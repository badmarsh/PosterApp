/**
 * Shared badge/status color config for the thesis-review module.
 *
 * Token strategy (hybrid): reuse the app's existing semantic tokens
 * (`success`, `warning`, `destructive`) where a badge's meaning overlaps
 * with one of them, and fall back to four dedicated tokens
 * (`status-info`, `status-ambiguous`, `status-interpretation`,
 * `status-neutral` — defined in app/globals.css) for meanings that don't
 * map cleanly onto pass/fail/danger.
 *
 * Every map is keyed exactly the way its source type is keyed (see
 * lib/ai/review-types.ts and lib/ai/thesis-rubric.ts), so consumers can
 * index directly: SEVERITY_CLASSES[finding.severity].
 */

import type { ReviewSeverity, EpistemicStatus, EvidenceState } from "@/lib/ai/review-types"
import type { CriterionRating } from "@/lib/ai/thesis-rubric"

export const SEVERITY_CLASSES: Record<ReviewSeverity, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  major: "bg-severity-major/15 text-severity-major border-severity-major/30",
  minor: "bg-status-info/15 text-status-info border-status-info/30",
  suggestion: "bg-muted text-muted-foreground border-muted-foreground/30",
  info: "bg-status-neutral/10 text-muted-foreground border-status-neutral/20",
}

/**
 * SUPPORTED_FACT      → verified directly against the manuscript (success)
 * SUPPORTED_INTERPRETATION → reviewer reading of the text, not a raw quote
 * REVIEWER_JUDGMENT   → subjective assessment, no textual anchor
 * MISSING_EVIDENCE    → could not be verified in the available text (warning)
 * REQUIRES_HUMAN_VERIFICATION → AI flagged, needs reviewer eyes (ambiguous)
 * POSSIBLE_RISK       → potential issue worth flagging (dedicated rose —
 *                        distinct from `destructive`, since this is a soft
 *                        flag rather than a hard error)
 */
export const EPISTEMIC_CLASSES: Record<EpistemicStatus, string> = {
  SUPPORTED_FACT: "bg-success/10 text-success border-success/30",
  SUPPORTED_INTERPRETATION:
    "bg-status-interpretation/10 text-status-interpretation border-status-interpretation/30",
  REVIEWER_JUDGMENT: "bg-status-neutral/10 text-muted-foreground border-status-neutral/30",
  MISSING_EVIDENCE: "bg-warning/10 text-warning border-warning/30",
  REQUIRES_HUMAN_VERIFICATION:
    "bg-status-ambiguous/10 text-status-ambiguous border-status-ambiguous/30",
  POSSIBLE_RISK: "bg-risk/10 text-risk border-risk/30",
}

export const EVIDENCE_CLASSES: Record<EvidenceState, string> = {
  "verified-exact": "text-success bg-success/10 border-success/30",
  "verified-normalized": "text-success bg-success/10 border-success/30",
  approximate: "text-warning bg-warning/10 border-warning/30",
  ambiguous: "text-status-ambiguous bg-status-ambiguous/10 border-status-ambiguous/30",
  stale: "text-destructive bg-destructive/10 border-destructive/30",
  unverified: "text-muted-foreground bg-muted border-border",
  verified: "text-success bg-success/10 border-success/30", // backward-compat alias for verified-exact
}

/**
 * Grade scale (A → FX) kept as its own literal red→green ramp rather than
 * folded into the 3-token semantic system: it's a 7-point ordinal scale,
 * not a pass/fail/danger signal, so it needs more steps than success/
 * warning/destructive can express. Carried over unchanged from the
 * original thesis-criteria-card.tsx RATING_COLORS.
 */
export const RATING_CLASSES: Record<CriterionRating, string> = {
  A: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-200",
  B: "bg-lime-100 text-lime-800 border-lime-300 dark:bg-lime-900/30 dark:text-lime-200",
  C: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-200",
  D: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-200",
  E: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-100",
  FX: "bg-red-200 text-red-900 border-red-400 dark:bg-red-900/50 dark:text-red-100",
  pending: "bg-muted text-muted-foreground border-border",
}
