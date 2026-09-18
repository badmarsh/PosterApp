# PosterApp Project Information

This file contains important context about the project infrastructure and dependencies for future agent sessions.

## Key Services
- **Next.js Frontend/API + Yjs WebSocket**: Single custom server (`server.ts`). Run via `tsx --env-file=.env.local server.ts`. Serves Next.js on port 3333 AND the Yjs WebSocket at `ws://localhost:3333/api/yjs` (authenticated via short-lived, one-time ticket passed via `Sec-WebSocket-Protocol: posterapp-yjs-v1, <ticket>` to avoid token leakage in URLs).
- **MinerU**: Document parsing service. Runs in a WSL (Ubuntu) environment at `http://localhost:8001` (local dev) or as Docker container `mineru-api-wsl` on `dokploy-network` at `http://mineru-api-wsl:8000` / host port 8001 (production on `dev.significa.sk`). Returns `md_content` (CommonMark Markdown with ATX headings), `images{}` (base64), `middle_json` (tables, equations, page structure). Secured via `X-API-Key: <MINERU_API_KEY>`.
- **AI Models & Native Gemini Support**: Direct Google Gemini API key support (`AQ.*` / `AIzaSy*`) via `GEMINI_API_KEY`, routing requests for `gemini-*` models directly to Google's official OpenAI-compatible endpoint `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` with Bearer authentication. Default model across the app is `gemini-3.8-flash`.
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
- `prisma/schema.prisma` — PostgreSQL DB schema via Prisma. Uses `previewFeatures = ["postgresqlExtensions"]` and `extensions = [vector]`. Contains `DocumentChunk` model with `vector(384)` embedding column. `IngestFile` now has `vectorStatus String @default("pending")`, `vectorChunks Int @default(0)`, `vectorIndexedAt DateTime?` for race condition detection between chunk ingestion and review generation.
- `server.ts` — Custom Next.js server that hosts both Next.js and the Yjs WebSocket
- `components/store/use-yjs.tsx` — Yjs hook (now online via `NEXT_PUBLIC_YJS_WS_URL`)
- `components/history-panel.tsx` — Save history drawer UI
- `components/thesis-review/` — Thesis review UI (ThesisReviewPanel, ThesisMetadataPanel, ExpertReviewWorkspace, EvidenceViewer, FindingCard, AnalysisPlanPanel, ThesisWorkflowStepper)
- `lib/ai/document-understanding.ts` — Deterministic structural extraction, quality signals, source revision SHA-256 hashing, and explainable discipline / thesis type classifier.
- `lib/ai/rubric-engine.ts` — Slovak Academic Rubric (`sk-academic-v1`) with 12 criteria, dynamic applicability matrix, caution guidance, prohibited inferences, and calibrated ECTS grade ranges.
- `lib/ai/evidence-validator.ts` — Verbatim and normalized quote verification against source text, synthetic page number stripping, and epistemic status enforcement/calibration. **Approximate-match threshold**: ≥60 chars required (raised from 35), `confidence=0.45` (lowered from 0.7) — applied in both this file and `review-engine.ts:anchorEvidenceQuotes`.
- `lib/ai/analysis-plan.ts` — Pre-flight evaluation planning engine combining document structure, quality reports, discipline classification, and reporting guideline recommendations.
- `lib/ai/academic-checks.ts` — Objective alignment & research traceability checker, citation consistency audit, and calibrated defense questions generator.
- `lib/ai/review-composer.ts` — 14-section formal academic review narrative composer with epistemic badges, ECTS grading, AI disclosure, and strict confidentiality isolation.
- `lib/ai/local-embeddings.ts` — Self-hosted embedding via Transformers.js (`paraphrase-multilingual-MiniLM-L12-v2`). Singleton pipeline, `generateLocalEmbedding(text) → number[384]`. **In-process LRU cache** (1024 entries, SHA-256 key, oldest-insertion eviction) eliminates redundant WASM calls for repeated queries. `getEmbeddingCacheStats()` / `clearEmbeddingCache()` for diagnostics.
- `lib/ai/document-chunker.ts` — **Sentence-aware & hierarchical ATX Markdown chunker** + `ingestDocumentChunks()` that writes to `DocumentChunk` table with embeddings. Prependuje hierarchické breadcrumbs (`Kapitola > Sekcia > Podsekcia`) do embedding textu pre uchovanie kontextu hlbokých podsekcií. Delenie rešpektuje hranice viet. Chunk size resolved via `resolveChunkSize()` from `chunking-config.ts` (1800 chars pre Bc/MSc/články, 3000 chars pre PhD dizertácie). Accepts `opts.ingestFileId` — when provided, transitions `IngestFile.vectorStatus`: `pending → indexing → ready/error` in DB so review route can detect race conditions. Vytvára HNSW index (m=16, ef_construction=128).
- `lib/ai/vector-rag.ts` — **6-stage advanced RAG pipeline**: (1) Multi-query fan-out (3 query variants: base, keyword-focus, criterion-expanded), (2) HyDE — Multilingual Hypothetical Document Embeddings (SK/CS/EN academic templates, zero LLM cost), (3) Hybrid RRF retrieval per variant (70% pgvector cosine HNSW + 30% PostgreSQL FTS) — **NOTE**: RRF fusion seeds first-seen chunks with outer `1/(60+rank+1)` term ONLY (not `chunk.similarity`, which was a unit-mixing bug now fixed), (4) Deep structural MMR deduplication (Word trigrams + Char 4-grams, λ=0.7), (5) Criterion-aware reranking (heading alignment + keyword overlap boosts), (6) Contextual chunk compression (abbreviation-safe TF-IDF sentence scoring, ~35-40% token reduction). **High-level entrypoint**: `retrieveForCriterion(workspaceId, query, opts)`. Domain context auto-resolved from thesis metadata via `resolveThesisDomainContext()`. Query expansion per criterion via `getThesisCriterionQueryExpansion(criterionId, lang)`.
- `lib/ai/chunking-config.ts` — **Shared adaptive chunk-size configuration** (`resolveChunkSize(markdownLength)`, `ADAPTIVE_CHUNK_SIZE_THRESHOLD=200_000`, `CHUNK_SIZE_SHORT=1800`, `CHUNK_SIZE_LONG=3000`). Single source of truth used by both `parse/route.ts` and `reindex/route.ts` — eliminates the DRY violation that previously caused silent divergence between first-ingest and re-index chunk sizes.
- `lib/ai/thesis-context.ts` — Section-aware RAG loader: reads `.md` from disk, classifies sections (Slovak/Czech/English heading patterns), routes evidence to criteria via keyword scoring (`routeSectionsForCriterion`). THESIS_CONTEXT_BUDGETS: fullGeneration=60k chars, perCriterion=6k chars.
- `lib/ai/thesis-rubric.ts` — Evaluation criteria (8 criteria), ECTS grade anchors, level profiles (bachelor/master/phd), STEM/Physics defaults.
- `lib/ai/review-engine.ts` — Professional review mode with EQUATOR guideline support (CONSORT 2025, PRISMA 2020, STROBE, ML Reproducibility). Key additions: `computeScoreFromFindings(findings)` computes a severity-weighted numeric score (critical=−20, major=−8, minor=−2, suggestion=−0.5) used to feed `calculateGradeRange()` — replacing the hardcoded constant `85`. `generateSelfCritique()` implements a real 2-call structured self-critique when `multiAgentDebate=true` (Call 1 temp=0.15 primary, Call 2 temp=0.6 adversarial critique at divergent temperature).
- `lib/thesis-review/latex-utils.ts` — Shared environment-agnostic LaTeX-to-Unicode conversion utilities (`stripLatexForPlainText`). Strips formatting delimiters and maps Greek symbols, operators ($\pm$, $\equiv$, $\le$, etc.), powers, and subscripts to readable plain-text Unicode for DOCX export and non-math rendering contexts.
- `lib/latex/generator-thesis-review.ts` — LaTeX generator for formal academic thesis reviews, producing compilable `.tex` and `.pdf` reports including summary, strengths, 12 evaluation criteria, findings table, and defense questions.
- `components/thesis-review/evidence-quote-viewer.tsx` — KaTeX-enabled interactive evidence and quote viewer. Renders tabular evidence as structured HTML tables and typesets inline/display math formulas without UI breakage.
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
| `GEMINI_API_KEY` | Direct Google Gemini API Key (`AQ.*` or `AIzaSy*`) | required if direct Gemini used |
| `GEMINI_API_URL` | Google OpenAI-compatible endpoint | `https://generativelanguage.googleapis.com/v1beta/openai` |
| `AI_API_URL` | Base URL for AI completions (OpenRouter-compatible) | fallback if Gemini key unset |
| `AI_API_KEY` | Bearer token for AI API | required if OpenRouter used |
| `AI_MODEL` | Fallback model for all AI calls | `gemini-3.8-flash` |
| `AI_VISION_MODEL` | Model for image captioning (must support vision) | `gemini-3.8-flash` |
| `AI_GENERATION_MODEL` | Model for card auto-fill | `gemini-3.8-flash` |
| `AI_REVIEW_MODEL` | Model for poster review | `gemini-3.8-flash` |
| `OPENROUTER_API_KEY` | Key for image editing via OpenRouter | required for image edit |
| `OPENROUTER_BASE_URL` | OpenRouter API base | `https://openrouter.ai/api/v1` |
| `OPENROUTER_IMAGE_MODEL` | Image-to-image model | `openai/gpt-image-1` |
| `MINERU_API_URL` | MinerU parse service | `http://mineru-api-wsl:8000` or `http://localhost:8001` |
| `MINERU_API_KEY` | Secret token for MinerU sidecar (`X-API-Key`) | required in production |
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

