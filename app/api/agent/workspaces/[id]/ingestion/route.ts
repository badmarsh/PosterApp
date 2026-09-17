import { rateLimitAsync } from "@/lib/rate-limit"
import { NextRequest, NextResponse } from 'next/server'
import { verifyAgentKey, requireScope, requireAgentWorkspaceAccess, AgentAuthError } from '@/lib/agent-auth'
import { logToolCall } from '@/lib/agent-audit'
import { isAllowedAgentIngestionUrl } from '@/lib/agent-restrictions'

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

    const rateLimit = await rateLimitAsync(`agent:${ctx.apiKeyId}:${id}:job`, 10, 600_000)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfterMs: rateLimit.retryAfterMs },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)) } }
      )
    }

    const body = await req.json().catch(() => ({}))
    if (body.sourceUrl && !isAllowedAgentIngestionUrl(String(body.sourceUrl))) {
      return NextResponse.json(
        { error: 'sourceUrl is not in the HTTPS academic ingestion allow-list' },
        { status: 403 }
      )
    }
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
