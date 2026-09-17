// Mutating calls use the canonical executeAgentTool rateLimitAsync chain exactly once.
import { NextRequest, NextResponse } from 'next/server'
import { verifyAgentKey, AgentAuthError } from '@/lib/agent-auth'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const { id, entryId } = await params
    const ctx = await verifyAgentKey(req)

    const { executeAgentTool } = await import("@/lib/agent-tools/executor")
    const envelope = await executeAgentTool(ctx, "posterapp.bibliography.remove", {
      workspaceId: id,
      entryId,
    })

    if (!envelope.ok) {
      const status =
        envelope.error.code === "NOT_FOUND"
          ? 404
          : envelope.error.code === "FORBIDDEN" || envelope.error.code === "UNAUTHORIZED"
          ? 403
          : envelope.error.code === "RATE_LIMITED"
          ? 429
          : 400
      return NextResponse.json(envelope, { status })
    }

    return NextResponse.json(envelope.data)
  } catch (err: any) {
    if (err instanceof AgentAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error("[agent bibliography DELETE] Error:", err)
    return NextResponse.json({ error: "Failed to remove bibliography entry" }, { status: 500 })
  }
}
