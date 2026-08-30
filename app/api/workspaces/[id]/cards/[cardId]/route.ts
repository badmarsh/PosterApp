import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"

const CardSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  column: z.number().int().nullable().optional(),
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
  outputId: z.string().optional(), // required for create, optional for update
})

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  const { id, cardId } = await params
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id, userId }
    })
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found or unauthorized" }, { status: 404 })
    }

    const card = await prisma.card.findUnique({
      where: { id: cardId },
      include: { output: true }
    })
    if (!card || card.output?.workspaceId !== id) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 })
    }
    const data = {
      ...card,
      table: card.table ? (card.table as any) : { hasHeader: true, caption: "", rows: [] },
      figures: card.figures ? (card.figures as any) : [],
      sourceIds: card.sourceIds ? (card.sourceIds as any) : [],
    }
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  const { id, cardId } = await params
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id, userId }
    })
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found or unauthorized" }, { status: 404 })
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
      return NextResponse.json({ error: "Card belongs to another workspace" }, { status: 403 })
    }

    if (!existing && !card.outputId) {
      return NextResponse.json({ error: "outputId is required when creating a new card" }, { status: 400 })
    }
    
    await prisma.card.upsert({
      where: { id: cardId },
      create: {
        id: cardId,
        outputId: card.outputId as string,
        title: card.title || "",
        column: card.column ?? null,
        order: card.order,
        pattern: card.pattern,
        content: card.content || "",
        table: card.table === null ? Prisma.DbNull : (card.table as any),
        figures: card.figures === null ? Prisma.DbNull : (card.figures as any),
        figureLayout: card.figureLayout || "single",
        sourceIds: card.sourceIds === null ? Prisma.DbNull : (card.sourceIds as any),
        heightBudget: card.heightBudget,
        validation: card.validation || "valid",
        generatedLatex: card.generatedLatex,
      },
      update: {
        title: card.title || "",
        column: card.column ?? null,
        order: card.order,
        pattern: card.pattern,
        content: card.content || "",
        table: card.table === null ? Prisma.DbNull : (card.table as any),
        figures: card.figures === null ? Prisma.DbNull : (card.figures as any),
        figureLayout: card.figureLayout || "single",
        sourceIds: card.sourceIds === null ? Prisma.DbNull : (card.sourceIds as any),
        heightBudget: card.heightBudget,
        validation: card.validation || "valid",
        generatedLatex: card.generatedLatex,
      }
    })
    
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  const { id, cardId } = await params
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id, userId }
    })
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found or unauthorized" }, { status: 404 })
    }

    const existing = await prisma.card.findUnique({ 
      where: { id: cardId },
      include: { output: true } 
    })
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    if (existing.output?.workspaceId !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    await prisma.card.delete({ where: { id: cardId } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
