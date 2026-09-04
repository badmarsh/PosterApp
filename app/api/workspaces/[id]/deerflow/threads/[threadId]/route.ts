import { NextResponse } from "next/server"
import { requireWorkspaceOwner } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { findRunForWorkspace, deleteDeerflowRun, updateDeerflowRun } from "@/lib/deerflow/db"
import { cancelRunRecord, getRunRecord } from "@/lib/deerflow/run-store"
import { deleteDeerThread } from "@/lib/deerflow/client"
import { safeApiError } from "@/lib/security"

/**
 * DELETE /api/workspaces/[id]/deerflow/threads/[threadId]
 * Cancels a live run (if any), removes the sidecar thread data, and deletes
 * the local mapping. Owner-only — the run/proposal lifecycle is borrowed
 * workspace state.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; threadId: string }> }) {
  const { id, threadId: runId } = await params
  if (!/^[a-zA-Z0-9_-]+$/.test(id) || !/^[a-zA-Z0-9_-]+$/.test(runId)) {
    return NextResponse.json({ error: "Invalid run id" }, { status: 400 })
  }

  try {
    const access = await requireWorkspaceOwner(id)

    const { allowed, retryAfterMs } = await rateLimitAsync(`${access.userId}:${id}:deerflow:delete`, 10, 60_000)
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limited", retryAfterMs },
        { status: 429, headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() } }
      )
    }

    const row = await findRunForWorkspace(runId, id)
    if (!row) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 })
    }

    // Stop a live run first (aborts the upstream stream).
    const live = getRunRecord(runId)
    if (live && (live.status === "running" || live.status === "queued")) {
      cancelRunRecord(runId)
      await updateDeerflowRun(runId, id, {
        status: "cancelled",
        error: "Deleted by owner",
        finishedAt: new Date(),
      })
    }

    // Best-effort cleanup on the sidecar; the local row is removed regardless.
    let sidecarDeleted = true
    try {
      await deleteDeerThread(row.deerThreadId)
    } catch (err) {
      console.warn("[deerflow] sidecar thread delete failed (ignored):", err)
      sidecarDeleted = false
    }

    await deleteDeerflowRun(runId, id)

    return NextResponse.json({ deleted: true, sidecarDeleted, runId, ownerId: access.userId })
  } catch (err) {
    if (err instanceof Response) return err
    console.error("[deerflow thread DELETE] Error:", err)
    return safeApiError("Failed to delete DeerFlow run", 500)
  }
}
