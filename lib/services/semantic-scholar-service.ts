/**
 * Semantic Scholar Graph API v1 client.
 * Free tier: 100 req/s without API key.
 * Optionally reads SEMANTIC_SCHOLAR_API_KEY from env for higher limits.
 *
 * Docs: https://api.semanticscholar.org/api-docs/graph
 */

const SS_BASE = "https://api.semanticscholar.org/graph/v1"
const SS_TIMEOUT_MS = 12_000

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

export interface ScholarPaper {
  paperId: string
  title: string
  year?: number | null
  authors: { authorId: string; name: string }[]
  abstract?: string | null
  citationCount?: number
  externalIds?: { DOI?: string; ArXiv?: string }
  url?: string
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
  confidence: "high" | "medium" | "low" | "not_found"
  paper: ScholarPaper | null
  note?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ssFetch<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  const url = new URL(`${SS_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  try {
    const res = await fetch(url.toString(), {
      headers: ssHeaders(),
      signal: AbortSignal.timeout(SS_TIMEOUT_MS),
    })
    if (!res.ok) {
      if (res.status === 429) console.warn("[SemanticScholar] Rate limited")
      return null
    }
    return (await res.json()) as T
  } catch (err) {
    console.warn("[SemanticScholar] Fetch error:", err)
    return null
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
  limit = 5
): Promise<ScholarPaper[]> {
  const data = await ssFetch<{ data: ScholarPaper[] }>("/paper/search", {
    query,
    limit: String(limit),
    fields: "paperId,title,year,authors,abstract,citationCount,externalIds,url",
  })
  return data?.data ?? []
}

/**
 * Fetch full paper details by Semantic Scholar ID or DOI (prefix "DOI:") or ArXiv ID (prefix "ARXIV:").
 */
export async function fetchPaperDetails(paperId: string): Promise<ScholarPaper | null> {
  return ssFetch<ScholarPaper>(`/paper/${encodeURIComponent(paperId)}`, {
    fields: "paperId,title,year,authors,abstract,citationCount,externalIds,url",
  })
}

/**
 * Fetch papers by a given author (by Semantic Scholar authorId).
 */
export async function fetchAuthorPapers(authorId: string, limit = 10): Promise<ScholarPaper[]> {
  const data = await ssFetch<{ data: ScholarPaper[] }>(`/author/${encodeURIComponent(authorId)}/papers`, {
    limit: String(limit),
    fields: "paperId,title,year,authors",
  })
  return data?.data ?? []
}

/**
 * Search for an author by name and return their profile.
 */
export async function searchAuthor(name: string): Promise<ScholarAuthor | null> {
  const data = await ssFetch<{ data: ScholarAuthor[] }>("/author/search", {
    query: name,
    limit: "1",
    fields: "authorId,name,paperCount,citationCount",
  })
  return data?.data?.[0] ?? null
}

/**
 * Verify a citation string against Semantic Scholar.
 * Useful for checking that cited works in a thesis actually exist.
 */
export async function verifyCitation(citedTitle: string): Promise<CitationVerification> {
  if (!citedTitle || citedTitle.trim().length < 5) {
    return { found: false, confidence: "not_found", paper: null, note: "Query too short" }
  }

  const results = await searchPaperByTitle(citedTitle, 3)
  if (!results.length) {
    return { found: false, confidence: "not_found", paper: null }
  }

  const topResult = results[0]
  // Simple normalise: lower-case, remove punctuation
  const normalise = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim()
  const queryNorm = normalise(citedTitle)
  const titleNorm = normalise(topResult.title)

  // Exact match
  if (titleNorm === queryNorm) {
    return { found: true, confidence: "high", paper: topResult }
  }

  // Substring / Jaccard
  const qTokens = new Set(queryNorm.split(" "))
  const tTokens = new Set(titleNorm.split(" "))
  const intersection = [...qTokens].filter((t) => tTokens.has(t)).length
  const union = new Set([...qTokens, ...tTokens]).size
  const jaccard = intersection / union

  if (jaccard >= 0.7) return { found: true, confidence: "high", paper: topResult }
  if (jaccard >= 0.45) return { found: true, confidence: "medium", paper: topResult }
  if (jaccard >= 0.25) return { found: true, confidence: "low", paper: topResult }

  return { found: false, confidence: "not_found", paper: null }
}
