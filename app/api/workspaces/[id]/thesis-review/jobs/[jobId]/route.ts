/**
 * GET    /api/workspaces/[id]/thesis-review/jobs/[jobId]   — one-shot status
 * DELETE /api/workspaces/[id]/thesis-review/jobs/[jobId]   — cancel the job
 */

import { NextRequest, NextResponse } from "next/server"
import { requireWorkspaceEditor } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { reviewJobManager } from "@/lib/review-jobs"

async function authorize(workspaceId: string): Promise<string | Response> {
  try {
    const access = await requireWorkspaceEditor(workspaceId)
    return access.userId
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; jobId: string }> }
) {
  const { id: workspaceId, jobId } = await params
  const auth = await authorize(workspaceId)
  if (typeof auth !== "string") return auth

  const state = reviewJobManager.get(jobId)
  if (!state || state.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }
  if (!reviewJobManager.ownsJob(jobId, auth)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return NextResponse.json({
    jobId: state.id,
    status: state.status,
    stage: state.stage,
    detail: state.detail,
    progress: state.progress,
    error: state.error,
    result: state.status === "done" ? state.result : undefined,
  })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; jobId: string }> }
) {
  const { id: workspaceId, jobId } = await params
  const auth = await authorize(workspaceId)
  if (typeof auth !== "string") return auth

  // Cancellation is cheap and bounded; still rate-limit to prevent abuse.
  const { allowed } = await rateLimitAsync(`${auth}:review-cancel`, 30, 60_000)
  if (!allowed) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 })
  }
  void req

  const state = reviewJobManager.get(jobId)
  if (!state || state.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }
  if (!reviewJobManager.ownsJob(jobId, auth)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const cancelled = reviewJobManager.cancel(jobId)
  return NextResponse.json({ cancelled })
}
