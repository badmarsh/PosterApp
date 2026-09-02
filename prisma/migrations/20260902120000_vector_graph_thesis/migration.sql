-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- AlterTable
ALTER TABLE "Asset" DROP COLUMN "tableRows",
ADD COLUMN     "tableRows" JSONB;

-- AlterTable
ALTER TABLE "Card" DROP COLUMN "table",
ADD COLUMN     "table" JSONB,
DROP COLUMN "figures",
ADD COLUMN     "figures" JSONB,
DROP COLUMN "sourceIds",
ADD COLUMN     "sourceIds" JSONB;

-- AlterTable
ALTER TABLE "IngestFile" ADD COLUMN     "vectorChunks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "vectorIndexedAt" TIMESTAMP(3),
ADD COLUMN     "vectorStatus" TEXT NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "Output" ADD COLUMN     "authors" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "secondaryLogoUrl" TEXT,
ADD COLUMN     "sourceIds" JSONB,
ADD COLUMN     "themeColor" TEXT,
ADD COLUMN     "venue" TEXT;

-- AlterTable
ALTER TABLE "ThesisReview" ADD COLUMN     "analysisPlan" TEXT,
ADD COLUMN     "confidence" DOUBLE PRECISION,
ADD COLUMN     "debateLog" TEXT,
ADD COLUMN     "discipline" TEXT,
ADD COLUMN     "limitationsSummary" TEXT,
ADD COLUMN     "phdEnrichment" TEXT,
ADD COLUMN     "proposedGradeRange" TEXT,
ADD COLUMN     "rubricVersion" TEXT DEFAULT 'sk-academic-v1',
ADD COLUMN     "schemaVersion" TEXT NOT NULL DEFAULT '1.0',
ADD COLUMN     "sourceRevision" TEXT;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "secondaryLogoUrl" TEXT,
DROP COLUMN "bibKeys",
ADD COLUMN     "bibKeys" JSONB,
DROP COLUMN "agentEvents",
ADD COLUMN     "agentEvents" JSONB,
DROP COLUMN "chatMessages",
ADD COLUMN     "chatMessages" JSONB;

-- CreateTable
CREATE TABLE "DocumentChunk" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "heading" TEXT,
    "content" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL,
    "embedding" vector(384),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraphNode" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GraphNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraphEdge" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "evidence" TEXT,
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GraphEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraphCommunity" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "memberNodeIds" JSONB NOT NULL,
    "summary" TEXT,
    "nodeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GraphCommunity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentChunk_workspaceId_idx" ON "DocumentChunk"("workspaceId");

-- CreateIndex
CREATE INDEX "GraphNode_workspaceId_idx" ON "GraphNode"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "GraphNode_workspaceId_label_name_key" ON "GraphNode"("workspaceId", "label", "name");

-- CreateIndex
CREATE INDEX "GraphEdge_workspaceId_idx" ON "GraphEdge"("workspaceId");

-- CreateIndex
CREATE INDEX "GraphEdge_sourceId_idx" ON "GraphEdge"("sourceId");

-- CreateIndex
CREATE INDEX "GraphEdge_targetId_idx" ON "GraphEdge"("targetId");

-- CreateIndex
CREATE INDEX "GraphCommunity_workspaceId_idx" ON "GraphCommunity"("workspaceId");

-- AddForeignKey
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphNode" ADD CONSTRAINT "GraphNode_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphEdge" ADD CONSTRAINT "GraphEdge_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphEdge" ADD CONSTRAINT "GraphEdge_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "GraphNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphEdge" ADD CONSTRAINT "GraphEdge_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "GraphNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphCommunity" ADD CONSTRAINT "GraphCommunity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create HNSW Index
CREATE INDEX IF NOT EXISTS document_chunk_embedding_hnsw
ON "DocumentChunk" USING hnsw (embedding vector_cosine_ops);
