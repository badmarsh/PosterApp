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
import type { ReviewLanguage, ThesisType } from "./thesis-rubric"
import { sortFindingsByPriority } from "./review-priorities"
import {
  extractDocumentStructure,
  computeSourceRevision,
} from "./document-understanding"
import {
  checkObjectiveAlignment,
  auditCitationConsistency,
  generateCalibratedDefenseQuestions,
} from "./academic-checks"
import {
  validateAndCalibrateFindings,
} from "./evidence-validator"
import { calculateGradeRange } from "./rubric-engine"

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
  reportingStandard?: ReportingStandard
  focusAreas?: string[]
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

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase()
}

/**
 * Searches for finding evidence quotes in the parsed sections and attaches
 * precise section headings, line/character offsets, and verified status.
 */
export function anchorEvidenceQuotes(
  findings: ReviewFindingContract[],
  rag: ThesisRAGContext,
  sourceRevision?: string
): ReviewFinding[] {
  return findings.map((f, idx) => {
    const rawEvidence = f.evidence || []
    const enrichedEvidence: EvidenceReference[] = rawEvidence.map((ev, evIdx) => {
      if (!ev.quote || !ev.quote.trim()) {
        return {
          id: `ev-${idx + 1}-${evIdx + 1}`,
          quote: ev.quote || "",
          verified: false,
          state: "unverified",
          sourceRevision,
        }
      }

      const cleanQuote = normalizeText(ev.quote)
      let state: EvidenceState = "unverified"
      let verificationMethod: "exact" | "whitespace_normalized" | "approximate" | "structural" | "manual" | undefined
      let isVerified = false

      // 1. Exact match search
      const exactMatches = rag.sections.filter((s) => s.content.includes(ev.quote))
      if (exactMatches.length === 1) {
        state = "verified-exact"
        verificationMethod = "exact"
        isVerified = true
      } else if (exactMatches.length > 1) {
        state = "ambiguous"
        verificationMethod = "exact"
        isVerified = true
      } else {
        // 2. Normalized match search
        const normMatches = rag.sections.filter((s) => normalizeText(s.content).includes(cleanQuote))
        if (normMatches.length === 1) {
          state = "verified-normalized"
          verificationMethod = "whitespace_normalized"
          isVerified = true
        } else if (normMatches.length > 1) {
          state = "ambiguous"
          verificationMethod = "whitespace_normalized"
          isVerified = true
        } else if (cleanQuote.length > 40) {
          // 3. Approximate match
          const subQuote = cleanQuote.slice(0, 35)
          const approxMatches = rag.sections.filter((s) => normalizeText(s.content).includes(subQuote))
          if (approxMatches.length > 0) {
            state = "approximate"
            verificationMethod = "approximate"
            isVerified = false
          }
        }
      }

      const matchedSection =
        rag.sections.find((s) => s.content.includes(ev.quote) || normalizeText(s.content).includes(cleanQuote)) ||
        (state === "approximate"
          ? rag.sections.find((s) => normalizeText(s.content).includes(cleanQuote.slice(0, 35)))
          : undefined)

      if (matchedSection) {
        const normSec = normalizeText(matchedSection.content)
        const quoteIndex = normSec.indexOf(cleanQuote)
        const subIndex = quoteIndex >= 0 ? quoteIndex : normSec.indexOf(cleanQuote.slice(0, 35))
        return {
          id: `ev-${idx + 1}-${evIdx + 1}`,
          page: ev.page,
          sectionHeading: ev.sectionHeading || matchedSection.heading,
          sectionTitle: ev.sectionHeading || matchedSection.heading,
          quote: ev.quote,
          startOffset: subIndex >= 0 ? subIndex : undefined,
          endOffset: subIndex >= 0 ? subIndex + ev.quote.length : undefined,
          verified: isVerified,
          state,
          verificationMethod,
          sourceRevision,
        }
      }

      // Quote could not be confirmed in extracted text
      return {
        id: `ev-${idx + 1}-${evIdx + 1}`,
        page: ev.page,
        sectionHeading: ev.sectionHeading,
        sectionTitle: ev.sectionHeading,
        quote: ev.quote,
        verified: false,
        state: "unverified",
        sourceRevision,
      }
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
      explanation: f.explanation,
      recommendation: f.recommendation,
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
  defenseQuestions: ReviewDefenseQuestion[]
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

  const systemPrompt = `You are a distinguished senior peer reviewer and academic expert performing a thorough, evidence-grounded review of a manuscript following COPE Ethical Guidelines and Nature/PLOS standards.

CRITICAL INSTRUCTIONS:
1. Ground every finding in direct evidence from the manuscript. Quote specific sentences or passages in the "evidence" field.
2. Tag every finding with an explicit "epistemicStatus":
   - "SUPPORTED_FACT": Directly demonstrated fact citing exact quotation.
   - "SUPPORTED_INTERPRETATION": Logical inference grounded in stated evidence.
   - "REVIEWER_JUDGMENT": Evaluative appraisal of quality or style.
   - "MISSING_EVIDENCE": Required information that could not be verified in the supplied text.
   - "POSSIBLE_RISK": Potential risk or limitation framed conditionally.
   - "REQUIRES_HUMAN_VERIFICATION": Area requiring verification in original complete PDF.
3. Differentiate strictly between severity levels:
   - "critical": Fatal ethical or methodological errors precluding publication/pass.
   - "major": Core methodological flaws, inadequate baselines, missing controls, or unsubstantiated claims.
   - "minor": Unclear formulations, minor typographical errors, formatting, or secondary references.
   - "suggestion": Constructive non-binding recommendations for future work.
4. Be constructive, professional, and actionable. State what the issue is, why it matters, and how the authors can fix it.
5. If checking reporting guidelines (${standard}), evaluate whether each key requirement is compliant, partial, or missing.
6. All assessment text MUST be written in the specified language: "${options.language}".
7. Output MUST strictly match the requested JSON schema.`

  const userPrompt = `Please evaluate the following academic manuscript and generate a comprehensive, structured peer review.

--- MANUSCRIPT METADATA ---
Document Title: ${options.documentTitle}
Author(s): ${options.authorName}
Review Type: ${options.reviewKind} ${options.thesisType ? `(${options.thesisType})` : ""}
Target Venue: ${options.targetVenue || "Academic Review"}
Reviewer Role: ${options.reviewerRole || "Expert Reviewer"}
Language: ${options.language}
Reporting Standard: ${standard}

--- REPORTING GUIDELINE FOCUS ---
${standardGuidance}

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

  const validated = await generateAIResponse<ProfessionalReviewGenerationResult>("peer-review", {
    model: resolveAiModel("thesis"),
    systemPrompt,
    userPrompt,
    schema: ProfessionalReviewGenerationSchema,
    temperature: 0.2,
  })

  // 1. Initial quote anchoring
  const anchored = anchorEvidenceQuotes(validated.findings, rag, sourceRevision)

  // 2. Deterministic alignment and citation checks
  const alignCheck = checkObjectiveAlignment(structure, rag, options.language)
  const citeCheck = auditCitationConsistency(structure, rag, options.language)

  const mergedFindings = [...anchored, ...alignCheck.findings, ...citeCheck.findings]

  // 3. Epistemic validation & calibration
  const validationResult = validateAndCalibrateFindings(mergedFindings, rag.fullText, rag.sections, sourceRevision)
  const finalFindings = sortFindingsByPriority(validationResult.validatedFindings, options.language)

  // 4. Calibrated defense questions (5-12)
  const calibratedQuestions = generateCalibratedDefenseQuestions(rag, finalFindings, options.thesisType || "master", options.language)

  // 5. Calculate proposed grade range
  const gradeRangeInfo = calculateGradeRange(85)

  return {
    ...validated,
    anchoredFindings: finalFindings,
    sourceRevision,
    proposedGradeRange: gradeRangeInfo.range,
    defenseQuestions: calibratedQuestions,
  }
}

export { calculateFindingPriority, sortFindingsByPriority } from "./review-priorities"
