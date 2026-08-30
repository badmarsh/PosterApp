import { z } from "zod"
import type {
  ReviewFinding,
  ReportingGuidelineCheck,
  ReviewSeverity,
  FindingStatus,
  ReviewKind,
  ReportingStandard,
} from "./review-types"
import type { ThesisSection } from "./thesis-rubric"
import {
  ReviewFindingContractSchema,
  ReportingGuidelineCheckContractSchema,
} from "./contracts"

export const REVIEW_SCHEMA_VERSION = 1
export const MAX_SERIALIZED_PAYLOAD_BYTES = 5 * 1024 * 1024 // 5 MB

export interface DeserializedThesisReview {
  id: string
  workspaceId: string
  studentName: string
  thesisTitle: string
  thesisType: string
  reviewerRole: string
  reviewerName: string | null
  institution: string | null
  department: string | null
  grade: string | null
  recommendation: string | null
  sections: ThesisSection[]
  defenseQuestions: string[]
  citationIssues: string[]
  reviewKind: ReviewKind
  targetVenue: string | null
  summary: string | null
  strengths: string[]
  findings: ReviewFinding[]
  reportingStandard: ReportingStandard
  reportingGuidelineChecks: ReportingGuidelineCheck[]
  confidentialComments: string | null
  status: string
  language: string
  schemaVersion: number
  createdAt: Date | string
  updatedAt: Date | string
}

/**
 * Safely parse a JSON string with a fallback value.
 * Never throws SyntaxError.
 */
export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw || typeof raw !== "string") return fallback
  try {
    const trimmed = raw.trim()
    if (!trimmed) return fallback
    return JSON.parse(trimmed) as T
  } catch {
    return fallback
  }
}

/**
 * Normalizes and validates an array of findings.
 * Ensures stable IDs, valid enums, and non-crashing fallbacks.
 */
export function normalizeFindings(raw: unknown): ReviewFinding[] {
  if (!Array.isArray(raw)) return []

  const validCategories = new Set([
    "methodology",
    "results",
    "statistics",
    "literature",
    "reproducibility",
    "ethics",
    "formal",
  ])
  const validSeverities = new Set(["critical", "major", "minor", "suggestion"])
  const validStatuses = new Set(["unreviewed", "accepted", "edited", "rejected", "resolved"])

  return raw
    .filter((item): item is Record<string, any> => item !== null && typeof item === "object")
    .map((f, idx): ReviewFinding => {
      const category = validCategories.has(String(f.category)) ? f.category : "methodology"
      const severity = validSeverities.has(String(f.severity)) ? f.severity : "minor"
      const status = validStatuses.has(String(f.status)) ? f.status : "unreviewed"
      const createdBy = f.createdBy === "reviewer" ? "reviewer" : "ai"

      const evidence = Array.isArray(f.evidence)
        ? f.evidence
            .filter((e: any) => e && typeof e === "object" && typeof e.quote === "string")
            .map((e: any) => ({
              id: e.id || `ev_${idx}_${Math.random().toString(36).slice(2, 7)}`,
              quote: String(e.quote).trim(),
              page: typeof e.page === "number" ? e.page : undefined,
              sectionHeading: e.sectionHeading ? String(e.sectionHeading).trim() : undefined,
              startOffset: typeof e.startOffset === "number" ? e.startOffset : undefined,
              endOffset: typeof e.endOffset === "number" ? e.endOffset : undefined,
              verified: Boolean(e.verified ?? false),
            }))
        : []

      return {
        id: String(f.id || `f_${idx + 1}_${Date.now().toString(36)}`),
        category,
        title: String(f.title || `Finding ${idx + 1}`).trim(),
        explanation: String(f.explanation || "").trim(),
        recommendation: String(f.recommendation || "").trim(),
        severity: severity as ReviewSeverity,
        confidence: typeof f.confidence === "number" && !isNaN(f.confidence) ? Math.min(1, Math.max(0, f.confidence)) : 0.8,
        evidence,
        status: status as FindingStatus,
        reviewerNotes: f.reviewerNotes ? String(f.reviewerNotes).trim() : undefined,
        includeInExport: f.includeInExport !== false,
        createdBy,
        createdAt: f.createdAt ? String(f.createdAt) : undefined,
        updatedAt: f.updatedAt ? String(f.updatedAt) : undefined,
      }
    })
}

/**
 * Normalizes reporting guideline checklist items.
 */
export function normalizeGuidelineChecks(raw: unknown): ReportingGuidelineCheck[] {
  if (!Array.isArray(raw)) return []
  const validStatuses = new Set(["compliant", "partial", "missing", "not_applicable"])

  return raw
    .filter((item): item is Record<string, any> => item !== null && typeof item === "object")
    .map((c): ReportingGuidelineCheck => {
      const status = validStatuses.has(String(c.status)) ? c.status : "compliant"
      return {
        item: String(c.item || c.name || "Check Item").trim(),
        category: String(c.category || "General").trim(),
        status: status as ReportingGuidelineCheck["status"],
        notes: String(c.notes || c.explanation || "").trim(),
        evidenceQuote: c.evidenceQuote ? String(c.evidenceQuote).trim() : undefined,
      }
    })
}

/**
 * Deserializes a database record of ThesisReview into typed domain format.
 * Never throws even on corrupted database records.
 */
