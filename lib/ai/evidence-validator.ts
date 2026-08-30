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

  // 3. Approximate match for long quotes (> 35 characters)
  if (cleanQuote.length > 35) {
    const prefix = cleanQuote.slice(0, 35)
    if (normSource.includes(prefix)) {
      const matchedSec = sections.find((s) => normalizeWhitespace(s.content).includes(prefix))
      return {
        ...evidence,
        quote,
        sectionHeading: evidence.sectionHeading || matchedSec?.heading,
        sectionTitle: evidence.sectionTitle || matchedSec?.heading,
        verified: false,
        state: "approximate",
        confidence: 0.7,
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
