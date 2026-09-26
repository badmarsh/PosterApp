/**
 * LaTeX generator for thesis assessment reports (posudok / Gutachten / recenzja).
 *
 * Two entry paths share every renderer below:
 *
 *  - the AI review pipeline (app/api/…/thesis-review/…/export) hands a complete
 *    `ThesisReviewGeneratorInput` in — metadata, sections with ratings, findings,
 *    strengths, defence questions, citation issues;
 *  - a workspace output (`ThesisReviewLatexGenerator.generateDocument`) only has
 *    cards, so `lib/latex/thesis-review-meta.ts` derives the same shape from the
 *    identification bullets, the rating lines and the conclusion tiles. This is
 *    what previously printed the reviewer as the student and the output title as
 *    the thesis title (audit finding P-01).
 *
 * The visual design is *not* in this file: `getThesisReviewPreamble` defines
 * style macros (`\posudokletterhead`, `\posudokheading`, `\posudokgrade`, …) per
 * template, so the six posudok templates produce structurally different
 * documents while this generator stays style-agnostic.
 */

import {
  getThesisReviewPreamble,
  reportLanguageFor,
  THESIS_REVIEW_LABELS,
  type ReportLanguage,
  type ThesisReviewTemplate,
  type ThesisReviewLabels,
} from "./templates-thesis"
import { thesisReviewStyleFor, type ThesisReviewStyle } from "./thesis-review-styles"
import { THESIS_CRITERIA, computeOverallScore, type ThesisSection, type ReviewLanguage } from "@/lib/ai/thesis-rubric"
import { SK_ACADEMIC_RUBRIC_V1 } from "@/lib/ai/rubric-engine"
import type { ReviewKind, ReviewFinding } from "@/lib/ai/review-types"
import { getEligibleFindings } from "@/lib/ai/review-composer"
import { bucketFindings } from "@/lib/ai/review-bucketing"
import { mapUnicodeToLatex, parseMarkdownToLatex } from "./parser"
import { assetUrlToLatexPath, normalizeLatexPath } from "./helpers"
import { deriveThesisReview, pointsForRating, resolveCriterion, type ReportLanguageCode } from "./thesis-review-meta"
import type { Project, OutputConfig } from "@/lib/poster-types"
import type { LatexGenerator } from "./types"

// ---------------------------------------------------------------------------
// LaTeX escaping (Single-pass replacement)
// ---------------------------------------------------------------------------

/**
 * Escaping policy for thesis-review documents, split by field role.
 *
 * `escapeLatex` (below) is for **structural** fields — student/reviewer names,
 * institution, department, thesis title, grades, rating symbols, labels. These
 * land inside `tabularx` cells and mandatory macro arguments, where an
 * `itemize` or a display equation would break the layout, and where a literal
 * `*` or `$` is far more likely to be a character than markup. They are
 * escaped verbatim, then passed through the shared Unicode map so that a Greek
 * letter in a thesis title is not a fatal `inputenc` error.
 *
 * `escapeProse` is for **free text** — section commentary, suggestions,
 * defense questions, citation issues, confidential notes, recommendation.
 * This content is LLM-written academic prose: it routinely contains Greek
 * letters, em dashes, smart quotes, `**emphasis**` and inline `$math$`. It
 * therefore goes through the same `parseMarkdownToLatex` pipeline that
 * poster/slides/paper use, which protects math and citations, renders
 * markdown, and applies the Unicode map.
 */
export function escapeLatex(text: string): string {
  if (!text) return ""
  const escaped = text.replace(/[\\&%$#_{}~^<>]/g, (match) => {
    switch (match) {
      case "\\":
        return "\\textbackslash{}"
      case "&":
        return "\\&"
      case "%":
        return "\\%"
      case "$":
        return "\\$"
      case "#":
        return "\\#"
      case "_":
        return "\\_"
      case "{":
        return "\\{"
      case "}":
        return "\\}"
      case "~":
        return "\\textasciitilde{}"
      case "^":
        return "\\textasciicircum{}"
      case "<":
        return "\\textless{}"
      case ">":
        return "\\textgreater{}"
      default:
        return match
    }
  })
  return mapUnicodeToLatex(escaped)
}

/** Free-text (prose) escaping — see the policy note on escapeLatex. */
export function escapeProse(text: string): string {
  if (!text) return ""
  return parseMarkdownToLatex(text)
}

function nl2par(text: string): string {
  return text
    .split(/\n\n+/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean)
    .join("\n\n")
}

// ---------------------------------------------------------------------------
// Criteria — the shape both entry paths normalise to
// ---------------------------------------------------------------------------

