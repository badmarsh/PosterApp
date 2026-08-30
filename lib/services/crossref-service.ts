/**
 * Crossref Service — authoritative DOI metadata and journal registry search.
 *
 * Provides:
 *  - Title & keyword search
 *  - Official journal name, volume, issue, page numbers
 *  - Publisher & author metadata
 *  - Free without API key
 */

export interface CrossrefWork {
  doi: string
  title: string
  authors: string[]
  publishedYear?: number
  containerTitle?: string // Journal or Book title
  publisher?: string
  volume?: string
  issue?: string
  page?: string
  url?: string
}

function parseCrossrefItem(item: any): CrossrefWork | null {
  if (!item.DOI || !item.title || item.title.length === 0) return null

  const title = Array.isArray(item.title) ? item.title[0] : item.title

  const authors: string[] = (item.author || []).map((a: any) => {
    if (a.given && a.family) return `${a.given} ${a.family}`
    if (a.family) return a.family
    if (a.name) return a.name
    return "Unknown Author"
  })

  let publishedYear: number | undefined
  const dateParts = item["published-print"]?.["date-parts"] || item["published-online"]?.["date-parts"] || item.created?.["date-parts"]
  if (dateParts && dateParts[0] && dateParts[0][0]) {
    publishedYear = dateParts[0][0]
  }

  const containerTitle = Array.isArray(item["container-title"])
    ? item["container-title"][0]
    : item["container-title"] || undefined

  return {
    doi: item.DOI,
    title: title.replace(/<[^>]+>/g, "").trim(),
    authors: authors.length > 0 ? authors : ["Unknown Author"],
    publishedYear,
    containerTitle,
    publisher: item.publisher || undefined,
    volume: item.volume || undefined,
    issue: item.issue || undefined,
    page: item.page || undefined,
    url: item.URL || `https://doi.org/${item.DOI}`,
  }
}

/**
 * Search Crossref for scholarly works by query.
 */
export async function searchCrossrefWorks(
  query: string,
  limit = 5,
  signal?: AbortSignal
): Promise<CrossrefWork[]> {
  try {
    const params = new URLSearchParams({
      query: query.trim(),
      rows: Math.min(limit, 10).toString(),
      sort: "relevance",
    })

    const url = `https://api.crossref.org/works?${params.toString()}`
    const res = await fetch(url, {
      headers: {
        "User-Agent": "PosterApp/1.0 (mailto:academic-connector@posterapp.local)",
        Accept: "application/json",
      },
      signal: signal || AbortSignal.timeout(6000),
    })

    if (!res.ok) {
      console.warn(`[Crossref] Search failed: HTTP ${res.status}`)
      return []
    }

    const data = await res.json()
    const items = data.message?.items || []
    return items.map(parseCrossrefItem).filter(Boolean) as CrossrefWork[]
  } catch (error) {
    console.warn("[Crossref] Search error:", error)
    return []
  }
}

/**
 * Fetch authoritative metadata for a single DOI from Crossref.
 */
export async function fetchCrossrefByDoi(
  doi: string,
  signal?: AbortSignal
): Promise<CrossrefWork | null> {
  try {
    const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//i, "").trim()
    const url = `https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`

    const res = await fetch(url, {
      headers: {
        "User-Agent": "PosterApp/1.0 (mailto:academic-connector@posterapp.local)",
        Accept: "application/json",
      },
      signal: signal || AbortSignal.timeout(5000),
    })

    if (!res.ok) return null
    const data = await res.json()
    return parseCrossrefItem(data.message)
  } catch {
    return null
  }
}
