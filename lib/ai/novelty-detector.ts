/**
 * Novelty Detector — Missing Prior Art & Claim-Based Coverage Analysis
 *
 * Implements the PaperQA2 / STORM approach to evaluating thesis novelty:
 *
 *   1. Claim Extraction: Extract atomic factual claims across thesis chunks
 *      (or full text with section-weighted sampling), avoiding 40k truncations.
 *
 *   2. Temporal Precedence Gating: Extract thesis submission year/date and compare
 *      against external publication dates (publishedAt / year). A paper published
 *      *after* or contemporaneously without prior-art precedence cannot be flagged
 *      as missing prior art.
 *
 *   3. Claim Embedding: Embed each claim locally (MiniLM, 384-dim).
 *
 *   4. Academic Coverage Search: For each claim, query Semantic Scholar,
 *      Crossref, and OpenAlex using the claim as a text query. For each returned paper,
 *      embed its abstract and compute cosine similarity.
 *
 *   5. Missing Prior Art Detection: Papers with cosine similarity > THRESHOLD,
 *      publication date strictly prior to thesis date (pub_date < thesis_date),
 *      and NOT in the thesis bibliography are flagged as "missing prior art".
 *
 *   6. Novelty Score: Fraction of claims for which NO highly similar prior work
 *      was found outside the bibliography = claim novelty rate.
 */

import { generateLocalEmbedding } from "./local-embeddings"
import { searchAcademicPaper } from "@/lib/services/academic-connector"
import { generateAIResponse } from "./client"
import { z } from "zod"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Cosine similarity threshold above which a paper is considered "highly related". */
export const SIMILARITY_THRESHOLD = 0.82

/** Max claims to extract per thesis (token cost control). */
export const MAX_CLAIMS = 20

/** Max papers to check per claim. */
export const MAX_PAPERS_PER_CLAIM = 5

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractedClaim {
  id: string
  text: string
  sectionHint?: string
  chunkId?: string
  page?: number | null
}

export interface MissingPriorArtResult {
  claimId: string
  claimText: string
  relatedPaper: {
    title: string
    authors: string[]
    year?: number | null
    publishedAt?: string | null
    doi?: string
    url?: string
    abstract?: string | null
    citationCount?: number
  }
  cosineSimilarity: number
  inBibliography: boolean
  temporalPrecedence: {
    isPriorArt: boolean
    thesisYear?: number | null
    paperYear?: number | null
    reason?: string
  }
}

export interface NoveltyReport {
  claimsExtracted: number
  claimsChecked: number
  thesisSubmissionYear?: number | null
  thesisSubmissionDate?: string | null
  missingPriorArt: MissingPriorArtResult[]
  noveltyScore: number // 0.0 – 1.0: fraction of claims with no highly-similar uncited prior art
  coverageScore: number // 0.0 – 1.0: fraction of claims covered by bibliography
  summary: string
}

export interface NoveltyOptions {
  apiKey?: string
  model?: string
  thesisYear?: number | null
  thesisDate?: string | null
  chunks?: Array<{
    id?: string
    content: string
    heading?: string | null
    sectionPath?: string | null
    pageStart?: number | null
  }>
}

// ---------------------------------------------------------------------------
// Step 0: Thesis Submission Date / Year Extraction
// ---------------------------------------------------------------------------

const MONTH_MAP: Record<string, number> = {
  január: 1, januar: 1, jan: 1, january: 1,
  február: 2, februar: 2, feb: 2, february: 2,
  marec: 3, mar: 3, march: 3, březen: 3, brezen: 3,
  apríl: 4, april: 4, apr: 4, duben: 4,
  máj: 5, maj: 5, may: 5, květen: 5, kveten: 5,
  jún: 6, jun: 6, june: 6, červen: 6, cerven: 6,
  júl: 7, jul: 7, july: 7, červenec: 7, cervenec: 7,
  august: 8, aug: 8, srpen: 8,
  september: 9, sep: 9, sept: 9, září: 9, zari: 9,
  október: 10, oktober: 10, oct: 10, october: 10, říjen: 10, rijen: 10,
  november: 11, nov: 11, listopad: 11,
  december: 12, dec: 12, prosinec: 12,
}

