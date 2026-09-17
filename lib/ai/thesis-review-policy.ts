/**
 * Pure helpers shared by the thesis-review route and its tests.
 * Kept out of the route module: Next.js route files may only export HTTP
 * handlers and route-segment config.
 */

// Starting value; needs empirical tuning
export const AUTO_APPLY_CONFIDENCE_THRESHOLD = 0.8

type ReviewKind = "thesis" | "paper" | "grant" | undefined

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

export function normalizeDefenseQuestions(
  questions: Array<string | { question: string }>
): string[] {
  return questions.map((question) => typeof question === "string" ? question : question.question)
}
