# PosterApp Project Information

This file contains important context about the project infrastructure and dependencies for future agent sessions.

## Key Services
- **Next.js Frontend/API**: The main application. Runs on port 3333.
- **MinerU**: Document parsing service. Runs in a WSL (Ubuntu) environment at `http://localhost:8001`. Source at `~/mineru`.
- **Ollama**: Local LLM (legacy, not currently wired to any route — env vars `OLLAMA_API_URL` / `OLLAMA_VISION_MODEL` were removed from parse route). Runs on the Windows Host at `http://127.0.0.1:11434`.

## Startup & Execution
- **Dev Server**: Run `pnpm run dev` to start everything concurrently.
- `start-mineru.bat`: Launches MinerU in WSL via `wsl -d Ubuntu -e bash -c "cd ~/mineru && source .venv/bin/activate && mineru-api --port 8001"`. MinerU API binds to **port 8001**.

## Key Directories & Files
- `workspaces/<id>/assets/` — extracted image files (figures, tables) served by `/api/workspaces/[id]/assets/[file]`
- `workspaces/<id>/sources/<fileId>.md` — parsed markdown from MinerU, used as RAG context for card generation and AI review
- `app/api/ingestion/parse/route.ts` — PDF ingestion: forwards to MinerU, runs parallel AI captions, extracts BibTeX, saves markdown
- `app/api/ingestion/image-edit/route.ts` — AI image editing via OpenRouter (`openai/gpt-image-1`)
- `app/api/workspaces/[id]/cards/[cardId]/generate/route.ts` — AI card auto-fill
- `app/api/workspaces/[id]/review/route.ts` — AI poster review
- `prisma/schema.prisma` — SQLite DB schema via Prisma
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
| `DATABASE_URL` | SQLite path | `file:./dev.db` |

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

**Key behaviour:** `fileCache` (module-level Map) stores the original `File` objects for retry. Lost on page refresh — retry fails if user reloads.

### AI Card Generation
```
autoFillCardAction(id) → POST /api/workspaces/<id>/cards/<cardId>/generate
  → load sources/*.md from disk (capped at 80k chars)
  → format available assets list
  → AI call (60s timeout) → { title, bullets, assignedAssets }
  → update card content + figures in store
  → trigger generateCardAction (local LaTeX gen)
```

`autoFillAllCardsAction` runs all empty cards in **parallel** via `Promise.allSettled`.

### AI Poster Review
```
aiReview() → POST /api/workspaces/<id>/review
  → buildLintReport() (deterministic: missing cites, layout overflows, empty cards)
  → load sources/*.md from disk (capped at 60k chars) — actual grounding corpus
  → AI call (90s timeout, temperature=0.1) → { tips: [{severity, category, message}] }
  → push as AgentEvent
```

### LaTeX Generation
`lib/latex/generator.ts` builds full tikzposter `.tex`. Supports two themes:
- `"atlas"` — CERN ATLAS colors (`#9e2b2f`), hardcoded logo paths `logos/atlas_transparent.png` + `logos/uk_logo.png`
- `"minimal"` — blue `#2B4B9E`

Both use `a0paper, portrait, 3-column` layout. Asset URLs rewritten from `/api/workspaces/<id>/assets/<file>` → `assets/<file>` for LaTeX `\includegraphics`.

### Database (Prisma + SQLite)
Schema at `prisma/schema.prisma`. Key notes:
- `Card.figures`, `Card.table`, `Card.sourceIds` — stored as JSON strings (`String?`), parsed/stringified in route
- `Asset.assignedCardId` / `Asset.assignedSlot` — stored but no FK `@relation` (no cascade delete)
- `IngestFile.dismissed` — boolean, persisted to DB so dismissed notifications survive page reload
- Run `npx prisma db push` after schema changes, then `npx prisma generate` (stop server first to release DLL lock)

---

## Known Remaining Issues

### Still Open
1. **`ignoreBuildErrors: true`** in `next.config.mjs` — TypeScript errors silently ignored at build time.
2. **`.gitignore` gaps** — `workspaces/` and `*.db` are not ignored. Sensitive data could be committed.
3. **`fileCache` lost on refresh** — Retry file after page reload shows "File no longer available". Fix: persist File to IndexedDB during upload.
4. **No FK relation for Asset→Card** — `Asset.assignedCardId` has no `@relation`. Deleting a card leaves orphaned asset records.
5. **BibTeX deduplication** — Same reference from two PDFs will appear twice in `bibContent`.
6. **Workspace hardcoded** — `page.tsx` hardcodes `switchProject("tilecal-irid-2026")`. No dynamic workspace selection UI.
7. **`execSync` in compile route** — Blocks event loop up to 60s during LaTeX compilation. Should use `child_process.spawn` with async.

### Fixed in This Session (2026-06-28)
- ✅ AI Review grounding: now loads `sources/*.md` from disk instead of always-empty text assets
- ✅ `JSON.parse` try/catch on all AI responses + markdown fence stripping
- ✅ `choices[0]` null-check on all AI responses
- ✅ Image edit model: `openai/gpt-image-1` (was invalid `openai/gpt-5.4-image-2`)
- ✅ Caption generation: parallel `Promise.all` (was sequential `for...of await`)
- ✅ Token budget cap: 80k chars on card generation, 60k on review
- ✅ Bulk auto-fill: parallel `Promise.allSettled` (was serial)
- ✅ Timeouts: MinerU 5min, image-edit 2min, generate 60s, review 90s
- ✅ Model names: all read from env vars with `gemini-3-flash` fallback
- ✅ Dead OLLAMA env vars removed from parse route
- ✅ `dismissed` flag on `IngestFile`: added to Prisma schema + Zod schema + saved to DB
- ✅ `saveProject` background toasts removed (silent auto-save)
- ✅ Legacy "Other Assets" orphaned 107 assets wiped from DB
- ✅ Asset re-ingestion: updates `fileId` of existing assets instead of skipping them
