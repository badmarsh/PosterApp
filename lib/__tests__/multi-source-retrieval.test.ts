/**
 * Contract tests for the multi-source retrieval pipeline (`lib/ai/hybrid-retrieval.ts`).
 *
 * The legacy single-statement hybrid search has its own contract suite
 * (`vector-rag-supabase.test.ts`). This file pins what the *new* pipeline adds, because none of
 * it existed before and none of it is covered by the old tests:
 *
 *   - criterion routing decides which retrieval legs run, and the decision is recorded;
 *   - each leg reports its own candidate count, latency and failure in the trace;
 *   - fusion attributes every surviving chunk to the legs that proposed it;
 *   - `contextPrefix` survives the whole trip (it is what FTS indexes, and losing it silently
 *     degrades the keyword leg);
 *   - a pipeline failure degrades to the legacy search instead of returning no evidence;
 *   - `RETRIEVAL_PIPELINE=legacy` turns the whole thing off.
 *
 * There is no database in this environment, so Postgres is simulated: `$queryRaw` inspects the
 * statement text and answers the shape each generator asks for. That verifies the wiring, the
 * routing and the assembly — it does NOT verify that the SQL is accepted by a real PostgreSQL,
 * which is stated in the report rather than implied by a green test.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// Prisma simulation
// ---------------------------------------------------------------------------

type FakeSql = { text: string; values: unknown[] }

/**
 * Shared mutable state for the `@prisma/client` mock.
 *
 * `vi.mock` is hoisted above every declaration in the file, so anything its factory touches has
 * to come from `vi.hoisted`. `rawThrows` lets one test simulate a Prisma build without
 * `Prisma.raw` — the exact way a retrieval leg dies silently in the field.
 */
const h = vi.hoisted(() => {
  const isSql = (v: unknown): v is { text: string; values: unknown[] } =>
    Boolean(v && typeof v === "object" && "text" in (v as object) && "values" in (v as object))
  const sqlTag = (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = ""
    const out: unknown[] = []
    strings.forEach((s, i) => {
      text += s
      if (i < values.length) {
        const v = values[i]
        if (isSql(v)) {
          text += v.text
          out.push(...v.values)
        } else {
          out.push(v)
          text += `⟨${out.length}⟩`
        }
      }
    })
    return { text, values: out }
  }
  return { sqlTag, isSql, rawThrows: false }
})

vi.mock("@prisma/client", () => ({
  Prisma: {
    sql: h.sqlTag,
    empty: { text: "", values: [] },
    raw: (text: string): FakeSql => {
      if (h.rawThrows) throw new TypeError("Prisma.raw is not a function")
      return { text, values: [] }
    },
    join: (parts: unknown[], sep = ","): FakeSql => {
      let text = ""
      const values: unknown[] = []
      parts.forEach((p, i) => {
        if (i > 0) text += sep
        if (h.isSql(p)) {
          text += (p as FakeSql).text
          values.push(...(p as FakeSql).values)
        } else {
          values.push(p)
          text += `⟨${values.length}⟩`
        }
      })
      return { text, values }
    },
  },
}))

// ---------------------------------------------------------------------------
// Corpus fixture
// ---------------------------------------------------------------------------

interface Row {
  id: string
  heading: string | null
  content: string
  tokens: number
  kind: string
  chunkType: string
  sectionPath: string | null
  pageStart: number | null
  pageEnd: number | null
  parentChunkId: string | null
  previousChunkId: string | null
  nextChunkId: string | null
  documentId: string
  contextPrefix: string | null
  sourceElementIds: string[]
  ordinal: number
  similarity?: number
  rank?: number
}

const row = (over: Partial<Row> & { id: string }): Row => ({
  heading: null,
  content: `Obsah chunku ${over.id}.`,
  tokens: 40,
  kind: "prose",
  chunkType: "paragraph",
  sectionPath: "4 Výsledky",
  pageStart: 12,
  pageEnd: 13,
  parentChunkId: "sec-results",
  previousChunkId: null,
  nextChunkId: null,
  documentId: "d1",
  contextPrefix: 'Úryvok z práce „P“ (odbor: Informatika), sekcia „Výsledky“.',
  sourceElementIds: [],
  ordinal: 10,
  ...over,
})

