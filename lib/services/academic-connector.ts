/**
 * Academic Connector — unified façade over multiple academic databases.
 *
 * Sources:
 *  1. Semantic Scholar Graph API  (general papers, citations)
 *  2. arXiv API                   (physics, CS, math preprints)
 *
 * Used in thesis-review pipeline to:
 *  - Verify that cited works actually exist with identifier prioritization (DOI -> arXiv -> Title)
 *  - Check source-aware ISO 690 completeness (books, articles, preprints, web resources)
 *  - Distinguish rate limits, timeouts, and service errors from genuine missing citations
 */

import {
  searchPaperByTitle,
  fetchPaperDetails,
  verifyCitation,
  searchAuthor,
  fetchAuthorPapers,
  normalizeScholarQuery,
  type ScholarPaper,
  type CitationVerification,
  type ScholarAuthor,
  type AcademicLookupStatus,
} from "./semantic-scholar-service"
import { fetchArxivMetadata, parseArxivId } from "./arxiv-service"
import { extractStructuredReferences, type ExtractedReference } from "@/lib/ai/thesis-context"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { AcademicLookupStatus }

export interface AcademicPaperResult {
  source: "semanticscholar" | "arxiv"
  paperId?: string
  title: string
  authors: string[]
  year?: number | null
  abstract?: string | null
  doi?: string
  arxivId?: string
  url?: string
  citationCount?: number
}

export interface AuthorProfile {
  name: string
  scholarId?: string
  paperCount?: number
  citationCount?: number
  recentPapers: Pick<AcademicPaperResult, "title" | "year">[]
}

export interface CitationIssue {
  code:
    | "missing_author"
    | "missing_title"
    | "missing_year"
    | "missing_container"
    | "missing_publisher"
    | "missing_access_date"
    | "missing_identifier"
    | "inconsistent_metadata"
  severity: "warning" | "error"
  message: string
}

export interface CitationCheckResult {
  /** The citation string as extracted from the thesis */
  citedText: string
  status: AcademicLookupStatus
  verification: CitationVerification
  enriched?: AcademicPaperResult
  iso690Issues: CitationIssue[]
  attempts: number
}

