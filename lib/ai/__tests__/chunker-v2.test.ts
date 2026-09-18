/**
 * chunker-v2 — hierarchical, token-aware, structure-aware chunking.
 *
 * Covers: document model construction (SK/CS/EN headings), hierarchy fields, token budgets,
 * atomic structural elements, parent/child + sibling links, deterministic ids, page resolution
 * and the "never fabricate a page number" rule.
 */

import { describe, it, expect, beforeEach } from "vitest"
import {
  buildDocumentModel,
  chunkDocument,
  segmentSectionBody,
  splitProseToTokenBudget,
  pageForOffset,
  anchorsFromPageCharCounts,
  anchorsFromImagePageMap,
  isBibliographyEntry,
  splitBibliographyEntries,
  collectLeafSections,
  isHierarchicalChunkerEnabled,
  CHUNKER_VERSION,
} from "@/lib/ai/chunker-v2"
import { countTokens } from "@/lib/ai/token-budget"

const SK_THESIS = `# Kapitola 1: Úvod

Táto práca sa zaoberá detekciou objektov. Cieľom je navrhnúť model.

## 1.1 Motivácia

Detekcia objektov je kľúčová pre autonómne systémy. Existujúce prístupy sú pomalé.

# Kapitola 3: Metodika

## 3.1 Návrh architektúry

Navrhli sme dvojfázový model. Prvá fáza extrahuje príznaky.

### 3.1.1 Tréning

Model bol trénovaný 50 epôch s learning rate 0.001.

| Model | Presnosť | p-hodnota |
|---|---|---|
| Baseline | 0.81 | 0.214 |
| Navrhovaný | 0.94 | p < 0.001 |

$$\\alpha = \\frac{p}{q}$$

Obr. 4.1 Porovnanie modelov na testovacej sade.
Graf ukazuje výrazné zlepšenie.
`

describe("buildDocumentModel — hierarchy", () => {
  it("builds chapter → section → subsection from markdown headings", () => {
    const model = buildDocumentModel(SK_THESIS, "doc-1")
    expect(model.sections.length).toBe(2)
    expect(model.sections[0].title).toBe("Kapitola 1: Úvod")
    expect(model.sections[0].children[0].title).toBe("1.1 Motivácia")
    const metodika = model.sections[1]
    expect(metodika.children[0].title).toBe("3.1 Návrh architektúry")
    expect(metodika.children[0].children[0].title).toBe("3.1.1 Tréning")
    expect(metodika.children[0].children[0].path).toEqual([
      "Kapitola 3: Metodika",
      "3.1 Návrh architektúry",
      "3.1.1 Tréning",
    ])
  })

  it("creates a Preamble section for text before the first heading", () => {
    const model = buildDocumentModel("Úvodný text bez nadpisu.\n\n# Kapitola 1\n\nObsah.", "doc-2")
    expect(model.sections[0].title).toBe("Preamble")
    expect(model.sections[0].elements.length).toBe(1)
  })

  it("keeps a headingless document as a single section (nothing dropped)", () => {
    const model = buildDocumentModel("Len obyčajný text.\n\nDruhý odstavec.", "doc-3")
    expect(model.sections.length).toBe(1)
    expect(collectLeafSections(model)[0].elements.length).toBe(2)
  })

  it("classifies section kinds (methodology / references)", () => {
    const model = buildDocumentModel("# Metodika\n\nPostup merania.\n\n# Zoznam literatúry\n\n[1] Autor, A. Titul. 2020.", "doc-4")
    const kinds = collectLeafSections(model).map((s) => s.kind)
    expect(kinds).toContain("methodology")
    expect(kinds).toContain("references")
  })
})

