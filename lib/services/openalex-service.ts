/**
 * OpenAlex Service — free, open academic search across 250M+ scholarly works.
 *
 * Provides:
 *  - Title & keyword search
 *  - Open Access PDF direct URLs
 *  - Citation counts & topics
 *  - Abstract reconstruction from inverted index
 *  - Direct DOI resolution
 */

export interface OpenAlexWork {
  id: string
  doi?: string
  title: string
  publicationYear?: number
  publicationDate?: string
  authors: string[]
  venue?: string
  publisher?: string
  abstract?: string
  citedByCount: number
  openAccessPdfUrl?: string
  landingPageUrl?: string
  topics?: string[]
}

/**
 * Reconstruct full-text abstract from OpenAlex's abstract_inverted_index structure.
 */
function reconstructAbstract(invertedIndex?: Record<string, number[]>): string | undefined {
  if (!invertedIndex || Object.keys(invertedIndex).length === 0) return undefined

  const wordPositions: Array<{ word: string; pos: number }> = []
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      wordPositions.push({ word, pos })
    }
  }

  wordPositions.sort((a, b) => a.pos - b.pos)
  const fullText = wordPositions.map((w) => w.word).join(" ")
  return fullText.trim() || undefined
}

function parseOpenAlexWork(item: any): OpenAlexWork {
  const doi = item.doi ? item.doi.replace(/^https?:\/\/doi\.org\//i, "") : undefined
  const authors = (item.authorships || [])
    .map((a: any) => a.author?.display_name)
    .filter(Boolean)

  const venue =
    item.primary_location?.source?.display_name ||
    item.locations?.[0]?.source?.display_name ||
    item.host_venue?.name ||
    undefined

  const openAccessPdfUrl =
    item.open_access?.oa_url ||
    item.primary_location?.pdf_url ||
    item.best_oa_location?.pdf_url ||
    undefined

  const landingPageUrl =
    item.primary_location?.landing_page_url ||
    item.doi ||
    `https://openalex.org/${item.id?.replace(/^https:\/\/openalex\.org\//, "")}`

  const topics = (item.topics || [])
    .slice(0, 3)
    .map((t: any) => t.display_name)
    .filter(Boolean)

  return {
    id: item.id,
    doi,
    title: item.display_name || item.title || "Untitled Paper",
    publicationYear: item.publication_year || undefined,
    publicationDate: item.publication_date || undefined,
    authors: authors.length > 0 ? authors : ["Unknown Author"],
    venue,
    publisher: item.primary_location?.source?.host_organization_name || undefined,
    abstract: reconstructAbstract(item.abstract_inverted_index),
    citedByCount: item.cited_by_count || 0,
    openAccessPdfUrl,
    landingPageUrl,
    topics,
  }
}

/**
 * Search OpenAlex for scholarly works by query with optional domain / year filters.
 */
export async function searchOpenAlexWorks(
  query: string,
  limit = 8,
  options?: {
    yearFrom?: number
    yearTo?: number
    domain?: string
    signal?: AbortSignal
  }
): Promise<OpenAlexWork[]> {
  try {
    const params = new URLSearchParams({
      search: query.trim(),
      per_page: Math.min(limit, 20).toString(),
      sort: "relevance_score:desc",
    })

    const filters: string[] = []
    if (options?.yearFrom) filters.push(`from_publication_date:${options.yearFrom}-01-01`)
    if (options?.yearTo) filters.push(`to_publication_date:${options.yearTo}-12-31`)
    if (filters.length > 0) {
      params.append("filter", filters.join(","))
    }

    const url = `https://api.openalex.org/works?${params.toString()}`
    const res = await fetch(url, {
      headers: {
        "User-Agent": "PosterApp/1.0 (mailto:support@posterapp.local)",
        Accept: "application/json",
      },
      signal: options?.signal || AbortSignal.timeout(6000),
    })

    if (!res.ok) {
      console.warn(`[OpenAlex] Search failed: HTTP ${res.status}`)
      return []
    }

    const data = await res.json()
    const results = (data.results || []).map(parseOpenAlexWork)
    return results
  } catch (error) {
    console.warn("[OpenAlex] Search error:", error)
    return []
  }
}

/**
 * Fetch a single work by DOI from OpenAlex.
 */
export async function fetchOpenAlexByDoi(
  doi: string,
  signal?: AbortSignal
): Promise<OpenAlexWork | null> {
  try {
    const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//i, "").trim()
    const url = `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(cleanDoi)}`

    const res = await fetch(url, {
      headers: {
        "User-Agent": "PosterApp/1.0 (mailto:support@posterapp.local)",
        Accept: "application/json",
      },
      signal: signal || AbortSignal.timeout(5000),
    })

    if (!res.ok) return null
    const data = await res.json()
    return parseOpenAlexWork(data)
  } catch (error) {
    return null
  }
}
