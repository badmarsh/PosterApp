/**
 * POST /api/workspaces/[id]/thesis-review
 *
 * Generates a complete thesis assessment (posudok) using:
 *  1. RAG from MinerU-parsed thesis documents
 *  2. Academic Connector for citation verification
 *  3. AI generation via ThesisReviewGenerationSchema
 *
 * Rate limit: 3 requests per 5 minutes per user.
 */

import { NextRequest, NextResponse } from "next/server"
import { rateLimitAsync } from "@/lib/rate-limit"
import { requireWorkspaceEditor } from "@/lib/auth"
import { generateAIResponse, getLastServedProvider, type AIProviderSource } from "@/lib/ai/client"
import { ThesisReviewGenerationSchema, validateGeneratedSections } from "@/lib/ai/contracts"
import { parseAiModelOverrides, resolveAiModelWithOverrides, AI_TIMEOUTS } from "@/lib/ai/models"
import { wrapUntrustedContext } from "@/lib/ai/prompts"
import {
  loadThesisContext,
  buildThesisContextHeader,
  buildFullGenerationContext,
  THESIS_CONTEXT_BUDGETS,
} from "@/lib/ai/thesis-context"
import {
  THESIS_LEVEL_PROFILES,
  gradeToRecommendation,
  type ThesisMetadata,
  type ReviewLanguage,
  type ReviewTone,
} from "@/lib/ai/thesis-rubric"
import { auditThesisCitations } from "@/lib/services/academic-connector"
import {
  retrieveForCriterion,
  resolveThesisDomainContext,
  getThesisCriterionQueryExpansion,
} from "@/lib/ai/vector-rag"
import { getFacultyRubricTemplate } from "@/lib/ai/rubric-templates"
import { prisma } from "@/lib/prisma"
import {
  classifyDisciplineAndThesisType,
  detectReportingGuideline,
  extractDocumentStructure,
} from "@/lib/ai/document-understanding"
import {
  RUBRIC_CRITERIA_MAP,
  NO_FINDINGS_SYNTHESIS,
  getApplicableCriteriaForThesisType,
  SK_ACADEMIC_RUBRIC_V1,
} from "@/lib/ai/rubric-engine"
import {
  checkObjectiveAlignment,
  auditCitationConsistency,
} from "@/lib/ai/academic-checks"
import { buildPreGenerationGrounding } from "@/lib/ai/review-engine"
import { buildSystemPrompt, buildUserPrompt } from "@/lib/ai/prompts-thesis"
import { z } from "zod"

// Starting value; needs empirical tuning
export const AUTO_APPLY_CONFIDENCE_THRESHOLD = 0.8

export function shouldUseProfessionalMode(
  professionalMode: boolean | undefined,
  reviewKind: "thesis" | "paper" | "grant" | undefined,
  reportingStandard: string | undefined,
  thesisType?: "bachelor" | "master" | "phd" | undefined,
  reviewerRole?: string | undefined
): boolean {
  if (reviewerRole === "self") return true
  if (Boolean(professionalMode)) return true
  if (reviewKind === "paper") return true
  if (reportingStandard !== undefined && reportingStandard !== "none") return true
  if ((reviewKind === "thesis" || reviewKind === undefined) && (thesisType === "master" || thesisType === "phd")) return true
  return false
}

const ThesisMetadataSchema = z.object({
  studentName: z.string().max(200).default("Študent / Autor"),
  thesisTitle: z.string().min(1).max(500),
  thesisType: z.enum(["bachelor", "master", "phd"]).default("master"),
  reviewerRole: z.string().max(50).default("opponent"),
  reviewerName: z.string().max(200).optional(),
  institution: z.string().max(300).optional(),
  department: z.string().max(300).optional(),
  language: z.enum(["sk", "cs", "en"]).default("sk"),
  academicYear: z.string().max(20).optional(),
  reviewKind: z.enum(["thesis", "paper", "grant"]).default("thesis"),
  targetVenue: z.string().max(300).optional(),
  reportingStandard: z.enum(["consort", "prisma", "strobe", "ml_reproducibility", "none"]).default("none"),
})

