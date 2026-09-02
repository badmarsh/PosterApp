import { describe, it, expect } from "vitest"
import { resolveBibSource } from "../latex/bib-source"

describe("resolveBibSource", () => {
  it("returns bibContent from workspace when no reference cards exist", () => {
    const result = resolveBibSource(
      { bibContent: "@article{smith2024, author={Smith}}" },
      []
    )
    expect(result).toBe("@article{smith2024, author={Smith}}")
  })

  it("returns reference card content when it contains BibTeX entries", () => {
    const result = resolveBibSource(
      { bibContent: "@article{fallback2024, author={Fallback}}" },
      [
        { pattern: "references", content: "@article{card2024, author={Card}}" },
      ]
    )
    expect(result).toBe("@article{card2024, author={Card}}")
  })

  it("falls back to workspace.bibContent when reference card has no BibTeX", () => {
    const result = resolveBibSource(
      { bibContent: "@article{fallback2024, author={Fallback}}" },
      [
        { pattern: "references", content: "Just plain text, no bib entries" },
      ]
    )
    // The plain text doesn't contain "@", so workspace.bibContent is used
    expect(result).toBe("@article{fallback2024, author={Fallback}}")
  })

  it("returns empty string when no bib source is available", () => {
    const result = resolveBibSource({}, [])
    expect(result).toBe("")
  })

  it("returns empty string when bibContent is null and no ref cards", () => {
    const result = resolveBibSource({ bibContent: null }, undefined)
    expect(result).toBe("")
  })

  it("joins multiple reference cards with bib entries", () => {
    const result = resolveBibSource(
      { bibContent: "@article{fallback2024, author={Fallback}}" },
      [
        { pattern: "references", content: "@article{first2024, author={First}}" },
        { pattern: "references", content: "@article{second2024, author={Second}}" },
      ]
    )
    expect(result).toContain("@article{first2024, author={First}}")
    expect(result).toContain("@article{second2024, author={Second}}")
  })

  it("prefers reference cards over workspace bibContent even when bibContent is empty", () => {
    const result = resolveBibSource(
      { bibContent: "" },
      [
        { pattern: "references", content: "@article{card2024, author={Card}}" },
      ]
    )
    expect(result).toBe("@article{card2024, author={Card}}")
  })

  it("ignores cards that are not references pattern", () => {
    const result = resolveBibSource(
      { bibContent: "@article{work2024, author={Work}}" },
      [
        { pattern: "bullets", content: "@article{shouldNotBeUsed2024, author={Nope}}" },
        { pattern: "references", content: "@article{ref2024, author={Ref}}" },
      ]
    )
    expect(result).toBe("@article{ref2024, author={Ref}}")
  })

  it("handles empty outputCards array", () => {
    const result = resolveBibSource(
      { bibContent: "@article{work2024, author={Work}}" },
      []
    )
    expect(result).toBe("@article{work2024, author={Work}}")
  })

  it("handles undefined outputCards gracefully", () => {
    const result = resolveBibSource(
      { bibContent: "@article{work2024, author={Work}}" },
      undefined
    )
    expect(result).toBe("@article{work2024, author={Work}}")
  })
})