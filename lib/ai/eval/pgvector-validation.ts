/**
 * Live PostgreSQL + pgvector validation.
 *
 * Every other test in this repository asserts on SQL *text*. That proves routing, fusion and
 * attribution; it proves nothing about whether the statements execute, whether the HNSW index is
 * used, whether `iterative_scan` exists on the target pgvector, or whether filtered approximate
 * search actually returns the nearest neighbours. This module closes that gap by running the
 * production retrieval statements against a real server.
 *
 * What "real" means here is stated explicitly in the result (`environment.flavor`):
 *   * `postgres` — a networked PostgreSQL (the project's `pgvector/pgvector:pg16` container).
 *   * `pglite`   — PostgreSQL compiled to WebAssembly with the real pgvector C extension. Same
 *                  executor, same index AM, same operators; **not** representative of throughput
 *                  at scale or of PgBouncer transaction pooling, and the result says so.
 *
 * Nothing here is a re-implementation: the statements under test are the ones
 * `lib/ai/retrievers/generators.ts` and `lib/ai/retrieval-sql.ts` build.
 *
 * @module eval/pgvector-validation
 */

import type { LivePg } from "./pg-live"
import { applyMigrations, cosineDistance, seededUnitVector, toVectorLiteral } from "./pg-live"
import { installLivePrisma, Prisma, type LivePrismaStats } from "./prisma-live"

export const VALIDATION_SCHEMA_VERSION = "1.0"

export interface CheckResult {
  id: string
  title: string
  ok: boolean
  /** Measurement, when the check produces one. */
  value?: unknown
  detail?: string
  ms?: number
  /** True when the check could not be executed rather than having failed. */
  skipped?: boolean
}

export interface CorpusSpec {
  name: string
  workspaces: number
  documentsPerWorkspace: number
  chunksPerDocument: number
}

export const CORPUS_SIZES: CorpusSpec[] = [
  { name: "small", workspaces: 1, documentsPerWorkspace: 1, chunksPerDocument: 200 },
  { name: "medium", workspaces: 1, documentsPerWorkspace: 2, chunksPerDocument: 1500 },
  { name: "large", workspaces: 2, documentsPerWorkspace: 3, chunksPerDocument: 4000 },
  { name: "multi-document", workspaces: 3, documentsPerWorkspace: 4, chunksPerDocument: 600 },
]

export interface PgvectorValidationResult {
  schemaVersion: string
  ranAt: string
  environment: {
    flavor: "postgres" | "pglite"
    serverVersion: string
    pgvectorVersion: string | null
    /** Honest statement of what this flavour cannot tell you. */
    caveats: string[]
  }
  migrations: Array<{ name: string; ok: boolean; ms: number; error?: string }>
  checks: CheckResult[]
  corpus: Array<{ spec: CorpusSpec; rows: number; ingestMs: number }>
  /** ANN recall measured against brute-force ground truth, per corpus and per k. */
  annRecall: Array<{
    corpus: string
    totalRows: number
    scopeRows: number
    efSearch: number
    k: number
    /** Null when the ground truth could not be made brute-force; never reported as 1. */
    recall: number | null
    exactTopMatches: number
    annLatencyMs: number
    exactLatencyMs: number
    /**
     * Whether the HNSW index was actually used for this measurement.
     *
     * Without this field a recall of 1.000 is indistinguishable from "the planner ignored the
     * index and did an exact sort", which is not an ANN measurement at all. On a small table
     * PostgreSQL legitimately prefers the scan; the harness therefore disables it (see
     * `forceIndex`) and records which plan actually ran.
     */
    indexUsed: boolean
    plan: string
    /**
     * Whether the ground-truth query really was a brute-force scan. If the planner let it use the
     * HNSW index, "recall" would be one approximate search scored against another and the number
     * would be circular, so it is reported as null instead.
     */
    exactIsBruteForce: boolean
    exactPlan: string
    /**
     * `off` | `strict_order` | `relaxed_order`. The production query is workspace+document
     * filtered, so the filter lands *after* the ANN scan; this is the knob that decides whether
     * the scan keeps walking until LIMIT is filled, and it has a measurable recall cost.
     */
    iterativeScan: string
  }>
  statementsExecuted: number
  passed: number
  failed: number
  skipped: number
  ok: boolean
}

const EMBEDDING_DIM = 384

// ---------------------------------------------------------------------------
// Corpus construction
// ---------------------------------------------------------------------------

async function ensureWorkspace(db: LivePg, workspaceId: string): Promise<void> {
  await db.query(
    `INSERT INTO "Workspace" (id, name, authors, venue, "userId")
     VALUES ($1, $2, '[]'::jsonb, 'test', 'validation')
     ON CONFLICT (id) DO NOTHING`,
    [workspaceId, `validation-${workspaceId}`]
  )
}

