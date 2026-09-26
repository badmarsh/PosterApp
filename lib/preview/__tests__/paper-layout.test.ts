import { describe, it, expect } from "vitest"
import type { Card, OutputConfig } from "@/lib/poster-types"
import type { BibEntry } from "@/lib/bib-types"
import {
  PAPER_GEOMETRY_BY_TEMPLATE,
  buildPaperBlocks,
  columnHeightPx,
  columnWidthPx,
  estimateBlockHeight,
  paginatePaper,
  paperGeometryFor,
  planPaper,
  splitMarkdownBlocks,
  splitPaperBlock,
  splitSentences,
  summarizePlan,
  type PaperBlock,
} from "@/lib/preview/paper-layout"

function card(patch: Partial<Card> = {}): Card {
  return {
    id: "card_p1",
    title: "Introduction",
    column: null,
    order: 0,
    pattern: "section",
    content: "Body text.",
    table: { hasHeader: false, caption: "", rows: [] },
    figures: [],
    figureLayout: "single",
    sourceIds: [],
    validation: "valid",
    ...patch,
  } as Card
}

function output(cards: Card[], templateId = "article-twocol"): OutputConfig {
  return {
    id: "out_paper",
    outputType: "paper",
    templateId,
    title: "A Live Typesetting Canvas for Academic Papers",
    cards,
  } as OutputConfig
}

function bib(id: string, title: string, authors: string[], year: string, journal?: string): BibEntry {
  return {
    id,
    key: id,
    type: "article",
    title,
    authors,
    authorString: authors.join(" and "),
    year,
    journal,
    rawBibtex: "",
  }
}

const BIB: BibEntry[] = [
  bib("knuth1984", "The TeXbook", ["D. E. Knuth"], "1984", "Addison-Wesley"),
  bib("lamport1994", "LaTeX: A Document Preparation System", ["L. Lamport"], "1994"),
  bib("mittelbach2004", "The LaTeX Companion", ["F. Mittelbach"], "2004"),
]

describe("paper geometry", () => {
  it("knows the two single-column ML venues are single column and Letter", () => {
    expect(paperGeometryFor("neurips").columns).toBe(1)
    expect(paperGeometryFor("neurips").label).toContain("Letter")
    expect(paperGeometryFor("iclr").columns).toBe(1)
  })

  it("matches the LaTeX generator's single-column set", () => {
    // Keep in sync with SINGLE_COLUMN_TEMPLATES in lib/latex/generator-paper.ts.
    for (const id of ["article-single", "springer-llncs", "jinst-proceedings", "pos-proceedings", "elsarticle", "epj-woc", "iopart", "neurips", "iclr"]) {
      expect(PAPER_GEOMETRY_BY_TEMPLATE[id]?.columns, id).toBe(1)
    }
    for (const id of ["article-twocol", "ieee-conf", "acm-sigconf", "revtex-aps", "icml", "acl", "cvpr", "aaai"]) {
      expect(PAPER_GEOMETRY_BY_TEMPLATE[id]?.columns, id).toBe(2)
    }
  })

  it("falls back to A4 two-column for unknown templates", () => {
    expect(paperGeometryFor("does-not-exist").id).toBe("A4-2col")
  })

  it("two columns are narrower than one column of the same page", () => {
    const two = paperGeometryFor("article-twocol")
    const one = paperGeometryFor("article-single")
    expect(columnWidthPx(two)).toBeLessThan(columnWidthPx(one))
    expect(columnHeightPx(two)).toBeGreaterThan(0)
  })
})

