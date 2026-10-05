/**
 * Declarative preview art for output templates.
 *
 * The template picker used to draw one of four generic schematics
 * (`layoutPreview` in lib/output-types.ts), so every poster looked identical
 * and every slide deck looked identical. This module replaces that with a
 * per-template description of the *actual* visual language the LaTeX template
 * implements — title band, card treatment, column widths, stat tiles — and
 * renders that document in the same isometric mockup style the showcase
 * galleries use (see `lib/template-mockup-scene.ts` and
 * `public/showcases/mockups/`), so a preview shows the template as a finished
 * artefact: printed on a board on an easel, on an open laptop, or as sheets on
 * the desk.
 *
 * Keeping it declarative (rather than one hand-drawn image per template) means
 * the artwork can never drift from the palette the user picks: the renderer
 * takes the template's `colors` at call time, which is also why the previews
 * stay distinct per template while sharing one canvas, one camera and one set.
 *
 * Consumers:
 *  - `scripts/generate-template-previews.mjs` writes `public/template-previews/*.{svg,png}`
 *  - `components/template-preview-image.tsx` shows those assets in the picker
 *    list and in the selected-template detail panel
 */

import type { TemplateColor, TemplateDef } from "./output-types"
import { renderMockupScene, type MockupKind, type SceneDocument, type ScenePalette } from "./template-mockup-scene"
import {
  GENERIC_DOCUMENT_CONTENT,
  truncate,
  wrapText,
  type PreviewDocumentContent,
  type PreviewSection,
} from "./template-preview-content"
import { THESIS_REVIEW_STYLES, thesisReviewStyleFor } from "./latex/thesis-review-styles"

export type PosterCardStyle =
  /** Solid accent title bar, white-on-accent text (atlas / minimal / tikzposter). */
  | "filled-title"
  /** White title bar with an accent underline rule (conference). */
  | "underlined-title"
  /** Faint accent wash behind the title + a solid bar down the left edge (aurora). */
  | "left-bar"
  /** No card chrome at all; sections are headings on the page (a0poster). */
  | "plain-section"
  /** Beamer `block`: rounded, accent title, tinted body (gemini). */
  | "rounded-block"
  /** Big-finding centre column (betterposter). */
  | "hero"

export type PosterPreviewArt = {
  kind: "poster"
  /** "landscape" boards are drawn wide; "portrait" tall. */
  orientation: "portrait" | "landscape"
  /** Column widths as fractions of the board; must sum to ~1. */
  columnWidths: number[]
  /** Title band treatment. `height` is a fraction of the board's short side. */
  titleBand: { fill: "accent" | "ink" | "none"; height: number; radius: number }
  /** Thin accent rule directly under the title band. */
  accentRule: boolean
  card: { style: PosterCardStyle; radius: number; bodyTint: number }
  /** Draw a row of stat tiles in the first card of column 2. */
  statTiles: boolean
  /** Logo chips in the title band (institutional templates). */
  logoChips: boolean
}

export type SlidePreviewArt = {
  kind: "slide"
  /** How the frame title is presented. */
  header: "band" | "rule" | "plain"
  /** `heavy` draws a thick, large title bar; `plain` a single text line. */
  titleWeight: "heavy" | "plain"
  footer: "bar" | "rule" | "none"
  /** Body layout shown in the content slide. */
  body: "bullets" | "columns" | "figure"
  /** Full-bleed ink title slide (editorial / focus). */
  darkTitleSlide: boolean
}

/**
 * Posudok (thesis-review) mockup. A posudok is neither a poster nor a deck: it
 * is an A4 form, and what distinguishes the six templates is the *form*
 * — letterhead, criteria table, grade panel, signature block — so the artwork is
 * derived from the same `THESIS_REVIEW_STYLES` descriptor the generator and the
 * live canvas read, rather than from generic body rules.
 */
export type PosudokPreviewArt = {
  kind: "posudok"
  /** Style descriptor id, resolved through `thesisReviewStyleFor`. */
  styleId: string
  /** How many criterion rows the mockup shows. */
  rows: number
  /** Criterion labels drawn in the first column. */
  labels: string[]
  /** Rating letters drawn with the style's own rating symbol. */
  ratings: string[]
}

export type PaperPreviewArt = {
  kind: "paper"
  columns: 1 | 2
  titleAlign: "left" | "center"
  masthead: "plain" | "publisher" | "badge" | "band" | "rule"
  abstract: "plain" | "shaded" | "boxed"
  headings: "numbered" | "ruled" | "filled"
  authorLayout: "centered" | "affiliations" | "compact"
  runningHeader: "none" | "one-sided" | "two-sided"
  figure: "none" | "column" | "wide"
  footer: "page" | "publisher" | "copyright" | "none"
  /** Optional short masthead wordmark (e.g. IEEE, ACM, or ACL). */
  wordmark?: string
}

export type TemplatePreviewArt = PosterPreviewArt | SlidePreviewArt | PaperPreviewArt | PosudokPreviewArt

/**
 * Criterion rows per posudok template. The German and Czech forms assess more
 * criteria than the compact Hungarian one, so the mockups differ in density as
 * well as in treatment.
 */
const POSUDOK_ART_ROWS: Record<string, { rows: number; labels: string[]; ratings: string[] }> = {
  "posudok-sk": {
    rows: 5,
    labels: ["Ciele práce", "Teoretická báza", "Metodika", "Výsledky", "Diskusia"],
    ratings: ["A", "A", "B", "A", "A"],
  },
  "posudok-cs": {
    rows: 5,
    labels: ["Relevance tématu", "Metodický postup", "Analytické zpracování", "Výsledky", "Citace"],
    ratings: ["A", "B", "A", "B", "C"],
  },
  "posudok-en": {
    rows: 6,
    labels: ["Objectives", "Method", "Execution", "Ethics", "Limitations", "Citations"],
    ratings: ["A", "A", "A", "A", "B", "A"],
  },
  "posudok-de": {
    rows: 5,
    labels: ["Relevanz", "Methodik", "Durchführung", "Ergebnisse", "Aufbau"],
    ratings: ["A", "B", "A", "B", "B"],
  },
  "posudok-pl": {
    rows: 5,
    labels: ["Oryginalność", "Metodyka", "Realizacja", "Wyniki", "Cytowania"],
    ratings: ["A", "B", "A", "A", "B"],
  },
  "posudok-hu": {
    rows: 5,
    labels: ["Célkitűzés", "Elmélet", "Módszertan", "Végrehajtás", "Korlátok"],
    ratings: ["A", "B", "B", "A", "B"],
  },
}

const INK = "#0F172A"

/**
 * Art spec per template. Anything missing falls back to `derivePreviewArt`,
 * which builds a reasonable spec from `layoutPreview` so a newly added
 * template still gets artwork on the day it is registered.
 */
const PREVIEW_ART: Record<string, TemplatePreviewArt> = {
  // ── posters ─────────────────────────────────────────────────────────────
  atlas: {
    kind: "poster", orientation: "portrait", columnWidths: [1 / 3, 1 / 3, 1 / 3],
    titleBand: { fill: "accent", height: 0.14, radius: 10 }, accentRule: false,
    card: { style: "filled-title", radius: 4, bodyTint: 0.08 },
    statTiles: true, logoChips: true,
  },
  conference: {
    kind: "poster", orientation: "portrait", columnWidths: [1 / 3, 1 / 3, 1 / 3],
    titleBand: { fill: "accent", height: 0.12, radius: 12 }, accentRule: false,
    card: { style: "underlined-title", radius: 6, bodyTint: 0.04 },
    statTiles: true, logoChips: false,
  },
  minimal: {
    kind: "poster", orientation: "portrait", columnWidths: [1 / 3, 1 / 3, 1 / 3],
    titleBand: { fill: "accent", height: 0.11, radius: 6 }, accentRule: false,
    card: { style: "filled-title", radius: 4, bodyTint: 0.05 },
    statTiles: false, logoChips: false,
  },
  aurora: {
    kind: "poster", orientation: "portrait", columnWidths: [1 / 3, 1 / 3, 1 / 3],
    titleBand: { fill: "ink", height: 0.13, radius: 0 }, accentRule: true,
    card: { style: "left-bar", radius: 0, bodyTint: 0 },
    statTiles: true, logoChips: false,
  },
  gemini: {
    kind: "poster", orientation: "portrait", columnWidths: [1 / 3, 1 / 3, 1 / 3],
    titleBand: { fill: "accent", height: 0.13, radius: 0 }, accentRule: false,
    card: { style: "rounded-block", radius: 8, bodyTint: 0.05 },
    statTiles: false, logoChips: false,
  },
  tikzposter: {
    kind: "poster", orientation: "portrait", columnWidths: [1 / 3, 1 / 3, 1 / 3],
    titleBand: { fill: "accent", height: 0.12, radius: 8 }, accentRule: false,
    card: { style: "filled-title", radius: 5, bodyTint: 0.06 },
    statTiles: false, logoChips: false,
  },
  a0poster: {
    kind: "poster", orientation: "portrait", columnWidths: [1 / 3, 1 / 3, 1 / 3],
    titleBand: { fill: "none", height: 0.09, radius: 0 }, accentRule: true,
    card: { style: "plain-section", radius: 0, bodyTint: 0 },
    statTiles: false, logoChips: false,
  },
  landscape: {
    kind: "poster", orientation: "landscape", columnWidths: [1 / 3, 1 / 3, 1 / 3],
    titleBand: { fill: "accent", height: 0.16, radius: 6 }, accentRule: false,
    card: { style: "filled-title", radius: 4, bodyTint: 0.05 },
    statTiles: false, logoChips: false,
  },
  betterposter: {
    kind: "poster", orientation: "landscape", columnWidths: [0.28, 0.44, 0.28],
    titleBand: { fill: "ink", height: 0.14, radius: 6 }, accentRule: false,
    card: { style: "hero", radius: 4, bodyTint: 0.05 },
    statTiles: false, logoChips: false,
  },
  // ── slides ──────────────────────────────────────────────────────────────
  "beamer-metropolis": {
    kind: "slide", header: "rule", titleWeight: "heavy", footer: "bar",
    body: "bullets", darkTitleSlide: true,
  },
  "beamer-atlas": {
    kind: "slide", header: "band", titleWeight: "heavy", footer: "bar",
    body: "bullets", darkTitleSlide: false,
  },
  "beamer-madrid": {
    kind: "slide", header: "band", titleWeight: "heavy", footer: "bar",
    body: "columns", darkTitleSlide: false,
  },
  "beamer-default": {
    kind: "slide", header: "plain", titleWeight: "plain", footer: "none",
    body: "bullets", darkTitleSlide: false,
  },
  "beamer-focus": {
    kind: "slide", header: "rule", titleWeight: "heavy", footer: "none",
    body: "figure", darkTitleSlide: true,
  },
  "beamer-editorial": {
    kind: "slide", header: "rule", titleWeight: "heavy", footer: "rule",
    body: "columns", darkTitleSlide: true,
  },
}

