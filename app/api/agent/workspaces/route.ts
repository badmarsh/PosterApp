import { NextRequest, NextResponse } from 'next/server'
import { verifyAgentKey, requireScope, AgentAuthError } from '@/lib/agent-auth'
import { logToolCall } from '@/lib/agent-audit'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const start = Date.now()
  try {
    const ctx = await verifyAgentKey(req)
    requireScope(ctx, 'workspace:read')

    const workspaces = await prisma.workspace.findMany({
      where: {
        OR: [
          { userId: ctx.userId },
          { members: { some: { userId: ctx.userId } } },
        ],
      },
      select: {
        id: true,
        name: true,
        authors: true,
        venue: true,
        revision: true,
        outputs: {
          select: {
            id: true,
            title: true,
            isActive: true,
            _count: { select: { cards: true } },
          },
        },
        _count: {
          select: {
            assets: true,
            ingestFiles: true,
            snapshots: true,
          },
        },
      },
    })

    const result = workspaces.map((w) => {
      const totalCards = w.outputs.reduce((acc, o) => acc + o._count.cards, 0)
      return {
        id: w.id,
        name: w.name,
        authors: w.authors,
        venue: w.venue,
        revision: w.revision,
        outputs: w.outputs,
        _count: {
          cards: totalCards,
          assets: w._count.assets,
          ingestFiles: w._count.ingestFiles,
          snapshots: w._count.snapshots,
        },
      }
    })

    await logToolCall(ctx, null, 'posterapp.workspaces.list', {}, { count: result.length }, Date.now() - start)
    return NextResponse.json(result)
  } catch (err: any) {
    if (err instanceof AgentAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[agent workspaces GET] Error:', err)
    return NextResponse.json({ error: 'Failed to list workspaces' }, { status: 500 })
  }
}
