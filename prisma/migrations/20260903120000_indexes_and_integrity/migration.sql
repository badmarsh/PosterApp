-- Hardening audit follow-up: query indexes, owner integrity, role integrity.

-- Workspace.userId: drop the "unauthenticated" default so owner-less rows fail loudly.
ALTER TABLE "Workspace" ALTER COLUMN "userId" DROP DEFAULT;

-- Role values are validated in lib/auth.ts; enforce the same set at the DB.
ALTER TABLE "WorkspaceMember"
  ADD CONSTRAINT "WorkspaceMember_role_check" CHECK ("role" IN ('owner', 'editor', 'viewer'));

-- Indexes for the per-workspace loads that previously sequential-scanned.
CREATE INDEX IF NOT EXISTS "Workspace_userId_idx" ON "Workspace"("userId");
CREATE INDEX IF NOT EXISTS "Output_workspaceId_idx" ON "Output"("workspaceId");
CREATE INDEX IF NOT EXISTS "Card_outputId_idx" ON "Card"("outputId");
CREATE INDEX IF NOT EXISTS "Asset_workspaceId_idx" ON "Asset"("workspaceId");
CREATE INDEX IF NOT EXISTS "Asset_assignedCardId_idx" ON "Asset"("assignedCardId");
CREATE INDEX IF NOT EXISTS "IngestFile_workspaceId_idx" ON "IngestFile"("workspaceId");
CREATE INDEX IF NOT EXISTS "DocumentChunk_workspaceId_documentId_idx" ON "DocumentChunk"("workspaceId", "documentId");
CREATE INDEX IF NOT EXISTS "GraphNode_workspaceId_documentId_idx" ON "GraphNode"("workspaceId", "documentId");
