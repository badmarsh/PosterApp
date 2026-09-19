import { describe, it, expect } from "vitest"
import { extractNumericalData, verifyNumericalConsistency } from "../numerical-verifier"
import { extractSymbolsFromFormula, checkEquationSanity } from "../equation-consistency"

describe("Numerical Verifier", () => {
  it("extracts parameters, values, and units from prose", () => {
    const text = "Dosiahli sme accuracy = 94.5% pri testovaní, pričom p < 0.05 a energia bola 13 TeV."
    const data = extractNumericalData(text)
    expect(data.length).toBeGreaterThanOrEqual(2)
    const acc = data.find((d) => d.parameter === "accuracy")
    expect(acc).toBeDefined()
    expect(acc?.value).toBe(94.5)
    expect(acc?.unit).toBe("%")
  })

  it("flags discrepancies between inline text and tables", () => {
    const inline = "Our model achieved accuracy = 98.2% on the benchmark dataset."
    const tables = [
      { content: "| Model | Accuracy | F1 |\n| Baseline | 91.0% | 0.89 |\n| Ours | accuracy = 92.4% | 0.91 |" }
    ]
    const res = verifyNumericalConsistency(inline, tables)
    expect(res.isConsistent).toBe(false)
    expect(res.discrepancies.length).toBe(1)
    expect(res.discrepancies[0].inlineClaim.value).toBe(98.2)
    expect(res.discrepancies[0].tableOrEquationEvidence.value).toBe(92.4)
    expect(res.discrepancies[0].severity).toBe("moderate")
  })
})

describe("Equation Consistency", () => {
  it("extracts symbols from LaTeX equation", () => {
    const formula = "E = m c^2 + \\alpha \\Delta"
    const symbols = extractSymbolsFromFormula(formula)
    expect(symbols).toContain("m")
    expect(symbols).toContain("\\alpha")
    expect(symbols).toContain("\\Delta")
  })

  it("flags out-of-bounds probabilities", () => {
    const formula = "P(A) = 1.45"
    const prose = "kde P(A) označuje pravdepodobnosť javu A"
    const res = checkEquationSanity(formula, prose)
    expect(res.isValid).toBe(false)
    expect(res.rangeViolations.length).toBe(1)
    expect(res.rangeViolations[0]).toContain("out of valid bounds")
  })
})
