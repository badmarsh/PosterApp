/**
 * Candidate-generator contracts.
 *
 * A *candidate generator* is one independent way of finding chunks that might answer a query.
 * Generators know nothing about each other, nothing about fusion, and nothing about ranking:
 * they return a ranked list and a score in their own scale. Fusion (`lib/ai/fusion.ts`) makes
 * the lists comparable; the reranker makes the final cut; evidence assembly turns the survivors
 * into prompt context.
 *
 * Keeping these separate is what lets the ablation suite switch a leg off and measure the
 * difference, and it is what lets a failing leg degrade to "no candidates" instead of failing
 * the whole review.
 *
 * @module retrievers/types
 */

import type { RetrievalSource } from "../fusion"

export type { RetrievalSource }

/** One chunk proposed by a generator. */
export interface RetrievalCandidate {
  /** DocumentChunk id. */
  id: string
  source: RetrievalSource
  /** Score in the generator's own scale — never compared across generators directly. */
  score: number
  heading: string | null
  content: string
  kind: string
  chunkType: string
  sectionPath: string | null
  pageStart: number | null
  pageEnd: number | null
  parentChunkId: string | null
  previousChunkId: string | null
  nextChunkId: string | null
  documentId: string
  tokens: number
  /** Anthropic-style contextual prefix. Indexed for FTS, never part of `content`. */
  contextPrefix: string | null
  /** Generator-specific diagnostics (matched entity, matched citation, …). */
  meta?: Record<string, unknown>
}

/** Everything a generator is allowed to know about the request. */
export interface RetrievalContext {
  workspaceId: string
  /** The query text (lexical generators) — already expanded by the caller if desired. */
  query: string
  /** Pre-computed query vectors; a generator that needs none ignores this. */
  queryEmbeddings?: number[][]
  /** How many candidates this generator should aim for. */
  limit: number
  /** Restrict to one ingest file. */
  documentId?: string
  /** Restrict to a set of ingest files. An empty array must match nothing. */
  documentIds?: string[]
  /** Restrict to structural kinds ("table" | "equation" | …). */
  kinds?: string[]
  /** Restrict to fine-grained chunk types ("paragraph" | "section" | "citation" | …). */
  chunkTypes?: string[]
  /** Boost (not filter) chunks whose section path starts with one of these. */
  sectionPathPrefixes?: string[]
  /** Restrict to a page window, when the query is page-anchored. */
  pageRange?: [number, number]
  /** Include section-level parent chunks in the candidate pool. */
  includeParents?: boolean
  signal?: AbortSignal
}

export interface GeneratorResult {
  source: RetrievalSource
  items: RetrievalCandidate[]
  /** Milliseconds this generator took. */
  latencyMs: number
  /** Non-fatal failure: the generator returned nothing and recorded why. */
  error?: string
  enabled: boolean
  /** True when an ablation switched this leg off (distinct from "not enabled for this route"). */
  excludedByAblation?: boolean
}

export interface CandidateGenerator {
  source: RetrievalSource
  /** Whether this leg should run at all (feature flags, missing data, …). */
  enabled(ctx: RetrievalContext): boolean
  retrieve(ctx: RetrievalContext): Promise<RetrievalCandidate[]>
}

/** Column projection shared by every generator, so payloads are homogeneous. */
export const CHUNK_SELECT_COLUMNS = `id, heading, content, tokens, kind, "chunkType", "sectionPath",
       "pageStart", "pageEnd", "parentChunkId", "previousChunkId", "nextChunkId", "documentId", "contextPrefix"`

/** Row shape returned by the shared projection. */
export interface ChunkRow {
  id: string
  heading: string | null
  content: string
  tokens: number
  kind: string
  chunkType: string
  sectionPath: string | null
  pageStart: number | null
  pageEnd: number | null
  parentChunkId: string | null
  previousChunkId: string | null
  nextChunkId: string | null
  documentId: string
  contextPrefix: string | null
}

/** Maps a raw row plus a source-specific score into a RetrievalCandidate. */
export function toCandidate(row: ChunkRow, source: RetrievalSource, score: number, meta?: Record<string, unknown>): RetrievalCandidate {
  return {
    id: row.id,
    source,
    score,
    heading: row.heading,
    content: row.content,
    kind: row.kind ?? "prose",
    chunkType: row.chunkType ?? "paragraph",
    sectionPath: row.sectionPath ?? null,
    pageStart: row.pageStart ?? null,
    pageEnd: row.pageEnd ?? null,
    parentChunkId: row.parentChunkId ?? null,
    previousChunkId: row.previousChunkId ?? null,
    nextChunkId: row.nextChunkId ?? null,
    documentId: row.documentId,
    tokens: row.tokens ?? 0,
    contextPrefix: row.contextPrefix ?? null,
    meta,
  }
}
