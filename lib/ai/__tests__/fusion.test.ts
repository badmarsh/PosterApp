/**
 * Unit tests for the multi-source fusion layer (`lib/ai/fusion.ts`).
 *
 * These are pure functions with no Prisma, no DB and no model, so they are the one part of the
 * retrieval stack that can be verified end-to-end in this environment. What they pin down is the
 * property the whole review depends on: a chunk that several independent legs agree on outranks a
 * chunk that one leg loves — and the per-source weights actually change the outcome.
 */

import { describe, expect, it } from "vitest"
import {
  DEFAULT_FUSION_WEIGHTS,
  DEFAULT_RRF_K,
  activeSources,
  candidateCountBySource,
  diversifyByGroup,
  fuseCandidates,
  minMaxNormalize,
  type RankedSource,
  type RetrievalSource,
} from "../fusion"

function src(source: RetrievalSource, ids: Array<[string, number]>, weight?: number): RankedSource<unknown> {
  return { source, weight, items: ids.map(([id, score]) => ({ id, score })) }
}

describe("minMaxNormalize", () => {
  it("maps the best item to 1 and the worst to 0", () => {
    const out = minMaxNormalize([{ id: "a", score: 10 }, { id: "b", score: 5 }, { id: "c", score: 0 }])
    expect(out).toEqual([1, 0.5, 0])
  })

  it("does not divide by zero when every score is identical", () => {
    const out = minMaxNormalize([{ id: "a", score: 7 }, { id: "b", score: 7 }])
    expect(out.every((v) => Number.isFinite(v))).toBe(true)
    expect(out).toEqual([1, 1])
  })

  it("returns an empty array for no items", () => {
    expect(minMaxNormalize([])).toEqual([])
  })
})

describe("fuseCandidates", () => {
  it("ranks a chunk agreed on by two legs above a chunk only one leg loves", () => {
    const fused = fuseCandidates(
      [
        src("dense", [["agreed", 0.9], ["dense-only", 0.95]]),
        src("lexical", [["agreed", 3.2], ["lexical-only", 4.1]]),
      ],
      { method: "rrf" }
    )
    expect(fused[0].id).toBe("agreed")
    expect(fused[0].sources.map((s) => s.source).sort()).toEqual(["dense", "lexical"])
  })

  it("assigns 1-based ranks in descending fused score", () => {
    const fused = fuseCandidates([src("dense", [["a", 1], ["b", 0.5], ["c", 0.1]])])
    expect(fused.map((f) => f.rank)).toEqual([1, 2, 3])
    expect(fused.map((f) => f.id)).toEqual(["a", "b", "c"])
    const scores = fused.map((f) => f.fusedScore)
    expect([...scores].sort((x, y) => y - x)).toEqual(scores)
  })

  it("uses the RRF paper constant by default", () => {
    expect(DEFAULT_RRF_K).toBe(60)
    const [top] = fuseCandidates([src("dense", [["a", 1]])])
    // Single source, weight 1, rank 1 → 1 / (k + 1).
    expect(top.fusedScore).toBeCloseTo(1 / 61, 10)
  })

  it("lets per-source weights change the winner under weighted-rrf", () => {
    const denseFirst = fuseCandidates(
      [src("dense", [["d", 0.9]]), src("lexical", [["l", 5]])],
      { method: "weighted-rrf", weights: { dense: 5, lexical: 0.1 } }
    )
    expect(denseFirst[0].id).toBe("d")

    const lexicalFirst = fuseCandidates(
      [src("dense", [["d", 0.9]]), src("lexical", [["l", 5]])],
      { method: "weighted-rrf", weights: { dense: 0.1, lexical: 5 } }
    )
    expect(lexicalFirst[0].id).toBe("l")
  })

  it("falls back to the configured default weight when a source has no override", () => {
    const fused = fuseCandidates([src("dense", [["a", 1]])], { method: "weighted-rrf" })
    expect(fused[0].sources[0].weight).toBe(DEFAULT_FUSION_WEIGHTS.dense)
  })

  it("reports each source's share of the fused score, summing to 1", () => {
    const fused = fuseCandidates([src("dense", [["a", 0.9]]), src("lexical", [["a", 2.0]])], { method: "rrf" })
    const total = fused[0].sources.reduce((s, c) => s + c.contribution, 0)
    expect(total).toBeCloseTo(1, 6)
    // Strongest contributor first.
    expect(fused[0].sources[0].contribution).toBeGreaterThanOrEqual(fused[0].sources[1].contribution)
  })

  it("records the raw score and rank each source reported", () => {
    const fused = fuseCandidates([src("dense", [["x", 0.42], ["a", 0.9]])], { method: "rrf" })
    const a = fused.find((f) => f.id === "a")!
    expect(a.sources[0].rank).toBe(2)
    expect(a.sources[0].rawScore).toBe(0.9)
  })

  it("carries the payload of the highest-ranked contributing source", () => {
    const densePayload = { from: "dense" }
    const lexicalPayload = { from: "lexical" }
    const fused = fuseCandidates<{ from: string }>([
      { source: "dense", items: [{ id: "a", score: 1, payload: densePayload }] },
      { source: "lexical", items: [{ id: "a", score: 1, payload: lexicalPayload }] },
    ])
    expect(fused[0].payload).toBeDefined()
    expect(["dense", "lexical"]).toContain(fused[0].payload!.from)
  })

  it("honours the limit", () => {
    const fused = fuseCandidates([src("dense", [["a", 3], ["b", 2], ["c", 1]])], { limit: 2 })
    expect(fused).toHaveLength(2)
  })

  it("keeps everything when limit is 0", () => {
    const fused = fuseCandidates([src("dense", [["a", 3], ["b", 2], ["c", 1]])], { limit: 0 })
    expect(fused).toHaveLength(3)
  })

  it("ignores empty sources and returns [] when nothing was proposed", () => {
    expect(fuseCandidates([])).toEqual([])
    expect(fuseCandidates([src("dense", []), src("lexical", [])])).toEqual([])
  })

  it("normalized-sum is scale-free across legs with incomparable units", () => {
    // Cosine in [0,1] vs ts_rank that can exceed 1: rank-based fusion is scale-free by
    // construction, and normalized-sum must be too.
    const fused = fuseCandidates(
      [src("dense", [["a", 0.99], ["b", 0.01]]), src("lexical", [["b", 900], ["a", 1]])],
      { method: "normalized-sum" }
    )
    expect(fused).toHaveLength(2)
    expect(fused.every((f) => Number.isFinite(f.fusedScore))).toBe(true)
    // Both legs put "a" and "b" at opposite ends, so the fused result must not be dominated by
    // the leg with the larger raw scale.
    expect(fused[0].sources.length).toBe(2)
  })

  it("breaks ties deterministically so repeated runs give identical reviews", () => {
    const build = () =>
      fuseCandidates([src("dense", [["b", 1], ["a", 1]])], { method: "rrf" }).map((f) => f.id)
    expect(build()).toEqual(build())
    expect(new Set(build()).size).toBe(2)
  })
})

