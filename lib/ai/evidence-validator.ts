/**
 * Evidence Validator & Epistemic Status Engine.
 *
 * Enforces non-negotiable grounding invariants:
 *  - Quote verification against source text (exact, normalized, approximate)
 *  - Epistemic status enforcement (SUPPORTED_FACT, SUPPORTED_INTERPRETATION, MISSING_EVIDENCE, etc.)
 *  - Prohibition of synthetic page numbers
 *  - Bounded repair / downgrading of unsupported claims
 *  - Stale evidence detection via sourceRevision
 */

import type {
  EvidenceReference,
  EvidenceState,
  EpistemicStatus,
  ReviewFinding,
} from "./review-types"
import type { ThesisRAGContext } from "./thesis-context"

/**
 * A cited chunk, as returned by retrieveForCriterion / fetchChunksByIds.
 * When evidence carries a `chunkId`, verification becomes an *exact lookup*:
 * the chunk must exist in the retrieved set and contain the quoted sentence.
 */
export interface CitedChunk {
  id: string
  heading?: string | null
  content: string
  kind?: string
  documentId?: string
}

function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase()
}

/**
 * Verifies an evidence reference by its chunk anchor ([c17]-style citation).
 * Exact lookup, not substring search:
 *   1. The cited chunk must exist in the retrieved chunk map.
 *   2. The quote (or a ≥60-char prefix of it) must be present in that chunk
 *      after whitespace normalization.
 * Returns null when the reference carries no usable chunkId.
 */
export function verifyEvidenceByChunkId(
  evidence: EvidenceReference,
  chunksById: Map<string, CitedChunk>
): EvidenceReference | null {
  const chunkId = evidence.chunkId ? evidence.chunkId : undefined
  if (!chunkId) return null
  const chunk = chunksById.get(chunkId)
  if (!chunk) {
    return {
      ...evidence,
      verified: false,
      state: "unverified",
      confidence: 0.1,
      verificationMethod: "exact",
      quote: evidence.quote || evidence.exactQuote || "",
      staleAt: new Date().toISOString(),
    }
  }

  const quote = (evidence.quote || evidence.exactQuote || "").trim()
  const normChunk = normalize(chunk.content)
  const normQuote = normalize(quote)

  let matched = false
  if (quote && normQuote.length >= 12) {
    matched = normChunk.includes(normQuote)
    if (!matched && normQuote.length > 60) {
      matched = normChunk.includes(normQuote.slice(0, 60))
    }
  } else {
    // No quote — the chunk itself is the evidence; structural anchors are accepted.
    matched = true
  }

  if (matched) {
    return {
      ...evidence,
      sourceDocumentId: evidence.sourceDocumentId ?? chunk.documentId,
      sectionHeading: evidence.sectionHeading ?? chunk.heading ?? undefined,
      sectionTitle: evidence.sectionTitle ?? chunk.heading ?? undefined,
      exactQuote: evidence.exactQuote ?? (quote || undefined),
      verified: true,
      state: "verified-exact",
      confidence: 1.0,
      verificationMethod: "exact",
      page: undefined,
      pageNumber: undefined,
    }
  }

  // Cited chunk exists but does NOT contain the quote → fabrication signal.
  return {
    ...evidence,
    verified: false,
    state: "unverified",
    confidence: 0.05,
    verificationMethod: "exact",
  }
}

export interface EvidenceValidationResult {
  isValid: boolean
  verifiedCount: number
  unverifiedCount: number
  staleCount: number
  downgradedClaimsCount: number
  validatedFindings: ReviewFinding[]
  diagnostics: string[]
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase()
}

/**
 * Verifies an individual evidence quote against the full source document and sections.
 */
