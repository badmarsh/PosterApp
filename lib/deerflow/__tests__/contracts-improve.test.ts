/**
 * Tests for improve_poster contract schemas and normalizer.
 */
import { describe, it, expect } from "vitest"
import {
  normalizeImprovePosterProposal,
  extractImprovePosterJsonCandidate,
  ImprovePosterProposalSchema,
  IMPROVE_POSTER_PROPOSAL_VERSION,
  DeerflowKindSchema,
  DeerflowStartRunSchema,
} from "../contracts"

const VALID_CARD_IDS = new Set(["card_1", "card_2", "card_3"])

const makeValidProposal = (overrides: Record<string, unknown> = {}) => ({
  version: IMPROVE_POSTER_PROPOSAL_VERSION,
  iterations: [
    {
      iterationIndex: 0,
      patches: [
        {
          id: "card_1",
          content: "Fixed content in **bold**",
          rationale: "Removed unsafe command",
        },
      ],
      compileLog: "! Missing $ inserted",
      diagnosis: "Math expression was unclosed",
    },
  ],
  summary: "Fixed LaTeX compile error",
  cleanCompile: true,
  meta: {},
  ...overrides,
})

describe("DeerflowKindSchema", () => {
  it("accepts poster_research", () => {
    expect(DeerflowKindSchema.parse("poster_research")).toBe("poster_research")
  })

  it("accepts improve_poster", () => {
    expect(DeerflowKindSchema.parse("improve_poster")).toBe("improve_poster")
  })

  it("rejects unknown kinds", () => {
    expect(() => DeerflowKindSchema.parse("deep_research")).toThrow()
    expect(() => DeerflowKindSchema.parse("")).toThrow()
  })
})

describe("DeerflowStartRunSchema discriminated union", () => {
  it("parses poster_research with focus", () => {
    const result = DeerflowStartRunSchema.safeParse({
      kind: "poster_research",
      focus: "Quantum entanglement and its applications",
      depth: "standard",
      confirmEstimate: true,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.kind).toBe("poster_research")
    }
  })

  it("parses improve_poster", () => {
    const result = DeerflowStartRunSchema.safeParse({
      kind: "improve_poster",
      maxIterations: 3,
      confirmEstimate: true,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.kind).toBe("improve_poster")
    }
  })

  it("rejects improve_poster with maxIterations > 5", () => {
    const result = DeerflowStartRunSchema.safeParse({
      kind: "improve_poster",
      maxIterations: 10,
      confirmEstimate: true,
    })
    expect(result.success).toBe(false)
  })

  it("defaults missing kind to poster_research for backward compat", () => {
    const result = DeerflowStartRunSchema.safeParse({
      focus: "Some research topic that is long enough",
      depth: "fast",
      confirmEstimate: true,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.kind).toBe("poster_research")
    }
  })
})

describe("ImprovePosterProposalSchema", () => {
  it("parses a valid proposal", () => {
    const result = ImprovePosterProposalSchema.safeParse(makeValidProposal())
    expect(result.success).toBe(true)
  })

  it("maps aliases: steps → iterations, success → cleanCompile", () => {
    const raw = {
      version: IMPROVE_POSTER_PROPOSAL_VERSION,
      steps: [
        {
          iterationIndex: 0,
          patches: [],
          compileLog: "",
          diagnosis: "",
        },
      ],
      summary: "done",
      success: true,
      meta: {},
    }
    const result = ImprovePosterProposalSchema.safeParse(raw)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.cleanCompile).toBe(true)
    }
  })

  it("rejects iterationIndex > 4", () => {
    const result = ImprovePosterProposalSchema.safeParse(
      makeValidProposal({
        iterations: [
          {
            iterationIndex: 5, // exceeds max
            patches: [],
            compileLog: "",
            diagnosis: "",
          },
        ],
      })
    )
    expect(result.success).toBe(false)
  })

  it("rejects unknown top-level keys via normalizeImprovePosterProposal", () => {
    const raw = { ...makeValidProposal(), secret_key: "oops" }
    const result = normalizeImprovePosterProposal(raw, { allowedCardIds: VALID_CARD_IDS })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues[0].message).toMatch(/Unknown top-level/)
    }
  })
})

