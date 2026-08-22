export type ColumnIndex = 1 | 2 | 3

import type { ExtractedAsset, IngestFile } from "./ingestion"

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

export type BlockPattern =
  | "bullets"
  | "bullets-image"
  | "bullets-two-images"
  | "bullets-table"
  | "image-focused"
  | "references"

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
  kind: "validate" | "generate" | "suggest" | "explain" | "info" | "verify"
  status: "running" | "done" | "error" | "warning"
  title: string
  detail?: string
  tips?: ReviewTip[]
}

export type Card = {
  id: string
  title: string
  column: ColumnIndex
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
}

export type Project = {
  id: string
  name: string
  posterTitle: string
  authors: string
  venue: string
  templateName: string
  cards: Card[]
  assets: ExtractedAsset[]
  ingestFiles: IngestFile[]
}

export function cardType(card: Card): CardType {
  switch (card.pattern) {
    case "bullets":
      return "bullets"
    case "bullets-table":
      return card.content.trim() ? "mixed" : "table"
    case "image-focused":
      return "figure"
    case "bullets-image":
    case "bullets-two-images":
      return "mixed"
    case "references":
      return "bullets"
    default:
      return "bullets" // or throw new Error("Unknown block pattern")
  }
}