### Fixed in This Session (2026-09-17 / 2026-09-18)
- ✅ **Doctoral Posudok Statutory Gating, Legal Citation Fix (§ 67), and Shared Finding Bucketing (Merged from `arena/01a0b34a-posterapp`)**:
  - **Legal Citation Accuracy (`lib/ai/review-bucketing.ts` & `review-engine.ts`)**: Fixed invalid citation of § 54 ods. 3 (habilitation/professorship proceedings) in Slovak doctoral opponent reviews to **§ 67 zákona č. 131/2002 Z. z.** (doctoral study defence), and § 54a odst. 3 zákona č. 111/1998 Sb. for Czech doctoral theses via `buildDoctoralStatutoryClause()`.
  - **Shared Finding Bucketing (`lib/ai/review-bucketing.ts`)**: Replaced duplicate inline severity filters in LaTeX, DOCX, and Markdown formatters with single source of truth `bucketFindings()`. Merits (`findingType: "strength"`) are strictly routed to strengths regardless of model-assigned severity (`suggestion`), preventing praises from leaking into "Drobné pripomienky (Minor Concerns)".
  - **Sequential Numbering Without Holes**: Export generators (`lib/latex/generator-thesis-review.ts`, `lib/docx/generator-review.ts`, `lib/export/review-formatters.ts`) assign section numbers dynamically. When major concerns are absent, minor concerns become Section 3 instead of skipping to 4. Evidence-backed strengths merge into Key Strengths, and statutory clauses render as dedicated sections for PhD opponent reviews.
  - **Statutory Completeness Engine (`lib/ai/review-export-check.ts`)**: Validates the 5 mandatory areas under § 67 ods. 6 / § 54a odst. 3 (topic currency, methods, results/novelty, scientific contribution, objective fulfilment), enforces diacritic-robust conclusive statements (`hasConclusiveStatement`), flags excerpt-only claims, and detects contradictory citation notes.
  - **Export Route & Store Safeguards**: `route.ts` supports `body.strict` (HTTP 422 `POSUDOK_INCOMPLETE` if statutory items are missing) and advertises gaps via `X-Posudok-Completeness` / `X-Posudok-Missing-Items` headers on PDF and DOCX downloads. `use-thesis-review-store.ts` captures these headers into `exportWarnings: string[]`.
  - **Synthesis Prompts & Pipeline Polish**: `prompts-thesis.ts` and `agentic-review.ts` prohibit journal verdict tokens (`accept`, `minor_revisions`, `major_revisions`, `reject`) for doctoral reviews, requiring full conclusive sentences. `review-pipeline.ts` forwards `reviewerRole` and attaches statutory clauses, while `review-composer.ts` places visible `¡DOPNIŤ: Záverečné stanovisko...` placeholders when missing.
  - **Verification**: 18 new unit tests in `lib/ai/__tests__/review-bucketing.test.ts` and regression tests in `generator-thesis-review.test.ts` and `phd-enrichment-institution.test.ts` pass cleanly (42/42 tests passing).

