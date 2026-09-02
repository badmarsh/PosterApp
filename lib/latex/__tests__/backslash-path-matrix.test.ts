import { describe, it, expect } from "vitest"
import { generateFullTemplate } from "../generator"
import type { Card, Project, OutputConfig, OutputType } from "@/lib/poster-types"

/**
 * Regression matrix: on Windows, paths built with Node's `path.join()` use
 * backslash separators, and LaTeX parses `\remote` as an undefined control
 * sequence. Every generator must normalize `\` to `/` inside \includegraphics
 * so such paths can never reach the .tex.
 */

const BACKSLASH_A = "assets\\remote\\remote-abc123.jpg"
const BACKSLASH_B = "assets\\remote\\remote-def456.png"
const BACKSLASH_LOGO = "logos\\my-logo.png"

const POSTER_TEMPLATES = ["atlas", "minimal", "gemini", "tikzposter", "a0poster"]
const PAPER_TEMPLATES = [
  "article-single",
  "article-twocol",
  "ieee-conf",
  "acm-sigconf",
  "springer-llncs",
  "jinst-proceedings",
  "pos-proceedings",
]
const SLIDES_TEMPLATES = [
  "beamer-metropolis",
  "beamer-madrid",
  "beamer-default",
  "beamer-focus",
  "beamer-atlas",
]

function fig(url: string) {
  return { id: `fig_${url.length}` as string, url, caption: "" }
}

function card(id: string, pattern: string, figures: Card["figures"]): Card {
  return {
    id,
    title: "Card",
    pattern: pattern as Card["pattern"],
    column: 1,
    order: 1,
    content: "",
    figures,
    figureLayout: "single",
    table: { hasHeader: false, caption: "", rows: [] },
    validation: "valid",
  }
}

const combos: Array<{ outputType: OutputType; templateId: string; cards: Card[] }> = [
  ...POSTER_TEMPLATES.map((templateId) => ({
    outputType: "poster" as const,
    templateId,
    cards: [
      card("p_single", "bullets-image", [fig(BACKSLASH_A)]),
      card("p_two", "bullets-two-images", [fig(BACKSLASH_A), fig(BACKSLASH_B)]),
    ],
  })),
  ...PAPER_TEMPLATES.map((templateId) => ({
    outputType: "paper" as const,
    templateId,
    cards: [
      card("paper_single", "section-figure", [fig(BACKSLASH_A)]),
      card("paper_two", "section-two-figures", [fig(BACKSLASH_A), fig(BACKSLASH_B)]),
    ],
  })),
  ...SLIDES_TEMPLATES.map((templateId) => ({
    outputType: "slides" as const,
    templateId,
    cards: [
      card("slide_fig", "figure-slide", [fig(BACKSLASH_A)]),
      card("slide_two", "two-column", [fig(BACKSLASH_A), fig(BACKSLASH_B)]),
    ],
  })),
]

function includegraphicsPaths(tex: string): string[] {
  const re = /\\includegraphics(?:\[[^\]]*\])?\{([^}]*)\}/g
  const paths: string[] = []
  for (let m = re.exec(tex); m; m = re.exec(tex)) paths.push(m[1])
  return paths
}

describe("backslash paths never reach \\includegraphics in any generator", () => {
  for (const { outputType, templateId, cards } of combos) {
    it(`${outputType}/${templateId} renders all image and logo paths with forward slashes`, () => {
      const output: OutputConfig = {
        id: "out_1",
        title: "Test Output",
        outputType,
        templateId,
        cards,
      }
      const project: Project = {
        id: "ws_bs",
        revision: 1,
        name: "Test Project",
        posterTitle: "Test Output",
        authors: "Author A",
        venue: "Test Venue",
        logoUrl: BACKSLASH_LOGO,
        secondaryLogoUrl: BACKSLASH_LOGO,
        activeOutputId: "out_1",
        outputs: [output],
        assets: [],
        ingestFiles: [],
      }

      // Run both with and without a workspaceId: the raw `f.url` branch
      // (no /api prefix rewriting) is only covered when workspaceId is empty.
      for (const workspaceId of ["ws_bs", ""]) {
        const tex = generateFullTemplate(project, output, workspaceId)

        const paths = includegraphicsPaths(tex)
        expect(paths.length).toBeGreaterThan(0)
        for (const p of paths) {
          expect(p).not.toContain("\\")
        }
        expect(tex).toContain("assets/remote/remote-abc123.jpg")
      }
    })
  }
})