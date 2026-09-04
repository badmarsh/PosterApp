import { NextResponse, NextRequest } from "next/server"
import { auth, requireWorkspaceEditor } from "@/lib/auth"
import { applyAgentChange } from "@/lib/agent-changes/apply"
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
    const forceRebase = Boolean(body.forceRebase)

    const result = await applyAgentChange(changeId, userId, { forceRebase })

    if (!result.ok) {
      if (result.code === "CONFLICT") {
        return NextResponse.json(
          {
            error: result.message,
            code: "CONFLICT",
            currentCard: result.currentCard,
            proposed: result.proposed,
          },
          { status: 409 }
        )
      }
      if (result.code === "FORBIDDEN") {
        return NextResponse.json({ error: result.message, code: "FORBIDDEN" }, { status: 403 })
      }
      if (result.code === "NOT_FOUND") {
        return NextResponse.json({ error: result.message, code: "NOT_FOUND" }, { status: 404 })
      }
      if (result.code === "EXPIRED") {
        return NextResponse.json({ error: result.message, code: "EXPIRED" }, { status: 410 })
      }
      return NextResponse.json(
        { error: result.message, code: result.code, details: (result as any).details },
        { status: 400 }
      )
    }

    return NextResponse.json(result)
  } catch (err: any) {
    if (err instanceof Response) return err
    console.error(`[agent-changes ${changeId} approve] Error:`, err)
    return NextResponse.json({ error: "Failed to approve change" }, { status: 500 })
  }
}
