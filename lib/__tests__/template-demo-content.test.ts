import { describe, it, expect } from "vitest"
import { TEMPLATE_REGISTRY } from "@/lib/output-types"
import {
  demoWorkspaceDocuments,
  demoWorkspaceForTemplate,
  templateDemoScene,
} from "@/lib/template-demo-content"
import { ALL_SHOWCASE_PROJECTS } from "@/lib/showcases-data"
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

describe("demo workspace documents", () => {
  it("uses the workspace that actually ships the template", () => {
    expect(demoWorkspaceForTemplate("atlas")!.id).toBe("atlas-bose-einstein-correlations")
    expect(demoWorkspaceForTemplate("beamer-atlas")!.id).toBe("atlas-bose-einstein-correlations")
    expect(demoWorkspaceForTemplate("epj-woc")!.id).toBe("atlas-bose-einstein-correlations")
    expect(demoWorkspaceForTemplate("cvpr")!.id).toBe("vla-autonomous-surgery")
  })

  it("gives every document template a workspace with all three documents", () => {
    for (const template of TEMPLATE_REGISTRY) {
      if (template.outputType === "thesis-review") {
        expect(demoWorkspaceForTemplate(template.id), template.id).toBeTruthy()
        continue
      }
      const documents = demoWorkspaceDocuments(template.id)
      expect(Object.keys(documents).sort(), template.id).toEqual(["paper", "poster", "slides"])
      for (const type of ["poster", "slides", "paper"] as const) {
        expect(documents[type]!.content.title.length, `${template.id} ${type}`).toBeGreaterThan(8)
        expect(documents[type]!.content.sections.length, `${template.id} ${type}`).toBeGreaterThan(0)
      }
    }
  })

  it("prints the previewed template's artwork for its own document type", () => {
    // A poster template prints its own poster; the workspace's deck and paper
    // keep their own templates.
    const posterDocs = demoWorkspaceDocuments("aaai")
    expect(posterDocs.paper!.templateId).toBe("aaai")
    expect(posterDocs.poster!.templateId).not.toBe("aaai")
    expect(demoWorkspaceDocuments("atlas").poster!.templateId).toBe("atlas")

    const deckDocs = demoWorkspaceDocuments("beamer-metropolis")
    expect(deckDocs.slides!.templateId).toBe("beamer-metropolis")
  })

  it("scenes every surface with the workspace's poster, slides and paper", () => {
    const posterScene = templateDemoScene("atlas")!
    expect(posterScene.content.title).toContain("Bose-Einstein")
    // Slides on the laptop, paper on the desk; the poster is the featured doc.
    expect(posterScene.scene.screen!.content.title).toContain("Bose-Einstein")
    expect(posterScene.scene.sheets).toHaveLength(1)
    expect(posterScene.scene.sheets![0].content.title).toContain("Bose-Einstein")

    const deckScene = templateDemoScene("beamer-metropolis")!
    expect(deckScene.scene.board!.content.title).toBeTruthy()
    expect(deckScene.scene.board!.templateId).not.toBe("beamer-metropolis")
    expect(deckScene.scene.sheets![0].content.title).toBeTruthy()

    // A paper preview shows the poster as a larger folded print on the desk.
    const paperScene = templateDemoScene("article-twocol")!
    expect(paperScene.scene.sheets).toHaveLength(2)
    expect(paperScene.scene.sheets![0].width).toBeGreaterThan(paperScene.scene.sheets![1].width!)
    // The laptop shows the 16:9 deck, not a portrait handout.
    expect(paperScene.scene.screen!.layout).toBeUndefined()
  })

  it("keeps thesis-review templates out of the workspace scene", () => {
    expect(templateDemoScene("posudok-sk")).toBeNull()
    // …but they still resolve a workspace, for fallback artwork.
    expect(demoWorkspaceForTemplate("posudok-sk")).toBeTruthy()
  })

  it("resolves every registered template deterministically", () => {
    for (const template of TEMPLATE_REGISTRY) {
      const first = demoWorkspaceForTemplate(template.id)!.id
      const second = demoWorkspaceForTemplate(template.id)!.id
      expect(first, template.id).toBe(second)
      expect(ALL_SHOWCASE_PROJECTS.some((project) => project.id === first), template.id).toBe(true)
    }
  })
})
