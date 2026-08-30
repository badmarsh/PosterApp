/**
 * Document Understanding Engine.
 *
 * Deterministic-first structural extraction, quality signals, source revision hashing,
 * and explainable thesis-type / discipline classification.
 */

import { createHash } from "crypto"
import type { ReviewLanguage, ThesisMetadata, ThesisType } from "./thesis-rubric"
import type { ReviewKind } from "./review-types"

export type DetailedThesisType =
  | "empirical_quantitative"
  | "experimental_physics"
  | "qualitative"
  | "mixed_methods"
  | "theoretical"
  | "literature_review"
  | "engineering_design"
  | "software_system"
  | "case_study"
  | "artistic_practice"
  | "unknown"

export interface ExtractedDocumentStructure {
  title?: string
  author?: string
  abstract?: string
  keywords: string[]
  hasTableOfContents: boolean
  headings: Array<{ level: number; title: string; lineIndex: number }>
  sections: Array<{
    id: string
    heading: string
    level: number
    content: string
    charCount: number
    wordCount: number
    startOffset: number
    endOffset: number
  }>
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

export interface DisciplineClassification {
  primaryDiscipline: string
  secondaryDisciplines: string[]
  thesisType: DetailedThesisType
  standardThesisType: ThesisType
  confidence: number // 0.0 - 1.0
  rationale: string
  sourceAnchors: string[]
  isHumanOverridden?: boolean
}

/**
 * Computes deterministic SHA-256 hash of normalized source text.
 */
export function computeSourceRevision(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").trim()
  return createHash("sha256").update(normalized, "utf8").digest("hex").slice(0, 16)
}

/**
 * Extracts structured headings, sections, and structural markers from markdown.
 */
export function extractDocumentStructure(
  markdown: string,
  providedMetadata?: Partial<ThesisMetadata>
): ExtractedDocumentStructure {
  const lines = markdown.split(/\r?\n/)
  const headings: Array<{ level: number; title: string; lineIndex: number }> = []
  const sections: ExtractedDocumentStructure["sections"] = []

  let currentHeading = "Úvod / Predhovor"
  let currentLevel = 1
  let currentContentLines: string[] = []
  let currentStartOffset = 0
  let runningOffset = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)

    if (headingMatch) {
      if (currentContentLines.length > 0 || headings.length === 0) {
        const content = currentContentLines.join("\n")
        const endOffset = currentStartOffset + content.length
        sections.push({
          id: `sec-${sections.length + 1}`,
          heading: currentHeading,
          level: currentLevel,
          content,
          charCount: content.length,
          wordCount: content.split(/\s+/).filter(Boolean).length,
          startOffset: currentStartOffset,
          endOffset,
        })
        currentContentLines = []
      }

      currentHeading = headingMatch[2].trim()
      currentLevel = headingMatch[1].length
      currentStartOffset = runningOffset + line.length + 1
      headings.push({ level: currentLevel, title: currentHeading, lineIndex: i })
    } else {
      currentContentLines.push(line)
    }