export function verifyEvidenceQuote(
  evidenceOrQuote: string | EvidenceReference,
  sourceText: string,
  sectionsOrRevision?: Array<{ id?: string; heading: string; content: string }> | string,
  currentRevision?: string
): EvidenceReference {
  const evidence: EvidenceReference = typeof evidenceOrQuote === "string"
    ? { quote: evidenceOrQuote }
    : { ...evidenceOrQuote }

  const sections: Array<{ id?: string; heading: string; content: string }> =
    Array.isArray(sectionsOrRevision) ? sectionsOrRevision : []
  const revision = typeof sectionsOrRevision === "string" ? sectionsOrRevision : currentRevision

  const quote = evidence.quote || evidence.exactQuote || ""
  if (!quote.trim()) {
    return {
      ...evidence,
      quote: "",
      verified: false,
      state: "unverified",
      confidence: 0.0,
      verificationMethod: "manual",
    }
  }

  // Check stale revision
  const isStale = evidence.sourceRevision && revision && evidence.sourceRevision !== revision
  if (isStale) {
    return {
      ...evidence,
      verified: false,
      state: "stale",
      confidence: 0.2,
      staleAt: new Date().toISOString(),
    }
  }

  const cleanQuote = normalizeWhitespace(quote)
  const normSource = normalizeWhitespace(sourceText)

  // 1. Exact match search
  const exactMatches = sections.filter((s) => s.content && s.content.includes(quote))
  if (exactMatches.length > 0 || sourceText.includes(quote)) {
    const isAmbiguous = exactMatches.length > 1
    const state: EvidenceState = isAmbiguous ? "ambiguous" : "verified-exact"
    const matchedSec = exactMatches[0] || sections.find((s) => s.content && s.content.includes(quote))
    const idx = sourceText.includes(quote) ? sourceText.indexOf(quote) : undefined

    return {
      ...evidence,
      quote,
      exactQuote: quote,
      startOffset: idx !== undefined && idx >= 0 ? idx : undefined,
      endOffset: idx !== undefined && idx >= 0 ? idx + quote.length : undefined,
      sectionHeading: evidence.sectionHeading || matchedSec?.heading,
      sectionTitle: evidence.sectionTitle || matchedSec?.heading,
      verified: true,
      state,
      confidence: isAmbiguous ? 0.95 : 1.0,
      verificationMethod: "exact",
      // Protect against synthetic page numbers: only keep if explicitly numeric and verified
      page: undefined,
      pageNumber: undefined,
    }
  }

  // 2. Whitespace-normalized match search
  const normMatches = sections.filter((s) => s.content && normalizeWhitespace(s.content).includes(cleanQuote))
  if (normMatches.length > 0 || normSource.includes(cleanQuote)) {
    const isAmbiguous = normMatches.length > 1
    const state: EvidenceState = isAmbiguous ? "ambiguous" : "verified-normalized"
    const matchedSec = normMatches[0] || sections.find((s) => s.content && normalizeWhitespace(s.content).includes(cleanQuote))
    const normIdx = normSource.includes(cleanQuote) ? normSource.indexOf(cleanQuote) : undefined

    return {
      ...evidence,
      quote,
      startOffset: normIdx !== undefined && normIdx >= 0 ? normIdx : undefined,
      endOffset: normIdx !== undefined && normIdx >= 0 ? normIdx + cleanQuote.length : undefined,
      sectionHeading: evidence.sectionHeading || matchedSec?.heading,
      sectionTitle: evidence.sectionTitle || matchedSec?.heading,
      verified: true,
      state,
      confidence: 0.95,
      verificationMethod: "whitespace_normalized",
    }
  }

  // 3. Approximate match for long quotes (> 60 characters)
  // Require a 60-char anchor to resist hallucinated continuations:
  // an LLM appending fabricated text after a real prefix must reproduce
  // at least 60 real characters before we grant any match.
  // Confidence 0.45 (clearly between unverified=0.1 and normalized=0.95).
  if (cleanQuote.length > 60) {
    const prefix = cleanQuote.slice(0, 60)
    const approxMatches = sections.filter((s) => s.content && normalizeWhitespace(s.content).includes(prefix))
    if (approxMatches.length > 0 || normSource.includes(prefix)) {
      const matchedSec = approxMatches[0] || sections.find((s) => s.content && normalizeWhitespace(s.content).includes(prefix))
      const subIndex = normSource.includes(prefix) ? normSource.indexOf(prefix) : undefined
      return {
        ...evidence,
        quote,
        startOffset: subIndex !== undefined && subIndex >= 0 ? subIndex : undefined,
        endOffset: subIndex !== undefined && subIndex >= 0 ? subIndex + prefix.length : undefined,
        sectionHeading: evidence.sectionHeading || matchedSec?.heading,
        sectionTitle: evidence.sectionTitle || matchedSec?.heading,
        verified: false,
        state: "approximate",
        confidence: 0.45,
        verificationMethod: "approximate",
        page: undefined,
        pageNumber: undefined,
      }
    }
  }

  // 4. Unverified fallback
  return {
    ...evidence,
    quote,
    verified: false,
    state: "unverified",
    confidence: 0.1,
    verificationMethod: "manual",
    page: undefined,
    pageNumber: undefined,
  }
}

/**
 * Validates and calibrates an array of findings according to their epistemic status.
 *
 * When `citedChunks` is provided (the chunks actually retrieved for the
 * review), evidence carrying a `chunkId` is verified by *exact lookup* into
 * that map first — no substring search across the manuscript. Evidence
 * without a chunk anchor falls back to the verbatim/approximate quote path.
 */