export type GeneratedCriterion = {
  /** Rubric criterion id, when it could be resolved. */
  criterionId: string
  name: string
  text: string
  /** Rating letter, or "" when the reviewer did not rate this criterion. */
  rating: string
  /** Rubric weight in percent, or null for custom/unmatched criteria. */
  weight: number | null
  /** Points from the rating (midpoint of its ECTS band), or null. */
  points: number | null
  suggestions: string[]
  /** Figures attached to the criterion card (score profiles, plots). */
  figures?: Array<{ url: string; caption: string }>
}

/** Rubric weights keyed by criterion id, v1 rubric first. */
function rubricWeightIndex(): Map<string, number> {
  const map = new Map<string, number>()
  for (const c of THESIS_CRITERIA) map.set(c.id, c.weight)
  for (const c of SK_ACADEMIC_RUBRIC_V1.criteria) map.set(c.id, c.weight)
  return map
}

function criteriaFromSections(sections: ThesisSection[], lang: ReportLanguage): GeneratedCriterion[] {
  return sections.map((section) => {
    const id = (section.criterionId || section.sectionId || section.id || "").trim()
    const rating = section.rating && section.rating !== "pending" ? section.rating : ""
    const points = typeof section.numericScore === "number" && Number.isFinite(section.numericScore)
      ? Math.round(section.numericScore)
      : pointsForRating(rating)
    // Resolution mirrors the workspace path exactly (id → rubric label by
    // diacritic-folded title → humanized fallback), so a section that stores a
    // human-readable criterion title still gets its real weight and name.
    const resolved = resolveCriterion(
      { id: section.id || id, title: section.criterionId || section.sectionId || section.id || "", criterionId: section.criterionId },
      lang as ReportLanguageCode,
    )
    return {
      criterionId: resolved.id,
      name: resolved.name || resolveSectionName(section, lang),
      text: section.text || "",
      rating,
      weight: resolved.weight ?? rubricWeightIndex().get(id) ?? null,
      points,
      suggestions: section.suggestions ?? [],
    }
  })
}

/**
 * Workspace-relative path for a figure URL. The compile pipeline stages the
 * workspace assets directory, and `ensureMissingGraphicsFallback` turns a
 * missing file into a visible placeholder rather than a fatal error, so a
 * stale attachment can never break an export.
 */
let activeWorkspaceId = ""
export function setThesisReviewWorkspaceId(id: string): void {
  activeWorkspaceId = id
}

function figurePath(url: string): string {
  if (activeWorkspaceId) return normalizeLatexPath(assetUrlToLatexPath(url, activeWorkspaceId))
  return normalizeLatexPath(url)
}

function normalizeRating(value: string): string {
  const clean = (value || "").trim().toUpperCase()
  return /^[A-F](X)?$/.test(clean) ? clean : ""
}

// ---------------------------------------------------------------------------
// Section generators
// ---------------------------------------------------------------------------

function buildLetterhead(
  labels: ThesisReviewLabels,
  meta: {
    institution?: string | null
    faculty?: string | null
    department?: string | null
    reviewerName?: string | null
    date?: string | null
    place?: string | null
    logoUrl?: string | null
  }
): string {
  const institution = { institution: meta.institution ?? "", faculty: meta.faculty ?? "" }
  const facultyLine = [institution.faculty, meta.department].filter(Boolean).join(" · ")
  const rightMeta = [meta.place, meta.date].filter(Boolean).join(", ") || labels.title
  if (!institution.institution && !facultyLine) return ""
  const logo = meta.logoUrl
    ? `\\noindent\\PosterIncludeGraphics[height=1.5cm]{${escapeLatex(meta.logoUrl)}}\\\\[0.4em]\n`
    : ""
  return `${logo}\\posudokletterhead{${escapeLatex(institution.institution)}}{${escapeLatex(facultyLine)}}{${escapeLatex(rightMeta)}}`
}

