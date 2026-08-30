import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    card: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    asset: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    ingestFile: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    workspaceSnapshot: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((cb: any) => cb(prismaMockTx)),
  },
}))

// Create a mock transaction client that has the same methods
const prismaMockTx = {
  workspace: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUnique: vi.fn() },
  output: { findMany: vi.fn().mockResolvedValue([]), upsert: vi.fn(), deleteMany: vi.fn(), findUnique: vi.fn() },
  card: { findMany: vi.fn().mockResolvedValue([]), upsert: vi.fn(), deleteMany: vi.fn(), findUnique: vi.fn() },
  asset: { findMany: vi.fn().mockResolvedValue([]), upsert: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
  ingestFile: { findMany: vi.fn().mockResolvedValue([]), upsert: vi.fn(), deleteMany: vi.fn(), findUnique: vi.fn() },
  workspaceSnapshot: { create: vi.fn().mockResolvedValue({ id: 'snap_1' }), findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() }
}

import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { GET, PUT, DELETE } from '@/app/api/workspaces/[id]/route'

const mockAuth = vi.mocked(auth)
const mockPrisma = vi.mocked(prisma)

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('GET /api/workspaces/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 for invalid ID format (path traversal)', async () => {
    const req = new Request('http://localhost/api/workspaces/../etc')
    const res = await GET(req, makeParams('../etc'))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Invalid workspace ID')
  })

  it('returns 400 for ID with special characters', async () => {
    const req = new Request('http://localhost/api/workspaces/test%20space')
    const res = await GET(req, makeParams('test space'))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Invalid workspace ID')
  })

  it('returns 401 when not authenticated', async () => {
    (mockAuth as any).mockResolvedValueOnce({ userId: null } as any)

    const req = new Request('http://localhost/api/workspaces/valid-id')
    const res = await GET(req, makeParams('valid-id'))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error?.code || json.error).toBeTruthy()
  })

  it('returns 404 when workspace not found or not owned by user', async () => {
    ;(mockAuth as any).mockResolvedValueOnce({ userId: 'user_123' } as any)
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValueOnce(null)

    const req = new Request('http://localhost/api/workspaces/not-mine')
    const res = await GET(req, makeParams('not-mine'))
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error?.code || json.error).toBeTruthy()
  })

  it('returns workspace data with parsed JSON fields', async () => {
    ;(mockAuth as any).mockResolvedValueOnce({ userId: 'user_123' } as any)
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValue({
      id: 'ws-1',
      name: 'Test',
      userId: 'user_123',
      members: [],
      agentEvents: '[]',
      chatMessages: '[]',
      outputs: [
        {
          id: 'out_1',
          outputType: 'poster',
          templateId: 'atlas',
          title: 'Test',
          isActive: true,
          cards: [
            {
              id: 'card-1',
              title: 'Intro',
              table: null,
              figures: '[]',
              sourceIds: '["src1"]',
            },
          ],
        },
      ],
      assets: [
        {
          id: 'a-1',
          tableRows: null,
        },
      ],
      ingestFiles: [],
    } as any)

    const req = new Request('http://localhost/api/workspaces/ws-1')
    const res = await GET(req, makeParams('ws-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.id).toBe('ws-1')
    expect(json.agentEvents).toEqual([])
    expect(json.outputs[0].cards[0].figures).toEqual([])
    expect(json.outputs[0].cards[0].sourceIds).toEqual(['src1'])
    // Check backward compatibility legacy fields
    expect(json.cards[0].id).toBe('card-1')
  })
})

describe('DELETE /api/workspaces/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 for invalid ID', async () => {
    const req = new Request('http://localhost/api/workspaces/bad!id', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('bad!id'))
    expect(res.status).toBe(400)
  })

  it('returns 401 when not authenticated', async () => {
    (mockAuth as any).mockResolvedValueOnce({ userId: null } as any)

    const req = new Request('http://localhost/api/workspaces/valid-id', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('valid-id'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when workspace not found or not owned', async () => {
    ;(mockAuth as any).mockResolvedValueOnce({ userId: 'user_123' } as any)
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValueOnce(null)

    const req = new Request('http://localhost/api/workspaces/other-ws', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('other-ws'))
    expect(res.status).toBe(404)
  })
})

describe('PUT /api/workspaces/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 for invalid ID format', async () => {
    const req = new Request('http://localhost/api/workspaces/..%2F..', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'test' }),
    })
    const res = await PUT(req, makeParams('../../'))
    expect(res.status).toBe(400)
  })

  it('returns 401 when not authenticated', async () => {
    (mockAuth as any).mockResolvedValueOnce({ userId: null } as any)

    const req = new Request('http://localhost/api/workspaces/ws-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'updated' }),
    })
    const res = await PUT(req, makeParams('ws-1'))
    expect(res.status).toBe(401)
  })

  it('returns 404 when workspace not owned by user', async () => {
    ;(mockAuth as any).mockResolvedValueOnce({ userId: 'user_123' } as any)
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValueOnce(null)

    const req = new Request('http://localhost/api/workspaces/ws-other', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'updated' }),
    })
    const res = await PUT(req, makeParams('ws-other'))
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid body (bad card column)', async () => {
    ;(mockAuth as any).mockResolvedValueOnce({ userId: 'user_123' } as any)
    ;(mockPrisma.workspace.findUnique as any).mockResolvedValue({ id: 'ws-1', userId: 'user_123', revision: 1, members: [] } as any)

    const req = new Request('http://localhost/api/workspaces/ws-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'test',
        cards: [{ id: 'c1', column: 99, order: 0, pattern: 'bullets' }],
      }),
    })
    const res = await PUT(req, makeParams('ws-1'))
    expect(res.status).toBe(400)
  })
})