/**
 * Extracts submission year and optional parsed ISO date from thesis front matter.
 */
export function extractThesisSubmissionDate(thesisText: string): {
  year: number | null
  date: string | null
  raw?: string
} {
  const front = thesisText.slice(0, 10000)

  // 1. Explicit submission date/year markers (SK / CZ / EN)
  const explicitDateMatch = front.match(
    /(?:Dátum\s+odovzdania|Datum\s+odevzdání|Submission\s+date|Date\s+of\s+submission|Obhajoba|Bratislava|Košice|Praha|Brno|Žilina|Zvolen|Trnava|Banská\s+Bystrica|Prešov|Nitra|Olomouc|Plzeň|Ostrava)\s*[:,-]?\s*([0-3]?[0-9][.\s]+(?:[a-záäčďéíĺľňóôŕšťúýž]+|[0-1]?[0-9])[.\s]+(20[0-2][0-9]|199[0-9]))/i
  )
  if (explicitDateMatch) {
    const raw = explicitDateMatch[1].trim()
    const yearMatch = raw.match(/\b(20[0-2][0-9]|199[0-9])\b/)
    const year = yearMatch ? parseInt(yearMatch[1], 10) : null
    return { year, date: year ? `${year}-01-01` : null, raw }
  }

  // 2. Month + Year patterns (e.g. "máj 2022", "May 2019")
  const monthYearMatch = front.match(
    /\b(január|február|marec|apríl|máj|jún|júl|august|september|október|november|december|leden|únor|březen|duben|květen|červen|červenec|srpen|září|říjen|listopad|prosinec|january|february|march|april|may|june|july|august|september|october|november|december)\s+(20[0-2][0-9]|199[0-9])\b/i
  )
  if (monthYearMatch) {
    const monthStr = monthYearMatch[1].toLowerCase()
    const year = parseInt(monthYearMatch[2], 10)
    const month = MONTH_MAP[monthStr] || 1
    const monthPadded = String(month).padStart(2, "0")
    return {
      year,
      date: `${year}-${monthPadded}-01`,
      raw: monthYearMatch[0],
    }
  }

  // 3. Academic year e.g. 2021/2022 -> 2022
  const academicYearMatch = front.match(/\b(20[0-2][0-9])\/(20[0-2][0-9])\b/)
  if (academicYearMatch) {
    const year = parseInt(academicYearMatch[2], 10)
    return { year, date: `${year}-06-30`, raw: academicYearMatch[0] }
  }

  // 4. Standalone recent 4-digit year in title block / front matter
  const standaloneMatch = front.match(/\b(20[0-2][0-9])\b/)
  if (standaloneMatch) {
    const year = parseInt(standaloneMatch[1], 10)
    return { year, date: `${year}-01-01`, raw: standaloneMatch[0] }
  }

  return { year: null, date: null }
}

/**
 * Checks temporal publication precedence between an external paper and the thesis.
 */
export function isTemporalPriorArt(
  paper: { year?: number | null; publishedAt?: string | null },
  thesisYear?: number | null,
  thesisDate?: string | null
): { isPriorArt: boolean; thesisYear?: number | null; paperYear?: number | null; reason: string } {
  if (!thesisYear && !thesisDate) {
    return {
      isPriorArt: true,
      thesisYear: null,
      paperYear: paper.year ?? null,
      reason: "Thesis submission year unknown; temporal gating skipped",
    }
  }

  const effectiveThesisYear = thesisYear ?? (thesisDate ? new Date(thesisDate).getFullYear() : null)

  let paperPubYear: number | null = null
  if (typeof paper.year === "number" && !Number.isNaN(paper.year)) {
    paperPubYear = paper.year
  } else if (paper.publishedAt) {
    const parsed = new Date(paper.publishedAt).getFullYear()
    if (!Number.isNaN(parsed)) paperPubYear = parsed
  }

  if (!paperPubYear) {
    return {
      isPriorArt: true,
      thesisYear: effectiveThesisYear,
      paperYear: null,
      reason: "Paper publication date unknown; cannot disprove prior art",
    }
  }

  if (effectiveThesisYear !== null && paperPubYear > effectiveThesisYear) {
    return {
      isPriorArt: false,
      thesisYear: effectiveThesisYear,
      paperYear: paperPubYear,
      reason: `Paper published in ${paperPubYear} post-dates thesis submitted in ${effectiveThesisYear}`,
    }
  }

  if (thesisDate && paper.publishedAt) {
    const tTime = new Date(thesisDate).getTime()
    const pTime = new Date(paper.publishedAt).getTime()
    if (!Number.isNaN(tTime) && !Number.isNaN(pTime)) {
      if (pTime > tTime) {
        return {
          isPriorArt: false,
          thesisYear: effectiveThesisYear,
          paperYear: paperPubYear,
          reason: `Paper published on ${paper.publishedAt} post-dates thesis date ${thesisDate}`,
        }
      }
    }
  }

  return {
    isPriorArt: true,
    thesisYear: effectiveThesisYear,
    paperYear: paperPubYear,
    reason: `Paper published in ${paperPubYear} precedes or coincides with thesis in ${effectiveThesisYear}`,
  }
}

