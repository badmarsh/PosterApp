import { readFileSync } from "fs"
import { describe, expect, it } from "vitest"
import { stripMarginLineNumbers } from "@/lib/services/margin-line-numbers"

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
  })
})
