import { describe, it, expect } from "vitest"
import { ensureEncodingPreamble } from "@/lib/latex/generator"
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

import { detectDocumentLanguage } from "@/lib/latex/generator"
describe("detectDocumentLanguage", () => {
  it("detects Slovak, Czech and English", () => {
    expect(detectDocumentLanguage("\\begin{document} Ľudia, ktorí robia veľké veci. \\end{document}")).toBe("sk")
    expect(detectDocumentLanguage("\\begin{document} Příliš žluťoučký kůň úpěl ďábelské ódy. \\end{document}")).toBe("cs")
    expect(detectDocumentLanguage("\\begin{document} Plain English poster text. \\end{document}")).toBe("en")
  })
})