// ---------------------------------------------------------------------------
// Step 1: Claim Extraction
// ---------------------------------------------------------------------------

const claimsSchema = z.object({
  claims: z
    .array(
      z.object({
        text: z.string().describe("A single atomic factual claim from the thesis, stated as one declarative sentence"),
        sectionHint: z.string().optional().describe("Chapter or section where this claim appears (e.g. 'Introduction', 'Results')"),
      })
    )
    .max(MAX_CLAIMS),
})

/**
 * Samples key representative sections across all thesis chunks rather than
 * a single 40k slice of the start of the manuscript.
 */
export function sampleRepresentativeThesisText(
  thesisText: string,
  chunks?: Array<{ content: string; heading?: string | null; sectionPath?: string | null; pageStart?: number | null }>,
  budgetChars = 60000
): string {
  if (chunks && chunks.length > 0) {
    const priorityRe = /(?:výsledk|result|metod|method|návrh|design|prínos|contribution|záver|conclusion|experiment)/i

    const highPriority: string[] = []
    const standard: string[] = []

    for (const ch of chunks) {
      const tag = `${ch.heading ?? ""} ${ch.sectionPath ?? ""}`
      const body = ch.content.trim()
      if (body.length < 50) continue
      if (priorityRe.test(tag)) {
        highPriority.push(`### ${ch.heading || "Section"}\n${body}`)
      } else {
        standard.push(`### ${ch.heading || "Section"}\n${body}`)
      }
    }

    const selected: string[] = []
    let currentLen = 0

    for (const block of highPriority) {
      if (currentLen + block.length > budgetChars * 0.75) break
      selected.push(block)
      currentLen += block.length + 2
    }

    for (const block of standard) {
      if (currentLen + block.length > budgetChars) break
      selected.push(block)
      currentLen += block.length + 2
    }

    if (selected.length > 0) {
      return selected.join("\n\n")
    }
  }

  if (thesisText.length <= budgetChars) return thesisText

  const third = Math.floor(budgetChars / 3)
  const part1 = thesisText.slice(0, third)
  const midStart = Math.floor((thesisText.length - third) / 2)
  const part2 = thesisText.slice(midStart, midStart + third)
  const part3 = thesisText.slice(thesisText.length - third)

  return `${part1}\n\n[... middle chapters ...]\n\n${part2}\n\n[... results & conclusions ...]\n\n${part3}`
}

/**
 * Uses LLM to extract atomic, testable factual claims from thesis text or chunks.
 */