async function seedCorpus(db: LivePg, spec: CorpusSpec): Promise<{ rows: number; ingestMs: number; ids: string[] }> {
  const t0 = Date.now()
  const ids: string[] = []
  let rows = 0
  for (let w = 0; w < spec.workspaces; w++) {
    const workspaceId = `ws-${spec.name}-${w}`
    await ensureWorkspace(db, workspaceId)
    for (let d = 0; d < spec.documentsPerWorkspace; d++) {
      const documentId = `doc-${spec.name}-${w}-${d}`
      ids.push(`${workspaceId}:${documentId}`)
      const batch: string[] = []
      const values: unknown[] = []
      let n = 0
      for (let c = 0; c < spec.chunksPerDocument; c++) {
        const vec = seededUnitVector(w * 1_000_003 + d * 10_007 + c, EMBEDDING_DIM)
        const p = (v: unknown) => {
          values.push(v)
          return `$${++n}`
        }
        batch.push(
          `(${p(`chk-${spec.name}-${w}-${d}-${c}`)}, ${p(workspaceId)}, ${p(documentId)}, ${p(`Section ${c % 12}`)}, ` +
            `${p(`Vedecký text o metóde ${c % 37} s presnosťou ${(c % 100) / 100}. `)}, ${p(64)}, ${p(toVectorLiteral(vec))}::vector, ` +
            `${p(c % 3 === 0 ? "table" : "prose")}, ${p(c % 3 === 0 ? "table" : "paragraph")}, ${p(c)}, ${p(`Kapitola ${c % 5}`)}, ` +
            `${p(`v2.0.0`)}, ${p(`mineru-md-1`)}, ${p(`Xenova/paraphrase-multilingual-MiniLM-L12-v2`)}, ${p(EMBEDDING_DIM)})`
        )
        if (batch.length >= 500) {
          await insertChunkBatch(db, batch, values)
          rows += batch.length
          batch.length = 0
          values.length = 0
          n = 0
        }
      }
      if (batch.length > 0) {
        await insertChunkBatch(db, batch, values)
        rows += batch.length
      }
    }
  }
  // Planner statistics matter. Without ANALYZE PostgreSQL estimates rows=1 for a filtered
  // scan on a freshly loaded table, and every plan captured below stops being representative
  // of a loaded production table.
  await db.exec(`ANALYZE "DocumentChunk"`).catch(() => undefined)
  return { rows, ingestMs: Date.now() - t0, ids }
}

