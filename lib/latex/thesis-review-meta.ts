/**
 * Derivation of the printed posudok from what a workspace actually stores.
 *
 * A `ThesisReview` record (AI pipeline) carries every field the form needs, and
 * the export route feeds `generateThesisReviewLatex` directly. A workspace that
 * was authored by hand, imported, or shipped as a curated showcase only has
 * *cards*: an identification card with `**Autor práce:** …` bullets, one card
 * per criterion with a rating line, an "Otázky k obhajobe" card, and a
 * conclusion card built from `stats` tiles.
 *
 * Historically the generator mapped `output.authors` → student, `output.title`
 * → thesis title and `output.venue` → reviewer, which printed the reviewer's
 * name as the student and the output's name as the thesis title (audit finding
 * P-01). This module derives the same fields *correctly*, in this order:
 *
 *   1. `output.reviewMeta` — explicit, always wins;
 *   2. the cards — parsed by label in all six report languages;
 *   3. the project/output free-text fields — only as a last resort.
 *
 * Everything is pure and synchronous so it can run in a React canvas, in the
 * LaTeX generator, and in tests without a database.
 */

import type {
  Card,
  OutputConfig,
  Project,
  ThesisReviewMetaCriterion,
  ThesisReviewOutputMeta,
} from "@/lib/poster-types"
import { resolveOutputMetadata } from "@/lib/poster-types"
import { SK_ACADEMIC_RUBRIC_V1 } from "@/lib/ai/rubric-engine"
import { THESIS_CRITERIA } from "@/lib/ai/thesis-rubric"

export type ReportLanguageCode = "sk" | "cs" | "en" | "de" | "pl" | "hu"

export type ThesisReviewerRole = "supervisor" | "opponent" | "reviewer" | "self"

/** One assessed criterion, resolved from a card plus the active rubric. */
export type DerivedCriterion = {
  /** Rubric criterion id when the card could be matched, else the humanized card title. */
  criterionId: string
  cardId: string
  /** Localised criterion name (rubric label when matched, card title otherwise). */
  name: string
  /** Commentary prose, with the identification/rating meta-lines removed. */
  text: string
  /** Rating letter (`A`–`F`) or `""` when the reviewer did not rate the criterion. */
  rating: string
  /** Rubric weight in percent, or `null` for unmatched/custom criteria. */
  weight: number | null
  /** Points the rating contributes (midpoint of its ECTS band), or `null`. */
  points: number | null
  suggestions: string[]
  /** Figures attached to the criterion card, printed with it. */
  figures: Array<{ url: string; caption: string }>
  matched: boolean
}

export type ThesisReviewDerived = {
  language: ReportLanguageCode
  reviewKind: "thesis" | "paper"
  studentName: string
  thesisTitle: string
  thesisType: "bachelor" | "master" | "phd"
  studyProgramme: string
  reviewerName: string
  reviewerRole: ThesisReviewerRole
  institution: string
  faculty: string
  department: string
  academicYear: string
  grade: string
  scorePercent: number | null
  recommendation: string
  place: string
  date: string
  includeConfidential: boolean
  confidentialComments: string
  summary: string
  strengths: string[]
  defenseQuestions: string[]
  citationIssues: string[]
  criteria: DerivedCriterion[]
  /** Weighted score over rated criteria, in percent. `null` when nothing is rated. */
  weightedScore: number | null
  /** Weighted score expressed as the letter it maps to (`calculateGradeRange` bands). */
  weightedGrade: string | null
  /** Provenance per field — tests and the UI use this to explain a value. */
  provenance: Record<string, "explicit" | "card" | "project" | "none">
}

// ---------------------------------------------------------------------------
// Card text parsing
// ---------------------------------------------------------------------------

const BULLET_RE = /^\s*(?:[-*+]|\d+[.)])\s+/
const BOLD_LABEL_RE = /^\s*(?:[-*+]\s*)?\*\*([^*]+?)\s*:?\*\*\s*(.*)$/
const PLAIN_LABEL_RE = /^\s*(?:[-*+]\s*)?([A-ZÀ-Ž][^:]{1,40}?)\s*:\s+(.*)$/

/** Strip markdown emphasis/pipes used by the card templates. */
export function stripMarkup(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/^\s*[-*+]\s+/, "")
    .replace(/\s*\|\s*/g, " — ")
    .trim()
}

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_\-–—]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

export type CardField = { label: string; value: string; foldedLabel: string }

/**
 * Label → value pairs found in a card, covering both shapes the templates use:
 * `- **Autor práce:** Bc. Martin Kováč` (bullets) and
 * `- **Hodnotenie A** Výborne | 96.4%` (stats tiles, where the value sits after
 * the bold label rather than inside it).
 */
