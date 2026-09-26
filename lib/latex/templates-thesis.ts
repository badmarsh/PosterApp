/**
 * LaTeX templates for thesis review (posudok).
 *
 * Supported templates — one *design* each, not one design in six languages:
 *  - posudok-sk: official Slovak form (STU/UK), letterhead + boxed grade
 *  - posudok-cs: Czech posudek (ČVUT/MUNI), shaded identification table
 *  - posudok-en: English assessment report, minimal chrome
 *  - posudok-de: German Gutachten, accent bar + weighting table + note panel
 *  - posudok-pl: Polish recenzja, two-column header + circled grade
 *  - posudok-hu: Hungarian bírálat, coloured bands
 *
 * The design decisions live in `./thesis-review-styles`; this module turns them
 * into a preamble whose *macros* carry the layout (`\posudokletterhead`,
 * `\posudokheading`, `\posudokgrade`, …). The generator therefore stays
 * style-agnostic: it calls the same macro names for every template and the
 * six documents come out structurally different.
 */

import { FITMATH_MACRO } from "./templates"
import { escapeLatex } from "./parser"
import { THESIS_REVIEW_STYLES, thesisReviewStyleFor } from "./thesis-review-styles"

export type ThesisReviewTemplate =
  | "posudok-sk"
  | "posudok-en"
  | "posudok-cs"
  | "posudok-de"
  | "posudok-pl"
  | "posudok-hu"

/**
 * Languages the *report* can be typeset in.
 *
 * Deliberately wider than `ReviewLanguage` from lib/ai/thesis-rubric: the AI
 * review pipeline (rubrics, prompts, evidence checks) only reasons in sk/cs/en,
 * but a finished report can be rendered for a German, Polish or Hungarian
 * faculty. Criterion names fall back to English for those, since the rubric
 * itself is not translated — see resolveCriterionLabel in the generator.
 *
 * This also makes the de/pl/hu entries in BABEL_BY_LANG (lib/latex/generator.ts)
 * reachable; they were previously dead code (audit finding B-01).
 */
export type ReportLanguage = "sk" | "cs" | "en" | "de" | "pl" | "hu"

const TEMPLATE_TO_LANG: Record<ThesisReviewTemplate, ReportLanguage> = {
  "posudok-sk": "sk",
  "posudok-cs": "cs",
  "posudok-en": "en",
  "posudok-de": "de",
  "posudok-pl": "pl",
  "posudok-hu": "hu",
}

export function reportLanguageFor(template: ThesisReviewTemplate): ReportLanguage {
  return TEMPLATE_TO_LANG[template] ?? "sk"
}

/** Babel language name per report language. */
const BABEL_OPTION: Record<ReportLanguage, string> = {
  sk: "slovak",
  cs: "czech",
  en: "english",
  de: "ngerman",
  pl: "polish",
  hu: "magyar",
}

