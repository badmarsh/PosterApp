-- Structure-aware chunking: record the structural kind of every chunk so
-- tables / equations / figure captions can be kept whole and retrieved by type.
ALTER TABLE "DocumentChunk"
  ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'prose';

CREATE INDEX IF NOT EXISTS "DocumentChunk_workspaceId_kind_idx"
  ON "DocumentChunk" ("workspaceId", "kind");

-- Backfill: mark existing chunks whose content is clearly structural.
UPDATE "DocumentChunk" SET kind = 'table'
  WHERE kind = 'prose'
    AND content ~ '^\s*\|.*\|\s*$'
    AND (
      SELECT COUNT(*) FROM regexp_split_to_table(content, '\n') AS ln
      WHERE ln ~ '^\s*\|.*\|\s*$'
    ) >= 2;

UPDATE "DocumentChunk" SET kind = 'equation'
  WHERE kind = 'prose' AND content LIKE '%$$%';

UPDATE "DocumentChunk" SET kind = 'figure_caption'
  WHERE kind = 'prose'
    AND (
      substring(content from '^\s*(.{0,40})') ~* '^(obr\.?\s*č?\.?\s*[0-9]|obrázok\s*č?\.?\s*[0-9]|fig(ure)?\.?\s*[0-9]|tab\.?\s*č?\.?\s*[0-9]|graf\s*č?\.?\s*[0-9]|schéma\s*č?\.?\s*[0-9])'
    );
