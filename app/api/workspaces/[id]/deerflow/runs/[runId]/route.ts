import { NextResponse } from "next/server"
import { requireWorkspaceAccess } from "@/lib/auth"
import { findRunForWorkspace } from "@/lib/deerflow/db"
import { markRunInterrupted } from "@/lib/deerflow/runner"
import { getRunRecord } from "@/lib/deerflow/run-store"
import { safeApiError } from "@/lib/security"

/**
 * GET /api/workspaces/[id]/deerflow/runs/[runId]
 * Durable status + proposal. The SSE stream is best-effort; this endpoint is
 * the reconnect-safe source of truth.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; runId: string }> }) {
  const { id, runId } = await params
  if (!/^[a-zA-Z0-9_-]+$/.test(id) || !/^[a-zA-Z0-9_-]+$/.test(runId)) {
    return NextResponse.json({ error: "Invalid run id" }, { status: 400 })
  }

  try {
    await requireWorkspaceAccess(id)
    let row = await findRunForWorkspace(runId, id)
    if (!row) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 })
    }

    const live = getRunRecord(runId)
    // A row stuck in "running" with no live state means the process restarted.
    if ((row.status === "running" || row.status === "queued") && !live) {
      await markRunInterrupted(runId, id)
      row = (await findRunForWorkspace(runId, id)) ?? row
    }

    return NextResponse.json({
      runId: row.id,
      status: row.status,
      phase: live?.phase ?? row.phase,
      proposal: row.proposal ?? null,
      error: live?.error ?? (row.error ? { message: row.error, code: "DEERFLOW_RUN_FAILED" } : null),
      costEstimateUsd: row.costEstimateUsd ?? live?.costEstimateUsd ?? null,
      events: live?.events ?? [],
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
    })
  } catch (err) {
    if (err instanceof Response) return err
    console.error("[deerflow run GET] Error:", err)
    return safeApiError("Failed to load DeerFlow run", 500)
  }
}
