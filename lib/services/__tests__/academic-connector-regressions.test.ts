/**
 * Regression tests for the Academic Connector audit findings (AR-nn).
 *
 * Each `describe` reproduces one finding from
 * artifacts/academic-retrieval-audit-2026-09-27/report.md against the real connector,
 * using the fixture-replay `fetch` (recorded provider bodies + fault injection).
 * All tests were red before the corresponding fix landed.
 */

import { describe, it, expect, afterEach, vi } from "vitest"
import * as connector from "@/lib/services/academic-connector"
import { ssFetch } from "@/lib/services/semantic-scholar-service"
import { fetchArxivMetadata } from "@/lib/services/arxiv-service"
import { ACADEMIC_TIMEOUTS_MS } from "@/lib/services/academic-http"
import { extractStructuredReferences } from "@/lib/ai/thesis-context"
import { installReplayFetch, jsonResponse, toOpenAlexWork, toScholarPaper, toCrossrefItem, type ReplayOptions } from "./academic-replay-fetch"

type Installed = ReturnType<typeof installReplayFetch>
let replay: Installed | null = null
const savedTimeouts = { ...ACADEMIC_TIMEOUTS_MS }

function useReplay(options: ReplayOptions = {}): Installed {
  replay?.restore()
  replay = installReplayFetch(options)
  return replay
}

/** Drive an async flow to completion while flushing fake timers (retry back-offs). */
async function flushed<T>(p: Promise<T>, stepMs = 500, maxSteps = 200): Promise<T> {
  let settled = false
  p.then(
    () => (settled = true),
    () => (settled = true)
  )
  for (let i = 0; i < maxSteps && !settled; i++) {
    await vi.advanceTimersByTimeAsync(stepMs)
  }
  return p
}

const oa = (w: Parameters<typeof toOpenAlexWork>[0]) => toOpenAlexWork(w)
const s2 = (w: Parameters<typeof toScholarPaper>[0]) => toScholarPaper(w)
const cr = (w: Parameters<typeof toCrossrefItem>[0]) => toCrossrefItem(w)

const openalexList = (works: ReturnType<typeof oa>[]) => (u: URL) =>
  u.pathname === "/works" ? jsonResponse({ meta: { count: works.length }, results: works }) : null
const scholarList = (papers: ReturnType<typeof s2>[]) => (u: URL) =>
  u.pathname.endsWith("/paper/search") ? jsonResponse({ total: papers.length, offset: 0, data: papers }) : null
const crossrefList = (items: ReturnType<typeof cr>[]) => (u: URL) =>
  u.pathname === "/works" ? jsonResponse({ status: "ok", "message-type": "work-list", message: { items } }) : null

afterEach(() => {
  vi.useRealTimers()
  replay?.restore()
  replay = null
  Object.assign(ACADEMIC_TIMEOUTS_MS, savedTimeouts)
  delete process.env.TAVILY_API_KEY
})

// ---------------------------------------------------------------------------

describe("AR-01 non-Latin titles survive deduplication", () => {
  it("keeps a CJK-title record that has no DOI", async () => {
    useReplay({
      stubs: { openalex: openalexList([oa({ id: "https://openalex.org/W1", title: "基于深度学习的地质找矿大数据挖掘与集成的挑战", doi: null, year: 2021, citations: 16, authors: ["左仁广"] })]) },
      faults: { semanticscholar: { kind: "empty" }, crossref: { kind: "empty" } },
    })
    const results = await connector.searchAcademicPaper("深度学习 地质找矿", 5)
    expect(results.map((r) => r.title)).toContain("基于深度学习的地质找矿大数据挖掘与集成的挑战")
  })

  it("still merges two providers' copies of a Cyrillic-title paper into one row", async () => {
    const title = "Глубокое обучение в задачах распознавания речи"
    useReplay({
      stubs: {
        openalex: openalexList([oa({ id: "https://openalex.org/W2", title, doi: null, year: 2020, citations: 3, authors: ["Иван Петров"] })]),
        semanticscholar: scholarList([s2({ id: "s2-ru", title: title.toUpperCase(), doi: null, year: 2020, citations: 4, authors: ["I. Петров"] })]),
      },
      faults: { crossref: { kind: "empty" } },
    })
    const results = await connector.searchAcademicPaper(title, 5)
    expect(results).toHaveLength(1)
  })
})

