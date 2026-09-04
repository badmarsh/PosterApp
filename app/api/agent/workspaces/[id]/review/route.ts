import { rateLimitAsync } from "@/lib/rate-limit"
import { NextRequest, NextResponse } from 'next/server'
import { verifyAgentKey, requireScope, requireAgentWorkspaceAccess, AgentAuthError } from '@/lib/agent-auth'
import { logToolCall } from '@/lib/agent-audit'
import { prisma } from '@/lib/prisma'
import { parseBibKeys, extractCiteKeys } from '@/lib/bib-parser'
import { z } from 'zod'

const reviewSchema = z.object({
  type: z.enum(['poster', 'thesis']).default('poster'),
  cards: z.array(z.string()).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const start = Date.now()
  try {
    const { id } = await params
    const ctx = await verifyAgentKey(req)
    requireScope(ctx, 'review:run')
    await requireAgentWorkspaceAccess(ctx, id, false)

    const raw = await req.json().catch(() => ({}))
    const body = reviewSchema.parse(raw)

    const workspace = await prisma.workspace.findUnique({
      where: { id },
      include: {
        outputs: {
          include: {
            cards: true,
          },
        },
        assets: true,
      },
    })

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const bibContent = workspace.bibContent || ''
    const bibKeys = parseBibKeys(bibContent)

    const activeOutput = workspace.outputs.find((o) => o.isActive) || workspace.outputs[0]
    const allCards = activeOutput ? activeOutput.cards : []
    const cardsToReview = body.cards && body.cards.length > 0
      ? allCards.filter((c) => body.cards!.includes(c.id))
      : allCards

    const missingCitations: string[] = []
    const usedCitations = new Set<string>()
    const emptyCaptions: Array<{ cardId: string; figIndex: number }> = []
    const emptyCards: string[] = []
    const flaggedCardIds = new Set<string>()

    for (const card of cardsToReview) {
      const text = card.content || ''
      const keys = extractCiteKeys(text)
      for (const k of keys) {
        usedCitations.add(k)
        if (!bibKeys.includes(k)) {
          if (!missingCitations.includes(k)) missingCitations.push(k)
          flaggedCardIds.add(card.id)
        }
      }

      if (!text.trim()) {
        emptyCards.push(card.id)
        flaggedCardIds.add(card.id)
      }

      const figs = Array.isArray(card.figures) ? card.figures : []
      figs.forEach((fig: any, idx: number) => {
        if (!fig.caption || !String(fig.caption).trim()) {
          emptyCaptions.push({ cardId: card.id, figIndex: idx })
          flaggedCardIds.add(card.id)
        }
      })
    }

    const orphanCitations = bibKeys.filter((k) => !usedCitations.has(k))

    let score = 100
    score -= missingCitations.length * 10
    score -= emptyCards.length * 15
    score -= emptyCaptions.length * 5
    if (score < 0) score = 0

    const jobId = 'rev_' + Math.random().toString(36).substring(2, 9)

    const reviewResult = {
      jobId,
      status: 'completed',
      type: body.type,
      score,
      totalCards: cardsToReview.length,
      flaggedCards: Array.from(flaggedCardIds),
      issues: {
        missingCitations,
        orphanCitations,
        emptyCards,
        emptyCaptions,
      },
      createdAt: new Date().toISOString(),
    }

    if (body.type === 'thesis') {
      try {
        await prisma.thesisReview.create({
          data: {
            workspaceId: id,
            studentName: workspace.authors || 'Author',
            thesisTitle: workspace.name,
            citationIssues: JSON.stringify(missingCitations),
            defenseQuestions: JSON.stringify([
              'How was the dataset validated against distribution shifts?',
              'What are the computational limits of the proposed architecture?',
            ]),
          },
        })
      } catch (e) {
        console.warn('[review POST] Failed to save thesis review record:', e)
      }
    }

    await logToolCall(ctx, id, 'posterapp.review.run', body, reviewResult, Date.now() - start)
    return NextResponse.json(reviewResult)
  } catch (err: any) {
    if (err instanceof AgentAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.format() }, { status: 400 })
    }
    console.error('[agent review POST] Error:', err)
    return NextResponse.json({ error: 'Failed to run review' }, { status: 500 })
  }
}
