/**
 * Centralized model defaults and timeout configuration for all AI operations.
 */

export const DEFAULT_AI_MODELS = {
  default: "gemini-3-flash",
  generation: "gemini-3-flash",
  structure: "gemini-3-flash",
  convert: "gemini-3-flash",
  shrink: "gemini-3-flash",
  review: "gemini-3-flash",
  reviewLayout: "qwen3-vl-flash",
  vision: "qwen3-vl-flash",
  chat: "gemini-3-flash",
  bibtex: "gemini-3-flash",
  labeler: "gemini-3-flash",
  autofix: "gemini-3-flash",
} as const

export type AiModelRole = keyof typeof DEFAULT_AI_MODELS

export const AI_TIMEOUTS = {
  vision: 60_000,
  bibtex: 45_000,
  labeler: 45_000,
  structure: 60_000,
  shrink: 120_000,
  generation: 180_000,
  review: 180_000,
  chat: 180_000,
} as const

export const DEFAULT_FALLBACK_VISION_MODELS: readonly string[] = [
  "qwen-omni-turbo",
  "qwen3-omni-flash",
  "qwen3-vl-plus",
  "qwen3-vl-flash",
  "qwen-vl-max",
  "qwen-vl-plus",
  "qwen3-vl-235b-a22b-instruct",
  "qwen3-omni-flash-2025-12-01",
  "qwen3-vl-plus-2025-12-19",
  "qwen3-vl-flash-2026-01-22",
] as const

export function getVisionModelChain(): string[] {
  const primary = process.env.AI_VISION_MODEL || DEFAULT_AI_MODELS.vision
  const envFallbacks = process.env.AI_VISION_FALLBACK_MODELS
    ? process.env.AI_VISION_FALLBACK_MODELS.split(",").map((s) => s.trim()).filter(Boolean)
    : DEFAULT_FALLBACK_VISION_MODELS

  // Ensure unique ordered chain of Qwen vision models starting with primary, returning up to 10 models
  const unique = Array.from(new Set([primary, ...envFallbacks]))
  return unique.slice(0, 10)
}

export function resolveAiModel(role: AiModelRole = "default"): string {
  switch (role) {
    case "vision":
      return process.env.AI_VISION_MODEL || DEFAULT_AI_MODELS.vision
    case "generation":
      return process.env.AI_GENERATION_MODEL || process.env.AI_MODEL || DEFAULT_AI_MODELS.generation
    case "structure":
      return process.env.AI_STRUCTURE_MODEL || process.env.AI_GENERATION_MODEL || process.env.AI_MODEL || DEFAULT_AI_MODELS.structure
    case "convert":
      return process.env.AI_CONVERT_MODEL || process.env.AI_GENERATION_MODEL || process.env.AI_MODEL || DEFAULT_AI_MODELS.convert
    case "shrink":
      return process.env.AI_SHRINK_MODEL || process.env.AI_GENERATION_MODEL || process.env.AI_MODEL || DEFAULT_AI_MODELS.shrink
    case "review":
      return process.env.AI_REVIEW_MODEL || process.env.AI_MODEL || DEFAULT_AI_MODELS.review
    case "reviewLayout":
      return process.env.AI_REVIEW_LAYOUT_MODEL || process.env.AI_VISION_MODEL || process.env.AI_REVIEW_MODEL || process.env.AI_MODEL || DEFAULT_AI_MODELS.reviewLayout
    case "chat":
      return process.env.AI_CHAT_MODEL || process.env.AI_MODEL || DEFAULT_AI_MODELS.chat
    case "bibtex":
      return process.env.AI_BIBTEX_MODEL || process.env.AI_MODEL || DEFAULT_AI_MODELS.bibtex
    case "labeler":
      return process.env.AI_LABELER_MODEL || process.env.AI_MODEL || DEFAULT_AI_MODELS.labeler
    case "autofix":
      return process.env.AI_AUTOFIX_MODEL || process.env.AI_REVIEW_MODEL || process.env.AI_MODEL || DEFAULT_AI_MODELS.autofix
    default:
      return process.env.AI_MODEL || DEFAULT_AI_MODELS.default
  }
}