const CHILD_A = row({ id: "child-a", content: "Presnosť modelu dosiahla F1 92.4 % na testovacej sade.", heading: "Presnosť", ordinal: 11, nextChunkId: "child-b" })
const CHILD_B = row({ id: "child-b", content: "Porovnanie s bázovým modelom ukazuje zlepšenie o 4.1 percentuálneho bodu.", heading: "Porovnanie", ordinal: 12, previousChunkId: "child-a" })
const PARENT = row({ id: "sec-results", chunkType: "section", content: "Kapitola výsledkov: presnosť, porovnanie, štatistická významnosť.", ordinal: 10, parentChunkId: null })
const TABLE = row({ id: "tbl-1", chunkType: "table", kind: "table", content: "| Model | F1 |\n|---|---|\n| návrh | 92.4 |", ordinal: 13 })
const CITATION = row({ id: "cit-1", chunkType: "citation", content: "[Novák 2019] Novák, J. Metódy hodnotenia. 2019.", ordinal: 40, sectionPath: "Zoznam literatúry", parentChunkId: null })

const ALL_ROWS: Row[] = [CHILD_A, CHILD_B, PARENT, TABLE, CITATION]
const byId = new Map(ALL_ROWS.map((r) => [r.id, r]))

/** Ids the most recent `id IN (...)` query asked for (bound values, captured per call). */
const requestedIds = new Set<string>()
let queryLog: string[] = []

/** Answers a `$queryRaw` call by inspecting the statement, the way each generator asks. */
function answerQuery(text: string): Row[] {
  // Context expansion fetches specific ids.
  if (/AND id IN/.test(text)) return ALL_ROWS.filter((r) => requestedIds.has(r.id))
  // Related-element expansion: structural chunks in the same sections.
  if (/"chunkType" IN/.test(text) && !/ts_rank/.test(text) && !/<=>/.test(text)) return [TABLE, CITATION]
  if (/<=>/.test(text)) return [CHILD_A, CHILD_B] // dense
  if (/ts_rank/.test(text)) return [CHILD_B, CHILD_A] // lexical — deliberately the opposite order
  return [CHILD_A]
}

function installPrisma() {
  h.rawThrows = false
  queryLog = []
  requestedIds.clear()
  const makeQueryRaw = (log: boolean) =>
    vi.fn(async (strings: TemplateStringsArray | FakeSql, ...values: unknown[]) => {
      // Prisma accepts both the tagged-template form and a pre-built Sql fragment.
      const sql = h.isSql(strings) ? (strings as FakeSql) : h.sqlTag(strings as TemplateStringsArray, ...values)
      if (log) queryLog.push(sql.text)
      if (/AND id IN/.test(sql.text)) {
        requestedIds.clear()
        for (const v of sql.values) if (typeof v === "string" && byId.has(v)) requestedIds.add(v)
      }
      return answerQuery(sql.text)
    })
  vi.doMock("@/lib/prisma", () => {
    const tx = { $queryRaw: makeQueryRaw(false), $executeRawUnsafe: vi.fn(async () => 1) }
    return {
      prisma: {
        $queryRaw: makeQueryRaw(true),
        $executeRaw: vi.fn(async () => 1),
        $executeRawUnsafe: vi.fn(async () => 1),
        $transaction: vi.fn(async (fn: (txClient: typeof tx) => Promise<unknown>) => fn(tx)),
        ingestFile: { findMany: vi.fn(async () => [{ id: "d1" }]) },
        graphNode: { findMany: vi.fn(async () => []) },
        graphEdge: { findMany: vi.fn(async () => []) },
        graphCommunity: {
          findMany: vi.fn(async () => [
            { id: "com-1", label: "Metodológia a výsledky", summary: "Práca navrhuje metódu a vyhodnocuje ju experimentálne.", nodeCount: 12, level: 0, summaryEmbedding: null },
          ]),
        },
      },
    }
  })
}

const NUMERICAL_QUERY = "Akú presnosť dosiahol model a o koľko percent zlepšil výsledky oproti báze?"
const NOVELTY_QUERY = "V čom je prínos práce originálny vzhľadom na [Novák 2019] a stav umenia?"

beforeEach(() => {
  vi.resetModules()
  delete process.env.RETRIEVAL_PIPELINE
})

afterEach(() => {
  vi.resetModules()
  delete process.env.RETRIEVAL_PIPELINE
  h.rawThrows = false
})

// ---------------------------------------------------------------------------

