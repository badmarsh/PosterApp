/**
 * LaTeX generator for thesis assessment reports (posudok diplomovej práce).
 *
 * Generates a complete, compilable LaTeX document from a ThesisReview record.
 * Templates: posudok-sk (Slovak), posudok-cs (Czech), posudok-en (English)
 */

import {
  getThesisReviewPreamble,
  reportLanguageFor,
  THESIS_REVIEW_LABELS,
  type ReportLanguage,
  type ThesisReviewTemplate,
  type ThesisReviewLabels,
} from "./templates-thesis"
import { THESIS_CRITERIA, type ThesisSection, type ReviewLanguage } from "@/lib/ai/thesis-rubric"
import type { ReviewKind, ReviewFinding } from "@/lib/ai/review-types"
import { getEligibleFindings } from "@/lib/ai/review-composer"
import { mapUnicodeToLatex, parseMarkdownToLatex } from "./parser"

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
// Section generators
// ---------------------------------------------------------------------------

function buildMetadataBlock(
  labels: ThesisReviewLabels,
  meta: {
    studentName: string
    thesisTitle: string
    thesisType: "bachelor" | "master" | "phd"
    reviewerRole: "supervisor" | "opponent" | "self" | "reviewer" | string
    reviewerName?: string | null
    institution?: string | null
    department?: string | null
    academicYear?: string | null
  }
): string {
  const rows: string[] = [
    `  \\textbf{${escapeLatex(labels.studentLabel)}:} & ${escapeLatex(meta.studentName)} \\\\`,
    `  \\textbf{${escapeLatex(labels.thesisTitleLabel)}:} & ${escapeLatex(meta.thesisTitle)} \\\\`,
    `  \\textbf{${escapeLatex(labels.thesisTypeLabel)}:} & ${escapeLatex(labels.thesisTypes[meta.thesisType] ?? meta.thesisType)} \\\\`,
  ]

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
    rows.push(`  \\textbf{${escapeLatex(labels.dateLabel)} / Rok:} & ${escapeLatex(meta.academicYear)} \\\\`)
  }

  return `\\noindent
\\begin{tabularx}{\\textwidth}{@{}l X@{}}
${rows.join("\n")}
\\end{tabularx}`
}

/**
 * Criterion display name for a report language.
 *
 * THESIS_CRITERIA is part of the AI rubric and is only translated into
 * sk/cs/en. For a report rendered in de/pl/hu the criterion names fall back
 * to English rather than printing a raw id like "methodology_rigor".
 */
function resolveCriterionLabel(
  criterion: (typeof THESIS_CRITERIA)[number],
  lang: ReportLanguage,
  fallbackId: string
): string {
  const rubricLang: ReviewLanguage = lang === "sk" || lang === "cs" || lang === "en" ? lang : "en"
  return criterion.labels[rubricLang] ?? criterion.labels.en ?? fallbackId
}

function buildCriteriaTable(
  labels: ThesisReviewLabels,
  sections: ThesisSection[],
  lang: ReportLanguage,
  includeRatings: boolean
): string {
  const rows: string[] = []

  for (const section of sections) {
    const criterion = THESIS_CRITERIA.find((c) => c.id === section.criterionId)
    if (!criterion || criterion.weight === 0 || criterion.category === "defense") continue

    const criterionName = resolveCriterionLabel(criterion, lang, section.criterionId)
    const rating = section.rating && section.rating !== "pending" ? section.rating : "---"
    const text = nl2par(section.text || "")

    const ratingSuffix = includeRatings ? ` \\hfill \\ratingsymbol{${escapeLatex(rating)}}` : ""
    rows.push(`\\Needspace{6\\baselineskip}
\\subsection*{${escapeLatex(criterionName)}${ratingSuffix}}
${escapeProse(text)}`)

    if (section.suggestions && section.suggestions.length > 0) {
      rows.push(`\\begin{itemize}[leftmargin=*,noitemsep,topsep=2pt]\\small
${section.suggestions.map((s) => `  \\item ${escapeProse(s)}`).join("\n")}
\\end{itemize}`)
    }
  }

  return rows.join("\n\n")
}

function buildSummaryAndStrengths(
  summary: string | null | undefined,
  strengths: string[] | undefined,
  lang: ReportLanguage,
  reviewKind: ReviewKind
): string {
  const parts: string[] = []
  const isPaper = reviewKind === "paper"

  if (summary && summary.trim()) {
    const title = lang === "sk"
      ? (isPaper ? "1. Zhrnutie rukopisu (Manuscript Summary)" : "1. Zhrnutie práce a hlavný prínos (Executive Summary)")
      : lang === "cs"
        ? (isPaper ? "1. Shrnutí rukopisu (Manuscript Summary)" : "1. Shrnutí práce a hlavní přínos (Executive Summary)")
        : (isPaper ? "1. Manuscript Summary" : "1. Executive Summary")

    parts.push(`\\Needspace{6\\baselineskip}
\\subsection*{${escapeLatex(title)}}
${escapeProse(nl2par(summary))}`)
  }

  if (strengths && strengths.length > 0) {
    const title = lang === "sk"
      ? (isPaper ? "2. Podložené silné stránky rukopisu (Evidence-Grounded Strengths)" : "2. Silné stránky práce (Key Strengths)")
      : lang === "cs"
        ? (isPaper ? "2. Podložené silné stránky rukopisu (Evidence-Grounded Strengths)" : "2. Silné stránky práce (Key Strengths)")
        : (isPaper ? "2. Evidence-Grounded Strengths" : "2. Key Strengths")

    parts.push(`\\Needspace{6\\baselineskip}
\\subsection*{${escapeLatex(title)}}
\\begin{itemize}[leftmargin=*,itemsep=2pt]
${strengths.map((s) => `  \\item ${escapeProse(s)}`).join("\n")}
\\end{itemize}`)
  }

  return parts.join("\n\n")
}

