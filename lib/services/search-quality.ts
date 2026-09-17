import type { AcademicPaperResult } from "@/lib/services/academic-connector"

/**
 * Credibility assessment for academic search results (audit 2026-09-17,
 * friction #6). The dialog already shows citation counts, but a number alone
 * does not tell an undergrad whether a source is trustworthy. This module
 * turns the metadata we already have — citations, OA availability, venue,
 * recency, influential citations, retraction flag — into one pill:
 * score 0–100, a level, and the reasons behind it.
 *
 * Pure and synchronous so it can run per result row during render without
 * effects or memo maps.
 */

export type CredibilityLevel = "high" | "medium" | "low" | "retracted"

export interface CredibilityAssessment {
  /** 0–100 heuristic trust score. 0 only when retracted. */
  score: number
  level: CredibilityLevel
  /** Short, user-facing reasons (English; the dialog localizes around it). */
  reasons: string[]
  isRetracted: boolean
}

function citationScore(count: number | undefined): { points: number; reason?: string } {
  const n = count ?? 0
  if (n >= 400) return { points: 25, reason: `highly cited (${n})` }
  if (n >= 100) return { points: 20, reason: `well cited (${n})` }
  if (n >= 25) return { points: 12, reason: `cited ${n}×` }
  if (n >= 5) return { points: 6, reason: `cited ${n}×` }
  return { points: 0 }
}

/**
 * Assess a paper's credibility from its metadata.
 *
 * Base score 40 (every indexed paper cleared a minimum bar); citations, a
 * named venue, an OA PDF and recent publication add up to the rest. A
 * retraction overrides everything: score 0, level "retracted".
 */
export function credibilityAssessment(
  paper: Pick<
    AcademicPaperResult,
    "citationCount" | "influentialCitationCount" | "openAccessPdfUrl" | "venue" | "year" | "isRetracted"
  >,
  currentYear: number = new Date().getFullYear(),
): CredibilityAssessment {
  const reasons: string[] = []

  if (paper.isRetracted) {
    return {
      score: 0,
      level: "retracted",
      reasons: ["retracted by the publisher — do not cite"],
      isRetracted: true,
    }
  }

  let score = 40

  const cites = citationScore(paper.citationCount)
  score += cites.points
  if (cites.reason) reasons.push(cites.reason)

  if ((paper.influentialCitationCount ?? 0) >= 5) {
    score += 5
    reasons.push(`${paper.influentialCitationCount} influential citations`)
  }

  if (paper.venue && paper.venue.trim()) {
    score += 8
    reasons.push(`published in ${paper.venue.trim()}`)
  }

  if (paper.openAccessPdfUrl) {
    score += 7
    reasons.push("open access PDF available")
  }

  if (typeof paper.year === "number" && paper.year > 0) {
    const age = currentYear - paper.year
    if (age <= 2) {
      score += 10
      reasons.push("published in the last two years")
    } else if (age <= 10) {
      score += 5
      reasons.push("recent work")
    } else if (age > 25) {
      reasons.push(`${age} years old — check for newer work`)
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)))
  const level: CredibilityLevel = score >= 75 ? "high" : score >= 50 ? "medium" : "low"
  if (reasons.length === 0) reasons.push("limited metadata — verify before citing")

  return { score, level, reasons, isRetracted: false }
}
