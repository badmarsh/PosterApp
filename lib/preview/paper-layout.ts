/**
 * Live paper canvas — layout engine.
 *
 * The paper editor used to show a linear list of cards ("Paper sections") that
 * told the user nothing about what the compiled PDF would look like: no pages,
 * no columns, no float placement, no page count. This module is the typesetting
 * half of the live canvas: it turns the active output's cards into an ordered
 * stream of *paper blocks* (title, abstract, headings, paragraphs, bullets,
 * equations, figures, tables, references) and flows that stream into a real
 * paginated, multi-column layout.
 *
 * Design constraints:
 *
 *  1. **Deterministic and DOM-free.** Everything here is pure so it can be unit
 *     tested with a synthetic `measure` function. The React component supplies
 *     real measurements from a hidden probe pass (`measureBlock`), but the
 *     engine never touches the DOM itself.
 *  2. **Honest about what it does not know.** Text height depends on the font
 *     that actually renders. The engine therefore asks for a measurement
 *     function and falls back to a documented character-count estimate when the
 *     DOM is unavailable (SSR, tests, first paint).
 *  3. **Splittable content.** A paper column is filled to the last line:
 *     paragraphs are split at sentence boundaries, bullet lists at item
 *     boundaries and tables at row boundaries (with the header repeated on the
 *     continuation). Atomic blocks (figures, equations) move to the next column
 *     instead of being cut in half.
 */

import type { BibEntry } from "@/lib/bib-types"
import type { Card, OutputConfig } from "@/lib/poster-types"

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** Print geometry of one paper template, in millimetres. */
export type PaperGeometry = {
  /** Stable id — `A4-2col`, `letter-1col`, … shown in the canvas chrome. */
  id: string
  label: string
  pageWidthMm: number
  pageHeightMm: number
  marginTopMm: number
  marginBottomMm: number
  marginLeftMm: number
  marginRightMm: number
  columns: 1 | 2
  columnGutterMm: number
  /** Body font size in points; drives the typographic scale on screen. */
  baseFontPt: number
  /** Serif for journal classes, sans for the IEEE-ish ones. */
  family: "serif" | "sans"
}

const A4 = { pageWidthMm: 210, pageHeightMm: 297 }
const LETTER = { pageWidthMm: 215.9, pageHeightMm: 279.4 }

function geometry(
  id: string,
  page: typeof A4,
  columns: 1 | 2,
  baseFontPt: number,
  family: "serif" | "sans",
  margins: Partial<Pick<PaperGeometry, "marginTopMm" | "marginBottomMm" | "marginLeftMm" | "marginRightMm" | "columnGutterMm">> = {},
): PaperGeometry {
  const marginTopMm = margins.marginTopMm ?? (columns === 2 ? 19 : 25)
  const marginBottomMm = margins.marginBottomMm ?? (columns === 2 ? 25 : 25)
  const marginLeftMm = margins.marginLeftMm ?? (columns === 2 ? 16 : 25)
  const marginRightMm = margins.marginRightMm ?? (columns === 2 ? 16 : 25)
  return {
    id,
    label: `${page === A4 ? "A4" : "Letter"} · ${columns === 1 ? "single column" : "two columns"}`,
    ...page,
    marginTopMm,
    marginBottomMm,
    marginLeftMm,
    marginRightMm,
    columns,
    columnGutterMm: margins.columnGutterMm ?? 7,
    baseFontPt,
    family,
  }
}

/**
 * Per-template page geometry.
 *
 * Mirrors the `\documentclass` line each template emits in
 * `lib/latex/templates.ts`: `article` variants are A4 11pt, the US venue styles
 * (IEEEtran, acmart, REVTeX reprint, NeurIPS/ICML/ICLR/CVPR/ACL/AAAI) are US
 * Letter, and the two-column set matches `SINGLE_COLUMN_TEMPLATES` in
 * `lib/latex/generator-paper.ts` — the same list the LaTeX generator uses to
 * decide whether `figure*` exists. Anything unknown falls back to A4.
 */
