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
import { hasConclusiveStatement } from "./review-bucketing"
import type { ReviewFinding, FindingAudience, ReviewDefenseQuestion } from "./review-types"
import type { ReviewLanguage } from "./thesis-rubric"


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

function noGroundedAssessment(lang: ReviewLanguage): string {
  return lang === "sk"
    ? "Pre túto oblasť nie je k dispozícii exportovateľné, evidenciou podložené zistenie. Vyžaduje sa posúdenie recenzentom."
    : "No export-eligible, evidence-grounded finding is available for this area. Human reviewer assessment is required."
}

/** Scientific papers use peer-review terminology and publication outcomes, never thesis grades. */
export function composePaperReviewNarrative(
  review: ThesisReviewRecord,
  audience: FindingAudience = "author",
  lang: ReviewLanguage = review.language || "sk",
): ComposedReviewResult {
  const findings = getEligibleFindings(review.findings, audience)
  const isConfirmed = Boolean(review.confirmedAt)
  const recommendation = review.finalRecommendation || review.recommendation || review.suggestedRecommendation
  const verifiedStrengthFindings = findings.filter((finding) =>
    finding.findingType === "strength" && finding.evidence?.some((evidence) => evidence.verified),
  )
  const strengths = isConfirmed
    ? review.strengths ?? []
    : verifiedStrengthFindings.map((finding) => finding.explanation || finding.title)
  const major = findings.filter(
    (finding) => finding.findingType !== "strength" && (finding.severity === "critical" || finding.severity === "major"),
  )
  // A merit is never a concern: strengths graded `severity: "suggestion"` must
  // not leak into "Drobné pripomienky" (see lib/ai/review-bucketing).
  const minor = findings.filter(
    (finding) => finding.findingType !== "strength" && (finding.severity === "minor" || finding.severity === "suggestion"),
  )
  const questions = review.questionsForAuthors?.length
    ? review.questionsForAuthors
    : review.defenseQuestions ?? []

  const sections: ComposedSection[] = [
    {
      id: "manuscript_identification",
      title: lang === "sk" ? "1. Identifikácia rukopisu a recenzenta" : "1. Manuscript and Reviewer Identification",
      content: [
        `${lang === "sk" ? "Názov článku" : "Paper title"}: ${review.thesisTitle}`,
        `${lang === "sk" ? "Autor(i)" : "Author(s)"}: ${review.studentName}`,
        `${lang === "sk" ? "Recenzent" : "Reviewer"}: ${review.reviewerName || (lang === "sk" ? "Odborný recenzent" : "Peer reviewer")}`,
        review.targetVenue ? `${lang === "sk" ? "Cieľový časopis / konferencia" : "Target journal / conference"}: ${review.targetVenue}` : null,
      ].filter(Boolean).join("\n"),
    },
    {
      id: "review_scope",
      title: lang === "sk" ? "2. Rozsah a limity recenzie" : "2. Review Scope and Limitations",
      content: review.limitationsSummary || noGroundedAssessment(lang),
    },
    {
      id: "paper_summary",
      title: lang === "sk" ? "3. Zhrnutie rukopisu" : "3. Manuscript Summary",
      content: review.summary || (lang === "sk" ? "Zhrnutie nebolo poskytnuté; recenzent ho musí doplniť." : "No summary was provided; the reviewer must add one."),
    },
    {
      id: "paper_strengths",
      title: lang === "sk" ? "4. Podložené silné stránky" : "4. Evidence-Grounded Strengths",
      content: strengths.length ? strengths.map((strength, index) => `${index + 1}. ${strength}`).join("\n") : noGroundedAssessment(lang),
    },
    {
      id: "major_concerns",
      title: lang === "sk" ? "5. Zásadné pripomienky" : "5. Major Concerns",
      content: major.length ? major.map((finding, index) => formatFindingWithEpistemicClarity(finding, index + 1, lang)).join("\n\n") : noGroundedAssessment(lang),
    },
    {
      id: "minor_concerns",
      title: lang === "sk" ? "6. Drobné pripomienky" : "6. Minor Concerns",
      content: minor.length ? minor.map((finding, index) => formatFindingWithEpistemicClarity(finding, index + 1, lang)).join("\n\n") : noGroundedAssessment(lang),
    },
    {
      id: "questions_for_authors",
      title: lang === "sk" ? "7. Otázky pre autorov" : "7. Questions for the Authors",
      content: questions.length ? questions.map((question, index) => `${index + 1}. ${question}`).join("\n\n") : noGroundedAssessment(lang),
      itemsCount: questions.length,
    },
    {
      id: "publication_recommendation",
      title: lang === "sk" ? "8. Odporúčanie editorovi a vyhlásenie o AI asistencii" : "8. Recommendation to the Editor and AI Disclosure",
      content: [
        `${lang === "sk" ? "Publikačné odporúčanie" : "Publication recommendation"}: ${recommendation || (lang === "sk" ? "Nebol zadaný návrh; rozhodne recenzent/editor." : "No recommendation supplied; the reviewer/editor must decide.")}`,
        lang === "sk"
          ? "Koncept recenzie pripravil evidenciou podložený AI asistent PosterApp. Konečné redakčné rozhodnutie patrí ľudskému recenzentovi a editorovi."
          : "This draft was prepared with PosterApp's evidence-grounded AI assistant. Final editorial judgment belongs to the human reviewer and editor.",
      ].join("\n\n"),
    },
  ]

  if (review.confidentialComments && audience !== "author") {
    sections.push({
      id: "confidential",
      title: lang === "sk" ? "Dôverné poznámky editorovi" : "Confidential Comments to the Editor",
      content: review.confidentialComments,
      isConfidential: true,
    })
  }

  const markdownText = [
    `# ${review.thesisTitle}`,
    `**${lang === "sk" ? "Odborná recenzia vedeckého článku" : "Scientific Paper Peer Review"}**`,
    ...sections.map((section) => `## ${section.title}\n\n${section.content}`),
  ].join("\n\n---\n\n")

  return {
    title: review.thesisTitle,
    metadata: {
      studentOrAuthor: review.studentName,
      manuscriptTitle: review.thesisTitle,
      reviewer: review.reviewerName || review.reviewerRole,
      date: new Date().toLocaleDateString(),
      grade: null,
      proposedGradeRange: null,
      recommendation,
      isConfirmed,
    },
    sections,
    plainText: sections.map((section) => `${section.title}\n\n${section.content}`).join("\n\n\n"),
    markdownText,
    includedFindingsCount: findings.length,
  }
}