describe("AR-02 one hung provider must not hang the whole search", () => {
  it("bounds a hung OpenAlex even when the caller passes a long-lived request signal", async () => {
    ACADEMIC_TIMEOUTS_MS.openalex = 50
    useReplay({ faults: { openalex: { kind: "hang" } } })
    const requestSignal = new AbortController().signal // never aborted, like `req.signal`
    const outcome = await Promise.race([
      connector.searchAcademicPaper("quantum machine learning", 5, { signal: requestSignal }).then((r) => ({ done: true, count: r.length })),
      new Promise<{ done: false; count: number }>((res) => setTimeout(() => res({ done: false, count: -1 }), 1500)),
    ])
    expect(outcome.done).toBe(true)
    expect(outcome.count).toBeGreaterThan(0) // Semantic Scholar + Crossref still answer
  })

  it("bounds a hung Tavily (no timeout at all before the fix)", async () => {
    process.env.TAVILY_API_KEY = "test-key"
    ACADEMIC_TIMEOUTS_MS.tavily = 50
    useReplay({ faults: { tavily: { kind: "hang" } } })
    const outcome = await Promise.race([
      connector.searchAcademicPaper("quantum machine learning", 5).then((r) => ({ done: true, count: r.length })),
      new Promise<{ done: false; count: number }>((res) => setTimeout(() => res({ done: false, count: -1 }), 1500)),
    ])
    expect(outcome.done).toBe(true)
    expect(outcome.count).toBeGreaterThan(0)
  })

  it("bounds a hung arXiv lookup with the caller signal", async () => {
    ACADEMIC_TIMEOUTS_MS.arxiv = 50
    useReplay({ faults: { arxiv: { kind: "hang" } } })
    const outcome = await Promise.race([
      connector.searchAcademicPaper("arXiv:1706.03762", 5).then((r) => ({ done: true, count: r.length })),
      new Promise<{ done: false; count: number }>((res) => setTimeout(() => res({ done: false, count: -1 }), 1500)),
    ])
    expect(outcome.done).toBe(true)
  })
})

describe("AR-03 duplicate rows for the same paper", () => {
  it("merges a DOI-keyed OpenAlex record with a title-keyed Semantic Scholar record of the same paper", async () => {
    useReplay({
      stubs: {
        openalex: openalexList([oa({ id: "https://openalex.org/W3", title: "Attention Is All You Need", doi: "10.65215/2q58a426", year: 2025, citations: 26907, authors: ["Ashish Vaswani", "Noam Shazeer"] })]),
        semanticscholar: scholarList([s2({ id: "s2-aiayn", title: "Attention is All you Need", doi: null, arxivId: "1706.03762", year: 2017, citations: 194008, influential: 20794, authors: ["Ashish Vaswani", "Noam Shazeer"] })]),
      },
      faults: { crossref: { kind: "empty" } },
    })
    const results = await connector.searchAcademicPaper("Attention Is All You Need", 5)
    expect(results).toHaveLength(1)
    expect(results[0].arxivId).toBe("1706.03762")
    expect(results[0].doi).toBe("10.65215/2q58a426")
    expect(results[0].citationCount).toBe(194008)
    expect(results[0].sources).toEqual(expect.arrayContaining(["openalex", "semanticscholar"]))
  })

  it("merges a DataCite arXiv DOI with the bare arXiv id of the same preprint", async () => {
    useReplay({
      stubs: {
        openalex: openalexList([oa({ id: "https://openalex.org/W4", title: "Is Space-Time Attention All You Need for Video Understanding?", doi: "10.48550/arxiv.2102.05095", year: 2021, citations: 1475, authors: ["Gedas Bertasius"] })]),
        semanticscholar: scholarList([s2({ id: "s2-timesformer", title: "Is Space-Time Attention All You Need for Video Understanding?", doi: null, arxivId: "2102.05095", year: 2021, citations: 1500, authors: ["Gedas Bertasius"] })]),
      },
      faults: { crossref: { kind: "empty" } },
    })
    const results = await connector.searchAcademicPaper("space-time attention video understanding", 5)
    expect(results).toHaveLength(1)
  })

  it("does NOT merge two different works that merely share a generic title", async () => {
    useReplay({
      stubs: {
        crossref: crossrefList([
          cr({ doi: "10.1016/b978-0-12-800953-6.00002-5", title: "Machine Learning", year: 2014, citations: 20, authors: [{ given: "Peter", family: "Wittek" }], venue: "Quantum Machine Learning" }),
          cr({ doi: "10.1007/978-1-4842-7098-1_2", title: "Machine Learning", year: 2021, citations: 1, authors: [{ given: "Santanu", family: "Ganguly" }], venue: "Quantum Machine Learning: An Applied Approach" }),
        ]),
      },
      faults: { openalex: { kind: "empty" }, semanticscholar: { kind: "empty" } },
    })
    const results = await connector.searchAcademicPaper("quantum machine learning", 5)
    expect(results).toHaveLength(2)
  })
})