/**
 * Paper templates use a shared page frame but keep their own recognizable
 * publishing cues. These descriptors intentionally reflect the registry's
 * actual single/two-column choice and venue identity rather than reusing one
 * generic paper drawing for every class.
 */
const PAPER_PREVIEW_ART: Record<string, PaperPreviewArt> = {
  "article-twocol": { kind: "paper", columns: 2, titleAlign: "center", masthead: "plain", abstract: "shaded", headings: "ruled", authorLayout: "affiliations", runningHeader: "none", figure: "column", footer: "page" },
  "article-single": { kind: "paper", columns: 1, titleAlign: "center", masthead: "plain", abstract: "shaded", headings: "ruled", authorLayout: "affiliations", runningHeader: "none", figure: "wide", footer: "page" },
  "ieee-conf": { kind: "paper", columns: 2, titleAlign: "center", masthead: "badge", abstract: "plain", headings: "numbered", authorLayout: "compact", runningHeader: "two-sided", figure: "column", footer: "copyright", wordmark: "IEEE" },
  "acm-sigconf": { kind: "paper", columns: 2, titleAlign: "left", masthead: "band", abstract: "boxed", headings: "numbered", authorLayout: "affiliations", runningHeader: "two-sided", figure: "wide", footer: "copyright", wordmark: "ACM" },
  "springer-llncs": { kind: "paper", columns: 1, titleAlign: "center", masthead: "publisher", abstract: "plain", headings: "numbered", authorLayout: "centered", runningHeader: "two-sided", figure: "wide", footer: "page", wordmark: "SPRINGER" },
  "jinst-proceedings": { kind: "paper", columns: 1, titleAlign: "left", masthead: "rule", abstract: "boxed", headings: "ruled", authorLayout: "affiliations", runningHeader: "one-sided", figure: "wide", footer: "publisher", wordmark: "JINST" },
  "pos-proceedings": { kind: "paper", columns: 1, titleAlign: "left", masthead: "badge", abstract: "shaded", headings: "filled", authorLayout: "compact", runningHeader: "one-sided", figure: "column", footer: "publisher", wordmark: "PoS" },
  elsarticle: { kind: "paper", columns: 1, titleAlign: "left", masthead: "band", abstract: "boxed", headings: "ruled", authorLayout: "affiliations", runningHeader: "one-sided", figure: "wide", footer: "page", wordmark: "ELSEVIER" },
  "revtex-aps": { kind: "paper", columns: 2, titleAlign: "center", masthead: "badge", abstract: "boxed", headings: "numbered", authorLayout: "centered", runningHeader: "two-sided", figure: "wide", footer: "none", wordmark: "PHYSICAL REVIEW" },
  "epj-woc": { kind: "paper", columns: 1, titleAlign: "center", masthead: "publisher", abstract: "shaded", headings: "numbered", authorLayout: "affiliations", runningHeader: "one-sided", figure: "wide", footer: "publisher", wordmark: "EPJ WEB OF CONFERENCES" },
  iopart: { kind: "paper", columns: 1, titleAlign: "left", masthead: "rule", abstract: "plain", headings: "ruled", authorLayout: "affiliations", runningHeader: "one-sided", figure: "column", footer: "publisher", wordmark: "IOP PUBLISHING" },
  neurips: { kind: "paper", columns: 1, titleAlign: "center", masthead: "band", abstract: "shaded", headings: "filled", authorLayout: "centered", runningHeader: "none", figure: "wide", footer: "copyright", wordmark: "NeurIPS" },
  icml: { kind: "paper", columns: 2, titleAlign: "center", masthead: "publisher", abstract: "plain", headings: "numbered", authorLayout: "compact", runningHeader: "two-sided", figure: "wide", footer: "copyright", wordmark: "ICML" },
  iclr: { kind: "paper", columns: 1, titleAlign: "center", masthead: "rule", abstract: "boxed", headings: "filled", authorLayout: "centered", runningHeader: "none", figure: "wide", footer: "page", wordmark: "ICLR" },
  acl: { kind: "paper", columns: 2, titleAlign: "left", masthead: "publisher", abstract: "boxed", headings: "numbered", authorLayout: "affiliations", runningHeader: "two-sided", figure: "column", footer: "page", wordmark: "ACL" },
  cvpr: { kind: "paper", columns: 2, titleAlign: "center", masthead: "badge", abstract: "shaded", headings: "numbered", authorLayout: "centered", runningHeader: "two-sided", figure: "wide", footer: "copyright", wordmark: "CVPR" },
  aaai: { kind: "paper", columns: 2, titleAlign: "center", masthead: "band", abstract: "boxed", headings: "ruled", authorLayout: "compact", runningHeader: "two-sided", figure: "column", footer: "copyright", wordmark: "AAAI" },
}

/** Build a sensible spec for a template that has no bespoke art yet. */
export function derivePreviewArt(t: TemplateDef): TemplatePreviewArt {
  if (t.outputType === "slides") {
    return PREVIEW_ART[t.id] ?? { kind: "slide", header: "plain", titleWeight: "plain", footer: "none", body: "bullets", darkTitleSlide: false }
  }
  if (t.outputType === "paper") {
    return PAPER_PREVIEW_ART[t.id] ?? {
      kind: "paper", columns: t.layoutPreview === "paper-twocol" ? 2 : 1,
      titleAlign: "center", masthead: "plain", abstract: "shaded", headings: "ruled",
      authorLayout: "centered", runningHeader: "none", figure: "column", footer: "page",
    }
  }
  if (t.outputType === "thesis-review") {
    const style = THESIS_REVIEW_STYLES[posudokStyleIdFor(t.id)]
    const rows = POSUDOK_ART_ROWS[t.id]
    return {
      kind: "posudok",
      styleId: style?.templateId ?? "posudok-sk",
      rows: rows?.rows ?? 5,
      labels: rows?.labels ?? [],
      ratings: rows?.ratings ?? [],
    }
  }
  if (t.outputType === "poster") {
    return {
      kind: "poster", orientation: "portrait", columnWidths: [1 / 3, 1 / 3, 1 / 3],
      titleBand: { fill: "accent", height: 0.12, radius: 6 }, accentRule: false,
      card: { style: "filled-title", radius: 4, bodyTint: 0.05 },
      statTiles: false, logoChips: false,
    }
  }
  // paper / thesis-review: a page with a title block and body rules
  return {
    kind: "poster", orientation: t.layoutPreview === "paper-twocol" ? "landscape" : "portrait",
    columnWidths: t.layoutPreview === "paper-twocol" ? [0.5, 0.5] : [1],
    titleBand: { fill: "none", height: 0.08, radius: 0 }, accentRule: true,
    card: { style: "plain-section", radius: 0, bodyTint: 0 },
    statTiles: false, logoChips: false,
  }
}

export function getPreviewArt(templateId: string, def?: TemplateDef): TemplatePreviewArt {
  if (PREVIEW_ART[templateId]) return PREVIEW_ART[templateId]
  if (PAPER_PREVIEW_ART[templateId]) return PAPER_PREVIEW_ART[templateId]
  if (resolvePosudokStyleId(templateId)) {
    return derivePreviewArt({ ...(def ?? {}), id: templateId, outputType: "thesis-review" } as TemplateDef)
  }
  return def ? derivePreviewArt(def) : derivePreviewArt({ layoutPreview: "poster-3col" } as TemplateDef)
}

type ThesisReviewTemplateId = keyof typeof THESIS_REVIEW_STYLES

/** Map a template id to a posudok style id (tolerates legacy aliases). */
function resolvePosudokStyleId(templateId: string): ThesisReviewTemplateId | undefined {
  if (templateId in THESIS_REVIEW_STYLES) return templateId as ThesisReviewTemplateId
  return (Object.keys(THESIS_REVIEW_STYLES) as ThesisReviewTemplateId[]).find(
    (id) => id.replace(/^posudok-/, "") === templateId.replace(/^(posudok|posudek|gutachten|recenzja|biralat)-/, ""),
  )
}

function posudokStyleIdFor(templateId: string): ThesisReviewTemplateId {
  return resolvePosudokStyleId(templateId) ?? "posudok-sk"
}

