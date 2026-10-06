-- AddColumn
ALTER TABLE "WorkspaceSnapshot" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'human';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkspaceSnapshot_workspaceId_source_idx" ON "WorkspaceSnapshot"("workspaceId", "source");
