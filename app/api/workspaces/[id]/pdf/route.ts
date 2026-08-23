import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const WORKSPACES_DIR = path.join(process.cwd(), "workspaces")

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Validate id to prevent path traversal
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid workspace id" }, { status: 400 })
  }

  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const owned = await prisma.workspace.findUnique({ where: { id, userId } })
  if (!owned) return NextResponse.json({ error: "Workspace not found or unauthorized" }, { status: 404 })

  const pdfPath = path.join(WORKSPACES_DIR, id, "main.pdf")

  if (!fs.existsSync(pdfPath)) {
    return NextResponse.json({ error: "PDF not found — compile first" }, { status: 404 })
  }

  try {
    const buffer = await fs.promises.readFile(pdfPath)
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
