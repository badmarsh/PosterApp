import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

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
    const body = await req.json()
    const { id, name } = body
    if (!id || !name) {
      return NextResponse.json({ error: "id and name required" }, { status: 400 })
    }
    
    const project = await prisma.workspace.create({
      data: {
        id,
        name,
        posterTitle: name,
        authors: "",
        venue: "",
        templateName: body.templateName || "atlas",
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
