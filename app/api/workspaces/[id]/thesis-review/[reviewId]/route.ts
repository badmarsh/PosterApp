/**
 * GET/PUT/DELETE /api/workspaces/[id]/thesis-review/[reviewId]
 *
 * Manage individual thesis review records.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireWorkspaceEditor } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import {
  deserializeThesisReview,
  serializeThesisReviewUpdate,
} from "@/lib/ai/review-serializer"

const UpdateSchema = z.object({
  studentName: z.string().min(1).max(300).optional(),
  thesisTitle: z.string().min(1).max(1000).optional(),
  thesisType: z.enum(["bachelor", "master", "phd"]).optional(),
  reviewerRole: z.string().max(100).optional(),
  reviewerName: z.string().max(300).optional().nullable(),
  institution: z.string().max(500).optional().nullable(),
  department: z.string().max(500).optional().nullable(),
  grade: z.string().max(50).optional().nullable(),
  suggestedGrade: z.string().max(50).optional().nullable(),
  finalGrade: z.string().max(50).optional().nullable(),
  recommendation: z.string().max(50000).optional().nullable(),
  suggestedRecommendation: z.string().max(50000).optional().nullable(),
  finalRecommendation: z.string().max(50000).optional().nullable(),
  confirmedAt: z.union([z.string(), z.date()]).optional().nullable(),
  sections: z.union([z.string(), z.array(z.any())]).optional().nullable(),
  defenseQuestions: z.union([z.string(), z.array(z.any())]).optional().nullable(),
  citationIssues: z.union([z.string(), z.array(z.any())]).optional().nullable(),
  reviewKind: z.string().optional().nullable(),
  targetVenue: z.string().max(500).optional().nullable(),
  summary: z.string().optional().nullable(),
  strengths: z.union([z.string(), z.array(z.any())]).optional().nullable(),
  findings: z.union([z.string(), z.array(z.any())]).optional().nullable(),
  reportingStandard: z.string().optional().nullable(),
  reportingGuidelineChecks: z.union([z.string(), z.array(z.any())]).optional().nullable(),
  confidentialComments: z.string().optional().nullable(),
  phdEnrichment: z.union([z.string(), z.any(), z.null()]).optional(),
  status: z.string().optional().nullable(),
  language: z.enum(["sk", "cs", "en"]).optional(),
}).passthrough()

// ---------------------------------------------------------------------------
// GET — fetch a single thesis review
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string }> }
) {
  const { id: workspaceId, reviewId } = await params

  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId)) {
    return NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 })
  }

  try {
    await requireWorkspaceEditor(workspaceId)
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const review = await prisma.thesisReview.findFirst({
    where: { id: reviewId, workspaceId },
  })

  if (!review) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Safe centralized deserialisation with fallback and versioning
  return NextResponse.json(deserializeThesisReview(review))
}

// ---------------------------------------------------------------------------
// PUT — update thesis review fields
// ---------------------------------------------------------------------------

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string }> }
) {
  const { id: workspaceId, reviewId } = await params

  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId)) {
    return NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 })
  }

  try {
    await requireWorkspaceEditor(workspaceId)
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let updates: Record<string, any>
  try {
    const raw = await req.json()
    const validated = UpdateSchema.parse(raw)
    updates = serializeThesisReviewUpdate(validated)
  } catch (err) {
    console.error("[thesis-review PUT] Validation error:", err)
    return NextResponse.json({
      error: "Invalid request body",
      details: err instanceof z.ZodError ? err.flatten() : String(err)
    }, { status: 400 })
  }

  try {
    const updated = await prisma.thesisReview.updateMany({
      where: { id: reviewId, workspaceId },
      data: updates,
    })

    if (updated.count === 0) {
      return NextResponse.json({ error: "Not found or access denied" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[thesis-review PUT] Error:", err)
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE — remove a thesis review
// ---------------------------------------------------------------------------

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string }> }
) {
  const { id: workspaceId, reviewId } = await params

  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId)) {
    return NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 })
  }

  try {
    await requireWorkspaceEditor(workspaceId)
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const deleted = await prisma.thesisReview.deleteMany({
      where: { id: reviewId, workspaceId },
    })

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Not found or access denied" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[thesis-review DELETE] Error:", err)
    return NextResponse.json({ error: "Delete failed" }, { status: 500 })
  }
}