export function cardFields(content: string): CardField[] {
  const fields: CardField[] = []
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim()
    if (!line) continue

    const bold = BOLD_LABEL_RE.exec(line)
    if (bold) {
      const label = stripMarkup(bold[1])
      const rest = bold[2] ?? ""
      // Stats tiles: `**Hodnotenie A** Výborne | 96.4%` — the letter belongs to
      // the label, the prose belongs to the value.
      const trailingLetter = /\b([A-F])\b\s*$/.exec(label)
      const value = rest.trim() || (trailingLetter ? trailingLetter[1] : "")
      fields.push({ label, value: value.trim(), foldedLabel: fold(label) })
      continue
    }

    const plain = PLAIN_LABEL_RE.exec(line)
    if (plain && !BULLET_RE.test(line)) {
      const label = plain[1]
      fields.push({ label, value: plain[2].trim(), foldedLabel: fold(label) })
      continue
    }

    if (BULLET_RE.test(line)) {
      fields.push({ label: "", value: stripMarkup(line), foldedLabel: "" })
    }
  }
  return fields
}

/** First field whose folded label matches any of the given needles. */
export function fieldValue(content: string, needles: string[]): string {
  const folded = needles.map(fold)
  for (const field of cardFields(content)) {
    if (!field.label) continue
    if (folded.some((needle) => field.foldedLabel === needle || field.foldedLabel.startsWith(needle))) {
      return stripMarkup(field.value)
    }
  }
  return ""
}

/** Bullet items of a card, in order, with markup removed. */
export function bulletItems(content: string): string[] {
  const items: string[] = []
  for (const line of content.split("\n")) {
    if (!BULLET_RE.test(line)) continue
    const value = stripMarkup(line)
    if (value) items.push(value)
  }
  return items
}

/** Numbered items (`1. …`) of a card, used for defence questions. */
export function numberedItems(content: string): string[] {
  const items: string[] = []
  for (const line of content.split("\n")) {
    const m = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    if (m && m[1].trim()) items.push(stripMarkup(m[1]))
  }
  return items
}

// ---------------------------------------------------------------------------
// Ratings
// ---------------------------------------------------------------------------

const RATING_NEEDLES = [
  "hodnotenie",
  "klasifikacia",
  "znamka",
  "hodnoceni",
  "klasifikace",
  "znamka",
  "grade",
  "rating",
  "mark",
  "bewertung",
  "note",
  "ocena",
  "ertekeles",
  "erdemjegy",
]

const GRADE_BANDS: Array<{ grade: string; points: number }> = [
  { grade: "A", points: 95 },
  { grade: "B", points: 85 },
  { grade: "C", points: 75 },
  { grade: "D", points: 65 },
  { grade: "E", points: 55 },
  { grade: "F", points: 45 },
]

/** Points a rating letter contributes (midpoint of its ECTS band), else `null`. */
export function pointsForRating(letter: string): number | null {
  const clean = (letter || "").trim().toUpperCase()
  return GRADE_BANDS.find((b) => b.grade === clean)?.points ?? null
}

const LETTER_RE = /\b([A-F])\b/

/**
 * Rating letter for a criterion card.
 *
 * Accepts every shape the templates and the AI pipeline emit:
 * `**Hodnotenie:** A`, `**Hodnotenie A** Výborne`, `Klasifikácia: B (veľmi
 * dobre)`, `Note: 1,7` (German), a bare `[A]`, or a numeric score that is
 * converted through the ECTS bands.
 */
export function ratingFromCard(content: string): string {
  const folded = fold(content)

  // 1. A label line that carries a letter.
  for (const field of cardFields(content)) {
    if (!field.label) continue
    if (!RATING_NEEDLES.some((needle) => field.foldedLabel.includes(needle))) continue
    const inLabel = LETTER_RE.exec(field.label.toUpperCase())
    if (inLabel) return inLabel[1]
    const inValue = LETTER_RE.exec(field.value.toUpperCase())
    if (inValue) return inValue[1]
  }

  // 2. German/Polish numeric scales: 1,0–1,5 → A … 4,0 → F.
  const decimal = /(?:note|ocena|grade)\D{0,12}([1-5])[,.]([0-9])/.exec(folded)
  if (decimal) {
    const value = Number(`${decimal[1]}.${decimal[2]}`)
    if (value <= 1.5) return "A"
    if (value <= 2.5) return "B"
    if (value <= 3.5) return "C"
    if (value <= 4.0) return "D"
    return "E"
  }

  // 3. A bare bracketed letter, e.g. a stats tile reading `[B]`.
  const bracketed = /\[([A-F])\]/.exec(content.toUpperCase())
  if (bracketed) return bracketed[1]

  // 4. A numeric score, mapped the same way the rubric engine maps it.
  const score = /(\d{1,3}(?:[.,]\d)?)\s*%/.exec(content)
  if (score) {
    const value = Number(score[1].replace(",", "."))
    if (value >= 90) return "A"
    if (value >= 80) return "B"
    if (value >= 70) return "C"
    if (value >= 60) return "D"
    if (value >= 50) return "E"
    return "F"
  }

  return ""
}

// ---------------------------------------------------------------------------
// Criterion resolution
// ---------------------------------------------------------------------------