/**
 * Composes a full 14-section structured thesis review narrative for the target audience.
 */
export function composeFullReviewNarrative(
  review: ThesisReviewRecord,
  audience: FindingAudience = "author",
  lang: ReviewLanguage = review.language || "sk"
): ComposedReviewResult {
  if (review.reviewKind === "paper") {
    return composePaperReviewNarrative(review, audience, lang)
  }

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

  // PhD enrichment is folded into the fixed canonical sections below so it
  // cannot change the promised 14-section thesis structure.
  const phdProfileText = review.phdEnrichment?.authorProfile
    ? [
        lang === "sk" ? "**Overený publikačný profil autora:**" : "**Verified author publication profile:**",
        `${review.phdEnrichment.authorProfile.name}: ${review.phdEnrichment.authorProfile.paperCount || 0} publications, ${review.phdEnrichment.authorProfile.citationCount || 0} citations.`,
      ].join("\n")
    : ""
  const phdSotaText = review.phdEnrichment?.sotaBenchmarking?.length
    ? [
        lang === "sk" ? "**Externé porovnanie so súčasným stavom:**" : "**External state-of-the-art comparison:**",
        ...review.phdEnrichment.sotaBenchmarking.map((paper: any) => `- ${paper.title} (${paper.year || "N/A"})`),
      ].join("\n")
    : ""

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

  // Key-points table belongs to the overview rather than becoming an extra
  // pseudo-section that shifts canonical numbering.
  if (eligibleFindings.length > 0) {
    const header = lang === "sk"
      ? `| Kategória | Závažnosť | Pripomienka | Jadro problému |\n|---|---|---|---|`
      : `| Category | Severity | Finding | Core Issue |\n|---|---|---|---|`
    const rows = eligibleFindings.map((finding) => {
      const issue = finding.explanation ? finding.explanation.replace(/\n/g, " ") : ""
      const shortIssue = issue.length > 150 ? issue.substring(0, 147) + "..." : issue
      return `| ${finding.category} | ${finding.severity} | ${finding.title} | ${shortIssue} |`
    }).join("\n")
    const summarySection = sections.find((section) => section.id === "summary")
    if (summarySection) {
      summarySection.content += `\n\n**${lang === "sk" ? "Prehľad podložených zistení" : "Evidence-grounded findings overview"}:**\n${header}\n${rows}`
    }
  }

  // 4. Zhodnotenie cieľov a prínosu
  const sec4Title = lang === "sk" ? "4. Zhodnotenie cieľov a prínosu práce" : "4. Evaluation of Objectives and Contribution"
  const sec4Findings = eligibleFindings.filter((f) => f.criterionKey === "objectives_clarity" || f.criterionKey === "problem_relevance" || f.criterionKey === "originality_contribution")
  const sec4Content = sec4Findings.length > 0
    ? sec4Findings.map((f, i) => formatFindingWithEpistemicClarity(f, i + 1, lang)).join("\n\n")
    : noGroundedAssessment(lang)
  sections.push({ id: "objectives_contribution", title: sec4Title, content: sec4Content })

  // 5. Teoretické východiská a práca so zdrojmi
  const sec5Title = lang === "sk" ? "5. Teoretické východiská a práca so zdrojmi" : "5. Theoretical Framework and Literature"
  const sec5Findings = eligibleFindings.filter((f) => f.category === "literature" || f.criterionKey === "theoretical_background")
  const sec5Assessment = sec5Findings.length > 0
    ? sec5Findings.map((f, i) => formatFindingWithEpistemicClarity(f, i + 1, lang)).join("\n\n")
    : noGroundedAssessment(lang)
  const sec5Content = [sec5Assessment, phdSotaText].filter(Boolean).join("\n\n")
  sections.push({ id: "theoretical_background", title: sec5Title, content: sec5Content })

  // 6. Metodológia a postup riešenia
  const sec6Title = lang === "sk" ? "6. Metodológia a postup riešenia" : "6. Methodology and Approach"
  const sec6Findings = eligibleFindings.filter((f) => f.category === "methodology" || f.criterionKey === "methodology_rigor" || f.criterionKey === "analytical_execution")
  const sec6Content = sec6Findings.length > 0
    ? sec6Findings.map((f, i) => formatFindingWithEpistemicClarity(f, i + 1, lang)).join("\n\n")
    : noGroundedAssessment(lang)
  sections.push({ id: "methodology", title: sec6Title, content: sec6Content })

  // 7. Výsledky, interpretácia a diskusia
  const sec7Title = lang === "sk" ? "7. Výsledky, interpretácia a diskusia" : "7. Results, Interpretation, and Discussion"
  const sec7Findings = eligibleFindings.filter((f) => f.category === "results" || f.category === "statistics" || f.criterionKey === "results_validity" || f.criterionKey === "discussion_relation")
  const sec7Content = sec7Findings.length > 0
    ? sec7Findings.map((f, i) => formatFindingWithEpistemicClarity(f, i + 1, lang)).join("\n\n")
    : noGroundedAssessment(lang)
  sections.push({ id: "results_discussion", title: sec7Title, content: sec7Content })

  // 8. Štruktúra, jazyk a formálna úroveň
  const sec8Title = lang === "sk" ? "8. Štruktúra, jazyk a formálna úroveň" : "8. Structure, Language, and Formal Quality"
  const sec8Findings = eligibleFindings.filter((f) => f.category === "formal" || f.criterionKey === "structure_coherence" || f.criterionKey === "citations_quality")
  const sec8Content = sec8Findings.length > 0
    ? sec8Findings.map((f, i) => formatFindingWithEpistemicClarity(f, i + 1, lang)).join("\n\n")
    : noGroundedAssessment(lang)
  sections.push({ id: "structure_formal", title: sec8Title, content: sec8Content })

  // 9. Silné stránky práce
  const sec9Title = lang === "sk" ? "9. Silné stránky práce" : "9. Key Strengths"
  const verifiedStrengths = eligibleFindings
    .filter((finding) => finding.findingType === "strength" && finding.evidence?.some((evidence) => evidence.verified))
    .map((finding) => finding.explanation || finding.title)
  const strengths = isConfirmed ? (review.strengths ?? []) : verifiedStrengths
  const strengthsList = strengths.length > 0
    ? strengths.map((strength, index) => `${index + 1}. ${strength}`).join("\n")
    : noGroundedAssessment(lang)
  sections.push({ id: "strengths", title: sec9Title, content: [strengthsList, phdProfileText].filter(Boolean).join("\n\n") })

  // 10. Slabé stránky a oblasti na zlepšenie
  const sec10Title = lang === "sk" ? "10. Slabé stránky a oblasti na zlepšenie" : "10. Weaknesses and Areas for Improvement"
  const weaknesses = eligibleFindings.filter((f) => f.findingType === "weakness" || f.severity === "critical" || f.severity === "major")
  const sec10Content = weaknesses.length > 0
    ? weaknesses.map((w, i) => formatFindingWithEpistemicClarity(w, i + 1, lang)).join("\n\n")
    : noGroundedAssessment(lang)
  sections.push({ id: "weaknesses", title: sec10Title, content: sec10Content })

  // 11. Otázky k obhajobe
  const sec11Title = lang === "sk" ? "11. Otázky a námety k obhajobe" : "11. Defense Questions"
  let questions = review.questionsForAuthors?.length ? [...review.questionsForAuthors] : (review.defenseQuestions ? [...review.defenseQuestions] : [])
  if (review.phdEnrichment?.defenseQuestionsExternal?.length) {
    questions.push(...review.phdEnrichment.defenseQuestionsExternal)
  }
  const sec11Content = questions && questions.length > 0
    ? questions.map((q, i) => `${i + 1}. ${q}`).join("\n\n")
    : noGroundedAssessment(lang)
  sections.push({ id: "defense_questions", title: sec11Title, content: sec11Content, itemsCount: questions?.length || 0 })

  // 12. Návrh hodnotenia a odôvodnenie
  const sec12Title = lang === "sk" ? "12. Návrh hodnotenia a záverečné stanovisko" : "12. Grade Proposal and Recommendation"
  const proposedRange = review.proposedGradeRange || null
  const sec12Lines = [
    effectiveRecommendation ? `Odporúčanie k obhajobe: ${effectiveRecommendation}` : noGroundedAssessment(lang),
    effectiveGrade ? `Navrhovaná známka / ECTS: ${effectiveGrade}${proposedRange ? ` (Rozpätie: ${proposedRange})` : ""}` : null,
    review.phdEnrichment?.statutoryClause ? `\nZákonné stanovisko:\n${review.phdEnrichment.statutoryClause}\n` : null,
    isConfirmed
      ? `(Rozhodnutie explicitne potvrdené recenzentom dňa: ${new Date(review.confirmedAt!).toLocaleDateString()})`
      : "(Návrh hodnotenia generovaný asistentom — podlieha nezávislému rozhodnutiu posudzovateľa)",
  ].filter(Boolean).join("\n")
  // The conclusive statement is the one part of a doctoral posudok that has
  // legal force; if neither the model nor the reviewer produced it, name the
  // gap in the export instead of shipping a review that a committee would
  // return to the dean.
  let conclusivePlaceholder: string | null = null
  if (
    (review.reviewKind ?? "thesis") === "thesis" &&
    review.thesisType === "phd" &&
    review.reviewerRole === "opponent" &&
    !hasConclusiveStatement(sec12Lines, review.language === "cs" ? "cz" : "sk")
  ) {
    conclusivePlaceholder = lang === "sk"
      ? "\u00a1DOPNIŤ: Záverečné stanovisko (§ 67 zákona č. 131/2002 Z. z.) — veta o splnení podmienok, odporúčanie na obhajobu a návrh titulu PhD s klasifikačným stupňom."
      : lang === "cs"
        ? "\u00a1DOPNIŤ: Závěrečné stanovisko (§ 54a zákona č. 111/1998 Sb.) — věta o splnění podmínek, doporučení k obhajobě a návrh na udělení titulu."
        : "\u00a1DOPNIŤ: Add the conclusive statement — the sentence on fulfilled conditions, the recommendation for defence and the proposed title with a pass/fail classification."
  }
  sections.push({ id: "evaluation_summary", title: sec12Title, content: [sec12Lines, conclusivePlaceholder].filter(Boolean).join("\n\n") })

  // 13. Limity AI asistovaného posúdenia
  const sec13Title = lang === "sk" ? "13. Transparentné vyhlásenie o AI asistencii" : "13. AI Assistance Disclosure & Boundaries"
  const sec13Content = lang === "sk"
    ? "Tento koncept posudku bol pripravený v systéme PosterApp s využitím evidenciami podloženého AI modulu. Systém neposudzuje prácu ako autoritatívny orgán; slúži ako transparentný asistent pre overenie podkladov, štruktúry a citácií. Konečné hodnotenie a podpis náleží výlučne menovanému recenzentovi."
    : "This review draft was synthesized using PosterApp evidence-grounded AI assistant. Final academic judgment belongs exclusively to the qualified human reviewer."
  sections.push({ id: "ai_disclosure", title: sec13Title, content: sec13Content })

  // 14. Keep the canonical thesis structure deterministic. Author copies get
  // a signature/attestation block; privileged copies may replace its content
  // with strictly separated confidential remarks.
  if (review.confidentialComments && audience !== "author") {
    sections.push({
      id: "confidential",
      title: lang === "sk" ? "14. Dôverné poznámky pre komisiu" : "14. Confidential Remarks for the Committee",
      content: review.confidentialComments,
      isConfidential: true,
    })
  } else {
    sections.push({
      id: "reviewer_attestation",
      title: lang === "sk" ? "14. Potvrdenie a podpis posudzovateľa" : "14. Reviewer Attestation and Signature",
      content: [
        `${lang === "sk" ? "Meno posudzovateľa" : "Reviewer"}: ${review.reviewerName || "________________"}`,
        `${lang === "sk" ? "Dátum" : "Date"}: __________________`,
        `${lang === "sk" ? "Podpis" : "Signature"}: __________________`,
      ].join("\n"),
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

export {
  reconcileGrade,
  HARSH_OUTLIER_THRESHOLD,
  GRADE_DIVERGENCE_THRESHOLD,
  type GradeReconciliationResult,
} from "./rubric-engine"

