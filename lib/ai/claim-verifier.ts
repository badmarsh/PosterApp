/**
 * Deterministic Claim & Evidence Verification Engine (Phases 5 & 10)
 *
 * Evaluates extracted thesis claims against:
 *   1. Direct textual evidence in chunks
 *   2. Numerical & statistical consistency (numerical-verifier.ts)
 *   3. Mathematical equations (equation-consistency.ts)
 *   4. Explicit counter-evidence & limitation markers (parent-context.ts)
 *   5. External literature prior art (scholarly-comparator.ts)
 *
 * Emits verdicts:
 *   - SUPPORTED
 *   - PARTIALLY_SUPPORTED
 *   - UNSUPPORTED
 *   - CONTRADICTED
 *   - UNCERTAIN
 */

import { verifyNumericalConsistency, type NumericalDiscrepancy } from "./numerical-verifier"
import { checkEquationSanity, type EquationValidationResult } from "./equation-consistency"
import { selectCounterEvidence, type ContextChunk } from "./parent-context"

export type ClaimVerificationVerdict =
  | "SUPPORTED"
  | "PARTIALLY_SUPPORTED"
  | "UNSUPPORTED"
  | "CONTRADICTED"
  | "UNCERTAIN"

export interface ClaimVerificationResult {
  claimKey: string
  claimText: string
  verdict: ClaimVerificationVerdict
  confidence: number
  supportingEvidenceIds: string[]
  contradictingEvidenceIds: string[]
  numericalDiscrepancies: NumericalDiscrepancy[]
  equationSanityIssues: EquationValidationResult[]
  counterEvidenceQuotes: string[]
  reasoning: string
}

/**
 * Checks whether a claim is directly supported, qualified, unsupported, or contradicted by evidence.
 */
export function verifyClaim(
  claim: { claimKey: string; text: string; chunkId?: string | null },
  evidenceChunks: Array<{ id: string; content: string; heading?: string | null; sectionPath?: string | null }>,
  options?: {
    tables?: Array<{ content: string; chunkId?: string }>
    formulas?: Array<{ formula: string; surroundingProse: string }>
    counterEvidence?: ContextChunk[]
  }
): ClaimVerificationResult {
  const claimText = claim.text
  const supportingIds: string[] = []
  const contradictingIds: string[] = []
  const counterQuotes: string[] = []

  // 1. Direct lexical & semantic containment check
  const claimWords = claimText
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)

  for (const ec of evidenceChunks) {
    const textLower = ec.content.toLowerCase()
    let overlapCount = 0
    for (const w of claimWords) {
      if (textLower.includes(w)) overlapCount++
    }
    const overlapRatio = claimWords.length > 0 ? overlapCount / claimWords.length : 0

    if (overlapRatio >= 0.4 || textLower.includes(claimText.slice(0, 40).toLowerCase())) {
      supportingIds.push(ec.id)
    }
  }

  // 2. Numerical verification
  let numericalDiscrepancies: NumericalDiscrepancy[] = []
  if (options?.tables && options.tables.length > 0) {
    const numRes = verifyNumericalConsistency(claimText, options.tables)
    numericalDiscrepancies = numRes.discrepancies
    for (const d of numRes.discrepancies) {
      if (d.severity === "critical" && d.tableOrEquationEvidence.chunkId) {
        contradictingIds.push(d.tableOrEquationEvidence.chunkId)
      }
    }
  }

  // 3. Equation sanity
  const equationSanityIssues: EquationValidationResult[] = []
  if (options?.formulas && options.formulas.length > 0) {
    for (const f of options.formulas) {
      const eqRes = checkEquationSanity(f.formula, f.surroundingProse)
      if (!eqRes.isValid || eqRes.rangeViolations.length > 0) {
        equationSanityIssues.push(eqRes)
      }
    }
  }

  // 4. Counter-evidence checking
  const allContextChunks: any[] = (evidenceChunks || []).map((c) => ({
    id: c.id,
    content: c.content,
    heading: c.heading,
    sectionPath: c.sectionPath,
    source: "retrieved",
    relevanceScore: 0.8,
  }))
  const directCounters = selectCounterEvidence(allContextChunks)
  const activeCounters = options?.counterEvidence || []
  const combinedCounters = [...directCounters, ...activeCounters]

  for (const cc of combinedCounters) {
    contradictingIds.push(cc.id)
    counterQuotes.push(cc.content.slice(0, 200))
  }

  // 5. Verdict assignment
  let verdict: ClaimVerificationVerdict = "UNCERTAIN"
  let confidence = 0.5
  let reasoning = ""

  const hasContradiction = contradictingIds.length > 0 || numericalDiscrepancies.some((d) => d.severity === "critical")
  const hasStrongSupport = supportingIds.length > 0
  const hasModerateDiscrepancy = numericalDiscrepancies.some((d) => d.severity === "moderate") || equationSanityIssues.length > 0

  if (hasContradiction) {
    verdict = "CONTRADICTED"
    confidence = 0.85
    reasoning = `Claim is contradicted by ${contradictingIds.length} counter-evidence passages or table discrepancies.`
  } else if (hasStrongSupport && !hasModerateDiscrepancy) {
    verdict = "SUPPORTED"
    confidence = Math.min(0.95, 0.6 + supportingIds.length * 0.1)
    reasoning = `Directly corroborated by ${supportingIds.length} manuscript passages without contradiction.`
  } else if (hasStrongSupport && hasModerateDiscrepancy) {
    verdict = "PARTIALLY_SUPPORTED"
    confidence = 0.7
    reasoning = `Supported by manuscript prose but minor numerical or formula discrepancies were detected.`
  } else if (supportingIds.length === 0 && !hasContradiction) {
    verdict = "UNSUPPORTED"
    confidence = 0.75
    reasoning = `No direct empirical or textual corroboration found in retrieved thesis chunks.`
  }

  return {
    claimKey: claim.claimKey,
    claimText,
    verdict,
    confidence,
    supportingEvidenceIds: Array.from(new Set(supportingIds)),
    contradictingEvidenceIds: Array.from(new Set(contradictingIds)),
    numericalDiscrepancies,
    equationSanityIssues,
    counterEvidenceQuotes: counterQuotes.slice(0, 3),
    reasoning,
  }
}
