/**
 * GET /api/workspaces/[id]/thesis-review/source-document
 *
 * Retrieves the full parsed manuscript markdown text from workspace sources directory
 * (workspaces/[id]/sources/*.md) for grounding and live evidence navigation in the Split-View.
 */

import { NextRequest, NextResponse } from "next/server"
import { requireWorkspaceEditor } from "@/lib/auth"
import fs from "fs/promises"
import path from "path"

const WORKSPACES_DIR = path.join(process.cwd(), "workspaces")

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params

  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId)) {
    return NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 })
  }

  try {
    await requireWorkspaceEditor(workspaceId)
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const sourcesDir = path.join(WORKSPACES_DIR, workspaceId, "sources")

  try {
    const dirExists = await fs.access(sourcesDir).then(() => true).catch(() => false)
    if (!dirExists) {
      return NextResponse.json({ fullText: "", files: [], totalChars: 0 })
    }

    const fileNames = await fs.readdir(sourcesDir)
    const mdFiles = fileNames.filter((f) => f.endsWith(".md")).sort()

    if (mdFiles.length === 0) {
      return NextResponse.json({ fullText: "", files: [], totalChars: 0 })
    }

    const files: { filename: string; content: string; length: number }[] = []
    let fullText = ""

    for (const file of mdFiles) {
      const content = await fs.readFile(path.join(sourcesDir, file), "utf-8")
      files.push({
        filename: file,
        content,
        length: content.length,
      })
      fullText += (fullText ? "\n\n---\n\n" : "") + content
    }

    return NextResponse.json(
      {
        fullText,
        files,
        totalChars: fullText.length,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
        },
      }
    )
  } catch (error) {
    console.error("[thesis-review/source-document GET] Error:", error)
    return NextResponse.json(
      { error: "Failed to read source document text" },
      { status: 500 }
    )
  }
}
