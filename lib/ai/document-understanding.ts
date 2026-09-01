/**
 * Document Understanding & Academic Intelligence Engine.
 *
 * Deterministic-first structural extraction, multi-dimensional academic metrics,
 * citation recency analysis, cross-referencing audit, lexical richness,
 * and explainable multi-discipline / methodology classification.
 */

import { createHash } from "crypto"
import type { ReviewLanguage, ThesisMetadata, ThesisType } from "./thesis-rubric"
import type {
  ReviewKind,
  AcademicMetricsReport,
  TOCNode,
} from "./review-types"
import { classifySectionKind, normalizeHeading, type SectionKind } from "./thesis-context"

export type DetailedThesisType =
  | "empirical_quantitative"
  | "experimental_physics"
  | "qualitative"
  | "mixed_methods"
  | "theoretical"
  | "literature_review"
  | "engineering_design"
  | "software_system"
  | "cybersecurity_audit"
  | "case_study"
  | "artistic_practice"
  | "unknown"

export interface ExtractedDocumentSection {
  id: string
  heading: string
  level: number
  content: string
  charCount: number
  wordCount: number
  startOffset: number
  endOffset: number
  kind: SectionKind
}

export interface ExtractedDocumentStructure {
  title?: string
  author?: string
  abstract?: string
  keywords: string[]
  hasTableOfContents: boolean
  headings: Array<{ level: number; title: string; lineIndex: number }>
  sections: ExtractedDocumentSection[]
  figuresCount: number
  tablesCount: number
  hasReferencesSection: boolean
  detectedReferenceLines: string[]
  detectedInTextCitationCount: number
  hasAppendices: boolean
  hasEthicsOrDeclarations: boolean
  hasMethodologyMarkers: boolean
  hasResultsMarkers: boolean
  hasDiscussionMarkers: boolean
  hasConclusionMarkers: boolean
  hasLimitationStatements: boolean
  hasDataOrCodeAvailabilityStatements: boolean
}

export interface StructuralQualitySignal {
  id: string
  label: string
  value: string | number | boolean
  status: "good" | "warning" | "caution" | "info"
  category: "structure" | "citations" | "content" | "integrity"
  signalType: "deterministic" | "heuristic" | "requires_human_verification"
  description: string
}

export interface SourceQualityReport {
  sourceRevision: string
  totalChars: number
  totalWords: number
  sectionCount: number
  extractionQuality: "high" | "medium" | "low"
  canProceedToDeepReview: boolean
  qualityGatePassed: boolean
  warnings: string[]
  limitations: string[]
  signals: StructuralQualitySignal[]
}

export interface DisciplineScoreItem {
  name: string
  score: number
  confidence: number
  tags: string[]
}

export interface DisciplineClassification {
  primaryDiscipline: string
  secondaryDisciplines: string[]
  thesisType: DetailedThesisType
  standardThesisType: ThesisType
  confidence: number // 0.0 - 1.0
  rationale: string
  sourceAnchors: string[]
  scoreBreakdown?: DisciplineScoreItem[]
  isHumanOverridden?: boolean
}

/**
 * Computes deterministic SHA-256 hash of normalized source text.
 */
export function computeSourceRevision(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").trim()
  return createHash("sha256").update(normalized, "utf8").digest("hex").slice(0, 16)
}

const BIBLIOGRAPHY_HEADING_REGEX = /(?:zoznam|seznam).*(?:literat|zdroj)|(?:použit[áé]|pouzit[ae]).*(?:literat|zdroj)|referencie|reference|bibliography|bibliografia|literatúra|literatura/i

/**
 * Extracts structured headings, sections, and structural markers from markdown.
 */
