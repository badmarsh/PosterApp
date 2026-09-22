import { expect, test, describe } from "vitest"
import { BeamerSlidesGenerator } from "../generator-slides"
import type { Project, OutputConfig } from "@/lib/poster-types"

const mockProject: Project = {
  id: "test",
  revision: 1,
  name: "Test slides",
  authors: "Author",
  venue: "Venue",
  activeOutputId: "out1",
  assets: [],
  ingestFiles: [],
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

  test("does not generate redundant empty frame for title-slide pattern", () => {
    const projectWithTitleSlide: Project = {
      ...mockProject,
      outputs: [
        {
          ...mockProject.outputs![0],
          cards: [
            {
              id: "c_title",
              pattern: "title-slide",
              title: "Title Slide",
              content: "",
              order: 0,
              column: null,
              table: { hasHeader: false, caption: "", rows: [] },
              figureLayout: "single",
              validation: "valid",
              figures: [],
              slideNotes: "Opening remarks"
            },
            ...mockProject.outputs![0].cards
          ]
        }
      ]
    }
    const generator = new BeamerSlidesGenerator("beamer-default")
    const tex = generator.generateDocument(projectWithTitleSlide, projectWithTitleSlide.outputs![0])
    expect(tex).not.toContain("\\begin{frame}{Title Slide}")
    expect(tex).toContain("\\note{Opening remarks}")
  })

  test("emits proper newline separation and balanced braces for captions", () => {
    const projectWithCaption: Project = {
      ...mockProject,
      outputs: [
        {
          ...mockProject.outputs![0],
          cards: [
            {
              id: "c_fig",
              pattern: "figure-slide",
              title: "Figure Slide",
              content: "",
              order: 0,
              column: null,
              table: { hasHeader: false, caption: "", rows: [] },
              figureLayout: "single",
              validation: "valid",
              figures: [{ url: "assets/fig.png", id: "f1", caption: "Caption with $x=1$" }]
            }
          ]
        }
      ]
    }
    const generator = new BeamerSlidesGenerator("beamer-default")
    const tex = generator.generateDocument(projectWithCaption, projectWithCaption.outputs![0])
    expect(tex).toContain("{\\footnotesize")
    const openBraces = (tex.match(/(?<!\\)\{/g) || []).length
    const closeBraces = (tex.match(/(?<!\\)\}/g) || []).length
    expect(openBraces).toBe(closeBraces)
  })

  test("emits bibliography with template-specific bibstyle", () => {
    const projectWithRefs: Project = {
      ...mockProject,
      outputs: [
        {
          ...mockProject.outputs![0],
          cards: [
            {
              id: "c_refs",
              pattern: "references",
              title: "References",
              content: "",
              order: 0,
              column: null,
              table: { hasHeader: false, caption: "", rows: [] },
              figureLayout: "single",
              validation: "valid",
              figures: []
            }
          ]
        }
      ]
    }
    const generator = new BeamerSlidesGenerator("beamer-metropolis")
    const tex = generator.generateDocument(projectWithRefs, projectWithRefs.outputs![0])
    expect(tex).toContain("\\bibliographystyle{plain}")
    expect(tex).toContain("\\bibliography{references}")
  })
})
