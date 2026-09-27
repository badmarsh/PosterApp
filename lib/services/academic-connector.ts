/**
 * Academic Connector — Perplexity-style multi-source academic discovery & verification engine.
 *
 * Sources:
 *  1. OpenAlex API                (250M+ works, Open Access PDFs, topic tags, citation counts)
 *  2. Crossref API                (150M+ works, authoritative DOIs, journal volume/issue/pages)
 *  3. Semantic Scholar Graph API  (citation graph, AI summaries, influential citations)
 *  4. arXiv API                   (physics, CS, math preprints)
 *  5. Tavily web search           (optional, only when TAVILY_API_KEY is set)
 *
 * Capabilities:
 *  - Multi-provider parallel consensus search; every provider is bounded by its own
 *    timeout so one hung upstream cannot stall the fan-out
 *  - Identity-aware deduplication (DOI ∪ arXiv id ∪ Unicode-safe title key) and
 *    field-wise merging that keeps the best value from each provider
 *  - Reciprocal-rank-fusion ranking with exact-title, citation and consensus bonuses
 *  - Direct DOI & arXiv identifier lookup (tolerant of pasted punctuation)
 *  - Source-aware ISO 690 completeness & metadata discrepancy auditing
 *  - Citation verification with similarity-gated fallbacks across all registries
 *  - Per-provider diagnostics (`searchAcademicPaperDetailed`) for observability
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
import { searchOpenAlexWorksDetailed, fetchOpenAlexByDoi, type OpenAlexWork } from "./openalex-service"
import { searchCrossrefWorksDetailed, fetchCrossrefByDoi, type CrossrefWork } from "./crossref-service"
import { extractStructuredReferences, type ExtractedReference } from "@/lib/ai/thesis-context"
import { searchTavily } from "./tavily-service"
import { ACADEMIC_TIMEOUTS_MS, boundedSignal, type ProviderStatus } from "./academic-http"
import {
  arxivIdFromDoi,
  authorsOverlap,
  cleanAuthors,
  cleanCitationTitle,
  compareTitles,
  extractDoi,
  normalizeArxivId,
  normalizeDoi,
  stripDoi,
  titleKey,
  titleMatchConfidence,
} from "./academic-identifiers"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { AcademicLookupStatus }

export type AcademicSource = "semanticscholar" | "arxiv" | "openalex" | "crossref" | "tavily"

export interface AcademicPaperResult {
  /** Provider that contributed the primary record. */
  source: AcademicSource
  /** Every provider that returned this paper (consensus signal; ≥ 2 = confirmed). */
  sources?: AcademicSource[]
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
  /** True when any provider reports the paper as retracted. */
  isRetracted?: boolean
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
  /** Citations beyond the per-audit cap that were not checked. */
  skipped: number
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

export interface ProviderDiagnostics {
  status: ProviderStatus
  count: number
  latencyMs: number
  statusCode?: number
}

export type AcademicSearchMode = "doi" | "arxiv" | "search"

export interface AcademicSearchResponse {
  results: AcademicPaperResult[]
  mode: AcademicSearchMode
  providers: Record<string, ProviderDiagnostics>
  /** True when at least one provider failed, timed out or was rate-limited. */
  degraded: boolean
  /** Rows removed because they fell outside the requested year window. */
  filteredByYear: number
}

/**
 * Ranking constants (documented so benchmark artifacts can snapshot them).
 * Score = Σ_providers weight / (RRF_K + rank) + title bonus + citation term + consensus bonus.
 */
export const RANKING_TUNABLES = {
  RRF_K: 60,
  PROVIDER_WEIGHTS: { openalex: 1.0, semanticscholar: 1.0, crossref: 0.8, arxiv: 0.9, tavily: 0.5 } as Record<AcademicSource, number>,
  EXACT_TITLE_BONUS: 0.05,
  NEAR_TITLE_BONUS: 0.02,
  NEAR_TITLE_JACCARD: 0.6,
  CITATION_WEIGHT: 0.004,
  CONSENSUS_BONUS: 0.01,
} as const

// ---------------------------------------------------------------------------
// Conversion Helpers
// ---------------------------------------------------------------------------

