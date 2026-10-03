import { describe, expect, it } from "vitest"
import { verifyEvidenceByChunkId, verifyEvidenceQuote } from "../evidence-validator"
import type { EvidenceReference } from "../review-types"

describe("evidence quote validation", () => {
  it("removes synthetic page hints only when physical page bounds are unavailable", () => {
    const rawQuote = "[Page 4] The measured response remained stable across all repeated trials."
    const source = `${rawQuote} The next sentence reports a separate result.`
    const evidence: EvidenceReference = { quote: rawQuote, page: 4, pageNumber: 4 }

    const physicallyBounded = verifyEvidenceQuote(evidence, source, [
      { heading: "Results", content: source, pageStart: 4, pageEnd: 5 },
    ])
    expect(physicallyBounded.state).toBe("verified-exact")
    expect(physicallyBounded.quote).toBe(rawQuote)
    expect(physicallyBounded.pageNumber).toBe(4)

    const syntheticOnly = verifyEvidenceQuote(evidence, source, [
      { heading: "Results", content: source },
    ])
    expect(syntheticOnly.state).toBe("verified-exact")
    expect(syntheticOnly.quote).not.toContain("Page 4")
    expect(syntheticOnly.page).toBeUndefined()
    expect(syntheticOnly.pageNumber).toBeUndefined()
  })

  it("accepts approximate evidence only with a matching prefix of at least 60 characters", () => {
    const prefix = "This source description contains enough alphabetic characters to establish a meaningful evidential overlap"
    const longQuote = `${prefix}, with an added model-only ending.`
    const longChunk = { id: "long", content: `${prefix} and additional source wording.` }
    const approximate = verifyEvidenceByChunkId(
      { chunkId: "long", quote: longQuote },
      new Map([["long", longChunk]])
    )
    if (!approximate) throw new Error("Expected a chunk-anchored verification result")
    expect(approximate.state).toBe("approximate")
    expect(approximate.verified).toBe(false)
    expect(approximate.confidence).toBe(0.45)

    const shortPrefix = prefix.slice(0, 59)
    const shortQuote = `${shortPrefix.slice(0, 58)}X`
    const short = verifyEvidenceByChunkId(
      { chunkId: "short", quote: shortQuote },
      new Map([["short", { id: "short", content: `${shortPrefix.slice(0, 58)}Y source diverges here.` }]])
    )
    if (!short) throw new Error("Expected a chunk-anchored verification result")
    expect(short.state).toBe("unverified")
    expect(short.verified).toBe(false)
  })

  it("does not accept synthetic-only hints as evidence after cleaning", () => {
    const result = verifyEvidenceQuote("[Page 12]", "[Page 12]", [{ heading: "Intro", content: "[Page 12]" }])
    expect(result.state).toBe("unverified")
    expect(result.quote).toBe("")
    expect(result.pageNumber).toBeUndefined()
  })
})
