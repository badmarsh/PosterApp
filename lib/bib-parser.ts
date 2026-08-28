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

/**
 * Extract cite keys used in text, like \cite{Author2020} or \cite{Author2020,Other2021}
 */
export function extractCiteKeys(text: string): string[] {
  if (!text) return []
  const keys = new Set<string>()

  // Match \cite{key1, key2}
  const regexLatex = /\\cite{([^}]+)}/g
  let match
  while ((match = regexLatex.exec(text)) !== null) {
    const splitKeys = match[1].split(",").map(k => k.trim())
    for (const k of splitKeys) {
      if (k) keys.add(k)
    }
  }

  // Match [@key1, @key2] or [@key]
  const regexMarkdown = /\[@([^\]]+)\]/g
  while ((match = regexMarkdown.exec(text)) !== null) {
    const splitKeys = match[1].split(",").map(k => k.trim().replace(/^@/, ""))
    for (const k of splitKeys) {
      if (k) keys.add(k)
    }
  }

  return Array.from(keys)
}
