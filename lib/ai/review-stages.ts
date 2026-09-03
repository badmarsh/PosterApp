/**
 * Shared review-generation stage labels (pipeline ↔ job manager ↔ SSE client).
 */
export type ReviewStage =
  | "queued"
  | "loading_context"
  | "retrieval"
  | "criterion_reviews"
  | "primary_review"
  | "self_critique"
  | "synthesis"
  | "persisting"
  | "done"
  | "error"
  | "cancelled"

/** Localized short labels for the progress UI (SK/CS/EN). */
export const REVIEW_STAGE_LABELS: Record<ReviewStage, { sk: string; cs: string; en: string }> = {
  queued: { sk: "V poradí", cs: "Ve frontě", en: "Queued" },
  loading_context: { sk: "Načítam dokument", cs: "Načítám dokument", en: "Loading manuscript" },
  retrieval: { sk: "Vyhľadávam dôkazy (RAG)", cs: "Vyhledávám důkazy (RAG)", en: "Retrieving evidence (RAG)" },
  criterion_reviews: { sk: "Hodnotím kritériá", cs: "Hodnotím kritéria", en: "Reviewing criteria" },
  primary_review: { sk: "Hlavný posudok", cs: "Hlavní posudek", en: "Primary review" },
  self_critique: { sk: "Sebakritika", cs: "Sebekritika", en: "Self-critique" },
  synthesis: { sk: "Záverečná syntéza", cs: "Závěrečná syntéza", en: "Final synthesis" },
  persisting: { sk: "Ukladám posudok", cs: "Ukládám posudek", en: "Saving review" },
  done: { sk: "Hotovo", cs: "Hotovo", en: "Done" },
  error: { sk: "Chyba", cs: "Chyba", en: "Error" },
  cancelled: { sk: "Zrušené", cs: "Zrušeno", en: "Cancelled" },
}
