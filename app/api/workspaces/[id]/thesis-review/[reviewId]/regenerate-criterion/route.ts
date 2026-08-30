/**
 * POST /api/workspaces/[id]/thesis-review/[reviewId]/regenerate-criterion
 *
 * Regenerates or refines a single thesis evaluation criterion using:
 *  1. Section-routed RAG from MinerU parsed thesis sources
 *  2. Target criterion rubric guidance
 *  3. AI generation via ThesisSingleSectionSchema
 */

import { NextRequest, NextResponse } from "next/server"
import { rateLimitAsync } from "@/lib/rate-limit"
import { requireWorkspaceEditor } from "@/lib/auth"
import { generateAIResponse } from "@/lib/ai/client"
import { ThesisSingleSectionSchema } from "@/lib/ai/contracts"
import { resolveAiModel, AI_TIMEOUTS } from "@/lib/ai/models"
import { wrapUntrustedContext } from "@/lib/ai/prompts"
import { loadThesisContext, buildCriterionContext, buildThesisContextHeader } from "@/lib/ai/thesis-context"
import {
  THESIS_CRITERIA,
  type ReviewLanguage,
  type ThesisSection,
  type ThesisMetadata,
  computeOverallScore,
  scoreToEctsGrade,
} from "@/lib/ai/thesis-rubric"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const RegenerateRequestSchema = z.object({
  criterionId: z.string().min(1).max(100),
  userInstruction: z.string().max(1000).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string }> }
) {
  const { id: workspaceId, reviewId } = await params

  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId) || !/^[a-zA-Z0-9_-]+$/.test(reviewId)) {
    return NextResponse.json({ error: "Invalid workspace or review ID" }, { status: 400 })
  }

  let userId: string
  try {
    const access = await requireWorkspaceEditor(workspaceId)
    userId = access.userId
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:thesis-regen`, 10, 300_000)
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limited", retryAfterMs },
      { status: 429, headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() } }
    )
  }

  let body: z.infer<typeof RegenerateRequestSchema>
  try {
    const raw = await req.json()
    body = RegenerateRequestSchema.parse(raw)
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body", details: String(err) }, { status: 400 })
  }

  const { criterionId, userInstruction } = body

  const review = await prisma.thesisReview.findFirst({
    where: { id: reviewId, workspaceId },
  })

  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 })
  }

  const criterion = THESIS_CRITERIA.find((c) => c.id === criterionId)
  if (!criterion) {
    return NextResponse.json({ error: "Unknown criterion ID" }, { status: 400 })
  }

  const lang = (review.language || "sk") as ReviewLanguage

  try {
    const thesisMetadata: ThesisMetadata = {
      studentName: review.studentName,
      thesisTitle: review.thesisTitle,
      thesisType: review.thesisType as any,
      reviewerRole: review.reviewerRole as any,
      reviewerName: review.reviewerName ?? undefined,
      institution: review.institution ?? undefined,
      department: review.department ?? undefined,
      language: lang,
    }

    const ragContext = await loadThesisContext({
      workspaceId,
      thesisMetadata,
      focusSections: [criterionId],
      maxChars: 40_000,
    })

    const criterionContext = buildCriterionContext(criterionId, ragContext, 12_000)
    const contextHeader = buildThesisContextHeader(thesisMetadata, lang)

    const systemPrompt = `You are an expert academic thesis reviewer. You evaluate one specific criterion of a thesis rigorously and objectively in ${lang === "sk" ? "Slovak" : lang === "cs" ? "Czech" : "English"}.`

    const userPrompt = `${wrapUntrustedContext("ThesisMetadata", contextHeader)}

${wrapUntrustedContext("TargetCriterion", `ID: ${criterion.id}
Label: ${criterion.labels[lang]}
Weight: ${criterion.weight}%
Guidance: ${criterion.guidance[lang]}`)}

${wrapUntrustedContext("ThesisDocumentExcerpt", criterionContext || "No excerpt found. Base assessment on general academic standards.")}

${userInstruction ? wrapUntrustedContext("ReviewerSpecialInstructions", userInstruction) : ""}

Write an updated, grounded evaluation for this criterion (2-4 concise sentences), suggest 1-2 concrete improvements, and assign an ECTS grade (A/B/C/D/E/FX) with a numeric score (0-100).

Return JSON format:
{
  "text": "<evaluation in ${lang}>",
  "rating": "<A|B|C|D|E|FX>",
  "numericScore": <0-100>,
  "suggestions": ["<suggestion 1>"]
}`

    const result = await generateAIResponse("thesis-regen-criterion", {
      model: resolveAiModel("thesis"),
      systemPrompt,
      userPrompt,
      schema: ThesisSingleSectionSchema,
      temperature: 0.2,
      signal: AbortSignal.timeout(AI_TIMEOUTS.thesis),
    })

    const currentSections: ThesisSection[] = review.sections ? JSON.parse(review.sections) : []
    const existingIndex = currentSections.findIndex((s) => s.criterionId === criterionId || s.sectionId === criterionId)

    const updatedSection: ThesisSection = {
      id: criterionId,
      sectionId: criterionId,
      criterionId,
      text: result.text,
      rating: result.rating as any,
      numericScore: result.numericScore,
      suggestions: result.suggestions ?? [],
    }

    if (existingIndex >= 0) {
      currentSections[existingIndex] = updatedSection
    } else {
      currentSections.push(updatedSection)
    }

    const newScore = computeOverallScore(currentSections)
    const newGrade = newScore != null ? scoreToEctsGrade(newScore) : review.grade

    await prisma.thesisReview.update({
      where: { id: reviewId },
      data: {
        sections: JSON.stringify(currentSections),
        grade: newGrade,
      },
    })

    return NextResponse.json({
      section: updatedSection,
      sections: currentSections,
      overallScore: newScore,
      grade: newGrade,
    })
  } catch (error: unknown) {
    if (error instanceof Response) return error
    console.error("[thesis-regen-criterion POST] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
