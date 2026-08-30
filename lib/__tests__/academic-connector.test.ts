import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  searchAcademicPaper,
  auditThesisCitations,
  fetchAcademicAuthorProfile,
  verifySingleCitation,
  checkIso690Issues,
} from "@/lib/services/academic-connector"
import * as semanticScholarService from "@/lib/services/semantic-scholar-service"
import * as arxivService from "@/lib/services/arxiv-service"
import * as openalexService from "@/lib/services/openalex-service"
import * as crossrefService from "@/lib/services/crossref-service"

describe("Academic Connector Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("prioritizes direct DOI lookup before fuzzy title search", async () => {
    const mockPaper: semanticScholarService.ScholarPaper = {
      paperId: "doi-paper-1",
      title: "Deep Residual Learning for Image Recognition",
      authors: [{ authorId: "a1", name: "Kaiming He" }],
      year: 2016,
      externalIds: { DOI: "10.1109/CVPR.2016.90" },
    }

    const fetchDetailsSpy = vi.spyOn(semanticScholarService, "fetchPaperDetails").mockResolvedValue({
      paper: mockPaper,
      status: "verified",
    })
    const searchSpy = vi.spyOn(semanticScholarService, "searchPaperByTitle")

    const result = await verifySingleCitation("He, K. Deep Residual Learning. 2016. DOI: 10.1109/CVPR.2016.90")
    expect(fetchDetailsSpy).toHaveBeenCalledWith("DOI:10.1109/CVPR.2016.90", undefined)
    expect(searchSpy).not.toHaveBeenCalled()
    expect(result.status).toBe("verified")
    expect(result.verification.found).toBe(true)
  })

  it("prioritizes direct arXiv metadata lookup when arXiv identifier is present", async () => {
    const mockArxivMeta: arxivService.PaperMetadata = {
      arxivId: "2301.12345",
      title: "Deep Learning for Physics Analysis",
      authors: ["Alice Smith", "Bob Jones"],
      publishedYear: "2023",
      abstract: "A novel neural network architecture...",
      doi: "10.1234/arxiv.2301.12345",
      pdfUrl: "https://arxiv.org/pdf/2301.12345.pdf",
    }

    vi.spyOn(semanticScholarService, "fetchPaperDetails").mockResolvedValue({
      paper: null,
      status: "not_found",
    })
    vi.spyOn(arxivService, "fetchArxivMetadata").mockResolvedValue(mockArxivMeta)

    const result = await verifySingleCitation("Smith, A. Physics AI. 2023. arXiv:2301.12345")
    expect(result.verification.found).toBe(true)
    expect(result.status).toBe("verified")
    expect(result.enriched?.source).toBe("semanticscholar") // shaped into scholar result
    expect(result.enriched?.title).toBe("Deep Learning for Physics Analysis")
  })

  it("does not require DOI for book citations and checks access date for web resources", () => {
    // 1. Book citation
    const bookIssues = checkIso690Issues(
      "Goodfellow, I. Deep Learning. MIT Press, 2016. ISBN: 9780262035613.",
      {
        raw: "Goodfellow, I. Deep Learning. MIT Press, 2016.",
        title: "Deep Learning",
        authors: ["Goodfellow, I."],
        year: 2016,
        sourceType: "book",
        parseWarnings: [],
      },
      null
    )
    expect(bookIssues.some((i) => i.code === "missing_identifier")).toBe(false)

    // 2. Web citation missing access date
    const webIssues = checkIso690Issues(
      "W3C. Web Standards. https://www.w3.org",
      {
        raw: "W3C. Web Standards. https://www.w3.org",
        title: "Web Standards",
        authors: ["W3C"],
        year: 2022,
        url: "https://www.w3.org",
        sourceType: "web",
        parseWarnings: [],
      },
      null
    )
    expect(webIssues.some((i) => i.code === "missing_access_date")).toBe(true)
  })

  it("flags metadata discrepancies when cited year differs from registry", () => {
    const verifiedPaper: semanticScholarService.ScholarPaper = {
      paperId: "p1",
      title: "Convolutional Networks",
      authors: [{ authorId: "a1", name: "Yann LeCun" }],
      year: 1998,
    }

    const issues = checkIso690Issues(
      "LeCun, Y. Convolutional Networks. 2015.",
      {
        raw: "LeCun, Y. Convolutional Networks. 2015.",
        title: "Convolutional Networks",
        authors: ["LeCun, Y."],
        year: 2015,
        sourceType: "article",
        parseWarnings: [],
      },
      verifiedPaper
    )

    const discrepancy = issues.find((i) => i.code === "inconsistent_metadata")
    expect(discrepancy).toBeDefined()
    expect(discrepancy?.message).toContain("1998")
  })

  it("deduplicates identical citations and tracks unavailable service statuses", async () => {
    vi.spyOn(semanticScholarService, "fetchPaperDetails").mockResolvedValue({
      paper: null,
      status: "rate_limited",
    })
    vi.spyOn(semanticScholarService, "verifyCitation").mockResolvedValue({
      found: false,
      status: "rate_limited",
      confidence: "not_found",
      paper: null,
      note: "Rate limited",
    })

    const audit = await auditThesisCitations([
      "Attention Is All You Need. 2017.",
      "Attention Is All You Need. 2017.", // Duplicate
    ])

    expect(audit.total).toBe(2)
    expect(audit.unavailable).toBe(2)
    expect(audit.verified).toBe(0)
    expect(audit.summary.unavailable).toBe(2)
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

  it("merges and deduplicates multi-source search results across OpenAlex and Crossref", async () => {
    vi.spyOn(openalexService, "searchOpenAlexWorks").mockResolvedValue([
      {
        id: "https://openalex.org/W1234",
        title: "Quantum Error Correction",
        authors: ["Peter Shor"],
        publicationYear: 1995,
        citedByCount: 4500,
        doi: "10.1103/PhysRevA.52.R2493",
        openAccessPdfUrl: "https://arxiv.org/pdf/quant-ph/9506001.pdf",
      },
    ])
    vi.spyOn(semanticScholarService, "searchPaperByTitle").mockResolvedValue({
      papers: [
        {
          paperId: "s2-1",
          title: "Quantum Error Correction",
          authors: [{ authorId: "a1", name: "Peter Shor" }],
          year: 1995,
          citationCount: 4500,
          externalIds: { DOI: "10.1103/PhysRevA.52.R2493" },
        },
      ],
      status: "verified",
    })
    vi.spyOn(crossrefService, "searchCrossrefWorks").mockResolvedValue([])

    const results = await searchAcademicPaper("Quantum Error Correction", 5)
    expect(results.length).toBe(1)
    expect(results[0].title).toBe("Quantum Error Correction")
    expect(results[0].doi).toBe("10.1103/PhysRevA.52.R2493")
    expect(results[0].openAccessPdfUrl).toBe("https://arxiv.org/pdf/quant-ph/9506001.pdf")
  })

  it("handles empty or wildcard queries gracefully without HTTP 400", async () => {
    const fetchSpy = vi.spyOn(global, "fetch")
    
    // Empty queries and wildcards should return empty array without fetching
    const emptyResult = await openalexService.searchOpenAlexWorks("")
    const wildcardResult = await openalexService.searchOpenAlexWorks("???")
    const punctuationResult = await openalexService.searchOpenAlexWorks("---")

    expect(emptyResult).toEqual([])
    expect(wildcardResult).toEqual([])
    expect(punctuationResult).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

