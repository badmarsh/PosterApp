/**
 * Academic Connector — Perplexity-style multi-source academic discovery & verification engine.
 *
 * Sources:
 *  1. OpenAlex API                (250M+ works, Open Access PDFs, topic tags, citation counts)
 *  2. Crossref API                (150M+ works, authoritative DOIs, journal volume/issue/pages)
 *  3. Semantic Scholar Graph API  (citation graph, AI summaries, influential citations)
 *  4. arXiv API                   (physics, CS, math preprints)
 *
 * Capabilities:
 *  - Multi-provider parallel consensus search with automatic deduplication
 *  - Direct DOI & arXiv identifier lookup
 *  - Open Access PDF direct link retrieval
 *  - Source-aware ISO 690 completeness & metadata discrepancy auditing
 *  - 1-Click BibTeX generation for posters and papers
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
import { searchOpenAlexWorks, fetchOpenAlexByDoi, type OpenAlexWork } from "./openalex-service"
import { searchCrossrefWorks, fetchCrossrefByDoi, type CrossrefWork } from "./crossref-service"
import { extractStructuredReferences, type ExtractedReference } from "@/lib/ai/thesis-context"
import { searchTavily } from "./tavily-service"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { AcademicLookupStatus }

export interface AcademicPaperResult {
  source: "semanticscholar" | "arxiv" | "openalex" | "crossref" | "tavily"
  paperId?: string
  title: string
  authors: string[]
  year?: number | null
  venue?: string | null
  publisher?: string | null
  abstract?: string | null
  tldr?: string | null
  doi?: string
  arxivId?: string
  url?: string
  openAccessPdfUrl?: string
  citationCount?: number
  influentialCitationCount?: number
  topics?: string[]
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

export interface AcademicSearchOptions {
  limit?: number
  yearFrom?: number
  yearTo?: number
  domain?: string
  signal?: AbortSignal
}

// ---------------------------------------------------------------------------
// Conversion Helpers
// ---------------------------------------------------------------------------

function scholarPaperToResult(p: ScholarPaper): AcademicPaperResult {
  return {
    source: "semanticscholar",
    paperId: p.paperId,
    title: p.title,
    authors: p.authors.map((a) => a.name),
    year: p.year,
    venue: p.venue || undefined,
    abstract: p.abstract,
    tldr: p.tldr?.text,
    doi: p.externalIds?.DOI,
    arxivId: p.externalIds?.ArXiv,
    url: p.url,
    openAccessPdfUrl: p.openAccessPdf?.url,
    citationCount: p.citationCount,
    influentialCitationCount: p.influentialCitationCount,
  }
}

function openAlexWorkToResult(w: OpenAlexWork): AcademicPaperResult {
  return {
    source: "openalex",
    paperId: w.id,
    title: w.title,
    authors: w.authors,
    year: w.publicationYear,
    venue: w.venue,
    publisher: w.publisher,
    abstract: w.abstract,
    doi: w.doi,
    url: w.landingPageUrl,
    openAccessPdfUrl: w.openAccessPdfUrl,
    citationCount: w.citedByCount,
    topics: w.topics,
  }
}

function crossrefWorkToResult(c: CrossrefWork): AcademicPaperResult {
  return {
    source: "crossref",
    title: c.title,
    authors: c.authors,
    year: c.publishedYear,
    venue: c.containerTitle,
    publisher: c.publisher,
    doi: c.doi,
    url: c.url,
  }
}

/**
 * Normalize title string for robust deduplication across databases.
 */
function normalizeTitleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim()
}

/**
 * Merge duplicate paper records from different providers into a single enriched record.
 */
