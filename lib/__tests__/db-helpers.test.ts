import { describe, it, expect } from "vitest"
import { safeJsonParse, jsonStringify } from "../db-helpers"

describe("db-helpers", () => {
  describe("safeJsonParse", () => {
    it("parses valid JSON strings", () => {
      expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 })
      expect(safeJsonParse('[1,2,3]', [])).toEqual([1, 2, 3])
    })

    it("returns fallback for invalid JSON", () => {
      expect(safeJsonParse("not json", { fallback: true })).toEqual({ fallback: true })
      expect(safeJsonParse("{unclosed", { fallback: true })).toEqual({ fallback: true })
    })

    it("returns fallback for null, undefined, and empty input", () => {
      expect(safeJsonParse(null, { fallback: true })).toEqual({ fallback: true })
      expect(safeJsonParse(undefined, { fallback: true })).toEqual({ fallback: true })
      expect(safeJsonParse("", { fallback: true })).toEqual({ fallback: true })
    })
  })

  describe("jsonStringify", () => {
    it("stringifies objects", () => {
      expect(jsonStringify({ a: 1 })).toBe('{"a":1}')
    })

    it("returns null for null and undefined", () => {
      expect(jsonStringify(null)).toBeNull()
      expect(jsonStringify(undefined)).toBeNull()
    })

    it("stringifies arrays and primitives", () => {
      expect(jsonStringify([1, 2])).toBe('[1,2]')
      expect(jsonStringify("hello")).toBe('"hello"')
    })
  })
})
