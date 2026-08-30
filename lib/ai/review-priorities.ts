/**
 * Client-safe finding prioritization and sorting functions.
 * Does not import Node fs or server-only libraries.
 */

import type { ReviewFinding } from "./review-types"
import type { ReviewLanguage } from "./thesis-rubric"

/**
 * Deterministic Finding Prioritization Tuple:
 * 1. unresolved critical
 * 2. unresolved major
 * 3. stale evidence
 * 4. ambiguous evidence
 * 5. unverified evidence
 * 6. contradictions / ethics
 * 7. reporting gaps (statistics/reproducibility)
 * 8. minor
 * 9. suggestions
 * 10. resolved / rejected
 */
export function calculateFindingPriority(
  finding: ReviewFinding,
  rubricIndex = 0,
  lang: ReviewLanguage = "sk"
): { rank: number; score: number; reason: string } {
  const isUnresolved = finding.status === "unreviewed" || finding.status === "edited"
  const evState =
    finding.evidenceState ||
    finding.evidence?.[0]?.state ||
    (finding.evidence?.[0]?.verified ? "verified-exact" : "unverified")

  if (isUnresolved && finding.severity === "critical") {
    return {
      rank: 1,
      score: 100,
      reason: lang === "sk" ? "Kritická nevyriešená chyba" : "Unresolved critical issue",
    }
  }

  if (isUnresolved && finding.severity === "major") {
    return {
      rank: 2,
      score: 80,
      reason: lang === "sk" ? "Závažná nevyriešená pripomienka" : "Unresolved major concern",
    }
  }

  if (isUnresolved && evState === "stale") {
    return {
      rank: 3,
      score: 70,
      reason: lang === "sk" ? "Zastaraný citát po úprave rukopisu" : "Stale quote citation",
    }
  }

  if (isUnresolved && evState === "ambiguous") {
    return {
      rank: 4,
      score: 65,
      reason: lang === "sk" ? "Nejednoznačný citát (viacero výskytov)" : "Ambiguous evidence citation",
    }
  }

  if (isUnresolved && (evState === "unverified" || !finding.evidence?.length)) {
    return {
      rank: 5,
      score: 60,
      reason: lang === "sk" ? "Neoverený citát v zdrojovom texte" : "Unverified quote reference",
    }
  }

  if (isUnresolved && (finding.category === "ethics" || finding.category === "statistics")) {
    return {
      rank: 6,
      score: 50,
      reason: lang === "sk" ? "Etická alebo štatistická pripomienka" : "Ethics or statistics observation",
    }
  }

  if (isUnresolved && finding.category === "reproducibility") {
    return {
      rank: 7,
      score: 40,
      reason: lang === "sk" ? "Nedostatok v reprodukovateľnosti" : "Reproducibility gap",
    }
  }

  if (isUnresolved && finding.severity === "minor") {
    return {
      rank: 8,
      score: 30,
      reason: lang === "sk" ? "Drobná pripomienka" : "Minor concern",
    }
  }

  if (isUnresolved && finding.severity === "suggestion") {
    return {
      rank: 9,
      score: 20,
      reason: lang === "sk" ? "Odporúčanie do budúcna" : "Suggestion",
    }
  }

  return {
    rank: 10,
    score: 10,
    reason: lang === "sk" ? "Uzavretá alebo zamietnutá pripomienka" : "Resolved or rejected finding",
  }
}

/**
 * Sorts findings by deterministic priority rank, tie-breaking by rubric index, creation date, and stable ID.
 */
export function sortFindingsByPriority(
  findings: ReviewFinding[],
  lang: ReviewLanguage = "sk"
): ReviewFinding[] {
  return [...findings].sort((a, b) => {
    const prioA = calculateFindingPriority(a, 0, lang)
    const prioB = calculateFindingPriority(b, 0, lang)

    if (prioA.rank !== prioB.rank) {
      return prioA.rank - prioB.rank
    }

    if (prioB.score !== prioA.score) {
      return prioB.score - prioA.score
    }

    // Tie-break 1: Creation timestamp (newest first)
    if (a.createdAt && b.createdAt && a.createdAt !== b.createdAt) {
      return b.createdAt.localeCompare(a.createdAt)
    }

    // Tie-break 2: Stable ID
    return a.id.localeCompare(b.id)
  })
}
