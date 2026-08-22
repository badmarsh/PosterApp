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
  column: z.number().int().min(1).max(3),
  order: z.number().int().min(0),
  pattern: z.enum(["bullets", "bullets-image", "bullets-two-images", "bullets-table", "image-focused", "references"]),
  content: z.string().optional(),
  table: CardTableSchema.nullable().optional(),
  figures: z.array(FigureSchema).nullable().optional(),
  figureLayout: z.string().optional(),
  sourceIds: z.array(z.string()).nullable().optional(),
  heightBudget: z.number().nullable().optional(),
  validation: z.string().optional(),
  generatedLatex: z.string().nullable().optional(),
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

export const WorkspaceSchema = z.object({
  name: z.string().optional(),
  posterTitle: z.string().optional(),
  authors: z.string().optional(),
  venue: z.string().optional(),
  templateName: z.preprocess(
    (val) => {
      // Normalize legacy value written before enum was enforced
      if (typeof val === "string" && val !== "atlas" && val !== "minimal") return "atlas"
      return val
    },
    z.enum(["atlas", "minimal"]).optional()
  ),
  cards: z.array(CardSchema).optional(),
  assets: z.array(AssetSchema).optional(),
  ingestFiles: z.array(IngestFileSchema).optional(),
})

export const WorkspaceCreateSchema = z.object({
  id: z.string().min(1, "ID is required"),
  name: z.string().min(1, "Name is required"),
  templateName: z.enum(["atlas", "minimal"]).optional(),
})