function buildIdentificationBlock(
  labels: ThesisReviewLabels,
  style: ThesisReviewStyle,
  meta: {
    studentName: string
    thesisTitle: string
    thesisType: "bachelor" | "master" | "phd"
    studyProgramme?: string | null
    reviewerRole: string
    reviewerName?: string | null
    institution?: string | null
    faculty?: string | null
    department?: string | null
    academicYear?: string | null
  },
  kind: "thesis" | "paper"
): string {
  const rows: string[] = [
    `  \\textbf{${escapeLatex(labels.studentLabel)}:} & ${escapeLatex(meta.studentName)} \\\\`,
    `  \\textbf{${escapeLatex(labels.thesisTitleLabel)}:} & ${escapeLatex(meta.thesisTitle)} \\\\`,
    `  \\textbf{${escapeLatex(labels.thesisTypeLabel)}:} & ${escapeLatex(labels.thesisTypes[meta.thesisType] ?? meta.thesisType)} \\\\`,
  ]

  if (meta.studyProgramme) {
    rows.push(`  \\textbf{${escapeLatex(labels.studyProgrammeLabel)}:} & ${escapeLatex(meta.studyProgramme)} \\\\`)
  }
  if (meta.faculty) {
    rows.push(`  \\textbf{${escapeLatex(labels.facultyLabel)}:} & ${escapeLatex(meta.faculty)} \\\\`)
  }
  if (meta.reviewerName) {
    rows.push(`  \\textbf{${escapeLatex(labels.reviewerLabel)}:} & ${escapeLatex(meta.reviewerName)} \\\\`)
  }
  rows.push(`  \\textbf{${escapeLatex(labels.roleLabel)}:} & ${escapeLatex((labels.roles as Record<string, string | undefined>)[meta.reviewerRole] ?? meta.reviewerRole)} \\\\`)

  if (meta.institution) {
    rows.push(`  \\textbf{${escapeLatex(labels.institutionLabel)}:} & ${escapeLatex(meta.institution)} \\\\`)
  }
  if (meta.department) {
    rows.push(`  \\textbf{${escapeLatex(labels.departmentLabel)}:} & ${escapeLatex(meta.department)} \\\\`)
  }
  if (meta.academicYear) {
    rows.push(`  \\textbf{${escapeLatex(labels.academicYearLabel)}:} & ${escapeLatex(meta.academicYear)} \\\\`)
  }

  // Shaded-label styles print a filled grey label column; the others use the
  // classic plain label column. Both are tabularx so long values wrap.
  const columnSpec =
    style.letterhead === "shaded-table"
      ? "@{}>{\\columncolor{formgrey}\\bfseries}l X@{}"
      : "@{}l X@{}"

  const heading = kind === "thesis"
    ? `\\section{${escapeLatex(labels.identificationLabel)}}\n\n`
    : ""

  return `${heading}\\noindent
\\begin{tabularx}{\\textwidth}{${columnSpec}}
${rows.join("\n")}
\\end{tabularx}`
}

/**
 * Weighted criteria overview table — the element that turns the review into an
 * auditable assessment: every criterion with its rubric weight, the points the
 * rating converts to, and the rating itself. Styles differ in which columns
 * they show and in the row treatment, but all of them read the same numbers.
 */
function buildCriteriaOverview(
  labels: ThesisReviewLabels,
  style: ThesisReviewStyle,
  criteria: GeneratedCriterion[],
  lang: ReportLanguage
): string {
  const rows = criteria.filter((c) => c.name)
  if (rows.length === 0) return ""

  const anyRating = rows.some((c) => c.rating)
  if (!anyRating && !style.showWeights) return ""

  const notRated = labels.notRatedLabel
  const cell = (c: GeneratedCriterion) => [
    escapeLatex(c.name),
    style.showWeights ? (c.weight === null ? "---" : `${c.weight}\\,\\%`) : null,
    style.showPoints ? (c.points === null ? "---" : `${c.points}`) : null,
    c.rating ? `\\ratingsymbol{${escapeLatex(c.rating)}}` : `\\textit{${escapeLatex(notRated)}}`,
  ].filter((v): v is string => v !== null)

  const headerCells = [
    labels.criterionLabel,
    style.showWeights ? labels.weightLabel : null,
    style.showPoints ? labels.pointsLabel : null,
    labels.ratingLabel,
  ].filter((v): v is string => v !== null)

  const columnSpec = [
    "@{}X",
    style.showWeights ? "r" : null,
    style.showPoints ? "r" : null,
    "r@{}",
  ].filter((v): v is string => v !== null).join(" ")

  const chunkSize = 12
  const chunks: GeneratedCriterion[][] = []
  for (let i = 0; i < rows.length; i += chunkSize) chunks.push(rows.slice(i, i + chunkSize))

  return chunks
    .map((chunk) => {
      const body = chunk
        .map((c, index) => {
          const cells = cell(c).join(" & ")
          const striped = style.criteriaTable === "band-rows" && index % 2 === 1
          return `${striped ? "\\rowcolor{formgrey} " : ""}  ${cells} \\\\`
        })
        .join("\n")
      const header = style.letterhead === "shaded-table"
        ? `\\rowcolor{accent}\\color{white}\\textbf{${headerCells.join("} & \\textbf{")}} \\\\`
        : `\\textbf{${headerCells.join("} & \\textbf{")}} \\\\`
      return `\\noindent\\begin{tabularx}{\\textwidth}{${columnSpec}}
\\toprule
${header}
\\midrule
${body}
\\bottomrule
\\end{tabularx}

{\\footnotesize\\itshape ${escapeLatex(labels.gradingScaleLabel)}}`
    })
    .join("\n\n")
}

/**
 * Per-criterion commentary. Numbering, marker and rating placement come from
 * the template's `\posudokheading` macro, so this code emits the same call for
 * every style.
 */
