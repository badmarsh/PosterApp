/**
 * Pure helpers shared by the thesis-review route and its tests.
 * Kept out of the route module: Next.js route files may only export HTTP
 * handlers and route-segment config.
 */

// Starting value; needs empirical tuning
export const AUTO_APPLY_CONFIDENCE_THRESHOLD = 0.8

export type ReviewKind = "thesis" | "paper" | "grant" | undefined

/** ECTS ratings and thesis-level checks never apply to journal/conference peer review. */
export function shouldApplyEctsGrading(reviewKind: ReviewKind, reviewerRole?: string): boolean {
  return (reviewKind === "thesis" || reviewKind === undefined) && reviewerRole !== "self"
}

/** Doctoral enrichment is meaningful only for an actual doctoral thesis opponent review. */
export function shouldRunPhdEnrichment(
  reviewKind: ReviewKind,
  thesisType?: "bachelor" | "master" | "phd",
  reviewerRole?: string,
): boolean {
  return (reviewKind === "thesis" || reviewKind === undefined) && thesisType === "phd" && reviewerRole === "opponent"
}

/** Prompt guidance that keeps role-specific judgments distinct across review paths. */
export function getReviewerRoleGuidance(
  reviewKind: ReviewKind,
  reviewerRole?: string | null,
): string {
  if (reviewKind === "paper") {
    if (reviewerRole === "editor") {
      return "ROLE: EDITOR. Provide confidential editorial triage: assess scope, fit, ethics, reporting, and decision readiness. Separate author-facing revisions from confidential editor notes; do not assign academic grades."
    }
    return "ROLE: PEER REVIEWER. Provide an independent, balanced scholarly assessment for authors and editor; distinguish evidence from reviewer judgment, give actionable revisions, and do not assign academic grades."
  }
  if (reviewKind === "grant") {
    return "ROLE: GRANT REVIEWER. Assess the proposal's significance, novelty, feasibility, team/resources, risk, ethics, and expected impact for a funding decision. Distinguish proposal weaknesses from missing information; do not grade a student or assign ECTS."
  }
  if (reviewerRole === "supervisor") {
    return "ROLE: THESIS SUPERVISOR. Give developmental, pedagogical feedback on progress and concrete next steps. Do not present this internal mentoring assessment as an independent opponent's judgment."
  }
  if (reviewerRole === "self") {
    return "ROLE: AUTHOR SELF-REVIEW. Use a reflective pre-submission audit. Identify what the manuscript itself supports, separate self-claims from verified evidence, list gaps for the author to resolve, and do not impersonate an external opponent or issue an independent academic verdict."
  }
  if (reviewerRole === "opponent") {
    return "ROLE: EXTERNAL OPONENT. Give an independent, balanced, evidence-based assessment of the submitted work, explicitly weigh merits and shortcomings, and state a defensible formal recommendation without adopting the supervisor's mentoring role."
  }
  return "ROLE: INDEPENDENT ACADEMIC REVIEWER. Provide a balanced, evidence-grounded assessment and actionable recommendations appropriate to the review type."
}

export function shouldUseProfessionalMode(
  professionalMode: boolean | undefined,
  reviewKind: "thesis" | "paper" | "grant" | undefined,
  reportingStandard: string | undefined,
  thesisType?: "bachelor" | "master" | "phd" | undefined,
  reviewerRole?: string | undefined
): boolean {
  if (reviewerRole === "self") return true
  if (Boolean(professionalMode)) return true
  if (reviewKind === "paper" || reviewKind === "grant") return true
  if (reportingStandard !== undefined && reportingStandard !== "none") return true
  if ((reviewKind === "thesis" || reviewKind === undefined) && (thesisType === "master" || thesisType === "phd")) return true
  return false
}

export function normalizeDefenseQuestions(
  questions: Array<string | { question: string }>
): string[] {
  return questions.map((question) => typeof question === "string" ? question : question.question)
}
