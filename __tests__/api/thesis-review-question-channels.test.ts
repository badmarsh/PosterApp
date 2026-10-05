import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * Pipeline-level regression coverage for the two review question channels.
 *
 * `questionsForAuthors` (paper / grant) and `defenseQuestions` (thesis) are
 * separate fields end to end. A regression here is expensive: it either leaks
 * thesis defence questions into an author-facing peer review, or silently drops
 * the author questions that a paper/grant review exists to produce. These tests
 * therefore drive the real `runReviewPipeline` (only the AI/retrieval edges are
 * stubbed) and assert on what the pipeline persists and returns.
 */

const persisted: { data: Record<string, unknown> }[] = []
const engineCalls: { reviewKind?: string; professionalMode?: boolean }[] = []

const MANUSCRIPT = [
  "Title: Sparse Attention for Long-Context Retrieval",
  "Abstract",
  "We study sparse attention schedules for long-context retrieval and report ablations.",
  "1 Introduction",
  "Prior work scales quadratically, which limits practical deployment.",
  "2 Methods",
  "We propose a block-sparse schedule with a learned router and describe the estimator.",
  "3 Results",
  "The proposed schedule reaches comparable quality at a quarter of the cost.",
  "References",
].join("\n")

const professionalResult = {
  grade: "B",
  recommendation: "Accept with minor revisions.",
  summary: "A sound contribution with clear evidence and a few reporting gaps.",
  strengths: ["Clear experimental design"],
  anchoredFindings: [],
  sourceRevision: "rev-question-channels",
  proposedGradeRange: "B",
  derivedScore: 78,
  defenseQuestions: ["Defence question that only belongs to a thesis review?"],
  questionsForAuthors: ["Could you report the router's training cost?", "Which baselines use identical prompts?"],
  contextCoverage: { totalChars: 500, selectedChars: 400, truncated: false },
  reportingGuidelineChecks: [],
  debateLog: undefined,
  confidentialComments: undefined,
  phdEnrichment: undefined,
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    thesisReview: {
      create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        persisted.push({ data })
        return { id: `rev_${persisted.length}` }
      }),
    },
    ingestFile: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

vi.mock("@/lib/ai/thesis-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/thesis-context")>()
  return {
    ...actual,
    loadThesisContext: vi.fn().mockResolvedValue({
      fullText: MANUSCRIPT,
      totalChars: MANUSCRIPT.length,
      referencesTitles: [],
      fullGenerationContext: MANUSCRIPT,
      sections: [],
      routedContext: "",
    }),
    buildPreGenerationGrounding: vi.fn().mockResolvedValue(""),
  }
})

vi.mock("@/lib/ai/vector-rag", () => ({
  retrieveForCriterion: vi.fn().mockResolvedValue({ chunks: [], communityContext: "" }),
  generateHypotheses: vi.fn().mockResolvedValue({}),
  resolveThesisDomainContext: vi.fn().mockReturnValue(""),
  getThesisCriterionQueryExpansion: vi.fn().mockReturnValue(""),
}))

vi.mock("@/lib/ai/graph-rag", () => ({
  retrieveGraphContext: vi.fn().mockResolvedValue(null),
}))

vi.mock("@/lib/ai/review-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/review-engine")>()
  return {
    ...actual,
    generateProfessionalReview: vi.fn().mockImplementation(async (options: { reviewKind?: string }) => {
      engineCalls.push({ reviewKind: options.reviewKind })
      return { ...professionalResult }
    }),
    buildPreGenerationGrounding: vi.fn().mockResolvedValue(""),
    computeScoreFromFindings: vi.fn().mockReturnValue(78),
  }
})

vi.mock("@/lib/ai/agentic-review", () => ({
  runAgenticPerCriterionReview: vi.fn().mockResolvedValue({
    allFindings: [],
    synthesis: {
      recommendation: "Accept",
      summary: "Agentic summary",
      strengths: [],
      defenseQuestions: ["Agentic defence question?"],
    },
  }),
}))

const { runReviewPipeline } = await import("@/lib/ai/review-pipeline")

function pipelineBody(overrides: Record<string, unknown> = {}) {
  return {
    sourceFileId: "file-1",
    skipCitationAudit: true,
    thesisMetadata: {
      studentName: "Mgr. Autor",
      thesisTitle: "Sparse Attention for Long-Context Retrieval",
      thesisType: "master",
      reviewerRole: "peer_reviewer",
      language: "en",
      reportingStandard: "none",
      reviewKind: "paper",
      ...overrides,
    },
  }
}

