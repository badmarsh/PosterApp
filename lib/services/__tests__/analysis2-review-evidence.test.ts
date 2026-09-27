import { readFileSync } from "fs"
import { describe, expect, it } from "vitest"

describe("Analysis_2 review evidence", () => {
  it("cites only exact spans of the cleaned chapter", () => {
    const chapter = readFileSync("artifacts/analysis-2/manuscript.clean.md", "utf8")
    const review = JSON.parse(readFileSync("artifacts/analysis-2/findings.json", "utf8"))
    const quotes: string[] = []
    for (const finding of review.findings) {
      for (const ev of finding.evidence) quotes.push(ev.quote)
    }
    expect(quotes.length).toBeGreaterThan(10)
    for (const quote of quotes) {
      expect(chapter.includes(quote), quote.slice(0, 80)).toBe(true)
      const at = chapter.indexOf(quote)
      const ev = review.findings.flatMap((f: { evidence: Array<{ quote: string; startOffset: number }> }) => f.evidence).find((e: { quote: string }) => e.quote === quote)
      expect(ev.startOffset).toBe(at)
    }
  })
})
