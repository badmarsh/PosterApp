import { describe, it, expect } from "vitest"
import { TEMPLATE_REGISTRY, getTemplatesForType, type TemplateDef } from "@/lib/output-types"
import { generateFullTemplate } from "@/lib/latex/generator"
import { getA0PosterTemplate, getAuroraTemplate, getEditorialTemplate, getTikzposterTemplate } from "@/lib/latex/templates"
import {
  checkLatexDocument,
  blankDefinitionBodies,
  stripComments,
  checkWideInlineMath,
  latexErrors,
} from "@/lib/latex/static-checks"
import type { Card, Project, OutputConfig } from "@/lib/poster-types"

/**
 * Every generated document is run through the structural audit in
 * `lib/latex/static-checks.ts`. A real pdflatex compile is the complete oracle
 * but cannot run in CI; the checks here are written against the specific TeX
 * error each finding stands in for (see the `texHint` field), so a green run
 * means "none of the known fatal structural defects are present", not "this
 * definitely typesets".
 */

function card(patch: Partial<Card> = {}): Card {
  return {
    id: "blk_x",
    title: "Section",
    column: 1,
    order: 0,
    pattern: "section",
    content: "Body text.",
    table: { hasHeader: true, caption: "", rows: [] },
    figures: [],
    figureLayout: "single",
    sourceIds: [],
    heightBudget: null,
    validation: "valid",
    ...patch,
  } as Card
}

/**
 * A deliberately hostile card set: wide inline math, short inline math,
 * Unicode that must survive `inputenc`, a markdown link (which the parser
 * turns into `\href`), stat tiles, a booktabs table, two figures (one whose
 * URL normalises to nothing) and a bibliography.
 */
/** Two-figure pattern name per output type. */
const FIGURE_PATTERN_BY_TYPE: Record<string, string> = {
  poster: "bullets-two-images",
  slides: "bullets-image",
  paper: "section-two-figures",
  "thesis-review": "section-figure",
}

function stressCards(outputType: string): Card[] {
  const FIGURE_PATTERN = FIGURE_PATTERN_BY_TYPE[outputType] ?? "bullets-two-images"
  return [
  card({
    id: "blk_math",
    title: "Intro & Math",
    column: 1,
    order: 0,
    pattern: "bullets",
    content: [
      "- Wide: $\\sum_{i=1}^{N}\\frac{\\partial \\mathcal{L}}{\\partial \\theta_i}\\nabla_{\\phi} \\log p_{\\theta}(x_i)$",
      "- Short inline $\\chi^2$ and $\\alpha=0.05$ stay untouched",
      "- Unicode: 8×P100, χ² test, α ≤ 0.05",
      "- Link: see [the paper](https://ex.com/a_b?x=1&y=2#sec%20a) for details",
      "- Display: $$\\int_{0}^{\\infty} e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}$$",
    ].join("\n"),
  }),
  card({
    id: "blk_stats",
    title: "Headline Results",
    column: 2,
    order: 0,
    pattern: "stats",
    content: [
      "**28.4 BLEU EN-DE** | +2.0 over SOTA",
      "**41.0 BLEU EN-FR** | State-of-the-art",
      "**3.5 d Training** | 8 $\\times$ P100",
    ].join("\n"),
    table: {
      hasHeader: true,
      caption: "Table 1: Main results",
      rows: [
        ["Model", "BLEU", "TER"],
        ["Baseline", "26.4", "0.41"],
        ["Ours", "28.4", "0.38"],
      ],
    },
  }),
  card({
    id: "blk_figs",
    title: "Figures",
    column: 3,
    order: 0,
    // Each output type has its own two-figure pattern name; see
    // PATTERNS_FOR_TYPE in lib/output-types.ts. Using a pattern the generator
    // does not handle would silently emit no figure at all and the empty-path
    // regression below would pass for the wrong reason.
    pattern: FIGURE_PATTERN as Card["pattern"],
    content: "- first finding\n- second finding",
    figures: [
      { id: "f1", url: "/api/workspaces/ws1/assets/arch.png", caption: "Figure 1: a_b & c" },
      // Normalises to the empty string — must be dropped, not emitted as
      // `\includegraphics{}`.
      { id: "f2", url: "%$#^", caption: "Figure 2" },
    ] as never,
  }),
  card({ id: "blk_refs", title: "References", column: 3, order: 1, pattern: "references", content: "" }),
  ]
}