export const PAPER_GEOMETRY_BY_TEMPLATE: Record<string, PaperGeometry> = {
  "article-twocol": geometry("A4-2col", A4, 2, 11, "serif"),
  "article-single": geometry("A4-1col", A4, 1, 11, "serif"),
  "ieee-conf": geometry("letter-2col", LETTER, 2, 10, "serif", { marginTopMm: 19, marginBottomMm: 22 }),
  "acm-sigconf": geometry("letter-2col", LETTER, 2, 10, "serif", { marginTopMm: 20, marginBottomMm: 22 }),
  "revtex-aps": geometry("letter-2col", LETTER, 2, 10, "serif"),
  "springer-llncs": geometry("A4-1col", A4, 1, 10, "serif", { marginLeftMm: 22, marginRightMm: 22 }),
  "jinst-proceedings": geometry("A4-1col", A4, 1, 11, "serif"),
  "pos-proceedings": geometry("A4-1col", A4, 1, 11, "serif"),
  elsarticle: geometry("A4-1col", A4, 1, 12, "serif", { marginLeftMm: 22, marginRightMm: 22 }),
  "epj-woc": geometry("A4-1col", A4, 1, 10, "serif", { marginLeftMm: 22, marginRightMm: 22 }),
  iopart: geometry("A4-1col", A4, 1, 12, "serif", { marginLeftMm: 20, marginRightMm: 20 }),
  neurips: geometry("letter-1col", LETTER, 1, 10, "serif", { marginLeftMm: 14, marginRightMm: 14 }),
  icml: geometry("letter-2col", LETTER, 2, 10, "serif", { marginLeftMm: 14, marginRightMm: 14, columnGutterMm: 6 }),
  iclr: geometry("letter-1col", LETTER, 1, 10, "serif"),
  acl: geometry("letter-2col", LETTER, 2, 10, "serif", { marginLeftMm: 20, marginRightMm: 20, columnGutterMm: 6 }),
  cvpr: geometry("letter-2col", LETTER, 2, 10, "serif", { marginLeftMm: 16, marginRightMm: 16 }),
  aaai: geometry("letter-2col", LETTER, 2, 10, "serif", { marginLeftMm: 16, marginRightMm: 16 }),
}

/** Page geometry for a paper template; A4 two-column for unknown ids. */
export function paperGeometryFor(templateId?: string | null): PaperGeometry {
  if (!templateId) return PAPER_GEOMETRY_BY_TEMPLATE["article-twocol"]
  return PAPER_GEOMETRY_BY_TEMPLATE[templateId] ?? PAPER_GEOMETRY_BY_TEMPLATE["article-twocol"]
}

/** CSS pixels per millimetre at the canvas' 96 dpi reference scale. */
export const PX_PER_MM = 96 / 25.4
/** CSS pixels per point. */
export const PX_PER_PT = 96 / 72

/** Width of a single text column, in px at the reference scale. */
export function columnWidthPx(g: PaperGeometry): number {
  const usable = g.pageWidthMm - g.marginLeftMm - g.marginRightMm
  const col = (usable - g.columnGutterMm * (g.columns - 1)) / g.columns
  return col * PX_PER_MM
}

/** Height available for text between the top and bottom margins, in px. */
export function columnHeightPx(g: PaperGeometry): number {
  return (g.pageHeightMm - g.marginTopMm - g.marginBottomMm) * PX_PER_MM
}

/** Page size in px at the reference scale. */
export function pageSizePx(g: PaperGeometry): { width: number; height: number } {
  return { width: g.pageWidthMm * PX_PER_MM, height: g.pageHeightMm * PX_PER_MM }
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

export type PaperBlockKind =
  | "title"
  | "abstract"
  | "heading"
  | "paragraph"
  | "bullets"
  | "equation"
  | "figure"
  | "table"
  | "references"

export type PaperBlock = {
  /** Stable identity: `${cardId}#${ordinal}` (parts add `#${part}`). */
  id: string
  cardId: string
  kind: PaperBlockKind
  /** Markdown/LaTeX-ish payload for text blocks. */
  text?: string
  /** 1 = `\section`, 2 = `\subsection`. */
  level?: 1 | 2
  /** Bullet items (already inline-markdown). */
  items?: string[]
  url?: string
  /** Second figure of a two-up float (LaTeX `minipage` pair). */
  alt?: string
  caption?: string
  rows?: string[][]
  hasHeader?: boolean
  /** Figure/table number as it will appear in the PDF. */
  number?: number
  entries?: BibEntry[]
  /** Title/abstract span both columns on the first page. */
  fullWidth?: boolean
  /** Splitting metadata (filled by the paginator). */
  split?: { part: number; of: number }
  /** True when the block continues content started in the previous column. */
  continues?: boolean
  /** A heading must not be the last thing in a column. */
  keepWithNext?: boolean
}

// ---------------------------------------------------------------------------
// Card → blocks
// ---------------------------------------------------------------------------

const BULLET_RE = /^\s*(?:[-*+]|\d+[.)])\s+/
const DISPLAY_MATH_RE = /^\s*\$\$([\s\S]*?)\$\$\s*$/

