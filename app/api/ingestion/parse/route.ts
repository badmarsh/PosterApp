import { NextResponse } from "next/server"
import * as fs from "fs"
import * as path from "path"
import { randomUUID } from "crypto"
import { prisma } from "@/lib/prisma"
import { rateLimitAsync } from "@/lib/rate-limit"
import { jsonStringify } from "@/lib/db-helpers"
import { generateCaption } from "@/lib/services/vision-service"
import { extractBibTeX } from "@/lib/services/bibtex-service"
import { generateEquationCaption } from "@/lib/services/equation-service"
import { cleanFormula, slugifyEquationKey } from "@/lib/equation-types"
import { requireWorkspaceEditor } from "@/lib/auth"
import { detectedPdf, MAX_UPLOAD_BYTES, SAFE_FILE_ID, SAFE_FILENAME, workspacePath } from "@/lib/workspace-files"
const WORKSPACES_DIR = path.join(process.cwd(), "workspaces")
const MINERU_API_URL = process.env.MINERU_API_URL ?? "http://127.0.0.1:8001"

// ---------------------------------------------------------------------------
// Types for the MinerU response
// ---------------------------------------------------------------------------

interface MinerUImage {
  /** Absolute or relative path to the extracted image on the MinerU host */
  path: string
  img_caption?: string
  caption?: string
  /** Page number (1-indexed) */
  page_no?: number
  /** Category hint: "figure" | "table" | ... */
  category?: string
  type?: string
}

