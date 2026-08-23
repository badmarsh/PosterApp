-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "authors" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'unauthenticated',
    "bibContent" TEXT,
    "bibKeys" TEXT,
    "agentEvents" TEXT,
    "chatMessages" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Output" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "outputType" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Output_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "outputId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "column" INTEGER,
    "order" INTEGER NOT NULL,
    "pattern" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "table" TEXT,
    "figures" TEXT,
    "figureLayout" TEXT NOT NULL,
    "sourceIds" TEXT,
    "heightBudget" DOUBLE PRECISION,
    "validation" TEXT NOT NULL,
    "generatedLatex" TEXT,
    "slideNotes" TEXT,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "filename" TEXT,
    "url" TEXT,
    "kind" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "section" TEXT,
    "bbox" TEXT,
    "confidence" TEXT NOT NULL,
    "heading" TEXT,
    "snippet" TEXT,
    "thumbnailUrl" TEXT,
    "caption" TEXT,
    "tableRows" TEXT,
    "assignedCardId" TEXT,
    "assignedSlot" TEXT,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestFile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "progress" INTEGER NOT NULL,
    "error" TEXT,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "IngestFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceSnapshot" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "label" TEXT,
    "revision" INTEGER NOT NULL,
    "snapshot" TEXT NOT NULL,

    CONSTRAINT "WorkspaceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceSnapshot_workspaceId_savedAt_idx" ON "WorkspaceSnapshot"("workspaceId", "savedAt" DESC);

-- AddForeignKey
ALTER TABLE "Output" ADD CONSTRAINT "Output_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_outputId_fkey" FOREIGN KEY ("outputId") REFERENCES "Output"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_assignedCardId_fkey" FOREIGN KEY ("assignedCardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestFile" ADD CONSTRAINT "IngestFile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceSnapshot" ADD CONSTRAINT "WorkspaceSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
