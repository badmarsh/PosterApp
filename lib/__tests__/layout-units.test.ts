/**
 * Height-unit ↔ character budget conversions (Objective D).
 *
 * The auto-fill API budgets AI text from the card's height budget using the
 * SAME coefficients as estimateHeight; these tests lock the round-trip
 * property so the two directions can never diverge.
 */

import { describe, it, expect } from "vitest"
import {
  estimateHeight,
  heightUnitsToCharacters,
  charactersToHeightUnits,
  COLUMN_BUDGET,
  COLUMN_BUDGET_BY_TEMPLATE,
  columnBudgetFor,
} from "@/lib/latex/layout"
import type { Card } from "@/lib/poster-types"

const makeCard = (overrides: Partial<Card> = {}): Card => ({
  id: "t",
  title: "T",
  column: 1,
  order: 0,
  pattern: "bullets",
  content: "",
  table: { hasHeader: false, caption: "", rows: [] },
  figures: [],
  figureLayout: "single",
  heightBudget: null,
  validation: "pending",
  ...overrides,
})

describe("heightUnitsToCharacters", () => {
  it("converts the full column budget with estimateHeight's prose rate", () => {
    // 900 units × 60 chars / 14 units ≈ 3857 chars
    expect(heightUnitsToCharacters(COLUMN_BUDGET)).toBe(Math.floor((COLUMN_BUDGET * 60) / 14))
  })

  it("subtracts reserved units before converting", () => {
    expect(heightUnitsToCharacters(900, 500)).toBe(heightUnitsToCharacters(400))
  })

  it("returns 0 for non-positive budgets and fully-reserved budgets", () => {
    expect(heightUnitsToCharacters(0)).toBe(0)
    expect(heightUnitsToCharacters(-5)).toBe(0)
    expect(heightUnitsToCharacters(100, 100)).toBe(0)
    expect(heightUnitsToCharacters(100, 250)).toBe(0)
    expect(heightUnitsToCharacters(Number.NaN)).toBe(0)
  })

  it("is monotonic in the budget", () => {
    expect(heightUnitsToCharacters(300)).toBeLessThan(heightUnitsToCharacters(600))
  })
})

describe("charactersToHeightUnits — round trip", () => {
  it("inverts heightUnitsToCharacters without exceeding the budget", () => {
    for (const budget of [100, 150, 520, 700, 900, 1000]) {
      const chars = heightUnitsToCharacters(budget)
      expect(chars).toBeGreaterThan(0)
      // ceil() on the way back → the reconstruction never exceeds the budget…
      expect(charactersToHeightUnits(chars)).toBeLessThanOrEqual(budget)
      // …and stays within one prose-line (14u) of it.
      expect(charactersToHeightUnits(chars)).toBeGreaterThan(budget - 14)
    }
  })

  it("agrees with estimateHeight's prose accounting", () => {
    // 4200 chars of pure prose in a bullets card → prose units = ceil(4200*14/60)
    const chars = 4200
    const card = makeCard({ content: "x".repeat(chars) })
    const proseUnits = estimateHeight(card) - 70 /* chrome */
    expect(proseUnits).toBe(charactersToHeightUnits(chars))
  })

  it("returns 0 for non-positive input", () => {
    expect(charactersToHeightUnits(0)).toBe(0)
    expect(charactersToHeightUnits(-1)).toBe(0)
    expect(charactersToHeightUnits(Number.NaN)).toBe(0)
  })
})

describe("template budgets feed the conversion", () => {
  it("every template budget converts to a sane character budget", () => {
    for (const budget of Object.values(COLUMN_BUDGET_BY_TEMPLATE)) {
      const chars = heightUnitsToCharacters(budget)
      expect(chars).toBeGreaterThan(500)
      expect(chars).toBeLessThan(10_000)
    }
    expect(heightUnitsToCharacters(columnBudgetFor("unknown-template"))).toBe(
      heightUnitsToCharacters(COLUMN_BUDGET)
    )
  })
})
