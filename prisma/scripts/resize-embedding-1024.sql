-- Resize vector columns from 384 → 1024 for qwen3.7-text-embedding
-- Safe to run on empty tables (arena DB has 0 chunks currently)
-- Run against: postgresql://posterapp:<password>@dev.significa.sk:5435/posterapp

ALTER TABLE  DocumentChunk
  ALTER COLUMN embedding TYPE vector(1024)
  USING embedding::vector(1024);

ALTER TABLE DocumentChunk
  ALTER COLUMN summaryEmbedding TYPE vector(1024)
  USING summaryEmbedding::vector(1024);

-- Drop and recreate HNSW index with correct dimensions
DROP INDEX IF EXISTS document_chunk_embedding_hnsw;

CREATE INDEX document_chunk_embedding_hnsw
  ON DocumentChunk USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 128);

-- Verify
SELECT
  attname,
  atttypmod AS declared_dim
FROM pg_attribute
WHERE attrelid = 'DocumentChunk'::regclass
  AND attname IN ('embedding', 'summaryEmbedding');
