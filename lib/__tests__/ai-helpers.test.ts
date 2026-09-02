import { describe, it, expect } from "vitest"
import { parseAiJson } from "../ai-helpers"

describe("AiHelpers", () => {
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
    it("parses array JSON correctly", () => {
      const res = parseAiJson<any[]>('```json\n[{"cardTitle": "Test", "issue": "Overflow"}]\n```')
      expect(res.data).toEqual([{ cardTitle: "Test", issue: "Overflow" }])
    })
    it("recovers array JSON surrounded by commentary", () => {
      const res = parseAiJson<any[]>('Here are the issues:\n[{"cardTitle": "Intro", "issue": "Text bleed"}]\nHope this helps!')
      expect(res.data).toEqual([{ cardTitle: "Intro", issue: "Text bleed" }])
    })
  })
})
