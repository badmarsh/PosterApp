import type { Card, ColumnIndex } from "@/lib/poster-types"

/**
 * Default column height budget, in the arbitrary "units" produced by
 * estimateHeight. Calibrated against the 3-column A0 *portrait* tikzposter
 * templates (atlas / minimal / tikzposter / gemini / a0poster).
 */
export const COLUMN_BUDGET = 1250

/**
 * Per-template column budgets.
 *
 * estimateHeight's units are proportional to *lines of text*, so a budget is
 * really "how many lines fit in one column". That depends on two things the
 * template fixes: how tall the column is, and how wide (wider columns fit
 * more characters per line, so the same text costs fewer lines).
 *
 * A0 portrait is 841mm x 1189mm; A0 landscape is 1189mm x 841mm. A landscape
 * column is therefore ~29% shorter but ~41% wider. Shorter cuts the budget;
 * wider means each unit of content is cheaper. The net is roughly
 * 1250 * (841/1189) * (1189/841) ≈ 1250 in theory — but the title block and
 * inter-block spacing do not scale, and in practice landscape boards hold
 * noticeably less per column, hence 700.
 *
 * NOTE: these are *structural estimates*, not measurements. The previous
 * single constant was equally unmeasured but could not even express the
 * difference. Calibrating them against real compiled PDFs is tracked as
 * B-05 in docs/audit/latex-audit-2026-09.md.
 */
export const COLUMN_BUDGET_BY_TEMPLATE: Record<string, number> = {
  // 3-column A0 portrait (the original calibration target)
  atlas: 1250,
  minimal: 1250,
  tikzposter: 1250,
  gemini: 1250,
  conference: 1250,
  // Aurora is A0 portrait with the same three-column geometry as the others;
  // its square-cornered, outline-free cards have marginally less chrome, but
  // not enough to justify a separate (unmeasured) number.
  aurora: 1250,
  // a0poster uses multicols at a smaller base font, so more fits per column
  a0poster: 1380,
  // A0 landscape: shorter columns
  landscape: 970,
  // Better Poster: the narrow flanking columns are the constraint, and the
  // centre column is meant to hold ONE sentence in very large type.
  betterposter: 720,
}

/**
 * Column budget for a template. Falls back to the portrait default for
 * unknown ids so callers that do not know the template keep working.
 */
export function columnBudgetFor(templateId?: string | null): number {
  if (!templateId) return COLUMN_BUDGET
  return COLUMN_BUDGET_BY_TEMPLATE[templateId] ?? COLUMN_BUDGET
}

/**
 * Per-part breakdown of a card's estimated height.
 *
 * The scalar total is what validation compares against the budget, but the
 * parts are what make the warning actionable: knowing a card is 140u over is
 * far less useful than knowing 620u of it is prose and 260u is a figure.
 * See "Genius idea" in docs/audit/latex-audit-2026-09.md.
 */
export interface HeightBreakdown {
  total: number
  chrome: number
  prose: number
  bullets: number
  table: number
  figures: number
}

/** Height cost of a single bullet, beyond its text. */
const BULLET_UNIT = 10
/** Height cost of a single table row. */
const TABLE_ROW_UNIT = 26

