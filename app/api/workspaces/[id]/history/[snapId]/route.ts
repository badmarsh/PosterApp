import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireWorkspaceAccess, requireWorkspaceEditor } from "@/lib/auth"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; snapId: string }> }
) {
  const { id, snapId } = await params
  try { await requireWorkspaceAccess(id) } catch (error) { if (error instanceof Response) return error; throw error }

  const snap = await prisma.workspaceSnapshot.findUnique({ where: { id: snapId, workspaceId: id } })
  if (!snap) return NextResponse.json({ error: "Snapshot not found" }, { status: 404 })

  return NextResponse.json({ ...snap, snapshot: JSON.parse(snap.snapshot) })
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; snapId: string }> }
) {
  const { id, snapId } = await params
  let workspace
  try { workspace = (await requireWorkspaceEditor(id)).workspace } catch (error) { if (error instanceof Response) return error; throw error }

  const snap = await prisma.workspaceSnapshot.findUnique({ where: { id: snapId, workspaceId: id } })
  if (!snap) return NextResponse.json({ error: "Snapshot not found" }, { status: 404 })

  const body = await req.json().catch(() => ({})) as { revision?: number }
  if (!Number.isInteger(body.revision) || body.revision !== workspace.revision) return NextResponse.json({ error: { code: "REVISION_CONFLICT", message: "Workspace changed; reload before restoring" } }, { status: 409 })
  const snapData = JSON.parse(snap.snapshot) as {
    name?: string; authors?: string; venue?: string; bibContent?: string
    bibKeys?: string; agentEvents?: string; chatMessages?: string
    outputs?: Array<{ id: string; outputType: string; templateId: string; title: string; themeColor?: string | null; isActive: boolean; cards: Array<{
      id: string; title: string; column?: number | null; order: number; pattern: string; content: string
      table?: any; figures?: any; figureLayout: string; sourceIds?: any
      heightBudget?: number | null; validation: string; generatedLatex?: string | null; slideNotes?: string | null
    }> }>
    assets?: Array<{ id: string; fileId: string; filename?: string | null; url?: string | null; kind: string; page: number; section?: string | null; bbox?: string | null; confidence: string; heading?: string | null; snippet?: string | null; thumbnailUrl?: string | null; caption?: string | null; tableRows?: any; assignedCardId?: string | null; assignedSlot?: string | null }>
  }

  // Restore workspace fields + outputs + cards in a transaction
  await prisma.$transaction(async (tx) => {
    // Update workspace scalar fields
    const changed = await tx.workspace.updateMany({
      where: { id, revision: body.revision },
      data: {
        revision: { increment: 1 },
        name: snapData.name ?? undefined,
        authors: snapData.authors ?? undefined,
        venue: snapData.venue ?? undefined,
        bibContent: snapData.bibContent ?? undefined,
        bibKeys: snapData.bibKeys ?? undefined,
        agentEvents: snapData.agentEvents ?? undefined,
        chatMessages: snapData.chatMessages ?? undefined,
      },
    })
    if (changed.count !== 1) throw new Error("revision conflict")

    // Delete all existing outputs (cascades to cards)
    await tx.output.deleteMany({ where: { workspaceId: id } })

    // Re-create outputs + cards from snapshot
    for (const output of (snapData.outputs ?? [])) {
      await tx.output.create({
        data: {
          id: output.id,
          workspaceId: id,
          outputType: output.outputType,
          templateId: output.templateId,
          title: output.title,
          themeColor: output.themeColor,
          isActive: output.isActive,
          cards: {
            create: output.cards.map((c) => ({
              id: c.id,
              title: c.title,
              column: c.column ?? null,
              order: c.order,
              pattern: c.pattern,
              content: c.content,
              table: c.table === null ? Prisma.DbNull : (c.table as any),
              figures: c.figures === null ? Prisma.DbNull : (c.figures as any),
              figureLayout: c.figureLayout,
              sourceIds: c.sourceIds === null ? Prisma.DbNull : (c.sourceIds as any),
              heightBudget: c.heightBudget ?? null,
              validation: c.validation,
              generatedLatex: c.generatedLatex ?? null,
              slideNotes: c.slideNotes ?? null,
            })),
          },
        },
      })
    }
    // Asset rows are not binary snapshots. Restore their metadata and card
    // assignments only when the corresponding files still exist on disk.
    if (snapData.assets) {
      await tx.asset.deleteMany({ where: { workspaceId: id } })
      if (snapData.assets.length) await tx.asset.createMany({ data: snapData.assets.map((asset) => ({ ...asset, workspaceId: id })) })
    }
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; snapId: string }> }
) {
  const { id, snapId } = await params
  try { await requireWorkspaceEditor(id) } catch (error) { if (error instanceof Response) return error; throw error }

  await prisma.workspaceSnapshot.deleteMany({ where: { id: snapId, workspaceId: id } })
  return NextResponse.json({ ok: true })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; snapId: string }> }
) {
  const { id, snapId } = await params
  try { await requireWorkspaceEditor(id) } catch (error) { if (error instanceof Response) return error; throw error }

  const body = await req.json().catch(() => ({}))
  const label = typeof body.label === "string" ? body.label.slice(0, 100) : null

  const updated = await prisma.workspaceSnapshot.updateMany({
    where: { id: snapId, workspaceId: id },
    data: { label },
  })

  if (updated.count === 0) return NextResponse.json({ error: "Snapshot not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}

