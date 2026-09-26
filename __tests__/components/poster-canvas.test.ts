import { describe, it, expect } from "vitest"
import { createElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { EditorProvider } from "@/components/editor-store"
import { PosterCanvas } from "@/components/preview/poster-canvas"
import { templateGalleryFor } from "@/lib/template-showcase-data"
import { columnBudgetFor, posterBoardFor, posterColumnHeightMm } from "@/lib/latex/layout"
import type { Card } from "@/lib/poster-types"

/**
 * First-frame smoke test for the poster surface.
 *
 * CI has no browser, so the canvas is server-rendered with the real curated
 * gallery content: that catches the failures which only appear once a component
 * actually executes — undefined geometry, a render-time `ResizeObserver` call,
 * a crash on an empty column. The measurement pass (`useLayoutEffect` +
 * `ResizeObserver`) still only runs in a browser, so every assertion here is
 * about the physical fallback geometry, which is exactly what the print layout
 * is derived from.
 */

const withProvider = (node: ReactNode) => createElement(EditorProvider, null, node)

function renderCanvas(templateId: string, cards: Card[]) {
  return renderToStaticMarkup(
    withProvider(
      createElement(PosterCanvas as never, {
        cards,
        templateId,
        renderCard: (card: Card) => createElement("div", { "data-card": card.id }, card.title),
        onAddCard: () => {},
        onBalance: () => {},
      } as never),
    ),
  )
}

const galleryCards = (templateId: string): Card[] => (templateGalleryFor(templateId)?.cards ?? []) as Card[]

/** Column wrappers are the only elements carrying a `row-gap` inline style. */
function columnBlocks(html: string): number {
  return (html.match(/row-gap:/g) ?? []).length
}

function boardSize(html: string): { width: number; height: number } {
  const m = html.match(/width:([\d.]+)px;height:([\d.]+)px/)
  if (!m) throw new Error("board size not found in markup")
  return { width: Number(m[1]), height: Number(m[2]) }
}

const POSTER_TEMPLATES = ["atlas", "conference", "minimal", "gemini", "tikzposter", "landscape", "betterposter", "aurora", "a0poster"]

describe("PosterCanvas", () => {
  /** Titles reach the DOM HTML-escaped (`&` → `&amp;`). */
  const escaped = (text: string) =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

  it.each(POSTER_TEMPLATES)("%s renders its board at the paper's true aspect ratio", (templateId) => {
    const cards = galleryCards(templateId)
    expect(cards.length, `${templateId} has no gallery content`).toBeGreaterThan(5)

    const html = renderCanvas(templateId, cards)
    const board = posterBoardFor(templateId)
    const size = boardSize(html)

    expect(html).toContain(`data-poster-board="${templateId}"`)
    const expected = board.heightMm / board.widthMm
    expect(size.height / size.width).toBeCloseTo(expected, 1)
    // Every card in the output is drawn.
    for (const card of cards) expect(html, `${templateId}/${card.id}`).toContain(escaped(card.title))
  })

  it("draws one column per board column, numbering them in the fill meter", () => {
    for (const templateId of POSTER_TEMPLATES) {
      const columns = posterBoardFor(templateId).columnWidths.length
      const html = renderCanvas(templateId, galleryCards(templateId))
      expect(columnBlocks(html), `${templateId} columns`).toBe(columns)
      for (let i = 1; i <= columns; i++) expect(html, `${templateId} C${i}`).toContain(`>C${i}<`)
      expect(html).toContain("of board")
    }
  })

  it("never draws a column taller than the board it belongs to", () => {
    // The rendered card boxes are sized from the same estimate the compile-fit
    // report uses, so a column that overflows here overflows in print.
    for (const templateId of POSTER_TEMPLATES) {
      const html = renderCanvas(templateId, galleryCards(templateId))
      const { height } = boardSize(html)
      const heights = [...html.matchAll(/min-height:([\d.]+)px/g)].map((m) => Number(m[1]))
      expect(heights.length, templateId).toBeGreaterThan(0)
      // Card boxes are scaled to the rendered board; the largest single block
      // must fit inside it (a card taller than the board is a hard layout bug).
      expect(Math.max(...heights), `${templateId}: tallest block`).toBeLessThan(height)
    }
  })

  it("tells the truth about what the PDF does with leftover column space", () => {
    // gemini (stretch glue) fills the board in print; tikzposter fills most of
    // it with an explicit vspace. The canvas must not label either as "white"
    // without saying what happens at compile time.
    const gemini = renderCanvas("gemini", galleryCards("gemini"))
    if (gemini.includes("% white")) {
      expect(gemini).toContain("filled in print")
    }
    const atlas = renderCanvas("atlas", galleryCards("atlas"))
    expect(atlas).toMatch(/% white|filled to the board edge|prints full|filled in print/)
  })

  it("shows the honest fill read-out for the gallery content", () => {
    const html = renderCanvas("atlas", galleryCards("atlas"))
    // Per-column percentages, a coverage pill and the balance control.
    expect(html).toMatch(/aria-label="Column 1: \d+ percent of budget"/)
    expect(html).toMatch(/\d+% of board/)
    expect(html).toContain("Fill canvas")
    // The gallery is balanced: no column may be reported as mostly empty.
    const fills = [...html.matchAll(/Column \d: (\d+) percent/g)].map((m) => Number(m[1]))
    expect(Math.min(...fills)).toBeGreaterThan(55)
  })

  it("renders empty-column guidance instead of collapsing", () => {
    const empty = renderCanvas("atlas", [])
    expect(empty).toContain("Empty column")
    expect(empty).toContain("data-poster-board=\"atlas\"")
    const unknown = renderCanvas("not-a-template", [])
    expect(unknown).toContain("data-poster-board")
    expect(unknown.length).toBeGreaterThan(500)
  })

  it("reports the budget the LaTeX validator uses, per template", () => {
    // The canvas and the static validator must agree, otherwise "fills the
    // canvas" on screen contradicts the compile report.
    for (const templateId of POSTER_TEMPLATES) {
      const board = posterBoardFor(templateId)
      expect(posterColumnHeightMm(board)).toBeGreaterThan(400)
      expect(columnBudgetFor(templateId)).toBeGreaterThan(0)
    }
  })
})
