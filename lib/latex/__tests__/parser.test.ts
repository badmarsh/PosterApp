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
