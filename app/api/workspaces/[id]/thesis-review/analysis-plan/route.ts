/**
 * POST /api/workspaces/[id]/thesis-review/analysis-plan
 *
 * Pre-flight document profiling & analysis plan generation.
 * Quickly inspects extracted manuscript content and returns a structured plan
 * before triggering the full in-depth review.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireWorkspaceEditor } from "@/lib/auth"
import { generateReviewAnalysisPlan } from "@/lib/ai/analysis-plan"
import { z } from "zod"

const RequestSchema = z.object({
  thesisMetadata: z.object({
    studentName: z.string().optional(),
    thesisTitle: z.string().optional(),
    thesisType: z.enum(["bachelor", "master", "phd"]).default("master"),
    reviewerRole: z.string().default("opponent"),
    reviewerName: z.string().optional(),
    institution: z.string().optional(),
    department: z.string().optional(),
    language: z.enum(["sk", "cs", "en"]).default("sk"),
    reviewKind: z.enum(["thesis", "paper", "grant"]).default("thesis"),
    targetVenue: z.string().optional(),
    reportingStandard: z.enum(["consort", "prisma", "strobe", "ml_reproducibility", "none"]).default("none"),
  }),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params

  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId)) {
    return NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 })
  }

  try {
    await requireWorkspaceEditor(workspaceId)
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: z.infer<typeof RequestSchema>
  try {
    const raw = await req.json()
    body = RequestSchema.parse(raw)
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body", details: String(err) }, { status: 400 })
  }

  try {
    const plan = await generateReviewAnalysisPlan({
      workspaceId,
      thesisMetadata: body.thesisMetadata as any,
    })

    return NextResponse.json(plan)
  } catch (err) {
    console.error("[analysis-plan POST] Error:", err)
    return NextResponse.json(
      { error: "Failed to generate analysis plan", message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
