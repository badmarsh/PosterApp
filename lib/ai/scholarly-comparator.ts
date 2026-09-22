/**
 * Scholarly Paper Canonicalization & Structured Prior-Art Comparator
 *
 * Implements:
 * 1. Canonicalization and deduplication across OpenAlex, Semantic Scholar, Crossref, and arXiv into ScholarlyPaper.
 * 2. Multi-dimensional claim <-> paper structured comparison:
 *    - problem / research question
 *    - task / domain
 *    - method / architecture
 *    - dataset / evaluation setting
 *    - metric & quantitative results
 * 3. Classification of relationship:
 *    - DIRECT_PRIOR_ART
 *    - CLOSE_PRIOR_ART
 *    - RELATED_METHOD
 *    - RELATED_PROBLEM
 *    - BACKGROUND
 *    - COMPLEMENTARY
 *    - NOT_MATERIAL
 *    - POSTDATED
 */

import type { AcademicPaperResult } from "@/lib/services/academic-connector"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

export type PriorArtRelation =
  | "DIRECT_PRIOR_ART"
  | "CLOSE_PRIOR_ART"
  | "RELATED_METHOD"
  | "RELATED_PROBLEM"
  | "BACKGROUND"
  | "COMPLEMENTARY"
  | "NOT_MATERIAL"
  | "POSTDATED"

export type OverlapLevel = "none" | "low" | "medium" | "high"

export interface StructuredClaimPaperComparison {
  relation: PriorArtRelation
  problemOverlap: OverlapLevel
  methodOverlap: OverlapLevel
  datasetOverlap: OverlapLevel
  claimOverlap: OverlapLevel
  temporalValidity: "valid" | "postdated" | "unknown"
  isPriorArt: boolean
  explanation: string
}

/**
 * Normalizes title for deduplication: lowercases, folds diacritics, strips punctuation.
 */
export function canonicalTitleKey(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/**
 * Normalizes DOI: lowercases, removes http:// or https://dx.doi.org/ prefix.
 */
export function canonicalDoi(doi?: string | null): string | null {
  if (!doi) return null
  const clean = doi.trim().toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "")
  const m = clean.match(/10\.\d{4,9}\/.+/)
  return m ? m[0] : clean || null
}

/**
 * Merges raw academic results into canonical ScholarlyPaper database records.
 */
export async function persistCanonicalScholarlyPaper(
  workspaceId: string,
  paper: AcademicPaperResult & { publishedAt?: string | null }
): Promise<{ id: string; titleKey: string }> {
  const normTitle = canonicalTitleKey(paper.title)
  const normDoi = canonicalDoi(paper.doi)

  const existing = await prisma.scholarlyPaper.findUnique({
    where: {
      workspaceId_titleKey: {
        workspaceId,
        titleKey: normTitle,
      },
    },
  })

  const pubDate = paper.publishedAt ? new Date(paper.publishedAt) : undefined
  const validPubDate = pubDate && !isNaN(pubDate.getTime()) ? pubDate : null

  const provenanceJson: Prisma.InputJsonValue = {
    [paper.source || "external"]: {
      paperId: paper.paperId ?? null,
      url: paper.url ?? null,
      retrievedAt: new Date().toISOString(),
    },
  }

  if (existing) {
    const existingProv =
      typeof existing.provenance === "object" && existing.provenance !== null && !Array.isArray(existing.provenance)
        ? (existing.provenance as Record<string, unknown>)
        : {}

    const updated = await prisma.scholarlyPaper.update({
      where: { id: existing.id },
      data: {
        doi: existing.doi || normDoi,
        abstract: existing.abstract || paper.abstract || paper.tldr,
        year: existing.year || paper.year,
        publicationDate: existing.publicationDate || validPubDate,
        venue: existing.venue || paper.venue,
        citationCount: Math.max(existing.citationCount || 0, paper.citationCount || 0),
        provenance: {
          ...existingProv,
          ...provenanceJson,
        } as Prisma.InputJsonValue,
      },
    })
    return { id: updated.id, titleKey: updated.titleKey }
  }

  const created = await prisma.scholarlyPaper.create({
    data: {
      workspaceId,
      titleKey: normTitle,
      title: paper.title,
      doi: normDoi,
      authors: paper.authors || [],
      year: paper.year,
      publicationDate: validPubDate,
      venue: paper.venue,
      abstract: paper.abstract || paper.tldr,
      citationCount: paper.citationCount,
      sourceProvider: paper.source || "merged",
      provenance: provenanceJson,
    },
  })

  return { id: created.id, titleKey: created.titleKey }
}

function wordOverlapJaccard(textA: string, textB: string): number {
  const wordsA = new Set(textA.toLowerCase().split(/\s+/).filter((w) => w.length > 3))
  const wordsB = new Set(textB.toLowerCase().split(/\s+/).filter((w) => w.length > 3))
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  let inter = 0
  for (const w of wordsA) if (wordsB.has(w)) inter++
  return inter / (wordsA.size + wordsB.size - inter)
}

