import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { safeJsonParse, jsonStringify } from "@/lib/db-helpers"
import { auth } from "@clerk/nextjs/server"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: 'Invalid workspace ID' }, { status: 400 })
  }

  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const workspace = await prisma.workspace.findUnique({
      where: { id, userId },
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
        table: safeJsonParse(c.table, undefined),
        figures: safeJsonParse(c.figures, []),
        sourceIds: safeJsonParse(c.sourceIds, []),
      })),
      assets: workspace.assets.map(a => ({
        ...a,
        tableRows: safeJsonParse(a.tableRows, undefined),
      })),
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

import { WorkspaceSchema } from "@/lib/validations/workspace"

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: 'Invalid workspace ID' }, { status: 400 })
  }

  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Check ownership first
    const existing = await prisma.workspace.findUnique({ where: { id, userId } })
    if (!existing) return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 })

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

      // Upsert cards
      if (body.cards) {
        const existingCardIds = new Set(
          (await tx.card.findMany({ where: { workspaceId: id }, select: { id: true } }))
            .map(c => c.id)
        )
        for (const card of body.cards) {
          await tx.card.upsert({
            where: { id: card.id },
            create: {
              id: card.id,
              workspaceId: id,
              title: card.title || "",
              column: card.column,
              order: card.order,
              pattern: card.pattern,
              content: card.content || "",
              table: jsonStringify(card.table),
              figures: jsonStringify(card.figures),
              figureLayout: card.figureLayout || "single",
              sourceIds: jsonStringify(card.sourceIds),
              heightBudget: card.heightBudget,
              validation: card.validation || "valid",
              generatedLatex: card.generatedLatex,
            },
            update: {
              title: card.title || "",
              column: card.column,
              order: card.order,
              pattern: card.pattern,
              content: card.content || "",
              table: jsonStringify(card.table),
              figures: jsonStringify(card.figures),
              figureLayout: card.figureLayout || "single",
              sourceIds: jsonStringify(card.sourceIds),
              heightBudget: card.heightBudget,
              validation: card.validation || "valid",
              generatedLatex: card.generatedLatex,
            },
          })
          existingCardIds.delete(card.id)
        }
        if (existingCardIds.size > 0) {
          await tx.card.deleteMany({ where: { id: { in: Array.from(existingCardIds) } } })
        }
      }

      // Upsert assets
      if (body.assets) {
        const existingAssetIds = new Set(
          (await tx.asset.findMany({ where: { workspaceId: id }, select: { id: true } }))
            .map(a => a.id)
        )
        for (const asset of body.assets) {
          const assetData = {
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
            tableRows: jsonStringify(asset.tableRows),
            assignedCardId: asset.assignedCardId,
            assignedSlot: asset.assignedSlot,
          }
          await tx.asset.upsert({
            where: { id: asset.id },
            create: {
              id: asset.id,
              workspaceId: id,
              ...assetData
            },
            update: assetData,
          })
          existingAssetIds.delete(asset.id)
        }
        if (existingAssetIds.size > 0) {
          await tx.asset.deleteMany({ where: { id: { in: Array.from(existingAssetIds) } } })
        }
      }

      // Upsert ingest files
      if (body.ingestFiles) {
        const existingFileIds = new Set(
          (await tx.ingestFile.findMany({ where: { workspaceId: id }, select: { id: true } }))
            .map(f => f.id)
        )
        for (const file of body.ingestFiles) {
          const fileData = {
            name: file.name,
            size: file.size,
            method: file.method,
            status: file.status,
            progress: file.progress,
            error: file.error,
            dismissed: file.dismissed || false,
          }
          await tx.ingestFile.upsert({
            where: { id: file.id },
            create: {
              id: file.id,
              workspaceId: id,
              ...fileData
            },
            update: fileData,
          })
          existingFileIds.delete(file.id)
        }
        if (existingFileIds.size > 0) {
          await tx.ingestFile.deleteMany({ where: { id: { in: Array.from(existingFileIds) } } })
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
  
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: 'Invalid workspace ID' }, { status: 400 })
  }

  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const existing = await prisma.workspace.findUnique({ where: { id, userId } })
    if (!existing) return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 })

    await prisma.workspace.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
