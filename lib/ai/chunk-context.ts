/**
 * Contextual Retrieval — Anthropic-style chunk enrichment.
 *
 * Extracted verbatim from `document-chunker.ts` so that the structure-aware chunker
 * (`chunker-v2.ts`) can build contextual prefixes without importing the Prisma-backed
 * ingestion module. `document-chunker.ts` re-exports these symbols, so every existing
 * import path keeps working.
 *
 * The prefix is stored SEPARATELY (`DocumentChunk.contextPrefix`) and only fed to the
 * embedding model and the FTS tsvector — `content` keeps the verbatim source text so
 * evidence validation ([c-anchor] quote checks) continues to match the original document
 * word-for-word.
 */

import type { SectionKind } from "./thesis-context"
import type { ChunkKind } from "./chunking-config"

// ---------------------------------------------------------------------------
// Contextual Retrieval (Anthropic-style chunk enrichment)
// ---------------------------------------------------------------------------

/** Supported languages for the contextual prefix (matches review languages). */
export type ContextLang = "sk" | "cs" | "en"

export interface ChunkContextInput {
  /** Document title (IngestFile.name / thesis title). */
  documentTitle?: string | null
  /** Research domain, e.g. "Informatika, AI a dátové vedy". */
  domain?: string | null
  /** Immediate section heading. */
  heading?: string | null
  /** Full hierarchical section path, e.g. "Kapitola 3: Metodika > 3.2 Štatistická analýza". */
  headingPath?: string | null
  /** Classified section kind (drives the section-objective sentence). */
  sectionKind?: SectionKind | null
  /** Structural kind of the chunk (table chunks get a flattened description instead). */
  kind?: ChunkKind | null
  /** Language for the prefix text (default "sk" — Slovak theses). */
  lang?: ContextLang
}

const SECTION_OBJECTIVES: Record<SectionKind, Record<ContextLang, string>> = {
  preamble: {
    sk: "predstavuje dokument a jeho štruktúru",
    cs: "představuje dokument a jeho strukturu",
    en: "introduces the document and its structure",
  },
  introduction: {
    sk: "uvádza do problematiky, motivuje tému a stanovuje ciele práce",
    cs: "uvádí do problematiky, motivuje tému a stanovuje cíle práce",
    en: "introduces the problem, motivates the topic and states the objectives",
  },
  literature: {
    sk: "rešíruje súčasný stav poznania a súvisiace vedecké práce",
    cs: "rešeršuje současný stav poznání a související vědecké práce",
    en: "surveys the state of the art and related work",
  },
  methodology: {
    sk: "popisuje metodiku, postupy, dáta a experimentálny návrh",
    cs: "popisuje metodiku, postupy, data a experimentální návrh",
    en: "describes the methodology, procedures, data and experimental design",
  },
  results: {
    sk: "prezentuje výsledky experimentov a ich vyhodnotenie vrátane štatistických údajov",
    cs: "prezentuje výsledky experimentů a jejich vyhodnocení včetně statistických údajů",
    en: "presents experimental results and their evaluation including statistical data",
  },
  discussion: {
    sk: "interpretuje výsledky, porovnáva ich s existujúcimi riešeniami a diskutuje limitácie",
    cs: "interpretuje výsledky, porovnává je s existujícími řešeními a diskutuje limitace",
    en: "interprets the results, compares them with existing work and discusses limitations",
  },
  conclusion: {
    sk: "sumarizuje závery a prínos práce pre odbornú verejnosť",
    cs: "sumarizuje závěry a přínos práce pro odbornou veřejnost",
    en: "summarises the conclusions and the contribution of the work",
  },
  references: {
    sk: "obsahuje zoznam citovanej literatúry",
    cs: "obsahuje seznam citované literatury",
    en: "contains the list of cited literature",
  },
  appendix: {
    sk: "obsahuje prílohy a doplnkový materiál",
    cs: "obsahuje přílohy a doplňkový materiál",
    en: "contains appendices and supplementary material",
  },
  unknown: {
    sk: "rozvíja hlavnú tému práce",
    cs: "rozvíjí hlavní téma práce",
    en: "develops the main topic of the work",
  },
}

/** LaTeX symbol names that make equation chunks findable by natural-language queries. */
const EQUATION_SYMBOL_LABELS: Array<[RegExp, string]> = [
  [/\\alpha|\balpha\b/i, "alpha (α)"],
  [/\\beta|\bbeta\b/i, "beta (β)"],
  [/\\gamma|\bgamma\b|\\Gamma/i, "gamma (γ)"],
  [/\\delta|\bdelta\b|\\Delta/i, "delta (δ/Δ)"],
  [/\\sigma|\bsigma\b|\\Sigma/i, "sigma (σ)"],
  [/\\lambda|\blambda\b|\\Lambda/i, "lambda (λ)"],
  [/\\mu|\bmu\b/i, "mu (μ)"],
  [/\\theta|\btheta\b/i, "theta (θ)"],
  [/\\pi|\bpi\b/i, "pi (π)"],
  [/\\epsilon|\bvarepsilon|\bvarepsilon\b/i, "epsilon (ε)"],
  [/\\sum\b|\\sum_/i, "sum"],
  [/\\int\b|\\oint/i, "integral"],
  [/\\nabla/i, "nabla (gradient)"],
  [/\\partial/i, "parciálna derivácia (partial derivative)"],
  [/[√\\sqrt]/, "odmocnina (square root)"],
  [/\\leq|\\le\b|≤/, "nerovnosť (inequality ≤)"],
  [/\\approx|≈/, "približne rovné (approximately equal)"],
]

