import { describe, expect, it } from "vitest"
import { applySectionBoost, mergeDenseCandidates, type ScoredSectionCandidate } from "../retrievers/candidate-ranking"

const candidate = (id: string, score: number, sectionPath: string | null = null): ScoredSectionCandidate => ({ id, score, sectionPath })

describe("shared generator ranking", () => {
  it("merges fan-out by best similarity, not number of query votes", () => {
    const rows = [candidate("repeated", 0.6), candidate("best", 0.8), candidate("repeated", 0.7), candidate("repeated", 0.65)]
    expect(mergeDenseCandidates(rows, undefined, 10)).toEqual([rows[1], rows[2]])
  })

  it("boosts after deduplication and applies the candidate limit last", () => {
    const rows = [candidate("other", 0.8), candidate("method", 0.65, "Methods"), candidate("method", 0.75, "Methods")]
    const original = structuredClone(rows)
    const result = mergeDenseCandidates(rows, ["method"], 1)
    expect(result.map(c => c.id)).toEqual(["method"])
    expect(result[0].score).toBeCloseTo(0.75 * 1.15)
    expect(rows).toEqual(original)
  })

  it("keeps unrelated and null-path candidates and preserves metadata", () => {
    const rows = [candidate("unknown", 0.9), { ...candidate("fit", 0.8, "Chapter > FIT SETUP"), meta: { probe: true } }]
    const result = applySectionBoost(rows, ["setup"])
    expect(result.map(c => c.id)).toEqual(["fit", "unknown"])
    expect(result[0].meta).toEqual({ probe: true, sectionBoost: true })
    expect(rows[1].meta).toEqual({ probe: true })
  })

  it("does not double-boost a path matching several preferences", () => {
    const result = applySectionBoost([candidate("fit", 0.5, "Methods > Statistical setup")], ["method", "statistic", "setup"])
    expect(result[0].score).toBeCloseTo(0.5 * 1.15)
  })

  it("downranks front matter, contents, acknowledgements and irrelevant references", () => {
    const rows = [
      candidate("results", 0.7, "5 Results > Evaluation"),
      candidate("front", 0.95, "Title page"),
      candidate("contents", 0.9, "Table of Contents"),
      candidate("thanks", 0.85, "Acknowledgements"),
      candidate("refs", 0.8, "References"),
    ]
    const ranked = applySectionBoost(rows, ["results"])
    expect(ranked[0].id).toBe("results")
    expect(ranked.find((c) => c.id === "front")?.score).toBeCloseTo(0.95 * 0.45)
    expect(ranked.find((c) => c.id === "contents")?.score).toBeCloseTo(0.9 * 0.35)
    expect(ranked.find((c) => c.id === "thanks")?.score).toBeCloseTo(0.85 * 0.35)
    expect(ranked.find((c) => c.id === "refs")?.score).toBeCloseTo(0.8 * 0.35)
  })

  it("keeps references eligible for a citation-focused route", () => {
    const [reference] = applySectionBoost([candidate("ref", 0.8, "References")], ["bibliography"])
    expect(reference.score).toBeCloseTo(0.8 * 1.15)
    expect(reference.meta?.sectionPenalty).toBeUndefined()
  })

  it("preserves first-seen ties, empty input and absent preferences", () => {
    const rows = [candidate("first", 0.8), candidate("second", 0.8), candidate("first", 0.8, "Later")]
    expect(mergeDenseCandidates(rows, [], 10)).toEqual([rows[0], rows[1]])
    expect(applySectionBoost(rows, undefined)).toBe(rows)
    expect(mergeDenseCandidates([], ["method"], 10)).toEqual([])
  })
})