describe("AR-04 DOI queries with sentence punctuation", () => {
  it.each([
    ["10.1038/nature14539.", "10.1038/nature14539"],
    ["see https://doi.org/10.1038/nature14539),", "10.1038/nature14539"],
    ["doi:10.1016/s0140-6736(97)11096-0.", "10.1016/s0140-6736(97)11096-0"],
  ])("resolves %s as a DOI lookup", async (query, expectedDoi) => {
    useReplay()
    const results = await connector.searchAcademicPaper(query, 5)
    expect(results).toHaveLength(1)
    expect(results[0].doi?.toLowerCase()).toBe(expectedDoi)
  })
})

describe("AR-05 year window applies to every provider", () => {
  it("passes the window to Semantic Scholar and Crossref and drops out-of-window rows", async () => {
    const rf = useReplay()
    const results = await connector.searchAcademicPaper("quantum machine learning", 12, { yearFrom: 2024 })
    expect(results.length).toBeGreaterThan(0)
    expect(results.filter((r) => typeof r.year === "number" && r.year < 2024)).toEqual([])
    const s2Call = rf.calls.find((c) => c.provider === "semanticscholar" && c.kind === "search")
    const crCall = rf.calls.find((c) => c.provider === "crossref" && c.kind === "search")
    expect(s2Call?.url).toMatch(/[?&]year=2024-/)
    expect(crCall?.url).toMatch(/from-pub-date(?:%3A|:)2024/)
  })

  it("post-filters rows whose provider ignored the window", async () => {
    useReplay({
      stubs: {
        semanticscholar: scholarList([
          s2({ id: "old", title: "Old quantum paper", doi: "10.1000/old", year: 2014, citations: 900, authors: ["A. Old"] }),
          s2({ id: "new", title: "New quantum paper", doi: "10.1000/new", year: 2025, citations: 5, authors: ["B. New"] }),
        ]),
      },
      faults: { openalex: { kind: "empty" }, crossref: { kind: "empty" } },
    })
    const results = await connector.searchAcademicPaper("quantum paper", 5, { yearFrom: 2024, yearTo: 2026 })
    expect(results.map((r) => r.doi)).toEqual(["10.1000/new"])
  })
})

describe("AR-06 fuzzy verification must be similarity-gated", () => {
  it("does not mark a fabricated citation as verified because OpenAlex returned some unrelated top hit", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
    useReplay({
      stubs: {
        openalex: openalexList([oa({ id: "https://openalex.org/W5", title: "Deep learning", doi: "10.1038/nature14539", year: 2015, citations: 85067, authors: ["Yann LeCun"] })]),
        crossref: crossrefList([cr({ doi: "10.1000/unrelated", title: "Quantum networks in industry: a survey", year: 2020, citations: 3, authors: [{ given: "X", family: "Y" }] })]),
      },
      faults: { semanticscholar: { kind: "empty" } },
    })
    const result = await flushed(connector.verifySingleCitation("NOVÁK, Ján. 2019. Neexistujúca práca o kvantových sieťach v priemysle. Bratislava: FMFI UK. 84 s."))
    expect(result.verification.found).toBe(false)
    expect(result.status).toBe("not_found")
  })
})

