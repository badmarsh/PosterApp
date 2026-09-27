import { describe, expect, it } from "vitest"
import { countTokens, fitEmbeddingText } from "@/lib/ai/token-budget"
import { chunkDocument } from "@/lib/ai/chunker-v2"

describe("fitEmbeddingText", () => {
  it("leaves text that already fits untouched", () => {
    const text = "Časticová fyzika. Korelačná funkcia C2(Q) pri 7 TeV."
    expect(fitEmbeddingText(text, 64)).toBe(text)
  })

  it("keeps both the opening prefix and a late p-value inside the window", () => {
    const prefix = "Úryvok z práce „Bose-Einstein correlations“ (odbor: časticová fyzika), sekcia „5.1 Entire sample“."
    const filler = Array.from({ length: 80 }, (_, i) => `veta ${i} opisuje fit bez čísla`).join(" ")
    const tail = "Štatistická významnosť / p-hodnoty: p = 0.00041 (Lévy alpha)"
    const text = `${prefix} ${filler} ${tail}`
    expect(countTokens(text)).toBeGreaterThan(80)

    const fitted = fitEmbeddingText(text, 80)
    expect(countTokens(fitted)).toBeLessThanOrEqual(80)
    expect(fitted.startsWith("Úryvok z práce")).toBe(true)
    expect(fitted).toContain("p = 0.00041")
    expect(fitted).toContain("[…]")
  })
})

describe("chunker embedding window", () => {
  it("does not put the whole oversized parent into the embedding input, but keeps content verbatim", () => {
    const paragraph = Array.from({ length: 180 }, (_, i) => `Veta ${i} opisuje meranie korelačného polomeru R a sily lambda.`).join(" ")
    const md = `# 5 Výsledky\n\n${paragraph}\n\nZáverečná veta kapitoly: lambda = 0.701 a R = 2.021 fm.`
    const { chunks } = chunkDocument(md, "doc-window", null, { childMaxTokens: 40, parentMaxTokens: 4000, emitParents: true })
    const parent = chunks.find((c) => c.isParent)
    expect(parent).toBeDefined()
    expect(parent!.content).toContain("lambda = 0.701")
    // Embedding input is window-fitted; stored content is not.
    expect(parent!.embeddingText.length).toBeLessThan(parent!.content.length + parent!.contextPrefix.length)
    expect(parent!.embeddingText.startsWith(parent!.contextPrefix.slice(0, 24))).toBe(true)
  })
})