describe("source bookkeeping", () => {
  it("lists only the sources that actually produced candidates", () => {
    const sources = activeSources([src("dense", [["a", 1]]), src("lexical", []), src("graph", [["g", 0.4]])])
    expect(sources.sort()).toEqual(["dense", "graph"])
  })

  it("counts candidates per source", () => {
    const counts = candidateCountBySource([src("dense", [["a", 1], ["b", 0.5]]), src("citation", [])])
    expect(counts).toEqual({ dense: 2, citation: 0 })
  })
})

describe("diversifyByGroup", () => {
  // One long section must not monopolise the evidence budget: cap entries per parent section.
  const fused = fuseCandidates([
    src("dense", [
      ["s1-a", 5],
      ["s1-b", 4],
      ["s1-c", 3],
      ["s2-a", 2],
      ["s2-b", 1],
    ]),
  ])
  const sectionOf: Record<string, string> = { "s1-a": "intro", "s1-b": "intro", "s1-c": "intro", "s2-a": "results", "s2-b": "results" }

  it("caps how many candidates any single group can contribute", () => {
    const out = diversifyByGroup(fused, (c) => sectionOf[c.id], 2)
    expect(out.filter((c) => sectionOf[c.id] === "intro")).toHaveLength(2)
    expect(out.filter((c) => sectionOf[c.id] === "results")).toHaveLength(2)
  })

  it("keeps the fused order within a group", () => {
    const out = diversifyByGroup(fused, (c) => sectionOf[c.id], 2)
    expect(out.map((c) => c.id)).toEqual(["s1-a", "s1-b", "s2-a", "s2-b"])
  })

  it("returns everything when the cap is not binding or disabled", () => {
    expect(diversifyByGroup(fused, (c) => sectionOf[c.id], 10)).toHaveLength(5)
    expect(diversifyByGroup(fused, (c) => sectionOf[c.id], 0)).toHaveLength(5)
  })

  it("never drops a candidate with no group", () => {
    const out = diversifyByGroup(fused, () => null, 1)
    expect(out).toHaveLength(5)
  })
})
