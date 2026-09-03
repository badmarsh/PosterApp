/**
 * Expert Review Generation Engine.
 *
 * Implements COPE, Nature, PLOS, and EQUATOR Network standards for scientific paper
 * and academic thesis peer reviews.
 *
 * Produces structured findings with explicit evidence anchors (quotes from text),
 * epistemic status validation, separated Major/Minor concerns, reporting guideline compliance checks,
 * calibrated defense questions, and proposed grade ranges.
 */

import { generateAIResponse } from "@/lib/ai/client"
import { resolveAiModel } from "@/lib/ai/models"
import { wrapUntrustedContext } from "@/lib/ai/prompts"
import { z } from "zod"
import {
  ProfessionalReviewGenerationSchema,
  type ProfessionalReviewGenerationResult,
  type ReviewFindingContract,
} from "./contracts"
import {
  loadThesisContext,
  routeSectionsForCriterion,
  type ThesisRAGContext,
} from "./thesis-context"
import type {
  ReviewKind,
  ReportingStandard,
  ReviewFinding,
  EvidenceReference,
  EvidenceState,
  EpistemicStatus,
  ReviewDefenseQuestion,
} from "./review-types"
import { THESIS_LEVEL_PROFILES, formatGradeAnchorsText, type ReviewLanguage, type ThesisType, type ReviewTone } from "./thesis-rubric"
import { sortFindingsByPriority } from "./review-priorities"
import {
  extractDocumentStructure,
  computeSourceRevision,
  type DetailedThesisType,
} from "./document-understanding"
import {
  checkObjectiveAlignment,
  auditCitationConsistency,
  generateCalibratedDefenseQuestions,
} from "./academic-checks"
import {
  auditThesisCitations,
  fetchAcademicAuthorProfile,
  searchAcademicPaper,
  type AcademicPaperResult,
} from "@/lib/services/academic-connector"
import {
  validateAndCalibrateFindings,
  groundClaimInChunks,
  formatGroundedEvidenceBlock,
  verifyEvidenceQuote,
} from "./evidence-validator"
import {
  calculateGradeRange,
  getApplicableCriteriaForThesisType,
  SK_ACADEMIC_RUBRIC_V1,
  reconcileGrade,
  HARSH_OUTLIER_THRESHOLD,
  GRADE_DIVERGENCE_THRESHOLD,
  type GradeReconciliationResult,
} from "./rubric-engine"
import { THESIS_CRITERIA } from "./thesis-rubric"

export interface GenerateProfessionalReviewOptions {
  workspaceId: string
  sourceFileId?: string
  documentTitle: string
  authorName: string
  reviewKind: ReviewKind
  thesisType?: ThesisType
  reviewerRole?: string
  targetVenue?: string
  language: ReviewLanguage
  reviewTone?: ReviewTone
  reportingStandard?: ReportingStandard
  focusAreas?: string[]
  skipCitationAudit?: boolean
  /** Enables structured self-critique: two separate AI calls at different temperatures.
   *  Call 1 (temp=0.15): primary review generation.
   *  Call 2 (temp=0.60): adversarial critique that may add/reject/adjust findings.
   *  Named "multiAgentDebate" for backwards API compatibility.
   *  2× LLM cost, produces genuine divergence (separate sampling contexts). */
  multiAgentDebate?: boolean
  /** Methodology-level thesis classification (from `classifyDisciplineAndThesisType`).
   *  Drives which SK_ACADEMIC_RUBRIC_V1 criteria contribute cautionGuidance /
   *  prohibitedInferences to the prompt. Defaults to "unknown" — a separate axis from
   *  the degree-level `thesisType` above, with no conversion between them. */
  detailedThesisType?: DetailedThesisType
  /** Institution name — used to gate jurisdiction-specific statutory clauses (e.g. Slovak §54/131/2002). */
  institution?: string
  graphAugmentation?: string
  vectorAugmentation?: string
}

/**
 * Builds rubric-guidance prompt text from SK_ACADEMIC_RUBRIC_V1's per-criterion
 * `cautionGuidance` / `prohibitedInferences` for a given methodology thesis type.
 * This is the anti-over-penalization content rubric-engine.ts already defines, but
 * which previously never reached the generation prompt. Criteria ruled
 * "not_applicable" for the thesis type are excluded; the rest are emitted with their
 * localized label and (for "partially_applicable") an applicability caveat.
 */
export function buildRubricGuidanceText(
  thesisType: DetailedThesisType,
  language: ReviewLanguage
): string {
  const applicable = getApplicableCriteriaForThesisType(thesisType, SK_ACADEMIC_RUBRIC_V1).filter(
    ({ applicability }) => applicability !== "not_applicable"
  )

  if (applicable.length === 0) return ""

  const blocks: string[] = []
  for (const { criterion, applicability } of applicable) {
    const label = criterion.labels[language] ?? criterion.labels.en
    const caution = criterion.cautionGuidance[language] ?? criterion.cautionGuidance.en
    const prohibited = (criterion.prohibitedInferences[language] ?? criterion.prohibitedInferences.en)
      .map((rule) => `- ${rule}`)
      .join("\n")
    const applicabilityNote =
      applicability === "partially_applicable" ? " (partially applicable — apply with caution)" : ""
    blocks.push(`### ${label}${applicabilityNote}\nCaution: ${caution}\nDo not infer:\n${prohibited}`)
  }
  return blocks.join("\n\n")
}

