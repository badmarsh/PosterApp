/**
 * Stored thesis-review record → output metadata.
 *
 * A posudok has two possible sources of truth: the cards the editor holds and
 * the review record the reviewer confirmed. The cards start empty when a
 * workspace gains a thesis-review output, so every server-side render of a
 * posudok (compile, export) has to be able to read the record.
 *
 * `reviewMetaFromRecord` does the mapping; this module is only the Prisma
 * loader, kept separate so the mapping stays unit-testable and client-safe.
 */

import { prisma } from "@/lib/prisma"
import { reviewMetaFromRecord, type ThesisReviewRecordLike } from "@/lib/latex/thesis-review-meta"
import type { ThesisReviewOutputMeta } from "@/lib/poster-types"

/**
 * Latest review record stored for a workspace, folded into `reviewMeta`.
 * Returns `null` when the workspace has no review so callers can keep the
 * card-derived document untouched.
 */
export async function loadReviewMetaForWorkspace(workspaceId: string): Promise<ThesisReviewOutputMeta | null> {
  let review: Record<string, unknown> | null = null
  try {
    review = (await prisma.thesisReview.findFirst({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
    })) as Record<string, unknown> | null
  } catch (err) {
    // A missing table (fresh schema) must not break compilation — the
    // document then falls back to the cards, exactly as before.
    console.warn("[review-record-meta] could not load review record:", err)
    return null
  }
  if (!review) return null
  const meta = reviewMetaFromRecord(review as unknown as ThesisReviewRecordLike)
  return Object.keys(meta).length > 0 ? meta : null
}

/**
 * Attach a stored review to a thesis-review output, without letting database
 * values overwrite metadata the caller set explicitly (client-supplied docs
 * win, then the record fills the gaps).
 */
export function mergeReviewMeta(
  meta: ThesisReviewOutputMeta | null | undefined,
  explicit: ThesisReviewOutputMeta | null | undefined,
): ThesisReviewOutputMeta | null {
  if (!meta && !explicit) return null
  return { ...(meta ?? {}), ...(explicit ?? {}) }
}
