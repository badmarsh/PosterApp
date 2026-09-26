# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Posudok revamp — live A4 canvas, real letterhead, six distinct designs (2026-09-26)

The thesis review (posudok) output was the last one without a canvas, and its six
templates shared a byte-identical preamble: the same form with different colours.
A demo posudok assessed two criteria it had no text for and printed one of them as
an `F` because the prose contained a result percentage.

- **Live posudok canvas.** `lib/preview/thesis-layout.ts` + `components/preview/thesis-review-canvas.tsx`
  render the A4 pages the export typesets: hidden probe measurement, pagination into whole
  pages, fit-width/zoom/guides chrome reporting pages, criteria and rated counts, and
  click-to-select blocks that highlight the backing card. The posudok tab of the preview
  switches between this document view and the AI review workspace.
- **Card → document mapping.** `lib/latex/thesis-review-meta.ts` derives every field the form
  needs (student, thesis title, reviewer *role*, institution, grade, recommendation, weighted
  score, strengths, defence questions, citation notes) with a documented precedence:
  explicit `reviewMeta` → six-language card labels → project text. Ratings are read from
  `Hodnotenie: A`, `Klasifikácia: B`, German `Note 1,7`, `[A]` or a *labelled* percentage;
  a percentage inside prose no longer becomes a grade. Unmatched criteria keep their own title
  instead of being dropped.
- **Letterhead, weighted table, classification.** `lib/latex/templates-thesis.ts` grows real
  letterhead/title/rating macros and six structurally distinct designs (stacked rule, shaded
  table, minimal, rule bar, two-column, band) with their own rating symbols and criteria-table
  treatments. Every template prints criterion, weight, points and rating columns, a
  weighted-average footer, and a classification panel that shows both the declared percentage
  and the weighted average over the rated criteria — two numbers that legitimately differ.
- **Stored reviews print too.** `lib/ai/review-record-meta.ts` folds a stored `ThesisReview`
  record into output metadata, so the compile route and the export ZIP print the confirmed
  classification and the per-criterion ratings even when a workspace's cards are empty; the
  compile cache key includes the review metadata hash.
- **Curated six-language galleries.** `lib/posudok-gallery-data.ts` ships a complete posudok per
  template in its own language (Slovak medical imaging, Czech predictive maintenance, English
  federated de-identification, German data-centre RL, Polish disinformation detection,
  Hungarian autonomous driving) with rubric-linked `criterionId`s, per-criterion commentary,
  strengths, citation notes and defence questions — so creating a posudok workspace no longer
  produces empty cards.
- **Per-language result figures.** `scripts/generate-demo-figures.mjs` draws a criteria-profile
  radar and a weighted-result chart for each language into `public/figures/`, replacing the one
  generic radar every posudok used to share.
- **Showcase thumbnail and picker previews.** `scripts/generate-posudok-thumbnail.mjs` renders
  the regenerated `public/showcases/posudok-diplomovka-ai.png` from the actual curated review,
  and `lib/template-preview-art.ts` gains a posudok mockup renderer driven by each template's
  own style descriptor.
- **Test contract.** `__tests__/components/thesis-review-canvas.test.ts` (8 tests) covers the
  chrome, the derived student/reviewer, the weighted table, the six distinct designs and their
  rating symbols, pagination geometry and the empty state; the gallery contract now covers
  thesis-review templates as well.

### Demo content, canvases and print-accurate poster fill (2026-09-26 session)

Templates used to demo one and the same document re-tinted per template, a new
project started from empty blocks, and the previews were lists rather than
canvases. Changes:

- **Curated galleries, not re-tinted copies.** `lib/template-showcase-data.ts` ships four
  complete research subjects (HEP di-photon resonance search, CRISPR antiviral programme,
  surgical-robotics VLA, speculative decoding) with their own prose, tables, figures and
  bibliographies, composed per template *and* per output type: poster editions (classic,
  dense, wide, Better-Poster hero), slide editions (classic, statement, editorial) and paper
  editions (full two-column, single-column, compact, proceedings). Poster editions are placed
  with `planPosterColumns` and topped up with a spare block so no column is left mostly white;
  every content slide carries speaker notes. `lib/__tests__/template-gallery.test.ts` fails if
  two templates ever ship identical card sets again, if a poster column is empty or >10% over
  budget, if a gallery cites a key its bibliography lacks, or if a gallery figure path could
  not be materialised at compile time.
- **Real demo figures.** `scripts/generate-demo-figures.mjs` draws eight deterministic
  vector figures (learning curves with confidence bands, grouped bars with error bars,
  detector cross-section, invariant-mass spectrum, cryo-EM dose response, knockdown screen,
  convergence map, model architecture) into `public/figures/*.svg|png`. `materializePublicFigures()`
  copies exactly the referenced files into the LaTeX staging directory (traversal- and
  `/api/`-guarded), for both the compile stage and the export ZIP; `outputFileTracingIncludes`
  keeps them in a serverless trace.
- **New projects are seeded.** `POST /api/workspaces` seeds the template's example cards and
  bibliography (`seedContent: false` opts out); `addOutput` in the editor store does the same
  for additional outputs; the template picker previews what each template starts with. The
  in-memory demo project (`demo_ws`) is assembled from the galleries, so all three of its
  outputs tell one story with one bibliography.
