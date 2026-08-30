import { describe, it, expect } from "vitest"
import { parseArxivId, resolvePdfUrl } from "../services/arxiv-service"

describe("arxiv-service", () => {
  describe("parseArxivId", () => {
    it("extracts ID from standard format", () => {
      expect(parseArxivId("2301.12345")).toBe("2301.12345")
    })

    it("extracts ID with version suffix", () => {
      expect(parseArxivId("2301.12345v2")).toBe("2301.12345v2")
    })

    it("extracts ID from full arXiv abstract URL", () => {
      expect(parseArxivId("https://arxiv.org/abs/2301.12345")).toBe("2301.12345")
    })

    it("extracts ID from full arXiv PDF URL", () => {
      expect(parseArxivId("https://arxiv.org/pdf/2301.12345.pdf")).toBe("2301.12345")
    })

    it("returns null for non-arXiv strings", () => {
      expect(parseArxivId("https://google.com")).toBeNull()
    })
  })

  describe("resolvePdfUrl", () => {
    it("resolves arXiv URL to direct PDF and clean filename", () => {
      const resolved = resolvePdfUrl("https://arxiv.org/abs/2301.12345")
      expect(resolved.arxivId).toBe("2301.12345")
      expect(resolved.pdfUrl).toBe("https://arxiv.org/pdf/2301.12345.pdf")
      expect(resolved.filename).toBe("arxiv_2301_12345.pdf")
    })

    it("handles direct PDF URL", () => {
      const resolved = resolvePdfUrl("https://example.com/papers/my_study.pdf")
      expect(resolved.pdfUrl).toBe("https://example.com/papers/my_study.pdf")
      expect(resolved.filename).toBe("my_study.pdf")
    })
  })
})
