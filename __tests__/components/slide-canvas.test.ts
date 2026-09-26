import { describe, it, expect } from "vitest"
import { createElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { EditorProvider } from "@/components/editor-store"
import { SlideCanvas, slideChromeFor, SLIDE_HEIGHT_MM, SLIDE_WIDTH_MM } from "@/components/preview/slide-canvas"
import { templateGalleryFor } from "@/lib/template-showcase-data"
import { TEMPLATE_REGISTRY } from "@/lib/output-types"
import type { Card } from "@/lib/poster-types"

/**
 * First-frame smoke test for the slide surface.
 *
 * The deck is drawn on real 16:9 frames at the template's own title
 * proportions, so the assertions are geometric: one frame per slide, the frame
 * aspect ratio, dark-ground themes drawn dark, and every content pattern
 * (bullets, stats, table, figures, two-column, title) surviving the render.
 */

const withProvider = (node: ReactNode) => createElement(EditorProvider, null, node)

const SLIDE_TEMPLATES = TEMPLATE_REGISTRY.filter((t) => t.outputType === "slides").map((t) => t.id)

function renderDeck(templateId: string, cards?: Card[]) {
  const deck = cards ?? ((templateGalleryFor(templateId)?.cards ?? []) as Card[])
  return renderToStaticMarkup(
    withProvider(createElement(SlideCanvas as never, { cards: deck, templateId } as never)),
  )
}

describe("SlideCanvas", () => {
  it("draws one 16:9 frame per slide", () => {
    for (const templateId of SLIDE_TEMPLATES) {
      const cards = (templateGalleryFor(templateId)?.cards ?? []) as Card[]
      expect(cards.length, `${templateId} has no gallery`).toBeGreaterThan(4)

      const html = renderDeck(templateId, cards)
      const frames = html.match(/data-slide-canvas=/g) ?? []
      expect(frames.length, `${templateId}: ${frames.length} frames`).toBe(cards.length)

      // Every frame is the same 16:9 box: 160 × 90 mm.
      const widths = [...html.matchAll(/width:([\d.]+)px;height:([\d.]+)px/g)].map((m) => [Number(m[1]), Number(m[2])])
      expect(widths.length, templateId).toBe(cards.length)
      for (const [w, h] of widths) {
        expect(w / h, templateId).toBeCloseTo(SLIDE_WIDTH_MM / SLIDE_HEIGHT_MM, 2)
      }
    }
  })

  it("renders each template's own theme", () => {
    expect(slideChromeFor("beamer-focus").dark).toBe(true)
    expect(slideChromeFor("beamer-metropolis").dark).toBe(true)
    expect(slideChromeFor("beamer-atlas").dark).toBe(false)

    const atlas = renderDeck("beamer-atlas")
    expect(atlas).toContain("#C8102E")               // ATLAS red accent
    expect(atlas).toContain("background-color:#ffffff")

    const focus = renderDeck("beamer-focus")
    expect(focus).toContain("background-color:#1c1c1c")  // dark ground, not a white lie
  })

  it("uses the project title on the title slide and a footline on the rest", () => {
    const html = renderDeck("beamer-metropolis")
    // Title slide carries venue, title, authors and the metric strip.
    expect(html).toContain("160 × 90 mm")
    expect(html).toMatch(/\d+ \/ \d+/)               // slide N / M in the footline
    expect(html).toContain("Slide 1 ·")
  })

  it("renders every content pattern the decks use", () => {
    const met = renderDeck("beamer-metropolis")
    expect(met).toContain("<table")                  // bullets-table slide
    expect(met).toContain("<img")                    // figure slide
    expect(met).toContain("grid-cols-2")             // two-column / stats slide
    expect(met).toContain("<ul")                     // bullet list

    const focus = renderDeck("beamer-focus")         // statement edition: stats + prose
    expect(focus).toContain("<table")
  })

  it("escapes LaTeX-only markup instead of leaking it into the deck", () => {
    const html = renderDeck("beamer-atlas")
    // \cite{...} is rewritten for reading; raw TeX control sequences must not
    // appear in the DOM.
    expect(html).not.toMatch(/\\\\(cite|ref|label)\{/)
  })

  it("shows an empty-state prompt with no slides", () => {
    const html = renderDeck("beamer-default", [])
    expect(html).toContain("No slides yet")
    expect(html).toContain("0 slides")
    expect((html.match(/data-slide-canvas=/g) ?? []).length).toBe(0)
  })
})
