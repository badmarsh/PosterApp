/**
 * Fixture-replay `fetch` for the Academic Connector benchmark.
 *
 * Serves the compact recorded provider bodies in `__fixtures__/academic/recorded.json`
 * in the exact JSON/XML shapes the production parsers read
 * (`parseOpenAlexWork`, `parseCrossrefItem`, `ScholarPaper`, arXiv Atom), routed by the
 * real request URLs the services build. Supports fault injection so resilience paths
 * (hang, 429 + Retry-After, 5xx, malformed JSON, empty) are testable offline with fake
 * timers, and records every call for assertions and diagnostics.
 *
 * Test-only helper — never imported by production code.
 */

import recorded from "@/__fixtures__/academic/recorded.json"

export type ReplayProvider = "openalex" | "crossref" | "semanticscholar" | "arxiv" | "tavily" | "unknown"

export type Fault =
  | { kind: "hang" }
  | { kind: "status"; status: number; retryAfterSec?: number; body?: string }
  | { kind: "malformed" }
  | { kind: "empty" }
  | { kind: "network" }

export interface ReplayCall {
  provider: ReplayProvider
  url: string
  kind: "search" | "doi" | "arxiv" | "other"
  routedTo: string | null
  simulatedYearFilter: boolean
  status: number
  startedAt: number
}

export interface ReplayOptions {
  faults?: Partial<Record<ReplayProvider, Fault>>
  /** Per-provider artificial latency in ms (advanced with fake timers). */
  latencyMs?: Partial<Record<ReplayProvider, number>>
  /**
   * Per-provider synthetic responders for scenarios the recorded corpus does not contain.
   * Return `null` to fall through to the fixtures. Faults take precedence over stubs.
   */
  stubs?: Partial<Record<ReplayProvider, (url: URL, init?: RequestInit) => Response | null>>
}

interface CompactAuthor {
  given?: string
  family?: string
  name?: string
}

interface CompactWork {
  id?: string
  doi?: string | null
  arxivId?: string | null
  title: string
  year?: number | null
  publicationDate?: string
  type?: string
  citations?: number | null
  influential?: number | null
  isRetracted?: boolean
  oaUrl?: string | null
  pdfUrl?: string | null
  landing?: string | null
  venue?: string | null
  publisher?: string | null
  rawSourceName?: string | null
  topics?: string[]
  authors?: Array<string | CompactAuthor>
  externalIds?: Record<string, string | number>
  issued?: Array<number | null>
  publishedPrint?: number[]
  publishedOnline?: number[]
  volume?: string
  issue?: string
  page?: string
  updateTo?: Array<Record<string, unknown>>
  abstract?: string
  tldr?: string
}

interface SearchFixture {
  url: string
  status?: number
  body?: unknown
  meta?: Record<string, unknown>
  results?: CompactWork[]
}

// ---------------------------------------------------------------------------
// Normalisation & routing helpers
// ---------------------------------------------------------------------------

