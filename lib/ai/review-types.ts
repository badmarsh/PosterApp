/**
 * Types and definitions for the Expert Peer & Thesis Review Workspace.
 *
 * Supports both:
 * 1. Academic Thesis Reviews (BSc, MSc, PhD — supervisor/opponent with ECTS scoring)
 * 2. Scientific Peer Reviews (Journals, Conferences, Grants — Major/Minor triage, reporting compliance, verdict)
 *
 * Implements COPE, EQUATOR Network (CONSORT 2025, PRISMA 2020, STROBE), Nature, and PLOS standards.
 */

import type { ReviewLanguage, CriterionRating } from "./thesis-rubric"

export type ReviewKind = "thesis" | "paper" | "grant"
export type ReviewSeverity = "critical" | "major" | "minor" | "suggestion"
export type FindingStatus = "unreviewed" | "accepted" | "edited" | "rejected" | "resolved"
export type ReportingStandard = "consort" | "prisma" | "strobe" | "ml_reproducibility" | "none"

export interface EvidenceReference {
  id?: string
  page?: number
  sectionHeading?: string
  quote: string
  startOffset?: number
  endOffset?: number
  verified?: boolean
}

export interface ReviewFinding {
  id: string
  category: "methodology" | "results" | "statistics" | "literature" | "reproducibility" | "ethics" | "formal"
  title: string
  explanation: string
  recommendation: string
  severity: ReviewSeverity
  confidence: number // 0.0 - 1.0
  evidence: EvidenceReference[]
  status: FindingStatus
  reviewerNotes?: string
  includeInExport: boolean
  createdBy: "ai" | "reviewer"
  createdAt?: string
  updatedAt?: string
}

export interface ReportingGuidelineCheck {
  item: string
  category: string
  status: "compliant" | "partial" | "missing" | "not_applicable"
  notes: string
  evidenceQuote?: string
}

export interface ProfessionalReviewRecord {
  id: string
  workspaceId: string
  documentTitle: string
  authorName: string
  reviewKind: ReviewKind
  targetVenue?: string // Journal, conference or university name
  reviewerRole: "supervisor" | "opponent" | "peer_reviewer" | "editor"
  reviewerName?: string
  institution?: string
  department?: string
  language: ReviewLanguage
  status: "draft" | "in_review" | "final"
  
  // Executive summaries
  summary: string
  strengths: string[]
  
  // Structured findings
  findings: ReviewFinding[]
  
  // Reporting checklist items
  reportingStandard: ReportingStandard
  reportingGuidelineChecks: ReportingGuidelineCheck[]
  
  // Questions & specific remarks
  questionsForAuthors: string[]
  confidentialComments?: string
  
  // Outcomes
  recommendation: string // e.g. "accept" | "minor_revisions" | "major_revisions" | "reject" | "obhajoba_odporucana"
  grade?: CriterionRating | string // ECTS grade (A-FX) for thesis reviews
  
  createdAt: string
  updatedAt: string
}

export const PEER_REVIEW_SEVERITY_LABELS: Record<ReviewLanguage, Record<ReviewSeverity, { label: string; description: string }>> = {
  sk: {
    critical: { label: "Kritická chyba", description: "Závažné metodologické alebo etické pochybenie brániace publikácii" },
    major: { label: "Zásadná pripomienka", description: "Metodologický nedostatok alebo chýbajúce experimenty vyžadujúce podstatnú revíziu" },
    minor: { label: "Drobná pripomienka", description: "Formulačné, formálne alebo menšie vysvetľujúce doplnenia" },
    suggestion: { label: "Návrh / Odporúčanie", description: "Nezáväzné odporúčanie na zlepšenie do budúcna" },
  },
  cs: {
    critical: { label: "Kritická chyba", description: "Závažné metodologické nebo etické pochybení bránící publikaci" },
    major: { label: "Zásadní připomínka", description: "Metodologický nedostatek nebo chybějící experimenty vyžadující podstatnou revizi" },
    minor: { label: "Drobná připomínka", description: "Formulační, formální nebo menší vysvětlující doplnění" },
    suggestion: { label: "Návrh / Doporučení", description: "Nezávazné doporučení pro zlepšení do budoucna" },
  },
  en: {
    critical: { label: "Critical Flaw", description: "Fatal methodological or ethical issue that precludes acceptance" },
    major: { label: "Major Concern", description: "Methodological gap or missing experiments requiring substantial revision" },
    minor: { label: "Minor Concern", description: "Clarifications, typographical issues, or minor textual refinements" },
    suggestion: { label: "Suggestion", description: "Optional recommendation for future improvement" },
  },
}

export const REPORTING_STANDARDS_INFO: Record<ReportingStandard, { name: string; description: string; itemsCount: number }> = {
  consort: {
    name: "CONSORT 2025",
    description: "Randomized controlled trials (randomization, blinding, primary outcome fidelity, trial registration)",
    itemsCount: 12,
  },
  prisma: {
    name: "PRISMA 2020",
    description: "Systematic reviews and meta-analyses (multi-database search, risk of bias, heterogeneity, flow diagram)",
    itemsCount: 12,
  },
  strobe: {
    name: "STROBE",
    description: "Observational studies (cohort, case-control, cross-sectional design, confounding variables)",
    itemsCount: 10,
  },
  ml_reproducibility: {
    name: "ML Reproducibility Checklist",
    description: "Machine learning research (model architecture, hyperparameters, random seeds, open data & code)",
    itemsCount: 10,
  },
  none: {
    name: "Standard General Review",
    description: "General academic and methodology assessment without specific clinical/reporting framework",
    itemsCount: 0,
  },
}
