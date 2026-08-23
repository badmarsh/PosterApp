import { expect, test, describe } from "vitest"
import { BeamerSlidesGenerator } from "../generator-slides"
import type { Project, OutputConfig } from "@/lib/poster-types"

const mockProject: Project = {
  id: "test",
  name: "Test slides",
  posterTitle: "Test slides",
  authors: "Author",
  venue: "Venue",
  activeOutputId: "out1",
  cards: [],
  assets: [],
  ingestFiles: [],
  templateName: "atlas",
  outputs: [
    {
      id: "out1",
      outputType: "slides",
      templateId: "beamer-default",
      title: "Test slides",
      cards: [
        {
          id: "c1",
          pattern: "bullets-image",
          title: "My Slide",
          content: "Content",
          order: 0,
          column: null,
          table: { hasHeader: false, caption: "", rows: [] },
          figureLayout: "single",
          validation: "valid",
          figures: [{ url: "/api/workspaces/test/assets/img.png", id: "fig1", caption: "" }]
        },
        {
          id: "c2",
          pattern: "bullets",
          title: "Notes Slide",
          content: "Content",
          order: 1,
          column: null,
          table: { hasHeader: false, caption: "", rows: [] },
          figureLayout: "single",
          validation: "valid",
          figures: [],
          slideNotes: "Here are some notes"
        }
      ]
    }
  ]
}

describe("BeamerSlidesGenerator", () => {
  test("generates beamer-metropolis theme", () => {
    const generator = new BeamerSlidesGenerator("beamer-metropolis")
    const tex = generator.generateDocument(mockProject, mockProject.outputs![0])
    expect(tex).toContain("\\usetheme{metropolis}")
  })

  test("generates beamer-atlas theme with colors", () => {
    const generator = new BeamerSlidesGenerator("beamer-atlas")
    const tex = generator.generateDocument(mockProject, mockProject.outputs![0])
    expect(tex).toContain("\\usetheme{Madrid}")
    expect(tex).toContain("\\definecolor{atlasred}{RGB}{158,43,47}")
    expect(tex).toContain("\\setbeamercolor{structure}{fg=atlasred}")
  })

  test("generates \\includegraphics for figure-slide", () => {
    const generator = new BeamerSlidesGenerator("beamer-default")
    const tex = generator.generateDocument(mockProject, mockProject.outputs![0], "test")
    expect(tex).toContain("\\includegraphics")
    expect(tex).toContain("assets/img.png") // assetUrlToLatexPath strips the URL
  })

  test("generates \\note{} for slideNotes", () => {
    const generator = new BeamerSlidesGenerator("beamer-default")
    const tex = generator.generateDocument(mockProject, mockProject.outputs![0])
    expect(tex).toContain("\\note{Here are some notes}")
  })
})