export function getThesisReviewPreamble(template: ThesisReviewTemplate, runningTitle?: string): string {
  const style = thesisReviewStyleFor(template)
  const lang: ReportLanguage = style.language
  const labels = THESIS_REVIEW_LABELS[lang]
  // Escape runningTitle — user-provided titles may contain %, &, $, #, _ etc.
  // Previously this was interpolated raw into \lhead, causing "Missing $ inserted"
  // or "Illegal parameter number" compile failures. Use escapeLatex for safe text.
  const rawHeader = runningTitle ?? labels.title
  const headerTitle = escapeLatex(rawHeader)
  const { top, bottom, left, right } = style.margins

  const letterheadMacro = LETTERHEAD_MACROS[style.letterhead]
  const titleMacro = TITLE_MACROS[style.titleStyle]
  const headingMacro = HEADING_MACROS[style.sectionMarker]
  const gradeMacro = GRADE_MACROS[style.gradeStyle]
  const markerMacro = MARKER_MACROS[style.sectionMarker]

  return String.raw`\documentclass[12pt,a4paper]{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage[${BABEL_OPTION[lang]}]{babel}
\usepackage[top=${top}mm,bottom=${bottom}mm,left=${left}mm,right=${right}mm]{geometry}
\usepackage{setspace}
\usepackage{booktabs}
\usepackage{array}
\usepackage{tabularx}
\usepackage[table]{xcolor}
\usepackage{microtype}
\usepackage{parskip}
\usepackage{titlesec}
\usepackage{fancyhdr}
\usepackage{lastpage}
\usepackage{needspace}
\usepackage{enumitem}
\usepackage{graphicx}
\usepackage{amsmath}
\usepackage{amssymb}
\usepackage{hyperref}

\hypersetup{
  colorlinks=false,
  pdfborder={0 0 0}
}

${FITMATH_MACRO}

% --- design tokens (per template: ${style.templateId}) -----------------------
\definecolor{accent}{HTML}{${style.accent}}
\definecolor{accentdark}{HTML}{${style.accentDark}}
\definecolor{accenttint}{HTML}{${style.accent}}
\definecolor{formgrey}{gray}{0.94}
\definecolor{rulegrey}{gray}{0.55}

\onehalfspacing

\titleformat{\section}[block]{\large\bfseries\color{accentdark}}{}{0em}{}[\vspace{-0.6ex}\textcolor{accent}{\rule{\linewidth}{0.9pt}}]
\titlespacing*{\section}{0pt}{1.6ex plus .5ex minus .25ex}{0.9ex}
\titleformat{\subsection}[block]{\normalsize\bfseries}{}{0em}{}
\titlespacing*{\subsection}{0pt}{1.2ex plus .4ex minus .2ex}{0.4ex}

\pagestyle{fancy}
\fancyhf{}
\rhead{\small\thepage\ /\ \pageref{LastPage}}
\lhead{\small ${headerTitle}}
\renewcommand{\headrulewidth}{0.4pt}

% --- shared building blocks --------------------------------------------------
\newcommand{\thesisfield}[2]{%
  \noindent\textbf{#1:} #2\par\smallskip
}
\newcommand{\ratingsymbol}[1]{%
  \fbox{\textbf{#1}}%
}
\newcommand{\posudoksubhead}[1]{%
  \Needspace{6\baselineskip}%
  \subsection*{#1}%
}
\newcommand{\posudokrule}{\textcolor{accent}{\rule{\linewidth}{1.1pt}}}
\newcommand{\posudokthinrule}{\textcolor{rulegrey}{\rule{\linewidth}{0.35pt}}}

% --- design-specific macros --------------------------------------------------
\newcommand{\posudokletterhead}[3]{%
${letterheadMacro}
}
\newcommand{\posudoktitle}[1]{%
${titleMacro}
}
\newcommand{\posudokmarker}[1]{%
${markerMacro}
}
\newcommand{\posudokheading}[3]{%
${headingMacro}
}
\newcommand{\posudokgrade}[2]{%
${gradeMacro}
}
\newcommand{\posudokpanel}[2]{%
  \noindent\begin{tabularx}{\linewidth}{@{}>{\raggedright\arraybackslash}p{3.2cm}X@{}}
  \rowcolor{formgrey}\textbf{#1} & #2 \\
  \end{tabularx}%
}
`
}

const LETTERHEAD_MACROS: Record<string, string> = {
  "stacked-rule": String.raw`  \noindent\begin{minipage}[t]{0.72\linewidth}
    \raggedright{\large\bfseries #1}\\[0.25em]
    {\small #2}
  \end{minipage}%
  \hfill
  \begin{minipage}[t]{0.26\linewidth}
    \raggedleft{\small #3}
  \end{minipage}\\[0.6em]
  \textcolor{accent}{\rule{\linewidth}{2.2pt}}\\[0.2em]
  \textcolor{accent}{\rule{\linewidth}{0.6pt}}`,
  "shaded-table": String.raw`  \noindent\begin{tabularx}{\linewidth}{@{}>{\columncolor{formgrey}\bfseries}l X@{}}
  #1 & #2 \\
  \end{tabularx}\\[0.5em]
  \noindent{\small\itshape #3}\\[0.4em]
  \textcolor{accent}{\rule{\linewidth}{1.4pt}}`,
  minimal: String.raw`  \noindent{\small\scshape #1\hfill #3}\\[0.3em]
  \textcolor{rulegrey}{\rule{\linewidth}{0.4pt}}\\[0.2em]
  \noindent{\footnotesize #2}`,
  "rule-bar": String.raw`  \noindent\textcolor{accent}{\rule{\linewidth}{3.2pt}}\\[0.5em]
  \noindent\begin{minipage}[t]{0.68\linewidth}\raggedright{\large\bfseries #1}\end{minipage}\hfill
  \begin{minipage}[t]{0.30\linewidth}\raggedleft{\small #3}\end{minipage}\\[0.15em]
  \noindent{\small #2}`,
  "two-column": String.raw`  \noindent\begin{tabularx}{\linewidth}{@{}>{\bfseries}p{0.46\linewidth}X@{}}
  #1 & \raggedleft #3 \\
  \end{tabularx}\\[0.3em]
  \noindent{\small #2}\\[0.3em]
  \textcolor{accent}{\rule{\linewidth}{1.6pt}}`,
  band: String.raw`  \noindent\colorbox{accent}{%
    \parbox{\dimexpr\linewidth-2\fboxsep}{%
      \color{white}\bfseries\small\hspace{0.4em}#1\hfill#3\hspace{0.4em}}}%
  \\[0.35em]
  \noindent{\small #2}`,
}