describe("normalizeImprovePosterProposal", () => {
  it("accepts a valid proposal with known card ids", () => {
    const result = normalizeImprovePosterProposal(makeValidProposal(), {
      allowedCardIds: VALID_CARD_IDS,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.rejected.unknownCardIds).toHaveLength(0)
      expect(result.rejected.unsafePatchIds).toHaveLength(0)
    }
  })

  it("rejects patches with unknown card ids", () => {
    const proposal = makeValidProposal({
      iterations: [
        {
          iterationIndex: 0,
          patches: [
            { id: "card_999", content: "Some content", rationale: "test" },
          ],
          compileLog: "",
          diagnosis: "",
        },
      ],
    })
    const result = normalizeImprovePosterProposal(proposal, { allowedCardIds: VALID_CARD_IDS })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.rejected.unknownCardIds).toContain("card_999")
      expect(result.proposal.iterations[0].patches).toHaveLength(0)
    }
  })

  it("strips patches containing unsafe LaTeX commands", () => {
    const proposal = makeValidProposal({
      iterations: [
        {
          iterationIndex: 0,
          patches: [
            { id: "card_1", content: "\\write18{rm -rf /}", rationale: "evil" },
            { id: "card_2", content: "Safe **markdown** content", rationale: "ok" },
          ],
          compileLog: "",
          diagnosis: "",
        },
      ],
    })
    const result = normalizeImprovePosterProposal(proposal, { allowedCardIds: VALID_CARD_IDS })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.rejected.unsafePatchIds).toContain("card_1")
      expect(result.proposal.iterations[0].patches).toHaveLength(1)
      expect(result.proposal.iterations[0].patches[0].id).toBe("card_2")
    }
  })

  it("rejects unbalanced braces in patch content", () => {
    const proposal = makeValidProposal({
      iterations: [
        {
          iterationIndex: 0,
          patches: [
            { id: "card_1", content: "Unmatched {brace", rationale: "broken" },
          ],
          compileLog: "",
          diagnosis: "",
        },
      ],
    })
    const result = normalizeImprovePosterProposal(proposal, { allowedCardIds: VALID_CARD_IDS })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.rejected.unsafePatchIds).toContain("card_1")
    }
  })

  it("returns ok:false for non-object input", () => {
    const result = normalizeImprovePosterProposal("not an object", { allowedCardIds: VALID_CARD_IDS })
    expect(result.ok).toBe(false)
  })
})

describe("extractImprovePosterJsonCandidate", () => {
  it("extracts JSON from fenced code block in messages", () => {
    const proposal = makeValidProposal()
    const valuesValue = {
      messages: [
        {
          content: "Here is my proposal:\n```json\n" + JSON.stringify(proposal) + "\n```",
        },
      ],
    }
    const candidate = extractImprovePosterJsonCandidate(valuesValue)
    expect(candidate).not.toBeUndefined()
    expect((candidate as any).version).toBe(IMPROVE_POSTER_PROPOSAL_VERSION)
  })

  it("extracts raw JSON object from last message", () => {
    const proposal = makeValidProposal()
    const valuesValue = {
      messages: [
        { content: "Preamble text" },
        { content: JSON.stringify(proposal) },
      ],
    }
    const candidate = extractImprovePosterJsonCandidate(valuesValue)
    expect(candidate).not.toBeUndefined()
  })

  it("returns undefined when no valid JSON found", () => {
    const valuesValue = {
      messages: [{ content: "Just plain text with no JSON" }],
    }
    const candidate = extractImprovePosterJsonCandidate(valuesValue)
    expect(candidate).toBeUndefined()
  })
})
