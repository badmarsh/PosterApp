/**
 * Academic Connector benchmark — golden set replayed through the real pipeline.
 *
 * Default (offline, `recorded` mode): the fixture-replay `fetch` serves bodies captured
 * from OpenAlex / Crossref / Semantic Scholar / arXiv (see `__fixtures__/academic/recorded.json`).
 * Fake timers flush the connector's retry back-offs so the whole run stays well under 10 s.
 *
 * Opt-in live mode: `ACADEMIC_LIVE=1 pnpm exec vitest run lib/services/__tests__/academic-retrieval-benchmark.test.ts`
 * uses the real network (requires egress; Tavily stays disabled unless TAVILY_API_KEY is set).
 *
 * Artifacts: `ACADEMIC_WRITE_ARTIFACTS=<name>` writes the full report to
 * `artifacts/academic-retrieval-audit-<date>/<name>.json` (used for the before/after comparison).
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import fs from "node:fs"
import path from "node:path"
import * as connector from "@/lib/services/academic-connector"
import {
  ACADEMIC_GOLDEN_SET,
  runGoldenSet,
  type GoldenRunReport,
  type GoldenSearchCase,
  type SearchOutcome,
} from "@/lib/services/academic-retrieval-eval"
import { installReplayFetch } from "./academic-replay-fetch"

const LIVE = process.env.ACADEMIC_LIVE === "1"
const ARTIFACT_NAME = process.env.ACADEMIC_WRITE_ARTIFACTS
const ARTIFACT_DIR = path.resolve(__dirname, "../../../artifacts/academic-retrieval-audit-2026-09-27")

type DetailedSearch = (
  query: string,
  limit?: number,
  options?: connector.AcademicSearchOptions
) => Promise<{ results: connector.AcademicPaperResult[]; mode: "doi" | "arxiv" | "search"; providers: SearchOutcome["providers"] }>

/** Works against both the baseline connector (no diagnostics) and the optimized one. */
async function runSearch(c: GoldenSearchCase): Promise<SearchOutcome> {
  const detailed = (connector as unknown as Record<string, unknown>).searchAcademicPaperDetailed as DetailedSearch | undefined
  const started = Date.now()
  if (typeof detailed === "function") {
    const r = await detailed(c.query, c.limit ?? 8, { yearFrom: c.yearFrom })
    return { results: r.results, mode: r.mode, providers: r.providers, elapsedMs: Date.now() - started }
  }
  const results = await connector.searchAcademicPaper(c.query, c.limit ?? 8, { yearFrom: c.yearFrom })
  return { results, elapsedMs: Date.now() - started }
}

/** Drive an async flow to completion while flushing fake timers (retry back-offs). */
async function withFlushedTimers<T>(p: Promise<T>): Promise<T> {
  let settled = false
  p.then(
    () => (settled = true),
    () => (settled = true)
  )
  while (!settled) {
    await vi.advanceTimersByTimeAsync(1000)
  }
  return p
}

describe(`academic retrieval benchmark (${LIVE ? "live" : "recorded"} mode)`, () => {
  let replay: ReturnType<typeof installReplayFetch> | null = null
  let report: GoldenRunReport

  beforeAll(async () => {
    delete process.env.TAVILY_API_KEY
    if (!LIVE) {
      replay = installReplayFetch()
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] })
    }
    const run = runGoldenSet(LIVE ? "live" : "recorded", {
      search: runSearch,
      verify: (c) => connector.verifySingleCitation(c.citedText),
    })
    report = LIVE ? await run : await withFlushedTimers(run)
    if (ARTIFACT_NAME) {
      fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
      const file = path.join(ARTIFACT_DIR, `${ARTIFACT_NAME}.json`)
      fs.writeFileSync(
        file,
        JSON.stringify(
          {
            ...report,
            replayCalls: replay ? replay.calls.map((c) => ({ provider: c.provider, kind: c.kind, routedTo: c.routedTo, status: c.status, simulatedYearFilter: c.simulatedYearFilter, url: c.url })) : undefined,
          },
          null,
          2
        )
      )
      // eslint-disable-next-line no-console
      console.log(`[academic-benchmark] wrote ${file}`)
    }
    // eslint-disable-next-line no-console
    console.log(
      `[academic-benchmark] P@1=${report.aggregate.meanPrecisionAt1.toFixed(2)} MRR=${report.aggregate.meanReciprocalRank.toFixed(2)} nDCG@5=${report.aggregate.meanNdcgAt5.toFixed(3)} dups=${report.aggregate.totalDuplicateRows} yearLeaks=${report.aggregate.yearLeaks} verified=${(report.aggregate.verifiedRate * 100).toFixed(0)}% unavailable=${report.aggregate.unavailable} violations=${report.aggregate.violations}`
    )
  }, 120_000)

  afterAll(() => {
    vi.useRealTimers()
    replay?.restore()
  })

  it("runs every golden case", () => {
    expect(report.searches.length).toBe(ACADEMIC_GOLDEN_SET.filter((c) => c.kind === "search").length)
    expect(report.citations.length).toBe(ACADEMIC_GOLDEN_SET.filter((c) => c.kind === "citation").length)
  })

  it("never calls Tavily without an API key", () => {
    if (!replay) return
    expect(replay.calls.filter((c) => c.provider === "tavily")).toHaveLength(0)
  })

  it("puts a target paper at rank 1 for every search case", () => {
    const misses = report.searches.filter((s) => s.precisionAt1 < 1).map((s) => `${s.id}: ${s.top[0]?.title ?? "(no results)"}`)
    expect(misses).toEqual([])
  })

  it("returns at least the minimum number of results for every case", () => {
    const short = report.searches.filter((s) => s.violations.some((v) => v.startsWith("expected ≥")))
    expect(short.map((s) => `${s.id}: ${s.violations.join("; ")}`)).toEqual([])
  })

  it("returns no duplicate rows (same DOI / arXiv id / title)", () => {
    const dups = report.searches.filter((s) => s.duplicateRows > 0).map((s) => `${s.id}: ${s.violations.filter((v) => v.includes("duplicate")).join("; ")}`)
    expect(dups).toEqual([])
  })

  it("honours the year window across all providers", () => {
    expect(report.aggregate.yearLeaks).toBe(0)
  })

  it("keeps the retraction flag on the rank-1 result of the retracted-paper case", () => {
    const g8 = report.searches.find((s) => s.id === "G8")!
    expect(g8.retractedTop).toBe(true)
  })

  it("verifies real citations and classifies fabricated ones as not_found", () => {
    const failures = report.citations.filter((c) => !c.pass).map((c) => `${c.id}: ${c.issues.join("; ")}`)
    expect(failures).toEqual([])
  })

  it("reports mode + provider diagnostics for every search run", () => {
    const missingMode = report.searches.filter((s) => !s.mode).map((s) => s.id)
    expect(missingMode).toEqual([])
    const searchCases = ACADEMIC_GOLDEN_SET.filter((c): c is GoldenSearchCase => c.kind === "search" && c.expectedMode === "search").map((c) => c.id)
    const missing = report.searches.filter((s) => searchCases.includes(s.id) && !s.providers).map((s) => s.id)
    expect(missing).toEqual([])
  })
})
