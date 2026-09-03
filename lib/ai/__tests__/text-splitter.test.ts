import { describe, it, expect } from "vitest"
import { splitIntoSubchunks, splitIntoAtomicUnits } from "@/lib/ai/text-splitter"

const para =
  "Model dosiahol presnosť 94.2% (tab. 3). Hodnota p<0.05 bola významná. Rovnica (2.1) definuje stratu pre i=1..N. Pozri obr. 4.2 a kap. 3.1.4 pre detaily. Koniec odseku. "

describe("splitIntoSubchunks", () => {
  it("does not drop decimals, abbreviations or section numbers", () => {
    const text = para.repeat(20)
    const out = splitIntoSubchunks(text, 1800, 200)
    const joined = out.join(" ")
    expect(joined).toContain("94.2%")
    expect(joined).toContain("p<0.05")
    expect(joined).toContain("obr. 4.2 a kap. 3.1.4")
    // Nothing lost: total kept ≥ input (overlap adds, never removes)
    expect(joined.replace(/\s+/g, "").length).toBeGreaterThanOrEqual(text.replace(/\s+/g, "").length)
    for (const c of out) expect(c.length).toBeLessThanOrEqual(1800)
  })

  it("keeps markdown tables and $$ blocks atomic", () => {
    const table = "| Model | Acc |\n|---|---|\n| CNN | 0.91 |\n| RNN | 0.87 |"
    const eq = "$$\nL = \\sum_i y_i \\log \\hat{y}_i\n$$"
    const text = `${para}\n\n${table}\n\n${eq}\n\n${para.repeat(30)}`
    const units = splitIntoAtomicUnits(text)
    expect(units).toContain(table)
    expect(units).toContain(eq)
    const out = splitIntoSubchunks(text, 1200, 100)
    expect(out.some((c) => c.includes(table))).toBe(true)
    expect(out.some((c) => c.includes(eq))).toBe(true)
  })

  it("hard-splits a single unbroken block", () => {
    const text = "x".repeat(5000)
    const out = splitIntoSubchunks(text, 1000, 100)
    expect(out.length).toBeGreaterThan(4)
    expect(out.every((c) => c.length <= 1000)).toBe(true)
  })

  it("returns input unchanged when it fits", () => {
    expect(splitIntoSubchunks("short", 100, 10)).toEqual(["short"])
  })
})
