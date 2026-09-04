import { NextResponse } from "next/server"
import { z } from "zod"
import { requireWorkspaceEditor } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { readJsonBodyCapped, safeApiError, PayloadTooLargeError } from "@/lib/security"
import { assertDeerflowAvailable, ensureDeerflowThread, toDeerflowResponse } from "@/lib/deerflow/guard"
import { DeerflowKindSchema } from "@/lib/deerflow/contracts"

const ThreadBodySchema = z.object({
  kind: DeerflowKindSchema.default("poster_research"),
})

/**
 * POST /api/workspaces/[id]/deerflow/threads
 * Creates (or reuses an idle) DeerFlow thread for the workspace and returns
 * the local run id that maps to the sidecar thread.
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

    const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:${id}:deerflow:threads`, 10, 60_000)
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
    const parsed = ThreadBodySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 })
    }

    const row = await ensureDeerflowThread({
      workspaceId: id,
      userId,
      kind: parsed.data.kind,
    })

    return NextResponse.json({
      runId: row.id,
      deerThreadId: row.deerThreadId,
      status: row.status,
    })
  } catch (err) {
    const deerflowErr = toDeerflowResponse(err)
    if (deerflowErr) return deerflowErr
    if (err instanceof Response) return err
    console.error("[deerflow threads] Error:", err)
    return safeApiError("Failed to create DeerFlow thread", 500)
  }
}
