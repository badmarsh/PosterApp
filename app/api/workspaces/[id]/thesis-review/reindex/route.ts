/**
 * POST /api/workspaces/[id]/thesis-review/reindex
 *
 * Re-runs vector chunking + embedding for all successfully parsed IngestFiles
 * in the workspace. Useful when the embedding model changes or the initial
 * fire-and-forget ingest failed silently.
 *
 * Rate limit: 1 request per 2 minutes per user.
 * Returns: { indexed, skipped, results[] }
 */

import { NextRequest, NextResponse } from "next/server"
import { requireWorkspaceEditor } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { prisma } from "@/lib/prisma"
import { ingestDocumentChunks } from "@/lib/ai/document-chunker"
import fs from "fs"
import path from "path"

const WORKSPACES_DIR = path.join(process.cwd(), "workspaces")

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params

  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId)) {
    return NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 })
  }

  let userId: string
  try {
    const access = await requireWorkspaceEditor(workspaceId)
    userId = access.userId
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Rate limit: 1 reindex per 2 minutes per user
  const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:reindex`, 1, 120_000)
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limited", retryAfterMs },
      { status: 429, headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() } }
    )
  }

  const files = await prisma.ingestFile.findMany({
    where: { workspaceId, status: "done" },
    select: { id: true, name: true },
  })

  if (files.length === 0) {
    return NextResponse.json({ message: "No parsed documents found", indexed: 0, skipped: 0, results: [] })
  }

  let indexed = 0
  let skipped = 0
  const results: Array<{ fileId: string; name: string; chunks: number; status: string }> = []

  for (const file of files) {
    const mdPath = path.join(WORKSPACES_DIR, workspaceId, "sources", `${file.id}.md`)
    if (!fs.existsSync(mdPath)) {
      skipped++
      results.push({ fileId: file.id, name: file.name, chunks: 0, status: "no_markdown" })
      continue
    }

    try {
      const markdown = fs.readFileSync(mdPath, "utf8")
      // Adaptive chunk size: PhD dissertations (> 200k chars) get larger chunks
      // to preserve the flow of longer arguments
      const maxChunkChars = markdown.length > 200_000 ? 3000 : 1800
      const { chunksCreated } = await ingestDocumentChunks(
        workspaceId,
        file.id,
        markdown,
        { maxChunkChars }
      )
      indexed++
      results.push({ fileId: file.id, name: file.name, chunks: chunksCreated, status: "ok" })
    } catch (err) {
      skipped++
      console.error(`[reindex] Failed to index ${file.name}:`, err)
      results.push({ fileId: file.id, name: file.name, chunks: 0, status: err instanceof Error ? err.message : String(err) })
    }
  }

  return NextResponse.json({ indexed, skipped, results })
}
