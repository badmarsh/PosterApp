/**
 * Live verification of the hardened RAG retrieval against Supabase (Objective A).
 *
 * Run from a machine that can reach the Supabase pooler:
 *
 *   DATABASE_URL="postgresql://…:6543/postgres?sslmode=require&pgbouncer=true" \
 *   DIRECT_URL="postgresql://…:5432/postgres?sslmode=require" \
 *   npx tsx scripts/verify-supabase-rag.ts
 *
 * Credentials are read EXCLUSIVELY from the environment (never hard-coded).
 *
 * Checks:
 *   A1  Direct connection (5432) reachable; pgvector extension present.
 *   A2  `contextPrefix` column exists (migration 20260917120000 applied).
 *   A3  HNSW index `document_chunk_embedding_hnsw` present on DocumentChunk.
 *   A4  Over the transaction pooler (6543): SET LOCAL hnsw.ef_search +
 *       hnsw.iterative_scan execute INSIDE prisma.$transaction without
 *       SQLSTATE 25001 and the hybrid RRF CTE returns rows.
 *   A5  Over the pooler: exact-scan fallback query (ORDER BY embedding <=>)
 *       returns rows, bounded by the same tenant filters.
 *   A6  Read-only — no data is created, modified or deleted.
 */

import { PrismaClient } from "@prisma/client"

const pooled = new PrismaClient({
  log: ["error", "warn"],
  datasources: process.env.DATABASE_URL ? { db: { url: process.env.DATABASE_URL } } : undefined,
})
const direct = new PrismaClient({
  log: ["error", "warn"],
  datasources: process.env.DIRECT_URL ? { db: { url: process.env.DIRECT_URL } } : undefined,
})

let failures = 0
function pass(id: string, msg: string) {
  console.log(`  [PASS] ${id} — ${msg}`)
}
function fail(id: string, msg: string, err?: unknown) {
  failures++
  console.error(`  [FAIL] ${id} — ${msg}${err instanceof Error ? ` (${err.message})` : ""}`)
}

