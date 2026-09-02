import { describe, it, expect } from "vitest"
import { TikzPosterGenerator } from "../generator-poster"
import { StandardPaperGenerator } from "../generator-paper"
import { BeamerSlidesGenerator } from "../generator-slides"
import type { Card, Project, OutputConfig } from "@/lib/poster-types"

function createMockProject(card: Card, outputType: "poster" | "paper" | "slides", templateId: string): { project: Project; output: OutputConfig } {
  const output: OutputConfig = {
    id: "out_1",
    title: "Test Output",
    outputType,
    templateId,
    cards: [card],
  }
  const project: Project = {
    id: "ws_test_figs",
    revision: 1,
    name: "Test Project",
    posterTitle: "Neural Representation",
    authors: "Author A",
    venue: "ICML",
    activeOutputId: "out_1",
    outputs: [output],
    assets: [],
    ingestFiles: [],
  }
  return { project, output }
}

describe("Figure Generation in Posters", () => {
  const gen = new TikzPosterGenerator("atlas")

  it("renders a single figure with clean caption and keepaspectratio", () => {
    const card: Card = {
      id: "card_1",
      title: "Model Architecture",
      pattern: "bullets-image",
      column: 1,
      order: 1,
      content: "Overview of the network",
      figures: [{ id: "fig_1", url: "/api/workspaces/ws_test_figs/assets/fig1.png", caption: "Figure 1: Pipeline diagram" }],
      figureLayout: "single",
      table: { hasHeader: false, caption: "", rows: [] },
      validation: "valid",
    }
    const { project, output } = createMockProject(card, "poster", "atlas")
    const tex = gen.generateDocument(project, output, "ws_test_figs")

    expect(tex).toContain("\\includegraphics[width=1.0\\linewidth,keepaspectratio]{assets/fig1.png}")
    expect(tex).toContain("Pipeline diagram")
    expect(tex).not.toContain("Figure 1: Figure 1:")
  })

  it("renders two subfigures side by side with minipages", () => {
    const card: Card = {
      id: "card_2",
      title: "Results",
      pattern: "bullets-two-images",
      column: 2,
      order: 1,
      content: "Loss and accuracy curves",
      figures: [
        { id: "fig_loss", url: "/api/workspaces/ws_test_figs/assets/loss.png", caption: "Fig. 1 Loss" },
        { id: "fig_acc", url: "/api/workspaces/ws_test_figs/assets/acc.png", caption: "Accuracy" },
      ],
      figureLayout: "two-up",
      table: { hasHeader: false, caption: "", rows: [] },
      validation: "valid",
    }
    const { project, output } = createMockProject(card, "poster", "atlas")
    const tex = gen.generateDocument(project, output, "ws_test_figs")

    expect(tex).toContain("0.495\\linewidth")
    expect(tex).toContain("assets/loss.png")
    expect(tex).toContain("assets/acc.png")
  })
})

describe("Figure Generation in Papers", () => {
  const gen = new StandardPaperGenerator("article-twocol")

  it("renders single figure with keepaspectratio in paper", () => {
    const card: Card = {
      id: "card_paper_1",
      title: "Method",
      pattern: "section-figure",
      column: 1,
      order: 1,
      content: "Detailed algorithm.",
      figures: [{ id: "fig_arch", url: "/api/workspaces/ws_test_figs/assets/arch.png", caption: "Figure 2: Architecture overview." }],
      figureLayout: "single",
      table: { hasHeader: false, caption: "", rows: [] },
      validation: "valid",
    }
    const { project, output } = createMockProject(card, "paper", "article-twocol")
    const tex = gen.generateDocument(project, output, "ws_test_figs")

    expect(tex).toContain("\\begin{figure*}[htbp]")
    expect(tex).toContain("\\includegraphics[width=\\linewidth,keepaspectratio]{assets/arch.png}")
    expect(tex).toContain("\\caption{Architecture overview.}")
  })

  it("renders two subfigures with minipages in two-column paper", () => {
    const card: Card = {
      id: "card_paper_2",
      title: "Ablation",
      pattern: "section-two-figures",
      column: 2,
      order: 1,
      content: "Component trade-offs.",
      figures: [
        { id: "fig_abl_a", url: "/api/workspaces/ws_test_figs/assets/abl_a.png", caption: "Trade-off A" },
        { id: "fig_abl_b", url: "/api/workspaces/ws_test_figs/assets/abl_b.png", caption: "Trade-off B" },
      ],
      figureLayout: "two-up",
      table: { hasHeader: false, caption: "", rows: [] },
      validation: "valid",
    }
    const { project, output } = createMockProject(card, "paper", "article-twocol")
    const tex = gen.generateDocument(project, output, "ws_test_figs")

    expect(tex).toContain("0.48\\linewidth")
    expect(tex).toContain("assets/abl_a.png")
    expect(tex).toContain("assets/abl_b.png")
  })
})

