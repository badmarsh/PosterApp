# PosterApp Project Information

This file contains important context about the project infrastructure and dependencies for future agent sessions.

## Key Services
- **Next.js Frontend/API + Yjs WebSocket**: Single custom server (`server.ts`). Run via `tsx --env-file=.env.local server.ts`. Serves Next.js on port 3333 AND the Yjs WebSocket at `ws://localhost:3333/api/yjs` (authenticated via Clerk JWT query param `?token=`).
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

### Fixed in This Session (2026-08-22)
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
- **Always Verify the App is Running & Error-Free:** After making any code changes, you MUST verify that the PosterApp is reachable, running, and has no build/runtime errors. (e.g. check the dev server logs, use curl or browse the local endpoint if needed).
- **Mandatory UI / Browser Check before Finishing a Phase:** BEFORE you declare any feature, task, or phase complete (e.g. "I have finished 1/3"), you MUST explicitly check the application in the browser using Playwright or the Browser Subagent. You must ensure there are no hydration errors, console errors, or broken UI elements. Never assume the UI works just because the build passes.
- **E2E Testing:** Playwright is configured to run on port `3333`. Always run `npx playwright test` to verify there are no regressions after major features. If you are fixing a bug or adding a feature, document the behavior in a `.spec.ts` file under `tests/`. (Note: Tests are currently skipped due to Clerk Auth).
- **API Authentication:** All internal `/api/*` routes are protected by Clerk (`clerkMiddleware`). E2E API requests will fail with 401 unless a valid Clerk session token is provided, so tests hitting the API directly might need to be mocked or bypassed in the middleware.
