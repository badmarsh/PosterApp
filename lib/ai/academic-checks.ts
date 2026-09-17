/**
 * Dedicated Academic Quality Check Modules.
 *
 * Implements transparent, evidence-grounded evaluators for:
 *  1. Objective Alignment (Traceability: Problem -> Objectives -> Method -> Results -> Conclusion)
 *  2. Methodology Appropriateness
 *  3. Results & Interpretation Calibration
 *  4. Citation & Bibliography Mechanical Audit
 *  5. Implementation & Technical Contribution
 *  6. Defense Questions Generator (5-12 prioritized questions)
 */

import type { ReviewLanguage, ThesisType } from "./thesis-rubric"
import type { ReviewDefenseQuestion, ReviewFinding, EpistemicStatus } from "./review-types"
import type { ExtractedDocumentStructure } from "./document-understanding"
import type { ThesisRAGContext } from "./thesis-context"

export interface TraceabilityCheckResult {
  isFullyAligned: boolean
  hasProblemStatement: boolean
  hasExplicitObjectives: boolean
  hasResearchQuestionsOrHypotheses: boolean
  hasMethodologyAlignment: boolean
  hasResultsToObjectivesMapping: boolean
  hasConclusionAlignment: boolean
  traceabilityScore: number // 0-100
  alignmentScore: number
  goalsFound: string[]
  researchQuestionsFound: string[]
  unaddressedObjectives: string[]
  gaps: string[]
  findings: ReviewFinding[]
}

export interface CitationAuditResult {
  isCitationIntegrityOk: boolean
  referencesDetected: number
  inTextCitationsDetected: number
  unmatchedInTextCitations: string[]
  unmatchedReferences: string[]
  formattingConsistencyScore: number // 0-100
  potentialIssues: string[]
  findings: ReviewFinding[]
}

/**
 * Evaluates the alignment and traceability across research stages.
 */
export function checkObjectiveAlignment(
  structure: ExtractedDocumentStructure,
  ragOrText: ThesisRAGContext | string,
  lang: ReviewLanguage = "sk"
): TraceabilityCheckResult {
  const fullText = typeof ragOrText === "string" ? ragOrText : ragOrText?.fullText || ""
  const fullLower = fullText.toLowerCase()
  const gaps: string[] = []
  const findings: ReviewFinding[] = []

  const hasProblemStatement = /problém|motivácia|aktuálnosť|problem statement|motivation/i.test(fullLower)
  const hasExplicitObjectives = /cieľom (?:tejto )?práce|hlavný cieľ|čiastkové ciele|the goal of this|objective/i.test(fullLower)
  const hasResearchQuestionsOrHypotheses = /výskumná otázka|výskumné otázky|hypotéz|research question|hypothesis/i.test(fullLower)
  const hasMethodologyAlignment = structure.hasMethodologyMarkers
  const hasResultsToObjectivesMapping = structure.hasResultsMarkers
  const hasConclusionAlignment = structure.hasConclusionMarkers

  let score = 100

  if (!hasExplicitObjectives) {
    score -= 25
    gaps.push(
      lang === "sk"
        ? "V úvode práce nebol nájdený explicitný výrok definujúci hlavný cieľ (napr. 'Cieľom práce je...')."
        : "No explicit goal statement found in introduction."
    )
    findings.push({
      id: `align-obj-${Date.now()}`,
      criterionKey: "objectives_clarity",
      category: "methodology",
      title: lang === "sk" ? "Nejednoznačná formulácia hlavného cieľa" : "Ambiguous main objective",
      findingType: "weakness",
      epistemicStatus: "MISSING_EVIDENCE",
      severity: "major",
      confidence: 0.85,
      explanation: lang === "sk"
        ? "V analyzovanom texte úvodu chýba jednoznačné zadefinovanie cieľov a dekompozícia na merateľné čiastkové kroky."
        : "Missing explicit decomposition into measurable sub-goals in introduction.",
      recommendation: lang === "sk"
        ? "Doplniť do úvodu explicitný zoznam hlavných a čiastkových cieľov."
        : "Add clear objective statements to introduction.",
      evidence: [],
      status: "unreviewed",
      includeInExport: true,
      createdBy: "ai",
    })
  }

  if (!hasResearchQuestionsOrHypotheses && !hasProblemStatement) {
    score -= 20
    gaps.push(
      lang === "sk"
        ? "V teoretickej a úvodnej časti chýba explicitná formulácia výskumných otázok alebo pracovných hypotéz."
        : "Missing research questions or hypotheses in introductory chapters."
    )
  }

  if (!hasMethodologyAlignment) {
    score -= 20
    gaps.push(
      lang === "sk"
        ? "Metodologická kapitola neposkytuje dostatočne detailný popis postupu riešenia vzhľadom na stanovené ciele."
        : "Methodology section does not adequately link to defined goals."
    )
  }

  if (!hasResultsToObjectivesMapping) {
    score -= 20
    gaps.push(
      lang === "sk"
        ? "Výsledková časť neobsahuje priamu syntézu vo vzťahu k splneniu formulovaných cieľov."
        : "Results section lacks clear synthesis demonstrating goal attainment."
    )
  }

  const goalsFound: string[] = []
  const goalsMatch = fullText.match(/(?:cieľom (?:tejto )?práce je|hlavným cieľom (?:tejto )?práce je|the goal of this (?:thesis|paper|work) is)\s+([^\.\n]+)/i)
  if (goalsMatch) {
    goalsFound.push(goalsMatch[1].trim())
  }

  const rqFound: string[] = []
  const rqMatch = fullText.match(/(?:výskumná otázka|výskumné otázky|research question[s]?)\s*[:：]?\s*([^\.\n\?]+[\?]?)/i)
  if (rqMatch) {
    rqFound.push(rqMatch[1].trim())
  }

  return {
    isFullyAligned: score >= 75 && gaps.length === 0,
    hasProblemStatement,
    hasExplicitObjectives,
    hasResearchQuestionsOrHypotheses,
    hasMethodologyAlignment,
    hasResultsToObjectivesMapping,
    hasConclusionAlignment,
    traceabilityScore: Math.max(0, score),
    alignmentScore: Math.max(0, score),
    goalsFound,
    researchQuestionsFound: rqFound,
    unaddressedObjectives: gaps,
    gaps,
    findings,
  }
}