/**
 * Pre-generation grounding (Task 5): runs groundClaimInChunks per criterion against
 * the RAG context sections. Returns formatted evidence blocks to inject BEFORE the
 * model writes, so it has verbatim best-matching sentences available up front.
 * PaperQA2 "retrieve → ground → generate" pattern.
 */
export async function buildPreGenerationGrounding(
  sections: Array<{ id: string; heading: string; content: string }>,
  language: ReviewLanguage
): Promise<string> {
  if (sections.length === 0) return ""

  const chunks = sections.map((s) => ({ id: s.id, heading: s.heading, content: s.content }))
  const grounds: Array<ReturnType<typeof formatGroundedEvidenceBlock> | null> = []

  for (const criterion of THESIS_CRITERIA) {
    if (criterion.id === "defense_questions") continue
    const label = criterion.labels[language] ?? criterion.labels.en
    const claimText = `${label}: ${criterion.guidance[language] ?? criterion.guidance.en}`
    const result = await groundClaimInChunks(claimText, chunks)
    const block = formatGroundedEvidenceBlock([result], label)
    if (block) grounds.push(block)
  }

  if (grounds.length === 0) return ""
  return `\n--- PRE-GENERATION EVIDENCE GROUNDING ---\n${grounds.join("\n")}`
}

// ---------------------------------------------------------------------------
// Grade computation from findings
// ---------------------------------------------------------------------------

/**
 * Derives a numeric score (0–100) from the actual severity distribution of
 * validated findings. Used to feed `calculateGradeRange` so the proposed grade
 * is coupled to the AI's own analysis rather than a hardcoded constant.
 *
 * Deduction schedule (calibrated for Slovak university theses):
 *  - critical:   −20 per finding (fatal flaws)
 *  - major:      −8  per finding (core weaknesses)
 *  - minor:      −2  per finding (secondary issues)
 *  - suggestion: −0.5 per finding (non-binding)
 *
 * Score is clamped to [10, 100] so even catastrophic results still produce
 * a displayable grade (FX) rather than a nonsensical negative number.
 */
export function computeScoreFromFindings(findings: ReviewFinding[]): number {
  const DEDUCTIONS: Record<string, number> = {
    critical: 20,
    major: 8,
    minor: 2,
    suggestion: 0.5,
  }
  let score = 100
  for (const f of findings) {
    const deduction = DEDUCTIONS[f.severity as string] ?? 0
    score -= deduction
  }
  return Math.min(100, Math.max(10, score))
}

/**
 * PhD-only guard: if NO finding touches originality/contribution at all (positive or
 * negative), that silence is itself worth flagging for a doctoral submission — absence
 * of any contribution discussion should not read as "nothing wrong, therefore excellent."
 * Returns a synthetic finding to append, or null if coverage already exists.
 */
export function checkContributionCoverage(
  findings: ReviewFinding[],
  thesisType: ThesisType | undefined,
  language: ReviewLanguage
): ReviewFinding | null {
  if (thesisType !== "phd") return null

  const touchesContribution = findings.some((f) => {
    const haystack = `${f.title} ${f.explanation}`.toLowerCase()
    return (
      f.category === "results" ||
      /origin|contribut|novelt|novel\b/i.test(haystack)
    )
  })
  if (touchesContribution) return null

  const texts: Record<ReviewLanguage, { title: string; explanation: string; recommendation: string }> = {
    sk: {
      title: "Chýba explicitné zhodnotenie vedeckého prínosu",
      explanation:
        "Žiadne zo zistení sa explicitne nevenuje originalite alebo vedeckému prínosu práce, čo je pri dizertačnej práci kľúčové kritérium. Absencia zistení k tejto téme nemusí znamenať, že prínos je bezproblémový — vyžaduje si to explicitnú manuálnu kontrolu.",
      recommendation:
        "Overte, či práca jasne formuluje a obhajuje svoj originálny vedecký prínos oproti súčasnému stavu poznania.",
    },
    cs: {
      title: "Chybí explicitní zhodnocení vědeckého přínosu",
      explanation:
        "Žádné ze zjištění se explicitně nevěnuje originalitě nebo vědeckému přínosu práce, což je u disertační práce klíčové kritérium. Absence zjištění k tomuto tématu nemusí znamenat bezproblémový přínos — vyžaduje explicitní manuální kontrolu.",
      recommendation:
        "Ověřte, zda práce jasně formuluje a obhajuje svůj originální vědecký přínos oproti současnému stavu poznání.",
    },
    en: {
      title: "No explicit assessment of scientific contribution",
      explanation:
        "None of the generated findings explicitly addresses originality or scientific contribution, which is the central criterion for a doctoral dissertation. The absence of findings on this topic should not be read as evidence the contribution is sound — it requires explicit manual verification.",
      recommendation:
        "Verify that the dissertation clearly articulates and defends its original scientific contribution relative to the state of the art.",
    },
  }
  const t = texts[language]
  const now = new Date().toISOString()

  return {
    id: "contribution-coverage-check",
    criterionId: "originality",
    criterionKey: "originality",
    title: t.title,
    findingType: "risk",
    epistemicStatus: "REQUIRES_HUMAN_VERIFICATION",
    explanation: t.explanation,
    recommendation: t.recommendation,
    severity: "major",
    category: "results",
    confidence: 0.6,
    evidence: [],
    evidenceState: "unverified",
    status: "unreviewed",
    decisionStatus: "needs_human_review",
    includeInExport: true,
    createdBy: "ai",
    createdAt: now,
    updatedAt: now,
  }
}

