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
  if (sourceText.includes(quote)) {
    const idx = sourceText.indexOf(quote)
    const matchedSec = sections.find((s) => s.content && s.content.includes(quote))
    return {
      ...evidence,
      quote,
      exactQuote: quote,
      startOffset: idx >= 0 ? idx : undefined,
      endOffset: idx >= 0 ? idx + quote.length : undefined,
      sectionHeading: evidence.sectionHeading || matchedSec?.heading,
      sectionTitle: evidence.sectionTitle || matchedSec?.heading,
      verified: true,
      state: "verified-exact",
      confidence: 1.0,
      verificationMethod: "exact",
      // Protect against synthetic page numbers: only keep if explicitly numeric and verified
      page: undefined,
      pageNumber: undefined,
    }
  }

  // 2. Whitespace-normalized match search
  if (normSource.includes(cleanQuote)) {
    const normIdx = normSource.indexOf(cleanQuote)
    const matchedSec = sections.find((s) => s.content && normalizeWhitespace(s.content).includes(cleanQuote))
    return {
      ...evidence,
      quote,
      startOffset: normIdx >= 0 ? normIdx : undefined,
      endOffset: normIdx >= 0 ? normIdx + quote.length : undefined,
      sectionHeading: evidence.sectionHeading || matchedSec?.heading,
      sectionTitle: evidence.sectionTitle || matchedSec?.heading,
      verified: true,
      state: "verified-normalized",
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
    if (normSource.includes(prefix)) {
      const matchedSec = sections.find((s) => normalizeWhitespace(s.content).includes(prefix))
      return {
        ...evidence,
        quote,
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
 */
export function validateAndCalibrateFindings(
  findings: ReviewFinding[],
  sourceText: string,
  sectionsOrRevision?: Array<{ id?: string; heading: string; content: string }> | string,
  currentRevision?: string
): EvidenceValidationResult {
  const sections: Array<{ id?: string; heading: string; content: string }> =
    Array.isArray(sectionsOrRevision) ? sectionsOrRevision : []
  const revision = typeof sectionsOrRevision === "string" ? sectionsOrRevision : currentRevision

  let verifiedCount = 0
  let unverifiedCount = 0
  let staleCount = 0
  let downgradedClaimsCount = 0
  const diagnostics: string[] = []

  const validatedFindings: ReviewFinding[] = findings.map((finding) => {
    // 1. Verify all evidence links
    const verifiedEvidenceList = (finding.evidence || []).map((ev) => {
      const verifiedEv = verifyEvidenceQuote(ev, sourceText, sections, revision)
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

export interface GroundedChunkResult {
  chunkId: string
  heading: string | null
  /** Sentence from the chunk that best supports the claim */
  anchorSentence: string
  /** Normalized overlap score between claim tokens and anchor sentence tokens */
  overlapScore: number
  /** Full chunk content (trimmed to 600 chars) */
  excerpt: string
}

/**
 * PaperQA2-style grounding: given a claim string and a list of retrieved RAG chunks,
 * finds the single best verbatim sentence from the corpus that supports the claim.
 *
 * Approach: token overlap scoring (no LLM, no API cost).
 * The returned `anchorSentence` is verbatim from the source — it can be
 * included directly in the review as a `quote` field to make hallucinations
 * structurally impossible (the LLM is forced to cite what it retrieved).
 *
 * Used by the review engine BEFORE generating text: retrieve → ground → generate.
 */
export function groundClaimInChunks(
  claimText: string,
  chunks: Array<{ id: string; heading: string | null; content: string }>
): GroundedChunkResult | null {
  if (!claimText || chunks.length === 0) return null

  // Tokenize claim
  const claimTokens = new Set(
    claimText.toLowerCase().replace(/[^\wÀ-žа-я]/g, " ").split(/\s+/).filter((t) => t.length > 3)
  )
  if (claimTokens.size === 0) return null

  let bestResult: GroundedChunkResult | null = null
  let bestScore = 0

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

      if (score > bestScore) {
        bestScore = score
        bestResult = {
          chunkId: chunk.id,
          heading: chunk.heading,
          anchorSentence: sentence,
          overlapScore: Math.round(score * 1000) / 1000,
          excerpt: chunk.content.slice(0, 600),
        }
      }
    }
  }

  // Require minimum overlap to avoid spurious anchoring
  return bestScore >= 0.15 ? bestResult : null
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
  const valid = grounds.filter((g): g is GroundedChunkResult => g !== null && g.overlapScore >= 0.15)
  if (valid.length === 0) return ""

  const lines = [`[Retrieved Evidence for "${criterionLabel}" — quote verbatim from these passages]\n`]
  for (const g of valid.slice(0, 6)) {
    lines.push(`Section: ${g.heading || "—"}`)
    lines.push(`> "${g.anchorSentence}"`)
    lines.push(`(Chunk ${g.chunkId.slice(0, 8)}, overlap: ${Math.round(g.overlapScore * 100)}%)\n`)
  }
  lines.push("[End of retrieved evidence — do not fabricate citations outside the above]\n")
  return lines.join("\n")
}
