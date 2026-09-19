/**
 * Shared, injection-safe SQL fragments for retrieval.
 *
 * Extracted from `vector-rag.ts` so the individual candidate generators
 * (`lib/ai/retrievers/*`) can reuse the *same* isolation filters and pgvector
 * session tuning instead of each growing their own copy. `vector-rag.ts`
 * re-exports these symbols, so every existing import path keeps working.
 *
 * Everything that reaches these helpers is either a Prisma-bound parameter or a
 * structural fragment assembled with `Prisma.sql` / `Prisma.join` — no user
 * input is ever string-interpolated, which keeps the queries injection-proof and
 * (for the vector leg) eligible for the HNSW index plan.
 *
 * @module retrieval-sql
 */

import { Prisma } from "@prisma/client"

/** Filters applied to every retrieval leg (vector, FTS, metadata, citation). */
export interface RetrievalFilter {
  /** Restrict retrieval to a single ingest/document ID. */
  documentId?: string
  /** Restrict retrieval to these ingest/document IDs. An empty array matches nothing. */
  documentIds?: string[]
  /** Restrict retrieval to structural chunk kinds, e.g. ["table"] or ["table","equation"]. */
  kinds?: string[]
  /** Restrict retrieval to fine-grained chunk types, e.g. ["paragraph","table"]. */
  chunkTypes?: string[]
  /** Restrict retrieval to a page window (1-based, inclusive). */
  pageRange?: [number, number]
}

/**
 * ef_search for a retrieval query, scaled to the requested candidate count.
 *
 * HNSW evaluates the index *before* the workspace/document filter, so the
 * default 40 can prune candidate branches before a small workspace fills its
 * result set in a large multi-tenant table. Applied via SET LOCAL —
 * transaction-scoped, so PgBouncer transaction pooling (Supabase port 6543)
 * never leaks the setting.
 *
 * The multiplier is measured, not assumed. `artifacts/eval/pgvector-live.json`
 * (PostgreSQL 18 + pgvector 0.8.1, brute-force ground truth, HNSW confirmed in
 * the EXPLAIN plan) gives mean recall@10 on a workspace+document-filtered query
 * of 0.700 at ef_search=40, 0.933 at 80, 0.967 at 100 and 1.000 at 200. The
 * previous `limit * 8` asked for 80 at topK=10 and therefore shipped below the
 * 0.95 bar the retrieval contract claims. `limit * 20` asks for 200 there,
 * which measured 1.000, and the floor moves 40 → 100 because 40 measured 0.700.
 * Re-measure before changing these again: `pnpm run eval:pgvector`.
 */
export function efSearchFor(limit: number): number {
  return Math.min(1000, Math.max(100, limit * 20))
}

/**
 * Builds a PostgreSQL `websearch_to_tsquery` string from free text: keeps the
 * most informative tokens (length > 3, de-duplicated, max `maxTerms`) and
 * OR-joins them. `plainto_tsquery` ANDs every term, which never matches for a
 * 30–45-word criterion query — this makes the keyword leg of the hybrid
 * search actually contribute.
 */
export function buildFtsQuery(text: string, maxTerms = 8): string {
  const seen = new Set<string>()
  const terms: string[] = []
  for (const raw of text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (raw.length <= 3 || seen.has(raw)) continue
    seen.add(raw)
    terms.push(raw)
    if (terms.length >= maxTerms) break
  }
  return terms.join(" OR ")
}

/**
 * Builds the shared parameterized WHERE fragment for retrieval queries.
 *
 * Returns `Prisma.empty` when no filter applies. An explicitly provided empty
 * `documentIds` array compiles to `AND 1 = 0` (must match nothing) rather than
 * silently dropping the tenant-isolation filter — losing workspace isolation is
 * the one failure mode that is never acceptable here.
 */
export function retrievalJoin(filter: RetrievalFilter = {}): Prisma.Sql {
  const parts: Prisma.Sql[] = []
  if (filter.documentIds !== undefined) {
    parts.push(
      filter.documentIds.length > 0
        ? Prisma.sql`AND "documentId" IN (${Prisma.join(filter.documentIds)})`
        : Prisma.sql`AND 1 = 0`
    )
  } else if (filter.documentId) {
    parts.push(Prisma.sql`AND "documentId" = ${filter.documentId}`)
  }
  if (filter.kinds && filter.kinds.length > 0) {
    parts.push(Prisma.sql`AND kind IN (${Prisma.join(filter.kinds)})`)
  }
  if (filter.chunkTypes && filter.chunkTypes.length > 0) {
    parts.push(Prisma.sql`AND "chunkType" IN (${Prisma.join(filter.chunkTypes)})`)
  }
  if (filter.pageRange) {
    parts.push(Prisma.sql`AND "pageStart" >= ${filter.pageRange[0]} AND COALESCE("pageEnd", "pageStart") <= ${filter.pageRange[1]}`)
  }
  return parts.length > 0 ? Prisma.join(parts, " ") : Prisma.empty
}

/**
 * Applies pgvector session tuning inside the current transaction.
 *
 * Supabase / PgBouncer transaction-pooler contract:
 *  - `SET LOCAL` outside an explicit transaction raises SQLSTATE 25001 on port
 *    6543 (or is silently discarded on connection return); inside one it is
 *    strictly bound to the statement.
 *  - The unknown-GUC risk (pgvector < 0.8 without `iterative_scan`) is guarded
 *    by a `DO $$ … EXCEPTION WHEN OTHERS` block so the SET cannot abort the
 *    whole transaction. Iterative scan is what makes *filtered* approximate
 *    search return a full candidate set on a multi-tenant table.
 *
 * Never throws: tuning is an optimisation, and a failed SET must not fail a review.
 */
export async function applyHnswSessionTuning(client: any, limit: number): Promise<void> {
  if (typeof client?.$executeRawUnsafe !== "function") return
  await client.$executeRawUnsafe(`SET LOCAL hnsw.ef_search = ${efSearchFor(limit)}`).catch(() => {})
  await client
    .$executeRawUnsafe(
      `DO $$ BEGIN PERFORM set_config('hnsw.iterative_scan', 'relaxed_order', true); EXCEPTION WHEN OTHERS THEN NULL; END $$;`
    )
    .catch(() => {})
}

/**
 * Runs `fn` inside a Prisma transaction when the client supports one, otherwise
 * directly. Test mocks expose only `$queryRaw`; both paths stay first-class.
 */
export async function inTransaction<T>(prisma: any, fn: (client: any) => Promise<T>): Promise<T> {
  if (typeof prisma?.$transaction === "function") {
    return prisma.$transaction(async (tx: any) => fn(tx))
  }
  return fn(prisma)
}
