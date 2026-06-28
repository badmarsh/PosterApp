import { describe, it, expect } from "vitest"
import { validateCard, hasUnsafeLatex, levelFromMessages } from "../validation"
import type { Card } from "@/lib/poster-types"

describe("LaTeX Validation", () => {
  it("detects unbalanced braces", () => {
    expect(hasUnsafeLatex("hello { world")).toContain("unbalanced {}")
    expect(hasUnsafeLatex("hello } world")).toContain("unbalanced {}")
    expect(hasUnsafeLatex("hello { world }")).toEqual([])
  })

  it("validates a valid card", () => {
    const card: Card = {
      id: "blk_test",
      title: "Test Card",
      column: 1,
      order: 0,
      pattern: "bullets",
      content: "- content",
      table: { hasHeader: true, caption: "", rows: [] },
      figures: [],
      figureLayout: "single",
      sourceIds: [],
      heightBudget: null,
      validation: "valid",
    }
    const msgs = validateCard(card)
    expect(msgs).toEqual([])
    expect(levelFromMessages(msgs)).toBe("valid")
  })

  it("detects missing title", () => {
    const card: Card = {
      id: "blk_test",
      title: "",
      column: 1,
      order: 0,
      pattern: "bullets",
      content: "- content",
      table: { hasHeader: true, caption: "", rows: [] },
      figures: [],
      figureLayout: "single",
      sourceIds: [],
      heightBudget: null,
      validation: "valid",
    }
    const msgs = validateCard(card)
    expect(msgs.find((m) => m.field === "title")).toBeDefined()
    expect(levelFromMessages(msgs)).toBe("invalid")
  })

  it("detects missing content for bullets pattern", () => {
    const card: Card = {
      id: "blk_test",
      title: "Test",
      column: 1,
      order: 0,
      pattern: "bullets",
      content: "",
      table: { hasHeader: true, caption: "", rows: [] },
      figures: [],
      figureLayout: "single",
      sourceIds: [],
      heightBudget: null,
      validation: "valid",
    }
    const msgs = validateCard(card)
    expect(msgs.find((m) => m.field === "content")).toBeDefined()
    expect(levelFromMessages(msgs)).toBe("invalid")
  })
})
