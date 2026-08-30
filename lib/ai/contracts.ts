import { z } from "zod"

// 1. Card Generation
export const CardGenerationSchema = z.preprocess((raw: any) => {
  if (raw && typeof raw === "object") {
    const bullets = raw.bullets || raw.points || raw.items || raw.paragraphs || raw.content || []
    return {
      title: raw.title || raw.cardTitle || raw.topic,
      bullets: Array.isArray(bullets) ? bullets.map(String) : (typeof bullets === "string" ? [bullets] : []),
      assignedAssets: Array.isArray(raw.assignedAssets)
        ? raw.assignedAssets
        : Array.isArray(raw.assets)
        ? raw.assets
        : []
    }
  }
  return raw
}, z.object({
  title: z.string().optional(),
  bullets: z.array(z.string()),
  assignedAssets: z.array(
    z.object({
      slot: z.string(),
      assetId: z.string()
    })
  ).optional()
}))
export type CardGenerationResult = z.infer<typeof CardGenerationSchema>

// 2. Review Tips
export const ReviewTipSchema = z.preprocess((item: any) => {
  if (item && typeof item === "object") {
    return {
      severity: item.severity || "info",
      category: item.category || "content",
      message: item.message || item.tip || item.text || item.description || "Review tip"
    }
  }
  return item
}, z.object({
  severity: z.enum(["error", "warning", "info"]).catch("info"),
  category: z.enum(["citation", "typo", "figure", "layout", "content", "grounding"]).catch("content"),
  message: z.string()
}))

export const ReviewTipsSchema = z.preprocess((raw: any) => {
  if (Array.isArray(raw)) return { tips: raw }
  if (raw && typeof raw === "object") {
    const tips = raw.tips || raw.review || raw.issues || raw.feedback || raw.suggestions || []
    if (Array.isArray(tips)) return { tips }
  }
  return raw
}, z.object({
  tips: z.array(ReviewTipSchema)
}))
export type ReviewTipsResult = z.infer<typeof ReviewTipsSchema>

// 3. Compile Patch
export const CompilePatchSchema = z.preprocess((raw: any) => {
  if (raw && typeof raw === "object") {
    return {
      id: String(raw.id || raw.cardId || ""),
      content: String(raw.content || raw.patch || raw.text || "")
    }
  }
  return raw
}, z.object({
  id: z.string(),
  content: z.string() // The updated card content
}))

export const CompileFixesSchema = z.preprocess((raw: any) => {
  if (Array.isArray(raw)) return { patches: raw }
  if (raw && typeof raw === "object") {
    const patches = raw.patches || raw.fixes || raw.corrections || []
    if (Array.isArray(patches)) {
      return { explanation: raw.explanation || raw.message, patches }
    }
  }
  return raw
}, z.object({
  explanation: z.string().optional(),
  patches: z.array(CompilePatchSchema)
}))
export type CompileFixesResult = z.infer<typeof CompileFixesSchema>

// 4. Layout Warnings (VLM Review)
export const LayoutWarningSchema = z.object({
  cardId: z.string().optional(),
  cardTitle: z.union([z.string(), z.number()]).transform(v => String(v)).optional().default("Untitled"),
  issue: z.union([z.string(), z.number()]).transform(v => String(v)).optional().default("Layout overflow detected"),
  recommendation: z.union([z.string(), z.number()]).transform(v => String(v)).optional().default("Reduce content or adjust layout to fit."),
  estimatedOverflowCharacters: z.preprocess((val) => {
    if (typeof val === "number") return val
    if (typeof val === "string") {
      const parsed = parseInt(val.replace(/\D/g, ""), 10)
      return isNaN(parsed) ? undefined : parsed
    }
    return undefined
  }, z.number().optional()),
  compiledRevision: z.number().optional()
})

export const LayoutWarningsSchema = z.preprocess((raw: any) => {
  if (Array.isArray(raw)) {
    return { warnings: raw }
  }
  if (raw && typeof raw === "object") {
    const list = raw.warnings || raw.issues || raw.layoutWarnings || raw.results || raw.data || raw.tips || raw.overflows
    if (Array.isArray(list)) {
      return { warnings: list }
    }
    if (!raw.warnings) {
      return { warnings: [] }
    }
  }
  return raw
}, z.object({
  warnings: z.array(
    z.preprocess((item: any) => {
      if (item && typeof item === "object") {
        return {
          cardTitle: item.cardTitle || item.title || item.card || item.slideTitle || item.sectionTitle || item.heading || "Untitled",
          issue: item.issue || item.description || item.message || item.overflow || item.problem || "Layout overflow detected",
          recommendation: item.recommendation || item.fix || item.suggestion || item.solution || "Reduce content or adjust layout to fit.",
          estimatedOverflowCharacters: item.estimatedOverflowCharacters ?? item.overflowCharacters ?? item.chars ?? item.overflowChars,
          cardId: item.cardId,
          compiledRevision: item.compiledRevision,
        }
      }
      return item
    }, LayoutWarningSchema)
  ).default([])
}))
export type LayoutWarningsResult = z.infer<typeof LayoutWarningsSchema>

