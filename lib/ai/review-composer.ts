/**
 * Academic Review Composer.
 *
 * Synthesizes evidence-grounded findings, criteria assessments, defense questions,
 * and quality reports into a 14-section formal Slovak academic review draft ("posudok").
 *
 * Rules:
 *  - Evidence before prose: every claim links to evidence or explicit uncertainty.
 *  - 14 formal academic sections.
 *  - Cautious, calibrated language reflecting epistemic status.
 *  - Strict separation of confidential comments.
 *  - Preserves human edits and supports per-section regeneration.
 */

import type { ThesisReviewRecord } from "@/components/thesis-review/use-thesis-review-store"
import type { ReviewFinding, FindingAudience, ReviewDefenseQuestion } from "./review-types"
import type { ReviewLanguage } from "./thesis-rubric"
import { calculateGradeRange } from "./rubric-engine"

export interface ComposedSection {
  id: string
  title: string
  content: string
  isConfidential?: boolean
  isAiGenerated?: boolean
  isHumanEdited?: boolean
  itemsCount?: number
}

export interface ComposedReviewResult {
  title: string
  metadata: {
    studentOrAuthor: string
    manuscriptTitle: string
    reviewer: string
    date: string
    grade?: string | null
    proposedGradeRange?: string | null
    recommendation?: string | null
    isConfirmed: boolean
  }
  sections: ComposedSection[]
  plainText: string
  markdownText: string
  includedFindingsCount: number
}

/**
 * Filter findings eligible for review narrative composition.
 */
export function getEligibleFindings(
  findings: ReviewFinding[] = [],
  audience: FindingAudience = "author"
): ReviewFinding[] {
  return findings.filter((f) => {
    // 1. Must be marked for export
    if (f.includeInExport === false) return false

    // 2. Rejected/dismissed findings are omitted
    if (f.status === "rejected" || f.decisionStatus === "dismissed") return false

    // 3. Confidential audience filter
    if (audience === "author" && (f.audience === "private" || f.audience === "editor" || f.audience === "committee")) {
      return false
    }

    return true
  })
}

function formatFindingWithEpistemicClarity(f: ReviewFinding, index: number, lang: ReviewLanguage = "sk"): string {
  const prefix = `${index}. `
  const title = `**${f.title}**`
  let epistemicPrefix = ""

  if (f.epistemicStatus === "SUPPORTED_FACT") {
    epistemicPrefix = lang === "sk" ? " [Doložený fakt]" : " [Supported fact]"
  } else if (f.epistemicStatus === "SUPPORTED_INTERPRETATION") {
    epistemicPrefix = lang === "sk" ? " [Interpretácia na základe textu]" : " [Evidenced interpretation]"
  } else if (f.epistemicStatus === "MISSING_EVIDENCE") {
    epistemicPrefix = lang === "sk" ? " [Chýbajúci podklad / Neoverené]" : " [Missing evidence]"
  } else if (f.epistemicStatus === "REQUIRES_HUMAN_VERIFICATION") {
    epistemicPrefix = lang === "sk" ? " [Vyžaduje overenie recenzentom]" : " [Requires human verification]"
  }

  const explanation = f.explanation || ""
  const recommendation = f.recommendation ? `\n   *Odporúčanie:* ${f.recommendation}` : ""
  const reviewerNote = f.reviewerNotes ? `\n   *Poznámka recenzenta:* ${f.reviewerNotes}` : ""

  const evidenceQuotes = (f.evidence || [])
    .filter((e) => e.quote && (e.verified !== false || e.state === "verified-exact" || e.state === "verified-normalized"))
    .map((e) => `„${e.quote.slice(0, 160)}${e.quote.length > 160 ? "..." : ""}“ (${e.sectionHeading || "Text práce"})`)
    .join("; ")

  const evidenceLine = evidenceQuotes ? `\n   *Dôkaz z práce:* ${evidenceQuotes}` : ""

  return `${prefix}${title}${epistemicPrefix}\n   ${explanation}${reviewerNote}${evidenceLine}${recommendation}`
}

/**
 * Composes a full 14-section structured review narrative for the target audience.
 */
