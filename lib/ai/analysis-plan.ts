import { loadThesisContext, type ThesisRAGContext } from "./thesis-context"
import type {
  ReviewAnalysisPlan,
  AnalysisPlanSection,
  StudyDesign,
  ReportingStandard,
  ReviewKind,
} from "./review-types"
import type { ReviewLanguage, ThesisMetadata } from "./thesis-rubric"
import {
  extractDocumentStructure,
  buildSourceQualityReport,
  classifyDisciplineAndThesisType,
  computeAcademicMetrics,
  buildTOCTree,
} from "./document-understanding"
import {
  SK_ACADEMIC_RUBRIC_V1,
  getApplicableCriteriaForThesisType,
} from "./rubric-engine"

export interface GenerateAnalysisPlanOptions {
  workspaceId: string
  sourceFileId?: string
  thesisMetadata: ThesisMetadata & {
    reviewKind?: ReviewKind
    targetVenue?: string
    reportingStandard?: ReportingStandard
  }
}

/**
 * Deterministically analyzes extracted manuscript content and generates an actionable ReviewAnalysisPlan.
 */
export async function generateReviewAnalysisPlan(
  options: GenerateAnalysisPlanOptions
): Promise<ReviewAnalysisPlan> {
  const { workspaceId, sourceFileId, thesisMetadata } = options
  const lang: ReviewLanguage = thesisMetadata.language || "sk"

  const rag = await loadThesisContext({
    workspaceId,
    sourceFileId,
    thesisMetadata,
    maxChars: 120_000,
  })

  return buildAnalysisPlanFromRAG(rag, thesisMetadata, lang)
}

