/**
 * Strips monotonic margin line numbers from extracted ATLAS-note / thesis PDFs.
 *
 * pdfjs reads the line-number gutter as ordinary text, so a draft comes out as
 * `97 The use of hadronically decaying W boson`. Those tokens dominate the
 * embedding window and break verbatim quote checks (`97 The use` is not in the
 * author's prose). The stripper runs only when a long, nearly +1 sequence is
 * present, so ordinary numbered lists and years are left alone.
 */

export interface MarginLineStrip {
  text: string
  stripped: number
  applied: boolean
}

// The token after the gutter number may be a word ("The use") or a section
// number ("2.1 Reco-to-truth"). The monotonic-chain test, not this regex,
// decides whether the prefix is a line number.
const NUMBERED = /^((?:#{1,6}\s+)?)(\d{2,4})\s+(\S.*)$/

interface Hit {
  index: number
  n: number
}

export function stripMarginLineNumbers(markdown: string): MarginLineStrip {
  if (!markdown) return { text: markdown, stripped: 0, applied: false }
  const lines = markdown.split("\n")
  const hits: Hit[] = []
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed || trimmed.startsWith("<!--")) continue
    const m = NUMBERED.exec(trimmed)
    if (!m) continue
    hits.push({ index: i, n: Number(m[2]) })
  }
  if (hits.length < 40) return { text: markdown, stripped: 0, applied: false }

  // Walk in document order and keep only a +1/+2 chain. Figure labels and
  // page numbers fail this test and stay in the text.
  let last = -1
  const accepted: Hit[] = []
  for (const hit of hits) {
    if (accepted.length === 0) {
      if (continues(hits, hit)) {
        accepted.push(hit)
        last = hit.n
      }
      continue
    }
    const d = hit.n - last
    if (d >= 1 && d <= 2) {
      accepted.push(hit)
      last = hit.n
    }
  }
  if (accepted.length < 40) return { text: markdown, stripped: 0, applied: false }

  const drop = new Map(accepted.map((h) => [h.index, h.n]))
  const out = lines.map((line, i) => {
    if (!drop.has(i)) return line
    return line.replace(/^(\s*(?:#{1,6}\s+)?)(\d{2,4})\s+/, "$1")
  })
  return { text: out.join("\n"), stripped: accepted.length, applied: true }
}

/**
 * Drops repeated running headers that pdfjs promotes to Markdown headings.
 *
 * A thesis page comes out as both `### 6.2 Fit setup` and, on the next page,
 * `## 6.2. Fit setup 41` plus `42 Chapter 6. Extraction of JES and JER`. The
 * second and third are the running head, not a new section. Leaving them in
 * splits one section into a heading per page and fills the embedding window
 * with the page number. A one-off title is kept.
 */
export function stripRunningHeaders(markdown: string): { text: string; stripped: number } {
  if (!markdown) return { text: markdown, stripped: 0 }
  const lines = markdown.split("\n")
  const drop = new Set<number>()

  const stems = lines.map((line) => headerStem(line))
  const stemCount = new Map<string, number>()
  for (const stem of stems) {
    if (!stem) continue
    stemCount.set(stem, (stemCount.get(stem) ?? 0) + 1)
  }
  const bareStem = new Set(stems.filter((stem, i) => stem && !hasPageSuffix(lines[i])))
  const bareChapter = new Set<string>()
  for (const line of lines) {
    const m = /^(?:#{1,6}\s+)?Chapter\s+(\d+)\s*$/.exec(line.trim())
    if (m) bareChapter.add(m[1])
  }

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed || trimmed.startsWith("<!--")) continue
    const stem = stems[i]
    if (!stem) continue
    const repeated = (stemCount.get(stem) ?? 0) >= 2
    const shadowed = hasPageSuffix(trimmed) && bareStem.has(stem)
    const chapter = /Chapter\s+(\d+)/.exec(trimmed)?.[1]
    const shadowedByChapter = Boolean(chapter && LEADING_PAGE.test(trimmed) && bareChapter.has(chapter))
    if (hasPageSuffix(trimmed) && (repeated || shadowed || shadowedByChapter)) drop.add(i)
    else if (LEADING_PAGE.test(trimmed) && (repeated || shadowedByChapter)) drop.add(i)
  }

  // A page marker already records the page. The bare number under it is the
  // printed folio, not a paragraph.
  for (let i = 0; i < lines.length; i++) {
    const marker = /<!-- Page (\d+) -->/.exec(lines[i].trim())
    if (!marker) continue
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      if (!lines[j].trim()) continue
      if (lines[j].trim() === marker[1]) drop.add(j)
      break
    }
  }

  if (drop.size === 0) return { text: markdown, stripped: 0 }
  return {
    text: lines.filter((_, i) => !drop.has(i)).join("\n"),
    stripped: drop.size,
  }
}

/** Margin gutters, then running headers. Same function the PDF parser and the indexer use. */
export function cleanExtractedPdfMarkdown(markdown: string): {
  text: string
  marginLinesStripped: number
  runningHeadersStripped: number
} {
  const margins = stripMarginLineNumbers(markdown)
  const headers = stripRunningHeaders(margins.text)
  return {
    text: headers.text,
    marginLinesStripped: margins.stripped,
    runningHeadersStripped: headers.stripped,
  }
}

const LEADING_PAGE = /^(?:#{1,6}\s+)?\d{1,3}\s+Chapter\s+\d+\./
const TRAILING_PAGE = /^(?:#{1,6}\s+)(?:Chapter\s+\d+\.|\d+\.\d+\.)\s+.{6,90}\s+\d{1,3}$/

function hasPageSuffix(line: string): boolean {
  const trimmed = line.trim()
  return LEADING_PAGE.test(trimmed) || TRAILING_PAGE.test(trimmed)
}

function headerStem(line: string): string | null {
  const trimmed = line.trim()
  if (!hasPageSuffix(trimmed) && !/^(?:#{1,6}\s+)?(?:Chapter\s+\d+\b|\d+\.\d+\.?)\s+\S/.test(trimmed)) {
    return null
  }
  if (!hasPageSuffix(trimmed) && !/^(?:#{1,6}\s+)/.test(trimmed) && !LEADING_PAGE.test(trimmed)) {
    return null
  }
  return trimmed
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\d{1,3}\s+(?=Chapter\s+\d+)/, "")
    .replace(/\s+\d{1,3}$/, "")
    .replace(/(\d)\.(?=\s)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function continues(hits: Hit[], start: Hit): boolean {
  let last = start.n
  let steps = 0
  for (const hit of hits) {
    if (hit.index <= start.index) continue
    const d = hit.n - last
    if (d >= 1 && d <= 2) {
      last = hit.n
      steps++
      if (steps >= 4) return true
    }
    if (hit.n > last + 8) break
  }
  return false
}
