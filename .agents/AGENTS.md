# PosterApp Project Information

This file contains important context about the project infrastructure and dependencies for future agent sessions.

## Key Services
- **Next.js Frontend/API + Yjs WebSocket**: Single custom server (`server.ts`). Run via `tsx --env-file=.env.local server.ts`. Serves Next.js on port 3333 AND the Yjs WebSocket at `ws://localhost:3333/api/yjs` (authenticated via short-lived, one-time ticket passed via `Sec-WebSocket-Protocol: posterapp-yjs-v1, <ticket>` to avoid token leakage in URLs).
- **MinerU**: Document parsing service. Runs in a WSL (Ubuntu) environment at `http://localhost:8001`. Source at `~/mineru`.
- **PostgreSQL**: Database via Docker. Run with `docker run -d --name posterapp-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=posterapp -p 5432:5432 postgres:16-alpine`. Connection: `postgresql://postgres:postgres@localhost:5432/posterapp`.

## Startup & Execution
- **Dev Server**: Run `pnpm run dev` to start everything concurrently.
- `start-mineru.bat`: Launches MinerU in WSL via `wsl -d Ubuntu -e bash -c "cd ~/mineru && source .venv/bin/activate && mineru-api --port 8001"`. MinerU API binds to **port 8001**.
- **IMPORTANT**: `pnpm dev` now uses `tsx --env-file=.env.local server.ts` (NOT `next dev`) so both Next.js and the Yjs WebSocket run on the same port 3333.
- **PostgreSQL via Docker**: Must be running before starting the app. Start with: `docker start posterapp-postgres` (or the full run command above if first time).

## Key Directories & Files
- `workspaces/<id>/assets/` — extracted image files (figures, tables) served by `/api/workspaces/[id]/assets/[file]`
- `workspaces/<id>/sources/<fileId>.md` — parsed markdown from MinerU, used as RAG context for card generation and AI review
- `app/api/ingestion/parse/route.ts` — PDF ingestion: forwards to MinerU, runs parallel AI captions, extracts BibTeX, saves markdown
- `app/api/ingestion/image-edit/route.ts` — AI image editing via OpenRouter (`openai/gpt-image-1`)
- `app/api/workspaces/[id]/cards/[cardId]/generate/route.ts` — AI card auto-fill
- `app/api/workspaces/[id]/review/route.ts` — AI poster review
- `app/api/workspaces/[id]/history/route.ts` — GET list of snapshots, POST create snapshot with optional label
- `app/api/workspaces/[id]/history/[snapId]/route.ts` — GET snapshot, POST restore, PATCH label, DELETE
- `prisma/schema.prisma` — PostgreSQL DB schema via Prisma (switched from SQLite 2026-08-23)
- `server.ts` — Custom Next.js server that hosts both Next.js and the Yjs WebSocket
- `components/store/use-yjs.tsx` — Yjs hook (now online via `NEXT_PUBLIC_YJS_WS_URL`)
- `components/history-panel.tsx` — Save history drawer UI
- `tests/ingestion.spec.ts` — Playwright E2E test for ingestion

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
- **E2E Testing:** Playwright is configured to run on port `3333`. Run `pnpm test:e2e` to verify full browser workflows. E2E tests leverage the `NEXT_PUBLIC_E2E_TEST=1` bypass in `middleware.ts` to execute authenticated flows without requiring live external Clerk network tokens.
- **API Authentication:** All internal `/api/*` routes are protected by Clerk (`clerkMiddleware`). In production/dev mode, requests are verified via Clerk session tokens; for local automated E2E tests, the test environment flag bypasses the middleware gate.
