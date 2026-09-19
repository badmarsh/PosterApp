/**
 * Review Adjudicator Architecture (Phases 26 & 27)
 *
 * Implements:
 *   PRIMARY REVIEW
 *         |
 *   ADVERSARIAL CRITIC
 *         |
 *   EVIDENCE RE-CHECK
 *         |
 *   ADJUDICATOR
 *         |
 *   FINAL FINDINGS
 *
 * The adjudicator receives:
 *   - primary findings & cited evidence
 *   - critic objections / severity adjustments
 *   - counter-evidence retrieved
 *   - numerical consistency verification results
 *   - deterministic severity calibration rules
 *
 * Adjudicator decisions:
 *   - ACCEPT
 *   - DOWNGRADE
 *   - UPGRADE
 *   - REMOVE
 *   - REQUIRES_HUMAN_VERIFICATION
 */

import type { ReviewFinding, ReviewSeverity } from "./review-types"
import type { NumericalDiscrepancy } from "./numerical-verifier"

export type AdjudicationAction =
  | "ACCEPT"
  | "DOWNGRADE"
  | "UPGRADE"
  | "REMOVE"
  | "REQUIRES_HUMAN_VERIFICATION"

export interface CriticObjection {
  findingIdOrIndex: number | string
  action: "downgrade" | "upgrade" | "remove"
  suggestedSeverity?: ReviewSeverity
  reason: string
}

export interface AdjudicationInput {
  primaryFindings: ReviewFinding[]
  criticObjections?: CriticObjection[]
  numericalDiscrepancies?: NumericalDiscrepancy[]
  counterEvidenceCount?: number
}

export interface AdjudicationFindingResult {
  finding: ReviewFinding
  action: AdjudicationAction
  originalSeverity: ReviewSeverity
  adjudicatedSeverity: ReviewSeverity
  justification: string
}

export interface AdjudicationReport {
  results: AdjudicationFindingResult[]
  acceptedCount: number
  downgradedCount: number
  upgradedCount: number
  removedCount: number
  flaggedHumanCount: number
}

const SEVERITY_ORDER: ReviewSeverity[] = ["critical", "major", "minor", "suggestion", "info"]

function stepSeverity(current: ReviewSeverity, direction: "down" | "up"): ReviewSeverity {
  const idx = SEVERITY_ORDER.indexOf(current)
  if (idx === -1) return current
  if (direction === "down" && idx < SEVERITY_ORDER.length - 1) {
    return SEVERITY_ORDER[idx + 1]
  }
  if (direction === "up" && idx > 0) {
    return SEVERITY_ORDER[idx - 1]
  }
  return current
}

/**
 * Adjudicates findings deterministically based on evidence strength, critic arguments, and data sanity.
 */
export function adjudicateFindings(input: AdjudicationInput): AdjudicationReport {
  const { primaryFindings, criticObjections = [], numericalDiscrepancies = [] } = input

  const results: AdjudicationFindingResult[] = []

  let acceptedCount = 0
  let downgradedCount = 0
  let upgradedCount = 0
  let removedCount = 0
  let flaggedHumanCount = 0

  for (let i = 0; i < primaryFindings.length; i++) {
    const finding = { ...primaryFindings[i] }
    const originalSeverity = finding.severity as ReviewSeverity

    // Check matching critic objection
    const objection = criticObjections.find(
      (o) => o.findingIdOrIndex === i + 1 || o.findingIdOrIndex === finding.id
    )

    // Check evidence backing
    const hasVerifiedExact =
      finding.evidenceState === "verified-exact" || finding.evidenceState === "verified-normalized"
    const hasAnyEvidence = (finding.evidence && finding.evidence.length > 0) || hasVerifiedExact

    let action: AdjudicationAction = "ACCEPT" as AdjudicationAction
    let adjudicatedSeverity: ReviewSeverity = originalSeverity
    let justification = "Primary finding accepted with adequate evidence backing."

    // 1. Critical findings without any evidence must be downgraded or flagged for review
    if (originalSeverity === "critical" && !hasAnyEvidence) {
      action = "DOWNGRADE"
      adjudicatedSeverity = "major"
      justification = "Critical finding lacks direct evidence anchor; downgraded to major per evidence contract."
      downgradedCount++
    }
    // 2. Unsubstantiated suggestions or low-confidence unevidenced findings
    else if (!hasAnyEvidence && finding.confidence !== undefined && finding.confidence < 0.3) {
      action = "REMOVE"
      justification = "Finding confidence below threshold and lacks evidence anchor; removed from final synthesis."
      removedCount++
      continue
    }
    // 3. Critic objections evaluated against evidence
    else if (objection) {
      // If the finding has exact verified quotes from the manuscript, reject arbitrary critic downgrades
      if (hasVerifiedExact && objection.action === "downgrade" && objection.reason.length < 25) {
        action = "ACCEPT"
        adjudicatedSeverity = originalSeverity
        justification = "Critic downgrade rejected: finding is supported by verified exact manuscript evidence."
        acceptedCount++
      } else if (objection.action === "downgrade") {
        action = "DOWNGRADE"
        adjudicatedSeverity = objection.suggestedSeverity || stepSeverity(originalSeverity, "down")
        justification = `Critic objection accepted: ${objection.reason}`
        downgradedCount++
      } else if (objection.action === "upgrade") {
        action = "UPGRADE"
        adjudicatedSeverity = objection.suggestedSeverity || stepSeverity(originalSeverity, "up")
        justification = `Critic upgrade accepted: ${objection.reason}`
        upgradedCount++
      }
    }
    // 4. Numerical contradiction detected for this finding
    else {
      const relevantNum = numericalDiscrepancies.find((nd) =>
        (finding.explanation || "").toLowerCase().includes(nd.parameter.toLowerCase())
      )
      if (relevantNum && relevantNum.severity === "critical") {
        action = "UPGRADE"
        adjudicatedSeverity = originalSeverity === "minor" ? "major" : originalSeverity === "major" ? "critical" : originalSeverity
        justification = `Severity escalated due to confirmed numerical table discrepancy: ${relevantNum.explanation}`
        upgradedCount++
      } else {
        acceptedCount++
      }
    }

    finding.severity = adjudicatedSeverity
    if (action === "DOWNGRADE" || action === "REQUIRES_HUMAN_VERIFICATION") {
      finding.decisionStatus = "needs_human_review"
    }

    results.push({
      finding,
      action,
      originalSeverity,
      adjudicatedSeverity,
      justification,
    })
  }

  return {
    results,
    acceptedCount,
    downgradedCount,
    upgradedCount,
    removedCount,
    flaggedHumanCount,
  }
}
