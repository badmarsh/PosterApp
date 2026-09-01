# PosterApp Project Information

This file contains important context about the project infrastructure and dependencies for future agent sessions.

## Key Services
- **Next.js Frontend/API + Yjs WebSocket**: Single custom server (`server.ts`). Run via `tsx --env-file=.env.local server.ts`. Serves Next.js on port 3333 AND the Yjs WebSocket at `ws://localhost:3333/api/yjs` (authenticated via short-lived, one-time ticket passed via `Sec-WebSocket-Protocol: posterapp-yjs-v1, <ticket>` to avoid token leakage in URLs).
- **MinerU**: Document parsing service. Runs in a WSL (Ubuntu) environment at `http://localhost:8001`. Source at `~/mineru`. Returns `md_content` (CommonMark Markdown with ATX headings), `images{}` (base64), `middle_json` (tables, equations, page structure).
- **PostgreSQL + pgvector**: Database via Docker using `pgvector/pgvector:pg16` image (NOT the standard `postgres:16-alpine`). Run with: `docker run -d --name posterapp-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=posterapp -p 5432:5432 pgvector/pgvector:pg16`. Connection: `postgresql://postgres:postgres@localhost:5432/posterapp`. The `vector` extension is enabled via Prisma schema (`extensions = [vector]`).
- **Local Embedding Model**: `Xenova/paraphrase-multilingual-MiniLM-L12-v2` via `@xenova/transformers` (Transformers.js/WASM), runs inside Node.js. No external API. Multilingual SK/CS/EN, 384-dimensional vectors. Singleton, lazy-loaded on first use. Model auto-downloads from HuggingFace on first call.

## Startup & Execution
- **Dev Server**: Run `pnpm run dev` to start everything concurrently.
- `start-mineru.bat`: Launches MinerU in WSL via `wsl -d Ubuntu -e bash -c "cd ~/mineru && source .venv/bin/activate && mineru-api --port 8001"`. MinerU API binds to **port 8001**.
- **IMPORTANT**: `pnpm dev` now uses `tsx --env-file=.env.local server.ts` (NOT `next dev`) so both Next.js and the Yjs WebSocket run on the same port 3333.
- **PostgreSQL via Docker**: Must be running `pgvector/pgvector:pg16` (not standard postgres). Start with: `docker start posterapp-postgres`. After schema changes: stop server first (releases DLL lock), then `npx prisma db push && npx prisma generate`.