async function insertChunkBatch(db: LivePg, batch: string[], values: unknown[]): Promise<void> {
  await db.query(
    `INSERT INTO "DocumentChunk"
       (id, "workspaceId", "documentId", heading, content, tokens, embedding, kind, "chunkType", ordinal,
        "sectionPath", "chunkerVersion", "parserVersion", "embeddingModelVersion", "embeddingDimensions")
     VALUES ${batch.join(", ")}
     ON CONFLICT (id) DO NOTHING`,
    values
  )
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Reads a GUC value from a `SHOW` result.
 *
 * PostgreSQL returns the value in a column called `setting` for a built-in GUC but in a column
 * named after the parameter for others (`SHOW hnsw.iterative_scan` yields a column literally named
 * `hnsw.iterative_scan`). Reading `.setting` unconditionally therefore reports a supported
 * parameter as missing — a false negative this harness must not produce.
 */
function gucValue(rows: Array<Record<string, unknown>>): string | null {
  const row = rows[0]
  if (!row) return null
  if (typeof row.setting === "string") return row.setting
  const only = Object.values(row)
  return typeof only[0] === "string" ? (only[0] as string) : null
}

export interface RunValidationOptions {
  db: LivePg
  /** Corpus sizes to seed. Defaults to the small and medium corpora. */
  sizes?: CorpusSpec[]
  /**
   * `hnsw.iterative_scan` modes to sweep. Production sets `relaxed_order` unconditionally, so the
   * harness measures the alternatives rather than assuming that choice is free.
   */
  iterativeScanModes?: string[]
  /** ef_search values to sweep when measuring ANN recall. */
  efSearchValues?: number[]
  /** Number of probe queries per corpus. */
  probes?: number
  migrationsDir?: string
}

/**
 * Runs the full live validation. Never throws for a failed check — a failed check is the result.
 * Only infrastructure failures (cannot open the database, cannot apply migrations) propagate.
 */
export async function runPgvectorValidation(opts: RunValidationOptions): Promise<PgvectorValidationResult> {
  const { db } = opts
  const sizes = opts.sizes ?? CORPUS_SIZES.slice(0, 2)
  // The sweep must include the value production actually asks for at topK=10, or it measures
  // configurations nobody ships. efSearchFor(10) is 200 under the measured multiplier.
  const efSearchValues = opts.efSearchValues ?? [40, 80, 100, 200, 400]
  const iterativeScanModes = opts.iterativeScanModes ?? ["off", "relaxed_order"]
  const probes = opts.probes ?? 5

  const checks: CheckResult[] = []
  const push = (c: CheckResult) => checks.push(c)

  // ---- Migrations ---------------------------------------------------------
  const migrations = await applyMigrations(db, { migrationsDir: opts.migrationsDir })
  const migrationsOk = migrations.every((m) => m.ok)
  push({
    id: "migrations",
    title: "Every migration in prisma/migrations applies to a real PostgreSQL",
    ok: migrationsOk,
    value: { applied: migrations.filter((m) => m.ok).length, total: migrations.length },
    detail: migrationsOk
      ? undefined
      : `failed at ${migrations.find((m) => !m.ok)?.name}: ${migrations.find((m) => !m.ok)?.error}`,
  })
  if (!migrationsOk) {
    return finish(db, migrations, checks, [], [])
  }

  // ---- A1: extension ------------------------------------------------------
  const ext = await db.query<{ extversion: string; name: string }>(
    `SELECT e.extversion, e.extname AS name FROM pg_extension e WHERE e.extname = 'vector'`
  )
  push({
    id: "extension-version",
    title: "pgvector extension is installed and its version is known",
    ok: ext.rows.length === 1 && Boolean(ext.rows[0].extversion),
    value: ext.rows[0]?.extversion ?? null,
    detail:
      ext.rows.length === 0
        ? "the `vector` extension is not installed"
        : `iterative_scan requires pgvector >= 0.8; this server has ${ext.rows[0]?.extversion}`,
  })

  // ---- A2: HNSW index -----------------------------------------------------
  const hnsw = await db.query<{ indexname: string; indexdef: string; amname: string }>(
    `SELECT i.relname AS indexname, pg_get_indexdef(x.indexrelid) AS indexdef, am.amname
       FROM pg_index x
       JOIN pg_class c ON c.oid = x.indrelid
       JOIN pg_class i ON i.oid = x.indexrelid
       JOIN pg_am am ON am.oid = i.relam
      WHERE c.relname = 'DocumentChunk'`
  )
  const hnswRow = hnsw.rows.find((r) => r.amname === "hnsw")
  push({
    id: "hnsw-index-exists",
    title: "DocumentChunk.embedding has an HNSW index",
    ok: Boolean(hnswRow),
    value: hnsw.rows.map((r) => ({ name: r.indexname, am: r.amname })),
    detail: hnswRow ? undefined : "no HNSW index found on DocumentChunk — dense retrieval will sequential-scan",
  })
  push({
    id: "hnsw-opclass",
    title: "the HNSW index uses vector_cosine_ops (matching the `<=>` operator the code uses)",
    ok: Boolean(hnswRow && /vector_cosine_ops/.test(hnswRow.indexdef)),
    value: hnswRow?.indexdef ?? null,
    detail: hnswRow && !/vector_cosine_ops/.test(hnswRow.indexdef)
      ? "operator class mismatch: a `<=>` query cannot use this index"
      : undefined,
  })

  // ---- A3: cosine operator -------------------------------------------------
  const op = await db.query<{ oprname: string }>(
    `SELECT o.oprname FROM pg_operator o JOIN pg_type t ON t.oid = o.oprleft
      WHERE t.typname = 'vector' AND o.oprname IN ('<=>','<->','<#>')`
  )
  push({
    id: "distance-operators",
    title: "pgvector distance operators are registered for the vector type",
    ok: op.rows.some((r) => r.oprname === "<=>"),
    value: op.rows.map((r) => r.oprname),
  })

  // ---- A4: ef_search + SET LOCAL scoping ----------------------------------
  const efDefault = await db
    .query<Record<string, unknown>>(`SHOW hnsw.ef_search`)
    .catch(() => ({ rows: [] as Record<string, unknown>[], ms: 0 }))
  const efDefaultValue = gucValue(efDefault.rows)
  push({
    id: "ef-search-readable",
    title: "hnsw.ef_search is a real GUC on this build",
    ok: efDefaultValue !== null,
    value: efDefaultValue,
  })

  let leaked: string | null = null
  let insideTx: string | null = null
  try {
    await db.transaction(async (tx) => {
      await tx.exec(`SET LOCAL hnsw.ef_search = 777`)
      insideTx = gucValue((await tx.query<Record<string, unknown>>(`SHOW hnsw.ef_search`)).rows)
    })
    leaked = gucValue((await db.query<Record<string, unknown>>(`SHOW hnsw.ef_search`)).rows)
  } catch (err) {
    push({
      id: "set-local-transaction-scoped",
      title: "SET LOCAL hnsw.ef_search is accepted inside a transaction (PgBouncer contract)",
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    })
  }
  if (leaked !== null) {
    push({
      id: "set-local-transaction-scoped",
      title: "SET LOCAL hnsw.ef_search applies inside the transaction and does not leak after it",
      ok: insideTx === "777" && leaked !== "777",
      value: { insideTransaction: insideTx, afterCommit: leaked, default: efDefaultValue },
      detail:
        insideTx !== "777"
          ? "the SET LOCAL did not take effect inside the transaction"
          : leaked === "777"
            ? "the value leaked past COMMIT — unsafe under session pooling"
            : undefined,
    })
  }

  // ---- A5: iterative_scan --------------------------------------------------
  let iterativeAvailable = false
  try {
    await db.transaction(async (tx) => {
      await tx.exec(`SET LOCAL hnsw.iterative_scan = 'relaxed_order'`)
      iterativeAvailable = gucValue((await tx.query<Record<string, unknown>>(`SHOW hnsw.iterative_scan`)).rows) === "relaxed_order"
    })
  } catch (err) {
    push({
      id: "iterative-scan",
      title: "hnsw.iterative_scan is available (needed for filtered ANN on a multi-tenant table)",
      ok: false,
      skipped: false,
      detail: `not available: ${err instanceof Error ? err.message : String(err)}`,
      value: { available: false },
    })
  }
  if (!checks.some((c) => c.id === "iterative-scan")) {
    push({
      id: "iterative-scan",
      title: "hnsw.iterative_scan is available and settable to relaxed_order",
      ok: iterativeAvailable,
      value: { available: iterativeAvailable },
      detail: iterativeAvailable
        ? undefined
        : "pgvector < 0.8 — filtered ANN may under-fill; the retrieval code degrades to an exact scan",
    })
  }
  // The retrieval code guards this SET in a DO block; prove the guard itself is valid SQL.
  try {
    await db.transaction(async (tx) => {
      await tx.exec(
        `DO $$ BEGIN PERFORM set_config('hnsw.iterative_scan', 'relaxed_order', true); EXCEPTION WHEN OTHERS THEN NULL; END $$;`
      )
    })
    push({
      id: "iterative-scan-guard",
      title: "the guarded DO-block SET used by applyHnswSessionTuning is valid SQL",
      ok: true,
    })
  } catch (err) {
    push({
      id: "iterative-scan-guard",
      title: "the guarded DO-block SET used by applyHnswSessionTuning is valid SQL",
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    })
  }

  // ---- Corpora + ANN recall ------------------------------------------------
  const corpusResults: PgvectorValidationResult["corpus"] = []
  const annRecall: PgvectorValidationResult["annRecall"] = []

  for (const spec of sizes) {
    const seeded = await seedCorpus(db, spec)
    corpusResults.push({ spec, rows: seeded.rows, ingestMs: seeded.ingestMs })

    const [wsId, docId] = seeded.ids[0].split(":")
    const scope = await db.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM "DocumentChunk" WHERE "workspaceId" = $1 AND "documentId" = $2`,
      [wsId, docId]
    )
    const scopeRows = scope.rows[0]?.n ?? 0

    for (let p = 0; p < probes; p++) {
      const probe = seededUnitVector(900_000 + p * 7919, EMBEDDING_DIM)
      const lit = toVectorLiteral(probe)
      for (const ef of efSearchValues) {
        for (const scanMode of iterativeScanModes) {
        for (const k of [10]) {
          // Ground truth: exact nearest neighbours inside the same scope.
          //
          // This MUST be a brute-force scan. Run as a plain query it is free to pick the HNSW
          // index at the default ef_search, in which case "recall" is just one approximate search
          // compared against a second approximate search — which is how a meaningless 1.000 at
          // ef_search=40 and an impossible 0.500 at ef_search=400 both end up in the same report.
          // Forcing the index off makes the sort exhaustive, and the plan is captured so the
          // claim is checkable rather than asserted.
          const t0 = Date.now()
          const exact = await db.transaction(async (tx) => {
            await tx.exec(`SET LOCAL enable_indexscan = off`)
            await tx.exec(`SET LOCAL enable_bitmapscan = off`)
            const rows = await tx.query<{ id: string }>(
              `SELECT id FROM "DocumentChunk"
                WHERE "workspaceId" = $1 AND "documentId" = $2 AND embedding IS NOT NULL
                ORDER BY embedding <=> $3::vector LIMIT $4`,
              [wsId, docId, lit, k]
            )
            const planRows = await tx.query<Record<string, unknown>>(
              `EXPLAIN SELECT id FROM "DocumentChunk"
                WHERE "workspaceId" = $1 AND "documentId" = $2 AND embedding IS NOT NULL
                ORDER BY embedding <=> $3::vector LIMIT $4`,
              [wsId, docId, lit, k]
            )
            return {
              rows: rows.rows,
              plan: planRows.rows
                .map((r) => String(Object.values(r)[0] ?? ""))
                .join(" | ")
                .replace(/'\[[^\]]*\]'::vector/g, "'<vector>'::vector")
                .slice(0, 600),
            }
          })
          const exactMs = Date.now() - t0
          // A ground truth that used the ANN index would make every recall number circular.
          const exactIsBruteForce = exact.plan.length > 0 && !/hnsw/i.test(exact.plan)

          const annSql = `SELECT id FROM "DocumentChunk"
                WHERE "workspaceId" = $1 AND "documentId" = $2 AND embedding IS NOT NULL
                ORDER BY embedding <=> $3::vector LIMIT $4`

          // Approximate: the same query with the index tuned exactly as the retrieval code tunes it.
          //
          // `enable_seqscan`/`enable_bitmapscan` are switched off for this measurement only. On a
          // table of a few thousand rows PostgreSQL legitimately prefers a bitmap scan + sort, which
          // is an *exact* search — measuring "recall" against it would return 1.000 while the HNSW
          // index was never touched. Forcing the scan off makes the number mean what it says.
          const t1 = Date.now()
          const ann = await db.transaction(async (tx) => {
            await tx.exec(`SET LOCAL hnsw.ef_search = ${ef}`)
            if (scanMode !== "off") {
              await tx
                .exec(`DO $$ BEGIN PERFORM set_config('hnsw.iterative_scan', '${scanMode}', true); EXCEPTION WHEN OTHERS THEN NULL; END $$;`)
                .catch(() => {})
            }
            await tx.exec(`SET LOCAL enable_seqscan = off`)
            await tx.exec(`SET LOCAL enable_bitmapscan = off`)
            return tx.query<{ id: string }>(annSql, [wsId, docId, lit, k])
          })
          const annMs = Date.now() - t1

          // Record the plan that actually ran, so the recall number can never be read as an ANN
          // measurement when the planner chose something else.
          const planRows = await db
            .transaction(async (tx) => {
              await tx.exec(`SET LOCAL hnsw.ef_search = ${ef}`)
              await tx.exec(`SET LOCAL enable_seqscan = off`)
              await tx.exec(`SET LOCAL enable_bitmapscan = off`)
              return tx.query<Record<string, unknown>>(`EXPLAIN ${annSql}`, [wsId, docId, lit, k])
            })
            .catch(() => ({ rows: [] as Record<string, unknown>[], ms: 0 }))
          // EXPLAIN inlines the probe vector, which is ~4 KB of digits and buries the node names.
          // Collapse it so the plan is readable and the scan node can actually be matched.
          const plan = planRows.rows
            .map((r) => String(Object.values(r)[0] ?? ""))
            .join(" | ")
            .replace(/\'\[[^\]]*\]\'::vector/g, "'<vector>'::vector")
          const indexUsed = /Index Scan using \S*hnsw/i.test(plan)

          const exactIds = new Set(exact.rows.map((r) => r.id))
          const matches = ann.rows.filter((r) => exactIds.has(r.id)).length
          annRecall.push({
            corpus: spec.name,
            totalRows: seeded.rows,
            scopeRows,
            efSearch: ef,
            k,
            // Null, not 1: a recall figure with no trustworthy ground truth is not a measurement.
            recall: exactIsBruteForce && exactIds.size > 0 ? matches / exactIds.size : null,
            exactTopMatches: matches,
            annLatencyMs: annMs,
            exactLatencyMs: exactMs,
            indexUsed,
            plan: plan.slice(0, 600),
            exactIsBruteForce,
            exactPlan: exact.plan,
            iterativeScan: scanMode,
          })
        }
        }
      }
    }
  }

  // Only a measurement with a brute-force ground truth AND the HNSW index in its plan is an
  // ANN recall figure. Everything else is recorded but never averaged into the headline number.
  const measured = annRecall.filter((r) => r.indexUsed && r.exactIsBruteForce && r.recall !== null)
  const worstRecall = measured.length > 0 ? Math.min(...measured.map((r) => r.recall as number)) : null
  const circularGroundTruth = annRecall.filter((r) => !r.exactIsBruteForce).length

  // The production query is workspace+document filtered, so the WHERE lands *after* the ANN scan.
  // Which hnsw.iterative_scan mode recovers the lost recall is a measurement, not a preference,
  // and the current code hard-codes relaxed_order without having compared it to anything.
  const byMode = iterativeScanModes.map((mode) => {
    const rows = measured.filter((r) => r.iterativeScan === mode)
    const worst = rows.length > 0 ? Math.min(...rows.map((r) => r.recall as number)) : null
    const mean = rows.length > 0 ? rows.reduce((a, b) => a + (b.recall as number), 0) / rows.length : null
    const meanLatency = rows.length > 0 ? rows.reduce((a, b) => a + b.annLatencyMs, 0) / rows.length : null
    return {
      iterativeScan: mode,
      measurements: rows.length,
      worstRecallAt10: worst === null ? null : Math.round(worst * 1000) / 1000,
      meanRecallAt10: mean === null ? null : Math.round(mean * 1000) / 1000,
      meanLatencyMs: meanLatency === null ? null : Math.round(meanLatency * 100) / 100,
      byEfSearch: efSearchValues.map((ef) => {
        const atEf = rows.filter((r) => r.efSearch === ef)
        return {
          efSearch: ef,
          measurements: atEf.length,
          meanRecallAt10:
            atEf.length === 0
              ? null
              : Math.round((atEf.reduce((a, b) => a + (b.recall as number), 0) / atEf.length) * 1000) / 1000,
        }
      }),
    }
  })
  const best = byMode
    .filter((m) => m.measurements > 0 && m.worstRecallAt10 !== null)
    .sort((a, b) => (b.worstRecallAt10 as number) - (a.worstRecallAt10 as number))[0]

  // The acceptance gate is the configuration the code actually ships, not the best row of a
  // sweep. The sweep deliberately includes under-provisioned ef_search values so the curve can
  // be seen; scoring against its worst row would fail a correct default, and scoring against its
  // best row would pass a broken one. efSearchFor(10) is the value applyHnswSessionTuning sends
  // for a topK=10 retrieval, and relaxed_order is the mode it sets.
  // Imported dynamically, as everywhere else in this file, so loading the harness does not pull
  // the Prisma client into the module graph before installLivePrisma has replaced it.
  const { efSearchFor } = await import("@/lib/ai/retrieval-sql")
  const productionEf = efSearchFor(10)
  const productionMode = "relaxed_order"
  const productionRows = measured.filter((r) => r.efSearch === productionEf && r.iterativeScan === productionMode)
  const productionWorst =
    productionRows.length > 0 ? Math.min(...productionRows.map((r) => r.recall as number)) : null
  const productionMean =
    productionRows.length > 0
      ? productionRows.reduce((a, b) => a + (b.recall as number), 0) / productionRows.length
      : null

  push({
    id: "ann-recall",
    title: "Filtered HNSW recall@10 in the shipped configuration is >= 0.95 against brute-force ground truth",
    // When nothing was measured as a genuine ANN search the check is skipped, never passed:
    // a recall of 1.000 from an exact plan would launder an unmeasured claim into a green tick.
    ok: productionRows.length > 0 && productionWorst !== null && productionWorst >= 0.95,
    skipped: measured.length === 0 || productionRows.length === 0,
    value: {
      productionConfiguration: {
        efSearch: productionEf,
        iterativeScan: productionMode,
        measurements: productionRows.length,
        worstRecallAt10: productionWorst === null ? null : Math.round(productionWorst * 1000) / 1000,
        meanRecallAt10: productionMean === null ? null : Math.round(productionMean * 1000) / 1000,
      },
      worstRecallAcrossWholeSweep: worstRecall === null ? null : Math.round(worstRecall * 1000) / 1000,
      measurementsUsingHnsw: measured.length,
      measurementsTotal: annRecall.length,
      measurementsDiscardedForCircularGroundTruth: circularGroundTruth,
      bestSweptConfiguration: best ? { iterativeScan: best.iterativeScan, worstRecallAt10: best.worstRecallAt10 } : null,
      byIterativeScanMode: byMode,
    },
    detail:
      measured.length === 0
        ? `SKIPPED: 0/${annRecall.length} measurements used document_chunk_embedding_hnsw with a brute-force ground truth. Every recall figure here would be exact-search recall (1.000 by construction), NOT an approximate-recall measurement. See annRecall[].plan and annRecall[].exactPlan.`
        : productionRows.length === 0
          ? `SKIPPED: the sweep contains no measurement at the shipped ef_search=${productionEf} with iterative_scan=${productionMode}, so the shipped configuration is unmeasured. Swept worst recall@10=${worstRecall === null ? null : worstRecall.toFixed(3)}.`
          : `shipped configuration (ef_search=${productionEf}, iterative_scan=${productionMode}): worst recall@10=${productionWorst?.toFixed(3)}, mean=${productionMean?.toFixed(3)} over ${productionRows.length} probes. Swept curve: ${byMode
              .map((m) => `${m.iterativeScan}[${m.byEfSearch.map((e) => `${e.efSearch}:${e.meanRecallAt10}`).join(" ")}]`)
              .join("; ")}`,
  })

  // What CAN be proven on any engine: the index exists, is valid, and is the right kind.
  // A valid index that the planner declines to use at this data volume is a cost-estimation
  // outcome, not a defect, and it is reported as such rather than as a failure.
  const hnswHealth = (
    await db.query<{
      indexName: string
      isValid: boolean
      isReady: boolean
      accessMethod: string
      definition: string
    }>(
      `SELECT c.relname AS "indexName",
              x.indisvalid AS "isValid",
              x.indisready AS "isReady",
              am.amname AS "accessMethod",
              pg_get_indexdef(x.indexrelid) AS "definition"
       FROM pg_index x
       JOIN pg_class c ON c.oid = x.indexrelid
       JOIN pg_am am ON am.oid = c.relam
       WHERE am.amname = 'hnsw'
       ORDER BY c.relname`
    )
  ).rows
  const chunkHnsw = hnswHealth.find((r) => r.indexName === "document_chunk_embedding_hnsw")
  push({
    id: "ann-index-valid",
    title: "document_chunk_embedding_hnsw is a valid, ready hnsw index (usable by the planner)",
    ok: Boolean(chunkHnsw?.isValid && chunkHnsw?.isReady),
    value: {
      index: chunkHnsw?.indexName ?? null,
      isValid: chunkHnsw?.isValid ?? null,
      isReady: chunkHnsw?.isReady ?? null,
      hnswIndexes: hnswHealth.map((r) => r.indexName),
    },
    detail: chunkHnsw
      ? undefined
      : "document_chunk_embedding_hnsw is missing from pg_index",
  })

  // ---- A6: filtered recall does not under-fill -----------------------------
  const small = corpusResults[0]
  if (small) {
    const [wsId, docId] = `${small.spec.name}`.length ? [`ws-${small.spec.name}-0`, `doc-${small.spec.name}-0-0`] : ["", ""]
    const underfill = await db.transaction(async (tx) => {
      await tx.exec(`SET LOCAL hnsw.ef_search = 40`)
      await tx
        .exec(`DO $$ BEGIN PERFORM set_config('hnsw.iterative_scan', 'relaxed_order', true); EXCEPTION WHEN OTHERS THEN NULL; END $$;`)
        .catch(() => {})
      return tx.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM (
           SELECT id FROM "DocumentChunk"
            WHERE "workspaceId" = $1 AND "documentId" = $2 AND embedding IS NOT NULL
            ORDER BY embedding <=> $3::vector LIMIT 50
         ) s`,
        [wsId, docId, toVectorLiteral(seededUnitVector(4242, EMBEDDING_DIM))]
      )
    })
    const total = await db.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM "DocumentChunk" WHERE "workspaceId" = $1 AND "documentId" = $2`,
      [wsId, docId]
    )
    const wanted = Math.min(50, total.rows[0]?.n ?? 0)
    push({
      id: "filtered-recall-no-underfill",
      title: "A workspace-scoped ANN query returns the full LIMIT despite the multi-tenant filter",
      ok: (underfill.rows[0]?.n ?? 0) >= wanted,
      value: { returned: underfill.rows[0]?.n ?? 0, wanted, scopeRows: total.rows[0]?.n ?? 0 },
      detail:
        (underfill.rows[0]?.n ?? 0) >= wanted
          ? undefined
          : "the HNSW scan was pruned by the workspace filter — this is the failure mode iterative_scan exists for",
    })
  }

  // ---- A7: the production statements execute -------------------------------
  const live = installLivePrisma({ db })
  try {
    const { denseRetriever, lexicalRetriever, metadataRetriever, citationRetriever } = await import("@/lib/ai/retrievers/generators")
    const { efSearchFor, buildFtsQuery, retrievalJoin } = await import("@/lib/ai/retrieval-sql")

    const workspaceId = `ws-${small?.spec.name ?? "small"}-0`
    const documentId = `doc-${small?.spec.name ?? "small"}-0-0`
    const scopeTotal =
      (
        await db.query<{ n: number }>(
          `SELECT COUNT(*)::int AS n FROM "DocumentChunk" WHERE "workspaceId" = $1 AND "documentId" = $2`,
          [workspaceId, documentId]
        )
      ).rows[0]?.n ?? 0
    const query = "Aká bola presnosť navrhnutého modelu a štatistická významnosť výsledkov?"
    const embedding = seededUnitVector(31337, EMBEDDING_DIM)

    const dense = await timed(() =>
      denseRetriever.retrieve({ workspaceId, query, queryEmbeddings: [embedding], limit: 10, documentId })
    )
    push({
      id: "dense-generator-executes",
      title: "denseRetriever's production SQL executes against a real PostgreSQL and returns rows",
      ok: dense.error === undefined && dense.value.length > 0,
      value: { candidates: dense.value.length },
      ms: dense.ms,
      detail: dense.error,
    })

    const lexical = await timed(() =>
      lexicalRetriever.retrieve({ workspaceId, query, limit: 10, documentId })
    )
    push({
      id: "lexical-generator-executes",
      title: "lexicalRetriever's production SQL (websearch_to_tsquery + ts_rank) executes",
      ok: lexical.error === undefined,
      value: { candidates: lexical.value.length, ftsQuery: buildFtsQuery(query) },
      ms: lexical.ms,
      detail: lexical.error,
    })

    const metadata = await timed(() => metadataRetriever.retrieve({ workspaceId, query, limit: 10, documentId }))
    push({
      id: "metadata-generator-executes",
      title: "metadataRetriever's production SQL executes",
      ok: metadata.error === undefined,
      value: { candidates: metadata.value.length },
      ms: metadata.ms,
      detail: metadata.error,
    })

    const citation = await timed(() => citationRetriever.retrieve({ workspaceId, query, limit: 10, documentId }))
    push({
      id: "citation-generator-executes",
      title: "citationRetriever's production SQL executes",
      ok: citation.error === undefined,
      value: { candidates: citation.value.length },
      ms: citation.ms,
      detail: citation.error,
    })

    // Tenant isolation: an explicitly empty documentIds array must match nothing. Executed for
    // real — a filter that only *looks* right is exactly what this harness exists to disprove.
    // Composed with Prisma's own `sql` tag, not string concatenation: the fragment carries its own
    // `$1..$n` numbering, so splicing it after another `$1` produces a statement whose parameter
    // count does not match its placeholders. Prisma renumbers on composition.
    const emptyScope = retrievalJoin({ documentIds: [] })
    const isolatedStmt = (Prisma as any).sql`SELECT COUNT(*)::int AS n FROM "DocumentChunk" WHERE "workspaceId" = ${workspaceId} ${emptyScope}`
    const isolated = await db.query<{ n: number }>(isolatedStmt.text, isolatedStmt.values)
    push({
      id: "empty-documentids-matches-nothing",
      title: "retrievalJoin({documentIds: []}) compiles to `AND 1 = 0` and matches no rows",
      ok: /AND 1 = 0/.test(emptyScope.text) && (isolated.rows[0]?.n ?? -1) === 0,
      value: { sql: emptyScope.text, rows: isolated.rows[0]?.n ?? null, scopeRows: scopeTotal },
    })

    // And the same filter with a real document id must match the whole document — the guard must
    // not have quietly become "match nothing always".
    const scopedJoin = retrievalJoin({ documentIds: [documentId] })
    const scopedStmt = (Prisma as any).sql`SELECT COUNT(*)::int AS n FROM "DocumentChunk" WHERE "workspaceId" = ${workspaceId} ${scopedJoin}`
    const scoped = await db.query<{ n: number }>(scopedStmt.text, scopedStmt.values)
    push({
      id: "documentids-filter-still-matches",
      title: "retrievalJoin({documentIds: [id]}) still matches every row of that document",
      ok: (scoped.rows[0]?.n ?? 0) === scopeTotal && scopeTotal > 0,
      value: { sql: scopedJoin.text, rows: scoped.rows[0]?.n ?? null, scopeRows: scopeTotal },
    })

    push({
      id: "ef-search-scaling",
      title: "efSearchFor scales with the requested limit and stays inside [100, 1000]",
      // Bounds are measured, not chosen: ef_search=40 gave recall@10 of 0.700 and 80 gave 0.933
      // on a filtered query (see ann-recall), so the floor is 100 and topK=10 must ask for 200.
      ok: efSearchFor(1) === 100 && efSearchFor(10) === 200 && efSearchFor(1000) === 1000 && efSearchFor(10_000) === 1000,
      value: { at1: efSearchFor(1), at10: efSearchFor(10), at1000: efSearchFor(1000), at10000: efSearchFor(10_000) },
    })

    const stmtCount = live.stats.statements.length
    push({
      id: "statements-executed",
      title: "Production retrieval statements were executed (not simulated)",
      ok: stmtCount > 0,
      value: { statements: stmtCount, sample: live.stats.statements.slice(0, 3).map((s) => s.text.slice(0, 200)) },
    })
  } catch (err) {
    push({
      id: "generators-execute",
      title: "Production retrieval generators execute against the live database",
      ok: false,
      detail: err instanceof Error ? `${err.message}\n${err.stack ?? ""}`.slice(0, 1000) : String(err),
    })
  } finally {
    live.restore()
  }

  return finish(db, migrations, checks, corpusResults, annRecall, live.stats)
}

async function timed<T>(fn: () => Promise<T[]>): Promise<{ value: T[]; ms: number; error?: string }> {
  const t0 = Date.now()
  try {
    const value = await fn()
    return { value, ms: Date.now() - t0 }
  } catch (err) {
    return { value: [], ms: Date.now() - t0, error: err instanceof Error ? err.message : String(err) }
  }
}

function finish(
  db: LivePg,
  migrations: PgvectorValidationResult["migrations"],
  checks: CheckResult[],
  corpus: PgvectorValidationResult["corpus"],
  annRecall: PgvectorValidationResult["annRecall"],
  stats?: LivePrismaStats
): PgvectorValidationResult {
  const passed = checks.filter((c) => c.ok).length
  const skipped = checks.filter((c) => c.skipped).length
  const failed = checks.filter((c) => !c.ok && !c.skipped).length
  return {
    schemaVersion: VALIDATION_SCHEMA_VERSION,
    ranAt: new Date().toISOString(),
    environment: {
      flavor: db.flavor,
      serverVersion: db.serverVersion,
      pgvectorVersion: db.pgvectorVersion,
      caveats:
        db.flavor === "pglite"
          ? [
              "PGlite is PostgreSQL compiled to WebAssembly: the executor, index access methods and pgvector operators are the real ones, but throughput, memory and I/O characteristics are NOT representative of a native server.",
              "PgBouncer / Supabase transaction-pooler behaviour cannot be exercised in-process; the SET LOCAL scoping check proves the SQL contract only.",
              "ANN recall is only meaningful when the planner actually chooses document_chunk_embedding_hnsw. Every annRecall record carries indexUsed plus the EXPLAIN plan that produced it. When indexUsed is false the recall figure is exact-search recall (1.000 by construction) and is NOT an approximate-recall measurement; the ann-recall check reports skipped=true in that case rather than passing on a vacuous number. Approximate-recall at production data volume remains unverified-live.",
            ]
          : ["Results depend on the server's configuration, load and pgvector build."],
    },
    migrations,
    checks,
    corpus,
    annRecall,
    statementsExecuted: stats?.statements.length ?? 0,
    passed,
    failed,
    skipped,
    ok: failed === 0,
  }
}

/** Renders the result as the machine-readable JSON the eval CLIs emit. */
export function validationToJson(result: PgvectorValidationResult): string {
  return JSON.stringify(result, null, 2)
}

/** Unused-import guard: keeps the helpers referenced so tree-shaking cannot drop them silently. */
export const __internals = { cosineDistance }
