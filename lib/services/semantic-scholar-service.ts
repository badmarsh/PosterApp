/**
 * Semantic Scholar Graph API v1 client.
 * Free tier: 100 req/s without API key.
 * Optionally reads SEMANTIC_SCHOLAR_API_KEY from env for higher limits.
 *
 * Docs: https://api.semanticscholar.org/api-docs/graph
 */

const SS_BASE = "https://api.semanticscholar.org/graph/v1"
const SS_TIMEOUT_MS = 10_000
const MAX_ATTEMPTS = 3

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
      const fetchSignal = signal
        ? AbortSignal.any([signal, AbortSignal.timeout(SS_TIMEOUT_MS)])
        : AbortSignal.timeout(SS_TIMEOUT_MS)

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
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    } catch (err: any) {
      if (err?.name === "TimeoutError" || err?.name === "AbortError") {
        lastStatus = "timeout"
      } else {
        lastStatus = "service_error"
      }

      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt + Math.random() * 200))
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

/**
 * Search for papers by title/keywords. Returns up to `limit` results.
 */
export async function searchPaperByTitle(
  query: string,
  limit = 5,
  signal?: AbortSignal
): Promise<{ papers: ScholarPaper[]; status: AcademicLookupStatus }> {
  const cleanQuery = query.trim().slice(0, 250)
  if (cleanQuery.length < 3) {
    return { papers: [], status: "invalid_input" }
  }

  const res = await ssFetch<{ data: ScholarPaper[] }>(
    "/paper/search",
    {
      query: cleanQuery,
      limit: String(limit),
      fields: "paperId,title,year,venue,authors,abstract,tldr,citationCount,influentialCitationCount,openAccessPdf,externalIds,url",
    },
    signal
  )

  return {
    papers: res.data?.data ?? [],
    status: res.status,
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

  const topResult = papers[0]
  const queryNorm = normalizeScholarQuery(cleanTitle)
  const titleNorm = normalizeScholarQuery(topResult.title)

  // Exact normalized match
  if (titleNorm === queryNorm) {
    return { found: true, status: "verified", confidence: "high", paper: topResult }
  }

  // Substring or Jaccard similarity
  const qTokens = new Set(queryNorm.split(" ").filter((t) => t.length > 2))
  const tTokens = new Set(titleNorm.split(" ").filter((t) => t.length > 2))

  if (qTokens.size > 0 && tTokens.size > 0) {
    const intersection = [...qTokens].filter((t) => tTokens.has(t)).length
    const union = new Set([...qTokens, ...tTokens]).size
    const jaccard = intersection / union

    if (jaccard >= 0.65 || titleNorm.includes(queryNorm) || queryNorm.includes(titleNorm)) {
      return { found: true, status: "verified", confidence: "high", paper: topResult }
    }
    if (jaccard >= 0.45) {
      return { found: true, status: "verified", confidence: "medium", paper: topResult }
    }
    if (jaccard >= 0.25) {
      return { found: true, status: "ambiguous", confidence: "low", paper: topResult }
    }
  }

  return { found: false, status: "not_found", confidence: "not_found", paper: null }
}