type RubricCriterion = {
  id: string
  weight: number
  category: string
  label: string
}

function rubricLabel(labels: Record<string, string>, lang: ReportLanguageCode): string {
  const rubricLang = lang === "sk" || lang === "cs" || lang === "en" ? lang : "en"
  return labels[rubricLang] ?? labels.en ?? ""
}

/** Flatten both rubrics into one searchable list, v1 first (production rubric). */
function rubricIndex(lang: ReportLanguageCode): RubricCriterion[] {
  const entries: RubricCriterion[] = []
  for (const c of SK_ACADEMIC_RUBRIC_V1.criteria) {
    entries.push({ id: c.id, weight: c.weight, category: c.category, label: rubricLabel(c.labels, lang) })
  }
  for (const c of THESIS_CRITERIA) {
    if (entries.some((e) => e.id === c.id)) continue
    entries.push({
      id: c.id,
      weight: c.weight,
      category: "legacy",
      label: rubricLabel(c.labels as unknown as Record<string, string>, lang),
    })
  }
  return entries
}

export type ResolvedCriterion = { id: string; name: string; weight: number | null; matched: boolean }

/**
 * Resolve a card to a rubric criterion by explicit id, criterion title, card
 * title, or card id. Never fails: an unmatched card keeps its own title so the
 * reviewer's paragraph always reaches the document.
 */
export function resolveCriterion(
  card: Pick<Card, "id" | "title" | "criterionId">,
  lang: ReportLanguageCode,
): ResolvedCriterion {
  const index = rubricIndex(lang)
  const rawId = (card.criterionId || "").trim()

  if (rawId) {
    const byId = index.find((c) => c.id === rawId)
    if (byId) return { id: byId.id, name: byId.label || byId.id, weight: byId.weight, matched: true }
    const foldedId = fold(rawId)
    const byLabel = index.find((c) => fold(c.label) === foldedId || fold(c.id) === foldedId)
    if (byLabel) return { id: byLabel.id, name: byLabel.label || byLabel.id, weight: byLabel.weight, matched: true }
  }

  const foldedTitle = fold(card.title || "")
  if (foldedTitle) {
    const byTitle = index.find((c) => fold(c.label) === foldedTitle || fold(c.id) === foldedTitle)
    if (byTitle) return { id: byTitle.id, name: byTitle.label || byTitle.id, weight: byTitle.weight, matched: true }
    // Looser containment both ways, so "Splnenie stanovených cieľov" still
    // finds `objectives_clarity` ("Ciele a zadanie práce").
    const byToken = index.find((c) => {
      const label = fold(c.label)
      if (!label) return false
      const tokens = label.split(" ").filter((t) => t.length > 4)
      return tokens.some((t) => foldedTitle.includes(t))
    })
    if (byToken) return { id: byToken.id, name: byToken.label || byToken.id, weight: byToken.weight, matched: true }
  }

  return {
    id: rawId || card.id,
    name: humanizeCriterionId((card.title || "").trim() || rawId || card.id),
    weight: null,
    matched: false,
  }
}

/**
 * Readable heading for a criterion that could not be matched to a rubric:
 * `totally_unknown_thing` → `Totally unknown thing`. Losing a reviewer's
 * paragraph is far worse than an imperfect heading, so nothing is dropped.
 */
export function humanizeCriterionId(value: string): string {
  const words = fold(value)
  return words ? words[0].toUpperCase() + words.slice(1) : value
}

/** Commentary for a criterion card: prose with identification/rating lines removed. */
export function commentaryFor(content: string): string {
  const kept: string[] = []
  for (const raw of content.split("\n")) {
    const line = raw.trim()
    if (!line) {
      kept.push("")
      continue
    }
    const field = cardFields(line)[0]
    const isMetaLine =
      Boolean(field?.label) &&
      (IDENTIFICATION_NEEDLES.some((n) => field.foldedLabel.includes(n)) ||
        RATING_NEEDLES.some((n) => field.foldedLabel.includes(n)))
    if (isMetaLine && !BULLET_RE.test(line)) continue
    if (isMetaLine && field && !field.value) continue
    kept.push(line)
  }
  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

const IDENTIFICATION_NEEDLES = [
  "autor",
  "student",
  "nazov",
  "title",
  "titul",
  "program",
  "typ prace",
  "thesis type",
  "skoliace",
  "pracovisko",
  "katedra",
  "ustav",
  "fakulta",
  "institut",
  "institution",
  "rok",
  "veduci",
  "oponent",
  "recenzent",
  "reviewer",
  "supervisor",
  "datum",
  "date",
  "podpis",
  "signature",
]

// ---------------------------------------------------------------------------
// Role / institution parsing
// ---------------------------------------------------------------------------

const ROLE_PATTERNS: Array<{ role: ThesisReviewerRole; needles: string[] }> = [
  { role: "supervisor", needles: ["veduci", "skolitel", "supervisor", "betreuer", "promotor", "temavezeto", "vedouci"] },
  { role: "opponent", needles: ["oponent", "opponent", "zweitgutachter", "oposnens", "opponens"] },
  { role: "self", needles: ["predkonzult", "vorbegutachtung", "self", "rozbor", "elozetes"] },
  { role: "reviewer", needles: ["recenzent", "reviewer", "gutachter", "recenzent", "biralo", "bíráló"] },
]

/** Read a reviewer role out of a free-text field such as `doc. X (Vedúci práce)`. */
export function roleFromText(text: string): ThesisReviewerRole | null {
  const folded = fold(text)
  for (const { role, needles } of ROLE_PATTERNS) {
    if (needles.some((n) => folded.includes(fold(n)))) return role
  }
  return null
}

/** Drop a trailing parenthetical role marker: `doc. X, PhD. (Vedúci práce)` → `doc. X, PhD.`. */
export function stripRoleSuffix(text: string): string {
  return text
    .replace(/\s*[\(\[]\s*[^)\]]{0,60}(vedúci|vedouci|skoliteľ|školiteľ|supervisor|oponent|opponent|recenzent|reviewer|gutachter|bíráló|biralo|betreuer|promotor)[^)\]]{0,60}\s*[\)\]]\s*$/i, "")
    .replace(/\s*[,–-]\s*(vedúci|vedouci|oponent|recenzent|reviewer|supervisor)\s*(práce|prace|práce)?\s*$/i, "")
    .trim()
}

