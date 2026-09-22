import { describe, it, expect } from "vitest"
import {
  ensureEncodingPreamble,
  ensureMissingGraphicsFallback,
  ensureHyperrefPreamble,
  ensureScriptPackages,
  detectExtraScripts,
} from "@/lib/latex/generator"
describe("ensureEncodingPreamble", () => {
  it("adds T1/lmodern/babel after documentclass for sk", () => {
    const out = ensureEncodingPreamble("\\documentclass[a0paper]{tikzposter}\n\\usepackage{graphicx}\n", "sk")
    expect(out).toContain("\\usepackage[T1]{fontenc}")
    expect(out).toContain("\\usepackage[english,slovak]{babel}")
    expect(out.indexOf("fontenc")).toBeGreaterThan(out.indexOf("documentclass"))
    expect(out.indexOf("fontenc")).toBeLessThan(out.indexOf("graphicx"))
  })
  it("does not duplicate existing packages", () => {
    const src = "\\documentclass{beamer}\n\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}\n\\usepackage{lmodern}\n\\usepackage[czech]{babel}\n"
    expect(ensureEncodingPreamble(src, "cs")).toBe(src)
  })
})

describe("ensureMissingGraphicsFallback preamble placement", () => {
  it("inserts the definition before \\begin{document} even when graphicx is loaded by the class", () => {
    const src = [
      "\\documentclass{tikzposter}",
      "\\begin{document}",
      "\\includegraphics{fig.png}",
      "\\end{document}",
    ].join("\n")
    const out = ensureMissingGraphicsFallback(src)
    const defAt = out.indexOf("\\providecommand{\\PosterIncludeGraphics}")
    const beginAt = out.indexOf("\\begin{document}")
    expect(defAt).toBeGreaterThan(-1)
    expect(defAt).toBeLessThan(beginAt)
  })
})

describe("ensureScriptPackages", () => {
  it("loads T2A + russian babel for Cyrillic body text", () => {
    const src = "\\documentclass{article}\n\\usepackage[T1]{fontenc}\n\\usepackage[english]{babel}\n\\begin{document}\nПривет мир исследование\n\\end{document}\n"
    expect(detectExtraScripts(src).cyrillic).toBe(true)
    const out = ensureScriptPackages(src)
    expect(out).toContain("\\usepackage[T2A,T1]{fontenc}")
    expect(out).toMatch(/\\usepackage\[[^\]]*russian[^\]]*\]\{babel\}/)
  })

  it("wraps CJK body text in a CJKutf8 environment", () => {
    const src = "\\documentclass{article}\n\\begin{document}\n深度学习研究\n\\end{document}\n"
    const out = ensureScriptPackages(src)
    expect(out).toContain("\\usepackage{CJKutf8}")
    expect(out).toContain("\\begin{CJK*}{UTF8}{gbsn}")
    expect(out).toContain("\\end{CJK*}")
  })
})

describe("ensureHyperrefPreamble", () => {
  it("injects hyperref before \\begin{document} for ordinary templates", () => {
    const src = "\\documentclass{article}\n\\begin{document}\nHi\n\\end{document}\n"
    const out = ensureHyperrefPreamble(src, "atlas")
    expect(out).toContain("\\usepackage{hyperref}")
    expect(out.indexOf("hyperref")).toBeLessThan(out.indexOf("\\begin{document}"))
  })

  it("skips AAAI, acmart, and revtex which already manage hyperref", () => {
    expect(ensureHyperrefPreamble("\\documentclass{article}\n\\begin{document}\nHi\n\\end{document}\n", "aaai")).not.toContain("hyperref")
    expect(ensureHyperrefPreamble("\\documentclass[sigconf]{acmart}\n\\begin{document}\nHi\n\\end{document}\n", "acm-sigconf")).not.toContain("hyperref")
    expect(ensureHyperrefPreamble("\\documentclass{revtex4-2}\n\\begin{document}\nHi\n\\end{document}\n", "revtex-aps")).not.toContain("hyperref")
  })
})

import { detectDocumentLanguage } from "@/lib/latex/generator"
describe("detectDocumentLanguage", () => {
  it("detects Slovak, Czech and English", () => {
    expect(detectDocumentLanguage("\\begin{document} Ľudia, ktorí robia veľké veci. \\end{document}")).toBe("sk")
    expect(detectDocumentLanguage("\\begin{document} Příliš žluťoučký kůň úpěl ďábelské ódy. \\end{document}")).toBe("cs")
    expect(detectDocumentLanguage("\\begin{document} Plain English poster text. \\end{document}")).toBe("en")
  })
})