export function validateAndCalibrateFindings(
  findings: ReviewFinding[],
  sourceText: string,
  sectionsOrRevision?: Array<{ id?: string; heading: string; content: string }> | string,
  currentRevision?: string,
  citedChunks?: CitedChunk[]
): EvidenceValidationResult {
  const sections: Array<{ id?: string; heading: string; content: string }> =
    Array.isArray(sectionsOrRevision) ? sectionsOrRevision : []
  const revision = typeof sectionsOrRevision === "string" ? sectionsOrRevision : currentRevision

  const chunksById = new Map<string, CitedChunk>()
  if (citedChunks) {
    for (const c of citedChunks) chunksById.set(c.id, c)
  }

  let verifiedCount = 0
  let unverifiedCount = 0
  let staleCount = 0
  let downgradedClaimsCount = 0
  const diagnostics: string[] = []

  const validatedFindings: ReviewFinding[] = findings.map((finding) => {
    // 1. Verify all evidence links — chunk-anchored exact lookup first,
    //    then the verbatim/normalized/approximate manuscript path.
    const verifiedEvidenceList = (finding.evidence || []).map((ev) => {
      let verifiedEv: EvidenceReference | null = null
      if (chunksById.size > 0 && ev.chunkId) {
        verifiedEv = verifyEvidenceByChunkId(ev, chunksById)
      }
      if (!verifiedEv) {
        verifiedEv = verifyEvidenceQuote(ev, sourceText, sections, revision)
      }
      if (verifiedEv.verified) {
        verifiedCount++
      } else if (verifiedEv.state === "stale") {
        staleCount++
      } else {
        unverifiedCount++
      }
      return verifiedEv
    })

    const hasAnyVerifiedEvidence = verifiedEvidenceList.some((e) => e.verified)

    // 2. Epistemic status enforcement & claim calibration
    let epistemicStatus: EpistemicStatus = finding.epistemicStatus || "REVIEWER_JUDGMENT"
    let confidence = finding.confidence ?? 0.85
    let title = finding.title
    let explanation = finding.explanation

    if (epistemicStatus === "SUPPORTED_FACT") {
      if (!hasAnyVerifiedEvidence) {
        // Downgrade to REQUIRES_HUMAN_VERIFICATION or MISSING_EVIDENCE
        epistemicStatus = "REQUIRES_HUMAN_VERIFICATION"
        confidence = Math.min(confidence, 0.4)
        downgradedClaimsCount++
        diagnostics.push(`Tvrdenie "${title}" bolo prekvalifikované na REQUIRES_HUMAN_VERIFICATION pre absenciu doloženého citátu.`)
      }
    } else if (epistemicStatus === "SUPPORTED_INTERPRETATION") {
      if (!hasAnyVerifiedEvidence) {
        epistemicStatus = "REVIEWER_JUDGMENT"
        confidence = Math.min(confidence, 0.5)
        downgradedClaimsCount++
        diagnostics.push(`Interpretácia "${title}" bola znížená na REVIEWER_JUDGMENT (chýba verifikovaný zdrojový podklad).`)
      }
    } else if (epistemicStatus === "MISSING_EVIDENCE") {
      // Ensure cautious phrasing
      if (!explanation.toLowerCase().includes("nebolo možné jednoznačne") && !explanation.toLowerCase().includes("chýba") && !explanation.toLowerCase().includes("v texte sa nenachádza")) {
        explanation = `V analyzovanom texte nebolo možné jednoznačne overiť: ${explanation}`
      }
    }

    return {
      ...finding,
      epistemicStatus,
      confidence,
      title,
      explanation,
      evidence: verifiedEvidenceList,
      sourceRevision: currentRevision,
    }
  })

  return {
    isValid: downgradedClaimsCount === 0 && unverifiedCount === 0,
    verifiedCount,
    unverifiedCount,
    staleCount,
    downgradedClaimsCount,
    validatedFindings,
    diagnostics,
  }
}

// ---------------------------------------------------------------------------
// PaperQA2-style Context-Quote Grounding
// ---------------------------------------------------------------------------

// Starting value; needs empirical tuning.
export const SEMANTIC_MATCH_THRESHOLD = 0.6

export interface GroundedChunkResult {
  chunkId: string
  heading: string | null
  /** Sentence from the chunk that best supports the claim */
  anchorSentence: string
  /** Normalized lexical overlap or embedding similarity for the supporting sentence. */
  overlapScore: number
  verificationMethod: "approximate" | "semantic_embedding"
  /** Full chunk content (trimmed to 600 chars) */
  excerpt: string
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  return a.reduce((sum, value, index) => sum + value * b[index], 0)
}

