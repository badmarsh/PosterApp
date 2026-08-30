/**
 * Thesis-specific RAG context loader and section routing engine.
 *
 * Extends the generic source context with section-aware, scored keyword routing:
 * instead of dumping a raw document prefix into the prompt, it parses ordered
 * hierarchical sections from Markdown sources, classifies section semantics,
 * and routes evidence-rich excerpts tailored to each thesis evaluation criterion.
 */

import * as fs from "fs"
import * as path from "path"
import type { ThesisMetadata, ReviewLanguage } from "./thesis-rubric"

const WORKSPACES_DIR = path.join(process.cwd(), "workspaces")

// ---------------------------------------------------------------------------
// Context Budgets
// ---------------------------------------------------------------------------

export const THESIS_CONTEXT_BUDGETS = {
  fullGeneration: 60_000,
  metadata: 2_000,
  citationAudit: 8_000,
  perCriterion: 6_000,
  regeneration: 14_000,
} as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SectionKind =
  | "preamble"
  | "introduction"
  | "literature"
  | "methodology"
  | "results"
  | "discussion"
  | "conclusion"
  | "references"
  | "appendix"
  | "unknown"

export interface ThesisDocumentSection {
  id: string
  sourceFile: string
  heading: string
  normalizedHeading: string
  level: number
  startOffset: number
  content: string
  kind: SectionKind
}

export interface ExtractedReference {
  raw: string
  title?: string
  authors: string[]
  year?: number
  doi?: string
  arxivId?: string
  url?: string
  sourceType: "article" | "book" | "chapter" | "web" | "thesis" | "preprint" | "unknown"
  parseWarnings: string[]
}

export interface ThesisRAGContext {
  fullText: string
  sections: ThesisDocumentSection[]
  references: ExtractedReference[]
  referencesTitles: string[]
  totalChars: number
  truncated: boolean
  sourceFiles: string[]
}

export interface RoutedExcerpt {
  criterionId: string
  text: string
  sectionIds: string[]
  sourceFiles: string[]
  truncated: boolean
  evidenceAvailable: boolean
}

// ---------------------------------------------------------------------------
// Heading Normalization and Classification
// ---------------------------------------------------------------------------

/**
 * Normalize headings using Unicode decomposition (NFD) and diacritic removal.
 */
