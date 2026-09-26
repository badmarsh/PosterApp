/**
 * Page model for the live posudok canvas.
 *
 * The canvas must show what the LaTeX export will typeset: the same order of
 * blocks, the same tables, the same page breaks, and — because the six posudok
 * templates are six different designs — the same *visual language* per
 * template. Everything here is derived from `THESIS_REVIEW_STYLES`, which the
 * generator also reads, so the preview and the PDF cannot drift.
 *
 * `buildThesisBlocks` mirrors `generateThesisReviewLatex` block for block:
 *
 *   letterhead → title → identification → evaluation blocks → criteria
 *   overview table → per-criterion commentary → defence questions → citation
 *   notes → confidential notes → grade panel → signature → AI disclosure
 *
 * Pagination is block-level and greedy: a block that does not fit starts the
 * next page, unless the page is still filling up (matching the `\Needspace`
 * hints in the generator, which keep a heading with its first lines).
 */

import { thesisReviewStyleFor, type ThesisReviewStyle } from "@/lib/latex/thesis-review-styles"
import type { ThesisReviewDerived } from "@/lib/latex/thesis-review-meta"

/** CSS pixels per millimetre at the canvas' 96 dpi reference scale. */
export const PX_PER_MM = 96 / 25.4
/** CSS pixels per point. */
export const PX_PER_PT = 96 / 72

export type ThesisGeometry = {
  label: string
  pageWidthMm: number
  pageHeightMm: number
  marginTopMm: number
  marginBottomMm: number
  marginLeftMm: number
  marginRightMm: number
  /** Body font size in points (article class 12pt). */
  baseFontPt: number
  style: ThesisReviewStyle
}

/** A4 geometry with the margins of the selected posudok template. */
export function thesisGeometryFor(templateId?: string | null): ThesisGeometry {
  const style = thesisReviewStyleFor(templateId)
  return {
    label: `A4 · ${style.templateId}`,
    pageWidthMm: 210,
    pageHeightMm: 297,
    marginTopMm: style.margins.top,
    marginBottomMm: style.margins.bottom,
    marginLeftMm: style.margins.left,
    marginRightMm: style.margins.right,
    baseFontPt: 12,
    style,
  }
}

export function pageSizePx(g: ThesisGeometry): { width: number; height: number } {
  return { width: g.pageWidthMm * PX_PER_MM, height: g.pageHeightMm * PX_PER_MM }
}

export function columnWidthPx(g: ThesisGeometry): number {
  return (g.pageWidthMm - g.marginLeftMm - g.marginRightMm) * PX_PER_MM
}

export function columnHeightPx(g: ThesisGeometry): number {
  return (g.pageHeightMm - g.marginTopMm - g.marginBottomMm) * PX_PER_MM
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

export type ThesisBlockKind =
  | "letterhead"
  | "title"
  | "identification"
  | "heading"
  | "prose"
  | "list"
  | "table"
  | "figure"
  | "grade"
  | "signature"
  | "disclosure"

export type ThesisBlock = {
  id: string
  kind: ThesisBlockKind
  /** Card this block came from; `__meta__` for document-level blocks. */
  cardId: string
  title?: string
  text?: string
  items?: string[]
  /** Rating letter printed next to the heading. */
  rating?: string
  /** Rubric weight in percent, when known. */
  weight?: number | null
  /** Points the rating converts to. */
  points?: number | null
  table?: { columns: string[]; rows: string[][] }
  figure?: { url: string; caption: string }
  /** Grade panel payload. */
  grade?: {
    grade: string
    scorePercent: number | null
    ects: string | null
    recommendation: string
    scale: string
    gradeLabel: string
    scoreLabel: string
    recommendationLabel: string
  }
}

const META_CARD = "__meta__"

/**
 * Card prose is written for LaTeX: `\cite{key}`, `\ref{fig:x}`, `\label{…}`.
 * The compiled posudok resolves those, but the canvas shows the text as the
 * model wrote it — so the commands are rendered as readable references instead
 * of leaking control sequences into the preview.
 */
export function renderInlineCommands(text: string): string {
  return text
    .replace(/\\cite[tp]?\{([^}]*)\}/g, (_match, keys: string) =>
      `[${keys.split(",").map((k) => k.trim()).filter(Boolean).join(", ")}]`)
    .replace(/\\ref\{([^}]*)\}/g, (_match, key: string) => key.replace(/^(fig|tab|sec|eq):/, "").replace(/[-_]/g, " "))
    .replace(/\\label\{[^}]*\}/g, "")
    .replace(/\\%/g, "%")
}

function cleanText(text: string | undefined): string | undefined {
  if (!text) return text
  const cleaned = renderInlineCommands(text).trim()
  return cleaned || text
}

