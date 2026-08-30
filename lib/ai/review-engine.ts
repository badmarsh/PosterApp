/**
 * Expert Review Generation Engine.
 *
 * Implements COPE, Nature, PLOS, and EQUATOR Network standards for scientific paper
 * and academic thesis peer reviews.
 *
 * Produces structured findings with explicit evidence anchors (quotes from text),
 * separated Major/Minor concerns, reporting guideline compliance checks, and questions for authors.
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
import type { ReviewKind, ReportingStandard, ReviewFinding, EvidenceReference } from "./review-types"
import type { ReviewLanguage, ThesisType } from "./thesis-rubric"

export interface GenerateProfessionalReviewOptions {
  workspaceId: string
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

/**
 * Searches for finding evidence quotes in the parsed sections and attaches
 * precise section headings and line/character offsets.
 */
export function anchorEvidenceQuotes(
  findings: ReviewFindingContract[],
  rag: ThesisRAGContext
): ReviewFinding[] {
  return findings.map((f, idx) => {
    const rawEvidence = f.evidence || []
    const enrichedEvidence: EvidenceReference[] = rawEvidence.map((ev) => {
      if (!ev.quote) return ev

      const cleanQuote = ev.quote.trim().toLowerCase()
      // Find matching section in RAG
      const matchedSection = rag.sections.find((s) =>
        s.content.toLowerCase().includes(cleanQuote)
      )

      if (matchedSection) {
        const quoteIndex = matchedSection.content.toLowerCase().indexOf(cleanQuote)
        return {
          ...ev,
          sectionHeading: ev.sectionHeading || matchedSection.heading,
          startOffset: quoteIndex >= 0 ? quoteIndex : undefined,
          endOffset: quoteIndex >= 0 ? quoteIndex + ev.quote.length : undefined,
        }
      }

      return ev
    })

    return {
      id: f.id || `finding-${idx + 1}`,
      title: f.title,
      explanation: f.explanation,
      recommendation: f.recommendation,
      severity: f.severity,
      category: f.category,
      confidence: f.confidence ?? 0.85,
      evidence: enrichedEvidence,
      status: "unreviewed",
      includeInExport: true,
      createdBy: "ai",
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
): Promise<ProfessionalReviewGenerationResult & { anchoredFindings: ReviewFinding[] }> {
  const rag = await loadThesisContext({
    workspaceId: options.workspaceId,
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

  const standard = options.reportingStandard || "none"
  const standardGuidance = REPORTING_CHECKLIST_PROMPTS[standard]

  const systemPrompt = `You are a distinguished senior peer reviewer and academic expert performing a thorough, evidence-grounded review of a manuscript following COPE Ethical Guidelines and Nature/PLOS standards.

CRITICAL INSTRUCTIONS:
1. Ground every finding in direct evidence from the manuscript. Quote specific sentences or passages in the "evidence" field.
2. Differentiate strictly between:
   - "critical": Fatal ethical or methodological errors precluding publication/pass.
   - "major": Core methodological flaws, inadequate baselines, missing controls, or unsubstantiated claims.
   - "minor": Unclear formulations, minor typographical errors, formatting, or secondary references.
   - "suggestion": Constructive non-binding recommendations for future work.
3. Be constructive, professional, and actionable. State what the issue is, why it matters, and how the authors can fix it.
4. If checking reporting guidelines (${standard}), evaluate whether each key requirement is compliant, partial, or missing.
5. All assessment text MUST be written in the specified language: "${options.language}".
6. Output MUST strictly match the requested JSON schema.`

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

  const anchoredFindings = anchorEvidenceQuotes(validated.findings, rag)

  return {
    ...validated,
    anchoredFindings,
  }
}
