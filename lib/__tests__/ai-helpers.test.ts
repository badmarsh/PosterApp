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
    it("recovers from trailing commas in objects", () => {
      const res = parseAiJson('{"a": 1, "b": 2,}')
      expect(res.data).toEqual({ a: 1, b: 2 })
      expect(res.error).toBeNull()
    })
    it("recovers from trailing commas in arrays", () => {
      const res = parseAiJson('[1, 2, 3,]')
      expect(res.data).toEqual([1, 2, 3])
      expect(res.error).toBeNull()
    })
    it("handles empty string input", () => {
      const res = parseAiJson("")
      expect(res.data).toBeNull()
      expect(res.error).toContain("invalid JSON")
    })
    it("handles whitespace-only input", () => {
      const res = parseAiJson("   \n  ")
      expect(res.data).toBeNull()
      expect(res.error).toContain("invalid JSON")
    })
    it("parses JSON with unescaped newlines and tabs", () => {
      const res = parseAiJson('{"text": "Hello\nWorld\t!"}')
      expect(res.data).toEqual({ text: "Hello\nWorld\t!" })
      expect(res.error).toBeNull()
    })
    it("recovers nested JSON with escaped characters", () => {
      const res = parseAiJson('{"nested": {"key": "value with \\"quotes\\""}}')
      expect(res.data).toEqual({ nested: { key: 'value with "quotes"' } })
      expect(res.error).toBeNull()
    })
    it("rejects completely malformed input", () => {
      const res = parseAiJson("not even close to json")
      expect(res.data).toBeNull()
      expect(res.error).toContain("invalid JSON")
    })
    it("recovers JSON with extra whitespace and newlines", () => {
      const res = parseAiJson('{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}')
      expect(res.data).toEqual({ a: 1, b: [2, 3] })
      expect(res.error).toBeNull()
    })
    it("strips code fences with language prefix that has no newline", () => {
      const res = parseAiJson('```json{"a": 1}```')
      expect(res.data).toEqual({ a: 1 })
      expect(res.error).toBeNull()
    })
    it("recovers JSON from markdown text with code fences and commentary", () => {
      const res = parseAiJson('The result is:\n```json\n{"items": [1, 2, 3]}\n```\nLet me know if you need changes.')
      expect(res.data).toEqual({ items: [1, 2, 3] })
      expect(res.error).toBeNull()
    })
  })
})