function buildCriteriaTable(
  labels: ThesisReviewLabels,
  criteria: GeneratedCriterion[],
  lang: ReportLanguage,
  includeRatings: boolean
): string {
  const rows: string[] = []
  let index = 0

  for (const criterion of criteria) {
    const text = nl2par(criterion.text || "")
    const suggestions = criterion.suggestions.filter(Boolean)
    if (!text && suggestions.length === 0 && !criterion.rating) continue

    const name = criterion.name || criterion.criterionId
    if (!name) continue
    index += 1
    const letter = includeRatings ? normalizeRating(criterion.rating) : ""
    const rating = letter ? `\\ratingsymbol{${escapeLatex(letter)}}` : ""
    rows.push(`\\posudokheading{${index}}{${escapeLatex(name)}}{${rating}}
${escapeProse(text)}`)

    if (suggestions.length > 0) {
      rows.push(`\\begin{itemize}[leftmargin=*,noitemsep,topsep=2pt]\\small
${suggestions.map((s) => `  \\item ${escapeProse(s)}`).join("\n")}
\\end{itemize}`)
    }

    const figures = (criterion.figures ?? []).filter((f) => f?.url)
    if (figures.length > 0) {
      rows.push(figures
        .map((fig) => {
          const path = figurePath(fig.url)
          const caption = escapeProse(fig.caption || "")
          const captionLine = caption
            ? `\n  \\par\\smallskip{\\footnotesize\\itshape ${caption}}`
            : ""
          return `\\begin{center}
  \\includegraphics[width=0.68\\linewidth,keepaspectratio]{${path}}${captionLine}
\\end{center}`
        })
        .join("\n"))
    }
  }

  void labels
  void lang
  return rows.join("\n\n")
}

type EvaluationBlock = { heading: string; body: string }

/**
 * Localised, unnumbered headings for the evaluation blocks. Numbering is
 * applied later, so that a block appearing or disappearing never leaves a gap
 * in the sequence (the previous hard-coded "3." / "4." headings vanished with
 * their section and silently shifted the whole review).
 */
function buildEvaluationBlocks(
  input: ThesisReviewGeneratorInput,
  reviewKind: "thesis" | "paper"
): EvaluationBlock[] {
  const lang = input.language
  const isPaper = reviewKind === "paper"
  const L = (sk: string, cs: string, en: string) => (lang === "sk" ? sk : lang === "cs" ? cs : en)
  const blocks: EvaluationBlock[] = []

  if (input.summary && input.summary.trim()) {
    blocks.push({
      heading: L(
        isPaper ? "Zhrnutie rukopisu (Manuscript Summary)" : "Zhrnutie práce a hlavný prínos (Executive Summary)",
        isPaper ? "Shrnutí rukopisu (Manuscript Summary)" : "Shrnutí práce a hlavní přínos (Executive Summary)",
        isPaper ? "Manuscript Summary" : "Executive Summary"
      ),
      body: escapeProse(nl2par(input.summary)),
    })
  }

  const eligible = input.findings && input.findings.length > 0
    ? getEligibleFindings(input.findings, input.includeConfidential ? "editor" : "author")
    : []
  const buckets = bucketFindings(eligible)

  // Strengths: verified strengths found while reviewing merge with the
  // reviewer-confirmed list. A strength is never a "concern" and therefore
  // never belongs to the minor-concerns bucket.
  const findingStrengths = isPaper
    ? []
    : buckets.strengths
        .filter((f) => f.evidence?.some((e) => e.verified))
        .map((f) => f.explanation || f.title)
  const strengths = [...new Set([...(input.strengths || []), ...findingStrengths])].filter(Boolean)
  if (strengths.length > 0) {
    const items = strengths.map((s) => "  \\item " + escapeProse(s)).join("\n")
    blocks.push({
      heading: L(
        isPaper ? "Podložené silné stránky rukopisu (Evidence-Grounded Strengths)" : "Silné stránky práce (Key Strengths)",
        isPaper ? "Podložené silné stránky rukopisu (Evidence-Grounded Strengths)" : "Silné stránky práce (Key Strengths)",
        isPaper ? "Evidence-Grounded Strengths" : "Key Strengths"
      ),
      body: "\\begin{itemize}[leftmargin=*,itemsep=2pt]\n" + items + "\n\\end{itemize}",
    })
  }

  const recPrefix = L("Odporúčaná náprava:", "Doporučená náprava:", "Recommended fix:")
  const evidencePrefix = L("Dôkaz v texte:", "Důkaz v textu:", "Evidence in text:")

  const renderFinding = (f: ReviewFinding) => {
    const cat = (f.category || "general").toUpperCase()
    const title = `[${cat}] ${f.title}`
    const expl = nl2par(f.explanation || "")
    const rec = f.recommendation
      ? "\\par\\noindent\\textit{\\textbf{" + escapeLatex(recPrefix) + "} " + escapeProse(f.recommendation) + "}"
      : ""
    const ev = f.evidence?.[0]?.quote
      ? "\\par\\noindent{\\small\\color{rulegrey}\\textit{" + escapeLatex(evidencePrefix) + " ``" + escapeProse(f.evidence[0].quote) + "''}}"
      : ""
    return "\\Needspace{5\\baselineskip}\n\\subsubsection*{" + escapeLatex(title) + "}\n" + escapeProse(expl) + rec + ev
  }

  if (buckets.major.length > 0) {
    blocks.push({
      heading: L("Zásadné pripomienky (Major Concerns)", "Zásadní připomínky (Major Concerns)", "Major Concerns"),
      body: buckets.major.map(renderFinding).join("\n\n"),
    })
  }

  if (buckets.minor.length > 0) {
    const items = buckets.minor
      .map((f) => {
        const cat = (f.category || "general").toUpperCase()
        return (
          "  \\item \\textbf{[" + escapeLatex(cat) + "]} \\textbf{" + escapeLatex(f.title) + "}: " +
          escapeProse(f.explanation || "")
        )
      })
      .join("\n")
    blocks.push({
      heading: L("Drobné pripomienky (Minor Concerns)", "Drobné připomínky (Minor Concerns)", "Minor Concerns"),
      body: "\\begin{itemize}[leftmargin=*,itemsep=4pt]\n" + items + "\n\\end{itemize}",
    })
  }

  // Slovak/Czech doctoral opponent reviews carry a statutory clause; render it
  // explicitly so the exported posudok contains the § 67 / § 54a wording.
  const statutoryClause = input.phdEnrichment?.statutoryClause
  if (reviewKind === "thesis" && input.thesisType === "phd" && input.reviewerRole === "opponent" && statutoryClause?.trim()) {
    blocks.push({
      heading: L(
        "Zákonné podmienky doktorského študijného programu",
        "Zákonné podmínky doktorského studijního programu",
        "Statutory Requirements of the Doctoral Study Programme"
      ),
      body: escapeProse(statutoryClause),
    })
  }

  return blocks
}

