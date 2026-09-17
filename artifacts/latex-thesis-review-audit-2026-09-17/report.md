# PosterApp LaTeX & Thesis/Scientific-Paper Review Audit

**Audit date:** 2026-09-17  
**Repository:** `badmarsh/PosterApp`  
**Branch:** `arena/01a0b0ec-posterapp`  
**Baseline commit:** `28364b1a891caebf10bb77d2351d88593c5cbcb4`

## Executive summary

The audited code paths now separate scientific-paper peer review from the Slovak 14-section thesis assessment, gate unsupported adverse AI claims from export and grading, maintain stable evidence anchors, perform bidirectional citation checks, and degrade missing graphics to visible nonfatal placeholders. LaTeX layout estimation and validation now use the same template-aware budgets. PDF/TeX/DOCX paper exports use publication terminology and suppress thesis/ECTS grading. Formal exports disclose AI assistance.

No open P0 or P1 defect remains in the audited scope. Residual P2 items are documented below and do not invalidate the hardened behavior. No database credential or password was changed.

## Scope and method

Reviewed:

- `lib/latex/`: generators, parser, templates, encoding, layout budgeting, validation, figures/assets, log parsing, and deterministic quick fixes.
- compile/autofix and review/export API routes, including workspace scoping and temporary-directory isolation.
- `lib/ai/`: review policy, engine, pipeline, composer, evidence validation, academic checks, chunking, hybrid pgvector RAG, and agentic review.
- `components/thesis-review/`, serializer/persistence paths, DOCX generation, PDF/TeX/Markdown export.
- tests covering escaping, preambles, templates, missing assets, layout, review kinds, evidence, citations, anchors, exports, and workspace isolation.

Method: static line review, focused Vitest regressions, full Vitest runs, TypeScript checking, and Next.js production build. Evidence is retained under `evidence/`; executable reproduction scripts are included beside this report.

## Findings and remediation

### P0 — malformed LaTeX commands in registered templates — **resolved**

**Impact:** venue-paper and landscape templates emitted doubled command prefixes, making otherwise valid generated documents uncompilable.  
**Remediation:** restored single LaTeX command prefixes and added registry-wide assertions. Representative corrected Elsevier template: `lib/latex/templates.ts:621-644`.  
**Regression:** `lib/latex/__tests__/template-registry.test.ts`; evidence `10-template-regression-tests.txt` and `12-after-template-full-tests.txt`.

### P0 — paper/thesis policy leakage — **resolved**

**Impact:** scientific papers could receive thesis/ECTS grades, defense terminology, and PhD thesis enrichment.  
**Remediation:** centralized policy guards at `lib/ai/thesis-review-policy.ts:10-24`; applied them in review engine, pipeline, and agentic-review flows. Composer dispatches papers into a dedicated peer-review narrative at `lib/ai/review-composer.ts:106-224`, always returning a null grade (`:196-207`).  
**Regression:** `lib/__tests__/professional-mode-default.test.ts`, `phd-enrichment-institution.test.ts`, `review-engine-grading.test.ts`, and `review-composer.test.ts`; evidence `40-paper-thesis-separation-tests.txt`.

### P1 — missing image/logo aborted compilation — **resolved**

**Impact:** stale relative assets or missing logos caused `graphicx` to terminate the entire compile.  
**Remediation:** the final-document pass now rewrites graphics calls to an idempotent `\IfFileExists` wrapper and emits an “Image unavailable” box (`lib/latex/generator.ts:29-75`). This catches generator images and template logos without requiring API callers to duplicate handling.  
**Regression:** `lib/latex/__tests__/figure-generation.test.ts`, `generator.test.ts`; evidence `20-missing-graphics-tests.txt`.

### P1 — layout estimator/validator disagreement — **resolved**

**Impact:** the editor, preview, review API, and conversion path could disagree about overflow; explicit card budgets and aggregate column overflow were not consistently honored.  
**Remediation:** shared per-template budgets (`lib/latex/layout.ts:3-52`), shared structural height breakdown (`:54-90`), explicit-budget precedence and aggregate column checks (`lib/latex/validation.ts:201-230`), with all UI/API consumers passing active template and sibling context.  
**Regression:** `lib/latex/__tests__/layout-budget.test.ts`; evidence `30-layout-validation-tests.txt`.

### P1 — unsupported adverse/missing-content claims affected output — **resolved**

**Impact:** an AI search miss could be presented as proof that content was absent and influence automated grading.  
**Remediation:** missing-content language is calibrated, and unsupported adverse AI findings are confidence-capped, marked `needs_human_review`, excluded from export, and excluded from automated scoring (`lib/ai/evidence-validator.ts:335-375`). Reviewer-approved findings remain available.  
**Regression:** `lib/__tests__/evidence-validator.test.ts` and grading tests; evidence `50-evidence-gating-tests.txt`.

### P1 — citation/reference consistency was one-directional — **resolved**

**Impact:** missing bibliography targets and uncited bibliography entries could pass undetected; bibliography text could self-match as an in-text citation.  
**Remediation:** numbered lists/ranges and author-year forms are checked bidirectionally after bibliography sections are removed from body scanning (`lib/ai/academic-checks.ts:178-240` and subsequent matching logic).  
**Regression:** `lib/__tests__/academic-checks.test.ts`; evidence `60-citation-matching-tests.txt`.

### P1 — RAG evidence anchor drift — **resolved**

**Impact:** rank-based anchors could change after asynchronous retrieval or deduplication, causing displayed citations to point at a different validation chunk.  
**Remediation:** opaque SHA-256 anchors derive solely from persistent chunk ID (`lib/ai/evidence-validator.ts:34-37`). The pipeline stores that exact anchor, assembles criterion context in rubric order, and preserves it through deduplication (`lib/ai/review-pipeline.ts:277-303`); agentic review uses the same scheme.  
**Regression:** `lib/__tests__/evidence-validator.test.ts` and vector pipeline tests; evidence `70-stable-anchor-tests.txt`.

