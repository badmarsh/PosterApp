/**
 * Shared adaptive chunk-size configuration for the thesis review RAG pipeline.
 *
 * This module exists to eliminate the DRY violation where the 200k-char threshold
 * and chunk sizes were duplicated literally in both:
 *  - app/api/ingestion/parse/route.ts   (fire-and-forget ingest)
 *  - app/api/workspaces/[id]/thesis-review/reindex/route.ts  (explicit reindex)
 *
 * Previously, tuning the threshold in one file would silently diverge from the
 * other, causing different chunk granularities between "first ingest" and
 * "post-edit re-analysis" of the same thesis.
 */

/** Character-count threshold above which a document is treated as a PhD/long thesis. */
export const ADAPTIVE_CHUNK_SIZE_THRESHOLD = 200_000

/**
 * Chunk size for shorter documents (Bc/MSc/journal articles ≤ 200k chars).
 * 1200 chars ≈ 400–480 Slovak/Czech tokens — safely inside the 512-token
 * window of paraphrase-multilingual-MiniLM-L12-v2 (input beyond 512 tokens is
 * silently truncated by the tokenizer and never influences the vector).
 */
export const CHUNK_SIZE_SHORT = 1200

/**
 * Chunk size for longer documents (PhD dissertations > 200k chars).
 * 1500 chars ≈ 500–600 tokens — upper bound that still (mostly) fits the
 * embedding window; heading-path prefix adds ~20–40 tokens on top.
 */
export const CHUNK_SIZE_LONG = 1500

/** Overlap between consecutive subchunks (chars). */
export const CHUNK_OVERLAP = 150

/**
 * Resolves the appropriate chunk size for a given markdown document length.
 *
 * @param markdownLength  Length of the full markdown string in characters.
 * @returns               Target max characters per chunk.
 */
export function resolveChunkSize(markdownLength: number): number {
  return markdownLength > ADAPTIVE_CHUNK_SIZE_THRESHOLD ? CHUNK_SIZE_LONG : CHUNK_SIZE_SHORT
}