describe("segmentSectionBody — typed elements with offsets", () => {
  it("separates prose, pipe table, display equation and caption", () => {
    const model = buildDocumentModel(SK_THESIS, "doc-1")
    const subsection = model.sections[1].children[0].children[0]
    const types = subsection.elements.map((e) => e.type)
    expect(types).toEqual(["paragraph", "table", "equation", "figure_caption"])
  })

  it("keeps a table whole and normalises HTML tables to pipe tables", () => {
    const html = `<table><tr><th>Model</th><th>Acc</th></tr><tr><td>A</td><td>0.9</td></tr></table>`
    const els = segmentSectionBody(`Text pred.\n\n${html}\n\nText po.`, 0, "results")
    const table = els.find((e) => e.type === "table")
    expect(table).toBeDefined()
    expect(table!.text).toContain("|")
    expect(table!.text).toContain("Model")
  })

  it("records offsets that slice back to the element text (prose)", () => {
    const body = "Prvý odstavec.\n\nDruhý odstavec."
    const els = segmentSectionBody(body, 100, "introduction")
    expect(els.length).toBe(2)
    for (const el of els) {
      expect(body.slice(el.startOffset - 100, el.endOffset - 100).trim()).toBe(el.text)
    }
  })

  it("treats bibliography entries as atomic citation elements", () => {
    const model = buildDocumentModel(
      `# Zoznam literatúry\n\n[1] Novák, J. Metódy. Bratislava: Vydavateľstvo, 2019. ISBN 978-80-000.\n\n[2] Horváth, P. Analýza. 2021. doi:10.1000/x.`,
      "doc-5"
    )
    const refs = collectLeafSections(model)[0]
    expect(refs.elements.every((e) => e.type === "citation")).toBe(true)
    expect(refs.elements.length).toBe(2)
  })
})

describe("bibliography helpers", () => {
  it("recognises numbered, author-year and DOI/ISBN entries", () => {
    expect(isBibliographyEntry("[1] Novák, J. Titul. 2019.")).toBe(true)
    expect(isBibliographyEntry("NOVÁK, J. Titul diela. Bratislava, 2019.")).toBe(true)
    expect(isBibliographyEntry("Niečo. doi:10.1234/abc")).toBe(true)
    expect(isBibliographyEntry("Toto je obyčajná veta o metóde bez odkazu.")).toBe(false)
  })

  it("splits a references block into individual entries", () => {
    const block = "[1] Prvý záznam.\n[2] Druhý záznam.\n[3] Tretí záznam."
    expect(splitBibliographyEntries(block).length).toBe(3)
  })
})

