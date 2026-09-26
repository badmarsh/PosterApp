import { describe, it, expect } from "vitest"
import { createElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { EditorProvider } from "@/components/editor-store"
import { PaperCanvas } from "@/components/preview/paper-canvas"
import { templateGalleryFor } from "@/lib/template-showcase-data"
import { PAPER_GEOMETRY_BY_TEMPLATE, pageSizePx, paperGeometryFor } from "@/lib/preview/paper-layout"

/**
 * First-frame smoke test for the live paper canvas.
 *
 * The canvas paginates from measured block heights; with no browser the probe
 * pass falls back to the estimates in `lib/preview/paper-layout.ts`, which is
 * the same plan the paginator uses. Rendering it here proves the component
 * executes against real paper content (the text templates' galleries), emits a
 * first page and a page count, and does not touch `window`/`document` during
 * render.
 */

const withProvider = (node: ReactNode) => createElement(EditorProvider, null, node)

function renderPaper() {
  return renderToStaticMarkup(withProvider(createElement(PaperCanvas as never, {} as never)))
}

const PAPER_TEMPLATES = [
  "article-twocol",
  "article-single",
  "ieee-conf",
  "acm-sigconf",
  "springer-llncs",
  "jinst-proceedings",
  "pos-proceedings",
  "elsarticle",
  "revtex-aps",
  "epj-woc",
  "iopart",
  "neurips",
  "icml",
  "iclr",
  "acl",
  "cvpr",
  "aaai",
]

describe("PaperCanvas", () => {
  it("renders a page surface with toolbar and pagination", () => {
    const html = renderPaper()
    expect(html).toContain("data-paper-page=")
    expect(html).toMatch(/Zoom (in|out)/)
    // Summary strip: paper size, column mode, page count, figure/table/reference
    // counts and the column-fill percentage — the numbers a user checks before
    // exporting.
    for (const label of ["page", "fig", "tab", "ref", "fill"]) {
      expect(html, `summary is missing "${label}"`).toContain(label)
    }
    expect(html.length).toBeGreaterThan(4_000)
  })

  it("has geometry for every registered paper template", () => {
    for (const templateId of PAPER_TEMPLATES) {
      const geometry = paperGeometryFor(templateId)
      expect(geometry, templateId).toBeTruthy()
      expect(PAPER_GEOMETRY_BY_TEMPLATE[templateId], templateId).toBeTruthy()
      const size = pageSizePx(geometry)
      // The venue's real paper: A4 (1.414) or US Letter (1.294). IEEE / ACM /
      // RevTeX / the NeurIPS family are letter — getting that wrong is a
      // visible formatting defect in a submitted paper.
      const longSide = Math.max(size.width, size.height)
      const shortSide = Math.min(size.width, size.height)
      const ratio = longSide / shortSide
      const isA4 = Math.abs(ratio - 297 / 210) < 0.005
      const isLetter = Math.abs(ratio - 11 / 8.5) < 0.005
      expect(isA4 || isLetter, `${templateId}: ratio ${ratio.toFixed(3)}`).toBe(true)
    }
  })

  it("can lay out the curated paper content of every template", () => {
    // The canvas renders the *active* output; this asserts the content it would
    // receive is real (titles, paragraphs, tables, figures, references).
    for (const templateId of PAPER_TEMPLATES) {
      const output = templateGalleryFor(templateId)
      expect(output, `${templateId} gallery`).toBeTruthy()
      expect(output!.cards.length).toBeGreaterThanOrEqual(6)
      const paragraph = output!.cards.find((c) => c.content.length > 400)
      expect(paragraph, `${templateId}: no prose section`).toBeTruthy()
      const abstract = output!.cards.find((c) => c.title.toLowerCase() === "abstract")
      expect(abstract?.content.length, `${templateId}: abstract`).toBeGreaterThan(200)
      expect(output!.cards.some((c) => c.pattern === "references"), templateId).toBe(true)
    }
  })
})
