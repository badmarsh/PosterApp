import { describe, it, expect } from "vitest"
import {
  resolveManuscriptAssetUrl,
  preprocessMathAndHtml,
  normalizeStr,
  chunkManuscriptMarkdown,
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

  describe("chunkManuscriptMarkdown", () => {
    it("handles empty or whitespace markdown safely", () => {
      expect(chunkManuscriptMarkdown("")).toEqual([])
      expect(chunkManuscriptMarkdown("   \n\n  ")).toEqual([])
    })

    it("splits markdown cleanly by ATX headings (#, ##, ###)", () => {
      const doc = `# 1. Úvod
Tento text patrí do úvodu práce.

## 1.1 Motivácia
Motiváciou pre prácu je zrýchlenie recenzného procesu.

# 2. Metodika
Tu popisujeme metódy a modely.`

      const chunks = chunkManuscriptMarkdown(doc)
      expect(chunks).toHaveLength(3)
      expect(chunks[0].heading).toBe("1. Úvod")
      expect(chunks[0].rawText).toContain("# 1. Úvod")
      expect(chunks[0].rawText).toContain("Tento text patrí do úvodu")

      expect(chunks[1].heading).toBe("1.1 Motivácia")
      expect(chunks[1].rawText).toContain("## 1.1 Motivácia")

      expect(chunks[2].heading).toBe("2. Metodika")
      expect(chunks[2].rawText).toContain("# 2. Metodika")
    })

    it("does not split headings inside fenced code blocks", () => {
      const doc = `# Skript
\`\`\`python
# Toto je komentár v kóde, nie nadpis sekcie
x = 10
\`\`\`
Text po kóde.`

      const chunks = chunkManuscriptMarkdown(doc)
      expect(chunks).toHaveLength(1)
      expect(chunks[0].heading).toBe("Skript")
      expect(chunks[0].rawText).toContain("# Toto je komentár v kóde")
    })

    it("keeps multi-line $$...$$ display math blocks whole without splitting", () => {
      const doc = `# Matematický model
Rovnica straty:
$$
\\mathcal{L}(y, \\hat{y}) = -\\sum_{i=1}^n y_i \\log \\hat{y}_i
$$
Následná interpretácia.`

      const chunks = chunkManuscriptMarkdown(doc)
      expect(chunks).toHaveLength(1)
      expect(chunks[0].rawText).toContain("\\mathcal{L}(y, \\hat{y})")
    })

    it("keeps HTML table blocks intact", () => {
      const doc = `# Tabuľka výsledkov
<table>
<tr><th>Model</th><th>F1</th></tr>
<tr><td>Baseline</td><td>0.82</td></tr>
</table>
Zhodnotenie tabuľky.`

      const chunks = chunkManuscriptMarkdown(doc)
      expect(chunks).toHaveLength(1)
      expect(chunks[0].rawText).toContain("<table>")
      expect(chunks[0].rawText).toContain("</table>")
    })

    it("splits large text without headings on paragraph boundaries when exceeding maxChunkChars", () => {
      const p1 = "A".repeat(200)
      const p2 = "B".repeat(200)
      const p3 = "C".repeat(200)
      const longDoc = `${p1}\n\n${p2}\n\n${p3}`

      // Force low maxChunkChars to test paragraph split
      const chunks = chunkManuscriptMarkdown(longDoc, 300)
      expect(chunks.length).toBeGreaterThanOrEqual(2)
      for (const chunk of chunks) {
        expect(chunk.rawText.trim().length).toBeGreaterThan(0)
      }
    })
  })
})
