import { describe, it, expect } from "vitest"
import {
  COLUMN_BUDGET,
  columnBudgetFor,
  estimateHeight,
  estimateHeightBreakdown,
  suggestReductions,
} from "@/lib/latex/layout"
import {
  estimatePosterColumnOccupancy,
  validateCard,
  validatePosterColumns,
} from "@/lib/latex/validation"
import type { Card } from "@/lib/poster-types"

function makeCard(patch: Partial<Card> = {}): Card {
  return {
    id: "card_1",
    title: "A Card",
    column: 1,
    order: 0,
    pattern: "bullets",
    content: "Some content",
    table: { hasHeader: true, caption: "", rows: [] },
    figures: [],
    figureLayout: "single",
    sourceIds: [],
    heightBudget: null,
    validation: "valid",
    ...patch,
  }
}

describe("columnBudgetFor", () => {
  it("falls back to the portrait default for unknown/missing templates", () => {
    expect(columnBudgetFor(undefined)).toBe(COLUMN_BUDGET)
    expect(columnBudgetFor(null)).toBe(COLUMN_BUDGET)
    expect(columnBudgetFor("no-such-template")).toBe(COLUMN_BUDGET)
  })

  it("gives landscape a smaller budget than portrait", () => {
    expect(columnBudgetFor("landscape")).toBeLessThan(columnBudgetFor("atlas"))
  })

  it("gives Better Poster the tightest budget", () => {
    const all = ["atlas", "minimal", "a0poster", "landscape", "betterposter"].map(columnBudgetFor)
    expect(columnBudgetFor("betterposter")).toBe(Math.min(...all))
  })
})

describe("estimateHeightBreakdown", () => {
  it("parts always sum to the total", () => {
    const cards = [
      makeCard({ pattern: "bullets", content: "- a\n- b\n- c" }),
      makeCard({ pattern: "bullets-table", table: { hasHeader: true, caption: "", rows: [["a"], ["b"]] } }),
      makeCard({ pattern: "image-focused", content: "" }),
      makeCard({ pattern: "bullets-two-images", content: "- x" }),
      makeCard({ pattern: "references", content: "" }),
    ]
    for (const c of cards) {
      const b = estimateHeightBreakdown(c)
      expect(b.chrome + b.prose + b.bullets + b.table + b.figures).toBe(b.total)
    }
  })

  it("agrees with the scalar estimateHeight (unchanged behaviour)", () => {
    const c = makeCard({ pattern: "bullets-table", content: "- a\n- b", table: { hasHeader: true, caption: "", rows: [["x"], ["y"], ["z"]] } })
    expect(estimateHeight(c)).toBe(estimateHeightBreakdown(c).total)
  })

  it("attributes figure height to the figures part, not prose", () => {
    const b = estimateHeightBreakdown(makeCard({
      pattern: "image-focused",
      content: "",
      figures: [{ id: "f1", url: "/assets/a.png", caption: "" }],
    }))
    expect(b.figures).toBe(260)
    expect(b.prose).toBe(0)
  })

  it("charges side-by-side two-image height once, not twice, and zero when no figures", () => {
    const fig = (id: string) => ({ id, url: `/assets/${id}.png`, caption: "" })
    const two = estimateHeightBreakdown(makeCard({
      pattern: "bullets-two-images",
      content: "- x",
      figures: [fig("a"), fig("b")],
    }))
    const one = estimateHeightBreakdown(makeCard({
      pattern: "bullets-two-images",
      content: "- x",
      figures: [fig("a")],
    }))
    const none = estimateHeightBreakdown(makeCard({
      pattern: "image-focused",
      content: "",
      figures: [],
    }))
    expect(two.figures).toBe(150)
    expect(two.figures).toBeLessThan(one.figures)
    expect(none.figures).toBe(0)
  })

  it("accounts for paper, slide, and two-column structural patterns", () => {
    const fig = (id: string) => ({ id, url: `/assets/${id}.png`, caption: "" })
    expect(estimateHeightBreakdown(makeCard({ pattern: "section-figure", figures: [fig("a")] })).figures).toBeGreaterThan(0)
    expect(estimateHeightBreakdown(makeCard({ pattern: "section-two-figures", figures: [fig("a"), fig("b")] })).figures).toBeGreaterThan(0)
    expect(estimateHeightBreakdown(makeCard({ pattern: "section-table" })).table).toBeGreaterThan(0)
    expect(estimateHeightBreakdown(makeCard({ pattern: "figure-slide", figures: [fig("a")] })).figures).toBeGreaterThan(0)
    expect(estimateHeightBreakdown(makeCard({ pattern: "two-column" })).chrome).toBeGreaterThan(
      estimateHeightBreakdown(makeCard({ pattern: "bullets" })).chrome,
    )
  })

  it("tolerates a malformed content field without throwing", () => {
    const bad = makeCard({ content: undefined as never })
    expect(() => estimateHeightBreakdown(bad)).not.toThrow()
    expect(estimateHeightBreakdown(bad).prose).toBe(0)
  })
})

