import { rateLimitAsync } from "@/lib/rate-limit"
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
    const hasScope = ctx.scopes.includes('*') || ctx.scopes.includes('assets:read') || ctx.scopes.includes('workspace:read')
    if (!hasScope) {
      return NextResponse.json({ error: 'Scope required: assets:read' }, { status: 403 })
    }
    await requireAgentWorkspaceAccess(ctx, id, false)

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
  const start = Date.now()
  try {
    const { id } = await params
    const ctx = await verifyAgentKey(req)
    requireScope(ctx, 'assets:write')
    await requireAgentWorkspaceAccess(ctx, id, true)

    const body = await req.json()
    const asset = await prisma.asset.create({
      data: {
        id: body.id || ('asset_' + Math.random().toString(36).substring(2, 9)),
        workspaceId: id,
        fileId: body.fileId || 'agent_upload',
        filename: body.filename || 'asset.png',
        url: body.url || '',
        kind: body.kind || 'figure',
        page: body.page || 1,
        confidence: body.confidence || 'high',
        caption: body.caption || null,
        assignedCardId: body.assignedCardId || null,
      },
    })

    await logToolCall(ctx, id, 'posterapp.assets.upload', body, { id: asset.id }, Date.now() - start, true)
    return NextResponse.json(asset)
  } catch (err: any) {
    if (err instanceof AgentAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[agent assets POST] Error:', err)
    return NextResponse.json({ error: 'Failed to upload asset' }, { status: 500 })
  }
}