export interface ThesisCitationAudit {
  total: number
  verified: number
  unverified: number
  unavailable: number
  results: CitationCheckResult[]
  summary: {
    verified: number
    notFound: number
    unavailable: number
    issuesByCode: Record<string, number>
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scholarPaperToResult(p: ScholarPaper): AcademicPaperResult {
  return {
    source: "semanticscholar",
    paperId: p.paperId,
    title: p.title,
    authors: p.authors.map((a) => a.name),
    year: p.year,
    abstract: p.abstract,
    doi: p.externalIds?.DOI,
    arxivId: p.externalIds?.ArXiv,
    url: p.url,
    citationCount: p.citationCount,
  }
}

/**
 * Detects source-aware ISO 690 completeness and metadata consistency issues.
 */
export function checkIso690Issues(
  citedText: string,
  refMeta: ExtractedReference,
  verifiedPaper: ScholarPaper | null
): CitationIssue[] {
  const issues: CitationIssue[] = []
  const preview = citedText.slice(0, 50).trim()

  // 1. Author check
  if (!refMeta.authors || refMeta.authors.length === 0) {
    issues.push({
      code: "missing_author",
      severity: "error",
      message: `Missing author(s) for citation: "${preview}..."`,
    })
  }

  // 2. Title check
  if (!refMeta.title || refMeta.title.length < 5) {
    issues.push({
      code: "missing_title",
      severity: "error",
      message: `Missing or incomplete title for citation: "${preview}..."`,
    })
  }

  // 3. Year check
  if (!refMeta.year) {
    issues.push({
      code: "missing_year",
      severity: "warning",
      message: `Missing publication year for citation: "${preview}..."`,
    })
  }

  // 4. Web resource checks
  if (refMeta.sourceType === "web") {
    if (!refMeta.url) {
      issues.push({
        code: "missing_identifier",
        severity: "error",
        message: `Web resource is missing URL: "${preview}..."`,
      })
    }
    const hasAccessDate = /\[cit\.\s*\d{4}[-\.]\d{1,2}[-\.]\d{1,2}\]|\[cit\.\s*\d{1,2}\.\s*\d{1,2}\.\s*\d{4}\]|online/i.test(citedText)
    if (!hasAccessDate) {
      issues.push({
        code: "missing_access_date",
        severity: "warning",
        message: `Web citation is missing ISO 690 citation/access date [cit. YYYY-MM-DD]: "${preview}..."`,
      })
    }
  }

  // 5. Books / Theses: do not demand DOI
  if (refMeta.sourceType === "article" || refMeta.sourceType === "preprint") {
    if (!refMeta.doi && !refMeta.arxivId && (!verifiedPaper || !verifiedPaper.externalIds?.DOI)) {
      issues.push({
        code: "missing_identifier",
        severity: "warning",
        message: `No DOI or persistent identifier found for article: "${preview}..."`,
      })
    }
  }

  // 6. Metadata discrepancy checks with verified paper
  if (verifiedPaper && refMeta.year && verifiedPaper.year) {
    if (Math.abs(refMeta.year - verifiedPaper.year) > 1) {
      issues.push({
        code: "inconsistent_metadata",
        severity: "warning",
        message: `Cited year (${refMeta.year}) differs from academic registry record (${verifiedPaper.year}) for: "${preview}..."`,
      })
    }
  }

  return issues
}

// ---------------------------------------------------------------------------
// Concurrency Controller
// ---------------------------------------------------------------------------

async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIdx = 0

  async function worker() {
    while (nextIdx < items.length) {
      const cur = nextIdx++
      results[cur] = await fn(items[cur], cur)
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search for a paper across Semantic Scholar and arXiv with identifier prioritization.
 */
export async function searchAcademicPaper(query: string, limit = 5): Promise<AcademicPaperResult[]> {
  const trimmed = query.trim()

  // 1. Check if DOI
  const doiMatch = trimmed.match(/10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/i)
  if (doiMatch) {
    const { paper } = await fetchPaperDetails(`DOI:${doiMatch[0]}`)
    if (paper) return [scholarPaperToResult(paper)]
  }

  // 2. Check if arXiv ID
  const arxivId = parseArxivId(trimmed)
  if (arxivId) {
    const meta = await fetchArxivMetadata(arxivId)
    if (meta) {
      return [{
        source: "arxiv",
        title: meta.title ?? query,
        authors: meta.authors ?? [],
        year: meta.publishedYear ? parseInt(meta.publishedYear, 10) : undefined,
        abstract: meta.abstract,
        doi: meta.doi,
        arxivId: meta.arxivId,
        url: meta.pdfUrl,
      }]
    }
  }

  // 3. Fallback to title search
  const { papers } = await searchPaperByTitle(trimmed, limit)
  return papers.map(scholarPaperToResult)
}

/**
 * Verify a single citation reference with prioritized identifiers:
 *  1. Direct DOI lookup
 *  2. Direct arXiv lookup
 *  3. Normalized title fuzzy search
 */
export async function verifySingleCitation(
  citedText: string,
  signal?: AbortSignal
): Promise<CitationCheckResult> {
  const parsedList = extractStructuredReferences(citedText)
  const refMeta: ExtractedReference = parsedList.length > 0
    ? parsedList[0]
    : {
        raw: citedText,
        title: citedText.slice(0, 100),
        authors: [],
        sourceType: "unknown",
        parseWarnings: [],
      }

  let verification: CitationVerification | null = null
  let enriched: AcademicPaperResult | undefined

  // 1. Direct DOI lookup
  if (refMeta.doi) {
    const { paper, status } = await fetchPaperDetails(`DOI:${refMeta.doi}`, signal)
    if (paper) {
      verification = {
        found: true,
        status: "verified",
        confidence: "high",
        paper,
        attempts: 1,
      }
      enriched = scholarPaperToResult(paper)
    } else if (status === "rate_limited" || status === "timeout" || status === "service_error") {
      verification = {
        found: false,
        status,
        confidence: "not_found",
        paper: null,
        note: `Lookup unavailable (${status})`,
        attempts: 1,
      }
    }
  }

  // 2. Direct arXiv lookup
  if (!verification?.found && refMeta.arxivId) {
    const arxivMeta = await fetchArxivMetadata(refMeta.arxivId)
    if (arxivMeta) {
      const scholarShape: ScholarPaper = {
        paperId: `ARXIV:${arxivMeta.arxivId}`,
        title: arxivMeta.title ?? refMeta.title ?? "ArXiv Paper",
        year: arxivMeta.publishedYear ? parseInt(arxivMeta.publishedYear, 10) : undefined,
        authors: (arxivMeta.authors ?? []).map((name, i) => ({ authorId: `a-${i}`, name })),
        abstract: arxivMeta.abstract,
        externalIds: { ArXiv: arxivMeta.arxivId, DOI: arxivMeta.doi },
        url: arxivMeta.pdfUrl,
      }
      verification = {
        found: true,
        status: "verified",
        confidence: "high",
        paper: scholarShape,
        attempts: 1,
      }
      enriched = scholarPaperToResult(scholarShape)
    }
  }

  // 3. Normalized title search
  if (!verification || (!verification.found && verification.status === "not_found")) {
    const searchTarget = refMeta.title || citedText
    verification = await verifyCitation(searchTarget, signal)
    if (verification.paper) {
      enriched = scholarPaperToResult(verification.paper)
    }
  }

  const iso690Issues = checkIso690Issues(citedText, refMeta, verification?.paper ?? null)

  return {
    citedText,
    status: verification?.status ?? "not_found",
    verification: verification ?? {
      found: false,
      status: "not_found",
      confidence: "not_found",
      paper: null,
      attempts: 0,
    },
    enriched,
    iso690Issues,
    attempts: 1,
  }
}

/**
 * Verify a list of citation strings with concurrency control, deduplication, and source-aware ISO 690 rules.
 */
export async function auditThesisCitations(
  citedTitles: string[],
  concurrency = 3,
  timeoutMs = 25_000
): Promise<ThesisCitationAudit> {
  const capped = citedTitles.slice(0, 30)
  const abortCtrl = new AbortController()
  const timer = setTimeout(() => abortCtrl.abort(), timeoutMs)

  // Deduplication cache
  const cache = new Map<string, Promise<CitationCheckResult>>()

  try {
    const results = await mapConcurrent(capped, concurrency, async (cited) => {
      const cacheKey = normalizeScholarQuery(cited)
      if (!cache.has(cacheKey)) {
        cache.set(cacheKey, verifySingleCitation(cited, abortCtrl.signal))
      }
      return cache.get(cacheKey)!
    })

    const verified = results.filter((r) => r.verification.found).length
    const unavailable = results.filter((r) =>
      r.status === "rate_limited" || r.status === "timeout" || r.status === "service_error"
    ).length
    const unverified = results.length - verified - unavailable

    const issuesByCode: Record<string, number> = {}
    for (const res of results) {
      for (const iss of res.iso690Issues) {
        issuesByCode[iss.code] = (issuesByCode[iss.code] ?? 0) + 1
      }
    }

    return {
      total: results.length,
      verified,
      unverified,
      unavailable,
      results,
      summary: {
        verified,
        notFound: unverified,
        unavailable,
        issuesByCode,
      },
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Look up author profile from Semantic Scholar.
 */
export async function fetchAcademicAuthorProfile(name: string): Promise<AuthorProfile | null> {
  const author: ScholarAuthor | null = await searchAuthor(name)
  if (!author) return null

  const papers = await fetchAuthorPapers(author.authorId, 5)

  return {
    name: author.name,
    scholarId: author.authorId,
    paperCount: author.paperCount,
    citationCount: author.citationCount,
    recentPapers: papers.map((p) => ({ title: p.title, year: p.year })),
  }
}

