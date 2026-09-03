import { describe, it, expect, beforeEach } from "vitest"
import {
  resolveAiModel,
  getVisionModelChain,
  MAX_VISION_CHAIN,
  DEFAULT_AI_MODELS,
  AI_TIMEOUTS,
  parseAiModelOverrides,
  resolveAiModelWithOverrides,
  AI_MODEL_OVERRIDE_HEADER,
} from "../ai/models"
import { VisionCaptionSchema } from "../ai/contracts"

describe("AI Models & Contracts", () => {
  beforeEach(() => {
    delete process.env.AI_MODEL
    delete process.env.AI_MODEL
    delete process.env.AI_VISION_MODEL
    delete process.env.AI_GENERATION_MODEL
    delete process.env.AI_STRUCTURE_MODEL
    delete process.env.AI_CONVERT_MODEL
    delete process.env.AI_SHRINK_MODEL
    delete process.env.AI_REVIEW_MODEL
    delete process.env.AI_REVIEW_LAYOUT_MODEL
    delete process.env.AI_CHAT_MODEL
    delete process.env.AI_BIBTEX_MODEL
    delete process.env.AI_LABELER_MODEL
    delete process.env.AI_AUTOFIX_MODEL
  })

  it("resolves default models when env vars are unset", () => {
    expect(resolveAiModel("default")).toBe(DEFAULT_AI_MODELS.default)
    expect(resolveAiModel("vision")).toBe(DEFAULT_AI_MODELS.vision)
    expect(resolveAiModel("generation")).toBe(DEFAULT_AI_MODELS.generation)
    expect(resolveAiModel("structure")).toBe(DEFAULT_AI_MODELS.structure)
    expect(resolveAiModel("convert")).toBe(DEFAULT_AI_MODELS.convert)
    expect(resolveAiModel("shrink")).toBe(DEFAULT_AI_MODELS.shrink)
    expect(resolveAiModel("review")).toBe(DEFAULT_AI_MODELS.review)
    expect(resolveAiModel("reviewLayout")).toBe(DEFAULT_AI_MODELS.reviewLayout)
    expect(resolveAiModel("chat")).toBe(DEFAULT_AI_MODELS.chat)
    expect(resolveAiModel("bibtex")).toBe(DEFAULT_AI_MODELS.bibtex)
    expect(resolveAiModel("labeler")).toBe(DEFAULT_AI_MODELS.labeler)
    expect(resolveAiModel("autofix")).toBe(DEFAULT_AI_MODELS.autofix)
  })

  it("prioritizes specific role env vars over fallback AI_MODEL", () => {
    process.env.AI_MODEL = "fallback-model"
    process.env.AI_VISION_MODEL = "specific-vision-model"

    expect(resolveAiModel("vision")).toBe("specific-vision-model")
    expect(resolveAiModel("generation")).toBe("fallback-model")
  })

  it("defines standard timeout constants", () => {
    expect(AI_TIMEOUTS.vision).toBe(60_000)
    expect(AI_TIMEOUTS.generation).toBe(180_000)
    expect(AI_TIMEOUTS.chat).toBe(180_000)
    expect(AI_TIMEOUTS.structure).toBe(60_000)
  })

  it("validates VisionCaptionSchema correctly", () => {
    const valid = { originalCaption: "Figure 1: Architecture", description: "A system diagram" }
    const result = VisionCaptionSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.originalCaption).toBe("Figure 1: Architecture")
      expect(result.data.description).toBe("A system diagram")
    }

    const empty = {}
    const emptyResult = VisionCaptionSchema.safeParse(empty)
    expect(emptyResult.success).toBe(true)
  })

  it("caps the vision chain at MAX_VISION_CHAIN (default 3) models", () => {
    const chain = getVisionModelChain()
    expect(chain.length).toBe(MAX_VISION_CHAIN)
    expect(chain.length).toBeLessThanOrEqual(3)
    expect(chain[0]).toBe(DEFAULT_AI_MODELS.vision)
  })

  it("prioritizes AI_VISION_MODEL as the first entry in getVisionModelChain", () => {
    process.env.AI_VISION_MODEL = "custom-omni-model"
    const chain = getVisionModelChain()
    expect(chain.length).toBe(MAX_VISION_CHAIN)
    expect(chain[0]).toBe("custom-omni-model")
  })
})

type OverrideMap = Partial<Record<keyof typeof DEFAULT_AI_MODELS, string>>

describe("parseAiModelOverrides (X-AI-Model-Override header validation)", () => {
  it("accepts valid overrides for known roles", () => {
    const headers = new Headers({
      [AI_MODEL_OVERRIDE_HEADER]: JSON.stringify({
        chat: "qwen3-64b-instruct",
        review: "deepseek-r1",
      }),
    })
    expect(parseAiModelOverrides(headers)).toEqual({
      chat: "qwen3-64b-instruct",
      review: "deepseek-r1",
    })
  })

  it("drops non-string values (numbers and nested objects)", () => {
    const headers = new Headers({
      [AI_MODEL_OVERRIDE_HEADER]: JSON.stringify({ chat: 123, review: { nested: true } }),
    })
    expect(parseAiModelOverrides(headers)).toEqual({})
  })

  it("drops unknown roles but keeps known ones", () => {
    const headers = new Headers({
      [AI_MODEL_OVERRIDE_HEADER]: JSON.stringify({ "not-a-role": "x", chat: "valid-model" }),
    })
    expect(parseAiModelOverrides(headers)).toEqual({ chat: "valid-model" })
  })

  it("drops values failing the model-name format check", () => {
    const headers = new Headers({
      [AI_MODEL_OVERRIDE_HEADER]: JSON.stringify({ chat: "model with spaces <script>" }),
    })
    expect(parseAiModelOverrides(headers)).toEqual({})
  })

  it("returns {} for malformed JSON, arrays, and missing headers", () => {
    expect(parseAiModelOverrides(new Headers({ [AI_MODEL_OVERRIDE_HEADER]: "{not json" }))).toEqual({})
    expect(parseAiModelOverrides(new Headers({ [AI_MODEL_OVERRIDE_HEADER]: "[1,2,3]" }))).toEqual({})
    expect(parseAiModelOverrides(new Headers())).toEqual({})
  })
})

describe("resolveAiModelWithOverrides", () => {
  beforeEach(() => {
    delete process.env.AI_MODEL
    delete process.env.AI_CHAT_MODEL
  })

  it("uses a valid override when provided", () => {
    const overrides: OverrideMap = { chat: "override-model" }
    expect(resolveAiModelWithOverrides("chat", overrides)).toBe("override-model")
  })

  it("ignores non-string overrides and falls back to env vars", () => {
    process.env.AI_CHAT_MODEL = "env-chat-model"
    const overrides: OverrideMap = { chat: 123 as unknown as string }
    expect(resolveAiModelWithOverrides("chat", overrides)).toBe("env-chat-model")
  })

  it("falls back to DEFAULT_AI_MODELS when nothing is set", () => {
    const overrides: OverrideMap = {}
    expect(resolveAiModelWithOverrides("chat", overrides)).toBe(DEFAULT_AI_MODELS.chat)
  })
})