async function run(
  reviewKind: "thesis" | "paper" | "grant",
  metadata: Record<string, unknown> = {},
  bodyOptions: Record<string, unknown> = {},
) {
  persisted.length = 0
  engineCalls.length = 0
  const result = await runReviewPipeline({
    workspaceId: "ws-question-channels",
    userId: "user-1",
    body: { ...pipelineBody({ reviewKind, ...metadata }), ...bodyOptions },
    headers: new Headers(),
  })
  return { saved: persisted[0]?.data, payload: result.responsePayload }
}

describe("review question channels through the pipeline", () => {
  beforeEach(() => {
    persisted.length = 0
    engineCalls.length = 0
  })

  it("persists paper author questions in questionsForAuthors and leaves defence questions empty", async () => {
    const { saved, payload } = await run("paper")

    expect(saved).toBeDefined()
    expect(saved!.reviewKind).toBe("paper")
    expect(JSON.parse(saved!.questionsForAuthors as string)).toEqual(professionalResult.questionsForAuthors)
    expect(JSON.parse(saved!.defenseQuestions as string)).toEqual([])

    // The API response mirrors persistence exactly — no channel mixing.
    expect(payload.reviewKind).toBe("paper")
    expect(payload.questionsForAuthors).toEqual(professionalResult.questionsForAuthors)
    expect(payload.defenseQuestions).toEqual([])
  })

  it("persists grant author questions in questionsForAuthors and leaves defence questions empty", async () => {
    const { saved, payload } = await run("grant")

    expect(saved!.reviewKind).toBe("grant")
    expect(JSON.parse(saved!.questionsForAuthors as string)).toEqual(professionalResult.questionsForAuthors)
    expect(JSON.parse(saved!.defenseQuestions as string)).toEqual([])
    expect(payload.questionsForAuthors).toEqual(professionalResult.questionsForAuthors)
    expect(payload.defenseQuestions).toEqual([])
    // Grant reviews are scored against the funding criteria, not degree criteria.
    expect(JSON.parse(saved!.sections as string).map((section: { id: string }) => section.id)).toContain("resource_feasibility")
  })

  it("persists thesis defence questions in defenseQuestions and never as author questions", async () => {
    // `agenticReview: false` exercises the monolithic professional path, where
    // the engine returns both channels and the pipeline must keep only the
    // thesis one.
    const { saved, payload } = await run("thesis", { reviewerRole: "opponent" }, { agenticReview: false })

    expect(saved!.reviewKind).toBe("thesis")
    expect(JSON.parse(saved!.defenseQuestions as string)).toEqual(professionalResult.defenseQuestions)
    expect(JSON.parse(saved!.questionsForAuthors as string)).toEqual([])
    expect(payload.defenseQuestions).toEqual(professionalResult.defenseQuestions)
    expect(payload.questionsForAuthors).toEqual([])
  })

  it("keeps the agentic thesis path on the defence channel only", async () => {
    const { saved, payload } = await run("thesis", { reviewerRole: "opponent" })

    expect(JSON.parse(saved!.defenseQuestions as string)).toEqual(["Agentic defence question?"])
    expect(JSON.parse(saved!.questionsForAuthors as string)).toEqual([])
    expect(payload.defenseQuestions).toEqual(["Agentic defence question?"])
    expect(payload.questionsForAuthors).toEqual([])
  })

  it("routes paper and grant reviews through the professional engine with their real reviewKind", async () => {
    await run("paper")
    expect(engineCalls).toHaveLength(1)
    expect(engineCalls[0].reviewKind).toBe("paper")

    await run("grant")
    expect(engineCalls).toHaveLength(1)
    expect(engineCalls[0].reviewKind).toBe("grant")
  })

  it("keeps the two channels separately addressable in the stored payload", async () => {
    const { saved } = await run("paper")
    const questionsForAuthors = JSON.parse(saved!.questionsForAuthors as string) as string[]
    const defenseQuestions = JSON.parse(saved!.defenseQuestions as string) as string[]

    // Distinct, non-overlapping arrays — never the same list written twice.
    expect(questionsForAuthors.length).toBeGreaterThan(0)
    expect(defenseQuestions).toHaveLength(0)
    for (const question of professionalResult.defenseQuestions) {
      expect(questionsForAuthors).not.toContain(question)
    }
  })
})
