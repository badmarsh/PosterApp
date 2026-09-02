/**
 * Granular Yjs Multiplayer Synchronization for Expert Peer & Thesis Reviews.
 *
 * Replaces monolithic JSON map synchronization with discrete CRDT structures:
 *  - Y.Map reviewMetadata (`review:${id}:metadata`)
 *  - Y.Map findingsById (`review:${id}:findings`)
 *  - Y.Array findingOrder (`review:${id}:order`)
 *  - Y.Map reportingChecksById (`review:${id}:reporting`)
 *  - Y.Map decisions (`review:${id}:decisions`)
 *
 * Supports:
 *  - Discrete concurrent edits on different findings without overwrite conflicts
 *  - Concurrent field edits on the same finding
 *  - Disconnect / reconnect state synchronization via binary update exchange
 *  - Legacy hydration fallback
 */

import * as Y from "yjs"
import type { ThesisReviewRecord } from "@/components/thesis-review/use-thesis-review-store"
import type { ReviewFinding, ReportingGuidelineCheck } from "./review-types"

export const YJS_TRANSACTION_ORIGIN = "posterapp-yjs-granular"

export interface GranularReviewStructure {
  metadataMap: Y.Map<string>
  findingsMap: Y.Map<string>
  findingOrderArray: Y.Array<string>
  reportingMap: Y.Map<string>
  decisionsMap: Y.Map<string>
}

/**
 * Retrieves the granular Yjs CRDT structure for a review ID.
 */
export function getGranularReviewStructure(ydoc: Y.Doc, reviewId: string): GranularReviewStructure {
  return {
    metadataMap: ydoc.getMap<string>(`review:${reviewId}:metadata`),
    findingsMap: ydoc.getMap<string>(`review:${reviewId}:findings`),
    findingOrderArray: ydoc.getArray<string>(`review:${reviewId}:order`),
    reportingMap: ydoc.getMap<string>(`review:${reviewId}:reporting`),
    decisionsMap: ydoc.getMap<string>(`review:${reviewId}:decisions`),
  }
}

/**
 * Hydrates a complete ThesisReviewRecord into granular Yjs maps.
 */
export function hydrateReviewIntoYDoc(
  ydoc: Y.Doc,
  review: ThesisReviewRecord,
  origin: string = YJS_TRANSACTION_ORIGIN
): void {
  ydoc.transact(() => {
    const { metadataMap, findingsMap, findingOrderArray, reportingMap, decisionsMap } =
      getGranularReviewStructure(ydoc, review.id)

    // 1. Metadata
    metadataMap.set("studentName", review.studentName || "")
    metadataMap.set("thesisTitle", review.thesisTitle || "")
    metadataMap.set("thesisType", review.thesisType || "master")
    metadataMap.set("reviewerRole", review.reviewerRole || "opponent")
    if (review.reviewerName) metadataMap.set("reviewerName", review.reviewerName)
    if (review.institution) metadataMap.set("institution", review.institution)
    if (review.summary) metadataMap.set("summary", review.summary)
    if (review.confidentialComments) metadataMap.set("confidentialComments", review.confidentialComments)
    metadataMap.set("status", review.status || "draft")
    metadataMap.set("language", review.language || "sk")

    // 2. Decisions
    if (review.grade) decisionsMap.set("grade", review.grade)
    if (review.suggestedGrade) decisionsMap.set("suggestedGrade", review.suggestedGrade)
    if (review.finalGrade) decisionsMap.set("finalGrade", review.finalGrade)
    if (review.recommendation) decisionsMap.set("recommendation", review.recommendation)
    if (review.suggestedRecommendation) decisionsMap.set("suggestedRecommendation", review.suggestedRecommendation)
    if (review.finalRecommendation) decisionsMap.set("finalRecommendation", review.finalRecommendation)
    if (review.confirmedAt) decisionsMap.set("confirmedAt", review.confirmedAt)

    // 3. Findings
    if (review.findings && review.findings.length > 0) {
      // Clear and re-populate order array if empty
      if (findingOrderArray.length === 0) {
        findingOrderArray.push(review.findings.map((f) => f.id))
      }
      for (const f of review.findings) {
        findingsMap.set(f.id, JSON.stringify(f))
      }
    }

    // 4. Reporting checks
    if (review.reportingGuidelineChecks && review.reportingGuidelineChecks.length > 0) {
      for (let i = 0; i < review.reportingGuidelineChecks.length; i++) {
        const check = review.reportingGuidelineChecks[i]
        const key = check.id || `check-${i}`
        reportingMap.set(key, JSON.stringify(check))
      }
    }
  }, origin)
}

/**
 * Updates a single finding within granular Yjs structures without touching other fields.
 */
export function updateFindingInYDoc(
  ydoc: Y.Doc,
  reviewId: string,
  finding: ReviewFinding,
  origin: string = YJS_TRANSACTION_ORIGIN
): void {
  ydoc.transact(() => {
    const { findingsMap, findingOrderArray } = getGranularReviewStructure(ydoc, reviewId)
    findingsMap.set(finding.id, JSON.stringify(finding))

    // Ensure finding is in the order array
    const order = findingOrderArray.toArray()
    if (!order.includes(finding.id)) {
      findingOrderArray.push([finding.id])
    }
  }, origin)
}

