import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseBibKeys } from "@/lib/bib-parser"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id },
      select: { bibContent: true, bibKeys: true }
    })
    
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    const bib = workspace.bibContent || ""
    const keys = workspace.bibKeys ? JSON.parse(workspace.bibKeys) : parseBibKeys(bib)
    
    return NextResponse.json({ bib, keys })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  try {
    const body = await req.json() as { bib: string }
    if (typeof body.bib !== "string") {
      return NextResponse.json({ error: "bib must be a string" }, { status: 400 })
    }
    
    const keys = parseBibKeys(body.bib)
    
    await prisma.workspace.update({
      where: { id },
      data: {
        bibContent: body.bib,
        bibKeys: JSON.stringify(keys),
      }
    })
    
    return NextResponse.json({ ok: true, keys })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
