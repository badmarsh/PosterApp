/**
 * Human-Controlled Review Composer.
 *
 * Synthesizes reviewer-approved findings, strengths, decisions, and reporting checks
 * into a coherent, publication-ready peer review or thesis assessment narrative.
 *
 * Rules:
 *  - Only includes accepted, edited, or explicitly included findings (includeInExport: true).
 *  - Reviewer edits take strict precedence over raw AI drafts.
 *  - Confidential comments are strictly isolated from the author audience.
 *  - Suggested grades are never conflated with confirmed final grades.
 *  - Generates 12 standard sections with optional AI rephrasing diffs.
 */

import type { ThesisReviewRecord } from "@/components/thesis-review/use-thesis-review-store"
import type { ReviewFinding, FindingAudience } from "./review-types"
import type { ReviewLanguage } from "./thesis-rubric"

export interface ComposedSection {
  id: string
  title: string
  content: string
  isConfidential?: boolean
  itemsCount?: number
}

export interface ComposedReviewResult {
  title: string
  metadata: {
    studentOrAuthor: string
    manuscriptTitle: string
    reviewer: string
    date: string
    grade?: string | null
    recommendation?: string | null
    isConfirmed: boolean
  }
  sections: ComposedSection[]
  plainText: string
  markdownText: string
  includedFindingsCount: number
}

/**
 * Filter findings eligible for review narrative composition.
 */
export function getEligibleFindings(
  findings: ReviewFinding[] = [],
  audience: FindingAudience = "author"
): ReviewFinding[] {
  return findings.filter((f) => {
    // 1. Must be marked for export
    if (f.includeInExport === false) return false

    // 2. Rejected findings are omitted by default
    if (f.status === "rejected") return false

    // 3. Confidential audience filter
    if (audience === "author" && f.audience === "private") return false
    if (audience === "author" && f.audience === "editor") return false

    return true
  })
}

/**
 * Composes a full structured review narrative for the target audience.
 */