export function extractDocumentStructure(
  markdown: string,
  providedMetadata?: Partial<ThesisMetadata>
): ExtractedDocumentStructure {
  const lines = markdown.split(/\r?\n/)
  const headings: Array<{ level: number; title: string; lineIndex: number }> = []
  const sections: ExtractedDocumentSection[] = []

  let currentHeading = "Preamble / Úvod"
  let currentLevel = 1
  let currentContentLines: string[] = []
  let currentStartOffset = 0
  let runningOffset = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)

    if (headingMatch) {
      const level = headingMatch[1].length
      const titleCandidate = headingMatch[2].trim()

      // Filter out noisy bullet list items or OCR artifacts parsed as headings
      const isBulletArtifact = /^[•○\-\*\u2022\u25E6]\s+/.test(titleCandidate) || (/^\[?[0-9]+[\]\.\)]\s+/.test(titleCandidate) && titleCandidate.length < 15)
      
      if (isBulletArtifact && level >= 3) {
        currentContentLines.push(line)
        runningOffset += line.length + 1
        continue
      }

      if (currentContentLines.length > 0 || headings.length === 0) {
        const content = currentContentLines.join("\n")
        const endOffset = currentStartOffset + content.length
        const kind = classifySectionKind(currentHeading, content)
        sections.push({
          id: `sec-${sections.length + 1}`,
          heading: currentHeading,
          level: currentLevel,
          content,
          charCount: content.length,
          wordCount: content.split(/\s+/).filter(Boolean).length,
          startOffset: currentStartOffset,
          endOffset,
          kind,
        })
        currentContentLines = []
      }

      currentHeading = titleCandidate.replace(/^[#*_`\s]+|[#*_`\s]+$/g, "")
      currentLevel = level
      currentStartOffset = runningOffset + line.length + 1
      headings.push({ level: currentLevel, title: currentHeading, lineIndex: i })
    } else {
      currentContentLines.push(line)
    }

    runningOffset += line.length + 1
  }

  if (currentContentLines.length > 0) {
    const content = currentContentLines.join("\n")
    const kind = classifySectionKind(currentHeading, content)
    sections.push({
      id: `sec-${sections.length + 1}`,
      heading: currentHeading,
      level: currentLevel,
      content,
      charCount: content.length,
      wordCount: content.split(/\s+/).filter(Boolean).length,
      startOffset: currentStartOffset,
      endOffset: currentStartOffset + content.length,
      kind,
    })
  }

  const fullText = markdown.toLowerCase()

  // Extract Abstract
  let abstract: string | undefined
  const abstractSec = sections.find((s) =>
    /abstrakt|abstract|anotácia|anotace|súhrn|souhrn/i.test(s.heading)
  )
  if (abstractSec && abstractSec.content.trim().length > 20) {
    abstract = abstractSec.content.trim().slice(0, 1500)
  }

  // Extract Keywords
  const keywords: string[] = []
  const kwMatch = markdown.match(/(?:kľúčové slová|klíčová slova|keywords|tags)\s*[:：]\s*([^\n\r]+)/i)
  if (kwMatch) {
    kwMatch[1].split(/[,;•|]/).forEach((k) => {
      const clean = k.trim().replace(/^[-*•]\s*/, "")
      if (clean && clean.length > 2 && clean.length < 50) {
        keywords.push(clean)
      }
    })
  }

  // Count figures and tables
  const figuresCount = (markdown.match(/!\[.*?\]\(.*?\)|Obrázok\s+\d+|Figure\s+\d+|Obr\.\s*\d+/gi) || []).length
  const tablesCount = (markdown.match(/\|[\s\S]*?\|[\s\S]*?\||Tabuľka\s+\d+|Table\s+\d+|Tab\.\s*\d+/gi) || []).length

  // References section detection (Slovak, Czech, English)
  const refSec = sections.find((s) => BIBLIOGRAPHY_HEADING_REGEX.test(s.heading))
  const hasReferencesSection = Boolean(refSec)
  const detectedReferenceLines: string[] = []
  if (refSec) {
    refSec.content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 12 && (/^(\[\d+\]|\d+[\.\)]|[-*•])\s+/i.test(l) || /^[A-Z][a-z]+,\s*[A-Z]|\b(19|20)\d{2}\b/i.test(l) || l.includes("doi.org") || l.includes("http")))
      .slice(0, 250)
      .forEach((l) => detectedReferenceLines.push(l))
  }

  // In-text citation regex matches
  const inTextMatches = markdown.match(/\[\d+(?:,\s*\d+)*\]|\([A-Z][a-záčďéíĺľňóôŕšťúýžÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ]+(?: et al\.)?,\s*(?:19|20)\d{2}\)|\[[A-Z][a-z]+(?:\+)?\s*(?:19|20)\d{2}\]/g) || []
  const detectedInTextCitationCount = inTextMatches.length

  const hasTableOfContents = sections.some((s) => /obsah|table of contents|contents/i.test(s.heading))
  const hasAppendices = sections.some((s) => /príloh|příloh|appendix|appendices/i.test(s.heading))
  const hasEthicsOrDeclarations = /čestné vyhlásenie|čestné prohlášení|etick|declaration|ethics|plagiarism declaration/i.test(fullText)
  const hasMethodologyMarkers = /metodol|metodika|postup riešenia|methodology|experimental design|výskumný dizajn|architektúra|návrh systému/i.test(fullText)
  const hasResultsMarkers = /výsledk|vysledk|results|findings|meranie|evaluácia|experimentálne výsledky|testovanie/i.test(fullText)
  const hasDiscussionMarkers = /diskusia|diskuse|discussion|porovnanie výsledkov|komparácia|vyhodnotenie/i.test(fullText)
  const hasConclusionMarkers = /záver|zaver|conclusion|concluding remarks/i.test(fullText)
  const hasLimitationStatements = /limity práce|limitations|obmedzenia výskumu|hrozby validity|threats to validity|možnosti ďalšieho/i.test(fullText)
  const hasDataOrCodeAvailabilityStatements = /dostupnosť dát|data availability|github\.com|gitlab\.com|zenodo|source code availability/i.test(fullText)

  return {
    title: providedMetadata?.thesisTitle,
    author: providedMetadata?.studentName,
    abstract,
    keywords,
    hasTableOfContents,
    headings,
    sections,
    figuresCount,
    tablesCount,
    hasReferencesSection,
    detectedReferenceLines,
    detectedInTextCitationCount,
    hasAppendices,
    hasEthicsOrDeclarations,
    hasMethodologyMarkers,
    hasResultsMarkers,
    hasDiscussionMarkers,
    hasConclusionMarkers,
    hasLimitationStatements,
    hasDataOrCodeAvailabilityStatements,
  }
}

/**
 * Builds a clean, hierarchical Table of Contents tree with proportions and category tags.
 */
export function buildTOCTree(sections: ExtractedDocumentSection[], totalWords: number): TOCNode[] {
  const rootNodes: TOCNode[] = []
  const stack: { node: TOCNode; level: number }[] = []
  const safeTotalWords = Math.max(1, totalWords)

  for (const sec of sections) {
    const isPreambleNoise = sec.level > 2 && (sec.wordCount < 10 || /^(poděkování|čestné|klíčová|abstrakt|abstract|obsah)/i.test(sec.heading))
    if (isPreambleNoise) continue

    const percentOfTotal = Math.round((sec.wordCount / safeTotalWords) * 1000) / 10
    const node: TOCNode = {
      id: sec.id,
      title: sec.heading,
      level: sec.level,
      wordCount: sec.wordCount,
      percentOfTotal,
      kind: sec.kind,
      isEmpty: sec.wordCount === 0 || sec.charCount < 50,
      hasWarning: sec.charCount < 100 && sec.level <= 2 && sec.kind !== "preamble",
      children: [],
    }

    while (stack.length > 0 && stack[stack.length - 1].level >= sec.level) {
      stack.pop()
    }

    if (stack.length === 0) {
      rootNodes.push(node)
    } else {
      stack[stack.length - 1].node.children.push(node)
    }

    stack.push({ node, level: sec.level })
  }

  return rootNodes
}