const RequestBodySchema = z.object({
  thesisMetadata: ThesisMetadataSchema,
  /** Optional: specific file ID to review in multi-document workspaces */
  sourceFileId: z.string().optional(),
  /** Optional: restrict generation to specific criterion IDs */
  focusCriteria: z.array(z.string()).optional(),
  /** Skip Academic Connector citation audit (faster but less thorough) */
  skipCitationAudit: z.boolean().default(false),
  /** Enable full professional peer review mode with evidence anchors */
  professionalMode: z.boolean().optional(),
  /** Supervisory / guidance tone vs formal opponent evaluation */
  reviewTone: z.enum(["formal", "constructive"]).optional(),
  /** Enable multi-agent debate to mitigate hivemind bias */
  multiAgentDebate: z.boolean().optional().default(false),
  rubricTemplateId: z.string().optional(),
  customWeights: z.record(z.string(), z.number()).optional(),
})

export function normalizeDefenseQuestions(
  questions: Array<string | { question: string }>
): string[] {
  return questions.map((question) => typeof question === "string" ? question : question.question)
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params

  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId)) {
    return NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 })
  }

  let userId: string
  try {
    const access = await requireWorkspaceEditor(workspaceId)
    userId = access.userId
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:thesis-review`, 3, 300_000)
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limited", retryAfterMs },
      { status: 429, headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() } }
    )
  }

  let body: z.infer<typeof RequestBodySchema>
  try {
    const raw = await req.json()
    body = RequestBodySchema.parse(raw)
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body", details: String(err) }, { status: 400 })
  }

  const { thesisMetadata, focusCriteria, skipCitationAudit } = body
  const lang = thesisMetadata.language as ReviewLanguage

  const normalizedMetadata: ThesisMetadata = {
    studentName: thesisMetadata.studentName || "Študent / Autor",
    thesisTitle: thesisMetadata.thesisTitle,
    thesisType: thesisMetadata.thesisType,
    reviewerRole: thesisMetadata.reviewerRole === "supervisor"
      ? "supervisor"
      : thesisMetadata.reviewerRole === "self"
      ? "self"
      : "opponent",
    reviewerName: thesisMetadata.reviewerName,
    institution: thesisMetadata.institution,
    department: thesisMetadata.department,
    language: thesisMetadata.language,
    academicYear: thesisMetadata.academicYear,
    targetVenue: thesisMetadata.targetVenue,
    reviewKind: thesisMetadata.reviewKind,
  }

  try {
    // 1. Load RAG context from MinerU-parsed documents
    const ragContext = await loadThesisContext({
      workspaceId,
      thesisMetadata: normalizedMetadata,
      sourceFileId: body.sourceFileId,
      focusSections: focusCriteria,
      maxChars: 120_000,
    })
    // Strict Grounding Guard: Do not generate authoritative review without parsed source text
    if (ragContext.totalChars === 0 || !ragContext.fullText.trim()) {
      return NextResponse.json(
        {
          error: "THESIS_SOURCE_REQUIRED",
          message: "Upload and parse a thesis document before generating a review.",
        },
        { status: 422 }
      )
    }

    // 1c. Deterministic discipline and methodology classification
    const classification = classifyDisciplineAndThesisType(
      ragContext.fullText,
      {
        thesisTitle: thesisMetadata.thesisTitle,
        studentName: thesisMetadata.studentName,
        department: thesisMetadata.department,
        institution: thesisMetadata.institution,
        thesisType: thesisMetadata.thesisType,
      },
      lang
    )

    // TASK 2: Generate activeCriteria directly from SK_ACADEMIC_RUBRIC_V1.criteria
    const applicableCriteria = getApplicableCriteriaForThesisType(
      classification.thesisType,
      SK_ACADEMIC_RUBRIC_V1
    ).filter(({ applicability }) => applicability !== "not_applicable")

    const applicableCriterionMap = new Map(
      applicableCriteria.map(({ criterion, applicability }) => [criterion.id, { criterion, applicability }])
    )

    const template = body.rubricTemplateId ? getFacultyRubricTemplate(body.rubricTemplateId) : null
    const weightOverrides = body.customWeights || (template ? Object.fromEntries(template.criteria.map((c) => [c.id, c.weight])) : null)

    const activeCriteria = SK_ACADEMIC_RUBRIC_V1.criteria
      .filter((c) => {
        if (focusCriteria?.length && !focusCriteria.includes(c.id)) return false
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
    let effectiveReportingStandard = thesisMetadata.reportingStandard ?? "none"
    let suggestedReportingStandard: string | null = null

    if (effectiveReportingStandard === "none" && detectedReportingGuideline !== "none") {
      if (classification.confidence >= AUTO_APPLY_CONFIDENCE_THRESHOLD) {
        effectiveReportingStandard = detectedReportingGuideline
      } else {
        suggestedReportingStandard = detectedReportingGuideline
      }
    }

    // 1b. Vector index readiness check — detect race condition where user generates
    // a review before the fire-and-forget ingestDocumentChunks has finished.
    // This is informational only (we continue), but the warning surfaces in the API response.
    let vectorWarning: string | null = null
    try {
      const sourceFiles = await prisma.ingestFile.findMany({
        where: { workspaceId, status: "done" },
        select: { id: true, name: true, vectorStatus: true, vectorIndexedAt: true },
      })
      const indexingFiles = sourceFiles.filter((f) => f.vectorStatus === "indexing")
      const pendingFiles = sourceFiles.filter((f) => f.vectorStatus === "pending")
      const errorFiles = sourceFiles.filter((f) => f.vectorStatus === "error")
      if (indexingFiles.length > 0) {
        vectorWarning = `Vector index is still building for ${indexingFiles.length} document(s). Review may have degraded RAG grounding. Wait ~1-2 min and try again, or click 'Reindexovať'.`
      } else if (pendingFiles.length > 0 && sourceFiles.every((f) => f.vectorStatus === "pending")) {
        vectorWarning = `No documents have been vector-indexed yet. Click 'Reindexovať' before generating to enable full RAG grounding.`
      } else if (errorFiles.length > 0) {
        vectorWarning = `Vector indexing failed for ${errorFiles.length} document(s). Review may have degraded grounding. Try clicking 'Reindexovať'.`
      }
    } catch {
      // Non-fatal: vectorStatus check failure should not block review generation
    }

    // 2. Build full generation context using criterion-routed excerpts
    const { contextText: routedContext, selectedChars, truncated } = buildFullGenerationContext(
      ragContext,
      activeCriterionIds,
      THESIS_CONTEXT_BUDGETS.fullGeneration
    )

    // 3. Academic citation audit (optional)
    let citationAuditSummary = ""
    if (!skipCitationAudit && ragContext.referencesTitles.length > 0) {
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
        console.warn("[thesis-review] Citation audit failed, continuing:", err)
      }
    }

    // 2b. pgvector 6-stage RAG augmentation — per-criterion evidence retrieval.
    let vectorAugmentation = ""
    try {
      const domainContext = resolveThesisDomainContext(normalizedMetadata)
      const criterionVectorContextParts: string[] = []

      const CRITERIA_BATCH_SIZE = 3
      for (let i = 0; i < activeCriteria.length; i += CRITERIA_BATCH_SIZE) {
        const batch = activeCriteria.slice(i, i + CRITERIA_BATCH_SIZE)
        await Promise.all(
          batch.map(async (c) => {
            const expansion = getThesisCriterionQueryExpansion(c.id, lang)
            const query = `${c.labels[lang]} ${c.guidance[lang]}`.slice(0, 300)
            const { chunks, communityContext: localCommunityCtx } = await retrieveForCriterion(workspaceId, query, {
              topK: 4,
              lambda: 0.7,
              domainContext,
              criterionId: c.id,
              criterionExpansion: expansion,
              useHyDE: true,
              compress: true,
              documentId: body.sourceFileId,
              includeCommunityContext: c === activeCriteria[0],
            })
            if (localCommunityCtx) criterionVectorContextParts.push(localCommunityCtx)
            if (chunks.length === 0) return
            const chunkText = chunks
              .map((ch) => (ch.heading ? `### ${ch.heading}\n${ch.content}` : ch.content))
              .join("\n\n")
            criterionVectorContextParts.push(`[VectorRAG:${c.id}]\n${chunkText}`)
          })
        )
      }

      if (criterionVectorContextParts.length > 0) {
        // Budget: respect 60k char ceiling for the full prompt
        const usedChars = routedContext.length + citationAuditSummary.length + 1000
        const vectorBudget = Math.max(0, THESIS_CONTEXT_BUDGETS.fullGeneration - usedChars)
        vectorAugmentation = criterionVectorContextParts.join("\n\n---\n\n").slice(0, vectorBudget)
      }
    } catch (vectorErr) {
      // pgvector not yet indexed or unavailable — continue with disk-only context
      console.warn("[thesis-review] pgvector augmentation skipped:", vectorErr)
    }

    // 2c. GraphRAG augmentation — query-aware multi-hop subgraph retrieval.
    let graphAugmentation = ""
    let graphWarning: string | null = null
    try {
      const { retrieveGraphContext } = await import("@/lib/ai/graph-rag")
      const graphBudget = Math.max(
        0,
        THESIS_CONTEXT_BUDGETS.fullGeneration
          - routedContext.length
          - citationAuditSummary.length
          - vectorAugmentation.length
          - 500 // prompt scaffolding reserve
      )
      if (graphBudget > 200) {
        const graphQuery = [
          normalizedMetadata.thesisTitle,
          ...activeCriteria.map((c) => c.labels[lang]),
        ]
          .join(" ")
          .slice(0, 500)
        const subgraph = await retrieveGraphContext(workspaceId, graphQuery, {
          charBudget: Math.min(4000, graphBudget),
          documentId: body.sourceFileId,
        })
        if (subgraph) {
          graphAugmentation = subgraph.serialized
          if (subgraph.truncated) {
            graphWarning = "GraphRAG knowledge graph context was truncated to fit the remaining prompt budget; some entity relationships may be missing from this review."
          }
        } else {
          graphWarning = "No matching knowledge-graph entities were found for this thesis; GraphRAG augmentation was skipped (this is expected if documents haven't finished ingestion-time graph extraction yet)."
        }
      } else {
        graphWarning = `GraphRAG augmentation was skipped — insufficient character budget remaining (${graphBudget} of ${THESIS_CONTEXT_BUDGETS.fullGeneration} chars) after routed context, citation audit, and vector RAG. Consider narrowing focusCriteria or reducing reportingStandard scope.`
      }
    } catch (graphErr) {
      console.warn("[thesis-review] GraphRAG augmentation skipped:", graphErr)
      graphWarning = "GraphRAG augmentation failed unexpectedly and was skipped for this review."
    }

    // 4. Build AI prompts with pre-generation grounding (PaperQA2 retrieve-ground-generate)
    const preGroundingText = await buildPreGenerationGrounding(ragContext.sections, lang)
    const contextHeader = buildThesisContextHeader(normalizedMetadata, lang)
    const criteriaList = activeCriteria
      .map((c) => `[${c.id}] ${c.labels[lang]} (weight: ${c.weight}%)\nGuidance: ${c.guidance[lang]}`)
      .join("\n\n")

    const sourceContextWithAudit = routedContext
      + (preGroundingText ? `\n\n${preGroundingText}` : "")
      + (vectorAugmentation ? `\n\n[Vector-Retrieved Evidence]\n${vectorAugmentation}` : "")
      + (graphAugmentation ? `\n\n[GraphRAG Knowledge Graph]\n${graphAugmentation}` : "")
      + (citationAuditSummary ? `\n\n[Citation Audit (Advisory)]\n${citationAuditSummary}` : "")

    const effectiveReviewTone: ReviewTone = body.reviewTone ?? (thesisMetadata.reviewerRole === "supervisor" || thesisMetadata.reviewerRole === "self" ? "constructive" : "formal")
    const systemPrompt = buildSystemPrompt(lang, normalizedMetadata, effectiveReviewTone)
    const userPrompt = buildUserPrompt(normalizedMetadata, contextHeader, sourceContextWithAudit, criteriaList, lang, effectiveReviewTone)

    // A reviewer can opt in explicitly, and paper/reporting-standard/PhD/Master reviews always
    // use the professional path. Self-review pre-consultation triage also forces professional mode.
    const useProfessionalMode = shouldUseProfessionalMode(
      body.professionalMode,
      thesisMetadata.reviewKind,
      effectiveReportingStandard,
      thesisMetadata.thesisType,
      thesisMetadata.reviewerRole
    )
    let result: any
    let professionalResult: any = null
    let calibratedDefenseQuestions: string[] | null = null

    // Parse AI model overrides from request headers
    const modelOverrides = parseAiModelOverrides(req.headers)

    // Mutable provenance bag filled in by generateAIResponse; avoids the
    // race condition of the module-level getLastServedProvider singleton.
    const reviewProvenance: { source?: AIProviderSource } = {}

    if (useProfessionalMode) {
      const { generateProfessionalReview } = await import("@/lib/ai/review-engine")
      professionalResult = await generateProfessionalReview({
        workspaceId,
        sourceFileId: body.sourceFileId,
        documentTitle: thesisMetadata.thesisTitle,
        authorName: thesisMetadata.studentName,
        reviewKind: thesisMetadata.reviewKind,
        thesisType: thesisMetadata.thesisType,
        detailedThesisType: classification.thesisType,
        reviewerRole: thesisMetadata.reviewerRole,
        reviewTone: effectiveReviewTone,
        targetVenue: thesisMetadata.targetVenue,
        language: lang,
        reportingStandard: effectiveReportingStandard,
        multiAgentDebate: body.multiAgentDebate,
        institution: thesisMetadata.institution,
        graphAugmentation,
        vectorAugmentation,
      })
      calibratedDefenseQuestions = normalizeDefenseQuestions(professionalResult.defenseQuestions)

      const sections = activeCriteria.map((c) => {
        const matchingFindings = (professionalResult.anchoredFindings || []).filter((f: any) => {
          // Direct criterion matching
          if (f.criterionId === c.id || f.criterionKey === c.id) return true

          // Category fallbacks to ensure unmapped findings are attributed correctly across all 12 criteria
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

        return {
          id: c.id,
          sectionId: c.id,
          criterionId: c.id,
          text,
          rating: thesisMetadata.reviewerRole === "self" ? ("pending" as const) : (professionalResult.grade || "B"),
          numericScore: thesisMetadata.reviewerRole === "self" ? undefined : (professionalResult.derivedScore ?? 75),
          suggestions: matchingFindings.map((f: any) => f.recommendation).filter(Boolean),
        }
      })

      result = {
        sections,
        overallGrade: thesisMetadata.reviewerRole === "self" ? null : (professionalResult.grade || "B"),
        recommendation: professionalResult.recommendation,
        defenseQuestions: calibratedDefenseQuestions,
        citationIssues: [],
      }
    } else {
      // Path A: Standard review generation (Default)
      result = await generateAIResponse("thesis-review", {
        model: resolveAiModelWithOverrides("thesis", modelOverrides),
        systemPrompt,
        userPrompt,
        schema: ThesisReviewGenerationSchema,
        temperature: 0.15,
        signal: AbortSignal.timeout(AI_TIMEOUTS.thesis),
        provenance: reviewProvenance,
      })

      // Post-generation validation
      validateGeneratedSections(result.sections, activeCriterionIds)

      // Task 11: Deterministic academic checks on Path A
      const structure = extractDocumentStructure(ragContext.fullText, normalizedMetadata)
      const alignmentResult = checkObjectiveAlignment(structure, ragContext, lang)
      const citationAuditResult = auditCitationConsistency(structure, ragContext, lang)

      // 1. Merge citation consistency issues into result.citationIssues
      const deterministicCitationIssues = citationAuditResult.findings.map(
        (f) => `${f.title}: ${f.explanation}`
      )
      result.citationIssues = Array.from(
        new Set([...(result.citationIssues || []), ...deterministicCitationIssues])
      )

      // 2. Merge objective alignment suggestions into matching section suggestions directly
      for (const f of alignmentResult.findings) {
        const targetId = f.criterionId || "objectives_clarity"
        const targetSec = result.sections.find(
          (s: any) => s.id === targetId || s.sectionId === targetId || s.criterionId === targetId
        )
        if (targetSec && f.recommendation) {
          targetSec.suggestions = Array.from(
            new Set([...(targetSec.suggestions || []), f.recommendation])
          )
        }
      }
    }

    // 7. Compute recommendation or triage summary
    if (thesisMetadata.reviewerRole === "self") {
      result.overallGrade = null
      result.recommendation = result.recommendation || (lang === "sk" ? "Predkonzultačný rozbor konceptu práce." : lang === "cs" ? "Předkonzultační rozbor konceptu práce." : "Pre-consultation draft triage.")
      if (professionalResult) {
        professionalResult.grade = null
        professionalResult.proposedGradeRange = null
      }
    } else if (!result.recommendation && result.overallGrade) {
      result.recommendation = gradeToRecommendation(result.overallGrade, lang)
    }

    // 8. Record provider provenance (Task 13) in saved review and API response
    const providerProvenance = reviewProvenance.source ?? getLastServedProvider()
    let finalDebateLog = professionalResult?.debateLog ?? null
    if (providerProvenance === "fallback-provider") {
      const fallbackNote = `[Provider Fallback] Review generated via fallback provider.`
      finalDebateLog = finalDebateLog ? `${finalDebateLog}\n${fallbackNote}` : fallbackNote
    }

    // 9. Save to database
    const saved = await prisma.thesisReview.create({
      data: {
        workspaceId,
        studentName: thesisMetadata.studentName,
        thesisTitle: thesisMetadata.thesisTitle,
        thesisType: thesisMetadata.thesisType,
        reviewerRole: thesisMetadata.reviewerRole,
        reviewerName: thesisMetadata.reviewerName ?? null,
        institution: thesisMetadata.institution ?? null,
        department: thesisMetadata.department ?? null,
        grade: result.overallGrade ?? null,
        suggestedGrade: professionalResult?.grade ?? result.overallGrade ?? null,
        recommendation: result.recommendation,
        suggestedRecommendation: professionalResult?.recommendation ?? result.recommendation ?? null,
        sections: JSON.stringify(result.sections),
        defenseQuestions: JSON.stringify(calibratedDefenseQuestions ?? result.defenseQuestions),
        citationIssues: JSON.stringify([
          ...result.citationIssues,
          ...(citationAuditSummary ? [citationAuditSummary] : []),
        ]),
        reviewKind: thesisMetadata.reviewKind || "thesis",
        targetVenue: thesisMetadata.targetVenue ?? null,
        summary: professionalResult?.summary ?? null,
        strengths: professionalResult?.strengths ? JSON.stringify(professionalResult.strengths) : null,
        findings: professionalResult?.anchoredFindings ? JSON.stringify(professionalResult.anchoredFindings) : null,
        sourceRevision: professionalResult?.sourceRevision ?? null,
        rubricVersion: "sk-academic-v1",
        discipline: thesisMetadata.targetVenue ?? null,
        proposedGradeRange: professionalResult?.proposedGradeRange ?? null,
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

    return NextResponse.json({
      id: saved.id,
      ...result,
      reviewKind: thesisMetadata.reviewKind,
      targetVenue: thesisMetadata.targetVenue,
      summary: professionalResult?.summary,
      strengths: professionalResult?.strengths ?? [],
      findings: professionalResult?.anchoredFindings ?? [],
      sourceRevision: professionalResult?.sourceRevision,
      rubricVersion: "sk-academic-v1",
      proposedGradeRange: professionalResult?.proposedGradeRange,
      derivedScore: professionalResult?.derivedScore,
      reportingStandard: effectiveReportingStandard,
      suggestedReportingStandard,
      disciplineClassification: classification ? {
        primaryDiscipline: classification.primaryDiscipline,
        thesisType: classification.thesisType,
        confidence: classification.confidence,
      } : null,
      reportingGuidelineChecks: professionalResult?.reportingGuidelineChecks ?? [],
      confidentialComments: professionalResult?.confidentialComments,
      phdEnrichment: professionalResult?.phdEnrichment ?? null,
      providerProvenance,
      vectorWarning,
      graphWarning,
      ragStats: {
        totalChars: ragContext.totalChars,
        selectedChars,
        truncated,
        referencesFound: ragContext.referencesTitles.length,
        citationAuditRan: !skipCitationAudit && ragContext.referencesTitles.length > 0,
      },
    })
  } catch (error: unknown) {
    if (error instanceof Response) return error
    console.error("[thesis-review POST] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// GET — list all thesis reviews for a workspace
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params

  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId)) {
    return NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 })
  }

  try {
    const access = await requireWorkspaceEditor(workspaceId)
    void access
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const reviews = await prisma.thesisReview.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      studentName: true,
      thesisTitle: true,
      thesisType: true,
      reviewerRole: true,
      reviewerName: true,
      institution: true,
      department: true,
      grade: true,
      suggestedGrade: true,
      finalGrade: true,
      recommendation: true,
      suggestedRecommendation: true,
      finalRecommendation: true,
      reviewKind: true,
      targetVenue: true,
      sourceRevision: true,
      rubricVersion: true,
      discipline: true,
      proposedGradeRange: true,
      confidence: true,
      limitationsSummary: true,
      reportingStandard: true,
      confirmedAt: true,
      status: true,
      language: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ reviews })
}
