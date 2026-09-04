# PosterApp × DeerFlow Integration — Megaprompt (Phase 0 + Phase 1)

Working directory: `/home/user/PosterApp`
Branch: `arena/01a06a87-posterapp`
Baseline commit: `2f4cf293e7853cbff25e47046bce2d5b712a5d48` (2026-09-04)
Companion doc (read FIRST, it is the source of truth for why): `docs/internal/POSTERAPP_DEERFLOW_INTEGRATION_ANALYSIS.md`
Date: 2026-09-04

---

# Mission

Implement **Phase 0 (plumbing spike)** and **Phase 1 (Deep Research Copilot MVP)** of the PosterApp × DeerFlow integration. DeerFlow is an optional, off-by-default **sidecar** (Gateway mode, Docker Compose) that PosterApp talks to **server-side only** over HTTP/SSE. The agent's output is always an **untrusted, Zod-validated proposal**; the human confirms before anything touches workspace state. No workspace mutation, LaTeX compilation, or database write may ever happen from inside the DeerFlow sandbox.

Do NOT re-implement DeerFlow. Do NOT replace the existing single-shot AI paths (`lib/ai/client.ts` based). Add a new tier beside them.

---

# Mandatory reading (read all before writing code)

| File | Why |
|---|---|
| `docs/internal/POSTERAPP_DEERFLOW_INTEGRATION_ANALYSIS.md` | Decision context, topology, contracts, budgets |
| `lib/ai/client.ts` + `lib/ai/models.ts` | Existing provider/cost/timeout conventions to mirror |
| `lib/ai/contracts.ts` | Zod preprocess/lenient-parse style to imitate |
| `app/api/workspaces/[id]/chat/route.ts` | Auth + rate-limit + body-cap + validation template |
| `app/api/workspaces/[id]/cards/[cardId]/route.ts` + `lib/validations/workspace.ts` | Revision gating, card schema, how to create cards safely |
| `lib/security.ts` (`safeApiError`, `readJsonBodyCapped`) + `lib/rate-limit.ts` (`rateLimitAsync`) | Required guardrails on every new route |
| `lib/ai/cost-ledger.ts` + `lib/ai/telemetry.ts` | Budget/usage integration points |
| `lib/poster-types.ts` (`AgentEvent`) + `components/agent-panel.tsx` | UI event feed + chat adapter to extend |
| `lib/workflow/step-registry.ts` | Config-driven step conventions (Phase 1 UI preset) |
| `lib/safe-fetch.ts` | SSRF-safe fetch (do NOT use raw `fetch` for the bridge URL) |
| `prisma/schema.prisma` + one recent migration | Migration naming/style |
| `docker-compose.yml`, `Dockerfile`, `.env.example`, `README.md` | Deployment surface to extend |
| `__tests__/` + `vitest.config.ts` + `playwright.config.ts` | Test conventions |

---

# Hard rules (non-negotiable)

1. Every new route: zod body validation → `rateLimitAsync` → `requireWorkspaceEditor` → `readJsonBodyCapped` → try/catch with `safeApiError`. No `String(err)` leaks (raw `detail` only when `NODE_ENV === "development"`).
2. No new npm dependencies without a written justification in the PR. The DeerFlow bridge must be plain `fetch` + a hand-rolled SSE parser (Node `ReadableStream`) — no `eventsource`, no OpenAI SDK, no LangChain.
3. New files: `lib/deerflow/*` (server-only), routes under `app/api/workspaces/[id]/deerflow/*`, UI under `components/deerflow/*` (or a sub-tab already in `agent-panel.tsx`).
4. No `: any` in `app/api/**`. Type contracts are inferred from Zod.
5. Never pass `DATABASE_URL`, `CLERK_SECRET_KEY`, `AI_API_KEY`, or any workspace absolute path to DeerFlow (neither in run input nor in env of its Docker Compose service).
6. All DeerFlow-produced strings are **untrusted**: render escaped, no `dangerouslySetInnerHTML`, wrap with existing untrusted-context helpers where they enter prompts.
7. Workspace mutation happens ONLY through existing routes (revision-gated) and ONLY after explicit user confirmation; the proposal must be previewed as a diff before "Apply".
8. Tests must run without a live DeerFlow (mock the gateway in-process / fake server fixture). Optional E2E gated by `DEERFLOW_E2E=1` (mirror `LATEX_AVAILABLE` pattern).
9. Update `.env.example`, `README.md`, and `CHANGELOG.md` (new `[Unreleased]` section) with every new env var/route.

