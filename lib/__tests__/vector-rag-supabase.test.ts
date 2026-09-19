/**
 * Supabase / PgBouncer transaction-pooler query simulation (Objective A).
 *
 * These tests emulate the constraints of Supabase's transaction pooler
 * (port 6543):
 *  - `SET LOCAL` is only legal INSIDE a transaction block (SQLSTATE 25001
 *    otherwise) — the tests assert retrieveSingleQuery executes every GUC SET
 *    through `prisma.$transaction`, never on the bare client.
 *  - If the pooled transaction fails (pool timeout, connection recycle), the
 *    pipeline must degrade to a plain query, not fail the request.
 *  - Multi-tenant HNSW pruning → adaptive exact-scan recall fallback.
 *  - All SQL fragments are built with Prisma.sql / Prisma.join (injection-safe)
 *    and remain index-eligible.
 *
 * Prisma is mocked with a lightweight Sql builder whose `.text` mirrors real
 * Prisma semantics (string concatenation with placeholder markers), so the
 * exact statements sent to PostgreSQL can be asserted.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// A Prisma.Sql stand-in with .text/.values, sufficient for SQL-text assertions.
// Nested Sql fragments inline their text and flatten their values — matching
// real Prisma template semantics.
type FakeSql = { text: string; values: unknown[] }
const isSql = (v: unknown): v is FakeSql => Boolean(v && typeof v === "object" && "text" in (v as object) && "values" in (v as object))
const asSql = (v: unknown): FakeSql =>
  typeof v === "string" ? { text: v, values: [] } : (v as FakeSql)
const sqlTag = (strings: TemplateStringsArray, ...values: unknown[]): FakeSql => {
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

vi.mock("@prisma/client", () => ({
  Prisma: {
    sql: sqlTag,
    empty: { text: "", values: [] },
    // Prisma.raw inlines a trusted literal fragment without adding a bound parameter.
    raw: (text: string): FakeSql => ({ text, values: [] }),
    // Prisma.join treats raw entries as bound parameters and inlines Sql fragments,
    // renumbering their placeholders after the values collected so far.
    join: (parts: unknown[], sep = ","): FakeSql => {
      let text = ""
      const values: unknown[] = []
      parts.forEach((p, i) => {
        if (i > 0) text += sep
        if (isSql(p)) {
          const offset = values.length
          text += p.text.replace(/⟨(\d+)⟩/g, (_m, n: string) => `⟨${offset + Number(n)}⟩`)
          values.push(...p.values)
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
// efSearchFor + retrievalJoin (pure helpers)
// ---------------------------------------------------------------------------

describe("efSearchFor — HNSW ef_search scaling", () => {
  it("scales with the requested limit (×20)", async () => {
    const { efSearchFor } = await import("@/lib/ai/vector-rag")
    expect(efSearchFor(10)).toBe(200)
    expect(efSearchFor(50)).toBe(1000)
  })

  it("clamps to the [100, 1000] bounds", async () => {
    const { efSearchFor } = await import("@/lib/ai/vector-rag")
    expect(efSearchFor(1)).toBe(100)
    expect(efSearchFor(500)).toBe(1000)
  })

  // Regression guard for the measured defect: the previous ×8 / floor-40 formula asked for
  // ef_search=80 at topK=10, which measured recall@10 = 0.933 against brute-force ground truth
  // on PostgreSQL 18 + pgvector 0.8.1 (artifacts/eval/pgvector-live.json) — below the 0.95 the
  // retrieval contract claims. ef_search=200 measured 1.000 on the same corpus.
  it("never asks for an ef_search that measured below the 0.95 recall bar", async () => {
    const { efSearchFor } = await import("@/lib/ai/vector-rag")
    for (const limit of [1, 2, 5, 10, 20, 50, 100, 500, 1000]) {
      expect(efSearchFor(limit), `limit=${limit}`).toBeGreaterThanOrEqual(100)
    }
  })
})

describe("retrievalJoin — parameterized isolation fragments", () => {
  it("returns empty fragment without filters", async () => {
    const { retrievalJoin } = await import("@/lib/ai/vector-rag")
    expect(retrievalJoin({}).text).toBe("")
    expect(retrievalJoin().text).toBe("")
  })

  it("builds documentId equality with a bound parameter", async () => {
    const { retrievalJoin } = await import("@/lib/ai/vector-rag")
    const f = retrievalJoin({ documentId: "doc-1" })
    expect(f.text).toBe(`AND "documentId" = ⟨1⟩`)
    expect(f.values).toEqual(["doc-1"])
  })

  it("builds documentIds IN-list with bound parameters", async () => {
    const { retrievalJoin } = await import("@/lib/ai/vector-rag")
    const f = retrievalJoin({ documentIds: ["doc-1", "doc-2"] })
    expect(f.text).toBe(`AND "documentId" IN (⟨1⟩,⟨2⟩)`)
    expect(f.values).toEqual(["doc-1", "doc-2"])
  })

  it("compiles an explicitly empty documentIds array to AND 1 = 0 (never drops isolation)", async () => {
    const { retrievalJoin } = await import("@/lib/ai/vector-rag")
    expect(retrievalJoin({ documentIds: [] }).text).toBe("AND 1 = 0")
  })

  it("adds a kind IN filter for table/equation retrieval (Objective E)", async () => {
    const { retrievalJoin } = await import("@/lib/ai/vector-rag")
    const f = retrievalJoin({ kinds: ["table", "equation"] })
    expect(f.text).toBe("AND kind IN (⟨1⟩,⟨2⟩)")
    expect(f.values).toEqual(["table", "equation"])
  })

  it("combines document and kind filters with AND", async () => {
    const { retrievalJoin } = await import("@/lib/ai/vector-rag")
    const f = retrievalJoin({ documentId: "doc-9", kinds: ["table"] })
    expect(f.text).toBe(`AND "documentId" = ⟨1⟩ AND kind IN (⟨2⟩)`)
    expect(f.values).toEqual(["doc-9", "table"])
  })
})

// ---------------------------------------------------------------------------
// retrieveSingleQuery (via searchHybrid) — PgBouncer transaction semantics
// ---------------------------------------------------------------------------

interface Harness {
  capturedTx: {
    executeRawUnsafe: string[]
    queryRawSql: string[]
  }
  capturedDirect: {
    queryRawSql: string[]
  }
  setRows: (rows: unknown[], exactScanRows?: unknown[]) => void
  mod: typeof import("@/lib/ai/vector-rag")
}

/**
 * Installs a prisma mock where $transaction receives a tx client that captures
 * every statement. $queryRaw on both clients records the SQL text; setRows
 * controls what the main hybrid query returns.
 */
