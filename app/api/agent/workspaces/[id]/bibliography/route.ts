import { rateLimitAsync } from "@/lib/rate-limit"
import { NextRequest, NextResponse } from 'next/server'
import { verifyAgentKey, requireScope, requireAgentWorkspaceAccess, AgentAuthError } from '@/lib/agent-auth'
import { logToolCall } from '@/lib/agent-audit'
import { createWorkspaceSnapshot } from '@/lib/agent-snapshot'
import { prisma } from '@/lib/prisma'
import { parseBibKeys, extractCiteKeys } from '@/lib/bib-parser'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const start = Date.now()
  try {
    const { id } = await params
    const ctx = await verifyAgentKey(req)
    const hasScope = ctx.scopes.includes('*') || ctx.scopes.includes('bibliography:read') || ctx.scopes.includes('workspace:read')
    if (!hasScope) {
      return NextResponse.json({ error: 'Scope required: bibliography:read' }, { status: 403 })
    }
    await requireAgentWorkspaceAccess(ctx, id, false)

    const workspace = await prisma.workspace.findUnique({
      where: { id },
      include: {
        outputs: {
          include: { cards: true },
        },
      },
    })

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const bibContent = workspace.bibContent || ''
    const keys = parseBibKeys(bibContent)

    // Map which cards cite which keys
    const citedByCards: Record<string, string[]> = {}
    for (const k of keys) {
      citedByCards[k] = []
    }

    const activeOutput = workspace.outputs.find((o) => o.isActive) || workspace.outputs[0]
    if (activeOutput) {
      for (const card of activeOutput.cards) {
        const found = extractCiteKeys(card.content || '')
        for (const k of found) {
          if (!citedByCards[k]) citedByCards[k] = []
          if (!citedByCards[k].includes(card.id)) citedByCards[k].push(card.id)
        }
      }
    }

    const result = {
      bibContent,
      keys,
      citedByCards,
    }

    await logToolCall(ctx, id, 'posterapp.bibliography.list', {}, { count: keys.length }, Date.now() - start)
    return NextResponse.json(result)
  } catch (err: any) {
    if (err instanceof AgentAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[agent bibliography GET] Error:', err)
    return NextResponse.json({ error: 'Failed to get bibliography' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ctx = await verifyAgentKey(req)
    const body = await req.json().catch(() => ({}))

    const { executeAgentTool } = await import("@/lib/agent-tools/executor")
    const envelope = await executeAgentTool(ctx, "posterapp.bibliography.add", {
      workspaceId: id,
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
    console.error("[agent bibliography POST] Error:", err)
    return NextResponse.json({ error: "Failed to add bibliography entry" }, { status: 500 })
  }
}
