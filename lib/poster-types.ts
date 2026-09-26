export type ColumnIndex = 1 | 2 | 3

import type { ExtractedAsset, IngestFile } from "./ingestion"
import type { OutputType } from "./output-types"
export type { OutputType }

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
  | "stats"
  | "metric-card"
  | "references"
  | "graph"
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
  // Poster patterns
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
  { id: "stats", label: "Stat hero callouts", description: "Display metric callouts with badges and large numbers." },
  { id: "metric-card", label: "Metric card", description: "Visual metric tiles for key benchmarks and results." },
  {
    id: "references",
    label: "References / Bibliography",
    description: "Auto-generates the bibliography.",
  },
  // Slide patterns
  { id: "title-slide", label: "Title slide", description: "Title page with authors and venue." },
  { id: "figure-slide", label: "Full figure", description: "A slide dominated by a single figure." },
  { id: "two-column", label: "Two-column", description: "Split slide with two content columns." },
  // Paper patterns
  { id: "section", label: "Text section", description: "Full prose section with optional bullets." },
  {
    id: "section-figure",
    label: "Section + figure",
    description: "Text section followed by a figure float.",
  },
  {
    id: "section-table",
    label: "Section + table",
    description: "Text section followed by a table float.",
  },
  {
    id: "section-two-figures",
    label: "Section + two figures",
    description: "Text section with two figure floats.",
  },
]

export type CardType = "bullets" | "table" | "figure" | "mixed"

export type ValidationLevel = "valid" | "warning" | "invalid" | "generating" | "pending"

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

/** A quote-grounded source anchor returned by card auto-fill. */
export type CardCitation = {
  bulletIndex: number
  chunkIds: string[]
  evidence: Array<{
    anchor: string
    chunkId: string
    quote: string
    heading?: string | null
    documentId?: string
  }>
}

/** A source asset ranked as relevant to the card topic. */
export type SuggestedAsset = {
  id: string
  kind: string
  filename?: string
  caption?: string
  snippet?: string
  section?: string | null
  score: number
}

export type CardLayoutTruth = {
  budget: number | null
  estimatedHeight: number | null
  overBudget: boolean
  /** Positive units by which the estimate exceeds the budget. */
  delta: number
  suggestions: string[]
  pattern?: BlockPattern
}

/** Metadata produced by the grounded auto-fill endpoint and persisted with a card. */
export type CardGrounding = {
  citations: CardCitation[]
  suggestedAssets: SuggestedAsset[]
  layout?: CardLayoutTruth
  grounded?: boolean
  generatedAt?: string
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
  /** Card the tip refers to, when the reviewer could attribute it. */
  cardId?: string
}

export type EventFix = {
  id: string
  content: string
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
  fixes?: EventFix[]
  fixesApplied?: boolean
  /** Snapshot that lets the user revert an AI change (e.g. auto-fill) from the feed. */
  undo?: { cardId: string; title: string; content: string; figures: Figure[] }
  undoApplied?: boolean
  /** Multi-card snapshot taken before autofix patches were applied automatically. */
  undoMany?: Array<{ cardId: string; content: string }>
  undoManyApplied?: boolean
}

export type Card = {
  id: string
  title: string
  /**
   * Rubric criterion this card assesses — only meaningful for thesis-review
   * outputs, where every card is one criterion of the review form. When absent,
   * `lib/latex/thesis-review-meta.ts` tries to resolve the card title against
   * the known rubrics before falling back to the humanized title, so a card is
   * never silently dropped from the posudok.
   */
  criterionId?: string | null
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
  /** Grounding, suggested-asset and layout metadata from the latest auto-fill. */
  grounding?: CardGrounding
}

/**
 * Structured metadata for a thesis-review (posudok) output.
 *
 * The AI review pipeline stores a full `ThesisReview` record and exports
 * straight from it. A workspace-authored posudok (hand-written, imported, or a
 * curated showcase) only has cards, so every fact the printed form needs —
 * student, thesis title, role, grade, defence date — used to be guessed from
 * the free-text fields (`authors`, `venue`, `title`) and often came out wrong.
 *
 * These optional fields are the explicit override. Anything left out is
 * derived from the cards by `lib/latex/thesis-review-meta.ts`, which parses the
 * identification bullets, the rating lines and the conclusion tiles that the
 * card templates already produce.
 */
/**
 * One assessed criterion carried by a stored review record (or a client-side
 * review store), independent of the card layout the workspace happens to use.
 * `deriveThesisReview` prefers these over card-derived criteria so an exported
 * posudok matches the review the reviewer actually confirmed.
 */
export type ThesisReviewMetaCriterion = {
  criterionId: string
  /** Localised rubric label; the rubric registry is consulted when omitted. */
  name?: string | null
  weight?: number | null
  /** Rating letter (A–F). */
  rating?: string | null
  /** 0–100 numeric score, when the rubric scored numerically. */
  numericScore?: number | null
  text?: string | null
  suggestions?: string[] | null
}

