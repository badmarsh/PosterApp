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
 * 1800 chars ≈ 450 tokens — fits criterion-sized methodological paragraphs.
 */
export const CHUNK_SIZE_SHORT = 1800

/**
 * Chunk size for longer documents (PhD dissertations > 200k chars).
 * 3000 chars ≈ 750 tokens — preserves the flow of longer argumentative sections.
 */
export const CHUNK_SIZE_LONG = 3000

/**
 * Resolves the appropriate chunk size for a given markdown document length.
 *
 * @param markdownLength  Length of the full markdown string in characters.
 * @returns               Target max characters per chunk.
 */
export function resolveChunkSize(markdownLength: number): number {
  return markdownLength > ADAPTIVE_CHUNK_SIZE_THRESHOLD ? CHUNK_SIZE_LONG : CHUNK_SIZE_SHORT
}
