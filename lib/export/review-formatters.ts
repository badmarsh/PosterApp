/**
 * Export formatters for Professional Peer Reviews and Thesis Assessments.
 *
 * Provides deterministic export to Markdown and Plain Text (for ScholarOne / Editorial Manager),
 * and handles section filtering and anonymization.
 */

import type { ThesisReviewRecord } from "@/components/thesis-review/use-thesis-review-store"
import type { ReviewFinding } from "@/lib/ai/review-types"

export interface FormatOptions {
  anonymize?: boolean
  includeConfidential?: boolean
  onlyAcceptedFindings?: boolean
}

/**
 * Format a review record to clean, structured Markdown.
 */
export function formatReviewToMarkdown(
  review: ThesisReviewRecord,
  options: FormatOptions = {}
): string {
  const lines: string[] = []

  // Document Title & Metadata
  lines.push(`# Posudok / Peer Review: ${review.thesisTitle}`)
  lines.push(`**Autor / Author:** ${review.studentName}`)
  if (!options.anonymize && review.reviewerName) {
    lines.push(`**Recenzent / Reviewer:** ${review.reviewerName}`)
    if (review.institution) lines.push(`**Inštitúcia / Institution:** ${review.institution}`)
  }
  lines.push(`**Typ hodnotenia / Review Type:** ${review.reviewKind || review.thesisType}`)
  if (review.grade) lines.push(`**Klasifikácia / ECTS Grade:** ${review.grade}`)
  if (review.recommendation) lines.push(`**Záverečné odporúčanie / Recommendation:** ${review.recommendation}`)
  lines.push(`**Dátum / Date:** ${new Date(review.updatedAt || review.createdAt).toLocaleDateString()}`)
  lines.push("")

  // Executive Summary
  if (review.summary) {
    lines.push("## 1. Zhrnutie práce / Executive Summary")
    lines.push(review.summary)
    lines.push("")
  }

  // Strengths
  if (review.strengths && review.strengths.length > 0) {
    lines.push("## 2. Silné stránky práce / Key Strengths")
    for (const str of review.strengths) {
      lines.push(`- ${str}`)
    }
    lines.push("")
  }

  // Filtered Findings (Major vs Minor)
  const allFindings = review.findings || []
  const activeFindings = options.onlyAcceptedFindings
    ? allFindings.filter((f) => f.includeInExport && f.status !== "rejected")
    : allFindings.filter((f) => f.includeInExport)

  const majorFindings = activeFindings.filter((f) => f.severity === "critical" || f.severity === "major")
  const minorFindings = activeFindings.filter((f) => f.severity === "minor" || f.severity === "suggestion")

  // Major Concerns
  if (majorFindings.length > 0) {
    lines.push("## 3. Zásadné pripomienky / Major Concerns")
    for (const f of majorFindings) {
      lines.push(`### [${(f.category || "general").toUpperCase()}] ${f.title}`)
      lines.push(f.explanation)
      if (f.recommendation) {
        lines.push(`**Odporúčaná náprava:** ${f.recommendation}`)
      }
      if (f.evidence?.[0]?.quote) {
        lines.push(`> *Dôkaz v texte:* "${f.evidence[0].quote}"`)
      }
      if (f.reviewerNotes) {
        lines.push(`*Poznámka recenzenta:* ${f.reviewerNotes}`)
      }
      lines.push("")
    }
  }

  // Minor Concerns
  if (minorFindings.length > 0) {
    lines.push("## 4. Drobné pripomienky / Minor Concerns")
    for (const f of minorFindings) {
      lines.push(`- **${f.title}** (${f.category}): ${f.explanation}`)
      if (f.recommendation) {
        lines.push(`  - *Náprava:* ${f.recommendation}`)
      }
    }
    lines.push("")
  }

  // Criteria Sections (if standard thesis review)
  if ((!review.findings || review.findings.length === 0) && review.sections?.length > 0) {
    lines.push("## Hodnotenie jednotlivých kritérií")
    for (const sec of review.sections) {
      lines.push(`### ${sec.criterionId || sec.sectionId} (Hodnotenie: ${sec.rating || "---"})`)
      lines.push(sec.text)
      if (sec.suggestions && sec.suggestions.length > 0) {
        lines.push(`*Návrhy na zlepšenie:* ${sec.suggestions.join("; ")}`)
      }
      lines.push("")
    }
  }

  // Reporting Guidelines
  if (review.reportingGuidelineChecks && review.reportingGuidelineChecks.length > 0) {
    lines.push(`## 5. Reporting Guideline Compliance (${review.reportingStandard?.toUpperCase()})`)
    for (const chk of review.reportingGuidelineChecks) {
      lines.push(`- **[${chk.status.toUpperCase()}] ${chk.item}**: ${chk.notes}`)
    }
    lines.push("")
  }

  // Questions for Authors / Defense Questions
  const questions = review.questionsForAuthors || review.defenseQuestions || []
  if (questions.length > 0) {
    lines.push("## 6. Otázky na autora / Questions for Authors")
    questions.forEach((q: string, idx: number) => {
      lines.push(`${idx + 1}. ${q}`)
    })
    lines.push("")
  }

  // Confidential comments for editor
  if (options.includeConfidential && review.confidentialComments) {
    lines.push("## 7. Dôverné komentáre pre editora / Confidential Comments for Editor")
    lines.push(review.confidentialComments)
    lines.push("")
  }

  return lines.join("\n")
}

/**
 * Format a review record into plain text formatted with ASCII separators,
 * suitable for direct clipboard copy into Editorial Manager / ScholarOne.
 */
export function formatReviewToPlainText(
  review: ThesisReviewRecord,
  options: FormatOptions = {}
): string {
  const md = formatReviewToMarkdown(review, options)
  return md
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^>\s+/gm, "   ")
}
