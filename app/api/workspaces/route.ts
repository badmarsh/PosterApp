import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { WorkspaceCreateSchema } from "@/lib/validations/workspace"
import { auth } from "@/lib/auth"
import { getDefaultTemplateId, getTemplateDef } from "@/lib/output-types"
import { rateLimitAsync } from "@/lib/rate-limit"
import { safeApiError } from "@/lib/security"

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    let workspaces = await prisma.workspace.findMany({
      where: {
        OR: [
          { userId },
          { members: { some: { userId } } },
        ]
      },
      include: {
        outputs: {
          select: {
            id: true,
            outputType: true,
            templateId: true,
            title: true,
            isActive: true,
          }
        }
      },
      orderBy: { id: "asc" },
    })

    if (workspaces.length === 0) {
      const { sampleProjects } = await import("@/lib/mock-data")

      const demoWorkspaces = await Promise.all(sampleProjects.map(async (sampleProj, idx) => {
        const demoId = idx === 0 ? `demo_${Date.now().toString(36)}` : sampleProj.id
        
        return prisma.workspace.create({
          data: {
            id: demoId,
            name: sampleProj.name,
            authors: sampleProj.authors,
            venue: sampleProj.venue,
            userId,
            outputs: {
              create: sampleProj.outputs?.map((out) => ({
                id: `out_${out.outputType}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
                outputType: out.outputType,
                templateId: out.templateId,
                title: out.title,
                themeColor: out.themeColor ?? getTemplateDef(out.templateId)?.colors[0]?.hex ?? null,
                isActive: out.id === sampleProj.activeOutputId,
                cards: {
                  create: out.cards.map((c) => ({
                    id: `card_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
                    title: c.title || "",
                    column: c.column,
                    order: c.order,
                    pattern: c.pattern,
                    content: c.content,
                    table: c.table ?? undefined,
                    figures: c.figures ?? undefined,
                    figureLayout: c.figureLayout || "auto",
                    sourceIds: c.sourceIds ?? undefined,
                    validation: c.validation || "ok",
                  })),
                },
              })),
            },
          },
          include: {
            outputs: {
              select: {
                id: true,
                outputType: true,
                templateId: true,
                title: true,
                isActive: true,
              }
            }
          }
        })
      }))
      
      workspaces = demoWorkspaces
    }

    const result = workspaces.map((ws) => {
      const activeOut = ws.outputs?.find((o) => o.isActive) || ws.outputs?.[0]
      return {
        id: ws.id,
        name: ws.name,
        authors: ws.authors,
        venue: ws.venue,
        templateName: activeOut?.templateId ?? "atlas",
      }
    })

    return NextResponse.json(result)
  } catch (err) {
    const msg = String(err);
    if (
      msg.includes("Can't reach database") || 
      msg.includes("PrismaClientInitializationError") ||
      msg.includes("P2021") ||
      msg.includes("does not exist") ||
      msg.includes("Invalid `prisma.workspace")
    ) {
      return NextResponse.json(
        { error: "Database offline or not initialized. Please start PostgreSQL and run 'npx dotenv-cli -e .env.local -- npx prisma db push'." },
        { status: 503 }
      )
    }
    console.error("[Workspaces GET] Server error:", err)
    return NextResponse.json({ error: "Failed to load workspaces" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:workspaces-create`, 20, 60_000)
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many workspace create requests", retryAfterMs },
        { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
      )
    }

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
            themeColor: getTemplateDef(resolvedTemplateId)?.colors[0]?.hex ?? null,
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
      activeOutputId: activeOutput?.id ?? outputId,
    }, { status: 201 })
  } catch (err) {
    const msg = String(err);
    if (
      msg.includes("Can't reach database") || 
      msg.includes("PrismaClientInitializationError") ||
      msg.includes("P2021") ||
      msg.includes("does not exist") ||
      msg.includes("Invalid `prisma.workspace")
    ) {
      return NextResponse.json(
        { error: "Database offline or not initialized. Please start PostgreSQL and run 'npx dotenv-cli -e .env.local -- npx prisma db push'." },
        { status: 503 }
      )
    }
    console.error("[Workspaces POST] Server error:", err)
    return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 })
  }
}