### P1 — nondeterministic thesis structure and fabricated positive fallbacks — **resolved**

**Impact:** optional PhD and key-points blocks changed a nominal 14-section report into 13–16 sections; empty evidence generated unsupported praise.  
**Remediation:** PhD enrichment and key-point summaries are folded into canonical sections, all thesis audiences receive exactly 14 numbered sections, and section 14 is either reviewer attestation or a privileged confidential block (`lib/ai/review-composer.ts:215-227`, `:247-404`). Empty areas now state that an evidence-grounded assessment is not established and require human review (`:100-103`, used throughout).  
**Regression:** `lib/__tests__/review-composer.test.ts`; evidence `80-composer-defense-tests.txt`.

### P1 — paper terminology/grade leakage in formal exports — **resolved**

**Impact:** PDF/TeX/DOCX paper reviews could be labelled as thesis assessments, expose ECTS ratings, or ask “defense” questions.  
**Remediation:** export routing now passes persisted `reviewKind` while retaining workspace-scoped lookup (`app/api/workspaces/[id]/thesis-review/[reviewId]/export/route.ts:58-60`, `:85-108`, `:205-245`). LaTeX labels, criterion ratings, summary grade, and AI disclosure are kind-aware (`lib/latex/generator-thesis-review.ts:240-325`). DOCX uses peer-review terms, suppresses paper grades, audience-filters findings, and includes disclosure (`lib/docx/generator-review.ts:28-41`, `:100-133`, `:275-328`).  
**Regression:** `lib/latex/__tests__/generator-thesis-review.test.ts`, `__tests__/lib/docx-confidential.test.ts`, `lib/__tests__/review-composer.test.ts`; evidence `90-export-tests.txt`.

### P2 — generic questions appeared ahead of grounded questions — **resolved**

**Impact:** a reviewer saw generic prompts before questions linked to verified findings.  
**Remediation:** finding-derived questions now require verified evidence, quote the verified passage, lead the list, and generic fillers are explicitly marked for human verification (`lib/ai/academic-checks.ts:461-530`).  
**Regression:** `lib/__tests__/academic-checks.test.ts`; evidence `80-composer-defense-tests.txt`.

### P2 — pgvector HNSW filtered recall — **mitigated; production calibration recommended**

**Impact:** with a large multi-tenant HNSW index, post-index workspace/document filtering can return fewer scoped candidates.  
**Mitigation:** retrieval runs transaction-local `hnsw.ef_search` scaled to requested pool and attempts pgvector 0.8 relaxed iterative scanning before the workspace/document-scoped hybrid CTE (`lib/ai/vector-rag.ts:292-378`). SQL remains parameterized through Prisma fragments.  
**Residual:** calibrate `ef_search` and verify query plans against production corpus cardinality. The sandbox did not contain production database statistics, so this is deliberately P2 rather than claimed fully resolved.

### P2 — long-chunk heuristic — **accepted residual**

The reranker applies a small `-0.05` penalty above 4,000 characters (`lib/ai/vector-rag.ts:617-620`) in addition to later cross-encoder truncation/compression. This is bounded and cannot bypass evidence validation, but should be calibrated on domain-specific retrieval judgments. It is not a correctness or security defect.

## LaTeX-specific conclusions

- Free prose and structural fields have separate escaping policies; inline math and citations survive while metadata remains safe in macro/table contexts (`lib/latex/generator-thesis-review.ts:20-78`).
- Review preambles include UTF-8 input, T1 fonts, and language-specific Babel (`lib/latex/templates-thesis.ts:43-87`).
- Missing relative assets are nonfatal and visibly represented (`lib/latex/generator.ts:39-75`).
- Compile repair remains bounded; deterministic fixes precede AI-assisted patching, and generated card patches are schema validated.
- Temporary compilation directories are unique and removed in `finally`; persistent export paths are workspace-derived and the review query includes `workspaceId`.

## Validation result

Final validation evidence is stored as:

- `evidence/90-export-tests.txt` — 3 export/composer/DOCX files, 31 tests passed.
- `evidence/100-final-focused-tests.txt` — 16 audit-focused files, 214 tests passed; TypeScript check passed.
- `evidence/101-final-full-tests.txt` — 135 files, 1,302 tests passed, 1 skipped, 0 failed.
- `evidence/102-final-build.txt` — production Next.js compilation, TypeScript, page-data collection, and static generation all passed.
- Earlier numbered files preserve each remediation checkpoint and its full-suite/build outcome.

Reproduce with:

```bash
./artifacts/latex-thesis-review-audit-2026-09-17/validate-static.sh
./artifacts/latex-thesis-review-audit-2026-09-17/validate-focused.sh
./artifacts/latex-thesis-review-audit-2026-09-17/validate-full.sh
```

## Environment note

The initial checkout lacked a generated Prisma client because the Prisma engine CDN disconnected during TLS setup (`evidence/03-prisma-generate.txt`). This was an environment/dependency bootstrap issue rather than an application defect. A generated client was made available locally for final TypeScript/build validation without changing database credentials. Normal CI/deployment must continue running the repository's Prisma generation step.

## Final risk statement

All identified P0 and P1 findings in scope have code-level remediation and regression coverage. Remaining P2 work is empirical retrieval/layout calibration requiring representative production documents and query plans; it does not weaken workspace isolation, evidence gating, confidentiality, paper/thesis separation, or LaTeX compilation resilience.
