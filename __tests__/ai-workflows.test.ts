import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  const mocks = {
    existsSync: vi.fn(),
    promises: {
      ...actual.promises,
      readdir: vi.fn(),
      stat: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      unlink: vi.fn(),
    }
  }
  return {
    ...actual,
    ...mocks,
    default: {
      ...actual,
      ...mocks,
    }
  }
})

vi.mock('@/lib/auth', () => ({
  requireWorkspaceEditor: vi.fn(),
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

vi.mock('@/lib/ai/client', () => ({
  generateAIResponse: vi.fn(),
  generateAITextResponse: vi.fn(),
}))

import { requireWorkspaceEditor } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { rateLimit, rateLimitAsync } from '@/lib/rate-limit'
import { POST as AutofixCompilePOST } from '@/app/api/workspaces/[id]/autofix-compile/route'
import { POST as ShrinkPOST } from '@/app/api/workspaces/[id]/cards/[cardId]/shrink/route'
import { loadSourceContext } from '@/lib/ai/context'
import { POST as ImageEditPOST } from '@/app/api/ingestion/image-edit/route'
import { POST as ChatPOST } from '@/app/api/workspaces/[id]/chat/route'
import { POST as ReviewPOST } from '@/app/api/workspaces/[id]/review/route'
import { generateAITextResponse, generateAIResponse } from '@/lib/ai/client'
import { NextRequest } from 'next/server'

const mockAuth = vi.mocked(requireWorkspaceEditor)
const mockPrisma = vi.mocked(prisma)
const mockGenerateAIText = vi.mocked(generateAITextResponse)
const mockGenerateAI = vi.mocked(generateAIResponse)

describe('AI Workflows Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(rateLimit).mockReturnValue({ allowed: true, retryAfterMs: 0 })
    vi.mocked(rateLimitAsync).mockResolvedValue({ allowed: true, retryAfterMs: 0 })
  })

  describe('Autofix Compile Route', () => {
    it('rejects with 409 if revision is stale', async () => {
      mockAuth.mockResolvedValueOnce({ 
        userId: 'user-1', 
        workspace: { id: 'ws-1', revision: 5 } 
      } as any)

      const req = new NextRequest('http://localhost/api/workspaces/ws-1/autofix-compile?revision=4', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log: 'error', cards: [] }),
      })

      const res = await AutofixCompilePOST(req, { params: Promise.resolve({ id: 'ws-1' }) })
      expect(res.status).toBe(409)
      const data = await res.json()
      expect(data.error).toBe('Stale revision')
    })

    it('filters out patches containing unsafe LaTeX or unknown card IDs', async () => {
      mockAuth.mockResolvedValueOnce({
        userId: 'user-1',
        workspace: { id: 'ws-1', revision: 5 }
      } as any)

      ;(mockPrisma.workspace.findUnique as any).mockResolvedValueOnce({
        id: 'ws-1',
        outputs: [
          {
            isActive: true,
            cards: [{ id: 'card-1' }, { id: 'card-2' }]
          }
        ]
      })

      mockGenerateAI.mockResolvedValueOnce({
        explanation: 'Fixed LaTeX issues',
        patches: [
          { id: 'card-1', content: 'Clean safe markdown content.' },
          { id: 'card-2', content: 'Unsafe {unbalanced content.' },
          { id: 'card-unknown', content: 'Content for nonexistent card.' },
        ]
      })

      const req = new NextRequest('http://localhost/api/workspaces/ws-1/autofix-compile?revision=5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          log: 'Compile error log',
          cards: [{ id: 'card-1', content: 'Old' }, { id: 'card-2', content: 'Old' }]
        }),
      })

      const res = await AutofixCompilePOST(req, { params: Promise.resolve({ id: 'ws-1' }) })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.fixes).toHaveLength(1)
      expect(data.fixes[0].id).toBe('card-1')
      expect(data.fixes[0].content).toBe('Clean safe markdown content.')
    })
  })


  describe('Shrink Content Route', () => {
    it('rejects with 409 if revision is stale', async () => {
      mockAuth.mockResolvedValueOnce({ 
        userId: 'user-1', 
        workspace: { id: 'ws-1', revision: 5 } 
      } as any)

      const req = new NextRequest('http://localhost/api/workspaces/ws-1/cards/c-1/shrink?revision=4', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'test' }),
      })

      const res = await ShrinkPOST(req, { params: Promise.resolve({ id: 'ws-1', cardId: 'c-1' }) })
      expect(res.status).toBe(409)
    })

    it('rejects with 400 if content is missing', async () => {
      mockAuth.mockResolvedValueOnce({ 
        userId: 'user-1', 
        workspace: { id: 'ws-1', revision: 5 } 
      } as any)

      const req = new NextRequest('http://localhost/api/workspaces/ws-1/cards/c-1/shrink?revision=5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const res = await ShrinkPOST(req, { params: Promise.resolve({ id: 'ws-1', cardId: 'c-1' }) })
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('Invalid request payload')
    })
  })

  describe('Source Context Caching', () => {
    it('loads context and caches it deterministically', async () => {
       const existsSyncMock = vi.mocked(fs.existsSync)
       const readdirMock = vi.mocked(fs.promises.readdir)
       const statMock = vi.mocked(fs.promises.stat)
       const readFileMock = vi.mocked(fs.promises.readFile)
       
       existsSyncMock.mockReturnValue(true)
       readdirMock.mockResolvedValue(['test.md'] as any)
       statMock.mockResolvedValue({ mtimeMs: 1000 } as any)
       readFileMock.mockResolvedValue('Hello World')
       
       const context1 = await loadSourceContext({ workspaceId: 'fake-ws' })
       expect(context1).toContain('Hello World')
       expect(readFileMock).toHaveBeenCalledTimes(1)
       
       const context2 = await loadSourceContext({ workspaceId: 'fake-ws' })
       expect(context2).toContain('Hello World')
       expect(readFileMock).toHaveBeenCalledTimes(1) 

       statMock.mockResolvedValueOnce({ mtimeMs: 2000 } as any)
       readFileMock.mockResolvedValueOnce('Hello World Updated')
       const context3 = await loadSourceContext({ workspaceId: 'fake-ws' })
       expect(context3).toContain('Hello World Updated')
       expect(readFileMock).toHaveBeenCalledTimes(2) 
    })
  })

  describe('Image Edit Route', () => {
    it('unlinks the draft file on discard', async () => {
      mockAuth.mockResolvedValueOnce({ userId: 'user-1' } as any)
      ;(mockPrisma.workspace.findUnique as any).mockResolvedValueOnce({ id: 'ws-1' })
      const existsSyncMock = vi.mocked(fs.existsSync).mockReturnValue(true)
      const unlinkMock = vi.mocked(fs.promises.unlink).mockResolvedValue()

      const req = new NextRequest('http://localhost/api/ingestion/image-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetUrl: '/api/workspaces/ws-1/assets/draft-123-test.png',
          workspaceId: 'ws-1',
          operation: 'discard',
        }),
      })

      const res = await ImageEditPOST(req)
      expect(res.status).toBe(200)
      expect(unlinkMock).toHaveBeenCalled()
    })
  })

  describe('Chat Route', () => {
    it('requires workspace editor access', async () => {
      mockAuth.mockRejectedValueOnce(new Error('Unauthorized'))
      
      const req = new NextRequest('http://localhost/api/workspaces/ws-1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [] }),
      })

      const res = await ChatPOST(req, { params: Promise.resolve({ id: 'ws-1' }) })
      expect(res.status).toBe(401)
    })

    it('successfully processes messages with bib context', async () => {
      mockAuth.mockResolvedValueOnce({
        userId: 'user-1',
        workspace: { id: 'ws-1', name: 'Project 1', bibKeys: ['Einstein1905'], bibContent: '@article{Einstein1905}' },
      } as any)
      ;(mockPrisma.workspace.findUnique as any).mockResolvedValueOnce({
        id: 'ws-1',
        outputs: [{ isActive: true, cards: [] }],
      } as any)
      mockGenerateAIText.mockResolvedValueOnce('Here is the reply <fix>Updated content</fix>')

      const req = new NextRequest('http://localhost/api/workspaces/ws-1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Improve this section' }],
        }),
      })

      const res = await ChatPOST(req, { params: Promise.resolve({ id: 'ws-1' }) })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.content).toContain('<fix>Updated content</fix>')
      expect(mockGenerateAIText).toHaveBeenCalled()
    })
  })

  describe('Review Route', () => {
    it('returns deterministic lintReport when AI call throws', async () => {
      mockAuth.mockResolvedValueOnce({
        userId: 'user-1',
        workspace: { id: 'ws-1' },
      } as any)
      mockGenerateAI.mockRejectedValueOnce(new Error('AI provider offline'))

      const req = new NextRequest('http://localhost/api/workspaces/ws-1/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bibKeys: ['KeyA'],
          cards: [{ id: 'card-1', title: 'Intro', content: 'Testing \\cite{MissingKey}', pattern: 'bullets' }],
        }),
      })

      const res = await ReviewPOST(req, { params: Promise.resolve({ id: 'ws-1' }) })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.aiUnavailable).toBe(true)
      expect(data.tips).toEqual([])
      expect(data.lintReport.missingCites).toContain('MissingKey')
      expect(data.lintReport.unusedBibKeys).toContain('KeyA')
    })
  })
})