export function estimateHeightBreakdown(card: Card): HeightBreakdown {
  // Pattern containers such as Beamer columns have measurable overhead even
  // when their textual contents are empty. Keep this in `chrome` so all
  // existing consumers continue to receive a stable breakdown shape.
  let chrome = 70 // title + block chrome
  if (card.pattern === "two-column") chrome += 20
  if (card.pattern === "title-slide") chrome += 30

  if (card.pattern === "stats" || card.pattern === "metric-card") {
    // The metric hero itself costs ~120u. The poster generator ALSO renders
    // an optional table and optional figures for this pattern — the previous
    // fixed estimate ignored both, so a stats card carrying a big table could
    // overflow a column without a single over-budget warning.
    const metricHero = 120
    let table = 0
    const tableRows = Array.isArray(card.table?.rows) ? card.table.rows.length : 0
    if (tableRows > 0) table = 30 + tableRows * TABLE_ROW_UNIT
    const figureCount = (card.figures ?? []).filter((f) => Boolean(f?.url?.trim())).length
    const figures = figureCount >= 2 ? 150 : figureCount === 1 ? 190 : 0
    return {
      total: chrome + metricHero + table + figures,
      chrome,
      prose: 0,
      bullets: 0,
      table,
      figures: metricHero + figures,
    }
  }

  if (card.pattern === "references") {
    return { total: chrome + 150, chrome, prose: 0, bullets: 0, table: 0, figures: 150 }
  }

  const content = typeof card.content === "string" ? card.content : ""
  const prose = Math.floor(content.length / 60) * 14
  const bulletCount = (content.match(/^[-*]\s/gm) || []).length
  const bullets = bulletCount * BULLET_UNIT

  let table = 0
  if (card.pattern === "bullets-table" || card.pattern === "section-table") {
    table = 30 + (Array.isArray(card.table?.rows) ? card.table.rows.length : 0) * TABLE_ROW_UNIT
  }

  // Charge for figures the generator will actually emit. Two side-by-side
  // images share one row of height (150u), they must not be stacked as 2×190.
  // Missing/empty URLs render as a `% no figures` comment, so they cost 0.
  const validFigCount = (card.figures ?? []).filter((f) => Boolean(f?.url?.trim())).length
  const rendersFigures =
    card.pattern === "bullets-image" ||
    card.pattern === "bullets-two-images" ||
    card.pattern === "section-figure" ||
    card.pattern === "section-two-figures" ||
    card.pattern === "figure-slide" ||
    card.pattern === "image-focused" ||
    card.pattern === "graph"
  let figures = 0
  if (rendersFigures && validFigCount > 0) {
    const twoUp =
      validFigCount >= 2 ||
      card.pattern === "bullets-two-images" ||
      card.pattern === "section-two-figures"
    if (twoUp && validFigCount >= 2) {
      figures = 150
    } else {
      figures = card.pattern === "image-focused" || card.pattern === "figure-slide" ? 260 : 190
    }
  }

  return {
    total: chrome + prose + bullets + table + figures,
    chrome,
    prose,
    bullets,
    table,
    figures,
  }
}

export function estimateHeight(card: Card): number {
  return estimateHeightBreakdown(card).total
}

/**
 * Concrete, self-consistent suggestions for bringing an over-budget card back
 * under. Every number here comes from the same model that produced the
 * overflow warning, so the advice cannot contradict the diagnosis.
 */
export function suggestReductions(card: Card, budget: number): string[] {
  const b = estimateHeightBreakdown(card)
  const excess = b.total - budget
  if (excess <= 0) return []

  const out: string[] = []
  const content = typeof card.content === "string" ? card.content : ""

  // Bullets: dropping the shortest ones is the least destructive edit.
  const bulletLines = content.split("\n").filter((l) => /^\s*[-*]\s/.test(l))
  if (bulletLines.length > 1) {
    const sorted = [...bulletLines].sort((x, y) => x.length - y.length)
    let saved = 0
    let n = 0
    for (const line of sorted) {
      if (saved >= excess) break
      saved += BULLET_UNIT + Math.floor(line.length / 60) * 14
      n++
    }
    if (n > 0 && n < bulletLines.length) {
      out.push(`drop the ${n} shortest bullet${n > 1 ? "s" : ""} (−${saved}u)`)
    }
  }

  // Figures: shrinking to two-thirds width scales the block's height.
  if (b.figures > 0) {
    const saved = Math.round(b.figures / 3)
    out.push(`shrink the figure to two-thirds width (−${saved}u)`)
  }

  // Tables: moving rows to a second card.
  if (b.table > 0) {
    const rows = Array.isArray(card.table?.rows) ? card.table.rows.length : 0
    if (rows > 2) {
      const needed = Math.min(rows - 1, Math.ceil(excess / TABLE_ROW_UNIT))
      out.push(`move ${needed} table row${needed > 1 ? "s" : ""} to a second card (−${needed * TABLE_ROW_UNIT}u)`)
    }
  }

  // Prose: last resort, and only when it actually dominates.
  if (b.prose > b.total / 2) {
    const chars = Math.ceil((excess / 14) * 60)
    out.push(`cut roughly ${chars} characters of body text (−${excess}u)`)
  }

  return out
}

export function indent(s: string, n = 2): string {
  const pad = " ".repeat(n)
  return s
    .split("\n")
    .map((l) => (l ? pad + l : l))
    .join("\n")
}

// ---------------------------------------------------------------------------
// Height-unit ↔ character budget conversion (first-pass layout budgeting)
// ---------------------------------------------------------------------------
// estimateHeight's model costs prose at 14u per ~60 characters and each bullet
// at BULLET_UNIT (10u) plus its text. The auto-fill API needs the inverse
// mapping: given a card's height budget in units, how many characters of
// bullet text may the model produce? Keeping the coefficients here — next to
// estimateHeight itself — guarantees the two directions can never diverge.