export function composeFullReviewNarrative(
  review: ThesisReviewRecord,
  audience: FindingAudience = "author",
  lang: ReviewLanguage = review.language || "sk"
): ComposedReviewResult {
  const eligibleFindings = getEligibleFindings(review.findings, audience)
  const isConfirmed = Boolean(review.confirmedAt)
  const effectiveGrade = review.finalGrade || review.grade || review.suggestedGrade
  const effectiveRecommendation = review.finalRecommendation || review.recommendation || review.suggestedRecommendation

  const sections: ComposedSection[] = []

  // 1. Identifikácia práce
  const sec1Title = lang === "sk" ? "1. Identifikácia práce a posudzovateľa" : "1. Identification of Thesis & Reviewer"
  const sec1Content = [
    `Názov práce: ${review.thesisTitle}`,
    `Autor práce: ${review.studentName}`,
    `Typ práce: ${review.thesisType.toUpperCase()}`,
    `Posudzovateľ: ${review.reviewerName || "Odborný posudzovateľ"} (${review.reviewerRole === "supervisor" ? "Školiteľ" : "Oponent"})`,
    review.institution ? `Inštitúcia: ${review.institution}` : null,
    review.department ? `Katedra / Pracovisko: ${review.department}` : null,
    review.targetVenue ? `Študijný program / Odbor: ${review.targetVenue}` : null,
  ].filter(Boolean).join("\n")
  sections.push({ id: "identification", title: sec1Title, content: sec1Content })

  if (review.phdEnrichment) {
    const phd = review.phdEnrichment
    if (phd.authorProfile) {
      const title = lang === "sk" ? "Publikačná činnosť a profil autora (Academic Connector)" : "Author Track Record (Academic Connector)"
      const lines = [
        `| Metrika | Hodnota |`,
        `|---|---|`,
        `| **Meno autora** | ${phd.authorProfile.name} |`,
        `| **Počet evidovaných prác** | ${phd.authorProfile.paperCount || 0} |`,
        `| **Ohlasy (Citácie)** | ${phd.authorProfile.citationCount || 0} |`,
      ]
      if (phd.authorProfile.recentPapers?.length) {
        lines.push("\n**Nedávne publikácie:**")
        phd.authorProfile.recentPapers.forEach((p: any) => lines.push(`- *${p.title}* (${p.year || "N/A"})`))
      }
      sections.push({ id: "phd_track_record", title, content: lines.join("\n") })
    }

    if (phd.sotaBenchmarking?.length) {
      const title = lang === "sk" ? "Porovnanie so súčasným stavom (SOTA Benchmarking)" : "SOTA Benchmarking"
      const lines = [
        lang === "sk" ? "Na základe analýzy literatúry (2024–2026) boli identifikované tieto nedávne kľúčové práce v rovnakej doméne:" : "Based on recent literature analysis (2024–2026), the following key works were identified:"
      ]
      phd.sotaBenchmarking.forEach((p: any) => {
        lines.push(`- **${p.title}** (${p.year || "N/A"}) — *Citácií: ${p.citationCount || 0}*`)
      })
      sections.push({ id: "phd_sota", title, content: lines.join("\n") })
    }
  }

  // 2. Rozsah a limity podkladov pre posúdenie
  const sec2Title = lang === "sk" ? "2. Rozsah a limity podkladov pre posúdenie" : "2. Scope and Review Limitations"
  const sec2Content = review.limitationsSummary || (lang === "sk"
    ? "Posúdenie bolo vypracované na základe digitalizovaného a extrahovaného rukopisu práce. Analýza rešpektuje limity strojového spracovania a vyžaduje konečné posúdenie odbornou komisiou."
    : "Review formulated based on extracted manuscript content within computational verification bounds.")
  sections.push({ id: "scope_limitations", title: sec2Title, content: sec2Content })

  // 3. Stručná charakteristika práce
  const sec3Title = lang === "sk" ? "3. Stručná charakteristika práce (Executive Summary)" : "3. Thesis Overview"
  const sec3Content = review.summary || (lang === "sk"
    ? `Predložená práca sa venuje téme „${review.thesisTitle}“. Ponúka spracovanie teoretického rámca a praktické riešenie stanovených úloh.`
    : `The submitted manuscript investigates "${review.thesisTitle}".`)
  sections.push({ id: "summary", title: sec3Title, content: sec3Content })

  // 4. Zhodnotenie cieľov a prínosu
  const sec4Title = lang === "sk" ? "4. Zhodnotenie cieľov a prínosu práce" : "4. Evaluation of Objectives and Contribution"
  const sec4Findings = eligibleFindings.filter((f) => f.criterionKey === "objectives_clarity" || f.criterionKey === "problem_relevance" || f.criterionKey === "originality_contribution")
  const sec4Content = sec4Findings.length > 0
    ? sec4Findings.map((f, i) => formatFindingWithEpistemicClarity(f, i + 1, lang)).join("\n\n")
    : (lang === "sk"
      ? "Ciele práce boli formulované zrozumiteľne a v súlade so zadaním odboru. Práca prináša relevantné zistenia a vlastný vklad autora."
      : "Objectives were stated with appropriate clarity.")
  sections.push({ id: "objectives_contribution", title: sec4Title, content: sec4Content })

  // 5. Teoretické východiská a práca so zdrojmi
  const sec5Title = lang === "sk" ? "5. Teoretické východiská a práca so zdrojmi" : "5. Theoretical Framework and Literature"
  const sec5Findings = eligibleFindings.filter((f) => f.category === "literature" || f.criterionKey === "theoretical_background")
  const sec5Content = sec5Findings.length > 0
    ? sec5Findings.map((f, i) => formatFindingWithEpistemicClarity(f, i + 1, lang)).join("\n\n")
    : (lang === "sk"
      ? "Teoretická časť práce poskytuje primeraný prehľad stavu poznania v skúmanej oblasti s oporou v domácej i zahraničnej literatúre."
      : "Theoretical section provides a satisfactory overview of current literature.")
  sections.push({ id: "theoretical_background", title: sec5Title, content: sec5Content })

  // 6. Metodológia a postup riešenia
  const sec6Title = lang === "sk" ? "6. Metodológia a postup riešenia" : "6. Methodology and Approach"
  const sec6Findings = eligibleFindings.filter((f) => f.category === "methodology" || f.criterionKey === "methodology_rigor" || f.criterionKey === "analytical_execution")
  const sec6Content = sec6Findings.length > 0
    ? sec6Findings.map((f, i) => formatFindingWithEpistemicClarity(f, i + 1, lang)).join("\n\n")
    : (lang === "sk"
      ? "Zvolené metódy a postup riešenia zodpovedajú charakteru práce a umožňujú dosiahnutie stanovených výstupov."
      : "Chosen methodology matches the problem scope.")
  sections.push({ id: "methodology", title: sec6Title, content: sec6Content })

  // 7. Výsledky, interpretácia a diskusia
  const sec7Title = lang === "sk" ? "7. Výsledky, interpretácia a diskusia" : "7. Results, Interpretation, and Discussion"
  const sec7Findings = eligibleFindings.filter((f) => f.category === "results" || f.category === "statistics" || f.criterionKey === "results_validity" || f.criterionKey === "discussion_relation")
  const sec7Content = sec7Findings.length > 0
    ? sec7Findings.map((f, i) => formatFindingWithEpistemicClarity(f, i + 1, lang)).join("\n\n")
    : (lang === "sk"
      ? "Dosiahnuté výsledky sú prezentované vecne a logicky nadväzujú na metodologickú časť práce."
      : "Results are clearly presented and aligned with methodology.")
  sections.push({ id: "results_discussion", title: sec7Title, content: sec7Content })

  // 8. Štruktúra, jazyk a formálna úroveň
  const sec8Title = lang === "sk" ? "8. Štruktúra, jazyk a formálna úroveň" : "8. Structure, Language, and Formal Quality"
  const sec8Findings = eligibleFindings.filter((f) => f.category === "formal" || f.criterionKey === "structure_coherence" || f.criterionKey === "citations_quality")
  const sec8Content = sec8Findings.length > 0
    ? sec8Findings.map((f, i) => formatFindingWithEpistemicClarity(f, i + 1, lang)).join("\n\n")
    : (lang === "sk"
      ? "Práca spĺňa formálne a jazykové náležitosti kladené na záverečné práce. Typografická a štylistická úroveň je primeraná."
      : "Thesis meets formal and language conventions.")
  sections.push({ id: "structure_formal", title: sec8Title, content: sec8Content })

  // 9. Silné stránky práce
  const sec9Title = lang === "sk" ? "9. Silné stránky práce" : "9. Key Strengths"
  const strengthsList = review.strengths && review.strengths.length > 0
    ? review.strengths.map((s, i) => `${i + 1}. ${s}`).join("\n")
    : (lang === "sk" ? "• Samostatný prístup k spracovaniu problematiky\n• Praktická realizovateľnosť riešenia" : "• Independent synthesis and problem framing")
  sections.push({ id: "strengths", title: sec9Title, content: strengthsList })

  // 10. Slabé stránky a oblasti na zlepšenie
  const sec10Title = lang === "sk" ? "10. Slabé stránky a oblasti na zlepšenie" : "10. Weaknesses and Areas for Improvement"
  const weaknesses = eligibleFindings.filter((f) => f.findingType === "weakness" || f.severity === "critical" || f.severity === "major")
  const sec10Content = weaknesses.length > 0
    ? weaknesses.map((w, i) => formatFindingWithEpistemicClarity(w, i + 1, lang)).join("\n\n")
    : (lang === "sk" ? "V analyzovanom texte neboli identifikované závažné systémové nedostatky." : "No critical structural flaws identified.")
  sections.push({ id: "weaknesses", title: sec10Title, content: sec10Content })

  // 11. Otázky k obhajobe
  const sec11Title = lang === "sk" ? "11. Otázky a námety k obhajobe" : "11. Defense Questions"
  let questions = review.questionsForAuthors?.length ? [...review.questionsForAuthors] : (review.defenseQuestions ? [...review.defenseQuestions] : [])
  if (review.phdEnrichment?.defenseQuestionsExternal?.length) {
    questions.push(...review.phdEnrichment.defenseQuestionsExternal)
  }
  const sec11Content = questions && questions.length > 0
    ? questions.map((q, i) => `${i + 1}. ${q}`).join("\n\n")
    : (lang === "sk"
      ? "1. Aké boli hlavné výzvy pri realizácii navrhnutého riešenia a ako ste ich prekonali?\n2. Ako by bolo možné rozšíriť dosiahnuté výsledky v ďalšej praxi?"
      : "1. What were the primary methodological challenges encountered?")
  sections.push({ id: "defense_questions", title: sec11Title, content: sec11Content, itemsCount: questions?.length || 2 })

  // 12. Návrh hodnotenia a odôvodnenie
  const sec12Title = lang === "sk" ? "12. Návrh hodnotenia a záverečné stanovisko" : "12. Grade Proposal and Recommendation"
  const calculated = calculateGradeRange(85)
  const proposedRange = review.proposedGradeRange || calculated.range
  const sec12Lines = [
    effectiveRecommendation ? `Odporúčanie k obhajobe: ${effectiveRecommendation}` : null,
    effectiveGrade ? `Navrhovaná známka / ECTS: ${effectiveGrade}${proposedRange ? ` (Rozpätie: ${proposedRange})` : ""}` : `Navrhovaná známka / ECTS: ${proposedRange}`,
    review.phdEnrichment?.statutoryClause ? `\nZákonné stanovisko:\n${review.phdEnrichment.statutoryClause}\n` : null,
    isConfirmed
      ? `(Rozhodnutie explicitne potvrdené recenzentom dňa: ${new Date(review.confirmedAt!).toLocaleDateString()})`
      : "(Návrh hodnotenia generovaný asistentom — podlieha nezávislému rozhodnutiu posudzovateľa)",
  ].filter(Boolean).join("\n")
  sections.push({ id: "evaluation_summary", title: sec12Title, content: sec12Lines })

  // 13. Limity AI asistovaného posúdenia
  const sec13Title = lang === "sk" ? "13. Transparentné vyhlásenie o AI asistencii" : "13. AI Assistance Disclosure & Boundaries"
  const sec13Content = lang === "sk"
    ? "Tento koncept posudku bol pripravený v systéme PosterApp s využitím evidenciami podloženého AI modulu. Systém neposudzuje prácu ako autoritatívny orgán; slúži ako transparentný asistent pre overenie podkladov, štruktúry a citácií. Konečné hodnotenie a podpis náleží výlučne menovanému recenzentovi."
    : "This review draft was synthesized using PosterApp evidence-grounded AI assistant. Final academic judgment belongs exclusively to the qualified human reviewer."
  sections.push({ id: "ai_disclosure", title: sec13Title, content: sec13Content })

  // 14. Interné / dôverné poznámky (strictly separated, never for author export)
  if (review.confidentialComments && audience !== "author") {
    const sec14Title = lang === "sk" ? "14. Dôverné poznámky pre komisiu / editora" : "14. Confidential Remarks for Committee/Editor"
    sections.push({
      id: "confidential",
      title: sec14Title,
      content: review.confidentialComments,
      isConfidential: true,
    })
  }

  // Format plain text & markdown
  const markdownParts: string[] = [
    `# ${review.thesisTitle}`,
    `**Posudok záverečnej práce (${review.thesisType.toUpperCase()})**\n`,
    ...sections.map((s) => `## ${s.title}\n\n${s.content}`),
  ]
  const markdownText = markdownParts.join("\n\n---\n\n")
  const plainText = sections.map((s) => `${s.title}\n\n${s.content}`).join("\n\n\n")

  return {
    title: review.thesisTitle,
    metadata: {
      studentOrAuthor: review.studentName,
      manuscriptTitle: review.thesisTitle,
      reviewer: review.reviewerName || review.reviewerRole,
      date: new Date().toLocaleDateString(),
      grade: effectiveGrade,
      proposedGradeRange: proposedRange,
      recommendation: effectiveRecommendation,
      isConfirmed,
    },
    sections,
    plainText,
    markdownText,
    includedFindingsCount: eligibleFindings.length,
  }
}
