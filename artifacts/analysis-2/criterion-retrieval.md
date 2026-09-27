# Criterion query experiment — Analysis_2

## Result

Kept three short, English evidence-oriented retrieval queries. Evaluation guidance is **not** changed. The shared builder is used by both the regular review pipeline and agentic criterion retrieval. Other criteria (including originality), Slovak/Czech queries, domain-prefix handling, FTS, and HyDE are unchanged.

| Retrieval condition | Baseline hit@5 | Kept query hit@5 | Previously missed criteria recovered | Protected hits retained |
|---|---:|---:|---|---|
| Dense only | 3/7 | **5/7** | Analytical execution; limitations | 3/3 |
| Dense + current FTS proxy, weighted RRF | 3/7 | **6/7** | Analytical execution; discussion; limitations | 3/3 |
| Historical pipeline query mix + current FTS proxy, weighted RRF | 3/7 | **6/7** | Analytical execution; discussion; limitations | 3/3 |

The protected hits are methodology, results, and citations. Their query strings **and top-five rankings** are unchanged in every condition. Originality remains a miss; its proposed rewrite was not kept.

### Kept queries

- **Analytical execution:** “Statistical uncertainties of fitted parameters from the likelihood function and the covariance matrix.”
- **Discussion:** “Interpretation of the results: agreement between data and simulation and comparison with previous measurements.”
- **Limitations:** “Remaining work: corrections not yet available and improvements to be implemented in the future.”

These replace rubric labels/cautions as retrieval input, not as instructions for assessing the evidence. They contain no chapter-specific numbers, section identifiers, or copied relevance-label phrases. The existing four misses and three hits are the only evaluation targets; labels were not changed.

## Experiment selection and limits

Two formulations were tested on this same chapter, so these are **development-set results, not held-out validation**:

1. Longer evidence-oriented queries for the four misses: dense 3/7, dense+FTS 6/7, pipeline mix 6/7. No dense gain.
2. Shorter evidence-oriented queries: dense 5/7, dense+FTS 6/7, pipeline mix 6/7. Kept only the three criteria that improved; reverting the unsuccessful originality rewrite preserved these totals.

The gains are measured with the existing 473 passage vectors and the original substring relevance labels. Dense ranking uses cosine similarity; the lexical leg uses `buildFtsQuery` and the historical substring-count approximation, not PostgreSQL tokenization or `ts_rank`. Fusion uses the existing `fuseCandidates` weighted RRF implementation. No acronym FTS experiment is used by this new evaluation mode.

The pipeline-mix row preserves the scoring harness's historical **text-only** `routeQuery(query)` call. It includes routed query expansion and template HyDE, but is **not** a live `retrieveEvidence` evaluation: live criterion-aware routing, source weights, metadata/citation generators, reranker, MMR, compression and LLM HyDE are not measured here. No database was contacted. Broader corpus/language and live-pipeline validation remain necessary; these results do not establish a universal retrieval improvement.

## Reproduction

No passage text, passage embeddings, PDF, extraction, or review files were changed. The reports record the SHA-256 of `embeddings.json`, exact baseline/candidate queries, and top-five chunk IDs/headings with per-criterion hits.

With the normal project dependencies available:

```sh
# Offline, no model or network needed: verifies the saved query-set fingerprint.
pnpm exec tsx scripts/compare-analysis2-retrieval.ts --criteria-only --cached-queries
pnpm exec tsx scripts/score-pipeline-variants.ts --cached-queries
pnpm exec vitest run lib/ai/__tests__/criterion-query.test.ts lib/__tests__/vector-rag.test.ts
```

`--criteria-only` bypasses the older raw/margin-index experiment entirely. Do not omit it when running the comparison for this task.

To regenerate **query vectors only**, use the local ONNX model documented in `scripts/embed-analysis2.ts`, then omit `--cached-queries` from the scorer. The scorer sets real/local-only MiniLM inference and rejects any `getModelHealthSnapshot().embedding.fallbackCount !== 0`, wrong dimensions or non-finite vectors. It never embeds passages. The query cache stores float32 neural vectors with a fingerprint of the model and complete query set; fresh and cached scoring both use float32 values.

This checkout lacked both the dependency tree and the model cache mentioned in the handoff. A temporary, ignored `.cache/retrieval-tools` dependency set and the documented npm-packaged ONNX were restored for execution; repository dependency manifests and lockfiles were not changed. One pre-model diagnostic invocation of the old scorer emitted hash-fallback results; those were discarded, not used as evidence. The scorer now fails instead of reporting a result when fallback occurs.

## Saved evidence

- `criterion-comparison.json`: dense and dense+FTS results.
- `criterion-pipeline.json`: historical routed query-mix results.
- `criterion-query-vectors.json`: compact neural **query** vectors for offline regression (not new passage embeddings).
- `lib/ai/__tests__/criterion-query.test.ts`: replays both reports, checks protected rankings and unchanged non-target/language behavior; embedding calls are mocked to throw.

Both harnesses enforce the acceptance gate: reproduce the exact baseline hit/miss pattern, increase hits among the four misses, retain all three protected hits, and introduce no per-criterion hit regression.
