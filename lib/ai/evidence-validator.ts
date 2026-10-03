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

import { createHash } from "crypto"
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
  pageStart?: number | null
  pageEnd?: number | null
}

/** Stable, opaque display anchor derived solely from the persistent chunk ID. */
export function stableEvidenceAnchor(chunkId: string): string {
  return `c-${createHash("sha256").update(chunkId, "utf8").digest("hex").slice(0, 16)}`
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
function hasPhysicalPageBounds(source: { pageStart?: number | null; pageEnd?: number | null }): boolean {
  const start = source.pageStart
  const end = source.pageEnd ?? source.pageStart
  return Number.isInteger(start) && Number(start) > 0 && Number.isInteger(end) && Number(end) >= Number(start)
}

function validatedPage(evidence: EvidenceReference, source?: { pageStart?: number | null; pageEnd?: number | null }): number | undefined {
  if (!source || !hasPhysicalPageBounds(source)) return undefined
  const page = evidence.pageNumber ?? evidence.page
  const start = Number(source.pageStart)
  const end = Number(source.pageEnd ?? source.pageStart)
  return Number.isInteger(page) && Number(page) >= start && Number(page) <= end ? Number(page) : undefined
}

/** Strip parser/model page labels only when the source has no physical page range. */
function stripSyntheticPageHints(text: string): string {
  return text.replace(/\[\s*(?:page|página|strana|stránka)\s*[:#]?\s*\d{1,4}\s*\]\s*/giu, " ").trim()
}

/**
 * Verifies a chunk-anchored quote by exact lookup into the retrieved chunk map.
 * Empty/very short quotes are never accepted as proof. A 60-character prefix may
 * be reported as approximate, but is not treated as an exact verification.
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
      page: undefined,
      pageNumber: undefined,
      staleAt: new Date().toISOString(),
    }
  }

  const rawQuote = (evidence.quote || evidence.exactQuote || "").trim()
  const physicalPages = hasPhysicalPageBounds(chunk)
  const quote = physicalPages ? rawQuote : stripSyntheticPageHints(rawQuote)
  const content = physicalPages ? chunk.content : stripSyntheticPageHints(chunk.content)
  const normChunk = normalize(content)
  const normQuote = normalize(quote)

  if (normQuote.length < 12) {
    return {
      ...evidence,
      quote,
      verified: false,
      state: "unverified",
      confidence: 0.05,
      verificationMethod: "exact",
      page: undefined,
      pageNumber: undefined,
    }
  }

  const exactMatch = normChunk.includes(normQuote)
  const approximateMatch = !exactMatch && normQuote.length >= 60 && normChunk.includes(normQuote.slice(0, 60))
  if (!exactMatch && !approximateMatch) {
    return {
      ...evidence,
      quote,
      verified: false,
      state: "unverified",
      confidence: 0.05,
      verificationMethod: "exact",
      page: undefined,
      pageNumber: undefined,
    }
  }

  const page = validatedPage(evidence, chunk)
  return {
    ...evidence,
    quote,
    sourceDocumentId: evidence.sourceDocumentId ?? chunk.documentId,
    sectionHeading: evidence.sectionHeading ?? chunk.heading ?? undefined,
    sectionTitle: evidence.sectionTitle ?? chunk.heading ?? undefined,
    exactQuote: exactMatch ? (evidence.exactQuote ?? quote) : undefined,
    verified: exactMatch,
    state: exactMatch ? "verified-exact" : "approximate",
    confidence: exactMatch ? 1.0 : 0.45,
    verificationMethod: exactMatch ? "exact" : "approximate",
    page,
    pageNumber: page,
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
  sectionsOrRevision?: Array<{ id?: string; heading: string; content: string; pageStart?: number | null; pageEnd?: number | null }> | string,
  currentRevision?: string
): EvidenceReference {
  const evidence: EvidenceReference = typeof evidenceOrQuote === "string"
    ? { quote: evidenceOrQuote }
    : { ...evidenceOrQuote }

  const sections: Array<{ id?: string; heading: string; content: string; pageStart?: number | null; pageEnd?: number | null }> =
    Array.isArray(sectionsOrRevision) ? sectionsOrRevision : []
  const revision = typeof sectionsOrRevision === "string" ? sectionsOrRevision : currentRevision

  const rawQuote = evidence.quote || evidence.exactQuote || ""
  if (!rawQuote.trim()) {
    return {
      ...evidence,
      quote: "",
      verified: false,
      state: "unverified",
      confidence: 0.0,
      verificationMethod: "manual",
      page: undefined,
      pageNumber: undefined,
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

  const hasPhysicalSectionBounds = sections.some(hasPhysicalPageBounds)
  const cleanedQuote = hasPhysicalSectionBounds ? rawQuote.trim() : stripSyntheticPageHints(rawQuote)
  const sourceWithoutSyntheticHints = hasPhysicalSectionBounds ? sourceText : stripSyntheticPageHints(sourceText)
  if (!cleanedQuote.trim()) {
    return {
      ...evidence,
      quote: "",
      exactQuote: "",
      verified: false,
      state: "unverified",
      confidence: 0,
      verificationMethod: "manual",
      page: undefined,
      pageNumber: undefined,
    }
  }

  const views = sections.map((section) => {
    const physicalPages = hasPhysicalPageBounds(section)
    return {
      section,
      physicalPages,
      content: physicalPages ? section.content : stripSyntheticPageHints(section.content),
      quote: physicalPages ? rawQuote.trim() : stripSyntheticPageHints(rawQuote),
    }
  })

  // Prefer an exact match in a physically page-bounded section; only then use
  // cleaned text whose synthetic page hints cannot support a page assertion.
  const exactViews = views.filter((view) => view.quote.length > 0 && view.content.includes(view.quote))
  const exactView = exactViews[0]
  const exactSourceMatch = sourceWithoutSyntheticHints.includes(cleanedQuote)
  if (exactView || exactSourceMatch) {
    const matchedView = exactView
    const quote = matchedView?.quote ?? cleanedQuote
    const matchedSection = matchedView?.section
    const page = validatedPage(evidence, matchedSection)
    const pageTagRemoved = quote !== rawQuote.trim()
    const sourceForOffset = matchedView?.physicalPages ? sourceText : sourceWithoutSyntheticHints
    const idx = !pageTagRemoved && sourceForOffset.includes(quote) ? sourceForOffset.indexOf(quote) : undefined
    const isAmbiguous = exactViews.length > 1
    return {
      ...evidence,
      quote,
      exactQuote: quote,
      startOffset: idx !== undefined && idx >= 0 ? idx : undefined,
      endOffset: idx !== undefined && idx >= 0 ? idx + quote.length : undefined,
      sectionHeading: evidence.sectionHeading || matchedSection?.heading,
      sectionTitle: evidence.sectionTitle || matchedSection?.heading,
      verified: true,
      state: isAmbiguous ? "ambiguous" : "verified-exact",
      confidence: isAmbiguous ? 0.95 : 1.0,
      verificationMethod: "exact",
      page,
      pageNumber: page,
    }
  }

  // 2. Whitespace-normalized match search
  const normalizedViews = views.filter((view) =>
    view.quote.length > 0 && normalizeWhitespace(view.content).includes(normalizeWhitespace(view.quote))
  )
  const normalizedView = normalizedViews[0]
  const cleanQuote = normalizedView?.quote ?? cleanedQuote
  const normSource = normalizeWhitespace(sourceWithoutSyntheticHints)
  if (normalizedView || normSource.includes(normalizeWhitespace(cleanQuote))) {
    const matchedSection = normalizedView?.section
    const page = validatedPage(evidence, matchedSection)
    const pageTagRemoved = cleanQuote !== rawQuote.trim()
    const normIdx = !pageTagRemoved && normSource.includes(normalizeWhitespace(cleanQuote))
      ? normSource.indexOf(normalizeWhitespace(cleanQuote))
      : undefined
    const isAmbiguous = normalizedViews.length > 1
    return {
      ...evidence,
      quote: cleanQuote,
      startOffset: normIdx !== undefined && normIdx >= 0 ? normIdx : undefined,
      endOffset: normIdx !== undefined && normIdx >= 0 ? normIdx + normalizeWhitespace(cleanQuote).length : undefined,
      sectionHeading: evidence.sectionHeading || matchedSection?.heading,
      sectionTitle: evidence.sectionTitle || matchedSection?.heading,
      verified: true,
      state: isAmbiguous ? "ambiguous" : "verified-normalized",
      confidence: 0.95,
      verificationMethod: "whitespace_normalized",
      page,
      pageNumber: page,
    }
  }

  // 3. Approximate match requires at least 60 real source characters.
  // Confidence stays low and the reference is explicitly marked approximate.
  const approximateQuote = cleanedQuote
  const normalizedApproxQuote = normalizeWhitespace(approximateQuote)
  if (normalizedApproxQuote.length >= 60) {
    const prefix = normalizedApproxQuote.slice(0, 60)
    const approxViews = views.filter((view) => normalizeWhitespace(view.content).includes(prefix))
    if (approxViews.length > 0 || normSource.includes(prefix)) {
      const matchedView = approxViews[0]
      const matchedSection = matchedView?.section
      const page = validatedPage(evidence, matchedSection)
      const subIndex = normSource.includes(prefix) ? normSource.indexOf(prefix) : undefined
      return {
        ...evidence,
        quote: matchedView?.quote ?? approximateQuote,
        startOffset: subIndex !== undefined && subIndex >= 0 ? subIndex : undefined,
        endOffset: subIndex !== undefined && subIndex >= 0 ? subIndex + prefix.length : undefined,
        sectionHeading: evidence.sectionHeading || matchedSection?.heading,
        sectionTitle: evidence.sectionTitle || matchedSection?.heading,
        verified: false,
        state: "approximate",
        confidence: 0.45,
        verificationMethod: "approximate",
        page,
        pageNumber: page,
      }
    }
  }

  // 4. Unverified fallback. Unsupported page hints are never retained.
  return {
    ...evidence,
    quote: cleanedQuote,
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
  sectionsOrRevision?: Array<{ id?: string; heading: string; content: string; pageStart?: number | null; pageEnd?: number | null }> | string,
  currentRevision?: string,
  citedChunks?: CitedChunk[]
): EvidenceValidationResult {
  const sections: Array<{ id?: string; heading: string; content: string; pageStart?: number | null; pageEnd?: number | null }> =
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
    let includeInExport = finding.includeInExport
    let decisionStatus = finding.decisionStatus

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
    } else if (
      epistemicStatus === "MISSING_EVIDENCE" ||
      title.toLowerCase().startsWith("chýbaj") ||
      title.toLowerCase().startsWith("absencia") ||
      explanation.toLowerCase().includes("v poskytnutých úryvkoch textu chýba") ||
      explanation.toLowerCase().includes("v poskytnutých dátach chýba")
    ) {
      if (epistemicStatus !== "MISSING_EVIDENCE") {
        epistemicStatus = "MISSING_EVIDENCE"
      }
      // Absence is not established by an incomplete RAG search or by quoting an unrelated passage.
      // Any evidence quotes attached to an absence claim are at best illustrative context,
      // NOT verified proofs that the entire document lacks the section.
      for (const ev of verifiedEvidenceList) {
        ev.verified = false
        ev.state = "context-only"
      }
      // Absence is not established by a failed search. Keep the wording
      // conditional until a reviewer verifies the complete source.
      if (!explanation.toLowerCase().includes("nebolo možné jednoznačne") && !explanation.toLowerCase().includes("chýba") && !explanation.toLowerCase().includes("v texte sa nenachádza")) {
        explanation = `V analyzovanom texte nebolo možné jednoznačne overiť: ${explanation}`
      }
    }

    const humanApproved =
      finding.createdBy === "reviewer" ||
      finding.status === "accepted" ||
      finding.status === "edited" ||
      finding.status === "resolved" ||
      finding.decisionStatus === "accepted" ||
      finding.decisionStatus === "edited"
    const isAdverse =
      finding.findingType !== "strength" &&
      finding.severity !== "info"
    const unsupportedAdverseAiClaim =
      finding.createdBy === "ai" &&
      isAdverse &&
      !humanApproved &&
      (!hasAnyVerifiedEvidence || epistemicStatus === "MISSING_EVIDENCE")

    if (unsupportedAdverseAiClaim) {
      // Unsupported adverse claims remain visible in the review workspace for
      // human triage, but cannot leak into exports or automated grades.
      includeInExport = false
      decisionStatus = "needs_human_review"
      confidence = Math.min(confidence, 0.4)
      diagnostics.push(`Nepodložené negatívne zistenie "${title}" bolo vyradené z exportu a automatického hodnotenia.`)
    }

    return {
      ...finding,
      epistemicStatus,
      confidence,
      title,
      explanation,
      includeInExport,
      decisionStatus,
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
