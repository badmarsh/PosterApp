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
    if (options.sourceIds && options.sourceIds.includes('doc1')) {
      return 'Mocked source content from server-side loader';
    }
    return '';
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

describe('POST /api/workspaces/[id]/cards/convert - sourceIds support', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockReturnValue({ allowed: true, retryAfterMs: 0 })
    mockRateLimitAsync.mockResolvedValue({ allowed: true, retryAfterMs: 0 })
    mockLoadSourceContext.mockResolvedValue('Mocked source content from server-side loader')
    mockGenerateAIResponse.mockResolvedValue({
      title: 'Converted Title',
      bullets: ['Converted bullet 1', 'Converted bullet 2']
    })
  })

  it('loads context from sourceIds when provided', async () => {
    ;(mockAuth as any).mockResolvedValueOnce({ userId: 'user_123' } as any)
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValueOnce({ id: 'ws-1', userId: 'user_123' } as any)

    const req = makeRequest({ 
      sourceIds: ['doc1'], 
      sourceType: 'poster', 
      targetType: 'slides',
      sourceTopic: 'Test Topic'
    })
    const res = await POST(req, makeParams('ws-1'))
    
    expect(mockLoadSourceContext).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      sourceIds: ['doc1'],
      maxChars: 40_000
    })
    
    expect(res.status).toBe(200)
  })

  it('prefers sourceIds over sourceContent when both are provided', async () => {
    ;(mockAuth as any).mockResolvedValueOnce({ userId: 'user_123' } as any)
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValueOnce({ id: 'ws-1', userId: 'user_123' } as any)

    const req = makeRequest({ 
      sourceContent: 'client provided content',
      sourceIds: ['doc1'], 
      sourceType: 'poster', 
      targetType: 'slides',
      sourceTopic: 'Test Topic'
    })
    const res = await POST(req, makeParams('ws-1'))
    
    expect(mockLoadSourceContext).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      sourceIds: ['doc1'],
      maxChars: 40_000
    })
    
    expect(res.status).toBe(200)
  })

  it('falls back to sourceContent when sourceIds not provided', async () => {
    ;(mockAuth as any).mockResolvedValueOnce({ userId: 'user_123' } as any)
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValueOnce({ id: 'ws-1', userId: 'user_123' } as any)

    const req = makeRequest({ 
      sourceContent: 'client provided content',
      sourceType: 'poster', 
      targetType: 'slides',
      sourceTopic: 'Test Topic'
    })
    const res = await POST(req, makeParams('ws-1'))
    
    // Since sourceIds wasn't provided, loadSourceContext shouldn't be called
    // The content should be processed directly
    expect(mockLoadSourceContext).not.toHaveBeenCalled()
    expect(res.status).toBe(200)
  })

  it('returns 400 when neither sourceIds nor sourceContent are provided', async () => {
    ;(mockAuth as any).mockResolvedValueOnce({ userId: 'user_123' } as any)
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValueOnce({ id: 'ws-1', userId: 'user_123' } as any)

    const req = makeRequest({ 
      sourceType: 'poster', 
      targetType: 'slides',
      sourceTopic: 'Test Topic'
    })
    const res = await POST(req, makeParams('ws-1'))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Either sourceIds or sourceContent is required')
  })
})