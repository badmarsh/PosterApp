# Thesis-Review Pipeline Upgrade — Repository Audit & Implementation Plan

**Date:** 2026-09-18 · **Branch:** `arena/01a0b680-posterapp` (from `46b5f72` on `main`)
**Status:** Phase 1 (audit) and Phase 2 (plan) complete. No code was modified while this
document was written.

---

## 1. Phase 1 — Audit of the existing system

Everything below was read out of the repository, not assumed.

### 1.1 Stack

| Concern | Reality in this repo |
| --- | --- |
| Framework | Next.js **16.2.11** App Router, React 19, TypeScript 5.7.3 |
| Runtime | Node ≥ 20.11, custom `server.ts` + `proxy.ts` (Clerk middleware) |
| Package manager | pnpm 9.15.9 (`pnpm-lock.yaml`) |
| Database | PostgreSQL + `pgvector`, Prisma **5.0.0**, `prisma/schema.prisma` (453 lines) |
| Local ML | `@xenova/transformers` **2.17.2** (Transformers.js v2, ONNX/WASM) |
| LLM access | OpenAI-compatible chat-completions via `lib/ai/client.ts` (retries, breaker, fallback provider) |
| Tests | vitest 4 (`__tests__/**`, `lib/**/__tests__/**`), Playwright (`tests/`) |
| Parser | MinerU FastAPI sidecar (`lib/services/mineru-bridge.ts`), PDF fallback parser |

### 1.2 Ingestion flow

`POST /api/ingestion/parse` (`app/api/ingestion/parse/route.ts`, 855 lines)

1. Upload → MinerU (`return_middle_json=true`) → `md_content` + `images` + `middle_json`.
2. `middle_json.pdf_info[]` is walked to build `pageMap` (image → page) and equation page
   anchors; char-offset→page boundaries are derived from cumulative node text lengths.
3. Markdown + assets are written to `workspaces/<id>/sources/<fileId>.md` and `assets/`.
4. BibTeX extraction, equation extraction (`lib/services/equation-service.ts`), asset rows.
5. **Fire-and-forget** `ingestDocumentChunks()` → `DocumentChunk` rows + embeddings;
   `IngestFile.vectorStatus` tracks `pending → indexing → ready | error`.

`POST /api/workspaces/[id]/thesis-review/reindex` re-runs the same chunker over stored markdown.

### 1.3 Schema (relevant tables)

* `DocumentChunk(id, workspaceId, documentId, heading, content, tokens, embedding vector(384), kind, contextPrefix, createdAt)`
  * HNSW: `document_chunk_embedding_hnsw ... USING hnsw (embedding vector_cosine_ops)`
  * `kind ∈ {prose, table, equation, figure_caption}`
  * **No** page, section path, parent/prev/next, content hash, or version columns.
* `GraphNode(id, workspaceId, documentId, label, name, description)`, unique `(workspaceId, label, name)`
* `GraphEdge(id, workspaceId, sourceId, targetId, relation, evidence, documentId)`
  * Provenance is `documentId` + a free-text `evidence` quote. **No page, no chunkId, no confidence.**
* `GraphCommunity(id, workspaceId, label, memberNodeIds JSONB, summary, nodeCount)` — flat, no hierarchy.
* `ThesisReview` — 40+ columns; `findings` / `debateLog` / `analysisPlan` are serialized JSON strings.

### 1.4 Embedding & chunking

* `lib/ai/local-embeddings.ts` — `Xenova/paraphrase-multilingual-MiniLM-L12-v2`, **384-dim**,
  `max_length: 512`, mean pooling, L2-normalised. 1024-entry LRU keyed by SHA-256 prefix,
  serialized WASM queue, deterministic hash fallback (`embeddingHealth.fallbackCount`).
* `lib/ai/chunking-config.ts` — `CHUNK_SIZE_SHORT = 1200`, `CHUNK_SIZE_LONG = 1500` chars,
  `CHUNK_OVERLAP = 150`, threshold 200 000 chars.
  > The task statement quotes "1800 / 3000 / 200". The repository's actual values are
  > **1200 / 1500 / 150**. The *mismatch* the task describes is nevertheless real: a 1500-char
  > Slovak chunk is ≈ 420–520 tokens and the **contextual prefix** (`contextPrefix`) is
  > prepended to the embedded text, so embedding input routinely exceeds the 512-token window
  > and the tail of the chunk is silently truncated. That is the bug that token-aware chunking
  > has to fix.
