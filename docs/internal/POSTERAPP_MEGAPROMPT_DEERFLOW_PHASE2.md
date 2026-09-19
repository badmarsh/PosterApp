# PosterApp × DeerFlow Integration — Megaprompt (Phase 2: Autonomous Build & Fix Loop)

Working directory: `C:\Users\marek\Documents\Robco PhD\PosterApp`
Branch: `main` (work in a new feature branch `feat/deerflow-phase2`)
Baseline commit: `8fefe6a` (2026-09-19, main HEAD)
Companion docs (read FIRST):
- `docs/internal/POSTERAPP_MEGAPROMPT_DEERFLOW.md` — Phase 0 + 1 spec (already implemented, reference only)
- `docs/internal/deerflow-runs-spike.md` — Auth spike findings (DEER_FLOW_AUTH_DISABLED=1 required)
- `.agents/AGENTS.md` — Full project architecture

Date: 2026-09-19

---

## Context: What Phase 0 + 1 built (DO NOT rebuild)

Phase 0 + 1 are **fully implemented and merged into `main`**. Verify by reading the files below before writing any code — do not duplicate what already exists:

| File | What it does |
|---|---|
| `lib/deerflow/client.ts` | HTTP bridge (`createDeerThread`, `streamDeerRun`, `deleteDeerThread`), `assertBridgePath` SSRF guard |
| `lib/deerflow/sse.ts` | Chunk-boundary-safe SSE parser, 512 KB frame cap |
| `lib/deerflow/config.ts` | `getDeerflowConfig()`, `isDeerflowEnabled()`, all env vars |
| `lib/deerflow/budget.ts` | `estimateDeerflowRun()`, `assertDeerflowBudget()`, `recordDeerflowSpend()`, per-workspace daily ledger |
| `lib/deerflow/errors.ts` | Full error taxonomy (`DeerflowError` subclasses + `isDeerflowError`) |
| `lib/deerflow/contracts.ts` | `PosterResearchProposalSchema`, `normalizeProposal()`, `extractProposalJsonCandidate()`, `DeerflowStartRunSchema`, `DeerflowKindSchema` |
| `lib/deerflow/context.ts` | `buildDeerflowContext()`, `getWorkspaceAssetIds()`, `parseWorkspaceBibKeys()`, `parseWorkspaceJson()` |
| `lib/deerflow/prompts.ts` | `buildDeerflowPrompt()`, `buildDeerflowRunPayload()` |
| `lib/deerflow/db.ts` | `upsertDeerflowThread()`, `findDeerflowThread()`, `findRunForWorkspace()`, `updateDeerflowRun()`, `deleteDeerflowRun()`, `markRunInterrupted()` |
| `lib/deerflow/run-store.ts` | In-memory run state, `createRunRecord()`, `subscribeRun()`, `appendRunEvent()`, `cancelRunRecord()` |
| `lib/deerflow/runner.ts` | `executeDeerflowResearch()` — background run execution, proposal normalization |
| `lib/deerflow/guard.ts` | `assertDeerflowAvailable()`, `ensureDeerflowThread()`, `toDeerflowResponse()` |
| `app/api/workspaces/[id]/deerflow/threads/route.ts` | `POST` create/get thread |
| `app/api/workspaces/[id]/deerflow/estimate/route.ts` | `POST` cost estimate |
| `app/api/workspaces/[id]/deerflow/runs/route.ts` | `POST` start run (202 + background) |
| `app/api/workspaces/[id]/deerflow/runs/[runId]/route.ts` | `GET` status + proposal |
| `app/api/workspaces/[id]/deerflow/runs/[runId]/stream/route.ts` | `GET` SSE passthrough |
| `app/api/workspaces/[id]/deerflow/runs/[runId]/apply/route.ts` | `POST` apply proposal (only mutation path) |
| `app/api/workspaces/[id]/deerflow/threads/[threadId]/route.ts` | `DELETE` cancel + cleanup |
| `components/deerflow/deerflow-panel.tsx` | Full "Deep research" UI tab in the agent panel |
| `prisma/schema.prisma` | `DeerflowThread` model, `Workspace.deerflowEnabled` flag |
| `tests/fixtures/deerflow-gateway.mjs` | Fake gateway for tests |
| `lib/deerflow/__tests__/` | SSE, client, budget, contracts tests (35 passing) |

