/**
 * Pure text-splitting utilities for the RAG chunker (no DB / model imports so
 * they are unit-testable in isolation).
 */

import { FIGURE_CAPTION_LINE_RE, type ChunkKind } from "./chunking-config"

/** A typed segment: prose text vs. an atomic structural block (table/equation/figure caption). */
export interface StructuralSegment {
  kind: ChunkKind
  text: string
}

/** A pipe row looks like a markdown table row: starts with `|` and contains another `|`. */
function isTableLine(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line)
}

/** Separator line after a table header: |---|:--:|---|. */
function isTableSeparatorLine(line: string): boolean {
  return isTableLine(line) && /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes("-")
}

function isDisplayMathStart(line: string): boolean {
  return /^\s*\$\$/.test(line)
}

function isDisplayMathEnd(line: string): boolean {
  return /\$\$\s*$/.test(line)
}

/**
 * Splits `text` into "atomic units" that must never be cut in the middle:
 *  - Markdown tables (consecutive `|`-rows) and `$$ … $$` display-math blocks
 *    are kept whole,
 *  - everything else is split into sentences at `[.!?]` followed by whitespace
 *    and an uppercase letter / digit / quote / bracket, so decimals (94.2),
 *    abbreviations (obr. 4.2, kap. 3.1.4, e.g.) and p<0.05 are preserved.
 *  - paragraph breaks (blank lines) are always boundaries.
 *
 * Unlike the previous regex-match approach, this is a *partition*: joining
 * the returned units reproduces the input text (minus surrounding whitespace).
 */
export function splitIntoAtomicUnits(text: string): string[] {
  const units: string[] = []
  const paragraphs = text.split(/\n{2,}/)
  for (const para of paragraphs) {
    const trimmedPara = para.trim()
    if (!trimmedPara) continue
    const lines = trimmedPara.split("\n")
    let i = 0
    let prose: string[] = []
    const flushProse = () => {
      if (prose.length === 0) return
      const block = prose.join("\n")
      prose = []
      units.push(...splitProseIntoSentences(block))
    }
    while (i < lines.length) {
      const line = lines[i]
      if (/^\s*\|.*\|\s*$/.test(line)) {
        flushProse()
        const tbl: string[] = []
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) tbl.push(lines[i++])
        units.push(tbl.join("\n"))
        continue
      }
      if (/^\s*\$\$/.test(line)) {
        flushProse()
        const eq: string[] = [line]
        // single-line `$$ … $$` or multi-line block
        const singleLine = /^\s*\$\$.*\$\$\s*$/.test(line) && line.trim().length > 4
        i++
        if (!singleLine) {
          while (i < lines.length) {
            eq.push(lines[i])
            if (/\$\$\s*$/.test(lines[i])) { i++; break }
            i++
          }
        }
        units.push(eq.join("\n"))
        continue
      }
      prose.push(line)
      i++
    }
    flushProse()
  }
  return units
}

const ABBREVIATIONS = new Set([
  "napr", "t.j", "tj", "resp", "atď", "atd", "spol", "č", "c", "obr", "tab", "kap", "rov", "str", "s", "p", "pp",
  "e.g", "i.e", "al", "fig", "eq", "sec", "vs", "cf", "approx", "vol", "no", "dr", "prof", "ing", "mgr", "phd",
  "mr", "mrs", "ms", "tzv", "príp", "pozn", "odst", "ods", "písm", "zv", "vyd", "roč",
])