/** True when the preview art for a template is bespoke rather than derived. */
export function hasBespokePreviewArt(templateId: string): boolean {
  return Object.prototype.hasOwnProperty.call(PREVIEW_ART, templateId)
    || Object.prototype.hasOwnProperty.call(PAPER_PREVIEW_ART, templateId)
    || resolvePosudokStyleId(templateId) !== undefined
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export interface PreviewPalette {
  accent: string
  accent2: string
  ink: string
  paper: string
}

export function paletteFrom(colors: TemplateColor[]): PreviewPalette {
  return {
    accent: colors[0]?.hex ?? "#2563EB",
    accent2: colors[1]?.hex ?? colors[0]?.hex ?? "#0D9488",
    ink: INK,
    paper: "#FFFFFF",
  }
}

function withAlpha(hex: string, alpha: number): string {
  const m = hex.replace(/^#/, "")
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return hex
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0")
  return `#${m}${a}`
}

/** Small helper for the "text line" placeholder bars every mockup uses. */
function textBar(x: number, y: number, w: number, h: number, fill: string, opacity = 1): string {
  return `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" rx="${r(h / 2)}" fill="${fill}" opacity="${opacity}"/>`
}

function r(n: number): number {
  return Math.round(n * 100) / 100
}

/** Inner markup of a rendered document, plus its local dimensions. */
function innerDocument(svg: string, width: number, height: number): SceneDocument {
  return {
    markup: svg.slice(svg.indexOf(">") + 1, svg.lastIndexOf("</svg>")),
    width,
    height,
  }
}

/** A template's document as a printable artefact, ready for the mockup stage. */
export type TemplateDocument = SceneDocument & {
  kind: MockupKind
  /** Native aspect ratio (height / width) of the printed document. */
  aspect: number
}

/**
 * The template's own document — poster page, slide, paper page or posudok form —
 * rendered in local coordinates. `renderTemplatePreviewSvg` prints it onto the
 * matching surface of the mockup scene.
 */
export function renderTemplateDocument(
  templateId: string,
  colors: TemplateColor[],
  def?: TemplateDef,
  options: {
    slide?: "title" | "content"
    width?: number
    content?: PreviewDocumentContent
    /** `deck` prints the portrait handout (title slide over a content slide). */
    layout?: "single" | "deck"
  } = {},
): TemplateDocument {
  const width = options.width ?? 320
  const art = getPreviewArt(templateId, def)
  const p = paletteFrom(colors)
  // Demo documents are injected by the generator (see lib/template-demo-content.ts)
  // so this module stays free of the gallery payload in the client bundle.
  const content = options.content ?? GENERIC_DOCUMENT_CONTENT

  if (art.kind === "posudok") {
    const height = width * (297 / 210)
    return { kind: "posudok", ...innerDocument(renderPosudok(art, p, width, templateId), width, height), aspect: 297 / 210 }
  }
  if (art.kind === "paper") {
    const height = width * (297 / 210)
    return { kind: "paper", ...innerDocument(renderPaper(art, p, width, templateId, content), width, height), aspect: 297 / 210 }
  }
  if (art.kind === "poster") {
    const height = width * (art.orientation === "landscape" ? 841 / 1189 : 1189 / 841)
    return { kind: "poster", ...innerDocument(renderPoster(art, p, width, templateId, content), width, height), aspect: height / width }
  }
  if (options.layout === "deck") {
    // Portrait handout: the deck as it would be printed and pinned on a board.
    const pad = width * 0.05
    const slideW = width - pad * 2
    const slideH = slideW * (9 / 16)
    const gap = width * 0.045
    const height = pad * 2 + slideH * 2 + gap
    const parts = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${r(width)}" height="${r(height)}" viewBox="0 0 ${r(width)} ${r(height)}" role="img" aria-label="${escapeXml(templateId)} deck handout">`,
      `<rect width="${r(width)}" height="${r(height)}" fill="${p.paper}"/>`,
      ...slideFrame(art, p, { x: pad, y: pad, w: slideW, h: slideH }, "title", content),
      ...slideFrame(art, p, { x: pad, y: pad + slideH + gap, w: slideW, h: slideH }, "content", content),
      "</svg>",
    ]
    return { kind: "slides", ...innerDocument(parts.join(""), width, height), aspect: height / width }
  }
  const height = width * (9 / 16)
  const markup = slideFrame(art, p, { x: 0, y: 0, w: width, h: height }, options.slide ?? "title", content).join("")
  return { kind: "slides", markup, width, height, aspect: 9 / 16 }
}

/** Stable per-template variation for the mockup camera and props. */
function previewVariant(templateId: string): number {
  let hash = 0
  for (let i = 0; i < templateId.length; i++) {
    hash = (hash * 31 + templateId.charCodeAt(i)) % 9973
  }
  return hash
}

/**
 * Render a template preview as an isometric mockup: the shared studio set with
 * the template's own document printed onto the surface that fits its output
 * type. Every preview uses the same 4:3 canvas, the same camera fit and the same
 * set, so the picker reads as one gallery — while the printed document keeps the
 * template's real palette, layout and page ratio.
 *
 * @param width Output width in SVG user units (height is always width × 3/4).
 */
export function renderTemplatePreviewSvg(
  templateId: string,
  colors: TemplateColor[],
  width = 320,
  def?: TemplateDef,
  options: { content?: PreviewDocumentContent } = {},
): string {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 320
  const height = safeWidth * 0.75
  const document = renderTemplateDocument(templateId, colors, def, { content: options.content })
  // Slide decks also pin their printed handout on the board, so both surfaces
  // show the demo deck rather than a placeholder page.
  const boardDocument =
    document.kind === "slides"
      ? renderTemplateDocument(templateId, colors, def, { content: options.content, layout: "deck" })
      : undefined
  const pal = paletteFrom(colors)
  const palette: ScenePalette = { accent: pal.accent, accent2: pal.accent2, ink: pal.ink }
  const scene = renderMockupScene(
    {
      kind: document.kind,
      variant: previewVariant(templateId),
      palette,
      document,
      boardDocument,
      idPrefix: `tp-${templateId.replace(/[^a-zA-Z0-9_-]/g, "")}`,
    },
    { width: safeWidth, height },
  )
  const label = escapeXml(`${def?.label ?? templateId} template preview`)

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${r(safeWidth)}" height="${r(height)}" viewBox="0 0 ${r(safeWidth)} ${r(height)}" role="img" aria-label="${label}" data-template-id="${escapeXml(templateId)}">`,
    scene,
    `</svg>`,
  ].join("")
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

function svgOpen(w: number, h: number, id: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${r(h)}" viewBox="0 0 ${w} ${r(h)}" ` +
    `role="img" aria-label="${id} template preview">`
  )
}

const TEXT_FONT = "Helvetica, Arial, sans-serif"

type TextOpts = {
  size: number
  fill: string
  weight?: number
  opacity?: number
  anchor?: "start" | "middle"
  letterSpacing?: number
  italic?: boolean
}

/** A real text run in document coordinates. */
function textEl(x: number, y: number, value: string, opts: TextOpts): string {
  if (!value) return ""
  return (
    `<text x="${r(x)}" y="${r(y)}" font-family="${TEXT_FONT}" font-size="${r(opts.size)}" fill="${opts.fill}"` +
    (opts.weight ? ` font-weight="${opts.weight}"` : "") +
    (opts.italic ? ` font-style="italic"` : "") +
    (opts.letterSpacing ? ` letter-spacing="${r(opts.letterSpacing)}"` : "") +
    (opts.opacity !== undefined ? ` opacity="${opts.opacity}"` : "") +
    (opts.anchor === "middle" ? ` text-anchor="middle"` : "") +
    `>${escapeXml(value)}</text>`
  )
}

/** Wrap to a width using the average Helvetica advance (~0.52 em). */
function wrapToWidth(value: string, width: number, size: number, maxLines: number, bold = false): string[] {
  const advance = Math.max(0.01, size) * (bold ? 0.56 : 0.52)
  return wrapText(value, Math.max(6, Math.floor(width / advance)), maxLines)
}

/** Plain body lines for a section, each shortened to the available width. */
function bodyLines(section: PreviewSection | undefined, width: number, size: number, maxLines: number): string[] {
  if (!section) return []
  const perLine = Math.max(8, Math.floor(width / (size * 0.52)))
  return section.lines
    .slice(0, maxLines)
    .map((line) => truncate(line.replace(/^•\s*/, ""), perLine))
    .filter(Boolean)
}

/**
 * Distribute the demo sections over the artwork's columns: honour the demo
 * document's own column grid when it matches this template's column count,
 * otherwise keep the document reading order and fill column by column.
 */
function groupSections(sections: PreviewSection[], columns: number): PreviewSection[][] {
  const groups: PreviewSection[][] = Array.from({ length: columns }, () => [])
  if (columns < 1) return groups
  const used = sections.filter((s) => typeof s.column === "number")
  const maxColumn = used.reduce((max, s) => Math.max(max, s.column ?? 1), 0)
  if (used.length && maxColumn === columns) {
    for (const section of sections) {
      const index = Math.min(columns - 1, Math.max(0, (section.column ?? 1) - 1))
      groups[index].push(section)
    }
    return groups
  }
  sections.forEach((section, index) => groups[index % columns].push(section))
  return groups
}

