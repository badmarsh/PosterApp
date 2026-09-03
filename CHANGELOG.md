# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
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