function projectFor(t: TemplateDef): Project {
  const STRESS_CARDS = stressCards(t.outputType)
  return {
    id: "prj_1",
    revision: 1,
    name: "Test Project",
    authors: "Róbert Astaloš, Jane Roe",
    venue: "Venue 2026",
    activeOutputId: "out_1",
    outputs: [
      { id: "out_1", outputType: t.outputType, templateId: t.id, title: "A Study of Deep Models", cards: STRESS_CARDS },
    ],
    assets: [],
    ingestFiles: [],
  } as unknown as Project
}

function outputFor(t: TemplateDef): OutputConfig {
  return {
    id: "out_1",
    outputType: t.outputType,
    templateId: t.id,
    title: "A Study of Deep Models",
    cards: stressCards(t.outputType),
  } as unknown as OutputConfig
}

function generate(t: TemplateDef): string {
  return generateFullTemplate(projectFor(t), outputFor(t), "ws1")
}

describe("LaTeX static audit — every registered template", () => {
  it.each(TEMPLATE_REGISTRY.map((t) => [t.id, t] as const))(
    "%s generates a structurally clean document",
    (_id, t) => {
      const tex = generate(t)
      const findings = checkLatexDocument(tex)
      expect(findings, findings.map((f) => `${f.code}: ${f.message}`).join("\n")).toEqual([])
    },
  )

  it("covers all four output types", () => {
    const types = new Set(TEMPLATE_REGISTRY.map((t) => t.outputType))
    expect([...types].sort()).toEqual(["paper", "poster", "slides", "thesis-review"])
  })

  it("the new aurora / editorial / a0poster templates are registered and reachable", () => {
    expect(getTemplatesForType("poster").map((t) => t.id)).toContain("aurora")
    expect(getTemplatesForType("poster").map((t) => t.id)).toContain("a0poster")
    expect(getTemplatesForType("slides").map((t) => t.id)).toContain("beamer-editorial")
  })
})

describe("Regression: \\href must exist in every document", () => {
  // `\href` is what the markdown parser emits for [text](url). Most templates
  // get it from the auto-injected hyperref; AAAI cannot load hyperref at all
  // (aaai2026.sty:239 raises a \PackageError), so it needs the fallback.
  it.each(TEMPLATE_REGISTRY.map((t) => [t.id, t] as const))(
    "%s defines \\href (hyperref or fallback)",
    (_id, t) => {
      const tex = generate(t)
      if (!/\\href(?![A-Za-z])/.test(tex)) return // no links in this document
      const hasHyperref = /\\usepackage(\[[^\]]*\])?\{hyperref\}/.test(tex)
      const hasFallback = /\\providecommand\{\\href\}/.test(tex)
      expect(hasHyperref || hasFallback, "neither hyperref nor a \\href fallback").toBe(true)
    },
  )

  it("aaai never loads hyperref but still defines \\href", () => {
    const aaai = TEMPLATE_REGISTRY.find((t) => t.id === "aaai")!
    const tex = generate(aaai)
    expect(tex).not.toMatch(/\\usepackage(\[[^\]]*\])?\{hyperref\}/)
    expect(tex).toMatch(/\\providecommand\{\\href\}\[2\]/)
    // The fallback must land in the preamble, not the body.
    expect(tex.indexOf("\\providecommand{\\href}")).toBeLessThan(tex.indexOf("\\begin{document}"))
  })
})

