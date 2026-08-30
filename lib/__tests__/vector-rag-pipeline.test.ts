/**
 * Tests for the 6-stage Advanced RAG Pipeline additions:
 *  - expandQuery (multi-query fan-out)
 *  - generateHypotheticalDocument (HyDE)
 *  - applyMMR (Maximal Marginal Relevance)
 *  - compressChunks (contextual compression)
 */

import { describe, it, expect } from "vitest"
import {
  expandQuery,
  generateHypotheticalDocument,
  applyMMR,
  compressChunks,
} from "@/lib/ai/vector-rag"

// ---------------------------------------------------------------------------
// expandQuery — multi-query fan-out
// ---------------------------------------------------------------------------

describe("expandQuery", () => {
  it("always includes the original query as first variant", () => {
    const variants = expandQuery("metodika výskumu")
    expect(variants[0]).toBe("metodika výskumu")
  })

  it("generates at most 3 variants", () => {
    const variants = expandQuery("machine learning classification", "neural networks deep learning")
    expect(variants.length).toBeLessThanOrEqual(3)
    expect(variants.length).toBeGreaterThanOrEqual(1)
  })

  it("keyword-focus variant filters short words", () => {
    const variants = expandQuery("metodika výskumu a implementácia")
    // Variant 2 should keep words > 4 chars: metodika, výskumu, implementácia
    expect(variants.length).toBeGreaterThan(1)
  })

  it("uses criterion expansion as 3rd variant when provided", () => {
    const variants = expandQuery("výsledky", "experimentálne merania výsledky diskusia")
    // 3rd variant should be a combo of base + expansion
    expect(variants.some((v) => v.includes("experimentálne"))).toBe(true)
  })

  it("deduplicates identical variants", () => {
    // If keyword-focus equals base, should not produce duplicate
    const variants = expandQuery("ab") // too short for keyword focus
    const unique = new Set(variants)
    expect(unique.size).toBe(variants.length)
  })

  it("handles empty string gracefully", () => {
    const variants = expandQuery("")
    expect(variants).toHaveLength(1)
    expect(variants[0]).toBe("")
  })
})

// ---------------------------------------------------------------------------
// generateHypotheticalDocument — HyDE
// ---------------------------------------------------------------------------

describe("generateHypotheticalDocument", () => {
  it("mentions the domain context in the generated passage", () => {
    const doc = generateHypotheticalDocument("magnetické pole", "STEM, Fyzika")
    expect(doc).toContain("STEM, Fyzika")
  })

  it("generates methodology-flavoured text for methodology queries", () => {
    const doc = generateHypotheticalDocument("metodika implementácia dataset", "STEM, Fyzika")
    // Should mention experiment-related text
    expect(doc.length).toBeGreaterThan(50)
    expect(typeof doc).toBe("string")
  })

  it("generates results-flavoured text for results queries", () => {
    const doc = generateHypotheticalDocument("výsledky diskusia prínos", "Informatika")
    expect(doc).toContain("výsledky")
    expect(doc.length).toBeGreaterThan(50)
  })

  it("generates literature-flavoured text for literature queries", () => {
    const doc = generateHypotheticalDocument("prehľad literatúry rešerš", "STEM, Fyzika")
    expect(doc.toLowerCase()).toContain("stav")
    expect(doc.length).toBeGreaterThan(50)
  })

  it("returns a non-empty string for any input", () => {
    const doc = generateHypotheticalDocument("random xyz 123", "any domain")
    expect(typeof doc).toBe("string")
    expect(doc.length).toBeGreaterThan(0)
  })

  it("generates English hypothetical document for English queries", () => {
    const doc = generateHypotheticalDocument("experimental methodology and dataset", "Computer Science", "en")
    expect(doc).toContain("In this work")
    expect(doc).toContain("Computer Science")
  })

  it("generates Czech hypothetical document for Czech queries", () => {
    const doc = generateHypotheticalDocument("metodika a experimentální měření", "Technické vědy", "cs")
    expect(doc).toContain("V této práci")
    expect(doc).toContain("Technické vědy")
  })
})

// ---------------------------------------------------------------------------
// applyMMR — Maximal Marginal Relevance
// ---------------------------------------------------------------------------

const makeMMRChunk = (
  id: string,
  content: string,
  similarity = 0.8
) => ({ id, content, heading: null, similarity })