// 5. Shrink Content Patch
export const ShrinkContentSchema = z.preprocess((raw: any) => {
  if (typeof raw === "string") return { content: raw }
  if (raw && typeof raw === "object") {
    const content = raw.content || raw.shrunkContent || raw.text || raw.summary || ""
    return { content: Array.isArray(content) ? content.join("\n\n") : String(content) }
  }
  return raw
}, z.object({
  content: z.string().min(1)
}))
export type ShrinkContentResult = z.infer<typeof ShrinkContentSchema>

// 6. Document Structure Generation
export const StructureCardDefSchema = z.preprocess((raw: any) => {
  if (raw && typeof raw === "object") {
    const pattern = raw.pattern || "bullets"
    const validPatterns = [
      "bullets", "bullets-image", "bullets-two-images", "bullets-table",
      "image-focused", "title-slide", "figure-slide", "two-column",
      "section", "section-figure", "section-table", "section-two-figures", "references"
    ]
    return {
      title: String(raw.title || "Section"),
      pattern: validPatterns.includes(pattern) ? pattern : "bullets",
      column: typeof raw.column === "number" ? raw.column : undefined
    }
  }
  return raw
}, z.object({
  title: z.string(),
  pattern: z.string(),
  column: z.number().int().min(1).max(3).optional()
}))

export const StructureGenerationSchema = z.preprocess((raw: any) => {
  if (Array.isArray(raw)) return { cards: raw }
  if (raw && typeof raw === "object") {
    const cards = raw.cards || raw.sections || raw.slides || raw.blocks || []
    if (Array.isArray(cards)) return { cards }
  }
  return raw
}, z.object({
  cards: z.array(StructureCardDefSchema)
}))
export type StructureGenerationResult = z.infer<typeof StructureGenerationSchema>

// 7. Vision Captioning & Naming
export const VisionCaptionSchema = z.preprocess((raw: any) => {
  if (raw && typeof raw === "object") {
    return {
      name: raw.name || raw.filename || raw.title || "",
      originalCaption: raw.originalCaption || raw.caption || raw.label || "",
      description: raw.description || raw.summary || raw.details || ""
    }
  }
  return raw
}, z.object({
  name: z.string().optional().default(""),
  originalCaption: z.string().optional().default(""),
  description: z.string().optional().default(""),
}))
export type VisionCaptionResult = z.infer<typeof VisionCaptionSchema>

// 8. Vision OCR & Multimodal Document Extraction
export const VisionOcrEquationSchema = z.preprocess((item: any) => {
  if (typeof item === "string") {
    return { formula: item, name: "Equation" }
  }
  if (item && typeof item === "object") {
    return {
      key: item.key || undefined,
      name: item.name || item.title || "Equation",
      formula: String(item.formula || item.latex || item.math || ""),
      description: item.description || item.meaning || undefined,
    }
  }
  return item
}, z.object({
  key: z.string().optional(),
  name: z.string().optional().default("Equation"),
  formula: z.string(),
  description: z.string().optional(),
}))

export const VisionOcrTableSchema = z.preprocess((item: any) => {
  if (item && typeof item === "object") {
    return {
      caption: item.caption || item.title || "",
      markdown: item.markdown || item.text || "",
      rows: Array.isArray(item.rows) ? item.rows : undefined,
    }
  }
  return item
}, z.object({
  caption: z.string().optional().default(""),
  markdown: z.string().optional().default(""),
  rows: z.array(z.array(z.string())).optional(),
}))

export const VisionOcrSchema = z.preprocess((raw: any) => {
  if (raw && typeof raw === "object") {
    const equations = raw.equations || raw.formulas || raw.math || []
    const tables = raw.tables || (raw.table ? [raw.table] : [])
    return {
      text: String(raw.text || raw.transcription || raw.content || raw.markdown || ""),
      mode: raw.mode || "auto",
      title: raw.title || raw.name || "Scanned Content",
      summary: raw.summary || raw.description || "",
      equations: Array.isArray(equations) ? equations : [],
      tables: Array.isArray(tables) ? tables : [],
    }
  }
  return raw
}, z.object({
  text: z.string().default(""),
  mode: z.enum(["auto", "equation", "table", "text", "figure"]).catch("auto"),
  title: z.string().optional().default("Scanned Content"),
  summary: z.string().optional().default(""),
  equations: z.array(VisionOcrEquationSchema).default([]),
  tables: z.array(VisionOcrTableSchema).default([]),
}))
export type VisionOcrResult = z.infer<typeof VisionOcrSchema>



