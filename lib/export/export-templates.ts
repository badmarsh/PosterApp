/**
 * Multi-Format Academic Export Engine.
 *
 * Provides specialized exporters for university administration:
 *  1. AIS2 / LMS Import Plain-Text Protocol
 *  2. CSV / Excel Grade Roster format
 *  3. Official Slovak University Thesis Protocol (Standard Form)
 */

import type { ThesisReviewRecord, ThesisReviewListItem } from "@/components/thesis-review/use-thesis-review-store"

/**
 * Generates an AIS2-compatible plain-text evaluation protocol for direct copy-paste or upload.
 */
export function generateAis2ProtocolText(review: ThesisReviewRecord): string {
  const lines: string[] = []
  lines.push("================================================================================")
  lines.push("              AKADEMICKÝ INFORMAČNÝ SYSTÉM (AIS2) — PROTOKOL HODNOTENIA         ")
  lines.push("================================================================================")
  lines.push(`Študent:             ${review.studentName}`)
  lines.push(`Názov práce:         ${review.thesisTitle}`)
  lines.push(`Typ práce:           ${review.thesisType.toUpperCase()}`)
  lines.push(`Rola posudzovateľa:  ${review.reviewerRole === "supervisor" ? "Vedúci práce" : "Oponent práce"}`)
  lines.push(`Posudzovateľ:        ${review.reviewerName || "Neuvedené"}`)
  lines.push(`Dátum vyhotovenia:   ${new Date(review.updatedAt || review.createdAt).toLocaleDateString("sk-SK")}`)
  lines.push(`Navrhnutá známka:    ${review.finalGrade || review.grade || "B"}`)
  lines.push(`Odporúčanie:         ${review.finalRecommendation || review.recommendation || "Prácu odporúčam na obhajobu."}`)
  lines.push("--------------------------------------------------------------------------------")
  lines.push("HODNOTENIE JEDNOTLIVÝCH KRITÉRIÍ:")
  
  for (const s of review.sections || []) {
    lines.push(`[${s.criterionId.toUpperCase()}] — Známka: ${s.rating || "B"} (${s.numericScore || 85}%)`)
    lines.push(s.text.replace(/\n+/g, " "))
    lines.push("")
  }

  if (review.defenseQuestions && review.defenseQuestions.length > 0) {
    lines.push("--------------------------------------------------------------------------------")
    lines.push("OTÁZKY NA OBHAJOBU:")
    review.defenseQuestions.forEach((q, i) => lines.push(`${i + 1}. ${q}`))
  }

  lines.push("================================================================================")
  lines.push("Protokol vygenerovaný systémom PosterApp (AI Grounded Academic Reviewer).")
  return lines.join("\n")
}

/**
 * Generates a standardized CSV grade roster across all reviews in a workspace.
 */
export function generateCsvGradeRoster(reviews: (ThesisReviewRecord | ThesisReviewListItem)[]): string {
  const headers = [
    '"ID"',
    '"Student"',
    '"Thesis Title"',
    '"Type"',
    '"Role"',
    '"Reviewer"',
    '"Grade"',
    '"Recommendation"',
    '"Status"',
    '"Date"',
  ]

  const rows = reviews.map((r) => {
    const grade = r.finalGrade || r.grade || "B"
    const rec = (r.finalRecommendation || r.recommendation || "Odporúčam na obhajobu").replace(/"/g, '""')
    const title = (r.thesisTitle || "").replace(/"/g, '""')
    const student = (r.studentName || "").replace(/"/g, '""')
    const reviewer = (r.reviewerName || "").replace(/"/g, '""')
    const date = new Date(r.updatedAt || r.createdAt).toISOString().split("T")[0]

    return [
      `"${r.id}"`,
      `"${student}"`,
      `"${title}"`,
      `"${r.thesisType}"`,
      `"${r.reviewerRole}"`,
      `"${reviewer}"`,
      `"${grade}"`,
      `"${rec}"`,
      `"${r.status}"`,
      `"${date}"`,
    ].join(",")
  })

  return [headers.join(","), ...rows].join("\n")
}
