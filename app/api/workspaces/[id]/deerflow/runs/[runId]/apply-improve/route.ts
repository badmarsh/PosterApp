import { NextResponse } from "next/server"
import { requireWorkspaceEditor } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { safeApiError } from "@/lib/security"
import { findRunForWorkspace } from "@/lib/deerflow/db"
import { normalizeImprovePosterProposal } from "@/lib/deerflow/contracts"
import { getWorkspaceCardIds } from "@/lib/deerflow/context"
import { toDeerflowResponse } from "@/lib/deerflow/guard"
import { createWorkspaceSnapshot } from "@/lib/agent-snapshot"

/**
 * POST /api/workspaces/[id]/deerflow/runs/[runId]/apply-improve
 *
 * Human confirmation step for an improve_poster run. The runner already applied
 * intermediate patches during the loop and took snapshots. This route:
 *  1. Re-validates the stored ImprovePosterProposal against current card ids.
 *  2. Reports on what was applied during the loop vs. what remains.
 *  3. Logs the agent event to the workspace feed.
 *  4. Returns the summary of patches applied across all iterations.
 *
 * Note: This route does NOT re-apply patches — the runner already applied them
 * during the loop. Snapshots can be used to undo. This is a confirmation/audit route.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string; runId: string }> }) {
  const { id, runId } = await params
  if (!/^[a-zA-Z0-9_-]+$/.test(id) || !/^[a-zA-Z0-9_-]+$/.test(runId)) {
    return NextResponse.json({ error: "Invalid run id" }, { status: 400 })
  }

  let userId: string
  try {
    const access = await requireWorkspaceEditor(id)
    userId = access.userId
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { allowed, retryAfterMs } = await rateLimitAsync(
      `${userId}:${id}:deerflow:apply-improve`,
      10,
      60_000
    )
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

    if (row.status !== "done") {
      return NextResponse.json(
        { error: "Run has not completed yet", status: row.status },
        { status: 409 }
      )
    }

    if (row.kind !== "improve_poster") {
      return NextResponse.json(
        { error: "This route is only for improve_poster runs. Use /apply for poster_research." },
        { status: 400 }
      )
    }

    // Re-validate the stored proposal
    const allowedCardIds = await getWorkspaceCardIds(id)
    const normalized = normalizeImprovePosterProposal(row.proposal, { allowedCardIds })

    if (!normalized.ok) {
      return NextResponse.json(
        {
          error: "Stored proposal failed re-validation",
          issues: normalized.issues.slice(0, 5),
        },
        { status: 422 }
      )
    }

    const proposal = normalized.proposal
    const allPatches = proposal.iterations.flatMap((iter) => iter.patches)
    const { unknownCardIds, unsafePatchIds } = normalized.rejected

    // Take a final snapshot for the record
    try {
      await createWorkspaceSnapshot(id, "deerflow-improve-confirmed", {
        source: "agent",
        coalesceWindowMs: 60_000,
      })
    } catch (snapErr) {
      console.warn("[deerflow apply-improve] final snapshot error:", snapErr)
    }

    return NextResponse.json({
      ok: true,
      appliedPatches: allPatches.length,
      totalIterations: proposal.iterations.length,
      cleanCompile: proposal.cleanCompile,
      summary: proposal.summary,
      skippedUnsafe: unsafePatchIds.length,
      skippedUnknown: unknownCardIds.length,
    })
  } catch (err) {
    const deerflowErr = toDeerflowResponse(err)
    if (deerflowErr) return deerflowErr
    if (err instanceof Response) return err
    console.error("[deerflow apply-improve] Error:", err)
    return safeApiError("Failed to confirm improve-poster run", 500)
  }
}