describe("Regression: colours used but never defined", () => {
  it("tikzposter defines maincolor before colorlet (was: Undefined color 'maincolor')", () => {
    const tex = getTikzposterTemplate(projectFor(TEMPLATE_REGISTRY[0]))
    const defineAt = tex.indexOf("\\definecolor{maincolor}")
    const colorletAt = tex.indexOf("\\colorlet{customaccent}{maincolor}")
    expect(defineAt).toBeGreaterThan(-1)
    expect(colorletAt).toBeGreaterThan(-1)
    expect(defineAt).toBeLessThan(colorletAt)
    expect(checkLatexDocument(tex).filter((f) => f.code === "undefined-color")).toEqual([])
  })

  it("a0poster loads xcolor so \\definecolor exists", () => {
    const tex = getA0PosterTemplate(projectFor(TEMPLATE_REGISTRY[0]))
    expect(tex).toMatch(/\\usepackage\{xcolor\}/)
    expect(tex.indexOf("\\usepackage{xcolor}")).toBeLessThan(tex.indexOf("\\definecolor{customaccent}"))
    expect(checkLatexDocument(tex).filter((f) => f.code === "missing-package")).toEqual([])
  })

  it("aurora resolves every colour it references", () => {
    const tex = getAuroraTemplate(projectFor(TEMPLATE_REGISTRY[0]))
    expect(checkLatexDocument(tex).filter((f) => f.code === "undefined-color")).toEqual([])
  })

  it("a genuinely undefined colour is caught", () => {
    const tex = "\\documentclass{article}\n\\usepackage{xcolor}\n\\begin{document}\n\\color{nosuchcolor} hi\n\\end{document}\n"
    const found = checkLatexDocument(tex)
    expect(found.some((f) => f.code === "undefined-color" && f.message.includes("nosuchcolor"))).toBe(true)
  })
})

describe("Regression: empty \\includegraphics paths", () => {
  it.each(["poster", "slides", "paper"] as const)("%s drops figures whose path normalises to empty", (outputType) => {
    const t = TEMPLATE_REGISTRY.find((x) => x.outputType === outputType)!
    const tex = generate(t)
    expect(tex).not.toMatch(/\\includegraphics(?:\[[^\]]*\])?\{\s*\}/)
    expect(tex).not.toMatch(/\\PosterIncludeGraphics(?:\[[^\]]*\])?\{\s*\}/)
    // The good figure survives.
    expect(tex).toContain("assets/arch.png")
  })

  it("an empty path is caught by the auditor", () => {
    const tex = "\\documentclass{article}\n\\usepackage{graphicx}\n\\begin{document}\n\\includegraphics[width=1cm]{}\n\\end{document}\n"
    expect(checkLatexDocument(tex).some((f) => f.code === "empty-graphics-path")).toBe(true)
  })
})