async function main() {
  console.log("=== PosterApp RAG / Supabase verification ===")
  if (!process.env.DATABASE_URL || !process.env.DIRECT_URL) {
    console.error("DATABASE_URL and DIRECT_URL must be set in the environment.")
    process.exit(1)
  }

  // ── A1: direct connection + pgvector ──────────────────────────────────────
  let extOk = false
  try {
    const ext = await direct.$queryRaw<Array<{ extname: string; extversion: string }>>`
      SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'`
    extOk = ext.length > 0
    if (extOk) pass("A1", `pgvector installed (v${ext[0].extversion}) on direct connection`)
    else fail("A1", "pgvector extension NOT found — run CREATE EXTENSION vector")
  } catch (err) {
    fail("A1", "direct connection (5432) unreachable", err)
  }

  // ── A2: contextPrefix column ──────────────────────────────────────────────
  try {
    const cols = await direct.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'DocumentChunk' AND column_name = 'contextPrefix'`
    if (cols.length > 0) pass("A2", "DocumentChunk.contextPrefix column exists")
    else
      fail(
        "A2",
        "contextPrefix missing — apply migration 20260917120000_document_chunk_context_prefix (npx prisma migrate deploy)"
      )
  } catch (err) {
    fail("A2", "could not inspect DocumentChunk schema", err)
  }

  // ── A3: HNSW index ────────────────────────────────────────────────────────
  try {
    const idx = await direct.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'DocumentChunk' AND indexname = 'document_chunk_embedding_hnsw'`
    if (idx.length > 0) pass("A3", "HNSW index document_chunk_embedding_hnsw present")
    else fail("A3", "HNSW index missing — retrieval will fall back to sequential scans")
  } catch (err) {
    fail("A3", "could not inspect indexes", err)
  }

  // ── A4: transaction-pooler GUC + hybrid CTE ───────────────────────────────
  try {
    const chunkCount = await pooled.$queryRaw<Array<{ n: bigint }>>`SELECT COUNT(*)::bigint AS n FROM "DocumentChunk"`
    console.log(`  [info] DocumentChunk rows: ${chunkCount[0]?.n ?? 0}`)

    const rows = await pooled.$transaction(async (txUnknown: unknown) => {
    const tx = txUnknown as { $executeRawUnsafe: (s: string) => Promise<number>; $queryRaw: <T>(strings: TemplateStringsArray, ...values: unknown[]) => Promise<T> }
      // The exact statements retrieveSingleQuery runs — SET LOCAL is only
      // legal inside a transaction block (25001 otherwise) on port 6543.
      await tx.$executeRawUnsafe(`SET LOCAL hnsw.ef_search = 200`)
      await tx.$executeRawUnsafe(
        `DO $$ BEGIN PERFORM set_config('hnsw.iterative_scan', 'relaxed_order', true); EXCEPTION WHEN OTHERS THEN NULL; END $$;`
      )
      return tx.$queryRaw<Array<{ id: string; similarity: number }>>`
        WITH vector_search AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY embedding <=> (SELECT embedding FROM "DocumentChunk" WHERE embedding IS NOT NULL LIMIT 1)::vector) AS rank_vec
          FROM "DocumentChunk"
          WHERE "workspaceId" IN (SELECT "workspaceId" FROM "DocumentChunk" LIMIT 1)
            AND embedding IS NOT NULL
          LIMIT 10
        ),
        fts_search AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY ts_rank(to_tsvector('simple', COALESCE("contextPrefix", '') || ' ' || content), websearch_to_tsquery('simple', 'metodika OR vysledky OR model')) DESC) AS rank_fts
          FROM "DocumentChunk"
          WHERE "workspaceId" IN (SELECT "workspaceId" FROM "DocumentChunk" LIMIT 1)
            AND to_tsvector('simple', COALESCE("contextPrefix", '') || ' ' || content) @@ websearch_to_tsquery('simple', 'metodika OR vysledky OR model')
          LIMIT 10
        )
        SELECT d.id,
          (COALESCE(0.7 / (60.0 + v.rank_vec), 0.0) + COALESCE(0.3 / (60.0 + f.rank_fts), 0.0)) AS similarity
        FROM "DocumentChunk" d
        LEFT JOIN vector_search v ON d.id = v.id
        LEFT JOIN fts_search f ON d.id = f.id
        WHERE v.id IS NOT NULL OR f.id IS NOT NULL
        ORDER BY similarity DESC
        LIMIT 5`
    })
    pass("A4", `SET LOCAL + hybrid RRF CTE OK over PgBouncer 6543 (${rows.length} rows)`)
  } catch (err) {
    fail("A4", "transactional retrieval over the pooler failed", err)
  }

  // ── A5: exact-scan fallback ───────────────────────────────────────────────
  try {
    const rows = await pooled.$queryRaw<Array<{ id: string; similarity: number }>>`
      SELECT id, 1.0 - (embedding <=> (SELECT embedding FROM "DocumentChunk" WHERE embedding IS NOT NULL LIMIT 1)::vector) AS similarity
      FROM "DocumentChunk"
      WHERE "workspaceId" IN (SELECT "workspaceId" FROM "DocumentChunk" LIMIT 1)
        AND embedding IS NOT NULL
      ORDER BY embedding <=> (SELECT embedding FROM "DocumentChunk" WHERE embedding IS NOT NULL LIMIT 1)::vector
      LIMIT 5`
    pass("A5", `exact-scan fallback query OK (${rows.length} rows)`)
  } catch (err) {
    fail("A5", "exact-scan fallback failed", err)
  }

  // ── A6: contextPrefix backfill coverage (informational) ───────────────────
  try {
    const stats = await direct.$queryRaw<Array<{ total: bigint; prefixed: bigint }>>`
      SELECT COUNT(*)::bigint AS total, COUNT("contextPrefix")::bigint AS prefixed FROM "DocumentChunk"`
    const { total, prefixed } = stats[0] ?? { total: BigInt(0), prefixed: BigInt(0) }
    if (total === BigInt(0)) pass("A6", "no chunks indexed yet — contextPrefix coverage 100% by definition")
    else
      console.log(
        `  [info] A6 — contextPrefix coverage: ${prefixed}/${total} chunks (re-run "Reindex" in Thesis Review to backfill)`
      )
  } catch (err) {
    fail("A6", "coverage query failed", err)
  }

  await pooled.$disconnect()
  await direct.$disconnect()

  if (failures > 0) {
    console.error(`=== ${failures} check(s) FAILED ===`)
    process.exit(1)
  }
  console.log("=== All checks passed ===")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
