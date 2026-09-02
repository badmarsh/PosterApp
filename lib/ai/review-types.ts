/**
 * Types and definitions for the Expert Peer & Thesis Review Workspace.
 *
 * Supports both:
 * 1. Academic Thesis Reviews (BSc, MSc, PhD — supervisor/opponent with ECTS scoring)
 * 2. Scientific Peer Reviews (Journals, Conferences, Grants — Major/Minor triage, reporting compliance, verdict)
 *
 * Implements COPE, EQUATOR Network (CONSORT 2025, PRISMA 2020, STROBE, ML Reproducibility), Nature, and PLOS standards.
 */

import type { ReviewLanguage, CriterionRating } from "./thesis-rubric"
import type { AuthorProfile, AcademicPaperResult, ThesisCitationAudit } from "@/lib/services/academic-connector"

export type ReviewKind = "thesis" | "paper" | "grant"
export type ReviewSeverity = "critical" | "major" | "minor" | "suggestion" | "info"
export type FindingStatus = "unreviewed" | "accepted" | "edited" | "rejected" | "resolved"
export type ReportingStandard = "consort" | "prisma" | "strobe" | "ml_reproducibility" | "none"

export interface PhdEnrichmentData {
  authorProfile?: AuthorProfile | null;
  sotaBenchmarking?: AcademicPaperResult[];
  statutoryClause?: string;
  defenseQuestionsExternal?: string[];
  citationAudit?: ThesisCitationAudit | null;
}

/**
 * Epistemic status of a finding or assertion to clearly separate fact, judgment, and missing data.
 */
export type EpistemicStatus =
  | "SUPPORTED_FACT"
  | "SUPPORTED_INTERPRETATION"
  | "REVIEWER_JUDGMENT"
  | "MISSING_EVIDENCE"
  | "POSSIBLE_RISK"
  | "REQUIRES_HUMAN_VERIFICATION"

export type EvidenceType =
  | "quote"
  | "section_summary"
  | "structural_signal"
  | "metadata"
  | "citation_record"
  | "retrieval_result"

export type EvidenceState =
  | "verified-exact"
  | "verified-normalized"
  | "approximate"
  | "unverified"
  | "stale"
  | "ambiguous"
  | "verified" // backward compat alias for verified-exact

export type FindingAudience = "author" | "editor" | "committee" | "private"

export interface EvidenceReference {
  id?: string
  evidenceType?: EvidenceType
  sourceDocumentId?: string
  sourceRevision?: string
  chunkId?: string
  documentId?: string
  revision?: string
  page?: number
  pageNumber?: number // Verified page number if supplied by parser
  sectionHeading?: string
  sectionTitle?: string
  quote: string
  exactQuote?: string
  normalizedSummary?: string
  relevanceExplanation?: string
  confidence?: number
  startOffset?: number
  endOffset?: number
  verified?: boolean
  state?: EvidenceState
  verificationMethod?: "exact" | "whitespace_normalized" | "approximate" | "structural" | "manual"
  staleAt?: string
  createdAt?: string
}

export type FindingType =
  | "strength"
  | "weakness"
  | "risk"
  | "missing_evidence"
  | "question"
  | "recommendation"

export interface ReviewFinding {
  id: string
  criterionId?: string
  criterionKey?: string
  category: "methodology" | "results" | "statistics" | "literature" | "reproducibility" | "ethics" | "formal"
  title: string
  findingType?: FindingType
  epistemicStatus?: EpistemicStatus
  aiDraft?: string
  explanation: string
  recommendation: string
  suggestedRevision?: string
  severity: ReviewSeverity
  confidence: number // 0.0 - 1.0
  impact?: string
  evidence: EvidenceReference[]
  evidenceState?: EvidenceState
  status: FindingStatus
  decisionStatus?: "open" | "accepted" | "dismissed" | "edited" | "needs_human_review"
  humanRationale?: string
  source?: "ai" | "reviewer" | "checklist"
  audience?: FindingAudience
  reviewerNotes?: string
  resolutionNotes?: string
  duplicateGroup?: string
  sourceRevision?: string
  includeInExport: boolean
  createdBy: "ai" | "reviewer"
  createdAt?: string
  updatedAt?: string
}

