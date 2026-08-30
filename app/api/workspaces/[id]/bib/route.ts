import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseBibKeys } from "@/lib/bib-parser"
import { requireWorkspaceAccess, requireWorkspaceEditor } from "@/lib/auth"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  try {
    const access = await requireWorkspaceAccess(id)

    const workspace = await prisma.workspace.findUnique({
      where: { id },
      select: { bibContent: true, bibKeys: true }
    })
    
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    const bib = workspace.bibContent || ""
    const keys = workspace.bibKeys ? (workspace.bibKeys as string[]) : parseBibKeys(bib)
    
    return NextResponse.json({ bib, keys })
  } catch (err) {
    if (err instanceof Response) return err
    console.error("[Bib GET] Error:", err)
    return NextResponse.json({ error: "Failed to load bibliography" }, { status: 500 })
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  try {
    await requireWorkspaceEditor(id)

    const body = await req.json() as { bib: string }
    if (typeof body.bib !== "string") {
      return NextResponse.json({ error: "bib must be a string" }, { status: 400 })
    }
    
    const keys = parseBibKeys(body.bib)
    
    await prisma.workspace.update({
      where: { id },
      data: {
        bibContent: body.bib,
        bibKeys: keys,
      }
    })
    
    return NextResponse.json({ ok: true, keys })
  } catch (err) {
    if (err instanceof Response) return err
    console.error("[Bib PUT] Error:", err)
    return NextResponse.json({ error: "Failed to update bibliography" }, { status: 500 })
  }
}
