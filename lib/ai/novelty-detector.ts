/**
 * Novelty Detector — Missing Prior Art & Claim-Based Coverage Analysis
 *
 * Implements the PaperQA2 / STORM approach to evaluating thesis novelty:
 *
 *   1. Claim Extraction: Use an LLM to extract 10-20 atomic factual claims
 *      from the thesis (one sentence each, testable, not vague).
 *
 *   2. Claim Embedding: Embed each claim locally (MiniLM, 384-dim).
 *
 *   3. Academic Coverage Search: For each claim, query Semantic Scholar and
 *      OpenAlex using the claim as a text query. For each returned paper,
 *      embed its abstract and compute cosine similarity.
 *
 *   4. Missing Prior Art Detection: Papers with cosine similarity > THRESHOLD
 *      that are NOT in the thesis bibliography are flagged as "missing prior art".
 *      These represent related work that should have been cited.
 *
 *   5. Novelty Score: Fraction of claims for which NO highly similar prior work
 *      was found outside the bibliography = claim novelty rate.
 *
 * This is evidence-grounded: each flag comes with the actual paper metadata
 * and the cosine similarity score, allowing the reviewer to verify manually.
 */

import { generateLocalEmbedding } from "./local-embeddings"
import { searchAcademicPaper } from "@/lib/services/academic-connector"
import { generateAIResponse } from "./client"
import { z } from "zod"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Cosine similarity threshold above which a paper is considered "highly related". */
const SIMILARITY_THRESHOLD = 0.82

/** Max claims to extract per thesis (token cost control). */
const MAX_CLAIMS = 20

/** Max papers to check per claim. */
const MAX_PAPERS_PER_CLAIM = 5

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractedClaim {
  id: string
  text: string
  sectionHint?: string // Which section this claim came from
}

export interface MissingPriorArtResult {
  claimId: string
  claimText: string
  relatedPaper: {
    title: string
    authors: string[]
    year?: number | null
    doi?: string
    url?: string
    abstract?: string | null
    citationCount?: number
  }
  cosineSimilarity: number
  inBibliography: boolean
}

export interface NoveltyReport {
  claimsExtracted: number
  claimsChecked: number
  missingPriorArt: MissingPriorArtResult[]
  noveltyScore: number // 0.0 – 1.0: fraction of claims with no highly-similar uncited prior art
  coverageScore: number // 0.0 – 1.0: fraction of claims covered by bibliography
  summary: string
}

// ---------------------------------------------------------------------------
// Step 1: Claim Extraction
// ---------------------------------------------------------------------------

const claimsSchema = z.object({
  claims: z.array(
    z.object({
      text: z.string().describe("A single atomic factual claim from the thesis, stated as one declarative sentence"),
      sectionHint: z.string().optional().describe("Chapter or section where this claim appears (e.g. 'Introduction', 'Results')"),
    })
  ).max(MAX_CLAIMS),
})

/**
 * Uses LLM to extract atomic, testable factual claims from thesis text.
 * Claims are suitable for embedding-based academic literature search.
 */
export async function extractClaims(thesisText: string, maxClaims = MAX_CLAIMS): Promise<ExtractedClaim[]> {
  // Sample at most 40k chars to keep LLM cost bounded
  const sample = thesisText.slice(0, 40000)

  const result = await generateAIResponse("NoveltyDetector-ClaimExtraction", {
    model: process.env.AI_MODEL || "gemini-3.7-flash",
    systemPrompt: `You are an expert academic reviewer. Extract the ${maxClaims} most important, specific, and testable factual claims from the following thesis excerpt. 
Focus on:
- Empirical findings ("We found that X achieves Y%...")
- Methodological contributions ("We propose a new method for...")
- Theoretical claims ("X is caused by Y because...")
- Quantitative results
Avoid vague claims like "The results are good." Each claim must be specific enough to search for in academic databases.`,
    userPrompt: sample,
    schema: claimsSchema,
    temperature: 0.1,
  })

  if (!result?.claims) return []

  return result.claims.map((c, i) => ({
    id: `claim-${i}`,
    text: c.text,
    sectionHint: c.sectionHint,
  }))
}

// ---------------------------------------------------------------------------
// Step 2–3: Embed claims and find related papers
// ---------------------------------------------------------------------------

/**
 * Computes cosine similarity between two L2-normalized embedding vectors.
 */
function cosineSim(a: number[], b: number[]): number {
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return dot
}

/**
 * Searches academic sources for papers related to a claim,
 * embeds their abstracts, and returns those with cosine > threshold.
 */
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
      // Embedding unavailable — skip this paper
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

/**
 * Parses a raw BibTeX string into an array of structured entries, extracting
 * title and DOI fields. Much more robust than raw substring search because it:
 *  - Handles title variations (preprint vs camera-ready, subtitle punctuation)
 *  - Avoids false-positive DOI matches on partial string overlaps
 *  - Works across different capitalizations and whitespace
 */