function buildDefenseQuestions(labels: ThesisReviewLabels, questions: string[]): string {
  if (!questions.length) return ""
  return `\\Needspace{8\\baselineskip}
\\section{${escapeLatex(labels.defenseLabel)}}
\\begin{enumerate}[leftmargin=*]
${questions.map((q) => `  \\item ${escapeProse(q)}`).join("\n")}
\\end{enumerate}`
}

function buildCitationNotes(labels: ThesisReviewLabels, issues: string[]): string {
  if (!issues.length) return ""
  return `\\Needspace{6\\baselineskip}
\\section{${escapeLatex(labels.citationLabel)}}
\\begin{itemize}[leftmargin=*]
${issues.map((i) => `  \\item ${escapeProse(i)}`).join("\n")}
\\end{itemize}`
}

function buildConfidentialNotes(labels: ThesisReviewLabels, comments: string): string {
  if (!comments || !comments.trim()) return ""
  return `\\Needspace{8\\baselineskip}
\\section{${escapeLatex(labels.confidentialLabel)}}
{\\small
${escapeProse(nl2par(comments))}
}`
}

/**
 * Grade panel: proposed classification, the weighted score it came from, the
 * ECTS band and the reviewer's recommendation. Rendered with the template's own
 * `\posudokgrade` macro so a Slovak form gets a boxed letter and a German
 * Gutachten a shaded note panel.
 */
