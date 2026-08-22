import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies before importing the routes
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { GET, POST } from '@/app/api/workspaces/route'

const mockAuth = vi.mocked(auth)
const mockPrisma = vi.mocked(prisma)

describe('GET /api/workspaces', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    (mockAuth as any).mockResolvedValueOnce({ userId: null } as any)

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
  })

  it('returns workspaces for authenticated user', async () => {
    (mockAuth as any).mockResolvedValueOnce({ userId: 'user_123' } as any)
;(mockPrisma.workspace.findMany as any).mockResolvedValueOnce([
      { id: 'ws-1', name: 'My Poster' },
      { id: 'ws-2', name: 'Another Poster' },
    ] as any)

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toHaveLength(2)
    expect(json[0].id).toBe('ws-1')
    expect(mockPrisma.workspace.findMany).toHaveBeenCalledWith({
      where: { userId: 'user_123' },
      select: { id: true, name: true },
    })
  })
})

describe('POST /api/workspaces', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    (mockAuth as any).mockResolvedValueOnce({ userId: null } as any)

    const req = new Request('http://localhost/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'test', name: 'Test' }),
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 400 for invalid input (missing name)', async () => {
    (mockAuth as any).mockResolvedValueOnce({ userId: 'user_123' } as any)

    const req = new Request('http://localhost/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'test' }),
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Validation failed')
  })

  it('returns 400 for invalid input (missing id)', async () => {
    (mockAuth as any).mockResolvedValueOnce({ userId: 'user_123' } as any)

    const req = new Request('http://localhost/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Validation failed')
  })

  it('creates a workspace with valid input', async () => {
    (mockAuth as any).mockResolvedValueOnce({ userId: 'user_123' } as any)
;(mockPrisma.workspace.create as any).mockResolvedValueOnce({
      id: 'new-ws',
      name: 'My New Poster',
      outputs: [
        {
          id: 'out_poster_123',
          outputType: 'poster',
          templateId: 'atlas',
          title: 'My New Poster',
          isActive: true,
          cards: [],
        },
      ],
    } as any)

    const req = new Request('http://localhost/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'new-ws', name: 'My New Poster', templateId: 'atlas', outputType: 'poster' }),
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.id).toBe('new-ws')
    expect(mockPrisma.workspace.create).toHaveBeenCalledWith({
      data: {
        id: 'new-ws',
        name: 'My New Poster',
        authors: '',
        venue: '',
        userId: 'user_123',
        outputs: expect.any(Object),
      },
      include: {
        outputs: {
          include: { cards: true },
        },
      },
    })
  })

  it('defaults templateName to atlas when not specified', async () => {
    (mockAuth as any).mockResolvedValueOnce({ userId: 'user_123' } as any)
;(mockPrisma.workspace.create as any).mockResolvedValueOnce({
      id: 'ws-2',
      name: 'Test',
      outputs: [
        {
          id: 'out_poster_456',
          outputType: 'poster',
          templateId: 'atlas',
          title: 'Test',
          isActive: true,
          cards: [],
        },
      ],
    } as any)

    const req = new Request('http://localhost/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'ws-2', name: 'Test' }),
    })

    await POST(req)

    expect(mockPrisma.workspace.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          outputs: expect.objectContaining({
            create: expect.objectContaining({
              templateId: 'atlas',
            }),
          }),
        }),
      })
    )
  })
})