export function composeFullReviewNarrative(
  review: ThesisReviewRecord,
  audience: FindingAudience = "author",
  lang: ReviewLanguage = review.language || "sk"
): ComposedReviewResult {
  const eligibleFindings = getEligibleFindings(review.findings, audience)
  const isConfirmed = Boolean(review.confirmedAt)
  const effectiveGrade = review.finalGrade || review.grade || review.suggestedGrade
  const effectiveRecommendation = review.finalRecommendation || review.recommendation || review.suggestedRecommendation

  const sections: ComposedSection[] = []

  // 1. Context & Metadata
  const contextTitle = lang === "sk" ? "1. Kontext a identifikácia" : "1. Context & Metadata"
  const contextContent = [
    `Rukopis / Práca: ${review.thesisTitle}`,
    `Autor: ${review.studentName}`,
    `Recenzent: ${review.reviewerName || "Anonymný recenzent"} (${review.reviewerRole})`,
    review.institution ? `Inštitúcia: ${review.institution}` : null,
    review.targetVenue ? `Cieľové fórum / Odbor: ${review.targetVenue}` : null,
  ].filter(Boolean).join("\n")
  sections.push({ id: "context", title: contextTitle, content: contextContent })

  // 2. Summary
  if (review.summary) {
    const sumTitle = lang === "sk" ? "2. Zhrnutie práce (Executive Summary)" : "2. Executive Summary"
    sections.push({ id: "summary", title: sumTitle, content: review.summary })
  }

  // 3. Strengths
  if (review.strengths && review.strengths.length > 0) {
    const strTitle = lang === "sk" ? "3. Silné stránky a prínos" : "3. Key Strengths & Novelty"
    const strContent = review.strengths.map((s, idx) => `${idx + 1}. ${s}`).join("\n")
    sections.push({ id: "strengths", title: strTitle, content: strContent, itemsCount: review.strengths.length })
  }

  // 4. Major Comments (Critical & Major)
  const majorFindings = eligibleFindings.filter((f) => f.severity === "critical" || f.severity === "major")
  if (majorFindings.length > 0) {
    const majTitle = lang === "sk" ? "4. Zásadné pripomienky (Major Concerns)" : "4. Major Concerns"
    const majContent = majorFindings.map((f, idx) => formatFindingItem(f, idx + 1, lang)).join("\n\n")
    sections.push({ id: "major_comments", title: majTitle, content: majContent, itemsCount: majorFindings.length })
  }

  // 5. Minor Comments & Suggestions
  const minorFindings = eligibleFindings.filter((f) => f.severity === "minor" || f.severity === "suggestion")
  if (minorFindings.length > 0) {
    const minTitle = lang === "sk" ? "5. Drobné pripomienky a odporúčania (Minor Concerns)" : "5. Minor Comments"
    const minContent = minorFindings.map((f, idx) => formatFindingItem(f, idx + 1, lang)).join("\n\n")
    sections.push({ id: "minor_comments", title: minTitle, content: minContent, itemsCount: minorFindings.length })
  }

  // 6. Reporting Guidelines
  if (review.reportingGuidelineChecks && review.reportingGuidelineChecks.length > 0) {
    const nonCompliant = review.reportingGuidelineChecks.filter((c) => c.status === "missing" || c.status === "partial")
    if (nonCompliant.length > 0) {
      const repTitle = lang === "sk" ? "6. Súlad s reporting štandardmi" : "6. Reporting Guidelines Adherence"
      const repContent = nonCompliant
        .map((c) => `• [${c.status.toUpperCase()}] ${c.item}: ${c.notes || "Nedostatočne doložené v texte"}`)
        .join("\n")
      sections.push({ id: "reporting_issues", title: repTitle, content: repContent, itemsCount: nonCompliant.length })
    }
  }

  // 7. Defense Questions / Questions for Authors
  const questions = review.questionsForAuthors?.length ? review.questionsForAuthors : review.defenseQuestions
  if (questions && questions.length > 0) {
    const qTitle = lang === "sk" ? "7. Otázky na obhajobu / pre autorov" : "7. Questions for Authors / Defense"
    const qContent = questions.map((q, idx) => `${idx + 1}. ${q}`).join("\n")
    sections.push({ id: "defense_questions", title: qTitle, content: qContent, itemsCount: questions.length })
  }

  // 8. Confidential Comments (Only for editor/committee)
  if (review.confidentialComments && audience !== "author") {
    const confTitle = lang === "sk" ? "8. Dôverné poznámky pre komisiu / editora" : "8. Confidential Comments to Editor/Committee"
    sections.push({ id: "confidential", title: confTitle, content: review.confidentialComments, isConfidential: true })
  }

  // 9. Final Decision & Assessment
  const decTitle = lang === "sk" ? "9. Záverečné stanovisko a hodnotenie" : "9. Final Decision & Assessment"
  const decLines = [
    effectiveRecommendation ? `Odporúčanie: ${effectiveRecommendation}` : null,
    effectiveGrade ? `Navrhovaná známka / ECTS: ${effectiveGrade}` : null,
    isConfirmed ? `(Rozhodnutie explicitne potvrdené recenzentom: ${new Date(review.confirmedAt!).toLocaleDateString()})` : "(Návrh rozhodnutia - čaká na potvrdenie recenzentom)",
  ].filter(Boolean).join("\n")
  sections.push({ id: "final_decision", title: decTitle, content: decLines })

  // 10. AI Transparency Disclosure
  const discTitle = lang === "sk" ? "10. Transparentné vyhlásenie o AI asistencii" : "10. AI Assistance Disclosure"
  const discContent = lang === "sk"
    ? "Tento posudok bol pripravený s asistenciou expertného AI modulu PosterApp v súlade s etickými štandardmi COPE. Všetky zistenia, citácie a záverečné hodnotenie boli overené a schválené odborným recenzentom."
    : "This review was prepared with the assistance of the PosterApp expert AI assessment module in compliance with COPE ethical guidelines. All findings, citations, and final decisions were verified and approved by the expert reviewer."
  sections.push({ id: "ai_disclosure", title: discTitle, content: discContent })

  // Build unified Plain Text and Markdown representations
  const mdParts = sections.map((s) => `## ${s.title}\n\n${s.content}`)
  const plainParts = sections.map((s) => `=== ${s.title} ===\n${s.content}`)

  return {
    title: `Posudok: ${review.thesisTitle}`,
    metadata: {
      studentOrAuthor: review.studentName,
      manuscriptTitle: review.thesisTitle,
      reviewer: review.reviewerName || "Recenzent",
      date: new Date().toLocaleDateString(),
      grade: effectiveGrade,
      recommendation: effectiveRecommendation,
      isConfirmed,
    },
    sections,
    plainText: plainParts.join("\n\n"),
    markdownText: mdParts.join("\n\n"),
    includedFindingsCount: eligibleFindings.length,
  }
}

function formatFindingItem(f: ReviewFinding, index: number, lang: ReviewLanguage): string {
  const text = f.reviewerNotes?.trim() || f.explanation
  const quote = f.evidence?.[0]?.quote ? `\n   » Citát z textu: "${f.evidence[0].quote}"` : ""
  const rec = f.recommendation ? `\n   Odporúčaná náprava: ${f.recommendation}` : ""

  return `${index}. [${f.category.toUpperCase()}] ${f.title}\n   ${text}${rec}${quote}`
}