describe("applyMMR", () => {
  it("returns exactly topK results when input > topK", () => {
    const chunks = Array.from({ length: 10 }, (_, i) =>
      makeMMRChunk(`c${i}`, `Content block number ${i}. Some different words each time.`, 0.9 - i * 0.05)
    )
    const result = applyMMR(chunks, 4)
    expect(result).toHaveLength(4)
  })

  it("returns all chunks when input <= topK", () => {
    const chunks = [
      makeMMRChunk("a", "First document content.", 0.9),
      makeMMRChunk("b", "Second document content.", 0.8),
    ]
    const result = applyMMR(chunks, 5)
    expect(result).toHaveLength(2)
  })

  it("avoids selecting highly similar (duplicate) chunks", () => {
    // Two nearly identical chunks + one diverse chunk
    const chunks = [
      makeMMRChunk("dup1", "The methodology used in this thesis includes machine learning experiments with neural networks.", 0.95),
      makeMMRChunk("dup2", "The methodology used in this thesis includes machine learning experiments with neural networks.", 0.94), // nearly identical
      makeMMRChunk("div",  "The references section lists 45 cited works including books and journal articles.", 0.70),
    ]
    const result = applyMMR(chunks, 2, 0.7)
    const ids = result.map((c) => c.id)
    // Should prefer dup1 (highest relevance) + div (diverse), NOT both dup1 and dup2
    expect(ids).toContain("dup1")
    expect(ids).toContain("div")
    expect(ids).not.toContain("dup2")
  })

  it("with lambda=1.0, behaves like pure relevance ranking (no diversity penalty)", () => {
    const chunks = [
      makeMMRChunk("low",  "Same text here same text.", 0.5),
      makeMMRChunk("high", "Same text here same text.", 0.9), // identical content but higher score
    ]
    const result = applyMMR(chunks, 1, 1.0)
    expect(result[0].id).toBe("high")
  })

  it("returns chunks in selection order (not by original index)", () => {
    const chunks = [
      makeMMRChunk("a", "Alpha content about physics measurements.", 0.6),
      makeMMRChunk("b", "Beta content about references and literature.", 0.9),
      makeMMRChunk("c", "Gamma content about alpha physics measurements.", 0.8), // similar to "a"
    ]
    const result = applyMMR(chunks, 2, 0.7)
    // b should be first (highest relevance), c is similar to a so a or c may be 2nd
    expect(result[0].id).toBe("b")
    expect(result).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// compressChunks — contextual compression
// ---------------------------------------------------------------------------

describe("compressChunks", () => {
  it("does not compress short chunks (< 400 chars)", () => {
    const shortContent = "This is a short chunk with only a few sentences. Not very long."
    const chunks = [{ id: "c1", content: shortContent, heading: null, relevanceScore: 0.8 }]
    const result = compressChunks("query about thesis", chunks)
    expect(result[0].content).toBe(shortContent)
  })

  it("compresses long chunks by keeping only relevant sentences", () => {
    const longContent = [
      "The methodology involved measuring magnetic field strength using Hall probes at 4 K.",
      "The introduction section provides context about the field of study.",
      "Magnetic field measurements were conducted at various temperatures from 4 K to 300 K.",
      "The results show that superconductivity emerges at critical temperature.",
      "Further work could explore different measurement techniques.",
      "Statistical analysis was performed using Python with SciPy.",
      "The dataset contains 10,000 measurement points across different materials.",
      "Conclusions summarize the main findings of the magnetic field research.",
    ].join(" ")

    const chunks = [{ id: "c1", content: longContent, heading: "Metodika", relevanceScore: 0.9 }]
    const result = compressChunks("magnetické pole meranie", chunks)

    // Should be shorter than original
    expect(result[0].content.length).toBeLessThan(longContent.length)
    // But should retain relevant sentences
    expect(result[0].content.toLowerCase()).toContain("magnetic")
  })

  it("preserves chunks where compression would not reduce size meaningfully", () => {
    // A chunk where all sentences are relevant — compression shouldn't apply
    const medContent = "Magnetické pole meranie. Výsledky magnetického poľa sú zaujímavé. " +
      "Magnetické vlastnosti materiálu sú dôležité."
    const chunks = [{ id: "c1", content: medContent, heading: null, relevanceScore: 0.8 }]
    const result = compressChunks("magnetické pole", chunks)
    // Should exist (not emptied)
    expect(result[0].content.length).toBeGreaterThan(0)
  })

  it("handles empty chunks array", () => {
    const result = compressChunks("some query", [])
    expect(result).toEqual([])
  })

  it("preserves heading and metadata fields", () => {
    const chunk = {
      id: "c1",
      content: "Short content.",
      heading: "Test Section",
      relevanceScore: 0.9,
      similarity: 0.8,
    }
    const result = compressChunks("test query", [chunk])
    expect(result[0].heading).toBe("Test Section")
    expect(result[0].id).toBe("c1")
  })
})
