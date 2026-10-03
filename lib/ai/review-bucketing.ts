/**
 * Shared finding bucketing + doctoral (PhD) statutory review requirements.
 *
 * Both the export generators (LaTeX / DOCX / Markdown formatters) and the
 * export route must agree on how findings are split into "strengths",
 * "major concerns" and "minor concerns". Historically each renderer kept its
 * own copy of the severity filter, which let a strength be rendered inside the
 * "Drobné pripomienky / Minor Concerns" section whenever the model graded it
 * with `severity: "suggestion"` (the schema's correct value for a merit) —
 * producing reviews whose concerns section contained only praise and whose
 * "Major Concerns" section silently disappeared together with the missing
 * `3.` heading.
 *
 * The same module owns the statutory content requirements of a doctoral
 * opponent's review so the check, the prompt and the exported text cannot
 * drift apart.
 */

import type { ReviewFinding } from "./review-types"

export type FindingBucket = "strength" | "major" | "minor"

export interface BucketedFindings {
  strengths: ReviewFinding[]
  major: ReviewFinding[]
  minor: ReviewFinding[]
}

/** A merit is never a "concern", regardless of how mild its severity is. */
export function isStrengthFinding(finding: ReviewFinding): boolean {
  return finding.findingType === "strength"
}

/**
 * Split findings into the three export buckets. Only findings eligible for
 * export should be passed in (see `getEligibleFindings`).
 */
export function bucketFindings(findings: ReviewFinding[]): BucketedFindings {
  const strengths: ReviewFinding[] = []
  const major: ReviewFinding[] = []
  const minor: ReviewFinding[] = []

  for (const finding of findings) {
    // Order matters: a merit is a merit whatever severity the model attached,
    // and it must never be printed as a concern.
    if (isStrengthFinding(finding)) {
      strengths.push(finding)
    } else if (finding.severity === "critical" || finding.severity === "major") {
      major.push(finding)
    } else {
      // minor / suggestion / info — the "read and optionally fix" bucket.
      minor.push(finding)
    }
  }

  return { strengths, major, minor }
}

// ---------------------------------------------------------------------------
// Doctoral-thesis (oponent) statutory requirements — SK / CZ
// ---------------------------------------------------------------------------

export type StatutoryJurisdiction = "sk" | "cz" | "none"

export interface StatutoryItem {
  id: string
  label: Record<"sk" | "cs" | "en", string>
  /** Folded term groups: every group must have at least one hit. */
  terms: Record<"sk" | "cz" | "en", string[][]>
}

/**
 * § 67 of Act No. 131/2002 Coll. (Slovakia): the oponent's review must contain
 * an objective and critical analysis of merits *and* shortcomings and must
 * address items a)–e); § 54a of Act No. 111/1998 Sb. (Czechia) is the parallel
 * requirement. The conclusive statement is mandatory — without it the review
 * is not considered complete, so it is checked separately.
 */