**Existing LaTeX autofix** (single-shot, 3 attempts, no DeerFlow involvement):
- `app/api/workspaces/[id]/autofix-compile/route.ts` — Single AI call, takes `{ log, cards }`, returns `{ explanation, fixes: [{id, content}] }`
- `components/store/project-slice.ts` — Client-side `compileOutputAction` triggers this; the 3-attempt cap is in the client loop, not the route

---

## Mission (Phase 2)

Add an **"Improve poster"** run kind to the DeerFlow integration. The agent is given the current poster's compiled LaTeX (via the existing compiler) and its error log, reasons about what is semantically wrong with the content (not just syntax), proposes card-level content patches (in Markdown), returns a validated `improve-poster-v1` proposal, and PosterApp applies patches through existing revision-gated write routes.

Key design constraints:
- **Max 5 compile-feedback iterations** per run (wall-clock cap still applies). Each iteration compiles, feeds errors back to the agent, loops until clean or limit reached.
- **Each iteration creates a snapshot** before applying — so every step is independently undoable via the existing snapshot UI.
- The DeerFlow agent **does not compile LaTeX** itself — PosterApp calls its own sandboxed `runSandboxedLatex` (or the Next.js compile route) and sends the results back as a new message to the same DeerFlow thread.
- The agent **only patches card content (Markdown)** — it never produces raw LaTeX, never touches `generatedLatex`, never changes card titles, figures, or table fields.
- All patches pass through `hasUnsafeLatex()` from `lib/latex/validation.ts` and `validateCard()` from `lib/validations/workspace.ts` before being stored — same guards as the existing autofix route.
- The existing single-shot autofix route at `app/api/workspaces/[id]/autofix-compile/route.ts` is **not changed** — Phase 2 is a separate, opt-in, longer-running path.

---

## Mandatory reading (read all before writing code)

| File | Why |
|---|---|
| `lib/deerflow/client.ts` + `lib/deerflow/contracts.ts` + `lib/deerflow/runner.ts` | Core patterns to extend, not replace |
| `app/api/workspaces/[id]/autofix-compile/route.ts` | Existing prompt + validation to reuse conceptually |
| `lib/latex/validation.ts` (`hasUnsafeLatex`) | Required patch guard |
| `lib/latex/compiler-runner.ts` | `runSandboxedLatex` — must be called from PosterApp, NEVER from inside DeerFlow |
| `app/api/workspaces/[id]/compile/route.ts` | Existing compile route — inspect how compilation is triggered server-side |
| `lib/agent-snapshot.ts` (`createWorkspaceSnapshot`) | Pre-mutation snapshot; must be called before each patch batch |
| `lib/validations/workspace.ts` (`validateCard`) | Card-level validation |
| `lib/ai/prompts.ts` (`wrapUntrustedContext`) | Sanitize DeerFlow-produced strings before trusting them |
| `lib/security.ts` (`safeApiError`, `readJsonBodyCapped`) | Route guardrails |
| `lib/rate-limit.ts` (`rateLimitAsync`) | Required on every new route |
| `lib/auth.ts` (`requireWorkspaceEditor`) | Auth pattern |
| `lib/deerflow/budget.ts` | Reuse for cost tracking; Phase 2 runs are more expensive |
| `prisma/schema.prisma` | Inspect before any new migration |
| `docker-compose.yml`, `.env.example`, `README.md`, `CHANGELOG.md` | Must be updated |
| `__tests__/` + `vitest.config.ts` | Test conventions |

---

## Hard rules (non-negotiable, same as Phase 0 + 1)

1. Every new route: `requireWorkspaceEditor` → `rateLimitAsync` → `readJsonBodyCapped` → Zod → try/catch with `safeApiError`. No `String(err)` leaks.
2. No new `npm` dependencies. Plain `fetch` + existing Node APIs only.
3. New files: `lib/deerflow/*` (server-only), routes under `app/api/workspaces/[id]/deerflow/*`, UI under `components/deerflow/*`.
4. No `: any` in `app/api/**`. All types inferred from Zod.
5. Never pass `DATABASE_URL`, `CLERK_SECRET_KEY`, `AI_API_KEY`, absolute workspace paths, or raw card table data to DeerFlow.
6. All DeerFlow strings are **untrusted**: `wrapUntrustedContext` when feeding them back into AI prompts, escaped when rendered in UI, no `dangerouslySetInnerHTML`.
7. Workspace mutation only through existing routes (revision-gated). A snapshot is created before each patch batch.
8. Tests run without a live DeerFlow — use the existing `tests/fixtures/deerflow-gateway.mjs` fixture extended with new scripted frames.
9. Update `.env.example`, `README.md`, and `CHANGELOG.md` for any new env vars or routes.
10. `pnpm typecheck && pnpm lint && pnpm test -- --run && pnpm build` must stay green.
11. PowerShell on this box — chain commands with `;` not `&&`.

