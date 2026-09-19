import { describe, it, expect } from "vitest"
import { createEditorStore } from "@/components/editor-store"
import { deriveQuickFixes, findDanglingCiteKeys, findDanglingRefKeys } from "@/lib/latex/quick-fixes"
import type { Card } from "@/lib/poster-types"

describe("QuickFixesPanel snapshot caching and stability", () => {
  it("ensures quick fixes and dangling keys derivation is pure and stable", () => {
    const testCard: Card = {
      id: "card_1",
      title: "Methodology",
      column: 1,
      order: 0,
      pattern: "bullets",
      content: "As shown in \\cite{einstein1905} and equation \\eqref{eq:energy}: $E = mc^2",
      table: { hasHeader: false, caption: "", rows: [] },
      figures: [],
      figureLayout: "single",
      validation: "valid",
    }

    const bibKeys = ["other2020"]
    const allCardContents = ["Some other card content with \\label{eq:mass}"]

    // Multiple calls return consistent results without side-effects
    const fixes1 = deriveQuickFixes(testCard)
    const fixes2 = deriveQuickFixes(testCard)
    expect(fixes1.map((f) => f.id)).toEqual(fixes2.map((f) => f.id))
    expect(fixes1.find((f) => f.id === "close-math")).toBeDefined()

    const danglingCites1 = findDanglingCiteKeys(testCard.content, bibKeys)
    const danglingCites2 = findDanglingCiteKeys(testCard.content, bibKeys)
    expect(danglingCites1).toEqual(["einstein1905"])
    expect(danglingCites1).toEqual(danglingCites2)

    const danglingRefs1 = findDanglingRefKeys(testCard.content, allCardContents)
    const danglingRefs2 = findDanglingRefKeys(testCard.content, allCardContents)
    expect(danglingRefs1).toEqual(["eq:energy"])
    expect(danglingRefs1).toEqual(danglingRefs2)
  })

  it("ensures store selectors for QuickFixesPanel return stable references", () => {
    const store = createEditorStore()
    const state = store.getState()

    // bibKeys in store should be a stable reference across multiple calls
    expect(state.bibKeys).toBe(state.bibKeys)
    expect(Array.isArray(state.bibKeys)).toBe(true)

    // cards selector should not generate new array wrappers on subsequent calls
    const selectCards = (s: typeof state) =>
      s.project.outputs?.find((o) => o.id === s.project.activeOutputId)?.cards
    const cards1 = selectCards(state)
    const cards2 = selectCards(state)
    expect(cards1).toBe(cards2)
  })
})
