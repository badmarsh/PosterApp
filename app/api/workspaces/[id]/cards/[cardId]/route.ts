import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireWorkspaceAccess, requireWorkspaceEditor } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { safeApiError } from "@/lib/security"
import { z } from "zod"
import { CardSchema as SharedCardSchema } from "@/lib/validations/workspace"

// Reuse the strict shared card schema (typed table/figures/sourceIds) and add
// the create-only outputId.
const CardSchema = SharedCardSchema.extend({
  outputId: z.string().optional(), // required for create, optional for update
})

function readExpectedRevision(req: Request): number | null {
  const raw = new URL(req.url).searchParams.get("revision")
  if (raw === null) return null
  const n = parseInt(raw, 10)
  return Number.isFinite(n) ? n : null
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  const { id, cardId } = await params
  try {
    await requireWorkspaceAccess(id)

    const card = await prisma.card.findUnique({
      where: { id: cardId },
      include: { output: true }
    })
    if (!card || card.output?.workspaceId !== id) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 })
    }
    const data = {
      ...card,
      table: card.table ?? { hasHeader: true, caption: "", rows: [] },
      figures: card.figures ?? [],
      sourceIds: card.sourceIds ?? [],
    }
    return NextResponse.json(data)
  } catch (err) {
    if (err instanceof Response) return err
    console.error("[Card GET] Error:", err)
    return safeApiError("Failed to load card", 500)
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  const { id, cardId } = await params
  try {
    // Editor role is appropriate for updating individual cards in a project
    const { userId, workspace } = await requireWorkspaceEditor(id)

    const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:${id}:card-update`, 30, 60_000)
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many card update requests", retryAfterMs },
        { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
      )
    }

    // Optimistic concurrency: same contract as the workspace PUT.
    const expectedRevision = readExpectedRevision(req)
    if (expectedRevision !== null && workspace.revision !== expectedRevision) {
      return NextResponse.json({ error: "Stale revision", revision: workspace.revision }, { status: 409 })
    }

    const rawBody = await req.json()
    const parsed = CardSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.format() }, { status: 400 })
    }
    const card = parsed.data

    // Check if exists
    const existing = await prisma.card.findUnique({
      where: { id: cardId },
      include: { output: true }
    })
    if (existing && existing.output?.workspaceId !== id) {
      // Don't confirm the card exists in another workspace.
      return NextResponse.json({ error: "Card not found" }, { status: 404 })
    }

    let outputId: string
    if (existing) {
      outputId = existing.outputId
    } else {
      if (!card.outputId) {
        return NextResponse.json({ error: "outputId is required when creating a new card" }, { status: 400 })
      }
      // The target output MUST belong to this workspace — otherwise an editor of
      // workspace A could insert cards into workspace B.
      const output = await prisma.output.findFirst({ where: { id: card.outputId, workspaceId: id }, select: { id: true } })
      if (!output) {
        return NextResponse.json({ error: "Output not found in this workspace" }, { status: 404 })
      }
      outputId = output.id
    }

    const data = {
      title: card.title || "",
      column: card.column ?? null,
      order: card.order,
      pattern: card.pattern,
      content: card.content || "",
      table: card.table === null || card.table === undefined ? Prisma.DbNull : (card.table as Prisma.InputJsonValue),
      figures: card.figures === null || card.figures === undefined ? Prisma.DbNull : (card.figures as Prisma.InputJsonValue),
      figureLayout: card.figureLayout || "single",
      sourceIds: card.sourceIds === null || card.sourceIds === undefined ? Prisma.DbNull : (card.sourceIds as Prisma.InputJsonValue),
      heightBudget: card.heightBudget,
      validation: card.validation || "valid",
      generatedLatex: card.generatedLatex,
    }

    const [, updatedWorkspace] = await prisma.$transaction([
      prisma.card.upsert({
        where: { id: cardId },
        create: { id: cardId, outputId, ...data },
        update: data,
      }),
      // Bump the workspace revision so full-document saves detect this change.
      prisma.workspace.update({
        where: { id },
        data: { revision: { increment: 1 } },
        select: { revision: true },
      }),
    ])

    return NextResponse.json({ ok: true, revision: updatedWorkspace.revision })
  } catch (err) {
    if (err instanceof Response) return err
    console.error("[Card PUT] Error:", err)
    return safeApiError("Failed to update card", 500)
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  const { id, cardId } = await params
  try {
    // Editor role is appropriate for deleting individual cards within an existing output
    const { userId, workspace } = await requireWorkspaceEditor(id)

    const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:${id}:card-delete`, 30, 60_000)
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many card delete requests", retryAfterMs },
        { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
      )
    }

    const existing = await prisma.card.findUnique({ 
      where: { id: cardId },
      include: { output: true } 
    })
    if (!existing || existing.output?.workspaceId !== id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    const expectedRevision = readExpectedRevision(req)
    if (expectedRevision !== null && workspace.revision !== expectedRevision) {
      return NextResponse.json({ error: "Stale revision", revision: workspace.revision }, { status: 409 })
    }
    const [, updatedWorkspace] = await prisma.$transaction([
      prisma.card.delete({ where: { id: cardId } }),
      prisma.workspace.update({ where: { id }, data: { revision: { increment: 1 } }, select: { revision: true } }),
    ])
    return NextResponse.json({ ok: true, revision: updatedWorkspace.revision })
  } catch (err) {
    if (err instanceof Response) return err
    console.error("[Card DELETE] Error:", err)
    return safeApiError("Failed to delete card", 500)
  }
}
