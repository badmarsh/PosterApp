# PosterApp Real Evaluation Report

> **Methodology: mixed** — Phase 1 (verifier wiring) is empirical code change.
> Phase 2 (benchmark framework) is infrastructure. Retrieval metrics are from
> simulated benchmarks (hash-based) until real corpus is provided.

---

## Executive Summary

This report documents the honest state of PosterApp's evaluation as of the
current branch. The key architectural changes in this PR are:

1. **Verifiers are now wired into the production review flow** — numerical
   consistency, equation sanity, and claim-evidence verification run
   deterministically on every review. Previously they existed as disconnected
   modules.

2. **Adjudicator now receives verification data** — the deterministic
   adjudicator escalates findings with confirmed numerical contradictions.
   Previously it was called with empty `numericalDiscrepancies`.

3. **Graph frontier retrieval added as 7th retrieval leg** — bounded BFS
   expansion across the knowledge graph, honestly described (NOT DRIFT).

4. **Real benchmark framework created** — `pnpm eval:real` infrastructure
   ready to run against actual corpus + golden judgments.

5. **CI tests assert structure, not simulated values** — no test asserts
   `recallAt10 >= 0.9` or `supportedRate === 1.0`.

---

## What Was Wired (Phase 1)

### Numerical Verifier → Review Engine

**Before:** `verifyNumericalConsistency()` from `numerical-verifier.ts` was
implemented but never called from the review flow.

**After:** Every finding's explanation is checked against table chunks for
inline numerical claims (p-values, accuracies, F1, AUC, sample sizes) that
contradict tabular data. Discrepancies are passed to the adjudicator.

**Expected behavior:** A finding claiming "p < 0.05" when the cited table
reports "p = 0.12" will be escalated by the adjudicator (minor → major,
major → critical).

### Equation Consistency → Review Engine

**Before:** `checkEquationSanity()` from `equation-consistency.ts` was
implemented but never called.

**After:** Chunks containing LaTeX formulas are scanned for undefined symbols
and range violations (e.g. negative probabilities). Issues are added as
additional findings with appropriate severity.

### Claim Verifier → Review Engine

**Before:** `verifyClaim()` from `claim-verifier.ts` was implemented but
never called from the review flow.

**After:** Every finding with evidence is verified against its evidence chunks.
Findings with `CONTRADICTED` verdict are escalated to critical severity and
flagged for human review.

### Scholarly Comparator → PhD Reviews

**Before:** `compareClaimToPaper()` from `scholarly-comparator.ts` was
implemented but never called.

**After:** For PhD opponent reviews, the thesis's originality claims are
compared against SOTA benchmarking papers. Prior-art relationships
(DIRECT_PRIOR_ART, CLOSE_PRIOR_ART, etc.) are stored in
`phdEnrichment.priorArtComparisons`.

### Adjudicator Receives Real Data

**Before:** `adjudicateFindings()` was called with only `primaryFindings` —
the `numericalDiscrepancies` parameter was always empty.

**After:** Numerical discrepancies from verification are passed to the
adjudicator. The adjudicator's existing escalation logic (line ~130 of
`review-adjudicator.ts`) now actually fires.

---

## What Was NOT Measured and Why

### Retrieval Quality (Recall, nDCG, MRR)

**Status:** Simulated only.

**Why:** The simulated benchmark (`competitive-benchmark.ts`) uses
`simulateRetrieval()` — a function that computes a hash of the query text
and compares it against hardcoded `baseHitProb` values per architecture.
This produces deterministic but fictional numbers.

**What's needed:**
1. Ingest real academic documents into `data/eval/corpus/`
2. Annotate chunk-level relevance judgments in `data/eval/golden-v2/`
   (grade 0-3, with annotator ID and rationale)
3. Run `pnpm eval:real` against a live PGlite engine

**Framework ready:** `lib/ai/eval/real-corpus-benchmark.ts` with
`computeRecallAtK`, `computeNdcgAtK`, `computeMrr` functions tested against
known inputs.

### Verifier Effectiveness

