/**
 * Export-time completeness check for a review record.
 *
 * Thin wrapper around `review-bucketing`'s statutory helpers that knows how to
 * flatten a review record into the plain text the checks run on. Kept separate
 * from the route because Next.js route files may only export HTTP handlers.
 */

import type { ReviewFinding } from "./review-types"
import {
  checkStatutoryPosudok,
  stripDiacritics,
  type StatutoryCheckInput,
  type StatutoryCheckResult,
} from "./review-bucketing"

export type { StatutoryCheckResult } from "./review-bucketing"

/**
 * The subset of a review record the completeness check reads. Structural (not
 * `ThesisReviewRecord`) so both the client store record and the deserialized
 * DB row can be passed without casting.
 */
export interface ReviewExportTextParts {
  thesisType?: string | null
  reviewerRole?: string | null
  reviewKind?: string | null
  language?: string | null
  institution?: string | null
  summary?: string | null
  recommendation?: string | null
  strengths?: string[] | null
  sections?: Array<{ text?: string | null; suggestions?: string[] | null }> | null
  findings?: ReviewFinding[] | null
  defenseQuestions?: string[] | null
  questionsForAuthors?: string[] | null
  citationIssues?: string[] | null
  confidentialComments?: string | null
  phdEnrichment?: { statutoryClause?: string } | null
  limitationsSummary?: string | null
}

/**
 * Flatten a review into the text that ends up in the exported document. Findings
 * are rendered the same way the DOCX/LaTeX generators do it (title + explanation
 * + recommendation), so the check inspects what a reader actually receives.
 */
export function buildReviewExportText(review: ReviewExportTextParts): string {
  const parts: string[] = [review.summary || "", review.recommendation || ""]

  for (const s of review.strengths || []) parts.push(s)

  for (const sec of review.sections || []) {
    parts.push(sec.text || "")
    parts.push(...(sec.suggestions || []))
  }

  for (const f of (review.findings || []) as ReviewFinding[]) {
    if (f.includeInExport === false || f.status === "rejected") continue
    parts.push(`${f.title}. ${f.explanation || ""} ${f.recommendation || ""}`)
  }

  parts.push(...(review.questionsForAuthors || []))
  parts.push(...(review.defenseQuestions || []))
  if (review.confidentialComments) parts.push(review.confidentialComments)
  const statutoryClause = review.phdEnrichment?.statutoryClause
  if (typeof statutoryClause === "string") parts.push(statutoryClause)

  return parts.filter(Boolean).join("\n\n")
}

export interface ExportCompletenessResult extends StatutoryCheckResult {
  /** True when the exported text only reflects excerpts of the document. */
  excerptOnly: boolean
}

/**
 * Runs the statutory check plus the two structural smells found in real
 * exports: judging from available fragments ("z dostupných úryvkov") and
 * self-contradictory citation notes.
 */
export function checkExportCompleteness(review: ReviewExportTextParts): ExportCompletenessResult {
  const text = buildReviewExportText(review)
  const base = checkStatutoryPosudok({
    input: {
      thesisType: review.thesisType || "master",
      reviewerRole: review.reviewerRole,
      language: review.language,
      institution: review.institution,
      reviewKind: review.reviewKind,
    } as StatutoryCheckInput,
    text,
    citationIssues: review.citationIssues ?? [],
  })

  const folded = stripDiacritics(text)
  const excerptOnly = /z dostupn[ae]ch (uryvk|extract)|from the available excerpts|excerptov/.test(folded)

  const problems = [...base.problems]
  if (excerptOnly && !problems.some((p) => /výňatk|excerpt/i.test(p))) {
    problems.push(
      "Text priznáva hodnotenie z čiastočných výňatkov; posudok k dizertačnej práci musí vychádzať z celého rukopisu."
    )
  }

  return { ...base, excerptOnly, problems, ok: problems.length === 0 }
}

/**
 * Headers that advertise the statutory completeness of a doctoral posudok on
 * any export response (PDF, DOCX, Markdown). Non-blocking by design: the UI
 * surfaces them as a warning, and `?strict=true` / `body.strict` on the PDF
 * export turns them into a hard refusal.
 */
export function completenessHeadersFrom(result: ExportCompletenessResult): Record<string, string> {
  if (!result.applies) return {}
  const missing =
    result.missing.length > 0
      ? result.missing.join(", ")
      : result.conclusiveStatementMissing
        ? "záverečné stanovisko"
        : result.excerptBoundClaims
          ? "hodnotenie z výňatkov"
          : "protirečivé poznámky k citáciám"
  return {
    "X-Posudok-Completeness": result.ok ? "complete" : "incomplete",
    "X-Posudok-Missing-Items": (result.ok ? "" : missing).slice(0, 200),
  }
}

/** Convenience wrapper: check + headers in one call (for exports without a strict gate). */
export function completenessHeaders(review: ReviewExportTextParts): Record<string, string> {
  return completenessHeadersFrom(checkExportCompleteness(review))
}
