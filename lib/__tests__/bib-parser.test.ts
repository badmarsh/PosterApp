import { describe, it, expect } from "vitest"
import { parseBibKeys, formatCiteKey, extractCiteKeys } from "../bib-parser"

describe("BibParser", () => {
  describe("parseBibKeys", () => {
    it("extracts keys from multi-entry .bib string", () => {
      const bib = `
        @article{Author2020,
          title = {Hello}
        }
        @inproceedings{Other2021,
          title = {World}
        }
      `
      expect(parseBibKeys(bib)).toEqual(["Author2020", "Other2021"])
    })

    it("returns [] for empty string", () => {
      expect(parseBibKeys("")).toEqual([])
    })

    it("handles @inproceedings, @article, @techreport entry types", () => {
      const bib = `@techreport{A,} @article{B,} @inproceedings{C,}`
      expect(parseBibKeys(bib)).toEqual(["A", "B", "C"])
    })
  })

  describe("formatCiteKey", () => {
    it("formats cite key", () => {
      expect(formatCiteKey("Author2020")).toBe("\\cite{Author2020}")
    })
  })

  describe("extractCiteKeys", () => {
    it("finds single cite", () => {
      expect(extractCiteKeys("This is a \\cite{A} text")).toEqual(["A"])
    })

    it("finds multiple cites", () => {
      expect(extractCiteKeys("This is \\cite{A,B,C} text")).toEqual(["A", "B", "C"])
    })

    it("returns empty for no cites", () => {
      expect(extractCiteKeys("This is a text")).toEqual([])
    })

    it("deduplicates repeated keys", () => {
      expect(extractCiteKeys("This is \\cite{A,B} and \\cite{B,C}")).toEqual(["A", "B", "C"])
    })
  })
})
