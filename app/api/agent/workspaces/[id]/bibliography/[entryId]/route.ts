import { rateLimitAsync } from "@/lib/rate-limit"
import { NextRequest, NextResponse } from 'next/server'
import { verifyAgentKey, requireScope, requireAgentWorkspaceAccess, AgentAuthError } from '@/lib/agent-auth'
import { logToolCall } from '@/lib/agent-audit'
import { createWorkspaceSnapshot } from '@/lib/agent-snapshot'
import { prisma } from '@/lib/prisma'
import { parseBibKeys } from '@/lib/bib-parser'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  const start = Date.now()
  try {
    const { id, entryId } = await params
    const ctx = await verifyAgentKey(req)
    requireScope(ctx, 'bibliography:write')
    await requireAgentWorkspaceAccess(ctx, id, true)

    // MANDATORY PRE-WRITE SNAPSHOT
    const snap = await createWorkspaceSnapshot(id, `agent:bib:remove:${entryId}`)

    const workspace = await prisma.workspace.findUnique({ where: { id }, select: { bibContent: true } })
    const currentBib = workspace?.bibContent || ''

    // Remove entry by matching @type{entryId, ...}
    const regex = new RegExp(`@\\w+\\s*\\{\\s*${entryId}\\s*,[\\s\\S]*?\\n\\s*\\}`, 'g')
    const newBib = currentBib.replace(regex, '').trim()
    const updatedKeys = parseBibKeys(newBib)

    await prisma.workspace.update({
      where: { id },
      data: {
        bibContent: newBib,
        bibKeys: updatedKeys,
        revision: { increment: 1 },
      },
    })

    const result = {
      ok: true,
      removedKey: entryId,
      totalKeys: updatedKeys.length,
      preWriteSnapshotId: snap.id,
    }

    await logToolCall(ctx, id, 'posterapp.bibliography.remove', { entryId }, result, Date.now() - start, true)
    return NextResponse.json(result)
  } catch (err: any) {
    if (err instanceof AgentAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[agent bibliography DELETE] Error:', err)
    return NextResponse.json({ error: 'Failed to remove bibliography entry' }, { status: 500 })
  }
}
