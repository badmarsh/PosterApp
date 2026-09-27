/**
 * OpenAlex Service — free, open academic search across 250M+ scholarly works.
 *
 * Provides:
 *  - Title & keyword search
 *  - Open Access PDF direct URLs
 *  - Citation counts & topics
 *  - Abstract reconstruction from inverted index
 *  - Direct DOI resolution
 *
 * Etiquette: requests carry a `mailto` (polite pool) and, when `OPENALEX_API_KEY` is set,
 * the `api_key` parameter — anonymous search is throttled under load (HTTP 429
 * `{"error":"Rate limit exceeded"}` observed during the 2026-09-27 audit).
 */

import {
  ACADEMIC_TIMEOUTS_MS,
  boundedSignal,
  statusFromError,
  statusFromHttp,
  type ProviderOutcome,
} from "./academic-http"
import { cleanAuthors, normalizeDoi, stripDoi } from "./academic-identifiers"

export interface OpenAlexWork {
  id: string
  doi?: string
  title: string
  publicationYear?: number
  publicationDate?: string
  /** Empty when OpenAlex has no authorship data (no sentinel strings). */
  authors: string[]
  venue?: string
  publisher?: string
  abstract?: string
  citedByCount: number
  openAccessPdfUrl?: string
  landingPageUrl?: string
  topics?: string[]
  /** OpenAlex `is_retracted` — surfaced as a hard warning in search UI. */
  isRetracted?: boolean
  /** OpenAlex work type (`article`, `preprint`, `retraction`, …). */
  type?: string
}

const OPENALEX_MAILTO = process.env.OPENALEX_MAILTO || "support@posterapp.local"

/** Only the fields the parser reads — keeps search bodies ~10× smaller than the default. */
const SEARCH_SELECT = [
  "id",
  "doi",
  "display_name",
  "title",
  "publication_year",
  "publication_date",
  "type",
  "cited_by_count",
  "is_retracted",
  "open_access",
  "primary_location",
  "best_oa_location",
  "authorships",
  "topics",
  "abstract_inverted_index",
].join(",")

function openAlexHeaders(): Record<string, string> {
  return {
    "User-Agent": `PosterApp/1.0 (mailto:${OPENALEX_MAILTO})`,
    Accept: "application/json",
  }
}