---

## Scope — IN (Phase 2)

### T2.1 New contract: `improve-poster-v1`

**File: `lib/deerflow/contracts.ts`** (extend, do not rewrite)

Add alongside `PosterResearchProposalSchema`:

```typescript
// Zod schema for a single card patch (same Markdown format as autofix-compile)
export const CardPatchSchema = z.object({
  id: z.string().max(128),                         // card id — must exist in workspace
  content: z.string().min(1).max(8000),            // replacement content in Markdown
  rationale: z.string().max(400).default(""),      // agent's explanation, untrusted, for UI display only
})
export type CardPatch = z.infer<typeof CardPatchSchema>

// Per-iteration result: the agent's patches for one compile → feedback cycle
export const ImprovePosterIterationSchema = z.object({
  iterationIndex: z.number().int().min(0).max(4),  // 0-based; max 5 iterations
  patches: z.array(CardPatchSchema).max(10).default([]),
  compileLog: z.string().max(2000).default(""),    // last compile log excerpt (summary only)
  diagnosis: z.string().max(600).default(""),      // overall diagnosis this iteration
})
export type ImprovePosterIteration = z.infer<typeof ImprovePosterIterationSchema>

// Final proposal returned by the agent after all iterations
export const ImprovePosterProposalSchema = z.preprocess(
  (raw: unknown) => {
    if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>
      return {
        version: obj.version ?? "improve-poster-v1",
        iterations: obj.iterations ?? obj.steps ?? obj.rounds ?? [],
        summary: obj.summary ?? obj.overview ?? "",
        cleanCompile: obj.cleanCompile ?? obj.success ?? false,
        meta: obj.meta ?? {},
      }
    }
    return raw
  },
  z.object({
    version: z.literal("improve-poster-v1").default("improve-poster-v1"),
    iterations: z.array(ImprovePosterIterationSchema).max(5).default([]),
    summary: z.string().max(2000).default(""),
    cleanCompile: z.boolean().default(false),      // true = final iteration compiled clean
    meta: ProposalMetaSchema.default({}),
  }).strict()
)
export type ImprovePosterProposal = z.infer<typeof ImprovePosterProposalSchema>

export const IMPROVE_POSTER_PROPOSAL_VERSION = "improve-poster-v1" as const
```

Also extend `DeerflowKindSchema`:
```typescript
export const DeerflowKindSchema = z.enum(["poster_research", "improve_poster"])
```

Add a Zod schema for the start-run body for `improve_poster`:
```typescript
export const DeerflowImprovePosterSchema = z.object({
  kind: z.literal("improve_poster"),
  language: DeerflowLanguageSchema.default("sk"),
  maxIterations: z.number().int().min(1).max(5).default(3),
  // maxMinutes already enforced by the runner via config
  confirmEstimate: z.boolean().default(false),
})
export type DeerflowImprovePosterInput = z.infer<typeof DeerflowImprovePosterSchema>
```

Add a discriminated union for the start-run body:
```typescript
export const DeerflowStartRunSchema = z.discriminatedUnion("kind", [
  // Phase 1 (already exists — keep unchanged)
  z.object({
    kind: z.literal("poster_research"),
    language: DeerflowLanguageSchema.default("sk"),
    focus: z.string().min(10).max(2000),
    depth: DeerflowDepthSchema.default("standard"),
    includeAssets: z.boolean().default(true),
    maxMinutes: z.number().int().min(1).max(30).optional(),
    confirmEstimate: z.boolean().default(false),
  }),
  // Phase 2 (new)
  DeerflowImprovePosterSchema,
])
export type DeerflowStartRunInput = z.infer<typeof DeerflowStartRunSchema>
```

