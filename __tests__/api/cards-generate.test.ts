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
  loadSourceContext: vi.fn(() => Promise.resolve('Mock source context')),
}))

import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, rateLimitAsync } from '@/lib/rate-limit'
import { POST } from '@/app/api/workspaces/[id]/cards/[cardId]/generate/route'
import { NextRequest } from 'next/server'

const mockAuth = vi.mocked(auth)
const mockPrisma = vi.mocked(prisma)
const mockRateLimit = vi.mocked(rateLimit)
const mockRateLimitAsync = vi.mocked(rateLimitAsync)

function makeParams(id: string, cardId: string) {
  return { params: Promise.resolve({ id, cardId }) }
}

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/workspaces/ws-1/cards/card-1/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const mockWorkspaceWithCard = {
  id: 'ws-1',
  userId: 'user_123',
  outputs: [
    {
      isActive: true,
      cards: [{ id: 'card-1', title: 'Test Card' }],
    },
  ],
}

describe('POST /api/workspaces/[id]/cards/[cardId]/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockReturnValue({ allowed: true, retryAfterMs: 0 })
    mockRateLimitAsync.mockResolvedValue({ allowed: true, retryAfterMs: 0 })
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValue(mockWorkspaceWithCard as any)
  })

  it('returns 400 for invalid workspace ID', async () => {
    const req = makeRequest({ topic: 'test' })
    const res = await POST(req, makeParams('../bad', 'card-1'))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid card ID', async () => {
    const req = makeRequest({ topic: 'test' })
    const res = await POST(req, makeParams('ws-1', 'bad!id'))
    expect(res.status).toBe(400)
  })

  it('returns 429 when rate limited', async () => {
    ;(mockAuth as any).mockResolvedValueOnce({ userId: 'user_123' } as any)
    mockRateLimitAsync.mockResolvedValueOnce({ allowed: false, retryAfterMs: 30000 })

    const req = makeRequest({ topic: 'test' })
    const res = await POST(req, makeParams('ws-1', 'card-1'))
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.error).toBe('Rate limited')
    expect(res.headers.get('Retry-After')).toBe('30')
  })

  it('returns 401 when not authenticated', async () => {
    (mockAuth as any).mockResolvedValueOnce({ userId: null } as any)

    const req = makeRequest({ topic: 'test' })
    const res = await POST(req, makeParams('ws-1', 'card-1'))

    expect(res.status).toBe(401)
  })

  it('returns 404 when workspace not found or not owned', async () => {
    ;(mockAuth as any).mockResolvedValueOnce({ userId: 'user_123' } as any)
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValue(null)

    const req = makeRequest({ topic: 'test' })
    const res = await POST(req, makeParams('ws-1', 'card-1'))

    expect(res.status).toBe(404)
  })

  it('returns 400 when characterLimit is non-positive', async () => {
    ;(mockAuth as any).mockResolvedValueOnce({ userId: 'user_123' } as any)

    const req = makeRequest({ topic: 'test', characterLimit: 0 })
    const res = await POST(req, makeParams('ws-1', 'card-1'))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('No available space for this card')
  })

  it('returns 500 when AI API not configured', async () => {
    const originalUrl = process.env.AI_API_URL
    const originalKey = process.env.AI_API_KEY
    delete process.env.AI_API_URL
    delete process.env.AI_API_KEY

    ;(mockAuth as any).mockResolvedValueOnce({ userId: 'user_123' } as any)

    const req = makeRequest({ topic: 'test' })
    const res = await POST(req, makeParams('ws-1', 'card-1'))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('AI API configuration missing (AI_API_URL or AI_API_KEY)')

    // Restore
    if (originalUrl) process.env.AI_API_URL = originalUrl
    if (originalKey) process.env.AI_API_KEY = originalKey
  })

  it('returns 400 when topic is missing', async () => {
    const originalUrl = process.env.AI_API_URL
    const originalKey = process.env.AI_API_KEY
    process.env.AI_API_URL = 'http://fake-ai-api'
    process.env.AI_API_KEY = 'fake-key'

    ;(mockAuth as any).mockResolvedValueOnce({ userId: 'user_123' } as any)

    const req = makeRequest({})
    const res = await POST(req, makeParams('ws-1', 'card-1'))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Card topic is required')

    // Restore
    process.env.AI_API_URL = originalUrl || ''
    process.env.AI_API_KEY = originalKey || ''
  })
})
