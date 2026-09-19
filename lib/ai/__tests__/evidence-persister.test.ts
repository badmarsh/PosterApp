import { describe, it, expect } from "vitest"
import { computeClaimKey, findQuoteOffsets } from "../evidence-persister"

describe("Evidence Persister", () => {
  it("computes deterministic claim key", () => {
    const text1 = "Neural networks achieve 95% accuracy on dataset X."
    const text2 = "neural  networks achieve 95% accuracy on dataset X.  "
    expect(computeClaimKey(text1)).toBe(computeClaimKey(text2))
    expect(computeClaimKey(text1)).toMatch(/^claim-[a-f0-9]{16}$/)
  })

  it("finds exact quote offsets in chunk content", () => {
    const chunk = "Chapter 4. Results.\nOur proposed method achieved 95% accuracy under test conditions."
    const quote = "Our proposed method achieved 95% accuracy"
    const offsets = findQuoteOffsets(chunk, quote)
    expect(offsets.startOffset).toBe(20)
    expect(offsets.endOffset).toBe(20 + quote.length)
    expect(chunk.slice(offsets.startOffset!, offsets.endOffset!)).toBe(quote)
  })

  it("finds case-insensitive quote offsets", () => {
    const chunk = "Some preamble text. The experiment succeeded completely."
    const quote = "the experiment succeeded completely."
    const offsets = findQuoteOffsets(chunk, quote)
    expect(offsets.startOffset).toBe(20)
    expect(offsets.endOffset).toBe(chunk.length)
  })
})