describe("markdown → blocks", () => {
  it("splits chunks on blank lines and detects bullet lists", () => {
    const chunks = splitMarkdownBlocks("First para.\n\n- one\n- two\n\nSecond para.")
    expect(chunks).toHaveLength(3)
    expect(chunks[1]).toContain("- one")
  })

  it("keeps inline math intact when splitting sentences", () => {
    const parts = splitSentences("We minimise $\\mathcal{L}(\\theta) = a. b$ here. And then more.")
    expect(parts[0]).toContain("$\\mathcal{L}(\\theta) = a. b$")
    expect(parts).toHaveLength(2)
  })

  it("numbers sections, figures and tables in reading order", () => {
    const blocks = buildPaperBlocks({
      cards: [
        card({ id: "card_1", title: "Introduction", order: 0 }),
        card({
          id: "card_2",
          title: "Method",
          order: 1,
          pattern: "section-figure",
          figures: [{ id: "f1", url: "/api/workspaces/ws/assets/fig1.png", caption: "Figure 1: pipeline" }],
        }),
        card({
          id: "card_3",
          title: "Results",
          order: 2,
          pattern: "section-table",
          table: { hasHeader: true, caption: "Table 1: accuracy", rows: [["Model", "Acc"], ["Ours", "99"]] },
        }),
      ],
      bibEntries: BIB,
      citedKeys: ["lamport1994"],
    })

    const headings = blocks.filter((b) => b.kind === "heading")
    expect(headings.map((h) => h.number)).toEqual([1, 2, 3])
    expect(blocks.find((b) => b.kind === "figure")?.number).toBe(1)
    expect(blocks.find((b) => b.kind === "table")?.number).toBe(1)
  })

  it("renders only the cited references, in citation order", () => {
    const blocks = buildPaperBlocks({
      cards: [card({ id: "card_refs", title: "References", pattern: "references", content: "" })],
      bibEntries: BIB,
      citedKeys: ["mittelbach2004", "knuth1984"],
    })
    const refs = blocks.find((b) => b.kind === "references")
    expect(refs?.entries?.map((e) => e.id)).toEqual(["mittelbach2004", "knuth1984"])
  })

  it("treats a card titled Abstract as an abstract, not a numbered section", () => {
    const blocks = buildPaperBlocks({
      cards: [card({ id: "card_abs", title: "Abstract", content: "We present a canvas." })],
    })
    expect(blocks.map((b) => b.kind)).toEqual(["abstract"])
  })

  it("models two figures on one card as a single two-up block", () => {
    const blocks = buildPaperBlocks({
      cards: [
        card({
          id: "card_figs",
          pattern: "section-two-figures",
          figures: [
            { id: "a", url: "/api/workspaces/ws/assets/a.png", caption: "Left" },
            { id: "b", url: "/api/workspaces/ws/assets/b.png", caption: "Right" },
          ],
        }),
      ],
    })
    const fig = blocks.find((b) => b.kind === "figure")
    expect(fig?.url).toContain("a.png")
    expect(fig?.alt).toContain("b.png")
    expect(fig?.caption).toBe("Left · Right")
  })
})

describe("splitting", () => {
  const g = paperGeometryFor("article-twocol")
  const measure = (b: PaperBlock) => estimateBlockHeight(b, g)

  it("splits a long paragraph at a sentence boundary", () => {
    const block: PaperBlock = {
      id: "x#p0",
      cardId: "x",
      kind: "paragraph",
      text: "First sentence here. Second sentence here. Third sentence here. Fourth sentence here.",
    }
    const split = splitPaperBlock(block, measure)
    expect(split).not.toBeNull()
    const [head, tail] = split!
    expect(head.text).toMatch(/First sentence/)
    expect(tail.text).toMatch(/Fourth sentence/)
    expect(tail.continues).toBe(true)
  })

  it("repeats the header when a table is split across columns", () => {
    const rows = [["Model", "Acc"], ["A", "90"], ["B", "91"], ["C", "92"], ["D", "93"]]
    const block: PaperBlock = { id: "t#tbl", cardId: "t", kind: "table", rows, hasHeader: true, caption: "Table 1" }
    const [head, tail] = splitPaperBlock(block, measure)!
    expect(head.rows?.[0]).toEqual(["Model", "Acc"])
    expect(tail.rows?.[0]).toEqual(["Model", "Acc"])
    expect(tail.caption).toBeUndefined()
    expect((head.rows?.length ?? 0) + (tail.rows?.length ?? 0)).toBe(rows.length + 1)
  })

  it("never splits figures or equations", () => {
    expect(splitPaperBlock({ id: "f", cardId: "f", kind: "figure", url: "x" }, measure)).toBeNull()
    expect(splitPaperBlock({ id: "e", cardId: "e", kind: "equation", text: "a=b" }, measure)).toBeNull()
  })
})