function splitProseIntoSentences(block: string): string[] {
  // Split only at sentence-final punctuation followed by whitespace and a
  // sentence-start-looking character; never after a known abbreviation.
  const out: string[] = []
  const re = /(?<=[.!?…]["')\]]?)\s+(?=["'(\[]?[A-ZÀ-ŽА-Я0-9])/gu
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(block)) !== null) {
    const before = block.slice(last, m.index)
    const lastWord = (before.match(/([\p{L}.]+)[.!?…]["')\]]?$/u)?.[1] ?? "").toLowerCase().replace(/\.$/, "")
    const nextChar = block[m.index + m[0].length] ?? ""
    const isAbbrev = ABBREVIATIONS.has(lastWord)
    // "obr. 4.2", "kap. 3", "s. 12" — short lowercase token followed by a digit
    const shortTokenBeforeDigit = /^[0-9]/.test(nextChar) && lastWord.length <= 4 && /^\p{Ll}/u.test(lastWord)
    if (isAbbrev || shortTokenBeforeDigit) continue
    out.push(block.slice(last, m.index))
    last = m.index + m[0].length
  }
  out.push(block.slice(last))
  return out.map((s) => s.trim()).filter((s) => s.length > 0)
}

/** Hard-split an oversized unit (no boundaries available) with overlap. */
function hardSplit(unit: string, maxChars: number, overlapChars: number): string[] {
  const out: string[] = []
  let pos = 0
  while (pos < unit.length) {
    out.push(unit.slice(pos, pos + maxChars))
    if (pos + maxChars >= unit.length) break
    pos += Math.max(1, maxChars - overlapChars)
  }
  return out
}

/**
 * Splits text that exceeds maxChars into overlapping subchunks while respecting
 * sentence, paragraph, table and equation boundaries. Guarantees no content is
 * dropped: every character of the input appears in at least one subchunk.
 */
export function splitIntoSubchunks(
  text: string,
  maxChars: number,
  overlapChars: number
): string[] {
  if (text.length <= maxChars) return [text]

  const units = splitIntoAtomicUnits(text)
  if (units.length === 0) return [text]

  const subchunks: string[] = []
  let buffer: string[] = []
  let bufferLen = 0

  const flush = () => {
    if (buffer.length === 0) return
    subchunks.push(buffer.join("\n"))
    // Carry over trailing units as overlap for the next subchunk
    const overlapBuffer: string[] = []
    let overlapLen = 0
    for (let i = buffer.length - 1; i >= 0; i--) {
      if (overlapLen + buffer[i].length + 1 > overlapChars) break
      overlapBuffer.unshift(buffer[i])
      overlapLen += buffer[i].length + 1
    }
    buffer = overlapBuffer
    bufferLen = overlapLen
  }

  for (const unit of units) {
    if (unit.length > maxChars) {
      // Oversized atomic unit (giant table / equation / unbroken text).
      // Structural blocks (tables, $$ … $$ math) are NEVER hard-split mid-block:
      // an equation cut in half produces LaTeX garbage and a table split loses
      // its header row. They are passed through whole even when oversized;
      // only unbroken prose is hard-split.
      flush()
      if (/^\s*\|.*\|\s*$/m.test(unit) || /\$\$/.test(unit)) {
        subchunks.push(unit)
      } else {
        subchunks.push(...hardSplit(unit, maxChars, overlapChars))
      }
      buffer = []
      bufferLen = 0
      continue
    }
    if (bufferLen + unit.length + 1 > maxChars && buffer.length > 0) {
      flush()
      // If the overlap alone leaves no room, drop the overlap
      if (bufferLen + unit.length + 1 > maxChars) { buffer = []; bufferLen = 0 }
    }
    buffer.push(unit)
    bufferLen += unit.length + 1
  }
  if (buffer.length > 0) {
    // Avoid emitting a trailing subchunk that is *only* overlap
    const joined = buffer.join("\n")
    if (subchunks.length === 0 || !subchunks[subchunks.length - 1].endsWith(joined)) {
      subchunks.push(joined)
    }
  }

  return subchunks
}


// ---------------------------------------------------------------------------
// Structure-aware segmentation
// ---------------------------------------------------------------------------

/**
 * Partitions a section's Markdown text into typed segments:
 *  - `table`         — consecutive pipe rows (kept whole, including the `|---|`
 *                      separator; tables are NEVER split across chunks).
 *  - `equation`      — `$$ … $$` display-math blocks, single-line or spanning
 *                      multiple lines (never split inside).
 *  - `figure_caption`— a MinerU/standard caption line (Obr. 1 … / Figure 2 … /
 *                      Tab. 3 …) together with its immediately following
 *                      non-caption text line (caption continuation/context).
 *  - `prose`         — everything else (paragraphs, lists, headings are already
 *                      stripped by the chunker before this stage).
 *
 * The segments are a partition of the *non-empty* input: joining segments in
 * order with single "\n" reproduces the original (whitespace-trimmed) text.
 */
export function splitIntoStructuralSegments(text: string): StructuralSegment[] {
  const segments: StructuralSegment[] = []
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  let prose: string[] = []

  const flushProse = () => {
    const block = prose.join("\n").trim()
    if (block) segments.push({ kind: "prose", text: block })
    prose = []
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // Blank line → prose paragraph boundary
    if (!trimmed) {
      i++
      continue
    }

    // --- Markdown table: a run of consecutive pipe rows (separator optional) ---
    if (isTableLine(line)) {
      flushProse()
      const tableLines: string[] = [line]
      i++
      while (i < lines.length && (isTableLine(lines[i]) || isTableSeparatorLine(lines[i]))) {
        tableLines.push(lines[i])
        i++
      }
      // Only treat it as a table if it has a data row + something that looks
      // like a separator or ≥2 rows; a single stray `|foo|` line stays prose.
      if (tableLines.length >= 2 || tableLines.some(isTableSeparatorLine)) {
        segments.push({ kind: "table", text: tableLines.join("\n").trim() })
      } else {
        prose.push(...tableLines)
      }
      continue
    }

    // --- Display equation: $$ … $$ (single- or multi-line; never split) ---
    if (isDisplayMathStart(line)) {
      flushProse()
      const singleLine = /^.*\$\$.*\$\$\s*$/.test(line) && line.trim().length > 4
      if (singleLine) {
        segments.push({ kind: "equation", text: line.trim() })
        i++
        continue
      }
      const eqLines: string[] = [line]
      i++
      while (i < lines.length) {
        eqLines.push(lines[i])
        if (isDisplayMathEnd(lines[i])) {
          i++
          break
        }
        i++
      }
      segments.push({ kind: "equation", text: eqLines.join("\n").trim() })
      continue
    }

    // --- Figure / table caption line: keep with one following text line ---
    if (FIGURE_CAPTION_LINE_RE.test(line)) {
      flushProse()
      const captionLines: string[] = [line]
      i++
      // Continuation of a wrapped caption: next non-structural, non-blank line
      if (i < lines.length) {
        const next = lines[i].trim()
        if (next && !isTableLine(lines[i]) && !isDisplayMathStart(lines[i]) && !FIGURE_CAPTION_LINE_RE.test(lines[i])) {
          captionLines.push(lines[i])
          i++
        }
      }
      segments.push({ kind: "figure_caption", text: captionLines.join("\n").trim() })
      continue
    }

    prose.push(line)
    i++
  }
  flushProse()
  return segments
}

/**
 * Table embedding text: `heading + column names + row text`.
 *
 * Embedding raw pipe rows leaves the model spending its 512-token window on
 * `|---|---|` scaffolding. Instead we flatten the table into a compact
 * "columns: A, B, C. Rows: A=1, B=2 …" form that matches how natural-language
 * queries ("what accuracy did the model achieve?") land in vector space.
 * The original Markdown is still stored as chunk content for display.
 */
export function buildTableEmbeddingText(markdownTable: string, heading: string | null): string {
  const rows = markdownTable
    .split("\n")
    .filter((l) => isTableLine(l))
    .map((l) =>
      l
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.trim())
        .filter((c) => c.length > 0)
    )
    .filter((cells) => !(cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c))))

  if (rows.length === 0) return heading ? `${heading}: ${markdownTable.slice(0, 800)}` : markdownTable.slice(0, 800)

  const header = rows[0]
  const dataRows = rows.slice(1)
  const parts: string[] = []
  if (heading) parts.push(heading)
  parts.push(`Columns: ${header.join(", ")}`)
  const flattenedRows = dataRows
    .slice(0, 12)
    .map((cells) =>
      cells
        .map((cell, idx) => (header[idx] ? `${header[idx]} = ${cell}` : cell))
        .join(", ")
    )
  parts.push(`Rows: ${flattenedRows.join("; ")}`)
  return parts.join(". ").slice(0, 1200)
}
