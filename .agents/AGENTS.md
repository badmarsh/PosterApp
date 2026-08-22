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
1. **BibTeX deduplication** — Same reference from two PDFs will appear twice in `bibContent`. (Dedups by cite key, but same ref might have different cite keys).
2. **AUTH_SECRET is a static bearer token** — not suitable for multi-user deployment.

### Fixed in This Session (2026-08-22)
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
