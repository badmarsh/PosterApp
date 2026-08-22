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

// Mock fs module
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    promises: {
      readdir: vi.fn(),
      readFile: vi.fn(),
    },
  },
  existsSync: vi.fn(),
  promises: {
    readdir: vi.fn(),
    readFile: vi.fn(),
  },
}))

import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import { POST } from '@/app/api/workspaces/[id]/cards/[cardId]/generate/route'
import { NextRequest } from 'next/server'

const mockAuth = vi.mocked(auth)
const mockPrisma = vi.mocked(prisma)
const mockRateLimit = vi.mocked(rateLimit)

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

describe('POST /api/workspaces/[id]/cards/[cardId]/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockReturnValue({ allowed: true, retryAfterMs: 0 })
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
    mockRateLimit.mockReturnValueOnce({ allowed: false, retryAfterMs: 30000 })

    const req = makeRequest({ topic: 'test' })
    const res = await POST(req, makeParams('ws-1', 'card-1'))
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.error).toBe('Rate limited')
    expect(res.headers.get('Retry-After')).toBe('30')
  })

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce({ userId: null } as any)

    const req = makeRequest({ topic: 'test' })
    const res = await POST(req, makeParams('ws-1', 'card-1'))

    expect(res.status).toBe(401)
  })

  it('returns 404 when workspace not found or not owned', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'user_123' } as any)
    mockPrisma.workspace.findUnique.mockResolvedValueOnce(null)

    const req = makeRequest({ topic: 'test' })
    const res = await POST(req, makeParams('ws-1', 'card-1'))

    expect(res.status).toBe(404)
  })

  it('returns 503 when AI API not configured', async () => {
    const originalUrl = process.env.AI_API_URL
    const originalKey = process.env.AI_API_KEY
    delete process.env.AI_API_URL
    delete process.env.AI_API_KEY

    mockAuth.mockResolvedValueOnce({ userId: 'user_123' } as any)
    mockPrisma.workspace.findUnique.mockResolvedValueOnce({ id: 'ws-1', userId: 'user_123' } as any)

    const req = makeRequest({ topic: 'test' })
    const res = await POST(req, makeParams('ws-1', 'card-1'))
    const json = await res.json()

    expect(res.status).toBe(503)
    expect(json.error).toBe('AI API configuration missing')

    // Restore
    if (originalUrl) process.env.AI_API_URL = originalUrl
    if (originalKey) process.env.AI_API_KEY = originalKey
  })

  it('returns 400 when topic is missing', async () => {
    const originalUrl = process.env.AI_API_URL
    const originalKey = process.env.AI_API_KEY
    process.env.AI_API_URL = 'http://fake-ai-api'
    process.env.AI_API_KEY = 'fake-key'

    mockAuth.mockResolvedValueOnce({ userId: 'user_123' } as any)
    mockPrisma.workspace.findUnique.mockResolvedValueOnce({ id: 'ws-1', userId: 'user_123' } as any)

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