## Key Directories & Files
- `workspaces/<id>/assets/` — extracted image files (figures, tables) served by `/api/workspaces/[id]/assets/[file]`
- `workspaces/<id>/sources/<fileId>.md` — parsed markdown from MinerU (max 5MB), used as RAG context for card generation and AI review. Also source for vector chunking.
- `app/api/ingestion/parse/route.ts` — PDF ingestion: forwards to MinerU, runs parallel AI captions, extracts BibTeX, saves markdown, **then triggers async vector chunking** (`setImmediate → ingestDocumentChunks()`) for pgvector storage.
- `app/api/ingestion/image-edit/route.ts` — AI image editing via OpenRouter (`openai/gpt-image-1`)
- `app/api/workspaces/[id]/cards/[cardId]/generate/route.ts` — AI card auto-fill
- `app/api/workspaces/[id]/review/route.ts` — AI poster review
- `app/api/workspaces/[id]/history/route.ts` — GET list of snapshots, POST create snapshot with optional label
- `app/api/workspaces/[id]/history/[snapId]/route.ts` — GET snapshot, POST restore, PATCH label, DELETE
- `app/api/workspaces/[id]/thesis-review/route.ts` — GET list / POST generate thesis review (AI posudok)
- `app/api/workspaces/[id]/thesis-review/[reviewId]/route.ts` — GET/PATCH/DELETE single review
- `app/api/workspaces/[id]/thesis-review/[reviewId]/export/route.ts` — Export to DOCX/PDF
- `prisma/schema.prisma` — PostgreSQL DB schema via Prisma. Uses `previewFeatures = ["postgresqlExtensions"]` and `extensions = [vector]`. Contains `DocumentChunk` model with `vector(384)` embedding column.
- `server.ts` — Custom Next.js server that hosts both Next.js and the Yjs WebSocket
- `components/store/use-yjs.tsx` — Yjs hook (now online via `NEXT_PUBLIC_YJS_WS_URL`)
- `components/history-panel.tsx` — Save history drawer UI
- `components/thesis-review/` — Thesis review UI (ThesisReviewPanel, ThesisMetadataPanel, ExpertReviewWorkspace, EvidenceViewer, FindingCard, AnalysisPlanPanel, ThesisWorkflowStepper)
- `lib/ai/document-understanding.ts` — Deterministic structural extraction, quality signals, source revision SHA-256 hashing, and explainable discipline / thesis type classifier.
- `lib/ai/rubric-engine.ts` — Slovak Academic Rubric (`sk-academic-v1`) with 12 criteria, dynamic applicability matrix, caution guidance, prohibited inferences, and calibrated ECTS grade ranges.
- `lib/ai/evidence-validator.ts` — Verbatim and normalized quote verification against source text, synthetic page number stripping, and epistemic status enforcement/calibration.
- `lib/ai/analysis-plan.ts` — Pre-flight evaluation planning engine combining document structure, quality reports, discipline classification, and reporting guideline recommendations.
- `lib/ai/academic-checks.ts` — Objective alignment & research traceability checker, citation consistency audit, and calibrated defense questions generator.
- `lib/ai/review-composer.ts` — 14-section formal academic review narrative composer with epistemic badges, ECTS grading, AI disclosure, and strict confidentiality isolation.
- `lib/ai/local-embeddings.ts` — Self-hosted embedding via Transformers.js (`paraphrase-multilingual-MiniLM-L12-v2`). Singleton pipeline, `generateLocalEmbedding(text) → number[384]`. **In-process LRU cache** (1024 entries, SHA-256 key, oldest-insertion eviction) eliminates redundant WASM calls for repeated queries. `getEmbeddingCacheStats()` / `clearEmbeddingCache()` for diagnostics.
- `lib/ai/document-chunker.ts` — **Sentence-aware & hierarchical ATX Markdown chunker** + `ingestDocumentChunks()` that writes to `DocumentChunk` table with embeddings. Prependuje hierarchické breadcrumbs (`Kapitola > Sekcia > Podsekcia`) do embedding textu pre uchovanie kontextu hlbokých podsekcií. Delenie rešpektuje hranice viet. Chunk size: 1800 chars pre Bc/MSc/články, 3000 chars pre PhD dizertácie (> 200k chars). Vytvára HNSW index (m=16, ef_construction=128).
- `lib/ai/vector-rag.ts` — **6-stage advanced RAG pipeline**: (1) Multi-query fan-out (3 query variants: base, keyword-focus, criterion-expanded), (2) HyDE — Multilingual Hypothetical Document Embeddings (SK/CS/EN academic templates, zero LLM cost), (3) Hybrid RRF retrieval per variant (70% pgvector cosine HNSW + 30% PostgreSQL FTS), (4) Deep structural MMR deduplication (Word trigrams + Char 4-grams, λ=0.7), (5) Criterion-aware reranking (heading alignment + keyword overlap boosts), (6) Contextual chunk compression (abbreviation-safe TF-IDF sentence scoring, ~35-40% token reduction). **High-level entrypoint**: `retrieveForCriterion(workspaceId, query, opts)`. Domain context auto-resolved from thesis metadata via `resolveThesisDomainContext()`. Query expansion per criterion via `getThesisCriterionQueryExpansion(criterionId, lang)`.
- `lib/ai/thesis-context.ts` — Section-aware RAG loader: reads `.md` from disk, classifies sections (Slovak/Czech/English heading patterns), routes evidence to criteria via keyword scoring (`routeSectionsForCriterion`). THESIS_CONTEXT_BUDGETS: fullGeneration=60k chars, perCriterion=6k chars.
- `lib/ai/thesis-rubric.ts` — Evaluation criteria (8 criteria), ECTS grade anchors, level profiles (bachelor/master/phd), STEM/Physics defaults.
- `lib/ai/review-engine.ts` — Professional review mode with EQUATOR guideline support (CONSORT 2025, PRISMA 2020, STROBE, ML Reproducibility).
- `ACADEMIC_REVIEWER_ARCHITECTURE.md` — Complete system architecture, epistemic grounding taxonomy, and rubric specifications.
- `ACADEMIC_REVIEWER_VALIDATION.md` — Automated test matrix, synthetic test benchmarks, and quality validation report.
- `tests/ingestion.spec.ts` — Playwright E2E test for ingestion
- `tests/collaboration.spec.ts` — Dual-context Yjs sync E2E test
- `tests/persistence.spec.ts` — DB save + reload recovery E2E test
- `tests/ai-fallback.spec.ts` — AI error handling / timeout E2E test