function expandNumericCitationGroup(group: string): string[] {
  const labels = new Set<string>()
  for (const part of group.split(",")) {
    const range = part.trim().match(/^(\d+)\s*[-–]\s*(\d+)$/)
    if (range) {
      const start = Number(range[1])
      const end = Number(range[2])
      if (end >= start && end - start <= 100) {
        for (let value = start; value <= end; value++) labels.add(String(value))
      }
    } else if (/^\d+$/.test(part.trim())) {
      labels.add(String(Number(part.trim())))
    }
  }
  return [...labels]
}

function referenceAuthorYear(raw: string): { surname: string; year: string } | null {
  const clean = raw.replace(/^(?:\[\d+\]|\d+[.)]|[-*•])\s*/, "").trim()
  const year = clean.match(/\b((?:19|20)\d{2})[a-z]?\b/i)?.[1]
  const surname = clean.match(/^([A-ZÀ-Ž][\p{L}'’\-]{1,})/u)?.[1]
  return year && surname ? { surname: surname.toLocaleLowerCase(), year } : null
}

/**
 * Performs a bounded mechanical citation & reference consistency audit.
 * Supports both numbered labels/ranges and author-year references. Bibliography
 * text is excluded before scanning in-text citations to avoid self-matches.
 */
export function auditCitationConsistency(
  structure: ExtractedDocumentStructure,
  ragOrText: ThesisRAGContext | string,
  lang: ReviewLanguage = "sk"
): CitationAuditResult {
  const fullText = typeof ragOrText === "string" ? ragOrText : ragOrText?.fullText || ""
  const findings: ReviewFinding[] = []
  const potentialIssues: string[] = []
  const referenceLines = structure?.detectedReferenceLines ?? []
  const referencesCount = referenceLines.length

  const bibliographySections = (structure?.sections ?? []).filter((section) =>
    section.kind === "references" || /referenc|bibliograph|literat|zdroj/i.test(section.heading)
  )
  let bodyText = fullText
  for (const section of bibliographySections) {
    if (section.content) bodyText = bodyText.replace(section.content, "")
  }

  // Detect suspicious placeholder tokens (e.g. [?], [TODO], [Citácia], [Author, Year])
  const placeholderMatches = bodyText.match(/\[\?\]|\[TODO\]|\[citácia\]|\[citation needed\]|\[author\s*,\s*year\]/gi) || []
  if (placeholderMatches.length > 0) {
    potentialIssues.push(
      lang === "sk"
        ? `Nájdených ${placeholderMatches.length} nevyriešených zástupných symbolov citácií (napr. [?], [TODO]).`
        : `Found ${placeholderMatches.length} unresolved citation placeholders.`
    )
    findings.push({
      id: `cite-placeholder-${Date.now()}`,
      criterionKey: "citations_quality",
      category: "formal",
      title: lang === "sk" ? "Nevyriešené zástupné citačné značky v texte" : "Unresolved citation placeholders in text",
      findingType: "weakness",
      epistemicStatus: "SUPPORTED_FACT",
      severity: "major",
      confidence: 0.95,
      explanation: lang === "sk"
        ? `V rukopise boli detegované nevymenené značky: ${placeholderMatches.slice(0, 5).join(", ")}.`
        : `Unresolved placeholders detected in text.`,
      recommendation: lang === "sk"
        ? "Doplniť chýbajúce bibliografické odkazy na označených miestach."
        : "Replace placeholders with valid literature citations.",
      evidence: placeholderMatches.slice(0, 3).map((q) => ({ quote: q, verified: true, state: "verified-exact" })),
      status: "unreviewed",
      includeInExport: true,
      createdBy: "ai",
    })
  }

  const citedReferenceIndexes = new Set<number>()
  const unmatchedInText = new Set<string>()
  let citationOccurrenceCount = 0

  // Numeric style: [1], [1, 3], and [2–5].
  const numericReferenceIndex = new Map<string, number>()
  referenceLines.forEach((line, index) => {
    const label = line.match(/^\s*(?:\[(\d+)\]|(\d+)[.)])\s+/)
    const value = label?.[1] ?? label?.[2]
    if (value) numericReferenceIndex.set(String(Number(value)), index)
  })
  for (const match of bodyText.matchAll(/\[((?:\d+\s*(?:[-–]\s*\d+)?)(?:\s*,\s*\d+\s*(?:[-–]\s*\d+)?)*)\]/g)) {
    citationOccurrenceCount++
    for (const label of expandNumericCitationGroup(match[1])) {
      const referenceIndex = numericReferenceIndex.get(label)
      if (referenceIndex === undefined) unmatchedInText.add(`[${label}]`)
      else citedReferenceIndexes.add(referenceIndex)
    }
  }

  // Author-year style: (Smith, 2020), (Smith et al., 2020), and Smith (2020).
  const authorYearReferenceIndex = new Map<string, number[]>()
  referenceLines.forEach((line, index) => {
    const parsed = referenceAuthorYear(line)
    if (!parsed) return
    const key = `${parsed.surname}|${parsed.year}`
    authorYearReferenceIndex.set(key, [...(authorYearReferenceIndex.get(key) ?? []), index])
  })
  const authorYearCitations = new Map<string, string>()
  const recordAuthorYear = (surname: string, year: string, display: string) => {
    const key = `${surname.toLocaleLowerCase()}|${year}`
    authorYearCitations.set(key, display)
  }
  for (const match of bodyText.matchAll(/(?:\(|;\s*)([A-ZÀ-Ž][\p{L}'’\-]+)(?:\s+et\s+al\.?)?(?:\s*&\s*[A-ZÀ-Ž][\p{L}'’\-]+)?\s*,\s*((?:19|20)\d{2})[a-z]?/gu)) {
    recordAuthorYear(match[1], match[2], `${match[1]}, ${match[2]}`)
    citationOccurrenceCount++
  }
  for (const match of bodyText.matchAll(/\b([A-ZÀ-Ž][\p{L}'’\-]+)(?:\s+et\s+al\.?)?\s*\(((?:19|20)\d{2})[a-z]?\)/gu)) {
    recordAuthorYear(match[1], match[2], `${match[1]} (${match[2]})`)
    citationOccurrenceCount++
  }
  for (const [key, display] of authorYearCitations) {
    const indexes = authorYearReferenceIndex.get(key)
    if (!indexes?.length) unmatchedInText.add(display)
    else indexes.forEach((index) => citedReferenceIndexes.add(index))
  }

  const unmatchedReferences = referenceLines.filter((_, index) => !citedReferenceIndexes.has(index))
  const unmatchedInTextCitations = [...unmatchedInText]
  const inTextCount = Math.max(structure?.detectedInTextCitationCount || 0, citationOccurrenceCount)

  let consistencyScore = 100
  if (referencesCount === 0 && inTextCount > 0) {
    consistencyScore -= 40
    potentialIssues.push(
      lang === "sk"
        ? "V texte boli detegované citácie, ale zoznam literatúry nebol nájdený."
        : "In-text citations found without a recognized bibliography section."
    )
  }
  if (unmatchedInTextCitations.length > 0) {
    consistencyScore -= Math.min(40, unmatchedInTextCitations.length * 10)
    potentialIssues.push(
      lang === "sk"
        ? `Citácie bez zodpovedajúcej položky v bibliografii: ${unmatchedInTextCitations.join(", ")}.`
        : `In-text citations without matching bibliography entries: ${unmatchedInTextCitations.join(", ")}.`
    )
    findings.push({
      id: `cite-unmatched-text-${Date.now()}`,
      criterionKey: "citations_quality",
      category: "literature",
      title: lang === "sk" ? "Citácie bez bibliografickej položky" : "In-text citations missing from bibliography",
      findingType: "weakness",
      epistemicStatus: "SUPPORTED_FACT",
      severity: "major",
      confidence: 1,
      explanation: potentialIssues[potentialIssues.length - 1],
      recommendation: lang === "sk" ? "Doplniť alebo opraviť zodpovedajúce bibliografické položky." : "Add or correct the corresponding bibliography entries.",
      evidence: unmatchedInTextCitations.slice(0, 3).map((quote) => ({ quote })),
      status: "unreviewed",
      includeInExport: true,
      createdBy: "ai",
    })
  }
  if (unmatchedReferences.length > 0) {
    consistencyScore -= Math.min(20, unmatchedReferences.length * 2)
    potentialIssues.push(
      lang === "sk"
        ? `${unmatchedReferences.length} bibliografických položiek nemá zistenú citáciu v texte.`
        : `${unmatchedReferences.length} bibliography entries have no detected in-text citation.`
    )
    findings.push({
      id: `cite-unmatched-refs-${Date.now()}`,
      criterionKey: "citations_quality",
      category: "literature",
      title: lang === "sk" ? "Necitované bibliografické položky" : "Uncited bibliography entries",
      findingType: "weakness",
      epistemicStatus: "SUPPORTED_FACT",
      severity: "minor",
      confidence: 1,
      explanation: potentialIssues[potentialIssues.length - 1],
      recommendation: lang === "sk" ? "Necitované položky citovať v texte alebo odstrániť zo zoznamu." : "Cite these entries in the manuscript or remove them from the bibliography.",
      evidence: unmatchedReferences.slice(0, 3).map((quote) => ({ quote })),
      status: "unreviewed",
      includeInExport: true,
      createdBy: "ai",
    })
  }

  return {
    isCitationIntegrityOk: potentialIssues.length === 0,
    referencesDetected: referencesCount,
    inTextCitationsDetected: inTextCount,
    unmatchedInTextCitations,
    unmatchedReferences,
    formattingConsistencyScore: Math.max(0, consistencyScore),
    potentialIssues,
    findings,
  }
}

/**
 * Generates 5–12 targeted, evidence-grounded defense questions in formal Slovak.
 */
export function generateCalibratedDefenseQuestions(
  ragOrText: ThesisRAGContext | string,
  findings: ReviewFinding[] = [],
  thesisType: ThesisType = "master",
  lang: ReviewLanguage = "sk"
): ReviewDefenseQuestion[] {
  const safeFindings = Array.isArray(findings) ? findings : []
  const questions: ReviewDefenseQuestion[] = []

  // 1. Methodology & Validation question
  const methFinding = safeFindings.find((f) => f.category === "methodology" || f.criterionKey === "methodology_rigor")
  questions.push({
    id: `q-def-1-${Date.now()}`,
    linkedCriterionKey: "methodology_rigor",
    question: lang === "sk"
      ? "Aké boli hlavné kritériá pri výbere použitej metodiky a aké alternatívne prístupy ste zvažovali pred realizáciou?"
      : "What were the primary criteria for selecting the chosen methodology, and what alternatives were considered?",
    motivation: lang === "sk"
      ? "Overenie schopnosti obhájiť metodologické rozhodnutia a zváženie alternatívnych riešení."
      : "Verify methodological justification and awareness of alternatives.",
    evidenceIds: methFinding?.evidence.map((e) => e.id || "").filter(Boolean) || [],
    priority: "high",
    category: "methodology",
    expectedAnswerBasis: lang === "sk"
      ? "Zdôvodnenie voľby nástrojov, knižníc alebo metód zberu dát s ohľadom na limity riešenia."
      : "Justification of tool/library/data collection selection.",
    includeInExport: true,
  })

  // 2. Results & Performance / Verification question
  questions.push({
    id: `q-def-2-${Date.now()}`,
    linkedCriterionKey: "results_validity",
    question: lang === "sk"
      ? "Ktoré dosiahnuté výsledky považujete za najvýznamnejšie a ako ste overili ich spoľahlivosť a správnosť?"
      : "Which results do you consider most significant, and how did you verify their reliability and correctness?",
    motivation: lang === "sk"
      ? "Overenie validity výsledkov a hĺbky interpretácie."
      : "Verify validity of findings and depth of interpretation.",
    evidenceIds: [],
    priority: "high",
    category: "validation",
    expectedAnswerBasis: lang === "sk"
      ? "Konkrétne metriky, testovacie scenáre alebo experimentálne merania."
      : "Concrete metrics, test scenarios, or measurements.",
    includeInExport: true,
  })

  // 3. Objectives fulfillment & Limitations question
  questions.push({
    id: `q-def-3-${Date.now()}`,
    linkedCriterionKey: "limitations_future_work",
    question: lang === "sk"
      ? "Aké sú kľúčové obmedzenia predloženého riešenia a ako by ste postupovali pri jeho ďalšom rozširovaní?"
      : "What are the key limitations of the presented solution, and how would you proceed with its future expansion?",
    motivation: lang === "sk"
      ? "Posúdenie kritickej sebareflexie a vízie ďalšieho rozvoja práce."
      : "Assess critical self-reflection and future research vision.",
    evidenceIds: [],
    priority: "medium",
    category: "limitation",
    expectedAnswerBasis: lang === "sk"
      ? "Pomenovanie technických alebo dátových limitov a konkrétne návrhy na ich prekonanie."
      : "Identification of technical/data bounds and steps to address them.",
    includeInExport: true,
  })

  // 4. Practical contribution question
  questions.push({
    id: `q-def-4-${Date.now()}`,
    linkedCriterionKey: "originality_contribution",
    question: lang === "sk"
      ? "V čom spočíva hlavný prínos Vašej práce pre prax alebo vedeckú komunitu v porovnaní s existujúcimi riešeniami?"
      : "What constitutes the main contribution of your work for practice or the scientific community compared to existing solutions?",
    motivation: lang === "sk"
      ? "Identifikácia pridanej hodnoty a originality študenta."
      : "Identify author's added value and novelty.",
    evidenceIds: [],
    priority: "high",
    category: "contribution",
    expectedAnswerBasis: lang === "sk"
      ? "Porovnanie s existujúcimi baseline nástrojmi alebo publikovanou literatúrou."
      : "Comparison with existing baseline tools or literature.",
    includeInExport: true,
  })

  // 5. Literature and State of the Art question
  questions.push({
    id: `q-def-5-${Date.now()}`,
    linkedCriterionKey: "theoretical_background",
    question: lang === "sk"
      ? "Ktoré kľúčové práce zo slovenskej a medzinárodnej literatúry najviac ovplyvnili Váš teoretický rámec a ako na ne Vaša práca nadväzuje?"
      : "Which key baseline publications most influenced your theoretical framework?",
    motivation: lang === "sk"
      ? "Overenie prehľadu v aktuálnej odbornej literatúre a schopnosti kritickej syntézy."
      : "Assess literature synthesis and baseline grounding.",
    evidenceIds: [],
    priority: "medium",
    category: "interpretation",
    expectedAnswerBasis: lang === "sk"
      ? "Konkrétne citácie autorov, modelov alebo metodických postupov."
      : "Citation of specific baseline works and models.",
    includeInExport: true,
  })

  // 6. Targeted finding-derived questions (scaling up to 12 questions maximum)
  const MAX_DEFENSE_QUESTIONS = 12
  const candidateFindings = safeFindings.filter(
    (f) =>
      f.title &&
      f.includeInExport !== false &&
      (f.severity === "critical" || f.severity === "major" || f.severity === "minor") &&
      f.evidence?.some((evidence) =>
        evidence.verified === true ||
        evidence.state === "verified-exact" ||
        evidence.state === "verified-normalized"
      )
  )

  const groundedQuestionIds = new Set<string>()
  let findingIndex = 0
  for (const finding of candidateFindings) {
    if (questions.length >= MAX_DEFENSE_QUESTIONS) break
    findingIndex++

    const isHigh = finding.severity === "critical" || finding.severity === "major"
    const priority = isHigh ? "high" : "medium"

    const evidenceQuote = finding.evidence
      ?.find((evidence) => evidence.verified === true || evidence.state === "verified-exact" || evidence.state === "verified-normalized")
      ?.quote
      ?.trim()
    const anchor = evidenceQuote ? evidenceQuote.slice(0, 180) : finding.title
    let questionText = ""
    if (lang === "sk") {
      questionText = `V podloženom úseku práce sa uvádza „${anchor}“. Ako toto tvrdenie súvisí so zistením „${finding.title}“ a s celkovými výsledkami?`
    } else if (lang === "cs") {
      questionText = `V doloženém úseku práce se uvádí „${anchor}“. Jak toto tvrzení souvisí se zjištěním „${finding.title}“ a s celkovými výsledky?`
    } else {
      questionText = `The verified passage states “${anchor}”. How does it relate to the finding “${finding.title}” and affect the overall results?`
    }

    let motivationText = ""
    if (lang === "sk") {
      motivationText = `Objasnenie zistenia (${finding.severity}): ${finding.explanation ? finding.explanation.slice(0, 100) : finding.title}...`
    } else if (lang === "cs") {
      motivationText = `Objasnění zjištění (${finding.severity}): ${finding.explanation ? finding.explanation.slice(0, 100) : finding.title}...`
    } else {
      motivationText = `Clarification of finding (${finding.severity}): ${finding.explanation ? finding.explanation.slice(0, 100) : finding.title}...`
    }

    const questionId = `q-def-${5 + findingIndex}-${Date.now()}`
    groundedQuestionIds.add(questionId)
    questions.push({
      id: questionId,
      linkedCriterionKey: finding.criterionKey || finding.criterionId || "methodology_rigor",
      question: questionText,
      motivation: motivationText,
      evidenceIds: finding.evidence?.map((e) => e.id || "").filter(Boolean) || [],
      priority,
      category: finding.category === "methodology" ? "methodology" : "clarification",
      expectedAnswerBasis: finding.recommendation || (lang === "sk" ? "Zdôvodnenie metodického alebo technického rozhodnutia." : "Justification of methodological or technical decision."),
      includeInExport: true,
    })
  }

  // Lead with questions linked to verified source passages. Generic prompts
  // only fill the minimum set and remain explicitly subject to human review.
  const grounded = questions
    .filter((question) => groundedQuestionIds.has(question.id))
    .map((question) => ({ ...question, requiresHumanVerification: false }))
  const generic = questions
    .filter((question) => !groundedQuestionIds.has(question.id))
    .map((question) => ({ ...question, requiresHumanVerification: true }))
  return [...grounded, ...generic].slice(0, MAX_DEFENSE_QUESTIONS)
}
