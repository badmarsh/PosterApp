/**
 * Analysis Plan & Pre-flight Diagnostics Generator.
 *
 * Implements the pre-analytical inspection stage:
 * Document -> Profile -> Analysis Plan -> User Confirmation -> Deep Review.
 */

import { loadThesisContext, type ThesisRAGContext } from "./thesis-context"
import type { ReviewAnalysisPlan, AnalysisPlanSection, StudyDesign, ReportingStandard, ReviewKind } from "./review-types"
import type { ReviewLanguage, ThesisMetadata } from "./thesis-rubric"

export interface GenerateAnalysisPlanOptions {
  workspaceId: string
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
  const { workspaceId, thesisMetadata } = options
  const lang: ReviewLanguage = thesisMetadata.language || "sk"

  const rag = await loadThesisContext({
    workspaceId,
    thesisMetadata,
    maxChars: 120_000,
  })

  return buildAnalysisPlanFromRAG(rag, thesisMetadata, lang)
}

export function buildAnalysisPlanFromRAG(
  rag: ThesisRAGContext,
  metadata: {
    thesisTitle?: string
    reviewKind?: ReviewKind
    thesisType?: string
  },
  lang: ReviewLanguage = "sk"
): ReviewAnalysisPlan {
  const fullLower = (rag.fullText + " " + rag.sections.map((s) => s.heading + " " + s.content).join(" ")).toLowerCase()
  const detectedSections: AnalysisPlanSection[] = rag.sections.map((s) => ({
    id: s.id,
    heading: s.heading,
    charCount: s.content.length,
    status: s.content.trim().length > 50 ? "found" : "empty",
  }))

  // Extraction quality assessment
  let extractionQuality: "high" | "medium" | "low" = "low"
  if (rag.totalChars > 15_000 && rag.sections.length >= 4) {
    extractionQuality = "high"
  } else if (rag.totalChars > 4_000 && rag.sections.length >= 2) {
    extractionQuality = "medium"
  }

  // Study design detection
  let studyDesign: StudyDesign = "unknown"
  let recommendedReportingGuideline: ReportingStandard = "none"
  let guidelineReason: string | undefined = undefined

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
  } else if (rag.sections.some((s) => s.kind === "methodology" || s.kind === "results")) {
    studyDesign = "empirical"
  } else if (rag.sections.some((s) => s.kind === "literature")) {
    studyDesign = "theoretical"
  } else {
    studyDesign = "methodological"
  }

  // Citation availability
  let citationAvailability: "rich" | "moderate" | "sparse" | "none" = "none"
  const refCount = rag.referencesTitles.length
  if (refCount > 15) {
    citationAvailability = "rich"
  } else if (refCount >= 5) {
    citationAvailability = "moderate"
  } else if (refCount >= 1) {
    citationAvailability = "sparse"
  }

  // Expected missing sections check
  const expectedMissingSections: string[] = []
  const hasIntro = rag.sections.some((s) => s.kind === "introduction" || /úvod|uvod|introduction/i.test(s.heading))
  const hasMethodology = rag.sections.some((s) => s.kind === "methodology" || /metod|method/i.test(s.heading))
  const hasResults = rag.sections.some((s) => s.kind === "results" || /výsledk|vysledk|result/i.test(s.heading))
  const hasDiscussion = rag.sections.some((s) => s.kind === "discussion" || /diskus|discuss/i.test(s.heading))
  const hasConclusion = rag.sections.some((s) => s.kind === "conclusion" || /záver|zaver|conclus/i.test(s.heading))

  if (!hasIntro) expectedMissingSections.push(lang === "sk" ? "Úvod" : "Introduction")
  if (!hasMethodology) expectedMissingSections.push(lang === "sk" ? "Metodológia / Metódy" : "Methodology")
  if (!hasResults) expectedMissingSections.push(lang === "sk" ? "Výsledky" : "Results")
  if (!hasDiscussion) expectedMissingSections.push(lang === "sk" ? "Diskusia" : "Discussion")
  if (!hasConclusion) expectedMissingSections.push(lang === "sk" ? "Záver" : "Conclusion")

  // Limitations identification
  const limitations: string[] = []
  if (extractionQuality === "low") {
    limitations.push(
      lang === "sk"
        ? "Nízky rozsah extrahovaného textu (menej ako 4000 znakov), hĺbková analýza môže byť limitovaná."
        : "Low extracted character count (< 4000 chars), in-depth analysis may be limited."
    )
  }
  if (citationAvailability === "none") {
    limitations.push(
      lang === "sk"
        ? "V dokumente nebola detegovaná samostatná sekcia referencií / literatúry."
        : "No bibliography/references section detected in the extracted text."
    )
  }
  if (expectedMissingSections.length > 0) {
    limitations.push(
      lang === "sk"
        ? `Nenájdené štandardné kapitoly: ${expectedMissingSections.join(", ")}.`
        : `Missing standard sections: ${expectedMissingSections.join(", ")}.`
    )
  }

  // Recommended rubric
  const reviewKind = metadata.reviewKind || "thesis"
  const recommendedRubric =
    reviewKind === "paper"
      ? (lang === "sk" ? "Vedecký recenzný posudok (Nature / IEEE standard)" : "Scientific Peer Review (Nature / IEEE standard)")
      : (lang === "sk" ? `Akademická rubrika pre ${String(metadata.thesisType || "master").toUpperCase()} prácu` : `Academic Rubric for ${String(metadata.thesisType || "master").toUpperCase()} Thesis`)

  const hasTablesAndFigures = /table \d|tabuľka \d|figure \d|obrázok \d|graf \d/i.test(fullLower)

  return {
    documentTitle: metadata.thesisTitle || "Manuscript Document",
    detectedType: reviewKind,
    language: lang,
    discipline: hasML ? "Informatika & Umelá inteligencia" : "Všeobecný akademický výskum",
    studyDesign,
    detectedSections,
    extractionQuality,
    hasTablesAndFigures,
    citationAvailability,
    expectedMissingSections,
    recommendedRubric,
    recommendedReportingGuideline,
    guidelineReason,
    limitations,
    canProceedToDeepReview: extractionQuality !== "low" || detectedSections.length > 0,
  }
}
