/**
 * Evidence and Claim Graph Persistence Engine (Phases 9 & 13)
 *
 * Connects runtime findings and extracted thesis claims to first-class database records:
 *   1. Evidence rows with exact quotes, chunk IDs, start/end character offsets, and element types.
 *   2. ThesisClaim rows linked to their source DocumentChunks, with deterministic claim keys,
 *      verification statuses, and relations to backing Evidence rows.
 */

import { prisma } from "@/lib/prisma"
import { createHash } from "crypto"
import type { ReviewFinding, EvidenceReference } from "./review-types"

export interface PersistReviewEvidenceOptions {
  workspaceId: string
  documentId: string
  findings: ReviewFinding[]
  reviewId?: string
}

export interface ExtractedThesisClaimInput {
  text: string
  chunkId?: string | null
  documentId: string
  claimType?: string
  importance?: number
  chapter?: string | null
  section?: string | null
  page?: number | null
  confidence?: number
  verificationStatus?: "SUPPORTED" | "PARTIALLY_SUPPORTED" | "UNSUPPORTED" | "CONTRADICTED" | "UNCERTAIN" | null
  verification?: Record<string, any> | null
  citedPaperIds?: string[]
}

/**
 * Computes deterministic claim key: claim-<sha256(normalizedText)[:16]>
 */
export function computeClaimKey(text: string): string {
  const norm = text.replace(/\s+/g, " ").trim().toLowerCase()
  const hash = createHash("sha256").update(norm, "utf8").digest("hex").slice(0, 16)
  return `claim-${hash}`
}

/**
 * Computes character start and end offsets of a quote inside chunk content.
 */
export function findQuoteOffsets(
  chunkContent: string,
  quote: string
): { startOffset: number | null; endOffset: number | null } {
  if (!chunkContent || !quote) return { startOffset: null, endOffset: null }
  const cleanQuote = quote.trim()
  if (cleanQuote.length < 5) return { startOffset: null, endOffset: null }

  let idx = chunkContent.indexOf(cleanQuote)
  if (idx !== -1) {
    return { startOffset: idx, endOffset: idx + cleanQuote.length }
  }

  // Case-insensitive fallback
  idx = chunkContent.toLowerCase().indexOf(cleanQuote.toLowerCase())
  if (idx !== -1) {
    return { startOffset: idx, endOffset: idx + cleanQuote.length }
  }

  // Prefix fallback if quote is long
  if (cleanQuote.length > 50) {
    const prefix = cleanQuote.slice(0, 40)
    idx = chunkContent.indexOf(prefix)
    if (idx !== -1) {
      return { startOffset: idx, endOffset: idx + cleanQuote.length }
    }
  }

  return { startOffset: null, endOffset: null }
}

/**
 * Persists runtime findings' evidence items into first-class `Evidence` rows,
 * verifying and recording exact chunk offsets.
 */
