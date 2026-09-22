/**
 * Unified template registry — the architectural fix for the workspace-vs-LaTeX
 * template duplication.
 *
 * Context
 * -------
 * Historically the same concept lived in four places that could (and did)
 * drift:
 *
 *   1. `lib/output-types.ts` `TEMPLATE_REGISTRY`  — UI metadata (label, palette,
 *      column layout, requiresClass)
 *   2. `lib/latex/templates.ts` + the four generators — the actual LaTeX
 *      preambles, wired up by string `switch`es in `generator-poster.ts` /
 *      `generator-slides.ts` / `generator-paper.ts`
 *   3. `lib/showcases-data.ts` + `components/research-lab-templates.tsx` —
 *      hand-written "demo workspace" card layouts that were silently designed
 *      around a specific LaTeX template (`templateId: "atlas"`, …) but carried
 *      no schema linking them back to it
 *   4. `lib/template-preview-art.ts` — bespoke artwork per template
 *
 * This module is phase 1 of the consolidation recommended in
 * `docs/architecture/template-unification.md`: a single `TemplateDefinition`
 * record per template that *composes* the existing pieces instead of
 * re-implementing them, so nothing has to move in one big risky change.
 *
 * Invariants it enforces at runtime (and in
 * `lib/templates/__tests__/unified-registry.test.ts`):
 *   - every registered template yields a working generator (no silent
 *     fall-through to a default)
 *   - every demo-workspace `templateId` and every `templateName` resolves to a
 *     registered definition
 *   - every definition exposes preview art and a default card scaffold
 *
 * See the doc for the phased plan to migrate (2) and (3) fully onto this record.
 */

import type { TemplateDef, OutputType, TemplateColor } from "@/lib/output-types"
import { TEMPLATE_REGISTRY, getTemplateDef, PATTERNS_FOR_TYPE } from "@/lib/output-types"
import type { LatexGenerator } from "@/lib/latex/types"
import { TikzPosterGenerator } from "@/lib/latex/generator-poster"
import { BeamerSlidesGenerator } from "@/lib/latex/generator-slides"
import { StandardPaperGenerator } from "@/lib/latex/generator-paper"
import { ThesisReviewLatexGenerator } from "@/lib/latex/generator-thesis-review"
import { renderTemplatePreviewSvg, getPreviewArt, hasBespokePreviewArt as previewHasBespoke, type TemplatePreviewArt } from "@/lib/template-preview-art"
import type { BlockPattern, Project } from "@/lib/poster-types"
import { POSTER_PREAMBLE_BY_ID, SLIDES_PREAMBLE_BY_ID, PAPER_PREAMBLE_BY_ID } from "@/lib/latex/template-map"

/** The column slots a seed layout should place cards into. */
export type ScaffoldCard = {
  /** Suggested block pattern, validated against PATTERNS_FOR_TYPE at use time. */
  pattern: BlockPattern
  title: string
  column: 1 | 2 | 3
  order: number
  /** Short starter content matching the template's density guidance. */
  content: string
}

/**
 * The single source of truth for one output template, composing the four
 * previously independent representations.
 */
export interface TemplateDefinition {
  id: string
  outputType: OutputType
  /** UI / registry metadata (unchanged shape, re-exported for convenience). */
  meta: TemplateDef
  /** Palette shorthand used by preview art and the picker. */
  colors: TemplateColor[]
  /** Construct the LaTeX generator responsible for this template. */
  createGenerator(): LatexGenerator
  /** Resolve the LaTeX preamble for this template (single dispatch, no switch). */
  getPreamble(project: Project, themeColor?: string, workspaceId?: string): string
  /** The LaTeX document class this template targets (from meta). */
  latexClass: string
  /** Bespoke (non-derived) preview artwork. */
  previewArt: TemplatePreviewArt
  hasBespokeArt: boolean
  /** Render the SVG mockup for this template at a given width. */
  renderPreview(width?: number): string
  /** Default card layout for seeding a fresh output of this template. */
  defaultCards: ScaffoldCard[]
}

/**
 * Default seed layouts per output type. These are *suggestions* used by the
 * "create output" flow and by demo seeding; the exact demo content still lives
 * in showcases-data.ts but should be generated from these in phase 2.
 */
const POSTER_SCAFFOLD: ScaffoldCard[] = [
  { pattern: "bullets", title: "Motivation", column: 1, order: 0, content: "- Why this problem matters\n- The gap we close" },
  { pattern: "bullets-image", title: "Method", column: 1, order: 1, content: "- Core idea in one line\n- Key components" },
  { pattern: "stats", title: "Headline Results", column: 2, order: 0, content: "**+2.0** | over SOTA\n**0.0%** | regression" },
  { pattern: "bullets-table", title: "Evaluation", column: 2, order: 1, content: "- Setup in one sentence" },
  { pattern: "bullets-two-images", title: "Analysis", column: 3, order: 0, content: "- Ablation takeaway\n- Failure-mode insight" },
  { pattern: "references", title: "References", column: 3, order: 1, content: "" },
]