const nonEmpty = (v: string | null | undefined): string | undefined => (v && v.trim() ? v : undefined)

function scholarPaperToResult(p: ScholarPaper): AcademicPaperResult {
  const doi = p.externalIds?.DOI ? stripDoi(p.externalIds.DOI) : undefined
  return {
    source: "semanticscholar",
    sources: ["semanticscholar"],
    paperId: p.paperId,
    title: p.title,
    authors: cleanAuthors((p.authors ?? []).map((a) => a.name)),
    year: p.year,
    venue: nonEmpty(p.venue),
    abstract: nonEmpty(p.abstract),
    tldr: nonEmpty(p.tldr?.text),
    doi,
    arxivId: normalizeArxivId(p.externalIds?.ArXiv) ?? arxivIdFromDoi(doi),
    url: nonEmpty(p.url),
    // Semantic Scholar returns `openAccessPdf.url: ""` for closed papers.
    openAccessPdfUrl: nonEmpty(p.openAccessPdf?.url),
    citationCount: p.citationCount,
    influentialCitationCount: p.influentialCitationCount,
  }
}

function openAlexWorkToResult(w: OpenAlexWork): AcademicPaperResult {
  return {
    source: "openalex",
    sources: ["openalex"],
    paperId: w.id,
    title: w.title,
    authors: cleanAuthors(w.authors),
    year: w.publicationYear,
    venue: nonEmpty(w.venue),
    publisher: nonEmpty(w.publisher),
    abstract: nonEmpty(w.abstract),
    doi: w.doi,
    arxivId: arxivIdFromDoi(w.doi),
    url: nonEmpty(w.landingPageUrl),
    openAccessPdfUrl: nonEmpty(w.openAccessPdfUrl),
    citationCount: w.citedByCount,
    topics: w.topics?.length ? w.topics : undefined,
    isRetracted: w.isRetracted || undefined,
  }
}

function crossrefWorkToResult(c: CrossrefWork): AcademicPaperResult {
  return {
    source: "crossref",
    sources: ["crossref"],
    title: c.title,
    authors: cleanAuthors(c.authors),
    year: c.publishedYear,
    venue: nonEmpty(c.containerTitle),
    publisher: nonEmpty(c.publisher),
    doi: c.doi,
    arxivId: arxivIdFromDoi(c.doi),
    url: nonEmpty(c.url),
    citationCount: c.citedByCount,
    isRetracted: c.isRetracted || undefined,
  }
}

function stableTavilyId(url: string): string {
  let h = 0
  for (let i = 0; i < url.length; i++) h = (h * 31 + url.charCodeAt(i)) | 0
  return `tavily-${(h >>> 0).toString(36)}`
}

// ---------------------------------------------------------------------------
// Identity, merging & ranking
// ---------------------------------------------------------------------------

/** Identity keys of a record: `doi:`, `arxiv:` and `title:` (Unicode-safe). */
function paperIdentityKeys(r: Pick<AcademicPaperResult, "doi" | "arxivId" | "title">): string[] {
  const keys: string[] = []
  if (r.doi) keys.push(`doi:${normalizeDoi(r.doi)}`)
  const arxiv = normalizeArxivId(r.arxivId) ?? arxivIdFromDoi(r.doi)
  if (arxiv) keys.push(`arxiv:${arxiv}`)
  const t = titleKey(r.title)
  if (t) keys.push(`title:${t}`)
  return keys
}

/**
 * Two records with the same title key may still be different works (generic titles such
 * as "Machine Learning" recur as book chapters). Only merge when their identifiers do not
 * conflict and the authors/years are compatible.
 */
function compatibleForTitleMerge(a: AcademicPaperResult, b: AcademicPaperResult): boolean {
  const aDoi = a.doi ? normalizeDoi(a.doi) : undefined
  const bDoi = b.doi ? normalizeDoi(b.doi) : undefined
  if (aDoi && bDoi && aDoi !== bDoi) {
    const aArx = arxivIdFromDoi(aDoi) ?? normalizeArxivId(a.arxivId)
    const bArx = arxivIdFromDoi(bDoi) ?? normalizeArxivId(b.arxivId)
    if (!(aArx && bArx && aArx === bArx)) return false
  }
  const aAuthors = cleanAuthors(a.authors)
  const bAuthors = cleanAuthors(b.authors)
  if (aAuthors.length && bAuthors.length) return authorsOverlap(aAuthors, bAuthors)
  if (typeof a.year === "number" && typeof b.year === "number") return Math.abs(a.year - b.year) <= 2
  return true
}

