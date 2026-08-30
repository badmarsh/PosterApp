/**
 * Structured BibTeX types and parsing helpers for PosterApp
 */

export interface BibEntry {
  id: string
  key: string
  type: "article" | "inproceedings" | "book" | "techreport" | "misc" | "phdthesis" | "mastersthesis" | "unpublished" | string
  title: string
  authors: string[]
  authorString: string
  year?: string
  journal?: string
  booktitle?: string
  publisher?: string
  volume?: string
  number?: string
  pages?: string
  doi?: string
  url?: string
  eprint?: string
  archivePrefix?: string
  primaryClass?: string
  abstract?: string
  rawBibtex: string
}

export function cleanBibValue(val: string): string {
  if (!val) return ""
  let cleaned = val.trim()
  // Remove wrapping braces or quotes
  if ((cleaned.startsWith("{") && cleaned.endsWith("}")) || (cleaned.startsWith('"') && cleaned.endsWith('"'))) {
    cleaned = cleaned.slice(1, -1).trim()
  }
  // Remove trailing commas if present
  cleaned = cleaned.replace(/,\s*$/, "").trim()
  return cleaned
}

/**
 * Parse raw BibTeX string into structured BibEntry array.
 */
export function parseBibEntries(bib: string): BibEntry[] {
  if (!bib || typeof bib !== "string") return []

  const entries: BibEntry[] = []
  // Split entries by top-level @
  const rawChunks = bib.split(/(?=@\w+\s*\{)/)

  for (const chunk of rawChunks) {
    const trimmed = chunk.trim()
    if (!trimmed.startsWith("@")) continue

    const headerMatch = /^@(\w+)\s*\{\s*([^,]+),([\s\S]*)$/.exec(trimmed)
    if (!headerMatch) continue

    const type = headerMatch[1].toLowerCase()
    const key = headerMatch[2].trim()
    const body = headerMatch[3].replace(/\}\s*$/, "") // remove trailing closing brace

    const fields: Record<string, string> = {}
    // Extract key = {value} or key = "value" or key = value
    const fieldPattern = /([a-zA-Z_-]+)\s*=\s*(?:\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}|"([^"]*)"|([^,}\n]+))/g
    let match: RegExpExecArray | null
    while ((match = fieldPattern.exec(body)) !== null) {
      const fieldName = match[1].toLowerCase().trim()
      const rawVal = match[2] ?? match[3] ?? match[4] ?? ""
      fields[fieldName] = cleanBibValue(rawVal)
    }

    const title = fields.title || key
    const authorRaw = fields.author || ""
    const authors = authorRaw
      ? authorRaw.split(/\s+and\s+/i).map((a) => a.trim().replace(/^\{+|\}+$/g, "")).filter(Boolean)
      : []

    entries.push({
      id: key,
      key,
      type,
      title,
      authors,
      authorString: authors.join(", ") || authorRaw,
      year: fields.year || undefined,
      journal: fields.journal || undefined,
      booktitle: fields.booktitle || undefined,
      publisher: fields.publisher || undefined,
      volume: fields.volume || undefined,
      number: fields.number || undefined,
      pages: fields.pages || undefined,
      doi: fields.doi || undefined,
      url: fields.url || undefined,
      eprint: fields.eprint || undefined,
      archivePrefix: fields.archiveprefix || undefined,
      primaryClass: fields.primaryclass || undefined,
      abstract: fields.abstract || undefined,
      rawBibtex: trimmed,
    })
  }

  return entries
}

/**
 * Format a BibEntry object into standard BibTeX string.
 */
export function formatBibEntry(entry: Partial<BibEntry>): string {
  const type = entry.type || "article"
  const key = entry.key || slugifyCiteKey(entry.authors?.[0] || "Author", entry.year, entry.title)

  const lines: string[] = [`@${type}{${key},`]
  if (entry.authorString || (entry.authors && entry.authors.length > 0)) {
    lines.push(`  author = {${entry.authorString || entry.authors?.join(" and ")}},`)
  }
  if (entry.title) {
    lines.push(`  title = {${entry.title}},`)
  }
  if (entry.journal) {
    lines.push(`  journal = {${entry.journal}},`)
  }
  if (entry.booktitle) {
    lines.push(`  booktitle = {${entry.booktitle}},`)
  }
  if (entry.publisher) {
    lines.push(`  publisher = {${entry.publisher}},`)
  }
  if (entry.volume) {
    lines.push(`  volume = {${entry.volume}},`)
  }
  if (entry.number) {
    lines.push(`  number = {${entry.number}},`)
  }
  if (entry.pages) {
    lines.push(`  pages = {${entry.pages}},`)
  }
  if (entry.year) {
    lines.push(`  year = {${entry.year}},`)
  }
  if (entry.doi) {
    lines.push(`  doi = {${entry.doi}},`)
  }
  if (entry.url) {
    lines.push(`  url = {${entry.url}},`)
  }
  if (entry.eprint) {
    lines.push(`  eprint = {${entry.eprint}},`)
  }
  if (entry.archivePrefix) {
    lines.push(`  archivePrefix = {${entry.archivePrefix}},`)
  }
  if (entry.primaryClass) {
    lines.push(`  primaryClass = {${entry.primaryClass}},`)
  }

  // Remove trailing comma from last field line
  if (lines.length > 1) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, "")
  }
  lines.push("}")

  return lines.join("\n")
}

/**
 * Generate a clean cite key slug from author, year, and title.
 */
export function slugifyCiteKey(author?: string, year?: string, title?: string): string {
  const authorSlug = (author || "ref")
    .split(/[\s,]+/)[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
  const yearSlug = year ? year.replace(/[^0-9]/g, "") : new Date().getFullYear().toString()
  const titleSlug = (title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .slice(0, 2)
    .join("_")

  const base = `${authorSlug}${yearSlug}${titleSlug ? `_${titleSlug}` : ""}`
  return base || `ref_${Date.now().toString(36)}`
}
