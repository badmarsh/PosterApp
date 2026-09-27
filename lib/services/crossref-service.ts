/**
 * Crossref Service — authoritative DOI metadata and journal registry search.
 *
 * Provides:
 *  - Bibliographic search (`query.bibliographic` — titles/authors/years, far less
 *    container-title noise than the generic `query` parameter)
 *  - Official journal name, volume, issue, page numbers
 *  - Publisher, author, citation-count (`is-referenced-by-count`) metadata
 *  - Retraction signals: `update-to` relations on retraction notices and the
 *    publisher "RETRACTED:" title prefix
 *  - Free without API key (polite pool via the mailto User-Agent)
 */

import {
  ACADEMIC_TIMEOUTS_MS,
  boundedSignal,
  statusFromError,
  statusFromHttp,
  type ProviderOutcome,
} from "./academic-http"
import { cleanAuthors, normalizeDoi, stripDoi } from "./academic-identifiers"

export interface CrossrefWork {
  doi: string
  title: string
  /** Empty when Crossref has no author data (no sentinel strings). */
  authors: string[]
  publishedYear?: number
  containerTitle?: string // Journal or Book title
  publisher?: string
  volume?: string
  issue?: string
  page?: string
  url?: string
  /** Crossref work type (`journal-article`, `book-chapter`, `posted-content`, …). */
  type?: string
  /** `is-referenced-by-count` — Crossref's citation count. */
  citedByCount?: number
  /** True when a retraction notice in the same response points at this DOI, or the title carries the "RETRACTED:" prefix. */
  isRetracted?: boolean
  /** DOI of the retraction notice, when known. */
  retractedBy?: string
  /** For retraction notices: DOIs of the works they retract. */
  retracts?: string[]
}

const CROSSREF_MAILTO = process.env.CROSSREF_MAILTO || "academic-connector@posterapp.local"

/** `select` is supported on the list route only (the single-work route rejects it). */
const LIST_SELECT = [
  "DOI",
  "title",
  "author",
  "issued",
  "published-print",
  "published-online",
  "created",
  "container-title",
  "publisher",
  "is-referenced-by-count",
  "URL",
  "type",
  "update-to",
  "volume",
  "issue",
  "page",
].join(",")

function crossrefHeaders(): Record<string, string> {
  return {
    "User-Agent": `PosterApp/1.0 (mailto:${CROSSREF_MAILTO})`,
    Accept: "application/json",
  }
}

interface RawCrossrefDate {
  "date-parts"?: Array<Array<number | null>>
}

interface RawCrossrefItem {
  DOI?: string
  title?: string[] | string
  author?: Array<{ given?: string; family?: string; name?: string }>
  issued?: RawCrossrefDate
  "published-print"?: RawCrossrefDate
  "published-online"?: RawCrossrefDate
  created?: RawCrossrefDate
  "container-title"?: string[] | string
  publisher?: string
  "is-referenced-by-count"?: number
  URL?: string
  type?: string
  "update-to"?: Array<{ DOI?: string; type?: string }>
  volume?: string
  issue?: string
  page?: string
}

function yearFrom(date?: RawCrossrefDate): number | undefined {
  const y = date?.["date-parts"]?.[0]?.[0]
  return typeof y === "number" && y > 0 ? y : undefined
}

const RETRACTED_PREFIX = /^\s*retracted(?:\s+article)?\s*[:\-–—]\s*/i

export function parseCrossrefItem(item: RawCrossrefItem | null | undefined): CrossrefWork | null {
  if (!item || !item.DOI || !item.title || item.title.length === 0) return null

  const rawTitle = Array.isArray(item.title) ? item.title[0] : item.title
  const title = String(rawTitle).replace(/<[^>]+>/g, "").trim()
  if (!title) return null

  const authors = cleanAuthors(
    (item.author || []).map((a) => {
      if (a.given && a.family) return `${a.given} ${a.family}`
      if (a.family) return a.family
      if (a.name) return a.name
      return ""
    })
  )

  const publishedYear =
    yearFrom(item["published-print"]) ?? yearFrom(item["published-online"]) ?? yearFrom(item.issued) ?? yearFrom(item.created)

  const containerTitle = Array.isArray(item["container-title"]) ? item["container-title"][0] : item["container-title"] || undefined

  const retracts = (item["update-to"] || [])
    .filter((u) => u?.DOI && /retract/i.test(u.type ?? ""))
    .map((u) => normalizeDoi(u.DOI!))

  return {
    doi: stripDoi(item.DOI),
    title,
    authors,
    publishedYear,
    containerTitle,
    publisher: item.publisher || undefined,
    volume: item.volume || undefined,
    issue: item.issue || undefined,
    page: item.page || undefined,
    url: item.URL || `https://doi.org/${item.DOI}`,
    type: item.type || undefined,
    citedByCount: typeof item["is-referenced-by-count"] === "number" ? item["is-referenced-by-count"] : undefined,
    isRetracted: RETRACTED_PREFIX.test(title) || undefined,
    retracts: retracts.length ? retracts : undefined,
  }
}

