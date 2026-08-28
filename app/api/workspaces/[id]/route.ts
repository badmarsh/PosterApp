import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { safeJsonParse, jsonStringify } from "@/lib/db-helpers"
import { auth } from "@/lib/auth"
import { WorkspaceSchema } from "@/lib/validations/workspace"
import { computeWorkspaceDiff } from "@/lib/snapshot-diff"
import { generateSnapshotLabelAsync } from "@/lib/ai-labeler"

class ForeignChildIdError extends Error {
  constructor() {
    super("A referenced child record belongs to another workspace")
    this.name = "ForeignChildIdError"
  }
}

class WorkspaceConflictError extends Error {
  constructor() {
    super("This workspace was changed in another session. Reload before saving again.")
    this.name = "WorkspaceConflictError"
  }
}

/**
 * Helper: parse a DB Card row's JSON fields into plain objects.
 */
function parseCard(c: any) {
  return {
    ...c,
    table: typeof c.table === "string" ? safeJsonParse(c.table, undefined) : (c.table ?? undefined),
    figures: typeof c.figures === "string" ? safeJsonParse(c.figures, []) : (c.figures ?? []),
    sourceIds: typeof c.sourceIds === "string" ? safeJsonParse(c.sourceIds, []) : (c.sourceIds ?? []),
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
      revision: workspace.revision,
      name: workspace.name,
      authors: workspace.authors,
      venue: workspace.venue,
      logoUrl: workspace.logoUrl ?? null,
      secondaryLogoUrl: workspace.secondaryLogoUrl ?? null,
      // Legacy flat fields — derived from active output
      posterTitle: activeOutput?.title ?? workspace.name,
      templateName: activeOutput?.templateId ?? "atlas",
      cards: activeOutput?.cards.map(parseCard) ?? [],
      // New outputs format
      outputs: workspace.outputs.map((o: any) => ({
        id: o.id,
        outputType: o.outputType,
        templateId: o.templateId,
        title: o.title,
        authors: o.authors ?? null,
        venue: o.venue ?? null,
        logoUrl: o.logoUrl ?? null,
        secondaryLogoUrl: o.secondaryLogoUrl ?? null,
        themeColor: o.themeColor,
        sourceIds: typeof o.sourceIds === "string" ? safeJsonParse(o.sourceIds, []) : (o.sourceIds ?? []),
        isActive: o.isActive,
        cards: o.cards.map(parseCard),
      })),
      activeOutputId: activeOutput?.id ?? "",
      // Shared workspace data
      assets: workspace.assets.map((a) => ({
        ...a,
        tableRows: a.tableRows ?? undefined,
      })),
      ingestFiles: workspace.ingestFiles,
      agentEvents: typeof workspace.agentEvents === "string" ? safeJsonParse(workspace.agentEvents, []) : (workspace.agentEvents ?? []),
      chatMessages: typeof workspace.chatMessages === "string" ? safeJsonParse(workspace.chatMessages, []) : (workspace.chatMessages ?? []),
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

  let nextRevision: number | undefined
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Check ownership first
    const existing = await prisma.workspace.findUnique({ where: { id, userId } })
    if (!existing) return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 })

    const prevSnapshot = await prisma.workspaceSnapshot.findFirst({
      where: { workspaceId: id },
      orderBy: { savedAt: "desc" }
    })

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
      // The client saves a complete object graph. Gate that destructive replace
      // on a revision so a stale tab cannot delete another tab's newer children.
      const expectedRevision = body.revision ?? existing.revision
      const update = await tx.workspace.updateMany({
        where: { id, userId, revision: expectedRevision },
        data: {
          name: body.name || id,
          authors: body.authors || "",
          venue: body.venue || "",
          logoUrl: body.logoUrl !== undefined ? body.logoUrl : undefined,
          secondaryLogoUrl: body.secondaryLogoUrl !== undefined ? body.secondaryLogoUrl : undefined,
          agentEvents: body.agentEvents ?? undefined,
          chatMessages: body.chatMessages ?? undefined,
          revision: { increment: 1 },
        }
      })
      if (update.count !== 1) throw new WorkspaceConflictError()
      // Compute final revision inside the transaction to avoid using a captured
      // outer variable that could be undefined if an early error fires.
      const confirmedRevision = expectedRevision + 1
      nextRevision = confirmedRevision

      // Pre-fetch the IDs of outputs and assets that already belong to this workspace.
      // We use these sets to guard upserts: an existing record whose ID is NOT in these
      // sets belongs to a different workspace and must not be touched.
      const ownedOutputIds = new Set(
        (await tx.output.findMany({ where: { workspaceId: id }, select: { id: true } }))
          .map(o => o.id)
      )
      const ownedAssetIds = new Set(
        (await tx.asset.findMany({ where: { workspaceId: id }, select: { id: true } }))
          .map(a => a.id)
      )

      // Upsert outputs and their cards
      if (body.outputs && body.outputs.length > 0) {
        const existingOutputIds = new Set(ownedOutputIds)
        
        for (const output of body.outputs) {
          // If this output ID already exists in the DB but does NOT belong to this
          // workspace, skip it entirely to prevent cross-workspace mutation.
          if (!ownedOutputIds.has(output.id)) {
            // It may be a brand-new ID (not in DB yet) — that is fine, the create
            // path will correctly set workspaceId: id.
            // But if we somehow received a foreign owned ID, reject it.
            const foreign = await tx.output.findUnique({ where: { id: output.id } })
            if (foreign && foreign.workspaceId !== id) throw new ForeignChildIdError()
          }

          const isActive = output.id === body.activeOutputId
          
          await tx.output.upsert({
            where: { id: output.id },
            create: {
              id: output.id,
              workspaceId: id,
              outputType: output.outputType,
              templateId: output.templateId,
              title: output.title,
              authors: output.authors,
              venue: output.venue,
              logoUrl: output.logoUrl,
              secondaryLogoUrl: output.secondaryLogoUrl,
              themeColor: output.themeColor,
              sourceIds: output.sourceIds ?? [],
              isActive,
            },
            update: {
              outputType: output.outputType,
              templateId: output.templateId,
              title: output.title,
              authors: output.authors,
              venue: output.venue,
              logoUrl: output.logoUrl,
              secondaryLogoUrl: output.secondaryLogoUrl,
              themeColor: output.themeColor,
              sourceIds: output.sourceIds ?? [],
              isActive,
            },
          })
          existingOutputIds.delete(output.id)

          // Upsert cards for this output
          if (output.cards) {
            // Fetch cards that actually belong to this output (scoped by outputId)
            const existingCardIds = new Set(
              (await tx.card.findMany({ where: { outputId: output.id }, select: { id: true } }))
                .map(c => c.id)
            )
            for (const card of output.cards) {
              // Reject cards whose ID exists in the DB under a different output
              const foreignCard = existingCardIds.has(card.id)
                ? null
                : await tx.card.findUnique({ where: { id: card.id } })
              if (foreignCard && foreignCard.outputId !== output.id) throw new ForeignChildIdError()

              const cardData = {
                title: card.title || "",
                column: card.column ?? null,
                order: card.order,
                pattern: card.pattern || "bullets",
                content: card.content || "",
                table: card.table ?? undefined,
                figures: card.figures ?? undefined,
                figureLayout: card.figureLayout || "single",
                sourceIds: card.sourceIds ?? undefined,
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
                update: {
                  ...cardData,
                },
              })
              existingCardIds.delete(card.id)
            }
            if (existingCardIds.size > 0) {
              // Before deleting orphaned cards, clear asset FK references that point to
              // them. Without this, the asset upsert below would try to re-apply the
              // stale assignedCardId and violate the FK constraint, rolling back the
              // entire transaction.
              await tx.asset.updateMany({
                where: { workspaceId: id, assignedCardId: { in: Array.from(existingCardIds) } },
                data: { assignedCardId: null, assignedSlot: null },
              })
              await tx.card.deleteMany({ where: { id: { in: Array.from(existingCardIds) } } })
            }
          } // end if (output.cards)
        } // end for (const output of body.outputs)
        
        if (existingOutputIds.size > 0) {
          // Delete orphaned outputs (and their cards will cascade)
          const orphanCardIds = (await tx.card.findMany({
            where: { outputId: { in: Array.from(existingOutputIds) } }, select: { id: true },
          })).map((card) => card.id)
          if (orphanCardIds.length) {
            await tx.asset.updateMany({
              where: { workspaceId: id, assignedCardId: { in: orphanCardIds } },
              data: { assignedCardId: null, assignedSlot: null },
            })
          }
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
              themeColor: undefined,
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
          if (!existingCardIds.has(card.id)) {
            const foreignCard = await tx.card.findUnique({ where: { id: card.id } })
            if (foreignCard && foreignCard.outputId !== activeOutput.id) throw new ForeignChildIdError()
          }
          const cardData = {
            title: card.title || "",
            column: card.column ?? null,
            order: card.order,
            pattern: card.pattern || "bullets",
            content: card.content || "",
            table: card.table ?? undefined,
            figures: card.figures ?? undefined,
            figureLayout: card.figureLayout || "single",
            sourceIds: card.sourceIds ?? undefined,
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
          // Clear orphaned asset FK refs before deleting cards (same reason as above)
          await tx.asset.updateMany({
            where: { workspaceId: id, assignedCardId: { in: Array.from(existingCardIds) } },
            data: { assignedCardId: null, assignedSlot: null },
          })
          await tx.card.deleteMany({ where: { id: { in: Array.from(existingCardIds) } } })
        }
      }

      // Upsert assets (shared across all outputs)
      if (body.assets) {
        for (const asset of body.assets) {
          // Reject assets whose ID exists in the DB but belongs to a different workspace
          if (!ownedAssetIds.has(asset.id)) {
            const foreign = await tx.asset.findUnique({ where: { id: asset.id } })
            if (foreign && foreign.workspaceId !== id) throw new ForeignChildIdError()
          }

          if (asset.assignedCardId) {
            const assignedCard = await tx.card.findFirst({
              where: { id: asset.assignedCardId, output: { workspaceId: id } },
              select: { id: true },
            })
            if (!assignedCard) throw new ForeignChildIdError()
          }

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
            tableRows: asset.tableRows ?? undefined,
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
            update: {
              ...assetData,
            },
          })
          ownedAssetIds.delete(asset.id)
        }
        if (ownedAssetIds.size > 0) {
          await tx.asset.deleteMany({ where: { id: { in: Array.from(ownedAssetIds) } } })
        }
      }

      // Upsert ingest files
      if (body.ingestFiles) {
        const existingFileIds = new Set(
          (await tx.ingestFile.findMany({ where: { workspaceId: id }, select: { id: true } }))
            .map(f => f.id)
        )
        for (const file of body.ingestFiles) {
          if (!existingFileIds.has(file.id)) {
            const foreignFile = await tx.ingestFile.findUnique({ where: { id: file.id } })
            if (foreignFile && foreignFile.workspaceId !== id) throw new ForeignChildIdError()
          }
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

      // ── Auto-snapshot on every save ──────────────────────────────────────
      // Re-fetch the updated workspace so the snapshot is up-to-date.
      const updatedWorkspace = await tx.workspace.findUnique({
        where: { id },
        include: { outputs: { include: { cards: true } }, assets: true, ingestFiles: true },
      })
      if (updatedWorkspace) {
        const newSnap = await tx.workspaceSnapshot.create({
          data: {
            workspaceId: id,
            revision: nextRevision ?? 0,
            snapshot: JSON.stringify(updatedWorkspace),
          },
        })

        // Compute diff and dispatch background labeler
        try {
          const oldWs = prevSnapshot ? JSON.parse(prevSnapshot.snapshot) : null
          const diff = computeWorkspaceDiff(oldWs, updatedWorkspace)
          if (diff.length > 0) {
            // fire and forget async task
            generateSnapshotLabelAsync(newSnap.id, diff).catch(console.error)
          }
        } catch (e) {
          console.error("Failed to generate AI label diff", e)
        }

        // Prune oldest snapshots beyond 50
        const old = await tx.workspaceSnapshot.findMany({
          where: { workspaceId: id },
          orderBy: { savedAt: "desc" },
          skip: 50,
          select: { id: true },
        })
        if (old.length > 0) {
          await tx.workspaceSnapshot.deleteMany({ where: { id: { in: old.map((s) => s.id) } } })
        }
      }
    })
    
    return NextResponse.json({ ok: true, revision: nextRevision })
  } catch (err) {
    console.error(err)
    if (err instanceof WorkspaceConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    if (err instanceof ForeignChildIdError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
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