async function importWithHarness(opts: {
  transactionBehavior?: "ok" | "throw"
  exactScanRows?: unknown[]
} = {}): Promise<Harness> {
  const capturedTx = { executeRawUnsafe: [] as string[], queryRawSql: [] as string[] }
  const capturedDirect = { queryRawSql: [] as string[] }
  let hybridRows: unknown[] = []
  let exactRows: unknown[] = []

  // $queryRaw accepts both the tagged-template form and a Prisma.Sql object
  // argument (used by the exact-scan fallback). Captured text is rebuilt with
  // the same Sql semantics (nested fragments inlined) for assertions.
  // The direct (non-tx) client serves both the degraded retry (template form →
  // hybrid rows) and the exact scan (Sql-object form → exact rows).
  const queryRawTag = (sink: string[], rowsFor: (isTemplate: boolean) => unknown[]) => (...args: unknown[]): unknown => {
    const first = args[0] as unknown
    const isTemplate = Array.isArray(first)
    if (isTemplate) sink.push(sqlTag(first as unknown as TemplateStringsArray, ...args.slice(1)).text)
    else sink.push(asSql(first).text)
    return rowsFor(isTemplate)
  }

  vi.doMock("@/lib/prisma", () => ({
    prisma: {
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        if (opts.transactionBehavior === "throw") throw new Error("P2024: Timed out fetching a new connection from the connection pool")
        const tx = {
          $executeRawUnsafe: vi.fn(async (statement: string) => {
            capturedTx.executeRawUnsafe.push(statement)
            return 0
          }),
          $queryRaw: queryRawTag(capturedTx.queryRawSql, () => hybridRows),
        }
        return fn(tx)
      }),
      $queryRaw: queryRawTag(capturedDirect.queryRawSql, (isTemplate) => (isTemplate ? hybridRows : exactRows)),
    },
  }))
  vi.doMock("@/lib/ai/local-embeddings", () => ({
    generateLocalEmbedding: vi.fn(async () => new Array(384).fill(0.05)),
  }))

  const mod = await import("@/lib/ai/vector-rag")
  return {
    capturedTx,
    capturedDirect,
    setRows: (rows: unknown[], exactScanRows: unknown[] = []) => {
      hybridRows = rows
      exactRows = exactScanRows
    },
    mod,
  }
}