function mergePaperRecords(primary: AcademicPaperResult, secondary: AcademicPaperResult): AcademicPaperResult {
  return {
    ...primary,
    venue: primary.venue || secondary.venue,
    publisher: primary.publisher || secondary.publisher,
    abstract: primary.abstract || secondary.abstract,
    tldr: primary.tldr || secondary.tldr,
    doi: primary.doi || secondary.doi,
    arxivId: primary.arxivId || secondary.arxivId,
    openAccessPdfUrl: primary.openAccessPdfUrl || secondary.openAccessPdfUrl,
    url: primary.openAccessPdfUrl ? primary.url : secondary.url || primary.url,
    citationCount: Math.max(primary.citationCount || 0, secondary.citationCount || 0) || undefined,
    topics: primary.topics || secondary.topics,
    authors: primary.authors.length > 0 ? primary.authors : secondary.authors,
    year: primary.year || secondary.year,
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
// Public Multi-Source Search API
// ---------------------------------------------------------------------------

/**
 * Search for papers across OpenAlex, Semantic Scholar, Crossref, and arXiv in parallel
 * with consensus deduplication and citation ranking (Perplexity-style).
 */
export async function searchAcademicPaper(
  query: string,
  limit = 5,
  options?: AcademicSearchOptions
): Promise<AcademicPaperResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  // 1. Direct DOI identifier check
  const doiMatch = trimmed.match(/10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/i)
  if (doiMatch) {
    const doi = doiMatch[0]
    // Parallel fetch across OpenAlex, Semantic Scholar, and Crossref
    const [openAlexRes, scholarRes, crossrefRes] = await Promise.allSettled([
      fetchOpenAlexByDoi(doi, options?.signal),
      fetchPaperDetails(`DOI:${doi}`, options?.signal),
      fetchCrossrefByDoi(doi, options?.signal),
    ])

    const candidateResults: AcademicPaperResult[] = []
    if (openAlexRes.status === "fulfilled" && openAlexRes.value) {
      candidateResults.push(openAlexWorkToResult(openAlexRes.value))
    }
    if (scholarRes.status === "fulfilled" && scholarRes.value.paper) {
      candidateResults.push(scholarPaperToResult(scholarRes.value.paper))
    }
    if (crossrefRes.status === "fulfilled" && crossrefRes.value) {
      candidateResults.push(crossrefWorkToResult(crossrefRes.value))
    }

    if (candidateResults.length > 0) {
      let merged = candidateResults[0]
      for (let i = 1; i < candidateResults.length; i++) {
        merged = mergePaperRecords(merged, candidateResults[i])
      }
      return [merged]
    }
  }

  // 2. Direct arXiv identifier check
  const arxivId = parseArxivId(trimmed)
  if (arxivId) {
    const meta = await fetchArxivMetadata(arxivId)
    if (meta) {
      return [{
        source: "arxiv",
        paperId: `ARXIV:${meta.arxivId}`,
        title: meta.title ?? query,
        authors: meta.authors ?? [],
        year: meta.publishedYear ? parseInt(meta.publishedYear, 10) : undefined,
        venue: "arXiv preprint",
        abstract: meta.abstract,
        doi: meta.doi,
        arxivId: meta.arxivId,
        url: meta.pdfUrl,
        openAccessPdfUrl: meta.pdfUrl,
      }]
    }
  }

  // 3. Parallel Multi-Source Query (OpenAlex + Semantic Scholar + Crossref + Tavily)
  const [openAlexList, scholarList, crossrefList, tavilyList] = await Promise.all([
    searchOpenAlexWorks(trimmed, limit, {
      yearFrom: options?.yearFrom,
      yearTo: options?.yearTo,
      signal: options?.signal,
    }).catch(() => []),
    searchPaperByTitle(trimmed, limit, options?.signal)
      .then((r) => r.papers)
      .catch(() => []),
    searchCrossrefWorks(trimmed, limit, options?.signal).catch(() => []),
    searchTavily(trimmed, options?.signal).catch(() => []),
  ])

  // Aggregate and deduplicate records by normalized title key and DOI
  const mapByKey = new Map<string, AcademicPaperResult>()

  // A. Add OpenAlex results
  for (const w of openAlexList) {
    const res = openAlexWorkToResult(w)
    const key = w.doi ? `doi:${w.doi.toLowerCase()}` : normalizeTitleKey(w.title)
    if (key) mapByKey.set(key, res)
  }

  // B. Merge Semantic Scholar results
  for (const sp of scholarList) {
    const res = scholarPaperToResult(sp)
    const key = sp.externalIds?.DOI
      ? `doi:${sp.externalIds.DOI.toLowerCase()}`
      : normalizeTitleKey(sp.title)
    if (key) {
      const existing = mapByKey.get(key)
      if (existing) {
        mapByKey.set(key, mergePaperRecords(existing, res))
      } else {
        mapByKey.set(key, res)
      }
    }
  }

  // C. Merge Crossref results
  for (const c of crossrefList) {
    const res = crossrefWorkToResult(c)
    const key = c.doi ? `doi:${c.doi.toLowerCase()}` : normalizeTitleKey(c.title)
    if (key) {
      const existing = mapByKey.get(key)
      if (existing) {
        mapByKey.set(key, mergePaperRecords(existing, res))
      } else {
        mapByKey.set(key, res)
      }
    }
  }

  // D. Merge Tavily results
  for (const t of tavilyList) {
    const key = normalizeTitleKey(t.title)
    if (key && !mapByKey.has(key)) {
      mapByKey.set(key, {
        source: "tavily",
        title: t.title,
        authors: [],
        abstract: t.content,
        url: t.url,
      })
    }
  }

  const mergedResults = Array.from(mapByKey.values())

  // Sort by citation count (if available) and relevance
  mergedResults.sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0))

  return mergedResults.slice(0, limit)
}