describe("AR-07 verification falls back to OpenAlex/Crossref when Semantic Scholar is rate-limited", () => {
  it("verifies a real citation from OpenAlex while Semantic Scholar answers 429", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
    useReplay({ faults: { semanticscholar: { kind: "status", status: 429 } } })
    const result = await flushed(connector.verifySingleCitation("BIAMONTE, Jacob et al. 2017. Quantum machine learning. Nature, 549(7671), pp. 195–202."))
    expect(result.status).toBe("verified")
    expect(result.verification.found).toBe(true)
    expect(result.enriched?.doi?.toLowerCase()).toBe("10.1038/nature23474")
  })

  it("stays 'unavailable' (not 'not_found') when every registry is down", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
    useReplay({
      faults: { semanticscholar: { kind: "status", status: 429 }, openalex: { kind: "status", status: 503 }, crossref: { kind: "status", status: 503 } },
    })
    const result = await flushed(connector.verifySingleCitation("BIAMONTE, Jacob et al. 2017. Quantum machine learning. Nature, 549(7671), pp. 195–202."))
    expect(result.verification.found).toBe(false)
    expect(["rate_limited", "service_error", "timeout"]).toContain(result.status)
  })
})

describe("AR-08 reference parser must not pollute the search title", () => {
  it("extracts clean titles from ISO 690 citations", () => {
    const [wakefield, vaswani, goodfellow] = extractStructuredReferences(
      [
        "[1] WAKEFIELD, A. J. et al. 1998. Ileal-lymphoid-nodular hyperplasia, non-specific colitis, and pervasive developmental disorder in children. The Lancet, 351(9103), pp. 637–641.",
        "[2] VASWANI, Ashish et al. 2017. Attention is all you need. In: Advances in Neural Information Processing Systems 30. pp. 5998–6008.",
        "[3] Goodfellow, I., Bengio, Y. 2016. Deep Learning. MIT Press. ISBN: 9780262035613.",
      ].join("\n")
    )
    expect(wakefield.title).toBe("Ileal-lymphoid-nodular hyperplasia, non-specific colitis, and pervasive developmental disorder in children")
    expect(vaswani.title).toBe("Attention is all you need")
    expect(goodfellow.title).toBe("Deep Learning")
  })

  it("verifies the retracted Wakefield citation by title and surfaces the retraction", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
    useReplay()
    const result = await flushed(
      connector.verifySingleCitation("WAKEFIELD, A. J. et al. 1998. Ileal-lymphoid-nodular hyperplasia, non-specific colitis, and pervasive developmental disorder in children. The Lancet, 351(9103), pp. 637–641.")
    )
    expect(result.status).toBe("verified")
    expect(result.enriched?.isRetracted).toBe(true)
  })
})

describe("AR-09 retraction knowledge from Crossref survives an OpenAlex outage", () => {
  it("flags the retracted Wakefield paper using Crossref's update-to / RETRACTED prefix", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
    useReplay({ faults: { openalex: { kind: "status", status: 500 } } })
    const results = await flushed(
      connector.searchAcademicPaper("Ileal-lymphoid-nodular hyperplasia non-specific colitis pervasive developmental disorder children", 8)
    )
    const wakefield = results.find((r) => r.doi?.toLowerCase() === "10.1016/s0140-6736(97)11096-0")
    expect(wakefield).toBeDefined()
    expect(wakefield?.isRetracted).toBe(true)
  })
})