- **Slides get a canvas.** `components/preview/slide-canvas.tsx` draws each slide on a real
  160 × 90 mm frame at the template's own title proportions, with dark-ground themes drawn
  dark, a running footline, the metropolis progress bar, and per-pattern body rendering
  (prose, `stats` tiles, figures with captions, tables, two-column).
- **Poster fill is print-accurate.** The generator and the canvas now share one decision table
  (`posterStretchModeFor`, `posterResidualWhite`, `POSTER_STRETCH_SAFETY`): stretch glue
  (gemini, a0poster) fills the board exactly; tikzposter-class boards get an explicit
  `\vspace{Nem}` with a documented safety factor. The canvas reports what *prints*
  ("~N% prints white" vs "filled in print") instead of the raw estimate, and a project's theme
  override only colours the output that owns it.

### Audit Fixes (2026-09-21 session — `docs/audits/addendum-fixes-2026-09-21.md`)

Implementation of the findings from the deep technical audit (`docs/audit/deep-analysis-2026-09-21.md`).

- **F-01 Single-pass LaTeX escaping.** `escapeLatex` previously ran chained `.replace()` passes that re-scanned their own output — a raw backslash became the corrupt `\textbackslash\{\}`. Now one regex consumes each special character exactly once via the `LATEX_SPECIALS` table; `<`/`>` also escape to `\textless{}`/`\textgreater{}` (T1 fonts typeset them as ¡/¿ glyphs).
- **F-02 Extended Unicode → LaTeX coverage.** `mapUnicodeToLatex` now covers math operators (∑ ∏ ∫ ∮ ∞ ∂ ∇ √ ℏ ℓ ⊕ ⊗ ⊖ ⊘ ≪ ≫ · ∝ ∘ ∼ ≃ ≅ ≡ ⊥ ∥ ⌊⌋ ⌈⌉ ⟨⟩ ∀ ∃ ∅ ↑ ↓ ↕ ↦ ⟶ ⟵ ÷), subscripts ₀–₉ and textcomp symbols († ‡ © ® ™ €) — all base-LaTeX-safe (no amssymb dependency) — and strips pictographs/emoji (U+1F000–1FAFF + dingbat ranges + ZWJ/VS16) that previously produced hard `inputenc` compile failures.
- **F-03/F-09a EPJ WoC template.** `getEpjWocTemplate` no longer emits the literal placeholder `\documentclass[option]{webofc}` and loads `amsmath` so the `\fitmath` resize path can't error.
- **F-09b elsarticle abstract.** Abstract cards are spliced into the frontmatter for elsarticle (like acm-sigconf) instead of rendering as body text after `\end{frontmatter}`.
- **F-22 Per-template BibTeX styles.** New `BIBSTYLE_BY_TEMPLATE` map: revtex-aps→`apsrev4-2`, elsarticle→`elsarticle-num`, acm-sigconf→`ACM-Reference-Format`, jinst→`JHEP`, epj-woc→`woc`, iopart→`iopart-num`, aaai→`aaai2026`, icml→`icml2026`, iclr→`iclr2026_conference`, acl→`acl_natbib`, neurips→`plainnat`, ieee-conf→`IEEEtran`. Unknown templates keep `plain`.
- **F-07 Poster generator honours the requested output.** `TikzPosterGenerator.generateDocument` now reads `outputConfig.cards` instead of re-resolving `project.activeOutputId` — compiling a non-active output previously produced the active output's PDF.
- **F-24 Metric hero tiles.** >3 metric items render at 0.46\linewidth (rows of two) instead of the cramped 0.28 single-row width.
- **F-08 Slides registry.** `bullets-table` is a valid slides pattern; slides `defaultCardCount` aligned 12→7 to match the narration-capacity budget used everywhere else.
- **F-12 Height estimation.** `estimateHeightBreakdown` for stats/metric-card now charges for the optional table and figures those patterns actually render, so overflowing stats cards are no longer under-estimated.
- **F-14 Thesis-review academic year.** New localized `academicYearLabel` in all six `ThesisReviewLabels` locales (sk/cs/en/de/pl/hu) replacing the hardcoded Slovak "Dátum / Rok:" in German, Polish and Hungarian exports.
- **F-04 Criterion resolution across rubric generations.** The thesis-review generator resolves sections against SK_ACADEMIC_RUBRIC_V1 (12 ids, what the production pipeline writes) first, then legacy THESIS_CRITERIA, then a diacritic/case-folded title match — and no longer silently drops unresolvable sections (humanized-title fallback keeps the reviewer's text in the PDF).
- **F-05/F-20 Elite showcase seed data.** `scripts/populate_elite_showcases.ts` writes proper `ThesisSection[]` (v1 criterionIds, ratings, scores) instead of the legacy `{criterion,title,grade,evidence}` shape, and the seeded slide equation is wrapped in `$…$` so it renders as math instead of escaped literal text.
- **F-06 Export ZIP completeness.** Workspace export now bundles the vendored `public/latex-styles/*` (.sty/.cls/.bst/.cfg/.clo) and `public/logos/*` templates logos, so the exported project compiles outside PosterApp for venue templates that are not on TeX Live default installs.
- **F-10 Compile cache integrity.** The compile cache key now includes a fingerprint of the resolved BibTeX source and on-disk assets (name+size+mtime), so bibliography-only or image-only changes no longer return stale cached PDFs; workspace GET returns outputs in deterministic (`createdAt ASC`) order; `compileWorkspace` builds its Project with sorted outputs.
- **F-11 acmart font conflict.** `ensureEncodingPreamble` no longer injects `lmodern` into `acmart` documents (class manages its own fonts; lmodern caused symbol redefinition errors).
- **Repo hygiene.** `scripts/patch_showcase_cards.js` (stale one-off migration whose targets no longer exist) rewritten without the nested template literal that made it unparseable by ESLint — it now exits cleanly with an explanatory message.
- **Tests.** New suite `lib/latex/__tests__/audit-fixes-2026-09.test.ts` (28 tests covering F-01…F-24), parser tests extended (+8), compile-cache test extended for the fingerprint invalidation (4 tests). pgvector-live eval tests now `ctx.skip()` in sandboxed environments whose Prisma engine is a stub (`Prisma.sql is not a function`) while keeping the deliberate loud-fail design for genuine DB unavailability.

### Error Lens, Quick Fixes & Defense Readiness (2026-09-17 session — `docs/audit-2026-09-17.md`)
- **Structured compile-log Error Lens.** New `lib/latex/log-parser.ts` parses the pdflatex/bibtex log into typed issues (errors, package/file/math/bibtex errors, Overfull boxes, warnings) with `l.NNN` line + context extraction, hard caps for pathological logs, and `attributeIssuesToCards()` heuristics (quoted file names, control sequences, normalized context matching). The PDF sidebar now shows a triage list with counts, severity icons, fix hints, expandable detail and jump-to-card instead of a raw log dump; the raw log stays behind a toggle. 15 unit tests.
- **Deterministic Quick Fixes in the card inspector.** `lib/latex/quick-fixes.ts` repairs the classic one-click breakages before the (rate-limited) AI autofix loop is spent: close unclosed `$…$`, balance braces, neutralise unknown control sequences inside math; plus dangling `\cite`-key and `\ref`-label diagnostics. Applied via the Validation tab with a Sonner toast. A live HeightMeter in the Content tab renders the same `estimateHeightBreakdown` model validation uses (soft 85 % warning / hard 100 % destructive thresholds, per-part breakdown). 15 unit tests.
- **Defense readiness scoring + Defense Pack.** `lib/thesis-review/defense-pack.ts` scores every prep question 0–100 (difficulty base, high-stakes-category boost with Slovak diacritic normalization, missing-evidence/penalties), gives a readiness verdict with a Slovak recommendation, sorts by risk (stable, non-mutating) and builds a copyable Markdown Defense Pack (risk-sorted questions, talking points, evidence quotes, source findings). DefensePrepPanel gains risk badges, a sort toggle, readiness banner, evidence display and an accessible rehearsal timer (3/5/10 min, aria-live). Fixes malformed Tailwind opacity chains (`bg-destructive/100/10`). 13 unit tests.
- **Credibility pill + retraction warning in academic search.** `lib/services/search-quality.ts` computes a 0–100 trust score per result (citations, influential citations, venue, OA availability, recency, retraction) with high/medium/low/retracted levels and reasons; OpenAlex `is_retracted` is mapped and survives result merging. Retracted papers get a destructive “RETRACTED — necitovať” badge; the OA link and other hardcoded `emerald/blue/amber/red-500` colors across high-traffic components are migrated to semantic tokens (`success`/`warning`/`status-info`/`destructive`) and locked by source-level tests.
- **Audit memo** `docs/audit-2026-09-17.md`: strengths, top-10 frictions with risk ranking, shipped/deferred lists.
### DeerFlow Integration (Phase 0 + Phase 1 — deep research copilot)
- **Optional DeerFlow sidecar (off by default).** New `deerflow` service in `docker-compose.yml` behind a `deerflow` profile, bound to `127.0.0.1:2026`; `DEERFLOW_ENABLED=1` + related env vars in `.env.example`; README section with security notes.
- **Zero-dependency bridge** (`lib/deerflow/`): env config, error taxonomy, hand-rolled SSE parser (chunk-boundary invariant, multi-line frames, 512 KB frame cap), HTTP client with same-origin bridge-path validation (never reaches a user-controlled host), thread create/delete + streamed run execution against the LangGraph-compatible API.
- **Run lifecycle + data model.** `DeerflowThread` Prisma model + migration `20260905000000_deerflow_threads` (mapping, status, phase, validated proposal, cost estimate, cascade delete); in-memory run store with event ring + subscriptions; background runner that never throws (failures are stored) and normalizes the agent's JSON against the workspace asset whitelist before persisting.
- **Budget & guardrails.** Per-workspace daily ledger (`DEERFLOW_DAILY_BUDGET_USD`, default $3), per-user rate limit (3/h), hard run timeout, `maxMinutes` ceiling, `DEERFLOW_ENABLED` + per-workspace `deerflowEnabled` kill switches, strict Zod start/estimate schemas.
- **API routes.** `POST …/deerflow/threads`, `POST …/deerflow/estimate`, `POST …/deerflow/runs` (202 + background), `GET …/runs/[runId]` (durable status), `GET …/runs/[runId]/stream` (SSE passthrough with replay + heartbeat + terminal events), `POST …/runs/[runId]/apply` (revision-gated, create-only card application + bib dedupe + agent event), `DELETE …/threads/[threadId]` (owner-only cancel+cleanup). All routes use `requireWorkspaceEditor/Owner`, `rateLimitAsync`, capped body reads and `safeApiError`.
- **Deep research UI tab.** New "Deep research" tab in the AI Assistant panel: focus/language/depth controls, debounced cost+time estimate, confirm-before-start, live phase/log feed via EventSource, proposal preview, apply-with-reload and discard.
- **Tests.** `lib/deerflow/__tests__/` (SSE parser incl. 50 random chunk boundaries + frame cap, bridge client against `tests/fixtures/deerflow-gateway.mjs`, budget gate, proposal normalization + JSON extraction) — all runnable with no external network and no live sidecar.
### DeerFlow Integration (Phase 2 — Autonomous Build & Fix Loop)
- **`improve_poster` run kind.** New DeerFlow run kind that compiles the active workspace poster, streams the error log to the DeerFlow lead agent, receives per-card Markdown patches, applies them with pre-mutation snapshots, recompiles, and repeats up to `maxIterations` (1/3/5). The loop runs entirely in the background; human confirmation is required before treating the final state as canonical.
- **Reusable compile helper.** Extracted `lib/latex/compile-workspace.ts` (`compileWorkspace(workspaceId, opts)`) from the compile HTTP route so the DeerFlow runner can call the same sandboxed LaTeX compilation logic without going through an internal HTTP call. The existing `/api/…/compile` route delegates to this helper.
- **Discriminated-union start-run schema.** `DeerflowStartRunSchema` is now a Zod discriminated union on `kind`; `poster_research` (Phase 1) and `improve_poster` (Phase 2) use separate schemas parsed in `POST …/deerflow/runs`. Old shape is backward-compatible (missing `kind` defaults to `poster_research`).
- **New contracts.** `CardPatchSchema`, `ImprovePosterIterationSchema`, `ImprovePosterProposalSchema` (version `improve-poster-v1`), `normalizeImprovePosterProposal` (card-id whitelist + `hasUnsafeLatex` guard on every patch), `extractImprovePosterJsonCandidate`.
- **ImprovePoster context + prompts.** `buildImprovePosterContext` reads non-reference card Markdown (max 600 chars each), templateId, and outputType. `buildImprovePosterPrompt`/`buildImprovePosterPayload` instruct the agent to diagnose errors and return safe Markdown patches only.
- **Budget estimates for improve_poster.** `IMPROVE_POSTER_ESTIMATES` (1 iter: $0.05/3 min, 3 iter: $0.18/10 min, 5 iter: $0.35/18 min), `estimateImprovePosterRun(maxIterations)`.
- **`POST …/runs/[runId]/apply-improve`.** Confirmation route for improve_poster runs: re-validates the stored `ImprovePosterProposal` against current card ids, takes a final agent snapshot, returns patch/iteration counts and clean-compile status.
- **UI: "Opraviť poster" sub-tab.** Two-tab switcher (Deep research / Opraviť poster) inside the DeerFlow panel. Improve tab shows max-iterations selector, language picker, cost/time estimate, live phase badge (Kompilácia / Aplikovanie opráv), per-iteration accordion with patch summaries, clean-compile badge, and Potvrdiť/Zahodiť actions.
- **Tests.** 19 new unit tests in `lib/deerflow/__tests__/contracts-improve.test.ts` covering `DeerflowKindSchema`, discriminated-union `DeerflowStartRunSchema`, `ImprovePosterProposalSchema` (alias mapping, iterationIndex bounds), `normalizeImprovePosterProposal` (unknown card ids, unsafe LaTeX, unbalanced braces), and `extractImprovePosterJsonCandidate` (fenced block, raw JSON, no-match).


### LaTeX Templates (Round 8 — template expansion, registry 20 → 35)
- **10 new paper venues.** Physics/HEP: `elsarticle` (Elsevier — NIM A, Phys. Lett. B), `revtex-aps` (PRD/PRL), `epj-woc` (EPJ Web of Conferences), `iopart` (IOP). ML/CS: `neurips`, `icml`, `iclr`, `acl` (ACL/EMNLP/NAACL), `cvpr` (CVPR/ICCV), `aaai`.
- **Landscape posters, finally (Tier 2).** Every previous poster template hardcoded `portrait`, so a landscape A0 board was impossible. Adds `landscape` (A0 landscape, 3 equal columns) and `betterposter` (Morrison "big finding" layout — asymmetric 0.24/0.46/0.24 columns, dominant centre for one plain-language sentence).
- **German, Polish and Hungarian thesis reviews.** `posudok-de` / `posudok-pl` / `posudok-hu` with fully translated labels. New `ReportLanguage` type is deliberately wider than the AI layer's `ReviewLanguage`: the review pipeline still reasons in sk/cs/en, de/pl/hu are render-only. Closes most of audit **B-01** by making the previously-dead `de`/`pl`/`hu` babel entries reachable (`de` also corrected `german` → `ngerman`).
- **Template-aware column budgets (audit B-05).** One `COLUMN_BUDGET = 900` calibrated for A0 portrait was wrong for a landscape board 29 % shorter. `COLUMN_BUDGET_BY_TEMPLATE` + `columnBudgetFor()` now feed `validateCard` (new optional `templateId`; old signature still works), both preview fill gauges, the card inspector and the auto-fill character budget. Values are structural estimates, not PDF measurements — calibration stays open.
- **Overflow warnings now say what to do.** `estimateHeightBreakdown()` returns per-part attribution (chrome/prose/bullets/table/figures) instead of one opaque integer, and `suggestReductions()` turns it into concrete advice: *"exceeds budget by 140u. Options: drop the 3 shortest bullets (−30u), shrink the figure to two-thirds width (−87u)"*. `estimateHeight()` is unchanged.
- **Fixed — single-column papers emitted `figure*`/`table*` (pre-existing).** `isTwoColumn` was `templateId !== "article-single"`, so `springer-llncs`, `jinst-proceedings` and `pos-proceedings` produced starred floats. Those environments are undefined outside a `twocolumn` class, so a wide table or two-figure section **aborted the compile**. Replaced with an explicit `SINGLE_COLUMN_TEMPLATES` set.
- **Fixed — thesis-review export could contradict itself (pre-existing).** Both the PDF and `.tex` paths honoured a `template` override but passed `review.language` independently, producing a document whose babel and labels disagreed. Both now derive language from the template.
- **New `TemplateDef.requiresClass`** lists `.sty`/`.cls` files that are neither in a base TeX Live install nor vendored in `public/latex-styles/`; the template detail panel warns up front instead of surfacing an opaque failed compile.
- **New guard `lib/latex/__tests__/template-registry.test.ts`:** every one of the 35 templates must emit a brace-balanced document with a *distinct* preamble — a registry entry with no generator branch previously fell through to the default template silently, giving the wrong venue format with no error.

### LaTeX Pipeline (Round 7 — Tier A of `docs/audit/latex-audit-2026-09.md`)
- **Thesis-review reports no longer fail to compile on ordinary academic prose (A-01, Critical):** `generator-thesis-review.ts` had its own `escapeLatex` covering only the ASCII special set, so a Greek letter, `≤`, an em dash or a smart quote in AI-written commentary reached the `.tex` verbatim — a fatal `Package inputenc Error: Unicode character … not set up` under the report's own `inputenc[utf8]`+`fontenc[T1]` preamble. `**bold**` also printed as literal asterisks, and a reviewer's `$x^2$` was escaped into `\$x\textasciicircum{}2\$`. Escaping is now split by field role: **structural** fields (student/reviewer names, thesis title, labels, grades) keep verbatim escaping plus the Unicode map — no markdown, no math, so a title cannot become an `itemize`; **free text** (section commentary, suggestions, defense questions, citation issues, confidential notes, recommendation) routes through the same `parseMarkdownToLatex` that poster/slides/paper use. The Unicode table now lives in exactly one place, exported from `parser.ts` as `mapUnicodeToLatex`.
- **Markdown link URLs survive escaping (A-02):** `escapeLatex` ran over the whole string *before* the link regex extracted `[text](url)`, so `\href{}`'s URL argument arrived pre-escaped — every DOI with an underscore, every query string and every anchor produced a wrong or dead link (`https://doi.org/10.1\_5/a`). Links are now placeheld before escaping, exactly like math and citations; the link *text* is still escaped, the URL is not. Non-`http(s)` targets keep the previous text-only behaviour.
- Regression tests added in `lib/latex/__tests__/parser.test.ts` (5 cases) and `lib/latex/__tests__/generator-thesis-review.test.ts` (6 cases). Tier B/C from the audit remain open.

### Applied AI (Round 6 — fixes for `docs/audit/ai-audit-2026-09.md`)
- **Chunker no longer drops text (A-01, Critical):** new `lib/ai/text-splitter.ts` partition splitter (sentence-aware with abbreviation/decimal/section-number protection; Markdown tables and `$$…$$` blocks are atomic; paragraphs are hard boundaries). Previously `94.2%` was indexed as `2%` and table rows vanished. Regression tests in `lib/ai/__tests__/text-splitter.test.ts`. **Re-index existing workspaces** (`Reindexovať`) to benefit.
- **Chunk size fits the embedding window (A-15):** 1200/1500 chars (was 1800/3000) with 150 overlap — MiniLM truncates at 512 tokens.
- **Professional review reads the whole thesis (A-02, Critical):** section-routed 80k excerpt selection instead of the first 80k characters; prompt now states coverage %, section inventory and instructs `REQUIRES_HUMAN_VERIFICATION` for material outside the excerpts; `contextCoverage` surfaced via `ragStats`.
- **RAG budgets reserved up front (A-03):** routed 60 % / vector 30 % / graph 10 % of the context budget (`THESIS_CONTEXT_SHARES`) — vector/graph evidence was previously sliced to ~0 chars.
- **Ranking maths (A-04/A-05/A-06):** fused RRF scores min-max normalised to [0,1]; reranker boosts are fractional and capped; criterion ids mapped to retrieval families (`resolveCriterionFamily`) so section boosts fire for `methodology_rigor`, `results_validity`, …; FTS leg uses OR-joined `websearch_to_tsquery` keywords (AND of 30+ Slovak words never matched); HyDE slot uses expansion keywords for FTS.
- **Compression keeps tables/equations/decimals (R9)** via the shared splitter; predominantly structural chunks are never compressed.
- **Domain-context regex (A-16):** `ai`/`it` word-bounded — "audit", "deficit", "fotosyntézy" no longer classified as Informatics.
- **HNSW recall (A-20):** `SET LOCAL hnsw.ef_search` scaled with `limit`, `hnsw.iterative_scan=relaxed_order` when available.
- **Reindex race (R13):** embeddings computed first, then old→new chunk swap in one transaction; empty embedding runs leave the previous index intact.
- **Prompts (P-1/P-2/P-3):** verbatim-quote rules and "data, not instructions" note in professional system prompt; `sourceRevision` emitted literally (no more "The source revision hash…" → stale); Path A prompt emits the exact score bands from `GRADE_BANDS`, explains retrieved-evidence blocks, and only wraps untrusted blocks (criteria/task were being mangled by `<`-escaping); card generation grounded on topic-focused retrieval (`lib/ai/card-context.ts`), asset-id whitelist in prompt + server-side filter, length range rule.
- **Temperatures (A-09):** structured calls default to 0.2 (`DEFAULT_STRUCTURED_TEMPERATURE`), card generation explicit 0.2, free-text stays 0.7.
- **Per-criterion grades are real (A-17):** professional path derives each criterion's score from its own findings (`—`/pending when none) instead of copying the overall grade / inventing 75.
- **Self-critique guard (A-12):** `verified-exact/normalized` + `SUPPORTED_FACT` findings cannot be downgraded by the 0.6-temperature critic (which never sees the manuscript).
- **Autofix loop is real (A-10):** patches are auto-applied with a multi-card undo snapshot and recompiled up to 3 attempts; "Undo autofix" button in the agent feed. **Injection guard:** only cards referenced by the error window may be patched, max 3 per call.
- **Chat `<fix>` bound to a card:** server annotates `<fix card="…">`; client applies to that card (not whatever is selected later); unclosed/truncated fix blocks are never offered.
- **Overshoot handling (A-21):** one server-side shrink retry before `overBudget` (threshold 1.15×); response includes `totalLength`, `characterLimit`, `shrinkAttempted`, `droppedAssetIds`.
- **Bulk generate (A-11):** dedicated `bulk-generate` limiter (40/min) via `X-Bulk-Generate` header — no more forced 60 s pauses on the app's own limit.
- **Reliability (A-08/A-13/A-14/A-18/A-19):** vision chain capped at 3 models with a 90 s shared deadline and immediate skip on non-429 4xx; in-process circuit breaker per provider URL (`lib/ai/telemetry.ts`, env `AI_BREAKER_*`) with fail-over while open; token/latency ledger exposed in `rag-stats` and the RAG status panel; truncated text completions carry a visible marker; JSON repair sends only the last 4k chars of the invalid output.
- **Cost (A-07):** GraphRAG extraction is now on by default (see Round 7) (`GRAPH_RAG_ENABLED=true`), batched 3 chunks/call, capped 24 chunks/doc and 100 calls/workspace/day, with a request timeout.

### Product & UX (Round 5 — fixes for `docs/audit/product-ux-audit-2026-09.md`)
- **Toasts now render (F-01):** `<Toaster>` (sonner) mounted in `app/layout.tsx`; the 10 existing `toast.*` calls were previously invisible.
- **Workspace creation (F-02):** selector sends `outputType`/`templateId` (was `templateName`, silently ignored); output-type picker (poster/slides/paper/thesis-review), template list from `TEMPLATE_REGISTRY`, slug auto-generated from the name, onboarding empty state.
- **Demo project (F-04):** stale `"prj_lattice"` check replaced by `DEMO_PROJECT_ID`; saving the in-memory demo no longer 404-loops — it shows a read-only notice.
- **Unsaved-edit guards (F-03, F-15):** `switchProject` prompts to save when dirty; thesis review tracks `isReviewDirty`, auto-saves 2 s after triage edits, shows "Uložené hh:mm" / error state and warns on tab close.
- **Destructive confirmations (F-05):** shared `ConfirmDialog`; output-tab delete and thesis-review delete now confirm.
- **Ingestion progress (F-06):** SSE heartbeat every 10 s during the MinerU wait with elapsed time; timeout gets a distinct, actionable error; upload list shows the live stage; X button labelled "Cancel parsing" while running.
- **AI auto-fill (F-07):** "Undo auto-fill" button on the event; `overBudget`, dropped unknown assets and removed unknown `\cite{}` keys are reported instead of swallowed.
- **Self-critique (F-08, F-16):** `debateLog` is now rendered in the review workspace; toggle/help text describe what actually runs (second independent pass, not a 3-expert panel); the critic receives evidence quotes so "overstated vs. evidence" is checkable.
- **Language (F-09):** Academic Search dialog localised (sk/cs/en) via `lib/i18n/academic-search.ts` following the Settings language; mixed SK/EN strings in the agent panel unified to English.
- **Bounded state (F-10):** `agentEvents`/`chatMessages` capped at 200 in the store and on hydrate.
- **Error boundaries (F-11):** per-card boundaries in poster/slides/paper canvases, per-finding boundary and a workspace-level boundary in thesis review.
- **Actionable review tips (F-12):** `ReviewTipSchema` accepts `cardId`; prompt asks for it; server drops unknown ids; the existing "Jump to Card →" link now activates.
- **Duplicate workspace (F-13):** implemented (was a "coming soon" stub reachable from 4 menus) — copies outputs/cards with re-minted ids; uploaded assets are not copied and the user is told so.
- **Collaboration (F-14):** new `GET/POST/DELETE /api/workspaces/:id/members` (owner invites by Clerk e-mail, editor/viewer roles); "Share" dialog with member list and invite link (`/?workspace=<id>` deep link honoured on load); Yjs now syncs output metadata (title/authors/venue/logos/theme/template) alongside cards, and local→Yjs pushes are debounced (150 ms).
- **Grade transparency (F-17):** ECTS badge opens a popover showing weighted criteria, finding deductions, thresholds and proposed range.
- **PDF viewer (F-18):** pages render lazily via IntersectionObserver (±150 % viewport) with height-preserving placeholders.
- **Embeddings (F-19):** `embeddingHealth` tracks fallback vectors; rag-stats exposes it and the RAG panel shows a red "Embeddingy degradované" badge; `instrumentation.ts` warms the WASM model at boot.
- **LaTeX for SK/CZ (F-20):** `ensureEncodingPreamble` injects `fontenc[T1]`, `lmodern` and babel (language auto-detected from body text) into poster/slides/paper output.
- **Shortcuts (F-22):** ⌘/Ctrl+S saves, ⌘/Ctrl+Enter compiles (outside text areas).

### Security (Hardening Round 4 — external audit of `f2930ad6`)
- **SSRF (V-01):** `lib/latex/remote-assets.ts` now downloads figures/logos through a new server-only `safeFetch` (`lib/safe-fetch.ts`) that validates the URL, its DNS-resolved addresses, and every redirect hop against private/reserved ranges, follows redirects manually, requires an image/PDF content-type, and verifies magic bytes. `import-url` uses the same helper (gaining the DNS check). Export route is now rate-limited (10/min).
- **Auth bypass gate (V-03):** E2E bypass moved to `lib/e2e-bypass.ts`; it requires the server-only `E2E_AUTH_BYPASS=1` **and** `NODE_ENV=development|test`. `NEXT_PUBLIC_E2E_TEST` is now client-only and an unset `NODE_ENV` fails closed.
- **Cross-workspace card insert (V-04) / revision bypass (V-07):** `cards/[cardId]` PUT verifies `outputId` belongs to the workspace, uses the strict shared `CardSchema` (no `z.any()`), honours `?revision=` (409 on stale) and bumps `Workspace.revision` transactionally on PUT/DELETE.
- **Unauthenticated fallback (V-05):** `academic/search` returns 401 instead of sharing an `anon` rate-limit bucket.
- **CSP (V-06):** `'unsafe-eval'` only emitted in development; `object-src` no longer allows `blob:`.
- **AI cost/availability (V-08):** every provider call has a hard timeout (`AI_REQUEST_TIMEOUT_MS`, default 180 s).
- **LaTeX (V-09):** compile commands export `openin_any=p openout_any=p shell_escape=f`; `hasUnsafeLatex` blocklist extended (`\makeatletter`, `\@@input`, `\scantokens`, `\pdffiledump`, `\directlua`, caret notation, …); `normalizeLatexPath` strips TeX specials from `\includegraphics` paths.
- **Input bounds (V-10):** byte-capped JSON body reader (`readJsonBodyCapped`) for workspace PUT and chat; chat body zod-validated with image count/size caps; `agentEvents`/`chatMessages`/table rows bounded.
- **Rate limiting (V-11):** production without Upstash now denies rate-limited requests unless `RATE_LIMIT_ALLOW_IN_MEMORY=1` is set explicitly.
- **Info disclosure (V-12):** DB remediation hint only returned outside production.
- **Dependencies (V-02):** `pnpm audit` is clean — overrides for `protobufjs>=7.6.3`, `js-yaml`, `brace-expansion`, `qs`, `@eslint/plugin-kit`.

### Changed
- **Production entrypoint (H-02):** `pnpm start` now runs `server.ts` (Next + Yjs WS) with Turbopack disabled in production; `/healthz` liveness endpoint; `Dockerfile` + `.dockerignore` added; `y-leveldb` added so `YPERSISTENCE` enables durable collaborative docs (H-03).
- **Workspace DELETE (H-04)** removes `workspaces/<id>/` from disk.
- **Schema (H-05):** migration `20260903120000_indexes_and_integrity` adds indexes on `Workspace.userId`, `Output.workspaceId`, `Card.outputId`, `Asset.workspaceId`, `Asset.assignedCardId`, `IngestFile.workspaceId`, `DocumentChunk(workspaceId, documentId)`, `GraphNode(workspaceId, documentId)`; drops the `"unauthenticated"` default on `Workspace.userId`; CHECK constraint on `WorkspaceMember.role`.
- **CI (H-01/H-06):** frozen lockfile, SHA-pinned actions, `permissions: contents: read`, `prisma generate` step, build runs even if earlier gates fail, dedicated `security` job (`pnpm audit --audit-level high` + gitleaks), E2E job split out with the new bypass env, Node 22, `packageManager` pinned.
- `rag-stats` GET no longer deletes rows (cleanup already happens on file delete).
- Fonts are self-hosted via the `geist` package (no Google Fonts fetch at build time).
- `lib/prisma.ts` caches the client on `globalThis` in all environments and only loads dotenv when `DATABASE_URL` is unset.
- Unsaved-changes `beforeunload` prompt (autosave remains off by design).
- Added `app/loading.tsx` and `app/not-found.tsx`.

### Fixed
- ESLint errors in `components/editor-store.tsx` (ref access during render) and `components/thesis-review/thesis-review-provider.tsx` (conditional hook) — CI Lint gate is green again.
- Thesis-review route no longer exports non-handler symbols (moved to `lib/ai/thesis-review-policy.ts`).
- `CONTRIBUTING.md` link to `.agents/AGENTS.md`.

### Removed
- Dead code: `lib/download-image.ts`, unused seed scripts, `settings.json(.backup)`, 1.3 MB `mineru_out_2.json` fixture. Marketing/prompt documents moved to `docs/internal/`.

### Security (previous unreleased items)
- **Rate limiting (Tier A/B):** Migrated the last in-memory `rateLimit` route guards to the distributed-capable `rateLimitAsync` (Upstash Redis REST with automatic in-memory fallback) for `thesis-review/build-communities` and `thesis-review/novelty`. Added per-user-workspace rate limits — keyed `${userId}:${workspaceId}:op` — to five previously unrated write routes: workspace `PUT` save (20/min), `compile` (10/min), `thesis-review/[reviewId]/export` (5/min), `bib` extract (3/min), and `thesis-review/rag-stats` hybrid search (20/min). Resolves audit finding **F1**.
- **LaTeX compiler sandboxing (Tier B):** Switched `pdflatex` from `-shell-escape` to `-shell-restricted` in the compile route, the thesis-review export route, and `scripts/export-all-templates.ts`, after verifying no `\minted`/unrestricted-`\write18` usage depends on it. Blocks arbitrary command execution while retaining the safe `\write18` subset.
- **CSP hardening (Tier A):** `connect-src` is now assembled from configured env origins (`AI_API_URL`, `AI_API_URL_FALLBACK`, `NEXT_PUBLIC_YJS_URL`) plus Clerk, removing the previous overly-permissive wildcard.
- **Upload size enforcement (Tier A):** `assets/upload` rejects oversized bodies early via a `Content-Length` check (200MB limit) before parsing form data.
- **Path-traversal fuzz tests (Tier A):** Added `fast-check` property tests asserting `workspacePath()` never escapes the workspace root across 1000 randomized inputs (`..` traversal, absolute-path injection).

## [0.1.2] - 2026-08-23
### Added
- Expanded LaTeX Template Architecture supporting 8 templates across 3 output types (posters, slides, papers).
- `OutputConfig` multi-output system with AI Context injection for each template.
- Integrated Yjs WebSocket for live collaboration in `server.ts`.

### Changed
- Migrated primary database from SQLite to PostgreSQL (Docker).
- Centralized template types and categories in `lib/output-types.ts`.

### Fixed
- Outdated mocks in `generator-slides.test.ts` causing test failures.
- Updated vulnerable dependencies via selective security patching.

## [0.1.1] - 2026-08-22
### Added
- ESLint flat config (`eslint.config.mjs`)
- 99 unit tests (Vitest) — store slices + API routes
- JSDoc documentation for core exported functions

### Fixed
- Next.js 16 turbopack config location
- Note: Next.js 16 deprecates `middleware.ts` in favor of `proxy.ts`, which was migrated.
- BibTeX deduplication for duplicate PDFs
- Playwright tests missing `webServer` config
- ESLint and React Compiler warnings

### Changed
- Git history purged of large binaries (148 MB → 3.74 MB)
- README revamped with architecture overview

## [0.1.0] - 2026-07
### Added
- Initial release: PDF ingestion, AI card auto-fill, LaTeX compilation
- Clerk authentication, Prisma SQLite, Zustand store
- tikzposter + paper LaTeX generators (atlas/minimal themes)
- MinerU integration for figure/table extraction
- AI poster review, AI chat assistant