export function normalizeHeading(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("sk")
    .replace(/^\s*(?:chapter|kapitola|sekcia|section)?\s*\d+(?:\.\d+)*[.):\s-]*/i, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Classify a section based on its heading and content.
 */
export function classifySectionKind(heading: string, content: string = ""): SectionKind {
  const norm = normalizeHeading(heading)

  // Appendix check first
  if (/^(?:priloh[ay]|prilohy|appendix|appendices|dodatok|dodatky)\b/i.test(norm)) {
    return "appendix"
  }

  // References / Bibliography
  if (/^(?:zoznam literatury|zoznam pouzitej literatury|literatura|pouzita literatura|bibliografia|bibliography|references|literarni prehled)\b/i.test(norm)) {
    return "references"
  }

  // Preamble (Title, Abstrakt, Obsah, Podakovanie, etc.)
  if (/^(?:diplomov[ay]|bakalarsk[ay]|dizertacn[ay]|zaverecn[ay]|titul|titulny|abstrakt|abstract|anotacia|anotace|podakovanie|podekovani|acknowledg|cestne vyhlasenie|prohlaseni|declaration|obsah|table of contents|contents|zoznam skratiek|zoznam obrazkov|zoznam tabuliek|list of figures|list of tables)\b/i.test(norm)) {
    return "preamble"
  }

  // Introduction / Motivation / Goals
  if (/^(?:uvod|introduction|motivacia|motivation|ciele|ciel prace|problem statement|vymedzenie problematiky)\b/i.test(norm)) {
    return "introduction"
  }

  // Literature / State of the art
  if (/^(?:sucasny stav|soucasny stav|stav riesenia|stav problematiky|prehlad literatury|related work|state of the art|background|teoreticke vychodiska|teoreticka cast)\b/i.test(norm)) {
    return "literature"
  }

  // Methodology / Implementation / Architecture / Approach
  if (/^(?:metodika|metody|metodologia|methodology|methods|postup riesenia|prakticka cast|navrh|navrh riesenia|architecture|architektura|implementacia|implementace|implementation|system design|analyza a navrh|experimentalny setup|dataset)\b/i.test(norm)) {
    return "methodology"
  }

  // Results / Evaluation / Experiments
  if (/^(?:vysledky|vysledky a diskusia|vyhodnotenie|zhodnotenie|evaluation|experiments|experimentalne vysledky|results|merania|mereni|testovanie|testovani|performance|dosiahnute vysledky)\b/i.test(norm)) {
    return "results"
  }

  // Discussion
  if (/^(?:diskusia|diskuse|discussion|porovnanie|comparison|obmedzenia|limitations|kritika)\b/i.test(norm)) {
    return "discussion"
  }

  // Conclusion / Summary
  if (/^(?:zaver|zaver a buduci vyvoj|conclusion|conclusions|summary|zhrnutie|prinosy prace|buduci vyvoj|future work)\b/i.test(norm)) {
    return "conclusion"
  }

  // Check content snippet if heading is non-descriptive
  if (content.length > 50) {
    const startContent = normalizeHeading(content.slice(0, 200))
    if (startContent.includes("v tejto praci navrhujeme") || startContent.includes("tato praca sa zaobera") || startContent.includes("cielom tejto prace")) {
      return "introduction"
    }
  }

  return "unknown"
}

// ---------------------------------------------------------------------------
// Document Section Parsing
// ---------------------------------------------------------------------------

/**
 * Split markdown source into hierarchical, ordered sections.
 */
export function parseDocumentSections(markdown: string, sourceFile: string): ThesisDocumentSection[] {
  const lines = markdown.split(/\r?\n/)
  const sections: ThesisDocumentSection[] = []

  let currentHeading = "Preamble"
  let currentLevel = 1
  let currentKind: SectionKind = "preamble"
  let buffer: string[] = []
  let sectionIndex = 0
  let startOffset = 0
  let currentOffset = 0

  function flushSection() {
    const text = buffer.join("\n").trim()
    if (text.length > 0 || currentHeading !== "Preamble") {
      const normHeading = normalizeHeading(currentHeading)
      sections.push({
        id: `${sourceFile}#sec-${sectionIndex++}`,
        sourceFile,
        heading: currentHeading,
        normalizedHeading: normHeading,
        level: currentLevel,
        startOffset,
        content: text,
        kind: currentKind,
      })
    }
    buffer = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const nextLine = i + 1 < lines.length ? lines[i + 1] : ""

    // 1. ATX Heading (# Heading)
    const atxMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (atxMatch) {
      flushSection()
      currentLevel = atxMatch[1].length
      currentHeading = atxMatch[2].trim()
      currentKind = classifySectionKind(currentHeading, "")
      startOffset = currentOffset
      currentOffset += line.length + 1
      continue
    }

    // 2. Setext Heading (Heading\n=== or Heading\n---)
    if (nextLine && /^(?:={3,}|-{3,})$/.test(nextLine.trim()) && line.trim().length > 0 && !line.startsWith("#")) {
      flushSection()
      currentLevel = nextLine.trim().startsWith("=") ? 1 : 2
      currentHeading = line.trim()
      currentKind = classifySectionKind(currentHeading, "")
      startOffset = currentOffset
      currentOffset += line.length + nextLine.length + 2
      i++ // Skip underline line
      continue
    }

    // 3. Explicit numbered chapter line without markdown hash
    // e.g. "1. Úvod" or "Kapitola 3: Metodika"
    const numberedMatch = line.match(/^(?:Kapitola\s+\d+|Chapter\s+\d+|\d+(?:\.\d+)*)\s*[:.-]\s+([A-Z\p{Lu}].{2,60})$/u)
    if (numberedMatch && (buffer.length === 0 || buffer[buffer.length - 1] === "")) {
      flushSection()
      currentLevel = line.includes(".") && !line.startsWith("Kapitola") ? 2 : 1
      currentHeading = line.trim()
      currentKind = classifySectionKind(currentHeading, "")
      startOffset = currentOffset
      currentOffset += line.length + 1
      continue
    }

    buffer.push(line)
    currentOffset += line.length + 1
  }

  flushSection()

  // If no sections were parsed (no headings), treat entire text as single unknown section
  if (sections.length === 0 && markdown.trim().length > 0) {
    sections.push({
      id: `${sourceFile}#sec-0`,
      sourceFile,
      heading: "Main Document",
      normalizedHeading: "main document",
      level: 1,
      startOffset: 0,
      content: markdown.trim(),
      kind: "unknown",
    })
  }

  return sections
}

// ---------------------------------------------------------------------------
// Reference Extraction
// ---------------------------------------------------------------------------

const DOI_REGEX = /\b10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/i
const ARXIV_REGEX = /(?:arxiv\.org\/(?:abs|pdf)\/|arxiv:\s*)(\d{4}\.\d{4,5}(?:v\d+)?)/i
const URL_REGEX = /https?:\/\/[^\s)>]+/i
const YEAR_REGEX = /\b((?:19|20)\d{2})\b/