function renderPoster(
  art: PosterPreviewArt,
  p: PreviewPalette,
  width: number,
  id: string,
  content: PreviewDocumentContent,
): string {
  const W = width
  const H = art.orientation === "landscape" ? width * (841 / 1189) : width * (1189 / 841)
  const pad = W * 0.035
  const bandH = H * art.titleBand.height
  const parts: string[] = [svgOpen(W, H, id)]

  // Board
  parts.push(`<rect width="${r(W)}" height="${r(H)}" fill="${art.titleBand.fill === "ink" ? withAlpha(p.ink, 0.03) : p.paper}"/>`)
  parts.push(`<rect x="0.5" y="0.5" width="${r(W - 1)}" height="${r(H - 1)}" fill="none" stroke="${withAlpha(p.ink, 0.14)}"/>`)

  // Title band: the demo document's title, authors and venue. The two band
  // styles typeset the title at different sizes, so each wraps to its own size.
  const bandTitleSize = bandH * 0.15
  const plainTitleSize = bandH * (wrapToWidth(content.title, W - pad * 3, bandH * 0.15, 2, true).length > 1 ? 0.24 : 0.3)
  const titleLines =
    art.titleBand.fill === "none"
      ? wrapToWidth(content.title, W - pad * 3, plainTitleSize, 2, true)
      : wrapToWidth(content.title, W - pad * 3, bandTitleSize, 2, true)
  if (art.titleBand.fill !== "none") {
    const fill = art.titleBand.fill === "ink" ? p.ink : p.accent
    parts.push(
      `<rect x="${r(pad)}" y="${r(pad)}" width="${r(W - pad * 2)}" height="${r(bandH)}" rx="${art.titleBand.radius}" fill="${fill}"/>`,
    )
    const size = bandH * (titleLines.length > 1 ? 0.13 : 0.155)
    const titleY = pad + bandH * (titleLines.length > 1 ? 0.32 : 0.42)
    titleLines.forEach((line, i) => {
      parts.push(textEl(W / 2, titleY + i * bandH * 0.24, line, { size, fill: "#FFFFFF", weight: 700, anchor: "middle", opacity: 0.97 }))
    })
    const meta = content.authors ?? content.venue
    if (meta) {
      const metaSize = bandH * 0.073
      parts.push(
        textEl(W / 2, pad + bandH * 0.9, truncate(meta, Math.floor((W - pad * 3) / (metaSize * 0.52))), {
          size: metaSize,
          fill: "#FFFFFF",
          anchor: "middle",
          opacity: 0.75,
        }),
      )
    }
    if (art.logoChips) {
      const chip = bandH * 0.5
      parts.push(`<rect x="${r(pad * 2)}" y="${r(pad + bandH / 2 - chip / 2)}" width="${r(chip)}" height="${r(chip)}" rx="3" fill="#FFFFFF" opacity="0.85"/>`)
      parts.push(`<rect x="${r(W - pad * 2 - chip)}" y="${r(pad + bandH / 2 - chip / 2)}" width="${r(chip)}" height="${r(chip)}" rx="3" fill="#FFFFFF" opacity="0.85"/>`)
    }
  } else {
    const size = plainTitleSize
    titleLines.forEach((line, i) => {
      parts.push(textEl(pad, pad + bandH * (0.34 + i * 0.32), line, { size, fill: p.ink, weight: 700, opacity: 0.92 }))
    })
    if (content.venue) {
      parts.push(textEl(pad, pad + bandH * 0.92, truncate(content.venue, 76), { size: bandH * 0.11, fill: p.ink, opacity: 0.5 }))
    }
  }

  if (art.accentRule) {
    parts.push(`<rect x="${r(pad)}" y="${r(pad + bandH + 2)}" width="${r(W - pad * 2)}" height="${r(Math.max(1.5, H * 0.004))}" fill="${p.accent}"/>`)
  }

  // Columns
  const top = pad + bandH + (art.accentRule ? 8 : 6)
  const bottom = H - pad
  const gutter = (W - pad * 2) * 0.022
  const usableW = W - pad * 2 - gutter * (art.columnWidths.length - 1)
  const grouped = groupSections(content.sections, art.columnWidths.length)
  let x = pad

  art.columnWidths.forEach((frac, ci) => {
    const colW = usableW * frac
    const colH = bottom - top
    const columnSections = grouped[ci] ?? []
    let sectionCursor = 0
    const nextSection = () => columnSections[sectionCursor++]

    if (art.card.style === "hero" && ci === 1) {
      // Better Poster: one enormous plain-language finding in the middle.
      const statement = truncate(content.claim ?? columnSections[0]?.lines[0]?.replace(/^•\s*/, "") ?? "", 150)
      const statementLines = wrapToWidth(statement, colW * 0.78, colH * 0.052, 3, true)
      parts.push(`<rect x="${r(x)}" y="${r(top)}" width="${r(colW)}" height="${r(colH * 0.62)}" rx="${art.card.radius}" fill="${withAlpha(p.accent, 0.08)}"/>`)
      statementLines.forEach((line, i) => {
        parts.push(textEl(x + colW / 2, top + colH * (0.24 + i * 0.09), line, { size: colH * 0.052, fill: p.ink, weight: 700, anchor: "middle", opacity: 0.9 }))
      })
      const heroBody = bodyLines(nextSection(), colW * 0.84, colH * 0.03, 4)
      heroBody.forEach((line, i) => {
        parts.push(textEl(x + colW * 0.08, top + colH * (0.44 + i * 0.045), line, { size: colH * 0.03, fill: withAlpha(p.ink, 0.62) }))
      })
      parts.push(`<rect x="${r(x)}" y="${r(top + colH * 0.68)}" width="${r(colW)}" height="${r(colH * 0.3)}" fill="${withAlpha(p.accent2, 0.1)}"/>`)
    } else if (art.card.style === "plain-section") {
      // No card chrome: a heading rule then body text.
      const blocks = 3
      const bh = colH / blocks
      for (let b = 0; b < blocks; b++) {
        const y = top + b * bh
        const section = nextSection()
        if (!section) {
          parts.push(`<rect x="${r(x)}" y="${r(y + bh * 0.2)}" width="${r(colW)}" height="${r(bh * 0.5)}" fill="${withAlpha(p.accent2, 0.07)}"/>`)
          continue
        }
        const heading = truncate(section.title, Math.floor(colW / (bh * 0.075 * 0.52)))
        parts.push(textEl(x, y + bh * 0.1, heading, { size: bh * 0.075, fill: p.accent, weight: 700, opacity: 0.95 }))
        parts.push(`<rect x="${r(x)}" y="${r(y + bh * 0.16)}" width="${r(colW * 0.5)}" height="${r(Math.max(1, H * 0.003))}" fill="${withAlpha(p.ink, 0.25)}"/>`)
        bodyLines(section, colW, bh * 0.05, 5).forEach((line, li) => {
          parts.push(textEl(x, y + bh * (0.28 + li * 0.13), line, { size: bh * 0.05, fill: withAlpha(p.ink, 0.62) }))
        })
      }
    } else {
      const cards = ci === 1 ? 2 : 3
      const gap = colH * 0.02
      const cardH = (colH - gap * (cards - 1)) / cards
      for (let b = 0; b < cards; b++) {
        const y = top + b * (cardH + gap)
        const bodyTop = y + cardH * 0.2
        const section = nextSection()

        if (!section) {
          // The demo document has fewer cards than this template's grid slot:
          // leave the slot empty rather than inventing a heading.
          continue
        }

        const headingSize = cardH * 0.07
        const heading = truncate(section.title, Math.floor((colW * 0.86) / (headingSize * 0.52)))

        if (art.card.style === "filled-title") {
          parts.push(`<rect x="${r(x)}" y="${r(y)}" width="${r(colW)}" height="${r(cardH)}" rx="${art.card.radius}" fill="${withAlpha(p.accent, art.card.bodyTint)}"/>`)
          parts.push(`<path d="M${r(x)} ${r(y + cardH * 0.2)} L${r(x)} ${r(y + art.card.radius)} Q${r(x)} ${r(y)} ${r(x + art.card.radius)} ${r(y)} L${r(x + colW - art.card.radius)} ${r(y)} Q${r(x + colW)} ${r(y)} ${r(x + colW)} ${r(y + art.card.radius)} L${r(x + colW)} ${r(y + cardH * 0.2)} Z" fill="${p.accent}"/>`)
          parts.push(textEl(x + colW * 0.06, y + cardH * 0.14, heading, { size: headingSize, fill: "#FFFFFF", weight: 700, opacity: 0.96 }))
        } else if (art.card.style === "underlined-title") {
          parts.push(`<rect x="${r(x)}" y="${r(y)}" width="${r(colW)}" height="${r(cardH)}" rx="${art.card.radius}" fill="${withAlpha(p.accent, art.card.bodyTint)}" stroke="${withAlpha(p.accent, 0.28)}"/>`)
          parts.push(textEl(x + colW * 0.06, y + cardH * 0.14, heading, { size: headingSize, fill: p.accent, weight: 700, opacity: 0.95 }))
          parts.push(`<rect x="${r(x + colW * 0.05)}" y="${r(y + cardH * 0.185)}" width="${r(colW * 0.9)}" height="${r(Math.max(1.2, cardH * 0.022))}" fill="${p.accent}"/>`)
        } else if (art.card.style === "left-bar") {
          parts.push(`<rect x="${r(x)}" y="${r(y)}" width="${r(colW)}" height="${r(cardH)}" fill="${p.paper}" stroke="${withAlpha(p.ink, 0.08)}"/>`)
          parts.push(`<rect x="${r(x)}" y="${r(y)}" width="${r(colW * 0.055)}" height="${r(cardH)}" fill="${p.accent}"/>`)
          parts.push(`<rect x="${r(x)}" y="${r(y)}" width="${r(colW)}" height="${r(cardH * 0.2)}" fill="${withAlpha(p.accent, 0.08)}"/>`)
          parts.push(textEl(x + colW * 0.11, y + cardH * 0.135, heading, { size: headingSize, fill: p.accent, weight: 700, opacity: 0.95 }))
        } else {
          // rounded-block (gemini)
          parts.push(`<rect x="${r(x)}" y="${r(y)}" width="${r(colW)}" height="${r(cardH)}" rx="${art.card.radius}" fill="${withAlpha(p.accent, art.card.bodyTint)}"/>`)
          parts.push(`<rect x="${r(x)}" y="${r(y)}" width="${r(colW)}" height="${r(cardH * 0.2)}" rx="${art.card.radius}" fill="${p.accent}"/>`)
          parts.push(textEl(x + colW * 0.06, y + cardH * 0.14, heading, { size: headingSize, fill: "#FFFFFF", weight: 700, opacity: 0.96 }))
        }

        // Body content: the demo card's own lines, sized to fill the card.
        const bodySize = cardH * 0.058
        if (art.statTiles && ci === 1 && b === 0) {
          const statLines = section.lines.slice(0, 3)
          const tileW = colW * 0.28
          statLines.forEach((line, t) => {
            const tx = x + colW * 0.04 + t * (tileW + colW * 0.02)
            parts.push(`<rect x="${r(tx)}" y="${r(bodyTop + cardH * 0.05)}" width="${r(tileW)}" height="${r(cardH * 0.2)}" rx="3" fill="${withAlpha(p.accent, 0.12)}"/>`)
            parts.push(textEl(tx + tileW / 2, bodyTop + cardH * 0.185, truncate(line.replace(/^•\s*/, ""), 16), { size: cardH * 0.055, fill: p.accent, weight: 700, anchor: "middle", opacity: 0.95 }))
          })
          bodyLines(section, colW, bodySize, 3).slice(0, 3).forEach((line, li) => {
            parts.push(textEl(x + colW * 0.06, bodyTop + cardH * (0.38 + li * 0.13), truncate(line, 34), { size: bodySize, fill: withAlpha(p.ink, 0.62) }))
          })
        } else {
          bodyLines(section, colW * 0.88, bodySize, 4).forEach((line, li) => {
            parts.push(textEl(x + colW * 0.06, bodyTop + cardH * (0.13 + li * 0.13), line, { size: bodySize, fill: withAlpha(p.ink, 0.62) }))
          })
          if (section.hasFigure) {
            parts.push(`<rect x="${r(x + colW * 0.06)}" y="${r(bodyTop + cardH * 0.6)}" width="${r(colW * 0.88)}" height="${r(cardH * 0.28)}" rx="2" fill="${withAlpha(p.accent2, 0.18)}"/>`)
          }
        }
      }
    }
    x += colW + gutter
  })

  parts.push("</svg>")
  return parts.join("")
}