## Environment Variables
All AI/model configuration is via `.env.local`. Key vars:

| Variable | Purpose | Default |
|---|---|---|
| `AI_API_URL` | Base URL for AI completions (OpenRouter-compatible) | required |
| `AI_API_KEY` | Bearer token for AI API | required |
| `AI_MODEL` | Fallback model for all AI calls | `gemini-3-flash` |
| `AI_VISION_MODEL` | Model for image captioning (must support vision) | `AI_MODEL` fallback |
| `AI_GENERATION_MODEL` | Model for card auto-fill | `AI_MODEL` fallback |
| `AI_REVIEW_MODEL` | Model for poster review | `AI_MODEL` fallback |
| `OPENROUTER_API_KEY` | Key for image editing via OpenRouter | required for image edit |
| `OPENROUTER_BASE_URL` | OpenRouter API base | `https://openrouter.ai/api/v1` |
| `OPENROUTER_IMAGE_MODEL` | Image-to-image model | `openai/gpt-image-1` |
| `MINERU_API_URL` | MinerU parse service | `http://localhost:8001` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/posterapp` |
| `NEXT_PUBLIC_YJS_WS_URL` | Yjs WebSocket URL (enables collaboration) | `ws://localhost:3333/api/yjs` |
| `CLERK_SECRET_KEY` | Used by server.ts to verify WebSocket JWT tokens | required |
| `SEMANTIC_SCHOLAR_API_KEY` | Academic Connector citation audit (optional but recommended) | 100 req/s with key vs. 100/5min without |

## Architecture Overview

### Store (Zustand + Immer)
The store is split into slices under `components/store/`:
- `project-slice.ts` — workspace/card state, AI actions (`autoFillCardAction`, `autoFillAllCardsAction`, `aiReview`, `saveProject`)
- `ingestion-slice.ts` — file upload/parse state, asset management (`uploadFiles`, `processFile`, `dismissFile`, `removeFile`, `promoteAsset`, `discardAsset`)
- `bib-slice.ts` — BibTeX state
- `ui-slice.ts` — panel/drawer open state

`editor-store.tsx` composes all slices. The `partialize` for Zustand persist only saves `selectedCardId` (intentionally minimal to avoid broken reload state).

### Ingestion Pipeline
```
Browser drop → uploadFiles() → processFile() → POST /api/ingestion/parse
  → MinerU /file_parse (5 min timeout)
  → rename images to <basename>_figure_N / _table_N
  → save markdown → workspaces/<id>/sources/<fileId>.md
  → AI BibTeX extraction from References section
  → AI captions: Promise.all (parallel, 30s timeout each)
  → Prisma $transaction: INSERT assets
  → return { assets }
  → merge into store (update existing by filename, or push new)
```

**Key behaviour:** `fileCache` (module-level Map backed by IndexedDB) stores the original `File` objects for retry. Files survive page refresh.

### AI Card Generation
```
autoFillCardAction(id) → POST /api/workspaces/<id>/cards/<cardId>/generate
  → load sources/*.md from disk (capped at 80k chars)
  → format available assets list
  → AI call (60s timeout) → { title, bullets, assignedAssets }
  → update card content + figures in store
  → trigger generateCardAction (local LaTeX gen)
```

`autoFillAllCardsAction` runs all empty cards sequentially via the `jobQueue`.

### AI Poster Review
```
aiReview() → POST /api/workspaces/<id>/review
  → buildLintReport() (deterministic: missing cites, layout overflows, empty cards)
  → load sources/*.md from disk (capped at 60k chars) — actual grounding corpus
  → AI call (90s timeout, temperature=0.1) → { tips: [{severity, category, message}] }
  → push as AgentEvent
```

