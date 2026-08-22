import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { WorkspaceCreateSchema } from "@/lib/validations/workspace"

export async function GET() {
  try {
    const workspaces = await prisma.workspace.findMany({
      select: { id: true, name: true },
    })
    return NextResponse.json(workspaces)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
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