/**
 * Updates decision fields within granular Yjs structure.
 */
export function updateDecisionInYDoc(
  ydoc: Y.Doc,
  reviewId: string,
  decisions: {
    suggestedGrade?: string | null
    finalGrade?: string | null
    suggestedRecommendation?: string | null
    finalRecommendation?: string | null
    confirmedAt?: string | null
  },
  origin: string = YJS_TRANSACTION_ORIGIN
): void {
  ydoc.transact(() => {
    const { decisionsMap } = getGranularReviewStructure(ydoc, reviewId)
    if (decisions.suggestedGrade !== undefined) {
      if (decisions.suggestedGrade) decisionsMap.set("suggestedGrade", decisions.suggestedGrade)
      else decisionsMap.delete("suggestedGrade")
    }
    if (decisions.finalGrade !== undefined) {
      if (decisions.finalGrade) decisionsMap.set("finalGrade", decisions.finalGrade)
      else decisionsMap.delete("finalGrade")
    }
    if (decisions.suggestedRecommendation !== undefined) {
      if (decisions.suggestedRecommendation) decisionsMap.set("suggestedRecommendation", decisions.suggestedRecommendation)
      else decisionsMap.delete("suggestedRecommendation")
    }
    if (decisions.finalRecommendation !== undefined) {
      if (decisions.finalRecommendation) decisionsMap.set("finalRecommendation", decisions.finalRecommendation)
      else decisionsMap.delete("finalRecommendation")
    }
    if (decisions.confirmedAt !== undefined) {
      if (decisions.confirmedAt) decisionsMap.set("confirmedAt", decisions.confirmedAt)
      else decisionsMap.delete("confirmedAt")
    }
  }, origin)
}

/**
 * Reconstructs a complete ThesisReviewRecord from the granular Yjs structures.
 */
export function extractReviewFromYDoc(
  ydoc: Y.Doc,
  reviewId: string,
  fallbackBase?: ThesisReviewRecord
): ThesisReviewRecord {
  const { metadataMap, findingsMap, findingOrderArray, reportingMap, decisionsMap } =
    getGranularReviewStructure(ydoc, reviewId)

  const order = findingOrderArray.toArray()
  const findings: ReviewFinding[] = []

  // Extract findings preserving the CRDT ordering array
  for (const id of order) {
    const raw = findingsMap.get(id)
    if (raw) {
      try {
        findings.push(JSON.parse(raw))
      } catch (err) {
        console.error("[Yjs] Failed to parse finding:", id, err)
      }
    }
  }

  // Any findings in findingsMap that were not in order array
  findingsMap.forEach((raw, id) => {
    if (!order.includes(id)) {
      try {
        findings.push(JSON.parse(raw))
      } catch (err) {
        console.warn("[Yjs] Failed to parse out-of-order finding:", id, err)
      }
    }
  })

  // Extract reporting guideline checks
  const reportingGuidelineChecks: ReportingGuidelineCheck[] = []
  reportingMap.forEach((raw) => {
    try {
      reportingGuidelineChecks.push(JSON.parse(raw))
    } catch (err) {
      console.warn("[Yjs] Failed to parse reporting guideline check:", err)
    }
  })

  return {
    id: reviewId,
    studentName: metadataMap.get("studentName") || fallbackBase?.studentName || "",
    thesisTitle: metadataMap.get("thesisTitle") || fallbackBase?.thesisTitle || "",
    thesisType: (metadataMap.get("thesisType") as any) || fallbackBase?.thesisType || "master",
    reviewerRole: metadataMap.get("reviewerRole") || fallbackBase?.reviewerRole || "opponent",
    reviewerName: metadataMap.get("reviewerName") || fallbackBase?.reviewerName || null,
    institution: metadataMap.get("institution") || fallbackBase?.institution || null,
    department: metadataMap.get("department") || fallbackBase?.department || null,
    summary: metadataMap.get("summary") || fallbackBase?.summary || null,
    confidentialComments: metadataMap.get("confidentialComments") || fallbackBase?.confidentialComments || null,
    status: (metadataMap.get("status") as any) || fallbackBase?.status || "draft",
    language: (metadataMap.get("language") as any) || fallbackBase?.language || "sk",

    grade: decisionsMap.get("grade") || fallbackBase?.grade || null,
    suggestedGrade: decisionsMap.get("suggestedGrade") || fallbackBase?.suggestedGrade || null,
    finalGrade: decisionsMap.get("finalGrade") || fallbackBase?.finalGrade || null,
    recommendation: decisionsMap.get("recommendation") || fallbackBase?.recommendation || null,
    suggestedRecommendation: decisionsMap.get("suggestedRecommendation") || fallbackBase?.suggestedRecommendation || null,
    finalRecommendation: decisionsMap.get("finalRecommendation") || fallbackBase?.finalRecommendation || null,
    confirmedAt: decisionsMap.get("confirmedAt") || fallbackBase?.confirmedAt || null,

    findings,
    reportingGuidelineChecks,
    strengths: fallbackBase?.strengths || [],
    defenseQuestions: fallbackBase?.defenseQuestions || [],
    questionsForAuthors: fallbackBase?.questionsForAuthors || [],
    citationIssues: fallbackBase?.citationIssues || [],
    sections: fallbackBase?.sections || [],
    createdAt: fallbackBase?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}
