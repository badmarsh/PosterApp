-- ============================================================================
-- Evidence-first retrieval, hierarchical chunks, citation graph, graph
-- provenance, observability and evaluation storage.
--
-- SAFETY CONTRACT
--   * Every ALTER TABLE ... ADD COLUMN is nullable or carries a DEFAULT, so the
--     migration never rewrites or invalidates an existing row.
--   * No column is renamed, retyped or dropped. No table is dropped.
--   * All DDL is guarded with IF NOT EXISTS / IF EXISTS so the migration is
--     re-runnable and safe to apply to a database that was partially migrated.
--   * Existing documents stay readable: chunks written by chunker v1 simply have
--     NULL hierarchy columns, and every consumer treats NULL as "unknown"
--     (never as a fabricated page number or section).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "vector";

-- ----------------------------------------------------------------------------
-- DocumentChunk — evidence-first hierarchy + provenance versions
-- ----------------------------------------------------------------------------
ALTER TABLE "DocumentChunk" ADD COLUMN IF NOT EXISTS "chunkType" TEXT NOT NULL DEFAULT 'paragraph';
ALTER TABLE "DocumentChunk" ADD COLUMN IF NOT EXISTS "ordinal" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DocumentChunk" ADD COLUMN IF NOT EXISTS "pageStart" INTEGER;
ALTER TABLE "DocumentChunk" ADD COLUMN IF NOT EXISTS "pageEnd" INTEGER;
ALTER TABLE "DocumentChunk" ADD COLUMN IF NOT EXISTS "chapter" TEXT;
ALTER TABLE "DocumentChunk" ADD COLUMN IF NOT EXISTS "section" TEXT;
ALTER TABLE "DocumentChunk" ADD COLUMN IF NOT EXISTS "subsection" TEXT;
ALTER TABLE "DocumentChunk" ADD COLUMN IF NOT EXISTS "sectionPath" TEXT;
ALTER TABLE "DocumentChunk" ADD COLUMN IF NOT EXISTS "sourceElementIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "DocumentChunk" ADD COLUMN IF NOT EXISTS "parentChunkId" TEXT;
ALTER TABLE "DocumentChunk" ADD COLUMN IF NOT EXISTS "previousChunkId" TEXT;
ALTER TABLE "DocumentChunk" ADD COLUMN IF NOT EXISTS "nextChunkId" TEXT;
ALTER TABLE "DocumentChunk" ADD COLUMN IF NOT EXISTS "characterCount" INTEGER;
ALTER TABLE "DocumentChunk" ADD COLUMN IF NOT EXISTS "oversized" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DocumentChunk" ADD COLUMN IF NOT EXISTS "contentHash" TEXT;
ALTER TABLE "DocumentChunk" ADD COLUMN IF NOT EXISTS "parserVersion" TEXT;
ALTER TABLE "DocumentChunk" ADD COLUMN IF NOT EXISTS "chunkerVersion" TEXT;
ALTER TABLE "DocumentChunk" ADD COLUMN IF NOT EXISTS "embeddingModelVersion" TEXT;
ALTER TABLE "DocumentChunk" ADD COLUMN IF NOT EXISTS "schemaVersion" TEXT DEFAULT '1.0';

-- Backfill for pre-existing rows: keep the coarse `kind` view consistent with the
-- new fine-grained `chunkType` so kind-based filters behave identically.
UPDATE "DocumentChunk" SET "chunkType" = "table"          WHERE "chunkType" = 'paragraph' AND "kind" = 'table';
UPDATE "DocumentChunk" SET "chunkType" = "equation"       WHERE "chunkType" = 'paragraph' AND "kind" = 'equation';
UPDATE "DocumentChunk" SET "chunkType" = "figure_caption" WHERE "chunkType" = 'paragraph' AND "kind" = 'figure_caption';
UPDATE "DocumentChunk" SET "characterCount" = length("content") WHERE "characterCount" IS NULL;
-- NOTE: `contentHash` is intentionally NOT backfilled here. Hashing 200k+ rows inside a
-- migration would need pgcrypto (not guaranteed to be installed) and would lock the table.
-- The reindex path computes it, and `NULL` is a legitimate "indexed before hashing" state
-- that the incremental-reindex logic treats as "must re-embed".