// ---------------------------------------------------------------------------
// Structured Self-Critique (Fix #3: replaces single-prompt multi-persona)
// ---------------------------------------------------------------------------

/** Zod schema for the adversarial self-critique API response */
const SelfCritiqueSchema = z.object({
  critiqueLog: z.string().default(""),
  overstatedIds: z.array(z.number()).default([]),
  missedWeaknesses: z.array(z.string()).default([]),
  severityAdjustments: z.array(z.object({
    id: z.number(),
    newSeverity: z.string(),
    reason: z.string(),
  })).default([]),
})
type SelfCritiqueResult = z.infer<typeof SelfCritiqueSchema>

/**
 * Adversarial self-critique: a second AI call at higher temperature that receives
 * the primary findings and must identify overstatements, missed positives, and
 * severity miscalibrations. Returns an adjusted finding list and a critique log.
 *
 * This is fundamentally different from the old single-call multi-persona approach:
 * - Separate sampling context → real stochastic divergence is possible
 * - Temperature 0.6 → the critique genuinely explores alternatives
 * - Structured output → adjustments are machine-parseable, not prose theater
 */
async function generateSelfCritique(
  primaryFindings: ReviewFinding[],
  documentTitle: string,
  language: ReviewLanguage,
  model: string
): Promise<{ adjustedFindings: ReviewFinding[]; critiqueLog: string }> {
  const findingsSummary = primaryFindings
    .map((f, i) => `[${i + 1}] (${f.severity}) ${f.title}: ${f.explanation?.slice(0, 200) ?? ""}`)
    .join("\n")

  const critiqueSysPrompt = `You are a rigorous adversarial reviewer performing a structured critique of a peer review draft. Your job is NOT to soften the review, but to:
1. Identify findings that are OVERSTATED relative to what the evidence supports.
2. Identify significant weaknesses that were MISSED entirely.
3. Flag any findings where severity is miscalibrated (too harsh or too lenient).
4. Confirm findings that are accurately stated and well-evidenced.

Respond strictly as JSON.`

  const critiqueUserPrompt = `Document under review: "${documentTitle}"

Draft findings from primary review:
${findingsSummary}

Respond with this JSON structure:
{
  "critiqueLog": "<2-4 sentence adversarial critique summary in ${language}>",
  "overstatedIds": [1, 3],
  "missedWeaknesses": ["<brief description of missed issue 1>", "<brief description of missed issue 2>"],
  "severityAdjustments": [
    { "id": 2, "newSeverity": "minor", "reason": "<brief reason>" }
  ]
}`

  let critiqueLog = ""
  let adjustedFindings = [...primaryFindings]

  try {
    const critiqueResult = await generateAIResponse<SelfCritiqueResult>("peer-review-critique", {
      model,
      systemPrompt: critiqueSysPrompt,
      userPrompt: critiqueUserPrompt,
      schema: SelfCritiqueSchema,
      // Higher temperature: we WANT divergence from the primary review
      temperature: 0.6,
    })

    critiqueLog = critiqueResult.critiqueLog || ""

    const explicitlyAdjustedIdx = new Set<number>()

    // Apply severity adjustments from the critique
    if (Array.isArray(critiqueResult.severityAdjustments)) {
      for (const adj of critiqueResult.severityAdjustments) {
        const idx = adj.id - 1 // findings are 1-indexed in the prompt
        if (idx >= 0 && idx < adjustedFindings.length && adj.newSeverity) {
          const validSeverities = ["critical", "major", "minor", "suggestion"]
          if (validSeverities.includes(adj.newSeverity)) {
            adjustedFindings[idx] = {
              ...adjustedFindings[idx],
              severity: adj.newSeverity as any,
              explanation: adjustedFindings[idx].explanation
                + `\n[Critique adjustment: ${adj.reason}]`,
            }
            explicitlyAdjustedIdx.add(idx)
          }
        }
      }
    }

    // Apply overstated-finding downgrades (one severity rung, human-review flag).
    // Skipped for findings already covered by an explicit severityAdjustments entry
    // above, since that carries a specific reason and should take precedence.
    const SEVERITY_LADDER = ["critical", "major", "minor", "suggestion"]
    if (Array.isArray(critiqueResult.overstatedIds)) {
      for (const id of critiqueResult.overstatedIds) {
        const idx = id - 1
        if (idx < 0 || idx >= adjustedFindings.length || explicitlyAdjustedIdx.has(idx)) continue
        const current = adjustedFindings[idx]
        const rung = SEVERITY_LADDER.indexOf(current.severity as string)
        if (rung < 0 || rung >= SEVERITY_LADDER.length - 1) continue // already lowest, or unknown severity
        const downgraded = SEVERITY_LADDER[rung + 1]
        adjustedFindings[idx] = {
          ...current,
          severity: downgraded as any,
          decisionStatus: "needs_human_review",
          explanation: current.explanation
            + `\n[Critique: flagged as potentially overstated relative to the evidence — downgraded from ${current.severity} to ${downgraded}. Reviewer should verify before export.]`,
        }
      }
    }

    // Append missed weakness summaries as new suggestion-level findings
    if (Array.isArray(critiqueResult.missedWeaknesses)) {
      const missedFindings: ReviewFinding[] = critiqueResult.missedWeaknesses
        .filter((w: string) => w && w.length > 10)
        .slice(0, 3) // cap to avoid inflating the finding count
        .map((weakness: string, i: number) => ({
          id: `critique-missed-${i + 1}`,
          criterionKey: "general",
          criterionId: "general",
          title: weakness.slice(0, 80),
          findingType: "weakness" as const,
          epistemicStatus: "REVIEWER_JUDGMENT" as const,
          explanation: weakness,
          recommendation: "",
          severity: "suggestion" as const,
          category: "methodology" as const,
          confidence: 0.5,
          evidence: [],
          evidenceState: "unverified" as const,
          status: "unreviewed" as const,
          decisionStatus: "open" as const,
          includeInExport: false, // critique-sourced; reviewer should confirm before exporting
          createdBy: "ai" as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }))
      adjustedFindings = [...adjustedFindings, ...missedFindings]
    }
  } catch (err) {
    // Self-critique is non-fatal — log the failure and continue with primary findings
    console.warn("[review-engine] Structured self-critique call failed (non-fatal):", err)
    critiqueLog = "[Structured self-critique skipped due to error]"
  }

  return { adjustedFindings, critiqueLog }
}

