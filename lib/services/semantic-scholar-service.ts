/**
 * Semantic Scholar Graph API v1 client.
 *
 * Rate limits: unauthenticated calls share one global pool that is frequently exhausted —
 * during the 2026-09-27 audit most anonymous requests answered HTTP 429. Set
 * SEMANTIC_SCHOLAR_API_KEY for a dedicated quota. Callers must treat `rate_limited` as
 * "unknown", never as "not found", and fall back to OpenAlex / Crossref.
 *
 * Docs: https://api.semanticscholar.org/api-docs/graph
 */

import { ACADEMIC_TIMEOUTS_MS, abortableDelay, boundedSignal, isAbortLike } from "./academic-http"
import { titleMatchConfidence } from "./academic-identifiers"

const SS_BASE = "https://api.semanticscholar.org/graph/v1"
const MAX_ATTEMPTS = 3
/**
 * Longest back-off we are willing to sleep between attempts. A `Retry-After` beyond this
 * means the shared pool is exhausted for minutes — retrying inside a 25 s audit budget is
 * pointless, so we report `rate_limited` immediately (with the advertised delay).
 */
const MAX_RETRY_DELAY_MS = 5_000

function ssHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": "PosterApp-ThesisReview/1.0",
  }
  const key = process.env.SEMANTIC_SCHOLAR_API_KEY
  if (key) headers["x-api-key"] = key
  return headers
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AcademicLookupStatus =
  | "verified"
  | "not_found"
  | "ambiguous"
  | "rate_limited"
  | "timeout"
  | "service_error"
  | "invalid_input"

export interface ScholarPaper {
  paperId: string
  title: string
  year?: number | null
  venue?: string | null
  authors: { authorId: string; name: string }[]
  abstract?: string | null
  citationCount?: number
  influentialCitationCount?: number
  externalIds?: { DOI?: string; ArXiv?: string }
  url?: string
  openAccessPdf?: { url?: string } | null
  tldr?: { text?: string } | null
}

export interface ScholarAuthor {
  authorId: string
  name: string
  paperCount?: number
  citationCount?: number
  papers?: Pick<ScholarPaper, "paperId" | "title" | "year">[]
}

export interface CitationVerification {
  found: boolean
  status: AcademicLookupStatus
  confidence: "high" | "medium" | "low" | "not_found"
  paper: ScholarPaper | null
  note?: string
  attempts?: number
}

export interface ScholarFetchResponse<T> {
  data: T | null
  status: AcademicLookupStatus
  statusCode?: number
  retryAfterMs?: number
}

// ---------------------------------------------------------------------------
// Query Normalization
// ---------------------------------------------------------------------------