describe("Windows backslash path normalization", () => {
  it("converts backslash separators to forward slashes in poster figures", () => {
    const card: Card = {
      id: "card_win",
      title: "Remote Fig",
      pattern: "bullets-image",
      column: 1,
      order: 1,
      content: "Remote figure",
      figures: [{ id: "fig_win", url: "assets\\remote\\remote-abc123.jpg", caption: "" }],
      figureLayout: "single",
      table: { hasHeader: false, caption: "", rows: [] },
      validation: "valid",
    }
    const { project, output } = createMockProject(card, "poster", "atlas")
    const tex = new TikzPosterGenerator("atlas").generateDocument(project, output, "ws_test_figs")
    expect(tex).toContain("\\includegraphics[width=1.0\\linewidth,keepaspectratio]{assets/remote/remote-abc123.jpg}")
    expect(tex).not.toContain("\\includegraphics[width=1.0\\linewidth,keepaspectratio]{assets\\remote")
  })

  it("converts backslash separators in paper figures", () => {
    const card: Card = {
      id: "card_win_paper",
      title: "Remote Fig",
      pattern: "section-figure",
      column: 1,
      order: 1,
      content: "Remote figure.",
      figures: [{ id: "fig_win", url: "assets\\remote\\remote-def456.png", caption: "" }],
      figureLayout: "single",
      table: { hasHeader: false, caption: "", rows: [] },
      validation: "valid",
    }
    const { project, output } = createMockProject(card, "paper", "article-twocol")
    const tex = new StandardPaperGenerator("article-twocol").generateDocument(project, output, "ws_test_figs")
    expect(tex).toContain("{assets/remote/remote-def456.png}")
    expect(tex).not.toContain("{assets\\remote")
  })

  it("converts backslash separators in slide figures", () => {
    const card: Card = {
      id: "card_win_slide",
      title: "Remote Fig",
      pattern: "figure-slide",
      column: 1,
      order: 1,
      content: "Remote figure.",
      figures: [{ id: "fig_win", url: "assets\\remote\\remote-abc789.jpg", caption: "" }],
      figureLayout: "single",
      table: { hasHeader: false, caption: "", rows: [] },
      validation: "valid",
    }
    const { project, output } = createMockProject(card, "slides", "beamer-metropolis")
    const tex = new BeamerSlidesGenerator("beamer-metropolis").generateDocument(project, output, "ws_test_figs")
    expect(tex).toContain("{assets/remote/remote-abc789.jpg}")
    expect(tex).not.toContain("{assets\\remote")
  })
})

describe("Figure Generation in Slides", () => {
  const gen = new BeamerSlidesGenerator("beamer-metropolis")

  it("renders figure slide with keepaspectratio and height constraint", () => {
    const card: Card = {
      id: "card_slide_1",
      title: "Network Architecture",
      pattern: "figure-slide",
      column: 1,
      order: 1,
      content: "Key components of the model.",
      figures: [{ id: "fig_slide", url: "/api/workspaces/ws_test_figs/assets/slide_fig.png", caption: "Overall System" }],
      figureLayout: "single",
      table: { hasHeader: false, caption: "", rows: [] },
      validation: "valid",
    }
    const { project, output } = createMockProject(card, "slides", "beamer-metropolis")
    const tex = gen.generateDocument(project, output, "ws_test_figs")

    expect(tex).toContain("keepaspectratio")
    expect(tex).toContain("assets/slide_fig.png")
    expect(tex).toContain("Overall System")
  })
})
