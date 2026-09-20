/**
 * Equation Consistency and Parameter Range Checker (Phase 16)
 *
 * Uses regex-based extraction (not AST parsing) to verify consistency of
 * mathematical equations in scientific dissertations:
 *   - Extracts distinct single-letter and LaTeX Greek symbols from formulas via regex
 *   - Checks whether variables used in formulas are defined or explained in the surrounding prose
 *   - Detects physically or mathematically impossible ranges (e.g. negative probabilities, probabilities > 1)
 */

export interface ExtractedEquationVariable {
  symbol: string
  contextSnippet?: string
  isDefinedInProse: boolean
}

export interface EquationValidationResult {
  formula: string
  declaredSymbols: string[]
  undefinedSymbols: string[]
  rangeViolations: string[]
  isValid: boolean
}

const COMMON_MATH_SYMBOLS = new Set([
  "\\alpha", "\\beta", "\\gamma", "\\delta", "\\epsilon", "\\eta", "\\theta", "\\lambda",
  "\\mu", "\\nu", "\\pi", "\\rho", "\\sigma", "\\tau", "\\phi", "\\chi", "\\psi", "\\omega",
  "\\Delta", "\\Gamma", "\\Theta", "\\Lambda", "\\Sigma", "\\Phi", "\\Psi", "\\Omega",
  "\\sum", "\\prod", "\\int", "\\partial", "\\infty", "\\sqrt", "\\nabla"
])

/**
 * Extracts distinct single-letter and LaTeX Greek symbols from a formula.
 */
export function extractSymbolsFromFormula(formula: string): string[] {
  const clean = formula.replace(/\\[a-zA-Z]+/g, (m) => (COMMON_MATH_SYMBOLS.has(m) ? ` ${m} ` : " "))
  const latinMatches = Array.from(new Set(clean.match(/[a-zA-Z]/g) ?? []))
  const greekMatches = Array.from(COMMON_MATH_SYMBOLS).filter((sym) => formula.includes(sym))

  const unique = Array.from(new Set([...latinMatches, ...greekMatches]))
  return unique.filter((s) => !["e", "d"].includes(s)) // Exclude common calculus markers
}

/**
 * Checks if a formula has out-of-bound probabilities or ranges in prose context.
 */
export function checkEquationSanity(formula: string, surroundingProse: string): EquationValidationResult {
  const symbols = extractSymbolsFromFormula(formula)
  const undefinedSymbols: string[] = []
  const rangeViolations: string[] = []

  const lowerProse = surroundingProse.toLowerCase()

  for (const sym of symbols) {
    const cleanSym = sym.startsWith("\\") ? sym.slice(1).toLowerCase() : sym.toLowerCase()
    // Look for symbol introduction patterns like "kde x je", "where x denotes", "symbol x represents"
    const defPattern = new RegExp(`(?:kde|where|symbol|parameter|variable|hodnota|označuje|denotes|represents)\\s+[^.]*\\b${cleanSym}\\b`, "i")
    const isDefined = defPattern.test(lowerProse) || lowerProse.includes(`${cleanSym} =`) || lowerProse.includes(`${cleanSym} je`)

    if (!isDefined && symbols.length < 8) {
      // For short concise equations, flag symbols not explained in text
      undefinedSymbols.push(sym)
    }
  }

  // Probability bounds sanity check: p in [0, 1]
  const probMatch = formula.match(/(?:P|p|prob)\s*(?:\([^)]+\))?\s*=\s*([-0-9.]+)/i)
  if (probMatch) {
    const val = parseFloat(probMatch[1])
    if (!Number.isNaN(val)) {
      if (val < 0 || val > 1) {
        rangeViolations.push(`Probability value ${val} out of valid bounds [0, 1].`)
      }
    }
  }

  return {
    formula,
    declaredSymbols: symbols,
    undefinedSymbols,
    rangeViolations,
    isValid: rangeViolations.length === 0,
  }
}