/** Split a venue string into institution and faculty/department parts. */
export function splitInstitution(venue: string): { institution: string; faculty: string } {
  const parts = venue
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) return { institution: "", faculty: "" }
  return { institution: parts[0], faculty: parts.slice(1).join(", ") }
}

/**
 * Bullet lines of a criterion card that are *suggestions* rather than
 * commentary — the pipeline appends them under a "Návrhy"/"Suggested" label.
 */
export function bulletsAsSuggestions(content: string): string[] {
  const lines = content.split("\n")
  const out: string[] = []
  let collecting = false
  for (const raw of lines) {
    const line = raw.trim()
    const folded = fold(stripMarkup(line))
    if (/^\s*(navrhy|odporucania|suggestions|empfehlungen|zalecenia|javaslatok)\b/.test(folded)) {
      collecting = true
      const inline = stripMarkup(line).replace(/^[^:]*:\s*/, "").trim()
      if (inline) out.push(inline)
      continue
    }
    if (!collecting) continue
    if (BULLET_RE.test(line)) out.push(stripMarkup(line))
    else if (line === "") collecting = false
  }
  return out
}

/**
 * Place and date out of a signature line: `V Bratislave dňa 21. mája 2026`,
 * `Dresden, den 12. Mai 2026`, `Warszawa, dnia 12 maja 2026`.
 */
export function placeAndDate(text: string): { place: string; date: string } {
  const clean = stripMarkup(text).replace(/^(podpis[^:]*:|signature[^:]*:)\s*/i, "").trim()
  if (!clean) return { place: "", date: "" }
  const match = /^(.{2,60}?)[,\s]+(?:dňa|dna|den|dnia|on|am)\s+(.+)$/i.exec(clean)
  if (match && /\d{4}/.test(match[2])) {
    return { place: match[1].replace(/[,;]+$/, "").trim(), date: match[2].trim() }
  }
  if (/\d{4}/.test(clean) && /^[^,]{2,40},/.test(clean)) {
    const [place, ...rest] = clean.split(",")
    return { place: place.trim(), date: rest.join(",").trim() }
  }
  return { place: "", date: "" }
}

// ---------------------------------------------------------------------------
// Card classification
// ---------------------------------------------------------------------------

type CardRole =
  | "identification"
  | "summary"
  | "strengths"
  | "defense"
  | "citations"
  | "conclusion"
  | "confidential"
  | "criterion"

const CARD_ROLE_NEEDLES: Array<{ role: CardRole; needles: string[] }> = [
  { role: "identification", needles: ["identifikacia", "identifikace", "identification", "zakladne udaje", "metadata", "angaben", "dane podstawowe"] },
  { role: "summary", needles: ["zhrnutie", "sumar", "shrnuti", "summary", "zusammenfassung", "streszczenie", "osszefoglalo", "abstract"] },
  { role: "strengths", needles: ["silne stranky", "prednosti", "starken", "strengths", "zalety", "silne stranky prace", "eross"] },
  { role: "defense", needles: ["otazky", "otazky k obhajobe", "fragen", "questions", "pytania", "kerdesek"] },
  { role: "citations", needles: ["citacie", "citaciam", "citations", "literatur", "zitate", "cytowan", "hivatkozas"] },
  { role: "conclusion", needles: ["zaverecne", "celkove", "hodnotenie prace", "gesamtergebnis", "conclusion", "ocena koncowa", "osszegzo", "klasifikacia", "klasifikace"] },
  { role: "confidential", needles: ["doverne", "confidential", "vertraulich", "poufne", "bizalmas"] },
]

