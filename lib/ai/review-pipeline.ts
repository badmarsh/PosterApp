/**
 * Shared review-generation pipeline used by:
 *   - the synchronous POST /thesis-review route, and
 *   - the detached SSE review job (lib/review-jobs.ts).
 *
 * It orchestrates retrieval, citation-anchored evidence, professional /
 * standard generation, optional agentic per-criterion decomposition and
 * self-critique, and persistence to ThesisReview. Stage progress is reported
 * through `onProgress`; an AbortSignal supports cancellation.
 */

import { prisma } from "@/lib/prisma"
import { generateAIResponse, getLastServedProvider, type AIProviderSource } from "./client"
import { ThesisReviewGenerationSchema, validateGeneratedSections } from "./contracts"
import { parseAiModelOverrides, resolveAiModelWithOverrides, parseAiApiKey, AI_TIMEOUTS } from "./models"
import {
  loadThesisContext,
  buildThesisContextHeader,
  buildFullGenerationContext,
  THESIS_CONTEXT_BUDGETS,
  THESIS_CONTEXT_SHARES,
} from "./thesis-context"
import type { ReviewLanguage, ThesisMetadata } from "./thesis-rubric"
import { auditThesisCitations } from "@/lib/services/academic-connector"
import {
  retrieveForCriterion,
  generateHypotheses,
  resolveThesisDomainContext,
  getThesisCriterionQueryExpansion,
} from "./vector-rag"
import { getFacultyRubricTemplate } from "./rubric-templates"
import {
  classifyDisciplineAndThesisType,
  detectReportingGuideline,
  computeSourceRevision,
} from "./document-understanding"
import {
  NO_FINDINGS_SYNTHESIS,
  getApplicableCriteriaForThesisType,
  SK_ACADEMIC_RUBRIC_V1,
  calculateGradeRange,
} from "./rubric-engine"
import { checkObjectiveAlignment, auditCitationConsistency } from "./academic-checks"
import { computeScoreFromFindings } from "./review-engine"
import { buildSystemPrompt, buildUserPrompt } from "./prompts-thesis"
import { buildPreGenerationGrounding } from "./review-engine"
import { runAgenticPerCriterionReview } from "./agentic-review"
import {
  normalizeDefenseQuestions,
  AUTO_APPLY_CONFIDENCE_THRESHOLD,
  shouldApplyEctsGrading,
  shouldUseProfessionalMode,
} from "./thesis-review-policy"
import type { ReviewStage } from "./review-stages"
import { stableEvidenceAnchor } from "./evidence-validator"

export interface PipelineParams {
  workspaceId: string
  userId: string
  body: any
  headers: Headers
  onProgress?: (stage: ReviewStage, detail?: string) => void
  signal?: AbortSignal
}

export interface PipelineResult {
  saved: { id: string }
  responsePayload: Record<string, unknown>
}

function throwIfCancelled(signal?: AbortSignal) {
  if (signal?.aborted) {
    const err = new Error("Review generation cancelled")
    err.name = "AbortError"
    throw err
  }
}