export interface CriterionAssessment {
  criterionKey: string
  applicability: "applicable" | "partially_applicable" | "not_applicable" | "unknown"
  score?: number
  scoreRange?: { min: number; max: number }
  confidence: "low" | "medium" | "high" | number
  rationale: string
  strengthsSummary: string[]
  weaknessesSummary: string[]
  evidenceCoverage: "insufficient" | "partial" | "adequate" | "strong"
  requiresHumanReview: boolean
  sourceRevision?: string
}

export interface ReviewDefenseQuestion {
  id: string
  linkedCriterionKey?: string
  question: string
  motivation: string
  evidenceIds: string[]
  priority: "high" | "medium" | "low"
  category: "clarification" | "methodology" | "validation" | "interpretation" | "limitation" | "contribution"
  expectedAnswerBasis?: string
  requiresHumanVerification?: boolean
  decisionStatus?: "accepted" | "edited" | "dismissed"
  includeInExport: boolean
}

export interface ReportingGuidelineCheck {
  id?: string
  item: string
  category: string
  status: "compliant" | "partial" | "missing" | "not_applicable"
  notes: string
  evidenceQuote?: string
  provenance?: "ai" | "reviewer"
  guideline?: string
  version?: string
}

export interface ReviewParseWarning {
  field: string
  code: string
  message: string
}

export interface ReviewParseDiagnostics {
  corruptedFields: string[]
  parseWarnings: string[]
  unverifiedEvidenceCount: number
  staleEvidenceCount: number
  migratedFromVersion?: number
}

export type ReviewDiagnostics = ReviewParseDiagnostics

export interface ReviewSourceBlock {
  id: string
  page?: number
  section?: string
  text: string
}

export interface ReviewSourceDocument {
  documentId: string
  revision: string
  title: string
  language?: string
  fullText: string
  blocks: ReviewSourceBlock[]
  totalChars: number
  files?: Array<{ filename: string; content: string; length: number }>
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

  // Outcomes & Decision Support
  suggestedGrade?: CriterionRating | string | null
  finalGrade?: CriterionRating | string | null
  suggestedRecommendation?: string | null
  finalRecommendation?: string | null
  recommendation: string // legacy / confirmed recommendation
  grade?: CriterionRating | string // legacy / confirmed ECTS grade

  diagnostics?: ReviewDiagnostics

  debateLog?: string | null
  confirmedAt?: string | null
  confirmedBy?: string | null

  phdEnrichment?: PhdEnrichmentData | null

  createdAt: string
  updatedAt: string
}

export const PEER_REVIEW_SEVERITY_LABELS: Record<ReviewLanguage, Record<ReviewSeverity, { label: string; description: string }>> = {
  sk: {
    critical: { label: "Kritická chyba", description: "Závažné metodologické alebo etické pochybenie brániace publikácii" },
    major: { label: "Zásadná pripomienka", description: "Metodologický nedostatok alebo chýbajúce experimenty vyžadujúce podstatnú revíziu" },
    minor: { label: "Drobná pripomienka", description: "Formulačné, formálne alebo menšie vysvetľujúce doplnenia" },
    suggestion: { label: "Návrh / Odporúčanie", description: "Nezáväzné odporúčanie na zlepšenie do budúcna" },
    info: { label: "Informačná poznámka", description: "Neutrálne zistenie alebo kontextuálna poznámka" },
  },
  cs: {
    critical: { label: "Kritická chyba", description: "Závažné metodologické nebo etické pochybení bránící publikaci" },
    major: { label: "Zásadní připomínka", description: "Metodologický nedostatek nebo chybějící experimenty vyžadující podstatnou revizi" },
    minor: { label: "Drobná připomínka", description: "Formulační, formální nebo menší vysvětlující doplnění" },
    suggestion: { label: "Návrh / Doporučení", description: "Nezávazné doporučení pro zlepšení do budoucna" },
    info: { label: "Informační poznámka", description: "Neutrální zjištění nebo kontextuální poznámka" },
  },
  en: {
    critical: { label: "Critical Flaw", description: "Fatal methodological or ethical issue that precludes acceptance" },
    major: { label: "Major Concern", description: "Methodological gap or missing experiments requiring substantial revision" },
    minor: { label: "Minor Concern", description: "Clarifications, typographical issues, or minor textual refinements" },
    suggestion: { label: "Suggestion", description: "Optional recommendation for future improvement" },
    info: { label: "Informational", description: "Neutral contextual note or observation" },
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
    name: "AI-assisted general review pre-check",
    description: "General academic and methodology assessment without specific clinical/reporting framework",
    itemsCount: 0,
  },
}