function parseBibEntries(bibContent: string): ParsedBibEntry[] {
  if (!bibContent) return []
  const entries: ParsedBibEntry[] = []

  // Split on BibTeX entry openers: @type{key,
  const entryRegex = /@\w+\{[^,]+,([\s\S]*?)(?=@\w+\{|$)/g
  let m: RegExpExecArray | null
  while ((m = entryRegex.exec(bibContent)) !== null) {
    const body = m[1]

    // Extract title = {...} or title = "..."
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

/**
 * Computes a simple word-level Jaccard similarity between two normalized strings.
 * Used to match thesis titles that may differ in subtitle punctuation or preprint
 * vs final-version wording.
 */
function titleJaccard(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/).filter((w) => w.length > 2))
  const wordsB = new Set(b.split(/\s+/).filter((w) => w.length > 2))
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  let inter = 0
  for (const w of wordsA) if (wordsB.has(w)) inter++
  return inter / (wordsA.size + wordsB.size - inter)
}

/**
 * Checks if a paper (identified by title and/or DOI) appears in the bibliography.
 * Uses structured BibTeX parsing + Jaccard title similarity for robustness.
 * Falls back to raw substring matching if parsing yields no entries.
 */
function isInBibliography(
  paper: { title?: string; doi?: string },
  bibContent: string
): boolean {
  if (!bibContent) return false

  const entries = parseBibEntries(bibContent)

  // Structured matching (preferred)
  if (entries.length > 0) {
    // 1. DOI exact match
    if (paper.doi) {
      const normPaperDoi = paper.doi.toLowerCase().trim()
      if (entries.some((e) => e.doi && e.doi === normPaperDoi)) return true
    }
    // 2. Title Jaccard similarity ≥ 0.6 (handles subtitle differences, preprint titles)
    if (paper.title && paper.title.length > 10) {
      const normPaperTitle = paper.title.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim()
      if (entries.some((e) => e.normalizedTitle && titleJaccard(normPaperTitle, e.normalizedTitle) >= 0.6)) {
        return true
      }
    }
    return false
  }

  // Fallback: original raw substring approach (if BibTeX couldn't be parsed)
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

/**
 * Runs the full novelty detection pipeline on a thesis.
 *
 * @param thesisText - Full or sampled thesis markdown content
 * @param bibContent - Raw BibTeX string from the workspace bibliography
 * @returns NoveltyReport with missing prior art flags and novelty/coverage scores
 */
export async function detectNovelty(
  thesisText: string,
  bibContent: string = ""
): Promise<NoveltyReport> {
  // Step 1: Extract claims
  const claims = await extractClaims(thesisText)
  if (claims.length === 0) {
    return {
      claimsExtracted: 0,
      claimsChecked: 0,
      missingPriorArt: [],
      noveltyScore: 1.0,
      coverageScore: 1.0,
      summary: "No claims could be extracted from the document.",
    }
  }

  const missingPriorArt: MissingPriorArtResult[] = []
  let claimsWithUncitedPriorArt = 0
  let claimsWithCitedCoverage = 0

  // Step 2–4: For each claim, embed + search + check bibliography
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
      if (inBib) hasCited = true
      else {
        hasUncited = true
        missingPriorArt.push({
          claimId: claim.id,
          claimText: claim.text,
          relatedPaper: {
            title: paper.title,
            authors: paper.authors,
            year: paper.year,
            doi: paper.doi,
            url: paper.url,
            abstract: paper.abstract,
            citationCount: paper.citationCount,
          },
          cosineSimilarity: Math.round(similarity * 1000) / 1000,
          inBibliography: false,
        })
      }
    }

    if (hasUncited) claimsWithUncitedPriorArt++
    if (hasCited) claimsWithCitedCoverage++
  }

  const noveltyScore = Math.max(
    0,
    Math.round(((claims.length - claimsWithUncitedPriorArt) / claims.length) * 100) / 100
  )
  const coverageScore = Math.round((claimsWithCitedCoverage / claims.length) * 100) / 100

  // Deduplicate missing prior art by paper title
  const seen = new Set<string>()
  const uniqueMissing = missingPriorArt.filter((r) => {
    const key = r.relatedPaper.title.slice(0, 30).toLowerCase().replace(/[^a-z0-9]/g, "")
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const summary =
    uniqueMissing.length === 0
      ? `All ${claims.length} extracted claims are either novel or covered by the cited bibliography.`
      : `Found ${uniqueMissing.length} potentially missing citation(s) across ${claimsWithUncitedPriorArt} claim(s). Novelty score: ${Math.round(noveltyScore * 100)}%. These are papers with cosine similarity ≥ ${SIMILARITY_THRESHOLD} to thesis claims that do not appear in the bibliography.`

  return {
    claimsExtracted: claims.length,
    claimsChecked: claims.length,
    missingPriorArt: uniqueMissing,
    noveltyScore,
    coverageScore,
    summary,
  }
}