describe("pagination", () => {
  it("fills columns to capacity and spills into page 2", () => {
    const g = paperGeometryFor("article-twocol")
    // 120 paragraphs is several pages for A4 two-column.
    const cards = Array.from({ length: 40 }, (_, i) =>
      card({
        id: `card_${i}`,
        title: `Section ${i}`,
        order: i,
        content: `Paragraph ${i} introduces the topic with enough words to take a few lines in the column. ${"More prose follows. ".repeat(6)}`,
      }),
    )
    const plan = planPaper(output(cards), { geometry: g })
    expect(plan.pageCount).toBeGreaterThan(1)
    for (const page of plan.pages) {
      for (const column of page.columns) {
        // Nothing may overflow its column by more than a rounding pixel.
        expect(column.usedHeight).toBeLessThanOrEqual(column.capacity + 1)
      }
    }
    // Reading order is preserved across the whole document.
    const ids = plan.pages.flatMap((p) => p.columns.flatMap((c) => c.placements.map((pl) => pl.block.cardId)))
    const numbered = ids.filter((id) => id.startsWith("card_"))
    for (let i = 1; i < numbered.length; i++) {
      const prev = Number(numbered[i - 1].split("_")[1])
      const cur = Number(numbered[i].split("_")[1])
      expect(cur).toBeGreaterThanOrEqual(prev)
    }
  })

  it("keeps a heading with its following content at a column break", () => {
    const g = paperGeometryFor("article-single")
    const huge = "Filler sentence that consumes many lines in the column. ".repeat(30)
    const blocks: PaperBlock[] = [
      { id: "a#p0", cardId: "a", kind: "paragraph", text: huge },
      { id: "b#heading", cardId: "b", kind: "heading", level: 1, number: 2, text: "Widow Section", keepWithNext: true },
      { id: "b#p0", cardId: "b", kind: "paragraph", text: "Body of the widow section." },
    ]
    const measure = (b: PaperBlock) => estimateBlockHeight(b, g)
    const plan = paginatePaper(blocks, measure, g)
    const flat = plan.pages.flatMap((p) => p.columns.flatMap((c) => c.placements.map((pl) => pl.block.id)))
    const headingIdx = flat.indexOf("b#heading")
    expect(headingIdx).toBeGreaterThanOrEqual(0)
    expect(flat[headingIdx + 1]).toBe("b#p0")
    // …and it is not the last block of a column.
    for (const page of plan.pages) {
      for (const column of page.columns) {
        const last = column.placements[column.placements.length - 1]?.block
        expect(last?.keepWithNext, "heading left dangling at the bottom of a column").not.toBe(true)
      }
    }
  })

  it("shrinks page 1 by the title band inset but leaves later pages full", () => {
    const g = paperGeometryFor("article-twocol")
    const blocks: PaperBlock[] = Array.from({ length: 24 }, (_, i) => ({
      id: `x#p${i}`,
      cardId: "x",
      kind: "paragraph",
      text: "Filler sentence that consumes a couple of lines in a printed column. ".repeat(2),
    }))
    const measure = (b: PaperBlock) => estimateBlockHeight(b, g)
    const inset = 200
    const plan = paginatePaper(blocks, measure, g, { firstPageInset: inset })
    expect(plan.pages[0].columns[0].capacity).toBeCloseTo(columnHeightPx(g) - inset, 3)
    expect(plan.pages[1].columns[0].capacity).toBeCloseTo(columnHeightPx(g), 3)
  })

  it("places an over-tall atomic block on its own and flags it", () => {
    const g = paperGeometryFor("article-twocol")
    const tiny: PaperBlock = { id: "a#p0", cardId: "a", kind: "paragraph", text: "Short." }
    const monster: PaperBlock = { id: "b#fig", cardId: "b", kind: "figure", url: "x", caption: "Big" }
    const measure = (b: PaperBlock) => (b.id === "b#fig" ? columnHeightPx(g) * 1.4 : estimateBlockHeight(b, g))
    const plan = paginatePaper([tiny, monster], measure, g)
    expect(plan.unplaced.map((b) => b.id)).toContain("b#fig")
    expect(plan.pages[0].columns[1].placements.at(-1)?.block.id).toBe("b#fig")
  })

  it("summarises the plan for the canvas chrome", () => {
    const g = paperGeometryFor("article-twocol")
    const plan = planPaper(
      output([
        card({ id: "card_1", title: "Introduction", order: 0, content: "Intro prose with a citation." }),
        card({
          id: "card_2",
          title: "Results",
          order: 1,
          pattern: "section-table",
          table: { hasHeader: true, caption: "Table 1", rows: [["A", "B"], ["1", "2"], ["3", "4"]] },
        }),
        card({ id: "card_refs", title: "References", order: 2, pattern: "references", content: "" }),
      ]),
      { geometry: g, bibEntries: BIB },
    )
    const summary = summarizePlan(plan)
    expect(summary.pageCount).toBe(1)
    expect(summary.tableCount).toBe(1)
    expect(summary.referenceCount).toBe(3)
    expect(summary.averageFill).toBeGreaterThan(0)
  })

  it("is deterministic for identical input", () => {
    const cards = [
      card({ id: "card_1", order: 0, content: "One. Two. Three. ".repeat(20) }),
      card({ id: "card_2", title: "Next", order: 1, content: "More text here." }),
    ]
    const a = planPaper(output(cards))
    const b = planPaper(output(cards))
    expect(JSON.stringify(a.pages)).toBe(JSON.stringify(b.pages))
  })
})
