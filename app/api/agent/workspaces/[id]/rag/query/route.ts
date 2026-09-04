import { rateLimitAsync } from "@/lib/rate-limit"
import { NextRequest, NextResponse } from 'next/server'
import { verifyAgentKey, requireScope, requireAgentWorkspaceAccess, AgentAuthError } from '@/lib/agent-auth'
import { logToolCall } from '@/lib/agent-audit'
import { searchHybrid } from '@/lib/ai/vector-rag'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const querySchema = z.object({
  query: z.string().min(1).max(2000),
  topK: z.number().min(1).max(50).default(5),
  threshold: z.number().min(0).max(1).default(0.0),
  mode: z.enum(['semantic', 'hybrid', 'exact']).default('hybrid'),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const start = Date.now()
  try {
    const { id } = await params
    const ctx = await verifyAgentKey(req)
    requireScope(ctx, 'rag:query')
    await requireAgentWorkspaceAccess(ctx, id, false)

    const raw = await req.json()
    const body = querySchema.parse(raw)

    let results: Array<{ id: string; heading: string | null; content: string; tokens: number; kind: string; similarity: number }> = []

    try {
      results = await searchHybrid(id, body.query, body.topK)
    } catch (searchErr) {
      console.warn('[agent RAG] searchHybrid fallback to text search:', searchErr)
      const fallbackChunks = await prisma.documentChunk.findMany({
        where: {
          workspaceId: id,
          content: { contains: body.query, mode: 'insensitive' },
        },
        take: body.topK,
        select: { id: true, heading: true, content: true, tokens: true, kind: true },
      })
      results = fallbackChunks.map((c) => ({ ...c, similarity: 0.75 }))
    }

    if (body.threshold > 0) {
      results = results.filter((r) => r.similarity >= body.threshold)
    }

    const payload = {
      query: body.query,
      results: results.map((r) => ({
        chunkId: r.id,
        heading: r.heading,
        content: r.content,
        kind: r.kind,
        score: r.similarity,
      })),
      count: results.length,
    }

    await logToolCall(ctx, id, 'posterapp.rag.query', body, { count: payload.count }, Date.now() - start)
    return NextResponse.json(payload)
  } catch (err: any) {
    if (err instanceof AgentAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.format() }, { status: 400 })
    }
    console.error('[agent RAG query POST] Error:', err)
    return NextResponse.json({ error: 'Failed to query RAG' }, { status: 500 })
  }
}
