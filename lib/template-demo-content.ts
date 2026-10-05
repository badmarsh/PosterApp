/**
 * The demo content each template preview prints onto its document.
 *
 * The curated galleries in `lib/template-showcase-data.ts` already compose a
 * genuinely different document per template (four research subjects × per-output
 * editions, with real titles, venues, prose, tables and figures). Those documents
 * are what the app shows in a demo workspace, so the previews print them too
 * instead of generic filler.
 *
 * Server/script-side only: it pulls the full gallery payload, so it must not be
 * imported from client components. `lib/template-preview-content.ts` carries the
 * shared types and the fallback content that client rendering uses.
 */

import { templateGalleryFor } from "./template-showcase-data"
import { getTemplateDef } from "./output-types"
import { GENERIC_DOCUMENT_CONTENT, splitLines, stripMarkdown, truncate, type PreviewDocumentContent, type PreviewSection } from "./template-preview-content"

const MAX_SECTIONS = 14
const MAX_LINES = 5

/** Cards that are front matter or references, not poster/paper sections. */
const NON_SECTION_TITLES = new Set(["abstract", "title", "references", "bibliography", "acknowledgements", "acknowledgments"])

function isNonSection(title: string): boolean {
  return NON_SECTION_TITLES.has(title.trim().toLowerCase())
}

/** First sentence of a take-home bullet, so the hero statement reads cleanly. */
function firstSentence(input: string): string {
  const clean = stripMarkdown(input).replace(/^•\s*/, "").trim()
  const match = clean.match(/^(.{25,170}?[.!?])(\s|$)/)
  return match ? match[1] : truncate(clean, 150)
}

/**
 * The gallery's curated demo document for `templateId`, flattened into what the
 * artwork needs. Returns `null` for templates without a curated gallery (the
 * thesis-review forms render their own labels) so callers can fall back.
 */
export function templateDemoContent(templateId: string): PreviewDocumentContent | null {
  const output = templateGalleryFor(templateId)
  if (!output) return null

  const def = getTemplateDef(templateId)
  const isPaper = def?.outputType === "paper"
  const cards = [...output.cards].sort(
    (a, b) => (a.column ?? 0) - (b.column ?? 0) || a.order - b.order,
  )

  const sections: PreviewSection[] = []
  let abstract: string | undefined
  let claim: string | undefined
  // The hero statement is chosen after the loop so a dedicated take-home card
  // wins over "Why It Matters" regardless of card order.
  let takeHome: string | undefined
  let whyItMatters: string | undefined

  for (const card of cards) {
    const title = stripMarkdown(card.title ?? "").replace(/\s*·\s*$/, "").trim()
    const lines = splitLines(card.content ?? "", MAX_LINES)
    if (!lines.length) continue

    // The paper abstract card is spliced into the frontmatter by the generator.
    if (isPaper && !abstract && title.toLowerCase() === "abstract") {
      abstract = lines.join(" ")
      continue
    }
    if (isNonSection(title)) {
      if (!claim) claim = truncate(lines[0], 120)
      continue
    }

    // Better Poster's hero statement comes from its take-home section.
    if (/take-?home|key message/i.test(title)) {
      takeHome = takeHome ?? firstSentence(lines[0])
    } else if (/why it matters/i.test(title)) {
      whyItMatters = whyItMatters ?? firstSentence(lines[0])
    }

    sections.push({
      title: title || `Section ${sections.length + 1}`,
      lines,
      hasFigure: (card.figures?.length ?? 0) > 0,
      column: typeof card.column === "number" ? card.column : undefined,
    })
    if (sections.length >= MAX_SECTIONS) break
  }

  if (!sections.length && !abstract) return null

  if (isPaper && !abstract) {
    // Proceedings galleries sometimes omit a dedicated abstract card.
    const first = sections.shift()
    abstract = first ? first.lines.join(" ") : undefined
    if (first && first.title) sections.unshift({ ...first, title: first.title, lines: first.lines })
  }

  claim = claim ?? takeHome ?? whyItMatters

  return {
    title: stripMarkdown(output.title ?? def?.label ?? templateId),
    authors: output.authors ? stripMarkdown(output.authors) : undefined,
    venue: output.venue ? stripMarkdown(output.venue) : undefined,
    abstract,
    claim,
    sections,
  }
}

/** Content for a template, falling back to the neutral placeholder document. */
export function templateDemoContentOrGeneric(templateId: string): PreviewDocumentContent {
  return templateDemoContent(templateId) ?? GENERIC_DOCUMENT_CONTENT
}