**Status:** Not yet measured empirically.

**Why:** Measuring verifier effectiveness requires a corpus of reviews where
we know ground-truth about which findings have numerical errors. This requires
either:
1. Human annotation of existing reviews (expensive)
2. Synthetic test cases with known contradictions (limited)

**What's available:**
- The `claim-verifier.ts` unit test (`__tests__/claim-verifier.test.ts`)
  verifies the SUPPORTED/CONTRADICTED/UNSUPPORTED logic on 3 mock claims
- The `numerical-consistency.test.ts` verifies the regex extraction and
  discrepancy detection on known inputs

### Adjudicator Quality

**Status:** Not measured against real reviews.

**Why:** The adjudicator's quality depends on the quality of inputs it
receives. With the wiring changes, it now receives numerical discrepancies,
but measuring whether it makes *correct* decisions requires annotated
test cases.

---

## Simulated Benchmarks (Previously Reported as Real)

The following files contain **simulated** data that was previously presented
without methodology labels:

| File | Status | Notes |
|---|---|---|
| `artifacts/eval/final-comparison.json` | `methodology: simulated` | Hash-based `simulateRetrieval()`, not real retrieval |
| `artifacts/eval/retrieval.json` | `methodology: simulated` | Ablation variants use simulated retrieval |
| `artifacts/eval/models.json` | `methodology: simulated` | Recall/latency estimated from model dimensions |
| `artifacts/eval/rerankers.json` | `methodology: simulated` | Reranker metrics estimated, not measured |
| `artifacts/eval/evidence.json` | `methodology: unit_test` | 3 hardcoded mock claims, not a real corpus |
| `artifacts/eval/novelty.json` | `methodology: unit_test` | 2 hardcoded temporal comparisons |
| `artifacts/eval/review.json` | `methodology: unit_test` | 1 hardcoded unverified critical finding |

### Previously Hardcoded Values Now Annotated

- `numericalErrorRate: 0.0` for posterapp-sota → **simulated**, not measured.
  The real rate depends on whether the verifier catches all errors in a real
  corpus.
- `supportedRate: 1.0` → **unit_test**, tested on 3 mock claims only.
- `recallAdvantageOverNaiveRagPct: 480` → **simulated**, based on hash
  probability, not real retrieval.
- `evidenceAnchoringRate: 0.985` → **simulated**, not measured against real
  reviews.

---

## Honest Architecture Description

| Component | Previous Description | Corrected Description |
|---|---|---|
| Graph retrieval | "DRIFT-style GraphRAG" | Bounded BFS graph frontier expansion (3 iterations, 40 nodes, 500ms) |
| Adjudicator | "Bayesian LLR" (implied) | Deterministic rules-based adjudicator |
| Equation checker | "AST equation verifier" (implied) | Regex/range-based equation checker |
| Default embedding | "BGE-M3" (implied as default) | Multilingual MiniLM-L12-v2 384d (actual default) |
| SOTA architecture | "6-Source RRF + DRIFT" | Multi-source RRF (7-leg fusion + Graph + Verifiers) |

---

## Reproducibility

Every number in this report can be verified:

- **Structural assertions:** `pnpm test` — asserts artifact structure and methodology
- **Simulated benchmark:** `pnpm eval:all` — runs simulated evaluation
- **Real benchmark (when corpus available):** `pnpm eval:real` — runs empirical evaluation
- **Typecheck:** `pnpm typecheck` — 207 pre-existing Prisma type errors (unchanged)

---

## Next Steps

1. **Provide corpus** — ingest real academic documents into `data/eval/corpus/`
2. **Annotate golden judgments** — create chunk-ID-level relevance judgments in
   `data/eval/golden-v2/` using the template in `data/eval/annotations/`
3. **Run `pnpm eval:real`** — produces real Recall/nDCG/MRR metrics
4. **Compare simulated vs empirical** — document the gap between simulated
   predictions and real measurements
5. **Measure verifier effectiveness** — count how many findings are
   escalated/downgraded by the wired verifiers in real reviews