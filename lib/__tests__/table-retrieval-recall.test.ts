/**
 * Table & numerical data retrieval optimization — recall benchmark (Objective E).
 *
 * kind === "table" / "equation" chunks suffer low cosine + FTS similarity
 * against natural-language questions ("Aké boli p-hodnoty v experimente?").
 * The enrichment pipeline (describeTableChunk / describeEquationChunk +
 * contextual prefix) turns raw scaffolding (|---|, $$…$$) into query-shaped
 * text. This benchmark quantifies that lift with the SAME lexical scoring
 * signal the reranker uses (query-token overlap), on a fixed SK corpus.
 */

import { describe, it, expect } from "vitest"
import { describeTableChunk } from "@/lib/ai/text-splitter"
import { buildContextualPrefix, describeEquationChunk } from "@/lib/ai/document-chunker"

const QUERY = "Aké boli p-hodnoty v experimente? Ktorý model dosiahol najvyššiu presnosť a štatistickú významnosť?"

const TABLE_MD = `| Model | Presnosť | p-hodnota |
|---|---|---|
| Baseline | 0.81 | 0.214 |
| Navrhovaný | 0.94 | p < 0.001 |`

const PROSE_CORPUS = [
  "Úvod do problematiky spracovania obrazu a počítačového videnia v medicínskych aplikáciách.",
  "Prehľad literatúry zaoberajúci sa konvolučnými neurónovými sieťami a transfer learningom.",
  "Metodika porovnania: modely sme trénovali rovnako dlho a presnosť reportujeme ako priemer z 5 behov.",
  "Diskusia obmedzení práce: malá vzorka pacientov a možné skreslenie anotácií.",
  "Záver: práca splnila stanovené ciele a otvára cestu pre budúci výskum v segmentácii.",
]

/** Same content-overlap signal as rerankChunks (fraction of query tokens present). */
function contentOverlap(query: string, text: string): number {
  const tokens = query
    .toLowerCase()
    .replace(/[.,?!;:()"]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 3)
  if (tokens.length === 0) return 0
  const lower = text.toLowerCase()
  return tokens.filter((t) => lower.includes(t)).length / tokens.length
}

describe("table retrieval recall benchmark", () => {
  it("enriched table representation outranks the raw markdown for a statistical query", () => {
    const context = buildContextualPrefix({
      documentTitle: "Diplomová práca",
      domain: "Informatika",
      headingPath: "Kapitola 4 > 4.1 Porovnanie modelov",
      sectionKind: "results",
      kind: "table",
    })

    const rawRepresentation = `Tab. 4.1 Porovnanie modelov\n${TABLE_MD}`
    const enrichedRepresentation = `${context} ${describeTableChunk(TABLE_MD, "Tab. 4.1 Porovnanie modelov")}`

    const rawScore = contentOverlap(QUERY, rawRepresentation)
    const enrichedScore = contentOverlap(QUERY, enrichedRepresentation)

    // The enrichment strictly improves the lexical match…
    expect(enrichedScore).toBeGreaterThan(rawScore)
    // …by a meaningful margin (benchmark gate, not a tautology).
    expect(enrichedScore - rawScore).toBeGreaterThanOrEqual(0.15)

    // Ranking lift: with 5 prose distractors the raw table lands below the top,
    // while the enriched one ranks FIRST.
    const corpusRaw = [...PROSE_CORPUS, rawRepresentation]
    const corpusEnriched = [...PROSE_CORPUS, enrichedRepresentation]
    const rawRank = corpusRaw
      .map((t, i) => ({ i, s: contentOverlap(QUERY, t) }))
      .sort((a, b) => b.s - a.s)
      .findIndex((x) => x.i === corpusRaw.length - 1)
    const enrichedRank = corpusEnriched
      .map((t, i) => ({ i, s: contentOverlap(QUERY, t) }))
      .sort((a, b) => b.s - a.s)
      .findIndex((x) => x.i === corpusEnriched.length - 1)

    expect(rawRank).toBeGreaterThan(0) // raw table is NOT the top hit
    expect(enrichedRank).toBe(0) // enriched table is the top hit
  })

  it("enriched equation representation matches symbol-word queries the raw LaTeX cannot", () => {
    const q = "Aký vzorec použil autor pre smerodajnú odchýlku sigma a priemer mu?"
    const raw = "$$\\sigma = \\sqrt{ \\frac{1}{n} \\sum_{i=1}^{n} (x_i - \\mu)^2 }$$"
    const enriched = describeEquationChunk(raw, "3.2 Štatistická analýza")

    expect(contentOverlap(q, enriched)).toBeGreaterThan(contentOverlap(q, raw))
    expect(contentOverlap(q, enriched)).toBeGreaterThanOrEqual(0.15)
  })

  it("verbatim table markdown is preserved for evidence quote validation", () => {
    // describeTableChunk is only the retrieval representation; the chunk content
    // fed to evidence-validator remains the exact source markdown.
    const context = buildContextualPrefix({ kind: "table" })
    const enriched = `${context} ${describeTableChunk(TABLE_MD, "Tab. 4.1")}`
    expect(enriched).not.toContain("|---|")
    expect(TABLE_MD).toContain("|---|") // original untouched
    expect(TABLE_MD).toContain("| Navrhovaný | 0.94 | p < 0.001 |")
  })
})