/**
 * Keep the primary provider's year unless the secondary is implausibly earlier (> 3 years):
 * that pattern is a re-registration of an old paper (e.g. a 2025 DOI for a 2017 preprint),
 * where the earlier year is the real first appearance.
 */
function mergedYear(primary: number | null | undefined, secondary: number | null | undefined): number | null | undefined {
  if (typeof primary !== "number") return secondary ?? primary
  if (typeof secondary !== "number") return primary
  return primary - secondary > 3 ? secondary : primary
}

function longer(a: string | null | undefined, b: string | null | undefined): string | undefined {
  const x = nonEmpty(a)
  const y = nonEmpty(b)
  if (!x) return y
  if (!y) return x
  return y.length > x.length ? y : x
}

/**
 * Merge duplicate paper records from different providers into a single enriched record.
 * Field-wise: real authors beat sentinels, counts take the max, identifiers union.
 */
function mergePaperRecords(primary: AcademicPaperResult, secondary: AcademicPaperResult): AcademicPaperResult {
  const primaryAuthors = cleanAuthors(primary.authors)
  const secondaryAuthors = cleanAuthors(secondary.authors)
  const citationCount = Math.max(primary.citationCount ?? -1, secondary.citationCount ?? -1)
  const influential = Math.max(primary.influentialCitationCount ?? -1, secondary.influentialCitationCount ?? -1)
  const sources = Array.from(new Set([...(primary.sources ?? [primary.source]), ...(secondary.sources ?? [secondary.source])]))
  const doi = primary.doi || secondary.doi
  return {
    ...primary,
    sources,
    paperId: primary.paperId || secondary.paperId,
    venue: nonEmpty(primary.venue) || nonEmpty(secondary.venue),
    publisher: nonEmpty(primary.publisher) || nonEmpty(secondary.publisher),
    abstract: longer(primary.abstract, secondary.abstract),
    tldr: nonEmpty(primary.tldr) || nonEmpty(secondary.tldr),
    doi: doi ? stripDoi(doi) : undefined,
    arxivId: normalizeArxivId(primary.arxivId) || normalizeArxivId(secondary.arxivId) || arxivIdFromDoi(doi),
    openAccessPdfUrl: nonEmpty(primary.openAccessPdfUrl) || nonEmpty(secondary.openAccessPdfUrl),
    url: nonEmpty(primary.url) || nonEmpty(secondary.url),
    citationCount: citationCount >= 0 ? citationCount : undefined,
    influentialCitationCount: influential >= 0 ? influential : undefined,
    topics: primary.topics?.length ? primary.topics : secondary.topics,
    authors: primaryAuthors.length >= secondaryAuthors.length ? primaryAuthors : secondaryAuthors,
    year: mergedYear(primary.year, secondary.year),
    // A retraction reported by any provider must survive the merge.
    isRetracted: primary.isRetracted || secondary.isRetracted || undefined,
  }
}

interface RankedCandidate {
  record: AcademicPaperResult
  /** provider → 0-based rank in that provider's own list */
  ranks: Partial<Record<AcademicSource, number>>
}

/**
 * Identity-aware deduplication. Records are merged when they share a DOI, an arXiv id
 * (incl. DataCite `10.48550/arXiv.*` DOIs) or a compatible title key. Records whose
 * title key is empty are never dropped.
 */
function dedupeCandidates(lists: Array<{ source: AcademicSource; records: AcademicPaperResult[] }>): RankedCandidate[] {
  const candidates: RankedCandidate[] = []
  const byKey = new Map<string, RankedCandidate>()

  for (const { source, records } of lists) {
    records.forEach((record, rank) => {
      const keys = paperIdentityKeys(record)
      let target: RankedCandidate | undefined
      for (const key of keys) {
        const hit = byKey.get(key)
        if (!hit) continue
        if (key.startsWith("title:") && !compatibleForTitleMerge(hit.record, record)) continue
        target = hit
        break
      }
      if (target) {
        target.record = mergePaperRecords(target.record, record)
        if (target.ranks[source] === undefined) target.ranks[source] = rank
      } else {
        target = { record, ranks: { [source]: rank } }
        candidates.push(target)
      }
      for (const key of paperIdentityKeys(target.record)) if (!byKey.has(key)) byKey.set(key, target)
    })
  }
  return candidates
}

