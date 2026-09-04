import { prisma } from "@/lib/prisma"
import { requireWorkspaceEditor } from "@/lib/auth"
import { createWorkspaceSnapshot } from "@/lib/agent-snapshot"
import { logApprovedMutation } from "@/lib/agent-audit"
import { parseBibKeys } from "@/lib/bib-parser"
import { workspacePath } from "@/lib/workspace-files"
import { findToolById } from "@/lib/agent-tools/registry"
import fs from "fs"
import path from "path"

export interface ApplyChangeOptions {
  forceRebase?: boolean
}

export type ApplyResult =
  | {
      ok: true
      changeId: string
      status: "applied"
      snapshotId: string
      resultData?: unknown
    }
  | {
      ok: false
      code: "CONFLICT"
      message: string
      currentCard: unknown
      proposed: unknown
    }
  | {
      ok: false
      code: "EXPIRED" | "NOT_FOUND" | "INVALID_STATE" | "VALIDATION" | "FORBIDDEN" | "INTERNAL"
      message: string
      details?: unknown
    }

/**
 * §9.2 Apply path for AgentPendingChange
 * 1 load change; must be pending and not expired
 * 2 approver = current human session (lib/auth.ts)
 * 3 requireWorkspaceEditor(change.workspaceId, approver.userId) at APPROVE time
 * 4 re-validate payload against the tool's zod schema (schema may have changed)
 * 5 for cards.update: if card.updatedAt > change.createdAt -> CONFLICT unless forceRebase
 * 6 createWorkspaceSnapshot(workspaceId, `pre-agent:${toolName}:${changeId}`, { source: 'agent' })
 * 7 perform mutation inside prisma.$transaction
 * 8 mark applied, set snapshotId, decidedById
 * 9 logToolCall with approved=true and changeId (only place approved=true is ever written)
 */
