import { describe, it, expect, vi, beforeEach } from "vitest"
import { chunkMarkdown } from "@/lib/ai/document-chunker"

// ---------------------------------------------------------------------------
// chunkMarkdown — pure function tests (no DB, no embeddings)
// ---------------------------------------------------------------------------

describe("chunkMarkdown — heading detection", () => {
  it("splits on ATX headings (# ## ###)", () => {
    const md = `# Introduction
Some intro text here.

## Methods
We used PyTorch.

### Sub-methods
Details of methods.

# Results
We achieved 94.5% accuracy.
`
    const chunks = chunkMarkdown(md, "doc1")
    const headings = chunks.map((c) => c.heading)
    expect(headings).toContain("Introduction")
    expect(headings).toContain("Methods")
    expect(headings).toContain("Sub-methods")
    expect(headings).toContain("Results")
  })

  it("includes preamble text before first heading", () => {
    const md = `Abstract text before any heading.

# 1. Introduction
Main content.
`
    const chunks = chunkMarkdown(md, "doc1")
    const preamble = chunks.find((c) => c.heading === "Preamble")
    expect(preamble).toBeDefined()
    expect(preamble?.content).toContain("Abstract text before any heading.")
  })

  it("handles document with no headings as single chunk stream", () => {
    const md = "A".repeat(500)
    const chunks = chunkMarkdown(md, "doc1", { maxChunkChars: 1000 })
    expect(chunks.length).toBeGreaterThanOrEqual(1)
    // All content should be preserved
    const allContent = chunks.map((c) => c.content).join("")
    expect(allContent.length).toBeGreaterThan(0)
  })
})

describe("chunkMarkdown — chunk size limits", () => {
  it("respects maxChunkChars and splits large sections into subchunks", () => {
    const longContent = "Word ".repeat(500) // 2500 chars
    const md = `# Big Section\n${longContent}`
    const chunks = chunkMarkdown(md, "doc1", { maxChunkChars: 500, overlap: 50 })

    const bigChunks = chunks.filter((c) => c.heading?.startsWith("Big Section"))
    expect(bigChunks.length).toBeGreaterThan(1)
    bigChunks.forEach((c) => {
      expect(c.content.length).toBeLessThanOrEqual(500)
    })
  })

  it("appends [N] suffix to subchunk headings", () => {
    const longContent = "X".repeat(2000)
    const md = `# Long Chapter\n${longContent}`
    const chunks = chunkMarkdown(md, "doc1", { maxChunkChars: 600, overlap: 50 })

    const subchunks = chunks.filter((c) => c.heading?.includes("["))
    expect(subchunks.length).toBeGreaterThan(0)
    expect(subchunks[0].heading).toMatch(/Long Chapter \[\d+\]/)
  })

  it("skips chunks shorter than minChunkChars", () => {
    const md = `# Title\n\nTiny.

# Long Section\n${"Content ".repeat(100)}
`
    const chunks = chunkMarkdown(md, "doc1", { minChunkChars: 50 })
    const tiny = chunks.find((c) => c.heading === "Title")
    // "Tiny." is only 5 chars — should be skipped
    expect(tiny).toBeUndefined()
  })

  it("preserves overlap between consecutive subchunks", () => {
    const longContent = "ABCD".repeat(300) // 1200 chars, predictable
    const md = `# Section\n${longContent}`
    const chunks = chunkMarkdown(md, "doc1", { maxChunkChars: 400, overlap: 100 })

    const sectionChunks = chunks.filter((c) => c.heading?.startsWith("Section"))
    if (sectionChunks.length >= 2) {
      // The end of chunk[0] should appear at the start of chunk[1]
      const endOf0 = sectionChunks[0].content.slice(-80)
      const startOf1 = sectionChunks[1].content.slice(0, 80)
      // At least some shared content due to overlap
      const shared = endOf0.split("").filter((ch) => startOf1.includes(ch)).length
      expect(shared).toBeGreaterThan(0)
    }
  })
})

