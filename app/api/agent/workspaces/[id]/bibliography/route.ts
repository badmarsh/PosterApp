import { rateLimitAsync } from "@/lib/rate-limit"
import { NextRequest, NextResponse } from 'next/server'
import { verifyAgentKey, requireScope, requireAgentWorkspaceAccess, AgentAuthError } from '@/lib/agent-auth'
import { logToolCall } from '@/lib/agent-audit'
import { createWorkspaceSnapshot } from '@/lib/agent-snapshot'
import { prisma } from '@/lib/prisma'
import { parseBibKeys, extractCiteKeys } from '@/lib/bib-parser'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const start = Date.now()
  try {
    const { id } = await params
    const ctx = await verifyAgentKey(req)
    const hasScope = ctx.scopes.includes('*') || ctx.scopes.includes('bibliography:read') || ctx.scopes.includes('workspace:read')
    if (!hasScope) {
      return NextResponse.json({ error: 'Scope required: bibliography:read' }, { status: 403 })
    }
    await requireAgentWorkspaceAccess(ctx, id, false)

    const workspace = await prisma.workspace.findUnique({
      where: { id },
      include: {
        outputs: {
          include: { cards: true },
        },
      },
    })

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const bibContent = workspace.bibContent || ''
    const keys = parseBibKeys(bibContent)

    // Map which cards cite which keys
    const citedByCards: Record<string, string[]> = {}
    for (const k of keys) {
      citedByCards[k] = []
    }

    const activeOutput = workspace.outputs.find((o) => o.isActive) || workspace.outputs[0]
    if (activeOutput) {
      for (const card of activeOutput.cards) {
        const found = extractCiteKeys(card.content || '')
        for (const k of found) {
          if (!citedByCards[k]) citedByCards[k] = []
          if (!citedByCards[k].includes(card.id)) citedByCards[k].push(card.id)
        }
      }
    }

    const result = {
      bibContent,
      keys,
      citedByCards,
    }

    await logToolCall(ctx, id, 'posterapp.bibliography.list', {}, { count: keys.length }, Date.now() - start)
    return NextResponse.json(result)
  } catch (err: any) {
    if (err instanceof AgentAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[agent bibliography GET] Error:', err)
    return NextResponse.json({ error: 'Failed to get bibliography' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const start = Date.now()
  try {
    const { id } = await params
    const ctx = await verifyAgentKey(req)
    requireScope(ctx, 'bibliography:write')
    await requireAgentWorkspaceAccess(ctx, id, true)

    const body = await req.json()

    // Generate BibTeX string if structured fields given
    let entryText = ''
    let key = body.key

    if (body.bibEntry && typeof body.bibEntry === 'string') {
      entryText = body.bibEntry.trim()
      const found = parseBibKeys(entryText)
      if (found.length > 0) key = found[0]
    } else if (body.title) {
      const authorsStr = Array.isArray(body.authors) ? body.authors.join(' and ') : (body.authors || 'Unknown')
      const firstAuthor = (Array.isArray(body.authors) && body.authors[0]) ? body.authors[0].split(' ').pop()?.replace(/[^a-zA-Z]/g, '') : 'Ref'
      const yearStr = body.year ? String(body.year) : new Date().getFullYear().toString()
      key = key || `${firstAuthor}${yearStr}`
      const doiField = body.doi ? `  doi = {${body.doi}},\n` : ''
      entryText = `@article{${key},\n  title = {${body.title}},\n  author = {${authorsStr}},\n  year = {${yearStr}},\n${doiField}}`
    } else if (body.bib && typeof body.bib === 'string') {
      entryText = body.bib.trim()
      const found = parseBibKeys(entryText)
      if (found.length > 0) key = found[0]
    } else {
      return NextResponse.json({ error: 'Invalid input. Expected title, bibEntry, or bib string.' }, { status: 400 })
    }

    // MANDATORY PRE-WRITE SNAPSHOT
    const snap = await createWorkspaceSnapshot(id, `agent:bib:add:${key || 'entry'}`)

    const workspace = await prisma.workspace.findUnique({ where: { id }, select: { bibContent: true } })
    const currentBib = workspace?.bibContent || ''
    const newBib = currentBib ? `${currentBib.trim()}\n\n${entryText}\n` : `${entryText}\n`

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
      key,
      entry: entryText,
      totalKeys: updatedKeys.length,
      preWriteSnapshotId: snap.id,
    }

    await logToolCall(ctx, id, 'posterapp.bibliography.add', body, result, Date.now() - start, true)
    return NextResponse.json(result)
  } catch (err: any) {
    if (err instanceof AgentAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[agent bibliography POST] Error:', err)
    return NextResponse.json({ error: 'Failed to add bibliography entry' }, { status: 500 })
  }
}
