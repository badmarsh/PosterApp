/**
 * The demo documents a template preview prints on the mockup scene.
 *
 * The scene shows a demo workspace — the fully populated projects in
 * `data/showcases/all-showcase-projects.json` — the way the studio set does in
 * the reference artwork: its **poster** on the easel board, its **slides** on the
 * laptop screen and its **paper** printed on the desk. The previewed template
 * supplies the artwork for the document of its own type, so a template picker
 * entry still shows that template's typography and page geometry.
 *
 * Server/script-side only: it pulls the full showcase payload, so it must not be
 * imported from client components. `lib/template-preview-content.ts` carries the
 * shared types and the fallback content that client rendering uses.
 */

import { ALL_SHOWCASE_PROJECTS } from "./showcases-data"
import { getTemplateDef, type OutputType } from "./output-types"
import { gallerySubjectForTemplate } from "./template-showcase-data"
import type { Card, OutputConfig, Project } from "./poster-types"
import {
  GENERIC_DOCUMENT_CONTENT,
  splitLines,
  stripMarkdown,
  truncate,
  type PreviewDocumentContent,
  type PreviewSection,
} from "./template-preview-content"
import type { PreviewScene, PreviewSceneSlot } from "./template-preview-art"

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
 * Flatten an output (poster page, deck or paper) into what the artwork needs.
 * Papers reserve their abstract for the front matter, Better Poster keeps its
 * take-home sentence for the hero block, and poster columns survive so the
 * artwork can honour the document's own grid.
 */
export function contentFromOutput(output: OutputConfig, project?: Project): PreviewDocumentContent {
  const isPaper = output.outputType === "paper"
  const cards: Card[] = [...(output.cards ?? [])].sort(
    (a, b) => (a.column ?? 0) - (b.column ?? 0) || a.order - b.order,
  )

  const sections: PreviewSection[] = []
  let abstract: string | undefined
  let claim: string | undefined
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

  if (!sections.length && !abstract) return GENERIC_DOCUMENT_CONTENT

  claim = claim ?? takeHome ?? whyItMatters

  return {
    title: stripMarkdown(output.title ?? project?.posterTitle ?? project?.name ?? ""),
    authors: output.authors ? stripMarkdown(output.authors) : project?.authors ? stripMarkdown(project.authors) : undefined,
    venue: output.venue ? stripMarkdown(output.venue) : project?.venue ? stripMarkdown(project.venue) : undefined,
    abstract,
    claim,
    sections,
  }
}

// ---------------------------------------------------------------------------
// Demo workspaces
// ---------------------------------------------------------------------------

/** Gallery subjects mapped onto the demo workspace that tells the same story. */
const SUBJECT_WORKSPACE: Record<string, string> = {
  hep: "atlas-bose-einstein-correlations",
  bio: "cas13-panviral-immunity",
  vla: "vla-autonomous-surgery",
  nlp: "speculative-decoding-guarantees",
}

const DEMO_PROJECTS = ALL_SHOWCASE_PROJECTS.filter((project) => (project.outputs?.length ?? 0) > 0)

/** Stable per-template index so the fallback workspace never changes between runs. */
function stableIndex(value: string, modulo: number): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) % 9973
  return modulo > 0 ? hash % modulo : 0
}

const DOCUMENT_TYPES: OutputType[] = ["poster", "slides", "paper"]

function hasAllDocumentTypes(project: Project): boolean {
  return DOCUMENT_TYPES.every((type) => (project.outputs ?? []).some((output) => output.outputType === type))
}

/**
 * The demo workspace whose documents a template preview shows.
 *
 * Preference order: a workspace that both ships this template and carries all
 * three document kinds (so the scene can fill board, laptop and desk), then the
 * workspace matching the template's curated gallery subject, then any complete
 * workspace (deterministically chosen), and finally whatever ships the template.
 */
