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
  loadSourceContext: vi.fn(() => Promise.resolve('Mock paper source context on particle physics and radiation.')),
}))

import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, rateLimitAsync } from '@/lib/rate-limit'
import { POST } from '@/app/api/workspaces/[id]/structure/generate/route'
import { NextRequest } from 'next/server'

const mockAuth = vi.mocked(auth)
const mockPrisma = vi.mocked(prisma)
const mockRateLimit = vi.mocked(rateLimit)
const mockRateLimitAsync = vi.mocked(rateLimitAsync)

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/workspaces/ws-1/structure/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/workspaces/[id]/structure/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockReturnValue({ allowed: true, retryAfterMs: 0 })
    mockRateLimitAsync.mockResolvedValue({ allowed: true, retryAfterMs: 0 })
  })

  it('returns 400 for invalid workspace ID', async () => {
    const req = makeRequest({ outputType: 'poster' })
    const res = await POST(req, makeParams('../bad'))
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthorized', async () => {
    mockAuth.mockResolvedValueOnce({ userId: null } as any)
    const req = makeRequest({ outputType: 'poster' })
    const res = await POST(req, makeParams('ws-1'))
    expect(res.status).toBe(401)
  })

  it('generates fallback structure when editor access confirmed but AI offline', async () => {
    ;(mockAuth as any).mockResolvedValueOnce({ userId: 'user-1' } as any)
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValueOnce({
      id: 'ws-1',
      userId: 'user-1',
      members: [],
    } as any)

    const req = makeRequest({ outputType: 'poster', count: 6 })
    const res = await POST(req, makeParams('ws-1'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.cards).toBeDefined()
    expect(data.cards.length).toBe(6)
    expect(data.cards[data.cards.length - 1].pattern).toBe('references')
  })
})
