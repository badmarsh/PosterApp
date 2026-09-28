# Held-out golden retrieval evaluation — committed arXiv corpus

## Result

A small held-out retrieval evaluation now runs on documents **other than the
Analysis_2 development chapter**: the three arXiv papers already committed
under `data/eval/corpus` (Attention Is All You Need; BERT; a 2023 LLM
prompting study), scored against the chunk-level graded judgments already
committed under `data/eval/golden-v2` (100 queries, grades 0–3). **No labels
were invented or edited.** The harness reuses the ranking policy shared with
production (max-cosine dense merge, 1.15 section boost, routed candidate
limits, weighted RRF fusion) and runs it under two engines and two chunk
bindings:

| Binding | Condition | nDCG@10 | MRR | Recall@5 | Recall@10 | Hit@5 | Hit@10 |
|---|---|---:|---:|---:|---:|---:|---:|
| chunk-markdown (273 units) | dense-memory | 0.043 | 0.097 | 0.022 | 0.054 | 0.15 | 0.23 |
| chunk-markdown | hybrid-memory-proxy | 0.127 | 0.191 | 0.081 | 0.163 | 0.33 | 0.47 |
| chunk-markdown | dense-pglite | 0.043 | 0.097 | 0.022 | 0.054 | 0.15 | 0.23 |
| chunk-markdown | hybrid-pglite | 0.113 | 0.183 | 0.072 | 0.142 | 0.30 | 0.44 |
| split-for-eval (117 units) | dense-memory | 0.187 | 0.317 | 0.143 | 0.204 | 0.44 | 0.53 |
| split-for-eval | hybrid-memory-proxy | 0.315 | 0.452 | 0.224 | 0.372 | 0.59 | 0.80 |
| split-for-eval | dense-pglite | 0.187 | 0.317 | 0.143 | 0.204 | 0.44 | 0.53 |
| split-for-eval | hybrid-pglite | 0.337 | 0.446 | 0.232 | 0.413 | 0.64 | 0.82 |

These are **single-corpus measurements against the committed judgments**.
They are NOT review accuracy, NOT held-out validation of the Analysis_2
criterion rewrites, and NOT a production-quality guarantee. The judgments are
**not verified human ground truth** (see the label audit below), so these
numbers pin harness behavior for regression detection; they do not establish
real retrieval quality.

> **Note on embedding model:** Measured with
> `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (the repo's production model,
> 384-dim). The golden-v2 judgments were annotated against a different chunking
> pass; absolute metric values are lower than a same-model annotation pass would
> yield. The regression contract pins the numbers from *this* model against
> *these* judgments.

### What the measurement shows (within those limits)

1. **Real pgvector distances reproduce the in-memory cosine ranking exactly at
   this scale.** `dense-pglite` and `dense-memory` match on every macro metric
   under both bindings (no ANN index; exact `<=>` ordering). The offline dense
   replay is not diverging from database cosine on these documents.
2. **The substring lexical proxy tracks real `websearch_to_tsquery`/`ts_rank`
   closely but not exactly.** Hybrid nDCG@10 differs by 0.022 (split-for-eval)
   and 0.014 (chunk-markdown). This partially de-risks the Analysis_2 replay's
   \"NOT PostgreSQL tokenization/ts_rank\" caveat for ranking *conclusions on
   these documents* — not for production scale, tsvector configurations, or the
   Analysis_2 chapter itself.
3. **Chunk binding dominates the metrics.** The same queries, judgments and
   ranking policy score nDCG@10 0.127 versus 0.337 depending only on which of
   the repo's two committed chunkings the chunk IDs are read against. A
   held-out number without a pinned chunk binding is not interpretable.
4. The hybrid leg beats dense-only under both engines and bindings, consistent
   with the Analysis_2 replay — on different documents and labels.


## Experiment selection and limits

This is the recommended follow-up "build a small held-out retrieval
evaluation from suitable documents already available in the repo", chosen
over the alternatives:

- Full live-pipeline validation on Analysis_2 (routing + all legs + reranker +
  MMR + compression) is **not reachable here**: no application database, no
  reranker weights (blocked upstream), no LLM key for HyDE. PGlite (real
  PostgreSQL + pgvector in-process) is reachable and is used for the database
  legs, but it cannot stand in for the whole pipeline.
- The originality criterion experiment remains a separate bounded follow-up;
  this experiment changes no query wording and no production policy.

Documents: two quantitative systems papers and one empirical prompting study.
**No qualitative thesis exists in the repo**, so the requested
quantitative/qualitative mix could not be included; nothing is claimed about
qualitative work.

The evaluation replays topic queries **raw**: no rubric query expansion, no
template HyDE, no LLM HyDE. The calibration-specific criterion rewrites do
not apply to these titles by design — the scope gate keeps them on the
original rubric queries, and the test asserts that no scope broadening
happened.

## Chunk bindings

The corpus has two committed chunkings that both use the `{docId}_{ordinal}`
id namespace the judgments reference:

- `chunk-markdown` — `chunkMarkdown()` output, matching
  `data/eval/corpus/chunks-index.json` (273 units). This is the binding
  `docs/prompts/PHASE3_LIVE_EVAL_PROMPT.md` documents as intended.
- `split-for-eval` — `splitMarkdownForEval()` output, which is what
  `lib/ai/eval/real-corpus-benchmark.ts` actually ingests (117 units).

Because the judgments do not consistently bind to either (below), the report
treats binding as a **sensitivity dimension** and reports both.

## Label audit (provenance of `data/eval/golden-v2`)

Mechanical audit only (`artifacts/eval/heldout-golden/label-audit.json`, 836
judgment rows); nothing was edited.

- **189 rows** are `"Independent verification by annotator-N: …"` rationales
  that duplicate another row's rationale verbatim (including the grade). The
  "independent" verifications are templated, not independent.
- Rationale-to-chunk text consistency favors `split-for-eval`
  (466 vs 198 preference, 171 ties; mean rationale-token containment 0.448
  vs 0.282) — but neither binding is clean.
- Git history shows the same `chunkId` receiving different content across
  annotation passes: e.g. `transformer-2017_0004` was graded with the
  rationale "First transduction model relying entirely on self-attention"
  (abstract/intro text) at `111ac5f` and re-graded "Section 3.3: Self-attention
  encoder-decoder layer architecture" at `5af1a21` — the two passes looked at
  different chunk listings. Transformer figure rows (`_0015/_0019/_0023`)
  match only the `split-for-eval` numbering; several BERT rows
  (`_0003/_0013/_0030/_0048`) match only `chunk-markdown`.
- 0 grade conflicts on identical `(query, chunkId)` pairs; 1 judged chunk id
  is out of range for `split-for-eval`.

Conclusion: the set is usable as a **fixed regression target** with the
provenance stated, and unusable as ground truth for retrieval-quality claims
or for comparing systems. A genuine held-out validation needs a human
annotation pass against one pinned chunking (the repo's own
`EMPIRICAL_METHODOLOGY.md` §5.1 already demands this).

## Reproduction

No passage text, corpus file, judgment file, PDF, extraction, or review file
was changed. No model weights are committed; the local ONNX comes from the
documented npm package and lives in the ignored `.cache/`.

```sh
# Offline replay (verifies the saved vector fingerprint; no model, no network):
pnpm exec tsx scripts/score-heldout-golden.ts --cached-vectors

