import { NextResponse } from "next/server"
import { requireWorkspaceEditor } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { readJsonBodyCapped, safeApiError, PayloadTooLargeError } from "@/lib/security"
import { getDeerflowConfig } from "@/lib/deerflow/config"
import { assertDeerflowAvailable, ensureDeerflowThread, toDeerflowResponse } from "@/lib/deerflow/guard"
import { estimateDeerflowRun, assertDeerflowBudget } from "@/lib/deerflow/budget"
import { DeerflowStartRunSchema } from "@/lib/deerflow/contracts"
import { createRunRecord } from "@/lib/deerflow/run-store"
import { executeDeerflowResearch } from "@/lib/deerflow/runner"
import { updateDeerflowRun } from "@/lib/deerflow/db"

/**
 * POST /api/workspaces/[id]/deerflow/runs
 * Validates the request, gates budget + rate limit, then launches a
 * background DeerFlow research run. Responds 202 immediately with the run id;
 * progress arrives via GET …/runs/[runId]/stream.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 })
  }

  let userId: string
  let access: Awaited<ReturnType<typeof requireWorkspaceEditor>>
  try {
    access = await requireWorkspaceEditor(id)
    userId = access.userId
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    assertDeerflowAvailable(access.workspace)

    let raw: unknown
    try {
      raw = await readJsonBodyCapped(req, 16 * 1024)
    } catch (err) {
      if (err instanceof PayloadTooLargeError) {
        return NextResponse.json({ error: "Payload too large" }, { status: 413 })
      }
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    const parsed = DeerflowStartRunSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 })
    }
    const input = parsed.data

    if (input.confirmEstimate !== true) {
      return safeApiError("Estimate confirmation required before starting a DeerFlow run", 400, "DEERFLOW_NEEDS_CONFIRMATION")
    }

    const cfg = getDeerflowConfig()
    const { allowed, retryAfterMs } = await rateLimitAsync(
      `${userId}:${id}:deerflow:run`,
      cfg.runsPerHour,
      3_600_000
    )
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limited", retryAfterMs },
        { status: 429, headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() } }
      )
    }

    const budget = assertDeerflowBudget(id)
    const estimate = estimateDeerflowRun(input.depth)

    const thread = await ensureDeerflowThread({ workspaceId: id, userId, kind: input.kind })
    if (thread.status === "running" || thread.status === "queued") {
      return NextResponse.json(
        { error: "A DeerFlow run is already in progress", runId: thread.id },
        { status: 409 }
      )
    }

    const runId = thread.id
    createRunRecord({
      runId,
      workspaceId: id,
      userId,
      deerThreadId: thread.deerThreadId,
      kind: input.kind,
      costEstimateUsd: estimate.usd,
    })
    await updateDeerflowRun(runId, id, {
      status: "queued",
      phase: "planning",
      costEstimateUsd: estimate.usd,
      error: null,
      finishedAt: null,
    })

    // Fire-and-forget; executeDeerflowResearch never throws (failures are stored).
    void executeDeerflowResearch({
      runId,
      workspaceId: id,
      userId,
      deerThreadId: thread.deerThreadId,
      kind: input.kind,
      input,
      costEstimateUsd: estimate.usd,
    }).catch((err: unknown) => {
      console.error("[deerflow] background run crashed:", err)
    })

    return NextResponse.json(
      {
        runId,
        deerThreadId: thread.deerThreadId,
        status: "queued",
        estimate,
        budget: {
          remainingUsd: budget.remainingUsd,
          spentUsd: budget.spentUsd,
        },
      },
      { status: 202 }
    )
  } catch (err) {
    const deerflowErr = toDeerflowResponse(err)
    if (deerflowErr) return deerflowErr
    if (err instanceof Response) return err
    console.error("[deerflow runs] Error:", err)
    return safeApiError("Failed to start DeerFlow run", 500)
  }
}