/**
 * Builds a 1–2 sentence Anthropic-style contextual prefix for a chunk.
 *
 * Isolated 1,200–1,800-char chunks (statistical paragraphs, equations, table
 * fragments) lose the document/section framing needed for queries that
 * reference the overarching hypothesis or methodology ("Aká bola hypotéza
 * práce?", "…v kapitole 3.2"). The prefix re-attaches that framing:
 *   document title → research domain → hierarchical section path → objective.
 *
 * The prefix is stored SEPARATELY (`DocumentChunk.contextPrefix`) and only
 * fed to the embedding model and the FTS tsvector — `content` keeps the
 * verbatim source text so evidence validation ([c-anchor] quote checks)
 * continues to match the original document word-for-word.
 */
export function buildContextualPrefix(ctx: ChunkContextInput): string {
  const lang: ContextLang = ctx.lang ?? "sk"
  const sentences: string[] = []

  const title = (ctx.documentTitle || "").trim()
  const domain = (ctx.domain || "").trim()
  const sectionPath = (ctx.headingPath || ctx.heading || "").trim()

  // Sentence 1 — where this chunk lives.
  if (lang === "en") {
    sentences.push(
      `Excerpt from ${title ? `the work "${trimTitle(title)}"` : "an academic work"}${domain ? ` (field: ${domain})` : ""}${sectionPath ? `, section "${sectionPath}"` : ""}.`
    )
  } else if (lang === "cs") {
    sentences.push(
      `Úryvek z ${title ? `práce „${trimTitle(title)}“` : "akademické práce"}${domain ? ` (obor: ${domain})` : ""}${sectionPath ? `, sekce „${sectionPath}“` : ""}.`
    )
  } else {
    sentences.push(
      `Úryvok z ${title ? `práce „${trimTitle(title)}“` : "akademickej práce"}${domain ? ` (odbor: ${domain})` : ""}${sectionPath ? `, sekcia „${sectionPath}“` : ""}.`
    )
  }

  // Sentence 2 — what this section is about (objective), unless the path
  // already makes it obvious and the section is the whole path.
  const objective = SECTION_OBJECTIVES[ctx.sectionKind ?? "unknown"][lang]
  const structuralNote = structuralPrefixNote(ctx.kind, lang)
  if (lang === "en") {
    sentences.push(`This section ${objective}${structuralNote ? `; ${structuralNote}` : ""}.`)
  } else {
    sentences.push(`Táto časť ${objective}${structuralNote ? `; ${structuralNote}` : ""}.`)
  }

  return sentences.join(" ")
}

function trimTitle(t: string): string {
  // Strip file extensions from IngestFile names ("thesis_final.pdf" → "thesis_final").
  return t.replace(/\.(pdf|md|markdown|docx?|tex)$/i, "").slice(0, 120)
}

function structuralPrefixNote(kind: ChunkKind | null | undefined, lang: ContextLang): string {
  if (kind === "table") {
    return lang === "en"
      ? "it is a data table — questions about specific values are answered by it"
      : "ide o dátovú tabuľku — otázky na konkrétne hodnoty sa zodpovedajú z nej"
  }
  if (kind === "equation") {
    return lang === "en"
      ? "it is a mathematical equation block"
      : "ide o matematický vzorec"
  }
  if (kind === "figure_caption") {
    return lang === "en"
      ? "it is a figure/table caption"
      : "ide o popis obrázka alebo tabuľky"
  }
  return ""
}

/**
 * Natural-language label for an equation chunk: heading + symbol inventory so
 * keyword queries ("rovnica pre gradient", "alfa parameter") can match without
 * containing raw LaTeX. Pure function — unit-testable.
 */
export function describeEquationChunk(content: string, heading: string | null): string {
  const symbols = EQUATION_SYMBOL_LABELS.filter(([re]) => re.test(content)).map(([, label]) => label)
  const parts: string[] = []
  if (heading) parts.push(heading)
  parts.push("matematický vzorec / equation")
  if (symbols.length > 0) parts.push(`obsahuje: ${symbols.slice(0, 8).join(", ")}`)
  // Keep a short verbatim tail so exact LaTeX tokens are still embeddable.
  parts.push(content.replace(/\s+/g, " ").slice(0, 300))
  return parts.join(". ")
}