export async function runReviewPipeline(params: PipelineParams): Promise<PipelineResult> {
  const { workspaceId, body } = params
  const report = params.onProgress ?? (() => {})
  const signal = params.signal
  const lang = body.thesisMetadata.language as ReviewLanguage
  const reviewKind = body.thesisMetadata.reviewKind ?? "thesis"
  const isThesisReview = reviewKind === "thesis"
  const applyEctsGrading = shouldApplyEctsGrading(reviewKind, body.thesisMetadata.reviewerRole)

  const normalizedMetadata: ThesisMetadata = {
    studentName: body.thesisMetadata.studentName || "Študent / Autor",
    thesisTitle: body.thesisMetadata.thesisTitle,
    thesisType: body.thesisMetadata.thesisType,
    reviewerRole: body.thesisMetadata.reviewerRole === "supervisor"
      ? "supervisor"
      : body.thesisMetadata.reviewerRole === "self"
      ? "self"
      : body.thesisMetadata.reviewerRole === "reviewer"
      ? "reviewer"
      : "opponent",
    reviewerName: body.thesisMetadata.reviewerName,
    institution: body.thesisMetadata.institution,
    department: body.thesisMetadata.department,
    language: body.thesisMetadata.language,
    academicYear: body.thesisMetadata.academicYear,
    targetVenue: body.thesisMetadata.targetVenue,
    reviewKind,
  }

  report("loading_context", "loading manuscript")
  // 1. Load RAG context
  const ragContext = await loadThesisContext({
    workspaceId,
    thesisMetadata: normalizedMetadata,
    sourceFileId: body.sourceFileId,
    focusSections: body.focusCriteria,
    maxChars: 120_000,
  })
  if (ragContext.totalChars === 0 || !ragContext.fullText.trim()) {
    const err = new Error("Upload and parse a thesis document before generating a review.")
    ;(err as any).code = "THESIS_SOURCE_REQUIRED"
    ;(err as any).statusCode = 422
    throw err
  }

  throwIfCancelled(signal)
  const sourceRevision = computeSourceRevision(ragContext.fullText)
  const classification = classifyDisciplineAndThesisType(
    ragContext.fullText,
    {
      thesisTitle: body.thesisMetadata.thesisTitle,
      studentName: body.thesisMetadata.studentName,
      department: body.thesisMetadata.department,
      institution: body.thesisMetadata.institution,
      thesisType: body.thesisMetadata.thesisType,
    },
    lang
  )

  // Degree-level applicability is thesis-only. Papers use the full neutral
  // academic rubric rather than inheriting bachelor/master/PhD expectations.
  const rubricDocumentType = isThesisReview ? classification.thesisType : "unknown"
  const applicableCriteria = getApplicableCriteriaForThesisType(
    rubricDocumentType,
    SK_ACADEMIC_RUBRIC_V1
  ).filter(({ applicability }) => applicability !== "not_applicable")
  const applicableCriterionMap = new Map(
    applicableCriteria.map(({ criterion, applicability }) => [criterion.id, { criterion, applicability }])
  )

  const template = body.rubricTemplateId ? getFacultyRubricTemplate(body.rubricTemplateId) : null
  const weightOverrides = body.customWeights || (template ? Object.fromEntries(template.criteria.map((c) => [c.id, c.weight])) : null)

  const activeCriteria = SK_ACADEMIC_RUBRIC_V1.criteria
    .filter((c) => {
      if (body.focusCriteria?.length && !body.focusCriteria.includes(c.id)) return false
      return applicableCriterionMap.has(c.id)
    })
    .map((c) => {
      const weight = weightOverrides && weightOverrides[c.id] != null ? weightOverrides[c.id] : c.weight
      return {
        id: c.id,
        key: c.key,
        category: c.category,
        weight,
        labels: c.labels,
        description: c.description,
        cautionGuidance: c.cautionGuidance,
        prohibitedInferences: c.prohibitedInferences,
        guidance: {
          sk: `${c.description.sk}${c.cautionGuidance.sk ? ` Upozornenie: ${c.cautionGuidance.sk}` : ""}${c.prohibitedInferences.sk?.length ? ` Neusudzujte: ${c.prohibitedInferences.sk.join("; ")}` : ""}`,
          cs: `${c.description.cs}${c.cautionGuidance.cs ? ` Upozornění: ${c.cautionGuidance.cs}` : ""}${c.prohibitedInferences.cs?.length ? ` Nevyvozujte: ${c.prohibitedInferences.cs.join("; ")}` : ""}`,
          en: `${c.description.en}${c.cautionGuidance.en ? ` Caution: ${c.cautionGuidance.en}` : ""}${c.prohibitedInferences.en?.length ? ` Do not infer: ${c.prohibitedInferences.en.join("; ")}` : ""}`,
        },
      }
    })
  const activeCriterionIds = activeCriteria.map((c) => c.id)

  const detectedReportingGuideline = detectReportingGuideline(ragContext.fullText)
  let effectiveReportingStandard = body.thesisMetadata.reportingStandard ?? "none"
  let suggestedReportingStandard: string | null = null
  if (effectiveReportingStandard === "none" && detectedReportingGuideline !== "none") {
    if (classification.confidence >= AUTO_APPLY_CONFIDENCE_THRESHOLD) {
      effectiveReportingStandard = detectedReportingGuideline
    } else {
      suggestedReportingStandard = detectedReportingGuideline
    }
  }

  // Vector index readiness warning
  let vectorWarning: string | null = null
  try {
    const sourceFiles = await prisma.ingestFile.findMany({
      where: { workspaceId, status: "done" },
      select: { id: true, name: true, vectorStatus: true },
    })
    const indexing = sourceFiles.filter((f) => f.vectorStatus === "indexing")
    const pending = sourceFiles.filter((f) => f.vectorStatus === "pending")
    const error = sourceFiles.filter((f) => f.vectorStatus === "error")
    if (indexing.length > 0) {
      vectorWarning = `Vector index is still building for ${indexing.length} document(s). Review may have degraded RAG grounding. Wait ~1-2 min and try again, or click 'Reindexovať'.`
    } else if (pending.length > 0 && sourceFiles.every((f) => f.vectorStatus === "pending")) {
      vectorWarning = `No documents have been vector-indexed yet. Click 'Reindexovať' before generating to enable full RAG grounding.`
    } else if (error.length > 0) {
      vectorWarning = `Vector indexing failed for ${error.length} document(s). Try clicking 'Reindexovať'.`
    }
  } catch { /* non-fatal */ }

  // 2. Routed context
  const routedBudget = Math.floor(THESIS_CONTEXT_BUDGETS.fullGeneration * THESIS_CONTEXT_SHARES.routed)
  const vectorBudgetReserved = Math.floor(THESIS_CONTEXT_BUDGETS.fullGeneration * THESIS_CONTEXT_SHARES.vector)
  const { contextText: routedContext, selectedChars, truncated } = buildFullGenerationContext(ragContext, activeCriterionIds, routedBudget)

  // 3. Citation audit
  let citationAuditSummary = ""
  if (!body.skipCitationAudit && ragContext.referencesTitles.length > 0) {
    try {
      const audit = await auditThesisCitations(ragContext.referencesTitles.slice(0, 20))
      const issues = audit.results
        .filter((r) => !r.verification.found || r.iso690Issues.length > 0)
        .map((r) => {
          const msgs = r.iso690Issues.length > 0
            ? r.iso690Issues.map((iss) => (typeof iss === "string" ? iss : iss.message)).join("; ")
            : `Unverified: "${r.citedText.slice(0, 60)}"`
          return msgs
        })
      if (issues.length > 0) {
        citationAuditSummary = `\nCitation audit found ${audit.unverified} unverified references:\n` + issues.join("\n")
      }
    } catch (err) {
      console.warn("[review-pipeline] Citation audit failed, continuing:", err)
    }
  }

  // 2b. Vector RAG — per-criterion retrieval with citation anchors [cN].
  report("retrieval", `retrieval 0/${activeCriteria.length}`)
  const domainContext = resolveThesisDomainContext(normalizedMetadata)
  const modelOverrides = parseAiModelOverrides(params.headers)
  const clientApiKey = parseAiApiKey(params.headers)
  const criterionVectorContextParts = new Map<string, string>()
  const retrievedChunkMap = new Map<string, { anchor: string; heading: string | null; content: string; kind?: string }>()
  let retrievalDone = 0
  try {
    const hypotheses = await generateHypotheses(
      activeCriteria.map((c) => ({ id: c.id, label: c.labels[lang], guidance: c.guidance[lang] })),
      {
        thesisTitle: normalizedMetadata.thesisTitle,
        domainContext,
        lang,
        model: resolveAiModelWithOverrides("thesis", modelOverrides),
        apiKey: clientApiKey,
        workspaceId,
      }
    )

    const BATCH = 3
    for (let i = 0; i < activeCriteria.length; i += BATCH) {
      throwIfCancelled(signal)
      const batchC = activeCriteria.slice(i, i + BATCH)
      await Promise.all(
        batchC.map(async (c) => {
          const expansion = getThesisCriterionQueryExpansion(c.id, lang)
          const query = `${c.labels[lang]} ${c.guidance[lang]}`.slice(0, 300)
          const { chunks, communityContext } = await retrieveForCriterion(workspaceId, query, {
            topK: 8,
            lambda: 0.7,
            domainContext,
            criterionId: c.id,
            criterionExpansion: expansion,
            useHyDE: true,
            hypothesis: hypotheses[c.id],
            lang,
            compress: true,
            documentId: body.sourceFileId,
            includeCommunityContext: false,
          })
          if (chunks.length === 0) {
            if (communityContext) criterionVectorContextParts.set(c.id, communityContext)
            return
          }
          // Anchors derive solely from persistent chunk IDs. They therefore stay
          // stable across criterion order, async completion order, and deduplication.
          const labeled = chunks.map((ch) => {
            const anchor = stableEvidenceAnchor(ch.id)
            const existing = retrievedChunkMap.get(ch.id)
            if (!existing || ch.content.length > existing.content.length) {
              retrievedChunkMap.set(ch.id, { anchor, heading: ch.heading, content: ch.content, kind: ch.kind })
            }
            return `[${anchor}]${ch.heading ? ` ${ch.heading}` : ""}\n${ch.content}`
          })
          const parts = [communityContext, `[VectorRAG:${c.id}]\n${labeled.join("\n\n")}`].filter(Boolean)
          criterionVectorContextParts.set(c.id, parts.join("\n\n"))
        })
      )
      retrievalDone += batchC.length
      report("retrieval", `retrieval ${retrievalDone}/${activeCriteria.length}`)
    }
  } catch (vectorErr) {
    if (vectorErr instanceof Error && vectorErr.name === "AbortError") throw vectorErr
    console.warn("[review-pipeline] pgvector augmentation skipped:", vectorErr)
  }

  const orderedVectorContext = activeCriteria
    .map((criterion) => criterionVectorContextParts.get(criterion.id))
    .filter((part): part is string => Boolean(part))
  const vectorAugmentation = orderedVectorContext.length > 0
    ? orderedVectorContext.join("\n\n---\n\n").slice(0, vectorBudgetReserved)
    : ""

  // 2c. GraphRAG augmentation
  let graphAugmentation = ""
  let graphWarning: string | null = null
  try {
    const { retrieveGraphContext } = await import("@/lib/ai/graph-rag")
    const graphBudget = Math.floor(THESIS_CONTEXT_BUDGETS.fullGeneration * THESIS_CONTEXT_SHARES.graph)
    if (graphBudget > 200) {
      const graphQuery = [normalizedMetadata.thesisTitle, ...activeCriteria.map((c) => c.labels[lang])].join(" ").slice(0, 500)
      const subgraph = await retrieveGraphContext(workspaceId, graphQuery, {
        charBudget: Math.min(4000, graphBudget),
        documentId: body.sourceFileId,
      })
      if (subgraph) {
        graphAugmentation = subgraph.serialized
        if (subgraph.truncated) {
          graphWarning = "GraphRAG knowledge graph context was truncated; some entity relationships may be missing."
        }
      } else {
        graphWarning = "No matching knowledge-graph entities found; GraphRAG augmentation skipped."
      }
    }
  } catch (graphErr) {
    console.warn("[review-pipeline] GraphRAG skipped:", graphErr)
    graphWarning = "GraphRAG augmentation failed unexpectedly and was skipped."
  }

  // 4. Prompts
  const preGroundingText = await buildPreGenerationGrounding(ragContext.sections, lang)
  const contextHeader = buildThesisContextHeader(normalizedMetadata, lang)
  const criteriaList = activeCriteria
    .map((c) => `[${c.id}] ${c.labels[lang]} (weight: ${c.weight}%)\nGuidance: ${c.guidance[lang]}`)
    .join("\n\n")

  const sourceContextWithAudit = routedContext
    + (preGroundingText ? `\n\n${preGroundingText}` : "")
    + (vectorAugmentation ? `\n\n[Vector-Retrieved Evidence — cite chunks by anchor, e.g. (c17)]\n${vectorAugmentation}` : "")
    + (graphAugmentation ? `\n\n[GraphRAG Knowledge Graph]\n${graphAugmentation}` : "")
    + (citationAuditSummary ? `\n\n[Citation Audit (Advisory)]\n${citationAuditSummary}` : "")

  const effectiveReviewTone = body.reviewTone ?? (normalizedMetadata.reviewerRole === "supervisor" || normalizedMetadata.reviewerRole === "self" ? "constructive" : "formal")
  const systemPrompt = buildSystemPrompt(lang, normalizedMetadata, effectiveReviewTone)
  const userPrompt = buildUserPrompt(normalizedMetadata, contextHeader, sourceContextWithAudit, criteriaList, lang, effectiveReviewTone)

  const useProfessionalMode = shouldUseProfessionalMode(
    body.professionalMode,
    reviewKind,
    effectiveReportingStandard,
    body.thesisMetadata.thesisType,
    body.thesisMetadata.reviewerRole
  )

  // Agentic decomposition opt-out (default ON for professional reviews; set
  // agenticReview:false to force the monolithic call).
  const useAgentic = useProfessionalMode && body.agenticReview !== false && process.env.AI_AGENTIC_REVIEW !== "false"

  let result: any
  let professionalResult: any = null
  let calibratedDefenseQuestions: string[] | null = null
  const reviewProvenance: { source?: AIProviderSource } = {}

  // Preserve the exact same stable anchor shown in retrieval context.
  const evidenceChunks = Array.from(retrievedChunkMap.entries()).map(([id, c]) => ({
    id,
    anchor: c.anchor,
    heading: c.heading,
    content: c.content,
    kind: c.kind,
  }))

  if (useAgentic) {
    // ---- Agentic per-criterion path (auditable, cacheable, no prefix truncation) ----
    report("criterion_reviews", `criterion reviews 0/${activeCriteria.length}`)
    const agentic = await runAgenticPerCriterionReview({
      workspaceId,
      sourceFileId: body.sourceFileId,
      documentTitle: body.thesisMetadata.thesisTitle,
      language: lang,
      reviewKind,
      thesisType: body.thesisMetadata.thesisType,
      detailedThesisType: rubricDocumentType,
      sourceRevision,
      signal,
      onProgress: (stage, detail) => report(stage as ReviewStage, detail),
      apiKey: clientApiKey,
      modelOverrides,
    })

    // Map findings onto sections (same attribution logic as monolithic path).
    const sections = activeCriteria.map((c) => {
      const matchingFindings = agentic.allFindings.filter((f: any) => {
        if (f.criterionId === c.id || f.criterionKey === c.id) return true
        if (c.id === "methodology_rigor" || c.id === "analytical_execution") return f.category === "methodology" || f.category === "statistics"
        if (c.id === "results_validity" || c.id === "discussion_relation") return f.category === "results" || f.category === "reproducibility"
        if (c.id === "citations_quality") return f.category === "literature"
        if (c.id === "problem_relevance" || c.id === "objectives_clarity") return f.category === "problem"
        if (c.id === "theoretical_background") return f.category === "theory"
        if (c.id === "originality_contribution") return f.category === "impact"
        if (c.id === "structure_coherence") return f.category === "formal"
        if (c.id === "ethics_transparency") return f.category === "ethics"
        if (c.id === "limitations_future_work") return f.category === "results" && f.findingType === "risk"
        return false
      })
      const text = matchingFindings.length > 0
        ? matchingFindings.map((f: any) => `• ${f.title}: ${f.explanation}`).join("\n\n")
        : (NO_FINDINGS_SYNTHESIS[lang] || NO_FINDINGS_SYNTHESIS.sk)
      const criterionScore = applyEctsGrading && matchingFindings.length > 0
        ? computeScoreFromFindings(matchingFindings)
        : undefined
      const criterionGrade = criterionScore !== undefined ? calculateGradeRange(criterionScore).grade : undefined
      return {
        id: c.id,
        sectionId: c.id,
        criterionId: c.id,
        text,
        rating: applyEctsGrading ? (criterionGrade ?? "pending") : ("pending" as const),
        numericScore: applyEctsGrading ? criterionScore : undefined,
        suggestions: matchingFindings.map((f: any) => f.recommendation).filter(Boolean),
      }
    })

    calibratedDefenseQuestions = normalizeDefenseQuestions(agentic.synthesis.defenseQuestions as any)
    const agenticScore = computeScoreFromFindings(agentic.allFindings)
    const agenticGradeRange = applyEctsGrading ? calculateGradeRange(agenticScore) : null
    professionalResult = {
      grade: agenticGradeRange?.grade ?? null,
      recommendation: agentic.synthesis.recommendation,
      summary: agentic.synthesis.summary,
      strengths: agentic.synthesis.strengths,
      anchoredFindings: agentic.allFindings,
      sourceRevision,
      proposedGradeRange: agenticGradeRange?.range ?? null,
      derivedScore: agenticScore,
      defenseQuestions: calibratedDefenseQuestions,
      contextCoverage: { totalChars: ragContext.totalChars, selectedChars, truncated },
      reportingGuidelineChecks: [],
      debateLog: undefined,
    }
    result = {
      sections,
      overallGrade: applyEctsGrading ? (professionalResult.grade ?? null) : null,
      recommendation: professionalResult.recommendation,
      defenseQuestions: calibratedDefenseQuestions,
      citationIssues: [],
    }
    report("synthesis", "synthesis complete")
  } else if (useProfessionalMode) {
    // ---- Monolithic professional path (with anchors, progress, cancel) ----
    report("primary_review", "primary review")
    const { generateProfessionalReview } = await import("./review-engine")
    professionalResult = await generateProfessionalReview({
      workspaceId,
      sourceFileId: body.sourceFileId,
      documentTitle: body.thesisMetadata.thesisTitle,
      authorName: body.thesisMetadata.studentName,
      reviewKind,
      thesisType: isThesisReview ? body.thesisMetadata.thesisType : undefined,
      detailedThesisType: rubricDocumentType,
      reviewerRole: body.thesisMetadata.reviewerRole,
      reviewTone: effectiveReviewTone,
      targetVenue: body.thesisMetadata.targetVenue,
      language: lang,
      reportingStandard: effectiveReportingStandard,
      multiAgentDebate: body.multiAgentDebate,
      institution: body.thesisMetadata.institution,
      graphAugmentation,
      vectorAugmentation,
      evidenceChunks: evidenceChunks.length > 0 ? evidenceChunks : undefined,
      onProgress: (stage: string, detail?: string) => report(stage as ReviewStage, detail),
      signal,
      apiKey: clientApiKey,
      modelOverrides,
    })
    calibratedDefenseQuestions = normalizeDefenseQuestions(professionalResult.defenseQuestions)

    const sections = activeCriteria.map((c) => {
      const matchingFindings = (professionalResult.anchoredFindings || []).filter((f: any) => {
        if (f.criterionId === c.id || f.criterionKey === c.id) return true
        if (c.id === "methodology_rigor" || c.id === "analytical_execution") return f.category === "methodology" || f.category === "statistics"
        if (c.id === "results_validity" || c.id === "discussion_relation") return f.category === "results" || f.category === "reproducibility"
        if (c.id === "citations_quality") return f.category === "literature"
        if (c.id === "problem_relevance" || c.id === "objectives_clarity") return f.category === "problem"
        if (c.id === "theoretical_background") return f.category === "theory"
        if (c.id === "originality_contribution") return f.category === "impact"
        if (c.id === "structure_coherence") return f.category === "formal"
        if (c.id === "ethics_transparency") return f.category === "ethics"
        if (c.id === "limitations_future_work") return f.category === "results" && f.findingType === "risk"
        return false
      })
      const text = matchingFindings.length > 0
        ? matchingFindings.map((f: any) => `• ${f.title}: ${f.explanation}`).join("\n\n")
        : (NO_FINDINGS_SYNTHESIS[lang] || NO_FINDINGS_SYNTHESIS.sk)
      const criterionScore = applyEctsGrading && matchingFindings.length > 0
        ? computeScoreFromFindings(matchingFindings)
        : undefined
      const criterionGrade = criterionScore !== undefined ? calculateGradeRange(criterionScore).grade : undefined
      return {
        id: c.id,
        sectionId: c.id,
        criterionId: c.id,
        text,
        rating: applyEctsGrading ? (criterionGrade ?? "pending") : ("pending" as const),
        numericScore: applyEctsGrading ? criterionScore : undefined,
        suggestions: matchingFindings.map((f: any) => f.recommendation).filter(Boolean),
      }
    })

    result = {
      sections,
      overallGrade: applyEctsGrading ? (professionalResult.grade ?? null) : null,
      recommendation: professionalResult.recommendation,
      defenseQuestions: calibratedDefenseQuestions,
      citationIssues: [],
    }
  } else {
    // ---- Path A: standard single-call review ----
    report("primary_review", "standard review generation")
    result = await generateAIResponse("thesis-review", {
      model: resolveAiModelWithOverrides("thesis", modelOverrides),
      systemPrompt,
      userPrompt,
      schema: ThesisReviewGenerationSchema,
      temperature: 0.15,
      signal: signal ?? AbortSignal.timeout(AI_TIMEOUTS.thesis),
      provenance: reviewProvenance,
      workspaceId,
    })
    throwIfCancelled(signal)
    validateGeneratedSections(result.sections, activeCriterionIds)

    const structure = (await import("./document-understanding")).extractDocumentStructure(ragContext.fullText, normalizedMetadata)
    const alignmentResult = checkObjectiveAlignment(structure, ragContext, lang)
    const citationAuditResult = auditCitationConsistency(structure, ragContext, lang)
    const deterministicCitationIssues = citationAuditResult.findings.map((f) => `${f.title}: ${f.explanation}`)
    result.citationIssues = Array.from(new Set([...(result.citationIssues || []), ...deterministicCitationIssues]))
    for (const f of alignmentResult.findings) {
      const targetId = f.criterionId || "objectives_clarity"
      const targetSec = result.sections.find((s: any) => s.id === targetId || s.sectionId === targetId || s.criterionId === targetId)
      if (targetSec && f.recommendation) {
        targetSec.suggestions = Array.from(new Set([...(targetSec.suggestions || []), f.recommendation]))
      }
    }
  }

  // Recommendation / triage. Paper and grant reviews use publication verdicts
  // only; ECTS fields are deterministically cleared regardless of model output.
  if (!applyEctsGrading) {
    result.overallGrade = null
    if (normalizedMetadata.reviewerRole === "self") {
      result.recommendation = result.recommendation || (lang === "sk" ? "Predkonzultačný rozbor konceptu práce." : lang === "cs" ? "Předkonzultační rozbor konceptu práce." : "Pre-consultation draft triage.")
    }
    if (professionalResult) {
      professionalResult.grade = null
      professionalResult.proposedGradeRange = null
    }
  } else if (!result.recommendation && result.overallGrade) {
    const { gradeToRecommendation } = await import("./thesis-rubric")
    result.recommendation = gradeToRecommendation(result.overallGrade, lang)
  }

  const providerProvenance = reviewProvenance.source ?? getLastServedProvider()
  let finalDebateLog = professionalResult?.debateLog ?? null
  if (providerProvenance === "fallback-provider") {
    const fallbackNote = `[Provider Fallback] Review generated via fallback provider.`
    finalDebateLog = finalDebateLog ? `${finalDebateLog}\n${fallbackNote}` : fallbackNote
  }

  // 9. Persist
  report("persisting", "saving review")
  const saved = await prisma.thesisReview.create({
    data: {
      workspaceId,
      studentName: body.thesisMetadata.studentName,
      thesisTitle: body.thesisMetadata.thesisTitle,
      thesisType: body.thesisMetadata.thesisType,
      reviewerRole: body.thesisMetadata.reviewerRole,
      reviewerName: body.thesisMetadata.reviewerName ?? null,
      institution: body.thesisMetadata.institution ?? null,
      department: body.thesisMetadata.department ?? null,
      grade: applyEctsGrading ? (result.overallGrade ?? null) : null,
      suggestedGrade: applyEctsGrading ? (professionalResult?.grade ?? result.overallGrade ?? null) : null,
      recommendation: result.recommendation,
      suggestedRecommendation: professionalResult?.recommendation ?? result.recommendation ?? null,
      sections: JSON.stringify(result.sections),
      defenseQuestions: JSON.stringify(calibratedDefenseQuestions ?? result.defenseQuestions),
      citationIssues: JSON.stringify([...result.citationIssues, ...(citationAuditSummary ? [citationAuditSummary] : [])]),
      reviewKind,
      targetVenue: body.thesisMetadata.targetVenue ?? null,
      summary: professionalResult?.summary ?? null,
      strengths: professionalResult?.strengths ? JSON.stringify(professionalResult.strengths) : null,
      findings: professionalResult?.anchoredFindings ? JSON.stringify(professionalResult.anchoredFindings) : null,
      sourceRevision: professionalResult?.sourceRevision ?? sourceRevision,
      rubricVersion: "sk-academic-v1",
      discipline: body.thesisMetadata.targetVenue ?? null,
      proposedGradeRange: applyEctsGrading ? (professionalResult?.proposedGradeRange ?? null) : null,
      confidence: 0.88,
      limitationsSummary: null,
      reportingStandard: effectiveReportingStandard,
      reportingGuidelineChecks: professionalResult?.reportingGuidelineChecks ? JSON.stringify(professionalResult.reportingGuidelineChecks) : null,
      confidentialComments: professionalResult?.confidentialComments ?? null,
      debateLog: finalDebateLog,
      phdEnrichment: professionalResult?.phdEnrichment ? JSON.stringify(professionalResult.phdEnrichment) : null,
      status: "draft",
      language: lang,
    },
  })

  report("done", "review complete")

  const responsePayload = {
    id: saved.id,
    ...result,
    reviewKind,
    targetVenue: body.thesisMetadata.targetVenue,
    summary: professionalResult?.summary,
    strengths: professionalResult?.strengths ?? [],
    findings: professionalResult?.anchoredFindings ?? [],
    sourceRevision: professionalResult?.sourceRevision ?? sourceRevision,
    rubricVersion: "sk-academic-v1",
    proposedGradeRange: professionalResult?.proposedGradeRange,
    derivedScore: professionalResult?.derivedScore,
    reportingStandard: effectiveReportingStandard,
    suggestedReportingStandard,
    disciplineClassification: classification
      ? { primaryDiscipline: classification.primaryDiscipline, thesisType: classification.thesisType, confidence: classification.confidence }
      : null,
    reportingGuidelineChecks: professionalResult?.reportingGuidelineChecks ?? [],
    confidentialComments: professionalResult?.confidentialComments,
    phdEnrichment: professionalResult?.phdEnrichment ?? null,
    providerProvenance,
    vectorWarning,
    graphWarning,
    agentic: useAgentic,
    ragStats: {
      totalChars: ragContext.totalChars,
      selectedChars: professionalResult?.contextCoverage?.selectedChars ?? selectedChars,
      truncated: professionalResult?.contextCoverage?.truncated ?? truncated,
      referencesFound: ragContext.referencesTitles.length,
      citationAuditRan: !body.skipCitationAudit && ragContext.referencesTitles.length > 0,
      evidenceChunks: retrievedChunkMap.size,
    },
  }

  return { saved, responsePayload }
}
