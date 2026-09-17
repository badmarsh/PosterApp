-- Contextual Retrieval (Anthropic-style chunk enrichment):
-- each chunk gets a 1–2 sentence contextual prefix (document title, research
-- domain, hierarchical section path, section objective) that is embedded and
-- included in the full-text-search tsvector, while `content` keeps the
-- verbatim source text required by the evidence validator's exact-quote
-- verification. Nullable: chunks indexed before this column simply have no
-- prefix and the FTS expression falls back to content-only.

ALTER TABLE "DocumentChunk"
  ADD COLUMN IF NOT EXISTS "contextPrefix" TEXT;