Add `normalizeImprovePosterProposal()` following the same pattern as `normalizeProposal()`:
- Validates with `ImprovePosterProposalSchema.safeParse`
- Filters patches: `id` must be in `allowedCardIds` (new parameter, a `ReadonlySet<string>`)
- Runs `hasUnsafeLatex(patch.content)` on every patch; patches that fail are silently dropped with a logged warning
- Returns `{ ok: true, proposal, rejected: { unknownCardIds, unsafePatchIds } }` or `{ ok: false, issues }`

---

### T2.2 Poster context for the agent

**File: `lib/deerflow/context.ts`** (extend)

Add:
```typescript
export interface ImprovePosterContext {
  language: DeerflowLanguage
  cards: Array<{
    id: string
    title: string
    content: string        // Markdown content (bounded)
    pattern: string
  }>
  templateId: string       // e.g. "tikzposter", "gemini" — from the active Output
  outputType: string       // "poster" | "slides" | "paper"
  truncated: boolean
}

export const MAX_CARD_CONTENT_CHARS = 600  // per card, to keep context tight

export async function buildImprovePosterContext(opts: {
  workspaceId: string
  language: DeerflowLanguage
}): Promise<ImprovePosterContext>
```

Implementation notes:
- Read cards from `prisma.output.findFirst({ where: { workspaceId }, include: { cards: true }, orderBy: { id: "desc" } })`
- Truncate each card's `content` to `MAX_CARD_CONTENT_CHARS`
- Only include `pattern !== "references"` cards
- Gather the output's `templateId` and `outputType`
- Expose a card-id set helper `getWorkspaceCardIds(workspaceId): Promise<Set<string>>` (mirrors `getWorkspaceAssetIds`)

---

### T2.3 Prompt builder for `improve_poster`

**File: `lib/deerflow/prompts.ts`** (extend, add alongside existing functions)

Add:
```typescript
export function buildImprovePosterPrompt(
  input: DeerflowImprovePosterInput,
  context: ImprovePosterContext,
  compileLog: string,          // from the first compile attempt
  iterationIndex: number,      // 0 = initial call, 1-4 = feedback rounds
  previousPatches?: CardPatch[], // patches applied in the previous iteration
): string
```