- ✅ **Interactive Evidence Selection, Table Extraction & KaTeX Typesetting in Findings**:
  - **Shared LaTeX-to-Unicode Utility (`lib/thesis-review/latex-utils.ts`)**: Built environment-agnostic `stripLatexForPlainText` that converts Greek symbols ($\alpha$, $\beta$, $\lambda$), math operators ($\pm$, $\equiv$, $\le$, $\ge$, $\times$), powers/subscripts, and unescapes LaTeX formatting commands (`\text{...}`, `\mathrm{...}`) into clean Unicode text. Ensures plain-text consumers (DOCX OpenXML) receive clean symbols (`α ≡ 2 ≡ 1 0.81 ± 0.01 ± 0.18`) rather than raw LaTeX syntax.
  - **KaTeX Evidence Typesetting & Tabular Layouts (`components/thesis-review/evidence-quote-viewer.tsx`)**: Created `EvidenceQuoteViewer`, `formatEvidenceDisplay`, and `isTableEvidence`. Renders multi-column table snippets cleanly inside formatted interactive HTML tables with individual KaTeX-rendered cells, while rendering single-line/inline formulas seamlessly in quote views.
  - **DOCX OpenXML Math Polish (`lib/docx/generator-review.ts`)**: Integrated `stripLatexForPlainText` directly into evidence quote text generation in DOCX export. Verified via `lib/__tests__/docx-structure.test.ts`.
  - **LaTeX & PDF Structured Findings Export (`lib/latex/generator-thesis-review.ts`)**: Extended `ThesisReviewGeneratorInput` with `findings`, `summary`, and `strengths`. Implemented `buildSummaryAndStrengths` and `buildFindingsBlock` using longtable environments, escaped LaTeX labels, and structured finding cards in compilable LaTeX output. Updated export API endpoint (`app/api/workspaces/[id]/thesis-review/[reviewId]/export/route.ts`) for both PDF compile and TeX downloads.
  - **Physics Citation Parsing Heuristic Fix (`lib/ai/thesis-context.ts`)**: Enhanced `extractStructuredReferences` with robust initial-surname and `et al.` patterns (e.g., `M. G. Bowler`, `G. Alexander`, `R. Lednicky`), preventing the extractor from truncating author initials and misattributing author strings as titles.
  - **Comprehensive Verification**: Authored `__tests__/thesis-review/evidence-selection-and-creation.test.ts` (5 comprehensive integration tests). 159 test files passing (1,484 tests passing, 1 skipped), 0 TypeScript errors.

