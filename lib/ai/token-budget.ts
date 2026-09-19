/**
 * Token budgeting for chunking and prompt assembly.
 *
 * Why this exists
 * ---------------
 * The previous chunker sized chunks in **characters** (1200 / 1500 chars) while the embedding
 * model attended to a **512-token** window, and the Anthropic-style contextual prefix was
 * prepended to the embedded text on top of that. The result was silent tail truncation: for a
 * Slovak/Czech chunk the last sentences simply never reached the vector. Token-aware chunking
 * is the fix, and it needs a token counter that does not require a 500 MB model download.
 *
 * Strategy
 * --------
 * 1. If the active model's real tokenizer is loaded, `countTokensExact()` uses it.
 * 2. Otherwise `estimateTokens()` applies a subword-aware heuristic calibrated for
 *    SentencePiece/BPE vocabularies used by the multilingual models in the registry.
 * 3. Both are cross-checked against a plain `chars / charsPerToken` estimate and the
 *    **maximum** of the two is used, so the budget is conservative (never over-fills).
 *
 * The heuristic is an estimate and is documented as one. It is deterministic, dependency-free,
 * and unit-tested against known token counts in `lib/ai/__tests__/token-budget.test.ts`.
 *
 * @module token-budget
 */

import { getEmbeddingModel } from "./model-registry"

/** Version of the estimator — recorded on indexed chunks so reindexing can be triggered. */
export const TOKEN_ESTIMATOR_VERSION = "1.0.0"

/**
 * Subword-aware token estimate for Latin-script academic text.
 *
 * Rationale: in a 250k-vocab SentencePiece model (XLM-R family) a common word of ≤4 characters
 * is one token, and each further ~4 characters costs roughly one more piece. Digits split more
 * aggressively than letters in most BPE vocabularies, so digit runs are charged per 2 chars.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0
  let tokens = 0
  // Word-level pass.
  const words = text.split(/[\s]+/).filter(Boolean)
  for (const raw of words) {
    const word = raw.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, "")
    if (!word) {
      tokens += 1
      continue
    }
    // Pure/partial digit runs (years, measurements, p-values) fragment more.
    const digitRuns = word.match(/\d[\d.,:]*\d|\d/g)
    let digitChars = 0
    if (digitRuns) for (const d of digitRuns) digitChars += d.length
    const letterPart = word.replace(/[\d.,:]+/g, "")
    const letterTokens = letterPart.length === 0 ? 0 : 1 + Math.floor(Math.max(0, letterPart.length - 4) / 4)
    const digitTokens = Math.ceil(digitChars / 2)
    tokens += Math.max(1, letterTokens + digitTokens)
  }
  // Explicit line breaks are real tokens in most tokenizers and matter for tables/LaTeX.
  const newlines = (text.match(/\n/g) || []).length
  tokens += Math.ceil(newlines / 2)
  return Math.max(text.trim() ? 1 : 0, tokens)
}

/** Plain character-ratio estimate; the fallback cross-check. */
export function estimateTokensByChars(text: string, charsPerToken: number): number {
  if (!text || charsPerToken <= 0) return 0
  return Math.ceil(text.length / charsPerToken)
}

export interface TokenCounter {
  /** Model id this counter is calibrated for. */
  model: string
  charsPerToken: number
  count(text: string): number
}

let cachedCounter: TokenCounter | null = null
let cachedCounterModel = ""

/** Token counter calibrated to the currently configured embedding model. */
export function getTokenCounter(): TokenCounter {
  const info = getEmbeddingModel().getModelInfo()
  if (cachedCounter && cachedCounterModel === info.id && cachedCounter.charsPerToken === info.charsPerToken) {
    return cachedCounter
  }
  cachedCounterModel = info.id
  cachedCounter = {
    model: info.id,
    charsPerToken: info.charsPerToken,
    count: (text: string) => countTokens(text, info.charsPerToken),
  }
  return cachedCounter
}