/** Height units per character of prose (inverse of 60 chars / 14u). */
export const HEIGHT_UNITS_PER_CHAR = 14 / 60
/** Characters of prose per height unit. */
export const CHARS_PER_HEIGHT_UNIT = 60 / 14

/**
 * Converts a height budget (units) minus fixed non-text costs into a maximum
 * character count for the AI text budget.
 *
 * @param budgetUnits   Total height budget for the card (units of estimateHeight).
 * @param reservedUnits Height already spent on non-text parts (figures, tables,
 *                      block chrome). Defaults to 0; pass estimateHeightBreakdown(card)
 *                      fields to exclude them from the text budget.
 * @returns Character budget; never negative.
 */
export function heightUnitsToCharacters(budgetUnits: number, reservedUnits = 0): number {
  if (!Number.isFinite(budgetUnits) || budgetUnits <= 0) return 0
  const textUnits = budgetUnits - Math.max(0, reservedUnits)
  if (textUnits <= 0) return 0
  return Math.floor(textUnits * CHARS_PER_HEIGHT_UNIT)
}

/**
 * Inverse of heightUnitsToCharacters: how many height units a character count
 * of prose text will occupy (bullet chrome NOT included — add BULLET_UNIT per
 * bullet when composing a full estimate).
 */
export function charactersToHeightUnits(chars: number): number {
  if (!Number.isFinite(chars) || chars <= 0) return 0
  return Math.ceil(chars * HEIGHT_UNITS_PER_CHAR)
}

// ---------------------------------------------------------------------------
// Poster board geometry (print truth for the live canvas and the generator)
// ---------------------------------------------------------------------------
// The preview used to be a fixed-width HTML mockup with `min-w-[720px]` and no
// relationship to the printed board: a column that looked full on screen could
// be half empty on paper. These numbers describe the physical board each
// template prints on, so the canvas can show the same proportions and the
// generator can distribute vertical space to fill it.

/** A0 in millimetres — the size every poster template prints. */
export const A0_PORTRAIT = { widthMm: 841, heightMm: 1189 }
/** A0 landscape: the board is rotated, not resized. */
export const A0_LANDSCAPE = { widthMm: 1189, heightMm: 841 }

export type PosterBoard = {
  /** Template id this board belongs to. */
  id: string
  label: string
  orientation: "portrait" | "landscape"
  widthMm: number
  heightMm: number
  /** Outer white margin the template leaves around the columns. */
  marginMm: number
  /** Height consumed by the title band (drawn by the class). */
  titleBandMm: number
  /** Column widths as fractions of the usable width; they sum to ~1. */
  columnWidths: number[]
  /** Human label shown in the canvas chrome, e.g. "A0 portrait · 3 columns". */
  description: string
}

function board(
  id: string,
  orientation: "portrait" | "landscape",
  titleBandMm: number,
  columnWidths: number[],
  marginMm = 40,
): PosterBoard {
  const page = orientation === "portrait" ? A0_PORTRAIT : A0_LANDSCAPE
  return {
    id,
    label: orientation === "portrait" ? "A0 portrait" : "A0 landscape",
    orientation,
    ...page,
    marginMm,
    titleBandMm,
    columnWidths,
    description: `${orientation === "portrait" ? "A0 portrait" : "A0 landscape"} · ${columnWidths.length} columns`,
  }
}

/**
 * Board geometry per poster template. Keep in sync with the `\documentclass`
 * options and the `\column{...}` widths in `lib/latex/templates.ts` /
 * `generator-poster.ts` (betterposter is the asymmetric 0.28/0.42/0.28 layout).
 */
export const POSTER_BOARD_BY_TEMPLATE: Record<string, PosterBoard> = {
  atlas: board("atlas", "portrait", 165, [1 / 3, 1 / 3, 1 / 3]),
  minimal: board("minimal", "portrait", 150, [1 / 3, 1 / 3, 1 / 3]),
  conference: board("conference", "portrait", 165, [1 / 3, 1 / 3, 1 / 3]),
  tikzposter: board("tikzposter", "portrait", 150, [1 / 3, 1 / 3, 1 / 3]),
  aurora: board("aurora", "portrait", 150, [1 / 3, 1 / 3, 1 / 3]),
  gemini: board("gemini", "portrait", 160, [1 / 3, 1 / 3, 1 / 3]),
  a0poster: board("a0poster", "portrait", 135, [1 / 3, 1 / 3, 1 / 3], 35),
  landscape: board("landscape", "landscape", 140, [1 / 3, 1 / 3, 1 / 3]),
  betterposter: board("betterposter", "landscape", 130, [0.28, 0.42, 0.28]),
}