    runningOffset += line.length + 1
  }

  if (currentContentLines.length > 0) {
    const content = currentContentLines.join("\n")
    sections.push({
      id: `sec-${sections.length + 1}`,
      heading: currentHeading,
      level: currentLevel,
      content,
      charCount: content.length,
      wordCount: content.split(/\s+/).filter(Boolean).length,
      startOffset: currentStartOffset,
      endOffset: currentStartOffset + content.length,
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

  // References section
  const refSec = sections.find((s) =>
    /literatúra|literatura|referencie|reference|bibliography|zoznam použitej literatúry|zoznam bibliografických odkazov/i.test(
      s.heading
    )
  )
  const hasReferencesSection = Boolean(refSec)
  const detectedReferenceLines: string[] = []
  if (refSec) {
    refSec.content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 15 && (/^\[\d+\]|^\[[A-Za-z]+.*?\d{4}\]|^[A-Z][a-z]+,\s*[A-Z]|\b(19|20)\d{2}\b/i.test(l) || l.includes("doi.org") || l.includes("http")))
      .slice(0, 150)
      .forEach((l) => detectedReferenceLines.push(l))
  }

  // In-text citation regex matches
  const inTextMatches = markdown.match(/\[\d+(?:,\s*\d+)*\]|\([A-Z][a-z]+(?: et al\.)?,\s*(?:19|20)\d{2}\)|\[[A-Z][a-z]+(?:\+)?\s*(?:19|20)\d{2}\]/g) || []
  const detectedInTextCitationCount = inTextMatches.length

  const hasTableOfContents = sections.some((s) => /obsah|table of contents|contents/i.test(s.heading))
  const hasAppendices = sections.some((s) => /príloh|příloh|appendix|appendices/i.test(s.heading))
  const hasEthicsOrDeclarations = /čestné vyhlásenie|čestné prohlášení|etick|declaration|ethics|plagiarism declaration/i.test(fullText)
  const hasMethodologyMarkers = /metodol|metodika|postup riešenia|methodology|experimental design|výskumný dizajn/i.test(fullText)
  const hasResultsMarkers = /výsledk|vysledk|results|findings|meranie|evaluácia|experimentálne výsledky/i.test(fullText)
  const hasDiscussionMarkers = /diskusia|diskuse|discussion|porovnanie výsledkov/i.test(fullText)
  const hasConclusionMarkers = /záver|zaver|conclusion|concluding remarks/i.test(fullText)
  const hasLimitationStatements = /limity práce|limitations|obmedzenia výskumu|hrozby validity|threats to validity/i.test(fullText)
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

  // 3. Heading hierarchy skips (e.g. h1 -> h3)
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
  const emptySections = structure.sections.filter((s) => s.charCount < 100 && s.level <= 2)
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
        ? "Citačný audit a overenie formálnej bibliografie vyžadujú manuálnu kontrolu v PDF."
        : "Citation audit and formal reference verification require manual check in source PDF."
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

/**
 * Explainable Discipline & Thesis Type Classifier.
 * Inspects headings, terminology, metadata, and structural markers.
 */
export function classifyDisciplineAndThesisType(
  markdown: string,
  metadata?: Partial<ThesisMetadata>,
  lang: ReviewLanguage = "sk"
): DisciplineClassification {
  const fullLower = markdown.toLowerCase()
  const title = (metadata?.thesisTitle || "").toLowerCase()
  const dept = (metadata?.department || "").toLowerCase()

  const sourceAnchors: string[] = []

  // 1. Discipline classification
  let primaryDiscipline = "Informatika a výpočtová technika"
  const secondaryDisciplines: string[] = []

  const isPhysicsSTEM = /fyzik|physics|kvantov|optik|spektroskop|termodynam|mechanik|materiál|laser|častica|particle/i.test(fullLower + " " + title + " " + dept)
  const isMedBio = /medicín|pacient|klinick|terapi|diagnost|bunka|genet|biol|baktéri|vírus|liečba/i.test(fullLower + " " + title + " " + dept)
  const isEconMgmt = /ekonóm|manažment|financ|marketing|bankov|trh|invest|obchod|náklad|zisk/i.test(fullLower + " " + title + " " + dept)
  const isHumanities = /filozof|históri|jazykoved|pedagog|sociol|právo|právn|literatúr/i.test(fullLower + " " + title + " " + dept)

  if (isPhysicsSTEM) {
    primaryDiscipline = "Fyzika a materiálové vedy (STEM)"
    sourceAnchors.push("Detegované kľúčové pojmy fyziky, meraní a experimentálnej aparatúry")
  } else if (isMedBio) {
    primaryDiscipline = "Medicína a biologické vedy"
    sourceAnchors.push("Detegovaná medicínska / biologická terminológia")
  } else if (isEconMgmt) {
    primaryDiscipline = "Ekonómia a manažment"
    sourceAnchors.push("Detegované ekonomické a finančné koncepty")
  } else if (isHumanities) {
    primaryDiscipline = "Spoločenské a humanitné vedy"
    sourceAnchors.push("Detegovaná spoločenskovedná a filozofická terminológia")
  } else {
    primaryDiscipline = "Informatika a umelá inteligencia (STEM)"
    sourceAnchors.push("Detegované softvérové komponenty, algoritmy a architektúra")
  }

  // 2. Detailed thesis type classification
  let thesisType: DetailedThesisType = "software_system"
  let confidence = 0.85

  const hasSystemImpl = /implement|architektúra systému|použité technológie|databázov|frontend|backend|gui|používateľské rozhranie|api|testovanie systému/i.test(fullLower)
  const hasQuantEmpirical = /štatistick|p-value|hypotéz|regresia|vzorka|dotazník|meranie veličín|experimentálne meranie|anova|t-test/i.test(fullLower)
  const hasQualitative = /kvalitatívny|pološtruktúrovaný rozhovor|hĺbkový rozhovor|focus group|tematická analýza|grounded theory|kódovanie dát/i.test(fullLower)
  const hasSystematicLit = /systematická rešerš|systematic review|meta-analýza|databázy wos|scopus|vyhľadávacia stratégia|kritériá zaradenia/i.test(fullLower)
  const hasTheoretical = /teoretický model|dôkaz vety|matematická formulácia|axióm|lema|analytické riešenie/i.test(fullLower)
  const hasCaseStudy = /prípadová štúdia|case study|analýza podniku|skúmaná organizácia/i.test(fullLower)

  if (isPhysicsSTEM && /experiment|laboratór|meranie|kryostat|spektro|aparát|qubit|vzork/i.test(fullLower)) {
    thesisType = "experimental_physics"
    confidence = 0.92
    sourceAnchors.push("Detegované experimentálne merania fyzikálnych veličín a laboratórna aparatúra")
  } else if (hasSystematicLit) {
    thesisType = "literature_review"
    confidence = 0.9
    sourceAnchors.push("Detegovaný protokol systematickej rešerše a vyhľadávacie kritériá")
  } else if (hasQualitative) {
    thesisType = "qualitative"
    confidence = 0.85
    sourceAnchors.push("Detegované metódy kvalitatívneho výskumu (rozhovory, tematické kódovanie)")
  } else if (hasQuantEmpirical) {
    thesisType = "empirical_quantitative"
    confidence = 0.88
    sourceAnchors.push("Detegované štatistické testovanie hypotéz, kvantitatívna vzorka a dátové metriky")
  } else if (hasTheoretical) {
    thesisType = "theoretical"
    confidence = 0.85
    sourceAnchors.push("Detegované matematické modely, vety a analytické odvodenia")
  } else if (hasCaseStudy) {
    thesisType = "case_study"
    confidence = 0.85
    sourceAnchors.push("Detegovaná metodológia prípadovej štúdie v konkrétnom kontexte")
  } else if (hasSystemImpl) {
    thesisType = "software_system"
    confidence = 0.9
    sourceAnchors.push("Detegovaný návrh softvérovej architektúry, databázy a implementácia")
  } else {
    thesisType = "engineering_design"
    confidence = 0.7
    sourceAnchors.push("Všeobecný inžiniersky a aplikačný charakter práce")
  }

  // Standard ThesisType mapping (bachelor / master / phd)
  const standardThesisType: ThesisType = metadata?.thesisType || "master"

  const rationale = lang === "sk"
    ? `Práca bola klasifikovaná ako ${primaryDiscipline} s typom metodológie [${thesisType}] na základe výskytu špecifických terminologických vzorov v kapitolách a štruktúre.`
    : `Work classified as ${primaryDiscipline} with methodology type [${thesisType}] based on identified structural and terminology anchors.`

  return {
    primaryDiscipline,
    secondaryDisciplines,
    thesisType,
    standardThesisType,
    confidence,
    rationale,
    sourceAnchors,
  }
}
