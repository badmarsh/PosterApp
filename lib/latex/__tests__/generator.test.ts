import { describe, it, expect } from "vitest"
import { generateLatexForCard, generateFullTemplate, assetUrlToLatexPath } from "../generator"
import type { Card, Project } from "@/lib/poster-types"

function makeCard(patch: Partial<Card>): Card {
  return {
    id: "card_1",
    title: "Test Card",
    column: 1,
    order: 0,
    pattern: "bullets",
    content: "Some content",
    table: { hasHeader: true, caption: "", rows: [] },
    figures: [],
    figureLayout: "single",
    sourceIds: [],
    heightBudget: null,
    validation: "valid",
    ...patch
  }
}

describe("Generator", () => {
  describe("assetUrlToLatexPath", () => {
    it("strips /api/workspaces/<id>/assets/ prefix to assets/<file>", () => {
      expect(assetUrlToLatexPath("/api/workspaces/ws1/assets/test.jpg", "ws1")).toBe("assets/test.jpg")
    })
    it("returns original URL if it doesn't match the prefix", () => {
      expect(assetUrlToLatexPath("https://example.com/test.jpg", "ws1")).toBe("https://example.com/test.jpg")
    })
  })

  describe("generateLatexForCard", () => {
    it("produces block with itemize for bullets pattern", () => {
      const card = makeCard({ pattern: "bullets", content: "- item 1\n- item 2" })
      const res = generateLatexForCard(card)
      expect(res).toContain("\\begin{itemize}")
      expect(res).toContain("\\item item 1")
    })

    it("produces bibliography and nocite for references pattern", () => {
      const card = makeCard({ pattern: "references" })
      const res = generateLatexForCard(card, "", ["Author2020"])
      expect(res).toContain("\\nocite{Author2020}")
      expect(res).toContain("\\bibliography{references}")
    })

    it("produces includegraphics for bullets-image with one figure", () => {
      const card = makeCard({
        pattern: "bullets-image",
        figures: [{ id: "fig1", url: "/api/workspaces/ws1/assets/fig1.png", caption: "" }]
      })
      const res = generateLatexForCard(card, "ws1")
      expect(res).toContain("\\includegraphics")
      expect(res).toContain("assets/fig1.png")
    })

    it("produces two minipages for bullets-two-images", () => {
      const card = makeCard({
        pattern: "bullets-two-images",
        figures: [
          { id: "fig1", url: "fig1.png", caption: "" },
          { id: "fig2", url: "fig2.png", caption: "" }
        ]
      })
      const res = generateLatexForCard(card)
      expect(res).toContain("\\begin{minipage}")
      expect(res).toMatch(/\\begin{minipage}[\s\S]*\\begin{minipage}/)
    })

    it("produces tabular for bullets-table", () => {
      const card = makeCard({
        pattern: "bullets-table",
        table: { hasHeader: true, caption: "", rows: [["A", "B"], ["C", "D"]] }
      })
      const res = generateLatexForCard(card)
      expect(res).toContain("\\begin{tabular}")
      expect(res).toContain("A & B \\\\")
    })
  })

  describe("generateFullTemplate", () => {
    const makeProject = (templateName: string, posterCards: Card[] = []): Project => ({
      id: "prj_1",
      name: "Test",
      posterTitle: "Title",
      authors: "Authors",
      venue: "Venue",
      templateName,
      cards: posterCards,
      assets: [],
      ingestFiles: [],
      outputs: [
        {
          id: "out_poster_atlas",
          outputType: "poster",
          templateId: "atlas",
          title: "Test Poster",
          cards: posterCards,
        },
        {
          id: "out_paper_twocol",
          outputType: "paper",
          templateId: "article-twocol",
          title: "Test Paper",
          cards: posterCards,
        },
      ],
      activeOutputId: "out_poster_atlas",
    })

    it("produces atlascolors for atlas template", () => {
      const prj = makeProject("atlas")
      const res = generateFullTemplate(prj, prj.outputs[0])
      expect(res).toContain("atlascolors")
    })

    it("produces minimalcolors for minimal template", () => {
      const prj = makeProject("minimal")
      // Pass an outputConfig with templateId="minimal" — the generator reads outputConfig, not project.templateName
      const minimalOutput = { ...prj.outputs[0], templateId: "minimal" }
      const res = generateFullTemplate(prj, minimalOutput)
      expect(res).toContain("minimalcolors")
    })

    it("includes nocite for keys used in card content", () => {
      const prj = makeProject("atlas", [
        makeCard({ pattern: "bullets", content: "Cite \\cite{Foo2020}" }),
        makeCard({ pattern: "references" })
      ])
      const res = generateFullTemplate(prj, prj.outputs[0])
      expect(res).toContain("\\nocite{Foo2020}")
    })
  })
})
