import { NextRequest, NextResponse } from 'next/server'
import { verifyAgentKey, requireAgentWorkspaceAccess, AgentAuthError } from '@/lib/agent-auth'
import { logToolCall } from '@/lib/agent-audit'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; jobId: string }> }
) {
  const start = Date.now()
  try {
    const { id, jobId } = await params
    const ctx = await verifyAgentKey(req)
    await requireAgentWorkspaceAccess(ctx, id, false)

    const result = {
      jobId,
      status: 'completed',
      outputUrl: `/api/workspaces/${id}/pdf`,
      error: null,
    }

    await logToolCall(ctx, id, 'posterapp.compile.status', { jobId }, result, Date.now() - start)
    return NextResponse.json(result)
  } catch (err: any) {
    if (err instanceof AgentAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[agent compile status GET] Error:', err)
    return NextResponse.json({ error: 'Failed to get compile status' }, { status: 500 })
  }
}
