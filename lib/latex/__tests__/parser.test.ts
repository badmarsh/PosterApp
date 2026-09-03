import { describe, it, expect } from "vitest"
import { parseMarkdownToLatex, escapeLatex } from "../parser"

describe("LaTeX Parser", () => {
  it("escapes special characters", () => {
    expect(escapeLatex("foo & bar % baz # qux _")).toBe("foo \\& bar \\% baz \\# qux \\_")
  })

  it("handles markdown bold and italic", () => {
    expect(parseMarkdownToLatex("**bold** and *italic*")).toBe("\\textbf{bold} and \\textit{italic}")
  })

  it("handles markdown code", () => {
    expect(parseMarkdownToLatex("`code`")).toBe("\\texttt{code}")
  })

  it("handles markdown links", () => {
    expect(parseMarkdownToLatex("[Google](https://google.com)")).toBe("\\href{https://google.com}{Google}")
  })

  it("handles bullet lists", () => {
    const input = "- item 1\n- item 2"
    const expected = "\\begin{itemize}\\setlength{\\itemsep}{0.3em}\n  \\item item 1\n  \\item item 2\n\\end{itemize}"
    expect(parseMarkdownToLatex(input)).toBe(expected)
  })

  it("protects math regions", () => {
    const input = "Here is math $E=mc^2$ and some text."
    expect(parseMarkdownToLatex(input)).toBe("Here is math $E=mc^2$ and some text.")
  })

  it("escapes untrusted LaTeX macros", () => {
    const input = "Here is a macro \\textcolor{red}{Red text}."
    expect(parseMarkdownToLatex(input)).not.toContain("\\textcolor")
  })

  it("does not permit dangerous commands in math", () => {
    expect(parseMarkdownToLatex("$\\input{secrets}$")).not.toContain("\\input")
  })
})

describe("markdown link URLs (A-02)", () => {
  it("does not escape LaTeX specials inside the href target", () => {
    const out = parseMarkdownToLatex("See [Paper](https://ex.com/a_b?x=1&y=2#sec)")
    expect(out).toBe("See \\href{https://ex.com/a_b?x=1&y=2#sec}{Paper}")
  })

  it("keeps DOI underscores intact", () => {
    expect(parseMarkdownToLatex("[X](https://doi.org/10.1_5/a)")).toBe("\\href{https://doi.org/10.1_5/a}{X}")
  })

  it("still escapes the link text while leaving the URL alone", () => {
    expect(parseMarkdownToLatex("[Smith & Co](https://ex.com/a%20b)")).toBe(
      "\\href{https://ex.com/a%20b}{Smith \\& Co}"
    )
  })

  it("renders links inside bullet lists", () => {
    const out = parseMarkdownToLatex("- see [d](https://ex.com/x_y)")
    expect(out).toContain("\\item see \\href{https://ex.com/x_y}{d}")
    expect(out).toContain("\\begin{itemize}")
  })

  it("drops the href for non-http targets, keeping escaped text", () => {
    expect(parseMarkdownToLatex("[a_b](mailto:x@y.z)")).toBe("a\\_b")
  })
})