describe("AR-10 merge keeps the best of every provider", () => {
  it("prefers real authors over the 'Unknown Author' sentinel and keeps influential citations", async () => {
    useReplay({
      stubs: {
        openalex: (u) =>
          u.pathname === "/works"
            ? jsonResponse({ results: [{ ...oa({ id: "https://openalex.org/W6", title: "Power of data in quantum machine learning", doi: "10.1038/s41467-021-22539-9", year: 2021, citations: 743 }), authorships: [] }] })
            : null,
        semanticscholar: scholarList([s2({ id: "s2-power", title: "Power of data in quantum machine learning", doi: "10.1038/s41467-021-22539-9", year: 2021, citations: 700, influential: 41, authors: ["Hsin-Yuan Huang", "Michael Broughton"] })]),
      },
      faults: { crossref: { kind: "empty" } },
    })
    const [row] = await connector.searchAcademicPaper("power of data quantum machine learning", 5)
    expect(row.authors).toEqual(["Hsin-Yuan Huang", "Michael Broughton"])
    expect(row.influentialCitationCount).toBe(41)
    expect(row.citationCount).toBe(743)
    expect(row.openAccessPdfUrl).not.toBe("")
  })

  it("maps Crossref citation counts and issued dates", async () => {
    useReplay({
      stubs: {
        crossref: crossrefList([cr({ doi: "10.1007/s42484-021-00056-8", title: "An introduction to quantum machine learning", citations: 87, authors: [{ given: "Leonardo", family: "Alchieri" }], issued: [2021, 8, 30], venue: "Quantum Machine Intelligence" })]),
      },
      faults: { openalex: { kind: "empty" }, semanticscholar: { kind: "empty" } },
    })
    const [row] = await connector.searchAcademicPaper("introduction to quantum machine learning", 5)
    expect(row.citationCount).toBe(87)
    expect(row.year).toBe(2021)
  })
})

describe("AR-11 ranking is not a pure citation sort", () => {
  it("ranks the exact-title paper confirmed by two providers above a more-cited near-title paper", async () => {
    useReplay({
      stubs: {
        openalex: openalexList([
          oa({ id: "https://openalex.org/W7", title: "Is Space-Time Attention All You Need for Video Understanding?", doi: "10.48550/arxiv.2102.05095", year: 2021, citations: 90000, authors: ["Gedas Bertasius"] }),
          oa({ id: "https://openalex.org/W8", title: "Channel Attention Is All You Need for Video Frame Interpolation", doi: "10.1609/aaai.v34i07.6693", year: 2020, citations: 378, authors: ["Myungsub Choi"] }),
        ]),
        semanticscholar: scholarList([s2({ id: "s2-choi", title: "Channel Attention Is All You Need for Video Frame Interpolation", doi: "10.1609/AAAI.V34I07.6693", year: 2020, citations: 380, authors: ["Myungsub Choi"] })]),
      },
      faults: { crossref: { kind: "empty" } },
    })
    const results = await connector.searchAcademicPaper("Channel Attention Is All You Need for Video Frame Interpolation", 5)
    expect(results[0].doi?.toLowerCase()).toBe("10.1609/aaai.v34i07.6693")
  })
})

describe("AR-12 Crossref search uses the bibliographic query mode", () => {
  it("sends query.bibliographic with a select projection", async () => {
    const rf = useReplay()
    await connector.searchAcademicPaper("quantum machine learning", 5)
    const crCall = rf.calls.find((c) => c.provider === "crossref" && c.kind === "search")
    expect(crCall?.url).toContain("query.bibliographic=")
    expect(crCall?.url).toContain("select=")
  })
})

describe("AR-14 OpenAlex venue falls back to raw_source_name", () => {
  it("fills venue from raw_source_name when primary_location.source is null", async () => {
    useReplay({
      stubs: {
        openalex: openalexList([
          oa({ id: "https://openalex.org/W9", title: "Attention Is All You Need In Speech Separation", doi: "10.1109/icassp39728.2021.9413901", year: 2021, citations: 646, authors: ["Cem Subakan"], rawSourceName: "ICASSP 2021 - 2021 IEEE International Conference on Acoustics, Speech and Signal Processing (ICASSP)" }),
        ]),
      },
      faults: { semanticscholar: { kind: "empty" }, crossref: { kind: "empty" } },
    })
    const [row] = await connector.searchAcademicPaper("attention speech separation", 5)
    expect(row.venue).toMatch(/^ICASSP 2021/)
  })
})

