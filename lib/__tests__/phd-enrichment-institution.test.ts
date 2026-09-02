import { describe, it, expect, vi, beforeEach } from "vitest"
import { generateProfessionalReview } from "@/lib/ai/review-engine"

// Mock the AI client to avoid actual API calls
vi.mock("@/lib/ai/client", () => ({
  generateAIResponse: vi.fn().mockResolvedValue({
    summary: "Test summary",
    strengths: ["Test strength"],
    findings: [],
    reportingStandard: "none",
    reportingGuidelineChecks: [],
    questionsForAuthors: [],
    recommendation: "accept",
    grade: "A",
  }),
}))

// Mock services
vi.mock("@/lib/services/academic-connector", () => ({
  auditThesisCitations: vi.fn().mockResolvedValue({
    results: [],
    summary: "No issues found",
  }),
  fetchAcademicAuthorProfile: vi.fn().mockResolvedValue(null),
  searchAcademicPaper: vi.fn().mockResolvedValue([]),
}))

// Mock thesis context with all required exports
vi.mock("@/lib/ai/thesis-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/thesis-context")>()
  return {
    ...actual,
    loadThesisContext: vi.fn().mockResolvedValue({
      fullText: "Test thesis content",
      sections: [{
        id: "sec-1",
        heading: "Introduction",
        content: "This is a test introduction with methodology and results.",
      }],
      references: [],
      referencesTitles: [],
      totalChars: 50,
      truncated: false,
      sourceFiles: [],
    }),
    routeSectionsForCriterion: vi.fn().mockResolvedValue([]),
  }
})

describe("Task 6: Institution-aware PhD enrichment (sk/cs/en)", () => {
  it("skips statutory clause for non-Slovak/Czech institutions", async () => {
    const result = await generateProfessionalReview({
      workspaceId: "test-ws",
      sourceFileId: "test-file",
      documentTitle: "Test Thesis",
      authorName: "Test Author",
      reviewKind: "thesis",
      thesisType: "phd",
      reviewerRole: "opponent",
      language: "en",
      institution: "University of Oxford",
    })

    expect(result.phdEnrichment).toBeDefined()
    expect(result.phdEnrichment.statutoryClause).toBeUndefined()
  })

  it("includes Slovak clause for Slovak institutions", async () => {
    const result = await generateProfessionalReview({
      workspaceId: "test-ws",
      sourceFileId: "test-file",
      documentTitle: "Test Thesis",
      authorName: "Test Author",
      reviewKind: "thesis",
      thesisType: "phd",
      reviewerRole: "opponent",
      language: "en",
      institution: "Slovenská technická univerzita",
    })

    expect(result.phdEnrichment).toBeDefined()
    expect(result.phdEnrichment.statutoryClause).toContain("§ 54")
    expect(result.phdEnrichment.statutoryClause).toContain("131/2002")
  })

  it("includes Czech clause for Czech institutions", async () => {
    const result = await generateProfessionalReview({
      workspaceId: "test-ws",
      sourceFileId: "test-file",
      documentTitle: "Test Thesis",
      authorName: "Test Author",
      reviewKind: "thesis",
      thesisType: "phd",
      reviewerRole: "opponent",
      language: "cs",
      institution: "Univerzita Karlova",
    })

    expect(result.phdEnrichment).toBeDefined()
    expect(result.phdEnrichment.statutoryClause).toContain("§ 54")
    expect(result.phdEnrichment.statutoryClause).toContain("111/1998")
  })

  it("includes Slovak clause for sk language regardless of institution", async () => {
    const result = await generateProfessionalReview({
      workspaceId: "test-ws",
      sourceFileId: "test-file",
      documentTitle: "Test Thesis",
      authorName: "Test Author",
      reviewKind: "thesis",
      thesisType: "phd",
      reviewerRole: "opponent",
      language: "sk",
      institution: undefined,
    })

    expect(result.phdEnrichment).toBeDefined()
    expect(result.phdEnrichment.statutoryClause).toContain("§ 54")
    expect(result.phdEnrichment.statutoryClause).toContain("131/2002")
  })
})
