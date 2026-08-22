/**
 * Output types, template registry, and layout constraints.
 *
 * This module defines the three first-class output types (poster, slides, paper),
 * the available graphical templates for each, and the physical layout constraints
 * that drive validation, AI generation, and height budgeting.
 */

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type OutputType = "poster" | "slides" | "paper"

export const OUTPUT_TYPE_LABELS: Record<OutputType, string> = {
  poster: "Poster",
  slides: "Slides",
  paper: "Paper",
}

export const OUTPUT_TYPE_DESCRIPTIONS: Record<OutputType, string> = {
  poster: "Large-format academic poster (A0/A1), typically 3-column portrait layout",
  slides: "Presentation slides (Beamer), sequential frames with speaker notes",
  paper: "Academic paper (article class), full prose sections with floats",
}

// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------

export type TemplateDef = {
  id: string
  outputType: OutputType
  label: string
  description: string
}

export const TEMPLATE_REGISTRY: TemplateDef[] = [
  // Posters
  { id: "atlas",   outputType: "poster", label: "ATLAS (CERN)",     description: "Red/white colour scheme with CERN ATLAS logos" },
  { id: "minimal", outputType: "poster", label: "Minimal Blue",     description: "Clean blue theme without institutional branding" },
  // Slides
  { id: "beamer-metropolis", outputType: "slides", label: "Metropolis",   description: "Modern minimal Beamer theme" },
  { id: "beamer-atlas",     outputType: "slides", label: "ATLAS Beamer", description: "CERN ATLAS branded Beamer slides" },
  // Papers
  { id: "article-twocol", outputType: "paper", label: "Two-Column Article", description: "Standard two-column article class" },
  { id: "article-single", outputType: "paper", label: "Single-Column",      description: "Single-column article, thesis style" },
]

/** Get all templates available for a given output type. */
export function getTemplatesForType(outputType: OutputType): TemplateDef[] {
  return TEMPLATE_REGISTRY.filter((t) => t.outputType === outputType)
}

/** Look up a specific template definition. Returns undefined if not found. */
export function getTemplateDef(templateId: string): TemplateDef | undefined {
  return TEMPLATE_REGISTRY.find((t) => t.id === templateId)
}

/** Get all valid template IDs for a given output type. */
export function getTemplateIdsForType(outputType: OutputType): string[] {
  return getTemplatesForType(outputType).map((t) => t.id)
}

/** Get the default template ID for a given output type. */
export function getDefaultTemplateId(outputType: OutputType): string {
  const templates = getTemplatesForType(outputType)
  return templates[0]?.id ?? "atlas"
}

// ---------------------------------------------------------------------------
// Block patterns per output type
// ---------------------------------------------------------------------------

export type PosterPattern =
  | "bullets"
  | "bullets-image"
  | "bullets-two-images"
  | "bullets-table"
  | "image-focused"
  | "references"

export type SlidePattern =
  | "title-slide"
  | "bullets"
  | "bullets-image"
  | "figure-slide"
  | "two-column"
  | "references"

export type PaperPattern =
  | "section"
  | "section-figure"
  | "section-table"
  | "section-two-figures"
  | "references"

/** All valid block patterns for a given output type. */
export const PATTERNS_FOR_TYPE: Record<OutputType, { id: string; label: string; description: string }[]> = {
  poster: [
    { id: "bullets", label: "Bullets only", description: "A bulleted list of findings." },
    { id: "bullets-image", label: "Bullets + single image", description: "Bullets followed by one centered figure." },
    { id: "bullets-two-images", label: "Bullets + two images", description: "Bullets followed by two side-by-side figures." },
    { id: "bullets-table", label: "Bullets + table", description: "Bullets followed by a tabular result block." },
    { id: "image-focused", label: "Image-focused card", description: "A figure-dominant block with a short caption." },
    { id: "references", label: "References / Bibliography", description: "Auto-generates the bibliography." },
  ],
  slides: [
    { id: "title-slide", label: "Title slide", description: "Title page with authors and venue." },
    { id: "bullets", label: "Bullet points", description: "Standard bullet-point slide." },
    { id: "bullets-image", label: "Bullets + image", description: "Bullets on one side, image on the other." },
    { id: "figure-slide", label: "Full figure", description: "A slide dominated by a single figure." },
    { id: "two-column", label: "Two-column", description: "Split slide with two content columns." },
    { id: "references", label: "References", description: "Bibliography slide." },
  ],
  paper: [
    { id: "section", label: "Text section", description: "Full prose section with optional bullets." },
    { id: "section-figure", label: "Section + figure", description: "Text section followed by a figure float." },
    { id: "section-table", label: "Section + table", description: "Text section followed by a table float." },
    { id: "section-two-figures", label: "Section + two figures", description: "Text section with two figure floats." },
    { id: "references", label: "References", description: "Bibliography section." },
  ],
}

/** Check if a pattern is valid for a given output type. */
export function isValidPattern(outputType: OutputType, patternId: string): boolean {
  return PATTERNS_FOR_TYPE[outputType].some((p) => p.id === patternId)
}

// ---------------------------------------------------------------------------
// Layout constraints
// ---------------------------------------------------------------------------

export type LayoutConstraints = {
  outputType: OutputType
  columnCount: number
  columnBudget: number        // height units; Infinity for paper
  maxCharsPerCard: number     // Infinity for paper
  defaultCardCount: number
}

export const LAYOUT_CONSTRAINTS: Record<OutputType, LayoutConstraints> = {
  poster: {
    outputType: "poster",
    columnCount: 3,
    columnBudget: 900,
    maxCharsPerCard: 400,
    defaultCardCount: 9,
  },
  slides: {
    outputType: "slides",
    columnCount: 1,
    columnBudget: 400,
    maxCharsPerCard: 180,
    defaultCardCount: 12,
  },
  paper: {
    outputType: "paper",
    columnCount: 1,
    columnBudget: Infinity,
    maxCharsPerCard: Infinity,
    defaultCardCount: 6,
  },
}

/** Get layout constraints for a given output type. */
export function getLayoutConstraints(outputType: OutputType): LayoutConstraints {
  return LAYOUT_CONSTRAINTS[outputType]
}
