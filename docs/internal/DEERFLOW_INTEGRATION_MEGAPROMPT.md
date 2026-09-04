# DeerFlow × PosterApp Integration Megaprompt — 2026-09-04

Working directory: `C:\Users\marek\Documents\Robco PhD\PosterApp`
Current commit at start of this pass: `9dbc88c9c3f688c625371c394b2468aa6c327f56` (2026-09-03 22:53:18 +0000, "Merge pull request #4 from badmarsh/arena/01a06908-posterapp")

## What this document is

An executor-ready spec for turning PosterApp's agent API from "a REST surface DeerFlow could theoretically call" into an actual working DeerFlow integration. It reconciles two prior documents against the live repo at the commit above:

- an audit of the existing `app/api/agent/*` surface, the Settings → DeerFlow Integration panel, and the Research Lab tab
- a set of six long-horizon scientific task prompts written for DeerFlow to run against a PosterApp workspace

Every claim in the "Ground truth" section was re-checked against the current commit by direct file read this pass, not carried over from the source docs unverified — file:line citations are given so a coding agent can jump straight to the code.

## Ground truth: what already exists

- Real machine-to-machine surface at `app/api/agent/*`: `manifest`, `workspaces`, `workspaces/[id]/{cards,bibliography,assets,rag/query,review,compile,snapshot,ingestion}` (confirmed via directory listing).
- Auth via `lib/agent-auth.ts` (Bearer → `AgentApiKey` lookup, scope check, per-workspace access check), pre-write snapshots via `lib/agent-snapshot.ts`, audit logging via `lib/agent-audit.ts` + `AgentToolCallLog`.
- Settings → "DeerFlow Integration" panel (`components/settings/agent-integration-panel.tsx`) mints a key the user pastes into DeerFlow's own `.env`.
- Research Lab tab (`components/research-lab-templates.tsx`, `SCIENTIFIC_TASKS`, 6 tasks) — "Launch Task" in `components/workspace-selector.tsx::handleLaunchLabTask` creates a workspace and writes `task.initialCards` into it immediately.
- No DeerFlow code in this repo. `deerflow` does not appear anywhere in the tree (repo-wide file-name search, zero hits). This is PosterApp's half of a two-sided integration only — nothing here calls out to a running DeerFlow instance.

## Tier A — verified, ready to execute

Each item below was independently reproduced against commit `9dbc88c` this pass (not just carried over from the audit).

### A1: "Launch Task" seeds fabricated results as validated fact
- **Proof:** `components/research-lab-templates.tsx:186-190` — the Retrieval Tournament task's `initialCards` includes a `pattern: "results"` entry, "Comparative Performance Matrix", with content `"Hybrid RRF (α=0.6) demonstrated clear superiority, reaching Recall@5 of 0.87 (+14.2% over dense baseline) and MRR of 0.79 with negligible 23ms latency overhead."` — invented numbers, written before any experiment has run. Every one of the 6 tasks has at least one equivalent `pattern: "results"` card. `components/workspace-selector.tsx:172-186` (`handleLaunchLabTask`) maps every `initialCards` entry — untouched — into the new workspace with `validation: "ok"`, and `PUT`s it immediately on click. There is no placeholder marking and no gating.
- **Why it matters:** if the person is interrupted after clicking Launch, before DeerFlow has run anything, they're left with a poster workspace containing invented statistics marked `"ok"` — the exact ungrounded-claim failure mode this project's thesis-review feature exists to catch.
- **Fix:** split each task's `initialCards` into `setupCards` (methods/protocol description — safe to seed) and `placeholderResultCards` (the current `pattern: "results"` entries). Either drop `placeholderResultCards` from the seed entirely, or seed them with `validation: "pending"` and a content prefix like `[PLACEHOLDER — not yet run]` that the UI renders as a visible badge, never `"ok"`.
- **Acceptance check:** every `pattern: "results"` match in `research-lab-templates.tsx` sits inside `placeholderResultCards`, never `setupCards`; `handleLaunchLabTask` never sets `validation: "ok"` on a card sourced from `placeholderResultCards`.

