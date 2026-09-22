import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { prisma, type Prisma } from "@/lib/prisma"
import { requireWorkspaceEditor } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { safeApiError } from "@/lib/security"
import { findRunForWorkspace } from "@/lib/deerflow/db"
import { normalizeProposal, type PosterResearchProposal } from "@/lib/deerflow/contracts"
import { getWorkspaceAssetIds, parseWorkspaceBibKeys, parseWorkspaceJson } from "@/lib/deerflow/context"
import { toDeerflowResponse } from "@/lib/deerflow/guard"

class ApplyConflictError extends Error {
  constructor() {
    super("Workspace changed in another session. Reload before applying.")
    this.name = "ApplyConflictError"
  }
}

const MAX_BIB_ENTRIES = 40

/** Builds a minimal BibTeX entry from a validated citation. */
function citationToBibtex(citation: {
  key?: string
  type?: string
  title: string
  authors?: string[]
  year?: string
  venue?: string
  doi?: string
  url?: string
}, key: string): string {
  const type = citation.type || "misc"
  const fields: string[] = [`  title = {${(citation.title || "").replace(/[{}]/g, "")}}`]
  if (citation.authors && citation.authors.length > 0) {
    fields.push(`  author = {${citation.authors.join(" and ")}}`)
  }
  if (citation.year) fields.push(`  year = {${citation.year}}`)
  if (citation.venue) fields.push(`  journal = {${(citation.venue || "").replace(/[{}]/g, "")}}`)
  if (citation.doi) fields.push(`  doi = {${citation.doi}}`)
  if (citation.url) fields.push(`  url = {${citation.url}}`)
  return `@${type}{${key},\n${fields.join(",\n")}\n}`
}