/** Classify a posudok card by title (and, secondarily, by its criterion id). */
export function cardRole(card: Pick<Card, "title" | "criterionId">): CardRole {
  const haystack = fold(`${card.title} ${card.criterionId ?? ""}`)
  if (/defense questions|defense_questions/.test(haystack)) return "defense"
  for (const { role, needles } of CARD_ROLE_NEEDLES) {
    if (needles.some((n) => haystack.includes(fold(n)))) return role
  }
  return "criterion"
}

// ---------------------------------------------------------------------------
// Derivation
// ---------------------------------------------------------------------------

function pick(
  explicit: string | undefined | null,
  cardValue: string,
  projectValue: string,
): { value: string; source: "explicit" | "card" | "project" | "none" } {
  if (explicit && explicit.trim()) return { value: explicit.trim(), source: "explicit" }
  if (cardValue && cardValue.trim()) return { value: cardValue.trim(), source: "card" }
  if (projectValue && projectValue.trim()) return { value: projectValue.trim(), source: "project" }
  return { value: "", source: "none" }
}

const ID_NEEDLES = {
  student: ["autor", "autorka", "student", "verfasser", "author", "szerzoje", "a dolgozat szerzoje", "autor prace"],
  thesisTitle: ["nazov zaverecnej prace", "nazov prace", "nazev prace", "thesis title", "titel der arbeit", "tytul pracy", "a dolgozat cime", "nazov diplomovej prace", "nazov bakalarskej prace", "paper title", "nazov clanku"],
  thesisType: ["typ prace", "thesis type", "art der arbeit", "rodzaj pracy", "tipusa", "manuscript type"],
  studyProgramme: ["studijny program", "studijni program", "study programme", "study program", "studiengang", "kierunek", "szak"],
  academicYear: ["akademicky rok", "akademicky", "academic year", "akademisches jahr", "rok akademicki", "tanev"],
  reviewer: ["vypracoval", "vypracovala", "reviewer", "gutachter", "recenzent", "biralo", "oponent", "veduci prace", "skolitel"],
}

/**
 * Derive the complete posudok from a project/output pair.
 *
 * `output.reviewMeta` wins field by field; the cards fill the gaps; the project
 * free-text fields are a last resort so a legacy workspace with neither still
 * produces a document rather than blanks.
 */