### LaTeX Generation
The `lib/latex/` directory contains generators for three distinct output types (`poster`, `slides`, `paper`), each supporting categorized templates defined in `lib/output-types.ts`:
- **Posters**: Built with `generator-poster.ts`. Supports `tikzposter` (including `atlas` and `minimal` themes) and Beamerposter (`gemini`).
- **Slides**: Built with `generator-slides.ts`. Supports Beamer templates (`metropolis`, `beamer-atlas`).
- **Papers**: Built with `generator-paper.ts`. Supports `article-twocol` and `article-single`.

Template preambles and AI Context comments are stored in `lib/latex/templates.ts`. Asset URLs are rewritten from `/api/workspaces/<id>/assets/<file>` → `assets/<file>` for LaTeX `\includegraphics`.

### Database (Prisma + PostgreSQL)
Schema at `prisma/schema.prisma`. Key notes:
- `Card.figures`, `Card.table`, `Card.sourceIds` — stored as JSON strings (`String?`), parsed/stringified in route
- `Asset.assignedCardId` / `Asset.assignedSlot` — stored but no FK `@relation` (no cascade delete)
- `IngestFile.dismissed` — boolean, persisted to DB so dismissed notifications survive page reload
- Run `npx prisma db push` after schema changes, then `npx prisma generate` (stop server first to release DLL lock)

---

## Known Remaining Issues

### Still Open
(None currently)

### Fixed in This Session (2026-08-30)
- ✅ **Thesis Review Workflow UI Redesign & Performance Optimization**:
  - **Bug Fix — Duplicate Saved Reviews**: Updated GET projection in `app/api/workspaces/[id]/thesis-review/route.ts` to return full distinguishing metadata (`reviewKind`, `status`, `confirmedAt`, `grade`, `suggestedGrade`, `finalGrade`, `recommendation`, `createdAt`, `updatedAt`). Regression-tested in `__tests__/api/thesis-review-dedup.test.ts`.
  - **Phase 2.1 — Step Indicator Rail**: Redesigned `ThesisWorkflowStepper` from 4 equal-weight cards into a compact horizontal `<nav aria-label="Kroky posudku">` rail with completed checkmark indicators, numbered active indicator, and accessibility semantics.
  - **Phase 2.2 & 2.3 — Merged Active-Step Action Panel**: Combined ready state, generation options (`confidentialityAgreed`, `skipCitationAudit`), primary "Vygenerovať posudok (AI + RAG)" action, secondary "Predanalýza a plánovanie (Pre-flight)" button, and visible retry on error into a single active-step card in `ThesisReviewPanel`.
  - **Phase 2.4 & 2.5 — Collapsed RAG Diagnostics & Test-Search Callout**: `RagIndexStatusPanel` is now collapsed by default (`expanded = false`), displaying a high-density summary in the header bar and an inline tinted tip callout for hybrid test-search.
  - **Phase 2.6 — Rich Saved Reviews Metadata**: Saved reviews list renders revision indices (`#1`, `#2`), status badges (*Koncept* / *Potvrdený*), full locale timestamp (`30. 8. 2026, 14:32`), reviewer role badge, review kind, grade, and recommendation snippets.
  - **Phase 2.7 — Collapsible Metadata Sidebar**: In `ThesisMetadataPanel`, completed metadata collapses to a compact summary card (`Metadáta ✓ — <Názov práce>, <Meno autora>`) with an "Upraviť" edit affordance, while document selection and pre-flight links remain permanently visible.
  - **Phase 3 — Caching & Performance**: Added in-memory client-side cache for source document markdown in `use-thesis-review-store.ts` (`sourceDocCache`) and 60s TTL cache for RAG index stats in `rag-index-status-panel.tsx` (`ragStatsCache`), preventing multi-megabyte refetches.
  - **Full Test Suite & Production Build**: 62 test files and 439 unit tests passing (100% pass rate), Next.js production build exits code 0 with 42 routes and 0 TypeScript errors.
