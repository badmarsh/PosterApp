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
}))

import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import { POST } from '@/app/api/workspaces/[id]/cards/convert/route'
import { NextRequest } from 'next/server'

const mockAuth = vi.mocked(auth)
const mockPrisma = vi.mocked(prisma)
const mockRateLimit = vi.mocked(rateLimit)

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

describe('POST /api/workspaces/[id]/cards/convert', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockReturnValue({ allowed: true, retryAfterMs: 0 })
  })

  it('returns 400 for invalid workspace ID', async () => {
    const req = makeRequest({ sourceContent: 'test' })
    const res = await POST(req, makeParams('../bad'))
    expect(res.status).toBe(400)
  })

  it('returns 429 when rate limited', async () => {
    ;(mockAuth as any).mockResolvedValueOnce({ userId: 'user_123' } as any)
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValueOnce({ id: 'ws-1', userId: 'user_123' } as any)
    mockRateLimit.mockReturnValueOnce({ allowed: false, retryAfterMs: 30000 })

    const req = makeRequest({ sourceContent: 'test' })
    const res = await POST(req, makeParams('ws-1'))
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.error).toBe('Rate limited')
    expect(res.headers.get('Retry-After')).toBe('30')
  })

  it('returns 401 when not authenticated', async () => {
    ;(mockAuth as any).mockResolvedValueOnce({ userId: null } as any)

    const req = makeRequest({ sourceContent: 'test' })
    const res = await POST(req, makeParams('ws-1'))

    expect(res.status).toBe(401)
  })

  it('returns 404 when workspace not found or not owned', async () => {
    ;(mockAuth as any).mockResolvedValueOnce({ userId: 'user_123' } as any)
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValueOnce(null)

    const req = makeRequest({ sourceContent: 'test' })
    const res = await POST(req, makeParams('ws-1'))

    expect(res.status).toBe(404)
  })

  it('returns 500 when AI API not configured', async () => {
    const originalUrl = process.env.AI_API_URL
    const originalKey = process.env.AI_API_KEY
    delete process.env.AI_API_URL
    delete process.env.AI_API_KEY

    ;(mockAuth as any).mockResolvedValueOnce({ userId: 'user_123' } as any)
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValueOnce({ id: 'ws-1', userId: 'user_123' } as any)

    const req = makeRequest({ sourceContent: 'test', sourceType: 'poster', targetType: 'slides' })
    const res = await POST(req, makeParams('ws-1'))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toBe('AI API configuration missing (AI_API_URL or AI_API_KEY)')

    if (originalUrl) process.env.AI_API_URL = originalUrl
    if (originalKey) process.env.AI_API_KEY = originalKey
  })

  it('returns 400 when sourceContent is missing', async () => {
    const originalUrl = process.env.AI_API_URL
    const originalKey = process.env.AI_API_KEY
    process.env.AI_API_URL = 'http://fake-ai-api'
    process.env.AI_API_KEY = 'fake-key'

    ;(mockAuth as any).mockResolvedValueOnce({ userId: 'user_123' } as any)
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValueOnce({ id: 'ws-1', userId: 'user_123' } as any)

    const req = makeRequest({}) // missing sourceContent
    const res = await POST(req, makeParams('ws-1'))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('sourceContent is required')

    process.env.AI_API_URL = originalUrl || ''
    process.env.AI_API_KEY = originalKey || ''
  })
})