export function deriveThesisReview(
  project: Project,
  output: OutputConfig | null | undefined,
  language: ReportLanguageCode,
  /**
   * Explicit metadata that wins over `output.reviewMeta` — the workspace view
   * passes the stored review record here, so the printed posudok matches the
   * review the reviewer confirmed even when the cards are stale or empty.
   */
  reviewMetaOverride?: ThesisReviewOutputMeta | null,
): ThesisReviewDerived {
  const cards = output?.cards ?? []
  const rm: ThesisReviewOutputMeta = { ...(output?.reviewMeta ?? {}), ...(reviewMetaOverride ?? {}) }
  const resolved = resolveOutputMetadata(project, output ?? null)
  const provenance: ThesisReviewDerived["provenance"] = {}

  const idCards = cards.filter((c) => cardRole(c) === "identification")
  const idText = idCards.map((c) => c.content).join("\n")
  const conclusionText = cards
    .filter((c) => cardRole(c) === "conclusion")
    .map((c) => c.content)
    .join("\n")

  const cardStudent = fieldValue(idText, ID_NEEDLES.student)
  const cardThesisTitle = fieldValue(idText, ID_NEEDLES.thesisTitle)
  const cardProgramme = fieldValue(idText, ID_NEEDLES.studyProgramme)
  const cardYear = fieldValue(idText, ID_NEEDLES.academicYear)
  const cardType = fieldValue(idText, ID_NEEDLES.thesisType)
  const cardReviewer = fieldValue(idText, ID_NEEDLES.reviewer)

  const roleFromCards = roleFromText(idText) ?? roleFromText(`${resolved.authors} ${resolved.venue}`) ?? null

  // -- reviewer identity -----------------------------------------------------
  const rawAuthors = (resolved.authors || "").trim()
  const authorsLooksLikeReviewer =
    /,|\b(doc|prof|dr|ing|mgr|rndr|phd|msc|bsc|drsc|csc|habil)\b/i.test(rawAuthors) ||
    roleFromText(rawAuthors) !== null
  const reviewerFallback = authorsLooksLikeReviewer ? stripRoleSuffix(rawAuthors) : ""

  const reviewerName = rm.reviewerName?.trim()
    || cardReviewer
    || reviewerFallback
    || stripRoleSuffix(resolved.venue)

  const reviewerRole: ThesisReviewerRole = rm.reviewerRole
    ?? roleFromCards
    ?? "opponent"

  // -- student, title --------------------------------------------------------
  const student = rm.studentName?.trim() || cardStudent || (/^Bc\.|^Mgr\.|^Ing\./.test(rawAuthors) ? rawAuthors : "")
  const thesisTitleFromOutputTitle = /^\s*(posudok|posudek|assessment|review|gutachten|recenzja|bírálat|biralat)/i.test(resolved.title)
    ? resolved.title.replace(/^[^:]*:\s*/, "").trim()
    : ""
  const thesisTitle = rm.thesisTitle?.trim() || cardThesisTitle || thesisTitleFromOutputTitle

  // -- institution -----------------------------------------------------------
  const roleStrippedVenue = stripRoleSuffix(resolved.venue)
  const venueSplit = splitInstitution(roleStrippedVenue)
  const institution = rm.institution?.trim() || rm.faculty?.trim() || venueSplit.institution
  const faculty = rm.faculty?.trim() || venueSplit.faculty
  const department = rm.department?.trim() || ""

  // -- thesis type -----------------------------------------------------------
  const typeFromMeta = rm.thesisType ?? null
  const foldedType = fold(cardType)
  const typeFromCard: "bachelor" | "master" | "phd" | null =
    /doktor|dizert|phd|doktor|disserta/.test(foldedType) ? "phd"
      : /bakalar|bachelor|\bbsc\b|\bba\b|licencjac/.test(foldedType) ? "bachelor"
        : /diplom|master|magistr|\bmsc\b|\bma\b|magister/.test(foldedType) ? "master"
          : null
  const thesisType = typeFromMeta ?? typeFromCard ?? "master"

  // -- grade / recommendation ------------------------------------------------
  const cardGrade = ratingFromCard(conclusionText)
  const grade = (rm.grade ?? "").trim().toUpperCase() || cardGrade
  const scoreFromCards = /(\d{1,3}(?:[.,]\d)?)\s*%/.exec(conclusionText)
  const scorePercent = typeof rm.scorePercent === "number"
    ? rm.scorePercent
    : scoreFromCards
      ? Number(scoreFromCards[1].replace(",", "."))
      : null

  const cardRecommendation =
    fieldValue(conclusionText, ["odporucanie", "odporucam", "recommendation", "empfehlung", "rekomendacja", "ajanlas"]) ||
    bulletItems(conclusionText).find((item) => /odporuc|recommend|empfehl|rekomend|ajanl/i.test(item)) ||
    ""

  const signatureField = fieldValue(conclusionText, ["podpis", "signature", "unterschrift", "podpis"])
  const parsedPlaceDate = placeAndDate(signatureField || conclusionText)
  const cardDate = fieldValue(conclusionText, ["datum", "date", "dátum"]) || parsedPlaceDate.date
  const cardPlace = fieldValue(conclusionText, ["miesto", "ort", "place", "miejscowosc"]) || parsedPlaceDate.place

  // -- narrative blocks ------------------------------------------------------
  const summary = rm.summary?.trim() || cards.filter((c) => cardRole(c) === "summary").map((c) => commentaryFor(c.content)).join("\n\n")
  const strengths = rm.strengths?.length
    ? rm.strengths.filter(Boolean)
    : cards.filter((c) => cardRole(c) === "strengths").flatMap((c) => bulletItems(c.content))
  const defenseSection = cards.filter((c) => cardRole(c) === "defense")
  const defenseQuestions = rm.defenseQuestions?.length
    ? rm.defenseQuestions.filter(Boolean)
    : defenseSection.flatMap((c) => {
        const numbered = numberedItems(c.content)
        return numbered.length ? numbered : bulletItems(c.content)
      })
  const citationIssues = rm.citationIssues?.length
    ? rm.citationIssues.filter(Boolean)
    : cards.filter((c) => cardRole(c) === "citations").flatMap((c) => bulletItems(c.content))
  const confidentialComments = rm.confidentialComments?.trim()
    || cards.filter((c) => cardRole(c) === "confidential").map((c) => commentaryFor(c.content)).join("\n\n")
  const includeConfidential = rm.includeConfidential ?? Boolean(confidentialComments)

  // -- criteria --------------------------------------------------------------
  const criteriaFromMeta = (rm.criteria ?? []).filter((c) => c && (c.criterionId || c.name))
  const criteria: DerivedCriterion[] = criteriaFromMeta.length > 0 && cards.every((c) => cardRole(c) !== "criterion")
    ? criteriaFromMeta.map((c, i) => {
        const rubric = resolveCriterionById(c.criterionId, c.name ?? "", language)
        const rating = normalizeRating(c.rating) || ratingFromScore(c.numericScore)
        return {
          criterionId: rubric.id,
          cardId: `__meta_${i}`,
          name: c.name?.trim() || rubric.name,
          text: stripMarkup(c.text ?? ""),
          rating,
          weight: typeof c.weight === "number" ? c.weight : rubric.weight,
          points: rating ? pointsForRating(rating) : pointsFromScore(c.numericScore),
          suggestions: (c.suggestions ?? []).filter(Boolean),
          figures: [],
          matched: rubric.matched,
        }
      })
    : cards
    .filter((c) => cardRole(c) === "criterion")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((card) => {
      const rubric = resolveCriterion(card, language)
      const rating = rm.grade && rubric.matched && card === cards[cards.length - 1] ? ratingFromCard(card.content) : ratingFromCard(card.content)
      return {
        criterionId: rubric.id,
        cardId: card.id,
        name: rubric.name,
        text: commentaryFor(card.content),
        rating,
        weight: rubric.weight,
        points: pointsForRating(rating),
        suggestions: bulletsAsSuggestions(card.content),
        figures: (card.figures ?? []).filter((f) => f?.url).map((f) => ({ url: f.url, caption: f.caption ?? "" })),
        matched: rubric.matched,
      }
    })

  const rated = criteria.filter((c) => c.weight !== null && c.weight > 0 && c.points !== null)
  const totalWeight = rated.reduce((sum, c) => sum + (c.weight ?? 0), 0)
  const weightedScore = totalWeight > 0
    ? Math.round(rated.reduce((sum, c) => sum + (c.points ?? 0) * (c.weight ?? 0), 0) / totalWeight * 10) / 10
    : null
  const weightedGrade = weightedScore === null
    ? null
    : weightedScore >= 90 ? "A" : weightedScore >= 80 ? "B" : weightedScore >= 70 ? "C" : weightedScore >= 60 ? "D" : weightedScore >= 50 ? "E" : "F"

  const set = <K extends keyof ThesisReviewDerived>(key: K, source: "explicit" | "card" | "project" | "none") => {
    provenance[String(key)] = source
  }
  set("studentName", rm.studentName ? "explicit" : cardStudent ? "card" : "none")
  set("thesisTitle", rm.thesisTitle ? "explicit" : cardThesisTitle ? "card" : thesisTitleFromOutputTitle ? "project" : "none")
  set("reviewerName", rm.reviewerName ? "explicit" : cardReviewer ? "card" : reviewerFallback ? "project" : "none")
  set("reviewerRole", rm.reviewerRole ? "explicit" : roleFromCards ? "card" : "none")
  set("institution", rm.institution ? "explicit" : venueSplit.institution ? "project" : "none")
  set("grade", rm.grade ? "explicit" : cardGrade ? "card" : weightedGrade ? "card" : "none")

  return {
    language,
    reviewKind: rm.reviewKind ?? "thesis",
    studentName: student,
    thesisTitle,
    thesisType,
    studyProgramme: rm.studyProgramme?.trim() || cardProgramme,
    reviewerName,
    reviewerRole,
    institution,
    faculty,
    department,
    academicYear: rm.academicYear?.trim() || cardYear,
    grade,
    scorePercent: scorePercent ?? weightedScore,
    recommendation: rm.recommendation?.trim() || cardRecommendation,
    place: rm.place?.trim() || cardPlace,
    date: rm.date?.trim() || cardDate,
    includeConfidential,
    confidentialComments,
    summary,
    strengths,
    defenseQuestions,
    citationIssues,
    criteria,
    weightedScore,
    weightedGrade,
    provenance,
  }
}