function rankScore(c: RankedCandidate, query: string): number {
  const T = RANKING_TUNABLES
  let score = 0
  for (const [source, rank] of Object.entries(c.ranks) as Array<[AcademicSource, number]>) {
    score += (T.PROVIDER_WEIGHTS[source] ?? 0.5) / (T.RRF_K + rank + 1)
  }
  const match = compareTitles(query, c.record.title)
  if (match.exact) score += T.EXACT_TITLE_BONUS
  else if (match.jaccard >= T.NEAR_TITLE_JACCARD || match.contains) score += T.NEAR_TITLE_BONUS
  score += T.CITATION_WEIGHT * Math.log10(1 + Math.max(0, c.record.citationCount ?? 0))
  score += T.CONSENSUS_BONUS * Math.max(0, Object.keys(c.ranks).length - 1)
  return score
}

/** Reciprocal-rank fusion with title/citation/consensus bonuses; deterministic tie-break. */
function rankCandidates(candidates: RankedCandidate[], query: string): AcademicPaperResult[] {
  return candidates
    .map((c) => ({ c, score: rankScore(c, query) }))
    .sort((a, b) => b.score - a.score || (b.c.record.citationCount ?? 0) - (a.c.record.citationCount ?? 0) || a.c.record.title.localeCompare(b.c.record.title))
    .map((x) => x.c.record)
}