/**
 * Deterministic multi-dimensional claim <-> paper comparison.
 */
export function compareClaimToPaper(
  claimText: string,
  paper: {
    title: string
    abstract?: string | null
    year?: number | null
    publishedAt?: string | null
  },
  thesisYear?: number | null,
  thesisDate?: string | null,
  cosineSimilarity = 0
): StructuredClaimPaperComparison {
  const paperYear = paper.year ?? (paper.publishedAt ? new Date(paper.publishedAt).getFullYear() : null)
  const effectiveThesisYear = thesisYear ?? (thesisDate ? new Date(thesisDate).getFullYear() : null)

  let temporalValidity: "valid" | "postdated" | "unknown" = "unknown"
  if (effectiveThesisYear !== null && paperYear !== null) {
    temporalValidity = paperYear > effectiveThesisYear ? "postdated" : "valid"
  }

  if (temporalValidity === "postdated") {
    return {
      relation: "POSTDATED",
      problemOverlap: "none",
      methodOverlap: "none",
      datasetOverlap: "none",
      claimOverlap: "none",
      temporalValidity: "postdated",
      isPriorArt: false,
      explanation: `Paper published in ${paperYear} post-dates thesis submitted in ${effectiveThesisYear}; cannot be prior art.`,
    }
  }

  const combinedPaper = `${paper.title} ${paper.abstract || ""}`.toLowerCase()
  const overlap = wordOverlapJaccard(claimText, combinedPaper)

  const methodKeywords = ["method", "algorithm", "model", "network", "transformer", "framework", "approach", "metod", "architekt"]
  const datasetKeywords = ["dataset", "corpus", "benchmark", "eval", "data", "participants", "subjects", "vzork"]
  const problemKeywords = ["task", "problem", "objective", "goal", "detect", "classify", "predict", "ries", "optimaliz"]

  const hasMethodTerm = methodKeywords.some((k) => claimText.toLowerCase().includes(k) && combinedPaper.includes(k))
  const hasDatasetTerm = datasetKeywords.some((k) => claimText.toLowerCase().includes(k) && combinedPaper.includes(k))
  const hasProblemTerm = problemKeywords.some((k) => claimText.toLowerCase().includes(k) && combinedPaper.includes(k))

  let methodOverlap: string = "none"
  if (hasMethodTerm && (overlap > 0.15 || cosineSimilarity > 0.8)) methodOverlap = "high"
  else if (hasMethodTerm) methodOverlap = "medium"
  else if (overlap > 0.1) methodOverlap = "low"

  let datasetOverlap: string = "none"
  if (hasDatasetTerm && overlap > 0.15) datasetOverlap = "high"
  else if (hasDatasetTerm) datasetOverlap = "medium"

  let problemOverlap: string = "none"
  if (hasProblemTerm && (overlap > 0.2 || cosineSimilarity > 0.8)) problemOverlap = "high"
  else if (hasProblemTerm || cosineSimilarity > 0.75) problemOverlap = "medium"
  else if (overlap > 0.05) problemOverlap = "low"

  let claimOverlap: string = "none"
  if (cosineSimilarity > 0.85 || overlap > 0.3) claimOverlap = "high"
  else if (cosineSimilarity > 0.75) claimOverlap = "medium"
  else if (overlap > 0.1) claimOverlap = "low"

  let relation: PriorArtRelation = "BACKGROUND"
  if (methodOverlap === "high" && problemOverlap === "high") {
    relation = "DIRECT_PRIOR_ART"
  } else if (methodOverlap === "high" || (problemOverlap === "high" && claimOverlap === "high")) {
    relation = "CLOSE_PRIOR_ART"
  } else if (methodOverlap === "high") {
    relation = "RELATED_METHOD"
  } else if (problemOverlap === "high") {
    relation = "RELATED_PROBLEM"
  } else if (overlap < 0.05 && cosineSimilarity < 0.7) {
    relation = "NOT_MATERIAL"
  }

  const isPriorArt = ["DIRECT_PRIOR_ART", "CLOSE_PRIOR_ART", "RELATED_METHOD", "RELATED_PROBLEM"].includes(relation)

  return {
    relation,
    problemOverlap: problemOverlap as OverlapLevel,
    methodOverlap: methodOverlap as OverlapLevel,
    datasetOverlap: datasetOverlap as OverlapLevel,
    claimOverlap: claimOverlap as OverlapLevel,
    temporalValidity,
    isPriorArt,
    explanation: `Problem: ${problemOverlap}, Method: ${methodOverlap}, Dataset: ${datasetOverlap}, Claim: ${claimOverlap}. Cosine: ${cosineSimilarity.toFixed(3)}. Verdict: ${relation}`,
  }
}
