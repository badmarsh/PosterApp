/**
 * Declarative preview art for output templates.
 *
 * The template picker used to draw one of four generic schematics
 * (`layoutPreview` in lib/output-types.ts), so every poster looked identical
 * and every slide deck looked identical. This module replaces that with a
 * per-template description of the *actual* visual language the LaTeX template
 * implements — title band, card treatment, column widths, stat tiles — plus a
 * renderer that turns it into SVG.
 *
 * Keeping it declarative (rather than one hand-drawn SVG per template) means
 * the artwork can never drift from the palette the user picks: the renderer
 * takes the template's `colors` at call time.
 *
 * Consumers:
 *  - `scripts/generate-template-previews.mjs` writes `public/template-previews/*.svg`
 *  - `components/poster-preview.tsx` renders the same SVG inline in the picker
 */

import type { TemplateColor, TemplateDef } from "./output-types"
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

export type TemplatePreviewArt = PosterPreviewArt | SlidePreviewArt | PosudokPreviewArt

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

/** Build a sensible spec for a template that has no bespoke art yet. */
export function derivePreviewArt(t: TemplateDef): TemplatePreviewArt {
  if (t.outputType === "slides") {
    return { kind: "slide", header: "plain", titleWeight: "plain", footer: "none", body: "bullets", darkTitleSlide: false }
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
  if (THESIS_REVIEW_STYLES[posudokStyleIdFor(templateId)]) {
    return derivePreviewArt({ ...(def ?? {}), id: templateId, outputType: "thesis-review" } as TemplateDef)
  }
  return def ? derivePreviewArt(def) : derivePreviewArt({ layoutPreview: "poster-3col" } as TemplateDef)
}

type ThesisReviewTemplateId = keyof typeof THESIS_REVIEW_STYLES

/** Map a template id to a posudok style id (tolerates legacy aliases). */
function posudokStyleIdFor(templateId: string): ThesisReviewTemplateId {
  if (templateId in THESIS_REVIEW_STYLES) return templateId as ThesisReviewTemplateId
  const match = (Object.keys(THESIS_REVIEW_STYLES) as ThesisReviewTemplateId[]).find(
    (id) => id.replace(/^posudok-/, "") === templateId.replace(/^(posudok|posudek|gutachten|recenzja|biralat)-/, ""),
  )
  return match ?? "posudok-sk"
}

/** True when the preview art for a template is bespoke rather than derived. */
export function hasBespokePreviewArt(templateId: string): boolean {
  return Object.prototype.hasOwnProperty.call(PREVIEW_ART, templateId)
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

/**
 * Render the SVG mockup for a template.
 *
 * @param width  Output width in SVG user units. Height follows the template's
 *               orientation (posters are portrait/landscape boards, slides 16:9).
 */
export function renderTemplatePreviewSvg(
  templateId: string,
  colors: TemplateColor[],
  width = 320,
  def?: TemplateDef,
): string {
  const art = getPreviewArt(templateId, def)
  const p = paletteFrom(colors)
  if (art.kind === "posudok") return renderPosudok(art, p, width, templateId)
  return art.kind === "poster"
    ? renderPoster(art, p, width, templateId)
    : renderSlide(art, p, width, templateId)
}

function svgOpen(w: number, h: number, id: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${r(h)}" viewBox="0 0 ${w} ${r(h)}" ` +
    `role="img" aria-label="${id} template preview">`
  )
}

function renderPoster(art: PosterPreviewArt, p: PreviewPalette, width: number, id: string): string {
  const W = width
  const H = art.orientation === "landscape" ? width * (841 / 1189) : width * (1189 / 841)
  const pad = W * 0.035
  const bandH = H * art.titleBand.height
  const parts: string[] = [svgOpen(W, H, id)]

  // Board
  parts.push(`<rect width="${r(W)}" height="${r(H)}" fill="${art.titleBand.fill === "ink" ? withAlpha(p.ink, 0.03) : p.paper}"/>`)
  parts.push(`<rect x="0.5" y="0.5" width="${r(W - 1)}" height="${r(H - 1)}" fill="none" stroke="${withAlpha(p.ink, 0.14)}"/>`)

  // Title band
  if (art.titleBand.fill !== "none") {
    const fill = art.titleBand.fill === "ink" ? p.ink : p.accent
    parts.push(
      `<rect x="${r(pad)}" y="${r(pad)}" width="${r(W - pad * 2)}" height="${r(bandH)}" rx="${art.titleBand.radius}" fill="${fill}"/>`,
    )
    const tw = (W - pad * 2) * 0.6
    parts.push(textBar(W / 2 - tw / 2, pad + bandH * 0.28, tw, bandH * 0.16, "#FFFFFF", 0.95))
    parts.push(textBar(W / 2 - tw * 0.32, pad + bandH * 0.58, tw * 0.64, bandH * 0.1, "#FFFFFF", 0.6))
    if (art.logoChips) {
      const chip = bandH * 0.5
      parts.push(`<rect x="${r(pad * 2)}" y="${r(pad + bandH / 2 - chip / 2)}" width="${r(chip)}" height="${r(chip)}" rx="3" fill="#FFFFFF" opacity="0.85"/>`)
      parts.push(`<rect x="${r(W - pad * 2 - chip)}" y="${r(pad + bandH / 2 - chip / 2)}" width="${r(chip)}" height="${r(chip)}" rx="3" fill="#FFFFFF" opacity="0.85"/>`)
    }
  } else {
    parts.push(textBar(pad, pad + bandH * 0.15, (W - pad * 2) * 0.7, bandH * 0.28, p.ink, 0.9))
    parts.push(textBar(pad, pad + bandH * 0.6, (W - pad * 2) * 0.42, bandH * 0.14, p.ink, 0.45))
  }

  if (art.accentRule) {
    parts.push(`<rect x="${r(pad)}" y="${r(pad + bandH + 2)}" width="${r(W - pad * 2)}" height="${r(Math.max(1.5, H * 0.004))}" fill="${p.accent}"/>`)
  }

  // Columns
  const top = pad + bandH + (art.accentRule ? 8 : 6)
  const bottom = H - pad
  const gutter = (W - pad * 2) * 0.022
  const usableW = W - pad * 2 - gutter * (art.columnWidths.length - 1)
  let x = pad

  art.columnWidths.forEach((frac, ci) => {
    const colW = usableW * frac
    const colH = bottom - top
    if (art.card.style === "hero" && ci === 1) {
      // Better Poster: one enormous plain-language finding in the middle.
      parts.push(`<rect x="${r(x)}" y="${r(top)}" width="${r(colW)}" height="${r(colH * 0.62)}" rx="${art.card.radius}" fill="${withAlpha(p.accent, 0.08)}"/>`)
      parts.push(textBar(x + colW * 0.12, top + colH * 0.2, colW * 0.76, colH * 0.055, p.ink, 0.9))
      parts.push(textBar(x + colW * 0.18, top + colH * 0.3, colW * 0.64, colH * 0.055, p.ink, 0.9))
      parts.push(textBar(x + colW * 0.26, top + colH * 0.4, colW * 0.48, colH * 0.055, p.ink, 0.9))
      parts.push(`<rect x="${r(x)}" y="${r(top + colH * 0.68)}" width="${r(colW)}" height="${r(colH * 0.3)}" fill="${withAlpha(p.accent2, 0.1)}"/>`)
    } else if (art.card.style === "plain-section") {
      // No card chrome: a heading rule then body text.
      const blocks = 3
      const bh = colH / blocks
      for (let b = 0; b < blocks; b++) {
        const y = top + b * bh
        parts.push(textBar(x, y + bh * 0.06, colW * 0.7, bh * 0.07, p.accent, 0.95))
        parts.push(`<rect x="${r(x)}" y="${r(y + bh * 0.16)}" width="${r(colW * 0.5)}" height="${r(Math.max(1, H * 0.003))}" fill="${withAlpha(p.ink, 0.25)}"/>`)
        for (let l = 0; l < 5; l++) {
          parts.push(textBar(x, y + bh * (0.26 + l * 0.13), colW * (l % 2 ? 0.82 : 0.98), bh * 0.05, withAlpha(p.ink, 0.28)))
        }
      }
    } else {
      const cards = ci === 1 ? 2 : 3
      const gap = colH * 0.02
      const cardH = (colH - gap * (cards - 1)) / cards
      for (let b = 0; b < cards; b++) {
        const y = top + b * (cardH + gap)
        const bodyTop = y + cardH * 0.2
        const bodyH = cardH * 0.8

        if (art.card.style === "filled-title") {
          parts.push(`<rect x="${r(x)}" y="${r(y)}" width="${r(colW)}" height="${r(cardH)}" rx="${art.card.radius}" fill="${withAlpha(p.accent, art.card.bodyTint)}"/>`)
          parts.push(`<path d="M${r(x)} ${r(y + cardH * 0.2)} L${r(x)} ${r(y + art.card.radius)} Q${r(x)} ${r(y)} ${r(x + art.card.radius)} ${r(y)} L${r(x + colW - art.card.radius)} ${r(y)} Q${r(x + colW)} ${r(y)} ${r(x + colW)} ${r(y + art.card.radius)} L${r(x + colW)} ${r(y + cardH * 0.2)} Z" fill="${p.accent}"/>`)
          parts.push(textBar(x + colW * 0.06, y + cardH * 0.07, colW * 0.6, cardH * 0.07, "#FFFFFF", 0.95))
        } else if (art.card.style === "underlined-title") {
          parts.push(`<rect x="${r(x)}" y="${r(y)}" width="${r(colW)}" height="${r(cardH)}" rx="${art.card.radius}" fill="${withAlpha(p.accent, art.card.bodyTint)}" stroke="${withAlpha(p.accent, 0.28)}"/>`)
          parts.push(textBar(x + colW * 0.06, y + cardH * 0.07, colW * 0.62, cardH * 0.07, p.accent, 0.95))
          parts.push(`<rect x="${r(x + colW * 0.05)}" y="${r(y + cardH * 0.185)}" width="${r(colW * 0.9)}" height="${r(Math.max(1.2, cardH * 0.022))}" fill="${p.accent}"/>`)
        } else if (art.card.style === "left-bar") {
          parts.push(`<rect x="${r(x)}" y="${r(y)}" width="${r(colW)}" height="${r(cardH)}" fill="${p.paper}" stroke="${withAlpha(p.ink, 0.08)}"/>`)
          parts.push(`<rect x="${r(x)}" y="${r(y)}" width="${r(colW * 0.055)}" height="${r(cardH)}" fill="${p.accent}"/>`)
          parts.push(`<rect x="${r(x)}" y="${r(y)}" width="${r(colW)}" height="${r(cardH * 0.2)}" fill="${withAlpha(p.accent, 0.08)}"/>`)
          parts.push(textBar(x + colW * 0.11, y + cardH * 0.06, colW * 0.6, cardH * 0.07, p.accent, 0.95))
        } else {
          // rounded-block (gemini)
          parts.push(`<rect x="${r(x)}" y="${r(y)}" width="${r(colW)}" height="${r(cardH)}" rx="${art.card.radius}" fill="${withAlpha(p.accent, art.card.bodyTint)}"/>`)
          parts.push(`<rect x="${r(x)}" y="${r(y)}" width="${r(colW)}" height="${r(cardH * 0.2)}" rx="${art.card.radius}" fill="${p.accent}"/>`)
          parts.push(textBar(x + colW * 0.06, y + cardH * 0.065, colW * 0.6, cardH * 0.07, "#FFFFFF", 0.95))
        }

        // Body content
        if (art.statTiles && ci === 1 && b === 0) {
          const tileW = colW * 0.28
          for (let t = 0; t < 3; t++) {
            const tx = x + colW * 0.04 + t * (tileW + colW * 0.02)
            parts.push(`<rect x="${r(tx)}" y="${r(bodyTop + cardH * 0.05)}" width="${r(tileW)}" height="${r(cardH * 0.2)}" rx="3" fill="${withAlpha(p.accent, 0.12)}"/>`)
            parts.push(textBar(tx + tileW * 0.2, bodyTop + cardH * 0.1, tileW * 0.6, cardH * 0.06, p.accent, 0.95))
          }
          for (let l = 0; l < 3; l++) {
            parts.push(textBar(x + colW * 0.06, bodyTop + cardH * (0.32 + l * 0.11), colW * (l % 2 ? 0.6 : 0.85), cardH * 0.045, withAlpha(p.ink, 0.3)))
          }
        } else {
          for (let l = 0; l < 4; l++) {
            const lw = colW * (l % 2 ? 0.62 : 0.86)
            parts.push(textBar(x + colW * 0.06, bodyTop + cardH * (0.07 + l * 0.13), lw, cardH * 0.045, withAlpha(p.ink, 0.3)))
          }
          if (b === cards - 1) {
            parts.push(`<rect x="${r(x + colW * 0.06)}" y="${r(bodyTop + cardH * 0.58)}" width="${r(colW * 0.88)}" height="${r(cardH * 0.3)}" rx="2" fill="${withAlpha(p.accent2, 0.18)}"/>`)
          }
        }
      }
    }
    x += colW + gutter
  })

  parts.push("</svg>")
  return parts.join("")
}

/**
 * A4 posudok mockup: letterhead, title, identification block, weighted criteria
 * table, classification panel and signature line — drawn from the template's
 * own style descriptor (`letterhead`, `titleStyle`, `criteriaTable`,
 * `ratingSymbol`, `gradeStyle`), so the picker shows the form the user gets.
 */
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
  const gradeH = H * 0.036
  switch (style.gradeStyle) {
    case "fbox":
      parts.push(textBar(pad, afterTable + gradeH * 0.25, innerW * 0.3, gradeH * 0.4, withAlpha(p.ink, 0.7)))
      parts.push(`<rect x="${r(pad + innerW * 0.34)}" y="${r(afterTable)}" width="${r(gradeH * 1.5)}" height="${r(gradeH * 0.85)}" fill="none" stroke="${withAlpha(p.ink, 0.75)}" stroke-width="1.4"/>`)
      parts.push(`<text x="${r(pad + innerW * 0.34 + gradeH * 0.75)}" y="${r(afterTable + gradeH * 0.66)}" font-size="${r(gradeH * 0.6)}" text-anchor="middle" font-family="Times New Roman, serif" fill="${INK}">A</text>`)
      break
    case "table-cell":
      parts.push(textBar(pad, afterTable + gradeH * 0.25, innerW * 0.3, gradeH * 0.4, withAlpha(p.ink, 0.7)))
      parts.push(`<rect x="${r(pad + innerW * 0.34)}" y="${r(afterTable)}" width="${r(gradeH * 1.6)}" height="${r(gradeH * 0.85)}" fill="${p.accent}"/>`)
      parts.push(`<text x="${r(pad + innerW * 0.34 + gradeH * 0.8)}" y="${r(afterTable + gradeH * 0.66)}" font-size="${r(gradeH * 0.6)}" text-anchor="middle" font-family="Times New Roman, serif" fill="#FFFFFF">A</text>`)
      break
    case "circled":
      parts.push(textBar(pad, afterTable + gradeH * 0.25, innerW * 0.3, gradeH * 0.4, withAlpha(p.ink, 0.7)))
      parts.push(`<circle cx="${r(pad + innerW * 0.36 + gradeH * 0.5)}" cy="${r(afterTable + gradeH * 0.42)}" r="${r(gradeH * 0.45)}" fill="none" stroke="${p.accent}" stroke-width="1.8"/>`)
      parts.push(`<text x="${r(pad + innerW * 0.36 + gradeH * 0.5)}" y="${r(afterTable + gradeH * 0.64)}" font-size="${r(gradeH * 0.58)}" text-anchor="middle" font-family="Times New Roman, serif" fill="${INK}">A</text>`)
      break
    case "inline-bold":
      parts.push(textBar(pad, afterTable + gradeH * 0.25, innerW * 0.3, gradeH * 0.4, withAlpha(p.ink, 0.7)))
      parts.push(textBar(pad + innerW * 0.34, afterTable + gradeH * 0.18, innerW * 0.08, gradeH * 0.55, p.accent))
      break
    default:
      parts.push(textBar(pad, afterTable + gradeH * 0.22, innerW * 0.44, gradeH * 0.34, withAlpha(p.ink, 0.5)))
      parts.push(textBar(pad, afterTable + gradeH * 0.7, innerW * 0.52, gradeH * 0.34, withAlpha(p.ink, 0.35)))
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

  parts.push(`<rect x="${r(pad)}" y="${r(sigY)}" width="${r(innerW * 0.44)}" height="1" fill="${withAlpha(p.ink, 0.6)}"/>`)
  parts.push(`<rect x="${r(W - pad - innerW * 0.28)}" y="${r(sigY)}" width="${r(innerW * 0.28)}" height="1" fill="${withAlpha(p.ink, 0.6)}"/>`)
  parts.push(textBar(pad, sigY + H * 0.008, innerW * 0.22, rowH * 0.3, withAlpha(p.ink, 0.35)))

  parts.push("</svg>")
  return parts.join("")
}

function renderSlide(art: SlidePreviewArt, p: PreviewPalette, width: number, id: string): string {
  const W = width
  const H = width * (9 / 16)
  const parts: string[] = [svgOpen(W, H, id)]
  const pad = W * 0.03
  const slideH = (H - pad * 2) * 0.46

  // ── Slide 1: title slide ────────────────────────────────────────────────
  const y1 = pad
  if (art.darkTitleSlide) {
    parts.push(`<rect x="${r(pad)}" y="${r(y1)}" width="${r(W - pad * 2)}" height="${r(slideH)}" fill="${p.ink}"/>`)
    parts.push(`<rect x="${r(pad)}" y="${r(y1 + slideH - slideH * 0.09)}" width="${r(W - pad * 2)}" height="${r(slideH * 0.09)}" fill="${p.accent}"/>`)
    parts.push(textBar(W * 0.2, y1 + slideH * 0.3, W * 0.6, slideH * 0.13, "#FFFFFF", 0.95))
    parts.push(`<rect x="${r(W * 0.42)}" y="${r(y1 + slideH * 0.52)}" width="${r(W * 0.16)}" height="${r(Math.max(1.5, slideH * 0.025))}" fill="${p.accent}"/>`)
    parts.push(textBar(W * 0.34, y1 + slideH * 0.66, W * 0.32, slideH * 0.07, "#FFFFFF", 0.55))
  } else {
    parts.push(`<rect x="${r(pad)}" y="${r(y1)}" width="${r(W - pad * 2)}" height="${r(slideH)}" fill="${p.paper}" stroke="${withAlpha(p.ink, 0.14)}"/>`)
    parts.push(`<rect x="${r(pad)}" y="${r(y1)}" width="${r(W - pad * 2)}" height="${r(slideH * 0.5)}" fill="${p.accent}"/>`)
    parts.push(textBar(W * 0.16, y1 + slideH * 0.14, W * 0.68, slideH * 0.12, "#FFFFFF", 0.95))
    parts.push(textBar(W * 0.3, y1 + slideH * 0.33, W * 0.4, slideH * 0.06, "#FFFFFF", 0.6))
    parts.push(textBar(W * 0.34, y1 + slideH * 0.7, W * 0.32, slideH * 0.07, p.ink, 0.45))
  }

  // ── Slide 2: content slide ──────────────────────────────────────────────
  const y2 = pad + slideH + pad
  parts.push(`<rect x="${r(pad)}" y="${r(y2)}" width="${r(W - pad * 2)}" height="${r(slideH)}" fill="${p.paper}" stroke="${withAlpha(p.ink, 0.14)}"/>`)

  if (art.header === "band") {
    parts.push(`<rect x="${r(pad)}" y="${r(y2)}" width="${r(W - pad * 2)}" height="${r(slideH * 0.24)}" fill="${p.accent}"/>`)
    parts.push(textBar(pad + W * 0.02, y2 + slideH * 0.07, W * 0.4, slideH * 0.1, "#FFFFFF", 0.95))
    parts.push(textBar(pad + W * 0.02, y2 + slideH * 0.165, W * 0.22, slideH * 0.05, "#FFFFFF", 0.6))
  } else if (art.header === "rule") {
    parts.push(`<rect x="${r(pad)}" y="${r(y2)}" width="${r(W - pad * 2)}" height="${r(slideH * 0.055)}" fill="${p.accent}"/>`)
    parts.push(textBar(pad + W * 0.02, y2 + slideH * 0.12, W * 0.46, slideH * (art.titleWeight === "heavy" ? 0.11 : 0.07), p.ink, 0.9))
    parts.push(`<rect x="${r(pad + W * 0.02)}" y="${r(y2 + slideH * 0.26)}" width="${r(W * 0.1)}" height="${r(Math.max(1.4, slideH * 0.022))}" fill="${p.accent}"/>`)
  } else {
    parts.push(textBar(pad + W * 0.02, y2 + slideH * 0.1, W * 0.42, slideH * 0.07, p.ink, 0.85))
  }

  const bodyTop = y2 + slideH * (art.header === "plain" ? 0.26 : 0.34)
  const bodyH = y2 + slideH * (art.footer === "none" ? 0.94 : 0.86) - bodyTop

  if (art.body === "columns") {
    const colW = (W - pad * 2 - W * 0.05) / 2 - W * 0.01
    for (let c = 0; c < 2; c++) {
      const cx = pad + W * 0.025 + c * (colW + W * 0.02)
      for (let l = 0; l < 4; l++) {
        parts.push(`<circle cx="${r(cx + 3)}" cy="${r(bodyTop + bodyH * (0.1 + l * 0.22))}" r="2" fill="${p.accent}"/>`)
        parts.push(textBar(cx + 8, bodyTop + bodyH * (0.07 + l * 0.22), colW * (l % 2 ? 0.6 : 0.9), bodyH * 0.09, withAlpha(p.ink, 0.32)))
      }
    }
  } else if (art.body === "figure") {
    for (let l = 0; l < 2; l++) {
      parts.push(textBar(pad + W * 0.025, bodyTop + bodyH * (0.06 + l * 0.2), W * 0.34, bodyH * 0.1, withAlpha(p.ink, 0.32)))
    }
    parts.push(`<rect x="${r(pad + W * 0.42)}" y="${r(bodyTop)}" width="${r(W * 0.5)}" height="${r(bodyH * 0.85)}" rx="3" fill="${withAlpha(p.accent, 0.16)}"/>`)
  } else {
    for (let l = 0; l < 4; l++) {
      const yy = bodyTop + bodyH * (0.08 + l * 0.22)
      parts.push(`<circle cx="${r(pad + W * 0.035)}" cy="${r(yy + bodyH * 0.05)}" r="2.2" fill="${p.accent}"/>`)
      parts.push(textBar(pad + W * 0.055, yy, W * (l % 2 ? 0.55 : 0.82), bodyH * 0.1, withAlpha(p.ink, 0.32)))
    }
  }

  if (art.footer === "bar") {
    parts.push(`<rect x="${r(pad)}" y="${r(y2 + slideH * 0.9)}" width="${r(W - pad * 2)}" height="${r(slideH * 0.1)}" fill="${withAlpha(p.accent, 0.9)}"/>`)
    parts.push(textBar(pad + W * 0.02, y2 + slideH * 0.93, W * 0.16, slideH * 0.04, "#FFFFFF", 0.9))
    parts.push(textBar(W - pad - W * 0.08, y2 + slideH * 0.93, W * 0.05, slideH * 0.04, "#FFFFFF", 0.9))
  } else if (art.footer === "rule") {
    parts.push(`<rect x="${r(pad + W * 0.025)}" y="${r(y2 + slideH * 0.93)}" width="${r(W - pad * 2 - W * 0.05)}" height="${r(Math.max(1, slideH * 0.012))}" fill="${withAlpha(p.ink, 0.18)}"/>`)
    parts.push(textBar(W - pad - W * 0.09, y2 + slideH * 0.87, W * 0.06, slideH * 0.05, withAlpha(p.ink, 0.4)))
  }

  parts.push("</svg>")
  return parts.join("")
}