// ---------------------------------------------------------------------------
// Stored review record → output metadata
// ---------------------------------------------------------------------------

/**
 * Shape of a stored `ThesisReview` row (Prisma) or the client-side
 * `ThesisReviewRecord`. Loosely typed on purpose: both surfaces carry the same
 * fields, but some arrive as JSON strings.
 */
export type ThesisReviewRecordLike = {
  studentName?: string | null
  thesisTitle?: string | null
  thesisType?: string | null
  reviewerRole?: string | null
  reviewerName?: string | null
  institution?: string | null
  department?: string | null
  grade?: string | null
  finalGrade?: string | null
  recommendation?: string | null
  finalRecommendation?: string | null
  summary?: string | null
  strengths?: string[] | string | null
  defenseQuestions?: string[] | string | null
  questionsForAuthors?: string[] | string | null
  citationIssues?: string[] | string | null
  reviewKind?: string | null
  language?: string | null
  place?: string | null
  date?: string | null
  confidentialComments?: string | null
  sections?: Array<{
    criterionId?: string | null
    text?: string | null
    rating?: string | null
    numericScore?: number | null
    suggestions?: string[] | null
  }> | string | null
}

const META_LANGUAGES: ReportLanguageCode[] = ["sk", "cs", "en", "de", "pl", "hu"]

function stringList(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value.map((v) => (typeof v === "string" ? v : String(v ?? ""))).filter(Boolean)
  if (typeof value !== "string" || !value.trim()) return []
  const trimmed = value.trim()
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return parsed.map((v) => String(v ?? "")).filter(Boolean)
    } catch {
      /* fall through to line splitting */
    }
  }
  return trimmed.split(/\n+/).map((line) => line.replace(BULLET_RE, "").trim()).filter(Boolean)
}

/** `A`, `Note: 1,7`, `96 %` → the canonical rating letter (or `""`). */
export function normalizeRating(value: string | null | undefined): string {
  if (!value) return ""
  const clean = value.trim()
  if (!clean) return ""
  const letter = /^(?:[A-F]|FX)$/i.exec(clean.toUpperCase())
  if (letter && letter[0].toUpperCase() !== "FX") return letter[0].toUpperCase()
  return ratingFromCard(clean)
}

