# Phase 3: Live Retrieval Evaluation Against Real Corpus

## Context

PosterApp is a PhD-thesis review platform built on a hybrid retrieval stack:
dense pgvector ANN (MiniLM-L6-v2 384d), BM25 full-text search, graph-frontier
expansion, HyDE query augmentation, and a cross-encoder reranker. The review
engine runs deterministic numerical, equation, and claim verifiers wired into
every review cycle.

Two previous phases are complete and merged to `main`:

- **Phase 1** — verifiers (numerical consistency, equation sanity, claim
  verifier, scholarly comparator) are wired into the production review flow and
  adjudicator. All tests pass.
- **Phase 2** — the real benchmark framework (`pnpm eval:real`) and its corpus
  infrastructure exist. Three arXiv documents are ingested as Markdown in
  `data/eval/corpus/` and five annotated golden-judgment query files (grade 0–3
  at chunk level) live in `data/eval/golden-v2/`. Running `pnpm eval:real`
  currently reports `goldenSetSize: 5` and `limitations: []` — the data is
  found — but all six retrieval architectures show `status: "not-executed"`
  because they require a live PostgreSQL + pgvector instance that the runner
  does not yet spin up.

## Objective

Make `pnpm eval:real` execute actual retrieval against real vectors and
produce empirical Recall@K, nDCG@10, and MRR numbers — no simulated or
hash-based results.

## What Needs to Be Built

### 1. In-process PGlite executor for the eval runner

The project already has a working PGlite test harness (see
`lib/ai/eval/__tests__/pgvector-live.test.ts` — 12/12 tests pass against
real pgvector 0.8.1 compiled to WASM). Extend `real-corpus-benchmark.ts` to:

- Boot a PGlite instance (or reuse the existing test harness pattern).
- Apply the Prisma migrations or the minimal DDL required to create the
  `DocumentChunk` table with a `vector(384)` column and an HNSW index.
- Run `chunkMarkdown()` on every `.md` file in `data/eval/corpus/` to produce
  chunks, generate MiniLM-L6-v2 embeddings via `generateLocalEmbedding()`,
  and insert them with stable chunk IDs matching the format used in
  `data/eval/golden-v2/` (i.e. `{docId}_{ordinal:04d}`).
- For the `bm25` architecture: run PostgreSQL `tsvector` / `ts_rank` queries.
- For the `dense-minilm` architecture: run the pgvector ANN query that already
  exists in `lib/ai/retrievers/generators.ts` (`denseRetriever`).
- For the `naive-rag` architecture: 500-token fixed chunking, top-5 cosine
  similarity, no expansion.
- For the `posterapp-pipeline` architecture: call the full
  `lib/ai/retrievers/index.ts` stack (dense + BM25 + graph-frontier + HyDE +
  reranker) end-to-end.
- Skip BGE-M3 and ColBERT (weights unavailable) — keep them `not-executed`
  with their current reason strings.

### 2. Chunk ID alignment

The golden judgment files reference IDs like `transformer-2017_0002`. The
corpus-chunk-inspect test already generates these IDs as
`docId + "_" + String(i).padStart(4, "0")`. Ensure the ingestion step assigns
exactly these IDs as the chunk's primary key when inserting into PGlite, so
retrieved chunk IDs can be looked up in the golden judgments.

### 3. Metrics computation

After retrieval for each query, call the already-implemented helpers:
- `computeRecallAtK(retrievedIds, judgments, k)` — at k=5, k=10, k=20.
- `computeNdcgAtK(retrievedIds, judgmentsMap, 10)`.
- `computeMrr(retrievedIds, relevantSet)`.

Aggregate per-query results into per-architecture mean scores and populate the
`ArchitectureResult` objects. Set `status: "executed"` and
`methodology: "empirical"` for architectures that actually ran.

### 4. Populate the comparison block

Once the four architectures have real numbers, compute:
```
comparison.posterappVsBaseline.bm25.recallDelta =
  posterappPipeline.metrics.recallAt10 - bm25.metrics.recallAt10
```
and the same for `ndcgDelta` and `naiveRag`.

### 5. Honest reporting constraints (non-negotiable)

- No architecture may be marked `status: "executed"` unless it completed at
  least one real retrieval query against real vectors.
- No metric may be hardcoded or derived from a hash function.
- The `methodology` field must be `"empirical"` only for architectures that
  used a live query engine.
- If PGlite boots but the ONNX model fails to load, mark `dense-minilm` and
  dependents `not-executed` with a clear `reason` string.
- The `limitations` array must remain accurate: if anything could not run,
  add an entry explaining why.

## Files Most Relevant to Read First

```
lib/ai/eval/real-corpus-benchmark.ts          — the runner to extend
lib/ai/eval/__tests__/pgvector-live.test.ts   — existing PGlite harness (reference pattern)
lib/ai/retrievers/generators.ts               — denseRetriever, bm25Retriever implementations
lib/ai/retrievers/index.ts                    — full pipeline entry point
lib/ai/document-chunker.ts                    — chunkMarkdown() pure function
lib/ai/local-embeddings.ts                    — generateLocalEmbedding() / generateLocalEmbeddings()
data/eval/corpus/                             — three Markdown documents (transformer, BERT, LLM survey)
data/eval/golden-v2/                          — five annotated query judgment files (q-001 … q-005)
data/eval/corpus/chunks-index.json            — pre-computed chunk listings with stable IDs
```

## Acceptance Criteria

`pnpm eval:real` exits 0 and the printed JSON satisfies all of:

1. At least one architecture has `status: "executed"` and `methodology: "empirical"`.
2. That architecture's `queriesEvaluated` equals 5 (one per golden query).
3. `recallAt10`, `ndcgAt10`, and `mrr` are non-zero numbers that vary by query.
4. `limitations` contains an entry for every architecture that could not run,
   and is empty if all four targetable architectures ran successfully.
5. Artifact files are written to `artifacts/eval/real/` with safe timestamps
   (no colons in filenames).
6. `pnpm vitest run lib/ai/eval/__tests__/real-corpus-benchmark.test.ts` still
   passes (the existing 4 tests must not regress).
7. Typecheck (`pnpm typecheck`) passes with no errors.

