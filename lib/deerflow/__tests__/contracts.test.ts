import { describe, expect, it } from "vitest"
import { extractProposalJsonCandidate, normalizeProposal } from "../contracts"

const VALID = {
  version: "poster-research-v1",
  summary: "A summary of the research.",
  sources: [
    {
      doi: "10.1000/xyz",
      title: "A verified paper",
      year: "2026",
      retrievedFrom: "crossref",
      confidence: 0.9,
    },
    {
      title: "Unverified web page",
      url: "https://example.com",
      retrievedFrom: "web",
      confidence: 0.3,
    },
  ],
  citations: [{ title: "A verified paper", doi: "10.1000/xyz", year: "2026" }],
  sectionDrafts: [
    {
      title: "Background",
      bullets: ["First finding", "Second finding"],
      suggestedAssetIds: ["asset-1", "asset-1", "missing-id"],
    },
  ],
  openQuestions: ["What remains open?"],
  meta: { estimatedUsd: 0.25, elapsedSeconds: 100 },
}

describe("normalizeProposal", () => {
  const allowed = new Set(["asset-1", "asset-2"])

  it("accepts a valid proposal and dedupes/filters unknown asset ids", () => {
    const result = normalizeProposal(VALID, { allowedAssetIds: allowed })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.proposal.sectionDrafts[0].suggestedAssetIds).toEqual(["asset-1"])
    expect(result.rejected.unknownAssets).toContain("missing-id")
    expect(result.rejected.unknownAssets).toContain("asset-1") // duplicate rejected
    expect(result.rejected.unknownKeys).toEqual([])
  })

  it("rejects unknown top-level keys (strict contract)", () => {
    const withUnknown = { ...VALID, maliciousField: "x" }
    const result = normalizeProposal(withUnknown, { allowedAssetIds: allowed })
    expect(result.ok).toBe(false)
  })

  it("accepts common alias field names via preprocess", () => {
    const aliased = {
      ...VALID,
      overview: "A summary.",
      references: VALID.sources,
      bibliography: VALID.citations,
      sections: VALID.sectionDrafts,
      questions: VALID.openQuestions,
    }
    delete (aliased as Record<string, unknown>).summary
    delete (aliased as Record<string, unknown>).sources
    delete (aliased as Record<string, unknown>).citations
    delete (aliased as Record<string, unknown>).sectionDrafts
    delete (aliased as Record<string, unknown>).openQuestions

    const result = normalizeProposal(aliased, { allowedAssetIds: allowed })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.proposal.sources).toHaveLength(2)
    expect(result.proposal.sectionDrafts).toHaveLength(1)
  })

  it("rejects proposals with too many sections or oversized strings", () => {
    const tooMany = {
      ...VALID,
      sectionDrafts: Array.from({ length: 9 }, (_, i) => ({
        title: `Section ${i}`,
        bullets: ["b"],
        suggestedAssetIds: [],
      })),
    }
    const result = normalizeProposal(tooMany, { allowedAssetIds: allowed })
    expect(result.ok).toBe(false)
  })

  it("rejects non-object input", () => {
    expect(normalizeProposal("not json", { allowedAssetIds: allowed }).ok).toBe(false)
    expect(normalizeProposal(null, { allowedAssetIds: allowed }).ok).toBe(false)
  })
})

describe("extractProposalJsonCandidate", () => {
  it("extracts JSON from a raw assistant message", () => {
    const values = { messages: [{ role: "assistant", content: JSON.stringify(VALID) }] }
    const candidate = extractProposalJsonCandidate(values)
    expect(candidate).toEqual(VALID)
  })

  it("extracts JSON from a fenced code block", () => {
    const values = {
      messages: [{ role: "assistant", content: "Here you go:\n```json\n" + JSON.stringify(VALID) + "\n```" }],
    }
    const candidate = extractProposalJsonCandidate(values)
    expect(candidate).toEqual(VALID)
  })

  it("extracts the first balanced JSON object from mixed output", () => {
    const values = {
      messages: [{ role: "assistant", content: `Preface text ${JSON.stringify(VALID)} trailing text` }],
    }
    const candidate = extractProposalJsonCandidate(values)
    expect(candidate).toEqual(VALID)
  })

  it("returns undefined when no JSON is present", () => {
    const values = { messages: [{ role: "assistant", content: "no json here" }] }
    expect(extractProposalJsonCandidate(values)).toBeUndefined()
    expect(extractProposalJsonCandidate({ messages: [] })).toBeUndefined()
    expect(extractProposalJsonCandidate("nope")).toBeUndefined()
  })
})
