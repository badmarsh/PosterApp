import { NextRequest, NextResponse } from 'next/server'
import { verifyAgentKey, requireScope, requireAgentWorkspaceAccess, AgentAuthError } from '@/lib/agent-auth'
import { logToolCall } from '@/lib/agent-audit'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const start = Date.now()
  try {
    const { id } = await params
    const ctx = await verifyAgentKey(req)
    requireScope(ctx, 'workspace:read')
    await requireAgentWorkspaceAccess(ctx, id, false)

    const workspace = await prisma.workspace.findUnique({
      where: { id },
      include: {
        outputs: {
          include: {
            cards: {
              orderBy: { order: 'asc' },
            },
          },
        },
        assets: true,
        ingestFiles: true,
      },
    })

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // A restricted-context key cannot safely receive this legacy full-object
    // response because it also contains bibliography, assets, and ingest files.
    // Preserve workspace metadata and only expose the selected card payloads;
    // callers needing full card data should use the cards endpoint.
    const responseWorkspace =
      ctx.restrictCardIds.length > 0
        ? {
            id: workspace.id,
            name: workspace.name,
            authors: workspace.authors,
            venue: workspace.venue,
            revision: workspace.revision,
            outputs: workspace.outputs.map((output) => ({
              ...output,
              cards: output.cards.filter((card) => ctx.restrictCardIds.includes(card.id)),
            })),
            assets: [],
            ingestFiles: [],
          }
        : workspace

    await logToolCall(ctx, id, 'posterapp.workspaces.get', { id }, { id: workspace.id, name: workspace.name }, Date.now() - start)
    return NextResponse.json(responseWorkspace)
  } catch (err: any) {
    if (err instanceof AgentAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[agent workspace GET] Error:', err)
    return NextResponse.json({ error: 'Failed to get workspace' }, { status: 500 })
  }
}
