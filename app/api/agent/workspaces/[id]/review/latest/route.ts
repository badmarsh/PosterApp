import { NextRequest, NextResponse } from 'next/server'
import { verifyAgentKey, requireAgentWorkspaceAccess, AgentAuthError } from '@/lib/agent-auth'
import { logToolCall } from '@/lib/agent-audit'
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
    await requireAgentWorkspaceAccess(ctx, id, false)

    const workspace = await prisma.workspace.findUnique({
      where: { id },
      include: {
        outputs: { include: { cards: true } },
        thesisReviews: {
          orderBy: { id: 'desc' },
          take: 1,
        },
      },
    })

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const bibKeys = parseBibKeys(workspace.bibContent || '')
    const activeOutput = workspace.outputs.find((o) => o.isActive) || workspace.outputs[0]
    const allCards = activeOutput ? activeOutput.cards : []

    const missingCitations: string[] = []
    const usedCitations = new Set<string>()
    const flaggedCardIds: string[] = []

    for (const card of allCards) {
      const keys = extractCiteKeys(card.content || '')
      for (const k of keys) {
        usedCitations.add(k)
        if (!bibKeys.includes(k)) {
          if (!missingCitations.includes(k)) missingCitations.push(k)
          if (!flaggedCardIds.includes(card.id)) flaggedCardIds.push(card.id)
        }
      }
    }

    const orphanCitations = bibKeys.filter((k) => !usedCitations.has(k))

    const result = {
      score: Math.max(0, 100 - missingCitations.length * 10),
      flaggedCards: flaggedCardIds,
      totalCards: allCards.length,
      issues: {
        missingCitations,
        orphanCitations,
      },
      latestThesisReview: workspace.thesisReviews[0] || null,
      checkedAt: new Date().toISOString(),
    }

    await logToolCall(ctx, id, 'posterapp.review.getLatest', {}, result, Date.now() - start)
    return NextResponse.json(result)
  } catch (err: any) {
    if (err instanceof AgentAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[agent review latest GET] Error:', err)
    return NextResponse.json({ error: 'Failed to get latest review' }, { status: 500 })
  }
}
