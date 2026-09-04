import { rateLimitAsync } from "@/lib/rate-limit"
import { NextRequest, NextResponse } from 'next/server'
import { verifyAgentKey, requireScope, requireAgentWorkspaceAccess, AgentAuthError } from '@/lib/agent-auth'
import { logToolCall } from '@/lib/agent-audit'
import { createWorkspaceSnapshot } from '@/lib/agent-snapshot'
import { prisma } from '@/lib/prisma'
import { extractCiteKeys } from '@/lib/bib-parser'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  const start = Date.now()
  try {
    const { id, cardId } = await params
    const ctx = await verifyAgentKey(req)
    requireScope(ctx, 'workspace:read')
    await requireAgentWorkspaceAccess(ctx, id, false)

    const card = await prisma.card.findUnique({
      where: { id: cardId },
      include: { output: true },
    })

    if (!card || card.output.workspaceId !== id) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }

    const citations = extractCiteKeys(card.content || '')
    const result = {
      ...card,
      citations,
    }

    await logToolCall(ctx, id, 'posterapp.cards.get', { cardId }, { id: card.id, title: card.title }, Date.now() - start)
    return NextResponse.json(result)
  } catch (err: any) {
    if (err instanceof AgentAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[agent card GET] Error:', err)
    return NextResponse.json({ error: 'Failed to get card' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  const start = Date.now()
  try {
    const { id, cardId } = await params
    const ctx = await verifyAgentKey(req)
    requireScope(ctx, 'workspace:write')
    await requireAgentWorkspaceAccess(ctx, id, true)

    const card = await prisma.card.findUnique({
      where: { id: cardId },
      include: { output: true },
    })

    if (!card || card.output.workspaceId !== id) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }

    const body = await req.json()

    // MANDATORY PRE-WRITE SNAPSHOT
    const snap = await createWorkspaceSnapshot(id, `agent:edit_card:${cardId}`)

    const [updatedCard] = await prisma.$transaction([
      prisma.card.update({
        where: { id: cardId },
        data: {
          ...(typeof body.title === 'string' ? { title: body.title } : {}),
          ...(typeof body.content === 'string' ? { content: body.content } : {}),
          ...(typeof body.validation === 'string' ? { validation: body.validation } : {}),
        },
      }),
      prisma.workspace.update({
        where: { id },
        data: { revision: { increment: 1 } },
      }),
    ])

    const citations = extractCiteKeys(updatedCard.content || '')
    const result = {
      ...updatedCard,
      citations,
      preWriteSnapshotId: snap.id,
    }

    await logToolCall(ctx, id, 'posterapp.cards.update', { cardId, ...body }, result, Date.now() - start, true)
    return NextResponse.json(result)
  } catch (err: any) {
    if (err instanceof AgentAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[agent card PATCH] Error:', err)
    return NextResponse.json({ error: 'Failed to update card' }, { status: 500 })
  }
}