function buildGradePanel(
  labels: ThesisReviewLabels,
  style: ThesisReviewStyle,
  options: {
    grade: string | null | undefined
    scorePercent: number | null
    ects: string | null
    recommendation: string | null | undefined
    includeGrade: boolean
    place?: string | null
    date?: string | null
  }
): string {
  const parts: string[] = []

  if (options.includeGrade) {
    const grade = options.grade ? escapeLatex(options.grade) : "\\rule{1.2cm}{0.4pt}"
    parts.push(`\\posudokgrade{${escapeLatex(labels.gradeLabel)}}{${grade}}`)
  }

  if (options.includeGrade && options.scorePercent !== null) {
    const score = `${options.scorePercent.toFixed(1)}\\,\\%`
    const ects = options.ects ? ` \\hfill ${escapeLatex(labels.ectsLabel)}: \\textbf{${escapeLatex(options.ects)}}` : ""
    parts.push(`\\posudokpanel{${escapeLatex(labels.scoreLabel)}}{${score}${ects}}`)
  }

  const recText = options.recommendation ? escapeProse(options.recommendation) : ""
  parts.push(`\\thesisfield{${escapeLatex(labels.recommendationLabel)}}{${recText}}`)

  if (options.includeGrade) {
    parts.push(`{\\footnotesize\\itshape ${escapeLatex(labels.gradingScaleLabel)}}`)
  }

  const gradePanel = parts.join("\n\n")
  const signatureRow = [
    style.letterhead === "shaded-table" ? "\\rowcolor{formgrey}" : "",
    `${escapeLatex(labels.signatureLabel)}: & ${escapeLatex(labels.dateLabel)}: \\\\[2.1cm]`,
    "  \\hrulefill & \\hrulefill \\\\",
  ].filter(Boolean).join("\n")

  return `\\Needspace{10\\baselineskip}
\\section{${escapeLatex(labels.summaryLabel)}}

${gradePanel}

\\vspace{2.2cm}

\\noindent
\\begin{tabular}{p{8cm}p{5cm}}
${signatureRow}
\\end{tabular}`
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function labelsForReviewKind(
  labels: ThesisReviewLabels,
  lang: ReportLanguage,
  reviewKind: ReviewKind
): ThesisReviewLabels {
  if (reviewKind !== "paper") return labels

  const sk = lang === "sk"
  const cs = lang === "cs"
  const scientificPaper = sk ? "Vedecký článok" : cs ? "Vědecký článek" : "Scientific paper"
  return {
    ...labels,
    title: sk ? "ODBORNÁ RECENZIA VEDECKÉHO ČLÁNKU" : cs ? "ODBORNÁ RECENZE VEDECKÉHO ČLÁNKU" : "SCIENTIFIC PAPER PEER REVIEW",
    studentLabel: sk ? "Autor/Autorka článku" : cs ? "Autor/Autorka článku" : "Author(s)",
    thesisTitleLabel: sk ? "Názov článku" : cs ? "Název článku" : "Paper title",
    thesisTypeLabel: sk ? "Typ rukopisu" : cs ? "Typ rukopisu" : "Manuscript type",
    gradingLabel: sk ? "ODBORNÉ POSÚDENIE" : cs ? "ODBORNÉ POSOUZENÍ" : "PEER-REVIEW FINDINGS",
    defenseLabel: sk ? "OTÁZKY PRE AUTOROV" : cs ? "OTÁZKY PRO AUTORY" : "QUESTIONS FOR THE AUTHORS",
    citationLabel: sk ? "POZNÁMKY K CITÁCIÁM" : cs ? "POZNÁMKY K CITACÍM" : "CITATION NOTES",
    summaryLabel: sk ? "PUBLIKAČNÉ ODPORÚČANIE" : cs ? "PUBLIKAČNÍ DOPORUČENÍ" : "PUBLICATION RECOMMENDATION",
    confidentialLabel: sk ? "DÔVERNÉ POZNÁMKY PRE EDITORA" : cs ? "DŮVĚRNÉ POZNÁMKY PRO EDITORA" : "CONFIDENTIAL COMMENTS TO THE EDITOR",
    recommendationLabel: sk ? "Odporúčanie editorovi" : cs ? "Doporučení editorovi" : "Recommendation to the editor",
    signatureLabel: sk ? "Podpis recenzenta/ky" : cs ? "Podpis recenzenta/ky" : "Reviewer's signature",
    identificationLabel: sk ? "IDENTIFIKÁCIA RUKOPISU" : cs ? "IDENTIFIKACE RUKOPISU" : "MANUSCRIPT IDENTIFICATION",
    criteriaOverviewLabel: sk ? "PREHĽAD POSÚDENIA KRITÉRIÍ" : cs ? "PŘEHLED POSOUZENÍ KRITÉRIÍ" : "REVIEW CRITERIA OVERVIEW",
    thesisTypes: { bachelor: scientificPaper, master: scientificPaper, phd: scientificPaper },
    roles: { ...labels.roles, supervisor: "Reviewer", opponent: "Reviewer", self: "Author triage", reviewer: "Reviewer" },
  }
}

function buildAiDisclosure(lang: ReportLanguage): string {
  const disclosure = lang === "sk"
    ? "Koncept recenzie bol pripravený s podporou evidenciou podloženého AI asistenta PosterApp. Konečné odborné posúdenie a rozhodnutie vykonal ľudský recenzent."
    : lang === "cs"
      ? "Návrh recenze byl připraven s podporou AI asistenta PosterApp založeného na důkazech. Konečné odborné posouzení a rozhodnutí provedl lidský recenzent."
      : lang === "de"
        ? "Der Entwurf dieses Gutachtens wurde mit Unterstützung des evidenzbasierten KI-Assistenten von PosterApp erstellt. Die abschließende fachliche Beurteilung und Entscheidung obliegt der menschlichen Begutachtung."
        : lang === "pl"
          ? "Projekt recenzji przygotowano z pomocą asystenta AI PosterApp opartego na dowodach. Ostateczna ocena merytoryczna i decyzja należą do recenzenta."
          : lang === "hu"
            ? "A bírálat tervezete a PosterApp bizonyítékokra támaszkodó AI-asszisztensének támogatásával készült. A végső szakmai értékelés és döntés a humán bíráló feladata."
            : "This review draft was prepared with PosterApp's evidence-grounded AI assistant. Final scholarly judgment and the decision remain with the human reviewer."
  return `\\Needspace{5\\baselineskip}\n\\section*{${escapeLatex(lang === "sk" ? "Vyhlásenie o AI asistencii" : lang === "cs" ? "Prohlášení o AI asistenci" : lang === "de" ? "Erklärung zur KI-Unterstützung" : lang === "pl" ? "Oświadczenie o wykorzystaniu AI" : lang === "hu" ? "Nyilatkozat az AI használatáról" : "AI Assistance Disclosure")}}\n${escapeProse(disclosure)}`
}

export interface ThesisReviewGeneratorInput {
  reviewKind?: ReviewKind
  studentName: string
  thesisTitle: string
  thesisType: "bachelor" | "master" | "phd"
  reviewerRole: "supervisor" | "opponent" | "self" | "reviewer" | string
  reviewerName?: string | null
  institution?: string | null
  /** Faculty / school line, printed under the institution where the style has a letterhead. */
  faculty?: string | null
  department?: string | null
  studyProgramme?: string | null
  academicYear?: string | null
  place?: string | null
  date?: string | null
  logoUrl?: string | null
  grade?: string | null
  scorePercent?: number | null
  recommendation?: string | null
  sections: ThesisSection[]
  /** Criteria already resolved from workspace cards (see thesis-review-meta). */
  criteria?: GeneratedCriterion[]
  findings?: ReviewFinding[]
  summary?: string | null
  strengths?: string[]
  defenseQuestions: string[]
  citationIssues: string[]
  /** Report language. Wider than ReviewLanguage: de/pl/hu are render-only. */
  language: ReportLanguage
  template: ThesisReviewTemplate
  /** Optional statutory enrichment (e.g. the § 67 clause) rendered as its own block. */
  phdEnrichment?: { statutoryClause?: string } | null
  confidentialComments?: string | null
  includeConfidential?: boolean
}

/**
 * Generate a complete LaTeX document for a thesis review.
 */
export function generateThesisReviewLatex(input: ThesisReviewGeneratorInput): string {
  const lang = input.language
  const reviewKind: "thesis" | "paper" = input.reviewKind === "paper" ? "paper" : "thesis"
  const style = thesisReviewStyleFor(input.template)
  const labels = labelsForReviewKind(THESIS_REVIEW_LABELS[lang], lang, reviewKind)
  const preamble = getThesisReviewPreamble(input.template, labels.title)
  const isThesis = reviewKind !== "paper"

  const letterhead = buildLetterhead(labels, input)
  const identification = buildIdentificationBlock(labels, style, {
    studentName: input.studentName,
    thesisTitle: input.thesisTitle,
    thesisType: input.thesisType,
    studyProgramme: input.studyProgramme,
    reviewerRole: input.reviewerRole,
    reviewerName: input.reviewerName,
    institution: input.institution,
    faculty: input.faculty,
    department: input.department,
    academicYear: input.academicYear,
  }, reviewKind)

  // Criteria may arrive pre-resolved (workspace cards) or as rubric sections.
  const criteria: GeneratedCriterion[] = input.criteria && input.criteria.length > 0
    ? input.criteria
    : criteriaFromSections(input.sections, lang)

  const overview = isThesis ? buildCriteriaOverview(labels, style, criteria, lang) : ""
  const criteriaBlock = buildCriteriaTable(labels, criteria, lang, isThesis)

  // Numbered evaluation blocks (summary, strengths, concerns, statutory
  // clause), then the weighted overview, then the per-criterion assessment.
  // Numbers are assigned here so they stay sequential whatever subset of
  // blocks is present, and the overview heading is only numbered when it
  // actually renders.
  const blocks = buildEvaluationBlocks(input, reviewKind)
  let blockIndex = 0
  const headingFor = (title: string) => (isThesis ? `\\subsection*{${escapeLatex(`${++blockIndex}. ${title}`)}}` : `\\subsection*{${escapeLatex(title)}}`)

  const bodyParts: string[] = blocks.map((b) => `\\Needspace{6\\baselineskip}
${headingFor(b.heading)}
${b.body}`)

  if (overview) {
    bodyParts.push(`\\Needspace{8\\baselineskip}
${headingFor(labels.criteriaOverviewLabel)}
${overview}`)
  }

  if (criteriaBlock) {
    bodyParts.push(`\\Needspace{6\\baselineskip}
${headingFor(labels.gradingLabel)}
${criteriaBlock}`)
  }

  // Defense questions — may be in sections or top-level
  const defenseSection = input.sections.find((s) => s.criterionId === "defense_questions")
  const allDefenseQuestions = [
    ...(defenseSection?.text ? [defenseSection.text] : []),
    ...input.defenseQuestions,
  ].filter(Boolean)

  const defenseBlock = buildDefenseQuestions(labels, allDefenseQuestions)
  const citationBlock = buildCitationNotes(labels, input.citationIssues)
  const confidentialBlock =
    input.includeConfidential && input.confidentialComments?.trim()
      ? buildConfidentialNotes(labels, input.confidentialComments)
      : ""

  const weightedEcts = computeEctsBand(input.scorePercent ?? null)
  const scorePercent = input.scorePercent ?? computeOverallScore(input.sections)
  const gradePanel = buildGradePanel(labels, style, {
    grade: input.grade,
    scorePercent: typeof scorePercent === "number" ? scorePercent : null,
    ects: weightedEcts,
    recommendation: input.recommendation,
    includeGrade: isThesis,
    place: input.place,
    date: input.date,
  })
  const aiDisclosureBlock = buildAiDisclosure(lang)

  return `${preamble}

\\begin{document}

${letterhead ? `${letterhead}\n\n\\vspace{0.4cm}\n\n` : ""}\\posudoktitle{${escapeLatex(labels.title)}}

\\vspace{0.5cm}

${identification}

\\vspace{0.6cm}

${bodyParts.join("\n\n\\vspace{0.4cm}\n\n")}

${defenseBlock}

${citationBlock}

${confidentialBlock}

${gradePanel}

${aiDisclosureBlock}

\\end{document}
`
}

function resolveSectionName(section: ThesisSection | null, lang: ReportLanguage): string {
  if (!section) return ""
  const id = (section.criterionId || section.sectionId || section.id || "").trim()
  if (!id) return ""
  const rubricLang: ReviewLanguage = lang === "sk" || lang === "cs" || lang === "en" ? lang : "en"
  const v1 = SK_ACADEMIC_RUBRIC_V1.criteria.find((c) => c.id === id)
  if (v1) return v1.labels[rubricLang] ?? v1.labels.en ?? id
  const legacy = THESIS_CRITERIA.find((c) => c.id === id)
  if (legacy) return legacy.labels[rubricLang] ?? legacy.labels.en ?? id
  return id
}

/** ECTS band label for a weighted score, per the rubric engine's own bands. */
export function computeEctsBand(score: number | null): string | null {
  if (score === null || !Number.isFinite(score)) return null
  if (score >= 90) return "A"
  if (score >= 80) return "B"
  if (score >= 70) return "C"
  if (score >= 60) return "D"
  if (score >= 50) return "E"
  return "F"
}

// ---------------------------------------------------------------------------
// Workspace generator (cards → posudok)
// ---------------------------------------------------------------------------

export class ThesisReviewLatexGenerator implements LatexGenerator {
  readonly outputType = "thesis-review" as const
  readonly templateId: string

  constructor(templateId: string) {
    this.templateId = templateId
  }

  generateDocument(project: Project, outputConfig: OutputConfig, workspaceId = ""): string {
    if (workspaceId) setThesisReviewWorkspaceId(workspaceId)
    const known: ThesisReviewTemplate[] = ["posudok-sk", "posudok-cs", "posudok-en", "posudok-de", "posudok-pl", "posudok-hu"]
    const template: ThesisReviewTemplate = known.includes(this.templateId as ThesisReviewTemplate)
      ? (this.templateId as ThesisReviewTemplate)
      : "posudok-sk"
    const lang = reportLanguageFor(template)

    // Derive every printed fact from the output's explicit review metadata and
    // the cards, in that order — see lib/latex/thesis-review-meta.ts.
    const derived = deriveThesisReview(project, outputConfig, lang as ReportLanguageCode)

    // Cards that hold narrative blocks (identification, defence questions,
    // citations, conclusion…) are not criteria and must not be rendered as such.
    const criteria: GeneratedCriterion[] = derived.criteria.map((c) => ({
      criterionId: c.criterionId,
      name: c.name,
      text: c.text,
      rating: normalizeRating(c.rating),
      weight: c.weight,
      points: c.points,
      suggestions: c.suggestions,
      figures: c.figures,
    }))

    return generateThesisReviewLatex({
      reviewKind: derived.reviewKind,
      studentName: derived.studentName || "Student",
      thesisTitle: derived.thesisTitle || outputConfig.title || project.name || "",
      thesisType: derived.thesisType,
      reviewerRole: derived.reviewerRole,
      reviewerName: derived.reviewerName || undefined,
      institution: derived.institution || undefined,
      faculty: derived.faculty || undefined,
      department: derived.department || undefined,
      studyProgramme: derived.studyProgramme || undefined,
      academicYear: derived.academicYear || undefined,
      place: derived.place || undefined,
      date: derived.date || undefined,
      logoUrl: outputConfig.logoUrl ?? project.logoUrl ?? null,
      grade: derived.grade || null,
      scorePercent: derived.scorePercent,
      recommendation: derived.recommendation || null,
      sections: [],
      criteria,
      summary: derived.summary || null,
      strengths: derived.strengths,
      defenseQuestions: derived.defenseQuestions,
      citationIssues: derived.citationIssues,
      language: lang,
      template,
      confidentialComments: derived.confidentialComments || null,
      includeConfidential: derived.includeConfidential,
    })
  }
}

