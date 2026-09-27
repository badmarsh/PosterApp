# Criterion query experiment — Analysis_2

## Result

Kept four short, English evidence-oriented retrieval queries, **only for explicitly identified jet-calibration titles**. Evaluation guidance is **not** changed. The shared builder is used by both the regular review pipeline and agentic criterion retrieval. The title must mention jet energy scale/resolution/calibration, or both JES and JER. Qualitative/history/education title signals veto the rewrite; missing metadata, a filename such as `Analysis_2`, a generic physics department, and unrelated titles retain the original rubric query. This is a conservative heuristic, not a validated discipline classifier. Other criteria (including originality), Slovak/Czech queries, domain-prefix handling, FTS, and HyDE are unchanged.

| Retrieval condition | Baseline hit@5 | Kept query hit@5 | Previously missed criteria recovered | Protected hits retained |
|---|---:|---:|---|---|
| Dense only | 3/7 | **5/7** | Analytical execution; limitations | 3/3 |
| Dense + current FTS proxy, weighted RRF | 3/7 | **6/7** | Analytical execution; discussion; limitations | 3/3 |
| Historical pipeline query mix + current FTS proxy, weighted RRF | 3/7 | **6/7** | Analytical execution; discussion; limitations | 3/3 |
| Criterion-aware dense/lexical policy replay | 3/7 | **6/7** | Methodology; discussion; limitations | 3/3 |

The protected hits are methodology, results, and citations. All three hit after the change. Results and citations retain their query strings **and top-five rankings**; methodology now has a fourth rewrite to recover its hit in the criterion-aware replay. Originality remains a miss; its proposed rewrite was not kept.

### Kept queries

- **Methodology:** “Measurement method, likelihood model and fitting procedure, with assumptions and parameter definitions.”

- **Analytical execution:** “Statistical uncertainties of fitted parameters from the likelihood function and the covariance matrix.”
- **Discussion:** “Interpretation of the results: agreement between data and simulation and comparison with previous measurements.”
- **Limitations:** “Remaining work: corrections not yet available and improvements to be implemented in the future.”

These replace rubric labels/cautions as retrieval input, not as instructions for assessing the evidence. They contain no chapter-specific numbers, section identifiers, or exact chapter quotations. Ordinary methodological vocabulary such as “likelihood” overlaps the broad existing substring relevance labels; a hit alone does not establish evidence quality. The existing four misses and three hits are the only evaluation targets; labels were not changed.

## Experiment selection and limits

The initial two formulations and one follow-up methodology query were tested on this same chapter, so these are **development-set results, not held-out validation**:

1. Longer evidence-oriented queries for the four misses: dense 3/7, dense+FTS 6/7, pipeline mix 6/7. No dense gain.
2. Shorter evidence-oriented queries: dense 5/7, dense+FTS 6/7, pipeline mix 6/7. Kept only the three criteria that improved; reverting the unsuccessful originality rewrite preserved these totals.

3. Follow-up: a closer criterion-aware replay showed the original three rewrites reached only 5/7. In this replay, the rubric-query baseline hits analytical execution, results and citations—not methodology. One focused methodology query restores methodology, raising the previous change from **5/7 to 6/7** in that replay while preserving the historical 5/7 dense and 6/7 fused totals. The new report includes `previousCandidate` rankings to reproduce this incremental comparison.

The gains are measured with the existing 473 passage vectors and the original substring relevance labels. Dense ranking uses cosine similarity; the lexical leg uses `buildFtsQuery` and the historical substring-count approximation, not PostgreSQL tokenization or `ts_rank`. Fusion uses the existing `fuseCandidates` weighted RRF implementation. No acronym FTS experiment is used by this new evaluation mode.

The pipeline-mix row preserves the scoring harness's historical **text-only** `routeQuery(query)` call. It includes routed query expansion and template HyDE, but is **not** a live `retrieveEvidence` evaluation: metadata/citation generators, reranker, MMR, compression and LLM HyDE are not measured here. The separate **criterion-aware replay** calls `routeQuery(query, { criterionId })`, uses the routed source weights and candidate limits, and shares production dense max-cosine merging and 1.15 section-boost helpers. This avoids the historical harness’s independent RRF vote per dense variant. Dense per-query pools follow the production `ceil(limit * 1.5)` policy; lexical candidates are limited before section boosting. That row is still an offline, dense/lexical-only approximation, not a call to the full live `retrieveEvidence` pipeline. No database was contacted. Broader corpus/language and live-pipeline validation remain necessary; these results do not establish a universal retrieval improvement.

## Reproduction

No passage text, passage embeddings, PDF, extraction, or review files were changed. The reports record the SHA-256 of `embeddings.json`, exact baseline/candidate queries, and top-five chunk IDs/headings with per-criterion hits.

With the normal project dependencies available:

```sh
# Offline, no model or network needed: verifies the saved query-set fingerprint.
pnpm exec tsx scripts/compare-analysis2-retrieval.ts --criteria-only --cached-queries
pnpm exec tsx scripts/score-pipeline-variants.ts --cached-queries
pnpm exec tsx scripts/score-pipeline-variants.ts --criterion-aware --cached-queries
pnpm exec vitest run lib/ai/__tests__/criterion-query.test.ts lib/ai/__tests__/candidate-ranking.test.ts lib/ai/__tests__/retrieval-routing.test.ts lib/ai/__tests__/fusion.test.ts lib/__tests__/vector-rag.test.ts
```

`--criteria-only` bypasses the older raw/margin-index experiment entirely. Do not omit it when running the comparison for this task.

To regenerate **query vectors only**, use the local ONNX model documented in `scripts/embed-analysis2.ts`, then omit `--cached-queries` from the scorer. The scorer sets real/local-only MiniLM inference and rejects any `getModelHealthSnapshot().embedding.fallbackCount !== 0`, wrong dimensions or non-finite vectors. It never embeds passages. The query cache stores float32 neural vectors with a fingerprint of the model and complete query set; fresh and cached scoring both use float32 values.

This checkout lacked both the dependency tree and the model cache mentioned in the handoff. A temporary, ignored `.cache/retrieval-tools` dependency set and the documented npm-packaged ONNX were restored for execution; repository dependency manifests and lockfiles were not changed. One pre-model diagnostic invocation of the old scorer emitted hash-fallback results; those were discarded, not used as evidence. The scorer now fails instead of reporting a result when fallback occurs.

## Saved evidence

- `criterion-comparison.json`: dense and dense+FTS results.
- `criterion-pipeline.json`: historical routed query-mix results.
- `criterion-aware.json`: criterion-aware dense/lexical policy replay, with route profiles/weights, previous-candidate results and per-criterion rankings.
- `criterion-query-vectors.json`: compact neural **query** vectors for offline regression (not new passage embeddings).
- `lib/ai/__tests__/criterion-query.test.ts`: replays all three reports, checks protected hits and unchanged results/citation rankings and unchanged non-target/language behavior; embedding calls are mocked to throw.

Both harnesses enforce the acceptance gate: reproduce the exact baseline hit/miss pattern for the selected mode, increase hits among the four misses, retain all three protected hits, and introduce no per-criterion hit regression.

## Scope and ranking safeguards

Both production callers pass the explicit thesis title into the query builder. The scope check never uses the inferred domain fallback. Unknown criterion IDs (including JavaScript prototype property names) retain the normal string query via a `Map` lookup.

`candidate-ranking.ts` extracts existing production behavior without changing it: max cosine per dense chunk, followed by a single section boost, sorting, and limit. Unit tests cover duplicates, stable ties, boost order, null paths, metadata preservation and non-mutation. No new section weighting or production fusion setting was introduced.
