import { describe, it, expect } from "vitest"
import {
  parseAiApiKey,
  parseAiModelOverrides,
  resolveAiModelWithOverrides,
  DEFAULT_AI_MODELS,
  DEFAULT_FALLBACK_VISION_MODELS,
  getVisionModelChain,
} from "@/lib/ai/models"

describe("AI Configuration and Model Resolution", () => {
  describe("parseAiApiKey", () => {
    it("extracts x-gemini-api-key header and trims whitespace", () => {
      const headers = new Headers({
        "x-gemini-api-key": "  AIzaSyTestKey123  ",
      })
      expect(parseAiApiKey(headers)).toBe("AIzaSyTestKey123")
    })

    it("extracts x-ai-api-key header when gemini key is missing", () => {
      const headers = new Headers({
        "x-ai-api-key": "sk-or-v1-customkey",
      })
      expect(parseAiApiKey(headers)).toBe("sk-or-v1-customkey")
    })

    it("prefers x-gemini-api-key over x-ai-api-key if both are present", () => {
      const headers = new Headers({
        "x-gemini-api-key": "gemini-primary",
        "x-ai-api-key": "ai-fallback",
      })
      expect(parseAiApiKey(headers)).toBe("gemini-primary")
    })

    it("returns undefined when no key headers are provided", () => {
      const headers = new Headers({
        "content-type": "application/json",
      })
      expect(parseAiApiKey(headers)).toBeUndefined()
    })

    it("returns undefined for whitespace-only headers", () => {
      const headers = new Headers({
        "x-gemini-api-key": "   ",
        "x-ai-api-key": " \t ",
      })
      expect(parseAiApiKey(headers)).toBeUndefined()
    })
  })

  describe("parseAiModelOverrides", () => {
    it("parses valid JSON overrides for known roles", () => {
      const headers = new Headers({
        "X-AI-Model-Override": JSON.stringify({
          shrink: "gemini-2.5-flash",
          review: "gemini-2.5-pro",
        }),
      })
      const overrides = parseAiModelOverrides(headers)
      expect(overrides).toEqual({
        shrink: "gemini-2.5-flash",
        review: "gemini-2.5-pro",
      })
    })

    it("ignores unknown roles and invalid formats", () => {
      const headers = new Headers({
        "X-AI-Model-Override": JSON.stringify({
          unknownRole: "some-model",
          shrink: 12345,
          convert: "valid-model-name",
        }),
      })
      const overrides = parseAiModelOverrides(headers)
      expect(overrides).toEqual({
        convert: "valid-model-name",
      })
    })

    it("returns empty object on malformed JSON", () => {
      const headers = new Headers({
        "X-AI-Model-Override": "{ malformed json",
      })
      expect(parseAiModelOverrides(headers)).toEqual({})
    })
  })

  describe("resolveAiModelWithOverrides", () => {
    it("respects role-specific override", () => {
      const model = resolveAiModelWithOverrides("shrink", { shrink: "custom-shrink-model" })
      expect(model).toBe("custom-shrink-model")
    })

    it("inherits default override when role-specific override is unset", () => {
      const model = resolveAiModelWithOverrides("shrink", { default: "gemini-2.5-pro" })
      expect(model).toBe("gemini-2.5-pro")
    })
  })

  describe("Vision & VLM Model ID Sanitization", () => {
    it("defaults reviewLayout, vision, and ocr to valid models (not gemini-3.5-flash)", () => {
      expect(DEFAULT_AI_MODELS.reviewLayout).toBe("gemini-2.5-flash")
      expect(DEFAULT_AI_MODELS.vision).toBe("gemini-2.5-flash")
      expect(DEFAULT_AI_MODELS.ocr).toBe("gemini-2.5-flash")
      expect(DEFAULT_AI_MODELS.reviewLayout).not.toContain("3.5")
      expect(DEFAULT_AI_MODELS.vision).not.toContain("3.5")
      expect(DEFAULT_AI_MODELS.ocr).not.toContain("3.5")
    })

    it("does not include nonexistent gemini-3.5-flash in fallback vision models", () => {
      expect(DEFAULT_FALLBACK_VISION_MODELS).not.toContain("gemini-3.5-flash")
      expect(DEFAULT_FALLBACK_VISION_MODELS).toContain("gemini-2.5-flash")
      expect(DEFAULT_FALLBACK_VISION_MODELS).toContain("gemini-1.5-flash")
    })

    it("getVisionModelChain contains valid models", () => {
      const chain = getVisionModelChain()
      expect(chain.length).toBeGreaterThan(0)
      for (const m of chain) {
        expect(m).not.toBe("gemini-3.5-flash")
      }
    })
  })
})
