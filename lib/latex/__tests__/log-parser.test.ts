import { describe, it, expect } from "vitest"
import {
  parseCompileLog,
  attributeIssuesToCards,
  extractQuotedNames,
} from "@/lib/latex/log-parser"
import type { Card } from "@/lib/poster-types"

function card(partial: Partial<Card> & { id: string }): Card {
  return {
    title: "T",
    column: 1,
    order: 0,
    pattern: "bullets",
    content: "",
    table: { hasHeader: false, caption: "", rows: [] },
    figures: [],
    figureLayout: "single",
    validation: "valid",
    ...partial,
  }
}

describe("parseCompileLog", () => {
  it("returns an empty, succeeded parse for null/empty logs", () => {
    expect(parseCompileLog(null)).toEqual({
      issues: [],
      errorCount: 0,
      warningCount: 0,
      succeeded: true,
    })
    expect(parseCompileLog("")).toEqual({
      issues: [],
      errorCount: 0,
      warningCount: 0,
      succeeded: true,
    })
  })

  it("extracts a LaTeX error with l.NNN line and context", () => {
    const log = [
      "This is pdfTeX, Version 3.14159265",
      "Enter file name:",
      "! LaTeX Error: Environment equation undefined.",
      "",
      "See the LaTeX manual or LaTeX Companion for explanation.",
      "Type  H <return>  for immediate help.",
      "",
      "l.45 \\begin{equation}",
      "                x = 1",
      "? ",
    ].join("\n")
    const parsed = parseCompileLog(log)
    expect(parsed.errorCount).toBe(1)
    expect(parsed.succeeded).toBe(false)
    const issue = parsed.issues[0]
    expect(issue.kind).toBe("latex-error")
    expect(issue.line).toBe(45)
    expect(issue.context).toBe("\\begin{equation}")
    expect(issue.message).toBe("LaTeX Error: Environment equation undefined.")
  })

  it("classifies undefined control sequences and captures the command from detail", () => {
    const log = [
      "! Undefined control sequence.",
      "l.120 \\captionshort",
      "                   {X}",
    ].join("\n")
    const parsed = parseCompileLog(log)
    expect(parsed.issues[0].kind).toBe("undefined-control-sequence")
    expect(parsed.issues[0].line).toBe(120)
    // The offending command lands on the l.NNN context line.
    expect(parsed.issues[0].context).toBe("\\captionshort")
  })

  it("classifies Missing $ inserted as a math error", () => {
    const log = ["! Missing $ inserted.", "", "l.88 p价值", "                "].join("\n")
    const parsed = parseCompileLog(log)
    expect(parsed.issues[0].kind).toBe("math")
  })

  it("classifies package errors separately from generic LaTeX errors", () => {
    const log = [
      "! Package pdftex.def Error: File `fig.png' not found.",
      "",
      "See the pdftex.def package documentation for explanation.",
    ].join("\n")
    const parsed = parseCompileLog(log)
    expect(parsed.issues[0].kind).toBe("file-not-found")
    expect(extractQuotedNames(parsed.issues[0].message)).toContain("fig.png")
  })

  it("collects overfull boxes as info and underfull/package warnings as warnings", () => {
    const log = [
      "Overfull \\hbox (14.20343pt too wide) in paragraph at lines 120--126",
      "Underfull \\hbox (badness 10000) in paragraph at lines 30--31",
      "Package hyperref Warning: Token not allowed in a PDF string on input line 55.",
      "LaTeX Warning: Citation `knuth1984' on page 1 undefined on input line 10.",
    ].join("\n")
    const parsed = parseCompileLog(log)
    expect(parsed.errorCount).toBe(0)
    expect(parsed.succeeded).toBe(true)
    expect(parsed.warningCount).toBe(2)
    const overfull = parsed.issues.find((i) => i.kind === "overfull")
    expect(overfull?.severity).toBe("info")
    expect(overfull?.line).toBe(120)
    expect(parsed.issues.filter((i) => i.severity === "warning")).toHaveLength(2)
  })

  it("flags a fatal error run as unsuccesful", () => {
    const log = [
      "!  ==> Fatal error occurred, no output PDF file produced!",
    ].join("\n")
    const parsed = parseCompileLog(log)
    expect(parsed.succeeded).toBe(false)
    expect(parsed.issues[0].kind).toBe("fatal")
  })

  it("recognises bibtex failures", () => {
    const log = ["I couldn't open style file plain.bst", "--- line 1 of file main.aux"].join("\n")
    const parsed = parseCompileLog(log)
    expect(parsed.issues[0].kind).toBe("bibtex")
    expect(parsed.issues[0].severity).toBe("warning")
  })

  it("caps pathological logs at MAX_ISSUES without throwing", () => {
    const log = Array.from({ length: 5000 }, (_, i) => `! Boom ${i}`).join("\n")
    const parsed = parseCompileLog(log)
    expect(parsed.issues.length).toBeLessThanOrEqual(200)
  })

  it("never leaves an unknown error shape unparsed", () => {
    const log = ["! Some totally new error from a future pdflatex.", "with detail"].join("\n")
    const parsed = parseCompileLog(log)
    expect(parsed.errorCount).toBe(1)
    expect(parsed.issues[0].kind).toBe("latex-error")
    expect(parsed.issues[0].detail).toContain("with detail")
  })
})

