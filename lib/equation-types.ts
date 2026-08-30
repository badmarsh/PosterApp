/**
 * Equation Registry types and helper utilities.
 */

export type EquationItem = {
  id: string
  key: string
  formula: string
  name: string
  description?: string
  contextSnippet?: string
  section?: string
  page?: number
  fileId?: string
  workspaceId: string
  createdAt?: string
}

/**
 * Clean a LaTeX formula string by removing surrounding display delimiters ($$, \[, \]).
 */
export function cleanFormula(raw: string): string {
  if (!raw) return ""
  return raw
    .replace(/^\s*\$\$\s*/, "")
    .replace(/\s*\$\$\s*$/, "")
    .replace(/^\s*\\\[\s*/, "")
    .replace(/\s*\\\]\s*$/, "")
    .replace(/^\s*\\begin\{(?:equation|align|gather|multline)\*?\s*\}\s*/, "")
    .replace(/\s*\\end\{(?:equation|align|gather|multline)\*?\s*\}\s*$/, "")
    .trim()
}

/**
 * Convert a descriptive equation title into a standard LaTeX label / key (e.g. "eq:gain_variance").
 */
export function slugifyEquationKey(name: string, fallbackIndex = 1): string {
  if (!name || !name.trim()) return `eq:${fallbackIndex}`
  
  const clean = name
    .toLowerCase()
    .replace(/^equation\s*(?:\([^)]*\)|\d+(?:\.\d+)*)?:?\s*/i, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
    .replace(/_+$/, "")

  return clean ? `eq:${clean}` : `eq:${fallbackIndex}`
}

/**
 * Format an equation for insertion into markdown/LaTeX card content.
 */
export function formatEquationForInsertion(
  formula: string,
  format: "display" | "inline" = "display"
): string {
  const cleaned = cleanFormula(formula)
  if (format === "inline") {
    return `$${cleaned}$`
  }
  return `$$\n${cleaned}\n$$`
}

/**
 * Detects whether a string is a genuine mathematical formula or a false positive
 * (e.g. HTML snippet, JavaScript payload, XML, SQL query, or raw prose wrapped in array).
 */
export function isLikelyMathematicalFormula(raw: string): boolean {
  if (!raw || raw.trim().length < 3) return false
  const clean = cleanFormula(raw)

  // 1. Hard-reject HTML / code snippets / XSS payloads / scripts
  if (/<\s*(?:script|div|span|html|body|table|tr|td|br|input|form|a|style|iframe|img|svg|meta|link)\b/i.test(clean)) {
    return false
  }
  if (/\b(?:alert\(|document\.cookie|window\.location|console\.log|SELECT\s+.+\s+FROM\s+|INSERT\s+INTO\s+|DROP\s+TABLE\b)/i.test(clean)) {
    return false
  }
  if (/(?:function\s*\(|class\s+\w+\s*\{|var\s+\w+\s*=|const\s+\w+\s*=|let\s+\w+\s*=)/.test(clean)) {
    return false
  }

  // 2. Must contain mathematical operators, greek letters, calculus, fractions, or algebraic structures
  const hasMathTokens = /(?:[=+\-*/^_{}\\]|\\frac|\\sum|\\int|\\prod|\\partial|\\sqrt|\\alpha|\\beta|\\gamma|\\theta|\\sigma|\\lambda|\\mu|\\omega|\\Delta|\\nabla|\\times|\\cdot|\\le|\\ge|\\ne|\\approx|\\in|\\to|\\pm|\\mathbf|\\mathcal|\\mathbb|\b[a-zA-Z]\s*=\s*|\b\d+\s*[\+\-\*\/=]\s*)/i.test(clean)
  if (!hasMathTokens) {
    return false
  }

  // 3. Reject if text is > 75% natural language words wrapped in \text{}
  const textMatches = clean.match(/\\text\s*\{([^}]+)\}/g)
  if (textMatches) {
    const textChars = textMatches.reduce((acc, m) => acc + m.length, 0)
    if (textChars > clean.length * 0.75 && clean.length > 50) {
      return false
    }
  }

  return true
}
