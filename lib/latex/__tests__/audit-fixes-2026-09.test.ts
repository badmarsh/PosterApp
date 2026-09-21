import { describe, it, expect } from "vitest"
import type { Card, Project } from "@/lib/poster-types"
import { getEpjWocTemplate } from "../templates"
import { StandardPaperGenerator } from "../generator-paper"
import { TikzPosterGenerator } from "../generator-poster"
import { estimateHeightBreakdown } from "../layout"
import { ensureEncodingPreamble } from "../generator"
import { THESIS_REVIEW_LABELS } from "../templates-thesis"
import { generateThesisReviewLatex } from "../generator-thesis-review"
import { isValidPattern, LAYOUT_CONSTRAINTS } from "@/lib/output-types"

// ---------------------------------------------------------------------------
// Fixtures (kept minimal but structurally honest)
// ---------------------------------------------------------------------------

function makeCard(patch: Partial<Card>): Card {
  return {
    id: "card_1",
    title: "Test Card",
    column: 1,
    order: 0,
    pattern: "bullets",
    content: "Some content",
    table: { hasHeader: true, caption: "", rows: [] },
    figures: [],
    figureLayout: "single",
    sourceIds: [],
    heightBudget: null,
    validation: "valid",
    ...patch,
  }
}

function makeProject(outputId: string, outputCards: Card[], secondCards?: Card[]): Project {
  const outputs = [
    {
      id: outputId,
      outputType: "paper",
      templateId: "article-twocol",
      title: "Main Output",
      cards: outputCards,
    },
    ...(secondCards
      ? [{
          id: "out_other",
          outputType: "poster",
          templateId: "minimal",
          title: "Other Output",
          cards: secondCards,
        }]
      : []),
  ]
  return {
    id: "prj_1",
    revision: 1,
    name: "Test Workspace",
    authors: "John Doe",
    venue: "Test Venue",
    activeOutputId: outputId,
    outputs: outputs as Project["outputs"],
    assets: [],
    ingestFiles: [],
  }
}

// ---------------------------------------------------------------------------
// F-03 / F-09a — EPJ Web of Conferences template
// ---------------------------------------------------------------------------

describe("F-03/F-09a: epj-woc template", () => {
  it("uses the webofc class without a bogus `[option]` placeholder", () => {
    const prj = makeProject("out_1", [])
    const tex = getEpjWocTemplate(prj)
    expect(tex).toContain("\\documentclass{webofc}")
    expect(tex).not.toContain("[option]")
  })

  it("loads amsmath so the fitmath resize path works", () => {
    const prj = makeProject("out_1", [])
    const tex = getEpjWocTemplate(prj)
    expect(tex).toMatch(/\\usepackage{amsmath}/)
  })
})

// ---------------------------------------------------------------------------
// F-09b — elsarticle abstract belongs into the frontmatter
// ---------------------------------------------------------------------------

describe("F-09b: elsarticle abstract placement", () => {
  it("splices an abstract card before \\end{frontmatter}", () => {
    const prj = makeProject("out_paper", [
      makeCard({ id: "a1", title: "Abstract", pattern: "abstract" as Card["pattern"], content: "We study things.", order: 0 }),
      makeCard({ id: "s1", title: "Intro", pattern: "section", content: "Intro body.", order: 1 }),
    ])
    prj.outputs[0].templateId = "elsarticle"
    const doc = new StandardPaperGenerator("elsarticle").generateDocument(prj, prj.outputs[0], "prj_1")
    const frontmatterEnd = doc.indexOf("\\end{frontmatter}")
    const abstractAt = doc.indexOf("\\begin{abstract}")
    expect(frontmatterEnd).toBeGreaterThan(-1)
    expect(abstractAt).toBeGreaterThan(-1)
    expect(abstractAt).toBeLessThan(frontmatterEnd)
  })
})

// ---------------------------------------------------------------------------
// F-22 — per-template bibliography styles
// ---------------------------------------------------------------------------

