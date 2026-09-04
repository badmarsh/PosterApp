import { rateLimitAsync } from "@/lib/rate-limit"
import { NextRequest, NextResponse } from 'next/server'
import { verifyAgentKey, requireScope, requireAgentWorkspaceAccess, AgentAuthError } from '@/lib/agent-auth'
import { logToolCall } from '@/lib/agent-audit'
import { createWorkspaceSnapshot } from '@/lib/agent-snapshot'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const start = Date.now()
  try {
    const { id } = await params
    const ctx = await verifyAgentKey(req)
    // snapshot:create or workspace:read/write
    const hasScope = ctx.scopes.includes('*') || ctx.scopes.includes('snapshot:create') || ctx.scopes.includes('workspace:write') || ctx.scopes.includes('workspace:read')
    if (!hasScope) {
      return NextResponse.json({ error: 'Scope required: snapshot:create' }, { status: 403 })
    }
    await requireAgentWorkspaceAccess(ctx, id, false)

    const body = await req.json().catch(() => ({}))
    const reason = typeof body.reason === 'string' ? body.reason : 'agent:snapshot'

    const snap = await createWorkspaceSnapshot(id, reason)

    const result = {
      snapshotId: snap.id,
      revision: snap.revision,
      label: snap.label,
      createdAt: snap.savedAt,
    }

    await logToolCall(ctx, id, 'posterapp.workspaces.snapshot', { reason }, result, Date.now() - start)
    return NextResponse.json(result)
  } catch (err: any) {
    if (err instanceof AgentAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[agent snapshot POST] Error:', err)
    return NextResponse.json({ error: 'Failed to create snapshot' }, { status: 500 })
  }
}
