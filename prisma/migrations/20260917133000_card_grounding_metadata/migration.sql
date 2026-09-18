-- Persist quote-grounded auto-fill metadata without coupling it to the card text.
ALTER TABLE "Card" ADD COLUMN "grounding" JSONB;