describe("F-22: bibliography style per template", () => {
  const cases: Array<[string, string]> = [
    ["revtex-aps", "apsrev4-2"],
    ["elsarticle", "elsarticle-num"],
    ["acm-sigconf", "ACM-Reference-Format"],
    ["jinst-proceedings", "JHEP"],
    ["epj-woc", "woc"],
    ["iopart", "iopart-num"],
    ["aaai", "aaai2026"],
    ["icml", "icml2026"],
    ["iclr", "iclr2026_conference"],
    ["acl", "acl_natbib"],
    ["neurips", "plainnat"],
  ]
  for (const [templateId, bibStyle] of cases) {
    it(`template ${templateId} uses \\bibliographystyle{${bibStyle}}`, () => {
      const prj = makeProject("out_paper", [
        makeCard({ id: "r1", title: "References", pattern: "references", content: "", order: 5 }),
      ])
      prj.outputs[0].templateId = templateId
      const doc = new StandardPaperGenerator(templateId).generateDocument(prj, prj.outputs[0], "prj_1")
      expect(doc).toContain(`\\bibliographystyle{${bibStyle}}`)
    })
  }

  it("unknown templates keep the plain style", () => {
    const prj = makeProject("out_paper", [
      makeCard({ id: "r1", title: "References", pattern: "references", content: "", order: 5 }),
    ])
    const doc = new StandardPaperGenerator("article-twocol").generateDocument(prj, prj.outputs[0], "prj_1")
    expect(doc).toContain("\\bibliographystyle{plain}")
  })
})

// ---------------------------------------------------------------------------
// F-07 — poster generator must render the REQUESTED output's cards
// ---------------------------------------------------------------------------

describe("F-07: poster generator uses outputConfig.cards", () => {
  it("compiling a non-active output does not yield the active output's PDF", () => {
    const activeCards = [makeCard({ id: "c_active", title: "ACTIVE MARKER", content: "active content" })]
    const otherCards = [makeCard({ id: "c_other", title: "OTHER MARKER", content: "other content" })]
    const prj = makeProject("out_main", activeCards)
    prj.activeOutputId = "out_main"
    prj.outputs = [
      {
        id: "out_main",
        outputType: "poster",
        templateId: "minimal",
        title: "Active Poster",
        cards: activeCards,
      },
      {
        id: "out_alt",
        outputType: "poster",
        templateId: "minimal",
        title: "Alt Poster",
        cards: otherCards,
      },
    ] as Project["outputs"]

    const gen = new TikzPosterGenerator("minimal")
    const altConfig = prj.outputs[1]
    const doc = gen.generateDocument(prj, altConfig, "prj_1")

    expect(doc).toContain("OTHER MARKER")
    expect(doc).not.toContain("ACTIVE MARKER")
  })
})

// ---------------------------------------------------------------------------
// F-24 — metric hero tile width for >3 items
// ---------------------------------------------------------------------------

describe("F-24: metric hero tile widths", () => {
  it("uses 0.46 tiles when more than three items render as rows of two", () => {
    const prj = makeProject("out_main", [
      makeCard({
        pattern: "stats",
        content: "**98%** success\n**42** runs\n**3.1** score\n**7** deploys",
      }),
    ])
    prj.outputs[0].outputType = "poster"
    prj.outputs[0].templateId = "minimal"
    const doc = new TikzPosterGenerator("minimal").generateDocument(prj, prj.outputs[0], "prj_1")
    expect(doc).toContain("\\begin{minipage}{0.46\\linewidth}")
    expect(doc).not.toContain("\\begin{minipage}{0.28\\linewidth}")
  })
})

// ---------------------------------------------------------------------------
// F-12 — stats/metric-card height estimate includes table + figures
// ---------------------------------------------------------------------------

describe("F-12: estimateHeightBreakdown for stats cards", () => {
  it("charges for the optional table and figures a stats card can render", () => {
    const bare = estimateHeightBreakdown(makeCard({ pattern: "stats" }))
    const withTable = estimateHeightBreakdown(
      makeCard({ pattern: "stats", table: { hasHeader: true, caption: "", rows: [["a", "b"], ["c", "d"]] } })
    )
    const withFigures = estimateHeightBreakdown(
      makeCard({ pattern: "stats", figures: [{ id: "f1", url: "/assets/a.png", caption: "" }] })
    )
    expect(withTable.table).toBeGreaterThan(0)
    expect(withTable.total).toBeGreaterThan(bare.total)
    expect(withFigures.figures).toBeGreaterThan(bare.figures)
    expect(withFigures.total).toBe(withFigures.chrome + withFigures.figures + withFigures.table)
  })
})

// ---------------------------------------------------------------------------
// F-11 — lmodern must not be injected into acmart documents
// ---------------------------------------------------------------------------

