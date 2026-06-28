import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id },
      include: { cards: true, assets: true, ingestFiles: true },
    })

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    // Parse JSON strings back to objects
    const data = {
      ...workspace,
      cards: workspace.cards.map(c => ({
        ...c,
        table: c.table ? JSON.parse(c.table) : undefined,
        figures: c.figures ? JSON.parse(c.figures) : [],
        sourceIds: c.sourceIds ? JSON.parse(c.sourceIds) : [],
      })),
      assets: workspace.assets.map(a => ({
        ...a,
        tableRows: a.tableRows ? JSON.parse(a.tableRows) : undefined,
      })),
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

import { z } from "zod"

const WorkspaceSchema = z.object({
  name: z.string().optional(),
  posterTitle: z.string().optional(),
  authors: z.string().optional(),
  venue: z.string().optional(),
  templateName: z.string().optional(),
  cards: z.array(z.object({
    id: z.string(),
    title: z.string().optional(),
    column: z.number().int(),
    order: z.number().int(),
    pattern: z.string(),
    content: z.string().optional(),
    table: z.any().optional().nullable(),
    figures: z.any().optional().nullable(),
    figureLayout: z.string().optional(),
    sourceIds: z.any().optional().nullable(),
    heightBudget: z.number().nullable().optional(),
    validation: z.string().optional(),
    generatedLatex: z.string().nullable().optional(),
  })).optional(),
  assets: z.array(z.object({
    id: z.string(),
    fileId: z.string(),
    filename: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
    kind: z.string(),
    page: z.number().int(),
    section: z.string().nullable().optional(),
    bbox: z.string().nullable().optional(),
    confidence: z.string(),
    heading: z.string().nullable().optional(),
    snippet: z.string().nullable().optional(),
    thumbnailUrl: z.string().nullable().optional(),
    caption: z.string().nullable().optional(),
    tableRows: z.any().optional().nullable(),
    assignedCardId: z.string().nullable().optional(),
    assignedSlot: z.string().nullable().optional(),
  })).optional(),
  ingestFiles: z.array(z.object({
    id: z.string(),
    name: z.string(),
    size: z.number(),
    method: z.string(),
    status: z.string(),
    progress: z.number(),
    error: z.string().nullable().optional(),
  })).optional(),
})

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const rawBody = await req.json()
    const parsed = WorkspaceSchema.safeParse(rawBody)
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      )
    }
    const body = parsed.data
    
    // Use a transaction to safely replace cards, assets, and ingest files
    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({
        where: { id },
        data: {
          name: body.name || id,
          posterTitle: body.posterTitle || "",
          authors: body.authors || "",
          venue: body.venue || "",
          templateName: body.templateName || "",
        }
      })

      // Delete existing to replace with new
      await tx.card.deleteMany({ where: { workspaceId: id } })
      await tx.asset.deleteMany({ where: { workspaceId: id } })
      await tx.ingestFile.deleteMany({ where: { workspaceId: id } })

      // Insert cards
      if (body.cards && body.cards.length > 0) {
        for (const card of body.cards) {
          await tx.card.create({
            data: {
              id: card.id,
              workspaceId: id,
              title: card.title || "",
              column: card.column,
              order: card.order,
              pattern: card.pattern,
              content: card.content || "",
              table: card.table ? JSON.stringify(card.table) : null,
              figures: card.figures ? JSON.stringify(card.figures) : null,
              figureLayout: card.figureLayout || "single",
              sourceIds: card.sourceIds ? JSON.stringify(card.sourceIds) : null,
              heightBudget: card.heightBudget,
              validation: card.validation || "valid",
              generatedLatex: card.generatedLatex,
            }
          })
        }
      }

      // Insert assets
      if (body.assets && body.assets.length > 0) {
        for (const asset of body.assets) {
          await tx.asset.create({
            data: {
              id: asset.id,
              workspaceId: id,
              fileId: asset.fileId,
              filename: asset.filename,
              url: asset.url,
              kind: asset.kind,
              page: asset.page,
              section: asset.section,
              bbox: asset.bbox,
              confidence: asset.confidence,
              heading: asset.heading,
              snippet: asset.snippet,
              thumbnailUrl: asset.thumbnailUrl,
              caption: asset.caption,
              tableRows: asset.tableRows ? JSON.stringify(asset.tableRows) : null,
              assignedCardId: asset.assignedCardId,
              assignedSlot: asset.assignedSlot,
            }
          })
        }
      }

      // Insert ingest files
      if (body.ingestFiles && body.ingestFiles.length > 0) {
        for (const file of body.ingestFiles) {
          await tx.ingestFile.create({
            data: {
              id: file.id,
              workspaceId: id,
              name: file.name,
              size: file.size,
              method: file.method,
              status: file.status,
              progress: file.progress,
              error: file.error,
            }
          })
        }
      }
    })
    
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    await prisma.workspace.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