const TITLE_MACROS: Record<string, string> = {
  "centered-double-rule": String.raw`  \begin{center}
    {\LARGE\bfseries #1}\\[0.7em]
    \textcolor{accent}{\rule{0.62\linewidth}{1.2pt}}\\[0.18em]
    \textcolor{accent}{\rule{0.42\linewidth}{0.5pt}}
  \end{center}`,
  "left-accent": String.raw`  \noindent{\color{accent}\rule[-0.35em]{3.4pt}{2.4em}}\hspace{0.6em}%
  \begin{minipage}[b]{0.86\linewidth}\raggedright{\LARGE\bfseries #1}\end{minipage}\\[0.5em]
  \posudokthinrule`,
  "plain-left": String.raw`  \noindent{\Large\bfseries #1}\\[0.35em]
  \textcolor{accent}{\rule{\linewidth}{0.9pt}}`,
  band: String.raw`  \noindent\colorbox{accentdark}{%
    \parbox{\dimexpr\linewidth-2\fboxsep}{%
      \vspace{0.25em}\color{white}\centering{\large\bfseries #1}\vspace{0.25em}}}%
  \\[0.4em]`,
  "rule-pair": String.raw`  \noindent\textcolor{accent}{\rule{\linewidth}{1pt}}\\[0.35em]
  {\Large\bfseries #1}\\[0.35em]
  \textcolor{accent}{\rule{\linewidth}{1pt}}`,
  "centered-band": String.raw`  \begin{center}
    {\LARGE\bfseries #1}\\[0.45em]
    \textcolor{accent}{\rule{0.5\linewidth}{2.6pt}}
  \end{center}`,
}

const MARKER_MACROS: Record<string, string> = {
  rule: String.raw`  \textcolor{accent}{\rule[0.12em]{2.6pt}{1.05em}}`,
  square: String.raw`  \textcolor{accent}{\rule[0.16em]{0.52em}{0.52em}}`,
  none: String.raw`  \textcolor{accent}{\rule[0.12em]{0pt}{0pt}}%`,
  bar: String.raw`  \colorbox{accent}{\color{white}\bfseries\footnotesize\,#1\,}`,
  "number-circle": String.raw`  \textcircled{\scriptsize #1}`,
}

const HEADING_MACROS: Record<string, string> = {
  rule: String.raw`  \Needspace{6\baselineskip}%
  \subsection*{\posudokmarker{#1}\hspace{0.45em}#2\hfill\textbf{#3}}`,
  square: String.raw`  \Needspace{6\baselineskip}%
  \subsection*{\posudokmarker{#1}\hspace{0.45em}\textsc{#2}\hfill\textbf{#3}}`,
  none: String.raw`  \Needspace{6\baselineskip}%
  \subsection*{#2\hfill\textbf{#3}}`,
  bar: String.raw`  \Needspace{6\baselineskip}%
  \subsection*{\posudokmarker{#1}\hspace{0.5em}#2\hfill\textbf{#3}}`,
  band: String.raw`  \Needspace{6\baselineskip}%
  \subsection*{\colorbox{accent!12}{#2}\hfill\textbf{#3}}`,
  "number-circle": String.raw`  \Needspace{6\baselineskip}%
  \subsection*{\posudokmarker{#1}\hspace{0.5em}#2\hfill\textbf{#3}}`,
}

