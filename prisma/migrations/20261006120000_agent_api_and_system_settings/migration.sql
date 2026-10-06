-- CreateEnum
CREATE TYPE "AgentChangeStatus" AS ENUM ('pending', 'approved', 'rejected', 'expired', 'applied', 'failed');

-- CreateTable
CREATE TABLE "AgentApiKey" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scopes" TEXT[],
    "workspaceId" TEXT,
    "restrictCardIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AgentApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentPendingChange" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "payload" JSONB NOT NULL,
    "diffPreview" JSONB,
    "rationale" TEXT,
    "status" "AgentChangeStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "snapshotId" TEXT,
    "error" TEXT,

    CONSTRAINT "AgentPendingChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentToolCallLog" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "toolName" TEXT NOT NULL,
    "args" JSONB NOT NULL,
    "result" JSONB,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "errorCode" TEXT,
    "durationMs" INTEGER,
    "changeId" TEXT,
    "calledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentToolCallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentApiKey_tokenHash_key" ON "AgentApiKey"("tokenHash");

-- CreateIndex
CREATE INDEX "AgentApiKey_tokenHash_idx" ON "AgentApiKey"("tokenHash");

-- CreateIndex
CREATE INDEX "AgentApiKey_userId_idx" ON "AgentApiKey"("userId");

-- CreateIndex
CREATE INDEX "AgentApiKey_workspaceId_idx" ON "AgentApiKey"("workspaceId");

-- CreateIndex
CREATE INDEX "AgentPendingChange_workspaceId_status_idx" ON "AgentPendingChange"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "AgentPendingChange_apiKeyId_idx" ON "AgentPendingChange"("apiKeyId");

-- CreateIndex
CREATE INDEX "AgentToolCallLog_workspaceId_calledAt_idx" ON "AgentToolCallLog"("workspaceId", "calledAt");

-- CreateIndex
CREATE INDEX "AgentToolCallLog_apiKeyId_calledAt_idx" ON "AgentToolCallLog"("apiKeyId", "calledAt");

-- AddForeignKey
ALTER TABLE "AgentApiKey" ADD CONSTRAINT "AgentApiKey_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPendingChange" ADD CONSTRAINT "AgentPendingChange_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPendingChange" ADD CONSTRAINT "AgentPendingChange_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "AgentApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentToolCallLog" ADD CONSTRAINT "AgentToolCallLog_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "AgentApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