- ✅ **Perplexity-Style Multi-Source Academic Connector**:
  - **Multi-Provider Consensus Engine**: Integrated **OpenAlex** (250M+ works, Open Access direct PDF URLs, citation counts, topic tags) in `lib/services/openalex-service.ts` and **Crossref** (150M+ authoritative DOIs, journal volume/issue/pages) in `lib/services/crossref-service.ts` alongside **Semantic Scholar** (AI TLDR, citation graphs) and **arXiv** (preprints).
  - **Cross-Source Consensus Deduplication**: `lib/services/academic-connector.ts` executes parallel multi-source queries, normalizes title keys, merges enriched metadata fields (e.g. OpenAlex PDF link + Crossref volume/pages + Semantic Scholar TLDR + citation metrics), and sorts by citation authority.
  - **Perplexity Academic Search Modal UI**: Created `components/academic-search-dialog.tsx` featuring real-time keyword/DOI/arXiv search, domain filter chips (*Všetky odbory, Fyzika & STEM, Informatika / AI, Inžinierstvo, Medicína*), publication year filters, direct Open Access PDF download badges, citation counts, AI TLDR expandable summaries, copy citation (ISO 690 / APA), and 1-click `+ Do .bib` workspace bibliography import.
  - **Global App Integration**: Added "Academic" button to TopBar and "Search Academic Literature (Perplexity)" to Command Palette (`⌘K`).
