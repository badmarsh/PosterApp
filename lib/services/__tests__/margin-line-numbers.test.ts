import { readFileSync } from "fs"
import { describe, expect, it } from "vitest"
import { cleanExtractedPdfMarkdown, stripMarginLineNumbers, stripRunningHeaders } from "@/lib/services/margin-line-numbers"

describe("stripRunningHeaders", () => {
  it("drops a repeated running head and keeps the real section heading", () => {
    const text = [
      "### Chapter 6",
      "### 6.2 Fit setup",
      "The likelihood is maximised.",
      "## 6.2. Fit setup 41",
      "42 Chapter 6. Extraction of JES and JER",
      "## 6.2. Fit setup 43",
      "3.0.1 Particle-level object definitions",
    ].join("\n")
    const out = stripRunningHeaders(text)
    expect(out.stripped).toBeGreaterThanOrEqual(3)
    expect(out.text).toContain("### Chapter 6")
    expect(out.text).toContain("### 6.2 Fit setup")
    expect(out.text).toContain("The likelihood is maximised.")
    expect(out.text).toContain("3.0.1 Particle-level object definitions")
    expect(out.text).not.toContain("Fit setup 41")
    expect(out.text).not.toContain("42 Chapter 6")
  })

  it("does not drop a section title that appears once", () => {
    const text = "### 9.1 A unique section title\nThe paragraph."
    expect(stripRunningHeaders(text).stripped).toBe(0)
  })
})

describe("stripMarginLineNumbers", () => {
  it("does not touch ordinary numbered prose", () => {
    const text = ["1. Introduction", "20 GeV jets were selected.", "The 2015 dataset is used."].join("\n")
    const out = stripMarginLineNumbers(text)
    expect(out.applied).toBe(false)
    expect(out.text).toBe(text)
  })

  it("strips a monotonic ATLAS-note gutter and keeps the prose", () => {
    const lines = Array.from({ length: 50 }, (_, i) => `${100 + i} Sentence ${i} about the W boson mass.`)
    lines.splice(10, 0, "105 ATLAS Data")
    const out = stripMarginLineNumbers(lines.join("\n"))
    expect(out.applied).toBe(true)
    expect(out.stripped).toBeGreaterThanOrEqual(40)
    expect(out.text).toContain("Sentence 0 about the W boson mass.")
    expect(out.text).not.toMatch(/^100 Sentence/m)
    expect(out.text).toContain("105 ATLAS Data")
  })

  it("cleans the extracted Analysis_2 manuscript when that file is present", () => {
    let raw = ""
    try {
      raw = readFileSync("artifacts/analysis-2/manuscript.md", "utf8")
    } catch {
      return
    }
    const out = stripMarginLineNumbers(raw)
    expect(out.applied).toBe(true)
    expect(out.stripped).toBeGreaterThan(200)
    expect(out.text).toContain("The use of hadronically decaying W boson")
    expect(out.text).not.toMatch(/^97 The use of hadronically/m)
    expect(out.text).toContain("2.1 Reco-to-truth matching")
    expect(out.text).not.toMatch(/^162 2\.1 Reco-to-truth/m)
    expect(out.text).toContain("Section ??")
    const cleaned = cleanExtractedPdfMarkdown(raw)
    expect(cleaned.runningHeadersStripped).toBeGreaterThan(20)
    expect(cleaned.text).not.toContain("## 6.2. Fit setup 41")
    expect(cleaned.text).toContain("### 6.2 Fit setup")
    expect(cleaned.text).toContain("3.0.1 Particle-level object definitions")
  })
})