---

# Scope — IN (Phase 0)

## T0.1 Docker Compose sidecar (disabled by default)
- Add `deerflow` service to `docker-compose.yml` behind a `deerflow` **profile** (`docker compose --profile deerflow up`), pinned image/commit with a comment "pin review required", healthcheck, gateway mode on an internal port (map to `127.0.0.1:2026`; **not** published to `0.0.0.0`).
- `.env.example`: `DEERFLOW_ENABLED=0`, `DEERFLOW_URL=http://127.0.0.1:2026`, `DEERFLOW_SERVICE_TOKEN=`, `DEERFLOW_DAILY_BUDGET_USD=3.00`, `DEERFLOW_RUN_TIMEOUT_MS=900000`, `DEERFLOW_MAX_RECURSION_LIMIT=100`, `DEERFLOW_RUNS_PER_HOUR=3`.
- README: "Optional DeerFlow integration" section — how to enable, what it is used for, security notes.

## T0.2 Bridge client (`lib/deerflow/client.ts`)
- `type DeerflowConfig` resolved from env; `isDeerflowEnabled()`.
- `createThread(workspaceMeta)` → `POST /api/langgraph/threads` via `safeFetch`-like host validation; returns `thread_id`.
- `startStreamingRun(threadId, payload)` → `POST /api/langgraph/threads/{id}/runs/stream` with `Accept: text/event-stream`; **SSE parser** that yields typed events: `values`, `messages-tuple` (message deltas), `custom` (agent events), `error`, `done`. Must handle `data:` frames, multi-line, comments, and buffered chunk splitting; max event size cap.
- `cancelRun(threadId)`, `deleteThread(threadId)` (`DELETE /api/threads/{id}`).
- Error taxonomy: `DeerflowUnavailableError` (503 → UI "agent service offline"), `DeerflowAuthError` (502), `DeerflowTimeoutError` (504 w/ retryable flag), `DeerflowBudgetExceededError` (429) — all mapped via `safeApiError` shapes.
- **Tests** (`lib/deerflow/__tests__/`): SSE parser (chunk-split frames, multi-line, big frame cap), error mapping, timeout enforcement, host validation rejects non-`DEERFLOW_URL` hosts.

## T0.3 Fake gateway fixture
- `tests/fixtures/deerflow-gateway.mjs` (or `vitest` fetch mock helper): serves `/api/langgraph/threads`, `/runs/stream` with scripted SSE sequences, `/api/models`, `DELETE /api/threads/{id}`. Used by unit/integration tests; never shipped in production.

## T0.4 Cost & budget gate (`lib/deerflow/budget.ts`)
- Reuse `cost-ledger` primitives: estimate from a plan event (tokens if surfaced, else duration heuristic), `checkAiBudget`-style per-workspace daily cap using `DEERFLOW_DAILY_BUDGET_USD`, pre-flight `POST …/estimate` returns `{ estimatedUsd, estimatedMinutes, willExceed }` and the UI **requires confirmation** when `estimatedMinutes > 2` or `estimatedUsd > 0.25`.
- Kill switch: `DEERFLOW_ENABLED=0` → route returns 503 `DEERFLOW_DISABLED`; per-workspace settings flag `deerflowEnabled` (default on) in the existing settings store.

# Scope — IN (Phase 1)

## T1.1 Data model (migration `20260905000000_deerflow`)
- Add `DeerflowThread` (see analysis §3.3): `id`, `workspaceId`, `userId`, `deerThreadId @unique`, `status`, `kind`, `proposal Json?`, `costEstimateUsd Float?`, `startedAt?`, `finishedAt?`, `createdAt`, `updatedAt`, indexes on `(workspaceId, status)`, FK cascade delete on workspace delete. Housekeeping: hard-delete orphan threads on workspace delete; add a "cancel stale runs" note in the existing job-queue (no new queue unless trivial).