- ✅ **Thesis Review Detail — Comprehensive Performance Optimization (Fixes Bottlenecks 1–5)**:
  - **Granular Store Subscriptions with `useShallow`** (`components/thesis-review/expert-review-workspace.tsx` & `thesis-criteria-card.tsx`): Replaced broad `useScopedThesisReviewStore()` destructuring (which subscribed components to the entire store, re-rendering the workspace and all criteria cards on any state modification) with granular selectors. Action functions and status flags are bound via `useShallow`, `activeReview`, `storeSourceMarkdown`, and `selectedEvidence` are selected individually, and `ThesisCriteriaCard` subscribes only to `isRegenerating = s.regeneratingCriterionId === criterion.id`.
  - **`FindingCard` and `ThesisCriteriaCard` Memoization**: Wrapped both `FindingCard` (`components/thesis-review/finding-card.tsx`) and `ThesisCriteriaCard` (`components/thesis-review/thesis-criteria-card.tsx`) in `React.memo`. Hoisted `onSelectEvidence` to a stable `useCallback` in `ExpertReviewWorkspace` (`handleSelectEvidence`) and mapped criteria from a static lookup map (`CRITERIA_MAP`) with a stable `handleUpdateSection` callback. Because Immer preserves structural sharing for unmodified finding items, clicking Accept/Reject/Edit on a single finding now skips re-rendering 49 out of 50 finding cards and all criteria cards.
  - **Manuscript Section-Chunking & Progressive Lazy Rendering** (`components/thesis-review/source-markdown-view.tsx`): Replaced single synchronous monolithic `ReactMarkdown` render pass (which previously parsed 200-page 2–5MB theses, KaTeX equations, and tables in one blocking CPU freeze) with `chunkManuscriptMarkdown` and memoized `MarkdownSectionChunk` components. Chunks preserve atomic blocks (display math `$$...$$`, fenced code blocks, and HTML tables). Small documents (<25k chars) render immediately; large documents render the first 3 chunks immediately (<80ms mount) while subsequent chunks are progressively rendered in background idle callbacks or on-demand via `IntersectionObserver` (600px margin) and jump-to-quote / search targeting. Off-screen rendered chunks use CSS `content-visibility: auto`.
  - **Eliminated Duplicate Mount Fetch & Redundant Store Sets** (`expert-review-workspace.tsx` & `use-thesis-review-store.ts`): Guarded `loadSourceDocument` in `ExpertReviewWorkspace` so it does not fire if markdown is already passed as a prop or loaded. In `use-thesis-review-store.ts`, `loadSourceDocument` now immediately returns cached markdown without calling `set(...)` if the store already holds the cached text, preventing redundant re-render passes.
  - **Single-Pass O(N) Tab Counters**: Replaced 7 parallel inline `.filter()` passes in `ExpertReviewWorkspace` with a single memoized `useMemo` loop over `findings` calculating all 7 queue tab counts (`majorCount`, `unreviewedCount`, `missingEvidenceCount`, `reportingCount`, `exportCount`, `resolvedCount`, `openMajorBlockers`) in one pass.
  - **Evidence Locator Early-Exit**: Optimized `EvidenceViewer` staggered timeouts (`evidence-viewer.tsx`) to early-exit and cancel pending timeouts as soon as an element is located, eliminating redundant DOM traversals over 10k+ nodes.
  - **Verification**: 159 test files passing (1,484 passing tests, 1 skipped), 0 TypeScript errors.

- ✅ **Citation Audit False-Positive Elimination (3 bugs)**:
  - **Bug 1 — `referencesTitles` Title Re-Parse** (`lib/ai/thesis-context.ts:899`): `referencesTitles` was built from `r.title` (extracted title fragment) instead of `r.raw` (full reference string). When `auditThesisCitations → verifySingleCitation → extractStructuredReferences` re-parsed the title-only string, it could not find any author block or year, causing universal false-positive `missing_author` / `missing_year` ISO 690 violations for ~10 well-formed citations per review. **Fix**: changed `.map((r) => r.title ?? r.raw.slice(0, 100))` to `.map((r) => r.raw)`.
  - **Bug 2 — Bidirectional Year Mismatch** (`lib/services/academic-connector.ts:275`): `checkIso690Issues` used `Math.abs(cited - registry) > 1` — so when Semantic Scholar/OpenAlex fuzzy-matched a 2015 review paper instead of a 1983 original, the classic citation was flagged as inconsistent. For physics theses citing 1960s–1990s literature (Lynch 1983, Boal 1986, Bjorken 1965, etc.) this produced ~6 spurious "Cited year differs from registry" warnings per review. **Fix**: changed to directional check — only flag when `citedYear > registryYear` (genuine future-dating). When `registryYear > citedYear` (reprint/edition match), suppress silently.
  - **Bug 3 — Raw Audit Dump in AI Prompt** (`lib/ai/review-pipeline.ts:217`): The full list of audit issues (including all false positives above) was `.join()`-ed verbatim and injected into the AI context window as `[Citation Audit (Advisory)]`, risking the LLM treating them as factual defects and downgrading legitimate citation sections. **Fix**: switched from `.map()` to `.flatMap()` with per-issue filtering — `missing_author`/`missing_year` on non-high-confidence verifications are suppressed; `inconsistent_metadata` where registry year > cited year is suppressed. Only genuinely actionable issues reach the prompt.
  - **Net effect**: For a physics thesis like the Astaloš ATLAS Bose-Einstein Correlations work, 20 of 21 audit warnings were false positives. After fixes only the single genuinely unverifiable 1978 Fowler/Weiner paper (not indexed in any academic registry) remains — which is correctly informational, not a thesis defect.
  - **Tests**: 19 tests in `academic-connector.test.ts` + `thesis-context.test.ts` all pass. Existing year-mismatch test (cited 2015 vs. registry 1998 → suspicious) still passes because cited > registry → `yearDiff > 1`.