const GRADE_MACROS: Record<string, string> = {
  fbox: String.raw`  \noindent\textbf{#1:}\hspace{0.6em}\fbox{\Large\textbf{#2}}`,
  circled: String.raw`  \noindent\textbf{#1:}\hspace{0.6em}\fbox{\fbox{\Large\strut\textbf{#2}}}`,
  "table-cell": String.raw`  \noindent\begin{tabularx}{\linewidth}{@{}>{\columncolor{formgrey}\bfseries}p{4.6cm}X@{}}
  #1 & \Large\textbf{#2} \\
  \end{tabularx}`,
  "inline-bold": String.raw`  \noindent\textbf{#1:}\hspace{0.5em}{\Large\bfseries\color{accentdark}#2}`,
  panel: String.raw`  \noindent\colorbox{formgrey}{%
    \parbox{\dimexpr\linewidth-2\fboxsep}{%
      \vspace{0.2em}\textbf{#1:}\hspace{0.5em}{\Large\bfseries\color{accentdark}#2}\vspace{0.2em}}}%
  \\[0.3em]`,
  band: String.raw`  \noindent\colorbox{accent}{%
    \parbox{\dimexpr\linewidth-2\fboxsep}{%
      \vspace{0.3em}\color{white}\textbf{#1:}\hspace{0.6em}{\Large\bfseries #2}\vspace{0.3em}}}`,
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
  confidentialLabel: string
  gradeLabel: string
  recommendationLabel: string
  signatureLabel: string
  dateLabel: string
  academicYearLabel: string
  /** New in the 2026-09 posudok revamp — every language must define them. */
  identificationLabel: string
  criteriaOverviewLabel: string
  weightLabel: string
  pointsLabel: string
  scoreLabel: string
  ectsLabel: string
  finalGradeLabel: string
  studyProgrammeLabel: string
  facultyLabel: string
  placeLabel: string
  notRatedLabel: string
  gradingScaleLabel: string
  thesisTypes: { bachelor: string; master: string; phd: string }
  roles: { supervisor: string; opponent: string; self?: string; reviewer?: string; [key: string]: string | undefined }
}