/** A4 research-paper mockup with venue-specific masthead and column treatment. */
function renderPaper(
  art: PaperPreviewArt,
  p: PreviewPalette,
  width: number,
  id: string,
  content: PreviewDocumentContent,
): string {
  const W = width
  const H = width * (297 / 210)
  const pad = W * 0.085
  const innerW = W - pad * 2
  const parts: string[] = [svgOpen(W, H, id)]
  parts.push(`<rect width="${r(W)}" height="${r(H)}" fill="${p.paper}"/>`)
  parts.push(`<rect x="0.5" y="0.5" width="${r(W - 1)}" height="${r(H - 1)}" fill="none" stroke="${withAlpha(p.ink, 0.12)}"/>`)

  let y = pad
  const wordmark = art.wordmark
  const markH = H * 0.032
  const runningTitle = truncate(content.title, art.columns === 2 ? 58 : 62)
  if (art.masthead === "band") {
    parts.push(`<rect x="${r(pad)}" y="${r(y)}" width="${r(innerW)}" height="${r(markH * 1.35)}" fill="${withAlpha(p.accent, 0.14)}"/>`)
    if (wordmark) parts.push(`<text x="${r(pad + innerW * 0.035)}" y="${r(y + markH * 0.8)}" font-size="${r(markH * 0.47)}" font-family="${TEXT_FONT}" font-weight="700" letter-spacing="0.5" fill="${p.accent}">${escapeXml(wordmark.toUpperCase())}</text>`)
    if (content.venue) parts.push(textEl(pad + innerW * 0.62, y + markH * 0.75, truncate(content.venue, 42), { size: markH * 0.36, fill: withAlpha(p.ink, 0.55) }))
    y += markH * 1.75
  } else if (art.masthead === "badge") {
    const badgeW = innerW * (wordmark && wordmark.length > 10 ? 0.52 : 0.26)
    parts.push(`<rect x="${r(pad)}" y="${r(y)}" width="${r(badgeW)}" height="${r(markH * 1.12)}" rx="${r(markH * 0.12)}" fill="${p.accent}"/>`)
    if (wordmark) parts.push(`<text x="${r(pad + badgeW * 0.08)}" y="${r(y + markH * 0.72)}" font-size="${r(markH * 0.44)}" font-family="${TEXT_FONT}" font-weight="700" fill="#FFFFFF">${escapeXml(wordmark.toUpperCase())}</text>`)
    if (content.venue) parts.push(textEl(pad + badgeW + innerW * 0.035, y + markH * 0.78, truncate(content.venue, 40), { size: markH * 0.36, fill: withAlpha(p.ink, 0.5) }))
    y += markH * 1.45
  } else if (art.masthead === "publisher") {
    if (wordmark) parts.push(`<text x="${r(pad)}" y="${r(y + markH * 0.72)}" font-size="${r(markH * 0.47)}" font-family="${TEXT_FONT}" font-weight="700" letter-spacing="0.65" fill="${p.accent}">${escapeXml(wordmark.toUpperCase())}</text>`)
    parts.push(`<rect x="${r(pad)}" y="${r(y + markH)}" width="${r(innerW)}" height="${r(Math.max(1, H * 0.0018))}" fill="${p.accent}"/>`)
    y += markH * 1.55
  } else if (art.masthead === "rule") {
    parts.push(`<rect x="${r(pad)}" y="${r(y)}" width="${r(innerW)}" height="${r(Math.max(1.5, H * 0.006))}" fill="${p.accent}"/>`)
    if (wordmark) parts.push(`<text x="${r(pad)}" y="${r(y + markH * 1.45)}" font-size="${r(markH * 0.44)}" font-family="${TEXT_FONT}" font-weight="700" letter-spacing="0.4" fill="${p.accent}">${escapeXml(wordmark.toUpperCase())}</text>`)
    y += markH * 1.85
  } else {
    if (art.runningHeader !== "none") {
      parts.push(textEl(pad, y + markH * 0.2, runningTitle, { size: markH * 0.32, fill: withAlpha(p.ink, 0.55) }))
      if (content.venue) parts.push(textEl(pad + innerW * 0.62, y + markH * 0.2, truncate(content.venue, 30), { size: markH * 0.32, fill: withAlpha(p.ink, 0.55) }))
    }
    y += markH * 1.35
  }

  // Title / authors / venue, as printed in the demo document.
  const titleW = innerW * (art.titleAlign === "center" ? 0.82 : 0.94)
  const titleX = art.titleAlign === "center" ? (W - titleW) / 2 : pad
  const titleSize = H * 0.0182
  const titleLines = wrapToWidth(content.title, titleW, titleSize, 2, true)
  if (art.masthead === "band") {
    const titleH = titleSize * titleLines.length + H * 0.006
    parts.push(`<rect x="${r(titleX)}" y="${r(y - titleSize * 0.5)}" width="${r(titleW)}" height="${r(titleH * 1.35)}" fill="${withAlpha(p.accent, 0.055)}"/>`)
  }
  titleLines.forEach((line, i) => {
    parts.push(textEl(art.titleAlign === "center" ? W / 2 : titleX, y + i * titleSize * 1.16, line, {
      size: titleSize,
      fill: p.ink,
      weight: 700,
      anchor: art.titleAlign === "center" ? "middle" : "start",
      opacity: 0.95,
    }))
  })
  y += titleSize * (titleLines.length + 0.75)

  const authorSize = H * 0.0062
  if (content.authors) {
    parts.push(textEl(art.titleAlign === "center" ? W / 2 : pad, y, truncate(content.authors, Math.floor(titleW / (authorSize * 0.52))), {
      size: authorSize,
      fill: withAlpha(p.accent, 0.9),
      anchor: art.titleAlign === "center" ? "middle" : "start",
    }))
  }
  y += authorSize * 1.5
  if (content.venue) {
    parts.push(textEl(art.titleAlign === "center" ? W / 2 : pad, y, truncate(content.venue, Math.floor(titleW / (authorSize * 0.9 * 0.52))), {
      size: authorSize * 0.9,
      fill: withAlpha(p.ink, 0.5),
      anchor: art.titleAlign === "center" ? "middle" : "start",
    }))
  }
  y += authorSize * 2.2

  // Abstract block is full width in both single- and two-column venues.
  const abstractH = H * 0.105
  if (art.abstract === "shaded") {
    parts.push(`<rect x="${r(pad)}" y="${r(y)}" width="${r(innerW)}" height="${r(abstractH)}" fill="${withAlpha(p.accent, 0.075)}"/>`)
  } else if (art.abstract === "boxed") {
    parts.push(`<rect x="${r(pad)}" y="${r(y)}" width="${r(innerW)}" height="${r(abstractH)}" fill="none" stroke="${withAlpha(p.accent, 0.48)}" stroke-width="${r(Math.max(0.7, W * 0.002))}"/>`)
  }
  parts.push(textEl(pad + innerW * 0.035, y + abstractH * 0.17, "Abstract", { size: abstractH * 0.115, fill: p.accent, weight: 700, opacity: 0.9 }))
  const abstractSize = abstractH * 0.085
  const abstractText = content.abstract ?? content.claim ?? content.sections[0]?.lines.join(" ") ?? ""
  wrapToWidth(abstractText, innerW * 0.94, abstractSize, 4).forEach((line, i) => {
    parts.push(textEl(pad + innerW * 0.035, y + abstractH * (0.36 + i * 0.16), line, { size: abstractSize, fill: withAlpha(p.ink, 0.66) }))
  })
  y += abstractH + H * 0.025

  const columns = art.columns
  const gutter = columns === 2 ? innerW * 0.065 : 0
  const colW = (innerW - gutter * (columns - 1)) / columns
  const bodyTop = y
  const bodyBottom = H - pad - H * 0.07
  const bodyH = Math.max(H * 0.2, bodyBottom - bodyTop)

  const sections = content.sections.slice(0, art.headings === "numbered" ? 6 : 5)
  const groups = groupSections(sections, columns)

  // Auto-size the body type: the largest size at which every section in the
  // busiest column still fits, so short demo documents fill the page instead of
  // leaving the bottom third blank.
  const measure = (group: PreviewSection[], size: number): number => {
    const headingUnit = Math.max(H * 0.0105, colW * 0.03) * 1.7
    return group.reduce((total, section) => {
      const figureSpace = section.hasFigure ? Math.min(H * 0.052, 40) + size * 1.4 : 0
      const isBulleted = section.lines.every((line) => line.startsWith("• "))
      const count = isBulleted
        ? section.lines.length
        : wrapToWidth(section.lines.join(" "), colW, size, 30).length
      return total + headingUnit + count * size * 1.5 + figureSpace + size
    }, 0)
  }
  const baseSize = Math.max(H * 0.0052, colW * 0.0165)
  let bodyTypeSize = baseSize
  for (let size = Math.min(H * 0.011, colW * 0.042); size >= baseSize; size -= 0.12) {
    if (groups.every((group) => group.length === 0 || measure(group, size) <= bodyH)) {
      bodyTypeSize = size
      break
    }
  }

  groups.forEach((group, ci) => {
    const x = pad + ci * (colW + gutter)
    let cursorY = bodyTop
    const available = bodyH / Math.max(1, group.length)
    group.forEach((section, index) => {
      // Start every section at the top of its own band so the column reaches the
      // bottom of the page, the way a typeset paper does.
      cursorY = bodyTop + index * available
      const headingSize = Math.max(H * 0.0105, colW * 0.03)
      const headingText =
        art.headings === "numbered" ? `${index + 1}  ${truncate(section.title, Math.floor((colW * 0.9) / (headingSize * 0.52)))}` : truncate(section.title, Math.floor((colW * 0.95) / (headingSize * 0.52)))
      if (art.headings === "filled") {
        parts.push(`<rect x="${r(x)}" y="${r(cursorY - headingSize * 0.2)}" width="${r(colW)}" height="${r(headingSize * 1.4)}" fill="${withAlpha(p.accent, 0.12)}"/>`)
        parts.push(textEl(x + colW * 0.035, cursorY + headingSize * 0.5, headingText, { size: headingSize, fill: p.accent, weight: 700, opacity: 0.95 }))
        cursorY += headingSize * 1.5
      } else {
        parts.push(textEl(x, cursorY, headingText, { size: headingSize, fill: art.headings === "numbered" ? p.accent : p.ink, weight: 700, opacity: 0.9 }))
        if (art.headings === "ruled") {
          parts.push(`<rect x="${r(x)}" y="${r(cursorY + headingSize * 0.35)}" width="${r(colW)}" height="${r(Math.max(0.8, H * 0.0016))}" fill="${withAlpha(p.ink, 0.3)}"/>`)
        }
        cursorY += headingSize * 1.35
      }

      const bodySize = Math.max(baseSize, Math.min(bodyTypeSize, available / Math.max(2, section.lines.length + 1.6)))
      const figureSpace = section.hasFigure ? Math.min(H * 0.052, available * 0.36) : 0
      const maxLines = Math.max(3, Math.min(12, Math.floor((available - headingSize * 1.7 - figureSpace - bodySize) / (bodySize * 1.5))))
      // Papers set whole paragraphs, so wrap the section text to the column
      // width (bullets keep their own line breaks).
      const isBulleted = section.lines.every((line) => line.startsWith("• "))
      const wrapped = isBulleted
        ? section.lines.slice(0, maxLines)
        : wrapToWidth(section.lines.join(" "), colW, bodySize, maxLines)
      const perLine = Math.max(8, Math.floor(colW / (bodySize * 0.52)))
      wrapped.forEach((line, li) => {
        parts.push(textEl(x, cursorY + li * bodySize * 1.5, truncate(line, perLine), { size: bodySize, fill: withAlpha(p.ink, 0.68) }))
      })
      cursorY += wrapped.length * bodySize * 1.5
      if (section.hasFigure) {
        const figH = Math.min(H * 0.052, available * 0.36)
        parts.push(`<rect x="${r(x)}" y="${r(cursorY + bodySize * 0.4)}" width="${r(colW)}" height="${r(figH)}" rx="2" fill="${withAlpha(p.accent2, 0.16)}"/>`)
        cursorY += figH + bodySize
      }
      cursorY += bodySize * 0.9
    })
  })

  // Footer: real venue and page number.
  const footerY = H - pad * 0.6
  if (art.footer === "copyright") {
    parts.push(textEl(W / 2, footerY, content.venue ? truncate(content.venue, 64) : "© 2026 The Authors", { size: H * 0.005, fill: withAlpha(p.ink, 0.5), anchor: "middle" }))
  } else if (art.footer === "publisher") {
    parts.push(textEl(pad, footerY, wordmark ? wordmark.toUpperCase() : "Proceedings", { size: H * 0.005, fill: withAlpha(p.ink, 0.5) }))
    parts.push(textEl(W - pad, footerY, "1", { size: H * 0.005, fill: withAlpha(p.ink, 0.5), anchor: "start" }))
  } else {
    parts.push(textEl(pad, footerY, runningTitle, { size: H * 0.005, fill: withAlpha(p.ink, 0.45) }))
    parts.push(textEl(W - pad, footerY, "1", { size: H * 0.005, fill: withAlpha(p.ink, 0.45) }))
  }

  parts.push("</svg>")
  return parts.join("")
}