CREATE INDEX IF NOT EXISTS "DocumentChunk_workspaceId_documentId_ordinal_idx"
  ON "DocumentChunk" ("workspaceId", "documentId", "ordinal");
CREATE INDEX IF NOT EXISTS "DocumentChunk_workspaceId_chunkType_idx"
  ON "DocumentChunk" ("workspaceId", "chunkType");
CREATE INDEX IF NOT EXISTS "DocumentChunk_workspaceId_parentChunkId_idx"
  ON "DocumentChunk" ("workspaceId", "parentChunkId");
CREATE INDEX IF NOT EXISTS "DocumentChunk_workspaceId_pageStart_idx"
  ON "DocumentChunk" ("workspaceId", "pageStart");
-- Content-hash lookup makes incremental reindex skip unchanged chunks.
CREATE INDEX IF NOT EXISTS "DocumentChunk_workspaceId_contentHash_idx"
  ON "DocumentChunk" ("workspaceId", "contentHash");

-- ----------------------------------------------------------------------------
-- Evidence — verbatim, page-anchored spans a finding may cite
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Evidence" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "page" INTEGER,
    "sectionPath" TEXT,
    "elementType" TEXT NOT NULL DEFAULT 'paragraph',
    "elementId" TEXT,
    "quote" TEXT NOT NULL,
    "startOffset" INTEGER,
    "endOffset" INTEGER,
    "origin" TEXT NOT NULL DEFAULT 'retrieval',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Evidence_workspaceId_documentId_idx" ON "Evidence" ("workspaceId", "documentId");
CREATE INDEX IF NOT EXISTS "Evidence_chunkId_idx" ON "Evidence" ("chunkId");
CREATE INDEX IF NOT EXISTS "Evidence_workspaceId_elementType_idx" ON "Evidence" ("workspaceId", "elementType");

ALTER TABLE "Evidence" DROP CONSTRAINT IF EXISTS "Evidence_workspaceId_fkey";
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Evidence" DROP CONSTRAINT IF EXISTS "Evidence_chunkId_fkey";
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_chunkId_fkey"
  FOREIGN KEY ("chunkId") REFERENCES "DocumentChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- ThesisClaim — explicit, verifiable claim objects
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ThesisClaim" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkId" TEXT,
    "claimKey" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "claimType" TEXT NOT NULL DEFAULT 'empirical',
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "chapter" TEXT,
    "section" TEXT,
    "page" INTEGER,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "verificationStatus" TEXT,
    "verification" JSONB,
    "citedPaperIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "extractorVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThesisClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ThesisClaim_workspaceId_claimKey_key" ON "ThesisClaim" ("workspaceId", "claimKey");
CREATE INDEX IF NOT EXISTS "ThesisClaim_workspaceId_documentId_idx" ON "ThesisClaim" ("workspaceId", "documentId");
CREATE INDEX IF NOT EXISTS "ThesisClaim_workspaceId_claimType_idx" ON "ThesisClaim" ("workspaceId", "claimType");
CREATE INDEX IF NOT EXISTS "ThesisClaim_workspaceId_verificationStatus_idx" ON "ThesisClaim" ("workspaceId", "verificationStatus");

ALTER TABLE "ThesisClaim" DROP CONSTRAINT IF EXISTS "ThesisClaim_workspaceId_fkey";
ALTER TABLE "ThesisClaim" ADD CONSTRAINT "ThesisClaim_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThesisClaim" DROP CONSTRAINT IF EXISTS "ThesisClaim_chunkId_fkey";
ALTER TABLE "ThesisClaim" ADD CONSTRAINT "ThesisClaim_chunkId_fkey"
  FOREIGN KEY ("chunkId") REFERENCES "DocumentChunk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Implicit many-to-many ThesisClaim <-> Evidence (relation name "ClaimEvidence").