export async function applyAgentChange(
  changeId: string,
  approverUserId: string,
  options?: ApplyChangeOptions
): Promise<ApplyResult> {
  // 1. Load change
  const change = await prisma.agentPendingChange.findUnique({
    where: { id: changeId },
    include: { apiKey: true },
  })

  if (!change) {
    return { ok: false, code: "NOT_FOUND", message: `Pending change ${changeId} not found` }
  }

  // Check lazy expiry (7 days default)
  if (change.status === "pending" && change.expiresAt < new Date()) {
    await prisma.agentPendingChange.update({
      where: { id: changeId },
      data: { status: "expired", decidedAt: new Date() },
    })
    return { ok: false, code: "EXPIRED", message: "Change proposal has expired" }
  }

  if (change.status !== "pending") {
    return {
      ok: false,
      code: "INVALID_STATE",
      message: `Change ${changeId} is not in pending status (current: ${change.status})`,
    }
  }

  // 2 & 3. Human approver re-authorization at APPROVE time
  try {
    await requireWorkspaceEditor(change.workspaceId)
  } catch (err: any) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: err?.message || "Approver does not have editor permissions for this workspace",
    }
  }

  // 4. Re-validate payload against tool's current Zod schema
  const tool = findToolById(change.toolName as any)
  if (!tool) {
    return {
      ok: false,
      code: "INTERNAL",
      message: `Tool ${change.toolName} is no longer registered in system`,
    }
  }

  const parseResult = tool.input.safeParse(change.payload)
  if (!parseResult.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "Change payload fails current tool schema validation",
      details: parseResult.error.format(),
    }
  }
  const payload = parseResult.data as any

  // 5. Conflict detection for cards.update
  let targetCard: any = null
  if (change.toolName === "posterapp.cards.update") {
    targetCard = await prisma.card.findUnique({
      where: { id: payload.cardId },
    })

    if (!targetCard) {
      return { ok: false, code: "NOT_FOUND", message: `Target card ${payload.cardId} not found` }
    }

    const diffPreview = change.diffPreview as { before?: { title?: string; content?: string } } | null
    const beforeTitle = diffPreview?.before?.title
    const beforeContent = diffPreview?.before?.content
    const isConflict =
      !options?.forceRebase &&
      ((Boolean(targetCard.updatedAt && change.createdAt) && targetCard.updatedAt > change.createdAt) ||
        (Boolean(diffPreview?.before) &&
          (targetCard.title !== beforeTitle || targetCard.content !== beforeContent)))

    if (isConflict) {
      return {
        ok: false,
        code: "CONFLICT",
        message:
          "Target card was modified by a human or concurrent process after this proposal was created. Review diff to rebase or reject.",
        currentCard: {
          title: targetCard.title,
          content: targetCard.content,
        },
        proposed: {
          title: payload.title ?? targetCard.title,
          content: payload.content ?? targetCard.content,
        },
      }
    }
  }

  // 6. Pre-apply snapshot tagged source: 'agent'
  let snapshot: any
  try {
    snapshot = await createWorkspaceSnapshot(
      change.workspaceId,
      `pre-agent:${change.toolName}:${changeId}`,
      { source: "agent" }
    )
  } catch (err: any) {
    console.error(`[apply] Snapshot failed for change ${changeId}:`, err)
    return { ok: false, code: "INTERNAL", message: "Failed to create pre-agent snapshot" }
  }

  // 7 & 8. Execute mutation & mark applied inside prisma.$transaction
  let resultData: any = null
  try {
    await prisma.$transaction(async (tx) => {
      // Branch per tool type
      if (change.toolName === "posterapp.cards.update") {
        const updateData: any = {}
        if (payload.title !== undefined) updateData.title = payload.title
        if (payload.content !== undefined) updateData.content = payload.content

        // §12.2: A pending card becomes ok only through a human edit or an approved agent change.
        if (targetCard?.validation === "pending") {
          updateData.validation = "valid"
        }

        const updatedCard = await tx.card.update({
          where: { id: payload.cardId },
          data: updateData,
        })
        const updatedWs = await tx.workspace.update({
          where: { id: change.workspaceId },
          data: { revision: { increment: 1 } },
        })
        resultData = { cardId: updatedCard?.id || payload.cardId, revision: updatedWs?.revision ?? 1 }
      } else if (change.toolName === "posterapp.cards.create") {
        let output = await tx.output.findFirst({
          where: { workspaceId: change.workspaceId },
        })
        if (!output) {
          output = await tx.output.create({
            data: {
              id: `out-${Date.now()}`,
              workspaceId: change.workspaceId,
              outputType: "poster",
              templateId: "tikzposter-default",
              title: "Poster",
              isActive: true,
            },
          })
        }

        const maxCard = await tx.card.findFirst({
          where: { outputId: output.id },
          orderBy: { order: "desc" },
        })
        const nextOrder = maxCard ? maxCard.order + 1 : 0

        const newCard = await tx.card.create({
          data: {
            id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            outputId: output.id,
            title: payload.title,
            content: payload.content,
            pattern: payload.pattern || "bullets",
            figureLayout: "single",
            order: payload.position ?? nextOrder,
            validation: "valid",
          },
        })
        await tx.workspace.update({
          where: { id: change.workspaceId },
          data: { revision: { increment: 1 } },
        })
        resultData = { cardId: newCard.id }
      } else if (change.toolName === "posterapp.bibliography.add") {
        const workspace = await tx.workspace.findUnique({
          where: { id: change.workspaceId },
          select: { bibContent: true, bibKeys: true },
        })

        let bibEntry = payload.bibtex || ""
        if (!bibEntry) {
          const firstAuthor =
            (payload.authors?.[0] || "Author").split(/\s+/).pop()?.toLowerCase() || "author"
          const year = payload.year || new Date().getFullYear()
          const cleanTitle = payload.title.replace(/[^a-zA-Z0-9]/g, "").slice(0, 15).toLowerCase()
          const citeKey = `${firstAuthor}${year}${cleanTitle}`
          const authorStr = payload.authors?.join(" and ") || "Unknown"
          bibEntry = `@article{${citeKey},\n  title={${payload.title}},\n  author={${authorStr}},\n  year={${year}}${payload.doi ? `,\n  doi={${payload.doi}}` : ""}\n}`
        }

        const existingBib = workspace?.bibContent || ""
        const updatedBib = existingBib ? `${existingBib.trim()}\n\n${bibEntry}` : bibEntry
        const keys = parseBibKeys(updatedBib)

        await tx.workspace.update({
          where: { id: change.workspaceId },
          data: {
            bibContent: updatedBib,
            bibKeys: keys as any,
            revision: { increment: 1 },
          },
        })
        resultData = { addedKeys: parseBibKeys(bibEntry), totalKeys: keys.length }
      } else if (change.toolName === "posterapp.bibliography.remove") {
        const workspace = await tx.workspace.findUnique({
          where: { id: change.workspaceId },
          select: { bibContent: true },
        })

        const existingBib = workspace?.bibContent || ""
        // Remove entry matching key
        const entryRegex = new RegExp(
          `@[a-zA-Z]+\\s*\\{\\s*${payload.entryId}\\s*,[\\s\\S]*?\\n\\}`,
          "gi"
        )
        const updatedBib = existingBib.replace(entryRegex, "").trim()
        const keys = parseBibKeys(updatedBib)

        await tx.workspace.update({
          where: { id: change.workspaceId },
          data: {
            bibContent: updatedBib,
            bibKeys: keys as any,
            revision: { increment: 1 },
          },
        })
        resultData = { removedKey: payload.entryId, totalKeys: keys.length }
      } else if (change.toolName === "posterapp.assets.upload") {
        const buffer = Buffer.from(payload.contentBase64, "base64")
        const dir = workspacePath(change.workspaceId, "assets")
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }
        const filePath = path.join(dir, payload.filename)
        fs.writeFileSync(filePath, buffer)

        const assetId = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        const asset = await tx.asset.create({
          data: {
            id: assetId,
            workspaceId: change.workspaceId,
            fileId: `file-${Date.now()}`,
            filename: payload.filename,
            url: `/api/workspaces/${change.workspaceId}/assets/${payload.filename}`,
            kind: "figure",
            page: 1,
            confidence: "high",
            caption: payload.caption || null,
          },
        })
        resultData = { assetId: asset.id, filename: asset.filename }
      } else if (change.toolName === "posterapp.compile.run") {
        resultData = { format: payload.format, queued: true }
      }

      // Mark applied
      await tx.agentPendingChange.update({
        where: { id: changeId },
        data: {
          status: "applied",
          snapshotId: snapshot.id,
          decidedById: approverUserId,
          decidedAt: new Date(),
          error: null,
        },
      })
    })
  } catch (err: any) {
    console.error(`[apply] Mutation transaction failed for change ${changeId}:`, err)
    // Mark failed
    await prisma.agentPendingChange.update({
      where: { id: changeId },
      data: {
        status: "failed",
        decidedById: approverUserId,
        decidedAt: new Date(),
        error: err?.message || "Transaction failed",
      },
    })
    return { ok: false, code: "INTERNAL", message: err?.message || "Mutation failed to apply" }
  }

  // 9. Log approved tool call in AgentToolCallLog (only place approved=true is written)
  await logApprovedMutation(
    change.apiKeyId,
    change.workspaceId,
    change.toolName,
    payload,
    resultData,
    changeId
  )

  return {
    ok: true,
    changeId,
    status: "applied",
    snapshotId: snapshot.id,
    resultData,
  }
}

/**
 * Rejects a pending agent change.
 */
export async function rejectAgentChange(
  changeId: string,
  approverUserId: string,
  reason?: string
): Promise<{ ok: boolean; code?: string; message?: string }> {
  const change = await prisma.agentPendingChange.findUnique({
    where: { id: changeId },
  })

  if (!change) {
    return { ok: false, code: "NOT_FOUND", message: `Change ${changeId} not found` }
  }

  if (change.status !== "pending") {
    return {
      ok: false,
      code: "INVALID_STATE",
      message: `Change ${changeId} is not in pending status (current: ${change.status})`,
    }
  }

  try {
    await requireWorkspaceEditor(change.workspaceId)
  } catch (err: any) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: err?.message || "Approver does not have editor permissions for this workspace",
    }
  }

  await prisma.agentPendingChange.update({
    where: { id: changeId },
    data: {
      status: "rejected",
      decidedById: approverUserId,
      decidedAt: new Date(),
      error: reason || null,
    },
  })

  return { ok: true }
}
