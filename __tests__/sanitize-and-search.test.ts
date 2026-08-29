import { describe, it, expect } from "vitest"
import { hasUnsafeLatex } from "@/lib/latex/validation"
import { extractCiteKeys } from "@/lib/bib-parser"
import { cleanCaption } from "@/lib/latex/helpers"
import { parseMarkdownToLatex } from "@/lib/latex/parser"

describe("LaTeX Sanitization & Validation", () => {
  it("allows balanced braces and normal text", () => {
    expect(hasUnsafeLatex("This is regular text with {balanced braces}.")).toEqual([])
    expect(hasUnsafeLatex("Formula: $E = mc^2$")).toEqual([])
  })

  it("safely allows escaped braces \\{ and \\}", () => {
    expect(hasUnsafeLatex("Set notation: \\{1, 2, 3\\}")).toEqual([])
    expect(hasUnsafeLatex("Single brace \\{ in text")).toEqual([])
    expect(hasUnsafeLatex("Nested escaped: {\\{a, b\\}}")).toEqual([])
  })

  it("detects unbalanced unescaped braces", () => {
    expect(hasUnsafeLatex("Unclosed { brace")).toContain("unbalanced {}")
    expect(hasUnsafeLatex("Unopened } brace")).toContain("unbalanced {}")
    expect(hasUnsafeLatex("Mismatched {a} {b")).toContain("unbalanced {}")
  })

  it("detects dangerous TeX control sequences", () => {
    expect(hasUnsafeLatex("\\write18{rm -rf /}")).toContain("prohibited command \\write")
    expect(hasUnsafeLatex("\\input{/etc/passwd}")).toContain("prohibited command \\input")
    expect(hasUnsafeLatex("\\openout\\stream=test.tex")).toContain("prohibited command \\openout")
    expect(hasUnsafeLatex("\\catcode`\\$=11")).toContain("prohibited command \\catcode")
  })
})

describe("Citation Key Extraction & Parsing", () => {
  it("extracts standard \\cite keys", () => {
    const text = "As shown in \\cite{vaswani2017attention} and \\cite{brown2020language,devlin2018bert}."
    const keys = extractCiteKeys(text)
    expect(keys).toContain("vaswani2017attention")
    expect(keys).toContain("brown2020language")
    expect(keys).toContain("devlin2018bert")
  })

  it("extracts \\citep, \\citet, \\nocite, and \\autocite keys", () => {
    const text = "Previous work \\citep{vaswani2017attention}, \\citet{devlin2018bert}, and \\nocite{radford2019language,touvron2023llama} with \\autocite{he2016resnet}."
    const keys = extractCiteKeys(text)
    expect(keys).toContain("vaswani2017attention")
    expect(keys).toContain("devlin2018bert")
    expect(keys).toContain("radford2019language")
    expect(keys).toContain("touvron2023llama")
    expect(keys).toContain("he2016resnet")
  })

  it("extracts markdown bracket citations with semicolons and commas", () => {
    const text = "Deep networks [@vaswani2017attention; @brown2020language, @devlin2018bert] perform well."
    const keys = extractCiteKeys(text)
    expect(keys).toContain("vaswani2017attention")
    expect(keys).toContain("brown2020language")
    expect(keys).toContain("devlin2018bert")
  })

  it("converts markdown citations to LaTeX in parseMarkdownToLatex", () => {
    const text = "See [@vaswani2017; @brown2020]."
    const tex = parseMarkdownToLatex(text)
    expect(tex).toContain("\\cite{vaswani2017, brown2020}")
  })
})

describe("Caption Sanitization Helper", () => {
  it("cleans redundant Figure prefixes", () => {
    expect(cleanCaption("Figure 1: Architecture diagram", "Figure")).toBe("Architecture diagram")
    expect(cleanCaption("Fig. 2. Loss curve", "Figure")).toBe("Loss curve")
    expect(cleanCaption("Figure: Overview", "Figure")).toBe("Overview")
    expect(cleanCaption("A clean caption without prefix", "Figure")).toBe("A clean caption without prefix")
  })

  it("cleans redundant Table prefixes", () => {
    expect(cleanCaption("Table 1: Benchmark results", "Table")).toBe("Benchmark results")
    expect(cleanCaption("Table 2 Quantitative metrics", "Table")).toBe("Quantitative metrics")
    expect(cleanCaption("Clean table caption", "Table")).toBe("Clean table caption")
  })

  it("safely handles undefined or empty captions", () => {
    expect(cleanCaption(undefined, "Figure")).toBe("")
    expect(cleanCaption("", "Table")).toBe("")
  })
})

describe("Math Parsing & Fitmath Wrapping", () => {
  it("wraps display math in equation* and fitmath", () => {
    const text = "$$E = mc^2$$"
    const parsed = parseMarkdownToLatex(text)
    expect(parsed).toContain("\\begin{equation*}\\fitmath{E = mc^2}\\end{equation*}")
  })

  it("keeps inline math intact without wrapping in fitmath", () => {
    const text = "The value is $x = 5$ in this case."
    const parsed = parseMarkdownToLatex(text)
    expect(parsed).toContain("$x = 5$")
    expect(parsed).not.toContain("\\fitmath")
  })
})

describe("Asset Search Matching Logic", () => {
  const assets = [
    { id: "1", kind: "figure", caption: "Figure 1: Loss curves across epochs", filename: "loss.png", page: 3 },
    { id: "2", kind: "table", caption: "Table 1: Accuracy on ImageNet", tableRows: [["Model", "Acc"], ["ResNet", "76%"]], page: 4 },
    { id: "3", kind: "equation", snippet: "\\mathcal{L}_{total} = \\sum W_i^2", caption: "Variational loss", page: 2 },
    { id: "4", kind: "text", heading: "Methodology", snippet: "We introduce adaptive attention gating.", page: 1 },
  ]

  function matches(a: any, query: string): boolean {
    const q = query.trim().toLowerCase()
    if (!q) return true
    const captionMatch = a.caption?.toLowerCase().includes(q)
    const snippetMatch = a.snippet?.toLowerCase().includes(q)
    const headingMatch = a.heading?.toLowerCase().includes(q)
    const filenameMatch = a.filename?.toLowerCase().includes(q)
    const pageMatch = a.page ? `p.${a.page}`.includes(q) || `page ${a.page}`.includes(q) || String(a.page) === q : false
    const tableMatch = a.tableRows ? JSON.stringify(a.tableRows).toLowerCase().includes(q) : false
    return Boolean(captionMatch || snippetMatch || headingMatch || filenameMatch || pageMatch || tableMatch)
  }

  it("filters assets by caption keyword", () => {
    const results = assets.filter(a => matches(a, "curves"))
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe("1")
  })

  it("filters assets by table content", () => {
    const results = assets.filter(a => matches(a, "resnet"))
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe("2")
  })

  it("filters assets by equation formula", () => {
    const results = assets.filter(a => matches(a, "mathcal"))
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe("3")
  })

  it("filters assets by page number", () => {
    const results = assets.filter(a => matches(a, "p.2"))
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe("3")
  })
})