export function extractStructuredReferences(markdown: string): ExtractedReference[] {
  const references: ExtractedReference[] = []
  const lines = markdown.split(/\r?\n/)

  const entries: string[] = []
  let currentEntry = ""

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (currentEntry) {
        entries.push(currentEntry)
        currentEntry = ""
      }
      continue
    }

    // Numbered [1], 1., 1), or bulleted starting pattern
    const isNewItem = /^(\[\d+\]|\d+[\.\)]|[-*•])\s+/.test(trimmed)
    if (isNewItem) {
      if (currentEntry) entries.push(currentEntry)
      currentEntry = trimmed.replace(/^(\[\d+\]|\d+[\.\)]|[-*•])\s+/, "")
    } else if (currentEntry) {
      currentEntry += " " + trimmed
    } else if (trimmed.length > 20 && (trimmed.includes(",") || trimmed.includes("."))) {
      currentEntry = trimmed
    }
  }
  if (currentEntry) entries.push(currentEntry)

  for (const raw of entries) {
    if (raw.length < 12) continue

    const warnings: string[] = []
    const doiMatch = raw.match(DOI_REGEX)
    const arxivMatch = raw.match(ARXIV_REGEX)
    const urlMatch = raw.match(URL_REGEX)
    const yearMatch = raw.match(YEAR_REGEX)

    const doi = doiMatch ? doiMatch[0] : undefined
    const arxivId = arxivMatch ? arxivMatch[1] : undefined
    const url = urlMatch ? urlMatch[0] : undefined
    const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined

    if (!year) warnings.push("Missing publication year")

    // Source type classification
    let sourceType: ExtractedReference["sourceType"] = "unknown"
    const rawLow = raw.toLowerCase()
    if (/\b(?:diplomov[ay]|bakalarsk[ay]|dizertacn[ay]|dissertation|thesis|zaverecn[ay]|praca|prace)\b/i.test(rawLow)) {
      sourceType = "thesis"
    } else if (arxivId || /\b(?:arxiv|biorxiv|medrxiv|preprint)\b/i.test(rawLow)) {
      sourceType = "preprint"
    } else if (/\[cit\.|online|dostupn|available\b/i.test(rawLow) || (url && !doi)) {
      sourceType = "web"
    } else if (/\b(?:isbn|vydavatel|nakladatel|publisher|springer|wiley|elsevier|o'reilly|press)\b/i.test(rawLow) && !/vol\.|pp\.|journal/i.test(rawLow)) {
      sourceType = "book"
    } else if (/\bin:\s*|\bkapitola\b/i.test(rawLow)) {
      sourceType = "chapter"
    } else if (/\b(?:vol\.|issue|no\.|pp\.|str\.|journal|transactions|proceedings|ieee|acm)\b/i.test(rawLow)) {
      sourceType = "article"
    }

    // Title & author extraction heuristics
    let title: string | undefined
    const authors: string[] = []

    // ISO 690 style: AUTHOR, First. Year. Title.
    // or Author, A. (Year) Title.
    const titleMatch = raw.match(/(?:(?:19|20)\d{2}[a-z]?[\).:]\s*|\.\s+)(["'„]?([A-Z\p{Lu}][^.?!]{10,180}?)[.?!]["'“]?\s*(?:In:|Available|Dostupné|DOI|http|ISBN|pp\.|Vol\.))/u)
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].replace(/^[„"']|[“"']$/g, "").trim()
    } else {
      // Fallback: take segment between first period/comma and publication year/container
      const segMatch = raw.match(/^[^\.,]+[\.,]\s*([^.,]{10,150})/i)
      if (segMatch) {
        title = segMatch[1].trim()
      } else {
        title = raw.slice(0, 100).trim()
      }
    }

    // Authors heuristic: string before first year or period
    const authorSeg = raw.split(/(?:19|20)\d{2}|\.\s+[A-Z]/)[0]
    if (authorSeg && authorSeg.length < 80) {
      const parsedAuthors = authorSeg
        .split(/;|\band\b|\ba\b/i)
        .map((a) => a.trim().replace(/^[\[\(0-9\]\)\.\-\s]+/, ""))
        .filter((a) => a.length > 2 && /[A-Za-z\p{L}]/u.test(a))
      if (parsedAuthors.length > 0) {
        authors.push(...parsedAuthors)
      }
    }

    if (authors.length === 0) warnings.push("Missing authors")
    if (!title) warnings.push("Missing title")

    references.push({
      raw,
      title,
      authors,
      year,
      doi,
      arxivId,
      url,
      sourceType,
      parseWarnings: warnings,
    })
  }

  return references
}

// ---------------------------------------------------------------------------
// Scored Criterion Routing
// ---------------------------------------------------------------------------

interface CriterionScoringRule {
  primaryKinds: SectionKind[]
  secondaryKinds: SectionKind[]
  keywords: string[]
}

const CRITERION_RULES: Record<string, CriterionScoringRule> = {
  formal_structure: {
    primaryKinds: ["preamble", "conclusion", "references"],
    secondaryKinds: ["introduction", "unknown"],
    keywords: ["struktura", "cleneni", "obsah", "uprava", "format", "rozsah", "appendix", "prilohy"],
  },
  goal_definition: {
    primaryKinds: ["introduction"],
    secondaryKinds: ["literature"],
    keywords: ["ciel", "ciele", "goal", "objective", "problem", "scope", "motivacia", "motivation", "vymedzenie"],
  },
  methodology: {
    primaryKinds: ["methodology"],
    secondaryKinds: ["results", "introduction"],
    keywords: ["metod", "method", "postup", "navrh", "design", "architekt", "implement", "algoritm", "approach", "dataset"],
  },
  results: {
    primaryKinds: ["results"],
    secondaryKinds: ["discussion", "methodology"],
    keywords: ["vysled", "result", "experiment", "evaluat", "meran", "testov", "vyhodnot", "zhodnot", "graf", "tabulka", "performance"],
  },
  originality: {
    primaryKinds: ["conclusion", "discussion"],
    secondaryKinds: ["results", "methodology"],
    keywords: ["origin", "prinos", "contribution", "novel", "inovat", "porovnan", "autorsky", "vlastny", "comparison"],
  },
  language_quality: {
    primaryKinds: ["introduction", "methodology", "results", "conclusion"],
    secondaryKinds: ["literature", "discussion"],
    keywords: ["terminol", "styl", "jazyk", "gramatik", "prejav"],
  },
  citations_bibliography: {
    primaryKinds: ["references"],
    secondaryKinds: ["literature", "introduction"],
    keywords: ["literatura", "reference", "citac", "zdroj", "iso", "bibliograf", "doi"],
  },
  defense_questions: {
    primaryKinds: ["methodology", "results"],
    secondaryKinds: ["discussion", "conclusion"],
    keywords: ["limitations", "obmedzenia", "otazky", "postup", "vysledok", "vyhodnotenie", "hypoteza"],
  },
}

/**
 * Score how relevant a section is for a given criterion.
 */
function scoreSectionForCriterion(
  section: ThesisDocumentSection,
  rule: CriterionScoringRule,
  criterionId: string
): number {
  let score = 0

  // 1. Primary section kind
  if (rule.primaryKinds.includes(section.kind)) {
    score += 100
  } else if (rule.secondaryKinds.includes(section.kind)) {
    score += 25
  }

  // 2. Heading keyword matching
  const normHeading = section.normalizedHeading
  for (const kw of rule.keywords) {
    if (normHeading.includes(kw)) {
      score += 40
      break
    }
  }

  // 3. Keyword density in content
  const contentLower = section.content.slice(0, 2000).toLowerCase()
  let matchedKw = 0
  for (const kw of rule.keywords) {
    if (contentLower.includes(kw)) matchedKw++
  }
  score += Math.min(20, matchedKw * 5)

  // 4. Appendix penalty
  if (section.kind === "appendix") {
    score -= 50
  }

  // 5. References penalty for non-citation criteria
  if (section.kind === "references" && criterionId !== "citations_bibliography") {
    score -= 100
  }

  // 6. Prefer non-empty sections
  if (section.content.length < 100) {
    score -= 30
  }

  return score
}

/**
 * Deterministically sample sections across beginning, middle, and end.
 */
function sampleDocumentAcrossSections(
  sections: ThesisDocumentSection[],
  budgetChars: number
): { text: string; sectionIds: string[]; sourceFiles: string[] } {
  const contentSections = sections.filter((s) => s.kind !== "preamble" && s.kind !== "references" && s.kind !== "appendix")
  const pool = contentSections.length > 0 ? contentSections : sections

  if (pool.length === 0) {
    return { text: "No document content available.", sectionIds: [], sourceFiles: [] }
  }

  if (pool.length === 1) {
    const sec = pool[0]
    return {
      text: `[Section: ${sec.heading}]\n${sec.content.slice(0, budgetChars)}`,
      sectionIds: [sec.id],
      sourceFiles: [sec.sourceFile],
    }
  }

  const head = pool[0]
  const middle = pool[Math.floor(pool.length / 2)]
  const tail = pool[pool.length - 1]

  const selected = [head, middle, tail].filter((s, idx, arr) => arr.indexOf(s) === idx)
  const perSectionBudget = Math.floor(budgetChars / selected.length)

  const parts: string[] = []
  const sectionIds: string[] = []
  const sourceFiles: Set<string> = new Set()

  for (const sec of selected) {
    parts.push(`[Section (${sec.heading}) in ${sec.sourceFile}]\n${sec.content.slice(0, perSectionBudget)}`)
    sectionIds.push(sec.id)
    sourceFiles.add(sec.sourceFile)
  }

  return {
    text: parts.join("\n\n---\n\n"),
    sectionIds,
    sourceFiles: Array.from(sourceFiles),
  }
}

/**
 * Route sections for a specific criterion with explicit character budgeting.
 */
export function routeSectionsForCriterion(
  criterionId: string,
  sections: ThesisDocumentSection[],
  budgetChars: number = THESIS_CONTEXT_BUDGETS.perCriterion
): RoutedExcerpt {
  if (!sections.length) {
    return {
      criterionId,
      text: "No thesis document sections available.",
      sectionIds: [],
      sourceFiles: [],
      truncated: false,
      evidenceAvailable: false,
    }
  }

  // Language quality or formal structure: use deterministic whole-doc sampling
  if (criterionId === "language_quality") {
    const sample = sampleDocumentAcrossSections(sections, budgetChars)
    return {
      criterionId,
      text: sample.text,
      sectionIds: sample.sectionIds,
      sourceFiles: sample.sourceFiles,
      truncated: sample.text.length >= budgetChars,
      evidenceAvailable: sample.sectionIds.length > 0,
    }
  }

  if (criterionId === "formal_structure") {
    // Document outline + head/middle/tail samples
    const outline = sections
      .map((s) => `  - ${s.heading} (${s.kind}, ~${s.content.length} chars)`)
      .join("\n")
    const sample = sampleDocumentAcrossSections(sections, Math.floor(budgetChars * 0.7))
    const text = `Document Outline:\n${outline}\n\nRepresentative Document Samples:\n${sample.text}`
    return {
      criterionId,
      text: text.slice(0, budgetChars),
      sectionIds: sample.sectionIds,
      sourceFiles: sample.sourceFiles,
      truncated: text.length > budgetChars,
      evidenceAvailable: true,
    }
  }

  const rule = CRITERION_RULES[criterionId] ?? {
    primaryKinds: ["unknown"],
    secondaryKinds: [],
    keywords: [criterionId],
  }

  // Score all sections
  const scored = sections.map((sec) => ({
    sec,
    score: scoreSectionForCriterion(sec, rule, criterionId),
  }))

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score)

  // Take top matching sections until budget is filled
  const chosenSections: ThesisDocumentSection[] = []
  let accumulatedChars = 0
  const chosenIds: string[] = []
  const chosenFiles: Set<string> = new Set()
  let truncated = false

  for (const item of scored) {
    if (item.score <= -50 && chosenSections.length > 0) break // Skip penalized sections if we have matches

    const needed = budgetChars - accumulatedChars
    if (needed <= 0) {
      truncated = true
      break
    }

    chosenSections.push(item.sec)
    chosenIds.push(item.sec.id)
    chosenFiles.add(item.sec.sourceFile)
    accumulatedChars += Math.min(item.sec.content.length + 100, needed)
  }

  // If no good sections matched, fall back to whole document sampling
  if (chosenSections.length === 0) {
    const fallback = sampleDocumentAcrossSections(sections, budgetChars)
    return {
      criterionId,
      text: fallback.text,
      sectionIds: fallback.sectionIds,
      sourceFiles: fallback.sourceFiles,
      truncated: fallback.text.length >= budgetChars,
      evidenceAvailable: false,
    }
  }

  // Format excerpt text
  const parts: string[] = []
  let currentLen = 0

  for (const sec of chosenSections) {
    const remaining = budgetChars - currentLen
    if (remaining <= 50) {
      truncated = true
      break
    }
    const chunk = sec.content.slice(0, remaining)
    parts.push(`### [Section: ${sec.heading} (${sec.sourceFile})]\n${chunk}`)
    currentLen += chunk.length + sec.heading.length + 40
  }

  return {
    criterionId,
    text: parts.join("\n\n"),
    sectionIds: chosenIds,
    sourceFiles: Array.from(chosenFiles),
    truncated,
    evidenceAvailable: chosenSections.length > 0,
  }
}

/**
 * Build consolidated full-generation context from routed excerpts across all active criteria.
 * Deduplicates overlapping sections and keeps source labels.
 */
export function buildFullGenerationContext(
  ragContext: ThesisRAGContext,
  activeCriterionIds: string[],
  maxChars: number = THESIS_CONTEXT_BUDGETS.fullGeneration
): {
  contextText: string
  selectedChars: number
  truncated: boolean
} {
  if (!ragContext.sections.length) {
    return { contextText: "", selectedChars: 0, truncated: false }
  }

  const perCriterionBudget = Math.min(
    THESIS_CONTEXT_BUDGETS.perCriterion,
    Math.floor(maxChars / Math.max(1, activeCriterionIds.length))
  )

  const usedSectionIds = new Set<string>()
  const formattedBlocks: string[] = []
  let totalLength = 0
  let isTruncated = false

  for (const critId of activeCriterionIds) {
    const excerpt = routeSectionsForCriterion(critId, ragContext.sections, perCriterionBudget)
    formattedBlocks.push(`=== Evidence for Criterion [${critId}] ===\n${excerpt.text}`)
    totalLength += excerpt.text.length

    for (const sid of excerpt.sectionIds) {
      usedSectionIds.add(sid)
    }

    if (totalLength >= maxChars) {
      isTruncated = true
      break
    }
  }

  const combined = formattedBlocks.join("\n\n\n")
  const finalContext = combined.slice(0, maxChars)

  return {
    contextText: finalContext,
    selectedChars: finalContext.length,
    truncated: isTruncated || combined.length > maxChars,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load and parse the thesis document for RAG-augmented review generation.
 */
export async function loadThesisContext(options: {
  workspaceId: string
  thesisMetadata: ThesisMetadata
  sourceFileId?: string
  focusSections?: string[]
  maxChars?: number
}): Promise<ThesisRAGContext> {
  const { workspaceId, sourceFileId, maxChars = 120_000 } = options
  const sourcesDir = path.join(WORKSPACES_DIR, workspaceId, "sources")

  if (!fs.existsSync(sourcesDir)) {
    return {
      fullText: "",
      sections: [],
      references: [],
      referencesTitles: [],
      totalChars: 0,
      truncated: false,
      sourceFiles: [],
    }
  }

  const files = await fs.promises.readdir(sourcesDir)
  let mdFiles = files.filter((f) => f.endsWith(".md")).sort()

  if (sourceFileId) {
    const cleanId = sourceFileId.replace(/\.(md|pdf)$/i, "")
    const matched = mdFiles.filter((f) => f.replace(/\.md$/i, "") === cleanId || f.includes(cleanId))
    if (matched.length > 0) {
      mdFiles = matched
    }
  }

  if (mdFiles.length === 0) {
    return {
      fullText: "",
      sections: [],
      references: [],
      referencesTitles: [],
      totalChars: 0,
      truncated: false,
      sourceFiles: [],
    }
  }

  let fullText = ""
  let totalUncappedChars = 0
  const allSections: ThesisDocumentSection[] = []

  for (const file of mdFiles) {
    const content = await fs.promises.readFile(path.join(sourcesDir, file), "utf-8")
    totalUncappedChars += content.length

    const chunk = `\n\n--- Source: ${file} ---\n\n${content}`
    if (fullText.length + chunk.length <= maxChars) {
      fullText += chunk
    } else {
      const remaining = maxChars - fullText.length
      if (remaining > 500) fullText += chunk.slice(0, remaining)
    }

    const fileSections = parseDocumentSections(content, file)
    allSections.push(...fileSections)
  }

  // Extract structured references from references sections or whole document
  const refSections = allSections.filter((s) => s.kind === "references")
  const refText = refSections.length > 0
    ? refSections.map((s) => s.content).join("\n\n")
    : fullText

  const references = extractStructuredReferences(refText)
  const referencesTitles = references
    .map((r) => r.title ?? r.raw.slice(0, 100))
    .filter((t) => t.length > 5)

  return {
    fullText: fullText.trim(),
    sections: allSections,
    references,
    referencesTitles,
    totalChars: totalUncappedChars,
    truncated: totalUncappedChars > maxChars,
    sourceFiles: mdFiles,
  }
}

/**
 * Build a focused context snippet for one thesis criterion.
 */
export function buildCriterionContext(
  criterionId: string,
  ragContext: ThesisRAGContext,
  maxChars: number = THESIS_CONTEXT_BUDGETS.perCriterion
): string {
  if (!ragContext.sections.length) return "No thesis document available."
  const excerpt = routeSectionsForCriterion(criterionId, ragContext.sections, maxChars)
  return excerpt.text
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
      dept: "Pracovisko/Katedra",
      year: "Akademický rok",
    },
    cs: {
      student: "Autor/autorka",
      title: "Název práce",
      type: "Typ práce",
      reviewer: "Hodnotitel/ka",
      role: "Role hodnotitele",
      inst: "Instituce",
      dept: "Pracoviště/Katedra",
      year: "Akademický rok",
    },
    en: {
      student: "Student",
      title: "Thesis title",
      type: "Thesis type",
      reviewer: "Reviewer",
      role: "Reviewer role",
      inst: "Institution",
      dept: "Department",
      year: "Academic year",
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
    metadata.department ? `${l.dept}: ${metadata.department}` : null,
    metadata.academicYear ? `${l.year}: ${metadata.academicYear}` : null,
  ]
    .filter(Boolean)
    .join("\n")
}

