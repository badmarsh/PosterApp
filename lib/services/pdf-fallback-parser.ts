/**
 * Fallback PDF text parser using Mozilla's pdfjs-dist.
 *
 * When MinerU is offline or unreachable, this parser extracts text and basic
 * structure directly from the PDF in Node.js, formatting it into CommonMark Markdown.
 * This guarantees that uploaded PDF files are never dropped or left unparsed.
 */

export interface ParsedPdfDocument {
  md_content: string
  pageCount: number
}

async function initPdfJs() {
  // Ensure the fake worker handler is attached to globalThis in Node runtime
  // so pdfjs never tries to dynamically import relative './pdf.worker.mjs' from the bundled chunk path.
  if (!(globalThis as any).pdfjsWorker) {
    try {
      const workerModule = await import("pdfjs-dist/legacy/build/pdf.worker.mjs").catch(
        () => import("pdfjs-dist/build/pdf.worker.mjs")
      )
      ;(globalThis as any).pdfjsWorker = workerModule
    } catch (err) {
      console.warn("[pdf-fallback-parser] Could not pre-bind pdf.worker.mjs to globalThis:", err)
    }
  }

  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs").catch(
    () => import("pdfjs-dist/build/pdf.mjs")
  )

  try {
    const { pathToFileURL } = await import("node:url")
    const { createRequire } = await import("node:module")
    const req = createRequire(import.meta.url)
    const workerPath = req.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")
    if (pdfjs.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href
    }
  } catch {
    // Ignore if require.resolve is unavailable
  }

  return pdfjs
}

async function extractWithPdftotext(
  pdfData: Uint8Array | Buffer,
  filename: string
): Promise<ParsedPdfDocument | null> {
  try {
    const fs = await import("node:fs/promises")
    const path = await import("node:path")
    const os = await import("node:os")
    const { execFile } = await import("node:child_process")
    const { promisify } = await import("node:util")
    const execFileAsync = promisify(execFile)

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdf-extract-"))
    const tmpPdf = path.join(tmpDir, "input.pdf")
    await fs.writeFile(tmpPdf, pdfData)

    try {
      const cmd = process.platform === "win32" ? "wsl" : "pdftotext"
      const args = process.platform === "win32"
        ? ["pdftotext", "-layout", tmpPdf.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`), "-"]
        : ["-layout", tmpPdf, "-"]

      const { stdout } = await execFileAsync(cmd, args, { timeout: 20_000, maxBuffer: 15 * 1024 * 1024 })
      if (stdout && stdout.trim().length > 0) {
        const titleHint = filename.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ")
        const pages = stdout.split("\f").filter((p, idx, arr) => idx < arr.length - 1 || p.trim().length > 0)
        const mdPages = pages.map((pageText, idx) => `\n\n<!-- Page ${idx + 1} -->\n\n` + pageText.trim()).join("\n")
        return {
          md_content: `# ${titleHint}\n\n` + mdPages.trim(),
          pageCount: Math.max(1, pages.length),
        }
      }
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }
  } catch {
    // pdftotext unavailable or failed
  }
  return null
}

export async function parsePdfWithFallback(
  pdfData: Uint8Array | Buffer,
  filename: string
): Promise<ParsedPdfDocument> {
  try {
    const pdfjs = await initPdfJs()

    const data = pdfData instanceof Uint8Array
      ? new Uint8Array(pdfData.buffer, pdfData.byteOffset, pdfData.byteLength)
      : new Uint8Array(pdfData)
    const loadingTask = pdfjs.getDocument({
      data,
      useSystemFonts: true,
      disableFontFace: true,
      verbosity: 0,
    })

    const doc = await loadingTask.promise
  const pageCount = doc.numPages
  const markdownPages: string[] = []

  // Document title header
  const titleHint = filename.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ")
  markdownPages.push(`# ${titleHint}\n\n`)

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await doc.getPage(pageNum)
    const textContent = await page.getTextContent()
    const items = textContent.items as Array<{
      str: string
      dir?: string
      width?: number
      height?: number
      transform?: number[]
      hasEOL?: boolean
    }>

    if (items.length === 0) continue

    // Group text items into lines based on vertical position (transform[5] is Y coordinate)
    const lineBuckets = new Map<number, Array<{ x: number; text: string; height: number }>>()
    const Y_TOLERANCE = 3 // pixels

    for (const item of items) {
      const text = item.str || ""
      if (!text && !item.hasEOL) continue

      const x = item.transform ? item.transform[4] : 0
      const y = item.transform ? item.transform[5] : 0
      const height = item.height || (item.transform ? Math.abs(item.transform[0]) : 12)

      // Find existing bucket within tolerance
      let foundY: number | null = null
      for (const bucketY of lineBuckets.keys()) {
        if (Math.abs(bucketY - y) <= Y_TOLERANCE) {
          foundY = bucketY
          break
        }
      }

      const targetY = foundY !== null ? foundY : y
      if (!lineBuckets.has(targetY)) {
        lineBuckets.set(targetY, [])
      }
      lineBuckets.get(targetY)!.push({ x, text, height })
    }

    // Sort lines by Y descending (PDF coordinates start from bottom-left)
    const sortedYs = Array.from(lineBuckets.keys()).sort((a, b) => b - a)

    const pageLines: string[] = []
    for (const y of sortedYs) {
      const lineItems = lineBuckets.get(y)!
      // Sort items in line by X ascending
      lineItems.sort((a, b) => a.x - b.x)

      const lineText = lineItems
        .map((i) => i.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()

      if (!lineText) continue

      const avgHeight = lineItems.reduce((acc, curr) => acc + curr.height, 0) / lineItems.length

      // Detect potential headings
      const isChapterPattern = /^(?:Kapitola\s+\d+|Chapter\s+\d+|\d+(?:\.\d+)*)\s*[:.-]\s+[A-Z\p{Lu}]/u.test(lineText)
      const isMajorSection = /^(?:Úvod|Introduction|Metodika|Methodology|Výsledky|Results|Diskusia|Discussion|Záver|Conclusion|Literatúra|References|Bibliography|Abstrakt|Abstract)\b/i.test(lineText)
      const isLargeFont = avgHeight >= 14 && lineText.length < 100

      if (isChapterPattern || (isMajorSection && lineText.length < 60) || (isLargeFont && lineText.length < 80)) {
        if (avgHeight >= 18 || /^(?:Kapitola|Chapter|\d+\.)/i.test(lineText)) {
          pageLines.push(`\n## ${lineText}\n`)
        } else {
          pageLines.push(`\n### ${lineText}\n`)
        }
      } else {
        pageLines.push(lineText)
      }
    }

    markdownPages.push(`\n\n<!-- Page ${pageNum} -->\n\n` + pageLines.join("\n"))
  }

  return {
    md_content: markdownPages.join("\n").trim(),
    pageCount,
  }
} catch (pdfjsErr) {
  console.warn(`[pdf-fallback-parser] pdfjs-dist parsing failed (${pdfjsErr instanceof Error ? pdfjsErr.message : String(pdfjsErr)}), attempting pdftotext utility...`)
  const pdftotextResult = await extractWithPdftotext(pdfData, filename)
  if (pdftotextResult && pdftotextResult.md_content.length > 50) {
    return pdftotextResult
  }
  throw pdfjsErr
}
}