/** Split markdown into paragraph-ish chunks on blank lines. */
export function splitMarkdownBlocks(content: string): string[] {
  return content
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
}

/** True when every non-empty line of a chunk is a list item. */
export function isBulletChunk(chunk: string): boolean {
  const lines = chunk.split("\n").filter((l) => l.trim())
  return lines.length > 0 && lines.every((l) => BULLET_RE.test(l))
}

function bulletItems(chunk: string): string[] {
  return chunk
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => l.replace(BULLET_RE, "").trim())
}

/** Split a sentence into parts that keep `$…$` math and `\[…\]` intact. */
export function splitSentences(text: string): string[] {
  const out: string[] = []
  let buffer = ""
  let mathDepth = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === "$" && text[i - 1] !== "\\") mathDepth = mathDepth === 0 ? 1 : 0
    buffer += ch
    if (mathDepth === 0 && (ch === "." || ch === "!" || ch === "?") ) {
      const next = text[i + 1]
      if (next === undefined || next === " " || next === "\n") {
        out.push(buffer.trim())
        buffer = ""
        while (text[i + 1] === " ") i++
      }
    }
  }
  if (buffer.trim()) out.push(buffer.trim())
  return out.length ? out : [text]
}

export type PaperBlockSource = {
  cards: Card[]
  /** Bibliography entries used to render the reference list. */
  bibEntries?: BibEntry[]
  /** Restrict references to these cite keys (in citation order of the cards). */
  citedKeys?: string[]
}

/** Skip a card that is not a paper section (e.g. a stray figure-only card). */
function isSectionCard(card: Card): boolean {
  return card.pattern !== "references" && card.pattern !== "title-slide"
}

function isAbstractCard(card: Card): boolean {
  const title = (card.title ?? "").trim().toLowerCase()
  return (card.pattern as string) === "abstract" || title === "abstract" || title.startsWith("abstract ")
}

/**
 * Build the ordered block stream for a paper output.
 *
 * Order follows `(column, order)` like the LaTeX generator does
 * (`generator-paper.ts`), so the canvas and the PDF agree on section order.
 */