const HYBRID_ROWS = [
  { id: "c1", heading: "Metodika", content: "popis metodiky", tokens: 3, kind: "prose", similarity: 0.02, contextPrefix: "Úryvok z práce „Diplomová práca“" },
]

describe("retrieveSingleQuery — SET LOCAL bound to the query transaction", () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.RAG_EXACT_FALLBACK = undefined
  })

  it("runs ef_search SET LOCAL + iterative-scan INSIDE $transaction (PgBouncer 6543 contract)", async () => {
    const h = await importWithHarness()
    h.setRows(HYBRID_ROWS)

    await h.mod.searchHybrid("ws-1", "metodika merania", 5, "STEM", undefined, { useHyDE: false })

    // Every GUC statement went through the transaction client…
    expect(h.capturedTx.executeRawUnsafe.length).toBeGreaterThanOrEqual(2)
    // …ef_search is transaction-scoped (SET LOCAL), scaled to the limit…
    expect(h.capturedTx.executeRawUnsafe[0]).toMatch(/^SET LOCAL hnsw\.ef_search = \d+$/)
    const ef = Number(h.capturedTx.executeRawUnsafe[0].replace(/\D+/g, ""))
    expect(ef).toBeGreaterThanOrEqual(40)
    expect(ef).toBeLessThanOrEqual(1000)
    // …and the pgvector <0.8 unknown-GUC risk is guarded by a DO block.
    expect(h.capturedTx.executeRawUnsafe[1]).toContain("hnsw.iterative_scan")
    expect(h.capturedTx.executeRawUnsafe[1]).toContain("EXCEPTION WHEN OTHERS")
  })

  it("falls back to a non-transactional query when the pooled transaction fails", async () => {
    const h = await importWithHarness({ transactionBehavior: "throw" })
    h.setRows(HYBRID_ROWS)

    const rows = await h.mod.searchHybrid("ws-1", "metodika", 5, "STEM", undefined, { useHyDE: false })

    // Request succeeded (degraded, no SET LOCAL), not failed.
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe("c1")
    expect(h.capturedDirect.queryRawSql.length).toBeGreaterThan(0)
    expect(h.capturedTx.queryRawSql).toHaveLength(0)
  })

  it("hybrid CTE selects contextPrefix and folds it into the FTS tsvector", async () => {
    const h = await importWithHarness()
    h.setRows(HYBRID_ROWS)

    await h.mod.searchHybrid("ws-1", "metodika", 5, "STEM", undefined, { useHyDE: false })

    const sql = h.capturedTx.queryRawSql.join(" ")
    expect(sql).toContain('d."contextPrefix"')
    expect(sql).toContain(`COALESCE("contextPrefix", '') || ' ' || content`)
    // Both isolation filters are workspace-scoped parameters…
    expect(sql).toContain(`"workspaceId" = ⟨`)
    // …and the embedding is cast, keeping the HNSW plan eligible.
    expect(sql).toContain(`embedding <=> ⟨1⟩::vector`)
  })

  it("threads kinds filter into the SQL for table/equation-scoped retrieval", async () => {
    const h = await importWithHarness()
    h.setRows([])

    await h.mod.searchHybrid("ws-1", "Aké boli p-hodnoty v experimente?", 5, "STEM", undefined, {
      useHyDE: false,
      kinds: ["table"],
    })

    const sql = h.capturedTx.queryRawSql.join(" ")
    expect(sql).toContain("AND kind IN (")
  })
})

// ---------------------------------------------------------------------------
// Adaptive exact-scan recall fallback (small-workspace HNSW pruning)
// ---------------------------------------------------------------------------

