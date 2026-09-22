import { expect, test } from "vitest";
import { BeamerSlidesGenerator } from "../generator-slides";
import type { Project } from "@/lib/poster-types";

test("BeamerSlidesGenerator renders stats hero slide with structure color columns", () => {
  const project: Project = {
    id: "p_test",
    revision: 1,
    name: "Test",
    authors: "Author",
    venue: "Venue",
    activeOutputId: "out1",
    assets: [],
    ingestFiles: [],
    outputs: [
      {
        id: "out1",
        outputType: "slides",
        templateId: "beamer-metropolis",
        title: "Test",
        cards: [
          {
            id: "card_stat_slide",
            pattern: "stats",
            title: "Key Performance Metrics",
            content: "- **98.7%** Accuracy | Across 1,200 test samples\n- **3.42x** Speedup | Over baseline implementation",
            order: 0,
            column: null,
            table: { hasHeader: false, caption: "", rows: [] },
            figureLayout: "single",
            validation: "valid",
            figures: [],
            sourceIds: []
          }
        ]
      }
    ]
  };

  const gen = new BeamerSlidesGenerator("beamer-metropolis");
  const tex = gen.generateDocument(project, project.outputs![0]);
  expect(tex).toContain("\\begin{columns}[t]");
  expect(tex).toContain("98.7\\%");
  expect(tex).toContain("3.42x");
  expect(tex).toContain("\\color{structure}");
});

test("BeamerSlidesGenerator renders graph slide with figure centering", () => {
  const project: Project = {
    id: "p_test",
    revision: 1,
    name: "Test",
    authors: "Author",
    venue: "Venue",
    activeOutputId: "out1",
    assets: [],
    ingestFiles: [],
    outputs: [
      {
        id: "out1",
        outputType: "slides",
        templateId: "beamer-atlas",
        title: "Test",
        cards: [
          {
            id: "card_graph_slide",
            pattern: "graph",
            title: "Convergence Dynamics Plot",
            content: "Training loss curve over 100 epochs.",
            order: 0,
            column: null,
            table: { hasHeader: false, caption: "", rows: [] },
            figureLayout: "single",
            validation: "valid",
            figures: [{ id: "f1", url: "assets/plot.png", caption: "Figure 1: Loss vs Epoch" }],
            sourceIds: []
          }
        ]
      }
    ]
  };

  const gen = new BeamerSlidesGenerator("beamer-atlas");
  const tex = gen.generateDocument(project, project.outputs![0]);
  expect(tex).toContain("\\includegraphics");
  expect(tex).toContain("assets/plot.png");
  expect(tex).toContain("Figure 1: Loss vs Epoch");
});