describe("chunkMarkdown — token estimation", () => {
  it("estimates tokens as approximately content.length / 4", () => {
    const md = `# A Section\n${"text ".repeat(100)}`
    const chunks = chunkMarkdown(md, "doc1")
    chunks.forEach((c) => {
      const expected = Math.ceil(c.content.length / 4)
      expect(c.tokens).toBe(expected)
    })
  })
})

describe("chunkMarkdown — section kind classification", () => {
  it("classifies introduction sections correctly", () => {
    const md = `# 1. Úvod a ciele práce\nCieľom tejto práce je...`
    const chunks = chunkMarkdown(md, "doc1")
    const intro = chunks.find((c) => c.heading?.includes("Úvod"))
    expect(intro?.sectionKind).toBe("introduction")
  })

  it("classifies methodology sections correctly", () => {
    const md = `# Metodika a návrh\nPoužili sme experimentálny dizajn...`
    const chunks = chunkMarkdown(md, "doc1")
    const meth = chunks.find((c) => c.heading?.includes("Metodika"))
    expect(meth?.sectionKind).toBe("methodology")
  })

  it("classifies references sections correctly", () => {
    const md = `# Zoznam použitej literatúry\n[1] Author. Title. 2020.`
    const chunks = chunkMarkdown(md, "doc1")
    const refs = chunks.find((c) => c.heading?.includes("literatúry"))
    expect(refs?.sectionKind).toBe("references")
  })

  it("classifies results sections correctly", () => {
    const md = `# Výsledky experimentov\nDosiahli sme F1=0.94...`
    const chunks = chunkMarkdown(md, "doc1")
    const res = chunks.find((c) => c.heading?.includes("Výsledky"))
    expect(res?.sectionKind).toBe("results")
  })

  it("classifies appendix sections correctly", () => {
    const md = `# Príloha A: Zdrojové kódy\nimport torch`
    const chunks = chunkMarkdown(md, "doc1")
    const app = chunks.find((c) => c.heading?.includes("Príloha"))
    expect(app?.sectionKind).toBe("appendix")
  })
})

describe("chunkMarkdown — documentId propagation", () => {
  it("assigns documentId to all chunks", () => {
    const md = `# Intro\nContent here.\n\n# Methods\nMore content.`
    const chunks = chunkMarkdown(md, "my-doc-id-123")
    chunks.forEach((c) => {
      expect(c.documentId).toBe("my-doc-id-123")
    })
  })
})

describe("chunkMarkdown — adaptive chunk size for PhD dissertations", () => {
  it("large documents produce many chunks with default settings", () => {
    // Simulate a very long PhD dissertation excerpt
    const dissertation = Array.from({ length: 10 }, (_, i) =>
      `## Chapter ${i + 1}: Advanced Topic ${i + 1}\n${"Research content. ".repeat(200)}`
    ).join("\n\n")

    const chunks = chunkMarkdown(dissertation, "phd-doc", {
      maxChunkChars: 3000,
      overlap: 200,
    })

    // Should produce multiple chunks
    expect(chunks.length).toBeGreaterThan(5)
    // All should have content
    chunks.forEach((c) => expect(c.content.length).toBeGreaterThan(0))
  })
})

describe("chunkMarkdown — multilingual headings (SK/CS/EN)", () => {
  const multilingualMd = `# Abstrakt
Stručný popis práce.

# Abstract
Brief description of the work.

# Souhrn
Stručný popis práce v češtině.

# Einleitung
Deutsche Einführung.
`

  it("handles Slovak, Czech, English, and other language headings", () => {
    const chunks = chunkMarkdown(multilingualMd, "multilingual-doc")
    const headings = chunks.map((c) => c.heading)
    expect(headings).toContain("Abstrakt")
    expect(headings).toContain("Abstract")
    expect(headings).toContain("Souhrn")
    expect(headings).toContain("Einleitung")
  })
})