export type ThesisLabelsSubset = {
  title: string
  identificationLabel: string
  criteriaOverviewLabel: string
  criterionLabel: string
  weightLabel: string
  pointsLabel: string
  ratingLabel: string
  notRatedLabel: string
  gradingLabel: string
  defenseLabel: string
  citationLabel: string
  confidentialLabel: string
  summaryLabel: string
  gradeLabel: string
  scoreLabel: string
  recommendationLabel: string
  signatureLabel: string
  dateLabel: string
  ectsLabel: string
  gradingScaleLabel: string
  studentLabel: string
  thesisTitleLabel: string
  thesisTypeLabel: string
  reviewerLabel: string
  roleLabel: string
  institutionLabel: string
  facultyLabel: string
  studyProgrammeLabel: string
  academicYearLabel: string
  thesisTypes: { bachelor: string; master: string; phd: string }
  roles: Record<string, string | undefined>
}

export type BuildThesisBlocksInput = {
  derived: ThesisReviewDerived
  labels: ThesisLabelsSubset
  /** Template design descriptor — decides which table columns exist. */
  style: ThesisReviewStyle
  /** Evaluation-block headings (exec summary, strengths, concerns…). */
  narrative: Array<{ heading: string; text?: string; items?: string[] }>
  styleNotes?: string
}

/**
 * Ordered block list — the canvas' equivalent of the generated document body.
 * Criterion blocks keep their card id so the canvas stays click-to-select.
 */
