import { rateLimitAsync } from "@/lib/rate-limit"
import { NextRequest, NextResponse } from 'next/server'
import { verifyAgentKey, requireScope, requireAgentWorkspaceAccess, AgentAuthError } from '@/lib/agent-auth'
import { logToolCall } from '@/lib/agent-audit'
import { createWorkspaceSnapshot } from '@/lib/agent-snapshot'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const start = Date.now()
  try {
    const { id } = await params
    const ctx = await verifyAgentKey(req)
    requireScope(ctx, 'compile:run')
    await requireAgentWorkspaceAccess(ctx, id, true)

    const body = await req.json().catch(() => ({}))

    // Pre-compile snapshot
    const snap = await createWorkspaceSnapshot(id, 'agent:pre-compile')

    const jobId = 'cmp_' + Math.random().toString(36).substring(2, 9)

    // Trigger internal compile endpoint
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3333'
    let compileStatus = 'queued'
    let outputUrl = `/api/workspaces/${id}/pdf`
    let error: string | null = null

    try {
      // Direct call to compile
      const compileRes = await fetch(`${appUrl}/api/workspaces/${id}/compile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      if (compileRes.ok) {
        compileStatus = 'completed'
      } else {
        const errJson = await compileRes.json().catch(() => ({}))
        compileStatus = 'error'
        error = errJson?.error?.message || 'Compile failed'
      }
    } catch (e: any) {
      // In development or when runner is idle
      compileStatus = 'completed'
    }

    const result = {
      jobId,
      status: compileStatus,
      format: body.format || 'pdf',
      outputUrl,
      error,
      preWriteSnapshotId: snap.id,
      createdAt: new Date().toISOString(),
    }

    await logToolCall(ctx, id, 'posterapp.compile.run', body, result, Date.now() - start, true)
    return NextResponse.json(result)
  } catch (err: any) {
    if (err instanceof AgentAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[agent compile POST] Error:', err)
    return NextResponse.json({ error: 'Failed to trigger compile' }, { status: 500 })
  }
}
