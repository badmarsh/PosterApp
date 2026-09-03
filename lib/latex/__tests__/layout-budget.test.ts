import { describe, it, expect } from "vitest"
import {
  COLUMN_BUDGET,
  columnBudgetFor,
  estimateHeight,
  estimateHeightBreakdown,
  suggestReductions,
} from "@/lib/latex/layout"
import { validateCard } from "@/lib/latex/validation"
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
    const b = estimateHeightBreakdown(makeCard({ pattern: "image-focused", content: "" }))
    expect(b.figures).toBe(260)
    expect(b.prose).toBe(0)
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
    const fixes = suggestReductions(makeCard({ pattern: "image-focused", content: "" }), 200)
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

  it("keeps the no-template signature working (portrait default)", () => {
    expect(() => validateCard(bigCard)).not.toThrow()
    const msg = validateCard(bigCard).find((m) => m.message.includes("exceeds"))
    expect(msg!.message).toContain(`${COLUMN_BUDGET}u`)
  })
})
