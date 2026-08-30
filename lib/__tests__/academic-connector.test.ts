import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  searchAcademicPaper,
  auditThesisCitations,
  fetchAcademicAuthorProfile,
} from "@/lib/services/academic-connector"
import * as semanticScholarService from "@/lib/services/semantic-scholar-service"
import * as arxivService from "@/lib/services/arxiv-service"

describe("Academic Connector Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("routes arXiv queries to arXiv metadata service", async () => {
    const mockArxivMeta: arxivService.PaperMetadata = {
      arxivId: "2301.12345",
      title: "Deep Learning for Physics Analysis",
      authors: ["Alice Smith", "Bob Jones"],
      publishedYear: "2023",
      abstract: "A novel neural network architecture...",
      doi: "10.1234/arxiv.2301.12345",
      pdfUrl: "https://arxiv.org/pdf/2301.12345.pdf",
    }

    vi.spyOn(arxivService, "parseArxivId").mockReturnValue("2301.12345")
    vi.spyOn(arxivService, "fetchArxivMetadata").mockResolvedValue(mockArxivMeta)

    const results = await searchAcademicPaper("2301.12345")
    expect(results).toHaveLength(1)
    expect(results[0].source).toBe("arxiv")
    expect(results[0].title).toBe("Deep Learning for Physics Analysis")
    expect(results[0].year).toBe(2023)
  })

  it("routes general queries to Semantic Scholar API", async () => {
    const mockScholarPaper: semanticScholarService.ScholarPaper = {
      paperId: "ss-12345",
      title: "Attention Is All You Need",
      authors: [{ authorId: "a1", name: "Ashish Vaswani" }],
      year: 2017,
      abstract: "The dominant sequence transduction models...",
      citationCount: 90000,
      externalIds: { DOI: "10.5555/3295222.3295349" },
    }

    vi.spyOn(semanticScholarService, "searchPaperByTitle").mockResolvedValue([mockScholarPaper])

    const results = await searchAcademicPaper("Attention Is All You Need")
    expect(results).toHaveLength(1)
    expect(results[0].source).toBe("semanticscholar")
    expect(results[0].title).toBe("Attention Is All You Need")
    expect(results[0].doi).toBe("10.5555/3295222.3295349")
  })

  it("audits thesis citations and flags missing DOI or unverified references", async () => {
    const verifiedPaper: semanticScholarService.ScholarPaper = {
      paperId: "p1",
      title: "Transformers for Computer Vision",
      authors: [{ authorId: "a1", name: "Alexey Dosovitskiy" }],
      year: 2020,
      // intentionally missing DOI
    }

    vi.spyOn(semanticScholarService, "verifyCitation")
      .mockResolvedValueOnce({
        found: true,
        confidence: "high",
        paper: verifiedPaper,
      })
      .mockResolvedValueOnce({
        found: false,
        confidence: "not_found",
        paper: null,
      })

    const audit = await auditThesisCitations([
      "Dosovitskiy: Transformers for Computer Vision (2020)",
      "NonExistentPaperTitleXYZ: Fake Study",
    ])

    expect(audit.total).toBe(2)
    expect(audit.verified).toBe(1)
    expect(audit.unverified).toBe(1)
    expect(audit.results[0].iso690Issues.length).toBeGreaterThan(0)
    expect(audit.results[0].iso690Issues[0]).toContain("No DOI found")
    expect(audit.results[1].verification.found).toBe(false)
  })

  it("fetches academic author profile", async () => {
    vi.spyOn(semanticScholarService, "searchAuthor").mockResolvedValue({
      authorId: "auth-99",
      name: "Geoffrey Hinton",
      paperCount: 300,
      citationCount: 500000,
    })
    vi.spyOn(semanticScholarService, "fetchAuthorPapers").mockResolvedValue([
      { paperId: "p1", title: "Deep Boltzmann Machines", year: 2009, authors: [] },
    ])

    const profile = await fetchAcademicAuthorProfile("Geoffrey Hinton")
    expect(profile).not.toBeNull()
    expect(profile?.name).toBe("Geoffrey Hinton")
    expect(profile?.paperCount).toBe(300)
    expect(profile?.recentPapers).toHaveLength(1)
  })
})