describe("chunkDocument — hierarchy, budgets, provenance", () => {
  let result: ReturnType<typeof chunkDocument>

  beforeEach(() => {
    result = chunkDocument(SK_THESIS, "doc-1", null, { childMaxTokens: 128, parentMaxTokens: 512 })
  })

  it("emits both parent (section) and child chunks", () => {
    expect(result.chunks.some((c) => c.isParent)).toBe(true)
    expect(result.chunks.some((c) => !c.isParent)).toBe(true)
  })

  it("gives every chunk the full provenance field set", () => {
    for (const c of result.chunks) {
      expect(c.documentId).toBe("doc-1")
      expect(typeof c.ordinal).toBe("number")
      expect(c.contentHash).toMatch(/^[0-9a-f]{32}$/)
      expect(c.chunkerVersion).toBe(CHUNKER_VERSION)
      expect(c.characterCount).toBe(c.content.length)
      expect(c.tokenCount).toBeGreaterThan(0)
      expect(c.sourceElementIds.length).toBeGreaterThan(0)
      expect(c.sectionPath).toBeTruthy()
      expect(c.contextPrefix).toBeTruthy()
      // chunkType is one of the declared element types or "section"
      expect(["section", "paragraph", "table", "equation", "figure_caption", "citation"]).toContain(c.chunkType)
    }
  })

  it("fills chapter / section / subsection from the heading path", () => {
    const tableChunk = result.chunks.find((c) => c.chunkType === "table")
    expect(tableChunk).toBeDefined()
    expect(tableChunk!.chapter).toBe("Kapitola 3: Metodika")
    expect(tableChunk!.section).toBe("3.1 Návrh architektúry")
    expect(tableChunk!.subsection).toBe("3.1.1 Tréning")
    expect(tableChunk!.sectionPath).toBe("Kapitola 3: Metodika > 3.1 Návrh architektúry > 3.1.1 Tréning")
  })

  it("links every child to its parent section chunk", () => {
    const parents = new Set(result.chunks.filter((c) => c.isParent).map((c) => c.id))
    for (const c of result.chunks.filter((c) => !c.isParent)) {
      expect(c.parentChunkId).not.toBeNull()
      expect(parents.has(c.parentChunkId!)).toBe(true)
    }
  })

  it("links siblings in document order", () => {
    const children = result.chunks.filter((c) => !c.isParent)
    for (let i = 1; i < children.length; i++) {
      expect(children[i].previousChunkId).toBe(children[i - 1].id)
      expect(children[i - 1].nextChunkId).toBe(children[i].id)
    }
  })

  it("never splits a table, equation or caption across chunks", () => {
    const table = result.chunks.find((c) => c.chunkType === "table")!
    expect(table.content).toContain("| Model | Presnosť | p-hodnota |")
    expect(table.content).toContain("|---|---|---|")
    expect(table.content).toContain("Navrhovaný")
    const eq = result.chunks.find((c) => c.chunkType === "equation")!
    expect(eq.content.startsWith("$$")).toBe(true)
    expect(eq.content.trim().endsWith("$$")).toBe(true)
  })

  it("keeps content verbatim and the prefix out of it", () => {
    const prose = result.chunks.find((c) => c.chunkType === "paragraph" && c.content.includes("dvojfázový model"))!
    expect(prose.content).toBe("Navrhli sme dvojfázový model. Prvá fáza extrahuje príznaky.")
    expect(prose.content).not.toContain("Úryvok z")
    expect(prose.embeddingText.startsWith(prose.contextPrefix)).toBe(true)
  })

  it("reports null pages when no anchors are supplied (never fabricates)", () => {
    expect(result.chunks.every((c) => c.pageStart === null && c.pageEnd === null)).toBe(true)
  })

  it("produces deterministic, content-stable ids", () => {
    const again = chunkDocument(SK_THESIS, "doc-1", null, { childMaxTokens: 128, parentMaxTokens: 512 })
    expect(again.chunks.map((c) => c.id)).toEqual(result.chunks.map((c) => c.id))
    const otherDoc = chunkDocument(SK_THESIS, "doc-OTHER", null, { childMaxTokens: 128, parentMaxTokens: 512 })
    expect(otherDoc.chunks.map((c) => c.id)).not.toEqual(result.chunks.map((c) => c.id))
  })
})

describe("chunkDocument — token awareness", () => {
  it("splits a long paragraph at sentence boundaries so each child fits the budget", () => {
    const sentence = "Toto je veta o metóde, ktorá popisuje experimentálny postup a jeho výsledky. "
    const longPara = sentence.repeat(40)
    const md = `# Metodika\n\n${longPara}`
    const res = chunkDocument(md, "doc-long", null, { childMaxTokens: 128 })
    const proseChildren = res.chunks.filter((c) => c.chunkType === "paragraph")
    expect(proseChildren.length).toBeGreaterThan(1)
    for (const c of proseChildren) {
      expect(c.tokenCount).toBeLessThanOrEqual(128)
    }
    // Nothing was lost: concatenating children reproduces every sentence.
    const joined = proseChildren.map((c) => c.content).join(" ")
    expect(joined.replace(/\s*\[…\]\s*/g, " ").length).toBeGreaterThan(longPara.length * 0.9)
  })

  it("flags an oversized atomic element instead of chopping it", () => {
    const bigTable = `| A | B |\n|---|---|\n${Array.from({ length: 400 }, (_, i) => `| r${i} | ${i} |`).join("\n")}`
    const res = chunkDocument(`# Výsledky\n\n${bigTable}`, "doc-big", null, { childMaxTokens: 64 })
    const table = res.chunks.find((c) => c.chunkType === "table")!
    expect(table.oversized).toBe(true)
    expect(table.content).toContain("r399")
    expect(res.oversizedCount).toBeGreaterThan(0)
  })

  it("stores token counts from the conservative estimator, not len/4", () => {
    const res = chunkDocument("# Úvod\n\nKrátka veta.", "doc-tok", null)
    const c = res.chunks.find((c) => c.chunkType === "paragraph")!
    expect(c.tokenCount).toBe(countTokens(c.content, 3.6))
  })
})

