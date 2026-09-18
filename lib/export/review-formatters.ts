/**
 * Export formatters for Professional Peer Reviews and Thesis Assessments.
 *
 * Provides deterministic export to Markdown and Plain Text (for ScholarOne / Editorial Manager),
 * and handles section filtering and anonymization.
 */

import type { ThesisReviewRecord } from "@/components/thesis-review/use-thesis-review-store"
import type { ReviewFinding } from "@/lib/ai/review-types"
import { bucketFindings } from "@/lib/ai/review-bucketing"

export interface FormatOptions {
  anonymize?: boolean
  includeConfidential?: boolean
  excludeRejected?: boolean
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

  const isPaper = review.reviewKind === "paper"
  const allFindings = review.findings || []
  const activeFindings = options.excludeRejected
    ? allFindings.filter((f) => f.includeInExport && f.status !== "rejected")
    : allFindings.filter((f) => f.includeInExport)
  const buckets = bucketFindings(activeFindings)

  // Numbering is assigned while blocks are emitted, so an empty block cannot
  // leave a hole in the sequence.
  const linesFor: { heading: string; body: string[] }[] = []
  const push = (heading: string, body: string[]) => linesFor.push({ heading, body })

  if (review.summary) push(isPaper ? "Zhrnutie rukopisu" : "Zhrnutie práce", [review.summary])

  const findingStrengths = isPaper
    ? []
    : buckets.strengths
        .filter((f) => f.evidence?.some((e) => e.verified))
        .map((f) => f.explanation || f.title)
  const strengths = [...new Set([...(review.strengths || []), ...findingStrengths])].filter(Boolean)
  if (strengths.length > 0) {
    push(isPaper ? "Silné stránky rukopisu" : "Silné stránky práce", strengths.map((s) => `- ${s}`))
  }

  if (buckets.major.length > 0) {
    const body: string[] = []
    for (const f of buckets.major) {
      body.push(`### [${(f.category || "general").toUpperCase()}] ${f.title}`)
      body.push(f.explanation)
      if (f.recommendation) body.push(`**Odporúčaná náprava:** ${f.recommendation}`)
      if (f.evidence?.[0]?.quote) body.push(`> *Dôkaz v texte:* "${f.evidence[0].quote}"`)
      if (f.reviewerNotes) body.push(`*Poznámka recenzenta:* ${f.reviewerNotes}`)
      body.push("")
    }
    push("Zásadné pripomienky / Major Concerns", body)
  }

  if (buckets.minor.length > 0) {
    const body: string[] = []
    for (const f of buckets.minor) {
      body.push(`- **${f.title}** (${f.category}): ${f.explanation}`)
      if (f.recommendation) body.push(`  - *Náprava:* ${f.recommendation}`)
    }
    body.push("")
    push("Drobné pripomienky / Minor Concerns", body)
  }

  // Slovak/Czech doctoral opponent reviews must state the statutory conditions
  // and an explicit recommendation for the defence plus the proposed title.
  const statutoryClause: string | undefined = review.phdEnrichment?.statutoryClause
  if (!isPaper && review.thesisType === "phd" && review.reviewerRole === "opponent") {
    if (statutoryClause?.trim()) {
      push("Zákonné podmienky doktorského študijného programu", [statutoryClause, ""])
    }
    if (review.recommendation?.trim()) {
      push(
        "Záverečné stanovisko",
        [review.recommendation.trim(), "", "Klasifikačný stupeň: .................. (prospel / neprospel)", ""]
      )
    }
  }

  let sectionNo = 0
  const numbered = (title: string) => (isPaper ? title : `${++sectionNo}. ${title}`)
  for (const block of linesFor) {
    lines.push(`## ${numbered(block.heading)}`)
    lines.push(...block.body)
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
    lines.push(`## ${numbered(`Reporting Guideline Compliance (${review.reportingStandard?.toUpperCase()})`)}`)
    for (const chk of review.reportingGuidelineChecks) {
      lines.push(`- **[${chk.status.toUpperCase()}] ${chk.item}**: ${chk.notes}`)
    }
    lines.push("")
  }

  // Questions for Authors / Defense Questions
  const questions = review.questionsForAuthors || review.defenseQuestions || []
  if (questions.length > 0) {
    lines.push(`## ${numbered("Otázky na autora / Questions for Authors")}`)
    questions.forEach((q: string, idx: number) => {
      lines.push(`${idx + 1}. ${q}`)
    })
    lines.push("")
  }

  // Confidential comments for editor
  if (options.includeConfidential && review.confidentialComments) {
    lines.push(`## ${numbered("Dôverné komentáre pre editora / Confidential Comments for Editor")}`)
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
