import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as CompileSummaryPOST } from '@/app/api/workspaces/[id]/compile-summary/route'
import { requireWorkspaceEditor } from '@/lib/auth'
import { summarizeCompileError } from '@/lib/latex/compile-summary'

vi.mock('@/lib/auth', () => ({
  requireWorkspaceEditor: vi.fn(),
}))

vi.mock('@/lib/latex/compile-summary', () => ({
  summarizeCompileError: vi.fn(),
}))

const mockAuth = vi.mocked(requireWorkspaceEditor)
const mockSummarize = vi.mocked(summarizeCompileError)

describe('Compile Summary Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows demo workspaces without auth and returns summary', async () => {
    mockSummarize.mockResolvedValueOnce('Demo compile error: missing dollar sign.')

    const req = new NextRequest('http://localhost/api/workspaces/demo_showcase/compile-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ log: '! Missing $ inserted.\nl.10 }' }),
    })

    const res = await CompileSummaryPOST(req, { params: Promise.resolve({ id: 'demo_showcase' }) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.summary).toBe('Demo compile error: missing dollar sign.')
    expect(mockAuth).not.toHaveBeenCalled()
  })

  it('requires auth for non-demo workspaces', async () => {
    mockAuth.mockRejectedValueOnce(new Response('Unauthorized', { status: 401 }))

    const req = new NextRequest('http://localhost/api/workspaces/ws-real/compile-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ log: '! Error' }),
    })

    const res = await CompileSummaryPOST(req, { params: Promise.resolve({ id: 'ws-real' }) })
    expect(res.status).toBe(401)
  })

  it('validates that log is provided', async () => {
    mockAuth.mockResolvedValueOnce({ userId: 'u-1', workspace: { id: 'ws-real' } } as any)

    const req = new NextRequest('http://localhost/api/workspaces/ws-real/compile-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const res = await CompileSummaryPOST(req, { params: Promise.resolve({ id: 'ws-real' }) })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Compiler log is required')
  })
})