export type StudyDesign = "empirical" | "theoretical" | "systematic_review" | "methodological" | "unknown"

export interface AnalysisPlanSection {
  id: string
  heading: string
  charCount: number
  wordCount?: number
  status: "found" | "empty" | "missing"
}

export interface TOCNode {
  id: string
  title: string
  level: number
  wordCount: number
  percentOfTotal: number
  kind: "preamble" | "introduction" | "literature" | "methodology" | "results" | "discussion" | "conclusion" | "references" | "appendix" | "unknown"
  isEmpty: boolean
  hasWarning?: boolean
  children: TOCNode[]
}

export interface AcademicMetricsReport {
  balance: {
    theoryWordCount: number
    practicalWordCount: number
    formalWordCount: number
    theoryRatio: number // 0.0 - 1.0
    practicalRatio: number // 0.0 - 1.0
    targetBenchmark: { theoryRatio: number; practicalRatio: number; label: string }
    status: "balanced" | "theory_heavy" | "practical_heavy" | "unclear"
    summary: string
  }
  lexical: {
    typeTokenRatio: number // 0.0 - 1.0
    vocabularyRichness: "high" | "moderate" | "low"
    hapaxLegomenaRatio: number // 0.0 - 1.0
    avgSentenceLengthWords: number
    avgWordLengthChars: number
    academicFormalityScore: number // 0 - 100
    hedgingRatioPer1000: number
    detectedFirstPersonPronounsCount: number
  }
  citations: {
    totalReferences: number
    inTextCitationsCount: number
    citationsPer1000Words: number
    medianPublicationYear: number | null
    recency5YearsRatio: number // 0.0 - 1.0
    recencyStatus: "fresh" | "adequate" | "outdated" | "no_data"
    decadeBreakdown: Record<string, number>
    sourceTypesBreakdown: Record<string, number>
  }
  crossReferencing: {
    figuresTotal: number
    figuresReferenced: number
    figuresOrphaned: number
    tablesTotal: number
    tablesReferenced: number
    tablesOrphaned: number
    integrityScore: number // 0 - 100
    orphanedItems: string[]
  }
  formalization: {
    equationsCount: number
    codeBlocksCount: number
    equationsDensityPer10k: number
    codeDensityPer10k: number
    technicalRigorLevel: "high" | "medium" | "low" | "none"
  }
  imrad: {
    phases: Array<{
      key: string
      name: string
      status: "complete" | "partial" | "missing"
      wordCount: number
      percentage: number
    }>
    completenessScore: number // 0 - 100
  }
}

export interface ReviewAnalysisPlan {
  documentTitle: string
  detectedType: ReviewKind
  language: ReviewLanguage
  discipline: string
  studyDesign: StudyDesign
  detectedSections: AnalysisPlanSection[]
  extractionQuality: "high" | "medium" | "low"
  hasTablesAndFigures: boolean
  citationAvailability: "rich" | "moderate" | "sparse" | "none"
  expectedMissingSections: string[]
  recommendedRubric: string
  recommendedReportingGuideline: ReportingStandard
  guidelineReason?: string
  limitations: string[]
  canProceedToDeepReview: boolean
  sourceRevision?: string
  detailedThesisType?: string
  qualityReport?: {
    sourceRevision: string
    totalChars: number
    totalWords: number
    sectionCount: number
    extractionQuality: "high" | "medium" | "low"
    canProceedToDeepReview: boolean
    warnings: string[]
    limitations: string[]
    signals: Array<{
      id: string
      label: string
      value: string | number | boolean
      status: "good" | "warning" | "caution" | "info"
      category: "structure" | "citations" | "content" | "integrity"
      signalType: "deterministic" | "heuristic" | "requires_human_verification"
      description: string
    }>
  }
  classification?: {
    primaryDiscipline: string
    secondaryDisciplines: string[]
    thesisType: string
    confidence: number
    rationale: string
    sourceAnchors: string[]
  }
  disciplineScoreBreakdown?: Array<{
    name: string
    score: number
    confidence: number
    tags: string[]
  }>
  applicableCriteria?: Array<{
    criterionKey: string
    label: string
    weight: number
    applicability: "applicable" | "partially_applicable" | "not_applicable"
  }>
  metrics?: AcademicMetricsReport
  tocTree?: TOCNode[]
}
