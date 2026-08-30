/**
 * Thesis-specific RAG context loader.
 *
 * Extends the generic `loadSourceContext` with section-aware keyword routing:
 * instead of dumping all sources into the prompt, it selects the most relevant
 * excerpt for each thesis criterion being generated.
 *
 * Section routing map (keyword → section IDs):
 *   methodology   → "methodology", "methods", "postup", "metodológia"
 *   results       → "results", "výsledky", "experiments", "evaluation"
 *   citations     → "references", "literatúra", "bibliography"
 *   formal        → full doc (structure audit)
 *   originality   → "conclusion", "záver", "discussion", "diskusia"
 *   language      → full doc (sampled)
 */

import * as fs from "fs"
import * as path from "path"
import type { ThesisMetadata, ReviewLanguage } from "./thesis-rubric"

const WORKSPACES_DIR = path.join(process.cwd(), "workspaces")

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThesisRAGContext {
  fullText: string
  sections: Record<string, string>
  referencesTitles: string[]
  totalChars: number
}

// ---------------------------------------------------------------------------
// Section keyword maps
// ---------------------------------------------------------------------------

const SECTION_KEYWORDS: Record<string, string[]> = {
  methodology: ["method", "metod", "approach", "prístup", "postup", "design", "implement", "algorithm"],
  results: ["result", "výsledok", "výsledky", "experiment", "evaluation", "hodnotenie", "measure", "performance"],
  discussion: ["discussion", "diskusia", "comparison", "porovnanie", "limitation", "obmedzenie", "future"],
  conclusion: ["conclusion", "záver", "summary", "zhrnutie", "contribution", "prínos"],
  introduction: ["introduction", "úvod", "background", "motivation", "related work"],
  references: ["reference", "literatúra", "bibliography", "zoznam literatúry", "sources"],
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Split markdown into rough sections by heading lines.
 * Returns a map of section-name → content.
 */
function splitIntoSections(markdown: string): Record<string, string> {
  const lines = markdown.split("\n")
  const sections: Record<string, string> = {}
  let currentKey = "_preamble"
  let buffer: string[] = []

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)/)
    if (headingMatch) {
      if (buffer.length > 0) {
        sections[currentKey] = (sections[currentKey] ?? "") + buffer.join("\n")
        buffer = []
      }
      currentKey = headingMatch[1].trim().toLowerCase()
    }
    buffer.push(line)
  }
  if (buffer.length > 0) {
    sections[currentKey] = (sections[currentKey] ?? "") + buffer.join("\n")
  }

  return sections
}

/**
 * Return the portion of the document most relevant to a given criterion.
 */
function routeSectionForCriterion(
  criterionId: string,
  docSections: Record<string, string>,
  maxChars = 8_000
): string {
  // Map criterion → relevant section keyword group
  const criterionToGroup: Record<string, string> = {
    methodology: "methodology",
    results: "results",
    originality: "conclusion",
    citations_bibliography: "references",
    goal_definition: "introduction",
    formal_structure: "_preamble",
    language_quality: "_preamble",
    defense_questions: "methodology",
  }

  const group = criterionToGroup[criterionId] ?? "_preamble"
  const keywords = SECTION_KEYWORDS[group] ?? []

  // Find doc sections whose heading matches keywords
  let matched = ""
  for (const [heading, content] of Object.entries(docSections)) {
    const headingLow = heading.toLowerCase()
    if (keywords.some((kw) => headingLow.includes(kw))) {
      matched += content + "\n\n"
      if (matched.length >= maxChars) break
    }
  }

  // Fallback: return the beginning of the full document
  if (!matched) {
    const allText = Object.values(docSections).join("\n\n")
    return allText.slice(0, maxChars)
  }

  return matched.slice(0, maxChars)
}

/**
 * Extract likely reference titles from a references section.
 * Looks for numbered/bulleted lines typical of bibliography entries.
 */