describe("suggestReductions", () => {
  it("returns nothing when the card is within budget", () => {
    expect(suggestReductions(makeCard({ content: "short" }), 900)).toEqual([])
  })

  it("suggests dropping bullets for a bullet-heavy card", () => {
    const content = Array.from({ length: 40 }, (_, i) => `- bullet number ${i}`).join("\n")
    const fixes = suggestReductions(makeCard({ content }), 300)
    expect(fixes.join(" ")).toMatch(/drop the \d+ shortest bullets/)
  })

  it("suggests shrinking the figure when a figure dominates", () => {
    const fixes = suggestReductions(makeCard({
      pattern: "image-focused",
      content: "",
      figures: [{ id: "f1", url: "/assets/a.png", caption: "" }],
    }), 200)
    expect(fixes.join(" ")).toContain("shrink the figure")
  })

  it("suggests splitting the table for a row-heavy table card", () => {
    const rows = Array.from({ length: 30 }, (_, i) => [`r${i}`, "v"])
    const fixes = suggestReductions(
      makeCard({ pattern: "bullets-table", content: "x", table: { hasHeader: true, caption: "", rows } }),
      400
    )
    expect(fixes.join(" ")).toMatch(/move \d+ table rows? to a second card/)
  })
})

describe("validateCard budget integration", () => {
  const bigCard = makeCard({
    content: Array.from({ length: 60 }, (_, i) => `- a reasonably long bullet line number ${i}`).join("\n"),
  })

  it("uses the template budget, so landscape overflows earlier than portrait", () => {
    const midCard = makeCard({ content: "x".repeat(3200) })
    const portrait = validateCard(midCard, "atlas").filter((m) => m.message.includes("exceeds"))
    const landscape = validateCard(midCard, "betterposter").filter((m) => m.message.includes("exceeds"))
    expect(portrait).toHaveLength(0)
    expect(landscape).toHaveLength(1)
  })

  it("names concrete reductions in the overflow warning", () => {
    const msg = validateCard(bigCard, "atlas").find((m) => m.message.includes("exceeds"))
    expect(msg).toBeDefined()
    expect(msg!.message).toContain("Options:")
    expect(msg!.message).toMatch(/−\d+u/)
  })

  it("reports the overflow amount explicitly", () => {
    const msg = validateCard(bigCard, "atlas").find((m) => m.message.includes("exceeds"))
    expect(msg!.message).toMatch(/by \d+u/)
  })

  it("honors an explicit per-card height target", () => {
    const card = makeCard({ content: "x".repeat(1000), heightBudget: 200 })
    const msg = validateCard(card, "atlas").find((m) => m.message.includes("exceeds"))
    expect(msg?.message).toContain("card budget 200u")
  })

  it("keeps the no-template signature working (portrait default)", () => {
    expect(() => validateCard(bigCard)).not.toThrow()
    const msg = validateCard(bigCard).find((m) => m.message.includes("exceeds"))
    expect(msg!.message).toContain(`${COLUMN_BUDGET}u`)
  })
})

describe("aggregate poster column validation", () => {
  const first = makeCard({ id: "card_first", column: 1, content: "x".repeat(2000) })
  const second = makeCard({ id: "card_second", column: 1, content: "y".repeat(2000) })
  const cards = [first, second]

  it("detects overflow made up of individually valid cards", () => {
    expect(validateCard(first, "atlas").some((m) => m.message.includes("exceeds"))).toBe(false)

    const occupancy = estimatePosterColumnOccupancy(cards, "atlas").find((result) => result.column === 1)
    expect(occupancy?.overflow).toBeGreaterThan(0)

    const errors = validatePosterColumns(cards, "atlas")
    expect(errors).toEqual([
      expect.objectContaining({ level: "error", field: "column-1" }),
    ])
  })

  it("propagates the document-level failure when sibling context is supplied", () => {
    const messages = validateCard(first, "atlas", cards)
    expect(messages).toContainEqual(
      expect.objectContaining({ level: "error", field: "column-1" }),
    )
  })
})
