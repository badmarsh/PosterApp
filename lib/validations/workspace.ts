import { z } from "zod"

export const FigureSchema = z.object({
  id: z.string(),
  url: z.string(),
  caption: z.string(),
})

export const CardTableSchema = z.object({
  hasHeader: z.boolean(),
  caption: z.string(),
  rows: z.array(z.array(z.string())),
})

export const CardSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  column: z.number().int().min(1).max(3).nullable().optional(),
  order: z.number().int().min(0),
  pattern: z.string(),
  content: z.string().optional(),
  table: CardTableSchema.nullable().optional(),
  figures: z.array(FigureSchema).nullable().optional(),
  figureLayout: z.string().optional(),
  sourceIds: z.array(z.string()).nullable().optional(),
  heightBudget: z.number().nullable().optional(),
  validation: z.string().optional(),
  generatedLatex: z.string().nullable().optional(),
  slideNotes: z.string().nullable().optional(),
})

export const AssetSchema = z.object({
  id: z.string(),
  fileId: z.string(),
  filename: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  kind: z.enum(["text", "figure", "table", "equation"]),
  page: z.number().int(),
  section: z.string().nullable().optional(),
  bbox: z.string().nullable().optional(),
  confidence: z.enum(["low", "medium", "high"]),
  heading: z.string().nullable().optional(),
  snippet: z.string().nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  tableRows: z.array(z.array(z.string())).nullable().optional(),
  assignedCardId: z.string().nullable().optional(),
  assignedSlot: z.string().nullable().optional(),
})

export const IngestFileSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number().int().min(0),
  method: z.enum(["MinerU", "Pandoc", "Auto"]),
  status: z.enum(["queued", "parsing", "done", "failed"]),
  progress: z.number().int().min(0).max(100),
  error: z.string().nullable().optional(),
  dismissed: z.boolean().optional(),
})

export const OutputSchema = z.object({
  id: z.string(),
  outputType: z.enum(["poster", "slides", "paper"]),
  templateId: z.string(),
  title: z.string(),
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  isActive: z.boolean().optional(),
  cards: z.array(CardSchema).optional(),
})

/**
 * Schema for updating a workspace via PUT.
 * Accepts both legacy flat format (posterTitle, templateName, cards)
 * and new outputs-based format.
 */
export const WorkspaceSchema = z.object({
  revision: z.number().int().nonnegative().optional(),
  name: z.string().optional(),
  // Legacy flat fields — mapped to/from the active output
  posterTitle: z.string().optional(),
  authors: z.string().optional(),
  venue: z.string().optional(),
  templateName: z.string().optional(),
  cards: z.array(CardSchema).optional(),
  // New outputs-based fields
  outputs: z.array(OutputSchema).optional(),
  activeOutputId: z.string().optional(),
  // Shared workspace data
  assets: z.array(AssetSchema).optional(),
  ingestFiles: z.array(IngestFileSchema).optional(),
  agentEvents: z.array(z.any()).optional(),
  chatMessages: z.array(z.any()).optional(),
})

export const WorkspaceCreateSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]+$/).min(3).max(64),
  name: z.string().min(1, "Name is required"),
  outputType: z.enum(["poster", "slides", "paper"]).optional().default("poster"),
  templateId: z.string().optional(),
})