/**
 * POST /api/workspaces/[id]/deerflow/runs/[runId]/apply
 * The ONLY mutation path for a DeerFlow proposal. Re-validates the stored
 * proposal against the current workspace asset set, then applies it inside a
 * revision-gated transaction:
 *  - creates NEW cards on the active output (never deletes/overwrites),
 *  - appends non-duplicate citations to the bibliography,
 *  - appends an agent event to the feed.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string; runId: string }> }) {
  const { id, runId } = await params
  if (!/^[a-zA-Z0-9_-]+$/.test(id) || !/^[a-zA-Z0-9_-]+$/.test(runId)) {
    return NextResponse.json({ error: "Invalid run id" }, { status: 400 })
  }

  let access: Awaited<ReturnType<typeof requireWorkspaceEditor>>
  let userId: string
  try {
    access = await requireWorkspaceEditor(id)
    userId = access.userId
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:${id}:deerflow:apply`, 5, 60_000)
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limited", retryAfterMs },
        { status: 429, headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() } }
      )
    }

    const row = await findRunForWorkspace(runId, id)
    if (!row) return NextResponse.json({ error: "Run not found" }, { status: 404 })
    if (row.status !== "done") {
      return safeApiError("Only a finished DeerFlow run can be applied", 409, "DEERFLOW_RUN_NOT_DONE")
    }
    if (!row.proposal) {
      return safeApiError("Run has no proposal to apply", 409, "DEERFLOW_PROPOSAL_MISSING")
    }

    // Re-validate against the CURRENT workspace asset set (not a cached one).
    const allowedAssetIds = await getWorkspaceAssetIds(id)
    const normalized = normalizeProposal(row.proposal, { allowedAssetIds })
    if (!normalized.ok) {
      return safeApiError(
        `Proposal no longer valid: ${normalized.issues.slice(0, 3).map((i) => `${i.path}: ${i.message}`).join("; ")}`,
        422,
        "DEERFLOW_PROPOSAL_INVALID"
      )
    }
    const proposal = normalized.proposal

    let nextRevision = access.workspace.revision + 1
    let appliedCardIds: string[] = []
    let skippedDuplicates = 0
    let bibAdded = 0

    await prisma.$transaction(async (tx) => {
      const activeOutput = await tx.output.findFirst({
        where: { workspaceId: id },
        orderBy: { isActive: "desc" },
        include: { cards: { select: { id: true, title: true, order: true } } },
      })
      if (!activeOutput) {
        throw new Error("Workspace has no output variant to host new cards")
      }

      const cards = (activeOutput.cards ?? []) as Array<{ id: string; title: string; order: number }>
      const existingTitles = new Set(
        cards.map((c) => c.title.trim().toLowerCase()).filter(Boolean)
      )
      const maxOrder = cards.reduce((max, c) => Math.max(max, c.order), -1)
      const isPoster = activeOutput.outputType === "poster"

      // Assign asset references (only ids that survived normalization).
      const assignedAssets: Array<{ cardId: string; assetId: string }> = []
      const pendingCards = proposal.sectionDrafts.filter((d) => !existingTitles.has(d.title.trim().toLowerCase())).slice(0, 8)
      skippedDuplicates = proposal.sectionDrafts.length - pendingCards.length

      let order = maxOrder + 1
      for (const draft of pendingCards) {
        const cardId = `df_${randomUUID().replace(/-/g, "").slice(0, 20)}`
        const content = draft.bullets.map((b) => `* ${b}`).join("\n\n")
        await tx.card.create({
          data: {
            id: cardId,
            outputId: activeOutput.id,
            title: draft.title,
            column: isPoster ? ((order - maxOrder - 1) % 3) + 1 : null,
            order,
            pattern: "bullets",
            content,
            figureLayout: "single",
            validation: "valid",
            generatedLatex: null,
            slideNotes: null,
          },
        })
        for (const assetId of draft.suggestedAssetIds) {
          assignedAssets.push({ cardId, assetId })
        }
        appliedCardIds.push(cardId)
        order += 1
      }

      // Attach assigned assets (filtered to workspace-owned ids).
      if (assignedAssets.length > 0) {
        for (const link of assignedAssets) {
          await tx.asset.updateMany({
            where: { id: link.assetId, workspaceId: id },
            data: { assignedCardId: link.cardId, assignedSlot: "main" },
          })
        }
      }

      // Bibliography: append only non-duplicate citations.
      const existingBib = (await tx.workspace.findUnique({ where: { id }, select: { bibContent: true, bibKeys: true, agentEvents: true } })) ?? {
        bibContent: null,
        bibKeys: null,
        agentEvents: null,
      }
      const bibContent = existingBib.bibContent || ""
      const existingKeys = new Set(parseWorkspaceBibKeys(existingBib.bibContent, existingBib.bibKeys))
      const bibLower = bibContent.toLowerCase()
      const newEntries: string[] = []
      const newKeys: string[] = []
      proposal.citations.slice(0, MAX_BIB_ENTRIES).forEach((citation, i) => {
        const doi = citation.doi ? citation.doi.toLowerCase() : ""
        const url = citation.url ? citation.url.toLowerCase() : ""
        if ((doi && bibLower.includes(doi)) || (url && bibLower.includes(url))) return
        let key = `deerflow${i + 1}`
        if (existingKeys.has(key) || newKeys.includes(key)) {
          key = `deerflow${i + 1}-${randomUUID().slice(0, 6)}`
        }
        newKeys.push(key)
        newEntries.push(citationToBibtex(citation, key))
      })
      bibAdded = newEntries.length
      const nextBib = bibAdded > 0 ? `${bibContent.trim() ? bibContent.trim() + "\n\n" : ""}${newEntries.join("\n\n")}\n` : bibContent
      const nextKeys = [...existingKeys, ...newKeys]

      // Agent event so the feed shows what happened.
      const agentEvents = parseWorkspaceJson<Array<Record<string, unknown>>>(existingBib.agentEvents, [])
      const event = {
        id: `df-${randomUUID().slice(0, 8)}`,
        ts: new Date().toISOString(),
        kind: "info",
        status: "done",
        title: "Deep research applied",
        detail: `Applied ${appliedCardIds.length} research card(s), added ${bibAdded} citation(s).`,
      }
      const nextEvents = [...agentEvents, event].slice(-500)

      // Revision-gated workspace update: bump + persist bib/events atomically.
      const updated = await tx.workspace.updateMany({
        where: { id, revision: access.workspace.revision },
        data: {
          revision: { increment: 1 },
          ...(bibAdded > 0 ? { bibContent: nextBib } : {}),
          ...(bibAdded > 0 ? { bibKeys: nextKeys as unknown as Prisma.InputJsonValue } : {}),
          agentEvents: nextEvents as unknown as Prisma.InputJsonValue,
        },
      })
      if (updated.count !== 1) throw new ApplyConflictError()
      nextRevision = access.workspace.revision + 1
    })

    return NextResponse.json({
      appliedCardIds,
      skippedDuplicates,
      bibAdded,
      rejected: normalized.rejected,
      revision: nextRevision,
    })
  } catch (err) {
    const deerflowErr = toDeerflowResponse(err)
    if (deerflowErr) return deerflowErr
    if (err instanceof ApplyConflictError) {
      return safeApiError(err.message, 409, "WORKSPACE_CONFLICT")
    }
    if (err instanceof Response) return err
    console.error("[deerflow apply] Error:", err)
    return safeApiError("Failed to apply DeerFlow proposal", 500)
  }
}
