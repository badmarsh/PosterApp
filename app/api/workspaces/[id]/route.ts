import { NextResponse } from "next/server"
import fs from "node:fs/promises"
import { workspacePath } from "@/lib/workspace-files"
import { prisma } from "@/lib/prisma"
import { safeJsonParse, jsonStringify } from "@/lib/db-helpers"
import { auth, requireWorkspaceAccess, requireWorkspaceEditor, requireWorkspaceOwner } from "@/lib/auth"
import { safeApiError, readJsonBodyCapped, PayloadTooLargeError } from "@/lib/security"
import { rateLimitAsync } from "@/lib/rate-limit"
import { WorkspaceSchema } from "@/lib/validations/workspace"
import { computeWorkspaceDiff } from "@/lib/snapshot-diff"
import { generateSnapshotLabelAsync } from "@/lib/ai-labeler"

const MAX_WORKSPACE_BODY_BYTES = 10 * 1024 * 1024

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
function parseCard(c: { table?: unknown; figures?: unknown; sourceIds?: unknown } & Record<string, unknown>) {
  const defaultTable = { hasHeader: true, caption: "", rows: [] }
  return {
    ...c,
    table: typeof c.table === "string" ? safeJsonParse(c.table, defaultTable) : (c.table ?? defaultTable),
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
    const access = await requireWorkspaceAccess(id)

    const workspace = await prisma.workspace.findUnique({
      where: { id },
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
      role: access.role,
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
      outputs: workspace.outputs.map((o) => ({
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
        tableRows: typeof a.tableRows === "string" ? safeJsonParse(a.tableRows, undefined) : (a.tableRows ?? undefined),
      })),
      ingestFiles: workspace.ingestFiles,
      agentEvents: typeof workspace.agentEvents === "string" ? safeJsonParse(workspace.agentEvents, []) : (workspace.agentEvents ?? []),
      chatMessages: typeof workspace.chatMessages === "string" ? safeJsonParse(workspace.chatMessages, []) : (workspace.chatMessages ?? []),
    }

    return NextResponse.json(data)
  } catch (err) {
    if (err instanceof Response) return err
    console.error("[Workspace GET] Unhandled error:", err)
    return safeApiError("Failed to load workspace", 500)
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
    const access = await requireWorkspaceEditor(id)
    const existing = access.workspace

    const { allowed, retryAfterMs } = await rateLimitAsync(
      `${access.userId}:${id}:save`,
      20,
      60_000
    )
    if (!allowed) {
      return NextResponse.json(
        { error: `Rate limited — try again in ${Math.ceil(retryAfterMs / 1000)}s` },
        { status: 429 }
      )
    }

    // Guard against oversized payloads — Next.js route handlers have no built-in
    // body limit and Content-Length alone can be omitted by chunked clients.
    let rawBody: unknown
    try {
      rawBody = await readJsonBodyCapped(req, MAX_WORKSPACE_BODY_BYTES)
    } catch (bodyErr) {
      if (bodyErr instanceof PayloadTooLargeError) {
        return NextResponse.json({ error: "Payload too large" }, { status: 413 })
      }
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const prevSnapshot = await prisma.workspaceSnapshot.findFirst({
      where: { workspaceId: id },
      orderBy: { savedAt: "desc" }
    })

    const parsed = WorkspaceSchema.safeParse(rawBody)
    
    if (!parsed.success) {
      console.error("[Workspace PUT] Validation failed:", JSON.stringify(parsed.error.format(), null, 2))
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      )
    }
    const body = parsed.data
    const pendingSnapshotRef: { current: { snapId: string; diff: string[] } | null } = { current: null }

    // Use a transaction to safely replace outputs, cards, assets, and ingest files
    await prisma.$transaction(async (tx) => {
      // The client saves a complete object graph. Gate that destructive replace
      // on a revision so a stale tab cannot delete another tab's newer children.
      const expectedRevision = body.revision ?? existing.revision
      const update = await tx.workspace.updateMany({
        where: { id, revision: expectedRevision },
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

        // Batch check foreign outputs
        const incomingOutputIds = body.outputs.map((o) => o.id)
        const foreignOutputs = await tx.output.findMany({
          where: { id: { in: incomingOutputIds }, workspaceId: { not: id } },
          select: { id: true },
        })
        if (foreignOutputs.length > 0) throw new ForeignChildIdError()

        // Batch check foreign cards
        const allIncomingCardIds = body.outputs.flatMap((o) => o.cards?.map((c) => c.id) ?? [])
        const foreignCards = await tx.card.findMany({
          where: { id: { in: allIncomingCardIds }, output: { workspaceId: { not: id } } },
          select: { id: true, outputId: true },
        })
        const foreignCardMap = new Map(foreignCards.map((c) => [c.id, c.outputId]))
        
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
              const foreignOutputId = foreignCardMap.get(card.id)
              if (foreignOutputId && foreignOutputId !== output.id) throw new ForeignChildIdError()

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
        const incomingCardIds = body.cards.map((c) => c.id)
        const foreignLegacyCards = await tx.card.findMany({
          where: { id: { in: incomingCardIds }, outputId: { not: activeOutput.id } },
          select: { id: true },
        })
        if (foreignLegacyCards.length > 0) throw new ForeignChildIdError()

        for (const card of body.cards) {
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
        const incomingAssetIds = body.assets.map((a) => a.id)
        const foreignAssets = await tx.asset.findMany({
          where: { id: { in: incomingAssetIds }, workspaceId: { not: id } },
          select: { id: true },
        })
        if (foreignAssets.length > 0) throw new ForeignChildIdError()

        const assignedCardIds = body.assets.map((a) => a.assignedCardId).filter(Boolean) as string[]
        if (assignedCardIds.length > 0) {
          const validCards = new Set(
            (await tx.card.findMany({
              where: { id: { in: assignedCardIds }, output: { workspaceId: id } },
              select: { id: true },
            })).map((c) => c.id)
          )
          for (const asset of body.assets) {
            if (asset.assignedCardId && !validCards.has(asset.assignedCardId)) {
              asset.assignedCardId = null
              asset.assignedSlot = null
            }
          }
        }

        for (const asset of body.assets) {
          const assetData = {
            fileId: asset.fileId || "",
            filename: asset.filename,
            url: asset.url,
            kind: asset.kind,
            page: asset.page,
            section: asset.section,
            bbox: asset.bbox,
            confidence: asset.confidence || "high",
            heading: asset.heading,
            snippet: asset.snippet,
            thumbnailUrl: asset.thumbnailUrl,
            caption: asset.caption,
            tableRows: asset.tableRows ? (typeof asset.tableRows === "string" ? safeJsonParse(asset.tableRows, undefined) : (asset.tableRows as any)) : undefined,
            assignedSlot: asset.assignedSlot,
          }
          let upserted: { id: string }
          if (asset.filename) {
            upserted = await tx.asset.upsert({
              where: {
                workspaceId_filename: {
                  workspaceId: id,
                  filename: asset.filename,
                },
              },
              create: {
                id: asset.id,
                workspaceId: id,
                assignedCardId: asset.assignedCardId ?? null,
                ...assetData,
              },
              update: {
                assignedCardId: asset.assignedCardId ?? null,
                ...assetData,
              },
            })
          } else {
            upserted = await tx.asset.upsert({
              where: { id: asset.id },
              create: {
                id: asset.id,
                workspaceId: id,
                assignedCardId: asset.assignedCardId ?? null,
                ...assetData,
              },
              update: {
                assignedCardId: asset.assignedCardId ?? null,
                ...assetData,
              },
            })
          }
          ownedAssetIds.delete(upserted.id)
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
        const incomingFileIds = body.ingestFiles.map((f) => f.id)
        const foreignFiles = await tx.ingestFile.findMany({
          where: { id: { in: incomingFileIds }, workspaceId: { not: id } },
          select: { id: true },
        })
        if (foreignFiles.length > 0) throw new ForeignChildIdError()

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
          const removedIds = Array.from(existingFileIds)
          await tx.ingestFile.deleteMany({ where: { id: { in: removedIds } } })
          await tx.documentChunk.deleteMany({ where: { workspaceId: id, documentId: { in: removedIds } } })
          await tx.graphNode.deleteMany({ where: { workspaceId: id, documentId: { in: removedIds } } })
        }
      }

      }, { timeout: 20_000, maxWait: 10_000 })

    // ── Auto-snapshot (post-commit) ────────────────────────────────────────
    // Snapshotting is non-critical bookkeeping; it runs after the save so a
    // failure here does not roll back the user's changes.
    try {
      const updatedWorkspace = await prisma.workspace.findUnique({
        where: { id },
        include: { outputs: { include: { cards: true } }, assets: true, ingestFiles: true },
      })
      if (updatedWorkspace) {
        const newSnap = await prisma.workspaceSnapshot.create({
          data: {
            workspaceId: id,
            revision: nextRevision ?? 0,
            snapshot: JSON.stringify(updatedWorkspace),
          },
        })

        // Compute diff for background labeler
        try {
          const oldWs = prevSnapshot ? JSON.parse(prevSnapshot.snapshot) : null
          const diff = computeWorkspaceDiff(oldWs, updatedWorkspace)
          if (diff.length > 0) {
            pendingSnapshotRef.current = { snapId: newSnap.id, diff }
          }
        } catch (e) {
          console.error("Failed to generate AI label diff", e)
        }

        // Prune oldest snapshots beyond 50
        const old = await prisma.workspaceSnapshot.findMany({
          where: { workspaceId: id },
          orderBy: { savedAt: "desc" },
          skip: 50,
          select: { id: true },
        })
        if (old.length > 0) {
          await prisma.workspaceSnapshot.deleteMany({ where: { id: { in: old.map((s) => s.id) } } })
        }
      }
    } catch (e) {
      console.error("[Workspace PUT] Snapshot bookkeeping failed after successful save:", e)
    }

    // Fire and forget AI snapshot labeler outside transaction
    if (pendingSnapshotRef.current) {
      generateSnapshotLabelAsync(pendingSnapshotRef.current.snapId, pendingSnapshotRef.current.diff).catch(console.error)
    }
    
    return NextResponse.json({ ok: true, revision: nextRevision })
  } catch (err) {
    if (err instanceof Response) return err
    console.error("[Workspace PUT] Unhandled error:", err)
    if (err instanceof WorkspaceConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    if (err instanceof ForeignChildIdError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    return safeApiError("Failed to save workspace", 500)
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
    // Owner-only: editors must not be able to destroy a workspace (MED-02 fix)
    await requireWorkspaceOwner(id)
    await prisma.workspace.delete({ where: { id } })
    // Remove on-disk artefacts (uploads, compiled PDFs, staged sources) so
    // user data does not outlive the workspace record. workspacePath() guards
    // against traversal; the id regex above guarantees a single path segment.
    try {
      await fs.rm(workspacePath(id), { recursive: true, force: true })
    } catch (fsErr) {
      console.error(`[Workspace DELETE] Failed to remove files for ${id}:`, fsErr)
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof Response) return err
    console.error("[Workspace DELETE] Unhandled error:", err)
    return safeApiError("Failed to delete workspace", 500)
  }
}