CREATE TABLE IF NOT EXISTS "_ClaimEvidence" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "_ClaimEvidence_AB_unique" ON "_ClaimEvidence" ("A", "B");
CREATE INDEX IF NOT EXISTS "_ClaimEvidence_B_index" ON "_ClaimEvidence" ("B");
ALTER TABLE "_ClaimEvidence" DROP CONSTRAINT IF EXISTS "_ClaimEvidence_A_fkey";
ALTER TABLE "_ClaimEvidence" ADD CONSTRAINT "_ClaimEvidence_A_fkey"
  FOREIGN KEY ("A") REFERENCES "ThesisClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ClaimEvidence" DROP CONSTRAINT IF EXISTS "_ClaimEvidence_B_fkey";
ALTER TABLE "_ClaimEvidence" ADD CONSTRAINT "_ClaimEvidence_B_fkey"
  FOREIGN KEY ("B") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- ScholarlyPaper + CitationOccurrence — citations as structured objects
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ScholarlyPaper" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "doi" TEXT,
    "titleKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "year" INTEGER,
    "publicationDate" TIMESTAMP(3),
    "venue" TEXT,
    "abstract" TEXT,
    "citationCount" INTEGER,
    "sourceProvider" TEXT NOT NULL DEFAULT 'merged',
    "provenance" JSONB,
    "externalId" TEXT,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScholarlyPaper_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ScholarlyPaper_workspaceId_titleKey_key" ON "ScholarlyPaper" ("workspaceId", "titleKey");
CREATE INDEX IF NOT EXISTS "ScholarlyPaper_workspaceId_doi_idx" ON "ScholarlyPaper" ("workspaceId", "doi");
CREATE INDEX IF NOT EXISTS "ScholarlyPaper_workspaceId_year_idx" ON "ScholarlyPaper" ("workspaceId", "year");

ALTER TABLE "ScholarlyPaper" DROP CONSTRAINT IF EXISTS "ScholarlyPaper_workspaceId_fkey";
ALTER TABLE "ScholarlyPaper" ADD CONSTRAINT "ScholarlyPaper_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "CitationOccurrence" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "chunkId" TEXT,
    "page" INTEGER,
    "context" TEXT,
    "relation" TEXT NOT NULL DEFAULT 'unknown',
    "startOffset" INTEGER,
    "endOffset" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CitationOccurrence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CitationOccurrence_workspaceId_documentId_idx" ON "CitationOccurrence" ("workspaceId", "documentId");
CREATE INDEX IF NOT EXISTS "CitationOccurrence_paperId_idx" ON "CitationOccurrence" ("paperId");
CREATE INDEX IF NOT EXISTS "CitationOccurrence_workspaceId_chunkId_idx" ON "CitationOccurrence" ("workspaceId", "chunkId");

ALTER TABLE "CitationOccurrence" DROP CONSTRAINT IF EXISTS "CitationOccurrence_workspaceId_fkey";
ALTER TABLE "CitationOccurrence" ADD CONSTRAINT "CitationOccurrence_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CitationOccurrence" DROP CONSTRAINT IF EXISTS "CitationOccurrence_paperId_fkey";
ALTER TABLE "CitationOccurrence" ADD CONSTRAINT "CitationOccurrence_paperId_fkey"
  FOREIGN KEY ("paperId") REFERENCES "ScholarlyPaper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- GraphRAG 2.0 — provenance + confidence on edges, hierarchy on communities
-- ----------------------------------------------------------------------------
ALTER TABLE "GraphNode" ADD COLUMN IF NOT EXISTS "canonicalKey" TEXT;
ALTER TABLE "GraphNode" ADD COLUMN IF NOT EXISTS "page" INTEGER;
ALTER TABLE "GraphNode" ADD COLUMN IF NOT EXISTS "chunkId" TEXT;
ALTER TABLE "GraphNode" ADD COLUMN IF NOT EXISTS "extractorVersion" TEXT;
CREATE INDEX IF NOT EXISTS "GraphNode_workspaceId_label_idx" ON "GraphNode" ("workspaceId", "label");

