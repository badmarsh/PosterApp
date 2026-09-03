/**
 * LaTeX templates for thesis review (posudok diplomovej práce).
 *
 * Supports:
 *  - posudok-sk: Slovak template (STU/UK/TUKE style)
 *  - posudok-en: English template
 *  - posudok-cs: Czech template
 */

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

export function getThesisReviewPreamble(template: ThesisReviewTemplate): string {
  const lang = reportLanguageFor(template)
  const labels = THESIS_REVIEW_LABELS[lang]

  const babel: Record<ReportLanguage, string> = {
    sk: "\\usepackage[slovak]{babel}",
    cs: "\\usepackage[czech]{babel}",
    en: "\\usepackage[english]{babel}",
    de: "\\usepackage[ngerman]{babel}",
    pl: "\\usepackage[polish]{babel}",
    hu: "\\usepackage[magyar]{babel}",
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
  confidentialLabel: string
  gradeLabel: string
  recommendationLabel: string
  signatureLabel: string
  dateLabel: string
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
    thesisTypes: { bachelor: "Bakalářská práce", master: "Diplomová práce", phd: "Dizertační práce" },
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
    thesisTypes: { bachelor: "Szakdolgozat (BSc/BA)", master: "Diplomamunka (MSc/MA)", phd: "Doktori értekezés" },
    roles: { supervisor: "Témavezető", opponent: "Opponens", self: "Előzetes elemzés", reviewer: "Bíráló" },
  },
}