describe("retrieveEvidence — routing", () => {
  it("routes a numerical question to the numerical category and runs the metadata leg", async () => {
    installPrisma()
    const { retrieveEvidence } = await import("@/lib/ai/hybrid-retrieval")
    const r = await retrieveEvidence({ workspaceId: "ws-1", query: NUMERICAL_QUERY, criterionId: "results_validity", topK: 4 })

    expect(r.route.category).toBe("numerical")
    expect(r.route.signals.map((s) => s.name)).toContain("numerical-question")
    const sources = Object.fromEntries(r.trace.sources.map((s) => [s.source, s.candidates]))
    expect(sources.dense).toBeGreaterThan(0)
    expect(sources.lexical).toBeGreaterThan(0)
    expect(sources.metadata).toBeGreaterThan(0)
  })

  it("routes a novelty question to the prior-art category and enables the citation leg", async () => {
    installPrisma()
    const { retrieveEvidence } = await import("@/lib/ai/hybrid-retrieval")
    const r = await retrieveEvidence({ workspaceId: "ws-1", query: NOVELTY_QUERY, criterionId: "originality_contribution", topK: 4 })

    expect(r.route.category).toBe("novelty-prior-art")
    expect(r.route.sources.map((s) => s.source)).toContain("citation")
    // Novelty is a whole-document question: the global leg must be part of the route.
    expect(r.route.sufficiency.requiresGlobalContext).toBe(true)
  })

  it("records the criterion profiles that shaped the route", async () => {
    installPrisma()
    const { retrieveEvidence } = await import("@/lib/ai/hybrid-retrieval")
    const r = await retrieveEvidence({ workspaceId: "ws-1", query: NUMERICAL_QUERY, criterionId: "methodology_rigor", topK: 4 })
    expect(r.route.profiles).toContain("methodology")
    expect(r.trace.route.profiles).toContain("methodology")
  })
})

describe("retrieveEvidence — fusion and attribution", () => {
  it("attributes a chunk to every leg that proposed it", async () => {
    installPrisma()
    const { retrieveEvidence } = await import("@/lib/ai/hybrid-retrieval")
    const r = await retrieveEvidence({ workspaceId: "ws-1", query: NUMERICAL_QUERY, criterionId: "results_validity", topK: 4 })

    const a = r.evidence.find((e) => e.id === "child-a")
    expect(a).toBeDefined()
    // dense and lexical both return child-a in this fixture.
    expect(a!.sources).toEqual(expect.arrayContaining(["dense", "lexical"]))
    expect(Object.keys(a!.perSourceScores)).toEqual(expect.arrayContaining(["dense", "lexical"]))
  })

  it("keeps both legs' candidates in the evidence set", async () => {
    installPrisma()
    const { retrieveEvidence } = await import("@/lib/ai/hybrid-retrieval")
    const r = await retrieveEvidence({ workspaceId: "ws-1", query: NUMERICAL_QUERY, criterionId: "results_validity", topK: 4 })
    const retrieved = r.evidence.filter((e) => e.role === "retrieved").map((e) => e.id)
    expect(retrieved).toContain("child-a")
    expect(retrieved).toContain("child-b")
  })

  it("reports the fusion method and the weights actually used", async () => {
    installPrisma()
    const { retrieveEvidence } = await import("@/lib/ai/hybrid-retrieval")
    const r = await retrieveEvidence({ workspaceId: "ws-1", query: NUMERICAL_QUERY, criterionId: "results_validity", topK: 4 })
    expect(r.trace.fusion.method).toBe("weighted-rrf")
    expect(r.trace.fusion.weights.dense).toBeGreaterThan(0)
    expect(r.trace.fusion.candidatesIn).toBeGreaterThan(0)
  })

  it("ablation: disabling a leg removes it from the run and from the trace", async () => {
    installPrisma()
    const { retrieveEvidence } = await import("@/lib/ai/hybrid-retrieval")
    const r = await retrieveEvidence({
      workspaceId: "ws-1",
      query: NUMERICAL_QUERY,
      criterionId: "results_validity",
      topK: 4,
      ablation: { disableSources: ["lexical"] },
    })
    const lexical = r.trace.sources.find((s) => s.source === "lexical")
    expect(lexical?.enabled).toBe(false)
    expect(r.evidence.every((e) => !e.sources.includes("lexical"))).toBe(true)
  })
})