interface MinerUResponse {
  /** All extracted images (figures + tables rendered as images) */
  images?: MinerUImage[]
  /** Some versions expose these separately */
  figures?: MinerUImage[]
  tables?: MinerUImage[]
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// POST /api/ingestion/parse?workspaceId=<id>
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get("workspaceId")

  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId query parameter is required" },
      { status: 400 }
    )
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId)) {
    return NextResponse.json(
      { error: "Invalid workspaceId" },
      { status: 400 }
    )
  }

  let userId: string
  try {
    const access = await requireWorkspaceEditor(workspaceId)
    userId = access.userId
  } catch (error) {
    if (error instanceof Response) return error
    return NextResponse.json({ error: { code: "AUTH_FAILED", message: "Could not authorize ingestion" } }, { status: 500 })
  }

  const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:ingest`, 10, 60_000)
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited', retryAfterMs }, { status: 429, headers: { 'Retry-After': Math.ceil(retryAfterMs / 1000).toString() } })
  }

  const contentLength = Number(req.headers.get("content-length"))
  if (!Number.isFinite(contentLength) || contentLength <= 0 || contentLength > MAX_UPLOAD_BYTES + 128 * 1024) return NextResponse.json({ error: "Upload is too large" }, { status: 413 })

  // -- Validate workspace exists ------------------------------------------
  const assetsDir = path.join(WORKSPACES_DIR, workspaceId, "assets")
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true })
  }

  // -- Parse incoming multipart form (Next.js 15 native formData) -----------
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json(
      { error: "Failed to parse multipart form data" },
      { status: 400 }
    )
  }

  const fileEntry = formData.get("file")
  if (!fileEntry || typeof fileEntry === "string") {
    return NextResponse.json(
      { error: "No file field found in form data" },
      { status: 400 }
    )
  }

  const uploadedFile = fileEntry as File
  if (uploadedFile.size <= 0 || uploadedFile.size > MAX_UPLOAD_BYTES || !/\.pdf$/i.test(uploadedFile.name) || !detectedPdf(new Uint8Array(await uploadedFile.slice(0, 5).arrayBuffer()))) {
    return NextResponse.json({ error: "Only valid PDF documents up to 25 MB are accepted" }, { status: 415 })
  }

  let existingAssets: string[] = []
  const existingAssetsStr = formData.get("existingAssets")
  if (existingAssetsStr && typeof existingAssetsStr === "string") {
    try {
      existingAssets = JSON.parse(existingAssetsStr)
    } catch {}
  }

  const fileId = formData.get("fileId")
  if (fileId && (typeof fileId !== "string" || !SAFE_FILE_ID.test(fileId))) {
    return NextResponse.json({ error: "Invalid file ID" }, { status: 400 })
  }

  // -- Set up SSE stream for real progress reporting ------------------------
  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  const sendEvent = async (data: {
    type: "progress" | "complete" | "error"
    stage?: string
    progress?: number
    assets?: any[]
    error?: string
    detail?: string
  }) => {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
    } catch {
      // client disconnected
    }
  }

  // Run pipeline asynchronously while streaming events to client
  ;(async () => {
    try {
      await sendEvent({
        type: "progress",
        stage: `Preparing ${uploadedFile.name} for parsing...`,
        progress: 10,
      })

      // Forward to MinerU
      try {
        const { ensureMinerUBridge } = await import("@/lib/services/mineru-bridge")
        ensureMinerUBridge()
      } catch {}

      await sendEvent({
        type: "progress",
        stage: "Submitting PDF to MinerU document parser...",
        progress: 20,
      })

      const mineruForm = new FormData()
      mineruForm.append("files", uploadedFile, uploadedFile.name)
      mineruForm.append("return_images", "true")
      mineruForm.append("return_middle_json", "true")

      let mineruResponse: Response
      try {
        mineruResponse = await fetch(`${MINERU_API_URL}/file_parse`, {
          method: "POST",
          body: mineruForm,
          signal: AbortSignal.timeout(300_000), // 5 minute timeout for large PDFs
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await sendEvent({
          type: "error",
          error: "MinerU document parsing service is unavailable",
          detail: `Could not connect to MinerU at ${MINERU_API_URL} (${message}). Please ensure the service is running (e.g. via start-mineru.bat).`,
        })
        return
      }

      if (!mineruResponse.ok) {
        const body = await mineruResponse.text().catch(() => "")
        await sendEvent({
          type: "error",
          error: "MinerU returned an error",
          detail: body || `HTTP ${mineruResponse.status}`,
        })
        return
      }

      let mineruData: { results?: Record<string, { md_content?: string; images?: Record<string, string>; middle_json?: any }> }
      try {
        mineruData = await mineruResponse.json()
      } catch {
        await sendEvent({
          type: "error",
          error: "Failed to parse MinerU JSON response",
        })
        return
      }

      await sendEvent({
        type: "progress",
        stage: "MinerU parse completed. Processing layout and markdown...",
        progress: 50,
      })

      // Parse MinerU API format
      const rawBasename = path.basename(uploadedFile.name, path.extname(uploadedFile.name))
      const basename = rawBasename.replace(/[^a-zA-Z0-9_-]/g, "_")
      const resultsMap = mineruData.results ?? {}
      const resultsKeys = Object.keys(resultsMap)
      const results =
        resultsMap[rawBasename] ??
        resultsMap[basename] ??
        (resultsKeys.length === 1 ? resultsMap[resultsKeys[0]] : undefined) ??
        resultsMap[
          resultsKeys.find(
            (k) => k.toLowerCase() === rawBasename.toLowerCase() || k.toLowerCase() === basename.toLowerCase()
          ) || ""
        ]

      if (!results) {
        await sendEvent({
          type: "error",
          error: "MinerU parsed the file but returned no matching result",
          detail: `Expected "${rawBasename}", available keys: [${resultsKeys.join(", ")}]`,
        })
        return
      }

      // Map to hold extracted table rows by their original image_path
      const tableMap = new Map<string, string[][]>()
      const pageMap = new Map<string, number>()

      if (results.middle_json) {
        try {
          const middle = typeof results.middle_json === "string" ? JSON.parse(results.middle_json) : results.middle_json
          let pageNum = 1
          for (const p of middle.pdf_info || []) {
            const searchImagePaths = (obj: any) => {
              if (!obj) return
              if (typeof obj === "object") {
                if (obj.image_path) {
                  pageMap.set(obj.image_path, pageNum)
                }
                if (obj.type === "table" && obj.html && obj.image_path) {
                  const rows: string[][] = []
                  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
                  let trMatch
                  while ((trMatch = trRegex.exec(obj.html)) !== null) {
                    const cells: string[] = []
                    const tdRegex = /<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi
                    let tdMatch
                    while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
                      cells.push(tdMatch[2].replace(/<[^>]+>/g, "").trim())
                    }
                    if (cells.length > 0) rows.push(cells)
                  }
                  tableMap.set(obj.image_path, rows)
                }
                for (const key of Object.keys(obj)) {
                  searchImagePaths(obj[key])
                }
              }
            }
            searchImagePaths(p)
            pageNum++
          }
        } catch (e) {
          console.error("Failed to parse middle_json for tables and pages", e)
        }
      }

      // Rename images to structured names to avoid long hashes while keeping stability
      if (results.images && results.md_content) {
        let figureIndex = 1
        let tableIndex = 1
        const newImages: Record<string, string> = {}
        for (const [filename, base64Data] of Object.entries(results.images)) {
          const ext = path.extname(filename) || ".jpg"
          const normName = filename.split("/").pop() || filename
          let newFilename = ""
          if (tableMap.has(normName)) {
            newFilename = `${basename}_table_${tableIndex++}${ext}`
            const rows = tableMap.get(normName)!
            tableMap.set(newFilename, rows)
            pageMap.set(newFilename, pageMap.get(normName) || 1)

            // Inject the parsed table directly into the Markdown so the AI can read the data!
            let mdTable = "\n\n"
            for (let i = 0; i < rows.length; i++) {
              mdTable += "| " + rows[i].map((c: string) => c.replace(/\|/g, "-")).join(" | ") + " |\n"
              if (i === 0) {
                mdTable += "| " + rows[i].map(() => "---").join(" | ") + " |\n"
              }
            }
            mdTable += "\n"

            // Try to replace the exact image markdown, or just append it near the image link
            const imgRegex = new RegExp("\\!\\[.*\\]\\(" + filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\)", "g")
            if (imgRegex.test(results.md_content)) {
              results.md_content = results.md_content.replace(imgRegex, `![](${newFilename})${mdTable}`)
            } else {
              results.md_content = results.md_content.split(filename).join(newFilename + '")\n' + mdTable + '\n[comment]: <> ("')
            }
          } else {
            newFilename = `${basename}_figure_${figureIndex++}${ext}`
            pageMap.set(newFilename, pageMap.get(normName) || 1)
            results.md_content = results.md_content.split(filename).join(newFilename)
          }
          newImages[newFilename] = base64Data
        }
        results.images = newImages
      }

      // Save parsed markdown to sources/ directory for RAG
      if (fileId && typeof fileId === "string" && results.md_content) {
        const sourcesDir = workspacePath(workspaceId, "sources")
        if (!fs.existsSync(sourcesDir)) fs.mkdirSync(sourcesDir, { recursive: true })
        await fs.promises.writeFile(workspacePath(workspaceId, "sources", `${fileId}.md`), results.md_content.slice(0, 5_000_000))

        await sendEvent({
          type: "progress",
          stage: "Extracting bibliography and references...",
          progress: 60,
        })

        // Auto-extract references to BibTeX (non-fatal)
        try {
          await extractBibTeX(results.md_content, workspaceId)
        } catch (err) {
          console.error("[Ingestion] BibTeX extraction failed (non-fatal):", err)
        }

        // Async vector chunking for RAG — fire-and-forget, non-blocking
        // This runs in background after SSE completes to avoid timeout
        const parsedIdForChunking = typeof fileId === "string" ? fileId : `file_${Date.now()}`
        setImmediate(async () => {
          try {
            const { ingestDocumentChunks } = await import("@/lib/ai/document-chunker")
            const { chunksCreated, skipped } = await ingestDocumentChunks(
              workspaceId,
              parsedIdForChunking,
              results.md_content!,
              // Use larger chunks for long documents (PhD/MSc) — approximated by content length
              {
                maxChunkChars: results.md_content!.length > 200_000 ? 3000 : 1800,
                concurrency: 2,
              }
            )
            console.log(`[VectorRAG] Indexed ${chunksCreated} chunks for ${workspaceId}/${parsedIdForChunking} (${skipped} skipped)`)
          } catch (err) {
            console.error("[VectorRAG] Background chunking failed (non-fatal):", err)
          }
        })
      }  // end: if (fileId && results.md_content)

  const assets: {
    id: string
    filename: string
    url: string
    thumbnailUrl: string
    kind: "figure" | "table" | "equation"
    heading?: string
    caption: string
    snippet?: string
    section?: string
    bbox?: string
    tableRows?: string[][]
    page: number
  }[] = []

    if (results?.images) {
      await sendEvent({
        type: "progress",
        stage: "Saving extracted figures and diagrams to workspace...",
        progress: 68,
      })

      const imageEntries = Object.entries(results.images).filter(([, v]) => typeof v === "string")
      await Promise.all(
        imageEntries.map(async ([filename, base64Data]) => {
          if (!SAFE_FILENAME.test(filename)) return
          const destPath = workspacePath(workspaceId, "assets", filename)
          try {
            const base64Payload = (base64Data as string).includes(",")
              ? (base64Data as string).split(",")[1]
              : (base64Data as string)
            const image = Buffer.from(base64Payload, "base64")
            if (image.byteLength > 10 * 1024 * 1024) return
            await fs.promises.writeFile(destPath, image)
          } catch {
            // skip unwritable images
          }
        })
      )

      // Second pass: generate captions in batches for new assets
      const MAX_CAPTIONS_PER_INGEST = 40
      let consecutiveAiFailures = 0
      let captionsAttempted = 0
      const CHUNK_SIZE = 2

      for (let i = 0; i < imageEntries.length; i += CHUNK_SIZE) {
        if (i > 0) {
          await new Promise((r) => setTimeout(r, 400))
        }
        const chunk = imageEntries.slice(i, i + CHUNK_SIZE)
        const currentCaptionCount = Math.min(i + chunk.length, imageEntries.length)
        await sendEvent({
          type: "progress",
          stage: `Generating AI captions for images (${currentCaptionCount}/${imageEntries.length})...`,
          progress: Math.min(85, 68 + Math.round((currentCaptionCount / Math.max(1, imageEntries.length)) * 17)),
        })

        await Promise.all(
          chunk.map(async ([filename, base64Data]) => {
            const uniqueFilename = filename
            const destPath = path.join(assetsDir, uniqueFilename)
            if (!fs.existsSync(destPath)) return

            const base64Payload = (base64Data as string).includes(",")
              ? (base64Data as string).split(",")[1]
              : (base64Data as string)

            let generated = { caption: "", snippet: "", name: "" }
            const isAlreadyExtracted = existingAssets.includes(uniqueFilename)
            const circuitTripped = consecutiveAiFailures >= 3
            const overMaxCaptions = captionsAttempted >= MAX_CAPTIONS_PER_INGEST

            if (isAlreadyExtracted || circuitTripped || overMaxCaptions) {
              // Caption already generated, AI circuit breaker tripped, or max cap reached
            } else {
              captionsAttempted++
              let contextWindow = ""
              if (results?.md_content) {
                const idx = results.md_content.indexOf(filename)
                if (idx !== -1) {
                  contextWindow = results.md_content.substring(
                    Math.max(0, idx - 800),
                    Math.min(results.md_content.length, idx + 800)
                  )
                }
              }
              try {
                generated = await generateCaption(base64Payload, contextWindow)
                if (!generated.caption && !generated.snippet) {
                  consecutiveAiFailures++
                } else {
                  consecutiveAiFailures = 0
                }
              } catch (err) {
                console.error(`[Ingestion] Failed to generate AI caption for ${uniqueFilename}:`, err)
                generated = { caption: "", snippet: "", name: "" }
                consecutiveAiFailures++
              }
            }

            const isTable = tableMap.has(uniqueFilename)
            const fallbackDefault = isTable ? "Table" : "Figure"
            const assetCaption = generated.caption || generated.name || fallbackDefault

            assets.push({
              id: randomUUID(),
              filename: uniqueFilename,
              url: `/api/workspaces/${workspaceId}/assets/${uniqueFilename}`,
              thumbnailUrl: `/api/workspaces/${workspaceId}/assets/${uniqueFilename}`,
              kind: isTable ? "table" : "figure",
              caption: assetCaption,
              snippet: generated.snippet,
              tableRows: isTable ? tableMap.get(uniqueFilename) : undefined,
              page: pageMap.get(uniqueFilename) || 1,
            })
          })
        )
      }
    }

    // Extract equations from middle_json and md_content with surrounding context
    await sendEvent({
      type: "progress",
      stage: "Extracting mathematical equations and formulas...",
      progress: 88,
    })

    const extractedEquations: {
      formula: string
      page: number
      title: string
      contextSnippet?: string
      section?: string
      key?: string
      description?: string
    }[] = []
    const seenEquations = new Set<string>()

    if (results.middle_json) {
      try {
        const middle = typeof results.middle_json === "string" ? JSON.parse(results.middle_json) : results.middle_json
        let pageNum = 1
        for (const p of middle.pdf_info || []) {
          const blocks: any[] = p.blocks || []
          for (let i = 0; i < blocks.length; i++) {
            const obj = blocks[i]
            if (obj && (obj.type === "equation" || obj.type === "interline_equation") && (obj.text || obj.latex)) {
              const rawFormula = (obj.latex || obj.text || "").trim()
              const clean = cleanFormula(rawFormula)
              if (clean.length >= 3 && !seenEquations.has(clean)) {
                seenEquations.add(clean)
                const prevText = blocks[i - 1]?.text || ""
                const nextText = blocks[i + 1]?.text || ""
                const contextSnippet = [prevText, nextText].filter(Boolean).join("\n")

                extractedEquations.push({
                  formula: clean,
                  page: pageNum,
                  title: `Equation: ${clean.slice(0, 45)}`,
                  contextSnippet: contextSnippet.slice(0, 1000),
                })
              }
            }
          }
          pageNum++
        }
      } catch (e) {
        console.error("Failed to parse middle_json for equations", e)
      }
    }

    if (results.md_content) {
      const displayMathRegex = /\$\$([\s\S]+?)\$\$|\\begin\{(?:equation|align|gather|multline)\*?\}([\s\S]+?)\\end\{(?:equation|align|gather|multline)\*?\}/g
      let match
      let eqCount = extractedEquations.length + 1
      while ((match = displayMathRegex.exec(results.md_content)) !== null) {
        const rawFormula = (match[1] || match[2] || "").trim()
        const clean = cleanFormula(rawFormula)
        if (clean.length >= 3 && !seenEquations.has(clean)) {
          seenEquations.add(clean)
          const matchIdx = match.index
          const contextSnippet = results.md_content.substring(
            Math.max(0, matchIdx - 500),
            Math.min(results.md_content.length, matchIdx + match[0].length + 500)
          )
          extractedEquations.push({
            formula: clean,
            page: 1,
            title: `Equation ${eqCount++}`,
            contextSnippet: contextSnippet.slice(0, 1000),
          })
        }
      }
    }

    // Generate AI captions and keys for extracted equations
    if (extractedEquations.length > 0) {
      await sendEvent({
        type: "progress",
        stage: "Generating descriptions for extracted equations...",
        progress: 92,
      })
      const MAX_EQUATION_CAPTIONS = 15
      const eqBatch = extractedEquations.slice(0, MAX_EQUATION_CAPTIONS)
      await Promise.all(
        eqBatch.map(async (eq) => {
          try {
            const meta = await generateEquationCaption(eq.formula, eq.contextSnippet)
            if (meta.name) eq.title = meta.name
            if (meta.key) eq.key = meta.key
            if (meta.description) eq.description = meta.description
          } catch {
            // Fallback title/key already set
          }
        })
      )
    }

    let eqIndex = 1
    for (const eq of extractedEquations) {
      const uniqueFilename = `${basename}_equation_${eqIndex++}.tex`
      const eqKey = eq.key || slugifyEquationKey(eq.title, eqIndex)
      assets.push({
        id: randomUUID(),
        filename: uniqueFilename,
        url: `/api/workspaces/${workspaceId}/assets/${uniqueFilename}`,
        thumbnailUrl: `/api/workspaces/${workspaceId}/assets/${uniqueFilename}`,
        kind: "equation",
        heading: eqKey,
        caption: eq.title || `Equation: ${eq.formula.slice(0, 40)}`,
        snippet: eq.formula,
        section: eq.description || undefined,
        bbox: eq.contextSnippet || undefined,
        page: eq.page,
      })
    }

    // Insert or update assets in Prisma with deduplication
    await sendEvent({
      type: "progress",
      stage: "Saving assets to database...",
      progress: 96,
    })

    if (assets.length > 0) {
      const parsedFileId = typeof fileId === "string" ? fileId : "unknown-file"
      try {
        await prisma.$transaction(
          assets.map((a) => {
            if (a.filename) {
              return prisma.asset.upsert({
                where: {
                  workspaceId_filename: {
                    workspaceId,
                    filename: a.filename,
                  },
                },
                create: {
                  ...a,
                  tableRows: a.tableRows ?? undefined,
                  workspaceId,
                  fileId: parsedFileId,
                  confidence: "high",
                },
                update: {
                  url: a.url,
                  thumbnailUrl: a.thumbnailUrl,
                  kind: a.kind,
                  heading: (a as any).heading ?? undefined,
                  caption: a.caption,
                  snippet: a.snippet,
                  section: (a as any).section ?? undefined,
                  bbox: (a as any).bbox ?? undefined,
                  tableRows: a.tableRows ?? undefined,
                  page: a.page,
                  fileId: parsedFileId,
                  confidence: "high",
                },
              })
            }
            return prisma.asset.create({
              data: {
                ...a,
                tableRows: a.tableRows ?? undefined,
                workspaceId,
                fileId: parsedFileId,
                confidence: "high",
              },
            })
          })
        )
      } catch (err) {
        await Promise.all(
          assets.map((a) =>
            fs.promises.unlink(workspacePath(workspaceId, "assets", a.filename)).catch(() => undefined)
          )
        )
        console.error("[Ingestion] Failed to persist assets, rolled back files:", err)
        await sendEvent({
          type: "error",
          error: "Failed to save extracted assets to database",
          detail: String(err),
        })
        return
      }
    }

    // Persist the IngestFile record in Prisma so it survives page reloads
    const parsedFileId = typeof fileId === "string" && SAFE_FILE_ID.test(fileId) ? fileId : `file_${Date.now()}`
    try {
      await prisma.ingestFile.upsert({
        where: { id: parsedFileId },
        create: {
          id: parsedFileId,
          workspaceId,
          name: uploadedFile.name,
          size: uploadedFile.size,
          method: "MinerU (WSL)",
          status: "done",
          progress: 100,
        },
        update: {
          status: "done",
          progress: 100,
          name: uploadedFile.name,
          size: uploadedFile.size,
        },
      })
    } catch (ingestErr) {
      console.warn("[Ingestion] Failed to upsert IngestFile:", ingestErr)
    }

    await sendEvent({
      type: "complete",
      assets,
      progress: 100,
    })
  } catch (err) {
    console.error("[Ingestion] Unexpected error in parsing pipeline:", err)
    await sendEvent({
      type: "error",
      error: err instanceof Error ? err.message : "Document parsing failed",
      detail: String(err),
    })
  } finally {
    try {
      await writer.close()
    } catch {}
  }
})()

return new Response(stream.readable, {
  headers: {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  },
})
}

