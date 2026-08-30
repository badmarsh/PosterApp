-- CreateTable
CREATE TABLE "ThesisReview" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "thesisTitle" TEXT NOT NULL,
    "thesisType" TEXT NOT NULL DEFAULT 'master',
    "reviewerRole" TEXT NOT NULL DEFAULT 'opponent',
    "reviewerName" TEXT,
    "institution" TEXT,
    "department" TEXT,
    "grade" TEXT,
    "recommendation" TEXT,
    "sections" TEXT,
    "defenseQuestions" TEXT,
    "citationIssues" TEXT,
    "reviewKind" TEXT NOT NULL DEFAULT 'thesis',
    "targetVenue" TEXT,
    "summary" TEXT,
    "strengths" TEXT,
    "findings" TEXT,
    "reportingStandard" TEXT,
    "reportingGuidelineChecks" TEXT,
    "confidentialComments" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "language" TEXT NOT NULL DEFAULT 'sk',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThesisReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ThesisReview_workspaceId_createdAt_idx" ON "ThesisReview"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_workspaceId_filename_key" ON "Asset"("workspaceId", "filename");

-- AddForeignKey
ALTER TABLE "ThesisReview" ADD CONSTRAINT "ThesisReview_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
