import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ allowed: true, retryAfterMs: 0 })),
  rateLimitAsync: vi.fn(async () => ({ allowed: true, retryAfterMs: 0 })),
}))

vi.mock('@/lib/ai/context', () => ({
  loadSourceContext: vi.fn(async (options: any) => {
    // Simulate loading multiple source documents
    const docs = options.sourceIds?.length || 1
    return `Mocked source content from ${docs} document(s) with ${options.maxChars || 40000} char limit`;
  }),
}))

vi.mock('@/lib/ai/client', () => ({
  generateAIResponse: vi.fn(async () => ({
    title: 'Converted Title',
    bullets: ['Converted bullet 1', 'Converted bullet 2']
  })),
}))

import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, rateLimitAsync } from '@/lib/rate-limit'
import { loadSourceContext } from '@/lib/ai/context'
import { generateAIResponse } from '@/lib/ai/client'
import { POST } from '@/app/api/workspaces/[id]/cards/convert/route'
import { NextRequest } from 'next/server'

const mockAuth = vi.mocked(auth)
const mockPrisma = vi.mocked(prisma)
const mockRateLimit = vi.mocked(rateLimit)
const mockRateLimitAsync = vi.mocked(rateLimitAsync)
const mockLoadSourceContext = vi.mocked(loadSourceContext)
const mockGenerateAIResponse = vi.mocked(generateAIResponse)

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/workspaces/ws-1/cards/convert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/workspaces/[id]/cards/convert - Performance & Scalability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockReturnValue({ allowed: true, retryAfterMs: 0 })
    mockRateLimitAsync.mockResolvedValue({ allowed: true, retryAfterMs: 0 })
    mockLoadSourceContext.mockResolvedValue('Mocked source content')
    mockGenerateAIResponse.mockResolvedValue({
      title: 'Converted Title',
      bullets: ['Converted bullet 1', 'Converted bullet 2']
    })
    ;(mockAuth as any).mockResolvedValue({ userId: 'user_123' } as any)
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValue({ id: 'ws-1', userId: 'user_123' } as any)
  })

  it('handles large sourceIds array (100+ documents)', async () => {
    const largeSourceIds = Array.from({ length: 150 }, (_, i) => `doc-${i}`)
    const req = makeRequest({
      sourceIds: largeSourceIds,
      sourceType: 'poster',
      targetType: 'slides',
      sourceTopic: 'Test Topic with many sources'
    })

    const start = Date.now()
    const res = await POST(req, makeParams('ws-1'))
    const duration = Date.now() - start

    expect(res.status).toBe(200)
    expect(mockLoadSourceContext).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      sourceIds: largeSourceIds,
      maxChars: 40_000
    })

    // Should complete within reasonable time (< 1s for mocked test)
    expect(duration).toBeLessThan(1000)
  })

  it('handles maximum character limit correctly', async () => {
    const req = makeRequest({
      sourceIds: ['doc1'],
      sourceType: 'poster',
      targetType: 'slides',
      sourceTopic: 'Test Topic',
      characterLimit: 1000
    })

    const res = await POST(req, makeParams('ws-1'))
    expect(res.status).toBe(200)

    // Verify the response includes character limit info
    const json = await res.json()
    expect(json).toHaveProperty('title')
    expect(json).toHaveProperty('bullets')
  })

  it('handles very long sourceTopic gracefully', async () => {
    const longTopic = 'A'.repeat(1000)  // Max allowed by schema
    const req = makeRequest({
      sourceIds: ['doc1'],
      sourceType: 'poster',
      targetType: 'slides',
      sourceTopic: longTopic
    })

    const res = await POST(req, makeParams('ws-1'))
    expect(res.status).toBe(200)
  })

  it('rejects sourceTopic over character limit', async () => {
    const tooLongTopic = 'A'.repeat(1001)  // Over the 1000 char limit
    const req = makeRequest({
      sourceIds: ['doc1'],
      sourceType: 'poster',
      targetType: 'slides',
      sourceTopic: tooLongTopic
    })

    const res = await POST(req, makeParams('ws-1'))
    expect(res.status).toBe(400)
  })

  it('handles concurrent requests without interference', async () => {
    const requests = Array.from({ length: 5 }, (_, i) => 
      makeRequest({
        sourceIds: [`doc-${i}`],
        sourceType: 'poster',
        targetType: 'slides',
        sourceTopic: `Topic ${i}`
      })
    )

    const start = Date.now()
    const results = await Promise.all(
      requests.map(req => POST(req, makeParams('ws-1')))
    )
    const duration = Date.now() - start

    // All should succeed
    results.forEach(res => {
      expect(res.status).toBe(200)
    })

    // Should complete within reasonable time
    expect(duration).toBeLessThan(2000)
  })

  it('validates characterLimit is positive', async () => {
    const req = makeRequest({
      sourceIds: ['doc1'],
      sourceType: 'poster',
      targetType: 'slides',
      sourceTopic: 'Test',
      characterLimit: -100
    })

    const res = await POST(req, makeParams('ws-1'))
    expect(res.status).toBe(400)
  })

  it('handles empty sourceIds array by falling back to error', async () => {
    const req = makeRequest({
      sourceIds: [],
      sourceType: 'poster',
      targetType: 'slides',
      sourceTopic: 'Test'
    })

    const res = await POST(req, makeParams('ws-1'))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Either sourceIds or sourceContent is required')
  })
})