export const THESIS_REVIEW_LABELS: Record<ReportLanguage, ThesisReviewLabels> = {
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
    confidentialLabel: "DÔVERNÉ POZNÁMKY PRE KOMISIU (NEZVEREJŇOVAŤ ŠTUDENTOVI)",
    gradeLabel: "Navrhovaná klasifikácia",
    recommendationLabel: "Odporúčanie",
    signatureLabel: "Podpis hodnotiteľa/ky",
    dateLabel: "Dátum",
    academicYearLabel: "Akademický rok",
    identificationLabel: "IDENTIFIKAČNÉ ÚDAJE PRÁCE",
    criteriaOverviewLabel: "PREHĽAD HODNOTENIA KRITÉRIÍ",
    weightLabel: "Váha",
    pointsLabel: "Body",
    scoreLabel: "Vážený výsledok",
    ectsLabel: "ECTS",
    finalGradeLabel: "Výsledná klasifikácia",
    studyProgrammeLabel: "Študijný program",
    facultyLabel: "Fakulta",
    placeLabel: "Miesto",
    notRatedLabel: "nehodnotené",
    gradingScaleLabel: "Stupnica: A – výborne · B – veľmi dobre · C – dobre · D – uspokojivo · E – dostatočne · F – nedostatočne",
    thesisTypes: { bachelor: "Bakalárska práca", master: "Diplomová práca", phd: "Dizertačná práca" },
    roles: { supervisor: "Vedúci/a práce", opponent: "Oponent/ka", self: "Predkonzultačný rozbor", reviewer: "Recenzent" },
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
    confidentialLabel: "DŮVĚRNÉ POZNÁMKY PRO KOMISI (NEZVEŘEJŇOVAT STUDENTŮM)",
    gradeLabel: "Navrhovaná klasifikace",
    recommendationLabel: "Doporučení",
    signatureLabel: "Podpis hodnotitele/ky",
    dateLabel: "Datum",
    academicYearLabel: "Akademický rok",
    identificationLabel: "IDENTIFIKAČNÍ ÚDAJE PRÁCE",
    criteriaOverviewLabel: "PŘEHLED HODNOCENÍ KRITÉRIÍ",
    weightLabel: "Váha",
    pointsLabel: "Body",
    scoreLabel: "Vážený výsledek",
    ectsLabel: "ECTS",
    finalGradeLabel: "Výsledná klasifikace",
    studyProgrammeLabel: "Studijní program",
    facultyLabel: "Fakulta",
    placeLabel: "Místo",
    notRatedLabel: "nehodnoceno",
    gradingScaleLabel: "Stupnice: A – výborně · B – velmi dobře · C – dobře · D – uspokojivě · E – dostatečně · F – nedostatečně",
    thesisTypes: { bachelor: "Bakalářská práce", master: "Diplomová práce", phd: "Disertační práce" },
    roles: { supervisor: "Vedoucí práce", opponent: "Oponent/ka", self: "Předkonzultační rozbor", reviewer: "Recenzent" },
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
    confidentialLabel: "CONFIDENTIAL NOTES FOR COMMITTEE (DO NOT SHARE WITH STUDENT)",
    gradeLabel: "Proposed grade",
    recommendationLabel: "Recommendation",
    signatureLabel: "Reviewer's signature",
    dateLabel: "Date",
    academicYearLabel: "Academic year",
    identificationLabel: "THESIS IDENTIFICATION",
    criteriaOverviewLabel: "CRITERIA OVERVIEW",
    weightLabel: "Weight",
    pointsLabel: "Points",
    scoreLabel: "Weighted result",
    ectsLabel: "ECTS",
    finalGradeLabel: "Final classification",
    studyProgrammeLabel: "Study programme",
    facultyLabel: "Faculty",
    placeLabel: "Place",
    notRatedLabel: "not rated",
    gradingScaleLabel: "Scale: A – excellent · B – very good · C – good · D – satisfactory · E – sufficient · F – fail",
    thesisTypes: { bachelor: "Bachelor's thesis", master: "Master's thesis", phd: "PhD dissertation" },
    roles: { supervisor: "Supervisor", opponent: "Opponent", self: "Pre-consultation triage", reviewer: "Reviewer" },
  },
  de: {
    title: "GUTACHTEN ZUR ABSCHLUSSARBEIT",
    studentLabel: "Verfasser/in",
    thesisTitleLabel: "Titel der Arbeit",
    thesisTypeLabel: "Art der Arbeit",
    reviewerLabel: "Gutachter/in",
    roleLabel: "Rolle",
    institutionLabel: "Institution",
    departmentLabel: "Institut/Lehrstuhl",
    gradingLabel: "BEWERTUNG DER KRITERIEN",
    criterionLabel: "Kriterium",
    ratingLabel: "Bewertung",
    commentLabel: "Kommentar",
    defenseLabel: "FRAGEN ZUR VERTEIDIGUNG",
    citationLabel: "ANMERKUNGEN ZU DEN ZITATEN",
    summaryLabel: "GESAMTBEWERTUNG",
    confidentialLabel: "VERTRAULICHE ANMERKUNGEN FÜR DIE KOMMISSION (NICHT AN DIE STUDIERENDEN WEITERGEBEN)",
    gradeLabel: "Vorgeschlagene Note",
    recommendationLabel: "Empfehlung",
    signatureLabel: "Unterschrift des Gutachters/der Gutachterin",
    dateLabel: "Datum",
    academicYearLabel: "Akademisches Jahr",
    identificationLabel: "ANGABEN ZUR ARBEIT",
    criteriaOverviewLabel: "ÜBERSICHT DER BEWERTUNG",
    weightLabel: "Gewichtung",
    pointsLabel: "Punkte",
    scoreLabel: "Gewichtetes Ergebnis",
    ectsLabel: "ECTS",
    finalGradeLabel: "Endnote",
    studyProgrammeLabel: "Studiengang",
    facultyLabel: "Fakultät",
    placeLabel: "Ort",
    notRatedLabel: "nicht bewertet",
    gradingScaleLabel: "Notenskala: A – sehr gut · B – gut · C – befriedigend · D – ausreichend · E – genügend · F – nicht bestanden",
    thesisTypes: { bachelor: "Bachelorarbeit", master: "Masterarbeit", phd: "Dissertation" },
    roles: { supervisor: "Betreuer/in", opponent: "Zweitgutachter/in", self: "Vorbegutachtung", reviewer: "Gutachter/in" },
  },
  pl: {
    title: "RECENZJA PRACY DYPLOMOWEJ",
    studentLabel: "Autor/Autorka pracy",
    thesisTitleLabel: "Tytuł pracy",
    thesisTypeLabel: "Rodzaj pracy",
    reviewerLabel: "Recenzent/ka",
    roleLabel: "Rola",
    institutionLabel: "Uczelnia",
    departmentLabel: "Katedra/Instytut",
    gradingLabel: "OCENA KRYTERIÓW",
    criterionLabel: "Kryterium",
    ratingLabel: "Ocena",
    commentLabel: "Komentarz",
    defenseLabel: "PYTANIA NA OBRONĘ",
    citationLabel: "UWAGI DO CYTOWAŃ",
    summaryLabel: "OCENA KOŃCOWA",
    confidentialLabel: "UWAGI POUFNE DLA KOMISJI (NIE UDOSTĘPNIAĆ STUDENTOWI)",
    gradeLabel: "Proponowana ocena",
    recommendationLabel: "Rekomendacja",
    signatureLabel: "Podpis recenzenta/ki",
    dateLabel: "Data",
    academicYearLabel: "Rok akademicki",
    identificationLabel: "IDENTYFIKACJA PRACY",
    criteriaOverviewLabel: "PRZEGLĄD OCEN KRYTERIÓW",
    weightLabel: "Waga",
    pointsLabel: "Punkty",
    scoreLabel: "Wynik ważony",
    ectsLabel: "ECTS",
    finalGradeLabel: "Ocena końcowa",
    studyProgrammeLabel: "Kierunek studiów",
    facultyLabel: "Wydział",
    placeLabel: "Miejscowość",
    notRatedLabel: "nieoceniane",
    gradingScaleLabel: "Skala: A – bardzo dobry · B – dobry plus · C – dobry · D – dostateczny · E – dostateczny plus · F – niedostateczny",
    thesisTypes: { bachelor: "Praca licencjacka", master: "Praca magisterska", phd: "Rozprawa doktorska" },
    roles: { supervisor: "Promotor/ka", opponent: "Recenzent/ka", self: "Analiza wstępna", reviewer: "Recenzent/ka" },
  },
  hu: {
    title: "BÍRÁLAT A ZÁRÓDOLGOZATRÓL",
    studentLabel: "A dolgozat szerzője",
    thesisTitleLabel: "A dolgozat címe",
    thesisTypeLabel: "A dolgozat típusa",
    reviewerLabel: "Bíráló",
    roleLabel: "Szerepkör",
    institutionLabel: "Intézmény",
    departmentLabel: "Tanszék/Intézet",
    gradingLabel: "A SZEMPONTOK ÉRTÉKELÉSE",
    criterionLabel: "Szempont",
    ratingLabel: "Értékelés",
    commentLabel: "Megjegyzés",
    defenseLabel: "KÉRDÉSEK A VÉDÉSHEZ",
    citationLabel: "MEGJEGYZÉSEK A HIVATKOZÁSOKHOZ",
    summaryLabel: "ÖSSZEGZŐ ÉRTÉKELÉS",
    confidentialLabel: "BIZALMAS MEGJEGYZÉSEK A BIZOTTSÁGNAK (A HALLGATÓVAL NEM KÖZÖLHETŐ)",
    gradeLabel: "Javasolt érdemjegy",
    recommendationLabel: "Ajánlás",
    signatureLabel: "A bíráló aláírása",
    dateLabel: "Dátum",
    academicYearLabel: "Tanév",
    identificationLabel: "A DOLGOZAT ADATAI",
    criteriaOverviewLabel: "AZ ÉRTÉKELÉS ÁTTEKINTÉSE",
    weightLabel: "Súlyozás",
    pointsLabel: "Pontszám",
    scoreLabel: "Súlyozott eredmény",
    ectsLabel: "ECTS",
    finalGradeLabel: "Végjegy",
    studyProgrammeLabel: "Szak",
    facultyLabel: "Kar",
    placeLabel: "Hely",
    notRatedLabel: "nem értékelt",
    gradingScaleLabel: "Osztályzat: A – jeles · B – jó · C – közepes · D – elégséges · E – megfelelt · F – elégtelen",
    thesisTypes: { bachelor: "Szakdolgozat (BSc/BA)", master: "Diplomamunka (MSc/MA)", phd: "Doktori értekezés" },
    roles: { supervisor: "Témavezető", opponent: "Opponens", self: "Előzetes elemzés", reviewer: "Bíráló" },
  },
}
