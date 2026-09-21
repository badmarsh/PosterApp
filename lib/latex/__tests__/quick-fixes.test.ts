import { describe, it, expect } from "vitest"
import {
  braceBalance,
  deriveQuickFixes,
  findUnknownMathCommands,
  findDanglingCiteKeys,
  findDanglingRefKeys,
} from "@/lib/latex/quick-fixes"
import type { Card } from "@/lib/poster-types"

function card(content: string): Card {
  return {
    id: "card_test",
    title: "Test",
    column: 1,
    order: 0,
    pattern: "bullets",
    content,
    table: { hasHeader: false, caption: "", rows: [] },
    figures: [],
    figureLayout: "single",
    validation: "valid",
  }
}

function fixById(id: string) {
  return (c: string) => deriveQuickFixes(card(c)).find((f) => f.id === id)
}

describe("braceBalance", () => {
  it("counts unescaped braces and ignores escaped ones", () => {
    expect(braceBalance("a {b} c")).toBe(0)
    expect(braceBalance("a {b c")).toBe(1)
    expect(braceBalance("a b} c")).toBe(-1)
    expect(braceBalance("\\{literal\\}")).toBe(0)
    expect(braceBalance("frac{a}{b}")).toBe(0)
  })

  it("ignores escaped braces inside math so $\\{x\\}$ is not an extra }", () => {
    expect(braceBalance("$\\{x\\}$")).toBe(0)
    expect(braceBalance("$\\frac{a}{b}$ and {unclosed")).toBe(1)
    expect(fixById("balance-braces")("$\\{x\\}$")).toBeUndefined()
  })
})

describe("deriveQuickFixes — close-math", () => {
  it("offers a fix when $ delimiters are unbalanced and appends the missing $", () => {
    const fix = fixById("close-math")("The value $x is important")
    expect(fix).toBeDefined()
    expect(fix!.apply("The value $x is important")).toBe("The value $x is important$")
  })

  it("preserves trailing newlines when appending the $", () => {
    const fix = fixById("close-math")("Euler: $e^{i\\pi} + 1 = 0\n\n")
    expect(fix!.apply("Euler: $e^{i\\pi} + 1 = 0\n\n")).toBe("Euler: $e^{i\\pi} + 1 = 0$\n\n")
  })

  it("does not offer close-math when dollars are balanced (including escaped \\$)", () => {
    expect(fixById("close-math")("Costs 5\\$ and $x$ units")).toBeUndefined()
    expect(fixById("close-math")("No math at all")).toBeUndefined()
  })
})

describe("deriveQuickFixes — balance-braces", () => {
  it("appends missing closing braces", () => {
    const fix = fixById("balance-braces")("Bold: **text** and {unclosed")
    expect(fix).toBeDefined()
    expect(fix!.apply("Bold: **text** and {unclosed")).toBe("Bold: **text** and {unclosed}")
    expect(braceBalance(fix!.apply("Bold: **text** and {unclosed"))).toBe(0)
    // A fresh derivation for a two-deep imbalance appends both braces.
    const fix2 = fixById("balance-braces")("a{b{c")
    expect(fix2!.apply("a{b{c")).toBe("a{b{c}}")
    expect(braceBalance(fix2!.apply("a{b{c"))).toBe(0)
  })

  it("removes surplus closing braces from the end", () => {
    const fix = fixById("balance-braces")("text }")
    expect(fix).toBeDefined()
    expect(fix!.apply("text }")).toBe("text ")
    expect(fix!.apply("a } b }")).toBe("a } b ")
  })

  it("does not offer balance-braces for balanced content", () => {
    expect(fixById("balance-braces")("{a} {b}")).toBeUndefined()
  })
})

describe("deriveQuickFixes — escape-unknown-commands", () => {
  it("detects unknown commands inside math segments", () => {
    expect(findUnknownMathCommands("$\\sqrt{x}$")).toEqual([])
    expect(findUnknownMathCommands("$\\foo{x}$")).toEqual(["\\foo"])
    expect(findUnknownMathCommands("$$\\begin{align}\\qrho\\end{align}$$")).toEqual(["\\qrho"])
    // Outside math it will be escaped by the pipeline — not a compile risk.
    expect(findUnknownMathCommands("plain \\foo text")).toEqual([])
  })

  it("neutralises unknown commands but keeps known ones", () => {
    const fix = fixById("escape-unknown-commands")("$\\sqrt{x} + \\foo{y}$")
    expect(fix).toBeDefined()
    expect(fix!.apply("$\\sqrt{x} + \\foo{y}$")).toBe("$\\sqrt{x} + foo{y}$")
  })

  it("leaves display math and citations intact", () => {
    const content = "$$\\frac{a}{b}$$\n\\cite{knuth1984}"
    expect(fixById("escape-unknown-commands")(content)).toBeUndefined()
  })
})

describe("deriveQuickFixes — clean content", () => {
  it("returns no fixes for valid content or empty content", () => {
    expect(deriveQuickFixes(card("Simple **markdown** with $x^2$ and - bullets"))).toEqual([])
    expect(deriveQuickFixes(card(""))).toEqual([])
    expect(deriveQuickFixes(card("   "))).toEqual([])
  })

  it("can offer multiple fixes at once", () => {
    const fixes = deriveQuickFixes(card("$\\foo$ and {unclosed"))
    expect(fixes.map((f) => f.id).sort()).toEqual(["balance-braces", "escape-unknown-commands"])
  })
})

describe("deriveQuickFixes — display math and \\text specials", () => {
  it("offers close-display-math for an orphaned $$ with even $ count", () => {
    const src = "The energy is $$E = mc^2"
    const fix = fixById("close-display-math")(src)
    expect(fix).toBeDefined()
    expect(fix!.apply(src)).toBe("The energy is $$E = mc^2$$")
    expect(fixById("close-math")(src)).toBeUndefined()
  })

  it("escapes unescaped specials inside \\text{...} in math", () => {
    const src = "$$\\text{a_b}$$"
    const fix = fixById("escape-text-specials")(src)
    expect(fix).toBeDefined()
    expect(fix!.apply(src)).toBe("$$\\text{a\\_b}$$")
  })
})

describe("findDanglingCiteKeys", () => {
  it("flags cite keys missing from the bibliography", () => {
    const content = "As shown \\cite{knuth1984} and [@doe2020]; also \\citep{smith, jones}"
    expect(findDanglingCiteKeys(content, ["knuth1984", "smith"])).toEqual(["doe2020", "jones"])
  })

  it("returns nothing when all keys resolve", () => {
    expect(findDanglingCiteKeys("\\cite{a}, [@b]", ["a", "b"])).toEqual([])
    expect(findDanglingCiteKeys("no citations", ["a"])).toEqual([])
  })
})

describe("findDanglingRefKeys", () => {
  it("flags refs without a matching \\label anywhere in the document", () => {
    const content = "see $\\ref{eq:mass}$ and \\ref{fig:arch}"
    const others = ["\\label{eq:mass} defined elsewhere"]
    expect(findDanglingRefKeys(content, others)).toEqual(["fig:arch"])
    expect(findDanglingRefKeys(content, [...others, "\\label{fig:arch} later"])).toEqual([])
  })
})
