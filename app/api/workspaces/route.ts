import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { WorkspaceCreateSchema } from "@/lib/validations/workspace"
import { auth } from "@/lib/auth"
import { getDefaultTemplateId } from "@/lib/output-types"

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    let workspaces = await prisma.workspace.findMany({
      where: { userId },
      select: { id: true, name: true },
    })

    if (workspaces.length === 0) {
      const { sampleProject } = await import("@/lib/mock-data")
      const { jsonStringify } = await import("@/lib/db-helpers")

      const demoId = `demo_${Date.now().toString(36)}`
      
      const project = await prisma.workspace.create({
        data: {
          id: demoId,
          name: sampleProject.name,
          authors: sampleProject.authors,
          venue: sampleProject.venue,
          userId,
          outputs: {
            create: sampleProject.outputs?.map((out) => ({
              id: `out_${out.outputType}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
              outputType: out.outputType,
              templateId: out.templateId,
              title: out.title,
              isActive: out.id === sampleProject.activeOutputId,
              cards: {
                create: out.cards.map((c) => ({
                  id: `card_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
                  title: c.title || "",
                  column: c.column,
                  order: c.order,
                  pattern: c.pattern,
                  content: c.content,
                  table: jsonStringify(c.table),
                  figures: jsonStringify(c.figures),
                  figureLayout: c.figureLayout || "auto",
                  sourceIds: jsonStringify(c.sourceIds),
                  validation: c.validation || "ok",
                })),
              },
            })),
          },
        },
        select: { id: true, name: true }
      })
      
      workspaces = [project]
    }

    return NextResponse.json(workspaces)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const rawBody = await req.json()
    const parsed = WorkspaceCreateSchema.safeParse(rawBody)
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      )
    }
    
    const { id, name, outputType = "poster", templateId } = parsed.data
    const resolvedTemplateId = templateId || getDefaultTemplateId(outputType)
    const outputId = `out_${outputType}_${Date.now().toString(36)}`
    
    const project = await prisma.workspace.create({
      data: {
        id,
        name,
        authors: "",
        venue: "",
        userId,
        outputs: {
          create: {
            id: outputId,
            outputType,
            templateId: resolvedTemplateId,
            title: name,
            isActive: true,
          },
        },
      },
      include: {
        outputs: {
          include: {
            cards: true,
          },
        },
      },
    })

    // Return in the expected Project format for the frontend
    const activeOutput = project.outputs.find((o) => o.isActive) || project.outputs[0]
    return NextResponse.json({
      ...project,
      // Legacy flat fields for backward compat
      posterTitle: activeOutput?.title ?? name,
      templateName: activeOutput?.templateId ?? resolvedTemplateId,
      cards: activeOutput?.cards ?? [],
      activeOutputId: activeOutput?.id ?? outputId,
    }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