/** Board geometry for a poster template; A0 portrait three-column by default. */
export function posterBoardFor(templateId?: string | null): PosterBoard {
  if (!templateId) return POSTER_BOARD_BY_TEMPLATE.atlas
  return POSTER_BOARD_BY_TEMPLATE[templateId] ?? POSTER_BOARD_BY_TEMPLATE.atlas
}

/** Usable width inside the margins, in mm. */
export function posterUsableWidthMm(b: PosterBoard): number {
  return b.widthMm - b.marginMm * 2
}

/**
 * Height of one column, in mm: the board minus margins, the title band and the
 * inter-block breathing room the class adds at the bottom.
 */
export function posterColumnHeightMm(b: PosterBoard, reserveBottomMm = 30): number {
  return Math.max(120, b.heightMm - b.marginMm * 2 - b.titleBandMm - reserveBottomMm)
}

/** Column width in mm for a given index. */
export function posterColumnWidthMm(b: PosterBoard, index: number): number {
  const gutter = 12
  const usable = posterUsableWidthMm(b) - gutter * (b.columnWidths.length - 1)
  return usable * (b.columnWidths[index] ?? 1 / 3)
}

// ---------------------------------------------------------------------------
// Column planning / balancing
// ---------------------------------------------------------------------------

export type PosterColumnPlan = {
  column: ColumnIndex
  cards: Card[]
  estimatedHeight: number
  budget: number
  /** 0…2 — 1 means exactly at budget. */
  fill: number
  /** Height still available, in units (0 when over budget). */
  headroom: number
}

export type PosterPlan = {
  board: PosterBoard
  columns: PosterColumnPlan[]
  /** Assignments keyed by card id, for `moveCard`-style application. */
  assignments: Record<string, ColumnIndex>
  /** Mean fill of the three columns, 0…2. */
  averageFill: number
  /** True when the plan moves at least one card away from its current column. */
  changes: boolean
}

/**
 * Assign cards to columns so the board is filled as evenly as possible.
 *
 * Greedy longest-processing-time: cards are placed highest-estimate-first into
 * the column with the most headroom. That is within ~11% of optimal for three
 * machines and, unlike round-robin, it respects the fact that one figure-heavy
 * card can cost as much as six bullets cards. The user's column *order* is
 * preserved inside each column: cards keep their relative sequence.
 */
export function planPosterColumns(
  cards: Card[],
  templateId?: string | null,
  opts: { columns?: number; respectCurrent?: boolean } = {},
): PosterPlan {
  const board = posterBoardFor(templateId)
  const columnCount = Math.min(3, Math.max(1, opts.columns ?? board.columnWidths.length))
  const budget = columnBudgetFor(templateId)
  const colIds = ([1, 2, 3] as ColumnIndex[]).slice(0, columnCount)

  const estimate = (card: Card) => estimateHeight(card)

  // Seed with the current columns when asked to (keeps the user in control and
  // only *tops up* empty space); otherwise start from an empty board.
  if (opts.respectCurrent) {
    const columns = colIds.map((column) => {
      const colCards = cards
        .filter((c) => c.column === column)
        .sort((a, b) => a.order - b.order)
      const estimatedHeight = colCards.reduce((sum, c) => sum + estimate(c), 0)
      return {
        column,
        cards: colCards,
        estimatedHeight,
        budget,
        fill: estimatedHeight / budget,
        headroom: Math.max(0, budget - estimatedHeight),
      }
    })
    return {
      board,
      columns,
      assignments: Object.fromEntries(columns.flatMap((c) => c.cards.map((card) => [card.id, c.column]))) as Record<string, ColumnIndex>,
      averageFill: columns.reduce((s, c) => s + c.fill, 0) / columns.length,
      changes: false,
    }
  }

  const buckets: Card[][] = colIds.map(() => [])
  const heights = colIds.map(() => 0)

  const ordered = [...cards].sort((a, b) => estimate(b) - estimate(a) || (a.column ?? 1) - (b.column ?? 1) || a.order - b.order)
  for (const card of ordered) {
    let target = 0
    for (let i = 1; i < columnCount; i++) if (heights[i] < heights[target]) target = i
    buckets[target].push(card)
    heights[target] += estimate(card)
  }

  // Restore the author's reading order inside every column.
  buckets.forEach((bucket, i) => {
    bucket.sort((a, b) => (a.column ?? 1) - (b.column ?? 1) || a.order - b.order)
    heights[i] = bucket.reduce((sum, c) => sum + estimate(c), 0)
  })

  const columns = colIds.map((column, i) => ({
    column,
    cards: buckets[i],
    estimatedHeight: heights[i],
    budget,
    fill: heights[i] / budget,
    headroom: Math.max(0, budget - heights[i]),
  }))

  const current = new Map(cards.map((c) => [c.id, c.column]))
  const assignments: Record<string, ColumnIndex> = {}
  for (const col of columns) for (const card of col.cards) assignments[card.id] = col.column
  const changes = cards.some((card, i) => current.get(card.id) !== assignments[card.id])

  return {
    board,
    columns,
    assignments,
    averageFill: columns.reduce((s, c) => s + c.fill, 0) / columns.length,
    changes,
  }
}

