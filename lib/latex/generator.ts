import type { Project, OutputConfig } from "@/lib/poster-types"
import type { OutputType } from "@/lib/output-types"
import type { LatexGenerator } from "./types"
import { TikzPosterGenerator, generateLatexForCard } from "./generator-poster"
import { StandardPaperGenerator } from "./generator-paper"
import { BeamerSlidesGenerator } from "./generator-slides"
import { ThesisReviewLatexGenerator } from "./generator-thesis-review"
import { assetUrlToLatexPath } from "./helpers"

export { assetUrlToLatexPath, generateLatexForCard }

/**
 * Factory to get the appropriate generator for a given output type and template.
 */
export function getGenerator(outputType: OutputType, templateId: string): LatexGenerator {
  const key = `${outputType}/${templateId}`
  
  if (outputType === "paper") return new StandardPaperGenerator(templateId)
  if (outputType === "slides") return new BeamerSlidesGenerator(templateId)
  if (outputType === "poster") return new TikzPosterGenerator(templateId)
  if (outputType === "thesis-review") return new ThesisReviewLatexGenerator(templateId)

  throw new Error(`No generator found for ${key}`)
}

/**
 * Generate a complete document by finding the right generator for the provided output config.
 */
export function generateFullTemplate(project: Project, outputConfig: OutputConfig, workspaceId = ""): string {
  const generator = getGenerator(outputConfig.outputType, outputConfig.templateId)
  const tex = generator.generateDocument(project, outputConfig, workspaceId)
  // The thesis-review generator already emits its own babel/fontenc block.
  if (outputConfig.outputType === "thesis-review") return tex
  return ensureEncodingPreamble(tex, detectDocumentLanguage(tex))
}

/**
 * Poster/slides/paper outputs carry no explicit language yet, so infer it from
 * the generated body: Slovak/Czech text is reliably marked by characters that
 * do not occur in English (ľ, ť, ď, ň, ô, ř, ě, ů, ...). Falls back to English.
 */
export function detectDocumentLanguage(tex: string): "sk" | "cs" | "en" {
  const bodyStart = tex.indexOf("\\begin{document}")
  const body = bodyStart >= 0 ? tex.slice(bodyStart) : tex
  const cz = (body.match(/[řěůŘĚŮ]/g) ?? []).length
  const sk = (body.match(/[ľĺŕôäĽĹŔÔÄ]/g) ?? []).length
  const shared = (body.match(/[čšžťďňáéíóúýČŠŽŤĎŇÁÉÍÓÚÝ]/g) ?? []).length
  if (cz + sk + shared < 3) return "en"
  if (cz > sk) return "cs"
  if (sk > cz) return "sk"
  return "sk"
}

/**
 * Babel option per language code.
 *
 * `detectDocumentLanguage` only ever returns sk/cs/en, because poster/slides/
 * paper carry no explicit language and are detected from body diacritics.
 * de/pl/hu are NOT dead: `ensureEncodingPreamble` is exported and takes an
 * explicit `language`, and thesis-review reports are rendered in those
 * languages via `ReportLanguage` (lib/latex/templates-thesis.ts), which
 * declares its own babel line.
 *
 * Adding real de/pl/hu detection for poster/slides/paper would need the
 * distinctive diacritics (ä/ö/ü/ß, ą/ę/ł/ż/ś/ć, ő/ű) and is deliberately not
 * done here — see B-01 in docs/audit/latex-audit-2026-09.md.
 */
const BABEL_BY_LANG: Record<string, string> = {
  sk: "slovak",
  cs: "czech",
  en: "english",
  de: "ngerman",
  pl: "polish",
  hu: "magyar",
}

/**
 * pdflatex needs T1 font encoding + a matching babel option to typeset
 * Slovak/Czech diacritics with proper hyphenation and vector glyphs. The
 * built-in poster/slides/paper templates only declared `inputenc`, which
 * produced bitmap-looking č/ď/ľ and English hyphenation for SK/CZ posters.
 * Inserted once, right after \documentclass, and never duplicated.
 */
export function ensureEncodingPreamble(tex: string, language?: string | null): string {
  const docclass = tex.match(/\\documentclass(\[[^\]]*\])?\{[^}]+\}[^\n]*\n/)
  if (!docclass || docclass.index === undefined) return tex

  const lang = (language || "en").toLowerCase().slice(0, 2)
  const babelOpt = BABEL_BY_LANG[lang] ?? "english"
  const lines: string[] = []
  if (!/\\usepackage(\[[^\]]*\])?\{inputenc\}/.test(tex)) lines.push("\\usepackage[utf8]{inputenc}")
  if (!/\\usepackage(\[[^\]]*\])?\{fontenc\}/.test(tex)) lines.push("\\usepackage[T1]{fontenc}")
  if (!/\\usepackage\{lmodern\}/.test(tex)) lines.push("\\usepackage{lmodern}")
  if (!/\\usepackage(\[[^\]]*\])?\{babel\}/.test(tex)) {
    // Keep english as the fallback language so \selectlanguage works for mixed abstracts.
    lines.push(babelOpt === "english" ? "\\usepackage[english]{babel}" : `\\usepackage[english,${babelOpt}]{babel}`)
  }
  if (lines.length === 0) return tex

  const insertAt = docclass.index + docclass[0].length
  return tex.slice(0, insertAt) + `% --- encoding & language (auto) ---\n${lines.join("\n")}\n` + tex.slice(insertAt)
}
