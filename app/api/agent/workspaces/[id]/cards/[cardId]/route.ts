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
  req: Request,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  try {
    const { id, cardId } = await params
    const ctx = await verifyAgentKey(req)
    const body = await req.json().catch(() => ({}))

    const { executeAgentTool } = await import("@/lib/agent-tools/executor")
    const envelope = await executeAgentTool(ctx, "posterapp.cards.update", {
      workspaceId: id,
      cardId,
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
    console.error("[agent card PATCH] Error:", err)
    return NextResponse.json({ error: "Failed to update card" }, { status: 500 })
  }
}