function ratingFromScore(score: number | null | undefined): string {
  if (typeof score !== "number" || !Number.isFinite(score)) return ""
  return score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : score >= 50 ? "E" : "F"
}

function pointsFromScore(score: number | null | undefined): number | null {
  if (typeof score !== "number" || !Number.isFinite(score)) return null
  return Math.max(0, Math.min(100, score))
}

/**
 * Fold a stored thesis-review record into `ThesisReviewOutputMeta`.
 *
 * The record is the authoritative description of a posudok: it knows the
 * student, the reviewer, the confirmed classification and the per-criterion
 * ratings. Exporting or previewing a workspace must therefore be able to read
 * it without caring whether the workspace's cards carry the same information.
 */
export function reviewMetaFromRecord(record: ThesisReviewRecordLike | null | undefined): ThesisReviewOutputMeta {
  if (!record) return {}
  const sections = typeof record.sections === "string" ? safeJsonArray(record.sections) : record.sections ?? []
  const typedSections = (sections ?? []) as Array<{
    criterionId?: string | null
    rating?: string | null
    numericScore?: number | null
    text?: string | null
    suggestions?: string[] | null
  }>
  const criteria: ThesisReviewMetaCriterion[] = typedSections
    .map((section) => ({
      criterionId: (section?.criterionId || "").trim(),
      rating: section?.rating ?? null,
      numericScore: typeof section?.numericScore === "number" ? section.numericScore : null,
      text: section?.text ?? null,
      suggestions: (section?.suggestions ?? []).filter(Boolean),
    }))
    .filter((c) => c.criterionId)

  const language = META_LANGUAGES.includes((record.language ?? "") as ReportLanguageCode)
    ? (record.language as ReportLanguageCode)
    : undefined

  const meta: ThesisReviewOutputMeta = {
    studentName: record.studentName?.trim() || undefined,
    thesisTitle: record.thesisTitle?.trim() || undefined,
    thesisType: record.thesisType === "bachelor" || record.thesisType === "master" || record.thesisType === "phd"
      ? record.thesisType
      : undefined,
    reviewerName: record.reviewerName?.trim() || undefined,
    reviewerRole: reviewerRoleFromString(record.reviewerRole),
    institution: record.institution?.trim() || undefined,
    department: record.department?.trim() || undefined,
    grade: (record.finalGrade || record.grade || "").trim().toUpperCase() || undefined,
    recommendation: (record.finalRecommendation || record.recommendation || "").trim() || undefined,
    summary: record.summary?.trim() || undefined,
    strengths: stringList(record.strengths),
    defenseQuestions: [...stringList(record.defenseQuestions), ...stringList(record.questionsForAuthors)],
    citationIssues: stringList(record.citationIssues),
    reviewKind: record.reviewKind === "paper" ? "paper" : "thesis",
    language,
    place: record.place?.trim() || undefined,
    date: record.date?.trim() || undefined,
    confidentialComments: record.confidentialComments?.trim() || undefined,
    criteria,
  }
  if (meta.includeConfidential === undefined && meta.confidentialComments) meta.includeConfidential = true
  return meta
}

function safeJsonArray(value: string): Array<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function reviewerRoleFromString(role: string | null | undefined): ThesisReviewOutputMeta["reviewerRole"] {
  const folded = fold(role ?? "")
  if (!folded) return undefined
  if (folded.includes("supervisor") || folded.includes("veduc") || folded.includes("skolitel") || folded.includes("betreuer")) return "supervisor"
  if (folded.includes("opponent") || folded.includes("oponent")) return "opponent"
  if (folded.includes("self") || folded.includes("vlastn")) return "self"
  return "reviewer"
}

/** Resolve a rubric criterion from an explicit id, falling back to its label. */
export function resolveCriterionById(
  id: string,
  label: string,
  lang: ReportLanguageCode,
): ResolvedCriterion {
  const index = rubricIndex(lang)
  const rawId = (id || "").trim()
  const foldedId = fold(rawId)
  const byId = rawId
    ? index.find((c) => c.id === rawId || fold(c.id) === foldedId || fold(c.label) === foldedId)
    : undefined
  if (byId) return { id: byId.id, name: byId.label || byId.id, weight: byId.weight, matched: true }

  const foldedLabel = fold(label || "")
  const byLabel = foldedLabel
    ? index.find((c) => fold(c.label) === foldedLabel || fold(c.id) === foldedLabel)
    : undefined
  if (byLabel) return { id: byLabel.id, name: byLabel.label || byLabel.id, weight: byLabel.weight, matched: true }

  return {
    id: rawId || humanizeCriterionId(foldedLabel || "criterion"),
    name: label?.trim() || humanizeCriterionId(rawId || "criterion"),
    weight: null,
    matched: false,
  }
}

export { pick as pickDerivedValue }