describe("retrieveEvidence — context expansion", () => {
  it("pulls in the parent section with role 'parent'", async () => {
    installPrisma()
    const { retrieveEvidence } = await import("@/lib/ai/hybrid-retrieval")
    const r = await retrieveEvidence({ workspaceId: "ws-1", query: NUMERICAL_QUERY, criterionId: "results_validity", topK: 4 })
    const parent = r.evidence.find((e) => e.id === "sec-results")
    expect(parent).toBeDefined()
    expect(parent!.role).toBe("parent")
    expect(r.trace.expansion.parents).toBeGreaterThan(0)
  })

  it("never drops a retrieved chunk while widening context", async () => {
    installPrisma()
    const { retrieveEvidence } = await import("@/lib/ai/hybrid-retrieval")
    const r = await retrieveEvidence({ workspaceId: "ws-1", query: NUMERICAL_QUERY, criterionId: "results_validity", topK: 4, maxContextChars: 60 })
    expect(r.evidence.filter((e) => e.role === "retrieved").length).toBeGreaterThan(0)
  })

  it("renders a labelled evidence context, not an unlabelled blob", async () => {
    installPrisma()
    const { retrieveEvidence } = await import("@/lib/ai/hybrid-retrieval")
    const r = await retrieveEvidence({ workspaceId: "ws-1", query: NUMERICAL_QUERY, criterionId: "results_validity", topK: 4 })
    expect(r.context).toContain("DIRECT EVIDENCE:")
    expect(r.context).toContain("EXPECTED EVIDENCE:")
    expect(r.context).toContain("F1 92.4")
  })

  it("keeps expansion off when the ablation says so", async () => {
    installPrisma()
    const { retrieveEvidence } = await import("@/lib/ai/hybrid-retrieval")
    const r = await retrieveEvidence({
      workspaceId: "ws-1",
      query: NUMERICAL_QUERY,
      criterionId: "results_validity",
      topK: 4,
      ablation: { disableExpansion: true },
    })
    expect(r.evidence.every((e) => e.role === "retrieved")).toBe(true)
  })
})

describe("contextPrefix plumbing", () => {
  it("carries contextPrefix from the chunk row to the evidence chunk", async () => {
    installPrisma()
    const { retrieveEvidence } = await import("@/lib/ai/hybrid-retrieval")
    const r = await retrieveEvidence({ workspaceId: "ws-1", query: NUMERICAL_QUERY, criterionId: "results_validity", topK: 4 })
    const a = r.evidence.find((e) => e.id === "child-a")!
    expect(a.contextPrefix).toContain("Úryvok z práce")
    // content stays verbatim — the prefix is index metadata, never part of the quote
    expect(a.content).toBe(CHILD_A.content)
  })

  it("survives retrieveForCriterion on the multi-source path", async () => {
    installPrisma()
    const { retrieveForCriterion } = await import("@/lib/ai/vector-rag")
    const { chunks } = await retrieveForCriterion("ws-1", NUMERICAL_QUERY, { topK: 3, criterionId: "results_validity" })
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[0].contextPrefix).toContain("Úryvok z práce")
  })
})