function renderPosudok(art: PosudokPreviewArt, p: PreviewPalette, width: number, id: string): string {
  const style = thesisReviewStyleFor(art.styleId as Parameters<typeof thesisReviewStyleFor>[0])
  const W = width
  const H = width * (297 / 210)
  const pad = W * 0.075
  const innerW = W - pad * 2
  const parts: string[] = [svgOpen(W, H, id)]
  parts.push(`<rect width="${r(W)}" height="${r(H)}" fill="${p.paper}"/>`)
  parts.push(`<rect x="0.5" y="0.5" width="${r(W - 1)}" height="${r(H - 1)}" fill="none" stroke="${withAlpha(p.ink, 0.12)}"/>`)

  let y = pad

  // -- letterhead ------------------------------------------------------------
  const headH = H * 0.055
  if (style.letterhead === "stacked-rule") {
    parts.push(textBar(pad, y, innerW * 0.62, headH * 0.34, p.ink, 0.88))
    parts.push(textBar(pad, y + headH * 0.44, innerW * 0.44, headH * 0.24, p.ink, 0.45))
    parts.push(textBar(W - pad - innerW * 0.26, y, innerW * 0.26, headH * 0.2, p.ink, 0.35))
    parts.push(`<rect x="${r(pad)}" y="${r(y + headH * 0.85)}" width="${r(innerW)}" height="${r(H * 0.004)}" fill="${p.accent}"/>`)
    parts.push(`<rect x="${r(pad)}" y="${r(y + headH * 1.15)}" width="${r(innerW)}" height="${r(Math.max(1, H * 0.0012))}" fill="${p.accent}"/>`)
  } else if (style.letterhead === "shaded-table") {
    parts.push(`<rect x="${r(pad)}" y="${r(y)}" width="${r(innerW)}" height="${r(headH * 0.6)}" fill="${withAlpha(p.accent, 0.16)}"/>`)
    parts.push(textBar(pad + innerW * 0.03, y + headH * 0.18, innerW * 0.5, headH * 0.26, p.ink, 0.88))
    parts.push(`<rect x="${r(pad)}" y="${r(y + headH * 0.85)}" width="${r(innerW)}" height="${r(Math.max(1.4, H * 0.002))}" fill="${p.accent}"/>`)
  } else if (style.letterhead === "rule-bar") {
    parts.push(`<rect x="${r(pad)}" y="${r(y)}" width="${r(innerW)}" height="${r(H * 0.007)}" fill="${p.accent}"/>`)
    parts.push(textBar(pad, y + headH * 0.5, innerW * 0.58, headH * 0.3, p.ink, 0.88))
    parts.push(textBar(W - pad - innerW * 0.28, y + headH * 0.55, innerW * 0.28, headH * 0.2, p.ink, 0.4))
  } else if (style.letterhead === "two-column") {
    parts.push(textBar(pad, y + headH * 0.15, innerW * 0.5, headH * 0.3, p.ink, 0.9))
    parts.push(textBar(W - pad - innerW * 0.3, y + headH * 0.2, innerW * 0.3, headH * 0.2, p.ink, 0.4))
    parts.push(`<rect x="${r(pad)}" y="${r(y + headH * 0.9)}" width="${r(innerW)}" height="${r(Math.max(1.6, H * 0.0026))}" fill="${p.accent}"/>`)
  } else if (style.letterhead === "band") {
    parts.push(`<rect x="${r(pad)}" y="${r(y)}" width="${r(innerW)}" height="${r(headH * 0.66)}" fill="${p.accent}"/>`)
    parts.push(textBar(pad + innerW * 0.03, y + headH * 0.22, innerW * 0.46, headH * 0.24, "#FFFFFF", 0.95))
  } else {
    parts.push(textBar(pad, y, innerW * 0.5, headH * 0.24, p.ink, 0.7))
    parts.push(`<rect x="${r(pad)}" y="${r(y + headH * 0.6)}" width="${r(innerW)}" height="${r(Math.max(1, H * 0.0012))}" fill="${withAlpha(p.ink, 0.4)}"/>`)
  }
  y += headH * 1.6

  // -- title -----------------------------------------------------------------
  const titleH = H * 0.03
  switch (style.titleStyle) {
    case "centered-double-rule":
      parts.push(textBar(W / 2 - innerW * 0.28, y, innerW * 0.56, titleH * 0.5, p.ink, 0.9))
      parts.push(`<rect x="${r(W / 2 - innerW * 0.31)}" y="${r(y + titleH)}" width="${r(innerW * 0.62)}" height="${r(H * 0.0035)}" fill="${p.accent}"/>`)
      parts.push(`<rect x="${r(W / 2 - innerW * 0.2)}" y="${r(y + titleH * 1.35)}" width="${r(innerW * 0.4)}" height="${r(Math.max(1, H * 0.0016))}" fill="${p.accent}"/>`)
      break
    case "left-accent":
      parts.push(`<rect x="${r(pad)}" y="${r(y)}" width="${r(H * 0.006)}" height="${r(titleH * 0.9)}" fill="${p.accent}"/>`)
      parts.push(textBar(pad + H * 0.014, y + titleH * 0.1, innerW * 0.66, titleH * 0.5, p.ink, 0.9))
      parts.push(`<rect x="${r(pad)}" y="${r(y + titleH * 1.2)}" width="${r(innerW)}" height="${r(Math.max(1, H * 0.0012))}" fill="${withAlpha(p.ink, 0.3)}"/>`)
      break
    case "band":
      parts.push(`<rect x="${r(pad)}" y="${r(y)}" width="${r(innerW)}" height="${r(titleH * 1.1)}" fill="${p.accent}"/>`)
      parts.push(textBar(W / 2 - innerW * 0.24, y + titleH * 0.3, innerW * 0.48, titleH * 0.42, "#FFFFFF", 0.95))
      break
    case "rule-pair":
      parts.push(`<rect x="${r(pad)}" y="${r(y)}" width="${r(innerW)}" height="${r(H * 0.004)}" fill="${p.accent}"/>`)
      parts.push(textBar(pad, y + titleH * 0.5, innerW * 0.52, titleH * 0.44, p.ink, 0.9))
      parts.push(`<rect x="${r(pad)}" y="${r(y + titleH * 1.2)}" width="${r(innerW)}" height="${r(H * 0.004)}" fill="${p.accent}"/>`)
      break
    case "centered-band":
      parts.push(textBar(W / 2 - innerW * 0.3, y, innerW * 0.6, titleH * 0.5, p.ink, 0.9))
      parts.push(`<rect x="${r(W / 2 - innerW * 0.25)}" y="${r(y + titleH * 0.85)}" width="${r(innerW * 0.5)}" height="${r(H * 0.005)}" fill="${p.accent}"/>`)
      break
    default:
      parts.push(textBar(pad, y, innerW * 0.54, titleH * 0.5, p.ink, 0.9))
      parts.push(`<rect x="${r(pad)}" y="${r(y + titleH * 0.9)}" width="${r(innerW)}" height="${r(Math.max(1.4, H * 0.002))}" fill="${p.accent}"/>`)
  }
  y += titleH * 1.9

  // -- identification block --------------------------------------------------
  const rowH = H * 0.0165
  for (let i = 0; i < 4; i++) {
    const labelW = innerW * (i === 1 ? 0.34 : 0.26)
    parts.push(textBar(pad, y + i * rowH, labelW, rowH * 0.42, withAlpha(p.ink, 0.55)))
    parts.push(textBar(pad + labelW + innerW * 0.03, y + i * rowH, innerW * (i === 1 ? 0.6 : 0.42), rowH * 0.42, p.ink, 0.8))
  }
  y += rowH * 4 + H * 0.018

  // -- weighted criteria table ----------------------------------------------
  const tableHead = y
  const colW = innerW * (style.showWeights ? 0.12 : 0)
  const pointsW = style.showPoints ? innerW * 0.11 : 0
  const ratingW = innerW * 0.1
  const nameW = innerW - colW - pointsW - ratingW
  parts.push(textBar(pad, tableHead, nameW * 0.7, rowH * 0.4, withAlpha(p.ink, 0.6)))
  if (style.showWeights) parts.push(textBar(pad + nameW + colW * 0.2, tableHead, colW * 0.6, rowH * 0.4, withAlpha(p.ink, 0.6)))
  if (style.showPoints) parts.push(textBar(pad + nameW + colW + pointsW * 0.2, tableHead, pointsW * 0.6, rowH * 0.4, withAlpha(p.ink, 0.6)))
  parts.push(textBar(pad + nameW + colW + pointsW + ratingW * 0.2, tableHead, ratingW * 0.6, rowH * 0.4, withAlpha(p.ink, 0.6)))
  parts.push(`<rect x="${r(pad)}" y="${r(tableHead + rowH * 0.75)}" width="${r(innerW)}" height="${r(Math.max(1.2, H * 0.0022))}" fill="${withAlpha(p.ink, style.criteriaTable === "boxed-ratings" ? 0.5 : 0.28)}"/>`)
  if (style.criteriaTable === "weighted-shaded") {
    parts.push(`<rect x="${r(pad)}" y="${r(tableHead - rowH * 0.3)}" width="${r(innerW)}" height="${r(rowH * 1.05)}" fill="${p.accent}" opacity="0.9"/>`)
  } else if (style.criteriaTable === "band-rows") {
    parts.push(`<rect x="${r(pad)}" y="${r(tableHead - rowH * 0.3)}" width="${r(innerW)}" height="${r(rowH * 1.05)}" fill="${withAlpha(p.ink, 0.08)}"/>`)
  }

  const tableTop = tableHead + rowH * 1.1
  for (let i = 0; i < art.rows; i++) {
    const rowY = tableTop + i * rowH * 1.05
    const banded =
      (style.criteriaTable === "band-rows" || style.criteriaTable === "weighted-shaded") && i % 2 === 1
    if (banded) {
      parts.push(`<rect x="${r(pad)}" y="${r(rowY - rowH * 0.15)}" width="${r(innerW)}" height="${r(rowH * 0.85)}" fill="${withAlpha(p.ink, 0.05)}"/>`)
    }
    if (style.criteriaTable === "ruled-rows" && i > 0) {
      parts.push(`<rect x="${r(pad)}" y="${r(rowY - rowH * 0.2)}" width="${r(innerW)}" height="1" fill="${withAlpha(p.ink, 0.2)}"/>`)
    }
    parts.push(textBar(pad, rowY, nameW * (i % 2 ? 0.62 : 0.78), rowH * 0.38, withAlpha(p.ink, 0.75)))
    if (style.showWeights) parts.push(textBar(pad + nameW + colW * 0.25, rowY, colW * 0.5, rowH * 0.34, withAlpha(p.ink, 0.4)))
    if (style.showPoints) parts.push(textBar(pad + nameW + colW + pointsW * 0.25, rowY, pointsW * 0.5, rowH * 0.34, withAlpha(p.ink, 0.4)))
    // the rating cell, drawn with the style's own rating symbol
    const letter = art.ratings[i] ?? "A"
    const cx = pad + nameW + colW + pointsW
    const boxW = ratingW * 0.44
    const boxH = rowH * 0.62
    switch (style.ratingSymbol) {
      case "fbox":
        parts.push(`<rect x="${r(cx)}" y="${r(rowY - rowH * 0.08)}" width="${r(boxW)}" height="${r(boxH)}" fill="none" stroke="${withAlpha(p.ink, 0.7)}" stroke-width="1"/>`)
        break
      case "shaded":
        parts.push(`<rect x="${r(cx)}" y="${r(rowY - rowH * 0.08)}" width="${r(boxW)}" height="${r(boxH)}" fill="${withAlpha(p.ink, 0.12)}"/>`)
        break
      case "bold":
        break
      case "dark":
        parts.push(`<rect x="${r(cx)}" y="${r(rowY - rowH * 0.08)}" width="${r(boxW)}" height="${r(boxH)}" fill="${p.accent}"/>`)
        break
      case "circled":
        parts.push(`<circle cx="${r(cx + boxW / 2)}" cy="${r(rowY + rowH * 0.23)}" r="${r(boxH / 2)}" fill="none" stroke="${withAlpha(p.ink, 0.7)}" stroke-width="1"/>`)
        break
      default:
        parts.push(`<rect x="${r(cx)}" y="${r(rowY - rowH * 0.08)}" width="${r(boxW)}" height="${r(boxH)}" fill="${withAlpha(p.accent, 0.92)}"/>`)
    }
    parts.push(
      `<text x="${r(cx + boxW / 2)}" y="${r(rowY + rowH * 0.3)}" font-size="${r(Math.max(6, rowH * 0.56))}" ` +
        `text-anchor="middle" font-family="Times New Roman, serif" ` +
        `fill="${["dark", "band"].includes(style.ratingSymbol) ? "#FFFFFF" : INK}">${letter}</text>`,
    )
  }
  let afterTable = tableTop + art.rows * rowH * 1.05 + H * 0.012
  parts.push(`<rect x="${r(pad)}" y="${r(afterTable)}" width="${r(innerW)}" height="${r(Math.max(1.2, H * 0.0022))}" fill="${withAlpha(p.ink, 0.28)}"/>`)
  afterTable += H * 0.012
  // weighted-average footer
  parts.push(textBar(pad, afterTable, innerW * 0.44, rowH * 0.34, withAlpha(p.ink, 0.5)))
  parts.push(textBar(pad + innerW * 0.46, afterTable, innerW * 0.18, rowH * 0.34, p.accent, 0.85))
  afterTable += H * 0.02

  // -- classification panel + signature --------------------------------------
  // Each design states the grade its own way; the chip is drawn twice (once on
  // the classification line, once inside the closing panel), so it lives in a
  // helper rather than in a duplicated switch.
  const gradeH = H * 0.036
  const drawGrade = (x: number, yTop: number, h: number) => {
    switch (style.gradeStyle) {
      case "fbox":
        parts.push(`<rect x="${r(x)}" y="${r(yTop)}" width="${r(h * 1.5)}" height="${r(h * 0.85)}" fill="none" stroke="${withAlpha(p.ink, 0.75)}" stroke-width="1.4"/>`)
        parts.push(`<text x="${r(x + h * 0.75)}" y="${r(yTop + h * 0.66)}" font-size="${r(h * 0.6)}" text-anchor="middle" font-family="Times New Roman, serif" fill="${INK}">A</text>`)
        break
      case "table-cell":
        parts.push(`<rect x="${r(x)}" y="${r(yTop)}" width="${r(h * 1.6)}" height="${r(h * 0.85)}" fill="${p.accent}"/>`)
        parts.push(`<text x="${r(x + h * 0.8)}" y="${r(yTop + h * 0.66)}" font-size="${r(h * 0.6)}" text-anchor="middle" font-family="Times New Roman, serif" fill="#FFFFFF">A</text>`)
        break
      case "circled":
        parts.push(`<circle cx="${r(x + h * 0.5)}" cy="${r(yTop + h * 0.42)}" r="${r(h * 0.45)}" fill="none" stroke="${p.accent}" stroke-width="1.8"/>`)
        parts.push(`<text x="${r(x + h * 0.5)}" y="${r(yTop + h * 0.64)}" font-size="${r(h * 0.58)}" text-anchor="middle" font-family="Times New Roman, serif" fill="${INK}">A</text>`)
        break
      case "inline-bold":
        parts.push(textBar(x, yTop + h * 0.18, Math.min(innerW * 0.08, W - pad - x), h * 0.55, p.accent))
        break
      default: {
        // A two-line grade/number pair (panel, band). The bars are clamped to the
        // page so the closing panel cannot push them past the right margin.
        const w = Math.min(innerW * 0.22, W - pad - x)
        parts.push(textBar(x, yTop + h * 0.14, w, h * 0.3, withAlpha(p.ink, 0.5)))
        parts.push(textBar(x, yTop + h * 0.6, Math.min(w * 1.15, W - pad - x), h * 0.3, withAlpha(p.ink, 0.35)))
      }
    }
  }
  if (style.gradeStyle === "panel") {
    parts.push(textBar(pad, afterTable + gradeH * 0.22, innerW * 0.44, gradeH * 0.34, withAlpha(p.ink, 0.5)))
    parts.push(textBar(pad, afterTable + gradeH * 0.7, innerW * 0.52, gradeH * 0.34, withAlpha(p.ink, 0.35)))
  } else {
    parts.push(textBar(pad, afterTable + gradeH * 0.25, innerW * 0.3, gradeH * 0.4, withAlpha(p.ink, 0.7)))
    drawGrade(pad + innerW * 0.35, afterTable, gradeH)
  }

  // -- per-criterion assessment + defence questions --------------------------
  // A real posudok is a full page: after the table it continues with the
  // reviewer's commentary per criterion and the questions for the defence. A
  // mockup with two thirds of the page blank would misrepresent the document.
  let bodyY = afterTable + gradeH * 1.9
  const sigY = H - pad - H * 0.045
  const lineH = H * 0.0095
  const sectionGap = H * 0.018

  const heading = (title: string, marker: string) => {
    if (marker === "rule" || marker === "square") {
      parts.push(`<rect x="${r(pad)}" y="${r(bodyY)}" width="${r(H * 0.004)}" height="${r(lineH * 1.3)}" fill="${p.accent}"/>`)
      parts.push(textBar(pad + H * 0.01, bodyY, innerW * 0.34, lineH * 0.95, withAlpha(p.ink, 0.8)))
    } else if (marker === "bar") {
      parts.push(`<rect x="${r(pad)}" y="${r(bodyY - lineH * 0.15)}" width="${r(innerW * 0.3)}" height="${r(lineH * 1.4)}" fill="${p.accent}"/>`)
      parts.push(textBar(pad + innerW * 0.02, bodyY + lineH * 0.2, innerW * 0.2, lineH * 0.7, "#FFFFFF", 0.92))
    } else if (marker === "band") {
      parts.push(`<rect x="${r(pad)}" y="${r(bodyY - lineH * 0.15)}" width="${r(innerW)}" height="${r(lineH * 1.5)}" fill="${withAlpha(p.ink, 0.08)}"/>`)
      parts.push(textBar(pad + H * 0.01, bodyY + lineH * 0.15, innerW * 0.34, lineH * 0.95, withAlpha(p.ink, 0.8)))
    } else {
      parts.push(textBar(pad, bodyY, innerW * 0.34, lineH * 0.95, withAlpha(p.ink, 0.8)))
    }
    void title
    bodyY += lineH * 2.4
  }

  const paragraph = (lines: number, widths: number[] = [0.96, 0.88, 0.93, 0.7]) => {
    for (let i = 0; i < lines; i++) {
      parts.push(textBar(pad, bodyY, innerW * widths[i % widths.length], lineH * 0.62, withAlpha(p.ink, 0.3)))
      bodyY += lineH * 1.25
    }
    bodyY += sectionGap * 0.35
  }

  // Two assessed criteria with a heading each, then the defence questions:
  // the page fills the way a real posudok does.
  for (let block = 0; block < 2; block++) {
    heading("", style.sectionMarker)
    paragraph(block === 0 ? 4 : 5)
  }
  heading("", style.sectionMarker)
  for (let q = 0; q < 3; q++) {
    parts.push(textBar(pad + innerW * 0.02, bodyY, innerW * (q % 2 ? 0.66 : 0.78), lineH * 0.62, withAlpha(p.ink, 0.3)))
    bodyY += lineH * 1.3
  }
  void sigY
  void sectionGap

  // -- closing assessment panel + signature ----------------------------------
  // The real posudok ends with an assessment panel above the signature line.
  // Anchoring it to the bottom and letting the commentary above flow into the
  // remaining room keeps the page full on every design instead of leaving a
  // band of blank paper above the signatures.
  const panelH = H * 0.115
  const panelTop = sigY - H * 0.02 - panelH
  let extra = 0
  while (extra < 3 && panelTop - bodyY > lineH * 7) {
    heading("", style.sectionMarker)
    const room = Math.floor((panelTop - bodyY) / (lineH * 1.25)) - 1
    paragraph(Math.max(2, Math.min(5, room)))
    extra++
  }
  if (panelTop - bodyY > lineH * 1.2) {
    parts.push(`<rect x="${r(pad)}" y="${r(panelTop)}" width="${r(innerW)}" height="${r(panelH)}" fill="${withAlpha(p.ink, 0.05)}" stroke="${withAlpha(p.ink, 0.16)}"/>`)
    parts.push(textBar(pad + H * 0.012, panelTop + panelH * 0.16, innerW * 0.32, lineH * 0.95, withAlpha(p.ink, 0.8)))
    parts.push(textBar(pad + H * 0.012, panelTop + panelH * 0.42, innerW * 0.46, lineH * 0.6, withAlpha(p.ink, 0.35)))
    parts.push(textBar(pad + H * 0.012, panelTop + panelH * 0.62, innerW * 0.38, lineH * 0.6, withAlpha(p.ink, 0.28)))
    parts.push(textBar(W - pad - H * 0.012 - innerW * 0.2, panelTop + panelH * 0.24, innerW * 0.2, lineH * 0.7, p.accent, 0.9))
    drawGrade(W - pad - innerW * 0.22, panelTop + panelH * 0.52, gradeH * 0.95)
  }

  parts.push(`<rect x="${r(pad)}" y="${r(sigY)}" width="${r(innerW * 0.44)}" height="1" fill="${withAlpha(p.ink, 0.6)}"/>`)
  parts.push(`<rect x="${r(W - pad - innerW * 0.28)}" y="${r(sigY)}" width="${r(innerW * 0.28)}" height="1" fill="${withAlpha(p.ink, 0.6)}"/>`)
  parts.push(textBar(pad, sigY + H * 0.008, innerW * 0.22, rowH * 0.3, withAlpha(p.ink, 0.35)))

  parts.push("</svg>")
  return parts.join("")
}

