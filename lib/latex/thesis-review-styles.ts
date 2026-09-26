/**
 * Visual identity of the six posudok templates.
 *
 * Before this module existed, the six thesis-review templates were the *same*
 * document in six languages: normalising the babel line and the running header
 * produced byte-identical preambles (audit finding P-02), so "Deutsches
 * Gutachten" and "Recenzja polska" printed an identical Slovak-style form with
 * different words in it.
 *
 * Each entry below changes how the document is *built*, not just its colour:
 * which letterhead exists, how the title is set, what the criteria overview
 * looks like, where the grade lives, and how sections are marked. Both the
 * LaTeX generator and the live canvas read this descriptor, so the preview and
 * the PDF cannot drift apart.
 *
 * Pure data — no LaTeX, no React — so it can be imported by the generator,
 * the canvas, the showcase gallery and the tests alike.
 */

import type { ThesisReviewTemplate } from "./templates-thesis"

/** How the identifying block at the top of the form is drawn. */
export type ThesisLetterheadStyle =
  | "stacked-rule"   // institution stacked over faculty, heavy rule under it
  | "shaded-table"   // grey label cells, formal form header
  | "minimal"        // no letterhead chrome, just the running head
  | "rule-bar"       // accent bar above an institutional line pair
  | "two-column"     // reviewer column / student column split
  | "band"           // filled accent band carrying the institution

/** How the document title is typeset. */
export type ThesisTitleStyle =
  | "centered-double-rule"
  | "left-accent"
  | "plain-left"
  | "band"
  | "rule-pair"
  | "centered-band"

/** The criteria overview element. */
export type ThesisCriteriaTableStyle =
  | "boxed-ratings"    // criterion · rating box, ratings column right-aligned
  | "weighted-shaded"  // shaded header, weight + points columns
  | "points-column"    // points column, no weights
  | "ruled-rows"       // Gewichtung rows, rules between criteria
  | "compact-weights"  // narrow two-column with weight in brackets
  | "band-rows"        // alternating shaded rows, weight column

/** Where the final classification lives. */
export type ThesisGradeStyle =
  | "fbox"
  | "circled"
  | "table-cell"
  | "inline-bold"
  | "panel"
  | "band"

/** Marker in front of per-criterion headings. */
export type ThesisSectionMarker = "rule" | "square" | "none" | "band" | "number-circle" | "bar"

export type ThesisReviewStyle = {
  templateId: ThesisReviewTemplate
  language: "sk" | "cs" | "en" | "de" | "pl" | "hu"
  /** Accent colour as a bare hex triplet (no `#`). */
  accent: string
  /** Darker companion used for text on tinted rows. */
  accentDark: string
  /** Whether criteria headings carry an explicit number. */
  numbered: boolean
  letterhead: ThesisLetterheadStyle
  titleStyle: ThesisTitleStyle
  criteriaTable: ThesisCriteriaTableStyle
  /** Criteria table shows rubric weights. */
  showWeights: boolean
  /** Criteria table shows converted points (0–100). */
  showPoints: boolean
  gradeStyle: ThesisGradeStyle
  sectionMarker: ThesisSectionMarker
  /** Page margins in mm — also drives the live canvas geometry. */
  margins: { top: number; bottom: number; left: number; right: number }
  /** Human-readable one-liner used by the template picker and the canvas. */
  blurb: string
}

