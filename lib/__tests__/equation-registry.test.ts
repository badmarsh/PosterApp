import { describe, it, expect } from "vitest"
import { cleanFormula, slugifyEquationKey, formatEquationForInsertion } from "@/lib/equation-types"
import { validateEquationKaTeX } from "@/lib/services/equation-service"

describe("Equation Registry Utilities", () => {
  describe("cleanFormula", () => {
    it("strips double dollar delimiters", () => {
      expect(cleanFormula("$$ E = mc^2 $$")).toBe("E = mc^2")
      expect(cleanFormula("$$\n\\beta = \\frac{v}{c}\n$$")).toBe("\\beta = \\frac{v}{c}")
    })

    it("strips bracket delimiters", () => {
      expect(cleanFormula("\\[ \\nabla \\times \\mathbf{B} = \\mu_0 \\mathbf{J} \\]")).toBe(
        "\\nabla \\times \\mathbf{B} = \\mu_0 \\mathbf{J}"
      )
    })

    it("strips equation and align environments", () => {
      expect(cleanFormula("\\begin{equation} F = ma \\end{equation}")).toBe("F = ma")
      expect(cleanFormula("\\begin{align*} a^2 + b^2 = c^2 \\end{align*}")).toBe("a^2 + b^2 = c^2")
    })

    it("handles plain formulas gracefully", () => {
      expect(cleanFormula("H |\\psi\\rangle = E |\\psi\\rangle")).toBe("H |\\psi\\rangle = E |\\psi\\rangle")
      expect(cleanFormula("")).toBe("")
    })
  })

  describe("slugifyEquationKey", () => {
    it("generates a clean eq: key from a title", () => {
      expect(slugifyEquationKey("Relative Gain Variance")).toBe("eq:relative_gain_variance")
      expect(slugifyEquationKey("Equation (2.1) PMT Anode Current")).toBe("eq:pmt_anode_current")
      expect(slugifyEquationKey("Bragg Peak Energy Deposition")).toBe("eq:bragg_peak_energy_deposition")
    })

    it("falls back to index if title is empty or generic", () => {
      expect(slugifyEquationKey("", 4)).toBe("eq:4")
      expect(slugifyEquationKey("   ", 2)).toBe("eq:2")
    })
  })

  describe("formatEquationForInsertion", () => {
    it("formats display math correctly", () => {
      expect(formatEquationForInsertion("E = mc^2", "display")).toBe("$$\nE = mc^2\n$$")
      expect(formatEquationForInsertion("$$ E = mc^2 $$", "display")).toBe("$$\nE = mc^2\n$$")
    })

    it("formats inline math correctly", () => {
      expect(formatEquationForInsertion("E = mc^2", "inline")).toBe("$E = mc^2$")
      expect(formatEquationForInsertion("$$ \\hbar \\omega $$", "inline")).toBe("$\\hbar \\omega$")
    })
  })

  describe("validateEquationKaTeX", () => {
    it("validates well-formed mathematical LaTeX", () => {
      const valid = validateEquationKaTeX("I_C = I_S \\left( e^{\\frac{V_{BE}}{V_T}} - 1 \\right)")
      expect(valid.valid).toBe(true)
      expect(valid.html).toBeDefined()
      expect(valid.error).toBeUndefined()
    })

    it("detects syntax errors in malformed formulas", () => {
      const invalid = validateEquationKaTeX("\\frac{numerator}{") // unclosed brace
      expect(invalid.valid).toBe(false)
      expect(invalid.error).toBeDefined()
    })

    it("rejects empty formulas", () => {
      const empty = validateEquationKaTeX("   ")
      expect(empty.valid).toBe(false)
      expect(empty.error).toBe("Formula is empty")
    })
  })
})
