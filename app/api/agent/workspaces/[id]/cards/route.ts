import { NextRequest, NextResponse } from 'next/server'
import { verifyAgentKey, requireScope, requireAgentWorkspaceAccess, AgentAuthError } from '@/lib/agent-auth'
import { logToolCall } from '@/lib/agent-audit'
import { prisma } from '@/lib/prisma'
import { extractCiteKeys } from '@/lib/bib-parser'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const start = Date.now()
  try {
    const { id } = await params
    const ctx = await verifyAgentKey(req)
    requireScope(ctx, 'workspace:read')
    await requireAgentWorkspaceAccess(ctx, id, false)

    const workspace = await prisma.workspace.findUnique({
      where: { id },
      include: {
        outputs: {
          include: {
            cards: {
              orderBy: [{ column: 'asc' }, { order: 'asc' }],
            },
          },
        },
      },
    })

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const activeOutput = workspace.outputs.find((o) => o.isActive) || workspace.outputs[0]
    const cards = activeOutput ? activeOutput.cards : []

    const formattedCards = cards.map((c) => {
      const citations = extractCiteKeys(c.content || '')
      return {
        id: c.id,
        outputId: c.outputId,
        title: c.title,
        content: c.content,
        column: c.column,
        order: c.order,
        pattern: c.pattern,
        validation: c.validation,
        citations,
      }
    })

    await logToolCall(ctx, id, 'posterapp.cards.list', {}, { count: formattedCards.length }, Date.now() - start)
    return NextResponse.json(formattedCards)
  } catch (err: any) {
    if (err instanceof AgentAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[agent cards GET] Error:', err)
    return NextResponse.json({ error: 'Failed to list cards' }, { status: 500 })
  }
}
