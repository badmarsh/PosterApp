import { describe, it, expect, beforeEach } from "vitest"
import { resolveAiModel, getVisionModelChain, DEFAULT_AI_MODELS, AI_TIMEOUTS } from "../ai/models"
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

  it("returns 10 fallback vision models in getVisionModelChain", () => {
    const chain = getVisionModelChain()
    expect(chain.length).toBe(10)
    expect(chain[0]).toBe(DEFAULT_AI_MODELS.vision)
  })

  it("prioritizes AI_VISION_MODEL as the first entry in getVisionModelChain", () => {
    process.env.AI_VISION_MODEL = "custom-omni-model"
    const chain = getVisionModelChain()
    expect(chain.length).toBe(10)
    expect(chain[0]).toBe("custom-omni-model")
  })
})
