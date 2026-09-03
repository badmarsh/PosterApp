# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
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