ALTER TABLE "GraphEdge" ADD COLUMN IF NOT EXISTS "chunkId" TEXT;
ALTER TABLE "GraphEdge" ADD COLUMN IF NOT EXISTS "page" INTEGER;
ALTER TABLE "GraphEdge" ADD COLUMN IF NOT EXISTS "confidence" DOUBLE PRECISION;
ALTER TABLE "GraphEdge" ADD COLUMN IF NOT EXISTS "extractorVersion" TEXT;
CREATE INDEX IF NOT EXISTS "GraphEdge_workspaceId_relation_idx" ON "GraphEdge" ("workspaceId", "relation");
CREATE INDEX IF NOT EXISTS "GraphEdge_workspaceId_chunkId_idx" ON "GraphEdge" ("workspaceId", "chunkId");

ALTER TABLE "GraphCommunity" ADD COLUMN IF NOT EXISTS "level" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GraphCommunity" ADD COLUMN IF NOT EXISTS "parentCommunityId" TEXT;
ALTER TABLE "GraphCommunity" ADD COLUMN IF NOT EXISTS "evidenceIds" JSONB;
ALTER TABLE "GraphCommunity" ADD COLUMN IF NOT EXISTS "summaryEmbedding" vector(384);
ALTER TABLE "GraphCommunity" ADD COLUMN IF NOT EXISTS "extractorVersion" TEXT;
CREATE INDEX IF NOT EXISTS "GraphCommunity_workspaceId_level_idx" ON "GraphCommunity" ("workspaceId", "level");
CREATE INDEX IF NOT EXISTS "GraphCommunity_parentCommunityId_idx" ON "GraphCommunity" ("parentCommunityId");

ALTER TABLE "GraphCommunity" DROP CONSTRAINT IF EXISTS "GraphCommunity_parentCommunityId_fkey";
ALTER TABLE "GraphCommunity" ADD CONSTRAINT "GraphCommunity_parentCommunityId_fkey"
  FOREIGN KEY ("parentCommunityId") REFERENCES "GraphCommunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- Observability + evaluation storage
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "RetrievalTrace" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "reviewId" TEXT,
    "criterion" TEXT,
    "queryCategory" TEXT,
    "query" TEXT,
    "route" TEXT,
    "candidateCounts" JSONB,
    "ranking" JSONB,
    "selectedEvidenceIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "graphNodeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "communityIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "promptTokens" INTEGER,
    "modelVersions" JSONB,
    "stageLatencyMs" JSONB,
    "totalLatencyMs" INTEGER,
    "degraded" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetrievalTrace_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RetrievalTrace_workspaceId_createdAt_idx" ON "RetrievalTrace" ("workspaceId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "RetrievalTrace_workspaceId_criterion_idx" ON "RetrievalTrace" ("workspaceId", "criterion");

ALTER TABLE "RetrievalTrace" DROP CONSTRAINT IF EXISTS "RetrievalTrace_workspaceId_fkey";
ALTER TABLE "RetrievalTrace" ADD CONSTRAINT "RetrievalTrace_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "EvalRun" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB,
    "metrics" JSONB,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "error" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvalRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EvalRun_kind_createdAt_idx" ON "EvalRun" ("kind", "createdAt" DESC);

-- ----------------------------------------------------------------------------
-- pgvector production tuning (idempotent, non-destructive)
--
-- The HNSW index created by 20260902120000 uses pgvector's defaults (m=16,
-- ef_construction=64). Those are fine for a few thousand chunks and measurably
-- weak for a 200-page dissertation corpus. The index is only rebuilt when the
-- operator opts in, because a rebuild locks writes and takes minutes.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/scripts/tune-hnsw.sql
--
-- Filtered (workspace-scoped) approximate search needs pgvector >= 0.8's
-- iterative scan; the retrieval code enables it per-transaction and already
-- degrades gracefully on older versions.
-- ----------------------------------------------------------------------------