function withEtiquette(params: URLSearchParams): URLSearchParams {
  params.set("mailto", OPENALEX_MAILTO)
  const key = process.env.OPENALEX_API_KEY
  if (key) params.set("api_key", key)
  return params
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

interface RawOpenAlexWork {
  id?: string
  doi?: string | null
  display_name?: string | null
  title?: string | null
  publication_year?: number | null
  publication_date?: string | null
  type?: string | null
  cited_by_count?: number | null
  is_retracted?: boolean | null
  open_access?: { oa_url?: string | null } | null
  primary_location?: {
    landing_page_url?: string | null
    pdf_url?: string | null
    raw_source_name?: string | null
    source?: { display_name?: string | null; host_organization_name?: string | null } | null
  } | null
  best_oa_location?: { pdf_url?: string | null } | null
  locations?: Array<{ source?: { display_name?: string | null } | null }> | null
  host_venue?: { name?: string | null } | null
  authorships?: Array<{ author?: { display_name?: string | null } | null }> | null
  topics?: Array<{ display_name?: string | null }> | null
  abstract_inverted_index?: Record<string, number[]> | null
}

export function parseOpenAlexWork(item: RawOpenAlexWork): OpenAlexWork {
  const doi = item.doi ? stripDoi(item.doi) : undefined
  const authors = cleanAuthors((item.authorships || []).map((a) => a?.author?.display_name ?? ""))

  const venue =
    item.primary_location?.source?.display_name ||
    item.locations?.[0]?.source?.display_name ||
    item.host_venue?.name ||
    // OpenAlex frequently has `source: null` while the publisher-supplied name is present.
    item.primary_location?.raw_source_name ||
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
    .map((t) => t?.display_name)
    .filter((t): t is string => Boolean(t))

  return {
    id: item.id ?? "",
    doi,
    title: item.display_name || item.title || "Untitled Paper",
    publicationYear: item.publication_year || undefined,
    publicationDate: item.publication_date || undefined,
    authors,
    venue: venue || undefined,
    publisher: item.primary_location?.source?.host_organization_name || undefined,
    abstract: reconstructAbstract(item.abstract_inverted_index ?? undefined),
    citedByCount: item.cited_by_count || 0,
    openAccessPdfUrl: openAccessPdfUrl || undefined,
    landingPageUrl,
    topics,
    isRetracted: Boolean(item.is_retracted),
    type: item.type || undefined,
  }
}

export interface OpenAlexSearchOptions {
  yearFrom?: number
  yearTo?: number
  domain?: string
  signal?: AbortSignal
}

/**
 * Search OpenAlex for scholarly works, reporting the provider outcome
 * (status, HTTP code, latency) alongside the parsed works.
 */
export async function searchOpenAlexWorksDetailed(
  query: string,
  limit = 8,
  options?: OpenAlexSearchOptions
): Promise<ProviderOutcome<OpenAlexWork>> {
  const started = Date.now()
  const cleanQuery = (query || "")
    .replace(/^[\s?*+!#%&/\\-]+/, "")
    .replace(/[\r\n\t]+/g, " ")
    .trim()

  if (!cleanQuery || cleanQuery.length < 2) {
    return { items: [], status: "skipped", latencyMs: 0 }
  }

  const params = withEtiquette(
    new URLSearchParams({
      search: cleanQuery,
      per_page: Math.min(limit, 20).toString(),
      sort: "relevance_score:desc",
      select: SEARCH_SELECT,
    })
  )

  const filters: string[] = []
  if (options?.yearFrom) filters.push(`from_publication_date:${options.yearFrom}-01-01`)
  if (options?.yearTo) filters.push(`to_publication_date:${options.yearTo}-12-31`)
  if (filters.length > 0) {
    params.append("filter", filters.join(","))
  }

  try {
    const url = `https://api.openalex.org/works?${params.toString()}`
    const res = await fetch(url, {
      headers: openAlexHeaders(),
      signal: boundedSignal(options?.signal, ACADEMIC_TIMEOUTS_MS.openalex),
    })

    if (!res.ok) {
      const errText = res.status === 429 ? "" : await res.text().catch(() => "")
      if (res.status !== 429) {
        console.warn(`[OpenAlex] Search failed: HTTP ${res.status} for "${cleanQuery.slice(0, 40)}": ${errText.slice(0, 100)}`)
      }
      return { items: [], status: statusFromHttp(res.status), statusCode: res.status, latencyMs: Date.now() - started }
    }

    const data = (await res.json()) as { results?: RawOpenAlexWork[] }
    const items = (data.results || []).map(parseOpenAlexWork)
    return { items, status: items.length ? "ok" : "empty", statusCode: res.status, latencyMs: Date.now() - started }
  } catch (error) {
    const status = statusFromError(error)
    if (status === "error") console.warn("[OpenAlex] Search error:", error)
    return { items: [], status, latencyMs: Date.now() - started, error: (error as Error)?.message }
  }
}

/**
 * Search OpenAlex for scholarly works by query with optional year filters.
 * Thin wrapper kept for existing callers; see `searchOpenAlexWorksDetailed` for status.
 */
export async function searchOpenAlexWorks(query: string, limit = 8, options?: OpenAlexSearchOptions): Promise<OpenAlexWork[]> {
  const outcome = await searchOpenAlexWorksDetailed(query, limit, options)
  return outcome.items
}

/**
 * Fetch a single work by DOI from OpenAlex.
 */
export async function fetchOpenAlexByDoi(doi: string, signal?: AbortSignal): Promise<OpenAlexWork | null> {
  try {
    const cleanDoi = stripDoi(doi)
    if (!cleanDoi) return null
    const params = withEtiquette(new URLSearchParams())
    const url = `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(cleanDoi)}?${params.toString()}`

    const res = await fetch(url, {
      headers: openAlexHeaders(),
      signal: boundedSignal(signal, ACADEMIC_TIMEOUTS_MS.openalex),
    })

    if (!res.ok) return null
    const data = (await res.json()) as RawOpenAlexWork
    return parseOpenAlexWork(data)
  } catch {
    return null
  }
}
