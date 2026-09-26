import { describe, it, expect } from "vitest"
import { createElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { EditorProvider } from "@/components/editor-store"
import { ThesisReviewCanvas } from "@/components/preview/thesis-review-canvas"
import { getShowcaseById } from "@/lib/showcases-data"
import { thesisReviewStyleFor } from "@/lib/latex/thesis-review-styles"
import { THESIS_REVIEW_STYLES } from "@/lib/latex/thesis-review-styles"
import { deriveThesisReview } from "@/lib/latex/thesis-review-meta"
import { buildThesisBlocks, paginateThesisBlocks, thesisGeometryFor, pageSizePx, estimateThesisBlockHeight, narrativeHeadingsFor } from "@/lib/preview/thesis-layout"
import { THESIS_REVIEW_LABELS } from "@/lib/latex/templates-thesis"
import type { Project } from "@/lib/poster-types"
import type { ThesisReviewTemplate } from "@/lib/latex/templates-thesis"

/**
 * Live posudok canvas.
 *
 * The canvas paginates from measured block heights; without a browser the probe
 * pass falls back to the estimates in `lib/preview/thesis-layout.ts`, which is
 * the plan the paginator uses. Rendering it here proves the component executes
 * against a real posudok workspace and emits real A4 pages, and that each of
 * the six posudok templates draws its *own* design.
 */

const TEMPLATES: ThesisReviewTemplate[] = ["posudok-sk", "posudok-cs", "posudok-en", "posudok-de", "posudok-pl", "posudok-hu"]

function showcaseProject(templateId: ThesisReviewTemplate): Project {
  const project = getShowcaseById("posudok-diplomovka-ai")!
  const output = project.outputs[0]
  return {
    ...project,
    outputs: [{ ...output, templateId, id: `out_${templateId}` }],
    activeOutputId: `out_${templateId}`,
  }
}

function renderCanvas(project?: Project) {
  const wrapper = (node: ReactNode) =>
    createElement(EditorProvider as never, { initialProject: project ?? null } as never, node)
  return renderToStaticMarkup(wrapper(createElement(ThesisReviewCanvas as never, {} as never)))
}

describe("ThesisReviewCanvas", () => {
  it("renders an A4 page with the posudok chrome", () => {
    const html = renderCanvas(showcaseProject("posudok-sk"))
    expect(html).toContain("data-thesis-page=")
    expect(html).toContain("data-thesis-template=")
    expect(html).toContain("Posudok · A4")
    expect(html.length).toBeGreaterThan(4_000)
  })

  it("prints the student and the thesis — not the reviewer and the output title", () => {
    const html = renderCanvas(showcaseProject("posudok-sk"))
    expect(html).toContain("Bc. Martin Kováč")
    expect(html).toContain("Hlboké reziduálne siete")
    // The reviewer must appear as the reviewer, with the derived role.
    expect(html).toContain("Róbert Astaloš")
    expect(html).toContain("Vedúci")
    expect(html).not.toContain("Oponent/ka")
    expect(html).not.toMatch(/Autor\/Autorka práce:\s*<\/td><td[^>]*>doc\./)
  })

  it("renders the weighted criteria overview, ratings and the classification", () => {
    const html = renderCanvas(showcaseProject("posudok-sk"))
    expect(html).toContain("PREHĽAD HODNOTENIA KRITÉRIÍ")
    expect(html).toContain("HODNOTENIE KRITÉRIÍ")
    expect(html).toContain("Navrhovaná klasifikácia")
    // The showcase posudok rates the work with A.
    expect(html).toContain(">A<")
    expect(html).toContain("OTÁZKY K OBHAJOBE")
    expect(html).toContain("CELKOVÉ HODNOTENIE")
  })

  it("draws a different page for every posudok template", () => {
    const renders = TEMPLATES.map((templateId) => renderCanvas(showcaseProject(templateId)))
    for (const [index, templateId] of TEMPLATES.entries()) {
      expect(renders[index], templateId).toContain(`data-thesis-template="${templateId}"`)
      const style = thesisReviewStyleFor(templateId)
      // Every template carries its own accent colour in the markup.
      expect(renders[index].toLowerCase(), `${templateId} accent`).toContain(style.accent.toLowerCase())
    }
    // Six templates ⇒ six distinct designs (not one document in six languages).
    const uniqueSignatures = new Set(TEMPLATES.map((t) => {
      const style = thesisReviewStyleFor(t)
      return [style.letterhead, style.titleStyle, style.criteriaTable, style.gradeStyle, style.sectionMarker].join("|")
    }))
    expect(uniqueSignatures.size).toBe(6)
    // Weighted/points columns exist only where the template declares them.
    const withWeights = renderCanvas(showcaseProject("posudok-cs"))
    expect(withWeights).toContain("Váha")
    const withoutWeights = renderCanvas(showcaseProject("posudok-en"))
    expect(withoutWeights).not.toContain("Weight</th>")
  })

  it("prints the narrative blocks a reviewer supplied (strengths, citations)", () => {
    const project = showcaseProject("posudok-sk")
    const output = project.outputs[0]
    const enriched: Project = {
      ...project,
      outputs: [
        {
          ...output,
          cards: [
            ...output.cards,
            {
              id: "card_strengths",
              title: "Silné stránky práce",
              column: 1,
              order: 10,
              pattern: "bullets",
              content:
                "- **Reprodukovateľnosť:** Kód aj konfigurácie sú zverejnené.\n- **Klinická relevancia:** Validácia na verejnom datasete LIDC-IDRI.",
              figureLayout: "single",
              table: { hasHeader: false, caption: "", rows: [] },
              figures: [],
              sourceIds: [],
              validation: "valid",
            },
            {
              id: "card_citations",
              title: "Poznámky k citáciám",
              column: 1,
              order: 11,
              pattern: "bullets",
              content: "- Chýbajúci DOI pri položke č. 12 — dohľadateľné v Crossref.",
              figureLayout: "single",
              table: { hasHeader: false, caption: "", rows: [] },
              figures: [],
              sourceIds: [],
              validation: "valid",
            },
          ],
        },
      ],
    }
    const html = renderCanvas(enriched)
    expect(html).toContain("Silné stránky práce (Key Strengths)")
    expect(html).toContain("Reprodukovateľnosť")
    expect(html).toContain("POZNÁMKY K CITÁCIÁM")
    expect(html).toContain("Chýbajúci DOI")
  })

  it("shows an empty state when there is no posudok content", () => {
    const project = showcaseProject("posudok-sk")
    const empty: Project = {
      ...project,
      outputs: [{ ...project.outputs[0], cards: [] }],
    }
    const html = renderCanvas(empty)
    expect(html).toContain("This posudok has no content yet")
    expect(html).not.toContain("data-thesis-page=")
  })

  it("paginates the posudok into whole A4 pages that match the geometry", () => {
    for (const templateId of TEMPLATES) {
      const project = showcaseProject(templateId)
      const output = project.outputs[0]
      const style = thesisReviewStyleFor(templateId)
      const geometry = thesisGeometryFor(templateId)
      const labels = THESIS_REVIEW_LABELS[style.language]
      const derived = deriveThesisReview(project, output, style.language)
      const headings = narrativeHeadingsFor(style.language)
      const blocks = buildThesisBlocks({
        derived,
        labels,
        style,
        narrative: [
          ...(derived.summary ? [{ heading: headings.summary, text: derived.summary }] : []),
          ...(derived.strengths.length > 0 ? [{ heading: headings.strengths, items: derived.strengths }] : []),
        ],
      })

      expect(blocks.length, templateId).toBeGreaterThan(6)
      // The form always carries the essentials of a review.
      for (const kind of ["letterhead", "title", "identification", "table", "grade", "signature"]) {
        expect(blocks.some((b) => b.kind === kind), `${templateId}: ${kind}`).toBe(true)
      }

      const measure = (block: (typeof blocks)[number]) => estimateThesisBlockHeight(block, geometry)
      const plan = paginateThesisBlocks(blocks, measure, geometry)
      const size = pageSizePx(geometry)
      expect(Math.abs(size.width - 210 * (96 / 25.4))).toBeLessThan(0.5)
      expect(Math.abs(size.height - 297 * (96 / 25.4))).toBeLessThan(0.5)
      expect(plan.pageCount, templateId).toBeGreaterThanOrEqual(1)
      // A two-page form must not leave the first page nearly empty.
      if (plan.pageCount > 1) {
        expect(plan.pages[0].usedHeight / plan.pages[0].capacity, `${templateId}: first page fill`).toBeGreaterThan(0.3)
      }
    }
  })

  it("describes every template in the registry with a distinct blurb", () => {
    const blurbs = Object.values(THESIS_REVIEW_STYLES).map((s) => s.blurb)
    expect(new Set(blurbs).size).toBe(6)
    for (const templateId of TEMPLATES) {
      const style = thesisReviewStyleFor(templateId)
      expect(style.templateId).toBe(templateId)
      expect(style.blurb.length).toBeGreaterThan(20)
    }
  })
})
