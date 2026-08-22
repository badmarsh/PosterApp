import { describe, expect, it } from "vitest"
import { BeamerSlidesGenerator } from "../generator-slides"
import { sampleProject } from "@/lib/mock-data"
import type { OutputConfig } from "@/lib/poster-types"

describe("BeamerSlidesGenerator", () => {
  it("generates \\usetheme{metropolis} for beamer-metropolis template", () => {
    const generator = new BeamerSlidesGenerator("beamer-metropolis")
    const outputConfig: OutputConfig = {
      id: "out-1",
      outputType: "slides",
      title: "Test Slides",
      templateId: "beamer-metropolis",
      cards: []
    }
    const tex = generator.generateDocument(sampleProject, outputConfig)
    expect(tex).toContain("\\usetheme{metropolis}")
  })

  it("generates \\includegraphics for figure-slide pattern", () => {
    const generator = new BeamerSlidesGenerator()
    const outputConfig: OutputConfig = {
      id: "out-1",
      outputType: "slides",
      title: "Test Slides",
      templateId: "beamer-default",
      cards: [
        {
          id: "card-1",
          pattern: "figure-slide",
          title: "Figure Slide",
          content: "Some content",
          figures: [{ url: "test.png", caption: "Test figure" }],
          table: { hasHeader: false, rows: [] },
          order: 0
        }
      ]
    }
    const tex = generator.generateDocument(sampleProject, outputConfig)
    expect(tex).toContain("\\includegraphics")
    expect(tex).toContain("test.png")
    expect(tex).toContain("Test figure")
  })

  it("generates \\note{...} when slideNotes is set", () => {
    const generator = new BeamerSlidesGenerator()
    const outputConfig: OutputConfig = {
      id: "out-1",
      outputType: "slides",
      title: "Test Slides",
      templateId: "beamer-default",
      cards: [
        {
          id: "card-1",
          pattern: "bullets",
          title: "Note Slide",
          content: "Some content",
          slideNotes: "Speaker notes go here",
          figures: [],
          table: { hasHeader: false, rows: [] },
          order: 0
        }
      ]
    }
    const tex = generator.generateDocument(sampleProject, outputConfig)
    expect(tex).toContain("\\note{Speaker notes go here}")
  })
})
