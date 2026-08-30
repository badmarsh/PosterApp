/**
 * Academic Connector — unified façade over multiple academic databases.
 *
 * Sources:
 *  1. Semantic Scholar Graph API  (general papers, citations)
 *  2. arXiv API                   (physics, CS, math preprints)
 *
 * Used in thesis-review pipeline to:
 *  - Verify that cited works actually exist
 *  - Check ISO 690 completeness (DOI, year, etc.)
 *  - Optionally enrich references with metadata
 */

import {
  searchPaperByTitle,
  verifyCitation,
  searchAuthor,
  fetchAuthorPapers,
  type ScholarPaper,
  type CitationVerification,
  type ScholarAuthor,
} from "./semantic-scholar-service"
import { fetchArxivMetadata, parseArxivId } from "./arxiv-service"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AcademicPaperResult {
  source: "semanticscholar" | "arxiv"
  paperId?: string
  title: string
  authors: string[]
  year?: number | null
  abstract?: string | null
  doi?: string
  arxivId?: string
  url?: string
  citationCount?: number
}

export interface AuthorProfile {
  name: string
  scholarId?: string
  paperCount?: number
  citationCount?: number
  recentPapers: Pick<AcademicPaperResult, "title" | "year">[]
}

export interface CitationCheckResult {
  /** The citation string as extracted from the thesis */
  citedText: string
  verification: CitationVerification
  enriched?: AcademicPaperResult
  iso690Issues: string[]
}

export interface ThesisCitationAudit {
  total: number
  verified: number
  unverified: number
  results: CitationCheckResult[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scholarPaperToResult(p: ScholarPaper): AcademicPaperResult {
  return {
    source: "semanticscholar",
    paperId: p.paperId,
    title: p.title,
    authors: p.authors.map((a) => a.name),
    year: p.year,
    abstract: p.abstract,
    doi: p.externalIds?.DOI,
    arxivId: p.externalIds?.ArXiv,
    url: p.url,
    citationCount: p.citationCount,
  }
}

/**
 * Detects common ISO 690 / BibTeX completeness issues for a given cited work.
 */
function checkIso690Issues(citedText: string, paper: ScholarPaper | null): string[] {
  const issues: string[] = []
  if (!paper) return issues

  // Year
  if (!paper.year) issues.push(`Missing publication year for: "${citedText.slice(0, 60)}"`)

  // Authors
  if (!paper.authors?.length) issues.push(`Missing authors for: "${citedText.slice(0, 60)}"`)

  // DOI
  if (!paper.externalIds?.DOI) {
    issues.push(`No DOI found for: "${paper.title.slice(0, 60)}" — consider adding one`)
  }

  return issues
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search for a paper across Semantic Scholar.
 * Falls back to arXiv if the query looks like an arXiv ID.
 */
export async function searchAcademicPaper(query: string, limit = 5): Promise<AcademicPaperResult[]> {
  // If it looks like an arXiv ID, fetch directly
  const arxivId = parseArxivId(query)
  if (arxivId) {
    const meta = await fetchArxivMetadata(arxivId)
    if (meta) {
      return [{
        source: "arxiv",
        title: meta.title ?? query,
        authors: meta.authors ?? [],
        year: meta.publishedYear ? parseInt(meta.publishedYear) : undefined,
        abstract: meta.abstract,
        doi: meta.doi,
        arxivId: meta.arxivId,
        url: meta.pdfUrl,
      }]
    }
  }

  const papers = await searchPaperByTitle(query, limit)
  return papers.map(scholarPaperToResult)
}

/**
 * Verify a list of citation titles (e.g. extracted from a references section).
 * Returns a full audit report with per-citation verification and ISO 690 issues.
 */
export async function auditThesisCitations(citedTitles: string[]): Promise<ThesisCitationAudit> {
  const results: CitationCheckResult[] = []

  // Sequential with small delay to respect rate limits
  for (const cited of citedTitles.slice(0, 30)) { // cap at 30 citations per audit
    const verification = await verifyCitation(cited)
    const iso690Issues = checkIso690Issues(cited, verification.paper)

    results.push({
      citedText: cited,
      verification,
      enriched: verification.paper ? scholarPaperToResult(verification.paper) : undefined,
      iso690Issues,
    })

    // Polite 100ms delay between requests
    await new Promise((r) => setTimeout(r, 100))
  }

  const verified = results.filter((r) => r.verification.found).length

  return {
    total: results.length,
    verified,
    unverified: results.length - verified,
    results,
  }
}

/**
 * Look up author profile from Semantic Scholar.
 * Returns their recent papers and citation statistics.
 */
export async function fetchAcademicAuthorProfile(name: string): Promise<AuthorProfile | null> {
  const author: ScholarAuthor | null = await searchAuthor(name)
  if (!author) return null

  const papers = await fetchAuthorPapers(author.authorId, 5)

  return {
    name: author.name,
    scholarId: author.authorId,
    paperCount: author.paperCount,
    citationCount: author.citationCount,
    recentPapers: papers.map((p) => ({ title: p.title, year: p.year })),
  }
}
