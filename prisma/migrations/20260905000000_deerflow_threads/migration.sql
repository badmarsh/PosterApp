-- DeerFlow integration: per-workspace switch + run/thread mapping.

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN "deerflowEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "DeerflowThread" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deerThreadId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "phase" TEXT,
    "proposal" JSONB,
    "error" TEXT,
    "costEstimateUsd" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeerflowThread_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeerflowThread_deerThreadId_key" ON "DeerflowThread"("deerThreadId");

-- CreateIndex
CREATE INDEX "DeerflowThread_workspaceId_status_idx" ON "DeerflowThread"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "DeerflowThread_userId_idx" ON "DeerflowThread"("userId");

-- AddForeignKey
ALTER TABLE "DeerflowThread" ADD CONSTRAINT "DeerflowThread_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