function buildFindingsBlock(
  labels: ThesisReviewLabels,
  findings: ReviewFinding[],
  lang: ReportLanguage,
  audience: "author" | "editor" = "author"
): string {
  const eligible = getEligibleFindings(findings, audience)
  if (eligible.length === 0) return ""

  const major = eligible.filter((f) => f.severity === "critical" || f.severity === "major")
  const minor = eligible.filter((f) => f.severity === "minor" || f.severity === "suggestion")

  const parts: string[] = []

  const majorTitle = lang === "sk" ? "3. Zásadné pripomienky (Major Concerns)" : lang === "cs" ? "3. Zásadní připomínky (Major Concerns)" : "3. Major Concerns"
  const minorTitle = lang === "sk" ? "4. Drobné pripomienky (Minor Concerns)" : lang === "cs" ? "4. Drobné připomínky (Minor Concerns)" : "4. Minor Concerns"
  const recPrefix = lang === "sk" ? "Odporúčaná náprava:" : lang === "cs" ? "Doporučená náprava:" : "Recommended fix:"
  const evidencePrefix = lang === "sk" ? "Dôkaz v texte:" : lang === "cs" ? "Důkaz v textu:" : "Evidence in text:"

  if (major.length > 0) {
    parts.push(`\\Needspace{8\\baselineskip}
\\subsection*{${escapeLatex(majorTitle)}}`)
    for (const f of major) {
      const cat = (f.category || "general").toUpperCase()
      const title = `[${cat}] ${f.title}`
      const expl = nl2par(f.explanation || "")
      const rec = f.recommendation ? `\\par\\noindent\\textit{\\textbf{${escapeLatex(recPrefix)}} ${escapeProse(f.recommendation)}}` : ""
      const ev = f.evidence?.[0]?.quote ? `\\par\\noindent{\\small\\color{gray}\\textit{${escapeLatex(evidencePrefix)} \`\`${escapeProse(f.evidence[0].quote)}''}}` : ""

      parts.push(`\\Needspace{5\\baselineskip}
\\subsubsection*{${escapeLatex(title)}}
${escapeProse(expl)}${rec}${ev}`)
    }
  }

  if (minor.length > 0) {
    parts.push(`\\Needspace{8\\baselineskip}
\\subsection*{${escapeLatex(minorTitle)}}
\\begin{itemize}[leftmargin=*,itemsep=4pt]
${minor.map((f) => {
  const cat = (f.category || "general").toUpperCase()
  return `  \\item \\textbf{[${escapeLatex(cat)}]} \\textbf{${escapeLatex(f.title)}}: ${escapeProse(f.explanation || "")}`
}).join("\n")}
\\end{itemize}`)
  }

  return parts.join("\n\n")
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

function buildSummaryBlock(
  labels: ThesisReviewLabels,
  grade: string | null | undefined,
  recommendation: string | null | undefined,
  includeGrade: boolean
): string {
  const gradeBox = grade ? `\\ratingsymbol{${escapeLatex(grade)}}` : "\\underline{\\hspace{3cm}}"
  const recText = recommendation ? escapeProse(recommendation) : ""
  const gradeField = includeGrade ? `\\thesisfield{${escapeLatex(labels.gradeLabel)}}{${gradeBox}}` : ""

  return `\\Needspace{10\\baselineskip}
\\section{${escapeLatex(labels.summaryLabel)}}

${gradeField}

\\thesisfield{${escapeLatex(labels.recommendationLabel)}}{${recText}}

\\vspace{2.5cm}

\\noindent
\\begin{tabular}{p{8cm}p{5cm}}
  ${escapeLatex(labels.signatureLabel)}: & ${escapeLatex(labels.dateLabel)}: \\\\[1.8cm]
  \\hrulefill & \\hrulefill \\\\
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
    title: sk ? "ODBORNÁ RECENZIA VEDECKÉHO ČLÁNKU" : cs ? "ODBORNÁ RECENZE VĚDECKÉHO ČLÁNKU" : "SCIENTIFIC PAPER PEER REVIEW",
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
    thesisTypes: { bachelor: scientificPaper, master: scientificPaper, phd: scientificPaper },
    roles: { ...labels.roles, supervisor: "Reviewer", opponent: "Reviewer", self: "Author triage", reviewer: "Reviewer" },
  }
}

function buildAiDisclosure(lang: ReportLanguage): string {
  const disclosure = lang === "sk"
    ? "Koncept recenzie bol pripravený s podporou evidenciou podloženého AI asistenta PosterApp. Konečné odborné posúdenie a rozhodnutie vykonal ľudský recenzent."
    : lang === "cs"
      ? "Návrh recenze byl připraven s podporou AI asistenta PosterApp založeného na důkazech. Konečné odborné posouzení a rozhodnutí provedl lidský recenzent."
      : "This review draft was prepared with PosterApp's evidence-grounded AI assistant. Final scholarly judgment and the decision remain with the human reviewer."
  return `\\Needspace{5\\baselineskip}\n\\section*{${escapeLatex(lang === "sk" ? "Vyhlásenie o AI asistencii" : lang === "cs" ? "Prohlášení o AI asistenci" : "AI Assistance Disclosure")}}\n${escapeProse(disclosure)}`
}

export interface ThesisReviewGeneratorInput {
  reviewKind?: ReviewKind
  studentName: string
  thesisTitle: string
  thesisType: "bachelor" | "master" | "phd"
  reviewerRole: "supervisor" | "opponent" | "self" | "reviewer" | string
  reviewerName?: string | null
  institution?: string | null
  department?: string | null
  academicYear?: string | null
  grade?: string | null
  recommendation?: string | null
  sections: ThesisSection[]
  findings?: ReviewFinding[]
  summary?: string | null
  strengths?: string[]
  defenseQuestions: string[]
  citationIssues: string[]
  /** Report language. Wider than ReviewLanguage: de/pl/hu are render-only. */
  language: ReportLanguage
  template: ThesisReviewTemplate
  confidentialComments?: string | null
  includeConfidential?: boolean
}

/**
 * Generate a complete LaTeX document for a thesis review.
 */
export function generateThesisReviewLatex(input: ThesisReviewGeneratorInput): string {
  const lang = input.language
  const reviewKind = input.reviewKind ?? "thesis"
  const labels = labelsForReviewKind(THESIS_REVIEW_LABELS[lang], lang, reviewKind)
  const preamble = getThesisReviewPreamble(input.template, labels.title)

  const metaBlock = buildMetadataBlock(labels, input)
  const summaryAndStrengthsBlock = buildSummaryAndStrengths(input.summary, input.strengths, lang, reviewKind)
  const findingsBlock = input.findings && input.findings.length > 0
    ? buildFindingsBlock(labels, input.findings, lang, input.includeConfidential ? "editor" : "author")
    : ""
  const criteriaBlock = buildCriteriaTable(labels, input.sections, lang, reviewKind === "thesis")

  const evaluationContent = [summaryAndStrengthsBlock, findingsBlock, criteriaBlock].filter(Boolean).join("\n\n\\vspace{0.4cm}\n\n")

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
  const summaryBlock = buildSummaryBlock(labels, input.grade, input.recommendation, reviewKind === "thesis")
  const aiDisclosureBlock = buildAiDisclosure(lang)

  return `${preamble}

\\begin{document}

\\begin{center}
  {\\LARGE\\bfseries ${escapeLatex(labels.title)}}
\\end{center}

\\vspace{0.5cm}
\\hrule
\\vspace{0.5cm}

${metaBlock}

\\vspace{0.5cm}
\\hrule
\\vspace{0.5cm}

\\section{${escapeLatex(labels.gradingLabel)}}

${evaluationContent}


${defenseBlock}

${citationBlock}

${confidentialBlock}

${summaryBlock}

${aiDisclosureBlock}

\\end{document}
`
}

import type { LatexGenerator } from "./types"
import type { Project, OutputConfig } from "@/lib/poster-types"

export class ThesisReviewLatexGenerator implements LatexGenerator {
  readonly outputType = "thesis-review" as const
  readonly templateId: string

  constructor(templateId: string) {
    this.templateId = templateId
  }

  generateDocument(project: Project, outputConfig: OutputConfig, _workspaceId = ""): string {
    const known: ThesisReviewTemplate[] = ["posudok-sk", "posudok-cs", "posudok-en", "posudok-de", "posudok-pl", "posudok-hu"]
    const template: ThesisReviewTemplate = known.includes(this.templateId as ThesisReviewTemplate)
      ? (this.templateId as ThesisReviewTemplate)
      : "posudok-sk"
    const lang = reportLanguageFor(template)

    const sections: ThesisSection[] = outputConfig.cards.map((c) => ({
      id: c.id,
      sectionId: c.id,
      criterionId: c.id,
      text: c.content || "",
      rating: "pending",
      suggestions: [],
    }))

    return generateThesisReviewLatex({
      studentName: outputConfig.authors || project.authors || "Student",
      thesisTitle: outputConfig.title || project.name || "Diplomová práca",
      thesisType: "master",
      reviewerRole: "opponent",
      reviewerName: project.venue || undefined,
      grade: null,
      recommendation: null,
      sections,
      defenseQuestions: [],
      citationIssues: [],
      language: lang,
      template,
    })
  }
}