describe("AR-15 search exposes per-provider diagnostics", () => {
  it("reports provider status, mode and degraded flag", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
    useReplay({ faults: { openalex: { kind: "status", status: 500 } } })
    const detailed = await flushed(connector.searchAcademicPaperDetailed("quantum machine learning", 5))
    expect(detailed.mode).toBe("search")
    expect(detailed.providers.openalex.status).toBe("error")
    expect(detailed.providers.semanticscholar.status).toBe("ok")
    expect(detailed.providers.semanticscholar.count).toBeGreaterThan(0)
    expect(detailed.degraded).toBe(true)
    expect(detailed.results.length).toBeGreaterThan(0)
  })

  it("distinguishes 'all providers failed' from 'no matches'", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
    useReplay({ faults: { openalex: { kind: "status", status: 503 }, semanticscholar: { kind: "status", status: 503 }, crossref: { kind: "network" } } })
    const detailed = await flushed(connector.searchAcademicPaperDetailed("quantum machine learning", 5))
    expect(detailed.results).toEqual([])
    expect(detailed.degraded).toBe(true)
    expect(Object.values(detailed.providers).filter((p) => p.status === "ok")).toHaveLength(0)
  })
})

describe("AR-16 Semantic Scholar back-off is capped and abortable", () => {
  it("gives up immediately on a Retry-After far beyond the budget instead of sleeping for minutes", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
    useReplay({ faults: { semanticscholar: { kind: "status", status: 429, retryAfterSec: 120 } } })
    let settled = false
    const p = ssFetch("/paper/search", { query: "x" }).then((r) => {
      settled = true
      return r
    })
    await vi.advanceTimersByTimeAsync(6000)
    expect(settled).toBe(true)
    const res = await p
    expect(res.status).toBe("rate_limited")
    expect(res.retryAfterMs).toBe(120_000)
  })

  it("stops backing off when the caller aborts", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
    useReplay({ faults: { semanticscholar: { kind: "status", status: 429 } } })
    const ctrl = new AbortController()
    let settled = false
    const p = ssFetch("/paper/search", { query: "x" }, ctrl.signal).then((r) => {
      settled = true
      return r
    })
    await vi.advanceTimersByTimeAsync(200)
    ctrl.abort()
    await vi.advanceTimersByTimeAsync(100)
    expect(settled).toBe(true)
    expect((await p).status).toBe("timeout")
  })
})

describe("AR-17 arXiv metadata parses the DOI and honours the caller signal", () => {
  const atom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"><entry>
  <id>http://arxiv.org/abs/2301.00001v1</id><published>2023-01-01T00:00:00Z</published>
  <title>A Paper With A DOI</title><summary>Abstract.</summary>
  <author><name>Ada Lovelace</name></author>
  <arxiv:doi xmlns:arxiv="http://arxiv.org/schemas/atom">10.1000/xyz123</arxiv:doi>
</entry></feed>`

  it("returns the DOI advertised in the Atom feed", async () => {
    useReplay({ stubs: { arxiv: () => new Response(atom, { status: 200, headers: { "content-type": "application/atom+xml" } }) } })
    const meta = await fetchArxivMetadata("2301.00001")
    expect(meta?.doi).toBe("10.1000/xyz123")
    expect(meta?.title).toBe("A Paper With A DOI")
  })

  it("returns null promptly when the caller signal is already aborted", async () => {
    useReplay({ faults: { arxiv: { kind: "hang" } } })
    const ctrl = new AbortController()
    ctrl.abort()
    const started = Date.now()
    const meta = await fetchArxivMetadata("2301.00001", { signal: ctrl.signal })
    expect(meta).toBeNull()
    expect(Date.now() - started).toBeLessThan(1000) // before the fix this waited for the 10 s timeout
  })
})

describe("AR-21 auditThesisCitations reports what it skipped", () => {
  it("exposes the number of citations beyond the cap instead of dropping them silently", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
    useReplay({ faults: { openalex: { kind: "empty" }, semanticscholar: { kind: "empty" }, crossref: { kind: "empty" } } })
    const citations = Array.from({ length: 33 }, (_, i) => `AUTHOR, A. 2020. Unknown citation number ${i}. Journal of Nothing, 1(1), pp. 1–2.`)
    const audit = await flushed(connector.auditThesisCitations(citations, 4))
    expect(audit.total).toBe(30)
    expect(audit.skipped).toBe(3)
  })
})