* `lib/ai/document-chunker.ts` — heading-driven (`#{1,4}`) split, then
  `splitIntoStructuralSegments()` (table / equation / figure_caption / prose) then
  `splitIntoSubchunks()` for prose. `tokens = ceil(len/4)`.
* Anthropic-style `buildContextualPrefix()` (SK/CS/EN) is stored in `contextPrefix`,
  embedded + FTS-indexed, **never** merged into `content` (evidence quotes stay verbatim).

### 1.5 Retrieval (`lib/ai/vector-rag.ts`, 1012 lines)

`retrieveForCriterion()` → `searchHybrid()` → `applyMMR()` → `rerankChunks()` → `compressChunks()`.

* Query fan-out: 3 variants (`expandQuery`).
* HyDE: LLM hypotheses (optional, `AI_HYDE_LLM`) + deterministic SK/CS/EN templates.
* **Fusion:** one SQL statement per query variant containing a `vector_search` CTE
  (`ROW_NUMBER() OVER (ORDER BY embedding <=> q)`) and an `fts_search` CTE
  (`ROW_NUMBER() OVER (ORDER BY ts_rank(...) DESC)`), combined as
  `0.7/(60+rank_vec) + 0.3/(60+rank_fts)`.
  > Correction to the task statement: the current system does **not** add raw cosine to raw
  > `ts_rank`. It is already rank-based RRF. What it *is*: (a) a **single** fused SQL query
  > rather than independent candidate generators, (b) hand-set 0.7/0.3 weights with no
  > calibration or benchmark, (c) only **two** retrieval sources — no graph, citation or
  > metadata leg. Those are the real gaps.
* pgvector tuning: `SET LOCAL hnsw.ef_search = clamp(40, 1000, limit*8)` and a guarded
  `hnsw.iterative_scan='relaxed_order'` inside an explicit `$transaction` (PgBouncer-safe),
  plus a non-indexed exact-scan recall fallback (`RAG_EXACT_FALLBACK`).
* MMR over word-bigram/trigram/char-4-gram Jaccard; heuristic criterion boosts (normalised to
  [0,1]); `Xenova/bge-reranker-v2-m3` cross-encoder over the top-24 pool (blend 0.8/0.2).
* **No parent/child retrieval** — chunks are flat; there is no way to widen a hit to its
  section or neighbours.

### 1.6 GraphRAG

* `lib/ai/graph-extractor.ts` — one LLM call per 3-chunk batch; labels limited to
  `Hypothesis | Methodology | Dataset | Metric | Finding | Citation | Concept`;
  relations are free-form (`EVALUATED_ON`, `PROVES`, `USES`, `CITES`, `MEASURES`,
  `CONTRADICTS`, `IMPROVES`, …). Budget: `GRAPH_RAG_MAX_CHUNKS_PER_DOC` (90),
  `GRAPH_RAG_DAILY_CAP` (400).
* `lib/ai/graph-rag.ts` — lexical entity linking (+ embedding cosine fallback ≥ 0.45),
  BFS `maxHops=2`, `maxNodes=40`, budget-capped serialization with `[doc: …]` tags.
  **Every edge is treated as equally reliable** — no confidence, no page.
* `lib/ai/graph-communities.ts` — hand-written Louvain (greedy ΔQ, ≤10 passes), LLM label +
  summary per community, stored flat in `GraphCommunity`.
  `getCommunityContext()` returns the top communities by `nodeCount` — **no query awareness**.
* No DRIFT/iterative retrieval. No local-vs-global routing.

### 1.7 Novelty (`lib/ai/novelty-detector.ts`, 378 lines)

LLM extracts ≤20 claims → `searchAcademicPaper()` (Semantic Scholar / OpenAlex / Crossref via
`lib/services/academic-connector.ts`) → embed abstracts → **`cosine > 0.82` ⇒ "missing prior
art"**. This is exactly the pattern the task asks to replace: a single similarity threshold
standing in for an analysis, with no temporal logic and no structured claim↔paper comparison.

