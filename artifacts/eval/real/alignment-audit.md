# Golden-corpus alignment audit

**Date:** 2026-09-27
**Scope:** Offline data/ID-integrity audit only. No retrieval run, embedding inference, network access, database access, or annotation changes were made.

## Finding

The saved `data/eval/golden-v2/` judgments refer to chunk IDs from `data/eval/corpus/chunks-index.json`, which is generated with PosterApp's production `chunkMarkdown()` function. The previous `real-corpus-benchmark.ts` instead used a private evaluation splitter. Replaying that splitter over the three Markdown sources produces 117 chunks (24 Transformer, 49 BERT, 44 survey), while the production chunk index contains 273 (44, 80, 149).

Both schemes assigned IDs by ordinal, so identical-looking IDs could refer to different passage text. The first preview mismatch is ordinal 2 for all three documents. Of the 99 distinct judged chunk IDs, 93 have an ordinal whose old-splitter passage preview differs from the frozen index; one judged BERT ID is beyond the old splitter's 49-chunk range. The old run could therefore score the wrong passages or a passage that it never ingested.

**Do not use the archived `artifacts/eval/real/arch-*.json` metrics or `real-benchmark-report.json` as retrieval-quality evidence until a corrected replay replaces them.** Their `methodology: empirical` field does not fix this chunk-ID alignment defect.

## Frozen annotations

The existing set has 100 queries and 836 chunk judgments across the three papers. Fifty-one queries have judgments from multiple annotators; repeated grades agree in the current files. No relevance grade, query, source text, or PDF was changed for this audit.

The corpus is separate from Analysis_2 and can support a broader academic-retrieval evaluation after alignment is restored. Since it already has historical benchmark outputs, its use history is not sufficiently independent to call it a pristine held-out test set.

## Bounded repair

`real-corpus-benchmark.ts` now builds evaluation passages with the production `chunkMarkdown()` function. Before embeddings or retrieval, the alignment helper checks per-document chunk counts, ordinal IDs, headings, character lengths, and saved previews against `chunks-index.json`; it also checks that every frozen judgment resolves to a chunk and fails on unresolved multi-annotator grade disagreements. The old permissive behavior that silently skipped malformed judgment JSON was removed.

The new alignment unit test is intended to run with:

```sh
pnpm exec vitest run \
  lib/ai/eval/__tests__/corpus-chunk-alignment.test.ts \
  lib/ai/eval/__tests__/real-corpus-benchmark.test.ts
```

The `pnpm` executable, project `node_modules`, and local model cache were absent in this checkout, so the production-chunker test and corrected PGlite replay have **not** been run here. No replacement vectors or synthetic retrieval metrics were generated. The corrected benchmark should be run only after the alignment test passes and real local inference is available; any model fallback must invalidate the dense result.
