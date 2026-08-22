import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { WorkspaceCreateSchema } from "@/lib/validations/workspace"
import { auth } from "@clerk/nextjs/server"

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
    
    const { id, name, templateName } = parsed.data
    
    const project = await prisma.workspace.create({
      data: {
        id,
        name,
        posterTitle: name,
        authors: "",
        venue: "",
        templateName: templateName || "atlas",
        userId,
      },
      include: {
        cards: true,
      }
    })
    return NextResponse.json(project, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