export function buildPaperBlocks({ cards, bibEntries = [], citedKeys }: PaperBlockSource): PaperBlock[] {
  const sorted = [...cards].sort((a, b) => (a.column ?? 1) - (b.column ?? 1) || a.order - b.order)
  const blocks: PaperBlock[] = []
  let figureNumber = 0
  let tableNumber = 0
  let sectionNumber = 0

  for (const card of sorted) {
    if (card.pattern === "title-slide") continue

    if (card.pattern === "references") {
      const entries = orderReferences(bibEntries, citedKeys)
      if (!entries.length) continue
      blocks.push({
        id: `${card.id}#refs`,
        cardId: card.id,
        kind: "references",
        entries,
      })
      continue
    }

    if (isAbstractCard(card)) {
      blocks.push({
        id: `${card.id}#abstract`,
        cardId: card.id,
        kind: "abstract",
        text: card.content.trim(),
        fullWidth: true,
      })
      continue
    }

    if (isSectionCard(card)) {
      sectionNumber += 1
      blocks.push({
        id: `${card.id}#heading`,
        cardId: card.id,
        kind: "heading",
        level: 1,
        number: sectionNumber,
        text: card.title.trim() || `Section ${sectionNumber}`,
        keepWithNext: true,
      })
    }

    const chunks = splitMarkdownBlocks(card.content ?? "")
    chunks.forEach((chunk, i) => {
      const displayMath = chunk.match(DISPLAY_MATH_RE)
      if (displayMath) {
        blocks.push({
          id: `${card.id}#eq${i}`,
          cardId: card.id,
          kind: "equation",
          text: displayMath[1].trim(),
        })
        return
      }
      if (isBulletChunk(chunk)) {
        blocks.push({
          id: `${card.id}#ul${i}`,
          cardId: card.id,
          kind: "bullets",
          items: bulletItems(chunk),
        })
        return
      }
      blocks.push({
        id: `${card.id}#p${i}`,
        cardId: card.id,
        kind: "paragraph",
        text: chunk,
      })
    })

    const showsFigures =
      card.pattern === "section-figure" ||
      card.pattern === "section-two-figures" ||
      card.pattern === "bullets-image" ||
      card.pattern === "bullets-two-images" ||
      card.pattern === "image-focused" ||
      card.pattern === "figure-slide" ||
      card.pattern === "graph"

    if (showsFigures) {
      const figs = (card.figures ?? []).filter((f) => f?.url?.trim())
      // Two figures on one card are floated side by side in the PDF; the canvas
      // models the same two-up row as a single block so heights agree.
      if (figs.length >= 2) {
        figureNumber += 1
        blocks.push({
          id: `${card.id}#fig`,
          cardId: card.id,
          kind: "figure",
          url: figs[0].url,
          alt: figs[1].url,
          caption: joinCaptions(figs.map((f) => f.caption)),
          number: figureNumber,
        })
      } else if (figs.length === 1) {
        figureNumber += 1
        blocks.push({
          id: `${card.id}#fig`,
          cardId: card.id,
          kind: "figure",
          url: figs[0].url,
          caption: figs[0].caption,
          number: figureNumber,
        })
      }
    }

    const showsTable =
      (card.pattern === "section-table" || card.pattern === "bullets-table") &&
      Array.isArray(card.table?.rows) &&
      card.table.rows.length > 0

    if (showsTable) {
      tableNumber += 1
      const rows = card.table.rows
      const hasHeader = Boolean(card.table.hasHeader && rows.length > 1)
      blocks.push({
        id: `${card.id}#tbl`,
        cardId: card.id,
        kind: "table",
        rows,
        hasHeader,
        caption: card.table.caption,
        number: tableNumber,
      })
    }
  }

  return blocks
}

function joinCaptions(captions: string[]): string {
  const clean = captions.map((c) => (c ?? "").trim()).filter(Boolean)
  if (!clean.length) return ""
  if (clean.length === 1) return clean[0]
  return `${clean[0]} · ${clean.slice(1).join(" · ")}`
}

/**
 * Reference list in citation order.
 *
 * `\nocite{...}` in the generated LaTeX prints exactly the cited keys in
 * bibliography order; the canvas matches that instead of dumping the whole
 * `.bib` (which would overstate the printed page count).
 */
export function orderReferences(entries: BibEntry[], citedKeys?: string[]): BibEntry[] {
  if (!citedKeys || citedKeys.length === 0) return [...entries]
  const byKey = new Map(entries.map((e) => [e.id, e]))
  const out: BibEntry[] = []
  const seen = new Set<string>()
  for (const key of citedKeys) {
    const entry = byKey.get(key)
    if (entry && !seen.has(key)) {
      out.push(entry)
      seen.add(key)
    }
  }
  // Entries cited by the prose but missing from the list still belong in the
  // render so the count lines up with `\nocite{*}` / unknown-key behaviour.
  return out.length ? out : [...entries]
}

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

/**
 * Height of a block in px at the reference scale. The React canvas passes a
 * function backed by real DOM measurements; tests (and the very first paint)
 * use {@link estimateBlockHeight}.
 */
export type MeasureBlock = (block: PaperBlock) => number

export type TextMetrics = {
  /** Average glyph width as a fraction of the font size. */
  glyphWidthRatio: number
  /** Line height as a multiple of the font size. */
  lineHeightRatio: number
}

export const DEFAULT_TEXT_METRICS: TextMetrics = { glyphWidthRatio: 0.5, lineHeightRatio: 1.35 }

function charsPerLine(g: PaperGeometry, metrics: TextMetrics, widthPx: number, fontPt: number): number {
  const fontPx = fontPt * PX_PER_PT
  return Math.max(18, Math.floor(widthPx / (metrics.glyphWidthRatio * fontPx)))
}

