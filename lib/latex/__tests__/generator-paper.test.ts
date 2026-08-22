import { describe, it, expect } from "vitest"
import { StandardPaperGenerator } from "../generator-paper"
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

describe("Generator Paper", () => {
  const makeProject = (templateName: string, posterCards: Card[] = []): Project => ({
    id: "prj_1",
    name: "Test",
    posterTitle: "My Paper Title",
    authors: "John Doe",
    venue: "Test Venue",
    templateName,
    cards: posterCards,
    assets: [],
    ingestFiles: [],
    outputs: [
      {
        id: "out_paper_twocol",
        outputType: "paper",
        templateId: "article-twocol",
        title: "Test Paper",
        cards: posterCards,
      },
    ],
    activeOutputId: "out_paper_twocol",
  })

  it("produces valid article documentclass", () => {
    const prj = makeProject("minimal")
    const res = new StandardPaperGenerator().generateDocument(prj, prj.outputs[0], "prj_1")
    expect(res).toContain("\\documentclass[11pt, a4paper, twocolumn]{article}")
    expect(res).toContain("\\begin{document}")
    expect(res).toContain("\\end{document}")
  })

  it("includes title, author, and date", () => {
    const prj = makeProject("minimal")
    const res = new StandardPaperGenerator().generateDocument(prj, prj.outputs[0], "prj_1")
    expect(res).toContain("\\title{My Paper Title}")
    expect(res).toContain("\\author{John Doe}")
    expect(res).toContain("\\affil{Test Venue}")
    expect(res).toContain("\\maketitle")
  })

  it("includes cards as sections", () => {
    const prj = makeProject("minimal", [
      makeCard({ title: "Introduction", content: "This is intro." }),
      makeCard({ title: "Methods", content: "This is methods." })
    ])
    const res = new StandardPaperGenerator().generateDocument(prj, prj.outputs[0], "prj_1")
    expect(res).toContain("\\section{Introduction}")
    expect(res).toContain("This is intro.")
    expect(res).toContain("\\section{Methods}")
    expect(res).toContain("This is methods.")
  })
})
