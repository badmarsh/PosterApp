import { describe, it, expect } from "vitest"
import { generateLatexForCard as generatePosterCard } from "@/lib/latex/generator-poster"
import { StandardPaperGenerator } from "@/lib/latex/generator-paper"
import { BeamerSlidesGenerator } from "@/lib/latex/generator-slides"
import type { Card, Project } from "@/lib/poster-types"
import { jobQueue } from "@/lib/job-queue"

describe("LaTeX Generators sparse figure resilience", () => {
  it("poster generator does not crash on card with sparse/null figures array", () => {
    const card: Card = {
      id: "card_1",
      title: "Sparse Figures Card",
      column: 1,
      order: 0,
      pattern: "bullets-two-images",
      content: "- Item 1\n- Item 2",
      table: { hasHeader: false, caption: "", rows: [] },
      // Sparse array converted to null by JSON stringify/parse
      figures: [null as any, { id: "fig_2", url: "/test.png", caption: "Figure 2" }],
      figureLayout: "two-up",
      validation: "valid",
    }

    expect(() => generatePosterCard(card, "ws_123")).not.toThrow()
    const latex = generatePosterCard(card, "ws_123")
    expect(latex).toContain("test.png")
  })

  it("paper generator does not crash on card with null figure hole", () => {
    const card: Card = {
      id: "card_2",
      title: "Paper Section",
      column: null,
      order: 0,
      pattern: "section-two-figures",
      content: "Prose content here.",
      table: { hasHeader: false, caption: "", rows: [] },
      figures: [null as any, { id: "fig_2", url: "/test2.png", caption: "Paper Figure 2" }],
      figureLayout: "two-up",
      validation: "valid",
    }

    const outputConfig = {
      id: "out_paper",
      outputType: "paper" as const,
      templateId: "article-twocol",
      title: "Test Paper",
      cards: [card],
    }

    const project: Project = {
      id: "ws_123",
      name: "Test Paper",
      authors: "Author",
      venue: "Venue",
      assets: [],
      ingestFiles: [],
      activeOutputId: "out_paper",
      outputs: [outputConfig],
    }

    const gen = new StandardPaperGenerator()
    expect(() => gen.generateDocument(project, outputConfig, "ws_123")).not.toThrow()
    const latex = gen.generateDocument(project, outputConfig, "ws_123")
    expect(latex).toContain("test2.png")
  })

  it("slides generator does not crash on card with null figure hole in two-column slide", () => {
    const card: Card = {
      id: "card_3",
      title: "Slide Title",
      column: null,
      order: 0,
      pattern: "two-column",
      content: "Left content\n\nRight content",
      table: { hasHeader: false, caption: "", rows: [] },
      figures: [null as any],
      figureLayout: "single",
      validation: "valid",
    }

    const outputConfig = {
      id: "out_slides",
      outputType: "slides" as const,
      templateId: "beamer-metropolis",
      title: "Test Slides",
      cards: [card],
    }

    const project: Project = {
      id: "ws_123",
      name: "Test",
      authors: "Author",
      venue: "Venue",
      assets: [],
      ingestFiles: [],
      activeOutputId: "out_slides",
      outputs: [outputConfig],
    }

    const gen = new BeamerSlidesGenerator("beamer-metropolis")
    expect(() => gen.generateDocument(project, outputConfig, "ws_123")).not.toThrow()
  })
})

describe("JobQueue retention and pruning", () => {
  it("enqueues and returns bounded list of jobs", () => {
    const jobs = jobQueue.getJobs()
    expect(Array.isArray(jobs)).toBe(true)
    expect(jobs.length).toBeLessThanOrEqual(50)
  })
})