### 1.8 Review generation & critique

* `lib/ai/review-pipeline.ts` (746 lines) — context load, routed context, citation audit,
  per-criterion vector retrieval with `[c-…]` anchors, GraphRAG augmentation, agentic or
  monolithic generation, persistence.
* `lib/ai/agentic-review.ts` — one grounded LLM call per criterion + synthesis.
* `lib/ai/review-engine.ts::generateSelfCritique` — adversarial pass with tool access
  (`searchHybrid`, 4 searches). It emits `overstatedIds`, `missedWeaknesses`,
  `severityAdjustments`. **There is no adjudicator**: critique output mutates findings directly.
* `lib/ai/evidence-validator.ts` — quote verification (exact/normalized/approximate),
  epistemic statuses, `stableEvidenceAnchor(chunkId) = "c-" + sha256(id)[:16]`,
  `validateAndCalibrateFindings()`.
* **No claim objects, no numerical verifier, no equation-consistency checks, no retrieval trace.**

### 1.9 Evaluation that already exists

`lib/ai/retrieval-eval.ts` — Recall@K (section coverage), Success@K (hit rate), MRR over a
40-query SK/CS/EN golden set; `RETRIEVAL_TUNABLES` snapshot. Gated real run:
`lib/__tests__/retrieval-golden.test.ts` under `TEST_REAL_EMBEDDINGS=1`.
**Missing:** nDCG, graded relevance, evidence precision/recall, faithfulness, novelty metrics,
ablations, model comparison, dashboard.

### 1.10 Configuration surface today

`GRAPH_RAG_ENABLED`, `GRAPH_RAG_MAX_CHUNKS_PER_DOC`, `GRAPH_RAG_DAILY_CAP`,
`AI_RERANKER_ENABLED`, `AI_RERANKER_MODEL`, `AI_HYDE_LLM`, `AI_CONTEXT_BUDGET_CHARS`,
`RAG_EXACT_FALLBACK`, `AI_AGENTIC_REVIEW`, plus the AI model roles in `lib/ai/models.ts`.
There is **no** embedding-model, chunker, claim, novelty, critic or adjudication flag.

### 1.11 Baseline verification (run in this sandbox)

```
pnpm install --frozen-lockfile      → OK (21.6 s)
npx vitest run                      → 1501 passed, 2 failed, 1 skipped (160 files)
```

The 2 failures are pre-existing and environmental: `__tests__/services/pdf-fallback-parser.test.ts`
reads `tests/fixtures/test.pdf`, which is not in the repository because `.gitignore` line 36
is `*.pdf`.

```
npx tsc --noEmit                    → 145 errors
```