### A2: Manifest and Research Lab prompts use two different tool vocabularies
- **Proof:** `app/api/agent/manifest/route.ts:16-49` — the manifest is hand-authored JSON exposing REST verb/path pairs only, e.g. `cards.update: 'PATCH /workspaces/{id}/cards/{cardId}'`. No `name` field, no machine-parseable tool identifier at all. Meanwhile `components/research-lab-templates.tsx:71` (and every task's phase list) references dot-namespaced tool names the manifest never emits: `"posterapp.cards.list"`, `"posterapp.rag.query"`, `"bash.sandbox"`, `"search_academic"`.
- **Why it matters:** nothing in the repo translates one vocabulary into the other. A human has to hand-wire DeerFlow's tool config to match the manifest every time either side changes.
- **Fix:** add a `name` field to every manifest capability (e.g. `cards.update` → `{ name: 'posterapp.cards.update', method: 'PATCH', path: '/workspaces/{id}/cards/{cardId}', scopes: ['workspace:write'] }`), matching the dot-namespace already used internally — `app/api/agent/workspaces/[id]/cards/[cardId]/route.ts:87` already calls `logToolCall(ctx, id, 'posterapp.cards.update', ...)`, so the naming convention exists in the code, just not in the manifest. Then regenerate `research-lab-templates.tsx`'s `tools:` arrays from the manifest's `name` fields instead of hand-typing them. `bash.sandbox`, `search_academic`, and other DeerFlow-native tools (not PosterApp's) stay as-is.
- **Acceptance check:** every `posterapp.*` string literal in `research-lab-templates.tsx` has a matching `name` in the manifest response; a small script diffs the two and fails CI on drift.

### A3: "Halts for human review" is not true
- **Proof:** `app/api/agent/workspaces/[id]/cards/[cardId]/route.ts` — `PATCH` writes to the DB immediately inside `prisma.$transaction` (line ~78), then calls `logToolCall(ctx, id, 'posterapp.cards.update', { cardId, ...body }, result, Date.now() - start, true)` at line 87 — the trailing `true` (`approved`) is hardcoded, not the outcome of any review step. The pre-write snapshot (`createWorkspaceSnapshot`, line ~70) gives rollback, but nothing gates the write on human approval before it happens.
- **Why it matters:** Tasks 1, 3, 4, 5, and 6 all show `⚠️ APPROVAL REQUIRED` before a results/methodology card update in their prompt copy. That gate doesn't exist in the code — every write lands unconditionally.
- **Fix:** either (a) build a real pending-approval queue — the right long-term answer, see Phase 2 below — or (b), as an immediate stopgap, stop implying synchronous human-gating anywhere in product copy (Research Lab task cards, Settings panel) and say plainly: "changes are written immediately and are individually reversible via snapshot." (b) should land regardless of which path is chosen, since it's a one-line honesty fix.
- **Acceptance check:** grep the six task prompt blocks and the settings panel for "review", "approval", "halts", "gate" — every remaining instance matches actual code behavior.

### A4: Agent keys aren't scoped to a workspace
- **Proof:** `lib/agent-auth.ts:3-7` (`AgentContext` type) carries only `{ apiKeyId, userId, scopes }` — no `workspaceId`. `requireAgentWorkspaceAccess` (line 65 onward) checks ownership/membership of the target workspace against `ctx.userId`, not against anything on the key itself. A key minted for one Research Lab task therefore has `workspace:write` on every workspace that user owns, including thesis-review workspaces with confidential reviewer comments.
- **Fix:** add an optional `workspaceId String?` column to the `AgentApiKey` model (`prisma/schema.prisma:333-347`, currently `id, key, name, userId, scopes, lastUsedAt, createdAt, expiresAt, revokedAt`); when set, `requireAgentWorkspaceAccess` must additionally check `apiKey.workspaceId === workspaceId` (null = unrestricted, clearly labeled as such in the key-creation UI). Update `agent-integration-panel.tsx`'s key-creation form to let the user pick a workspace to scope to, defaulting to scoped-to-the-launching-workspace when a key is minted from a Research Lab task.
- **Acceptance check:** a key minted with `workspaceId: X` gets 403 from `requireAgentWorkspaceAccess` on any workspace `!== X`; existing unscoped keys (`workspaceId: null`) keep current behavior.

### A5: Keys are stored in plaintext
- **Proof:** `lib/agent-auth.ts:28-30` — `prisma.agentApiKey.findUnique({ where: { key: rawKey } })`, against `prisma/schema.prisma:335` — `key String @unique @default(cuid())`. No hashing anywhere in the lookup path. Compare `lib/collaboration-ticket.ts`, which generates a raw ticket via `randomBytes(32)` but stores and looks up a `tokenHash` (`prisma/schema.prisma:84`, `CollaborationTicket` model) — never the raw value.
- **Fix:** rename `AgentApiKey.key` → `AgentApiKey.tokenHash` (migration), keep generating the raw key as today, hash it with the same function `collaboration-ticket.ts` uses before storage, and look up by hash in `verifyAgentKey`. The raw key is shown to the user exactly once at creation time — same UX as today, only the storage changes.
- **Acceptance check:** no column on `AgentApiKey` ever holds a value directly comparable to a raw bearer token; a DB dump of the table contains no usable credentials.

### A6: `rateLimitAsync` is imported but never called on the agent surface
- **Proof:** every route under `app/api/agent/**` — confirmed for `cards/[cardId]`, `bibliography`, `bibliography/[entryId]`, `assets`, `compile`, `ingestion`, `rag/query`, `review`, `snapshot` (9 files) — imports `rateLimitAsync` from `@/lib/rate-limit` at line 1 but never invokes it in any handler body (verified directly in `cards/[cardId]/route.ts`, same import-without-call pattern present in the other 8 by inspection of their identical header). `rateLimitAsync(key: string, limit: number, windowMs: number): Promise<RateLimitResult>` (`lib/rate-limit.ts:84-88`) is the same function other mutating routes elsewhere in the app already call correctly, e.g. `app/api/ingestion/parse/route.ts:75-78`.
- **Fix:** in each of the 9 files, after `requireAgentWorkspaceAccess`, add: `const { allowed, retryAfterMs } = await rateLimitAsync(\`agent:${ctx.apiKeyId}:${id}\`, <limit>, <windowMs>); if (!allowed) return NextResponse.json({ error: 'Rate limited', retryAfterMs }, { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } })` — key by `apiKeyId` (not `userId`) so one runaway DeerFlow session doesn't burn a human's normal rate-limit budget on the same account. Also add rate limiting to key issuance itself (`agent-keys/route.ts`, flagged with the same dead import in the original audit).
- **Acceptance check:** `Get-ChildItem app/api/agent -Recurse -Include route.ts | Select-String "await rateLimitAsync\("` returns one match per exported mutating verb across all 9+1 files; a scripted burst of calls against one endpoint with one key gets 429s.

### A7: Snapshot cost scales badly with agent chattiness
- **Proof:** `lib/agent-snapshot.ts` (`createWorkspaceSnapshot`, called at the top of every agent write route, e.g. `cards/[cardId]/route.ts` line ~70) serializes the entire workspace — all cards, assets, ingest files — to JSON on every single card write. Fine for occasional human edits; the Ablation Study task alone implies "33 seeded runs" worth of periodic agent writes in one session, and the HPO task implies 150 trials feeding back status.
- **Fix (Phase 2, not urgent for Phase 0):** either (a) debounce/coalesce snapshots — skip a fresh one if the workspace hasn't meaningfully changed since the last snapshot within some window — or (b) switch to incremental/diff snapshots. `lib/snapshot-diff.ts` already exists in this repo (used elsewhere) — check whether it's reusable here before writing new diff logic.
- **Acceptance check:** a scripted 33-write agent session against a workspace with the current cap (20 snapshots/workspace) doesn't silently evict useful rollback points faster than a human could review them; snapshot write time doesn't scale with unrelated workspace size for a single-card patch.

## Phase 0 — do first (blocks nothing else, unblocks trust)
A1 alone. This is a data-integrity bug independent of everything else in this document — ship it before any other Research Lab work continues, so no more workspaces get seeded with fake `"ok"` results in the meantime.

## Phase 1 — security/auth hardening (A4, A5, A6)
Independent of each other; land as 3 small PRs or 1 combined one. None of these change API shape for a well-behaved caller (DeerFlow or otherwise) — only for someone exploiting the gaps.

## Phase 2 — make "reviewed" true (A3, A7)
Build the pending-approval queue (a new `AgentPendingChange` model — workspace, proposed diff, status `pending | approved | rejected`, plus a UI list to approve/reject before the write lands) so `⚠️ APPROVAL REQUIRED` in the task prompts becomes real product behavior, not aspirational copy. Fold in the snapshot-cost fix here since both touch the same write path.

## Phase 3 — manifest as source of truth (A2)
Add `name` fields to the manifest, regenerate `research-lab-templates.tsx`'s tool lists from it, add the CI drift check. This is the change that turns "a human has to hand-wire this" into "point DeerFlow's tool config at `/api/agent/manifest` and go."

## Phase 4 — the other half: an actual DeerFlow connection
Nothing in Phases 0–3 makes DeerFlow *run*. Today "Launch Task" only creates a workspace and copies a prompt to the clipboard for the user to paste into a separately-running DeerFlow instance. Two options, not mutually exclusive:

- **4a (manual, low-lift):** keep the copy-to-clipboard flow, but make the copied text self-configuring — include the freshly-minted, workspace-scoped agent key (per A4) and the manifest URL inline in the copied prompt/config block, so pasting it into DeerFlow's `.env` + prompt window is one paste instead of two.
- **4b (automated):** if DeerFlow exposes its own API/webhook for starting a run, add an outbound call from `handleLaunchLabTask` to actually kick off the DeerFlow run with the generated key and workspace ID, instead of only preparing PosterApp's side. This requires knowing DeerFlow's actual invocation contract — **not yet known from anything in this repo or the source docs** — flag as needs-input rather than guessing at an API shape. Do not fabricate a DeerFlow client library against a guessed contract; that repeats the A1 mistake one layer up.

## Phase 5 — Research Lab UX truthfulness pass
Once Phases 0–4 land, re-read every one of the 6 task cards' copy (`research-lab-templates.tsx`) against actual behavior — runtime estimates, "approval required" callouts, tool names — and correct anything still describing aspirational rather than shipped behavior. Do this last so it's checked against what's actually true by then.

## Execution rules
(same standing rules as `docs/internal/POSTERAPP_MEGAPROMPT_ROUND4.md` and the audits before it — restated here so this doc is self-contained)

- Work phase by phase, one PR per phase where reasonable; Phase 0 is a single small PR.
- Keep `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e` green throughout.
- Never remove a user-visible feature without saying so explicitly in the PR description.
- Auth boundary is `lib/auth.ts` (human sessions) / `lib/agent-auth.ts` (agent keys) only — don't add parallel auth checks elsewhere.
- Commit format: `deerflow-N(scope): imperative summary`, N = phase number.
- Ask before any destructive migration (A5's key-column rename touches live `AgentApiKey` rows).
- PowerShell on this box — chain with `;` not `&&`.
- Before claiming any item in this document "still true" in a future pass, re-verify it against the then-current commit the way this pass did — don't carry forward Tier A status unchecked.

## Source material
This document reconciles two inputs supplied for this pass, both dated 2026-09-04:

- an audit of `app/api/agent/*`, `lib/agent-*.ts`, `agent-integration-panel.tsx`, and the Research Lab tab
- "Long-Horizon Scientific Tasks for DeerFlow × PosterApp" — the 6 task-prompt specs (`SCIENTIFIC_TASKS` in `research-lab-templates.tsx` is PosterApp's implementation of this doc's task list)

Neither source doc is itself checked into this repo; this file is the checked-in, re-verified synthesis of both.
