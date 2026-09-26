import { describe, it, expect } from "vitest"
import { TEMPLATE_REGISTRY } from "@/lib/output-types"
import { generateFullTemplate } from "@/lib/latex/generator"
import { checkLatexDocument } from "@/lib/latex/static-checks"
import { estimatePosterColumnOccupancy } from "@/lib/latex/validation"
import { estimateHeight, posterBoardFor } from "@/lib/latex/layout"
import { GALLERY_SUBJECTS, galleryBibEntriesFor, templateGalleryFor } from "@/lib/template-showcase-data"
import type { Project } from "@/lib/poster-types"

/**
 * Contract for the curated template galleries.
 *
 * The galleries exist because the previous demo content was the *same* twelve
 * cards re-tinted per template ("same thing with different text and colour").
 * The tests below are written to fail if that regresses:
 *
 *  - every registered template has a gallery;
 *  - the gallery generates structurally clean LaTeX;
 *  - poster galleries respect their own board's column budget;
 *  - the four subjects are genuinely different documents (not the same prose
 *    with different numbers);
 *  - two templates never ship byte-identical card content.
 */

function projectFor(templateId: string): { project: Project; output: NonNullable<ReturnType<typeof templateGalleryFor>> } {
  const output = templateGalleryFor(templateId)!
  const project: Project = {
    id: `prj_${templateId}`,
    revision: 1,
    name: output.title,
    posterTitle: output.title,
    authors: output.authors ?? "",
    venue: output.venue ?? "",
    activeOutputId: output.id,
    assets: [],
    ingestFiles: [],
    outputs: [output],
  } as unknown as Project
  return { project, output }
}