describe("retrieveSingleQuery — adaptive exact-scan fallback", () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.RAG_EXACT_FALLBACK = undefined
  })

  it("fills the deficit from an exact scan when hybrid returns fewer rows than requested", async () => {
    const h = await importWithHarness()
    // Hybrid leg: only 1 of 5 requested rows (HNSW pruned the small workspace).
    // Exact-scan leg returns a further nearest neighbour.
    h.setRows(
      [HYBRID_ROWS[0]],
      [{ id: "c2", heading: "Výsledky", content: "F1 92.4 %", tokens: 3, kind: "prose", similarity: 0.83, contextPrefix: null }]
    )

    const rows = await h.mod.searchHybrid("ws-small", "metodika", 5, "STEM", undefined, { useHyDE: false })

    // The direct (non-tx) client served the exact scan…
    expect(h.capturedDirect.queryRawSql.length).toBe(1)
    const exactSql = h.capturedDirect.queryRawSql[0]
    // …which is a non-indexed nearest-neighbour scan scoped by the same filters.
    expect(exactSql).toMatch(/1.0 - \(embedding <=> ⟨\d+⟩::vector\) AS similarity/)
    expect(exactSql).toMatch(/ORDER BY embedding <=> ⟨\d+⟩::vector/)
    expect(exactSql).toContain(`"workspaceId" = ⟨`)
    // …and the result pool was filled back up without duplicates.
    expect(rows.map((r) => r.id)).toEqual(["c1", "c2"])
  })

  it("does not run the fallback when the hybrid pool is already full", async () => {
    const h = await importWithHarness()
    const full = Array.from({ length: 5 }, (_, i) => ({
      id: `c${i}`, heading: null, content: `obsah ${i}`, tokens: 2, kind: "prose", similarity: 0.01, contextPrefix: null,
    }))
    h.setRows(full)

    await h.mod.searchHybrid("ws-full", "metodika", 5, "STEM", undefined, { useHyDE: false })
    expect(h.capturedDirect.queryRawSql).toHaveLength(0)
  })

  it("honours RAG_EXACT_FALLBACK=false", async () => {
    process.env.RAG_EXACT_FALLBACK = "false"
    const h = await importWithHarness()
    h.setRows([HYBRID_ROWS[0]])

    await h.mod.searchHybrid("ws-small", "metodika", 5, "STEM", undefined, { useHyDE: false })
    expect(h.capturedDirect.queryRawSql).toHaveLength(0)
    process.env.RAG_EXACT_FALLBACK = undefined
  })

  it("never runs the fallback for an explicitly empty documentIds filter", async () => {
    const h = await importWithHarness()
    h.setRows([])

    await h.mod.searchHybrid("ws-1", "metodika", 5, "STEM", undefined, { useHyDE: false, documentIds: [] })
    expect(h.capturedDirect.queryRawSql).toHaveLength(0)
    // AND 1 = 0 — isolation holds even with no documents selected.
    expect(h.capturedTx.queryRawSql.join(" ")).toContain("AND 1 = 0")
  })
})

// ---------------------------------------------------------------------------
// contextPrefix plumb-through
// ---------------------------------------------------------------------------

describe("contextPrefix plumb-through", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("fetchChunksByIds selects contextPrefix", async () => {
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        documentChunk: {
          findMany: vi.fn(async (args: { select: Record<string, boolean> }) => {
            expect(args.select.contextPrefix).toBe(true)
            return [{ id: "c1", heading: "h", content: "c", tokens: 1, kind: "prose", documentId: "d1", contextPrefix: "Úryvok" }]
          }),
        },
      },
    }))
    const { fetchChunksByIds } = await import("@/lib/ai/vector-rag")
    const chunks = await fetchChunksByIds("ws-1", ["c1"])
    expect(chunks[0].contextPrefix).toBe("Úryvok")
  })

  it("retrieveForCriterion passes contextPrefix through to its output chunks", async () => {
    // This pins the *legacy* single-statement pipeline. The multi-source pipeline
    // (hybrid-retrieval.ts) has its own contract test in multi-source-retrieval.test.ts.
    const prevPipeline = process.env.RETRIEVAL_PIPELINE
    process.env.RETRIEVAL_PIPELINE = "legacy"
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        $queryRaw: vi.fn(async () => [
          { id: "c1", heading: "Výsledky", content: "F1 92.4%", tokens: 3, kind: "prose", similarity: 0.9, contextPrefix: "Úryvok z práce „P“ (odbor: Informatika), sekcia „Výsledky“." },
        ]),
      },
    }))
    vi.doMock("@/lib/ai/local-embeddings", () => ({
      generateLocalEmbedding: vi.fn(async () => new Array(384).fill(0.1)),
    }))
    vi.doMock("@/lib/ai/local-reranker", () => ({
      crossEncoderScores: vi.fn(async () => null),
    }))

    const { retrieveForCriterion } = await import("@/lib/ai/vector-rag")
    try {
      const { chunks } = await retrieveForCriterion("ws-1", "výsledky experimentov", { topK: 2, useHyDE: false, compress: false })
      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0].contextPrefix).toContain("Úryvok z práce")
      // content stays verbatim (no prefix leakage)
      expect(chunks[0].content).toBe("F1 92.4%")
    } finally {
      if (prevPipeline === undefined) delete process.env.RETRIEVAL_PIPELINE
      else process.env.RETRIEVAL_PIPELINE = prevPipeline
    }
  })
})
