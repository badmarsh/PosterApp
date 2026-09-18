-- ============================================================================
-- pgvector HNSW tuning for the thesis-review corpus
--
-- NOT a Prisma migration. `prisma migrate deploy` never touches this file; run
-- it by hand, on purpose, against a specific database:
--
--     psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/scripts/tune-hnsw.sql
--
-- Why this is opt-in rather than a migration:
--   * CREATE INDEX CONCURRENTLY cannot run inside a transaction block, and
--     Prisma wraps each migration in one.
--   * Rebuilding the index on a 200-page dissertation corpus takes minutes and
--     blocks writes to "DocumentChunk" unless CONCURRENTLY is used.
--   * m and ef_construction are a storage/recall tradeoff. Whether raising them
--     pays depends on corpus size, which only the operator knows.
--
-- The index being tuned is `document_chunk_embedding_hnsw`, created by
-- prisma/migrations/20260902120000_vector_graph_thesis/migration.sql using
-- pgvector's defaults (m=16, ef_construction=64).
--
-- Query-time recall is a separate control: `SET LOCAL hnsw.ef_search`, applied
-- per transaction by lib/ai/retrieval-sql.ts::applyHnswSessionTuning.
--
-- Running this file as-is performs ONLY the read-only inspection below. The
-- rebuild is commented out and must be uncommented deliberately.
-- ============================================================================

\set ON_ERROR_STOP on

-- --- 1. What is the index today? -------------------------------------------

\echo '--- current index definition ---'
SELECT indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'DocumentChunk'
  AND indexname = 'document_chunk_embedding_hnsw';

-- Empty reloptions means the index is on pgvector defaults (m=16,
-- ef_construction=64), i.e. a rebuild would change something.
\echo '--- current index options (no rows = pgvector defaults) ---'
SELECT option_name, option_value
FROM pg_class c
JOIN pg_index i ON i.indexrelid = c.oid
CROSS JOIN LATERAL pg_options_to_table(c.reloptions)
WHERE c.relname = 'document_chunk_embedding_hnsw'
  AND option_name IN ('m', 'ef_construction');

\echo '--- rows to be indexed ---'
SELECT count(*) AS total_chunks,
       count(embedding) AS chunks_with_embedding
FROM "DocumentChunk";

-- --- 2. Is iterative scan available? ---------------------------------------
--
-- Filtered (workspace-scoped) approximate search needs pgvector >= 0.8.
-- Without it, HNSW evaluates the index *before* the workspace/document filter,
-- so a small workspace inside a large multi-tenant table can come back short.
-- lib/ai/retrieval-sql.ts enables iterative_scan per transaction inside a
-- guarded DO block, so an older pgvector degrades instead of aborting.

\echo '--- pgvector version (iterative scan requires >= 0.8.0) ---'
SELECT extversion FROM pg_extension WHERE extname = 'vector';

-- --- 3. The rebuild (commented out on purpose) -----------------------------
--
-- Suggested parameters for a corpus of 10k-200k chunks: m=24,
-- ef_construction=128. Larger corpora can go higher; both raise index size and
-- build time.
--
-- CONCURRENTLY builds a second index and swaps it in without blocking writes.
-- Each statement must run outside a transaction block, so execute them one at a
-- time rather than wrapping them in BEGIN/COMMIT.
--
-- A CONCURRENTLY build that fails part-way leaves an INVALID index behind.
-- Drop it before retrying:
--
--   DROP INDEX CONCURRENTLY IF EXISTS document_chunk_embedding_hnsw_new;
--
-- Then:
--
--   CREATE INDEX CONCURRENTLY document_chunk_embedding_hnsw_new
--     ON "DocumentChunk" USING hnsw (embedding vector_cosine_ops)
--     WITH (m = 24, ef_construction = 128);
--
--   ALTER INDEX document_chunk_embedding_hnsw RENAME TO document_chunk_embedding_hnsw_old;
--   ALTER INDEX document_chunk_embedding_hnsw_new RENAME TO document_chunk_embedding_hnsw;
--   DROP INDEX CONCURRENTLY document_chunk_embedding_hnsw_old;
--
-- Verify afterwards that the new index is valid:
--
--   SELECT indexrelid::regclass, indisvalid
--   FROM pg_index
--   WHERE indexrelid = 'document_chunk_embedding_hnsw'::regclass;

\echo 'Done. The rebuild above is commented out; uncomment it deliberately to proceed.'