export function normalizeQueryKey(q: string): string {
  return q
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tokenSet(q: string): Set<string> {
  return new Set(normalizeQueryKey(q).split(" ").filter(Boolean))
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  return inter / (a.size + b.size - inter)
}

function cleanDoi(doi: string): string {
  return decodeURIComponent(doi)
    .replace(/^https?:\/\/doi\.org\//i, "")
    .trim()
    .toLowerCase()
}

function indexByNormalizedKey<T>(obj: Record<string, T>): Map<string, { key: string; value: T }> {
  const map = new Map<string, { key: string; value: T }>()
  for (const [key, value] of Object.entries(obj)) {
    const [base] = key.split("|")
    map.set(normalizeQueryKey(base) + (key.includes("|") ? "|" + key.split("|")[1] : ""), { key, value })
  }
  return map
}

function resolveSearchFixture<T>(
  index: Map<string, { key: string; value: T }>,
  query: string,
  variant?: string
): { key: string; value: T } | null {
  const norm = normalizeQueryKey(query)
  if (variant) {
    const exactVariant = index.get(`${norm}|${variant}`)
    if (exactVariant) return exactVariant
  }
  const exact = index.get(norm)
  if (exact) return exact
  // Citation-string titles differ from the recorded query by stop-words / punctuation.
  const qs = tokenSet(query)
  let best: { key: string; value: T } | null = null
  let bestScore = 0
  for (const [k, entry] of index) {
    if (k.includes("|")) continue
    const score = jaccard(qs, tokenSet(k))
    if (score > bestScore) {
      bestScore = score
      best = entry
    }
  }
  return bestScore >= 0.8 ? best : null
}

function yearInWindow(year: number | null | undefined, from?: number, to?: number): boolean {
  if (from === undefined && to === undefined) return true
  if (typeof year !== "number") return false
  if (from !== undefined && year < from) return false
  if (to !== undefined && year > to) return false
  return true
}

// ---------------------------------------------------------------------------
// Shape expanders (compact record → provider response body)
// ---------------------------------------------------------------------------

function authorName(a: string | CompactAuthor): string {
  if (typeof a === "string") return a
  if (a.name) return a.name
  return [a.given, a.family].filter(Boolean).join(" ")
}

function invertedIndex(text: string | undefined): Record<string, number[]> | null {
  if (!text) return null
  const idx: Record<string, number[]> = {}
  text.split(/\s+/).forEach((w, i) => {
    ;(idx[w] ??= []).push(i)
  })
  return idx
}

export function toOpenAlexWork(w: CompactWork) {
  const authorships = (w.authors ?? []).map((a) => ({
    author_position: "middle",
    author: { id: null, display_name: authorName(a), orcid: null },
    institutions: [],
  }))
  const source = w.venue
    ? { id: null, display_name: w.venue, host_organization_name: w.publisher ?? null, type: "journal" }
    : null
  return {
    id: w.id,
    doi: w.doi ? `https://doi.org/${w.doi}` : null,
    title: w.title,
    display_name: w.title,
    publication_year: w.year ?? null,
    publication_date: w.publicationDate ?? (w.year ? `${w.year}-01-01` : null),
    type: w.type ?? "article",
    cited_by_count: w.citations ?? 0,
    is_retracted: Boolean(w.isRetracted),
    open_access: { is_oa: Boolean(w.oaUrl), oa_status: w.oaUrl ? "green" : "closed", oa_url: w.oaUrl ?? null },
    primary_location: {
      is_oa: Boolean(w.pdfUrl),
      landing_page_url: w.landing ?? (w.doi ? `https://doi.org/${w.doi}` : null),
      pdf_url: w.pdfUrl ?? null,
      source,
      raw_source_name: w.rawSourceName ?? w.venue ?? null,
    },
    best_oa_location: w.pdfUrl ? { pdf_url: w.pdfUrl } : null,
    authorships,
    topics: (w.topics ?? []).map((t) => ({ display_name: t })),
    abstract_inverted_index: invertedIndex(w.abstract),
  }
}

export function toCrossrefItem(w: CompactWork) {
  const item: Record<string, unknown> = {
    DOI: w.doi,
    title: [w.title],
    type: w.type ?? "journal-article",
    "is-referenced-by-count": w.citations ?? 0,
    URL: w.landing ?? `https://doi.org/${w.doi}`,
    publisher: w.publisher ?? undefined,
    "container-title": w.venue ? [w.venue] : undefined,
    issued: { "date-parts": [w.issued ?? [w.year ?? null]] },
    volume: w.volume,
    issue: w.issue,
    page: w.page,
  }
  if (w.publishedPrint) item["published-print"] = { "date-parts": [w.publishedPrint] }
  if (w.publishedOnline) item["published-online"] = { "date-parts": [w.publishedOnline] }
  // Every live Crossref item carries `created` (deposit date); emit it so the baseline
  // parser — which never reads `issued` — sees the same year the live API would give it.
  if (typeof w.year === "number") item.created = { "date-parts": [[w.year, 1, 1]] }
  if (w.authors) {
    item.author = w.authors.map((a) =>
      typeof a === "string"
        ? (() => {
            const parts = a.split(" ")
            return parts.length > 1
              ? { given: parts.slice(0, -1).join(" "), family: parts[parts.length - 1], sequence: "additional", affiliation: [] }
              : { family: a, sequence: "additional", affiliation: [] }
          })()
        : { ...a, sequence: "additional", affiliation: [] }
    )
  }
  if (w.updateTo) item["update-to"] = w.updateTo
  return item
}

export function toScholarPaper(w: CompactWork) {
  const externalIds: Record<string, string | number> = { ...(w.externalIds ?? {}) }
  if (w.doi) externalIds.DOI = w.doi
  if (w.arxivId) externalIds.ArXiv = w.arxivId
  return {
    paperId: w.id,
    externalIds,
    url: w.landing ?? `https://www.semanticscholar.org/paper/${w.id}`,
    title: w.title,
    venue: w.venue ?? "",
    year: w.year ?? null,
    citationCount: w.citations ?? 0,
    influentialCitationCount: w.influential ?? 0,
    openAccessPdf: { url: w.oaUrl ?? "", status: w.oaUrl ? "GREEN" : null, license: null },
    authors: (w.authors ?? []).map((a, i) => ({ authorId: String(i + 1), name: authorName(a) })),
    abstract: w.abstract ?? null,
    tldr: w.tldr ? { model: "tldr@v2.0.0", text: w.tldr } : null,
  }
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export function toArxivAtom(entry: {
  id: string
  title: string
  updated: string
  published: string
  summary: string
  comment?: string
  doi?: string
  authors: string[]
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <link href="http://arxiv.org/api/query?search_query%3D%26id_list%3D1706.03762%26start%3D0%26max_results%3D10" rel="self" type="application/atom+xml"/>
  <title type="html">ArXiv Query: search_query=&amp;id_list=${entry.id.split("/abs/")[1]?.replace(/v\d+$/, "")}&amp;start=0&amp;max_results=10</title>
  <id>http://arxiv.org/api/replay</id>
  <updated>${entry.updated}</updated>
  <opensearch:totalResults xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">1</opensearch:totalResults>
  <entry>
    <id>${entry.id}</id>
    <updated>${entry.updated}</updated>
    <published>${entry.published}</published>
    <title>${xmlEscape(entry.title)}</title>
    <summary>${xmlEscape(entry.summary)}</summary>
${entry.authors.map((a) => `    <author>\n      <name>${xmlEscape(a)}</name>\n    </author>`).join("\n")}
${entry.doi ? `    <arxiv:doi xmlns:arxiv="http://arxiv.org/schemas/atom">${entry.doi}</arxiv:doi>\n` : ""}${entry.comment ? `    <arxiv:comment xmlns:arxiv="http://arxiv.org/schemas/atom">${xmlEscape(entry.comment)}</arxiv:comment>\n` : ""}    <link href="${entry.id}" rel="alternate" type="text/html"/>
    <link title="pdf" href="${entry.id.replace("/abs/", "/pdf/")}" rel="related" type="application/pdf"/>
  </entry>
</feed>`
}

// ---------------------------------------------------------------------------
// Replay fetch factory
// ---------------------------------------------------------------------------

type RecordedShape = {
  openalex: { search: Record<string, SearchFixture>; doi: Record<string, { url: string; result: CompactWork }> }
  crossref: {
    search: Record<string, SearchFixture>
    searchBibliographic: Record<string, SearchFixture>
    doi: Record<string, { url: string; result: CompactWork }>
  }
  semanticscholar: {
    search: Record<string, SearchFixture>
    doi: Record<string, { url: string; status: number; body: unknown }>
  }
  arxiv: Record<string, { url: string; entry: Parameters<typeof toArxivAtom>[0] }>
}

const corpus = recorded as unknown as RecordedShape

/** All compact records of a provider, for DOI resolution across fixtures. */
function allProviderWorks(provider: "openalex" | "crossref" | "semanticscholar"): CompactWork[] {
  const out: CompactWork[] = []
  const block = corpus[provider] as unknown as {
    search: Record<string, SearchFixture>
    searchBibliographic?: Record<string, SearchFixture>
    doi?: Record<string, { result?: CompactWork }>
  }
  for (const fx of Object.values(block.search)) out.push(...(fx.results ?? []))
  for (const fx of Object.values(block.searchBibliographic ?? {})) out.push(...(fx.results ?? []))
  for (const fx of Object.values(block.doi ?? {})) if (fx.result) out.push(fx.result)
  return out
}

export function providerOf(url: string): ReplayProvider {
  if (url.includes("api.openalex.org")) return "openalex"
  if (url.includes("api.crossref.org")) return "crossref"
  if (url.includes("api.semanticscholar.org")) return "semanticscholar"
  if (url.includes("export.arxiv.org")) return "arxiv"
  if (url.includes("api.tavily.com")) return "tavily"
  return "unknown"
}

export interface ReplayFetch {
  fetch: typeof fetch
  calls: ReplayCall[]
  reset(): void
}

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  })
}

function waitOrAbort(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("The operation was aborted.", "AbortError"))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    function onAbort() {
      clearTimeout(timer)
      reject(signal?.reason ?? new DOMException("The operation was aborted.", "AbortError"))
    }
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

function hangUntilAbort(signal?: AbortSignal | null): Promise<never> {
  return new Promise((_, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("The operation was aborted.", "AbortError"))
      return
    }
    signal?.addEventListener(
      "abort",
      () => reject(signal.reason ?? new DOMException("The operation was aborted.", "AbortError")),
      { once: true }
    )
  })
}

export function createReplayFetch(options: ReplayOptions = {}): ReplayFetch {
  const calls: ReplayCall[] = []
  const oaIndex = indexByNormalizedKey(corpus.openalex.search)
  const crIndex = indexByNormalizedKey(corpus.crossref.search)
  const crBibIndex = indexByNormalizedKey(corpus.crossref.searchBibliographic)
  const s2Index = indexByNormalizedKey(corpus.semanticscholar.search)

  const replay = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
    const provider = providerOf(url)
    const signal = init?.signal ?? null
    const call: ReplayCall = {
      provider,
      url,
      kind: "other",
      routedTo: null,
      simulatedYearFilter: false,
      status: 200,
      startedAt: Date.now(),
    }
    calls.push(call)

    const latency = options.latencyMs?.[provider]
    if (latency) await waitOrAbort(latency, signal)

    const fault = options.faults?.[provider]
    if (fault) {
      if (fault.kind === "hang") return hangUntilAbort(signal)
      if (fault.kind === "network") throw new TypeError("fetch failed")
      if (fault.kind === "malformed") {
        call.status = 200
        return new Response("{not json", { status: 200, headers: { "content-type": "application/json" } })
      }
      if (fault.kind === "status") {
        call.status = fault.status
        const headers: Record<string, string> = {}
        if (fault.retryAfterSec !== undefined) headers["retry-after"] = String(fault.retryAfterSec)
        return jsonResponse(fault.body ?? { error: `injected ${fault.status}` }, fault.status, headers)
      }
      if (fault.kind === "empty") {
        if (provider === "openalex") return jsonResponse({ meta: { count: 0 }, results: [] })
        if (provider === "crossref") return jsonResponse({ status: "ok", message: { items: [] } })
        if (provider === "semanticscholar") return jsonResponse({ total: 0, offset: 0, data: [] })
      }
    }

    const u = new URL(url)

    const stub = options.stubs?.[provider]
    if (stub) {
      const stubbed = stub(u, init)
      if (stubbed) {
        call.kind = "other"
        call.routedTo = "stub"
        call.status = stubbed.status
        return stubbed
      }
    }

    // ----- OpenAlex ----------------------------------------------------------
    if (provider === "openalex") {
      const doiMatch = u.pathname.match(/^\/works\/(.+)$/)
      if (doiMatch) {
        call.kind = "doi"
        const doi = cleanDoi(doiMatch[1])
        const hit = allProviderWorks("openalex").find((w) => w.doi && w.doi.toLowerCase() === doi)
        if (!hit) {
          call.status = 404
          return jsonResponse({ error: "Not Found", message: "The requested resource could not be found." }, 404)
        }
        call.routedTo = `doi:${doi}`
        return jsonResponse(toOpenAlexWork(hit))
      }
      call.kind = "search"
      const q = u.searchParams.get("search") ?? ""
      const filter = u.searchParams.get("filter") ?? ""
      const from = filter.match(/from_publication_date:(\d{4})/)?.[1]
      const to = filter.match(/to_publication_date:(\d{4})/)?.[1]
      const fx = resolveSearchFixture(oaIndex, q, from ? `from:${from}` : undefined)
      if (!fx) {
        call.routedTo = null
        return jsonResponse({ meta: { count: 0 }, results: [] })
      }
      call.routedTo = fx.key
      let results = fx.value.results ?? []
      if ((from || to) && !fx.key.includes("|")) {
        call.simulatedYearFilter = true
        results = results.filter((w) => yearInWindow(w.year, from ? Number(from) : undefined, to ? Number(to) : undefined))
      }
      const perPage = Number(u.searchParams.get("per_page") ?? 5)
      return jsonResponse({ meta: { ...(fx.value.meta ?? {}), per_page: perPage }, results: results.slice(0, perPage).map(toOpenAlexWork) })
    }

    // ----- Crossref ----------------------------------------------------------
    if (provider === "crossref") {
      const doiMatch = u.pathname.match(/^\/works\/(.+)$/)
      if (doiMatch) {
        call.kind = "doi"
        const doi = cleanDoi(doiMatch[1])
        const hit = allProviderWorks("crossref").find((w) => w.doi && w.doi.toLowerCase() === doi)
        if (!hit) {
          call.status = 404
          return new Response("Resource not found.", { status: 404 })
        }
        call.routedTo = `doi:${doi}`
        return jsonResponse({ status: "ok", "message-type": "work", message: toCrossrefItem(hit) })
      }
      call.kind = "search"
      const bib = u.searchParams.get("query.bibliographic")
      const q = bib ?? u.searchParams.get("query") ?? ""
      const filter = u.searchParams.get("filter") ?? ""
      const from = filter.match(/from-pub-date:(\d{4})/)?.[1]
      const to = filter.match(/until-pub-date:(\d{4})/)?.[1]
      const fx = resolveSearchFixture(bib ? crBibIndex : crIndex, q) ?? resolveSearchFixture(crIndex, q)
      if (!fx) {
        return jsonResponse({ status: "ok", "message-type": "work-list", message: { items: [], "total-results": 0 } })
      }
      call.routedTo = (bib && crBibIndex.get(normalizeQueryKey(q)) ? "bibliographic:" : "") + fx.key
      let results = fx.value.results ?? []
      if (from || to) {
        call.simulatedYearFilter = true
        results = results.filter((w) => yearInWindow(w.year, from ? Number(from) : undefined, to ? Number(to) : undefined))
      }
      const rows = Number(u.searchParams.get("rows") ?? 5)
      return jsonResponse({
        status: "ok",
        "message-type": "work-list",
        message: { ...(fx.value.meta ?? {}), items: results.slice(0, rows).map(toCrossrefItem) },
      })
    }

    // ----- Semantic Scholar --------------------------------------------------
    if (provider === "semanticscholar") {
      if (u.pathname.endsWith("/paper/search")) {
        call.kind = "search"
        const q = u.searchParams.get("query") ?? ""
        const fx = resolveSearchFixture(s2Index, q)
        if (!fx) return jsonResponse({ total: 0, offset: 0, data: [] })
        call.routedTo = fx.key
        if (fx.value.status && fx.value.status !== 200) {
          call.status = fx.value.status
          return new Response(String(fx.value.body ?? ""), { status: fx.value.status, headers: { "content-type": "text/plain" } })
        }
        let results = fx.value.results ?? []
        const year = u.searchParams.get("year")
        if (year) {
          const m = year.match(/^(\d{4})?-?(\d{4})?$/)
          const from = m?.[1] ? Number(m[1]) : undefined
          const to = m?.[2] ? Number(m[2]) : year.includes("-") ? undefined : from
          call.simulatedYearFilter = true
          results = results.filter((w) => yearInWindow(w.year, from, to))
        }
        const limit = Number(u.searchParams.get("limit") ?? 5)
        return jsonResponse({ total: results.length, offset: 0, data: results.slice(0, limit).map(toScholarPaper) })
      }
      const idMatch = u.pathname.match(/^\/graph\/v1\/paper\/(.+)$/)
      if (idMatch) {
        call.kind = "doi"
        const raw = decodeURIComponent(idMatch[1])
        if (/^ARXIV:/i.test(raw)) {
          const arxivId = raw.replace(/^ARXIV:/i, "").replace(/v\d+$/, "")
          const hit = allProviderWorks("semanticscholar").find((w) => w.arxivId === arxivId)
          if (!hit) {
            call.status = 404
            return jsonResponse({ error: `Paper with id ${raw} not found` }, 404)
          }
          call.routedTo = `arxiv:${arxivId}`
          return jsonResponse(toScholarPaper(hit))
        }
        const doi = raw.replace(/^DOI:/i, "").toLowerCase()
        const fixture = corpus.semanticscholar.doi[doi]
        if (fixture) {
          call.status = fixture.status
          return jsonResponse(fixture.body, fixture.status)
        }
        const hit = allProviderWorks("semanticscholar").find((w) => w.doi && w.doi.toLowerCase() === doi)
        if (!hit) {
          call.status = 404
          return jsonResponse({ error: `Paper with id ${raw} not found` }, 404)
        }
        call.routedTo = `doi:${doi}`
        return jsonResponse(toScholarPaper(hit))
      }
      return jsonResponse({ error: "unrouted" }, 404)
    }

    // ----- arXiv ----------------------------------------------------------------
    if (provider === "arxiv") {
      call.kind = "arxiv"
      const id = (u.searchParams.get("id_list") ?? "").replace(/v\d+$/, "")
      const fx = corpus.arxiv[id]
      if (!fx) {
        return new Response(toArxivAtom({ id: "", title: "", updated: "", published: "", summary: "", authors: [] }).replace(/<entry>[\s\S]*<\/entry>/, ""), {
          status: 200,
          headers: { "content-type": "application/atom+xml" },
        })
      }
      call.routedTo = id
      return new Response(toArxivAtom(fx.entry), { status: 200, headers: { "content-type": "application/atom+xml" } })
    }

    call.status = 599
    throw new TypeError(`replay fetch: unrouted URL ${url}`)
  }

  return {
    fetch: replay as typeof fetch,
    calls,
    reset() {
      calls.length = 0
    },
  }
}

/** Install the replay fetch globally for a test; returns a restore function. */
export function installReplayFetch(options: ReplayOptions = {}): ReplayFetch & { restore(): void } {
  const rf = createReplayFetch(options)
  const original = globalThis.fetch
  globalThis.fetch = rf.fetch
  return {
    ...rf,
    restore() {
      globalThis.fetch = original
    },
  }
}