- ✅ **Self-Hosted Vector RAG Pipeline (Hybrid Search + pgvector HNSW)**:
  - **Docker**: Upgraded from `postgres:16-alpine` to `pgvector/pgvector:pg16` (existing volume preserved). `vector` extension enabled via Prisma `previewFeatures = ["postgresqlExtensions"]`.
  - **Local Embeddings**: `@xenova/transformers` installed; `lib/ai/local-embeddings.ts` uses `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (384-dim, multilingual SK/CS/EN, runs fully in Node.js WASM). Zero API cost.
  - **Document Chunker**: `lib/ai/document-chunker.ts` — ATX heading-based semantic chunker with adaptive chunk sizes: 1800 chars for Bc/MSc/articles, **3000 chars for PhD dissertations** (auto-detected when md_content > 200k chars). 200-char overlap between chunks. Creates `pgvector` HNSW index (m=16, ef_construction=64) after first ingest.
  - **Async Ingestion Hook**: `parse/route.ts` calls `ingestDocumentChunks()` via `setImmediate` after MinerU save — fire-and-forget, does NOT block the SSE stream to the browser.
  - **Hybrid Search**: `lib/ai/vector-rag.ts` uses 70% cosine similarity (`<=>`) + 30% PostgreSQL FTS `ts_rank` in a single SQL query. `rerankChunks()` applies keyword overlap + heading boost + length penalty heuristics (local, no API).
  - **STEM/Fyzika Defaults**: Domain prefix `"STEM, Fyzika: "` prepended to all embedding queries. Thesis review form defaults: PhD · Prírodovedecká fakulta · Katedra Fyziky (STEM).
  - **Prisma Schema**: `DocumentChunk` model with `embedding Unsupported("vector(384)")`, `heading`, `content`, `tokens`, `documentId` fields. Workspace `documentChunks` relation added.
- ✅ **Loading Animations for Thesis Review Generation**: Full-page skeleton loader with glowing `Loader2` spinner + animated pulse backdrop + text "Umelá inteligencia analyzuje rukopis..." shown in `thesis-review-panel.tsx` during `isGenerating`. Replaces the previous button-only spinner.
- ✅ **Thesis Review UI Defaults (STEM/Physics)**: `thesis-metadata-panel.tsx` pre-fills: `thesisType = "phd"`, `institution = "Prírodovedecká fakulta"`, `department = "Katedra Fyziky (STEM)"`, `targetVenue = "STEM / Fyzika"`.
- ✅ **Technical Documentation in Help Modal**: New accordion section "Školiteľské posudky — Technická dokumentácia" in `help-modal.tsx` (accessible via `?` icon). Covers: E2E pipeline (8 steps), Vector RAG architecture (4 component cards), chunking strategy table by thesis type, `DocumentChunk` Prisma schema, and STEM/Physics domain defaults.
- ✅ **AGENTS.md Updated**: Documented new infrastructure (pgvector image, local embeddings, document chunker, vector RAG, thesis review routes, all new lib/ai files, SEMANTIC_SCHOLAR_API_KEY).
- ✅ **Production Build Verified**: `pnpm run build` exits with code 0, 0 TypeScript/ESLint errors, all 40 routes compile correctly.
- ✅ **6-Stage Advanced RAG Pipeline** (`lib/ai/vector-rag.ts` full rewrite):
  - **Stage 1 — Multi-query Fan-out**: Generates 3 semantically diverse query variants (base / keyword-focus / criterion-expanded) so complementary corpus facets are covered.
  - **Stage 2 — HyDE** (Hypothetical Document Embeddings): Local template-based generation of a short "ideal thesis passage" for each criterion — embeds the hypothetical doc to bridge the query-document representation gap. Zero LLM cost.
  - **Stage 3 — Hybrid RRF Retrieval**: Runs all variants in parallel via Reciprocal Rank Fusion (k=60) over pgvector HNSW cosine (70%) + PostgreSQL FTS ts_rank (30%). Results merged and deduplicated by RRF score.
  - **Stage 4 — MMR Deduplication**: Maximal Marginal Relevance (λ=0.7) using Jaccard bigram overlap. Eliminates redundant passages that would waste context budget without adding information.
  - **Stage 5 — Criterion-Aware Reranking**: Heading/section alignment boosts + query-token overlap scoring tuned per thesis evaluation criterion (methodology, results, literature, goals, citations).
  - **Stage 6 — Contextual Compression**: TF-IDF sentence scoring trims each chunk to top-N most query-relevant sentences (~35% token reduction). Chunks < 400 chars passed through unchanged.
  - **High-level entrypoint**: `retrieveForCriterion(workspaceId, query, opts)` — used in thesis review generation and live search preview.
- ✅ **LRU Embedding Cache** (`lib/ai/local-embeddings.ts`): 512-entry in-process cache keyed by SHA-256(text) with oldest-insertion eviction. Eliminates redundant WASM inference for repeated criterion queries during multi-query fan-out. `getEmbeddingCacheStats()` exposed via rag-stats GET.
- ✅ **Reindex API Route** (`app/api/workspaces/[id]/thesis-review/reindex/route.ts`): `POST` re-runs vector chunking + embedding for all parsed IngestFiles. Rate-limited (1/2min per user). Adaptive chunk size (1800 chars Bc/MSc, 3000 chars PhD). Returns `{ indexed, skipped, results[] }`.
- ✅ **Reindex Button in RagIndexStatusPanel**: "Indexovať dokumenty" / "Preindexovať znova" button with spinner + sonner toast feedback. Auto-refreshes stats after completion.
- ✅ **pgvector integrated into Thesis Review Generation**: Review route now runs 6-stage `retrieveForCriterion` per criterion alongside disk-based `loadThesisContext`. Vector evidence prepended as `[Vector-Retrieved Evidence]` block, budget-aware truncation respects 60k char limit.
- ✅ **Embedding Cache Stats in rag-stats GET**: `embeddingCacheStats: { size, maxSize }` returned in `/thesis-review/rag-stats` GET response for diagnostics.
- ✅ **Production Build Verified (2026-08-30 PM)**: `pnpm run build` exits code 0, 42 routes, 0 TypeScript/ESLint errors.
- ✅ **Expert Peer Review & Thesis Assessment Workspace (Packages 1–6)**:
  - **Data Model & Contracts**: Created `ReviewKind`, `ReviewSeverity`, `FindingStatus`, `EvidenceReference`, `ReportingStandard`, `ReportingGuidelineCheck` in `lib/ai/review-types.ts` and Zod contracts in `lib/ai/contracts.ts`. Extended PostgreSQL `ThesisReview` table via Prisma schema.
  - **Server-Side Review Engine & RAG Grounding**: Implemented `generateProfessionalReview` with EQUATOR guideline prompts (CONSORT 2025, PRISMA 2020, STROBE, ML Reproducibility), prompt injection escaping, and verbatim evidence offset locator `anchorEvidenceQuotes` in `lib/ai/review-engine.ts`.
  - **Interactive Split-View & Triage Stream**: Built `ExpertReviewWorkspace`, `EvidenceViewer` (auto-scroll-to-quote, animated highlight pulse, selection-to-finding toolbar), and `FindingCard` (severity selector, triage status badges, inline edit, reviewer notes) in `components/thesis-review/`.
  - **Multi-Format Export Engine**: Implemented `generateThesisReviewDocx` in `lib/docx/generator-review.ts`, and 1-click plain text / markdown formatters in `lib/export/review-formatters.ts` for editorial submission platforms (ScholarOne / Editorial Manager).
  - **Full Test Suite & Production Build**: 45 test files, 298 tests passing (100% pass rate), 0 ESLint/TypeScript errors, and verified with Next.js production build.
- ✅ **Phase 5: Unified Collaboration, BibTeX Pipeline & E2E Automation**:
  - **Real-Time Yjs Thesis Reviews**: Synchronized `useThesisReviewStore` with `ydoc.getMap("thesisReviews")` in `use-yjs.tsx` for live multiplayer review editing, score recomputation, and rating overrides.
  - **1-Click BibTeX Import from Citation Audit**: Added `academicPaperToBibEntry` converter in `lib/bib-types.ts` and "+ Do .bib" direct import buttons in `CitationIssuesPanel` with visual checkmark indicators and workspace bibliography injection.
  - **Playwright E2E Test Suite**: Authored `tests/thesis-review.spec.ts` covering workspace initialization, metadata form validation, academic literature lookup, and 1-click BibTeX import.
  - **Prisma Schema Foreign Key Cascade Fix**: Added `onDelete: SetNull` to `Asset.assignedCard` in `prisma/schema.prisma` to prevent hard constraint errors when deleting cards/outputs with attached assets.
  - **Full Test Suite & Production Build**: 44 test files, 291 tests passing (100% pass rate) and Next.js production build cleanly verified.
- ✅ **Thesis Review Generation Module Hardened (Phases 1–4, Critical Findings 1–10)**:
  - **Phase 1 (RAG Grounding & Prompt Hardening)**: Replaced flat text slicing with scored section routing (`routeSectionsForCriterion`), Unicode heading normalization, multi-zone document sampling, character budgets (`THESIS_CONTEXT_BUDGETS`), strict source requirement guard (422 `THESIS_SOURCE_REQUIRED`), degree level profiles (`THESIS_LEVEL_PROFILES`), and post-generation contract validation (`validateGeneratedSections`).
  - **Phase 2 (Citation Verification & Academic Connector)**: Discriminated `AcademicLookupStatus`, bounded retries with jitter and `Retry-After` adherence in Semantic Scholar service, source-aware ISO 690 rules (books/theses without mandatory DOIs, web access dates), `inconsistent_metadata` detection, identifier prioritization (DOI -> arXiv -> Title search), and worker pool concurrency limiting (`concurrency = 3`).
  - **Phase 3 (LaTeX Preamble & Export Polish)**: Single-pass `escapeLatex` token replacement preventing curly-brace corruption, `\usepackage{needspace}`, `\usepackage{tabularx}`, `\usepackage{enumitem}`, localized running headers, and raw `.tex` source export (`?format=tex`).
  - **Phase 4 (UI/State Polish & Regeneration)**: IME composition guards (`!e.nativeEvent.isComposing`), error handling and state rollback on delete failure in Zustand store, dynamic score and recommendation recomputation on criterion edit, and responsive narrow-screen layout.
  - **Full Test Suite & Production Build**: 44 test files, 288 tests passing (100% pass rate) and Next.js production build cleanly verified.
- ✅ **Prompt Delimiter Escaping Completed** — Fully escaped untrusted content in all AI routes (`chat`, `review`, `shrink`, `autofix-compile`, `convert`, `generate`, `bib/lookup`) with `wrapUntrustedContext`, with regression unit tests in `lib/__tests__/ai-prompts.test.ts`.
- ✅ **Security Headers Implemented** — Edge-level security headers configured in `next.config.mjs` including `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and `Strict-Transport-Security`.
- ✅ **`.env.example` Synchronization** — Verified PostgreSQL `DATABASE_URL` and standardized `NEXT_PUBLIC_YJS_WS_URL=ws://localhost:3333/api/yjs`.
- ✅ **Yjs Auth Documentation Updated** — Corrected AGENTS.md documentation to reflect the short-lived one-time ticket mechanism via `Sec-WebSocket-Protocol`.
- ✅ **Real Ingestion Progress** — End-to-end SSE streaming pipeline from `/api/ingestion/parse` through `ingestion-slice.ts`, reflecting live stage progression and image batching without simulated intervals.
- ✅ **Parallel Ingestion Queue** — `JobQueue` supports concurrent job execution with `maxConcurrency = 3` for independent document uploads, backed by unit tests.
- ✅ **Job State Reconciliation on Reload** — `JobQueue.reconcileWithIngestFiles()` reconciles in-flight/interrupted job states against true database state loaded on workspace mount.
- ✅ **DB-Level Asset Deduplication** — Unique composite index `@@unique([workspaceId, filename])` in Prisma schema with atomic `prisma.asset.upsert()` in both ingestion parsing and workspace PUT routes.
- ✅ **Compiler Container Hardening** — Docker compile execution fortified with `--cap-drop=ALL`, `--user 1000:1000`, `--read-only`, `--tmpfs /tmp:rw,noexec,nosuid,size=64m`, and `--security-opt no-new-privileges`.