## T1.2 Routes (`app/api/workspaces/[id]/deerflow/`)
- `POST …/threads` — create/get-or-create thread for workspace, returns `{ deerThreadId, status }` (server stores mapping).
- `POST …/runs` — start a run for kind `poster_research` (Phase 1 only): validates body (zod: `kind` enum, `language` enum `sk|cs|en`, `focus` string ≤ 2000, `includeAssets: boolean` default true, `maxMinutes` 1–30), budget gate, `rateLimitAsync(userId:deerflow:run, 3/h)`, 202 + `{ runId/deerThreadId }`.
- `GET …/runs/[runId]/stream` — **SSE passthrough route** re-emitting bridge events (`text/event-stream`, `X-Accel-Buffering: no`, flush headers; heartbeat every 15 s); terminates with a final `proposal` event or `error` event. Must be registered so Clerk proxy doesn't interfere (routes already behind auth).
- `GET …/runs/[runId]` — status + proposal (fallback for reconnects; SSE is best-effort, state always readable here).
- `POST …/runs/[runId]/apply` — **the ONLY mutation path**: takes validated proposal, renders preview diff server-side, then:
  - creates **draft cards** via existing card creation route/schema (revision-gated, one transaction, `kind: draft` if field exists — otherwise reuse existing card shape and note the limitation),
  - registers `sources`/citations via existing `bib` route (dedupe by DOI),
  - never deletes/overwrites existing cards; returns `{ appliedCardIds, skippedDuplicates }`.
- `DELETE …/threads/[threadId]` — cancel + delete DeerFlow thread + mapping (owner only).

## T1.3 Contracts (`lib/deerflow/contracts.ts`)
- `PosterResearchProposalSchema` (zod, lenient preprocess like `lib/ai/contracts.ts`):
  `{ version: literal("poster-research-v1"), summary: string ≤4000, sources: SourceRef[] ≤40, citations: BibEntry[] ≤40, sectionDrafts: { title ≤160, bullets: string[] ≤8 each ≤600, suggestedAssetIds: string[] ≤3 (must exist in workspace — server-filtered) }[] ≤8, openQuestions: string[] ≤10, meta: { estimatedUsd?, elapsedSeconds? } }`.
- `SourceRef`: `{ doi?, url?, title, authors?, year?, venue?, retrievedFrom: "crossref"|"openalex"|"semantic_scholar"|"arxiv"|"web", confidence: 0..1 }` — `confidence < 0.5` sources are flagged, never auto-glued into the bib.
- **Server-side normalizer** `normalizeProposal(raw)` → strips unknown fields, enforces caps, validates asset ids against the workspace, marks out-of-order/duplicate citations. Everything else in the proposal is rejected, not silently dropped (log + count).

## T1.4 UI (`components/deerflow/deerflow-panel.tsx` + agent-panel integration)
- New "Deep research" tab/section in the agent panel (keep chat tab untouched).
- Controls: focus textarea, language select, depth (fast/standard/deep → maps to `maxMinutes` 5/15/30), estimated cost/time line, **"Confirm & start"** when estimate exceeds thresholds.
- Live status: reuse `AgentEvent` feed shape (progress %, current phase `planning | researching | synthesizing | writing`, stage log, cost ticker).
- Result: proposal drawer with evidence list (source links), citation list (checkboxes to include), section drafts (editable before apply), diff-style "cards to create" preview.
- "Apply to workspace" button → posts `/apply`, shows success + link to cards; "Discard" cleans thread mapping.
- Errors: offline state ("DeerFlow service offline — enable via docker compose --profile deerflow"), budget exceeded, rate-limited (retry-after).

