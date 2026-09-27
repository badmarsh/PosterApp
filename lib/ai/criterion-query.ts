import type { ReviewLanguage } from "./thesis-rubric"

/**
 * Retrieval asks for evidence, not an assessor's instructions. These English
 * criteria otherwise spend the 300-character query budget on rubric cautions.
 * Keep the rubric guidance unchanged for evaluation; use evidence-oriented
 * vocabulary only for retrieval. No document-specific numbers or quotations.
 */
const ENGLISH_EVIDENCE_QUERIES: Record<string, string> = {
  analytical_execution: "Statistical uncertainties of fitted parameters from the likelihood function and the covariance matrix.",
  discussion_relation: "Interpretation of the results: agreement between data and simulation and comparison with previous measurements.",
  limitations_future_work: "Remaining work: corrections not yet available and improvements to be implemented in the future.",
}

export function buildCriterionRetrievalQuery(
  criterionId: string,
  label: string,
  guidance: string,
  lang: ReviewLanguage,
): string {
  return lang === "en" && ENGLISH_EVIDENCE_QUERIES[criterionId]
    ? ENGLISH_EVIDENCE_QUERIES[criterionId]
    : `${label} ${guidance}`.slice(0, 300)
}
