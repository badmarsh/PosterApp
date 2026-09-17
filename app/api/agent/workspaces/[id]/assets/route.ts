// Mutating calls use the canonical executeAgentTool rateLimitAsync chain exactly once.
import { NextRequest, NextResponse } from 'next/server'
import { verifyAgentKey, requireScope, requireAgentWorkspaceAccess, AgentAuthError } from '@/lib/agent-auth'
import { logToolCall } from '@/lib/agent-audit'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const start = Date.now()
  try {
    const { id } = await params
    const ctx = await verifyAgentKey(req)
    requireScope(ctx, 'assets:read')
    await requireAgentWorkspaceAccess(ctx, id, false)
    if (ctx.restrictCardIds.length > 0) {
      return NextResponse.json(
        { error: 'Restricted-context key cannot access assets' },
        { status: 403 }
      )
    }

    const assets = await prisma.asset.findMany({
      where: { workspaceId: id },
      orderBy: { page: 'asc' },
    })

    await logToolCall(ctx, id, 'posterapp.assets.list', {}, { count: assets.length }, Date.now() - start)
    return NextResponse.json(assets)
  } catch (err: any) {
    if (err instanceof AgentAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[agent assets GET] Error:', err)
    return NextResponse.json({ error: 'Failed to list assets' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = await verifyAgentKey(req)
    const body = await req.json().catch(() => ({}))

    const { executeAgentTool } = await import("@/lib/agent-tools/executor")
    const envelope = await executeAgentTool(ctx, "posterapp.assets.upload", {
      workspaceId: id,
      ...body,
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
    console.error("[agent assets POST] Error:", err)
    return NextResponse.json({ error: "Failed to upload asset" }, { status: 500 })
  }
}
