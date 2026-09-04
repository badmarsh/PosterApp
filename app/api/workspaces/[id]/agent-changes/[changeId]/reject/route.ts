import { NextResponse, NextRequest } from "next/server"
import { auth, requireWorkspaceEditor } from "@/lib/auth"
import { rejectAgentChange } from "@/lib/agent-changes/apply"
import { rateLimitAsync } from "@/lib/rate-limit"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; changeId: string }> }
) {
  const { id, changeId } = await params
  try {
    const { userId } = await requireWorkspaceEditor(id)
    const { allowed, retryAfterMs } = await rateLimitAsync(`agent-changes:${userId}:${id}`, 20, 60_000)
    if (!allowed) {
      return NextResponse.json(
        { error: `Rate limited — try again in ${Math.ceil(retryAfterMs / 1000)}s` },
        { status: 429 }
      )
    }
    const body = await req.json().catch(() => ({}))
    const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : undefined

    const result = await rejectAgentChange(changeId, userId, reason)

    if (!result.ok) {
      const status = result.code === "NOT_FOUND" ? 404 : result.code === "FORBIDDEN" ? 403 : 400
      return NextResponse.json({ error: result.message, code: result.code }, { status })
    }

    return NextResponse.json({ ok: true, changeId, status: "rejected" })
  } catch (err: any) {
    if (err instanceof Response) return err
    console.error(`[agent-changes ${changeId} reject] Error:`, err)
    return NextResponse.json({ error: "Failed to reject change" }, { status: 500 })
  }
}