## T1.5 Integration & context
- Context payload builder `lib/deerflow/context.ts`: workspace summary from existing `loadSourceContext` / `thesis-context` builders (bounded to ~40k chars — mirror chat route), document inventory (titles + first heading level), current card titles, language of workspace. **No base64 PDFs, no full sources.**
- Prompt document for the run (`prompts-deerflow.ts`): instructs agent to return **only** the strict JSON contract, cite every claim (SourceRef), prefer DOI-verified sources, honor `language`, never invent statistics, `REQUIRES_HUMAN_VERIFICATION` marker for unsupported claims.

# Scope — OUT (explicitly not this pass)

- Phase 2 (autonomous compile/fix loop), Phase 3 (review panel, skills), Phase 4 (memory, IM channels) — design only, leave TODO notes in this doc.
- Replacing `lib/ai/client.ts` or the `chat` route.
- Any DeerFlow-side customization (custom agents, skills installs) — we consume `lead_agent` only.
- Production orchestration (K8s provisioner, Redis for multi-worker SSE) — note in README as future work.
- Frontend routing of `NEXT_PUBLIC_*` DeerFlow URLs (browser never talks to DeerFlow directly).

---

# Acceptance matrix

| ID | Check | How to verify |
|---|---|---|
| A0.1 | `docker compose --profile deerflow up` starts only when profile given; `docker compose up` (no profile) does NOT start DeerFlow | run both, inspect `docker compose ps` |
| A0.2 | Bridge offline → `POST …/runs` returns 503 `DEERFLOW_DISABLED`/`UNAVAILABLE` JSON (no stack trace) | unit test + manual with service stopped |
| A0.3 | SSE parser: 50 random chunk boundaries on a 300-event fixture → identical event sequence; >512 KB event rejected | vitest `lib/deerflow/__tests__/sse.test.ts` |
| A0.4 | Budget gate: workspace at `$3.00` → start returns 429 with `retryAfterMs`; pre-flight `estimate` refuses `maxMinutes > 30` | vitest budget tests |
| A1.1 | Migration applies on fresh PG (`pnpm prisma migrate dev`) and `DeerflowThread` row created on `POST …/threads`; deleting workspace cascades | integration test + manual |
| A1.2 | Fake-gateway run: UI shows progress events, final drawer renders proposal; running `pnpm test` requires no external network | vitest + `pnpm test` in fresh env |
| A1.3 | `/apply` with unknown `suggestedAssetIds` → those entries rejected; proposal with extra unknown keys → normalized with logged warnings, not applied | unit tests for `normalizeProposal` |
| A1.4 | `/apply` creates cards through the SAME revision-gated path as manual card creation (workspace revision bumps; stale `?revision=` → 409) | `__tests__/api/deerflow-apply.test.ts` |
| A1.5 | No new dep in `package.json`; `pnpm lint` + `pnpm typecheck` + `pnpm test -- --run` + `pnpm build` green | run the four commands |
| A1.6 | `.env.example` documents every new var; README has the integration section; CHANGELOG `[Unreleased]` has a DeerFlow entry | grep + manual |
| A1.7 | E2E optional suite gated on `DEERFLOW_E2E=1` and skipped in CI by default | `playwright.config.ts` pattern check |

---

# Deliverables & DoD

- Commits on `arena/01a06a87-posterapp` only, conventional messages (`feat(deerflow): …`, `test(deerflow): …`).
- Final `git status` clean; `pnpm lint`, `pnpm typecheck`, `pnpm test -- --run`, `pnpm build` all pass (report exact outputs in the summary).
- Summary report in the PR/reply: what was built, files touched, decisions made, what is deliberately deferred (Phase 2–4), and any deviations from this prompt with justification.

# Verification commands (run in this order)

```bash
pnpm typecheck
pnpm lint
pnpm test -- --run        # vitest run mode
pnpm build                # full production build (captures Next route/config issues)
# optional, only if a live DeerFlow sidecar is available:
# docker compose --profile deerflow up -d && DEERFLOW_E2E=1 pnpm test:e2e
```

---

*This megaprompt is meant to be handed to an agent verbatim. It supersedes no audit doc; it is a build plan against `2f4cf293`.*
