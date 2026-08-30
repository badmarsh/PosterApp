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
