import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { safeJsonParse, jsonStringify } from "@/lib/db-helpers"
import { auth } from "@/lib/auth"
import { WorkspaceSchema } from "@/lib/validations/workspace"

/**
 * Helper: parse a DB Card row's JSON fields into plain objects.
 */
function parseCard(c: any) {
  return {
    ...c,
    table: safeJsonParse(c.table, undefined),
    figures: safeJsonParse(c.figures, []),
    sourceIds: safeJsonParse(c.sourceIds, []),
  }
}

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
      include: {
        outputs: {
          include: { cards: true },
        },
        assets: true,
        ingestFiles: true,
      },
    })

    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    // Find the active output (or first output as fallback)
    const activeOutput = workspace.outputs.find((o) => o.isActive) || workspace.outputs[0]

    // Build response with both new outputs format and legacy flat fields
    const data = {
      id: workspace.id,
      name: workspace.name,
      authors: workspace.authors,
      venue: workspace.venue,
      // Legacy flat fields — derived from active output
      posterTitle: activeOutput?.title ?? workspace.name,
      templateName: activeOutput?.templateId ?? "atlas",
      cards: activeOutput?.cards.map(parseCard) ?? [],
      // New outputs format
      outputs: workspace.outputs.map((o) => ({
        id: o.id,
        outputType: o.outputType,
        templateId: o.templateId,
        title: o.title,
        isActive: o.isActive,
        cards: o.cards.map(parseCard),
      })),
      activeOutputId: activeOutput?.id ?? "",
      // Shared workspace data
      assets: workspace.assets.map((a) => ({
        ...a,
        tableRows: safeJsonParse(a.tableRows, undefined),
      })),
      ingestFiles: workspace.ingestFiles,
      agentEvents: safeJsonParse(workspace.agentEvents, []),
      chatMessages: safeJsonParse(workspace.chatMessages, []),
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

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
    
    // Use a transaction to safely replace outputs, cards, assets, and ingest files
    await prisma.$transaction(async (tx) => {
      await tx.workspace.update({
        where: { id },
        data: {
          name: body.name || id,
          authors: body.authors || "",
          venue: body.venue || "",
          agentEvents: body.agentEvents ? jsonStringify(body.agentEvents) : undefined,
          chatMessages: body.chatMessages ? jsonStringify(body.chatMessages) : undefined,
        }
      })

      // Upsert outputs and their cards
      if (body.outputs && body.outputs.length > 0) {
        const existingOutputIds = new Set(
          (await tx.output.findMany({ where: { workspaceId: id }, select: { id: true } }))
            .map(o => o.id)
        )
        
        for (const output of body.outputs) {
          const isActive = output.id === body.activeOutputId
          
          await tx.output.upsert({
            where: { id: output.id },
            create: {
              id: output.id,
              workspaceId: id,
              outputType: output.outputType,
              templateId: output.templateId,
              title: output.title,
              isActive,
            },
            update: {
              outputType: output.outputType,
              templateId: output.templateId,
              title: output.title,
              isActive,
            },
          })
          existingOutputIds.delete(output.id)

          // Upsert cards for this output
          if (output.cards) {
            const existingCardIds = new Set(
              (await tx.card.findMany({ where: { outputId: output.id }, select: { id: true } }))
                .map(c => c.id)
            )
            for (const card of output.cards) {
              const cardData = {
                title: card.title || "",
                column: card.column ?? null,
                order: card.order,
                pattern: card.pattern || "bullets",
                content: card.content || "",
                table: jsonStringify(card.table),
                figures: jsonStringify(card.figures),
                figureLayout: card.figureLayout || "single",
                sourceIds: jsonStringify(card.sourceIds),
                heightBudget: card.heightBudget,
                validation: card.validation || "valid",
                generatedLatex: card.generatedLatex,
                slideNotes: card.slideNotes,
              }
              await tx.card.upsert({
                where: { id: card.id },
                create: {
                  id: card.id,
                  outputId: output.id,
                  ...cardData,
                },
                update: cardData,
              })
              existingCardIds.delete(card.id)
            }
            if (existingCardIds.size > 0) {
              await tx.card.deleteMany({ where: { id: { in: Array.from(existingCardIds) } } })
            }
          }
        }
        
        if (existingOutputIds.size > 0) {
          // Delete orphaned outputs (and their cards will cascade)
          await tx.output.deleteMany({ where: { id: { in: Array.from(existingOutputIds) } } })
        }
      } else if (body.cards) {
        // Legacy path: cards sent at top level without outputs.
        // Find or create the active output to host these cards.
        let activeOutput = await tx.output.findFirst({
          where: { workspaceId: id, isActive: true },
        })
        
        if (!activeOutput) {
          // Create a default poster output if none exists
          const outputId = `out_poster_${Date.now().toString(36)}`
          activeOutput = await tx.output.create({
            data: {
              id: outputId,
              workspaceId: id,
              outputType: "poster",
              templateId: body.templateName || "atlas",
              title: body.posterTitle || body.name || "",
              isActive: true,
            },
          })
        } else {
          // Update title/template from legacy fields if provided
          await tx.output.update({
            where: { id: activeOutput.id },
            data: {
              title: body.posterTitle || activeOutput.title,
              templateId: body.templateName || activeOutput.templateId,
            },
          })
        }

        // Upsert legacy cards under the active output
        const existingCardIds = new Set(
          (await tx.card.findMany({ where: { outputId: activeOutput.id }, select: { id: true } }))
            .map(c => c.id)
        )
        for (const card of body.cards) {
          const cardData = {
            title: card.title || "",
            column: card.column ?? null,
            order: card.order,
            pattern: card.pattern || "bullets",
            content: card.content || "",
            table: jsonStringify(card.table),
            figures: jsonStringify(card.figures),
            figureLayout: card.figureLayout || "single",
            sourceIds: jsonStringify(card.sourceIds),
            heightBudget: card.heightBudget,
            validation: card.validation || "valid",
            generatedLatex: card.generatedLatex,
            slideNotes: card.slideNotes,
          }
          await tx.card.upsert({
            where: { id: card.id },
            create: {
              id: card.id,
              outputId: activeOutput.id,
              ...cardData,
            },
            update: cardData,
          })
          existingCardIds.delete(card.id)
        }
        if (existingCardIds.size > 0) {
          await tx.card.deleteMany({ where: { id: { in: Array.from(existingCardIds) } } })
        }
      }

      // Upsert assets (shared across all outputs)
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