describe("template galleries", () => {
  it("covers every non-thesis template in the registry", () => {
    const missing = TEMPLATE_REGISTRY.filter((t) => t.outputType !== "thesis-review" && templateGalleryFor(t.id) === null)
    expect(missing.map((t) => t.id)).toEqual([])
  })

  it("returns null for thesis-review templates (their content path is the review record)", () => {
    for (const t of TEMPLATE_REGISTRY.filter((x) => x.outputType === "thesis-review")) {
      expect(templateGalleryFor(t.id), t.id).toBeNull()
    }
  })

  it.each(TEMPLATE_REGISTRY.filter((t) => t.outputType !== "thesis-review").map((t) => [t.id, t] as const))(
    "%s generates structurally clean LaTeX",
    (id) => {
      const { project, output } = projectFor(id)
      const tex = generateFullTemplate(project, output, project.id)
      const findings = checkLatexDocument(tex)
      expect(findings, findings.map((f) => `${f.code}: ${f.message}`).join("\n")).toEqual([])
      expect(tex).not.toMatch(/\\includegraphics(?:\ [[^\]]*)?\{\s*\}/)
      expect(tex).toContain("\\begin{document}")
      expect(tex.trimEnd().endsWith("\\end{document}"))
    },
  )

  it("uses stable, prefixed card ids", () => {
    for (const t of TEMPLATE_REGISTRY) {
      const output = templateGalleryFor(t.id)
      if (!output) continue
      for (const card of output.cards) {
        expect(card.id, `${t.id}/${card.id}`).toMatch(/^card_[a-z0-9_]+$/)
      }
      // ids are unique within the output
      expect(new Set(output.cards.map((c) => c.id)).size).toBe(output.cards.length)
    }
  })

  it("gives every poster gallery a filled, non-overflowing board", () => {
    const problems: string[] = []
    for (const t of TEMPLATE_REGISTRY.filter((x) => x.outputType === "poster")) {
      const output = templateGalleryFor(t.id)!
      const board = posterBoardFor(t.id)
      const columns = board.columnWidths.length
      const occupancy = estimatePosterColumnOccupancy(output.cards, t.id)
      for (const col of occupancy) {
        if (col.column > columns) {
          if (col.estimatedHeight > 0) problems.push(`${t.id}: cards assigned to unused column ${col.column}`)
          continue
        }
        if (col.estimatedHeight === 0) problems.push(`${t.id}: column ${col.column} is empty`)
        if (col.overflow > 0.1 * col.budget) {
          problems.push(`${t.id}: column ${col.column} overflows by ${col.overflow}u (${Math.round((col.estimatedHeight / col.budget) * 100)}%)`)
        }
      }
      // "Posters must fill the entire canvas": every column should be within
      // 40% of its budget, i.e. no column may be mostly white.
      for (const col of occupancy) {
        if (col.column > columns) continue
        if (col.estimatedHeight < 0.6 * col.budget) {
          problems.push(`${t.id}: column ${col.column} only ${Math.round((col.estimatedHeight / col.budget) * 100)}% full`)
        }
      }
    }
    expect(problems, problems.join("\n")).toEqual([])
  })

  it("gives every slides gallery a title slide and a references slide", () => {
    for (const t of TEMPLATE_REGISTRY.filter((x) => x.outputType === "slides")) {
      const output = templateGalleryFor(t.id)!
      expect(output.cards.some((c) => c.pattern === "title-slide"), t.id).toBe(true)
      expect(output.cards.some((c) => c.pattern === "references"), t.id).toBe(true)
      // Speaker notes are what makes a deck usable: every content slide must
      // have them (the title and references slides are the only exceptions).
      const bare = output.cards.filter(
        (c) => !c.slideNotes && !["title", "references", "acknowledgements"].includes(c.title.toLowerCase()),
      )
      expect(bare.map((c) => c.title), `${t.id}: slides without notes`).toEqual([])
    }
  })

  it("gives every paper gallery an abstract, a conclusion and references", () => {
    for (const t of TEMPLATE_REGISTRY.filter((x) => x.outputType === "paper")) {
      const output = templateGalleryFor(t.id)!
      const titles = output.cards.map((c) => c.title.toLowerCase())
      expect(titles).toContain("abstract")
      expect(titles.some((x) => x.includes("conclusion")), t.id).toBe(true)
      expect(output.cards.some((c) => c.pattern === "references"), t.id).toBe(true)
      // Proceedings formats are deliberately short (four to six pages), so they
      // get a lower floor than the journal/full-conference formats.
      const isProceedings = t.id.endsWith("-proceedings") || t.id === "pos-proceedings"
      expect(output.cards.length, t.id).toBeGreaterThanOrEqual(isProceedings ? 6 : 7)
    }
  })

  it("does not reuse one card set across templates (the 'same content, new colour' regression)", () => {
    const fingerprints = new Map<string, string[]>()
    for (const t of TEMPLATE_REGISTRY) {
      const output = templateGalleryFor(t.id)
      if (!output) continue
      const fingerprint = output.cards.map((c) => `${c.title}|${c.content}`).join("\n")
      const list = fingerprints.get(fingerprint) ?? []
      list.push(t.id)
      fingerprints.set(fingerprint, list)
    }
    const duplicates = [...fingerprints.values()].filter((ids) => ids.length > 1)
    expect(duplicates, `identical galleries: ${JSON.stringify(duplicates)}`).toEqual([])
  })

  it("writes four genuinely distinct research subjects", () => {
    expect(GALLERY_SUBJECTS).toHaveLength(4)
    const titles = new Set(GALLERY_SUBJECTS.map((s) => s.title))
    expect(titles.size).toBe(4)
    for (const subject of GALLERY_SUBJECTS) {
      // Each subject needs its own references (a shared bibliography would mean
      // the "different" content is cosmetic).
      expect(subject.bibEntries.length, subject.id).toBeGreaterThanOrEqual(3)
      // …and its own figures/tables, not just its own prose.
      const posterCards = [
        ...subject.poster,
        subject.extras.poster.keyFinding,
        subject.extras.poster.sideBySide,
        subject.extras.poster.details,
        subject.extras.poster.spare,
      ]
      const posterFigures = posterCards.flatMap((c) => c.figures ?? [])
      const posterTables = posterCards.flatMap((c) => (c.table?.rows?.length ? [c.table] : []))
      expect(posterFigures.length, `${subject.id} poster figures`).toBeGreaterThanOrEqual(3)
      expect(posterTables.length, `${subject.id} poster tables`).toBeGreaterThanOrEqual(2)
    }
    // Adjacent posters must not be the same subject.
    const posterIds = TEMPLATE_REGISTRY.filter((t) => t.outputType === "poster").map((t) => templateGalleryFor(t.id)!.title)
    for (let i = 1; i < posterIds.length; i++) {
      expect(posterIds[i], `posters ${i} and ${i + 1} share a subject`).not.toBe(posterIds[i - 1])
    }
  })

  it("resolves a bibliography for every gallery", () => {
    for (const t of TEMPLATE_REGISTRY) {
      const output = templateGalleryFor(t.id)
      if (!output) continue
      const entries = galleryBibEntriesFor(t.id)
      expect(entries.length, t.id).toBeGreaterThanOrEqual(3)
      // Every \cite key that appears in the gallery must exist in its .bib,
      // otherwise the compiled PDF prints [?].
      const body = output.cards.map((c) => c.content).join("\n")
      const cited = [...body.matchAll(/\\cite\{([^}]+)\}/g)].flatMap((m) => m[1].split(",").map((k) => k.trim()))
      const keys = new Set(entries.map((e) => e.id))
      const unresolved = [...new Set(cited)].filter((k) => !keys.has(k))
      expect(unresolved, `${t.id} cites unknown keys`).toEqual([])
    }
  })

  it("keeps every gallery figure resolvable by the compile stage", () => {
    // Figures point at app-relative paths under public/; materializePublicFigures
    // copies exactly these. Anything else silently drops out of the PDF.
    for (const t of TEMPLATE_REGISTRY) {
      const output = templateGalleryFor(t.id)
      if (!output) continue
      for (const card of output.cards) {
        for (const fig of card.figures) {
          expect(fig.url, `${t.id}/${card.id}`).toMatch(/^\/figures\/[a-z0-9-]+\.png$/)
          expect(fig.caption.trim().length, `${t.id}/${card.id} figure caption`).toBeGreaterThan(8)
        }
      }
    }
  })

  it("does not put more content in a poster than a portrait A0 can hold", () => {
    // A rough upper bound on a single block: anything above half a column in one
    // card means the demo would need manual shrinking on first open.
    for (const t of TEMPLATE_REGISTRY.filter((x) => x.outputType === "poster")) {
      const output = templateGalleryFor(t.id)!
      for (const card of output.cards) {
        expect(estimateHeight(card), `${t.id}/${card.id}`).toBeLessThan(700)
      }
    }
  })
})