function estimateTextHeight(
  text: string,
  g: PaperGeometry,
  metrics: TextMetrics,
  opts: { fontPt: number; widthPx: number; spaceBeforePx?: number },
): number {
  const cpl = charsPerLine(g, metrics, opts.widthPx, opts.fontPt)
  const wordsPerLine = Math.max(4, Math.floor(cpl / 6))
  const words = text.split(/\s+/).filter(Boolean).length
  const explicitLines = text.split("\n").length
  const lines = Math.max(1, Math.ceil(words / wordsPerLine), explicitLines)
  const linePx = opts.fontPt * PX_PER_PT * metrics.lineHeightRatio
  return lines * linePx + (opts.spaceBeforePx ?? 0)
}

/** Deterministic fallback used before (or without) DOM measurement. */
export function estimateBlockHeight(block: PaperBlock, g: PaperGeometry, metrics: TextMetrics = DEFAULT_TEXT_METRICS): number {
  const width = columnWidthPx(g) || 1
  const bodyPt = g.baseFontPt
  switch (block.kind) {
    case "title":
      return 120
    case "abstract":
      return (
        estimateTextHeight(block.text ?? "", g, metrics, { fontPt: bodyPt * 0.95, widthPx: width * 0.8, spaceBeforePx: 26 }) + 18
      )
    case "heading":
      return (block.level === 1 ? 34 : 28)
    case "paragraph":
      return estimateTextHeight(block.text ?? "", g, metrics, { fontPt: bodyPt, widthPx: width }) + 8
    case "bullets":
      return (
        (block.items ?? []).reduce(
          (sum, item) => sum + estimateTextHeight(item, g, metrics, { fontPt: bodyPt, widthPx: width - 14 }) + 4,
          10,
        ) + 4
      )
    case "equation":
      return 46
    case "figure": {
      const twoUp = Boolean(block.alt)
      const height = twoUp ? width * 0.42 : width * 0.68
      return height + 34
    }
    case "table": {
      const rows = block.rows?.length ?? 0
      const cols = block.rows?.[0]?.length ?? 1
      const rowsWrapped = (block.rows ?? []).reduce((sum, row) => {
        const longest = row.reduce((m, c) => Math.max(m, c.length), 0)
        return sum + Math.max(1, Math.ceil(longest / Math.max(8, Math.floor(columnWidthPx(g) / (cols * 5.2)))))
      }, 0)
      return (Math.max(rows, rowsWrapped) * 16) + 44
    }
    case "references":
      return ((block.entries ?? []).length * 26) + 30
  }
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export type PaperPlacement = {
  block: PaperBlock
  height: number
}

export type PaperColumnPlan = {
  index: number
  side: "left" | "right"
  placements: PaperPlacement[]
  usedHeight: number
  capacity: number
  /** 0…1 — how full the column is. */
  fill: number
}

export type PaperPagePlan = {
  index: number
  columns: PaperColumnPlan[]
}

export type PaperPaginationOptions = {
  /**
   * Height (px) consumed at the top of page 1 by a full-width title band
   * (`\maketitle` + abstract). Page 1 columns are shorter by this amount, which
   * is exactly how a real two-column paper class lays out its first page.
   */
  firstPageInset?: number
  /** Depth limit for splitting a block across columns. */
  maxSplitParts?: number
}

export type PaperPlan = {
  pages: PaperPagePlan[]
  /** Blocks that could not be placed at all (should never happen: they land on a fresh page). */
  unplaced: PaperBlock[]
  /** Total pages in the plan. */
  pageCount: number
  /** Reference index assigned per block id (figures/tables are numbered in `buildPaperBlocks`). */
  geometry: PaperGeometry
}

function emptyColumn(index: number, side: "left" | "right", capacity: number): PaperColumnPlan {
  return { index, side, placements: [], usedHeight: 0, capacity, fill: 0 }
}

/**
 * Split a block into a head and a tail that can flow into the next column.
 * Returns `null` for atomic blocks, and forces progress (never returns an empty
 * head) so pagination cannot loop forever.
 */
export function splitPaperBlock(block: PaperBlock, measure: MeasureBlock): [PaperBlock, PaperBlock] | null {
  const withSplit = (part: number, of: number, patch: Partial<PaperBlock>): PaperBlock => ({
    ...block,
    ...patch,
    id: `${block.id.split("~part")[0]}~part${part}of${of}`,
  })

  if (block.kind === "paragraph") {
    const sentences = splitSentences(block.text ?? "")
    // Two sentences is enough to split *as long as* each part is a real
    // sentence, which also guarantees termination: a one-sentence part cannot
    // be split again.
    if (sentences.length >= 2 && sentences.every((s) => s.trim().length >= 12)) {
      const half = Math.max(1, Math.ceil(sentences.length / 2))
      const headText = sentences.slice(0, half).join(" ")
      const tailText = sentences.slice(half).join(" ")
      const head = withSplit(1, 2, { text: headText, split: { part: 1, of: 2 } })
      const tail = withSplit(2, 2, { text: tailText, split: { part: 2, of: 2 }, continues: true })
      if (measure(tail) <= 0) return null
      return [head, tail]
    }
  }

  if (block.kind === "bullets" && (block.items ?? []).length > 1) {
    const items = block.items ?? []
    const half = Math.max(1, Math.ceil(items.length / 2))
    const head = withSplit(1, 2, { items: items.slice(0, half), split: { part: 1, of: 2 } })
    const tail = withSplit(2, 2, {
      items: items.slice(half),
      split: { part: 2, of: 2 },
      continues: true,
    })
    return [head, tail]
  }

  if (block.kind === "table" && (block.rows ?? []).length > 2) {
    const rows = block.rows ?? []
    const header = block.hasHeader ? rows[0] : null
    const body = block.hasHeader ? rows.slice(1) : rows
    if (body.length > 1) {
      const half = Math.max(1, Math.ceil(body.length / 2))
      const headRows = header ? [header, ...body.slice(0, half)] : body.slice(0, half)
      const tailRows = header ? [header, ...body.slice(half)] : body.slice(half)
      const head = withSplit(1, 2, { rows: headRows, split: { part: 1, of: 2 } })
      const tail = withSplit(2, 2, {
        rows: tailRows,
        split: { part: 2, of: 2 },
        continues: true,
        caption: undefined,
      })
      return [head, tail]
    }
  }

  if (block.kind === "references" && (block.entries ?? []).length > 1) {
    const entries = block.entries ?? []
    const half = Math.max(1, Math.ceil(entries.length / 2))
    const head = withSplit(1, 2, { entries: entries.slice(0, half), split: { part: 1, of: 2 } })
    const tail = withSplit(2, 2, {
      entries: entries.slice(half),
      split: { part: 2, of: 2 },
      continues: true,
    })
    return [head, tail]
  }

  return null
}

/**
 * Flow blocks into pages and columns.
 *
 * Every column is filled to the last line: when a block overflows, the paginator
 * tries to split it (see {@link splitPaperBlock}); if it cannot, the block moves
 * whole to the next column. Headings never end a column alone (`keepWithNext`).
 */
export function paginatePaper(
  blocks: PaperBlock[],
  measure: MeasureBlock,
  g: PaperGeometry,
  options: PaperPaginationOptions = {},
): PaperPlan {
  const baseCapacity = columnHeightPx(g)
  const maxSplitParts = options.maxSplitParts ?? 4
  const firstPageInset = options.firstPageInset ?? 0

  const pages: PaperPagePlan[] = []
  const batch: PaperBlock[] = [...blocks]

  const capacityForPage = (pageIndex: number) => (pageIndex === 0 ? baseCapacity - firstPageInset : baseCapacity)

  const newPage = (): PaperPagePlan => {
    const capacity = capacityForPage(pages.length)
    const page: PaperPagePlan = {
      index: pages.length + 1,
      columns: [emptyColumn(0, "left", capacity)],
    }
    if (g.columns === 2) page.columns.push(emptyColumn(1, "right", capacity))
    pages.push(page)
    return page
  }

  let page = newPage()
  let columnIndex = 0
  let column = page.columns[columnIndex]

  const advanceColumn = () => {
    if (page.columns.length === 1) {
      page = newPage()
      columnIndex = 0
      column = page.columns[0]
      return
    }
    if (columnIndex === 0) {
      columnIndex = 1
      column = page.columns[1]
      return
    }
    page = newPage()
    columnIndex = 0
    column = page.columns[0]
  }

  const place = (block: PaperBlock, height: number) => {
    column.placements.push({ block, height })
    column.usedHeight += height
    column.fill = Math.min(1.5, column.usedHeight / Math.max(1, column.capacity))
  }

  const fits = (height: number) => column.usedHeight + height <= column.capacity + 1

  const unplaced: PaperBlock[] = []

  /**
   * Place the title block(s) and then every block in order, filling each
   * column to the last line. The queue is mutated in place; the head of the
   * queue is only shifted when it has actually been placed, so an over-tall
   * block is retried in the next column instead of being dropped.
   */
  const flush = (items: PaperBlock[]) => {
    const queue: { block: PaperBlock; part: number }[] = items.map((block) => ({ block, part: 0 }))
    let guard = 0
    while (queue.length) {
      if (guard++ > 20_000) break
      const { block, part } = queue[0]
      const height = measure(block)

      if (fits(height)) {
        // Widow control: a section heading must not be the last thing in a
        // column when content follows — push it to the next column instead.
        const next = queue[1]?.block
        if (block.keepWithNext && next && column.usedHeight > 0) {
          const minFollow = Math.min(measure(next), column.capacity * 0.18)
          if (!fits(height + minFollow)) {
            advanceColumn()
            continue
          }
        }
        queue.shift()
        place(block, height)
        continue
      }

      const split = part < maxSplitParts ? splitPaperBlock(block, measure) : null
      if (split) {
        const [head, tail] = split
        const headHeight = measure(head)
        const tailHeight = measure(tail)
        // Progress guarantees: the head must be smaller than the whole block
        // and both parts must have real height, otherwise we move the block.
        if (headHeight > 0 && tailHeight > 0 && headHeight < height) {
          if (!fits(headHeight)) {
            if (column.usedHeight > 0) {
              advanceColumn()
              continue
            }
            // Even an empty column cannot hold the head — fall through and let
            // the atomic path below move or overflow it.
          } else {
            queue.shift()
            place(head, headHeight)
            queue.unshift({ block: tail, part: part + 1 })
            continue
          }
        }
      }

      if (column.usedHeight > 0) {
        advanceColumn()
        continue
      }

      // Empty column and the block still does not fit: a single block taller
      // than a whole column (huge figure / long table). Place it anyway and let
      // it visually spill, flagged for the user rather than silently dropped.
      queue.shift()
      place(block, height)
      if (height > column.capacity) unplaced.push(block)
    }
  }

  flush(batch)
  return { pages, unplaced, pageCount: pages.length, geometry: g }
}

/**
 * Convenience wrapper: build blocks from an output and paginate them.
 * Used by the canvas and by tests.
 */
export function planPaper(
  output: OutputConfig,
  opts: {
    measure?: MeasureBlock
    bibEntries?: BibEntry[]
    citedKeys?: string[]
    geometry?: PaperGeometry
    /** Height of the full-width title band, already measured where possible. */
    titleHeight?: number
  } = {},
): PaperPlan {
  const g = opts.geometry ?? paperGeometryFor(output.templateId)
  const blocks = buildPaperBlocks({ cards: output.cards, bibEntries: opts.bibEntries, citedKeys: opts.citedKeys })
  const measure = opts.measure ?? ((block: PaperBlock) => estimateBlockHeight(block, g))
  const titleHeight = opts.titleHeight ?? estimateBlockHeight({ id: "__title__", cardId: "__title__", kind: "title" }, g)
  return paginatePaper(blocks, measure, g, { firstPageInset: titleHeight })
}

/** Summary used by the canvas chrome: page count and the emptiest column. */
export function summarizePlan(plan: PaperPlan): {
  pageCount: number
  blockCount: number
  figureCount: number
  tableCount: number
  referenceCount: number
  /** 0…1, mean fill of all columns except the last page's trailing ones. */
  averageFill: number
} {
  let blocks = 0
  let figures = 0
  let tables = 0
  let references = 0
  const fills: number[] = []
  for (const page of plan.pages) {
    for (const column of page.columns) {
      if (column.placements.length) fills.push(Math.min(1, column.fill))
      for (const p of column.placements) {
        blocks += 1
        if (p.block.kind === "figure") figures += 1
        if (p.block.kind === "table") tables += 1
        if (p.block.kind === "references") references += (p.block.entries ?? []).length
      }
    }
  }
  const averageFill = fills.length ? fills.reduce((a, b) => a + b, 0) / fills.length : 0
  return { pageCount: plan.pageCount, blockCount: blocks, figureCount: figures, tableCount: tables, referenceCount: references, averageFill }
}
