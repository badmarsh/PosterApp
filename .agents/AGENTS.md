# PosterApp Project Information

This file contains important context about the project infrastructure and dependencies for future agent sessions.

## Key Services
- **Next.js Frontend/API**: The main application. Runs on port 3333.
- **Ollama**: Local LLM service. Runs on the Windows Host at `http://127.0.0.1:11434`. Models include `minicpm-v` for vision tasks.
- **MinerU**: Document parsing service. Runs in a WSL (Ubuntu) environment. The source is located at `~/mineru`.

## Startup & Execution
- **Dev Server**: Run `pnpm run dev` to start everything concurrently.
- `start-mineru.bat`: Helper script that launches MinerU in WSL via `wsl -d Ubuntu -e bash -c "cd ~/mineru && source .venv/bin/activate && mineru-api --port 8001"`. MinerU API binds to port 8001.

## Directories
- `workspaces/`: Currently stores workspace data (project configurations, assets, and markdown) as JSON files. (Note: A migration to Prisma + SQLite is planned).
- `app/api/ingestion/parse/route.ts`: API route that delegates file ingestion to the local MinerU service.
- `tests/ingestion.spec.ts`: Playwright UI test for validating the end-to-end ingestion pipeline.

---

## Deep Codebase Analysis (2026-06-28)

### Critical Issues (P0)
1. **Hardcoded API keys in source** — `app/api/workspaces/[id]/cards/[cardId]/generate/route.ts:L89` and `app/api/workspaces/[id]/review/route.ts:L54` contain plaintext `Bearer sk-4c2ec...` key and hardcoded URL `http://localhost:8045`. Must move to `process.env`.
2. **`ignoreBuildErrors: true`** in `next.config.mjs:L4` — TypeScript checking disabled at build time.
3. **`.gitignore` gaps** — `.env`, `*.db`, `workspaces/` are NOT ignored. Line 15 has null-byte corruption.
4. **Zustand persist stores everything** — `editor-store.tsx` L629-633 partialize is a no-op. Transient fields (`generatingId`, `isSwitchingProject`, `parseLog`, `agentEvents`) persist and cause broken reload state.
5. **Save race condition** — `isDirty` cleared before save request completes in `editor-store.tsx`.
6. **Exposed API keys in `.env.local`** — OpenRouter and NVIDIA keys should be rotated.

### Architecture Issues
- **Store**: Monolithic 685-line Zustand store (`components/editor-store.tsx`) mixing 4 domains (Project, Ingestion, Bib, UI). 23 actions, 10 state fields. Module-level mutable counters. JS getters don't work with Immer drafts.
- **Selectors**: ALL 12 components call `useEditor()` without selectors → full store subscription → cascade re-renders.
- **Types**: 19 `any` occurrences. 5 JSON-as-string Prisma fields. No API response types. No Zod validation.
- **LaTeX**: `lib/latex.ts` (495 lines) bundles parsing, validation, height estimation, and generation. Entire template hardcoded (ATLAS colors, logos). `project.templateName` never read.
- **API**: Cards/assets have no standalone CRUD routes — managed via destructive workspace PUT (delete-all-then-recreate). 2 undocumented routes: `/api/ingestion/image-edit` and `/api/workspaces/[id]/cards/[cardId]/generate`.
- **Tests**: 0 unit tests, 1 E2E test (ingestion only). No test framework for units. `latex.ts` and `bib-parser.ts` untested.
- **Compile**: `execSync` blocks event loop up to 60s. No async compilation.
- **Workspace**: `page.tsx:L192` hardcodes `switchProject("tilecal-irid-2026")`. No dynamic workspace selection.
- **Dead code**: `e2e_test.js`, old Shadcn toast system, `MOCK_PROJECT`, dark mode CSS duplication, unused env vars (`POSTER_LATEX_ENGINE`, `WORKSPACE_DIR`).

### Package Info
- Next.js is actually **v15.3.3** (not v16 as previously documented).
- `concurrently` is in `dependencies` (should be `devDependencies`).
- `hono` override pinned to `4.12.25` with no explanation.
- Missing: Zod, react-hook-form, @dnd-kit, vitest.