export function buildAnalysisPlanFromRAG(
  rag: ThesisRAGContext,
  metadata: {
    thesisTitle?: string
    studentName?: string
    department?: string
    institution?: string
    reviewKind?: ReviewKind
    thesisType?: string
  },
  lang: ReviewLanguage = "sk"
): ReviewAnalysisPlan {
  const sectionsContent = rag.sections && rag.sections.length > 0
    ? rag.sections.map((s) => `## ${s.heading}\n\n${s.content}`).join("\n\n")
    : ""
  const markdown = (rag.fullText && rag.fullText.length > 50)
    ? rag.fullText
    : sectionsContent || rag.fullText || ""

  // 1. Extract structural breakdown and quality report
  const structure = extractDocumentStructure(markdown, {
    thesisTitle: metadata.thesisTitle,
    studentName: metadata.studentName,
    department: metadata.department,
    institution: metadata.institution,
  })
  const qualityReport = buildSourceQualityReport(markdown, {
    thesisTitle: metadata.thesisTitle,
    studentName: metadata.studentName,
  }, lang)

  // 2. Classify discipline & detailed methodology type
  const classification = classifyDisciplineAndThesisType(markdown, {
    thesisTitle: metadata.thesisTitle,
    department: metadata.department,
    institution: metadata.institution,
    thesisType: (metadata.thesisType as any) || "master",
  }, lang)

  // 3. Compute Deep Academic Metrics & Hierarchical TOC
  const metrics = computeAcademicMetrics(markdown, structure, {
    thesisTitle: metadata.thesisTitle,
    studentName: metadata.studentName,
    thesisType: (metadata.thesisType as any) || "master",
  }, lang)

  const tocTree = buildTOCTree(structure.sections, qualityReport.totalWords)

  // 4. Map detected sections
  const detectedSections: AnalysisPlanSection[] = (rag.sections && rag.sections.length > 0
    ? rag.sections.map((s) => ({
        id: s.id,
        heading: s.heading,
        charCount: s.content.length,
        wordCount: s.content.split(/\s+/).filter(Boolean).length,
        status: s.content.trim().length > 50 ? "found" as const : "empty" as const,
      }))
    : structure.sections.map((s) => ({
        id: s.id,
        heading: s.heading,
        charCount: s.charCount,
        wordCount: s.wordCount,
        status: s.charCount > 50 ? "found" as const : "empty" as const,
      })))

  // 5. Determine study design & reporting guideline recommendation
  let studyDesign: StudyDesign = "unknown"
  let recommendedReportingGuideline: ReportingStandard = "none"
  let guidelineReason: string | undefined = undefined

  const fullLower = (rag.fullText || markdown).toLowerCase()
  const hasML = /machine learning|neural network|transformer|deep learning|neurón|accuracy|dataset|benchmark|epoch|hyperparameter|loss function|f1-score/i.test(fullLower)
  const hasConsort = /randomiz|randomized|control group|clinical trial|patient|placebo|intervention/i.test(fullLower)
  const hasPrisma = /systematic review|meta-analysis|prisma|search strategy|inclusion criteria|eligibility criteria/i.test(fullLower)
  const hasStrobe = /cohort|case-control|cross-sectional|observational study/i.test(fullLower)

  if (hasPrisma) {
    studyDesign = "systematic_review"
    recommendedReportingGuideline = "prisma"
    guidelineReason = lang === "sk"
      ? "Detegovaná systematická rešerš alebo meta-analýza (odporúčaný štandard PRISMA 2020)."
      : lang === "cs"
      ? "Detekována systematická rešerše nebo meta-analýza (doporučený standard PRISMA 2020)."
      : "Detected systematic review or meta-analysis (PRISMA 2020 guideline recommended)."
  } else if (hasConsort) {
    studyDesign = "empirical"
    recommendedReportingGuideline = "consort"
    guidelineReason = lang === "sk"
      ? "Detegovaný klinický alebo randomizovaný experimentálny dizajn (odporúčaný štandard CONSORT 2025)."
      : lang === "cs"
      ? "Detekován klinický nebo randomizovaný experimentální design (doporučený standard CONSORT 2025)."
      : "Detected randomized or controlled trial design (CONSORT 2025 guideline recommended)."
  } else if (hasML) {
    studyDesign = "empirical"
    recommendedReportingGuideline = "ml_reproducibility"
    guidelineReason = lang === "sk"
      ? "Detegované metódy strojového učenia, modely a benchmarky (odporúčaný ML Reproducibility Checklist)."
      : lang === "cs"
      ? "Detekovány metody strojového učení a benchmarky (doporučený ML Reproducibility Checklist)."
      : "Detected machine learning methodologies and experimental benchmarks (ML Reproducibility Checklist recommended)."
  } else if (hasStrobe) {
    studyDesign = "empirical"
    recommendedReportingGuideline = "strobe"
    guidelineReason = lang === "sk"
      ? "Detegovaná observačná alebo epidemiologická štúdia (odporúčaný štandard STROBE)."
      : lang === "cs"
      ? "Detekována observační nebo epidemiologická studie (doporučený standard STROBE)."
      : "Detected observational study design (STROBE guideline recommended)."
  } else if (rag.sections && rag.sections.some((s) => s.kind === "methodology" || s.kind === "results")) {
    studyDesign = "empirical"
  } else if (classification.thesisType === "empirical_quantitative" || classification.thesisType === "qualitative" || classification.thesisType === "cybersecurity_audit") {
    studyDesign = "empirical"
  } else if (classification.thesisType === "theoretical") {
    studyDesign = "theoretical"
  } else {
    studyDesign = "methodological"
  }

  // 6. Extraction quality and Citation availability
  const effectiveTotalChars = Math.max(rag.totalChars || 0, markdown.length)
  let extractionQuality: "high" | "medium" | "low" = "low"
  if (effectiveTotalChars > 15_000 && ((rag.sections && rag.sections.length >= 4) || structure.sections.length >= 4)) {
    extractionQuality = "high"
  } else if (effectiveTotalChars > 4_000 && ((rag.sections && rag.sections.length >= 2) || structure.sections.length >= 2)) {
    extractionQuality = "medium"
  }

  let citationAvailability: "rich" | "moderate" | "sparse" | "none" = "none"
  const refCount = Math.max(structure.detectedReferenceLines.length, rag.referencesTitles?.length || 0)
  if (refCount > 15) {
    citationAvailability = "rich"
  } else if (refCount >= 5) {
    citationAvailability = "moderate"
  } else if (refCount >= 1) {
    citationAvailability = "sparse"
  }

  const hasTablesAndFigures = structure.figuresCount > 0 || structure.tablesCount > 0 || (rag.sections && rag.sections.some((s) => /table|tabuľka|figure|obrázok/i.test(s.content)))
  const canProceedToDeepReview = extractionQuality !== "low" || effectiveTotalChars > 4_000 || (rag.sections && rag.sections.length >= 2)

  // 7. Expected missing sections check
  const expectedMissingSections: string[] = []
  if (!structure.sections.some((s) => /úvod|uvod|introduction/i.test(s.heading))) {
    expectedMissingSections.push(lang === "sk" ? "Úvod" : "Introduction")
  }
  if (!structure.hasMethodologyMarkers) {
    expectedMissingSections.push(lang === "sk" ? "Metodológia / Metódy" : "Methodology")
  }
  if (!structure.hasResultsMarkers) {
    expectedMissingSections.push(lang === "sk" ? "Výsledky" : "Results")
  }
  if (!structure.hasDiscussionMarkers) {
    expectedMissingSections.push(lang === "sk" ? "Diskusia" : "Discussion")
  }
  if (!structure.hasConclusionMarkers) {
    expectedMissingSections.push(lang === "sk" ? "Záver" : "Conclusion")
  }

  // 8. Applicable criteria matrix from rubric engine
  const applicableCriteriaList = getApplicableCriteriaForThesisType(classification.thesisType, SK_ACADEMIC_RUBRIC_V1).map((item) => ({
    criterionKey: item.criterion.key,
    label: item.criterion.labels[lang] || item.criterion.labels.sk,
    weight: item.criterion.weight,
    applicability: item.applicability,
  }))

  return {
    documentTitle: metadata.thesisTitle || "Záverečná práca",
    detectedType: metadata.reviewKind || "thesis",
    language: lang,
    discipline: classification.primaryDiscipline,
    studyDesign,
    detectedSections,
    extractionQuality,
    hasTablesAndFigures,
    citationAvailability,
    expectedMissingSections,
    recommendedRubric: SK_ACADEMIC_RUBRIC_V1.slug,
    recommendedReportingGuideline,
    guidelineReason,
    limitations: qualityReport.limitations,
    canProceedToDeepReview,
    sourceRevision: qualityReport.sourceRevision,
    detailedThesisType: classification.thesisType,
    qualityReport,
    classification: {
      primaryDiscipline: classification.primaryDiscipline,
      secondaryDisciplines: classification.secondaryDisciplines,
      thesisType: classification.thesisType,
      confidence: classification.confidence,
      rationale: classification.rationale,
      sourceAnchors: classification.sourceAnchors,
    },
    disciplineScoreBreakdown: classification.scoreBreakdown,
    applicableCriteria: applicableCriteriaList,
    metrics,
    tocTree,
  }
}