export type ThesisReviewOutputMeta = {
  reviewKind?: "thesis" | "paper"
  studentName?: string
  thesisTitle?: string
  thesisType?: "bachelor" | "master" | "phd"
  studyProgramme?: string
  reviewerName?: string
  reviewerRole?: "supervisor" | "opponent" | "reviewer" | "self"
  institution?: string
  faculty?: string
  department?: string
  academicYear?: string
  /** Final classification letter (A–F). */
  grade?: string
  /** Overall weighted score in percent, when the reviewer computed one. */
  scorePercent?: number
  recommendation?: string
  place?: string
  date?: string
  includeConfidential?: boolean
  confidentialComments?: string
  /** Typesetting language of the exported posudok. */
  language?: "sk" | "cs" | "en" | "de" | "pl" | "hu"
  /** Structured per-criterion assessments from a stored review record. */
  criteria?: ThesisReviewMetaCriterion[] | null
  /** Narrative blocks kept outside the cards. */
  summary?: string
  strengths?: string[]
  defenseQuestions?: string[]
  citationIssues?: string[]
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
  /** Specific authors override for this output instance (falls back to project.authors if omitted) */
  authors?: string | null
  /** Specific venue override for this output instance (falls back to project.venue if omitted) */
  venue?: string | null
  /** Specific logo override for this output instance (falls back to project.logoUrl if omitted) */
  logoUrl?: string | null
  /** Specific secondary logo override for this output instance (falls back to project.secondaryLogoUrl if omitted) */
  secondaryLogoUrl?: string | null
  /** Accent token selected from the template's supported palette. */
  themeColor?: string | null
  /** Document-level default source files to restrict Gemini RAG autofill context */
  sourceIds?: string[]
  /** Explicit posudok metadata for thesis-review outputs (overrides derivation). */
  reviewMeta?: ThesisReviewOutputMeta | null
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
  posterTitle?: string
  authors: string
  venue: string
  /** Global default logo URL */
  logoUrl?: string | null
  /** Global default secondary logo URL */
  secondaryLogoUrl?: string | null
  /** @deprecated Use outputs[activeOutputId].templateId instead */
  templateName?: string
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
    case "stats":
    case "metric-card":
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
      return "bullets"
  }
}

/**
 * Resolves title, authors, venue, and logo for an output variant.
 * If the output has specific override values, they are used;
 * otherwise it inherits from the top-level project defaults.
 */
export function resolveOutputMetadata(project: Project, output?: OutputConfig | null) {
  const active = output ?? project.outputs?.find((o) => o.id === project.activeOutputId)
  const defaultTitle = project.posterTitle || project.name || "Untitled Project"
  const defaultAuthors = project.authors || ""
  const defaultVenue = project.venue || ""
  const defaultLogoUrl = project.logoUrl ?? null
  const defaultSecondaryLogoUrl = project.secondaryLogoUrl ?? null

  const title = (active?.title && active.title.trim()) ? active.title : defaultTitle
  const authors = (active?.authors && active.authors.trim()) ? active.authors : defaultAuthors
  const venue = (active?.venue && active.venue.trim()) ? active.venue : defaultVenue
  const logoUrl = (active?.logoUrl !== undefined && active?.logoUrl !== null && active.logoUrl.trim() !== "") ? active.logoUrl : defaultLogoUrl
  const secondaryLogoUrl = (active?.secondaryLogoUrl !== undefined && active?.secondaryLogoUrl !== null && active.secondaryLogoUrl.trim() !== "") ? active.secondaryLogoUrl : defaultSecondaryLogoUrl

  const isTitleOverridden = Boolean(active?.title && active.title.trim() && active.title !== defaultTitle)
  const isAuthorsOverridden = Boolean(active?.authors && active.authors.trim() && active.authors !== defaultAuthors)
  const isVenueOverridden = Boolean(active?.venue && active.venue.trim() && active.venue !== defaultVenue)
  const isLogoOverridden = Boolean(active?.logoUrl && active.logoUrl !== defaultLogoUrl)
  const isSecondaryLogoOverridden = Boolean(active?.secondaryLogoUrl && active.secondaryLogoUrl !== defaultSecondaryLogoUrl)

  return {
    title,
    authors,
    venue,
    logoUrl,
    secondaryLogoUrl,
    defaultTitle,
    defaultAuthors,
    defaultVenue,
    defaultLogoUrl,
    defaultSecondaryLogoUrl,
    isTitleOverridden,
    isAuthorsOverridden,
    isVenueOverridden,
    isLogoOverridden,
    isSecondaryLogoOverridden,
  }
}
