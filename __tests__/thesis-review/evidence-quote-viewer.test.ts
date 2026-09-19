import { describe, it, expect } from "vitest"
import {
  parseInlineMath,
  parseTableFromText,
  formatPreviewSnippet,
  stripLatexForPlainText,
} from "@/components/thesis-review/evidence-quote-viewer"

describe("evidence-quote-viewer", () => {
  it("splits plain text without math", () => {
    const parts = parseInlineMath("Plain sentence without math")
    expect(parts).toHaveLength(1)
    expect(parts[0]).toEqual({ kind: "text", value: "Plain sentence without math" })
  })

  it("extracts inline math formulas from mixed text", () => {
    const parts = parseInlineMath("Results for $R_2(Q)$ parameter and $k_{\\text{T}}$ [MeV]")
    expect(parts).toHaveLength(5)
    expect(parts[0]).toEqual({ kind: "text", value: "Results for " })
    expect(parts[1]).toEqual({ kind: "math", value: "R_2(Q)" })
    expect(parts[2]).toEqual({ kind: "text", value: " parameter and " })
    expect(parts[3]).toEqual({ kind: "math", value: "k_{\\text{T}}" })
    expect(parts[4]).toEqual({ kind: "text", value: " [MeV]" })
  })

  it("handles LaTeX \\( ... \\) delimiters as math", () => {
    const parts = parseInlineMath("Energy \\(E = mc^2\\) is conserved")
    expect(parts).toHaveLength(3)
    expect(parts[1]).toEqual({ kind: "math", value: "E = mc^2" })
  })

  describe("parseTableFromText", () => {
    it("parses single-line collapsed markdown tables with math cells", () => {
      const collapsedTable =
        "| $k_{\\text{T}}$ [MeV] | $n_{\\text{ch}}$ | $R$ [fm] | $\\lambda$ | | --- | --- | --- | --- | | 100 – 300 | 2 – 9 | $1.444 \\pm 0.062$ | $1.025 \\pm 0.057$ |"

      const parsed = parseTableFromText(collapsedTable)
      expect(parsed).not.toBeNull()
      expect(parsed?.headers).toEqual([
        "$k_{\\text{T}}$ [MeV]",
        "$n_{\\text{ch}}$",
        "$R$ [fm]",
        "$\\lambda$",
      ])
      expect(parsed?.rows).toHaveLength(1)
      expect(parsed?.rows[0]).toEqual([
        "100 – 300",
        "2 – 9",
        "$1.444 \\pm 0.062$",
        "$1.025 \\pm 0.057$",
      ])
    })

    it("parses multi-space separated OCR parameter tables with math", () => {
      const spaceTable = [
        "$\\alpha$    $\\equiv 2$    $\\equiv 1$    $0.81 \\pm 0.01 \\pm 0.18$",
        "$C_0$    $0.9778 \\pm 0.0002$    $0.9740 \\pm 0.0002$    $0.9725 \\pm 0.0003$",
        "$\\lambda$    $0.302 \\pm 0.002 \\pm 0.019$    $0.701 \\pm 0.006 \\pm 0.067$    $1.016 \\pm 0.030 \\pm 0.407$",
        "$R$ [fm]    $1.046 \\pm 0.005 \\pm 0.114$    $2.021 \\pm 0.012 \\pm 0.281$    $2.960 \\pm 0.094 \\pm 1.309$",
        "$\\varepsilon$ [GeV $^{-1}$ ]    $0.0125 \\pm 0.0002$    $0.0153 \\pm 0.0002$    $0.0163 \\pm 0.0002$",
        "$\\chi^2/\\text{ndf}$    $5932 / 95$    $1963 / 95$    $1755 / 94$",
      ].join("\n")

      const parsed = parseTableFromText(spaceTable)
      expect(parsed).not.toBeNull()
      expect(parsed?.rows).toHaveLength(6)
      expect(parsed?.rows[0][0]).toBe("$\\alpha$")
      expect(parsed?.rows[0][1]).toBe("$\\equiv 2$")
      expect(parsed?.rows[0][3]).toBe("$0.81 \\pm 0.01 \\pm 0.18$")
      expect(parsed?.rows[1][0]).toBe("$C_0$")
    })

    it("parses multi-line standard markdown tables", () => {
      const table = [
        "| Parameter | Value |",
        "| --- | --- |",
        "| $\\alpha$ | 1.5 |",
        "| $\\lambda$ | 0.8 |",
      ].join("\n")

      const parsed = parseTableFromText(table)
      expect(parsed).not.toBeNull()
      expect(parsed?.headers).toEqual(["Parameter", "Value"])
      expect(parsed?.rows).toHaveLength(2)
      expect(parsed?.rows[0]).toEqual(["$\\alpha$", "1.5"])
      expect(parsed?.rows[1]).toEqual(["$\\lambda$", "0.8"])
    })

    it("parses multi-space parameter tables with explicit 'fit Gaussian Exponential Lévy' header", () => {
      const fitTable = [
        "renderuj fit    Gaussian    Exponential    Lévy",
        "$\\alpha$    $\\equiv 2$    $\\equiv 1$    $0.81 \\pm 0.01 \\pm 0.18$",
        "$C_0$    $0.9778 \\pm 0.0002$    $0.9740 \\pm 0.0002$    $0.9725 \\pm 0.0003$",
        "$\\lambda$    $0.302 \\pm 0.002 \\pm 0.019$    $0.701 \\pm 0.006 \\pm 0.067$    $1.016 \\pm 0.030 \\pm 0.407$",
      ].join("\n")

      const parsed = parseTableFromText(fitTable)
      expect(parsed).not.toBeNull()
      expect(parsed?.headers).toEqual(["fit", "Gaussian", "Exponential", "Lévy"])
      expect(parsed?.rows).toHaveLength(3)
      expect(parsed?.rows[0][0]).toBe("$\\alpha$")
      expect(parsed?.rows[0][1]).toBe("$\\equiv 2$")
      expect(parsed?.rows[0][3]).toBe("$0.81 \\pm 0.01 \\pm 0.18$")
    })

    it("parses complex multi-experiment tab-separated table with omitted leading cells and right-aligned measurements", () => {
      const expTable = [
        "renderovanie xperiment\t$\\sqrt{s}$ [GeV] colliding p.\tfunction refer. sam.\tpairs\tR [fm]\tλ",
        "Aleph[74][75]\t$91.2, e^{+}e^{-}$\t1.21 MIX\tall\t$0.528 \\pm 0.005$\t$0.362 \\pm 0.006$",
        "1.21 ULS\tall\t$0.777 \\pm 0.007$\t$0.438 \\pm 0.006$",
        "1.21 SIM\t$K_{S}^{0}K_{S}^{0}$\t$0.71 \\pm 0.07 \\pm 0.15$\t$1.4 \\pm 0.3 \\pm 0.4$",
        "Delphi[76][77]\t$91.2, e^{+}e^{-}$\t1.21 ULS\t$K^{\\pm}K^{\\pm}$\t$0.48 \\pm 0.04 \\pm 0.07$\t$0.82 \\pm 0.11 \\pm 0.25$",
        "$91.3 e^{+}e^{-}$\t1.21 ULS\t$\\pi^{\\pm}\\pi^{\\pm}$\t$0.93 \\pm 0.02 \\pm 0.15$\t$0.87 \\pm 0.03 \\pm 0.14$",
        "Zeus[82]\t$27.6\\times 820^{a}ep$\t1.21 ULS\tall\t$0.666 \\pm 0.009^{+0.022}_{-0.036}$\t$0.475 \\pm 0.007^{+0.011}_{-0.003}$",
      ].join("\n")

      const parsed = parseTableFromText(expTable)
      expect(parsed).not.toBeNull()
      expect(parsed?.headers).toHaveLength(6)
      expect(parsed?.headers[0]).toBe("xperiment")
      expect(parsed?.headers[4]).toBe("R [fm]")
      expect(parsed?.headers[5]).toBe("λ")

      expect(parsed?.rows).toHaveLength(6)
      // Row 0 (Aleph): 6 columns
      expect(parsed?.rows[0][0]).toBe("Aleph[74][75]")
      expect(parsed?.rows[0][4]).toBe("$0.528 \\pm 0.005$")
      expect(parsed?.rows[0][5]).toBe("$0.362 \\pm 0.006$")

      // Row 1 (1.21 ULS): 4 columns -> padded with 2 leading empty cells
      expect(parsed?.rows[1][0]).toBe("")
      expect(parsed?.rows[1][1]).toBe("")
      expect(parsed?.rows[1][2]).toBe("1.21 ULS")
      expect(parsed?.rows[1][3]).toBe("all")
      expect(parsed?.rows[1][4]).toBe("$0.777 \\pm 0.007$")
      expect(parsed?.rows[1][5]).toBe("$0.438 \\pm 0.006$")

      // Row 4 ($91.3): 5 columns -> padded with 1 leading empty cell
      expect(parsed?.rows[4][0]).toBe("")
      expect(parsed?.rows[4][1]).toBe("$91.3 e^{+}e^{-}$")
      expect(parsed?.rows[4][2]).toBe("1.21 ULS")
      expect(parsed?.rows[4][4]).toBe("$0.93 \\pm 0.02 \\pm 0.15$")

      // Row 5 (Zeus with asymmetric errors)
      expect(parsed?.rows[5][0]).toBe("Zeus[82]")
      expect(parsed?.rows[5][4]).toBe("$0.666 \\pm 0.009^{+0.022}_{-0.036}$")
    })

    it("returns null for non-table text", () => {
      expect(parseTableFromText("Regular paragraph of text without pipes.")).toBeNull()
    })
  })

  describe("formatPreviewSnippet", () => {
    it("returns short text untruncated", () => {
      const { snippet, isTruncated } = formatPreviewSnippet("Short text with $\\alpha = 1$")
      expect(isTruncated).toBe(false)
      expect(snippet).toBe("Short text with $\\alpha = 1$")
    })

    it("collapses newlines and multiple spaces into single spaces", () => {
      const input = "fit\t\tGaussian\nExponential\n$\\alpha$"
      const { snippet } = formatPreviewSnippet(input, 50)
      expect(snippet).toBe("fit Gaussian Exponential $\\alpha$")
    })

    it("strips outer quotes including curly quotes", () => {
      const input = "“fit Gaussian Exponential Lévy”"
      const { snippet, isTruncated } = formatPreviewSnippet(input)
      expect(isTruncated).toBe(false)
      expect(snippet).toBe("fit Gaussian Exponential Lévy")
    })

    it("expands to close nearby math formula rather than cutting in the middle", () => {
      // Prompt selection:
      const tableSelection = [
        "fit    Gaussian    Exponential    Lévy",
        "$\\alpha$    $\\equiv 2$    $\\equiv 1$    $0.81 \\pm 0.01 \\pm 0.18$",
        "$C_0$    $0.9778 \\pm 0.0002$",
      ].join("\n")

      const { snippet, isTruncated } = formatPreviewSnippet(tableSelection, 85)
      expect(isTruncated).toBe(true)
      // Must contain balanced math delimiters and complete $0.81 \pm 0.01 \pm 0.18$
      expect(snippet).toContain("$0.81 \\pm 0.01 \\pm 0.18$")
      const dollarCount = (snippet.match(/(?<!\\)\$/g) || []).length
      expect(dollarCount % 2).toBe(0)
    })
  })

  describe("stripLatexForPlainText", () => {
    it("converts Greek letters and math operators to Unicode", () => {
      const input = "Measurement of $\\alpha \\pm 0.01$ and $\\lambda = 0.302 \\pm 0.002$"
      const result = stripLatexForPlainText(input)
      expect(result).toBe("Measurement of α ± 0.01 and λ = 0.302 ± 0.002")
    })

    it("unwraps \\text and \\mathrm blocks cleanly", () => {
      const input = "Chi-squared $\\chi^2/\\text{ndf} = 5932/95$ and $k_{\\mathrm{T}}$"
      const result = stripLatexForPlainText(input)
      expect(result).toContain("χ^2/ndf = 5932/95")
      expect(result).toContain("k_T")
    })

    it("handles display math blocks ($$...$$ and \\[...\\])", () => {
      const input = "$$R_2(Q) = C_0 (1 + \\lambda e^{-R^2 Q^2})$$"
      const result = stripLatexForPlainText(input)
      expect(result).toBe("R_2(Q) = C_0 (1 + λ e^-R^2 Q^2)")
    })

    it("handles complex multi-column table cells with math", () => {
      const input = "$\\alpha$    $\\equiv 2$    $\\equiv 1$    $0.81 \\pm 0.01 \\pm 0.18$"
      const result = stripLatexForPlainText(input)
      expect(result).toBe("α ≡ 2 ≡ 1 0.81 ± 0.01 ± 0.18")
    })

    it("returns empty string for empty input", () => {
      expect(stripLatexForPlainText("")).toBe("")
    })
  })
})