export const STATUTORY_REVIEW_ITEMS: StatutoryItem[] = [
  {
    id: "topic_currency",
    label: { sk: "aktuálnosť zvolenej témy", cs: "aktuálnost zvoleného tématu", en: "timeliness of the chosen topic" },
    terms: {
      sk: [["tema", "tematik"], ["aktualn", "sucasn", "casov", "relevantn"]],
      cz: [["tema", "tematik"], ["aktualn", "sucasn", "casov", "relevantn"]],
      en: [["topic"], ["timely", "current", "relevant", "significant", "contemporary"]],
    },
  },
  {
    id: "methods",
    label: { sk: "zvolené metódy spracovania", cs: "zvolené metody zpracování", en: "methods and procedure" },
    terms: {
      sk: [["metod"], ["postup", "spracovan", "zvolen", "opis"]],
      cz: [["metod"], ["postup", "zpracovan", "zvolen", "popis"]],
      en: [["method"], ["procedure", "approach", "process", "design"]],
    },
  },
  {
    id: "results_novelty",
    label: {
      sk: "vyhodnotenie výsledkov a nových poznatkov",
      cs: "vyhodnocení výsledků a nových poznatků",
      en: "assessment of results and new knowledge",
    },
    terms: {
      sk: [["vysledk", "zisten"], ["nove poznatk", "novy poznatk", "nove vedomost"]],
      cz: [["vysledk", "zjisten"], ["nove poznatk", "novy poznatk", "nove vedomost"]],
      en: [["result", "finding", "outcome"], ["new knowledge", "novel", "original finding", "new insight"]],
    },
  },
  {
    id: "contribution",
    label: {
      sk: "prínos pre rozvoj vedy, techniky alebo umenia",
      cs: "přínos pro rozvoj vědy, techniky nebo umění",
      en: "contribution to the development of science, technology, or the arts",
    },
    terms: {
      sk: [["prinos"], ["rozvoj", "veda", "techn", "umen", "odbor"]],
      cz: [["prinos"], ["rozvoj", "veda", "techn", "umen", "obor"]],
      en: [["contribut"], ["science", "technology", "art", "field", "discipline", "development"]],
    },
  },
  {
    id: "objective_fulfilment",
    label: {
      sk: "splnenie sledovaných cieľov a požiadaviek",
      cs: "splnění sledovaných cílů a požadavků",
      en: "fulfilment of stated objectives and requirements",
    },
    terms: {
      sk: [["ciel", "ciele", "poziadavk"], ["spln", "dosiahn", "napln"]],
      cz: [["cil", "cile", "pozadavk"], ["spln", "dosaz", "napln"]],
      en: [["objective", "aim", "goal", "requirement"], ["achiev", "fulfil", "fulfill", "meet", "attain"]],
    },
  },
]

/**
 * Required conclusion components: demonstrated research ability, an explicit
 * defence recommendation, and a proposed doctoral-degree award. Patterns run
 * against diacritic-folded text to support SK/CZ and English reports.
 */
const ABILITY_PATTERNS = [
  /(?:schopnost|sposobilost|predpoklad)[^.!?\n]{0,120}(?:vedeck|vyzkum|samostatn|research|scientific)/,
  /(?:vedeck|vyzkum|samostatn|research|scientific)[^.!?\n]{0,120}(?:schopnost|sposobilost|ability|capacity|competence)/,
  /(?:demonstrat|prokaz|preukaz)[^.!?\n]{0,100}(?:ability|schopnost|spusobilost|vedeck|research)/,
]

const DEFENCE_RECOMMENDATION_PATTERNS = [
  /(?:odporuc|doporuc|navrhuj|recommend|propos)[^.!?\n]{0,140}(?:obhajob|defen[cs]e|defend)/,
  /(?:obhajob|defen[cs]e|defend)[^.!?\n]{0,140}(?:odporuc|doporuc|navrhuj|recommend|propos)/,
]

const DEGREE_AWARD_PATTERNS = [
  /(?:navrhuj|doporuc|recommend|propos)[^.!?\n]{0,160}(?:udelen|udelit|award|grant|confer|akademick.{0,20}titul|doctoral degree|ph\.?d)/,
  /(?:award|grant|confer|udelen|udelit)[^.!?\n]{0,100}(?:ph\.?d|doktor|academic title|akademick.{0,20}titul|degree)/,
  /(?:ph\.?d|doktor|degree|titul)[^.!?\n]{0,100}(?:udelen|udelit|award|grant|confer)/,
]

/** Diacritic + case folding so wording is found in any spelling variant. */
export function stripDiacritics(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase()
}

/** Sentence-level claim that the review is based on fragments only. */
const EXCERPT_BOUND_PATTERN = /z dostupn.{0,3}ch\s+(uryvk|vysk|extract)|from the available excerpts|excerptov/

/** True only when ability, defence recommendation, and degree award are all explicit. */
export function hasConclusiveStatement(text: string, jurisdiction: StatutoryJurisdiction): boolean {
  if (jurisdiction === "none") return false
  const folded = stripDiacritics(text || "")
  const hasAbility = ABILITY_PATTERNS.some((re) => re.test(folded))
  const hasDefenceRecommendation = DEFENCE_RECOMMENDATION_PATTERNS.some((re) => re.test(folded))
  const hasDegreeAward = DEGREE_AWARD_PATTERNS.some((re) => re.test(folded))
  return hasAbility && hasDefenceRecommendation && hasDegreeAward
}

