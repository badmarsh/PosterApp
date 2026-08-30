/**
 * LaTeX generator for thesis assessment reports (posudok diplomovej práce).
 *
 * Generates a complete, compilable LaTeX document from a ThesisReview record.
 * Templates: posudok-sk (Slovak), posudok-cs (Czech), posudok-en (English)
 */

import {
  getThesisReviewPreamble,
  THESIS_REVIEW_LABELS,
  type ThesisReviewTemplate,
  type ThesisReviewLabels,
} from "./templates-thesis"
import { THESIS_CRITERIA, type ThesisSection, type ReviewLanguage } from "@/lib/ai/thesis-rubric"

// ---------------------------------------------------------------------------
// LaTeX escaping (Single-pass replacement)
// ---------------------------------------------------------------------------

export function escapeLatex(text: string): string {
  if (!text) return ""
  return text.replace(/[\\&%$#_{}~^<>]/g, (match) => {
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
    reviewerRole: "supervisor" | "opponent"
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
  rows.push(`  \\textbf{${escapeLatex(labels.roleLabel)}:} & ${escapeLatex(labels.roles[meta.reviewerRole] ?? meta.reviewerRole)} \\\\`)

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

function buildCriteriaTable(
  labels: ThesisReviewLabels,
  sections: ThesisSection[],
  lang: ReviewLanguage
): string {
  const rows: string[] = []

  for (const section of sections) {
    const criterion = THESIS_CRITERIA.find((c) => c.id === section.criterionId)
    if (!criterion || criterion.weight === 0 || criterion.category === "defense") continue

    const criterionName = criterion.labels[lang] ?? section.criterionId
    const rating = section.rating && section.rating !== "pending" ? section.rating : "---"
    const text = nl2par(section.text || "")

    rows.push(`\\Needspace{6\\baselineskip}
\\subsection*{${escapeLatex(criterionName)} \\hfill \\ratingsymbol{${escapeLatex(rating)}}}
${escapeLatex(text)}`)

    if (section.suggestions && section.suggestions.length > 0) {
      rows.push(`\\begin{itemize}[leftmargin=*,noitemsep,topsep=2pt]\\small
${section.suggestions.map((s) => `  \\item ${escapeLatex(s)}`).join("\n")}
\\end{itemize}`)
    }
  }

  return rows.join("\n\n")
}

function buildDefenseQuestions(labels: ThesisReviewLabels, questions: string[]): string {
  if (!questions.length) return ""
  return `\\Needspace{8\\baselineskip}
\\section{${escapeLatex(labels.defenseLabel)}}
\\begin{enumerate}[leftmargin=*]
${questions.map((q) => `  \\item ${escapeLatex(q)}`).join("\n")}
\\end{enumerate}`
}

function buildCitationNotes(labels: ThesisReviewLabels, issues: string[]): string {
  if (!issues.length) return ""
  return `\\Needspace{6\\baselineskip}
\\section{${escapeLatex(labels.citationLabel)}}
\\begin{itemize}[leftmargin=*]
${issues.map((i) => `  \\item ${escapeLatex(i)}`).join("\n")}
\\end{itemize}`
}

function buildSummaryBlock(
  labels: ThesisReviewLabels,
  grade: string | null | undefined,
  recommendation: string | null | undefined
): string {
  const gradeBox = grade ? `\\ratingsymbol{${escapeLatex(grade)}}` : "\\underline{\\hspace{3cm}}"
  const recText = recommendation ? escapeLatex(recommendation) : ""

  return `\\Needspace{10\\baselineskip}
\\section{${escapeLatex(labels.summaryLabel)}}

\\thesisfield{${escapeLatex(labels.gradeLabel)}}{${gradeBox}}

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

export interface ThesisReviewGeneratorInput {
  studentName: string
  thesisTitle: string
  thesisType: "bachelor" | "master" | "phd"
  reviewerRole: "supervisor" | "opponent"
  reviewerName?: string | null
  institution?: string | null
  department?: string | null
  academicYear?: string | null
  grade?: string | null
  recommendation?: string | null
  sections: ThesisSection[]
  defenseQuestions: string[]
  citationIssues: string[]
  language: ReviewLanguage
  template: ThesisReviewTemplate
}

/**
 * Generate a complete LaTeX document for a thesis review.
 */
export function generateThesisReviewLatex(input: ThesisReviewGeneratorInput): string {
  const lang = input.language
  const labels = THESIS_REVIEW_LABELS[lang]
  const preamble = getThesisReviewPreamble(input.template)

  const metaBlock = buildMetadataBlock(labels, input)
  const criteriaBlock = buildCriteriaTable(labels, input.sections, lang)

  // Defense questions — may be in sections or top-level
  const defenseSection = input.sections.find((s) => s.criterionId === "defense_questions")
  const allDefenseQuestions = [
    ...(defenseSection?.text ? [defenseSection.text] : []),
    ...input.defenseQuestions,
  ].filter(Boolean)

  const defenseBlock = buildDefenseQuestions(labels, allDefenseQuestions)
  const citationBlock = buildCitationNotes(labels, input.citationIssues)
  const summaryBlock = buildSummaryBlock(labels, input.grade, input.recommendation)

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

${criteriaBlock}

${defenseBlock}

${citationBlock}

${summaryBlock}

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
    const template = (this.templateId === "posudok-en" ? "posudok-en" : this.templateId === "posudok-cs" ? "posudok-cs" : "posudok-sk") as ThesisReviewTemplate
    const lang: ReviewLanguage = this.templateId === "posudok-en" ? "en" : this.templateId === "posudok-cs" ? "cs" : "sk"

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

