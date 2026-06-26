/**
 * Lightweight .bib parsing helpers for PosterApp.
 * No external dependencies — uses a simple regex to extract cite keys.
 */

/**
 * Parse all cite keys from a BibTeX string.
 * Matches entries like @article{KEY, or @techreport{KEY,
 */
export function parseBibKeys(bib: string): string[] {
  const pattern = /@\w+\{([^,]+),/g
  const keys: string[] = []
  let match: RegExpExecArray | null
  while ((match = pattern.exec(bib)) !== null) {
    const key = match[1].trim()
    if (key) keys.push(key)
  }
  return keys
}

/**
 * Format a cite key as a LaTeX \cite{} command.
 */
export function formatCiteKey(key: string): string {
  return `\\cite{${key}}`
}
