import { NextResponse } from "next/server"
import { requireWorkspaceEditor } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { readJsonBodyCapped, safeApiError, PayloadTooLargeError } from "@/lib/security"
import { assertDeerflowAvailable, toDeerflowResponse } from "@/lib/deerflow/guard"
import {
  estimateDeerflowRun,
  estimateImprovePosterRun,
  getDeerflowBudgetStatus,
} from "@/lib/deerflow/budget"
import { DeerflowEstimateSchema } from "@/lib/deerflow/contracts"

/**
 * POST /api/workspaces/[id]/deerflow/estimate
 * Pre-flight estimate so the UI can show cost/time and require confirmation.
 * Supports both poster_research and improve_poster kinds.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 })
  }

  try {
    const access = await requireWorkspaceEditor(id)
    assertDeerflowAvailable(access.workspace)

    const { allowed, retryAfterMs } = await rateLimitAsync(`${access.userId}:${id}:deerflow:estimate`, 30, 60_000)
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limited", retryAfterMs },
        { status: 429, headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() } }
      )
    }

    let raw: unknown
    try {
      raw = await readJsonBodyCapped(req, 8 * 1024)
    } catch (err) {
      if (err instanceof PayloadTooLargeError) {
        return NextResponse.json({ error: "Payload too large" }, { status: 413 })
      }
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    const parsed = DeerflowEstimateSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 })
    }

    const { kind, depth, maxIterations } = parsed.data
    const estimate =
      kind === "improve_poster"
        ? estimateImprovePosterRun(maxIterations ?? 3)
        : estimateDeerflowRun(depth ?? "standard")

    const budget = getDeerflowBudgetStatus(id)
    return NextResponse.json({
      estimate,
      budget,
      willExceed: budget.overBudget || estimate.usd > budget.remainingUsd,
    })
  } catch (err) {
    const deerflowErr = toDeerflowResponse(err)
    if (deerflowErr) return deerflowErr
    if (err instanceof Response) return err
    console.error("[deerflow estimate] Error:", err)
    return safeApiError("Failed to estimate DeerFlow run", 500)
  }
}
