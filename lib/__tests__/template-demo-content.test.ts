import { describe, it, expect } from "vitest"
import { TEMPLATE_REGISTRY } from "@/lib/output-types"
import { templateDemoContent, templateDemoContentOrGeneric } from "@/lib/template-demo-content"
import {
  GENERIC_DOCUMENT_CONTENT,
  splitLines,
  stripMarkdown,
  truncate,
  wrapText,
} from "@/lib/template-preview-content"

/**
 * Template previews print the curated demo document (the content a demo
 * workspace holds), so these tests pin both halves: the text helpers that turn
 * markdown/latex card bodies into printable text, and the extraction that maps
 * a template's gallery output onto the document the artwork draws.
 */
describe("preview content helpers", () => {
  it("strips markdown, inline math and latex commands down to prose", () => {
    expect(stripMarkdown("**5.8 σ** local significance")).toBe("5.8 σ local significance")
    expect(stripMarkdown("See [the paper](https://example.com) for details")).toBe("See the paper for details")
    expect(stripMarkdown("`code` and *emphasis*")).toBe("code and emphasis")
    expect(stripMarkdown("## Heading\n- first\n- second")).toBe("Heading\n• first\n• second")
    expect(stripMarkdown("decaying to $\\gamma\\gamma$ in 139 fb$^{-1}$")).toBe("decaying to γγ in 139 fb-1")
    // Subscripts keep their glyphs: m_γγ is the physics the card is about.
    expect(stripMarkdown("a resonance at $m_{\\gamma\\gamma} = 630.4$ GeV")).toBe("a resonance at mγγ = 630.4 GeV")
    expect(stripMarkdown("fitted with a Bernstein polynomial \\cite{hep2025resonance} [@hep2026tracker]")).toBe(
      "fitted with a Bernstein polynomial",
    )
    expect(stripMarkdown("occupancy at $|\\eta| > 2$")).toBe("occupancy at η > 2")
    expect(stripMarkdown("| Parameter | Value |\n|---|---|\n| mass | 630 GeV |")).toContain("Parameter · Value")
  })

  it("keeps bullet bodies as separate lines and splits long paragraphs", () => {
    const bullets = splitLines("- one\n- two\n- three")
    expect(bullets).toEqual(["• one", "• two", "• three"])

    const paragraph = splitLines(
      "Sub-millimetre manipulation on deformable tissue requires policies that are accurate. Learning-based methods have reached the required accuracy in the lab. Generalising to the operating room is the remaining gap.",
    )
    expect(paragraph.length).toBeGreaterThan(1)
    expect(paragraph.every((line) => line.length <= 110)).toBe(true)
    expect(paragraph.join(" ")).toContain("remaining gap")
  })

  it("caps how much body text a section can carry", () => {
    expect(splitLines("- a\n- b\n- c\n- d\n- e\n- f\n- g", 3)).toHaveLength(3)
  })

  it("wraps to a character budget and marks truncated text", () => {
    const lines = wrapText("one two three four five six seven eight nine ten eleven twelve", 20, 2)
    expect(lines).toHaveLength(2)
    expect(lines.join(" ").length).toBeLessThan(60)
    expect(lines[1].endsWith("…")).toBe(true)
  })

  it("truncates at a word boundary", () => {
    expect(truncate("short text", 40)).toBe("short text")
    expect(truncate("structure-aware cas13 guide ensembles expand the antiviral target space", 30)).toBe(
      "structure-aware cas13 guide…",
    )
  })
})

describe("templateDemoContent", () => {
  it("carries the gallery document's title, authors, venue and sections", () => {
    const content = templateDemoContent("atlas")!
    expect(content).toBeTruthy()
    expect(content.title).toContain("Di-Photon")
    expect(content.authors).toContain("Horák")
    expect(content.venue).toContain("ICHEP")
    expect(content.sections.length).toBeGreaterThan(3)
    expect(content.sections.map((section) => section.title)).toContain("Mass Spectrum")
    expect(content.sections.some((section) => section.hasFigure)).toBe(true)
    // Demo column assignments survive, so the artwork can honour the demo grid.
    expect(content.sections.some((section) => section.column === 2 || section.column === 3)).toBe(true)
  })

  it("leaves no markdown or math delimiters in the printable text", () => {
    for (const template of TEMPLATE_REGISTRY) {
      const content = templateDemoContent(template.id)
      if (!content) continue
      const printable = [
        content.title,
        content.authors ?? "",
        content.venue ?? "",
        content.abstract ?? "",
        content.claim ?? "",
        ...content.sections.flatMap((section) => [section.title, ...section.lines]),
      ]
        .map((piece) => piece.trim())
        .filter(Boolean)
        .join(" | ")
      expect(printable, `${template.id} text`).not.toMatch(/(\*\*|\$|\\[a-zA-Z]+\{|\]\()/)
      expect(printable, `${template.id} whitespace`).not.toMatch(/\s{2,}/)
    }
  })

  it("extracts a paper abstract as front matter, not as a body section", () => {
    const content = templateDemoContent("article-twocol")!
    expect(content.abstract).toBeTruthy()
    expect(content.abstract!.length).toBeGreaterThan(80)
    expect(content.sections.map((section) => section.title.toLowerCase())).not.toContain("abstract")
    expect(content.sections.map((section) => section.title)).toContain("Introduction")
  })

  it("gives Better Poster a one-sentence take-home claim", () => {
    const content = templateDemoContent("betterposter")!
    expect(content.claim).toBeTruthy()
    // A sentence, not a dangling clause, and short enough for the hero block.
    expect(content.claim!.length).toBeLessThanOrEqual(160)
    expect(content.claim).not.toMatch(/…\.$/)
  })

  it("has demo content for every non-thesis-review template", () => {
    const missing = TEMPLATE_REGISTRY.filter(
      (template) => template.outputType !== "thesis-review" && templateDemoContent(template.id) === null,
    ).map((template) => template.id)
    expect(missing).toEqual([])
  })

  it("falls back to the generic document for unknown templates", () => {
    expect(templateDemoContent("nope")).toBeNull()
    expect(templateDemoContentOrGeneric("nope")).toBe(GENERIC_DOCUMENT_CONTENT)
    expect(GENERIC_DOCUMENT_CONTENT.sections.length).toBeGreaterThan(2)
  })
})
