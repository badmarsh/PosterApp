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
  studentName: z.string().min(1).max(200).optional(),
  thesisTitle: z.string().min(1).max(500).optional(),
  thesisType: z.enum(["bachelor", "master", "phd"]).optional(),
  reviewerRole: z.string().max(50).optional(),
  reviewerName: z.string().max(200).optional(),
  institution: z.string().max(300).optional(),
  department: z.string().max(300).optional(),
  grade: z.string().max(20).optional(),
  suggestedGrade: z.string().max(20).optional().nullable(),
  finalGrade: z.string().max(20).optional().nullable(),
  recommendation: z.string().max(2000).optional(),
  suggestedRecommendation: z.string().max(2000).optional().nullable(),
  finalRecommendation: z.string().max(2000).optional().nullable(),
  confirmedAt: z.union([z.string(), z.date()]).optional().nullable(),
  sections: z.union([z.string(), z.array(z.any())]).optional(),
  defenseQuestions: z.union([z.string(), z.array(z.any())]).optional(),
  citationIssues: z.union([z.string(), z.array(z.any())]).optional(),
  reviewKind: z.string().optional(),
  targetVenue: z.string().max(300).optional(),
  summary: z.string().optional(),
  strengths: z.union([z.string(), z.array(z.any())]).optional(),
  findings: z.union([z.string(), z.array(z.any())]).optional(),
  reportingStandard: z.string().optional(),
  reportingGuidelineChecks: z.union([z.string(), z.array(z.any())]).optional(),
  confidentialComments: z.string().optional().nullable(),
  status: z.string().optional(),
  language: z.enum(["sk", "cs", "en"]).optional(),
})

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
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
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
