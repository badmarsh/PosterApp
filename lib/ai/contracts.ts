import { z } from "zod"

// 1. Card Generation
export const CardGenerationSchema = z.object({
  title: z.string().optional(),
  bullets: z.array(z.string()),
  assignedAssets: z.array(
    z.object({
      slot: z.string(),
      assetId: z.string()
    })
  ).optional()
})
export type CardGenerationResult = z.infer<typeof CardGenerationSchema>

// 2. Review Tips
export const ReviewTipSchema = z.object({
  severity: z.enum(["error", "warning", "info"]),
  category: z.enum(["citation", "typo", "figure", "layout", "content", "grounding"]),
  message: z.string()
})
export const ReviewTipsSchema = z.object({
  tips: z.array(ReviewTipSchema)
})
export type ReviewTipsResult = z.infer<typeof ReviewTipsSchema>

// 3. Compile Patch
export const CompilePatchSchema = z.object({
  id: z.string(),
  content: z.string() // The updated card content
})
export const CompileFixesSchema = z.object({
  patches: z.array(CompilePatchSchema)
})
export type CompileFixesResult = z.infer<typeof CompileFixesSchema>

// 4. Layout Warnings
export const LayoutWarningSchema = z.object({
  cardId: z.string(),
  message: z.string(),
  estimatedOverflowCharacters: z.number().optional()
})
export const LayoutWarningsSchema = z.object({
  warnings: z.array(LayoutWarningSchema)
})
export type LayoutWarningsResult = z.infer<typeof LayoutWarningsSchema>

// 5. Shrink Content Patch
export const ShrinkContentSchema = z.object({
  content: z.string()
})
export type ShrinkContentResult = z.infer<typeof ShrinkContentSchema>