describe("Regression: list helpers open and close their own environment", () => {
  it.each(getTemplatesForType("poster").map((t) => [t.id, t] as const))(
    "%s has no unbalanced environment",
    (_id, t) => {
      const tex = generate(t)
      expect(checkLatexDocument(tex).filter((f) => f.code === "unbalanced-environment")).toEqual([])
    },
  )

  it("the old \\newcommand{\\looseitems}{\\begin{itemize}} shape is gone", () => {
    for (const t of getTemplatesForType("poster")) {
      const tex = generate(t)
      expect(tex, t.id).not.toMatch(/\\newcommand\{\\looseitems\}\{\\begin\{itemize\}/)
    }
  })

  it("an unclosed environment is caught", () => {
    const tex = "\\documentclass{article}\n\\begin{document}\n\\begin{itemize}\n\\item x\n\\end{document}\n"
    const found = checkLatexDocument(tex)
    expect(found.some((f) => f.code === "unbalanced-environment" && f.message.includes("itemize"))).toBe(true)
  })
})

describe("Math overflow protection", () => {
  it("wide inline math is wrapped in \\fitinline and short math is not", () => {
    const t = TEMPLATE_REGISTRY.find((x) => x.id === "minimal")!
    const tex = generate(t)
    expect(tex).toContain("\\fitinline{\\sum_{i=1}^{N}\\frac{\\partial \\mathcal{L}}")
    expect(tex).toContain("$\\chi^2$")
    expect(tex).toContain("$\\alpha=0.05$")
  })

  it("display math still becomes equation* + \\fitmath", () => {
    const t = TEMPLATE_REGISTRY.find((x) => x.id === "minimal")!
    const tex = generate(t)
    expect(tex).toContain("\\begin{equation*}\\fitmath{\\int_{0}^{\\infty}")
  })

  it("every template that can receive \\fitinline defines it", () => {
    for (const t of TEMPLATE_REGISTRY) {
      const tex = generate(t)
      if (/\\fitinline(?![A-Za-z])/.test(tex) || /\\fitmath(?![A-Za-z])/.test(tex)) {
        expect(tex, `${t.id} uses \\fit* without FITMATH_MACRO`).toMatch(/\\providecommand\{\\fitmath\}/)
      }
    }
  })

  it("the auditor ignores tikz coordinate arithmetic in $...$", () => {
    const tex = [
      "\\documentclass{tikzposter}",
      "\\begin{document}",
      "\\node at ($(\\titleposleft,\\titlepostop)!0.5!(\\titleposright,\\titleposbottom)$) {logo};",
      "\\end{document}",
    ].join("\n")
    expect(checkWideInlineMath(stripComments(tex))).toEqual([])
  })

  it("the auditor flags unprotected wide inline math", () => {
    const long = "x".repeat(60)
    const tex = `\\documentclass{article}\n\\begin{document}\n$${long}$\n\\end{document}\n`
    const found = checkWideInlineMath(stripComments(tex))
    expect(found).toHaveLength(1)
    expect(found[0].code).toBe("unprotected-wide-math")
  })
})

describe("Structural checks behave correctly on hand-built documents", () => {
  const clean = "\\documentclass{article}\n\\begin{document}\nHello.\n\\end{document}\n"

  it("accepts a minimal valid document", () => {
    expect(checkLatexDocument(clean)).toEqual([])
  })

  it("detects a missing \\documentclass", () => {
    expect(checkLatexDocument("\\begin{document}\nHi\n\\end{document}\n").some((f) => f.code === "missing-documentclass")).toBe(true)
  })

  it("detects \\usepackage after \\begin{document}", () => {
    const tex = "\\documentclass{article}\n\\begin{document}\n\\usepackage{amsmath}\n\\end{document}\n"
    expect(checkLatexDocument(tex).some((f) => f.code === "package-after-begin-document")).toBe(true)
  })

  it("detects unbalanced braces", () => {
    const tex = "\\documentclass{article}\n\\begin{document}\n\\textbf{oops\n\\end{document}\n"
    expect(checkLatexDocument(tex).some((f) => f.code === "unbalanced-braces")).toBe(true)
  })

  it("detects a command whose package is missing", () => {
    const tex = "\\documentclass{article}\n\\begin{document}\n\\toprule\n\\end{document}\n"
    const found = checkLatexDocument(tex)
    expect(found.some((f) => f.code === "missing-package" && f.message.includes("booktabs"))).toBe(true)
  })

  it("accepts the same command once booktabs is loaded", () => {
    const tex = "\\documentclass{article}\n\\usepackage{booktabs}\n\\begin{document}\n\\toprule\n\\end{document}\n"
    expect(checkLatexDocument(tex)).toEqual([])
  })

  it("accepts transitively provided packages (jinstpub brings graphicx)", () => {
    const tex = "\\documentclass{article}\n\\usepackage{jinstpub}\n\\begin{document}\n\\includegraphics{a.png}\n\\end{document}\n"
    expect(checkLatexDocument(tex)).toEqual([])
  })

  it("detects \\href with no hyperref and no fallback", () => {
    const tex = "\\documentclass{article}\n\\begin{document}\n\\href{https://x}{x}\n\\end{document}\n"
    expect(checkLatexDocument(tex).some((f) => f.message.includes("\\href"))).toBe(true)
  })

  it("accepts \\href when a fallback is defined", () => {
    const tex = "\\documentclass{article}\n\\providecommand{\\href}[2]{#2}\n\\begin{document}\n\\href{https://x}{x}\n\\end{document}\n"
    expect(checkLatexDocument(tex)).toEqual([])
  })

  it("ignores \\begin inside a macro definition body", () => {
    const blanked = blankDefinitionBodies("\\newcommand{\\looseitems}{\\begin{itemize}\\setlength{\\itemsep}{1pt}}")
    expect(blanked).not.toContain("\\begin{itemize}")
    // ...and the same text *outside* a definition is preserved.
    expect(blankDefinitionBodies("\\begin{itemize}")).toContain("\\begin{itemize}")
  })

  it("blanking preserves line numbers", () => {
    const src = "\\newcommand{\\a}{\n\\begin{itemize}\n}\n\\begin{document}"
    expect(blankDefinitionBodies(src).split("\n")).toHaveLength(src.split("\n").length)
  })

  it("latexErrors filters to errors only", () => {
    const long = "x".repeat(80)
    const tex = `\\documentclass{article}\n\\begin{document}\n$${long}$\n\\end{document}\n`
    expect(latexErrors(tex)).toEqual([])
    expect(checkLatexDocument(tex)).toHaveLength(1)
  })
})

describe("New templates are wired end to end", () => {
  it("aurora renders blocks and columns through the poster generator", () => {
    const t = TEMPLATE_REGISTRY.find((x) => x.id === "aurora")!
    const tex = generate(t)
    expect(tex).toMatch(/\\documentclass\[[^\]]*\]\{tikzposter\}/)
    expect(tex).toContain("\\useblockstyle{AuroraCard}")
    expect(tex).toContain("\\usetitlestyle{AuroraTitle}")
    expect(tex).toContain("\\block{Intro \\& Math}")
    expect(tex).toContain("\\column{0.333}")
  })

  it("aurora follows the theme colour", () => {
    const t = TEMPLATE_REGISTRY.find((x) => x.id === "aurora")!
    const themed = generateFullTemplate(projectFor(t), { ...outputFor(t), themeColor: "#7C3AED" } as never, "ws1")
    expect(themed).toContain("\\definecolor{maincolor}{HTML}{7C3AED}")
    expect(checkLatexDocument(themed)).toEqual([])
  })

  it("editorial is a 16:9 beamer deck with no third-party theme dependency", () => {
    const t = TEMPLATE_REGISTRY.find((x) => x.id === "beamer-editorial")!
    const tex = generate(t)
    expect(tex).toMatch(/\\documentclass\[aspectratio=169\]\{beamer\}/)
    expect(tex).not.toMatch(/\\usetheme\{(metropolis|focus)\}/)
    expect(tex).toContain("\\setbeamertemplate{frametitle}")
    expect(tex).toContain("\\begin{frame}{Intro \\& Math}")
  })

  it("editorial follows the theme colour", () => {
    const t = TEMPLATE_REGISTRY.find((x) => x.id === "beamer-editorial")!
    const themed = generateFullTemplate(projectFor(t), { ...outputFor(t), themeColor: "#0D9488" } as never, "ws1")
    expect(themed).toContain("\\definecolor{customaccent}{HTML}{0D9488}")
    expect(checkLatexDocument(themed)).toEqual([])
  })

  it("editorial slide generator picks its own preamble, not the ATLAS default", () => {
    const t = TEMPLATE_REGISTRY.find((x) => x.id === "beamer-editorial")!
    const editorial = generate(t)
    const atlas = generate(TEMPLATE_REGISTRY.find((x) => x.id === "beamer-atlas")!)
    expect(editorial).not.toBe(atlas)
    expect(editorial).toContain("aspectratio=169")
  })

  it("getEditorialTemplate is reachable as a standalone export", () => {
    expect(getEditorialTemplate(projectFor(TEMPLATE_REGISTRY[0]))).toContain("\\documentclass[aspectratio=169]{beamer}")
  })
})
