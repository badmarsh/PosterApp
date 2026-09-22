/**
 * Single source of truth for templateId → LaTeX preamble mapping.
 * Phase 2 of template-unification: eliminate duplicated string switches in
 * generator-poster/slides/paper.ts. Both the generators and
 * lib/templates/unified-registry.ts import from this module.
 */

import type { Project } from "@/lib/poster-types"
import {
  getMinimalTemplate,
  getConferenceTemplate,
  getAtlasTemplate,
  getGeminiTemplate,
  getTikzposterTemplate,
  getA0PosterTemplate,
  getLandscapeTemplate,
  getBetterPosterTemplate,
  getAuroraTemplate,
  getMetropolisTemplate,
  getBeamerAtlasTemplate,
  getMadridTemplate,
  getDefaultTemplate,
  getFocusTemplate,
  getEditorialTemplate,
  getTwoColumnTemplate,
  getSingleColumnTemplate,
  getIEEEConfTemplate,
  getACMSigconfTemplate,
  getSpringerLLNCSTemplate,
  getJinstProceedingsTemplate,
  getPosProceedingsTemplate,
  getElsarticleTemplate,
  getRevtexTemplate,
  getEpjWocTemplate,
  getIopartTemplate,
  getNeurIPSTemplate,
  getICMLTemplate,
  getICLRTemplate,
  getACLTemplate,
  getCVPRTemplate,
  getAAAITemplate,
} from "./templates"

export type PreambleFactory = (
  project: Project,
  themeColor?: string,
  workspaceId?: string
) => string

// Poster: 9 templates
export const POSTER_PREAMBLE_BY_ID: Record<string, PreambleFactory> = {
  minimal: (p, c) => getMinimalTemplate(p, c),
  conference: (p, c) => getConferenceTemplate(p, c),
  atlas: (p, c, w) => getAtlasTemplate(p, c, w ?? ""),
  gemini: (p, c) => getGeminiTemplate(p, c),
  tikzposter: (p, c) => getTikzposterTemplate(p, c),
  a0poster: (p, c) => getA0PosterTemplate(p, c),
  landscape: (p, c) => getLandscapeTemplate(p, c),
  betterposter: (p, c) => getBetterPosterTemplate(p, c),
  aurora: (p, c) => getAuroraTemplate(p, c),
}

// Slides: 6 templates
export const SLIDES_PREAMBLE_BY_ID: Record<string, PreambleFactory> = {
  "beamer-metropolis": (p, c) => getMetropolisTemplate(p, c),
  "beamer-atlas": (p, c) => getBeamerAtlasTemplate(p, c),
  "beamer-madrid": (p, c) => getMadridTemplate(p, c),
  "beamer-default": (p, c) => getDefaultTemplate(p, c),
  "beamer-focus": (p, c) => getFocusTemplate(p, c),
  "beamer-editorial": (p, c) => getEditorialTemplate(p, c),
}

// Paper: 17 templates (all single-arg, themeColor ignored)
export const PAPER_PREAMBLE_BY_ID: Record<string, PreambleFactory> = {
  "article-twocol": (p) => getTwoColumnTemplate(p),
  "article-single": (p) => getSingleColumnTemplate(p),
  "ieee-conf": (p) => getIEEEConfTemplate(p),
  "acm-sigconf": (p) => getACMSigconfTemplate(p),
  "springer-llncs": (p) => getSpringerLLNCSTemplate(p),
  "jinst-proceedings": (p) => getJinstProceedingsTemplate(p),
  "pos-proceedings": (p) => getPosProceedingsTemplate(p),
  elsarticle: (p) => getElsarticleTemplate(p),
  "revtex-aps": (p) => getRevtexTemplate(p),
  "epj-woc": (p) => getEpjWocTemplate(p),
  iopart: (p) => getIopartTemplate(p),
  neurips: (p) => getNeurIPSTemplate(p),
  icml: (p) => getICMLTemplate(p),
  iclr: (p) => getICLRTemplate(p),
  acl: (p) => getACLTemplate(p),
  cvpr: (p) => getCVPRTemplate(p),
  aaai: (p) => getAAAITemplate(p),
}

export function getPosterPreamble(
  templateId: string,
  project: Project,
  themeColor?: string,
  workspaceId?: string
): string {
  const factory = POSTER_PREAMBLE_BY_ID[templateId.toLowerCase()] ?? POSTER_PREAMBLE_BY_ID["atlas"]
  return factory(project, themeColor, workspaceId)
}

export function getSlidesPreamble(
  templateId: string,
  project: Project,
  themeColor?: string
): string {
  const factory = SLIDES_PREAMBLE_BY_ID[templateId.toLowerCase()] ?? SLIDES_PREAMBLE_BY_ID["beamer-atlas"]
  return factory(project, themeColor)
}

export function getPaperPreamble(
  templateId: string,
  project: Project
): string {
  const factory = PAPER_PREAMBLE_BY_ID[templateId.toLowerCase()] ?? PAPER_PREAMBLE_BY_ID["article-twocol"]
  return factory(project)
}
