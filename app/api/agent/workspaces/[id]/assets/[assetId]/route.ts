import { NextRequest, NextResponse } from 'next/server'
import { verifyAgentKey, requireAgentWorkspaceAccess, AgentAuthError } from '@/lib/agent-auth'
import { logToolCall } from '@/lib/agent-audit'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  const start = Date.now()
  try {
    const { id, assetId } = await params
    const ctx = await verifyAgentKey(req)
    await requireAgentWorkspaceAccess(ctx, id, false)

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
    })

    if (!asset || asset.workspaceId !== id) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    await logToolCall(ctx, id, 'posterapp.assets.get', { assetId }, { id: asset.id }, Date.now() - start)
    return NextResponse.json(asset)
  } catch (err: any) {
    if (err instanceof AgentAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[agent asset GET] Error:', err)
    return NextResponse.json({ error: 'Failed to get asset' }, { status: 500 })
  }
}