### Fixed in Previous Session (2026-08-29)
- ✅ **AI Feature Layer Audit (F1–F13)** — All 13 findings remediated:
  - Distributed `rateLimitAsync` adopted across all AI and ingestion endpoints.
  - Per-user rate limiting and auth ordering fixed in ingestion parser.
  - Conversion actions throttled with retry/backoff and citation sanitization.
  - AI prompt delimiters safely escaped with `wrapUntrustedContext`.
  - LaTeX validation guards added to UI apply buttons (Autofix & Shrink) and autofix compile route.
  - Unbounded history & input sizes bounded across chat and conversion routes.
  - Environment variables documented in `.env.example` and `AI_CONFIG` centralized.
  - Background AI snapshot labeler integrated into history snapshot creation.
  - Full test suite passing (26 files, 157 tests) and verified with production build.

### Fixed in Previous Session (2026-08-22)
- ✅ **BibTeX deduplication** — Extracted titles are now normalized and deduplicated to prevent duplicates from different PDFs.
- ✅ **PDF Previews in Figure Editor** — Figure editor natively renders `<object>` previews for `.pdf` assets and safely disables AI image operations for them.
- ✅ Added `tests/features.spec.ts` for regression testing BibTeX dedup and PDF previews.
- ✅ `AI_MODEL` now set in `.env.local`, model name no longer hardcoded
- ✅ Orphaned env vars (`NVIDIA_*`, `LLM_PROVIDER`, `ONYX_MCP_URL`) documented as legacy
- ✅ `ollama serve` removed from dev script
- ✅ `WorkspaceSelector` shows auth/load errors and handles missing workspaces
- ✅ "Switch Workspace" button added to TopBar
- ✅ "Create New Project" is now fully functional
- ✅ Rate limiter documented as in-memory
- ✅ `templateName` normalized to `"atlas"` | `"minimal"` in Prisma/Zod
- ✅ BibTeX extraction uses text model (`AI_MODEL`), not vision model
- ✅ Dead middleware public bypass removed
- ✅ `workspaces/` and `*.db` properly untracked from git and `.gitignore` updated
- ✅ `ignoreBuildErrors: true` removed from `next.config.mjs` — TypeScript errors fail builds
- ✅ FK relation Asset→Card verified as present in schema (`@relation(fields: [assignedCardId], references: [id], onDelete: SetNull)`)
- ✅ `execSync` in compile route was replaced with async `spawn`
- ✅ Dynamic Workspace selection UI replaced the hardcoded `prj_lattice` loading constraint


---

## General Agent Guidelines
- **E2E Testing:** Playwright is configured to run on port `3333`. Run `pnpm test:e2e` to verify full browser workflows. E2E tests leverage the `NEXT_PUBLIC_E2E_TEST=1` bypass in `proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`) to execute authenticated flows without requiring live external Clerk network tokens.
- **API Authentication:** All internal `/api/*` routes are protected by Clerk (`clerkMiddleware`). In production/dev mode, requests are verified via Clerk session tokens; for local automated E2E tests, the test environment flag bypasses the middleware gate.