function extractReferenceTitles(referencesText: string): string[] {
  const lines = referencesText.split("\n")
  const titles: string[] = []

  for (const line of lines) {
    const trimmed = line.replace(/^\s*[\[\(]?\d+[\]\).]?\s*/, "").trim()
    // Keep lines that look like a citation (at least 20 chars, contains comma or period)
    if (trimmed.length > 20 && (trimmed.includes(",") || trimmed.includes("."))) {
      // Extract the title portion (typically before the first period or comma-year pattern)
      const titleMatch = trimmed.match(/^(.+?)[,.]?\s*(?:In:|(?:19|20)\d{2}|pp?\.|Vol\.|doi:)/i)
      const extracted = titleMatch ? titleMatch[1].trim() : trimmed.slice(0, 100)
      if (extracted.length > 10) titles.push(extracted)
      if (titles.length >= 30) break
    }
  }

  return titles
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load and parse the thesis document for RAG-augmented review generation.
 *
 * Returns:
 *  - `fullText`: complete concatenated source (capped at `maxChars`)
 *  - `sections`: heading-keyed map of document sections
 *  - `referencesTitles`: extracted reference titles (for citation audit)
 *  - `totalChars`: total characters loaded
 */
export async function loadThesisContext(options: {
  workspaceId: string
  thesisMetadata: ThesisMetadata
  focusSections?: string[]
  maxChars?: number
}): Promise<ThesisRAGContext> {
  const { workspaceId, maxChars = 80_000 } = options
  const sourcesDir = path.join(WORKSPACES_DIR, workspaceId, "sources")

  if (!fs.existsSync(sourcesDir)) {
    return { fullText: "", sections: {}, referencesTitles: [], totalChars: 0 }
  }

  const files = await fs.promises.readdir(sourcesDir)
  const mdFiles = files.filter((f) => f.endsWith(".md")).sort()

  let fullText = ""
  const mergedSections: Record<string, string> = {}

  for (const file of mdFiles) {
    const content = await fs.promises.readFile(path.join(sourcesDir, file), "utf-8")
    const chunk = `\n\n--- Source: ${file} ---\n\n${content}`
    if (fullText.length + chunk.length > maxChars) {
      const remaining = maxChars - fullText.length
      if (remaining > 500) fullText += chunk.slice(0, remaining)
      break
    }
    fullText += chunk

    // Merge section maps
    const fileSections = splitIntoSections(content)
    for (const [k, v] of Object.entries(fileSections)) {
      mergedSections[k] = (mergedSections[k] ?? "") + "\n\n" + v
    }
  }

  // Extract reference titles from references sections
  const refText = Object.entries(mergedSections)
    .filter(([k]) => SECTION_KEYWORDS.references.some((kw) => k.includes(kw)))
    .map(([, v]) => v)
    .join("\n")
  const referencesTitles = extractReferenceTitles(refText)

  return {
    fullText: fullText.trim(),
    sections: mergedSections,
    referencesTitles,
    totalChars: fullText.length,
  }
}

/**
 * Build a focused context snippet for one thesis criterion.
 * Used in the per-section AI generation call.
 */
export function buildCriterionContext(
  criterionId: string,
  ragContext: ThesisRAGContext,
  maxChars = 8_000
): string {
  if (!ragContext.fullText) return "No thesis document available."
  return routeSectionForCriterion(criterionId, ragContext.sections, maxChars)
}

/**
 * Build the full context header (metadata block) for the AI prompt.
 */
export function buildThesisContextHeader(
  metadata: ThesisMetadata,
  lang: ReviewLanguage
): string {
  const labels: Record<ReviewLanguage, Record<string, string>> = {
    sk: {
      student: "Autor/autorka",
      title: "Názov práce",
      type: "Typ práce",
      reviewer: "Hodnotiteľ/ka",
      role: "Rola hodnotiteľa",
      inst: "Inštitúcia",
    },
    cs: {
      student: "Autor/autorka",
      title: "Název práce",
      type: "Typ práce",
      reviewer: "Hodnotitel/ka",
      role: "Role hodnotitele",
      inst: "Instituce",
    },
    en: {
      student: "Student",
      title: "Thesis title",
      type: "Thesis type",
      reviewer: "Reviewer",
      role: "Reviewer role",
      inst: "Institution",
    },
  }

  const l = labels[lang]
  const typeLabels: Record<string, Record<ReviewLanguage, string>> = {
    bachelor: { sk: "Bakalárska práca", cs: "Bakalářská práce", en: "Bachelor's thesis" },
    master: { sk: "Diplomová práca", cs: "Diplomová práce", en: "Master's thesis" },
    phd: { sk: "Dizertačná práca", cs: "Dizertační práce", en: "PhD dissertation" },
  }
  const roleLabels: Record<string, Record<ReviewLanguage, string>> = {
    supervisor: { sk: "Vedúci práce", cs: "Vedoucí práce", en: "Supervisor" },
    opponent: { sk: "Oponent", cs: "Oponent", en: "Opponent" },
  }

  return [
    `${l.student}: ${metadata.studentName}`,
    `${l.title}: ${metadata.thesisTitle}`,
    `${l.type}: ${typeLabels[metadata.thesisType]?.[lang] ?? metadata.thesisType}`,
    metadata.reviewerName ? `${l.reviewer}: ${metadata.reviewerName}` : null,
    `${l.role}: ${roleLabels[metadata.reviewerRole]?.[lang] ?? metadata.reviewerRole}`,
    metadata.institution ? `${l.inst}: ${metadata.institution}` : null,
  ]
    .filter(Boolean)
    .join("\n")
}
