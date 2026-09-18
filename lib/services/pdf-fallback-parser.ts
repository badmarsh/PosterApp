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

export async function parsePdfWithFallback(
  pdfData: Uint8Array | Buffer,
  filename: string
): Promise<ParsedPdfDocument> {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs").catch(
    () => import("pdfjs-dist/build/pdf.mjs")
  )

  const data = pdfData instanceof Uint8Array
    ? new Uint8Array(pdfData.buffer, pdfData.byteOffset, pdfData.byteLength)
    : new Uint8Array(pdfData)
  const loadingTask = pdfjs.getDocument({
    data,
    useSystemFonts: true,
    disableFontFace: true,
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
}
