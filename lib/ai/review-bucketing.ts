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
  /** Folded (diacritic-stripped, lowercase) terms any of which marks coverage. */
  terms: Record<"sk" | "cz", string[]>
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
    label: { sk: "aktuálnosť zvolenej témy", cs: "aktuálnost zvoleného tématu", en: "timeliness of the topic" },
    terms: { sk: ["aktualn", "vyzn"], cz: ["aktualn", "vyzn"] },
  },
  {
    id: "methods",
    label: { sk: "zvolené metódy spracovania", cs: "zvolené metody zpracování", en: "methods used" },
    terms: { sk: ["metod", "postup riezenia"], cz: ["metod", "zpracovani"] },
  },
  {
    id: "results_novelty",
    label: {
      sk: "vyhodnotenie výsledkov a nových poznatkov",
      cs: "vyhodnocení výsledků a nových poznatků",
      en: "results and new knowledge",
    },
    terms: { sk: ["vysledk", "nove poznatk"], cz: ["vysledk", "nove poznatky"] },
  },
  {
    id: "contribution",
    label: {
      sk: "prínos pre rozvoj vedy, techniky alebo umenia",
      cs: "přínos pro rozvoj vědy, techniky nebo umění",
      en: "contribution to the development of science",
    },
    terms: { sk: ["prinos pre", "prinos v odbore", "prinos pre rozvoj"], cz: ["prinos pro", "prinos v oboru"] },
  },
  {
    id: "objective_fulfilment",
    label: {
      sk: "splnenie sledovaných cieľov a požiadaviek",
      cs: "splnění sledovaných cílů a požadavků",
      en: "fulfilment of the stated objectives",
    },
    terms: { sk: ["spln", "ciel bol", "ciele bol", "splnene"], cz: ["spln", "cil byl", "cile byl"] },
  },
]

/**
 * The conclusive statement required for the review to be considered complete.
 * Patterns run against a diacritic-stripped, lowercased copy of the text (see
 * `stripDiacritics`) so both "odporúčam" and "oporucam" spellings match, and
 * they are deliberately tolerant of word order because reviewers phrase the
 * sentence differently ("Prácu odporúčam na obhajobu" / "Odporúčam prácu
 * na obhajobu").
 */
const CONCLUSIVE_PATTERNS: Record<StatutoryJurisdiction, RegExp[]> = {
  none: [],
  sk: [
    /odporucam[^\n]{0,60}obhajobu/,
    /praca sp(?:l|n)a[^\n]{0,40}podmienky/,
    /navrhujem udelenie[^\n]{0,40}titulu/,
    /zavazujem[^\n]{0,60}obhajobu/,
  ],
  cz: [
    /doporucuji[^\n]{0,60}obhajob/,
    /prace splnuje[^\n]{0,40}po(ad|z)avky/,
    /navrhuji udeleni[^\n]{0,40}titulu/,
  ],
}

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

/** True when `text` contains a conclusive statement (recommendation + title). */
export function hasConclusiveStatement(text: string, jurisdiction: StatutoryJurisdiction): boolean {
  return CONCLUSIVE_PATTERNS[jurisdiction].some((re) => re.test(stripDiacritics(text || "")))
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
  const inst = (input.institution || "").toLowerCase()
  if (
    input.language === "cs" ||
    inst.includes("czech") ||
    inst.includes("česk") ||
    inst.includes("karlova") ||
    inst.includes("morav") ||
    inst.includes("siles")
  ) {
    return "cz"
  }
  if (
    input.language === "sk" ||
    inst.includes("slovak") ||
    inst.includes("slovensk") ||
    inst.includes("komenskeho") ||
    inst.includes("pavol josef") ||
    inst.includes("stuba") ||
    inst.includes("technicka univerzita")
  ) {
    return "sk"
  }
  // Neither legal system recognised: no statutory framing at all.
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
  const haystack = stripDiacritics(`${text}\n${(params.citationIssues || []).join("\n")}`)

  const covered: string[] = []
  const missing: string[] = []
  for (const item of STATUTORY_REVIEW_ITEMS) {
    const terms = jurisdiction === "cz" ? item.terms.cz : item.terms.sk
    const hit = terms.some((term) => haystack.includes(stripDiacritics(term)))
    if (hit) covered.push(item.id)
    else missing.push(item.label[jurisdiction === "cz" ? "cs" : "sk"])
  }

  const conclusiveStatementMissing = !CONCLUSIVE_PATTERNS[jurisdiction].some((re) => re.test(foldedText))
  const excerptBoundClaims = EXCERPT_BOUND_PATTERN.test(foldedText)
  const citationNotesContradiction = hasCitationNotesContradiction(params.citationIssues || [])

  const problems: string[] = []
  if (applies) {
    if (missing.length > 0) {
      problems.push(
        jurisdiction === "sk"
          ? `Posudok neobsahuje zákonom vyžadované vyjadrenia k: ${missing.join(", ")} (§ 67 ods. 6 zákona č. 131/2002 Z. z.).`
          : `Posudek neobsahuje zákonem vyžadovaná vyjádření k: ${missing.join(", ")} (§ 54a odst. 3 zákona č. 111/1998 Sb.).`
      )
    }
    if (conclusiveStatementMissing) {
      problems.push(
        jurisdiction === "sk"
          ? "Chýba záverečné stanovisko (odporúčanie na obhajobu a návrh udelenia titulu PhD s klasifikačným stupňom prospel/neprospel). Bez neho nemožno posudok považovať za úplný."
          : "Chybí závěrečné stanovisko (doporučení k obhajobě a návrh na udělení titulu). Bez něj nelze posudek považovat za úplný."
      )
    }
  }
  if (excerptBoundClaims) {
    problems.push(
      jurisdiction === "sk"
        ? "Text priznáva hodnotenie z čiastočných výňatkov; posudok k dizertačnej práci musí vychádzať z celého rukopisu."
        : "Text přiznává hodnocení z částečných výňatků; posudek musí vycházet z celého textu práce."
    )
  }
  if (citationNotesContradiction) {
    problems.push(
      jurisdiction === "sk"
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
    return "Predložená dizertačná práca spĺňa podmienky kladené na dizertačnú prácu podľa § 67 zákona č. 131/2002 Z. z. o vysokých školách a o zmene a doplnení niektorých zákonov v znení neskorších predpisov. Na základe predloženej dizertačnej práce navrhujem udelenie akademického titulu „philosophiae doctor“ (v skratke „PhD.“)."
  }
  if (jurisdiction === "cz") {
    return "Předložená disertační práce splňuje požadavky kladené na disertační práce podle § 54a odst. 3 zákona č. 111/1998 Sb., o vysokých školách, ve znění pozdějších předpisů. Na základě předložené disertační práce navrhuji udělení akademického titulu „doktor“ (ve zkratce „Ph.D.“)."
  }
  return undefined
}