export function deserializeThesisReview(dbRecord: any): DeserializedThesisReview {
  const sections = safeJsonParse<ThesisSection[]>(dbRecord.sections, [])
  const defenseQuestions = safeJsonParse<string[]>(dbRecord.defenseQuestions, [])
  const citationIssues = safeJsonParse<string[]>(dbRecord.citationIssues, [])
  const strengths = safeJsonParse<string[]>(dbRecord.strengths, [])
  const rawFindings = safeJsonParse<unknown[]>(dbRecord.findings, [])
  const rawChecks = safeJsonParse<unknown[]>(dbRecord.reportingGuidelineChecks, [])

  const validReviewKinds = new Set(["thesis", "paper", "grant"])
  const reviewKind: ReviewKind = validReviewKinds.has(String(dbRecord.reviewKind))
    ? (dbRecord.reviewKind as ReviewKind)
    : "thesis"

  const validStandards = new Set(["consort", "prisma", "strobe", "ml_reproducibility", "none"])
  const reportingStandard: ReportingStandard = validStandards.has(String(dbRecord.reportingStandard))
    ? (dbRecord.reportingStandard as ReportingStandard)
    : "none"

  return {
    id: String(dbRecord.id),
    workspaceId: String(dbRecord.workspaceId),
    studentName: String(dbRecord.studentName || ""),
    thesisTitle: String(dbRecord.thesisTitle || ""),
    thesisType: String(dbRecord.thesisType || "master"),
    reviewerRole: String(dbRecord.reviewerRole || "opponent"),
    reviewerName: dbRecord.reviewerName ? String(dbRecord.reviewerName) : null,
    institution: dbRecord.institution ? String(dbRecord.institution) : null,
    department: dbRecord.department ? String(dbRecord.department) : null,
    grade: dbRecord.grade ? String(dbRecord.grade) : null,
    recommendation: dbRecord.recommendation ? String(dbRecord.recommendation) : null,
    sections: Array.isArray(sections) ? sections : [],
    defenseQuestions: Array.isArray(defenseQuestions) ? defenseQuestions.map(String) : [],
    citationIssues: Array.isArray(citationIssues) ? citationIssues.map(String) : [],
    reviewKind,
    targetVenue: dbRecord.targetVenue ? String(dbRecord.targetVenue) : null,
    summary: dbRecord.summary ? String(dbRecord.summary) : null,
    strengths: Array.isArray(strengths) ? strengths.map(String) : [],
    findings: normalizeFindings(rawFindings),
    reportingStandard,
    reportingGuidelineChecks: normalizeGuidelineChecks(rawChecks),
    confidentialComments: dbRecord.confidentialComments ? String(dbRecord.confidentialComments) : null,
    status: String(dbRecord.status || "draft"),
    language: String(dbRecord.language || "sk"),
    schemaVersion: REVIEW_SCHEMA_VERSION,
    createdAt: dbRecord.createdAt,
    updatedAt: dbRecord.updatedAt,
  }
}

/**
 * Validates and serializes update payload for database persistence.
 */
export function serializeThesisReviewUpdate(data: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {}

  // Scalar fields
  const scalarKeys = [
    "studentName",
    "thesisTitle",
    "thesisType",
    "reviewerRole",
    "reviewerName",
    "institution",
    "department",
    "grade",
    "recommendation",
    "reviewKind",
    "targetVenue",
    "summary",
    "reportingStandard",
    "confidentialComments",
    "status",
    "language",
  ]
  for (const k of scalarKeys) {
    if (data[k] !== undefined) {
      result[k] = data[k]
    }
  }

  // JSON serialized fields with length and structure validation
  if (data.sections !== undefined) {
    const raw = typeof data.sections === "string" ? data.sections : JSON.stringify(data.sections)
    if (raw.length > MAX_SERIALIZED_PAYLOAD_BYTES) {
      throw new Error("Payload size limit exceeded for sections")
    }
    result.sections = raw
  }

  if (data.defenseQuestions !== undefined) {
    const raw = typeof data.defenseQuestions === "string" ? data.defenseQuestions : JSON.stringify(data.defenseQuestions)
    if (raw.length > MAX_SERIALIZED_PAYLOAD_BYTES) {
      throw new Error("Payload size limit exceeded for defenseQuestions")
    }
    result.defenseQuestions = raw
  }

  if (data.citationIssues !== undefined) {
    const raw = typeof data.citationIssues === "string" ? data.citationIssues : JSON.stringify(data.citationIssues)
    result.citationIssues = raw
  }

  if (data.strengths !== undefined) {
    const raw = typeof data.strengths === "string" ? data.strengths : JSON.stringify(data.strengths)
    result.strengths = raw
  }

  if (data.findings !== undefined) {
    const parsed = typeof data.findings === "string" ? safeJsonParse(data.findings, []) : data.findings
    const normalized = normalizeFindings(parsed)
    const raw = JSON.stringify(normalized)
    if (raw.length > MAX_SERIALIZED_PAYLOAD_BYTES) {
      throw new Error("Payload size limit exceeded for findings")
    }
    result.findings = raw
  }

  if (data.reportingGuidelineChecks !== undefined) {
    const parsed = typeof data.reportingGuidelineChecks === "string" ? safeJsonParse(data.reportingGuidelineChecks, []) : data.reportingGuidelineChecks
    const normalized = normalizeGuidelineChecks(parsed)
    result.reportingGuidelineChecks = JSON.stringify(normalized)
  }

  return result
}