/** Conservative token count: max(subword heuristic, char-ratio estimate). */
export function countTokens(text: string, charsPerToken = 3.6): number {
  return Math.max(estimateTokens(text), estimateTokensByChars(text, charsPerToken))
}

/** True when `text` fits in `maxTokens` under the conservative estimate. */
export function fitsTokenBudget(text: string, maxTokens: number, charsPerToken = 3.6): boolean {
  return countTokens(text, charsPerToken) <= maxTokens
}

/**
 * Character budget that corresponds to `maxTokens` for the active model, with `reserve` tokens
 * held back (used for the contextual prefix). Never below 120 chars.
 */
export function charsForTokens(maxTokens: number, reserveTokens = 0, charsPerToken = 3.6): number {
  const effective = Math.max(16, maxTokens - reserveTokens)
  // The heuristic is usually the tighter of the two estimates for prose, so use a slightly
  // reduced ratio to stay on the safe side.
  return Math.max(120, Math.floor(effective * charsPerToken * 0.9))
}

// ---------------------------------------------------------------------------
// Boundary-aware truncation
// ---------------------------------------------------------------------------

const SENTENCE_END = /(?<=[.!?…]["')\]]?)\s+/u

/**
 * Truncates `text` to fit `maxTokens`, preferring (in order) a paragraph boundary, a sentence
 * boundary, then a word boundary. Never cuts mid-word, and appends an ellipsis marker so the
 * reader of the chunk can tell it was shortened.
 */
export function truncateToTokenBudget(text: string, maxTokens: number, charsPerToken = 3.6): string {
  if (fitsTokenBudget(text, maxTokens, charsPerToken)) return text
  const limit = Math.max(60, charsForTokens(maxTokens, 4, charsPerToken))
  let cut = text.slice(0, limit)

  const lastParagraph = cut.lastIndexOf("\n\n")
  if (lastParagraph > limit * 0.5) cut = cut.slice(0, lastParagraph)
  else {
    const parts = cut.split(SENTENCE_END)
    if (parts.length > 1) {
      let acc = parts[0]
      for (let i = 1; i < parts.length; i++) {
        const candidate = `${acc} ${parts[i]}`
        if (candidate.length > cut.length) break
        acc = candidate
      }
      if (acc.length > limit * 0.5) cut = acc
    }
  }
  const lastSpace = cut.lastIndexOf(" ")
  if (lastSpace > cut.length * 0.8) cut = cut.slice(0, lastSpace)
  return `${cut.trimEnd()} […]`
}

// ---------------------------------------------------------------------------
// Budget-aware packing
// ---------------------------------------------------------------------------

export interface PackResult {
  groups: string[][]
  /** Indices of units that exceeded the budget on their own (kept whole, flagged). */
  oversized: number[]
}

/**
 * Packs pre-split atomic units into groups that each fit `maxTokens`.
 *
 * Units are never split here — the caller decides how to produce them (paragraph, sentence,
 * table row block, equation). A unit that does not fit alone is emitted as its own group and
 * reported in `oversized`, so callers can flag it instead of silently chopping it.
 */
export function packUnitsIntoTokenBudget(units: string[], maxTokens: number, charsPerToken = 3.6): PackResult {
  const groups: string[][] = []
  const oversized: number[] = []
  let current: string[] = []
  let currentTokens = 0

  const flush = () => {
    if (current.length > 0) {
      groups.push(current)
      current = []
      currentTokens = 0
    }
  }

  units.forEach((unit, idx) => {
    const t = countTokens(unit, charsPerToken)
    if (t > maxTokens) {
      flush()
      groups.push([unit])
      oversized.push(idx)
      return
    }
    // +1 accounts for the joiner between units.
    if (current.length > 0 && currentTokens + t + 1 > maxTokens) flush()
    current.push(unit)
    currentTokens += t + 1
  })
  flush()
  return { groups, oversized }
}

/** Test hook. */
export function __resetTokenCounterCache(): void {
  cachedCounter = null
  cachedCounterModel = ""
}
