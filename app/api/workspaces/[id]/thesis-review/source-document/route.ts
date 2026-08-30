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
import fs from "fs/promises"
import path from "path"
import { createHash } from "crypto"

const WORKSPACES_DIR = path.join(process.cwd(), "workspaces")
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

  const sourcesDir = path.join(WORKSPACES_DIR, workspaceId, "sources")

  try {
    let fullText = ""
    const files: Array<{ filename: string; content: string; length: number }> = []

    const dirExists = await fs.access(sourcesDir).then(() => true).catch(() => false)
    if (dirExists) {
      const fileNames = await fs.readdir(sourcesDir)
      const mdFiles = fileNames.filter((f) => f.endsWith(".md")).sort()

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
        const ingestFiles = await prisma.ingestFile.findMany({
          where: { workspaceId },
          select: { name: true },
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
    console.error("[thesis-review/source-document GET] Error reading source document")
    return NextResponse.json(
      { error: "Failed to load manuscript source document" },
      { status: 500 }
    )
  }
}