/**
 * PaperQA2-style grounding: given a claim string and a list of retrieved RAG chunks,
 * finds the single best verbatim sentence from the corpus that supports the claim.
 *
 * Approach: lexical overlap first, then embeddings only for candidates in the
 * ambiguous band. This keeps the common case free of embedding latency.
 *
 * The returned `anchorSentence` is verbatim from the source — it can be
 * included directly in the review as a `quote` field to make hallucinations
 * structurally impossible (the LLM is forced to cite what it retrieved).
 *
 * Used by the review engine BEFORE generating text: retrieve → ground → generate.
 */
export async function groundClaimInChunks(
  claimText: string,
  chunks: Array<{ id: string; heading: string | null; content: string }>
): Promise<GroundedChunkResult | null> {
  if (!claimText || chunks.length === 0) return null

  // Tokenize claim
  const claimTokens = new Set(
    claimText.toLowerCase().replace(/[^\wÀ-žа-я]/g, " ").split(/\s+/).filter((t) => t.length > 3)
  )
  if (claimTokens.size === 0) return null

  const candidates: GroundedChunkResult[] = []

  for (const chunk of chunks) {
    // Split chunk into sentences
    const sentences = chunk.content
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20)

    for (const sentence of sentences) {
      const sentTokens = sentence.toLowerCase().replace(/[^\wÀ-žа-я]/g, " ").split(/\s+/).filter((t) => t.length > 3)
      if (sentTokens.length === 0) continue

      // Jaccard-style token overlap: intersection / claim tokens
      let hits = 0
      for (const t of sentTokens) if (claimTokens.has(t)) hits++
      const score = hits / claimTokens.size

      if (score > 0) {
        candidates.push({
          chunkId: chunk.id,
          heading: chunk.heading,
          anchorSentence: sentence,
          overlapScore: Math.round(score * 1000) / 1000,
          verificationMethod: "approximate",
          excerpt: chunk.content.slice(0, 600),
        })
      }
    }
  }

  if (candidates.length === 0) return null
  candidates.sort((a, b) => b.overlapScore - a.overlapScore)

  const bestLexical = candidates[0]
  if (bestLexical.overlapScore >= 0.15) return bestLexical
  if (bestLexical.overlapScore < 0.05) return null

  try {
    const { generateLocalEmbedding } = await import("./local-embeddings")
    const claimEmbedding = await generateLocalEmbedding(claimText)
    let bestSemantic: GroundedChunkResult | null = null

    // Starting value; needs empirical tuning. Restrict embedding work to the
    // strongest lexical candidates so every sentence is never embedded.
    const SEMANTIC_CANDIDATE_LIMIT = 5
    for (const candidate of candidates.slice(0, SEMANTIC_CANDIDATE_LIMIT)) {
      const similarity = cosineSimilarity(
        claimEmbedding,
        await generateLocalEmbedding(candidate.anchorSentence)
      )
      if (!bestSemantic || similarity > bestSemantic.overlapScore) {
        bestSemantic = {
          ...candidate,
          overlapScore: Math.round(similarity * 1000) / 1000,
          verificationMethod: "semantic_embedding",
        }
      }
    }

    if (bestSemantic && bestSemantic.overlapScore >= SEMANTIC_MATCH_THRESHOLD) {
      return bestSemantic
    }
  } catch (error) {
    console.warn("[groundClaimInChunks] Embedding verification unavailable:", error)
  }

  return null
}

/**
 * Formats grounded chunk results as a compact evidence block for the review LLM prompt.
 * Injected BEFORE the "write your assessment" instruction so the LLM can only
 * refer to what is shown — the PaperQA2 "evidence-first generation" pattern.
 */
export function formatGroundedEvidenceBlock(
  grounds: Array<GroundedChunkResult | null>,
  criterionLabel: string
): string {
  const valid = grounds.filter((g): g is GroundedChunkResult => g !== null && (
    g.overlapScore >= 0.15 || g.verificationMethod === "semantic_embedding"
  ))
  if (valid.length === 0) return ""

  const lines = [`[Retrieved Evidence for "${criterionLabel}" — quote verbatim from these passages]\n`]
  for (const g of valid.slice(0, 6)) {
    lines.push(`Section: ${g.heading || "—"}`)
    lines.push(`> "${g.anchorSentence}"`)
    const method = g.verificationMethod === "semantic_embedding" ? "semantic similarity" : "overlap"
    lines.push(`(Chunk ${g.chunkId.slice(0, 8)}, ${method}: ${Math.round(g.overlapScore * 100)}%)\n`)
  }
  lines.push("[End of retrieved evidence — do not fabricate citations outside the above]\n")
  return lines.join("\n")
}
