import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWorkspaceEditor } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { safeApiError } from "@/lib/security"
import { workspacePath } from "@/lib/workspace-files"
import fs from "fs"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { id, fileId } = await params

  try {
    const { userId } = await requireWorkspaceEditor(id)

    const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:${id}:ingest-file-patch`, 20, 60_000)
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many file update requests", retryAfterMs },
        { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
      )
    }

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
    return safeApiError("Failed to update file", 500)
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { id, fileId } = await params

  try {
    // Editor role is appropriate for deleting individual uploaded source files from a workspace
    const { userId } = await requireWorkspaceEditor(id)

    const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:${id}:ingest-file-delete`, 20, 60_000)
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many file delete requests", retryAfterMs },
        { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
      )
    }

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

    // 3. Remove source markdown file on disk if exists (B5: using workspacePath)
    try {
      const sourceMd = workspacePath(id, "sources", `${fileId}.md`)
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
    return safeApiError("Failed to delete file", 500)
  }
}