All 145 come from the **ungenerated Prisma client**: `prisma generate` cannot run here because
the engine binaries live on `binaries.prisma.sh`, which is unreachable from this sandbox
(only `registry.npmjs.org` is). The errors are `TS7006` (implicit `any` in Prisma callbacks),
`TS2694`/`TS2339` (`Prisma.Sql`, `Prisma.sql`, `Prisma.join`, `Prisma.JsonValue`, …) — i.e.
missing generated types, not source defects. `huggingface.co` and `api.openalex.org` are
likewise unreachable, so no model download and no live scholarly lookup is possible here.
Verification therefore relies on: vitest (mocked Prisma, the repo's own convention), an
error-set diff against this 145-error baseline, ESLint, and an offline-runnable evaluation
harness. This is stated again, with numbers, in the final report.

---

## 2. Phase 2 — Implementation plan

### 2.1 Principles

1. **Additive.** Every new column is nullable or defaulted; every new table is independent.
   No existing column is renamed, retyped or dropped.
2. **Flagged.** Every advanced stage reads a flag and degrades to the previous behaviour.
3. **Composable.** Retrieval, ranking, evidence assembly, reasoning, verification and
   generation live in separate modules with narrow interfaces.
4. **Deterministic where possible.** Fusion, tokenisation, numerical checks, temporal
   classification, severity scoring and IDs are pure functions — unit-testable without a DB.
5. **No parallel subsystems.** The new fusion layer *replaces* the inline SQL fusion behind a
   flag; the old path stays as `RETRIEVAL_FUSION=legacy`.

### 2.2 Phase map

| Phase | Deliverable | Modules |
| --- | --- | --- |
| 3 | Model registry, token-aware chunker, provenance | `lib/ai/model-registry.ts`, `lib/ai/token-budget.ts`, `lib/ai/chunker-v2.ts`, `lib/ai/document-chunker.ts`, `prisma/schema.prisma` |
| 4 | Candidate generators + fusion | `lib/ai/fusion.ts`, `lib/ai/retrievers/*.ts` |
| 5 | Parent/neighbour expansion | `lib/ai/parent-context.ts` |
| 6 | GraphRAG 2.0, communities, DRIFT | `lib/ai/graph-extractor.ts`, `lib/ai/graph-rag.ts`, `lib/ai/graph-communities.ts`, `lib/ai/drift-retrieval.ts` |
| 7 | Claims + verification | `lib/ai/claims.ts`, `lib/ai/claim-verification.ts`, `lib/ai/evidence-store.ts` |
| 8 | Prior-art engine | `lib/ai/prior-art.ts` |
| 9 | Numerical / equation verification | `lib/ai/numerical-verifier.ts`, `lib/ai/equation-consistency.ts` |
| 10 | Critic + adjudicator | `lib/ai/adjudication.ts`, `lib/ai/severity.ts` |
| 11 | Evaluation, ablations, model benchmark, dashboard | `lib/ai/eval/*.ts`, `app/api/.../eval/route.ts`, `app/dev/eval/page.tsx` |
| 12 | Tests | `lib/ai/__tests__/*.test.ts` |
| 13 | Migrations & reindex | `prisma/migrations/20260918…`, `scripts/reindex-cli.mjs` |
| 14 | Documentation & benchmark report | `docs/architecture/*.md` |

### 2.3 Explicit non-goals

* No replacement of PostgreSQL/pgvector (nothing in the repo argues for it).
* No replacement of Transformers.js v2 at the default path. A modern backend is *pluggable*
  (`@huggingface/transformers` v3/v4 or an OpenAI-compatible `/v1/embeddings` endpoint) but is
  not added as a hard dependency, because it cannot be installed or exercised in this sandbox.
* No partitioning of `DocumentChunk` — measurements must justify it first.

---

## 3. Implementation status

Updated as each phase lands. Every number here came from a command run in this sandbox; anything
that could not be run here is marked **unverified** rather than assumed.

### 3.1 Verification harness (fixed for the whole project)

| Gate | Command | Baseline (unmodified `main`) | Current |
| --- | --- | --- | --- |
| Tests | `npx vitest run` | 2 failed / 1501 passed / 1 skipped (160 files) | **2 failed / 1622 passed / 1 skipped (164 files)** |
| Types | `npx tsc --noEmit` | 145 errors | **191 errors** (62 new, see below) |
| Lint | `npx eslint <changed files>` | — | **0 errors**, 18 `no-explicit-any` warnings (same style as pre-existing `vector-rag.ts`) |

The 2 failing tests are `__tests__/services/pdf-fallback-parser.test.ts`, which reads
`tests/fixtures/test.pdf` — a file excluded by `.gitignore:36` (`*.pdf`) and therefore absent from
the checkout. This failure predates any change in this branch and is not a regression.

**Why `tsc` cannot reach zero here.** `prisma generate` requires `binaries.prisma.sh`, which is
unreachable from this sandbox, and `node_modules/.pnpm/@prisma+engines@5.0.0` ships no binaries.
`.prisma/client/index.d.ts` is therefore never generated, so `Prisma.Sql`, `Prisma.sql/join/raw/
empty` and every model accessor are missing from the type surface. All 62 new errors are in the
families that this causes and nothing else:

* `TS2339: Property '(sql|join|raw|empty)' does not exist on type 'typeof Prisma'` (43)
* `TS2694: Namespace 'Prisma' has no exported member 'Sql'` (6)
* `TS7006` implicit-`any` on `$queryRaw` / `$transaction` callbacks (13)

(43 + 6 + 13 = 62, the full set of new errors.)

Verified with: `grep -vxF -f /tmp/tsc-baseline.txt /tmp/tsc-now.txt | grep -vE '<those three
families>'` → empty. **Consequence: the new Prisma schema has never been machine-validated, and
`next build` is not a usable gate in this environment.**

### 3.2 Phase 3 — model registry, token-aware chunker, provenance ✅

* `lib/ai/model-registry.ts` — model descriptors, pluggable backends, batching, LRU cache,
  health. `local-embeddings.ts` / `local-reranker.ts` are now thin façades over it.
* `lib/ai/token-budget.ts`, `lib/ai/chunk-context.ts`, `lib/ai/chunker-v2.ts` — hierarchical
  parent/child chunking with token budgets instead of the old 1200/1500/150-character windows.
  The old defect was real: a 1500-char Slovak chunk (≈420–520 tokens) plus its `contextPrefix`
  exceeds the 512-token MiniLM window, so the tail was silently truncated at embed time.
* `prisma/schema.prisma` + `prisma/migrations/20260918120000_evidence_first_retrieval` — additive,
  every DDL guarded `IF [NOT] EXISTS`. **Unverified:** the migration cannot be applied or
  generated here (no Prisma engine, no `DATABASE_URL`).
* `prisma/scripts/tune-hnsw.sql` — opt-in HNSW maintenance, referenced from the migration's
  closing comment. Read-only inspection by default; the `CREATE INDEX CONCURRENTLY` rebuild is
  commented out and must be uncommented deliberately. `.gitignore` previously ignored `*.sql`
  outside `prisma/migrations/**`, so a narrow `!prisma/scripts/**/*.sql` negation was added to
  track it. **Unverified:** no PostgreSQL is available in this sandbox, so this script has never
  been executed.
* Tests: `lib/ai/__tests__/chunker-v2.test.ts` (29).

**Correction to §1.5 of this document.** The audit originally repeated the claim that fusion was
`0.7 × cosine + 0.3 × ts_rank`. It is not: `vector-rag.ts` already fuses *reciprocal ranks*
(`0.7/(60+rank_dense) + 0.3/(60+rank_fts)`) inside a single SQL statement. The real gaps were the
absence of a candidate-generator layer, of configurable per-source weights, of graph/citation/
metadata legs, and of per-source observability — which is what Phase 4 built.

### 3.3 Phase 4 — candidate generators, fusion, routing ✅

| Module | Role |
| --- | --- |
| `lib/ai/fusion.ts` | `rrf` / `weighted-rrf` / `normalized-sum`, per-source weights, per-source contribution shares, deterministic tie-breaks, `diversifyByGroup` |
| `lib/ai/retrievers/types.ts` | `CandidateGenerator`, `RetrievalCandidate`, `RetrievalContext`, shared column projection |
| `lib/ai/retrievers/generators.ts` | `dense` (pgvector `<=>`, `hnsw.ef_search`, guarded `iterative_scan`), `lexical` (`websearch_to_tsquery` + `ts_rank`), `metadata`, `citation`, `graph` (provenance-bearing edges, confidence-aware), `community` |
| `lib/ai/retrievers/index.ts` | parallel legs, per-leg deadline, `degraded` reporting, `excluded` reporting for ablations |
| `lib/ai/retrieval-sql.ts` | shared isolation filters, `efSearchFor`, `buildFtsQuery`, HNSW session tuning — extracted so generators and `vector-rag.ts` cannot drift apart |
| `lib/ai/retrieval-ranking.ts` | `applyMMR` (moved verbatim from `vector-rag.ts`), `mmrSelect`, `detectNoveltyDrift`, `rerankCandidates` |
| `lib/ai/criterion-profiles.ts` | data table of criterion → expected evidence / preferred sections / legs / sufficiency |
| `lib/ai/query-router.ts` | multilingual signal table → category → retrieval policy, merged with the criterion profile |
| `lib/ai/hybrid-retrieval.ts` | route → transform → generate → fuse → rank → expand → assemble, with a full `RetrievalTrace` |

`retrieveForCriterion` now delegates to the new pipeline by default (`RETRIEVAL_PIPELINE=legacy`
restores the old path) via a **dynamic** import — `hybrid-retrieval.ts` statically imports the
query-transform helpers from `vector-rag.ts`, so a static import in the other direction would be a
module cycle. Any failure degrades to the legacy search and logs the reason.

Tests: `lib/ai/__tests__/fusion.test.ts` (22), `lib/ai/__tests__/retrieval-routing.test.ts` (49),
`lib/__tests__/multi-source-retrieval.test.ts` (21).

**Unverified:** the generators' SQL has never been executed against a real PostgreSQL. The
multi-source tests simulate `$queryRaw` by inspecting statement text, which verifies routing,
fusion, attribution, expansion and degradation — not query planning, not HNSW recall, not that
`iterative_scan` exists on the target pgvector version.

### 3.4 Phase 5 — parent / neighbour / related-element expansion ✅

`lib/ai/parent-context.ts`: `expandToParentContext`, `expandToNeighborContext` (breadth-first along
the persisted `previousChunkId`/`nextChunkId` links, so a window of 2 really reaches two paragraphs
out), `expandToRelatedElements` (tables/equations/figures in the same section), `expandContext`
under one shared budget, `buildEvidenceContext` (labelled DIRECT / COUNTER / NUMERICAL / PRIOR-ART
blocks), `selectCounterEvidence`. Retrieved chunks are never dropped to make room for context.

Covered by `retrieval-routing.test.ts` (assembly, counter-evidence, retrieval-unit selection) and
`multi-source-retrieval.test.ts` (parent role, budget behaviour, ablation off-switch).

### 3.5 Defects found and fixed while wiring Phases 4–5

These were caught by the new tests, not by review, and are recorded so they are not reintroduced:

1. **`contextPrefix` was dropped** on the way from the chunk row to the evidence chunk, and
   `retrieveForCriterion` hardcoded `contextPrefix: null`. Since `contextPrefix` is what the FTS
   index is built over, losing it silently weakens the keyword leg. Now carried end to end and
   asserted in both pipelines.
2. **`parent-context.ts` evaluated `Prisma.sql` at module load**, so the module could not be
   imported at all without a generated Prisma client. The projection is now built per call.
3. **Ablated legs vanished from the trace.** `disableSources` filtered generators out before they
   ran, so a trace could not distinguish "switched off for this experiment" from "never
   configured". They are now reported with `enabled: false, excludedByAblation: true`.
4. **Every signal pattern ended in `\b`**, which defeats stem matching: `metodik` never matched
   *metodika*, `limit` never matched *limity*. The trailing boundary is gone (the leading one
   stays, so we still never match inside a word). Slovak *presnosť* was also missing from the
   numerical signal entirely.
5. **`reusedHashes` was block-scoped** inside the hierarchical branch of
   `ingestDocumentChunks` but read by the shared persistence block below it. Hoisted.
6. **`ContextLang` was used but never imported** in `document-chunker.ts`.
7. `RerankModel.rerank()` returns `Promise<number[] | null>`, not a ranked-index array; the first
   draft of `rerankCandidates` called a `.rank()` method that does not exist and awaited a
   synchronous `getReranker()`.

### 3.6 Terminology rule (binding for every benchmark table in this project)

"Cross-encoder" means a real reranker model. The scorer in `vector-rag.ts::rerankChunks` is a
**lexical heuristic** and must be labelled `lexical-heuristic`, never `cross-encoder`.
`RetrievalTrace.ranking.scorer` is one of `cross-encoder | lexical-heuristic | fusion-score` and
`usedNeuralReranker` is true only for the first. `retrieval-routing.test.ts` asserts that a run
without a loaded reranker cannot report `cross-encoder`.

---

## 4. Round 2 — Gap analysis before the evaluation upgrade (2026-09-19)

Branch `arena/01a0b716-posterapp`, from `dd3be81` on `main`. Nothing in this section was assumed;
every row is a file that was opened, or a command that was run, in this sandbox.

### 4.1 Baseline gates, re-measured (they differ from §3.1)

| Gate | §3.1 claim | Measured on unmodified `main` here |
| --- | --- | --- |
| `npx vitest run` | 2 failed / 1622 passed / 1 skipped | **2 failed / 1622 passed / 1 skipped (164 files)** ✔ |
| `npx tsc --noEmit` | "191 errors, cannot reach zero" | **0 errors** — see below |
| `npx eslint .` | "0 errors" | **2 errors, 309 warnings** |

**The `tsc` conclusion in §3.1 was wrong.** The repository already ships
`scripts/generate-prisma-types.js`, which drives Prisma's own WASM schema builder
(`prisma/build/prisma_schema_build_bg.wasm`) and `@prisma/client/generator-build` to emit the real
`.prisma/client/index.d.ts` **without downloading a query-engine binary**. Running it
(`node scripts/generate-prisma-types.js` → `1895408 bytes`) takes `npx tsc --noEmit` from
**190 errors to 0**. Two consequences:

1. `tsc` is a usable gate in this sandbox, and the previous rounds' "62 new errors are all
   Prisma-stub artefacts" reasoning is unnecessary — real type errors would now be visible.
2. The WASM builder *parses the schema*, so `prisma/schema.prisma` (including the
   `20260918120000_evidence_first_retrieval` additions) is now machine-validated for syntax and
   relation shape. It is still **not** validated as executable DDL — that needs a live server,
   which §4.2 addresses.

The 2 remaining ESLint errors are pre-existing and in React components, not in the retrieval
stack: `components/thesis-review/evidence-quote-viewer.tsx:363` ("Avoid constructing JSX within
try/catch") and `components/thesis-review/expert-review-workspace.tsx:352` (React-compiler
"Existing memoization could not be preserved").

### 4.2 A live PostgreSQL + pgvector is reachable here

`binaries.prisma.sh` and `huggingface.co` are firewalled, but `registry.npmjs.org` and
`codeload.github.com` are not. That makes two things possible that §3.1 declared impossible:

* **Live pgvector.** `@electric-sql/pglite` + `@electric-sql/pglite-pgvector` give a real
  PostgreSQL engine with the real pgvector C extension. Verified in this sandbox:
  `server_version = 18.3`, `SELECT extversion FROM pg_extension WHERE extname='vector'` →
  **0.8.1**, `CREATE INDEX … USING hnsw (embedding vector_cosine_ops)` succeeds, `ORDER BY
  embedding <=> $1` returns nearest neighbours, `SET hnsw.ef_search` succeeds and
  `SET hnsw.iterative_scan='relaxed_order'` **succeeds** (it exists from pgvector 0.8). This is
  the environment `scripts/verify-pgvector.ts` runs against.
* **Not** possible here: real model weights (HuggingFace is blocked), so neural
  embedding/reranker numbers cannot be measured in this sandbox, and PgBouncer transaction-pooler
  behaviour, which needs a networked pooler. Both stay flagged as *unverified-live* rather than
  being reported as measured.

### 4.3 What already exists and must be reused (not rebuilt)

| Capability | Where | Status |
| --- | --- | --- |
| Pluggable model registry, descriptors for MiniLM / BGE-M3 / E5 / Qwen3, batching, LRU, health | `lib/ai/model-registry.ts` | **present** — descriptors are declarations, never benchmarked |
| Token-aware hierarchical parent/child chunker | `lib/ai/chunker-v2.ts` (`CHUNKER_VERSION 2.0.0`) | **present** |
| Contextual prefix, separated from verbatim `content` | `lib/ai/chunk-context.ts`, `document-chunker.ts` | **present** |
| Six candidate generators (dense/lexical/metadata/citation/graph/community) | `lib/ai/retrievers/generators.ts` | **present** |
| RRF / weighted-RRF / normalized-sum fusion with per-source shares | `lib/ai/fusion.ts` | **present** |
| Lexical MMR (`applyMMR`), `mmrSelect`, novelty drift, honest reranker labelling | `lib/ai/retrieval-ranking.ts` | **present** |
| Parent / neighbour / related-element expansion, labelled evidence blocks | `lib/ai/parent-context.ts` | **present** |
| Route → transform → generate → fuse → rank → expand → assemble + `RetrievalTrace` | `lib/ai/hybrid-retrieval.ts` | **present** |
| Query router (13 categories) + criterion profiles | `lib/ai/query-router.ts`, `criterion-profiles.ts` | **present** |
| Provenance columns (`parserVersion`, `chunkerVersion`, `embeddingModelVersion`, `contentHash`, `pageStart/End`, `sectionPath`, `sourceElementIds`) | `prisma/schema.prisma`, migration `20260918120000` | **present** |
| `Evidence`, `ThesisClaim`, `ScholarlyPaper`, `CitationOccurrence`, `RetrievalTrace`, `EvalRun` tables | same migration | **schema present, no writer/reader code** |
| Community hierarchy columns (`level`, `parentCommunityId`, `evidenceIds`, `summaryEmbedding`) | same migration | **schema present, never populated** |
| Graph edge provenance (`chunkId`, `page`, `confidence`, `extractorVersion`) | same migration | **columns present; `graph-extractor.ts` never writes them** |
| Adversarial critic with tool access and SUPPORTED_FACT protection | `review-engine.ts::generateSelfCritique` | **present** |
| Recall@K / Success@K / MRR over a 40-query golden set | `lib/ai/retrieval-eval.ts` | **present** |
| Context shares so vector/graph evidence is not starved | `thesis-context.ts::THESIS_CONTEXT_SHARES` | **present** (3 shares, no counter-evidence / prior-art share) |

### 4.4 Real gaps, in priority order

**P0 — correctness**

1. **No index-representation guard.** `EMBEDDING_MODEL=Xenova/bge-m3` (1024-dim) against the
   `vector(384)` column fails at INSERT time with a raw Postgres error; nothing detects the
   mismatch *before* ingestion, and `schemaVersion` / token-estimator version are never written
   by the chunker even though the columns and `TOKEN_ESTIMATOR_VERSION` exist.
2. **`splitProseToTokenBudget` can silently delete source text.** Step 3 calls
   `truncateToTokenBudget`, which appends `[…]` and drops the tail of any single sentence over
   `childMaxTokens`. There is no coverage assertion anywhere that the emitted chunks reconstruct
   the source.
3. **No live pgvector validation had ever been run** (see §4.2 for the fix).
4. **Evidence-budget starvation is only partly solved.** `THESIS_CONTEXT_SHARES` reserves routed /
   vector / graph, but there is no counter-evidence or prior-art share, and
   `buildFullGenerationContext` still ends in `combined.slice(0, maxChars)`.

**P1 — evaluation and the scientific core**

5. **Nothing is benchmarked.** No `lib/ai/eval/` module, no model benchmark, no ablation matrix,
   no nDCG, no evidence precision/recall, no cost accounting, no eval CLI. The default embedding
   model is MiniLM by declaration, not by measurement.
6. **Novelty is still `cosine ≥ 0.82 ⇒ missing prior art`** (`novelty-detector.ts:36`), claims are
   extracted from `thesisText.slice(0, 40000)` only, and there is no temporal logic at all — a
   2024 paper can be flagged as prior art against a 2019 thesis.
7. **Community retrieval is lexical overlap + a size prior** (`generators.ts::communityRetriever`);
   `buildGraphCommunities` never writes `summaryEmbedding`, `level`, `parentCommunityId` or
   `evidenceIds`, and `getCommunityContext` orders by `nodeCount`.
8. **Counter-evidence is selected, not retrieved.** `selectCounterEvidence` filters chunks that
   are *already* in the retrieved set; nothing issues a contrary-evidence query.
9. **Claims are not first-class objects at runtime.** `ThesisClaim` exists in the schema with no
   writer.
10. **No adjudicator.** `generateSelfCritique` mutates findings directly.

**P2 — quality**

11. MMR is lexical-only; there is no embedding-diversity mode and no `mmrMode` in the trace.
12. Numerical and equation consistency are left entirely to the LLM.
13. `graph-extractor.ts` emits 7 labels and free-form relations and writes no confidence.

### 4.5 Rules this round is held to

* Extend `CandidateGenerator`, `FusionMethod`, `RetrievalRoute`, `ModelInfo`, `RerankModel` and
  `RetrievalTrace`. Do not add a second retrieval pipeline, a second chunker or a second fusion
  function.
* Every advanced stage reads a flag and degrades to the previous behaviour.
* A benchmark number in this repository is either a measurement produced by a command that can be
  re-run here, or it is labelled *unverified*.