export async function persistFindingsEvidence(
  opts: PersistReviewEvidenceOptions
): Promise<{ persistedEvidenceCount: number; evidenceIds: string[] }> {
  const { workspaceId, documentId, findings } = opts
  const evidenceRecords: Array<{
    quote: string
    chunkId: string
    page?: number | null
    sectionPath?: string | null
    elementType: string
    startOffset?: number | null
    endOffset?: number | null
  }> = []

  // Extract candidate evidence items from findings
  for (const finding of findings) {
    const evList: EvidenceReference[] = Array.isArray(finding.evidence) ? finding.evidence : []
    for (const ev of evList) {
      const quote = (ev.exactQuote || ev.quote || "").trim()
      if (!quote || !ev.chunkId) continue
      evidenceRecords.push({
        quote,
        chunkId: ev.chunkId,
        page: ev.page ?? null,
        sectionPath: ev.sectionHeading ?? null,
        elementType: "paragraph",
      })
    }
  }

  if (evidenceRecords.length === 0) {
    return { persistedEvidenceCount: 0, evidenceIds: [] }
  }

  // Fetch backing chunks to compute startOffset and endOffset
  const chunkIds = Array.from(new Set(evidenceRecords.map((e) => e.chunkId)))
  const chunks = await prisma.documentChunk.findMany({
    where: { id: { in: chunkIds }, workspaceId },
    select: { id: true, content: true, pageStart: true, sectionPath: true },
  })
  const chunkMap = new Map(chunks.map((c) => [c.id, c]))

  const createdIds: string[] = []

  for (const record of evidenceRecords) {
    const chunk = chunkMap.get(record.chunkId)
    const offsets = chunk ? findQuoteOffsets(chunk.content, record.quote) : { startOffset: null, endOffset: null }
    const page = record.page ?? chunk?.pageStart ?? null
    const sectionPath = record.sectionPath ?? chunk?.sectionPath ?? null

    try {
      const created = await prisma.evidence.create({
        data: {
          workspaceId,
          documentId,
          chunkId: record.chunkId,
          quote: record.quote,
          page,
          sectionPath,
          elementType: record.elementType,
          startOffset: offsets.startOffset,
          endOffset: offsets.endOffset,
          origin: "review-pipeline",
        },
        select: { id: true },
      })
      createdIds.push(created.id)
    } catch (err) {
      // Graceful error recovery: log and continue
      console.warn("[evidence-persister] Failed to insert Evidence row:", err)
    }
  }

  return { persistedEvidenceCount: createdIds.length, evidenceIds: createdIds }
}

/**
 * Persists an array of extracted thesis claims to the `ThesisClaim` table.
 * Links them idempotently via unique `(workspaceId, claimKey)`.
 */
export async function persistThesisClaims(
  workspaceId: string,
  claims: ExtractedThesisClaimInput[],
  backingEvidenceIds?: string[]
): Promise<{ persistedCount: number; claimIds: string[] }> {
  const claimIds: string[] = []

  for (const claim of claims) {
    const norm = claim.text.replace(/\s+/g, " ").trim()
    if (!norm) continue
    const claimKey = computeClaimKey(norm)

    try {
      const record = await prisma.thesisClaim.upsert({
        where: {
          workspaceId_claimKey: {
            workspaceId,
            claimKey,
          },
        },
        update: {
          documentId: claim.documentId,
          chunkId: claim.chunkId ?? undefined,
          text: claim.text,
          normalizedText: norm,
          claimType: claim.claimType ?? "empirical",
          importance: claim.importance ?? 0.5,
          chapter: claim.chapter ?? undefined,
          section: claim.section ?? undefined,
          page: claim.page ?? undefined,
          confidence: claim.confidence ?? 0.8,
          verificationStatus: claim.verificationStatus ?? undefined,
          verification: claim.verification ? (claim.verification as any) : undefined,
          citedPaperIds: claim.citedPaperIds ?? [],
          evidence: backingEvidenceIds && backingEvidenceIds.length > 0 ? {
            connect: backingEvidenceIds.map((id) => ({ id })),
          } : undefined,
        },
        create: {
          workspaceId,
          documentId: claim.documentId,
          chunkId: claim.chunkId ?? undefined,
          claimKey,
          text: claim.text,
          normalizedText: norm,
          claimType: claim.claimType ?? "empirical",
          importance: claim.importance ?? 0.5,
          chapter: claim.chapter ?? undefined,
          section: claim.section ?? undefined,
          page: claim.page ?? undefined,
          confidence: claim.confidence ?? 0.8,
          verificationStatus: claim.verificationStatus ?? undefined,
          verification: claim.verification ? (claim.verification as any) : undefined,
          citedPaperIds: claim.citedPaperIds ?? [],
          evidence: backingEvidenceIds && backingEvidenceIds.length > 0 ? {
            connect: backingEvidenceIds.map((id) => ({ id })),
          } : undefined,
        },
        select: { id: true },
      })
      claimIds.push(record.id)
    } catch (err) {
      console.warn(`[evidence-persister] Failed to upsert ThesisClaim ${claimKey}:`, err)
    }
  }

  return { persistedCount: claimIds.length, claimIds }
}