export function normalizeScholarQuery(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// ---------------------------------------------------------------------------
// Robust Fetch with Bounded Retries & Jitter
// ---------------------------------------------------------------------------

export async function ssFetch<T>(
  path: string,
  params: Record<string, string> = {},
  signal?: AbortSignal
): Promise<ScholarFetchResponse<T>> {
  const url = new URL(`${SS_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  let lastStatus: AcademicLookupStatus = "service_error"
  let lastStatusCode: number | undefined
  let retryAfterMs: number | undefined

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (signal?.aborted) {
      return { data: null, status: "timeout" }
    }

    try {
      const fetchSignal = boundedSignal(signal, ACADEMIC_TIMEOUTS_MS.semanticscholar)

      const res = await fetch(url.toString(), {
        headers: ssHeaders(),
        signal: fetchSignal,
      })

      lastStatusCode = res.status

      if (res.ok) {
        const data = (await res.json()) as T
        return { data, status: "verified", statusCode: res.status }
      }

      if (res.status === 404) {
        return { data: null, status: "not_found", statusCode: 404 }
      }

      if (res.status === 400 || res.status === 422) {
        return { data: null, status: "invalid_input", statusCode: res.status }
      }

      if (res.status === 429) {
        lastStatus = "rate_limited"
        const retryHeader = res.headers.get("retry-after")
        if (retryHeader) {
          const parsedSec = parseInt(retryHeader, 10)
          retryAfterMs = !isNaN(parsedSec) ? parsedSec * 1000 : 2000
        } else {
          retryAfterMs = 1500 * attempt
        }
      } else if ([502, 503, 504].includes(res.status)) {
        lastStatus = "service_error"
        retryAfterMs = 1000 * attempt
      } else {
        lastStatus = "service_error"
        return { data: null, status: "service_error", statusCode: res.status }
      }

      if (attempt < MAX_ATTEMPTS) {
        const delay = (retryAfterMs ?? 1000) + Math.random() * 300
        if (delay > MAX_RETRY_DELAY_MS) break
        const completed = await abortableDelay(delay, signal)
        if (!completed) return { data: null, status: "timeout", statusCode: lastStatusCode, retryAfterMs }
      }
    } catch (err: unknown) {
      if (isAbortLike(err)) {
        lastStatus = "timeout"
        // The caller gave up (or our own timeout fired) — retrying cannot help.
        if (signal?.aborted) return { data: null, status: "timeout", statusCode: lastStatusCode }
      } else {
        lastStatus = "service_error"
      }

      if (attempt < MAX_ATTEMPTS) {
        const completed = await abortableDelay(500 * attempt + Math.random() * 200, signal)
        if (!completed) return { data: null, status: "timeout", statusCode: lastStatusCode }
      }
    }
  }

  return {
    data: null,
    status: lastStatus,
    statusCode: lastStatusCode,
    retryAfterMs,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ScholarSearchFilters {
  yearFrom?: number
  yearTo?: number
}

/** Semantic Scholar `year` parameter: `2024-`, `-2026` or `2024-2026`. */
function scholarYearParam(filters?: ScholarSearchFilters): string | undefined {
  if (!filters?.yearFrom && !filters?.yearTo) return undefined
  if (filters.yearFrom && filters.yearTo) return `${filters.yearFrom}-${filters.yearTo}`
  return filters.yearFrom ? `${filters.yearFrom}-` : `-${filters.yearTo}`
}

/**
 * Search for papers by title/keywords. Returns up to `limit` results.
 */
export async function searchPaperByTitle(
  query: string,
  limit = 5,
  signal?: AbortSignal,
  filters?: ScholarSearchFilters
): Promise<{ papers: ScholarPaper[]; status: AcademicLookupStatus; statusCode?: number; retryAfterMs?: number }> {
  const cleanQuery = query.trim().slice(0, 250)
  if (cleanQuery.length < 3) {
    return { papers: [], status: "invalid_input" }
  }

  const params: Record<string, string> = {
    query: cleanQuery,
    limit: String(limit),
    fields: "paperId,title,year,venue,authors,abstract,tldr,citationCount,influentialCitationCount,openAccessPdf,externalIds,url",
  }
  const year = scholarYearParam(filters)
  if (year) params.year = year

  const res = await ssFetch<{ data: ScholarPaper[] }>("/paper/search", params, signal)

  return {
    papers: res.data?.data ?? [],
    status: res.status,
    statusCode: res.statusCode,
    retryAfterMs: res.retryAfterMs,
  }
}

/**
 * Fetch full paper details by Semantic Scholar ID or DOI (prefix "DOI:") or ArXiv ID (prefix "ARXIV:").
 */
export async function fetchPaperDetails(
  paperId: string,
  signal?: AbortSignal
): Promise<{ paper: ScholarPaper | null; status: AcademicLookupStatus }> {
  const res = await ssFetch<ScholarPaper>(
    `/paper/${encodeURIComponent(paperId)}`,
    {
      fields: "paperId,title,year,venue,authors,abstract,tldr,citationCount,influentialCitationCount,openAccessPdf,externalIds,url",
    },
    signal
  )

  return {
    paper: res.data,
    status: res.status,
  }
}

/**
 * Fetch papers by a given author (by Semantic Scholar authorId).
 */
export async function fetchAuthorPapers(authorId: string, limit = 10): Promise<ScholarPaper[]> {
  const res = await ssFetch<{ data: ScholarPaper[] }>(`/author/${encodeURIComponent(authorId)}/papers`, {
    limit: String(limit),
    fields: "paperId,title,year,authors",
  })
  return res.data?.data ?? []
}

/**
 * Search for an author by name and return their profile.
 */
export async function searchAuthor(name: string): Promise<ScholarAuthor | null> {
  const res = await ssFetch<{ data: ScholarAuthor[] }>("/author/search", {
    query: name,
    limit: "1",
    fields: "authorId,name,paperCount,citationCount",
  })
  return res.data?.data?.[0] ?? null
}

/**
 * Verify a citation string against Semantic Scholar with Unicode matching and confidence rating.
 */
export async function verifyCitation(
  citedTitle: string,
  signal?: AbortSignal
): Promise<CitationVerification> {
  const cleanTitle = citedTitle.trim()
  if (cleanTitle.length < 5) {
    return {
      found: false,
      status: "invalid_input",
      confidence: "not_found",
      paper: null,
      note: "Query too short",
    }
  }

  const { papers, status } = await searchPaperByTitle(cleanTitle, 3, signal)

  if (status === "rate_limited" || status === "timeout" || status === "service_error") {
    return {
      found: false,
      status,
      confidence: "not_found",
      paper: null,
      note: `Academic lookup unavailable (${status})`,
    }
  }

  if (!papers.length) {
    return { found: false, status: "not_found", confidence: "not_found", paper: null }
  }

  // Best title match among the top hits (the provider's #1 is not always the cited work).
  const rank = { high: 3, medium: 2, low: 1 } as const
  let best: { paper: ScholarPaper; confidence: "high" | "medium" | "low" } | null = null
  for (const paper of papers) {
    const confidence = titleMatchConfidence(cleanTitle, paper.title ?? "")
    if (confidence && (!best || rank[confidence] > rank[best.confidence])) best = { paper, confidence }
    if (best?.confidence === "high") break
  }

  if (!best) return { found: false, status: "not_found", confidence: "not_found", paper: null }
  if (best.confidence === "low") return { found: true, status: "ambiguous", confidence: "low", paper: best.paper }
  return { found: true, status: "verified", confidence: best.confidence, paper: best.paper }
}