/**
 * One 16:9 slide drawn into the given box. `which` selects the title slide or
 * the content slide, so the same frame can be shown on its own (the mockup
 * laptop) or two-up on a printed handout sheet.
 */
/** Largest title size (within a range) at which `text` fits `maxLines` without ellipsis. */
function fitTitleSize(value: string, width: number, maxSize: number, minSize: number, maxLines: number): { size: number; lines: string[] } {
  for (let step = 0; step < 8; step++) {
    const size = maxSize - ((maxSize - minSize) * step) / 7
    const lines = wrapToWidth(value, width, size, maxLines)
    const joined = lines.join(" ").replace(/…$/, "")
    if (joined.length >= value.replace(/\s+/g, " ").trim().length) return { size, lines }
  }
  return { size: minSize, lines: wrapToWidth(value, width, minSize, maxLines) }
}

function slideFrame(
  art: SlidePreviewArt,
  p: PreviewPalette,
  box: { x: number; y: number; w: number; h: number },
  which: "title" | "content",
  content: PreviewDocumentContent,
): string[] {
  const { x, y, w, h } = box
  const parts: string[] = []

  if (which === "title") {
    // Title slide: the demo document's title, authors and venue.
    const dark = art.darkTitleSlide
    const titleW = w * 0.82
    const { size: titleSize, lines: titleLines } = fitTitleSize(
      content.title,
      titleW,
      h * (dark ? 0.115 : 0.105),
      h * 0.068,
      4,
    )
    const startY = h * (dark ? 0.3 : 0.16 + h * 0.28)

    parts.push(
      dark
        ? `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" fill="${p.ink}"/>`
        : `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" fill="${p.paper}" stroke="${withAlpha(p.ink, 0.14)}"/>`,
    )
    if (dark) {
      parts.push(`<rect x="${r(x)}" y="${r(y + h - h * 0.09)}" width="${r(w)}" height="${r(h * 0.09)}" fill="${p.accent}"/>`)
    } else {
      parts.push(`<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h * 0.5)}" fill="${p.accent}"/>`)
    }
    const titleFill = dark ? "#FFFFFF" : "#FFFFFF"
    const firstY = dark ? y + h * 0.3 : y + h * 0.13
    const lineGap = titleSize * 1.24
    titleLines.forEach((line, i) => {
      const ly = dark ? firstY + i * lineGap : firstY + i * lineGap
      if (!dark && ly > y + h * 0.44) return // keep the light title inside its band
      parts.push(textEl(x + w / 2, ly, line, { size: titleSize, fill: titleFill, weight: 700, anchor: "middle", opacity: 0.97 }))
    })
    if (dark) {
      parts.push(`<rect x="${r(x + w * 0.42)}" y="${r(y + h * 0.62)}" width="${r(w * 0.16)}" height="${r(Math.max(1.5, h * 0.02))}" fill="${p.accent}"/>`)
    }
    const metaSize = h * 0.062
    const meta = content.authors ?? ""
    if (meta) {
      parts.push(textEl(x + w / 2, y + h * (dark ? 0.76 : 0.79), truncate(meta, Math.floor((w * 0.86) / (metaSize * 0.52))), {
        size: metaSize, fill: dark ? "#FFFFFF" : p.ink, anchor: "middle", opacity: dark ? 0.6 : 0.5,
      }))
    }
    if (content.venue) {
      parts.push(textEl(x + w / 2, y + h * (dark ? 0.88 : 0.9), truncate(content.venue, Math.floor((w * 0.8) / (metaSize * 0.44 * 0.52))), {
        size: metaSize * 0.44, fill: dark ? "#FFFFFF" : p.ink, anchor: "middle", opacity: dark ? 0.42 : 0.38,
      }))
    }
    return parts
  }

  // Content slide: the first demo section, its heading and its bullet lines.
  const section = content.sections[0]
  const bodyWidth = w * 0.9
  parts.push(`<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" fill="${p.paper}" stroke="${withAlpha(p.ink, 0.14)}"/>`)

  const headerTitle = truncate(section?.title ?? content.title, Math.floor((w * 0.62) / (h * 0.09 * 0.52)))
  if (art.header === "band") {
    parts.push(`<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h * 0.24)}" fill="${p.accent}"/>`)
    parts.push(textEl(x + w * 0.04, y + h * 0.155, headerTitle, { size: h * 0.085, fill: "#FFFFFF", weight: 700, opacity: 0.96 }))
    if (content.venue) parts.push(textEl(x + w * 0.04, y + h * 0.205, truncate(content.venue, 46), { size: h * 0.045, fill: "#FFFFFF", opacity: 0.6 }))
  } else if (art.header === "rule") {
    parts.push(`<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h * 0.055)}" fill="${p.accent}"/>`)
    parts.push(textEl(x + w * 0.04, y + h * 0.19, headerTitle, { size: h * (art.titleWeight === "heavy" ? 0.1 : 0.075), fill: p.ink, weight: 700, opacity: 0.9 }))
    parts.push(`<rect x="${r(x + w * 0.04)}" y="${r(y + h * 0.26)}" width="${r(w * 0.1)}" height="${r(Math.max(1.4, h * 0.022))}" fill="${p.accent}"/>`)
  } else {
    parts.push(textEl(x + w * 0.04, y + h * 0.16, headerTitle, { size: h * 0.075, fill: p.ink, weight: 700, opacity: 0.88 }))
  }

  const bodyTop = y + h * (art.header === "plain" ? 0.26 : 0.34)
  const bodyH = y + h * (art.footer === "none" ? 0.94 : 0.86) - bodyTop
  const bullets = (section?.lines ?? []).slice(0, 5).map((line) => line.replace(/^•\s*/, ""))
  const bulletSize = Math.min(bodyH * 0.13, w * 0.032)

  if (art.body === "columns") {
    const colW = (w - w * 0.05) / 2 - w * 0.01
    bullets.forEach((bullet, index) => {
      const c = index % 2
      const row = Math.floor(index / 2)
      const cx = x + w * 0.025 + c * (colW + w * 0.02)
      const by = bodyTop + Math.min(bodyH * 0.22, bulletSize * 1.7) * (row + 0.6)
      parts.push(`<circle cx="${r(cx + 3)}" cy="${r(by - bulletSize * 0.32)}" r="2" fill="${p.accent}"/>`)
      parts.push(textEl(cx + 8, by, truncate(bullet, Math.floor((colW - 10) / (bulletSize * 0.52))), { size: bulletSize, fill: withAlpha(p.ink, 0.68) }))
    })
  } else if (art.body === "figure") {
    bullets.slice(0, 2).forEach((bullet, index) => {
      parts.push(textEl(x + w * 0.025, bodyTop + bodyH * (0.14 + index * 0.2), truncate(bullet, Math.floor((w * 0.36) / (bulletSize * 0.52))), {
        size: bulletSize, fill: withAlpha(p.ink, 0.68),
      }))
    })
    parts.push(`<rect x="${r(x + w * 0.42)}" y="${r(bodyTop)}" width="${r(w * 0.5)}" height="${r(bodyH * 0.85)}" rx="3" fill="${withAlpha(p.accent, 0.16)}"/>`)
  } else {
    const rows = Math.max(1, bullets.length)
    bullets.forEach((bullet, index) => {
      const ry = bodyTop + bodyH * (0.1 + index * Math.min(0.2, 0.82 / rows))
      parts.push(`<circle cx="${r(x + w * 0.035)}" cy="${r(ry - bulletSize * 0.3)}" r="2.2" fill="${p.accent}"/>`)
      parts.push(textEl(x + w * 0.055, ry, truncate(bullet, Math.floor(bodyWidth / (bulletSize * 0.52))), { size: bulletSize, fill: withAlpha(p.ink, 0.68) }))
    })
  }

  if (art.footer === "bar") {
    parts.push(`<rect x="${r(x)}" y="${r(y + h * 0.9)}" width="${r(w)}" height="${r(h * 0.1)}" fill="${withAlpha(p.accent, 0.9)}"/>`)
    parts.push(textEl(x + w * 0.02, y + h * 0.965, truncate(content.title, 30), { size: h * 0.038, fill: "#FFFFFF", opacity: 0.9 }))
    parts.push(textEl(x + w * 0.98, y + h * 0.965, "1", { size: h * 0.038, fill: "#FFFFFF", opacity: 0.9, anchor: "start" }))
  } else if (art.footer === "rule") {
    parts.push(`<rect x="${r(x + w * 0.025)}" y="${r(y + h * 0.93)}" width="${r(w * 0.95)}" height="${r(Math.max(1, h * 0.012))}" fill="${withAlpha(p.ink, 0.18)}"/>`)
    parts.push(textEl(x + w * 0.91, y + h * 0.915, "1", { size: h * 0.05, fill: withAlpha(p.ink, 0.5) }))
  }

  return parts
}

/** Two slides on one handout page (the printed companion to the deck). */
function renderSlide(
  art: SlidePreviewArt,
  p: PreviewPalette,
  width: number,
  id: string,
  content: PreviewDocumentContent,
): string {
  const W = width
  const H = width * (9 / 16)
  const pad = W * 0.03
  const slideH = (H - pad * 2) * 0.46
  const parts: string[] = [
    svgOpen(W, H, id),
    ...slideFrame(art, p, { x: pad, y: pad, w: W - pad * 2, h: slideH }, "title", content),
    ...slideFrame(art, p, { x: pad, y: pad + slideH + pad, w: W - pad * 2, h: slideH }, "content", content),
    "</svg>",
  ]
  return parts.join("")
}