export function buildThesisBlocks(input: BuildThesisBlocksInput): ThesisBlock[] {
  const { derived, labels, narrative, style } = input
  const blocks: ThesisBlock[] = []

  // 1. Letterhead + title
  blocks.push({
    id: "letterhead",
    kind: "letterhead",
    cardId: META_CARD,
    text: derived.institution,
    title: [derived.faculty, derived.department].filter(Boolean).join(" · "),
    items: [[derived.place, derived.date].filter(Boolean).join(", ")],
  })

  blocks.push({ id: "title", kind: "title", cardId: META_CARD, text: labels.title })

  // 2. Identification
  const identificationRows: string[][] = [
    [labels.studentLabel, derived.studentName || "—"],
    [labels.thesisTitleLabel, derived.thesisTitle || "—"],
    [labels.thesisTypeLabel, labels.thesisTypes[derived.thesisType] ?? derived.thesisType],
  ]
  if (derived.studyProgramme) identificationRows.push([labels.studyProgrammeLabel, derived.studyProgramme])
  if (derived.faculty) identificationRows.push([labels.facultyLabel, derived.faculty])
  if (derived.reviewerName) identificationRows.push([labels.reviewerLabel, derived.reviewerName])
  identificationRows.push([
    labels.roleLabel,
    (labels.roles as Record<string, string | undefined>)[derived.reviewerRole] ?? derived.reviewerRole,
  ])
  if (derived.institution) identificationRows.push([labels.institutionLabel, derived.institution])
  if (derived.academicYear) identificationRows.push([labels.academicYearLabel, derived.academicYear])

  blocks.push({
    id: "identification-heading",
    kind: "heading",
    cardId: META_CARD,
    title: labels.identificationLabel,
  })
  blocks.push({
    id: "identification",
    kind: "identification",
    cardId: META_CARD,
    table: { columns: [], rows: identificationRows },
  })

  // 3. Narrative evaluation blocks
  narrative.forEach((block, index) => {
    blocks.push({
      id: `narrative-${index}-heading`,
      kind: "heading",
      cardId: META_CARD,
      title: block.heading,
    })
    if (block.text) {
      blocks.push({ id: `narrative-${index}`, kind: "prose", cardId: META_CARD, text: cleanText(block.text) })
    }
    if (block.items?.length) {
      blocks.push({ id: `narrative-${index}-list`, kind: "list", cardId: META_CARD, items: block.items.map((i) => renderInlineCommands(i)) })
    }
  })

  // 4. Criteria overview table
  const rated = derived.criteria.filter((c) => c.name)
  if (rated.length > 0) {
    blocks.push({
      id: "overview-heading",
      kind: "heading",
      cardId: META_CARD,
      title: labels.criteriaOverviewLabel,
    })
    const columns = [labels.criterionLabel]
    if (style.showWeights) columns.push(labels.weightLabel)
    if (style.showPoints) columns.push(labels.pointsLabel)
    columns.push(labels.ratingLabel)
    blocks.push({
      id: "overview",
      kind: "table",
      cardId: META_CARD,
      table: {
        columns,
        rows: rated.map((c) => {
          const row = [c.name]
          if (style.showWeights) row.push(c.weight === null ? "—" : `${c.weight} %`)
          if (style.showPoints) row.push(c.points === null ? "—" : `${c.points}`)
          row.push(c.rating || labels.notRatedLabel)
          return row
        }),
      },
      text: labels.gradingScaleLabel,
    })
  }

  // 5. Per-criterion commentary
  if (rated.length > 0) {
    blocks.push({
      id: "criteria-heading",
      kind: "heading",
      cardId: META_CARD,
      title: labels.gradingLabel,
    })
    rated.forEach((criterion, index) => {
      blocks.push({
        id: `criterion-${index}-heading`,
        kind: "heading",
        cardId: criterion.cardId,
        title: `${index + 1}. ${criterion.name}`,
        rating: criterion.rating,
      })
        if (criterion.text) {
        blocks.push({
          id: `criterion-${index}`,
          kind: "prose",
          cardId: criterion.cardId,
          text: cleanText(criterion.text),
        })
      }
      if (criterion.suggestions.length > 0) {
        blocks.push({
          id: `criterion-${index}-suggestions`,
          kind: "list",
          cardId: criterion.cardId,
          items: criterion.suggestions.map((i) => renderInlineCommands(i)),
        })
      }
      ;(criterion.figures ?? []).forEach((figure, figureIndex) => {
        blocks.push({
          id: `criterion-${index}-figure-${figureIndex}`,
          kind: "figure",
          cardId: criterion.cardId,
          figure,
        })
      })
    })
  }

  // 6. Defence questions, citation notes, confidential notes
  if (derived.defenseQuestions.length > 0) {
    blocks.push({ id: "defense-heading", kind: "heading", cardId: META_CARD, title: labels.defenseLabel })
    blocks.push({ id: "defense", kind: "list", cardId: META_CARD, items: derived.defenseQuestions.map((q) => renderInlineCommands(q)) })
  }
  if (derived.citationIssues.length > 0) {
    blocks.push({ id: "citations-heading", kind: "heading", cardId: META_CARD, title: labels.citationLabel })
    blocks.push({ id: "citations", kind: "list", cardId: META_CARD, items: derived.citationIssues.map((c) => renderInlineCommands(c)) })
  }
  if (derived.includeConfidential && derived.confidentialComments) {
    blocks.push({ id: "confidential-heading", kind: "heading", cardId: META_CARD, title: labels.confidentialLabel })
    blocks.push({ id: "confidential", kind: "prose", cardId: META_CARD, text: cleanText(derived.confidentialComments) })
  }

  // 7. Grade panel + signature
  blocks.push({ id: "grade-heading", kind: "heading", cardId: META_CARD, title: labels.summaryLabel })
  blocks.push({
    id: "grade",
    kind: "grade",
    cardId: META_CARD,
    rating: derived.grade,
    grade: {
      grade: derived.grade,
      scorePercent: derived.scorePercent,
      ects: derived.weightedGrade,
      recommendation: derived.recommendation,
      scale: labels.gradingScaleLabel,
      gradeLabel: labels.gradeLabel,
      scoreLabel: labels.scoreLabel,
      recommendationLabel: labels.recommendationLabel,
    },
  })
  blocks.push({
    id: "signature",
    kind: "signature",
    cardId: META_CARD,
    items: [labels.signatureLabel, labels.dateLabel],
    text: [derived.place, derived.date].filter(Boolean).join(", "),
  })

  return blocks
}

/** Localised headings for the narrative blocks the canvas shows above the criteria. */
export function narrativeHeadingsFor(lang: ThesisReviewDerived["language"]): { summary: string; strengths: string } {
  switch (lang) {
    case "sk":
      return { summary: "Zhrnutie práce a hlavný prínos (Executive Summary)", strengths: "Silné stránky práce (Key Strengths)" }
    case "cs":
      return { summary: "Shrnutí práce a hlavní přínos (Executive Summary)", strengths: "Silné stránky práce (Key Strengths)" }
    case "de":
      return { summary: "Zusammenfassung und Hauptergebnis", strengths: "Stärken der Arbeit" }
    case "pl":
      return { summary: "Streszczenie i główny wkład", strengths: "Mocne strony pracy" }
    case "hu":
      return { summary: "Összefoglaló és fő eredmény", strengths: "A dolgozat erősségei" }
    default:
      return { summary: "Executive Summary", strengths: "Key Strengths" }
  }
}

// ---------------------------------------------------------------------------
// Measurement + pagination
// ---------------------------------------------------------------------------

export type ThesisMeasure = (block: ThesisBlock) => number

const LINE_RATIO = 1.45

