/**
 * GET/PUT/DELETE /api/workspaces/[id]/thesis-review/[reviewId]
 *
 * Manage individual thesis review records.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireWorkspaceEditor } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const UpdateSchema = z.object({
  studentName: z.string().min(1).max(200).optional(),
  thesisTitle: z.string().min(1).max(500).optional(),
  thesisType: z.enum(["bachelor", "master", "phd"]).optional(),
  reviewerRole: z.string().max(50).optional(),
  reviewerName: z.string().max(200).optional(),
  institution: z.string().max(300).optional(),
  department: z.string().max(300).optional(),
  grade: z.string().max(20).optional(),
  recommendation: z.string().max(2000).optional(),
  sections: z.string().optional(),         // JSON string
  defenseQuestions: z.string().optional(), // JSON string
  citationIssues: z.string().optional(),   // JSON string
  reviewKind: z.string().optional(),
  targetVenue: z.string().max(300).optional(),
  summary: z.string().optional(),
  strengths: z.string().optional(),        // JSON string
  findings: z.string().optional(),         // JSON string
  reportingStandard: z.string().optional(),
  reportingGuidelineChecks: z.string().optional(), // JSON string
  confidentialComments: z.string().optional(),
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

  // Deserialise JSON fields for the client
  return NextResponse.json({
    ...review,
    sections: review.sections ? JSON.parse(review.sections) : [],
    defenseQuestions: review.defenseQuestions ? JSON.parse(review.defenseQuestions) : [],
    citationIssues: review.citationIssues ? JSON.parse(review.citationIssues) : [],
    strengths: review.strengths ? JSON.parse(review.strengths) : [],
    findings: review.findings ? JSON.parse(review.findings) : [],
    reportingGuidelineChecks: review.reportingGuidelineChecks ? JSON.parse(review.reportingGuidelineChecks) : [],
  })
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

  let updates: z.infer<typeof UpdateSchema>
  try {
    const raw = await req.json()
    updates = UpdateSchema.parse(raw)
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