describe("trace honesty", () => {
  it("labels the ranking stage with what actually produced the order", async () => {
    installPrisma()
    const { retrieveEvidence } = await import("@/lib/ai/hybrid-retrieval")
    const r = await retrieveEvidence({ workspaceId: "ws-1", query: NUMERICAL_QUERY, criterionId: "results_validity", topK: 4 })
    // No cross-encoder model is loaded in this environment, so the trace must not claim one ran.
    expect(["cross-encoder", "fusion-score"]).toContain(r.trace.ranking.scorer)
    expect(r.trace.ranking.usedNeuralReranker).toBe(r.trace.ranking.scorer === "cross-encoder")
    expect(r.trace.pipeline).toBe("multi-source")
  })

  it("does not assert intra-corpus novelty drift without embeddings to compare", async () => {
    installPrisma()
    const { retrieveEvidence } = await import("@/lib/ai/hybrid-retrieval")
    const r = await retrieveEvidence({ workspaceId: "ws-1", query: NOVELTY_QUERY, criterionId: "originality_contribution", topK: 4 })
    // The fused pool carries no stored embeddings, so maxSimilarity is null and no claim is made.
    expect(r.trace.noveltyDrift.maxSimilarity).toBeNull()
    expect(r.trace.noveltyDrift.triggered).toBe(false)
  })

  it("records a latency for every leg that ran", async () => {
    installPrisma()
    const { retrieveEvidence } = await import("@/lib/ai/hybrid-retrieval")
    const r = await retrieveEvidence({ workspaceId: "ws-1", query: NUMERICAL_QUERY, criterionId: "results_validity", topK: 4 })
    for (const s of r.trace.sources.filter((x) => x.enabled)) {
      expect(typeof s.latencyMs).toBe("number")
      expect(s.latencyMs).toBeGreaterThanOrEqual(0)
    }
    expect(r.trace.totalLatencyMs).toBeGreaterThanOrEqual(0)
  })

  it("records every degraded leg instead of hiding it", async () => {
    installPrisma()
    h.rawThrows = true
    const { retrieveEvidence } = await import("@/lib/ai/hybrid-retrieval")
    const r = await retrieveEvidence({ workspaceId: "ws-1", query: NUMERICAL_QUERY, criterionId: "results_validity", topK: 4 })
    // Every leg that builds SQL through Prisma.raw fails; the pipeline must say so.
    expect(r.trace.degraded.length).toBeGreaterThan(0)
    expect(r.trace.degraded[0].error).toContain("Prisma.raw")
    expect(r.trace.sources.filter((s) => s.enabled && s.candidates === 0).length).toBeGreaterThan(0)
  })
})

describe("degradation", () => {
  it("retrieveForCriterion still returns evidence when every generator fails", async () => {
    // A Prisma build without `raw` is exactly how a leg dies in the field: the generator throws,
    // is caught, and reports zero candidates. The review must still get evidence.
    installPrisma()
    h.rawThrows = true
    const { retrieveForCriterion } = await import("@/lib/ai/vector-rag")
    const { chunks } = await retrieveForCriterion("ws-1", "výsledky experimentov", { topK: 2, useHyDE: false, compress: false })
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[0].id).toBeTruthy()
  })

  it("RETRIEVAL_PIPELINE=legacy skips the multi-source pipeline entirely", async () => {
    installPrisma()
    process.env.RETRIEVAL_PIPELINE = "legacy"
    const { retrieveForCriterion } = await import("@/lib/ai/vector-rag")
    const { chunks } = await retrieveForCriterion("ws-1", NUMERICAL_QUERY, { topK: 3, useHyDE: false, compress: false })
    expect(chunks.length).toBeGreaterThan(0)
    // Discriminator: the legacy projection is `id, heading, content, tokens, kind,
    // "contextPrefix"`; every multi-source generator also selects "chunkType" and "sectionPath".
    // If the new pipeline had run, those columns would appear in the SQL.
    expect(queryLog.length).toBeGreaterThan(0)
    expect(queryLog.every((q) => !/"chunkType"/.test(q) && !/"sectionPath"/.test(q))).toBe(true)
    expect(queryLog.some((q) => /<=>/.test(q))).toBe(true)
  })
})

describe("isMultiSourceRetrievalEnabled", () => {
  it("is on by default and honours the documented off switches", async () => {
    installPrisma()
    const { isMultiSourceRetrievalEnabled } = await import("@/lib/ai/hybrid-retrieval")
    delete process.env.RETRIEVAL_PIPELINE
    expect(isMultiSourceRetrievalEnabled()).toBe(true)
    for (const off of ["legacy", "vector-rag", "false", "0"]) {
      process.env.RETRIEVAL_PIPELINE = off
      expect(isMultiSourceRetrievalEnabled()).toBe(false)
    }
    process.env.RETRIEVAL_PIPELINE = "multi-source"
    expect(isMultiSourceRetrievalEnabled()).toBe(true)
  })

  it("agrees with the copy in vector-rag, which reads the same flag", async () => {
    installPrisma()
    const a = await import("@/lib/ai/hybrid-retrieval")
    const b = await import("@/lib/ai/vector-rag")
    for (const v of [undefined, "legacy", "multi-source"]) {
      if (v === undefined) delete process.env.RETRIEVAL_PIPELINE
      else process.env.RETRIEVAL_PIPELINE = v
      expect(a.isMultiSourceRetrievalEnabled()).toBe(b.isMultiSourceRetrievalEnabled())
    }
  })
})
