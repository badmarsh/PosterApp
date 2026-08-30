-- AlterTable
ALTER TABLE "ThesisReview" ADD COLUMN IF NOT EXISTS "suggestedGrade" TEXT;
ALTER TABLE "ThesisReview" ADD COLUMN IF NOT EXISTS "finalGrade" TEXT;
ALTER TABLE "ThesisReview" ADD COLUMN IF NOT EXISTS "suggestedRecommendation" TEXT;
ALTER TABLE "ThesisReview" ADD COLUMN IF NOT EXISTS "finalRecommendation" TEXT;
ALTER TABLE "ThesisReview" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);