/**
 * Verify a single citation reference with prioritized multi-source lookups.
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

  // 1. Direct DOI lookup across OpenAlex / Semantic Scholar / Crossref
  if (refMeta.doi) {
    const [scholarRes, openAlexRes] = await Promise.allSettled([
      fetchPaperDetails(`DOI:${refMeta.doi}`, signal),
      fetchOpenAlexByDoi(refMeta.doi, signal),
    ])

    if (scholarRes.status === "fulfilled" && scholarRes.value.paper) {
      const paper = scholarRes.value.paper
      verification = {
        found: true,
        status: "verified",
        confidence: "high",
        paper,
        attempts: 1,
      }
      enriched = scholarPaperToResult(paper)
    } else if (openAlexRes.status === "fulfilled" && openAlexRes.value) {
      const oa = openAlexRes.value
      const scholarShape: ScholarPaper = {
        paperId: oa.id,
        title: oa.title,
        year: oa.publicationYear,
        authors: oa.authors.map((name, i) => ({ authorId: `oa-${i}`, name })),
        abstract: oa.abstract,
        venue: oa.venue,
        externalIds: { DOI: oa.doi },
        url: oa.landingPageUrl,
        citationCount: oa.citedByCount,
      }
      verification = {
        found: true,
        status: "verified",
        confidence: "high",
        paper: scholarShape,
        attempts: 1,
      }
      enriched = openAlexWorkToResult(oa)
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

  // 3. Multi-source Title Fuzzy Search
  if (!verification || (!verification.found && verification.status === "not_found")) {
    const searchTarget = refMeta.title || citedText
    verification = await verifyCitation(searchTarget, signal)
    if (verification.paper) {
      enriched = scholarPaperToResult(verification.paper)
    } else if (verification.status === "not_found") {
      // Fallback to OpenAlex fuzzy title search
      const oaFallback = await searchOpenAlexWorks(searchTarget, 1, { signal }).catch(() => [])
      if (oaFallback.length > 0) {
        const top = oaFallback[0]
        const scholarShape: ScholarPaper = {
          paperId: top.id,
          title: top.title,
          year: top.publicationYear,
          authors: top.authors.map((name, i) => ({ authorId: `oa-${i}`, name })),
          abstract: top.abstract,
          venue: top.venue,
          externalIds: { DOI: top.doi },
          url: top.landingPageUrl,
          citationCount: top.citedByCount,
        }
        verification = {
          found: true,
          status: "verified",
          confidence: "medium",
          paper: scholarShape,
          attempts: 2,
        }
        enriched = openAlexWorkToResult(top)
      } else {
        // Fallback to Tavily Web Search
        const tavilyResults = await searchTavily(searchTarget, signal).catch(() => [])
        if (tavilyResults.length > 0) {
          const top = tavilyResults[0]
          const scholarShape: ScholarPaper = {
            paperId: `tavily-${Date.now()}`,
            title: top.title || refMeta.title || "Web Resource",
            year: refMeta.year,
            authors: refMeta.authors?.map((name, i) => ({ authorId: `t-${i}`, name })) || [],
            abstract: top.content,
            url: top.url,
          }
          verification = {
            found: true,
            status: "verified",
            confidence: "low",
            paper: scholarShape,
            attempts: 3,
          }
          enriched = {
            source: "tavily",
            title: scholarShape.title,
            authors: refMeta.authors || [],
            year: refMeta.year,
            abstract: top.content,
            url: top.url,
          }
        }
      }
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