export function demoWorkspaceForTemplate(templateId: string): Project | null {
  if (!DEMO_PROJECTS.length) return null

  const usingTemplate = DEMO_PROJECTS.filter((project) =>
    (project.outputs ?? []).some((output) => output.templateId === templateId),
  )
  const complete = DEMO_PROJECTS.filter(hasAllDocumentTypes)

  const completeUsing = usingTemplate.find(hasAllDocumentTypes)
  if (completeUsing) return completeUsing

  const subject = gallerySubjectForTemplate(templateId)
  const subjectProjectId = subject ? SUBJECT_WORKSPACE[subject] : undefined
  const subjectProject = subjectProjectId ? DEMO_PROJECTS.find((project) => project.id === subjectProjectId) : undefined
  if (subjectProject) return subjectProject

  if (complete.length) return complete[stableIndex(templateId, complete.length)]
  return usingTemplate[0] ?? DEMO_PROJECTS[stableIndex(templateId, DEMO_PROJECTS.length)]
}

export type DemoDocumentSpec = {
  /** Template whose artwork prints this document. */
  templateId: string
  outputType: OutputType
  content: PreviewDocumentContent
}

/**
 * The workspace's documents, keyed by output type. The document of the
 * previewed template's own type is printed with that template's artwork; the
 * others keep the workspace's own templates.
 */
export function demoWorkspaceDocuments(templateId: string): Partial<Record<OutputType, DemoDocumentSpec>> {
  const project = demoWorkspaceForTemplate(templateId)
  if (!project) return {}
  const def = getTemplateDef(templateId)
  const documents: Partial<Record<OutputType, DemoDocumentSpec>> = {}

  for (const output of project.outputs ?? []) {
    if (output.outputType === "thesis-review") continue
    const featured = output.outputType === def?.outputType
    documents[output.outputType] = {
      templateId: featured ? templateId : output.templateId,
      outputType: output.outputType,
      content: contentFromOutput(output, project),
    }
  }
  return documents
}

function slotFrom(spec: DemoDocumentSpec, layout?: "single" | "deck"): PreviewSceneSlot {
  return { templateId: spec.templateId, content: spec.content, layout }
}

/**
 * Everything `renderTemplatePreviewSvg` needs for a template: the featured
 * document's content plus the demo workspace's other two documents placed on the
 * surfaces that suit them.
 *
 * - poster templates  → board: poster, laptop: slides, desk: paper
 * - slide templates   → board: poster, laptop: deck,   desk: paper
 * - paper templates   → board: paper,  laptop: slides, desk: poster print + paper copy
 */
export function templateDemoScene(templateId: string): { content: PreviewDocumentContent; scene: PreviewScene } | null {
  const def = getTemplateDef(templateId)
  if (!def || def.outputType === "thesis-review") return null

  const documents = demoWorkspaceDocuments(templateId)
  const featured = documents[def.outputType]
  if (!featured) return null

  const { poster, slides, paper } = documents
  const scene: PreviewScene = {}

  if (def.outputType === "slides") {
    // The deck takes the laptop; the board shows the workspace's poster.
    if (poster) scene.board = slotFrom(poster)
  } else if (slides) {
    // 16:9 on the laptop screen, plus the printed handout on the desk.
    scene.screen = slotFrom(slides)
  }

  const sheets: (PreviewSceneSlot & { width?: number })[] = []
  if (def.outputType === "paper") {
    // The paper already fills the board: the desk carries its printed copy and
    // the workspace's poster as a folded print, so all three documents show.
    if (poster) sheets.push({ ...slotFrom(poster), width: 25 })
    sheets.push({ ...slotFrom(featured), width: 20 })
  } else if (paper) {
    sheets.push({ ...slotFrom(paper), width: 23 })
    // Slide templates also stack the printed handout next to the paper.
    if (def.outputType === "slides" && slides) sheets.push({ ...slotFrom(slides, "deck"), width: 18 })
  }
  if (sheets.length) scene.sheets = sheets

  return { content: featured.content, scene }
}
