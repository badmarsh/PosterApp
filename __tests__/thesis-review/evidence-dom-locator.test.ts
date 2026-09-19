import { describe, it, expect, vi } from "vitest"
import {
  normalizeText,
  extractQuoteMatchCandidates,
  locateAndHighlightEvidence,
  clearEvidenceHighlights,
} from "@/lib/thesis-review/evidence-dom-locator"

describe("evidence-dom-locator", () => {
  it("normalizes text by folding whitespace and diacritics", () => {
    expect(normalizeText("  Výsledky   merania  \n")).toBe("vysledky merania")
    expect(normalizeText("Bose-Einstein")).toBe("bose-einstein")
  })

  it("extracts candidates and phrases from LaTeX-heavy quotes", () => {
    const rawQuote = "Results of fits of $R _ { 2 } ( Q )$ using the opposite hemisphere reference sample [2]"
    const candidates = extractQuoteMatchCandidates(rawQuote)

    expect(candidates.full).toBe(rawQuote)
    expect(candidates.cleaned).toBe("Results of fits of using the opposite hemisphere reference sample")
    expect(candidates.phrases).toContain("using the opposite hemisphere reference sample")
    expect(candidates.keywords).toContain("results")
    expect(candidates.keywords).toContain("fits")
    expect(candidates.keywords).toContain("opposite")
    expect(candidates.keywords).toContain("hemisphere")
    expect(candidates.keywords).toContain("reference")
    expect(candidates.keywords).toContain("sample")
  })

  it("extracts clean candidate phrases from multi-line text", () => {
    const raw = "The ATLAS detector has recorded\n7 TeV proton-proton collisions with high precision."
    const candidates = extractQuoteMatchCandidates(raw)
    expect(candidates.cleaned).toContain("The ATLAS detector has recorded 7 TeV proton-proton collisions with high precision.")
    expect(candidates.phrases.length).toBeGreaterThan(0)
  })

  describe("locateAndHighlightEvidence mock matching", () => {
    it("finds matching block using candidates and invokes scrollIntoView", () => {
      const scrollIntoViewMock = vi.fn()
      const classListAdd = vi.fn()
      const classListRemove = vi.fn()
      const setAttribute = vi.fn()

      const block1 = {
        tagName: "DIV",
        textContent: "Úvod do problematiky kvantovej optiky.",
        classList: { add: vi.fn(), remove: vi.fn(), contains: () => false },
        setAttribute: vi.fn(),
        removeAttribute: vi.fn(),
        scrollIntoView: vi.fn(),
      }
      const block2 = {
        tagName: "DIV",
        textContent: "Results of fits of R 2 ( Q ) using the opposite hemisphere reference sample [2] are summarized.",
        classList: { add: classListAdd, remove: classListRemove, contains: () => true },
        setAttribute,
        removeAttribute: vi.fn(),
        scrollIntoView: scrollIntoViewMock,
      }

      const mockContainer = {
        querySelectorAll: (selector: string) => {
          if (selector.includes("mark")) return []
          if (selector.includes("evidence-block-matched")) return []
          return [block1, block2]
        },
      } as unknown as HTMLElement

      const rawQuote = "Results of fits of $R _ { 2 } ( Q )$ using the opposite hemisphere reference sample [2]"
      const result = locateAndHighlightEvidence(mockContainer, rawQuote)

      expect(result).toBe(block2)
      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth", block: "center" })
      expect(setAttribute).toHaveBeenCalledWith("data-evidence-match", "true")
      expect(classListAdd).toHaveBeenCalled()
    })

    it("falls back to section heading if no paragraph text matches", () => {
      const scrollIntoViewMock = vi.fn()
      const h2Block = {
        tagName: "H2",
        textContent: "4. Results of fits",
        classList: { add: vi.fn(), remove: vi.fn(), contains: () => true },
        setAttribute: vi.fn(),
        removeAttribute: vi.fn(),
        scrollIntoView: scrollIntoViewMock,
      }
      const pBlock = {
        tagName: "DIV",
        textContent: "Completely unrelated content here.",
        classList: { add: vi.fn(), remove: vi.fn(), contains: () => false },
        setAttribute: vi.fn(),
        removeAttribute: vi.fn(),
        scrollIntoView: vi.fn(),
      }

      const mockContainer = {
        querySelectorAll: (selector: string) => {
          if (selector.includes("mark")) return []
          if (selector.includes("evidence-block-matched")) return []
          return [pBlock, h2Block]
        },
      } as unknown as HTMLElement

      const result = locateAndHighlightEvidence(mockContainer, "Some text that does not exist", "4. Results of fits")
      expect(result).toBe(h2Block)
      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: "smooth", block: "center" })
    })
  })
})