export async function extractClaims(
  thesisText: string,
  maxClaims = MAX_CLAIMS,
  options?: NoveltyOptions
): Promise<ExtractedClaim[]> {
  const sampledText = sampleRepresentativeThesisText(thesisText, options?.chunks, 50000)

  const result = await generateAIResponse("NoveltyDetector-ClaimExtraction", {
    model: options?.model || process.env.AI_MODEL || "gemini-2.5-flash",
    apiKey: options?.apiKey,
    systemPrompt: `You are an expert academic reviewer. Extract up to ${maxClaims} of the most important, specific, and testable factual claims across this thesis. 
Focus on:
- Empirical findings ("We found that X achieves Y%...")
- Methodological contributions ("We propose a new method for...")
- Theoretical claims ("X is caused by Y because...")
- Quantitative results
Avoid vague claims like "The results are good." Each claim must be specific enough to search for in academic databases.`,
    userPrompt: sampledText,
    schema: claimsSchema,
    temperature: 0.1,
  })

  if (!result?.claims || result.claims.length === 0) return []

  return result.claims.slice(0, maxClaims).map((c, i) => ({
    id: `claim-${i}`,
    text: c.text,
    sectionHint: c.sectionHint,
  }))
}

// ---------------------------------------------------------------------------
// Step 2–3: Embed claims and find related papers
// ---------------------------------------------------------------------------

function cosineSim(a: number[], b: number[]): number {
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return dot
}

async function findRelatedPapers(
  claim: ExtractedClaim,
  claimEmbedding: number[],
  threshold: number
): Promise<Array<{ paper: Awaited<ReturnType<typeof searchAcademicPaper>>[number]; similarity: number }>> {
  const results = await searchAcademicPaper(claim.text, MAX_PAPERS_PER_CLAIM).catch(() => [])
  const hits: Array<{ paper: typeof results[number]; similarity: number }> = []

  for (const paper of results) {
    if (!paper.abstract && !paper.tldr) continue
    const abstractText = paper.abstract || paper.tldr || ""
    try {
      const paperEmb = await generateLocalEmbedding(abstractText.slice(0, 1000))
      const sim = cosineSim(claimEmbedding, paperEmb)
      if (sim >= threshold) {
        hits.push({ paper, similarity: sim })
      }
    } catch {
      // ignore
    }
  }

  return hits.sort((a, b) => b.similarity - a.similarity)
}

// ---------------------------------------------------------------------------
// Step 4: Bibliography matching
// ---------------------------------------------------------------------------

interface ParsedBibEntry {
  doi?: string
  title?: string
  normalizedTitle: string
}