function linesFor(text: string, g: ThesisGeometry, fontPt: number, widthPx: number): number {
  const glyphWidth = fontPt * PX_PER_PT * 0.5
  const perLine = Math.max(12, Math.floor(widthPx / glyphWidth))
  return text
    .split("\n")
    .reduce((sum, paragraph) => sum + Math.max(1, Math.ceil(paragraph.trim().length / perLine)), 0)
}

/** First-pass height estimate, used before (and without) DOM measurement. */
export function estimateThesisBlockHeight(block: ThesisBlock, g: ThesisGeometry): number {
  const width = columnWidthPx(g)
  const body = g.baseFontPt * PX_PER_PT
  const line = body * LINE_RATIO

  switch (block.kind) {
    case "letterhead":
      return body * 3.2
    case "title":
      return body * 3.4
    case "identification":
      return body * 0.35 + (block.table?.rows.length ?? 0) * body * 1.45
    case "heading":
      return body * 2.1
    case "prose":
      return linesFor(block.text ?? "", g, g.baseFontPt, width) * line + body * 0.6
    case "list":
      return (block.items?.length ?? 0) * line + body * 0.8
    case "table": {
      const header = g.baseFontPt * PX_PER_PT * 1.6
      const rowCount = block.table?.rows.length ?? 0
      const caption = block.text ? body * 1.9 : 0
      return header + rowCount * body * 1.5 + caption + body
    }
    case "figure":
      return width * 0.42 + (block.figure?.caption ? body * 2 : 0) + body
    case "grade":
      return body * (block.grade?.scorePercent !== null && block.grade?.scorePercent !== undefined ? 7.6 : 6.2)
    case "signature":
      return body * 5.2
    case "disclosure":
      return body * 4
    default:
      return line
  }
}

export type ThesisPage = {
  index: number
  blocks: ThesisBlock[]
  usedHeight: number
  capacity: number
}

export type ThesisPaginationOptions = {
  /** Blocks that must not be separated from the block that follows them. */
  keepWithNext?: (block: ThesisBlock, next: ThesisBlock | undefined) => boolean
}

/**
 * Greedy block-level pagination.
 *
 * A block moves to the next page when it would overflow *and* the current page
 * already holds at least a third of its capacity — otherwise a single tall
 * table would leave the first page nearly empty. Headings are kept with the
 * block that follows them (`keepWithNext`).
 */
export function paginateThesisBlocks(
  blocks: ThesisBlock[],
  measure: ThesisMeasure,
  g: ThesisGeometry,
  options: ThesisPaginationOptions = {},
): { pages: ThesisPage[]; pageCount: number } {
  const capacity = columnHeightPx(g)
  const pages: ThesisPage[] = []
  let current: ThesisPage = { index: 1, blocks: [], usedHeight: 0, capacity }
  const keepWithNext = options.keepWithNext ?? ((block) => block.kind === "heading")

  const push = () => {
    pages.push(current)
    current = { index: pages.length + 1, blocks: [], usedHeight: 0, capacity }
  }

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]
    const height = Math.max(1, measure(block))
    const next = blocks[i + 1]
    const mustStay = next && keepWithNext(block, next) ? Math.max(1, measure(next)) : 0
    const fits = current.usedHeight + height + mustStay <= capacity
    const pageIsFilling = current.usedHeight >= capacity * 0.32

    if (!fits && pageIsFilling) push()

    current.blocks.push(block)
    current.usedHeight += height
  }

  if (current.blocks.length > 0 || pages.length === 0) pages.push(current)
  return { pages, pageCount: pages.length }
}

export type ThesisPlanSummary = {
  pageCount: number
  criteriaCount: number
  ratedCount: number
  figureCount: number
  wordCount: number
  weightedScore: number | null
  averageFill: number
}

export function summarizeThesisPlan(pages: ThesisPage[], derived: ThesisReviewDerived): ThesisPlanSummary {
  const words = pages
    .flatMap((p) => p.blocks)
    .reduce((sum, block) => {
      const text = [block.text ?? "", ...(block.items ?? []), block.figure?.caption ?? ""].join(" ")
      return sum + text.split(/\s+/).filter(Boolean).length
    }, 0)
  const used = pages.reduce((sum, page) => sum + page.usedHeight, 0)
  const capacity = pages.reduce((sum, page) => sum + page.capacity, 0)
  return {
    pageCount: pages.length,
    criteriaCount: derived.criteria.length,
    ratedCount: derived.criteria.filter((c) => c.rating).length,
    figureCount: derived.criteria.reduce((sum, c) => sum + (c.figures?.length ?? 0), 0),
    wordCount: words,
    weightedScore: derived.weightedScore,
    averageFill: capacity > 0 ? used / capacity : 0,
  }
}
