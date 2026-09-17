import { describe, it, expect } from "vitest"
import {
  resolveManuscriptAssetUrl,
  preprocessMathAndHtml,
  normalizeStr,
} from "@/components/thesis-review/source-markdown-view"

describe("SourceMarkdownView Helpers & Asset Resolution", () => {
  describe("resolveManuscriptAssetUrl", () => {
    it("resolves MinerU images/ relative path to workspace asset endpoint", () => {
      const result = resolveManuscriptAssetUrl(
        "images/zaverecna_praca_figure_24.jpg",
        "demo_mtfpx0o2"
      )
      expect(result).toBe("/api/workspaces/demo_mtfpx0o2/assets/zaverecna_praca_figure_24.jpg")
    })

    it("resolves plain filename to workspace asset endpoint", () => {
      const result = resolveManuscriptAssetUrl("architecture_diagram.png", "ws_123")
      expect(result).toBe("/api/workspaces/ws_123/assets/architecture_diagram.png")
    })

    it("resolves nested ./images/ relative path properly", () => {
      const result = resolveManuscriptAssetUrl("./images/table_1.jpg", "ws_abc")
      expect(result).toBe("/api/workspaces/ws_abc/assets/table_1.jpg")
    })

    it("preserves external https URLs", () => {
      const url = "https://example.com/figures/chart.png"
      expect(resolveManuscriptAssetUrl(url, "ws_123")).toBe(url)
    })

    it("preserves data: base64 URLs", () => {
      const dataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA"
      expect(resolveManuscriptAssetUrl(dataUri, "ws_123")).toBe(dataUri)
    })

    it("preserves pre-resolved /api/workspaces/ URLs", () => {
      const apiUrl = "/api/workspaces/ws_123/assets/my_fig.jpg"
      expect(resolveManuscriptAssetUrl(apiUrl, "ws_123")).toBe(apiUrl)
    })

    it("handles empty or undefined inputs safely", () => {
      expect(resolveManuscriptAssetUrl("", "ws_123")).toBe("")
      expect(resolveManuscriptAssetUrl(undefined, "ws_123")).toBe("")
      expect(resolveManuscriptAssetUrl("img.jpg", undefined)).toBe("img.jpg")
    })
  })

  describe("preprocessMathAndHtml", () => {
    it("converts LaTeX display bracket math \\[ ... \\] to CommonMark $$ ... $$", () => {
      const input = "Rovnica modelu:\n\\[\\text{score} = \\alpha \\cdot S + \\beta\\]\nkde alfa je váha."
      const output = preprocessMathAndHtml(input)
      expect(output).toContain("$$\n\\text{score} = \\alpha \\cdot S + \\beta\n$$")
    })

    it("converts LaTeX inline bracket math \\( ... \\) to $ ... $", () => {
      const input = "Hodnota \\(E = mc^2\\) je invariantná."
      const output = preprocessMathAndHtml(input)
      expect(output).toContain("$E = mc^2$")
    })

    it("ensures $$ display equations are padded with newlines for block parsing", () => {
      const input = "Pred textom\n$$\\int_0^1 f(x)dx$$\nPo texte"
      const output = preprocessMathAndHtml(input)
      expect(output).toContain("\n\n$$\n\\int_0^1 f(x)dx\n$$\n\n")
    })

    it("handles empty input gracefully", () => {
      expect(preprocessMathAndHtml("")).toBe("")
    })
  })

  describe("normalizeStr", () => {
    it("collapses multi-space and lowercases string for evidence matching", () => {
      expect(normalizeStr("  Hybridný   Párovací  Algoritmus \n\t ")).toBe(
        "hybridný párovací algoritmus"
      )
    })
  })
})
