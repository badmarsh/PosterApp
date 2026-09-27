import type { ReviewLanguage, ThesisMetadata } from "./thesis-rubric"

/**
 * Retrieval asks for evidence, not an assessor's instructions. These English
 * criteria otherwise spend the 300-character query budget on rubric cautions.
 * Keep the rubric guidance unchanged for evaluation; use evidence-oriented
 * vocabulary only for retrieval. No document-specific numbers or quotations.
 */
const ENGLISH_EVIDENCE_QUERIES = new Map<string, string>([
  ["methodology_rigor", "Measurement method, likelihood model and fitting procedure, with assumptions and parameter definitions."],
  ["analytical_execution", "Statistical uncertainties of fitted parameters from the likelihood function and the covariance matrix."],
  ["discussion_relation", "Interpretation of the results: agreement between data and simulation and comparison with previous measurements."],
  ["limitations_future_work", "Remaining work: corrections not yet available and improvements to be implemented in the future."],
])

/** Conservative scope: validated on jet calibration, not all English academic work.
 * Never use the inferred domain label: missing metadata historically defaults to physics.
 * Unknown, qualitative, and non-calibration titles retain the original rubric query.
 */
export function supportsCalibrationEvidenceQueries(metadata?: Partial<ThesisMetadata>): boolean {
  const title = metadata?.thesisTitle?.trim() ?? ""
  if (/\b(qualitative|interview\w*|ethnograph\w*|histor\w*|sociolog\w*|education\w*|teaching)\b/i.test(title)) return false
  return /\bjet energy (?:scale|resolution|calibration)\b|\bJES\b.*\bJER\b|\bJER\b.*\bJES\b/i.test(title)
}

export function buildCriterionRetrievalQuery(
  criterionId: string,
  label: string,
  guidance: string,
  lang: ReviewLanguage,
  metadata?: Partial<ThesisMetadata>,
): string {
  const evidenceQuery = lang === "en" && supportsCalibrationEvidenceQueries(metadata)
    ? ENGLISH_EVIDENCE_QUERIES.get(criterionId)
    : undefined
  return evidenceQuery ?? `${label} ${guidance}`.slice(0, 300)
}
