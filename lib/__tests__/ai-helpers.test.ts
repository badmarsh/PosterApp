import { describe, it, expect } from "vitest"
import { stripMarkdownFences, parseAiJson } from "../ai-helpers"

describe("AiHelpers", () => {
  describe("stripMarkdownFences", () => {
    it("removes ```json fences", () => {
      expect(stripMarkdownFences("```json\n{}\n```")).toBe("{}")
    })
    it("removes bare ``` fences", () => {
      expect(stripMarkdownFences("```\n{}\n```")).toBe("{}")
    })
    it("is a no-op for plain JSON without fences", () => {
      expect(stripMarkdownFences("{}")).toBe("{}")
    })
  })

  describe("parseAiJson", () => {
    it("returns { data, error: null } for valid JSON", () => {
      expect(parseAiJson('{"a": 1}')).toEqual({ data: { a: 1 }, error: null })
    })
    it("returns { data: null, error: string } for invalid JSON", () => {
      const res = parseAiJson('{"a": 1')
      expect(res.data).toBeNull()
      expect(res.error).toContain("AI returned invalid JSON")
    })
    it("correctly strips fences then parses", () => {
      expect(parseAiJson("```json\n{\"a\": 1}\n```")).toEqual({ data: { a: 1 }, error: null })
    })
    it("works with typed generic", () => {
      const res = parseAiJson<{ tips: [] }>('{"tips": []}')
      expect(res.data?.tips).toEqual([])
    })
  })
})