export interface StatutoryCheckInput {
  thesisType: string
  reviewerRole?: string | null
  language?: string | null
  institution?: string | null
  reviewKind?: string | null
}

export interface StatutoryCheckResult {
  /** True when the statutory completeness check applies to this review at all. */
  applies: boolean
  jurisdiction: StatutoryJurisdiction
  covered: string[]
  /** Labels (in the report language) of the statutory items not addressed. */
  missing: string[]
  /** Missing or placeholder-only conclusive statement. */
  conclusiveStatementMissing: boolean
  /** Review admits judging from fragments / excerpts instead of the whole thesis. */
  excerptBoundClaims: boolean
  /** Citation notes that assert "0 unverified" and list an unverified reference. */
  citationNotesContradiction: boolean
  ok: boolean
  /** Human-readable, ready for a UI banner / export error message. */
  problems: string[]
}

function isDoctoralOpponentReview(input: StatutoryCheckInput): boolean {
  if (input.reviewKind && input.reviewKind !== "thesis") return false
  if (input.thesisType !== "phd") return false
  return input.reviewerRole === "opponent"
}

export function detectStatutoryJurisdiction(
  input: Pick<StatutoryCheckInput, "language" | "institution">
): StatutoryJurisdiction {
  const inst = stripDiacritics(input.institution || "")
  const czechInstitution = ["czech", "cesk", "karlova", "masaryk", "mendel", "palack", "siles", "brno", "praha", "ostrava", "olomouc", "cvut", "vut "]
    .some((marker) => inst.includes(marker))
  const slovakInstitution = ["slovak", "slovensk", "komenskeho", "pavol jozef", "safarik", "stuba", "tuke", "zilina", "kosice", "technicka univerzita"]
    .some((marker) => inst.includes(marker))

  // An explicit institution is stronger jurisdictional evidence than report language.
  if (czechInstitution) return "cz"
  if (slovakInstitution) return "sk"
  if (input.language === "cs") return "cz"
  if (input.language === "sk") return "sk"
  return "none"
}

/** True when the review is framed by Slovak or Czech higher-education law. */
function hasStatutoryFramework(input: StatutoryCheckInput): boolean {
  const jurisdiction = detectStatutoryJurisdiction(input)
  return jurisdiction === "sk" || jurisdiction === "cz"
}

function hasCitationNotesContradiction(citationIssues: string[]): boolean {
  const joined = stripDiacritics(citationIssues.join(" "))
  const zero = /(?:found|nalezen|zjisten|zisten)[^\d]{0,14}\b0\b|\b0 unverified\b/.test(joined)
  const unverified = /unverified|neverifikovan|nie je overen|nenalezen|not found/.test(joined)
  return zero && unverified
}

/**
 * Checks a review's exported text for the statutory content requirements of a
 * doctoral opponent's review. Keyword matching is folded (see
 * `stripDiacritics`), so the check is spelling-robust rather than exact.
 */