/**
 * Extra inter-block spacing (as a multiple of `em`) that would spread a column's
 * content over the full board height.
 *
 * `estimateHeight` units are proportional to printed area, so the leftover
 * fraction of the budget maps directly onto the leftover fraction of the
 * column. Spreading it across `n-1` gaps and expressing the result in `em`
 * keeps the number meaningful at every template font size. The value is capped
 * so a nearly empty column grows airy rather than absurd.
 */
/**
 * How a template's column fills the vertical space it does not use.
 *
 * The generator picks one of three mechanisms (see the gap logic in
 * `generator-poster.ts`) and the preview canvas has to *show the same thing*,
 * otherwise "the poster fills the canvas" on screen contradicts the PDF.
 *
 *  - `stretch-glue`: the column is typeset in a box of fixed height
 *    (beamerposter / a0poster+multicols), so `\vspace{\stretch{1}}` between
 *    blocks spreads the leftover over the whole column — the board ends up full.
 *  - `explicit-vspace`: tikzposter typesets a natural-height vbox where stretch
 *    glue collapses, so the generator emits an explicit `\vspace{Nem}`
 *    computed from the leftover fraction, with a safety factor and a cap — the
 *    column fills *most* of the way and the remainder prints white.
 *  - `none`: no mechanism, leftover space stays white.
 */
export type PosterStretchMode = "stretch-glue" | "explicit-vspace" | "none"

const EXPLICIT_VSPACE_TEMPLATES = new Set([
  "atlas",
  "minimal",
  "tikzposter",
  "conference",
  "aurora",
  "landscape",
  "betterposter",
])

/** Safety factor applied to the explicit `\vspace` value (estimate error). */
export const POSTER_STRETCH_SAFETY = 0.7

export function posterStretchModeFor(templateId?: string | null): PosterStretchMode {
  if (!templateId) return "stretch-glue"
  return EXPLICIT_VSPACE_TEMPLATES.has(templateId) ? "explicit-vspace" : "stretch-glue"
}

/**
 * Fraction of a column that still prints white after the generator's stretching
 * — 0 means the PDF fills the column (possibly with wider gaps between blocks).
 */
export function posterResidualWhite(
  plan: PosterColumnPlan,
  gapCount: number,
  templateId?: string | null,
): number {
  const leftover = Math.max(0, 1 - plan.fill)
  if (leftover <= 0 || gapCount < 1) return leftover
  const mode = posterStretchModeFor(templateId)
  if (mode === "none") return leftover
  if (mode === "stretch-glue") return 0
  // explicit-vspace: the generator spends `min(8em, intended) * 0.7`, and
  // `posterStretchEm` spends 5% of the column per 0.35em.
  const intended = posterStretchEm(plan, gapCount, Number.POSITIVE_INFINITY)
  const spentEm = Math.min(8, intended) * POSTER_STRETCH_SAFETY
  const spentFraction = spentEm * (0.05 / 0.35)
  return Math.max(0, leftover - spentFraction)
}

export function posterStretchEm(plan: PosterColumnPlan, gapCount: number, maxEm = 8): number {
  if (gapCount < 1) return 0
  const leftoverUnits = Math.max(0, plan.budget - plan.estimatedHeight)
  const leftoverFraction = leftoverUnits / plan.budget
  // ~2.2em of block spacing ≈ 5% of a column's height for the A0 poster sizes,
  // so fraction/0.05 gives the em multiplier that spends the leftover.
  const em = (leftoverFraction / 0.05) * 0.35
  return Math.max(0, Math.min(maxEm, Number(em.toFixed(2))))
}