describe("F-11: ensureEncodingPreamble skips lmodern for acmart", () => {
  it("leaves acmart preambles untouched by lmodern", () => {
    const tex = "\\documentclass[sigconf,nonacm]{acmart}\n\\begin{document}\nHi\n\\end{document}"
    const out = ensureEncodingPreamble(tex, "en")
    expect(out).not.toContain("lmodern")
  })

  it("still adds lmodern for plain article templates", () => {
    const tex = "\\documentclass[11pt]{article}\n\\begin{document}\nHi\n\\end{document}"
    const out = ensureEncodingPreamble(tex, "en")
    expect(out).toContain("\\usepackage{lmodern}")
  })
})

// ---------------------------------------------------------------------------
// F-14 — academic year label in all thesis-review locales
// ---------------------------------------------------------------------------

describe("F-14: thesis-review academic year label", () => {
  it("every locale defines academicYearLabel", () => {
    for (const [lang, labels] of Object.entries(THESIS_REVIEW_LABELS)) {
      expect(labels.academicYearLabel, `locale ${lang} missing academicYearLabel`).toBeTruthy()
    }
  })

  it("the German export no longer contains a hardcoded Slovak label", () => {
    const doc = generateThesisReviewLatex({
      studentName: "Max Mustermann",
      thesisTitle: "Tiefe Netze",
      thesisType: "master",
      reviewerRole: "opponent",
      institution: "TU Berlin",
      academicYear: "2025/2026",
      language: "de",
      template: "posudok-de",
      sections: [
        { id: "s1", criterionId: "methodology_rigor", text: "Solide Methodik.", rating: "B" },
      ],
      defenseQuestions: [],
      citationIssues: [],
      includeConfidential: false,
    } as Parameters<typeof generateThesisReviewLatex>[0])
    expect(doc).toContain("Akademisches Jahr")
    expect(doc).not.toContain("Rok:")
  })
})

// ---------------------------------------------------------------------------
// F-04 — criterion resolution across rubric generations
// ---------------------------------------------------------------------------

describe("F-04: thesis-review criterion resolution", () => {
  const baseInput = {
    studentName: "Jane Doe",
    thesisTitle: "Deep Nets",
    thesisType: "master" as const,
    reviewerRole: "opponent",
    language: "en" as const,
    template: "posudok-en" as const,
    defenseQuestions: [] as string[],
    citationIssues: [] as string[],
    includeConfidential: false,
  }

  function renderSections(sections: Array<Record<string, unknown>>): string {
    return generateThesisReviewLatex({
      ...baseInput,
      sections: sections as unknown as Parameters<typeof generateThesisReviewLatex>[0]["sections"],
    } as Parameters<typeof generateThesisReviewLatex>[0])
  }

  it("resolves v1 rubric ids (what the production pipeline writes)", () => {
    const doc = renderSections([
      { id: "s1", criterionId: "methodology_rigor", text: "Rigorous.", rating: "A" },
      { id: "s2", criterionId: "results_validity", text: "Valid.", rating: "B" },
    ])
    expect(doc).toContain("Methodological appropriateness")
    expect(doc).toContain("Validity of results")
  })

  it("still resolves legacy THESIS_CRITERIA ids", () => {
    const doc = renderSections([{ id: "s1", criterionId: "methodology", text: "Legacy.", rating: "A" }])
    expect(doc).toContain("Methodology")
  })

  it("matches human-readable titles with diacritic/case folding", () => {
    const doc = renderSections([
      { id: "s1", criterionId: "Validity of Results and Interpretation", text: "Titled.", rating: "A" },
    ])
    expect(doc).toContain("Validity of results and interpretation")
  })

  it("never silently drops an unresolvable section", () => {
    const doc = renderSections([
      { id: "s1", criterionId: "totally_unknown_thing", text: "Keep me visible.", rating: "A" },
    ])
    expect(doc).toContain("Keep me visible")
    expect(doc).toContain("Totally unknown thing")
  })
})

// ---------------------------------------------------------------------------
// F-08 — slides patterns & card-count budget
// ---------------------------------------------------------------------------

describe("F-08: slides pattern registry", () => {
  it("accepts bullets-table as a valid slides pattern", () => {
    expect(isValidPattern("slides", "bullets-table")).toBe(true)
  })
  it("slides default card count matches the narration capacity", () => {
    expect(LAYOUT_CONSTRAINTS.slides.defaultCardCount).toBe(7)
  })
})
