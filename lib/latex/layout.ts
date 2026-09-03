import type { Card } from "@/lib/poster-types"

/**
 * Default column height budget, in the arbitrary "units" produced by
 * estimateHeight. Calibrated against the 3-column A0 *portrait* tikzposter
 * templates (atlas / minimal / tikzposter / gemini / a0poster).
 */
export const COLUMN_BUDGET = 900

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
 * 900 * (841/1189) * (1189/841) ≈ 900 in theory — but the title block and
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
  atlas: 900,
  minimal: 900,
  tikzposter: 900,
  gemini: 900,
  // a0poster uses multicols at a smaller base font, so more fits per column
  a0poster: 1000,
  // A0 landscape: shorter columns
  landscape: 700,
  // Better Poster: the narrow flanking columns are the constraint, and the
  // centre column is meant to hold ONE sentence in very large type.
  betterposter: 520,
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
  const chrome = 70 // title + block chrome

  if (card.pattern === "references") {
    return { total: chrome + 150, chrome, prose: 0, bullets: 0, table: 0, figures: 150 }
  }

  const content = typeof card.content === "string" ? card.content : ""
  const prose = Math.floor(content.length / 60) * 14
  const bulletCount = (content.match(/^[-*]\s/gm) || []).length
  const bullets = bulletCount * BULLET_UNIT

  let table = 0
  if (card.pattern === "bullets-table") {
    table = 30 + (Array.isArray(card.table?.rows) ? card.table.rows.length : 0) * TABLE_ROW_UNIT
  }

  let figures = 0
  if (card.pattern === "bullets-image" || card.pattern === "image-focused") {
    figures = card.pattern === "image-focused" ? 260 : 190
  }
  if (card.pattern === "bullets-two-images") figures = 150

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