export const THESIS_REVIEW_STYLES: Record<ThesisReviewTemplate, ThesisReviewStyle> = {
  "posudok-sk": {
    templateId: "posudok-sk",
    language: "sk",
    accent: "1B3A6B",
    accentDark: "12274A",
    numbered: true,
    letterhead: "stacked-rule",
    titleStyle: "centered-double-rule",
    criteriaTable: "boxed-ratings",
    showWeights: false,
    showPoints: false,
    gradeStyle: "fbox",
    sectionMarker: "rule",
    margins: { top: 25, bottom: 25, left: 25, right: 20 },
    blurb: "Oficiálny slovenský posudok (STU/UK) s hlavičkou, rámikom klasifikácie a číslovanými kritériami.",
  },
  "posudok-cs": {
    templateId: "posudok-cs",
    language: "cs",
    accent: "0065BD",
    accentDark: "004A8C",
    numbered: true,
    letterhead: "shaded-table",
    titleStyle: "left-accent",
    criteriaTable: "weighted-shaded",
    showWeights: true,
    showPoints: true,
    gradeStyle: "table-cell",
    sectionMarker: "bar",
    margins: { top: 22, bottom: 22, left: 24, right: 24 },
    blurb: "Český posudek (ČVUT/MUNI) s tabulkou kritérií a váhami, šedými popisky polí.",
  },
  "posudok-en": {
    templateId: "posudok-en",
    language: "en",
    accent: "33475B",
    accentDark: "22303D",
    numbered: false,
    letterhead: "minimal",
    titleStyle: "plain-left",
    criteriaTable: "points-column",
    showWeights: false,
    showPoints: true,
    gradeStyle: "inline-bold",
    sectionMarker: "none",
    margins: { top: 25, bottom: 25, left: 25, right: 25 },
    blurb: "English assessment report: neutral typography, points per criterion, inline classification.",
  },
  "posudok-de": {
    templateId: "posudok-de",
    language: "de",
    accent: "1F4E79",
    accentDark: "143450",
    numbered: true,
    letterhead: "rule-bar",
    titleStyle: "band",
    criteriaTable: "ruled-rows",
    showWeights: true,
    showPoints: true,
    gradeStyle: "panel",
    sectionMarker: "number-circle",
    margins: { top: 20, bottom: 20, left: 22, right: 20 },
    blurb: "Deutsches Gutachten mit Akzentbalken, Gewichtungstabelle und Notenpanel.",
  },
  "posudok-pl": {
    templateId: "posudok-pl",
    language: "pl",
    accent: "8A1538",
    accentDark: "64102A",
    numbered: true,
    letterhead: "two-column",
    titleStyle: "rule-pair",
    criteriaTable: "compact-weights",
    showWeights: true,
    showPoints: false,
    gradeStyle: "circled",
    sectionMarker: "square",
    margins: { top: 22, bottom: 22, left: 24, right: 22 },
    blurb: "Recenzja polska z kolumnową nagłówkową tabelą, wagami w nawiasach i okrągłą oceną.",
  },
  "posudok-hu": {
    templateId: "posudok-hu",
    language: "hu",
    accent: "1E6B52",
    accentDark: "14493A",
    numbered: false,
    letterhead: "band",
    titleStyle: "centered-band",
    criteriaTable: "band-rows",
    showWeights: true,
    showPoints: false,
    gradeStyle: "band",
    sectionMarker: "none",
    margins: { top: 24, bottom: 24, left: 24, right: 24 },
    blurb: "Magyar bírálat: színes sávos fejléc, csíkozott kritériumtáblázat, sávos érdemjegy.",
  },
}

/** Style for a template id, falling back to the Slovak official form. */
export function thesisReviewStyleFor(templateId?: string | null): ThesisReviewStyle {
  if (templateId && templateId in THESIS_REVIEW_STYLES) {
    return THESIS_REVIEW_STYLES[templateId as ThesisReviewTemplate]
  }
  return THESIS_REVIEW_STYLES["posudok-sk"]
}

/**
 * Structural signature of a style — the set of decisions that make a template
 * recognisably different from its siblings. The template-differentiation test
 * asserts that no two templates share one.
 */
export function styleSignature(style: ThesisReviewStyle): string {
  return [
    style.letterhead,
    style.titleStyle,
    style.criteriaTable,
    style.gradeStyle,
    style.sectionMarker,
    style.numbered ? "numbered" : "unnumbered",
    style.showWeights ? "weights" : "no-weights",
    style.showPoints ? "points" : "no-points",
  ].join("|")
}