/** Propagate `update-to` retraction relations across a batch of works. */
export function applyRetractionRelations(works: CrossrefWork[]): CrossrefWork[] {
  const noticeByTarget = new Map<string, string>()
  for (const w of works) {
    for (const target of w.retracts ?? []) noticeByTarget.set(target, w.doi)
  }
  if (noticeByTarget.size === 0) return works
  return works.map((w) => {
    const notice = noticeByTarget.get(normalizeDoi(w.doi))
    return notice ? { ...w, isRetracted: true, retractedBy: notice } : w
  })
}

export interface CrossrefSearchOptions {
  signal?: AbortSignal
  yearFrom?: number
  yearTo?: number
}

/**
 * Search Crossref for scholarly works, reporting the provider outcome alongside the works.
 */
export async function searchCrossrefWorksDetailed(
  query: string,
  limit = 5,
  options?: CrossrefSearchOptions
): Promise<ProviderOutcome<CrossrefWork>> {
  const started = Date.now()
  const cleanQuery = query.trim()
  if (cleanQuery.length < 2) return { items: [], status: "skipped", latencyMs: 0 }

  const params = new URLSearchParams({
    "query.bibliographic": cleanQuery,
    rows: Math.min(limit, 20).toString(),
    sort: "relevance",
    select: LIST_SELECT,
    mailto: CROSSREF_MAILTO,
  })
  const filters: string[] = []
  if (options?.yearFrom) filters.push(`from-pub-date:${options.yearFrom}-01-01`)
  if (options?.yearTo) filters.push(`until-pub-date:${options.yearTo}-12-31`)
  if (filters.length) params.set("filter", filters.join(","))

  try {
    const url = `https://api.crossref.org/works?${params.toString()}`
    const res = await fetch(url, {
      headers: crossrefHeaders(),
      signal: boundedSignal(options?.signal, ACADEMIC_TIMEOUTS_MS.crossref),
    })

    if (!res.ok) {
      if (res.status !== 429) console.warn(`[Crossref] Search failed: HTTP ${res.status}`)
      return { items: [], status: statusFromHttp(res.status), statusCode: res.status, latencyMs: Date.now() - started }
    }

    const data = (await res.json()) as { message?: { items?: RawCrossrefItem[] } }
    const items = applyRetractionRelations(
      (data.message?.items || []).map(parseCrossrefItem).filter((w): w is CrossrefWork => Boolean(w))
    )
    return { items, status: items.length ? "ok" : "empty", statusCode: res.status, latencyMs: Date.now() - started }
  } catch (error) {
    const status = statusFromError(error)
    if (status === "error") console.warn("[Crossref] Search error:", error)
    return { items: [], status, latencyMs: Date.now() - started, error: (error as Error)?.message }
  }
}

/**
 * Search Crossref for scholarly works by query.
 * Thin wrapper kept for existing callers; see `searchCrossrefWorksDetailed` for status.
 */
export async function searchCrossrefWorks(query: string, limit = 5, signal?: AbortSignal): Promise<CrossrefWork[]> {
  const outcome = await searchCrossrefWorksDetailed(query, limit, { signal })
  return outcome.items
}

/**
 * Fetch authoritative metadata for a single DOI from Crossref.
 */
export async function fetchCrossrefByDoi(doi: string, signal?: AbortSignal): Promise<CrossrefWork | null> {
  try {
    const cleanDoi = stripDoi(doi)
    if (!cleanDoi) return null
    const url = `https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}?mailto=${encodeURIComponent(CROSSREF_MAILTO)}`

    const res = await fetch(url, {
      headers: crossrefHeaders(),
      signal: boundedSignal(signal, ACADEMIC_TIMEOUTS_MS.crossref),
    })

    if (!res.ok) return null
    const data = (await res.json()) as { message?: RawCrossrefItem }
    return parseCrossrefItem(data.message)
  } catch {
    return null
  }
}
