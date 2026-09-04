import { rateLimitAsync } from "@/lib/rate-limit"
import { NextRequest, NextResponse } from 'next/server'
import { verifyAgentKey, requireScope, requireAgentWorkspaceAccess, AgentAuthError } from '@/lib/agent-auth'
import { logToolCall } from '@/lib/agent-audit'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const start = Date.now()
  try {
    const { id } = await params
    const ctx = await verifyAgentKey(req)
    requireScope(ctx, 'ingestion:run')
    await requireAgentWorkspaceAccess(ctx, id, true)

    const body = await req.json().catch(() => ({}))
    const jobId = 'ing_' + Math.random().toString(36).substring(2, 9)

    const result = {
      jobId,
      status: 'started',
      workspaceId: id,
      sourceUrl: body.sourceUrl || null,
      assetId: body.assetId || null,
    }

    await logToolCall(ctx, id, 'posterapp.ingestion.trigger', body, result, Date.now() - start)
    return NextResponse.json(result)
  } catch (err: any) {
    if (err instanceof AgentAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[agent ingestion POST] Error:', err)
    return NextResponse.json({ error: 'Failed to trigger ingestion' }, { status: 500 })
  }
}