# Regenerate vectors + report (local MiniLM required; rejects embedding fallback):
pnpm exec tsx scripts/score-heldout-golden.ts

# Regression contract + scope-gate assertions:
pnpm exec vitest run lib/ai/eval/__tests__/heldout-golden-retrieval.test.ts

# Prior per-criterion no-regression checks must stay green:
pnpm exec vitest run \
  lib/ai/__tests__/criterion-query.test.ts \
  lib/ai/__tests__/candidate-ranking.test.ts \
  lib/ai/__tests__/retrieval-routing.test.ts \
  lib/ai/__tests__/fusion.test.ts \
  lib/__tests__/vector-rag.test.ts
```

Vector generation uses the local `Xenova/paraphrase-multilingual-MiniLM-L12-v2` ONNX
(the repo's production embedding model, 384-dim; real, local-only inference;
`getModelHealthSnapshot().embedding.fallbackCount === 0` enforced; wrong
dimensions or non-finite vectors rejected). Chunk and query texts are hashed
into the cache fingerprint, so any corpus edit invalidates the cache instead
of silently reusing stale vectors. The scored representation is float32 in
both generation and replay; the offline replay is bit-identical to the
generation report.

## Saved evidence

- `artifacts/eval/heldout-golden/report.json` — macro + per-query metrics for
  both bindings × four conditions, scope and provenance strings, corpus and
  judgment hashes.
- `artifacts/eval/heldout-golden/label-audit.json` — per-judgment
  rationale-token containment under both bindings plus the summary above.
- `artifacts/eval/heldout-golden/vectors.json` — compact float32 query/chunk
  vectors for offline regression (same convention as
  `artifacts/analysis-2/criterion-query-vectors.json`; not model weights).
- `lib/ai/eval/heldout-golden-retrieval.ts` — harness; `scripts/score-heldout-golden.ts` — CLI.
- `lib/ai/eval/__tests__/heldout-golden-retrieval.test.ts` — replays the
  report with embeddings mocked to throw, pins the label audit, asserts the
  calibration scope gate does not extend to these titles, and checks the
  memory/pglite agreement properties used above.

## Not validated here

- Review accuracy of any kind; the Analysis_2 criterion rewrites (their scope
  rule is by construction inactive on these titles).
- Real retrieval quality as ground truth — the labels' provenance forbids the
  claim (see above).
- PostgreSQL at production scale: ANN/HNSW behavior, planner choices,
  tsvector configurations beyond `'simple'`, latency.
- Other retrieval legs (metadata, citation, graph, community), reranking, MMR,
  context expansion/compression, LLM HyDE.

## Follow-ups (bounded)

1. Originality criterion retrieval as its own experiment (prior-work/
   contribution queries or section preferences; keep only if the miss is
   recovered without losing the measured Analysis_2 hits).
2. Re-annotate `data/eval/golden-v2` in a human pass against one pinned
   chunking, then rerun this harness unchanged to obtain interpretable
   held-out numbers.
3. Analysis_2 replay against real database legs on PGlite (real `ts_rank` +
   pgvector for the chapter's 473 vectors), keeping offline and real results
   distinctly labelled.