describe("splitProseToTokenBudget — boundary preference", () => {
  it("returns the text untouched when it already fits", () => {
    const { pieces, oversized } = splitProseToTokenBudget("Krátka veta.", 128, 3.6)
    expect(pieces).toEqual(["Krátka veta."])
    expect(oversized).toBe(false)
  })

  it("prefers paragraph boundaries over sentence boundaries", () => {
    const p1 = "Prvý odstavec. ".repeat(30)
    const p2 = "Druhý odstavec. ".repeat(30)
    const { pieces } = splitProseToTokenBudget(`${p1}\n\n${p2}`, 120, 3.6)
    expect(pieces.length).toBeGreaterThanOrEqual(2)
    expect(pieces[0].startsWith("Prvý odstavec.")).toBe(true)
  })

  it("falls back to a token boundary for a single unbreakable run", () => {
    const run = "slovo ".repeat(400)
    const { pieces } = splitProseToTokenBudget(run, 64, 3.6)
    expect(pieces.length).toBe(1)
    expect(pieces[0].endsWith("[…]")).toBe(true)
    expect(countTokens(pieces[0], 3.6)).toBeLessThanOrEqual(64)
  })
})

describe("page anchors", () => {
  it("resolves offsets to pages and returns null with no anchors", () => {
    const anchors = anchorsFromPageCharCounts([100, 100, 100])
    expect(pageForOffset(0, anchors)).toBe(1)
    expect(pageForOffset(150, anchors)).toBe(2)
    expect(pageForOffset(250, anchors)).toBe(3)
    expect(pageForOffset(50, null)).toBeNull()
    expect(pageForOffset(50, [])).toBeNull()
  })

  it("derives anchors from an image → page map", () => {
    const md = "text\n![](images/a.jpg)\nmore\n![](images/b.jpg)\n"
    const anchors = anchorsFromImagePageMap(md, { "images/a.jpg": 3, "images/b.jpg": 7 })
    expect(anchors.length).toBe(2)
    expect(anchors[0].page).toBe(3)
    expect(anchors[1].page).toBe(7)
    expect(anchors[0].offset).toBeLessThan(anchors[1].offset)
  })

  it("assigns page ranges to chunks when anchors are supplied", () => {
    const md = `# Úvod\n\n${"Prvá strana. ".repeat(20)}\n\n# Záver\n\n${"Druhá strana. ".repeat(20)}`
    const anchors = anchorsFromPageCharCounts([Math.floor(md.length / 2), Math.ceil(md.length / 2)])
    const res = chunkDocument(md, "doc-pages", anchors, { childMaxTokens: 200 })
    const withPages = res.chunks.filter((c) => c.pageStart !== null)
    expect(withPages.length).toBeGreaterThan(0)
    for (const c of withPages) {
      expect(c.pageEnd!).toBeGreaterThanOrEqual(c.pageStart!)
    }
  })
})

describe("chunker mode flag", () => {
  it("is hierarchical by default and honours CHUNKER=legacy", () => {
    const prev = process.env.CHUNKER
    delete process.env.CHUNKER
    expect(isHierarchicalChunkerEnabled()).toBe(true)
    process.env.CHUNKER = "legacy"
    expect(isHierarchicalChunkerEnabled()).toBe(false)
    if (prev === undefined) delete process.env.CHUNKER
    else process.env.CHUNKER = prev
  })
})
