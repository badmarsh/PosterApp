/**
 * POST /api/workspaces/[id]/thesis-review
 *
 * Generates a complete thesis assessment (posudok). Two execution modes:
 *   - default synchronous: runs the full pipeline and returns the saved review
 *     (legacy behaviour; suitable for short/fast reviews);
 *   - streaming job: body `{ stream: true }` starts a detached job, returns
 *     `{ jobId }`, and progress is streamed over
 *       GET  /thesis-review/jobs/[jobId]/stream  (SSE: stage events)
 *     with cancellation via
 *       DELETE /thesis-review/jobs/[jobId].
 *
 * Rate limit: 3 requests per 5 minutes per user.
 */

import { NextRequest, NextResponse } from "next/server"
import { rateLimitAsync } from "@/lib/rate-limit"
import { requireWorkspaceEditor } from "@/lib/auth"
import { runReviewPipeline } from "@/lib/ai/review-pipeline"
import { reviewJobManager } from "@/lib/review-jobs"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const ThesisMetadataSchema = z.object({
  studentName: z.string().max(200).default("Študent / Autor"),
  thesisTitle: z.string().min(1).max(500),
  thesisType: z.enum(["bachelor", "master", "phd"]).default("master"),
  reviewerRole: z.string().max(50).default("opponent"),
  reviewerName: z.string().max(200).optional(),
  institution: z.string().max(300).optional(),
  department: z.string().max(300).optional(),
  language: z.enum(["sk", "cs", "en"]).default("sk"),
  academicYear: z.string().max(20).optional(),
  reviewKind: z.enum(["thesis", "paper", "grant"]).default("thesis"),
  targetVenue: z.string().max(300).optional(),
  reportingStandard: z.enum(["consort", "prisma", "strobe", "ml_reproducibility", "none"]).default("none"),
})

const RequestBodySchema = z.object({
  thesisMetadata: ThesisMetadataSchema,
  sourceFileId: z.string().optional(),
  focusCriteria: z.array(z.string()).optional(),
  skipCitationAudit: z.boolean().default(false),
  professionalMode: z.boolean().optional(),
  reviewTone: z.enum(["formal", "constructive"]).optional(),
  multiAgentDebate: z.boolean().optional().default(false),
  rubricTemplateId: z.string().optional(),
  customWeights: z.record(z.string(), z.number()).optional(),
  /** Run as a detached, cancellable, progress-streaming job (returns jobId). */
  stream: z.boolean().optional().default(false),
  /** Use the agentic per-criterion decomposition (default true for pro mode). */
  agenticReview: z.boolean().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params

  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId)) {
    return NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 })
  }

  let userId: string
  try {
    const access = await requireWorkspaceEditor(workspaceId)
    userId = access.userId
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:thesis-review`, 3, 300_000)
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limited", retryAfterMs },
      { status: 429, headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() } }
    )
  }

  let body: z.infer<typeof RequestBodySchema>
  try {
    const raw = await req.json()
    body = RequestBodySchema.parse(raw)
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body", details: String(err) }, { status: 400 })
  }

  // ---- Streaming job mode ------------------------------------------------
  if (body.stream) {
    const state = reviewJobManager.start(workspaceId, userId, async (report, signal) => {
      const { responsePayload } = await runReviewPipeline({
        workspaceId,
        userId,
        body,
        headers: req.headers,
        onProgress: (stage, detail) => report(stage, detail),
        signal,
      })
      return responsePayload
    })
    return NextResponse.json({ jobId: state.id, status: state.status })
  }

  // ---- Synchronous mode (legacy) -----------------------------------------
  try {
    const { responsePayload } = await runReviewPipeline({ workspaceId, userId, body, headers: req.headers })
    return NextResponse.json(responsePayload)
  } catch (error: unknown) {
    if (error instanceof Response) return error
    console.error("[thesis-review POST] Error:", error)
    const code = (error as { code?: string })?.code
    const status = code === "THESIS_SOURCE_REQUIRED" ? 422 : 500
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
        code,
      },
      { status }
    )
  }
}

// ---------------------------------------------------------------------------
// GET — list all thesis reviews for a workspace (+ active job snapshot)
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params

  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId)) {
    return NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 })
  }

  try {
    const access = await requireWorkspaceEditor(workspaceId)
    void access
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const reviews = await prisma.thesisReview.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      studentName: true,
      thesisTitle: true,
      thesisType: true,
      reviewerRole: true,
      reviewerName: true,
      institution: true,
      department: true,
      grade: true,
      suggestedGrade: true,
      finalGrade: true,
      recommendation: true,
      suggestedRecommendation: true,
      finalRecommendation: true,
      reviewKind: true,
      targetVenue: true,
      sourceRevision: true,
      rubricVersion: true,
      discipline: true,
      proposedGradeRange: true,
      confidence: true,
      limitationsSummary: true,
      reportingStandard: true,
      confirmedAt: true,
      status: true,
      language: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  const activeJobs = reviewJobManager
    .listForWorkspace(workspaceId)
    .filter((j) => j.status === "running")
    .map((j) => ({ jobId: j.id, stage: j.stage, detail: j.detail, progress: j.progress, status: j.status }))

  return NextResponse.json({ reviews, activeJobs })
}