const REPORTING_CHECKLIST_PROMPTS: Record<ReportingStandard, string> = {
  consort: `
Examine adherence to CONSORT 2025 (Randomized Trials):
- Trial design and rationale
- Participant eligibility criteria and settings
- Randomization method, allocation concealment sequence, and implementation
- Blinding / masking procedures
- Clear definition of primary vs secondary outcomes
- Sample size determination and statistical power
- Flow of participants (recruitment, losses, exclusions)
- Intention-to-treat analysis
- Reporting of all harms / adverse events
`,
  prisma: `
Examine adherence to PRISMA 2020 (Systematic Reviews & Meta-Analyses):
- Explicit statement of research questions & eligibility criteria (PICO framework)
- Information sources and comprehensive search strategies (databases, registers)
- Selection process, data collection process, and list of all variables sought
- Risk of bias assessment in individual studies (e.g. RoB 2, ROBINS-I)
- Synthesis methods, effect measures, and certainty assessment (GRADE)
- Discussion of study limitations, publication bias, and registration/protocol numbers
`,
  strobe: `
Examine adherence to STROBE (Observational Studies: Cohort, Case-Control, Cross-Sectional):
- Clear presentation of setting, participants, eligibility criteria, and follow-up
- Explicit definition of exposures, outcomes, predictors, potential confounders, and effect modifiers
- Description of data sources, measurement methods, and efforts to address potential sources of bias
- Statistical methods including handling of missing data, loss to follow-up, and sensitivity analyses
- Reporting of unadjusted and confounder-adjusted estimates with 95% confidence intervals
`,
  ml_reproducibility: `
Examine adherence to ML Reproducibility Guidelines (NeurIPS / ICML / ICLR standard):
- Full mathematical formulation of algorithms and loss functions
- Specification of all hyperparameters, search ranges, selection criteria, and compute budget
- Dataset documentation, data splits (train/val/test), preprocessing pipelines, and leak prevention
- Source code / repository availability, dependencies, random seed variance, and hardware environment
- Error bars, confidence intervals, statistical significance tests across multiple random seeds
- Direct comparison with standard established baseline models under identical conditions
`,
  none: `
Focus on general scientific rigor:
- Novelty and significance of the contributions
- Soundness of theoretical justifications and experimental methodology
- Validity and statistical rigor of results and conclusions
- Completeness of literature review and appropriate citation of foundational works
`,
}