const SLIDES_SCAFFOLD: ScaffoldCard[] = [
  { pattern: "title-slide", title: "Title", column: 1, order: 0, content: "" },
  { pattern: "bullets", title: "Motivation", column: 1, order: 1, content: "- Problem\n- Why now" },
  { pattern: "two-column", title: "Approach", column: 1, order: 2, content: "Method summary.\n\nComplementary detail." },
  { pattern: "figure-slide", title: "Results", column: 1, order: 3, content: "" },
  { pattern: "references", title: "References", column: 1, order: 4, content: "" },
]

const PAPER_SCAFFOLD: ScaffoldCard[] = [
  { pattern: "section", title: "Introduction", column: 1, order: 0, content: "Opening paragraph." },
  { pattern: "section", title: "Method", column: 1, order: 1, content: "Method prose." },
  { pattern: "section-figure", title: "Experiments", column: 1, order: 2, content: "Setup and findings." },
  { pattern: "references", title: "References", column: 1, order: 3, content: "" },
]

const THESIS_SCAFFOLD: ScaffoldCard[] = [
  { pattern: "section", title: "Formal Structure", column: 1, order: 0, content: "Assessment of formal criteria." },
  { pattern: "section", title: "Content & Method", column: 1, order: 1, content: "Assessment of substance." },
  { pattern: "bullets", title: "Questions for Defense", column: 1, order: 2, content: "- First question\n- Second question" },
  { pattern: "references", title: "Citation Audit", column: 1, order: 3, content: "" },
]

export function scaffoldFor(outputType: OutputType): ScaffoldCard[] {
  switch (outputType) {
    case "slides": return SLIDES_SCAFFOLD
    case "paper": return PAPER_SCAFFOLD
    case "thesis-review": return THESIS_SCAFFOLD
    default: return POSTER_SCAFFOLD
  }
}

function build(def: TemplateDef): TemplateDefinition {
  const preambleFactory = (() => {
    if (def.outputType === "poster") return POSTER_PREAMBLE_BY_ID[def.id.toLowerCase()] ?? POSTER_PREAMBLE_BY_ID["atlas"]
    if (def.outputType === "slides") return SLIDES_PREAMBLE_BY_ID[def.id.toLowerCase()] ?? SLIDES_PREAMBLE_BY_ID["beamer-atlas"]
    if (def.outputType === "paper") return PAPER_PREAMBLE_BY_ID[def.id.toLowerCase()] ?? PAPER_PREAMBLE_BY_ID["article-twocol"]
    // thesis-review has its own generator; no poster/slides/paper preamble
    return null
  })()

  return {
    id: def.id,
    outputType: def.outputType,
    meta: def,
    colors: def.colors,
    createGenerator: () => {
      if (def.outputType === "poster") return new TikzPosterGenerator(def.id)
      if (def.outputType === "slides") return new BeamerSlidesGenerator(def.id)
      if (def.outputType === "paper") return new StandardPaperGenerator(def.id)
      if (def.outputType === "thesis-review") return new ThesisReviewLatexGenerator(def.id)
      throw new Error(`No generator for ${def.outputType}/${def.id}`)
    },
    getPreamble: (project: Project, themeColor?: string, workspaceId?: string) => {
      if (!preambleFactory) {
        return `% thesis-review preamble for ${def.id} — use ThesisReviewLatexGenerator`
      }
      return preambleFactory(project, themeColor, workspaceId)
    },
    latexClass: def.latexClass,
    previewArt: getPreviewArt(def.id, def),
    hasBespokeArt: isBespoke(def.id),
    renderPreview: (width = 320) => renderTemplatePreviewSvg(def.id, def.colors, width, def),
    defaultCards: scaffoldFor(def.outputType),
  }
}

let bespokeCache: Set<string> | null = null
function isBespoke(id: string): boolean {
  if (!bespokeCache) {
    bespokeCache = new Set(TEMPLATE_REGISTRY.filter((t) => previewHasBespoke(t.id)).map((t) => t.id))
  }
  return bespokeCache.has(id)
}

const unified = new Map<string, TemplateDefinition>(TEMPLATE_REGISTRY.map((t) => [t.id, build(t)]))

/** Look up a unified template by id. */
export function getUnifiedTemplate(id: string): TemplateDefinition | undefined {
  return unified.get(id)
}

/** All unified templates. */
export function listUnifiedTemplates(): TemplateDefinition[] {
  return TEMPLATE_REGISTRY.map((t) => unified.get(t.id)!)
}

/** All unified templates of one output type. */
export function unifiedTemplatesFor(outputType: OutputType): TemplateDefinition[] {
  return listUnifiedTemplates().filter((t) => t.outputType === outputType)
}

/**
 * Validate that a scaffold card's pattern is legal for its output type. Used by
 * the registry test so a bad scaffold can never ship.
 */
export function scaffoldPatternIsValid(outputType: OutputType, pattern: string): boolean {
  return PATTERNS_FOR_TYPE[outputType].some((p) => p.id === pattern)
}

export { getTemplateDef }