The prompt instructs the agent to:
1. Read the compile log and the card inventory.
2. Identify which card content is causing the error (same logic as `autofix-compile/route.ts`'s diagnosis).
3. Produce the `improve-poster-v1` JSON contract:
   - `iterations[iterationIndex].patches` — the patches for this round.
   - `iterations[iterationIndex].diagnosis` — what is wrong.
   - `cleanCompile: false` (it cannot know whether the patched version compiles — PosterApp will tell it).
4. After PosterApp applies and recompiles, a new message is sent to the **same thread** with the new log. The agent accumulates `iterations[]` across messages.
5. When all errors are resolved or `iterationIndex === maxIterations - 1`, the agent emits the final proposal JSON with all iterations populated and `cleanCompile: true/false`.

Key language rules (same as existing prompts):
- Card content is **Markdown**, not LaTeX. Never return raw LaTeX.
- Return `improve-poster-v1` JSON only — no prose before or after.
- Use `wrapUntrustedContext` pattern (document the rule in the comment; the prompt itself is server-constructed, not user input).
- Never mention file paths, secrets, or PosterApp internals.

Add a corresponding payload builder:
```typescript
export function buildImprovePosterPayload(
  input: DeerflowImprovePosterInput,
  context: ImprovePosterContext,
  compileLog: string,
  iterationIndex: number,
  previousPatches?: CardPatch[],
): StartRunPayload
```

For **continuation messages** (iteration > 0), the payload sends an additional `human` message to the same thread (same `deerThreadId`) with the new compile log and the patches that were applied, rather than a new run. Use `POST /api/langgraph/threads/{thread_id}/runs/stream` with the added message — this is the same SSE endpoint already wired in `streamDeerRun`.

---

### T2.4 Runner for `improve_poster`

**File: `lib/deerflow/runner.ts`** (extend, add alongside `executeDeerflowResearch`)

Add:
```typescript
export interface LaunchImprovePosterParams {
  workspaceId: string
  userId: string
  deerThreadId: string
  runId: string            // DeerflowThread.id
  input: DeerflowImprovePosterInput
  costEstimateUsd: number
}

export async function executeDeerflowImproveLoop(params: LaunchImprovePosterParams): Promise<void>
```

The loop:
1. `phase = "compiling"` → call `POST /api/workspaces/{id}/compile` (or `runSandboxedLatex` directly if accessible server-side — inspect `lib/latex/compiler-runner.ts`).
   - **Important**: do NOT embed pdflatex directly in this module. Call the existing compile infrastructure (route or exported lib function).
   - The compile is a server-side call on the Node process. If `runSandboxedLatex` is exported from `lib/latex/compiler-runner.ts`, import and call it. Otherwise, make a local `fetch` to `/api/workspaces/{id}/compile` with a service token and `?internal=1` guard.
2. Feed the compile log to the agent via `streamDeerRun` (first call) or a continuation message (subsequent iterations).
3. Parse the agent's response: call `extractImprovePosterJsonCandidate` (new, similar to existing `extractProposalJsonCandidate` but for `improve-poster-v1`).
4. Validate with `normalizeImprovePosterProposal`. On failure → `phase = "failed"`.
5. For each patch in the current iteration:
   a. `createWorkspaceSnapshot(workspaceId, "deerflow-improve-iter-N")` — pre-mutation snapshot.
   b. Apply patch via `prisma.card.updateMany({ where: { id, outputId /* owned by workspace */ }, data: { content } })`.
   c. Log `appendRunEvent(runId, { type: "tool", message: "Patched card: ..." })`.
6. Recompile. If clean → mark `cleanCompile: true`, store proposal, transition `status = "done"`.
7. If not clean and `iterationIndex < maxIterations - 1` → send feedback message to same thread, increment `iterationIndex`, go to step 2.
8. If limit reached → store partial proposal, `status = "done"` with `cleanCompile: false` (not failed — the patches may still be an improvement).
9. All errors stored via `updateDeerflowRun` + `updateRunRecord` (same pattern as Phase 1 runner).

**Cost tracking**: `recordDeerflowSpend(workspaceId, costEstimateUsd * iterationCount / maxIterations)` after each iteration so budget stays accurate as the run progresses.

**Concurrency guard**: at step 1, check that no other run for this workspace is in `running` status. The existing check in `runs/route.ts` handles the start, but the loop must re-check at each iteration start to handle concurrent cancellations.

**Snapshot coalescing**: do not snapshot more than once per 30 seconds per workspace (check `lib/snapshot-diff.ts` — if an increment/diff approach is available, prefer it).

---

### T2.5 Budget estimates for `improve_poster`

**File: `lib/deerflow/budget.ts`** (extend)

Add cost estimates for the new run kind:
```typescript
export interface ImprovePosterEstimate {
  iterations: number
  minutes: number
  usd: number
  description: string
}

export const IMPROVE_POSTER_ESTIMATES: Record<number, ImprovePosterEstimate> = {
  1: { iterations: 1, minutes: 3,  usd: 0.05, description: "Single iteration fix (~3 min, ~$0.05)" },
  3: { iterations: 3, minutes: 10, usd: 0.18, description: "Up to 3 iteration fix loop (~10 min, ~$0.18)" },
  5: { iterations: 5, minutes: 18, usd: 0.35, description: "Full 5-iteration fix loop (~18 min, ~$0.35)" },
}

export function estimateImprovePosterRun(maxIterations: number): ImprovePosterEstimate
```

---

### T2.6 Routes

**All new routes follow the exact same pattern as existing deerflow routes** (auth → rate-limit → body-cap → Zod → try/catch → `safeApiError`). Read `app/api/workspaces/[id]/deerflow/runs/route.ts` as the template.

The existing `POST .../deerflow/runs` route already accepts a discriminated union body (`DeerflowStartRunSchema`) — extend it to dispatch on `kind`:

```typescript
// In runs/route.ts:
if (input.kind === "poster_research") {
  void executeDeerflowResearch({ ... }).catch(...)
} else if (input.kind === "improve_poster") {
  void executeDeerflowImproveLoop({ ... }).catch(...)
}
```

Add a new **apply route** for `improve_poster`:

**`POST app/api/workspaces/[id]/deerflow/runs/[runId]/apply-improve/route.ts`**

- Auth: `requireWorkspaceEditor`
- Rate limit: `rateLimitAsync(`${userId}:${id}:deerflow:apply-improve`, 10, 60_000`)`
- Fetches the `DeerflowThread` row for `runId` scoped to `workspaceId`
- Re-validates the stored `ImprovePosterProposal` using `normalizeImprovePosterProposal` with current card ids
- **For each patch**, in iteration order:
  - `createWorkspaceSnapshot` (pre-mutation)
  - Updates the card via `prisma.card.updateMany({ where: { id: patch.id, output: { workspaceId } }, data: { content: patch.content, generatedLatex: null } })`
  - Increments workspace revision via `prisma.workspace.update({ where: { id }, data: { revision: { increment: 1 } } })`
- Returns `{ appliedPatches, totalIterations, cleanCompile, skippedUnsafe }`

> **Note:** This is the explicit human "Apply" action after the run finishes, distinct from the in-loop intermediate patches the runner applies automatically. The runner applies patches to test compilation; this route is for the user to confirm the final result. If the runner already applied patches during the loop, this route is a no-op (or diffs against the already-applied state). Clarify the semantics: the runner applies intermediate patches in-place **and takes snapshots**, so the user can always undo. The "Apply" button in the UI is the explicit confirmation; without it, the workspace is in an "agent-patched" state that the user should review.

---

### T2.7 UI: "Improve poster" tab/section

**File: `components/deerflow/deerflow-panel.tsx`** (extend)

Add a second mode alongside the existing "Deep research" form:

```
[Deep research] [Improve poster]   ← sub-tab switcher inside the panel
```

"Improve poster" mode shows:
- Max iterations selector: 1 / 3 / 5 (maps to `maxIterations`)
- Language selector (shared with existing)
- Estimated cost + time (from `IMPROVE_POSTER_ESTIMATES`)
- Confirm before start (required when estimate > thresholds)
- **Live progress**: phase badge (`compiling` / `patching` / `compiling` / `done`), iteration counter `Iteration 1/3`, per-iteration patch count
- **Per-iteration log**: expandable accordion showing what was patched each iteration
- **Result drawer**: shows final `summary`, `cleanCompile` badge (green/amber), diff preview of all patches across all iterations
- **"Apply" button** → calls `/apply-improve`; **"Undo all" button** → links to snapshot history (opens snapshot panel)
- **Error states**: same as existing panel (`offline`, `budget`, `rate-limited`)

Reuse all existing UI state patterns from `deerflow-panel.tsx`:
- `esRef`, `connectStream`, `refreshStatus` — identical flow, different endpoint suffix (`/apply-improve` instead of `/apply`)
- `serverEnabled`, `workspaceRevision`, `overBudget` — shared, no duplication

**Do NOT** remove or modify the existing "Deep research" form — both modes coexist.

---

### T2.8 Compile infrastructure access (server-side)

Inspect `lib/latex/compiler-runner.ts` to determine whether `runSandboxedLatex` (or an equivalent) is exported and callable from the Node process without going through an HTTP route. If yes, import and use it directly in the runner — no internal HTTP call needed.

If the compile function is not directly importable (e.g. only available as a Docker sidecar call), then make a server-to-server fetch to `/api/workspaces/{id}/compile` with a guard header `X-Internal-Deerflow: 1` and a short-lived HMAC derived from `CLERK_SECRET_KEY` (or a dedicated `DEERFLOW_INTERNAL_TOKEN` env var). The compile route must check and reject external callers without this header.

Document the chosen approach in a comment in `runner.ts` and in `README.md`.

---

### T2.9 Tests

**New test files** (all runnable with no external network, no live sidecar):

#### `lib/deerflow/__tests__/contracts-improve.test.ts`
- `normalizeImprovePosterProposal` accepts valid proposal
- Rejects patches with unknown card ids
- Rejects patches failing `hasUnsafeLatex`
- Rejects unknown top-level keys
- `extractImprovePosterJsonCandidate` finds JSON in fenced block, raw text, balanced scan
- `ImprovePosterIterationSchema` rejects `iterationIndex > 4`

#### `lib/deerflow/__tests__/runner-improve.test.ts`
- Mock `streamDeerRun` returning a scripted SSE sequence (using `deerflow-gateway.mjs` extended with `improve-poster-v1` frames)
- Mock compile call returning a log with errors (first call) then clean (second call)
- Verify that exactly 2 snapshots were taken (one per iteration)
- Verify `DeerflowThread.status = "done"`, `cleanCompile = true`
- Verify that patched card content passes `hasUnsafeLatex`

#### `__tests__/api/deerflow-apply-improve.test.ts`
- `/apply-improve` with unknown card ids → rejected patches logged
- `/apply-improve` with valid proposal → cards updated, revision incremented
- `/apply-improve` on non-done run → 409
- Rate limit: >10 calls/min → 429

#### Extended `tests/fixtures/deerflow-gateway.mjs`
Add a `createImprovePosterFixture({ iterations })` factory that:
- Returns `improve-poster-v1` JSON with N iterations
- Simulates the "compile → feedback → patch" ping-pong with scripted SSE frames

---

### T2.10 Env, docs, changelog

**`.env.example`** — add only if any new env var is introduced (e.g. `DEERFLOW_INTERNAL_TOKEN`).

**`README.md`** — extend the "Optional DeerFlow integration" section with:
- Subsection "Improve poster loop" — what it does, how to trigger, iteration cap
- Note on compile infrastructure access (server-side vs internal HTTP)
- Security note: the runner never gives DeerFlow the LaTeX source — it gives it the **compiler log** and the **card Markdown** only

**`CHANGELOG.md`** — add a DeerFlow Phase 2 entry under `[Unreleased]`:
```markdown
### DeerFlow Integration (Phase 2 — Autonomous build & fix loop)
- **`improve_poster` run kind.** …
```

---

## Scope — OUT (explicitly not this pass)

- Phase 3 (multi-agent review panel, skill orchestration through thesis-review module)
- Phase 4 (memory, IM channels)
- Making the agent produce or inspect raw LaTeX (it only sees Markdown card content + compile log)
- Changing `app/api/workspaces/[id]/autofix-compile/route.ts` (left as the fast, cheap single-shot path)
- Multi-output support — Phase 2 always targets the active output (most recent by `id`)
- Parallelising compile iterations — one compile at a time, sequential

---

## Acceptance matrix

| ID | Check | How to verify |
|---|---|---|
| A2.1 | `DeerflowKindSchema` accepts `"improve_poster"` and `"poster_research"`; rejects others | `pnpm test -- contracts-improve` |
| A2.2 | `normalizeImprovePosterProposal` rejects patches with unsafe LaTeX | unit test |
| A2.3 | Runner loop calls compile, feeds log back, patches cards, takes snapshot per iteration | `runner-improve.test.ts` with mocked compile |
| A2.4 | Loop stops after `maxIterations` even if still failing | unit test |
| A2.5 | `/apply-improve` creates one snapshot before the first patch; returns revision bumped | `deerflow-apply-improve.test.ts` |
| A2.6 | UI shows iteration counter and per-iteration patch list in the progress feed | manual |
| A2.7 | `DEERFLOW_ENABLED=0` → `POST .../runs` with `kind: "improve_poster"` returns 503 | unit test (mock env) |
| A2.8 | No new `npm` dep in `package.json` | `pnpm ls` diff |
| A2.9 | `pnpm lint`, `pnpm typecheck`, `pnpm test -- --run`, `pnpm build` all pass | run in order |
| A2.10 | CHANGELOG + README updated | grep |

---

## Deliverables & DoD

- Feature branch `feat/deerflow-phase2`, squash-merge to `main` when green.
- Conventional commits: `feat(deerflow): …`, `test(deerflow): …`, `docs(deerflow): …`.
- Final `git status` clean.
- Summary in the PR/reply: files touched, decisions made (especially compile access strategy), deferred items, test output.

---

## Verification commands (run in this order)

```powershell
pnpm typecheck
pnpm lint
pnpm test -- --run
pnpm build
# Optional, requires live DeerFlow + DEERFLOW_E2E=1:
# pnpm test:e2e -- deerflow
```

---

## Key decisions to document in the PR

1. **Compile access strategy**: direct import of `runSandboxedLatex` vs. internal HTTP to `/api/workspaces/{id}/compile`. Document which was used and why.
2. **Intermediate patches**: the runner applies patches during the loop (to test compilation). Document whether the "Apply" button re-applies or just confirms, and how duplicates are handled.
3. **Snapshot coalescing**: whether `lib/snapshot-diff.ts` was usable or a simple debounce was applied.
4. **Continuation messages**: how the second+ iteration sends a new human message to the same DeerFlow thread without starting a new thread (LangGraph thread reuse).
