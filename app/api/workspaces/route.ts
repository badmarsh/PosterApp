import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { WorkspaceCreateSchema } from "@/lib/validations/workspace"
import { auth } from "@/lib/auth"
import { getDefaultTemplateId } from "@/lib/output-types"

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const workspaces = await prisma.workspace.findMany({
      where: { userId },
      select: { id: true, name: true },
    })
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