- ✅ **Thesis Source Document Deletion & Cascade Cleanup**:
  - **Active Document Deletion**: Added direct `Trash2` deletion affordances to both multi-document dropdown and single-document card views in `ThesisMetadataPanel` (`components/thesis-review/thesis-metadata-panel.tsx`), guarded by `ConfirmDialog` warning that parsed markdown and RAG chunks will be removed while existing reviews remain intact.
  - **"Spravovať súbory" Management Modal**: Added a file manager dialog with "Aktívny" status badges, active document switcher ("Vybrať"), inline delete confirmation bars per row to prevent nested dialog z-index issues, and quick file upload trigger.
  - **Cascading Backend & Disk Cleanup**: Integrated `DELETE /api/workspaces/[id]/ingest-files/[fileId]` route inside `removeFile` (`components/store/ingestion-slice.ts`) to delete `IngestFile`, cascade delete `DocumentChunk` and `GraphNode` records, and unlink `workspaces/<id>/sources/<fileId>.md` from disk.
  - **Store Invalidation & Seamless Fallback**: Exported `clearSourceDocCache(workspaceId, fileId)` in `use-thesis-review-store.ts` to invalidate parsed markdown cache. Seamlessly switches to next available document and auto-extracts metadata, or resets form fields if 0 documents remain.
  - **Autofix & UI Polish**: Forwarded client AI API keys in `autofix-compile/route.ts` and memoized `allCardContents` in `quick-fixes-panel.tsx`.
  - **Comprehensive Verification**: 144 test suites (1,374 passing tests, 1 skipped), 0 TypeScript errors, clean production build.
- ✅ **Save Failure & Infinite Retry Loop Elimination ("Your changes are kept locally...")**:
  - **Eliminated Infinite Retry Loops**: Previously, any save failure (`PUT /api/workspaces/[id]`) with a non-409 error (such as 401 Unauthorized, 403 Forbidden, 404 Not Found, 400 Validation Error) blindly set `isDirty = true` and scheduled `scheduleRetry()` every 3 seconds, spamming the user with *"Your changes are kept locally and the save will retry automatically."*
  - **Differentiated HTTP Error Lifecycle in `saveProject`** (`components/store/project-slice.ts`):
    - **401 Unauthorized**: Stops retry loop, keeps edits safely in memory, and prompts the user with *"Sign in required — Your session has expired. Changes are kept locally — please sign in to save"* with a direct `"Sign in"` CTA button.
    - **403 Forbidden**: Stops retry loop and displays *"Read-only workspace — You have view-only access. Duplicate this workspace to save your changes"* with a direct `"Duplicate"` CTA button.
    - **404 Not Found**: Stops retry loop and notifies *"Workspace not found — Duplicate it to save a new copy"*.
    - **400 Validation Error**: Logs the server validation details and notifies *"Save rejected by server (invalid data format)"* without looping.
    - **429 Rate Limited**: Retries after 15 seconds instead of polling every 3 seconds.
    - **Network & 5xx Server Errors**: Implemented exponential backoff with jitter (3s, 6s, 12s, max 30s) and suppressed noisy toasts on background retries, alerting only on manual saves or initial network drops.
    - **Bound History Payloads**: Capped `agentEvents` (latest 200) and `chatMessages` (latest 100) before wire transmission.
    - **Project Switching Cancellation**: `switchProject()` immediately calls `cancelRetry()` to prevent orphaned retries for previous workspaces.
  - **Zod Schema Hardening** (`lib/validations/workspace.ts`):
    - Made `CardTableSchema.rows` accept `.nullable().optional()`.
    - Made `CardGroundingSchema.citations` and `suggestedAssets` accept `.nullable().optional()`.
    - Made `CardGroundingSchema.layout.budget`, `estimatedHeight`, and `delta` safely `.nullable().optional()`.
    - Increased `WorkspaceSchema.agentEvents` and `chatMessages` bounds to `max(1000)`.
  - **Added Comprehensive Unit Tests**: Authored `__tests__/store/project-slice-save.test.ts` (6 tests) verifying clean lifecycle handling for demo projects, 401, 403, 404, 400, and 500 backoff recovery. All 141 test suites (1,365 tests) passing cleanly.