describe("attributeIssuesToCards", () => {
  const cards: Card[] = [
    card({ id: "card_method", title: "Method", content: "We use a convolutional approach with layer norm." }),
    card({
      id: "card_results",
      title: "Results",
      content: "Accuracy numbers in $\\sqrt{x}$ math.",
    }),
    card({
      id: "card_fig",
      title: "Architecture",
      content: "See the diagram.",
      figures: [{ id: "f1", url: "/api/workspaces/w1/assets/arch.png", caption: "Architecture" }],
    }),
  ]

  it("attributes undefined control sequence errors via the offending command", () => {
    // The results card literally contains \sqrt — the log detail names it.
    const log = ["! Undefined control sequence.", "l.9 \\sqrt", "         {x}"].join("\n")
    const parsed = parseCompileLog(log)
    const attributed = attributeIssuesToCards(parsed.issues, cards)
    // \sqrt is inside math in the card source, so the raw text matches.
    expect(attributed[0].cardId).toBe("card_results")
  })

  it("attributes errors via normalized l.NNN context text", () => {
    // Content "convolutional approach" survives parsing as plain words; the
    // context line contains escaped variants of the same words.
    const log = [
      "! Undefined control sequence.",
      "l.31 \\textbf{convolutional} approach with",
      "                             layer norm.",
    ].join("\n")
    const parsed = parseCompileLog(log)
    const attributed = attributeIssuesToCards(parsed.issues, cards)
    expect(attributed[0].cardId).toBe("card_method")
  })

  it("returns issues untouched (no cardId) when nothing matches", () => {
    const log = ["! Emergency stop.", "", "l.1 ??"].join("\n")
    const parsed = parseCompileLog(log)
    const attributed = attributeIssuesToCards(parsed.issues, cards)
    expect(attributed[0].cardId).toBeUndefined()
  })

  it("does not mutate the input issues", () => {
    const parsed = parseCompileLog("! Undefined control sequence.\nl.9 \\sqrt {x}")
    const frozen = Object.freeze([...parsed.issues])
    attributeIssuesToCards(frozen as unknown as typeof parsed.issues, cards)
    expect(frozen[0].cardId).toBeUndefined()
  })

  it("handles an empty card list", () => {
    const parsed = parseCompileLog("! Undefined control sequence.\nl.9 \\sqrt {x}")
    const attributed = attributeIssuesToCards(parsed.issues, [])
    expect(attributed[0].cardId).toBeUndefined()
  })
})
