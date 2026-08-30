/**
 * LaTeX templates for thesis review (posudok diplomovej práce).
 *
 * Supports:
 *  - posudok-sk: Slovak template (STU/UK/TUKE style)
 *  - posudok-en: English template
 *  - posudok-cs: Czech template
 */

export type ThesisReviewTemplate = "posudok-sk" | "posudok-en" | "posudok-cs"

export function getThesisReviewPreamble(template: ThesisReviewTemplate): string {
  const lang = template === "posudok-en" ? "en" : template === "posudok-cs" ? "cs" : "sk"
  const labels = THESIS_REVIEW_LABELS[lang]

  const babel: Record<string, string> = {
    sk: "\\usepackage[slovak]{babel}",
    cs: "\\usepackage[czech]{babel}",
    en: "\\usepackage[english]{babel}",
  }

  return `\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
${babel[lang]}
\\usepackage[top=2.5cm,bottom=2.5cm,left=3cm,right=2cm]{geometry}
\\usepackage{setspace}
\\usepackage{booktabs}
\\usepackage{array}
\\usepackage{tabularx}
\\usepackage{microtype}
\\usepackage{parskip}
\\usepackage{titlesec}
\\usepackage{fancyhdr}
\\usepackage{lastpage}
\\usepackage{needspace}
\\usepackage{enumitem}
\\usepackage{hyperref}

\\hypersetup{
  colorlinks=false,
  pdfborder={0 0 0}
}

\\onehalfspacing

\\titleformat{\\section}[block]{\\large\\bfseries}{}{0em}{}[\\titlerule]
\\titlespacing*{\\section}{0pt}{1.5ex plus .5ex minus .25ex}{0.8ex}

\\pagestyle{fancy}
\\fancyhf{}
\\rhead{\\small\\thepage\\ / \\pageref{LastPage}}
\\lhead{\\small ${labels.title}}
\\renewcommand{\\headrulewidth}{0.4pt}

%% Custom commands
\\newcommand{\\thesisfield}[2]{%
  \\noindent\\textbf{#1:} #2\\par\\smallskip
}
\\newcommand{\\ratingsymbol}[1]{%
  \\fbox{\\textbf{#1}}
}`
}

export interface ThesisReviewLabels {
  title: string
  studentLabel: string
  thesisTitleLabel: string
  thesisTypeLabel: string
  reviewerLabel: string
  roleLabel: string
  institutionLabel: string
  departmentLabel: string
  gradingLabel: string
  criterionLabel: string
  ratingLabel: string
  commentLabel: string
  defenseLabel: string
  citationLabel: string
  summaryLabel: string
  gradeLabel: string
  recommendationLabel: string
  signatureLabel: string
  dateLabel: string
  thesisTypes: { bachelor: string; master: string; phd: string }
  roles: { supervisor: string; opponent: string }
}

export const THESIS_REVIEW_LABELS: Record<
  "sk" | "cs" | "en",
  ThesisReviewLabels
> = {
  sk: {
    title: "POSUDOK ZÁVEREČNEJ PRÁCE",
    studentLabel: "Autor/Autorka práce",
    thesisTitleLabel: "Názov záverečnej práce",
    thesisTypeLabel: "Typ práce",
    reviewerLabel: "Vypracoval/a",
    roleLabel: "Rola",
    institutionLabel: "Inštitúcia",
    departmentLabel: "Katedra/Ústav",
    gradingLabel: "HODNOTENIE KRITÉRIÍ",
    criterionLabel: "Kritérium",
    ratingLabel: "Hodnotenie",
    commentLabel: "Komentár",
    defenseLabel: "OTÁZKY K OBHAJOBE",
    citationLabel: "POZNÁMKY K CITÁCIÁM",
    summaryLabel: "CELKOVÉ HODNOTENIE",
    gradeLabel: "Navrhovaná klasifikácia",
    recommendationLabel: "Odporúčanie",
    signatureLabel: "Podpis hodnotiteľa/ky",
    dateLabel: "Dátum",
    thesisTypes: { bachelor: "Bakalárska práca", master: "Diplomová práca", phd: "Dizertačná práca" },
    roles: { supervisor: "Vedúci/a práce", opponent: "Oponent/ka" },
  },
  cs: {
    title: "POSUDEK ZÁVĚREČNÉ PRÁCE",
    studentLabel: "Autor/Autorka práce",
    thesisTitleLabel: "Název závěrečné práce",
    thesisTypeLabel: "Typ práce",
    reviewerLabel: "Vypracoval/a",
    roleLabel: "Role",
    institutionLabel: "Instituce",
    departmentLabel: "Katedra/Ústav",
    gradingLabel: "HODNOCENÍ KRITÉRIÍ",
    criterionLabel: "Kritérium",
    ratingLabel: "Hodnocení",
    commentLabel: "Komentář",
    defenseLabel: "OTÁZKY K OBHAJOBĚ",
    citationLabel: "POZNÁMKY K CITACÍM",
    summaryLabel: "CELKOVÉ HODNOCENÍ",
    gradeLabel: "Navrhovaná klasifikace",
    recommendationLabel: "Doporučení",
    signatureLabel: "Podpis hodnotitele/ky",
    dateLabel: "Datum",
    thesisTypes: { bachelor: "Bakalářská práce", master: "Diplomová práce", phd: "Dizertační práce" },
    roles: { supervisor: "Vedoucí práce", opponent: "Oponent/ka" },
  },
  en: {
    title: "THESIS ASSESSMENT REPORT",
    studentLabel: "Student",
    thesisTitleLabel: "Thesis title",
    thesisTypeLabel: "Thesis type",
    reviewerLabel: "Reviewer",
    roleLabel: "Role",
    institutionLabel: "Institution",
    departmentLabel: "Department",
    gradingLabel: "CRITERIA EVALUATION",
    criterionLabel: "Criterion",
    ratingLabel: "Rating",
    commentLabel: "Comments",
    defenseLabel: "DEFENSE QUESTIONS",
    citationLabel: "CITATION NOTES",
    summaryLabel: "OVERALL ASSESSMENT",
    gradeLabel: "Proposed grade",
    recommendationLabel: "Recommendation",
    signatureLabel: "Reviewer's signature",
    dateLabel: "Date",
    thesisTypes: { bachelor: "Bachelor's thesis", master: "Master's thesis", phd: "PhD dissertation" },
    roles: { supervisor: "Supervisor", opponent: "Opponent" },
  },
}