export function checkStatutoryPosudok(params: {
  input: StatutoryCheckInput
  text: string
  citationIssues?: string[]
}): StatutoryCheckResult {
  const jurisdiction = detectStatutoryJurisdiction(params.input)
  const applies = isDoctoralOpponentReview(params.input) && hasStatutoryFramework(params.input)
  const text = params.text || ""
  const foldedText = stripDiacritics(text)
  const reviewClauses = foldedText.split(/[.!?;\n]+/).map((clause) => clause.trim()).filter(Boolean)
  const language = params.input.language === "en"
    ? "en"
    : jurisdiction === "cz"
      ? "cs"
      : "sk"

  const covered: string[] = []
  const missing: string[] = []
  for (const item of applies ? STATUTORY_REVIEW_ITEMS : []) {
    const termLanguage = language === "en" ? "en" : jurisdiction === "cz" ? "cz" : "sk"
    const groups = item.terms[termLanguage]
    const hit = reviewClauses.some((clause) =>
      groups.every((group) => group.some((term) => clause.includes(stripDiacritics(term))))
    )
    if (hit) covered.push(item.id)
    else missing.push(item.label[language])
  }

  const conclusiveStatementMissing = !hasConclusiveStatement(text, jurisdiction)
  const excerptBoundClaims = EXCERPT_BOUND_PATTERN.test(foldedText)
  const citationNotesContradiction = hasCitationNotesContradiction(params.citationIssues || [])

  const problems: string[] = []
  if (applies) {
    if (missing.length > 0) {
      problems.push(
        language === "en"
          ? `The doctoral opponent review does not address the required areas: ${missing.join(", ")} (${jurisdiction === "sk" ? "§ 67 of Act No. 131/2002 Coll." : "§ 54a(3) of Act No. 111/1998 Sb."}).`
          : jurisdiction === "sk"
            ? `Posudok neobsahuje zákonom vyžadované vyjadrenia k: ${missing.join(", ")} (§ 67 ods. 6 zákona č. 131/2002 Z. z.).`
            : `Posudek neobsahuje zákonem vyžadovaná vyjádření k: ${missing.join(", ")} (§ 54a odst. 3 zákona č. 111/1998 Sb.).`
      )
    }
    if (conclusiveStatementMissing) {
      problems.push(
        language === "en"
          ? "The conclusion must explicitly assess the candidate's scientific/research ability, recommend for or against the defence, and state whether the PhD degree should be awarded."
          : jurisdiction === "sk"
            ? "Chýba záverečné stanovisko, ktoré výslovne posúdi vedeckú spôsobilosť, odporučí alebo neodporučí obhajobu a uvedie návrh na udelenie titulu PhD."
            : "Chybí závěrečné stanovisko, které výslovně posoudí vědeckou způsobilost, doporučí či nedoporučí obhajobu a uvede návrh na udělení titulu Ph.D."
      )
    }
  }
  if (excerptBoundClaims && applies) {
    problems.push(
      language === "en"
        ? "The review says its assessment is based only on excerpts; confirm that the complete thesis was reviewed."
        : jurisdiction === "sk"
          ? "Text priznáva hodnotenie z čiastočných výňatkov; posudok k dizertačnej práci musí vychádzať z celého rukopisu."
          : "Text přiznává hodnocení z částečných výňatků; posudek musí vycházet z celého textu práce."
    )
  }
  if (citationNotesContradiction && applies) {
    problems.push(
      language === "en"
        ? "Citation notes contradict themselves: they report zero unverified references while listing an unverified citation."
        : jurisdiction === "sk"
          ? "Poznámky k citáciám si protirečia (tvrdia 0 neverifikovaných a zároveň uvádzajú neverifikovanú citáciu)."
          : "Poznámky k citacím si odporují (tvrdí 0 neověřených a zároveň uvádí neověřenou citaci)."
    )
  }

  return {
    applies,
    jurisdiction,
    covered,
    missing,
    conclusiveStatementMissing: applies ? conclusiveStatementMissing : false,
    excerptBoundClaims,
    citationNotesContradiction,
    ok: problems.length === 0,
    problems,
  }
}

/**
 * The statutory clause for a doctoral thesis, or `undefined` when the
 * institution follows neither the Slovak nor the Czech legal system (inventing
 * a legal citation is worse than omitting one).
 *
 * Note the section for Slovakia: § 67 governs the third study cycle (state
 * exams and the doctoral defence); § 54 governs habilitation and professorship
 * proceedings and must never be cited for a dizertačná práca. In Czechia the
 * doctoral-thesis requirements are in § 54a of Act No. 111/1998 Sb.
 */
export function buildDoctoralStatutoryClause(params: {
  language?: string | null
  institution?: string | null
}): string | undefined {
  const jurisdiction = detectStatutoryJurisdiction(params)
  if (jurisdiction === "sk") {
    return params.language === "en"
      ? "Legal framework: § 67 of Act No. 131/2002 Coll. on Higher Education (statutory requirements for doctoral opponent reviews)."
      : "Právny rámec: § 67 zákona č. 131/2002 Z. z. o vysokých školách (zákonné náležitosti oponentského posudku dizertačnej práce)."
  }
  if (jurisdiction === "cz") {
    return params.language === "en"
      ? "Legal framework: § 54a(3) of Act No. 111/1998 Sb. on Higher Education (statutory requirements for doctoral opponent reviews)."
      : "Právní rámec: § 54a odst. 3 zákona č. 111/1998 Sb., o vysokých školách (zákonné náležitosti posudku disertační práce)."
  }
  return undefined
}
