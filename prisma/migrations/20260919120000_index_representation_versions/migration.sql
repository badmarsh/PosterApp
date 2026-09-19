-- ============================================================================
-- Index representation versioning + semantic community retrieval storage.
--
-- SAFETY CONTRACT (same as 20260918120000)
--   * Every ADD COLUMN is nullable or carries a DEFAULT — no row is rewritten.
--   * No column is renamed, retyped or dropped. No table is dropped.
--   * All DDL is guarded IF [NOT] EXISTS, so the migration is re-runnable.
--   * Existing rows keep working: NULL provenance means "unknown", and
--     lib/ai/index-version.ts classifies "unknown" as needing reindex rather
--     than treating it as current.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- DocumentChunk — the full representation chain
-- ----------------------------------------------------------------------------
ALTER TABLE "DocumentChunk" ADD COLUMN IF NOT EXISTS "tokenEstimatorVersion" TEXT;
ALTER TABLE "DocumentChunk" ADD COLUMN IF NOT EXISTS "embeddingDimensions" INTEGER;
ALTER TABLE "DocumentChunk" ADD COLUMN IF NOT EXISTS "indexVersion" TEXT;

-- Staleness is answered per document, so the lookup is (workspace, document, indexVersion).
CREATE INDEX IF NOT EXISTS "DocumentChunk_workspaceId_indexVersion_idx"
  ON "DocumentChunk" ("workspaceId", "indexVersion");
CREATE INDEX IF NOT EXISTS "DocumentChunk_workspaceId_embeddingModelVersion_idx"
  ON "DocumentChunk" ("workspaceId", "embeddingModelVersion");

-- ----------------------------------------------------------------------------
-- GraphCommunity — reproducible, model-tagged summaries
-- ----------------------------------------------------------------------------
ALTER TABLE "GraphCommunity" ADD COLUMN IF NOT EXISTS "summaryEmbeddingModel" TEXT;
ALTER TABLE "GraphCommunity" ADD COLUMN IF NOT EXISTS "summaryVersion" TEXT;

-- Community retrieval is now a nearest-neighbour search over summaries, not a
-- `ORDER BY nodeCount`. It needs an index. `IF NOT EXISTS` on an index name is
-- supported from PostgreSQL 9.5; the vector opclass matches DocumentChunk's.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'graph_community_summary_embedding_hnsw'
  ) THEN
    CREATE INDEX "graph_community_summary_embedding_hnsw"
      ON "GraphCommunity" USING hnsw ("summaryEmbedding" vector_cosine_ops);
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- A community index is an optimisation over a table of tens of rows. If the
  -- installed pgvector predates HNSW the sequential scan is still correct.
  RAISE NOTICE 'graph community HNSW index skipped: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS "GraphCommunity_workspaceId_summaryVersion_idx"
  ON "GraphCommunity" ("workspaceId", "summaryVersion");