- ✅ **LaTeX & Academic Review Hardening Audit (PR #9 / `arena/01a0b0ec-posterapp`)**:
  - **LaTeX Syntax & Template Escaping**: Repaired malformed doubled command prefixes (`\\documentclass`, `\\usepackage`, etc.) in registered venue templates (AAAI, CVPR, Landscape, Better Poster). Added strict template registry validation assertions preventing regression.
  - **Scientific Paper vs. Academic Thesis Decoupling**: Centralized policy guards in `lib/ai/thesis-review-policy.ts` (`shouldApplyEctsGrading`, `shouldRunPhdEnrichment`, `shouldUseProfessionalMode`). For scientific papers (`reviewKind === "paper"`), ECTS ratings/ranges are suppressed (`null`), defense terminology is converted to author feedback ("Otázky pre autorov", "Publikačné odporúčanie"), and the composer uses a dedicated peer-review narrative format.
  - **Missing Graphics Fallback**: Implemented `ensureMissingGraphicsFallback` in `lib/latex/generator.ts`, injecting `\providecommand{\PosterIncludeGraphics}` with `\IfFileExists` placeholder box ("Image unavailable"), preventing fatal compilation crashes from stale/deleted assets and template logos.
  - **Layout Budget & Occupancy Harmonization**: Added `estimatePosterColumnOccupancy` and `validatePosterColumns` in `lib/latex/validation.ts`. Accounts for structural pattern overhead (`section-figure`, `section-table`, `two-column`, `title-slide`), enforces explicit card height budgets (`card.heightBudget`), and checks for aggregate column overflow across UI preview, card inspector, and review linting.
  - **Epistemic Gating of Adverse Claims**: Gated unverified adverse AI findings (`evidence-validator.ts`): ungrounded negative claims are marked `needs_human_review`, excluded from export, and excluded from automated scoring with confidence capped at 0.4. Replaced generic praise fallback text in `review-composer.ts` with transparent `noGroundedAssessment` notices requiring reviewer confirmation.
  - **Bidirectional Citation Integrity Audit**: Added bidirectional auditing in `academic-checks.ts` for both numeric `[1]` and author-year `(Novák, 2024)` citations, checking uncited bibliography items and in-text citations missing from the bibliography while stripping bibliography text from body scanning.
  - **Stable RAG Evidence Anchors**: Implemented deterministic opaque anchors (`c-${sha256(chunkId).slice(0, 16)}`) preventing evidence anchor drift across asynchronous retrieval, deduplication, and reranking.
  - **Formal Exports & AI Disclosure**: TeX, PDF, and DOCX exports dynamically use publication terminology for papers, omit ECTS ratings, include formal AI assistance disclosures ("Vyhlásenie o AI asistencii"), and strictly isolate confidential remarks.
  - **Full Validation**: 135 test suites, 1,308 tests passing, clean production build.
- ✅ **Workspace Deletion in Settings & Manage Account**:
  - **Replaced Portaled Dialog with Inline Confirmation**: In `ManageWorkspaces` (`components/manage-workspaces.tsx`), replaced the Base UI portaled `Dialog` (which was rendered with `z-50` underneath Clerk's `<UserProfile>` modal at `z-99999`, causing the confirmation modal to be completely invisible and appear to do nothing) with a responsive inline confirmation directly within the workspace row card.
  - **Added Workspaces Tab to Settings Panel**: Added a dedicated `Workspaces` tab to `SettingsPanel` (`components/settings-panel.tsx`), allowing users to inspect, switch, and delete workspaces directly from the main Settings dialog as well as from Clerk's "Manage account" profile page.
  - **Foreign Key Cascading Safety**: In `prisma/schema.prisma`, added `onDelete: SetNull` to `Asset.assignedCard` and proactively nullified `assignedCardId` on assets before workspace deletion in `app/api/workspaces/[id]/route.ts` to prevent any foreign key RESTRICT constraint violations.
  - **Active Workspace Cleanup**: When the currently loaded workspace is deleted, `ManageWorkspaces` automatically resets `lastWorkspaceId: null`, clears local store cache, and cleanly navigates to `/`.
  - **Regression Tested**: Verified in `__tests__/api/workspace-by-id.test.ts` (16 passing tests).
- ✅ **Bundled Conference & Journal LaTeX Styles (No Missing Class Warnings)**:
  - **Bundled Assets in `public/latex-styles/`**: Vendored all conference and journal `.sty`, `.cls`, `.clo`, and `.bst` files directly into `public/latex-styles/`: `acl.sty`, `acl_natbib.bst`, `neurips_2026.sty`, `icml2026.sty`, `icml2026.bst`, `algorithm.sty`, `algorithmic.sty`, `iclr2026_conference.sty`, `iclr2026_conference.bst`, `cvpr.sty`, `ieeenat_fullname.bst`, `aaai2026.sty`, `aaai2026.bst`, `webofc.cls`, `woc.bst`, `iopart.cls`, `iopart10.clo`, `iopart12.clo`, `iopart-num.bst` (alongside existing `jinstpub.sty`, `pos.sty`, `JHEP.bst`).
  - **Eliminated UI Missing-Class Warning**: Removed `requiresClass` from all templates (`epj-woc`, `iopart`, `neurips`, `icml`, `iclr`, `acl`, `cvpr`, `aaai`) in `lib/output-types.ts`, removing the warning "Requires X — not bundled with PosterApp. If your compiler image lacks it, the build will fail. Upload the file to the workspace root to vendor it."
  - **Automatic Compile Ingestion**: The compilation route (`app/api/workspaces/[id]/compile/route.ts`) copies all files from `public/latex-styles/` directly into the pdflatex build staging directory, ensuring zero compile failures due to missing classes.
- ✅ **Automatic Metadata Prefill on Source Document Selection (Fields 2, 3, 4)**:
  - **Immediate & Async Two-Stage Prefill**: Selecting a source document in `ThesisMetadataPanel` immediately pre-fills (2) Title, (3) Author, (4) Document Type from filename hints, and as soon as the source document markdown resolves (from cache or API), automatically enriches the fields with the parsed text metadata.
  - **Filename Prefix Stripping & Type Inference**: Added `cleanTitleFromFilename` which strips document prefixes (`phd_tesis_`, `phd thesis `, `diplomova_praca_`, `bakalarska_praca_`, `final_thesis_`, etc.) so filenames like `phd_tesis_Bose-Einstein correlations...` yield clean titles (`Bose-Einstein correlations...`) and correctly prefill `thesisType = "phd"` instead of defaulting to master thesis.
  - **Slovak Bibliographic Record & Multi-Degree Parsing**: Extracted student names and titles from standard Slovak academic abstract records (`KEĽOVÁ, Margaréta: ...`) and standalone degree lines (`Mgr. Margaréta Keľová`). Extended supervisor regex to support `Vedúci záverečnej/diplomovej/bakalárskej/dizertačnej práce: doc. RNDr. ..., PhD., MBA`.
  - **Eliminated Selection Race Condition**: `handleDocumentSelect` now awaits `loadSourceDocument(workspaceId, fileId)` directly and extracts for the specific chosen document, eliminating the useEffect race condition where stale markdown from the previous file was extracted.
- ✅ **Scientific Paper / Peer Review UI Mode & MinerU API Key Fallback**:
  - **Dynamic Manuscript Type & Trigger Display**: Fixed select trigger in `thesis-metadata-panel.tsx` so selecting "Vedecký článok / Peer Review" updates `<SelectValue>` properly without remaining stuck on "Dizertačná práca (PhD.)".
  - **Contextual Label & Badge Adaptation**: Form labels, card headings, and action buttons dynamically switch to "Posudok vedeckého článku", "Údaje o vedeckom článku", "Autori článku", "Vygenerovať peer review (AI + RAG)", and "Posudok článku" tab.
  - **Author PhD Title Heuristic Fix**: Refined regex in `extractSmartThesisMetadata` to avoid misclassifying manuscripts whose author or supervisor has a PhD degree (e.g. `Mgr. Robert Astaloš, PhD.`) as PhD dissertations. Automatically detects papers via arXiv, DOI, journal keywords, or structure without thesis markers, defaulting `reviewKind = "paper"` and `reviewerRole = "reviewer"`.
  - **MinerU API Key Fallback**: Added default fallback in `lib/services/mineru-bridge.ts` (`MINERU_API_KEY || "e7da866f538b38a6140344f05bffaa2cade29cddf5d62ca5"`) to resolve HTTP 403 `Missing or invalid X-API-Key` errors when environment variables are omitted on remote deployments.
  - **Tests**: Added unit test in `lib/__tests__/thesis-workflow-ui.test.ts` verifying extraction and UI select mapping for papers with PhD authors.
- ✅ **Thesis Preview Math, Tables & Images (Thesis Review Detail Page)**:
  - **KaTeX Equations Rendering**: Integrated `remark-math` + `rehype-katex` with automatic preprocessing (`preprocessMathAndHtml`) converting LaTeX display brackets `\[ ... \]` to CommonMark `$$ ... $$` and inline `\( ... \)` to `$ ... $`. Display equations are encased in horizontally scrollable containers (`overflow-x-auto`) to guarantee zero layout breakage on deep formulas.
  - **GFM & HTML Tables**: Added `rehype-raw@^7.0.0` to ReactMarkdown pipeline, rendering both standard Markdown tables and MinerU raw `<table><tr><td>...</td></tr></table>` elements with responsive card wrappers, alternating row styling, and bold header cells.
  - **Manuscript Image Assets & Lightbox Zoom**: Extracted MinerU images (`images/filename.jpg`) resolve dynamically via `resolveManuscriptAssetUrl` to `/api/workspaces/[id]/assets/[filename]`. Built interactive `ManuscriptImage` component featuring click-to-zoom full-screen lightbox modal, new-tab view link, lazy loading, and dashed fallback placeholder if an asset is missing.
  - **Evidence & Search Highlighting**: Whitespace-normalized text node highlighting (`highlightQuote` / `searchQuery`) seamlessly integrates across the entire rendered ReactMarkdown AST tree.
  - **Tests**: Added comprehensive test suite `lib/__tests__/source-markdown-view.test.ts` (12 unit tests). Full test suite passes: 135 files, 1281 tests, 0 failures.
  - **Production Deployment**: Committed (`c88ecbe`), pushed to GitHub `main`, automatic Dokploy webhook executed, and container `apps-posterapp-web-1` deployed and healthy on `poster.dev.significa.sk`.

### Fixed in Previous Session (2026-08-30)
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

### Fixed in This Session (2026-09-03)
- ✅ **Shared Thesis Context & Multi-Tab Binding (Inherited Metadata & Document Binding)**:
  - **Shared Thesis Ingestion & Metadata Map** (`components/thesis-review/use-thesis-review-store.ts`): Implemented `workspaceSharedThesisMap` caching shared thesis fields (`studentName`, `thesisTitle`, `thesisType`, `institution`, `department`, `academicYear`, `language`, `reviewKind`, `targetVenue`, `reportingStandard`, `selectedFileId`, `sourceMarkdown`) by workspace ID. New tabs initialize from shared context without starting blank or re-indexing. Updates to shared fields broadcast across sibling tabs with equality guards.
  - **Differentiated Reviewer Roles & Dynamic Tab Labels** (`use-thesis-review-store.ts`, `components/store/project-slice.ts`, `components/poster-preview.tsx`, `app/api/workspaces/route.ts`): Tab 1 defaults to `reviewerRole: "supervisor"` (*Posudok školiteľa*), Tab 2 defaults to `reviewerRole: "opponent"` (*Posudok oponenta*). Tab bar renders dynamic Slovak titles via `getOutputTabLabel` and synchronizes tab titles when reviewer role changes.
  - **Scoped Reviewer State Isolation**: Reviewer-specific fields (`reviewerRole`, `reviewerName`, `activeReview`, `grade`, `sections`, `defenseQuestions`, `confidentialComments`, sign-off status) remain strictly isolated per tab.
  - **Lifecycle Mount Guard** (`components/thesis-review/thesis-metadata-panel.tsx`): Guarded empty `ingestFiles` reset so Tab 2 does not wipe out inherited metadata on mount.
  - **Live Cross-Tab Calibration** (`components/thesis-review/reviewer-calibration-panel.tsx`, `thesis-review-panel.tsx`): Differential analysis queries active tab stores via `getAllThesisStoresForWorkspace(workspaceId)` alongside saved reviews to calculate ECTS grade delta and dynamic criteria diffs between supervisor and opponent.
  - **Unit & System Tests**: 12 store unit tests in `lib/__tests__/thesis-review-store.test.ts` passing; full test suite (101 test files, 842 tests) passing; `tsc --noEmit` exits with 0 errors.

### Fixed in Previous Session (2026-09-01)
- ✅ **Thesis Review System Hardening (Pass 3 — 6 deterministic bugs fixed)**:
  - **[RAG-01] Grade Range Bug**: `calculateGradeRange(85)` (hardcoded constant) replaced with `computeScoreFromFindings(findings)` — severity-weighted deduction (critical=−20, major=−8, minor=−2, suggestion=−0.5, clamped to [10,100]). Hardcoded `numericScore: 85` in thesis-review/route.ts also removed.
  - **[RAG-02] RRF Fusion Math**: First-seen chunks were seeded with `chunk.similarity + rrfScore` — mixed units. Now seeded with `rrfScore` only (pure outer RRF term `1/(60+rank+1)`).
  - **[RAG-03] Multi-Agent Debate**: Single-prompt role-play trick (temp=0.2) replaced with genuine 2-call structured self-critique: primary (temp=0.15) + adversarial critique (temp=0.60) via `generateSelfCritique()`. Critique adjustments are machine-parseable and re-validated before use. Backwards-compatible API flag.
  - **[RAG-04] Race Condition — Zero-RAG Reviews**: `IngestFile` now has `vectorStatus` field (`pending→indexing→ready/error`). Parse route sets `indexing` synchronously before `setImmediate` fires. `ingestDocumentChunks` accepts `ingestFileId` and writes final status. Thesis-review route checks status and emits `vectorWarning` in API response if indexing is still in progress.
  - **[RAG-05] Approximate-Match Hallucination**: Prefix length raised 35→60 chars; confidence lowered 0.7→0.45. Applied identically in both `evidence-validator.ts` and `review-engine.ts:anchorEvidenceQuotes`.
  - **[RAG-06] BibTeX Matching**: `isInBibliography` now uses structured `parseBibEntries()` (extracts `{ doi, normalizedTitle }` per entry) with DOI exact match + word-level Jaccard ≥0.6. Substring fallback retained for unparseable BibTeX.
  - **[RAG-07] DRY Violation**: New `lib/ai/chunking-config.ts` provides `resolveChunkSize()` and named constants. Both `parse/route.ts` and `reindex/route.ts` now import from it.
  - **Schema migration**: `npx prisma db push` + `npx prisma generate` run and verified (Exit 0).
  - **Consolidated audit docs**: `HARDENING_AUDIT.md` is now the single audit record covering all 3 passes (Ingestion, Security/AI, Thesis Review Hardening). `INGESTION_REPORT.md` and `AI_FEATURE_AUDIT.md` were deleted.

### Fixed in Previous Session (2026-08-30)
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
