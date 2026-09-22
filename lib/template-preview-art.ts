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

export type TemplatePreviewArt = PosterPreviewArt | SlidePreviewArt

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
  return PREVIEW_ART[templateId] ?? (def ? derivePreviewArt(def) : derivePreviewArt({ layoutPreview: "poster-3col" } as TemplateDef))
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