/**
 * Computes deep academic metrics: Theory vs Practical Balance, TTR Lexical Richness,
 * Citation Recency Dynamics, Cross-Referencing Integrity, Technical Formalization, and IMRaD.
 */
export function computeAcademicMetrics(
  markdown: string,
  structure: ExtractedDocumentStructure,
  metadata?: Partial<ThesisMetadata>,
  lang: ReviewLanguage = "sk"
): AcademicMetricsReport {
  const totalWords = structure.sections.reduce((acc, s) => acc + s.wordCount, 0)
  const safeTotalWords = Math.max(1, totalWords)

  // 1. Balance calculation (Theory vs Practical / Empirical)
  let theoryWordCount = 0
  let practicalWordCount = 0
  let formalWordCount = 0

  for (const sec of structure.sections) {
    switch (sec.kind) {
      case "literature":
        theoryWordCount += sec.wordCount
        break
      case "methodology":
      case "results":
      case "discussion":
        practicalWordCount += sec.wordCount
        break
      case "preamble":
      case "references":
      case "appendix":
        formalWordCount += sec.wordCount
        break
      case "introduction":
      case "conclusion":
      default:
        theoryWordCount += Math.round(sec.wordCount * 0.4)
        practicalWordCount += Math.round(sec.wordCount * 0.6)
        break
    }
  }

  const coreWordCount = Math.max(1, theoryWordCount + practicalWordCount)
  const theoryRatio = Math.round((theoryWordCount / coreWordCount) * 100) / 100
  const practicalRatio = Math.round((practicalWordCount / coreWordCount) * 100) / 100

  const thesisType = metadata?.thesisType || "master"
  const targetBenchmark = thesisType === "bachelor"
    ? { theoryRatio: 0.40, practicalRatio: 0.60, label: "Bc. (40% Teória / 60% Aplikačná časť)" }
    : thesisType === "phd"
    ? { theoryRatio: 0.25, practicalRatio: 0.75, label: "PhD. (25% Stav poznania / 75% Vlastný výskum a prínos)" }
    : { theoryRatio: 0.35, practicalRatio: 0.65, label: "Ing./Mgr. (35% Teoretické východiská / 65% Návrh, realizácia a evaluácia)" }

  let balanceStatus: "balanced" | "theory_heavy" | "practical_heavy" | "unclear" = "balanced"
  let balanceSummary = ""

  if (theoryRatio > targetBenchmark.theoryRatio + 0.18) {
    balanceStatus = "theory_heavy"
    balanceSummary = lang === "sk"
      ? `Práca obsahuje nadmerný podiel teoretickej rešerše (${Math.round(theoryRatio * 100)}%), vlastná realizačná/výskumná časť tvorí iba ${Math.round(practicalRatio * 100)}%.`
      : `Manuscript is theory-heavy (${Math.round(theoryRatio * 100)}% theoretical background vs ${Math.round(practicalRatio * 100)}% practical/empirical work).`
  } else if (practicalRatio > targetBenchmark.practicalRatio + 0.18) {
    balanceStatus = "practical_heavy"
    balanceSummary = lang === "sk"
      ? `Práca má silný praktický/aplikačný charakter (${Math.round(practicalRatio * 100)}%), teoretická báza a rešerš sú stručnejšie (${Math.round(theoryRatio * 100)}%).`
      : `Manuscript is practically oriented (${Math.round(practicalRatio * 100)}% implementation/results vs ${Math.round(theoryRatio * 100)}% literature review).`
  } else {
    balanceStatus = "balanced"
    balanceSummary = lang === "sk"
      ? `Výborne vyvážený pomer teoretickej bázy (${Math.round(theoryRatio * 100)}%) a vlastnej výskumnej/realizačnej časti (${Math.round(practicalRatio * 100)}%).`
      : `Well-balanced ratio of theoretical foundations (${Math.round(theoryRatio * 100)}%) and practical execution (${Math.round(practicalRatio * 100)}%).`
  }

  // 2. Lexical richness & Style metrics
  const cleanTokens = markdown
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2)

  const tokenFreq = new Map<string, number>()
  for (const token of cleanTokens) {
    tokenFreq.set(token, (tokenFreq.get(token) || 0) + 1)
  }

  const uniqueTokensCount = tokenFreq.size
  const typeTokenRatio = cleanTokens.length > 0 ? Math.round((uniqueTokensCount / cleanTokens.length) * 100) / 100 : 0.4
  let hapaxCount = 0
  for (const count of tokenFreq.values()) {
    if (count === 1) hapaxCount++
  }
  const hapaxLegomenaRatio = cleanTokens.length > 0 ? Math.round((hapaxCount / cleanTokens.length) * 100) / 100 : 0.2

  const sentences = markdown.split(/[.!?]+(?:\s+|$)/).filter((s) => s.trim().length > 15)
  const avgSentenceLengthWords = sentences.length > 0 ? Math.round((totalWords / sentences.length) * 10) / 10 : 16.5

  const totalCharsInWords = cleanTokens.reduce((acc, t) => acc + t.length, 0)
  const avgWordLengthChars = cleanTokens.length > 0 ? Math.round((totalCharsInWords / cleanTokens.length) * 10) / 10 : 6.2

  // Academic Formality & Discourse markers
  const academicFormalityMarkers = (markdown.match(/\b(z uvedeného vyplýva|na základe|je možné konštatovať|vzhľadom na|v kontexte|dôkazom je|predpokladá sa|analýza preukázala|výsledky indikujú|z hľadiska|v súlade s|v porovnaní s|na rozdiel od|v rámci výskumu|na základe zistení)\b/gi) || []).length
  const informalPronouns = (markdown.match(/\b(ja som|som spravil|som urobil|podľa mňa|môj názor|chcel som|rozhodol som sa|spravil som|urobila som|vytvoril som)\b/gi) || []).length
  const hedgingMatches = (markdown.match(/\b(naznačuje|predpokladáme|možno predpokladať|indikuje|pravdepodobne|do určitej miery|pomerne|dá sa očakávať|potenciálne|predbežne)\b/gi) || []).length

  const hedgingRatioPer1000 = Math.round((hedgingMatches / (safeTotalWords / 1000)) * 10) / 10
  const formalityScore = Math.max(30, Math.min(98, Math.round(75 + (academicFormalityMarkers * 2) - (informalPronouns * 5))))

  const vocabularyRichness: "high" | "moderate" | "low" = typeTokenRatio >= 0.35 ? "high" : typeTokenRatio >= 0.25 ? "moderate" : "low"

  // 3. Citation Recency Dynamics
  const yearsFound: number[] = []
  const yearMatches = markdown.match(/\b((?:19[789]\d|20[012]\d))\b/g) || []
  const currentYear = 2026

  for (const yStr of yearMatches) {
    const y = parseInt(yStr, 10)
    if (y >= 1970 && y <= currentYear) {
      yearsFound.push(y)
    }
  }

  let medianYear: number | null = null
  let recency5YearsRatio = 0
  const decadeBreakdown: Record<string, number> = {
    "2020+": 0,
    "2015-2019": 0,
    "2010-2014": 0,
    "pre-2010": 0,
  }

  if (yearsFound.length > 0) {
    yearsFound.sort((a, b) => a - b)
    medianYear = yearsFound[Math.floor(yearsFound.length / 2)]

    const recentCount = yearsFound.filter((y) => y >= currentYear - 5).length
    recency5YearsRatio = Math.round((recentCount / yearsFound.length) * 100) / 100

    for (const y of yearsFound) {
      if (y >= 2020) decadeBreakdown["2020+"]++
      else if (y >= 2015) decadeBreakdown["2015-2019"]++
      else if (y >= 2010) decadeBreakdown["2010-2014"]++
      else decadeBreakdown["pre-2010"]++
    }
  }

  const recencyStatus = yearsFound.length === 0 ? "no_data" : recency5YearsRatio >= 0.45 ? "fresh" : recency5YearsRatio >= 0.25 ? "adequate" : "outdated"

  const sourceTypesBreakdown: Record<string, number> = {
    article: (markdown.match(/\b(journal|transactions|proceedings|ieee|acm|vol\.|issue)\b/gi) || []).length,
    book: (markdown.match(/\b(isbn|springer|wiley|o'reilly|nakladatelství|vydavateľstvo)\b/gi) || []).length,
    web: (markdown.match(/\b(http|online|dostupné|available at)\b/gi) || []).length,
    thesis: (markdown.match(/\b(diplomov|bakalársk|dizertač|thesis|dissertation)\b/gi) || []).length,
    preprint: (markdown.match(/\b(arxiv|biorxiv|preprint)\b/gi) || []).length,
  }

  // 4. Cross-referencing & Visual Integrity
  const figureRefs = (markdown.match(/(?:viď|pozri|na|v|podľa)?\s*(?:obrázku?|obrázok|obrázku|figure|fig\.|obr\.)\s*(\d+(?:\.\d+)*)/gi) || []).length
  const tableRefs = (markdown.match(/(?:viď|pozri|na|v|podľa)?\s*(?:tabuľke?|tabuľka|tabuľku|table|tab\.)\s*(\d+(?:\.\d+)*)/gi) || []).length

  const figuresTotal = structure.figuresCount
  const tablesTotal = structure.tablesCount
  const figuresReferenced = Math.min(figuresTotal, figureRefs)
  const tablesReferenced = Math.min(tablesTotal, tableRefs)
  const figuresOrphaned = Math.max(0, figuresTotal - figuresReferenced)
  const tablesOrphaned = Math.max(0, tablesTotal - tablesReferenced)

  const totalVisualAssets = figuresTotal + tablesTotal
  const totalReferenced = figuresReferenced + tablesReferenced
  const integrityScore = totalVisualAssets > 0 ? Math.round((totalReferenced / totalVisualAssets) * 100) : 100

  const orphanedItems: string[] = []
  if (figuresOrphaned > 0) {
    orphanedItems.push(`${figuresOrphaned} obrázkov bez priameho odkazu v odstavcoch textu`)
  }
  if (tablesOrphaned > 0) {
    orphanedItems.push(`${tablesOrphaned} tabuliek bez explicitného odkazu v texte`)
  }

  // 5. Technical Formalization
  const equationsCount = (markdown.match(/\$\$[\s\S]*?\$\$|\\begin\{equation\}[\s\S]*?\\end\{equation\}|\$[^$\n]+\$/g) || []).length
  const codeBlocksCount = (markdown.match(/```[\s\S]*?```/g) || []).length
  const equationsDensityPer10k = Math.round((equationsCount / (safeTotalWords / 10000)) * 10) / 10
  const codeDensityPer10k = Math.round((codeBlocksCount / (safeTotalWords / 10000)) * 10) / 10

  const technicalRigorLevel: "high" | "medium" | "low" | "none" =
    (equationsCount >= 10 || codeBlocksCount >= 8) ? "high" :
    (equationsCount >= 3 || codeBlocksCount >= 2) ? "medium" :
    (equationsCount > 0 || codeBlocksCount > 0) ? "low" : "none"

  // 6. IMRaD & Scientific Phase Completeness
  const phases = [
    { key: "intro", name: lang === "sk" ? "1. Úvod & Ciele" : "1. Introduction & Goals", kind: "introduction" as SectionKind },
    { key: "lit", name: lang === "sk" ? "2. Teoretické východiská" : "2. Literature Review", kind: "literature" as SectionKind },
    { key: "method", name: lang === "sk" ? "3. Metodika & Návrh" : "3. Methodology & Design", kind: "methodology" as SectionKind },
    { key: "impl", name: lang === "sk" ? "4. Realizácia / Experimenty" : "4. Implementation / Experiments", kind: "methodology" as SectionKind },
    { key: "results", name: lang === "sk" ? "5. Výsledky & Evaluácia" : "5. Results & Evaluation", kind: "results" as SectionKind },
    { key: "discussion", name: lang === "sk" ? "6. Diskusia & Limity" : "6. Discussion & Threats", kind: "discussion" as SectionKind },
    { key: "conclusion", name: lang === "sk" ? "7. Záver & Prínos" : "7. Conclusion & Future Work", kind: "conclusion" as SectionKind },
    { key: "references", name: lang === "sk" ? "8. Zoznam zdrojov" : "8. References", kind: "references" as SectionKind },
  ].map((p) => {
    const matchingSections = structure.sections.filter((s) => s.kind === p.kind)
    const sectionWords = matchingSections.reduce((acc, s) => acc + s.wordCount, 0)
    const percentage = Math.round((sectionWords / safeTotalWords) * 1000) / 10

    let status: "complete" | "partial" | "missing" = "missing"
    if (sectionWords >= 200 || (matchingSections.length > 0 && sectionWords >= Math.max(10, safeTotalWords * 0.05))) {
      status = "complete"
    } else if (sectionWords > 0 || matchingSections.length > 0) {
      status = "partial"
    }

    return {
      key: p.key,
      name: p.name,
      status,
      wordCount: sectionWords,
      percentage,
    }
  })

  const completePhasesCount = phases.filter((p) => p.status === "complete").length
  const partialPhasesCount = phases.filter((p) => p.status === "partial").length
  const completenessScore = Math.round(((completePhasesCount * 12.5) + (partialPhasesCount * 6.25)))

  return {
    balance: {
      theoryWordCount,
      practicalWordCount,
      formalWordCount,
      theoryRatio,
      practicalRatio,
      targetBenchmark,
      status: balanceStatus,
      summary: balanceSummary,
    },
    lexical: {
      typeTokenRatio,
      vocabularyRichness,
      hapaxLegomenaRatio,
      avgSentenceLengthWords,
      avgWordLengthChars,
      academicFormalityScore: formalityScore,
      hedgingRatioPer1000,
      detectedFirstPersonPronounsCount: informalPronouns,
    },
    citations: {
      totalReferences: structure.detectedReferenceLines.length,
      inTextCitationsCount: structure.detectedInTextCitationCount,
      citationsPer1000Words: Math.round((structure.detectedInTextCitationCount / (safeTotalWords / 1000)) * 10) / 10,
      medianPublicationYear: medianYear,
      recency5YearsRatio,
      recencyStatus,
      decadeBreakdown,
      sourceTypesBreakdown,
    },
    crossReferencing: {
      figuresTotal,
      figuresReferenced,
      figuresOrphaned,
      tablesTotal,
      tablesReferenced,
      tablesOrphaned,
      integrityScore,
      orphanedItems,
    },
    formalization: {
      equationsCount,
      codeBlocksCount,
      equationsDensityPer10k,
      codeDensityPer10k,
      technicalRigorLevel,
    },
    imrad: {
      phases,
      completenessScore,
    },
  }
}

/**
 * Calculates deterministic and heuristic quality signals.
 */
export function computeStructuralQualitySignals(
  structure: ExtractedDocumentStructure,
  totalChars: number,
  lang: ReviewLanguage = "sk"
): StructuralQualitySignal[] {
  const signals: StructuralQualitySignal[] = []
  const totalWords = structure.sections.reduce((acc, s) => acc + s.wordCount, 0)

  // 1. Length & volume
  signals.push({
    id: "sig-word-count",
    label: lang === "sk" ? "Rozsah textu (slová)" : "Word count",
    value: totalWords,
    status: totalWords > 8000 ? "good" : totalWords > 3000 ? "info" : "warning",
    category: "structure",
    signalType: "deterministic",
    description: lang === "sk"
      ? `Extrahovaných ${totalWords.toLocaleString()} slov (${totalChars.toLocaleString()} znakov).`
      : `Extracted ${totalWords.toLocaleString()} words (${totalChars.toLocaleString()} chars).`,
  })

  // 2. Sections count & hierarchy
  const majorSections = structure.sections.filter((s) => s.level <= 2 && s.charCount > 100)
  signals.push({
    id: "sig-major-sections",
    label: lang === "sk" ? "Hlavné kapitoly" : "Major sections",
    value: majorSections.length,
    status: majorSections.length >= 4 ? "good" : "warning",
    category: "structure",
    signalType: "deterministic",
    description: lang === "sk"
      ? `Detegovaných ${majorSections.length} hlavných obsahových kapitol.`
      : `Detected ${majorSections.length} major body chapters.`,
  })

  // 3. Heading hierarchy skips
  let headingSkips = 0
  for (let i = 1; i < structure.headings.length; i++) {
    if (structure.headings[i].level > structure.headings[i - 1].level + 1) {
      headingSkips++
    }
  }
  if (headingSkips > 0) {
    signals.push({
      id: "sig-heading-hierarchy",
      label: lang === "sk" ? "Hierarchia nadpisov" : "Heading hierarchy",
      value: `${headingSkips} preskokov`,
      status: "caution",
      category: "integrity",
      signalType: "heuristic",
      description: lang === "sk"
        ? `Nájdených ${headingSkips} prípadov nesúvislého číslovania úrovní nadpisov (napr. H1 priamo na H3).`
        : `Found ${headingSkips} instances of discontinuous heading levels.`,
    })
  }

  // 4. Abstract presence
  signals.push({
    id: "sig-abstract",
    label: lang === "sk" ? "Prítomnosť abstraktu" : "Abstract presence",
    value: Boolean(structure.abstract),
    status: structure.abstract ? "good" : "warning",
    category: "content",
    signalType: "deterministic",
    description: structure.abstract
      ? (lang === "sk" ? "Abstrakt bol úspešne identifikovaný a extrahovaný." : "Abstract identified.")
      : (lang === "sk" ? "V extrahovanom texte chýba explicitná sekcia abstraktu." : "Missing abstract section in parsed text."),
  })

  // 5. References section
  signals.push({
    id: "sig-references",
    label: lang === "sk" ? "Zoznam literatúry" : "Bibliography section",
    value: structure.hasReferencesSection ? `${structure.detectedReferenceLines.length} položiek` : "Chýba",
    status: structure.hasReferencesSection && structure.detectedReferenceLines.length >= 10
      ? "good"
      : structure.hasReferencesSection
      ? "info"
      : "warning",
    category: "citations",
    signalType: "deterministic",
    description: structure.hasReferencesSection
      ? (lang === "sk" ? `Detegovaný zoznam literatúry s cca ${structure.detectedReferenceLines.length} položkami.` : `Detected bibliography with ${structure.detectedReferenceLines.length} entries.`)
      : (lang === "sk" ? "V extrahovanom texte nebola nájdená samostatná sekcia literatúry." : "No separate bibliography section found in parsed text."),
  })

  // 6. In-text citation density
  signals.push({
    id: "sig-intext-citations",
    label: lang === "sk" ? "Citácie v texte" : "In-text citations",
    value: structure.detectedInTextCitationCount,
    status: structure.detectedInTextCitationCount > 15 ? "good" : structure.detectedInTextCitationCount > 3 ? "caution" : "warning",
    category: "citations",
    signalType: "heuristic",
    description: lang === "sk"
      ? `Nájdených ${structure.detectedInTextCitationCount} odkazov na citácie v texte.`
      : `Found ${structure.detectedInTextCitationCount} in-text citation markers.`,
  })

  // 7. Empty or suspiciously short sections (< 100 chars)
  const emptySections = structure.sections.filter((s) => s.charCount < 100 && s.level <= 2 && s.kind !== "preamble")
  if (emptySections.length > 0) {
    signals.push({
      id: "sig-empty-sections",
      label: lang === "sk" ? "Veľmi krátke sekcie" : "Short sections",
      value: emptySections.length,
      status: "caution",
      category: "integrity",
      signalType: "deterministic",
      description: lang === "sk"
        ? `${emptySections.length} kapitol má menej ako 100 znakov (môže ísť o chybu parsovania tabuliek alebo prázdne štruktúry).`
        : `${emptySections.length} sections contain fewer than 100 characters.`,
    })
  }

  // 8. Research traceability markers
  const traceabilityStatus = structure.hasMethodologyMarkers && structure.hasResultsMarkers && structure.hasConclusionMarkers
  signals.push({
    id: "sig-traceability",
    label: lang === "sk" ? "Štrukturálna nadväznosť (Metódy → Výsledky → Záver)" : "Traceability markers",
    value: traceabilityStatus ? "Kompletná" : "Čiastočná",
    status: traceabilityStatus ? "good" : "caution",
    category: "content",
    signalType: "requires_human_verification",
    description: lang === "sk"
      ? (traceabilityStatus ? "Identifikované všetky štandardné fázy výskumu (metódy, výsledky, záver)." : "Chýbajú niektoré kľúčové značky štandardnej vedeckej štruktúry.")
      : (traceabilityStatus ? "Core research phases identified." : "Some core research markers are missing in parsed text."),
  })

  return signals
}

/**
 * Builds a comprehensive SourceQualityReport and determines parse gating.
 */
export function buildSourceQualityReport(
  markdown: string,
  providedMetadata?: Partial<ThesisMetadata>,
  lang: ReviewLanguage = "sk"
): SourceQualityReport {
  const structure = extractDocumentStructure(markdown, providedMetadata)
  const totalChars = markdown.length
  const totalWords = structure.sections.reduce((acc, s) => acc + s.wordCount, 0)
  const signals = computeStructuralQualitySignals(structure, totalChars, lang)
  const sourceRevision = computeSourceRevision(markdown)

  const warnings: string[] = []
  const limitations: string[] = []

  let extractionQuality: "high" | "medium" | "low" = "low"
  if (totalChars > 20_000 && structure.sections.length >= 4 && structure.hasReferencesSection) {
    extractionQuality = "high"
  } else if (totalChars > 2_000 && structure.sections.length >= 2) {
    extractionQuality = "medium"
  } else {
    extractionQuality = "low"
  }

  if (extractionQuality === "low") {
    warnings.push(
      lang === "sk"
        ? "Extrahovaný text má veľmi malý rozsah (menej ako 2 000 znakov). Posúdenie bude limitované na prehľadový náčrt."
        : "Extracted character count is very low (< 2,000 characters). Analysis will be restricted to an overview."
    )
    limitations.push(
      lang === "sk"
        ? "Nedostatočný rozsah podkladového textu neumožňuje hĺbkové overenie experimentov a analytických detailov."
        : "Insufficient document text volume prevents deep verification of experimental details."
    )
  }

  if (!structure.hasReferencesSection) {
    warnings.push(
      lang === "sk"
        ? "Nebola nájdená samostatná sekcia referencií / zoznamu literatúry."
        : "No standalone bibliography section found in parsed text."
    )
    limitations.push(
      lang === "sk"
        ? "Automatický citačný audit bude orientačný z dôvodu absencie formálneho zoznamu literatúry."
        : "Automated citation audit will be limited due to the missing bibliography section."
    )
  }

  if (!structure.hasMethodologyMarkers) {
    limitations.push(
      lang === "sk"
        ? "V extrahovanom texte sa nepodarilo jednoznačne lokalizovať metodologickú kapitolu."
        : "Methodology section could not be clearly localized in parsed text."
    )
  }

  const qualityGatePassed = extractionQuality !== "low" && totalChars > 2_000
  const canProceedToDeepReview = qualityGatePassed

  return {
    sourceRevision,
    totalChars,
    totalWords,
    sectionCount: structure.sections.length,
    extractionQuality,
    canProceedToDeepReview,
    qualityGatePassed,
    warnings,
    limitations,
    signals,
  }
}

interface DisciplineKeywordDef {
  name: string
  tags: string[]
  regex: RegExp
}

const DISCIPLINE_DEFINITIONS: DisciplineKeywordDef[] = [
  {
    name: "Informatika a kybernetická bezpečnosť (STEM)",
    tags: ["Kybernetická bezpečnosť", "Etický hacking", "Penetračné testovanie", "Webové zraniteľnosti"],
    regex: /\b(hacking|etick[yý]|zraniteľn|zraniteln|vulnerability|xss|sql injection|sqli|csrf|burp suite|kali linux|dvwa|exploat|exploitat|penetračn|autentiz|šifrov|firewall|bezpečnosť web|bezpecnost|útok|útoky|command injection|file inclusion|brute force)\b/i,
  },
  {
    name: "Umelá inteligencia a dátová veda (STEM)",
    tags: ["Machine Learning", "Deep Learning", "LLM", "NLP", "Neurónové siete"],
    regex: /\b(umel[aá] inteligencia|uměl[aá] inteligence|machine learning|deep learning|neurón|neural network|transformer|llm|nlp|rag\b|retrieval|vektor|embedding|pgvector|dataset|benchmark|hyperparameter|loss function|f1-score|klasifik|predikcia)\b/i,
  },
  {
    name: "Softvérové inžinierstvo a webové technológie (STEM)",
    tags: ["Fullstack", "Webové aplikácie", "Softvérová architektúra", "API"],
    regex: /\b(softvér|software|webov[yáé]|aplikáci[a-z]*|aplikac[a-z]*|frontend|backend|framework|react|next\.js|node\.js|typescript|javascript|databáz|database|sql|rest api|architektúr|graphql|docker|git\b|používateľské rozhranie|gui|wireframe)\b/i,
  },
  {
    name: "Informačné systémy a IT manažment",
    tags: ["Grantový manažment", "Informačné systémy", "Projektové riadenie", "Procesy"],
    regex: /\b(informačn[yýé] systém|grantov[yýé]|projektov[yýé] manažment|proces|monitoring|agiln|scrum|workflow|erp|crm|architektúra podniku|itms|apvv|kega|vega|post-award|pre-award|výkazníctvo)\b/i,
  },
  {
    name: "Fyzika, astronómia a materiálové vedy (STEM)",
    tags: ["Kvantová fyzika", "Experimentálna fyzika", "Spektroskopia", "Časticová fyzika"],
    regex: /\b(fyzik[a-z]*|physics|kvantov[a-z]*|qubit|supravodiv[a-z]*|kryostat|spektroskop|optik[a-z]*|laser|častic[a-z]*|particle|termodynam|mechanik[a-z]*|materiál[a-z]*|hadrón|polovodič|relativist[a-z]*|bozón|boson|lhc|cern|atlas|josephson)\b/i,
  },
  {
    name: "Elektrotechnika, robotika a automatizácia (STEM)",
    tags: ["Robotika", "Mikrokontroléry", "Zabudované systémy", "Senzory"],
    regex: /\b(elektrotechn|elektronik|obvod|mikrokontrol|arduino|raspberry|senzor|mechatronik|robotik|signál|fpga|dsp|automatiz|riadenie pohonov)\b/i,
  },
  {
    name: "Medicína, farmácia a biomedicínske vedy",
    tags: ["Klinický výskum", "Biomedicína", "Diagnostika", "Terapia"],
    regex: /\b(medicín|klinick|pacient|diagnost|terapi|farmak|liečiv|chorob|bunk[a-z]*|genet|biol|baktéri|vírus|onkolog|chirurg|randomizovan|placebo)\b/i,
  },
  {
    name: "Ekonómia, financie a podnikový manažment",
    tags: ["Manažment", "Financie", "Digitálny marketing", "Podnikanie"],
    regex: /\b(ekonóm|financ|marketing|bankov|invest|trh\b|podnik[a-z]*|účetn|náklad[a-z]*|výnos[a-z]*|mikropodnik|malé a stredné|konkuren|zisk|e-commerce|seo\b|webová analytika|konverzia)\b/i,
  },
  {
    name: "Spoločenské vedy, právo a humanitné vedy",
    tags: ["Spoločenské vedy", "Právo", "Pedagogika", "Filozofia"],
    regex: /\b(sociol|psycholog|pedagog|filozof|históri|jazykoved|lingvist|právo|právn|legislatív|etika\b|politol|didaktik)\b/i,
  },
]

/**
 * Multi-dimensional, explainable Discipline & Thesis Type Classifier.
 * Weighted term scoring across Title (10x), Abstract (5x), Headings (3x), and Body (1x).
 */
export function classifyDisciplineAndThesisType(
  markdown: string,
  metadata?: Partial<ThesisMetadata>,
  lang: ReviewLanguage = "sk"
): DisciplineClassification {
  const fullLower = markdown.toLowerCase()
  const title = (metadata?.thesisTitle || "").toLowerCase()
  const dept = (metadata?.department || "").toLowerCase()
  const headingsText = (markdown.match(/^#{1,4}\s+(.+)$/gm) || []).join(" ").toLowerCase()
  const abstractText = (markdown.match(/(?:abstrakt|abstract|anotácia)[\s\S]{0,1000}/i)?.[0] || "").toLowerCase()

  const sourceAnchors: string[] = []
  const scores: DisciplineScoreItem[] = []

  for (const def of DISCIPLINE_DEFINITIONS) {
    const titleMatches = (title.match(new RegExp(def.regex.source, "gi")) || []).length
    const deptMatches = (dept.match(new RegExp(def.regex.source, "gi")) || []).length
    const abstractMatches = (abstractText.match(new RegExp(def.regex.source, "gi")) || []).length
    const headingMatches = (headingsText.match(new RegExp(def.regex.source, "gi")) || []).length
    const bodyMatches = (fullLower.match(new RegExp(def.regex.source, "gi")) || []).length

    const weightedScore = (titleMatches * 15) + (deptMatches * 12) + (abstractMatches * 6) + (headingMatches * 4) + Math.min(60, bodyMatches * 1.2)

    if (weightedScore > 0) {
      scores.push({
        name: def.name,
        score: Math.round(weightedScore),
        confidence: Math.min(0.98, Math.round((weightedScore / 40) * 100) / 100),
        tags: def.tags,
      })
    }
  }

  scores.sort((a, b) => b.score - a.score)

  let primaryDiscipline = "Informatika a výpočtová technika (STEM)"
  let confidence = 0.85
  const secondaryDisciplines: string[] = []

  if (scores.length > 0 && scores[0].score > 8) {
    primaryDiscipline = scores[0].name
    confidence = Math.max(0.75, Math.min(0.96, scores[0].confidence))
    sourceAnchors.push(`Dominantné tematické ukotvenie: ${scores[0].tags.join(", ")} (skóre: ${scores[0].score})`)

    for (let i = 1; i < Math.min(3, scores.length); i++) {
      if (scores[i].score >= scores[0].score * 0.35 && scores[i].score > 15) {
        secondaryDisciplines.push(scores[i].name)
      }
    }
  } else {
    sourceAnchors.push("Všeobecné interdisciplinárne akademické ukotvenie")
  }

  // 2. Detailed thesis type / research methodology classification
  let thesisType: DetailedThesisType = "software_system"

  const hasHackingAudit = /etick[yý]\s+hacking|penetračn|zraniteľn|vulnerability|brute force|burp suite|sql injection|xss/i.test(fullLower + " " + title)
  const hasPhysicsExp = /qubit|supravodiv|kryostat|spektro|hadrón|bozón|lhc|cern|interferom|laser/i.test(fullLower + " " + title)
  const hasSystematicLit = /systematická rešerš|systematic review|meta-analýza|databázy wos|scopus|vyhľadávacia stratégia|kritériá zaradenia/i.test(fullLower)
  const hasQuantEmpirical = /štatistick|p-value|hypotéz|regresia|vzorka|dotazník|meranie veličín|experimentálne meranie|anova|t-test/i.test(fullLower)
  const hasQualitative = /kvalitatívny|pološtruktúrovaný rozhovor|hĺbkový rozhovor|focus group|tematická analýza|grounded theory|kódovanie dát/i.test(fullLower)
  const hasTheoretical = /teoretický model|dôkaz vety|matematická formulácia|axióm|lema|analytické riešenie/i.test(fullLower)
  const hasCaseStudy = /prípadová štúdia|case study|analýza podniku|skúmaná organizácia/i.test(fullLower)
  const hasSystemImpl = /implement|architektúra systému|použité technológie|databázov|frontend|backend|gui|používateľské rozhranie|api|testovanie systému/i.test(fullLower)

  if (hasHackingAudit) {
    thesisType = "cybersecurity_audit"
    confidence = Math.max(confidence, 0.92)
    sourceAnchors.push("Identifikovaná metodológia penetračného testovania, auditu zraniteľností a návrhu ochrany")
  } else if (hasPhysicsExp) {
    thesisType = "experimental_physics"
    confidence = Math.max(confidence, 0.92)
    sourceAnchors.push("Detegované experimentálne merania fyzikálnych veličín a laboratórna aparatúra")
  } else if (hasSystematicLit) {
    thesisType = "literature_review"
    confidence = Math.max(confidence, 0.90)
    sourceAnchors.push("Detegovaný protokol systematickej rešerše a vyhľadávacie kritériá")
  } else if (hasQualitative) {
    thesisType = "qualitative"
    confidence = Math.max(confidence, 0.85)
    sourceAnchors.push("Detegované metódy kvalitatívneho výskumu (rozhovory, tematické kódovanie)")
  } else if (hasQuantEmpirical) {
    thesisType = "empirical_quantitative"
    confidence = Math.max(confidence, 0.88)
    sourceAnchors.push("Detegované štatistické testovanie hypotéz, kvantitatívna vzorka a dátové metriky")
  } else if (hasTheoretical) {
    thesisType = "theoretical"
    confidence = Math.max(confidence, 0.85)
    sourceAnchors.push("Detegované matematické modely, vety a analytické odvodenia")
  } else if (hasCaseStudy) {
    thesisType = "case_study"
    confidence = Math.max(confidence, 0.85)
    sourceAnchors.push("Detegovaná metodológia prípadovej štúdie v konkrétnom kontexte")
  } else if (hasSystemImpl) {
    thesisType = "software_system"
    confidence = Math.max(confidence, 0.90)
    sourceAnchors.push("Detegovaný návrh softvérovej architektúry, databázy a implementácia")
  } else {
    thesisType = "engineering_design"
    confidence = Math.max(confidence, 0.75)
    sourceAnchors.push("Všeobecný inžiniersky a aplikačný charakter práce")
  }

  const standardThesisType: ThesisType = metadata?.thesisType || "master"

  const rationale = lang === "sk"
    ? `Práca bola klasifikovaná ako ${primaryDiscipline} s typom metodológie [${thesisType}] na základe váženej frekvencie odborných pojmov (${sourceAnchors.join(" · ")}).`
    : `Work classified as ${primaryDiscipline} with methodology type [${thesisType}] based on weighted domain terminology frequency.`

  return {
    primaryDiscipline,
    secondaryDisciplines,
    thesisType,
    standardThesisType,
    confidence,
    rationale,
    sourceAnchors,
    scoreBreakdown: scores.slice(0, 5),
  }
}
