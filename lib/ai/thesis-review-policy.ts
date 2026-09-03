/**
 * Pure helpers shared by the thesis-review route and its tests.
 * Kept out of the route module: Next.js route files may only export HTTP
 * handlers and route-segment config.
 */

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

export function normalizeDefenseQuestions(
  questions: Array<string | { question: string }>
): string[] {
  return questions.map((question) => typeof question === "string" ? question : question.question)
}
