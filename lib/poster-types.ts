export type ColumnIndex = 1 | 2 | 3

import type { ExtractedAsset, IngestFile } from "./ingestion"
import type { OutputType } from "./output-types"

export type BibEntry = {
  id: string
  title: string
  authors: string[]
  year?: string
  journal?: string
  doi?: string
}

export type WorkspaceSettings = {
  theme: string
  // Add other settings as needed
}

export type ValidationResult = {
  isValid: boolean
  messages: ValidationMessage[]
}

/**
 * BlockPattern is a union of ALL patterns across all output types.
 * Use `PATTERNS_FOR_TYPE[outputType]` from output-types.ts to get
 * the subset valid for a specific output type.
 */
export type BlockPattern =
  | "bullets"
  | "bullets-image"
  | "bullets-two-images"
  | "bullets-table"
  | "image-focused"
  | "references"
  // Slide-specific patterns
  | "title-slide"
  | "figure-slide"
  | "two-column"
  // Paper-specific patterns
  | "section"
  | "section-figure"
  | "section-table"
  | "section-two-figures"

export const BLOCK_PATTERNS: {
  id: BlockPattern
  label: string
  description: string
}[] = [
  { id: "bullets", label: "Bullets only", description: "A bulleted list of findings." },
  {
    id: "bullets-image",
    label: "Bullets + single image",
    description: "Bullets followed by one centered figure.",
  },
  {
    id: "bullets-two-images",
    label: "Bullets + two images",
    description: "Bullets followed by two side-by-side figures.",
  },
  {
    id: "bullets-table",
    label: "Bullets + table",
    description: "Bullets followed by a tabular result block.",
  },
  {
    id: "image-focused",
    label: "Image-focused card",
    description: "A figure-dominant block with a short caption.",
  },
  {
    id: "references",
    label: "References / Bibliography",
    description: "Auto-generates the bibliography.",
  },
]

export type CardType = "bullets" | "table" | "figure" | "mixed"

export type ValidationLevel = "valid" | "warning" | "invalid" | "generating"

export type ValidationMessage = {
  level: "error" | "warning" | "info"
  field: string
  message: string
}

export type FigureLayout = "single" | "two-up"

export type Figure = {
  id: string
  url: string
  caption: string
}

export type CardTable = {
  hasHeader: boolean
  caption: string
  rows: string[][]
}

export type ReviewTip = {
  severity: "error" | "warning" | "info"
  category: "citation" | "typo" | "figure" | "layout" | "content" | "grounding" | string
  message: string
}

export type AgentEvent = {
  id: string
  ts: string
  createdAt?: number
  kind: "validate" | "generate" | "suggest" | "explain" | "info" | "verify" | "review"
  status: "running" | "done" | "error" | "warning"
  title: string
  detail?: string
  tips?: ReviewTip[]
}

export type Card = {
  id: string
  title: string
  /** Column index — only meaningful for poster layout (1|2|3). Null for slides/paper. */
  column: ColumnIndex | null
  order: number
  pattern: BlockPattern
  content: string
  table: CardTable
  figures: Figure[]
  figureLayout: FigureLayout
  sourceIds?: string[]
  heightBudget?: number | null
  validation: ValidationLevel
  /** when validation === "generating" we still keep last messages */
  generatedLatex?: string
  /** Speaker notes — only used for slides output type */
  slideNotes?: string
}

/**
 * An OutputConfig represents a single output variant within a workspace.
 * Each output has its own set of cards tailored for a specific output type
 * and graphical template.
 */
export type OutputConfig = {
  id: string
  outputType: OutputType
  templateId: string
  title: string
  /** Accent token selected from the template's supported palette. */
  themeColor?: string
  cards: Card[]
}

/**
 * A Project (workspace) stores shared source material and multiple output configurations.
 *
 * For backward compatibility, the flat `cards`, `posterTitle`, and `templateName`
 * fields are still present and correspond to the active output's cards.
 * New code should use `outputs` and `activeOutputId` instead.
 */
export type Project = {
  id: string
  /** Server-side optimistic-lock revision. Omitted only for legacy local samples. */
  revision?: number
  name: string
  /** @deprecated Use outputs[activeOutputId].title instead */
  posterTitle: string
  authors: string
  venue: string
  /** @deprecated Use outputs[activeOutputId].templateId instead */
  templateName: string
  /** @deprecated Use outputs[activeOutputId].cards instead */
  cards: Card[]
  assets: ExtractedAsset[]
  ingestFiles: IngestFile[]
  /** All output configurations for this workspace */
  outputs: OutputConfig[]
  /** ID of the currently active output */
  activeOutputId: string
}

export function cardType(card: Card): CardType {
  switch (card.pattern) {
    case "bullets":
    case "section":
    case "title-slide":
    case "references":
      return "bullets"
    case "bullets-table":
    case "section-table":
      return card.content.trim() ? "mixed" : "table"
    case "image-focused":
    case "figure-slide":
      return "figure"
    case "bullets-image":
    case "bullets-two-images":
    case "two-column":
    case "section-figure":
    case "section-two-figures":
      return "mixed"
    default:
      return "bullets" // or throw new Error("Unknown block pattern")
  }
}
