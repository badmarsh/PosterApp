import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWorkspaceEditor } from "@/lib/auth"
import fs from "fs"
import path from "path"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { id, fileId } = await params

  try {
    await requireWorkspaceEditor(id)

    const body = await req.json()
    const name = typeof body.name === "string" ? body.name.trim() : ""

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const updated = await prisma.ingestFile.update({
      where: {
        id: fileId,
        workspaceId: id,
      },
      data: { name },
    })

    return NextResponse.json({ ok: true, file: updated })
  } catch (err) {
    if (err instanceof Response) return err
    console.error("[IngestFile PATCH] Error:", err)
    return NextResponse.json({ error: "Failed to update file" }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { id, fileId } = await params

  try {
    await requireWorkspaceEditor(id)

    // 1. Delete IngestFile
    await prisma.ingestFile.deleteMany({
      where: {
        id: fileId,
        workspaceId: id,
      },
    })

    // 2. Cascade delete associated DocumentChunks & GraphNodes
    await prisma.documentChunk.deleteMany({
      where: {
        workspaceId: id,
        documentId: fileId,
      },
    })

    await prisma.graphNode.deleteMany({
      where: {
        workspaceId: id,
        documentId: fileId,
      },
    })

    // 3. Remove source markdown file on disk if exists
    try {
      const sourceMd = path.join(process.cwd(), "workspaces", id, "sources", `${fileId}.md`)
      if (fs.existsSync(sourceMd)) {
        fs.unlinkSync(sourceMd)
      }
    } catch (fsErr) {
      console.warn("[IngestFile DELETE] Could not delete source file on disk:", fsErr)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof Response) return err
    console.error("[IngestFile DELETE] Error:", err)
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 })
  }
}
