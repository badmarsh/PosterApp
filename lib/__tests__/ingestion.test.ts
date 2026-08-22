import { describe, it, expect } from "vitest"
import { detectMethod, formatBytes, slotsForKind } from "../ingestion"

describe("Ingestion", () => {
  describe("detectMethod", () => {
    it("returns MinerU for .pdf", () => {
      expect(detectMethod("test.pdf")).toBe("MinerU")
    })
    it("returns Pandoc for .docx, .md, .tex, .bib", () => {
      expect(detectMethod("test.docx")).toBe("Pandoc")
      expect(detectMethod("test.md")).toBe("Pandoc")
      expect(detectMethod("test.tex")).toBe("Pandoc")
      expect(detectMethod("test.bib")).toBe("Pandoc")
    })
    it("returns Auto for .jpg, .png, .xyz", () => {
      expect(detectMethod("test.jpg")).toBe("Auto")
      expect(detectMethod("test.png")).toBe("Auto")
      expect(detectMethod("test.xyz")).toBe("Auto")
    })
  })

  describe("formatBytes", () => {
    it("formats bytes correctly", () => {
      expect(formatBytes(500)).toBe("500 B")
    })
    it("formats KB correctly", () => {
      expect(formatBytes(1500)).toBe("1 KB")
    })
    it("formats MB correctly", () => {
      expect(formatBytes(1500000)).toBe("1.4 MB")
    })
  })

  describe("slotsForKind", () => {
    it("returns figure1, figure2 for figure", () => {
      expect(slotsForKind("figure")).toEqual(["figure1", "figure2"])
    })
    it("returns table for table", () => {
      expect(slotsForKind("table")).toEqual(["table"])
    })
    it("returns bullets for text", () => {
      expect(slotsForKind("text")).toEqual(["bullets"])
    })
  })
})
