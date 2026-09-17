/**
 * GET /api/workspaces/[id]/thesis-review/source-document
 *
 * Retrieves the full parsed manuscript markdown text from workspace sources directory
 * (workspaces/[id]/sources/*.md) or DB assets fallback for grounding and live evidence navigation.
 *
 * Implements strict workspace authorization, path traversal checks, payload size bounds,
 * and structured block tokenization (ReviewSourceDocument).
 */

import { NextRequest, NextResponse } from "next/server"
import { requireWorkspaceEditor } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { ReviewSourceDocument, ReviewSourceBlock } from "@/lib/ai/review-types"
import { workspacePath } from "@/lib/workspace-files"
import fs from "fs/promises"
import path from "path"
import { createHash } from "crypto"

const MAX_SOURCE_DOC_BYTES = 10 * 1024 * 1024 // 10 MB limit

function parseMarkdownIntoBlocks(markdown: string): ReviewSourceBlock[] {
  const lines = markdown.split(/\r?\n/)
  const blocks: ReviewSourceBlock[] = []
  let currentSection = "Manuscript"
  let currentParagraphLines: string[] = []
  let blockIndex = 0

  const flushParagraph = () => {
    if (currentParagraphLines.length === 0) return
    const text = currentParagraphLines.join("\n").trim()
    if (text.length > 0) {
      blocks.push({
        id: `blk-${blockIndex++}`,
        section: currentSection,
        text,
      })
    }
    currentParagraphLines = []
  }

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/)
    if (headingMatch) {
      flushParagraph()
      currentSection = headingMatch[1].trim()
      blocks.push({
        id: `blk-${blockIndex++}`,
        section: currentSection,
        text: line.trim(),
      })
    } else if (line.trim() === "" || line.trim() === "---") {
      flushParagraph()
    } else {
      currentParagraphLines.push(line)
    }
  }
  flushParagraph()

  return blocks
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params

  // Strict path traversal and alphanumeric validation
  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId)) {
    return NextResponse.json({ error: "Invalid workspace identifier" }, { status: 400 })
  }

  try {
    await requireWorkspaceEditor(workspaceId)
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const requestedFileId = req.nextUrl.searchParams.get("fileId")

  const sourcesDir = workspacePath(workspaceId, "sources")

  try {
    let fullText = ""
    const files: Array<{ filename: string; content: string; length: number }> = []

    const dirExists = await fs.access(sourcesDir).then(() => true).catch(() => false)
    if (dirExists) {
      const fileNames = await fs.readdir(sourcesDir)
      let mdFiles = fileNames.filter((f) => f.endsWith(".md")).sort()

      if (requestedFileId) {
        const cleanId = requestedFileId.replace(/\.(md|pdf)$/i, "")
        let matched = mdFiles.filter((f) => f.replace(/\.md$/i, "") === cleanId || f.includes(cleanId))

        // If not matched directly by filename, check database for matching IngestFile
        if (matched.length === 0) {
          try {
            const ingest = await prisma.ingestFile.findFirst({
              where: {
                workspaceId,
                OR: [
                  { id: cleanId },
                  { name: requestedFileId },
                  { name: { contains: cleanId, mode: "insensitive" } },
                ],
              },
              select: { id: true },
            })
            if (ingest) {
              matched = mdFiles.filter((f) => f === `${ingest.id}.md` || f.includes(ingest.id))
            }
          } catch (e) {
            console.warn("[source-document GET] IngestFile lookup failed:", e)
          }
        }

        // CRITICAL: When a specific file is requested, only load that file.
        // If not matched, do NOT fall back to loading all files in the directory!
        mdFiles = matched
      } else if (mdFiles.length > 1) {
        // If no fileId was specified, do not concatenate independent theses.
        // Pick the first/active ingest file.
        try {
          const ingest = await prisma.ingestFile.findFirst({
            where: { workspaceId },
            orderBy: { id: "asc" },
            select: { id: true },
          })
          if (ingest) {
            const single = mdFiles.filter((f) => f === `${ingest.id}.md`)
            if (single.length > 0) {
              mdFiles = single
            } else {
              mdFiles = [mdFiles[0]]
            }
          } else {
            mdFiles = [mdFiles[0]]
          }
        } catch {
          mdFiles = [mdFiles[0]]
        }
      }

      for (const file of mdFiles) {
        // Prevent path traversal on individual files
        const safePath = path.join(sourcesDir, path.basename(file))
        const stat = await fs.stat(safePath)
        if (stat.size > MAX_SOURCE_DOC_BYTES) {
          continue
        }
        const content = await fs.readFile(safePath, "utf-8")
        files.push({
          filename: file,
          content,
          length: content.length,
        })
        fullText += (fullText ? "\n\n---\n\n" : "") + content
      }
    }

    // Database fallback if filesystem is empty or ephemeral
    if (!fullText.trim()) {
      const assets = await prisma.asset.findMany({
        where: { workspaceId },
        select: { filename: true, heading: true, snippet: true, kind: true },
      })
      const textSnippets = assets
        .filter((a) => a.kind === "text" || a.snippet)
        .map((a) => `## ${a.heading || a.filename}\n\n${a.snippet || ""}`)
        .join("\n\n")

      if (textSnippets.trim()) {
        fullText = textSnippets
      } else {
        const ingestWhere = requestedFileId
          ? {
              workspaceId,
              OR: [
                { id: requestedFileId.replace(/\.(md|pdf)$/i, "") },
                { name: requestedFileId },
              ],
            }
          : { workspaceId }
        const ingestFiles = await prisma.ingestFile.findMany({
          where: ingestWhere,
          select: { name: true },
          take: 1,
        })
        if (ingestFiles.length > 0) {
          fullText = `# Dokument: ${ingestFiles[0].name}\n\n(Text dokumentu bol spracovaný cez MinerU pipeline)`
        }
      }
    }

    const blocks = parseMarkdownIntoBlocks(fullText)

    // Use content SHA-256 hash as stable revision for stale detection.
    // Same content always produces the same revision, enabling clients
    // to detect when documents change and mark old evidence as stale.
    const contentRevision = fullText
      ? createHash("sha256").update(fullText, "utf8").digest("hex").slice(0, 16)
      : "empty-doc"

    const responseData: ReviewSourceDocument = {
      documentId: `doc-${workspaceId}`,
      revision: contentRevision,
      title: files[0]?.filename?.replace(/\.md$/, "") || "Manuscript Source",
      language: "sk",
      fullText,
      blocks,
      totalChars: fullText.length,
      files,
    }

    return NextResponse.json(responseData, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
      },
    })
  } catch (error) {
    console.error("[thesis-review/source-document GET] Error reading source document:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load manuscript source document" },
      { status: 500 }
    )
  }
}