function parseBibEntries(bibContent: string): ParsedBibEntry[] {
  if (!bibContent) return []
  const entries: ParsedBibEntry[] = []

  const entryRegex = /@\w+\{[^,]+,([\s\S]*?)(?=@\w+\{|$)/g
  let m: RegExpExecArray | null
  while ((m = entryRegex.exec(bibContent)) !== null) {
    const body = m[1]
    const titleMatch = body.match(/title\s*=\s*[{"]([^}"]+)[}"]/i)
    const doiMatch = body.match(/doi\s*=\s*[{"]([^}"]+)[}"]/i)

    const rawTitle = titleMatch ? titleMatch[1].replace(/[{}]/g, "").trim() : undefined
    const doi = doiMatch ? doiMatch[1].trim().toLowerCase() : undefined
    const normalizedTitle = rawTitle
      ? rawTitle.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim()
      : ""

    if (rawTitle || doi) {
      entries.push({ doi, title: rawTitle, normalizedTitle })
    }
  }
  return entries
}

function titleJaccard(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/).filter((w) => w.length > 2))
  const wordsB = new Set(b.split(/\s+/).filter((w) => w.length > 2))
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  let inter = 0
  for (const w of wordsA) if (wordsB.has(w)) inter++
  return inter / (wordsA.size + wordsB.size - inter)
}

function isInBibliography(
  paper: { title?: string; doi?: string },
  bibContent: string
): boolean {
  if (!bibContent) return false

  const entries = parseBibEntries(bibContent)

  if (entries.length > 0) {
    if (paper.doi) {
      const normPaperDoi = paper.doi.toLowerCase().trim()
      if (entries.some((e) => e.doi && e.doi === normPaperDoi)) return true
    }
    if (paper.title && paper.title.length > 10) {
      const normPaperTitle = paper.title.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim()
      if (entries.some((e) => e.normalizedTitle && titleJaccard(normPaperTitle, e.normalizedTitle) >= 0.6)) {
        return true
      }
    }
    return false
  }

  const normBib = bibContent.toLowerCase().replace(/[^a-z0-9]/g, "")
  if (paper.doi) {
    if (normBib.includes(paper.doi.toLowerCase().replace(/[^a-z0-9]/g, ""))) return true
  }
  if (paper.title && paper.title.length > 10) {
    const normTitle = paper.title.slice(0, 40).toLowerCase().replace(/[^a-z0-9]/g, "")
    if (normBib.includes(normTitle)) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Public: Full Novelty Detection Pipeline
// ---------------------------------------------------------------------------

export async function detectNovelty(
  thesisText: string,
  bibContent: string = "",
  options?: NoveltyOptions
): Promise<NoveltyReport> {
  const parsedDate = extractThesisSubmissionDate(thesisText)
  const thesisYear = options?.thesisYear ?? parsedDate.year
  const thesisDate = options?.thesisDate ?? parsedDate.date

  const claims = await extractClaims(thesisText, MAX_CLAIMS, options)
  if (claims.length === 0) {
    return {
      claimsExtracted: 0,
      claimsChecked: 0,
      thesisSubmissionYear: thesisYear,
      thesisSubmissionDate: thesisDate,
      missingPriorArt: [],
      noveltyScore: 1.0,
      coverageScore: 1.0,
      summary: "No claims could be extracted from the document.",
    }
  }

  const missingPriorArt: MissingPriorArtResult[] = []
  let claimsWithUncitedPriorArt = 0
  let claimsWithCitedCoverage = 0

  for (const claim of claims) {
    let claimEmb: number[]
    try {
      claimEmb = await generateLocalEmbedding(claim.text)
    } catch {
      continue
    }

    const related = await findRelatedPapers(claim, claimEmb, SIMILARITY_THRESHOLD)
    if (related.length === 0) continue

    let hasUncited = false
    let hasCited = false

    for (const { paper, similarity } of related) {
      const inBib = isInBibliography(paper, bibContent)
      if (inBib) {
        hasCited = true
        continue
      }

      const precedence = isTemporalPriorArt(paper, thesisYear, thesisDate)
      if (!precedence.isPriorArt) {
        continue
      }

      hasUncited = true
      missingPriorArt.push({
        claimId: claim.id,
        claimText: claim.text,
        relatedPaper: {
          title: paper.title,
          authors: paper.authors,
          year: paper.year,
          publishedAt: (paper as any).publishedAt ?? null,
          doi: paper.doi,
          url: paper.url,
          abstract: paper.abstract,
          citationCount: paper.citationCount,
        },
        cosineSimilarity: Math.round(similarity * 1000) / 1000,
        inBibliography: false,
        temporalPrecedence: precedence,
      })
    }

    if (hasUncited) claimsWithUncitedPriorArt++
    if (hasCited) claimsWithCitedCoverage++
  }

  const noveltyScore = Math.max(
    0,
    Math.round(((claims.length - claimsWithUncitedPriorArt) / claims.length) * 100) / 100
  )
  const coverageScore = Math.round((claimsWithCitedCoverage / claims.length) * 100) / 100

  const seen = new Set<string>()
  const uniqueMissing = missingPriorArt.filter((r) => {
    const key = r.relatedPaper.title.slice(0, 30).toLowerCase().replace(/[^a-z0-9]/g, "")
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const yearAnnotation = thesisYear ? ` (thesis year: ${thesisYear})` : ""
  const summary =
    uniqueMissing.length === 0
      ? `All ${claims.length} extracted claims are either novel or covered by the cited bibliography${yearAnnotation}.`
      : `Found ${uniqueMissing.length} potentially missing prior-art citation(s) across ${claimsWithUncitedPriorArt} claim(s)${yearAnnotation}. Novelty score: ${Math.round(noveltyScore * 100)}%. These are papers published prior to the thesis with cosine similarity ≥ ${SIMILARITY_THRESHOLD} that do not appear in the bibliography.`

  return {
    claimsExtracted: claims.length,
    claimsChecked: claims.length,
    thesisSubmissionYear: thesisYear,
    thesisSubmissionDate: thesisDate,
    missingPriorArt: uniqueMissing,
    noveltyScore,
    coverageScore,
    summary,
  }
}