/**
 * Searches for finding evidence quotes in the parsed sections and attaches
 * precise section headings, line/character offsets, and verified status.
 */
export function anchorEvidenceQuotes(
  findings: Array<Partial<ReviewFindingContract> & { title: string; explanation?: string; severity?: any; category?: any; evidence?: any[] }>,
  rag: ThesisRAGContext,
  sourceRevision?: string
): ReviewFinding[] {
  return findings.map((f, idx) => {
    const rawEvidence = f.evidence || []
    const enrichedEvidence: EvidenceReference[] = rawEvidence.map((ev, evIdx) => {
      const evidence: EvidenceReference = {
        id: `ev-${idx + 1}-${evIdx + 1}`,
        quote: ev.quote || "",
        page: ev.page,
        sectionHeading: ev.sectionHeading,
        sectionTitle: ev.sectionHeading,
        sourceRevision,
      }
      return verifyEvidenceQuote(evidence, rag.fullText, rag.sections, sourceRevision)
    })

    const overallFindingState: EvidenceState = enrichedEvidence.some((e) => e.state === "stale")
      ? "stale"
      : enrichedEvidence.length > 0 && enrichedEvidence.every((e) => e.state === "verified-exact")
      ? "verified-exact"
      : enrichedEvidence.length > 0 && enrichedEvidence.every((e) => e.state === "verified-exact" || e.state === "verified-normalized")
      ? "verified-normalized"
      : enrichedEvidence.some((e) => e.state === "ambiguous")
      ? "ambiguous"
      : enrichedEvidence.some((e) => e.state === "approximate")
      ? "approximate"
      : "unverified"

    return {
      id: f.id || `finding-${idx + 1}`,
      criterionKey: f.criterionKey || f.criterionId,
      criterionId: f.criterionId || f.criterionKey,
      title: f.title,
      findingType: f.findingType || "weakness",
      epistemicStatus: f.epistemicStatus || "REVIEWER_JUDGMENT",
      explanation: f.explanation || "",
      recommendation: f.recommendation || "",
      suggestedRevision: f.suggestedRevision,
      severity: f.severity,
      category: f.category,
      confidence: f.confidence ?? 0.85,
      impact: f.impact,
      evidence: enrichedEvidence,
      evidenceState: overallFindingState,
      status: "unreviewed",
      decisionStatus: "open",
      includeInExport: true,
      createdBy: "ai",
      sourceRevision,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  })
}

/**
 * Generates an expert peer review using server-side AI with COPE/EQUATOR grounding.
 */
export async function generateProfessionalReview(
  options: GenerateProfessionalReviewOptions
): Promise<ProfessionalReviewGenerationResult & {
  anchoredFindings: ReviewFinding[]
  sourceRevision: string
  proposedGradeRange: string
  /** Severity-weighted numeric score [10–100] computed from anchoredFindings */
  derivedScore: number
  /** Adversarial self-critique log (only set when multiAgentDebate=true) */
  debateLog?: string
  defenseQuestions: ReviewDefenseQuestion[]
  phdEnrichment?: any
}> {
  const rag = await loadThesisContext({
    workspaceId: options.workspaceId,
    sourceFileId: options.sourceFileId,
    thesisMetadata: {
      studentName: options.authorName,
      thesisTitle: options.documentTitle,
      thesisType: options.thesisType || "master",
      reviewerRole: "opponent",
      language: options.language,
    },
    maxChars: 80_000,
  })

  if (rag.totalChars === 0) {
    const err = new Error("No readable source text found in workspace.")
    ;(err as any).statusCode = 422
    ;(err as any).code = "REVIEW_SOURCE_REQUIRED"
    throw err
  }

  const sourceRevision = computeSourceRevision(rag.fullText)
  const structure = extractDocumentStructure(rag.fullText, {
    thesisTitle: options.documentTitle,
    studentName: options.authorName,
  })

  const standard = options.reportingStandard || "none"
  const standardGuidance = REPORTING_CHECKLIST_PROMPTS[standard]

  let levelExpectationsText = ""
  if (options.thesisType && THESIS_LEVEL_PROFILES[options.thesisType]) {
    const profile = THESIS_LEVEL_PROFILES[options.thesisType]
    levelExpectationsText = `
--- THESIS LEVEL EXPECTATIONS (${options.thesisType.toUpperCase()}) ---
Originality Expectation: ${profile.originalityExpectation}
Methodology Expectation: ${profile.methodologyExpectation}
Key Minimum Requirements for this Level:
${profile.evidenceExpectations.map(e => `- ${e}`).join("\n")}

${formatGradeAnchorsText(profile, options.language)}
`
  }

  const effectiveThesisType: DetailedThesisType = options.detailedThesisType ?? "unknown"
  const rubricGuidanceText = buildRubricGuidanceText(effectiveThesisType, options.language)
  const preGroundingText = await buildPreGenerationGrounding(rag.sections, options.language)

  const effectiveReviewTone: ReviewTone = options.reviewTone ?? (options.reviewerRole === "supervisor" || options.reviewerRole === "self" ? "constructive" : "formal")

  const systemPrompt = effectiveReviewTone === "constructive"
    ? `You are an experienced academic supervisor and mentor performing a rigorous, evidence-grounded assessment of a student manuscript.

CRITICAL INSTRUCTIONS ON TONE AND FRAMING:
1. Do not write this as a final judgment. Write this as constructive guidance for the student. Frame weaknesses as areas for improvement before submission.
2. Ground every finding in direct evidence from the manuscript. Quote specific sentences or passages in the "evidence" field.
3. Be constructive, pedagogical, and actionable. Identify what needs strengthening, missing elements, and methodological gaps. Frame weaknesses as concrete areas for improvement before submission. State what the issue is, why it matters, and how the student can fix or improve it.
4. Tag every finding with an explicit "epistemicStatus":
   - "SUPPORTED_FACT": Directly demonstrated fact citing exact quotation.
   - "SUPPORTED_INTERPRETATION": Logical inference grounded in stated evidence.
   - "REVIEWER_JUDGMENT": Evaluative appraisal of quality or style.
   - "MISSING_EVIDENCE": Required information that could not be verified in the supplied text.
   - "POSSIBLE_RISK": Potential risk or limitation framed conditionally.
   - "REQUIRES_HUMAN_VERIFICATION": Area requiring verification in original complete PDF.
5. Differentiate strictly between severity levels:
   - "critical": Fatal ethical or methodological errors precluding publication/pass.
   - "major": Core methodological flaws, inadequate baselines, missing controls, or unsubstantiated claims.
   - "minor": Unclear formulations, minor typographical errors, formatting, or secondary references.
   - "suggestion": Constructive non-binding recommendations for future work.
6. If checking reporting guidelines (${standard}), evaluate whether each key requirement is compliant, partial, or missing.
7. All assessment text MUST be written in the specified language: "${options.language}".
8. Output MUST strictly match the requested JSON schema.
9. WARNING: Do not invent causal or logical relationships between separate quotes. If you cite two separate passages in one finding, the relationship between them must also be explicitly supported by the text.
  ${options.multiAgentDebate ? `
10. CRITICAL RIGOUR PASS: Before finalising the JSON, review your draft findings for:
   - Any finding where the stated severity is higher than the evidence actually supports → downgrade it.
   - Any methodological gap you may have missed on first pass → add it.
   The final output must represent your most calibrated, evidence-grounded judgment.` : ""}`
    : `You are a distinguished senior peer reviewer and academic expert performing a highly critical, rigorous, evidence-grounded review of a manuscript following COPE Ethical Guidelines and Nature/PLOS standards.

CRITICAL INSTRUCTIONS:
1. Ground every finding in direct evidence from the manuscript. Quote specific sentences or passages in the "evidence" field.
2. Be extremely critical and rigorous. Explicitly identify WHAT IS MISSING (missing controls, missing literature, untested edge cases), WHAT IS WRONG (flawed methodology, statistical errors, unjustified claims), and WHAT IS FILLER (redundant sections, irrelevant background, fluff). Do not hold back on identifying weaknesses.
3. Tag every finding with an explicit "epistemicStatus":
   - "SUPPORTED_FACT": Directly demonstrated fact citing exact quotation.
   - "SUPPORTED_INTERPRETATION": Logical inference grounded in stated evidence.
   - "REVIEWER_JUDGMENT": Evaluative appraisal of quality or style.
   - "MISSING_EVIDENCE": Required information that could not be verified in the supplied text.
   - "POSSIBLE_RISK": Potential risk or limitation framed conditionally.
   - "REQUIRES_HUMAN_VERIFICATION": Area requiring verification in original complete PDF.
4. Differentiate strictly between severity levels:
   - "critical": Fatal ethical or methodological errors precluding publication/pass.
   - "major": Core methodological flaws, inadequate baselines, missing controls, or unsubstantiated claims.
   - "minor": Unclear formulations, minor typographical errors, formatting, or secondary references.
   - "suggestion": Constructive non-binding recommendations for future work.
5. Be constructive, professional, and actionable. State what the issue is, why it matters, and how the authors can fix it.
6. If checking reporting guidelines (${standard}), evaluate whether each key requirement is compliant, partial, or missing.
7. All assessment text MUST be written in the specified language: "${options.language}".
8. Output MUST strictly match the requested JSON schema.
9. WARNING: Do not invent causal or logical relationships between separate quotes. If you cite two separate passages in one finding, the relationship between them must also be explicitly supported by the text.
  ${options.multiAgentDebate ? `
10. CRITICAL RIGOUR PASS: Before finalising the JSON, review your draft findings for:
   - Any finding where the stated severity is higher than the evidence actually supports → downgrade it.
   - Any methodological gap you may have missed on first pass → add it.
   The final output must represent your most calibrated, evidence-grounded judgment.` : ""}`

  const userPrompt = `Please evaluate the following academic manuscript and generate a comprehensive, structured peer review.

--- MANUSCRIPT METADATA ---
Document Title: ${options.documentTitle}
Author(s): ${options.authorName}
Review Type: ${options.reviewKind} ${options.thesisType ? `(${options.thesisType})` : ""}
Target Venue: ${options.targetVenue || "Academic Review"}
Reviewer Role: ${options.reviewerRole || "Expert Reviewer"}
Language: ${options.language}
Reporting Standard: ${standard}
Source Revision: ${sourceRevision}

--- REPORTING GUIDELINE FOCUS ---
${standardGuidance}
${levelExpectationsText}
${rubricGuidanceText ? `--- RUBRIC ANTI-OVER-PENALIZATION GUIDANCE (sk-academic-v1) ---\n${rubricGuidanceText}\n` : ""}

${options.graphAugmentation ? `--- KNOWLEDGE GRAPH (MULTI-HOP REASONING) ---\n${options.graphAugmentation}\n` : ""}
${options.vectorAugmentation ? `--- RELEVANT EXTRACTED CONTEXT (VECTOR RAG) ---\n${options.vectorAugmentation}\n` : ""}
${preGroundingText}

--- MANUSCRIPT EXCERPTS ---
${wrapUntrustedContext("manuscript_text", rag.fullText)}

--- RESPONSE JSON FORMAT ---
Respond with a valid JSON object matching this structure:
{
  "summary": "High-level summary of the paper's core premise, contribution, and primary novelty in ${options.language}",
  "strengths": [
    "Key strength 1 with specific merit",
    "Key strength 2"
  ],
  "findings": [
    {
      "id": "f-1",
      "category": "methodology | results | statistics | literature | reproducibility | ethics | formal",
      "findingType": "strength | weakness | risk | missing_evidence | question | recommendation",
      "epistemicStatus": "SUPPORTED_FACT | SUPPORTED_INTERPRETATION | REVIEWER_JUDGMENT | MISSING_EVIDENCE | POSSIBLE_RISK | REQUIRES_HUMAN_VERIFICATION",
      "title": "Clear concise title of the observation",
      "explanation": "Detailed scientific critique explaining why this is a concern",
      "recommendation": "Concrete actionable advice on how the author can address this",
      "severity": "critical | major | minor | suggestion",
      "confidence": 0.9,
      "sourceRevision": "The source revision hash provided in the metadata",
      "evidence": [
        {
          "sectionHeading": "Name of section",
          "quote": "Direct verbatim quote from the text demonstrating the issue"
        }
      ]
    }
  ],
  "reportingStandard": "${standard}",
  "reportingGuidelineChecks": [
    {
      "item": "Requirement name",
      "category": "Design | Statistics | Ethics | Data",
      "status": "compliant | partial | missing | not_applicable",
      "notes": "Assessment of adherence",
      "evidenceQuote": "Optional supporting quote"
    }
  ],
  "questionsForAuthors": [
    "Targeted defense or revision question 1",
    "Targeted defense or revision question 2"
  ],
  "confidentialComments": "Optional confidential notes for the editor/committee",
  "recommendation": "accept | minor_revisions | major_revisions | reject",
  "grade": "${options.reviewKind === "thesis" ? "A | B | C | D | E | FX" : ""}"
}`

  const model = resolveAiModel("thesis")
  const validated = await generateAIResponse<ProfessionalReviewGenerationResult>("peer-review", {
    model,
    systemPrompt,
    userPrompt,
    schema: ProfessionalReviewGenerationSchema,
    temperature: 0.15, // slightly tighter than before for primary review
  })

  // 1. Initial quote anchoring
  const anchored = anchorEvidenceQuotes(validated.findings, rag, sourceRevision)

  // 2. Deterministic alignment and citation checks
  const alignCheck = checkObjectiveAlignment(structure, rag, options.language)
  const citeCheck = auditCitationConsistency(structure, rag, options.language)

  const mergedFindings = [...anchored, ...alignCheck.findings, ...citeCheck.findings]

  // 3. Epistemic validation & calibration
  const validationResult = validateAndCalibrateFindings(mergedFindings, rag.fullText, rag.sections, sourceRevision)
  let finalFindings = sortFindingsByPriority(validationResult.validatedFindings, options.language)

  // 3b. Structured self-critique — second AI call at higher temperature.
  // Only runs when multiAgentDebate=true. 2× LLM cost, genuine divergence.
  let critiqueLog: string | undefined
  if (options.multiAgentDebate && finalFindings.length > 0) {
    const critiqueResult = await generateSelfCritique(
      finalFindings,
      options.documentTitle,
      options.language,
      model
    )
    // Re-validate the critique-adjusted findings before using them
    const critiqueValidation = validateAndCalibrateFindings(
      critiqueResult.adjustedFindings,
      rag.fullText,
      rag.sections,
      sourceRevision
    )
    finalFindings = sortFindingsByPriority(critiqueValidation.validatedFindings, options.language)
    critiqueLog = critiqueResult.critiqueLog || undefined
  }

  // 3c. PhD-only guard: flag total silence on originality/contribution as a finding,
  // so it participates in computeScoreFromFindings rather than reading as "flawless."
  const contributionGuardFinding = checkContributionCoverage(finalFindings, options.thesisType, options.language)
  if (contributionGuardFinding) {
    finalFindings = [...finalFindings, contributionGuardFinding]
  }

  // 4. Calibrated defense questions (5-12)
  const calibratedQuestions = generateCalibratedDefenseQuestions(rag, finalFindings, options.thesisType || "master", options.language)

  // 5. Calculate proposed grade range — derived from actual finding severity, NOT hardcoded.
  // Uses severity-weighted deduction: critical=−20, major=−8, minor=−2, suggestion=−0.5
  // Clamped to [10, 100] so FX is the floor.
  // When reviewerRole === "self", skip ECTS grading derivation (Task 4)
  const isSelfTriage = options.reviewerRole === "self"
  const derivedScore = computeScoreFromFindings(finalFindings)
  const gradeRangeInfo = isSelfTriage
    ? { grade: undefined as any, range: "", minScore: derivedScore, maxScore: derivedScore }
    : calculateGradeRange(derivedScore)
  const { grade: reconciledGrade, note: gradeReconciliationNote } = isSelfTriage
    ? { grade: undefined as any, note: undefined }
    : reconcileGrade(
        validated.grade,
        derivedScore,
        gradeRangeInfo.grade
      )

  // 6. PhD Opponent Enrichment
  let phdEnrichment: any = null
  if (options.thesisType === "phd" && options.reviewerRole === "opponent") {
    let authorProfile = null
    let sotaBenchmarking: AcademicPaperResult[] = []
    let citationAudit = null

    try {
      const tasks = []
      
      tasks.push(
        fetchAcademicAuthorProfile(options.authorName)
          .then(res => { authorProfile = res })
          .catch(err => console.warn("Failed to fetch author profile", err))
      )
      
      tasks.push(
        searchAcademicPaper(options.documentTitle, 3, { yearFrom: new Date().getFullYear() - 2 })
          .then(res => { sotaBenchmarking = res })
          .catch(err => console.warn("Failed to fetch SOTA", err))
      )

      if (!options.skipCitationAudit && rag.referencesTitles.length > 0) {
        tasks.push(
          auditThesisCitations(rag.referencesTitles.slice(0, 20))
            .then(res => { citationAudit = res })
            .catch(err => console.warn("Failed to audit citations", err))
        )
      }

      await Promise.all(tasks)

      // Determine jurisdiction from institution name and language
      const institutionLower = options.institution?.toLowerCase() || ""

      let statutoryClause: string | undefined
      if (options.language === "sk" || 
          institutionLower.includes("slovak") || 
          institutionLower.includes("slovensk")) {
        statutoryClause = "Práca spĺňa všetky požiadavky kladené na dizertačné práce v zmysle § 54 ods. 3 Zákona č. 131/2002 Z. z. o vysokých školách a o zmene a doplnení niektorých zákonov."
      } else if (options.language === "cs" ||
                 institutionLower.includes("czech") ||
                 institutionLower.includes("česk") ||
                 institutionLower.includes("morav")) {
        statutoryClause = "Práce splňuje všechny požadavky kladené na dizertační práce v souladu s § 54 odst. 3 zákona č. 111/1998 Sb., o vysokých školách."
      }
      // Otherwise: no statutory clause (non-Slovak/Czech institution)

      const defenseQuestionsExternal: string[] = []
      if (sotaBenchmarking.length > 0) {
        const topSota = sotaBenchmarking[0]
        defenseQuestionsExternal.push(
          options.language === "sk"
            ? `Ako by ste porovnali Vaše výsledky so súčasným stavom poznania reprezentovaným prácou "${topSota.title}" (${topSota.year})?`
            : `How do your results compare to the state-of-the-art represented by "${topSota.title}" (${topSota.year})?`
        )
      }

      phdEnrichment = {
        authorProfile,
        sotaBenchmarking,
        statutoryClause,
        defenseQuestionsExternal,
        citationAudit,
      }
    } catch (e) {
      console.warn("PhD Enrichment failed", e)
    }
  }

  return {
    ...validated,
    grade: reconciledGrade,
    anchoredFindings: finalFindings,
    sourceRevision,
    proposedGradeRange: gradeRangeInfo.range,
    derivedScore,
    debateLog: [critiqueLog ?? validated.debateLog, gradeReconciliationNote]
      .filter(Boolean)
      .join("\n\n") || undefined,
    defenseQuestions: calibratedQuestions,
    phdEnrichment,
  }
}

export { calculateFindingPriority, sortFindingsByPriority } from "./review-priorities"
export {
  reconcileGrade,
  HARSH_OUTLIER_THRESHOLD,
  GRADE_DIVERGENCE_THRESHOLD,
  type GradeReconciliationResult,
} from "./rubric-engine"