function inYearWindow(year: number | null | undefined, yearFrom?: number, yearTo?: number): boolean {
  if (!yearFrom && !yearTo) return true
  if (typeof year !== "number") return false
  if (yearFrom && year < yearFrom) return false
  if (yearTo && year > yearTo) return false
  return true
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

  // 6. Metadata discrepancy checks with verified paper.
  //
  // Strategy: only flag as suspicious when the cited year is LATER than the
  // registry record (future-dating is always wrong). When the registry year is
  // later than the cited year the mismatch is almost always a reprint, a later
  // edition, or a wrong fuzzy match — not an error in the thesis. Suppress those
  // unless the gap is large AND the verification confidence is high.
  if (verifiedPaper && refMeta.year && verifiedPaper.year) {
    const yearDiff = refMeta.year - verifiedPaper.year // positive → cited is later
    if (yearDiff > 1) {
      // Cited year is newer than the registry record — genuinely suspicious.
      issues.push({
        code: "inconsistent_metadata",
        severity: "warning",
        message: `Cited year (${refMeta.year}) is later than academic registry record (${verifiedPaper.year}) for: "${preview}..."`,
      })
    }
    // Registry year is later → reprint/edition mismatch. Skip to avoid false positives.
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

type DoiLookup = { source: AcademicSource; record: AcademicPaperResult | null; status: ProviderStatus; latencyMs: number }

async function lookupDoiEverywhere(doi: string, signal?: AbortSignal): Promise<DoiLookup[]> {
  const timed = async <T,>(source: AcademicSource, run: () => Promise<T | null>, convert: (v: T) => AcademicPaperResult): Promise<DoiLookup> => {
    const started = Date.now()
    try {
      const v = await run()
      return { source, record: v ? convert(v) : null, status: v ? "ok" : "empty", latencyMs: Date.now() - started }
    } catch {
      return { source, record: null, status: "error", latencyMs: Date.now() - started }
    }
  }
  return Promise.all([
    timed("openalex", () => fetchOpenAlexByDoi(doi, signal), openAlexWorkToResult),
    timed(
      "semanticscholar",
      async () => {
        const r = await fetchPaperDetails(`DOI:${doi}`, signal)
        return r.paper
      },
      scholarPaperToResult
    ),
    timed("crossref", () => fetchCrossrefByDoi(doi, signal), crossrefWorkToResult),
  ])
}

function mergeAll(records: AcademicPaperResult[]): AcademicPaperResult | null {
  if (records.length === 0) return null
  return records.slice(1).reduce((acc, r) => mergePaperRecords(acc, r), records[0])
}

/**
 * Search for papers across OpenAlex, Semantic Scholar, Crossref, arXiv (and Tavily when
 * configured) in parallel, with identity-aware deduplication, field-wise merging and
 * reciprocal-rank-fusion ranking. Returns per-provider diagnostics alongside the results.
 */
export async function searchAcademicPaperDetailed(
  query: string,
  limit = 5,
  options?: AcademicSearchOptions
): Promise<AcademicSearchResponse> {
  const trimmed = query.trim()
  const providers: Record<string, ProviderDiagnostics> = {}
  const empty = (mode: AcademicSearchMode): AcademicSearchResponse => ({ results: [], mode, providers, degraded: false, filteredByYear: 0 })
  if (!trimmed) return empty("search")

  // 1. Direct DOI identifier check (tolerates pasted punctuation / URL prefixes)
  const doi = extractDoi(trimmed)
  if (doi) {
    const lookups = await lookupDoiEverywhere(doi, options?.signal)
    for (const l of lookups) providers[l.source] = { status: l.status, count: l.record ? 1 : 0, latencyMs: l.latencyMs }
    const merged = mergeAll(lookups.map((l) => l.record).filter((r): r is AcademicPaperResult => Boolean(r)))
    if (merged) {
      return { results: [merged], mode: "doi", providers, degraded: lookups.some((l) => l.status === "error"), filteredByYear: 0 }
    }
    // Fall through to keyword search only when the query is more than the DOI itself.
    if (normalizeDoi(trimmed) === normalizeDoi(doi) || trimmed.length <= doi.length + 24) {
      return { ...empty("doi"), degraded: lookups.some((l) => l.status === "error") }
    }
  }

  // 2. Direct arXiv identifier check
  const arxivId = parseArxivId(trimmed)
  if (arxivId) {
    const started = Date.now()
    const meta = await fetchArxivMetadata(arxivId, { signal: options?.signal })
    providers.arxiv = { status: meta ? "ok" : "empty", count: meta ? 1 : 0, latencyMs: Date.now() - started }
    if (meta) {
      const record: AcademicPaperResult = {
        source: "arxiv",
        sources: ["arxiv"],
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
      }
      // Enrich with the registries: by DOI when the preprint carries one, otherwise via
      // Semantic Scholar's `ARXIV:` lookup (citation counts, venue, published version).
      if (meta.doi) {
        const lookups = await lookupDoiEverywhere(meta.doi, options?.signal)
        for (const l of lookups) providers[l.source] = { status: l.status, count: l.record ? 1 : 0, latencyMs: l.latencyMs }
        const merged = mergeAll([record, ...lookups.map((l) => l.record).filter((r): r is AcademicPaperResult => Boolean(r))])
        return { results: merged ? [merged] : [record], mode: "arxiv", providers, degraded: lookups.some((l) => l.status === "error"), filteredByYear: 0 }
      }
      const s2Started = Date.now()
      const s2 = await fetchPaperDetails(`ARXIV:${meta.arxivId}`, options?.signal).catch(() => ({ paper: null, status: "service_error" as AcademicLookupStatus }))
      providers.semanticscholar = {
        status: s2.paper ? "ok" : s2.status === "not_found" ? "empty" : s2.status === "rate_limited" ? "rate_limited" : s2.status === "timeout" ? "timeout" : "error",
        count: s2.paper ? 1 : 0,
        latencyMs: Date.now() - s2Started,
      }
      const merged = s2.paper ? mergePaperRecords(record, scholarPaperToResult(s2.paper)) : record
      return { results: [merged], mode: "arxiv", providers, degraded: providers.semanticscholar.status !== "ok" && providers.semanticscholar.status !== "empty", filteredByYear: 0 }
    }
  }

  // 3. Parallel multi-source query. Each provider is bounded by its own timeout (see
  //    academic-http.ts) so a hung upstream degrades the answer instead of stalling it.
  const yearFrom = options?.yearFrom
  const yearTo = options?.yearTo
  const perProvider = Math.min(Math.max(limit, 5), 20)
  const signal = options?.signal
  const tavilyEnabled = Boolean(process.env.TAVILY_API_KEY)

  const timedList = async <T,>(
    source: AcademicSource,
    run: () => Promise<{ items: T[]; status: ProviderStatus; statusCode?: number }>,
    convert: (v: T) => AcademicPaperResult
  ): Promise<{ source: AcademicSource; records: AcademicPaperResult[] }> => {
    const started = Date.now()
    try {
      const r = await run()
      providers[source] = { status: r.status, count: r.items.length, latencyMs: Date.now() - started, statusCode: r.statusCode }
      return { source, records: r.items.map(convert) }
    } catch (err) {
      providers[source] = { status: (err as { name?: string })?.name === "AbortError" || (err as { name?: string })?.name === "TimeoutError" ? "timeout" : "error", count: 0, latencyMs: Date.now() - started }
      return { source, records: [] }
    }
  }

  const lists = await Promise.all([
    timedList("openalex", () => searchOpenAlexWorksDetailed(trimmed, perProvider, { yearFrom, yearTo, signal }), openAlexWorkToResult),
    timedList(
      "semanticscholar",
      async () => {
        const r = await searchPaperByTitle(trimmed, perProvider, signal, { yearFrom, yearTo })
        const status: ProviderStatus =
          r.status === "verified" ? (r.papers.length ? "ok" : "empty")
          : r.status === "not_found" || r.status === "invalid_input" ? "empty"
          : r.status === "rate_limited" ? "rate_limited"
          : r.status === "timeout" ? "timeout"
          : "error"
        return { items: r.papers, status, statusCode: r.statusCode }
      },
      scholarPaperToResult
    ),
    timedList("crossref", () => searchCrossrefWorksDetailed(trimmed, perProvider, { signal, yearFrom, yearTo }), crossrefWorkToResult),
    tavilyEnabled
      ? timedList(
          "tavily",
          async () => {
            const items = await searchTavily(trimmed, boundedSignal(signal, ACADEMIC_TIMEOUTS_MS.tavily))
            return { items, status: items.length ? ("ok" as const) : ("empty" as const) }
          },
          (t) => ({
            source: "tavily" as const,
            sources: ["tavily" as const],
            paperId: stableTavilyId(t.url),
            title: t.title,
            authors: [],
            abstract: t.content,
            url: t.url,
          })
        )
      : Promise.resolve({ source: "tavily" as const, records: [] as AcademicPaperResult[] }),
  ])
  if (!tavilyEnabled) providers.tavily = { status: "skipped", count: 0, latencyMs: 0 }

  const candidates = dedupeCandidates(lists.filter((l) => l.records.length > 0))
  const ranked = rankCandidates(candidates, trimmed)

  // 4. Post-merge year window (providers that ignore the filter, merged years).
  const inWindow = ranked.filter((r) => inYearWindow(r.year, yearFrom, yearTo))
  const filteredByYear = ranked.length - inWindow.length

  const degraded = Object.values(providers).some((p) => p.status === "error" || p.status === "timeout" || p.status === "rate_limited")
  return { results: inWindow.slice(0, limit), mode: "search", providers, degraded, filteredByYear }
}

/**
 * Search for papers across OpenAlex, Semantic Scholar, Crossref, and arXiv in parallel
 * with consensus deduplication and fused ranking (Perplexity-style).
 */
export async function searchAcademicPaper(
  query: string,
  limit = 5,
  options?: AcademicSearchOptions
): Promise<AcademicPaperResult[]> {
  const { results } = await searchAcademicPaperDetailed(query, limit, options)
  return results
}

function resultToScholarShape(r: AcademicPaperResult): ScholarPaper {
  return {
    paperId: r.paperId ?? r.doi ?? r.title,
    title: r.title,
    year: r.year,
    authors: r.authors.map((name, i) => ({ authorId: `${r.source}-${i}`, name })),
    abstract: r.abstract,
    venue: r.venue,
    externalIds: { DOI: r.doi, ArXiv: r.arxivId },
    url: r.url,
    citationCount: r.citationCount,
    influentialCitationCount: r.influentialCitationCount,
    openAccessPdf: r.openAccessPdfUrl ? { url: r.openAccessPdfUrl } : null,
  }
}

const UNAVAILABLE: ReadonlySet<AcademicLookupStatus> = new Set(["rate_limited", "timeout", "service_error"])
const UNAVAILABLE_PROVIDER: ReadonlySet<ProviderStatus> = new Set(["rate_limited", "timeout", "error"])

/**
 * Pick the candidate that best matches the cited title, disambiguating identical titles
 * (reply letters, retraction notices) by author surname overlap and year.
 */
function bestTitleMatch(
  target: string,
  refMeta: ExtractedReference,
  candidates: AcademicPaperResult[]
): { record: AcademicPaperResult; confidence: "high" | "medium" | "low" } | null {
  const rank = { high: 3, medium: 2, low: 1 } as const
  let best: { record: AcademicPaperResult; confidence: "high" | "medium" | "low"; score: number } | null = null
  const citedAuthors = cleanAuthors(refMeta.authors)
  for (const record of candidates) {
    const confidence = titleMatchConfidence(target, record.title)
    if (!confidence) continue
    let score = rank[confidence] * 10
    if (citedAuthors.length && record.authors.length) score += authorsOverlap(citedAuthors, record.authors) ? 5 : -5
    if (refMeta.year && record.year) score += Math.abs(refMeta.year - record.year) <= 1 ? 3 : -1
    if (compareTitles(target, record.title).exact) score += 1
    if (!best || score > best.score) best = { record, confidence, score }
  }
  return best ? { record: best.record, confidence: best.confidence } : null
}

/**
 * Verify a single citation reference with prioritized multi-source lookups.
 *
 * Order: DOI (all registries) → arXiv id → title search on Semantic Scholar, then
 * OpenAlex, then Crossref (each similarity-gated), then Tavily (low confidence).
 * A registry outage yields `rate_limited`/`timeout`/`service_error`, never `not_found`.
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
  let attempts = 0
  let registryAnswered = false
  let outageStatus: AcademicLookupStatus | null = null

  // 1. Direct DOI lookup across OpenAlex / Semantic Scholar / Crossref
  if (refMeta.doi) {
    attempts++
    const lookups = await lookupDoiEverywhere(stripDoi(refMeta.doi), signal)
    const found = lookups.map((l) => l.record).filter((r): r is AcademicPaperResult => Boolean(r))
    const merged = mergeAll(found)
    if (merged) {
      enriched = merged
      verification = { found: true, status: "verified", confidence: "high", paper: resultToScholarShape(merged), attempts }
    } else if (lookups.some((l) => l.status === "empty")) {
      registryAnswered = true
    } else {
      outageStatus = "service_error"
    }
  }

  // 2. Direct arXiv lookup
  if (!verification?.found && refMeta.arxivId) {
    attempts++
    const arxivMeta = await fetchArxivMetadata(refMeta.arxivId, { signal })
    if (arxivMeta) {
      enriched = {
        source: "arxiv",
        sources: ["arxiv"],
        paperId: `ARXIV:${arxivMeta.arxivId}`,
        title: arxivMeta.title ?? refMeta.title ?? "ArXiv Paper",
        authors: arxivMeta.authors ?? [],
        year: arxivMeta.publishedYear ? parseInt(arxivMeta.publishedYear, 10) : undefined,
        venue: "arXiv preprint",
        abstract: arxivMeta.abstract,
        doi: arxivMeta.doi,
        arxivId: arxivMeta.arxivId,
        url: arxivMeta.pdfUrl,
        openAccessPdfUrl: arxivMeta.pdfUrl,
      }
      verification = { found: true, status: "verified", confidence: "high", paper: resultToScholarShape(enriched), attempts }
    }
  }

  // 3. Title search — Semantic Scholar, then OpenAlex, then Crossref, each similarity-gated.
  if (!verification?.found) {
    const searchTarget = cleanCitationTitle(refMeta.title || "") || citedText.slice(0, 200)

    attempts++
    const s2 = await verifyCitation(searchTarget, signal)
    if (s2.found && s2.paper) {
      verification = { ...s2, attempts }
      enriched = scholarPaperToResult(s2.paper)
    } else if (UNAVAILABLE.has(s2.status)) {
      outageStatus = s2.status
    } else {
      registryAnswered = true
    }

    if (!verification?.found) {
      attempts++
      const oa = await searchOpenAlexWorksDetailed(searchTarget, 3, { signal })
      const best = bestTitleMatch(searchTarget, refMeta, oa.items.map(openAlexWorkToResult))
      if (best) {
        enriched = best.record
        verification = {
          found: true,
          status: best.confidence === "low" ? "ambiguous" : "verified",
          confidence: best.confidence,
          paper: resultToScholarShape(best.record),
          attempts,
        }
      } else if (UNAVAILABLE_PROVIDER.has(oa.status)) {
        outageStatus = outageStatus ?? (oa.status === "rate_limited" ? "rate_limited" : oa.status === "timeout" ? "timeout" : "service_error")
      } else {
        registryAnswered = true
      }
    }

    if (!verification?.found) {
      attempts++
      const cr = await searchCrossrefWorksDetailed(searchTarget, 3, { signal })
      const best = bestTitleMatch(searchTarget, refMeta, cr.items.map(crossrefWorkToResult))
      if (best) {
        enriched = best.record
        verification = {
          found: true,
          status: best.confidence === "low" ? "ambiguous" : "verified",
          confidence: best.confidence,
          paper: resultToScholarShape(best.record),
          attempts,
        }
      } else if (UNAVAILABLE_PROVIDER.has(cr.status)) {
        outageStatus = outageStatus ?? (cr.status === "rate_limited" ? "rate_limited" : cr.status === "timeout" ? "timeout" : "service_error")
      } else {
        registryAnswered = true
      }
    }

    if (!verification?.found && process.env.TAVILY_API_KEY) {
      attempts++
      const tavilyResults = await searchTavily(searchTarget, boundedSignal(signal, ACADEMIC_TIMEOUTS_MS.tavily)).catch(() => [])
      const top = tavilyResults.find((t) => titleMatchConfidence(searchTarget, t.title || "") !== null)
      if (top) {
        enriched = {
          source: "tavily",
          sources: ["tavily"],
          paperId: stableTavilyId(top.url),
          title: top.title || refMeta.title || "Web Resource",
          authors: cleanAuthors(refMeta.authors),
          year: refMeta.year,
          abstract: top.content,
          url: top.url,
        }
        verification = { found: true, status: "verified", confidence: "low", paper: resultToScholarShape(enriched), attempts }
      }
    }
  }

  // 4. Retraction/enrichment pass: Semantic Scholar does not expose retraction status.
  if (enriched?.doi && !enriched.isRetracted && !enriched.sources?.includes("openalex")) {
    const oa = await fetchOpenAlexByDoi(enriched.doi, signal).catch(() => null)
    if (oa) {
      enriched = mergePaperRecords(enriched, openAlexWorkToResult(oa))
      if (verification?.paper) verification = { ...verification, paper: resultToScholarShape(enriched) }
    }
  }

  const iso690Issues = checkIso690Issues(citedText, refMeta, verification?.paper ?? null)

  const finalStatus: AcademicLookupStatus = verification?.found
    ? verification.status
    : registryAnswered || !outageStatus
      ? "not_found"
      : outageStatus

  return {
    citedText,
    status: finalStatus,
    verification: verification?.found
      ? verification
      : {
          found: false,
          status: finalStatus,
          confidence: "not_found",
          paper: null,
          attempts,
          note: finalStatus === "not_found" ? undefined : `Academic lookup unavailable (${finalStatus})`,
        },
    enriched,
    iso690Issues,
    attempts,
  }
}

/**
 * Verify a list of citation strings with concurrency control, deduplication, and source-aware ISO 690 rules.
 */
/** Maximum citations checked per audit (keeps the 25 s budget with 3 concurrent lookups). */
const MAX_AUDITED_CITATIONS = 30

export async function auditThesisCitations(
  citedTitles: string[],
  concurrency = 3,
  timeoutMs = 25_000
): Promise<ThesisCitationAudit> {
  const capped = citedTitles.slice(0, MAX_AUDITED_CITATIONS)
  const skipped = Math.max(0, citedTitles.length - capped.length)
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
      skipped,
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
