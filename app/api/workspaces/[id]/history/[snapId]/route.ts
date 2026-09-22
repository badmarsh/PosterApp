import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireWorkspaceAccess, requireWorkspaceEditor } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { safeApiError } from "@/lib/security"
import { z } from "zod"

const SnapshotDataSchema = z.object({
  name: z.string().optional(),
  authors: z.string().optional(),
  venue: z.string().optional(),
  bibContent: z.string().nullable().optional(),
  bibKeys: z.any().optional(),
  agentEvents: z.any().optional(),
  chatMessages: z.any().optional(),
  logoUrl: z.string().nullable().optional(),
  secondaryLogoUrl: z.string().nullable().optional(),
  outputs: z.array(z.object({
    id: z.string(),
    outputType: z.string(),
    templateId: z.string(),
    title: z.string(),
    themeColor: z.string().nullable().optional(),
    isActive: z.boolean().default(false),
    authors: z.string().nullable().optional(),
    venue: z.string().nullable().optional(),
    logoUrl: z.string().nullable().optional(),
    secondaryLogoUrl: z.string().nullable().optional(),
    sourceIds: z.any().optional(),
    cards: z.array(z.object({
      id: z.string(),
      title: z.string().default(""),
      column: z.number().int().nullable().optional(),
      order: z.number().int(),
      pattern: z.string(),
      content: z.string().default(""),
      table: z.any().optional(),
      figures: z.any().optional(),
      figureLayout: z.string().default("single"),
      sourceIds: z.any().optional(),
      heightBudget: z.number().nullable().optional(),
      validation: z.string().default("valid"),
      generatedLatex: z.string().nullable().optional(),
      slideNotes: z.string().nullable().optional(),
    })).default([]),
  })).optional(),
  assets: z.array(z.object({
    id: z.string(),
    fileId: z.string().default("unknown-file"),
    filename: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
    kind: z.string().default("figure"),
    page: z.number().int().default(1),
    section: z.string().nullable().optional(),
    bbox: z.string().nullable().optional(),
    confidence: z.string().default("high"),
    heading: z.string().nullable().optional(),
    snippet: z.string().nullable().optional(),
    thumbnailUrl: z.string().nullable().optional(),
    caption: z.string().nullable().optional(),
    tableRows: z.any().optional(),
    assignedCardId: z.string().nullable().optional(),
    assignedSlot: z.string().nullable().optional(),
  })).optional(),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; snapId: string }> }
) {
  const { id, snapId } = await params
  try {
    await requireWorkspaceAccess(id)
  } catch (error) {
    if (error instanceof Response) return error
    throw error
  }

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
  let userId: string
  try {
    const access = await requireWorkspaceEditor(id)
    workspace = access.workspace
    userId = access.userId
  } catch (error) {
    if (error instanceof Response) return error
    throw error
  }

  const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:${id}:snapshot-restore`, 10, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many restore requests", retryAfterMs },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    )
  }

  const snap = await prisma.workspaceSnapshot.findUnique({ where: { id: snapId, workspaceId: id } })
  if (!snap) return NextResponse.json({ error: "Snapshot not found" }, { status: 404 })

  const body = await req.json().catch(() => ({})) as { revision?: number }
  if (!Number.isInteger(body.revision) || body.revision !== workspace.revision) {
    return NextResponse.json({ error: { code: "REVISION_CONFLICT", message: "Workspace changed; reload before restoring" } }, { status: 409 })
  }

  let parsedSnapshot: z.infer<typeof SnapshotDataSchema>
  try {
    const rawParsed = JSON.parse(snap.snapshot)
    parsedSnapshot = SnapshotDataSchema.parse(rawParsed)
  } catch (err) {
    console.error("[Snapshot restore] Invalid snapshot JSON:", err)
    return NextResponse.json({ error: "Corrupted snapshot payload" }, { status: 422 })
  }

  try {
    // Restore workspace fields + outputs + cards + assets in a single transaction
    await prisma.$transaction(async (tx) => {
      // Update workspace scalar fields
      const changed = await tx.workspace.updateMany({
        where: { id, revision: body.revision },
        data: {
          revision: { increment: 1 },
          name: parsedSnapshot.name ?? undefined,
          authors: parsedSnapshot.authors ?? undefined,
          venue: parsedSnapshot.venue ?? undefined,
          bibContent: parsedSnapshot.bibContent ?? undefined,
          bibKeys: parsedSnapshot.bibKeys ?? undefined,
          agentEvents: parsedSnapshot.agentEvents ?? undefined,
          chatMessages: parsedSnapshot.chatMessages ?? undefined,
          logoUrl: parsedSnapshot.logoUrl ?? undefined,
          secondaryLogoUrl: parsedSnapshot.secondaryLogoUrl ?? undefined,
        },
      })
      if (changed.count !== 1) throw new Error("revision conflict")

      // Delete all existing outputs (cascades to cards)
      await tx.output.deleteMany({ where: { workspaceId: id } })

      // Re-create outputs + cards from snapshot (restoring ALL metadata fields: B2)
      for (const output of (parsedSnapshot.outputs ?? [])) {
        await tx.output.create({
          data: {
            id: output.id,
            workspaceId: id,
            outputType: output.outputType,
            templateId: output.templateId,
            title: output.title,
            themeColor: output.themeColor,
            isActive: output.isActive,
            authors: output.authors ?? null,
            venue: output.venue ?? null,
            logoUrl: output.logoUrl ?? null,
            secondaryLogoUrl: output.secondaryLogoUrl ?? null,
            sourceIds: output.sourceIds ?? undefined,
            cards: {
              create: output.cards.map((c) => ({
                id: c.id,
                title: c.title,
                column: c.column ?? null,
                order: c.order,
                pattern: c.pattern,
                content: c.content,
                table: c.table === null || c.table === undefined ? Prisma.DbNull : (c.table as any),
                figures: c.figures === null || c.figures === undefined ? Prisma.DbNull : (c.figures as any),
                figureLayout: c.figureLayout,
                sourceIds: c.sourceIds === null || c.sourceIds === undefined ? Prisma.DbNull : (c.sourceIds as any),
                heightBudget: c.heightBudget ?? null,
                validation: c.validation,
                generatedLatex: c.generatedLatex ?? null,
                slideNotes: c.slideNotes ?? null,
              })),
            },
          },
        })
      }

      // Restore asset metadata rows
      if (parsedSnapshot.assets) {
        await tx.asset.deleteMany({ where: { workspaceId: id } })
        if (parsedSnapshot.assets.length) {
          await tx.asset.createMany({
            data: parsedSnapshot.assets.map((asset) => ({
              ...asset,
              workspaceId: id,
            })),
          })
        }
      }
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof Response) return err
    console.error("[Snapshot restore POST] Error:", err)
    return safeApiError("Failed to restore snapshot", 500)
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; snapId: string }> }
) {
  const { id, snapId } = await params
  let userId: string
  try {
    // Editor role is appropriate for deleting individual history snapshots within a workspace
    const access = await requireWorkspaceEditor(id)
    userId = access.userId
  } catch (error) {
    if (error instanceof Response) return error
    throw error
  }

  const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:${id}:snapshot-delete`, 10, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many snapshot delete requests", retryAfterMs },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    )
  }

  try {
    await prisma.workspaceSnapshot.deleteMany({ where: { id: snapId, workspaceId: id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[Snapshot DELETE] Error:", err)
    return safeApiError("Failed to delete snapshot", 500)
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; snapId: string }> }
) {
  const { id, snapId } = await params
  let userId: string
  try {
    const access = await requireWorkspaceEditor(id)
    userId = access.userId
  } catch (error) {
    if (error instanceof Response) return error
    throw error
  }

  const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:${id}:snapshot-patch`, 10, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many snapshot update requests", retryAfterMs },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    )
  }

  const body = await req.json().catch(() => ({}))
  const label = typeof body.label === "string" ? body.label.slice(0, 100) : null

  try {
    const updated = await prisma.workspaceSnapshot.updateMany({
      where: { id: snapId, workspaceId: id },
      data: { label },
    })

    if (updated.count === 0) return NextResponse.json({ error: "Snapshot not found" }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[Snapshot PATCH] Error:", err)
    return safeApiError("Failed to update snapshot", 500)
  }
}

