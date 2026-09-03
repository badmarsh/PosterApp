# PosterApp Improvement Megaprompt — Round 4 — 2026-09-02

Working directory: `C:\Users\marek\Documents\Robco PhD\PosterApp`
Current commit at start of this pass: `f021ae9e553719db772e345b662065f5015c66c9` (2026-09-02 14:55:10 +0200)
`git log 7bc0945..HEAD --oneline` (7bc0945 = HARDENING_AUDIT.md's stated target commit) → **one commit**, `f021ae9`, "refactor: workspace path consolidation, AI model upgrades, and security hardening" (99 files changed, +4974/-2753). This commit post-dates every existing audit doc's stated baseline and was read via `git show f021ae9 --stat` plus targeted file reads before any claim below was accepted.

## Files read this pass

Root-level docs matching `*_AUDIT.md`, `*_REPORT.md`, `*_ARCHITECTURE.md`, `*_ROADMAP.md`, `CODING_AGENT_PROMPT_*.md`, plus README/CHANGELOG, enumerated via a full repo-root directory listing:

| File | Opened? | Note |
|---|---|---|
| `README.md` | Yes | Full read |
| `CHANGELOG.md` | Yes | Full read, all version sections |
| `HARDENING_AUDIT.md` | Yes | Full read (Round 3, target commit `7bc0945`) |
| `ACADEMIC_REVIEWER_MASTER.md` | Yes | Full read (448 lines) |
| `ACADEMIC_REVIEWER.md` | N/A | Deleted in `f021ae9`; content merged into `ACADEMIC_REVIEWER_MASTER.md` |
| `PIPELINE_ARCHITECTURE_AND_PERFECTION_ROADMAP.md` | N/A | Deleted in `f021ae9`; content merged into `ACADEMIC_REVIEWER_MASTER.md` |
| `CODING_AGENT_PROMPT_pipeline_perfection.md` | N/A | Deleted in `f021ae9`; content merged into `ACADEMIC_REVIEWER_MASTER.md` |
| `CONTRIBUTING.md` | Yes | Skimmed for the no-`any`/`rateLimitAsync`/`safeApiError` rules referenced by D5 |
| `package.json` | Yes | Full read |
| `prisma/schema.prisma` | Partial | Referenced for migration name only (not fully diffed line-by-line — flagged as Tier B) |
| `git log --oneline -50` | Yes | Scanned in full |

No other root file matches the four patterns. The prompt's assumption that `ACADEMIC_REVIEWER.md` and `PIPELINE_ARCHITECTURE_AND_PERFECTION_ROADMAP.md` still exist as separate files is **stale as of `f021ae9`** — both were consolidated into `ACADEMIC_REVIEWER_MASTER.md` on the same day as this pass, which itself absorbed and closed out nearly every open item those two docs used to track.

## Baseline reconciliation

| Item (source doc) | Status per doc | Status now (evidence) |
|---|---|---|
| A1–A6 (Tier A, `HARDENING_AUDIT.md`) | ✅ Fixed | **Confirmed still fixed.** `requireWorkspaceOwner`, `safeApiError`, viewer write-gating all present; spot-checked `review-layout/route.ts` (uses `requireWorkspaceEditor`). |
| A3 "38 routes" rate-limit claim | ✅ Fixed, 38 routes | **Confirmed and re-verified against current tree**, not just accepted. `Get-ChildItem app/api -Recurse -Include route.ts` → 43 total route files, 38 export a mutating verb (`POST`/`PUT`/`PATCH`/`DELETE`), **all 38 call `rateLimitAsync`** (checked for the async variant specifically, not just the string `rateLimit`). Count is unchanged and accurate post-`f021ae9`. |
| B1 `NEXT_PUBLIC_YJS_URL` old name | ✅ Fixed | **Confirmed**: 0 matches repo-wide (excluding `node_modules`). |
| B5 centralized `WORKSPACES_ROOT` | ✅ Fixed | **Confirmed**: only 4 matches for `process.cwd().*workspaces` in `app/`+`lib/`, and all 4 are the canonical definition in `lib/workspace-files.ts` (comment + implementation) or its own test file. No stray call sites. |
| A2 "no raw error leaks", verified via `grep error: String\(` | ✅ Fixed, 0 matches | **Re-verified, doc's grep is still literally true (0 matches) — but the check was too narrow.** Found a genuine new instance the pattern doesn't catch: `app/api/ingestion/parse/route.ts:686` sends `detail: String(err)` unconditionally over the SSE stream on an asset-persistence DB failure. Same file's other three catch blocks (lines 180, 743) either use `.message` safely or gate the raw string behind `NODE_ENV === "development"` (line 743) — this one path is the odd one out. **New Tier A finding, see below.** |
| A-2 `review-layout` unconditional `wsl` spawn | ✅ Fixed (2026-09-02) | **Confirmed.** Read the full file: no raw `wsl`/`spawn` call remains; it goes through `runSandboxedLatex()` and returns 503 with `PDF_TOOLS_UNAVAILABLE` when the compiler is unavailable in production. |
| C2 dead code removal (`d3`, audit-trail, webhook, firecrawl) | ✅ Done | **Confirmed** — `d3` and `@types/d3` absent from `package.json` dependencies; `knip` present as devDependency with a `deadcode` script. (Stale copies of `d3` remain physically in `node_modules/` from a transitive dependency — not a `package.json` issue, not re-flagged.) |
| C4 `any` cleanup, "~25 remain in app/api" | ⚠️ In progress | **Improved beyond what the doc credits itself for.** Current count in `app/api/**`: **10** occurrences of `: any`, concentrated in exactly 2 files — `compile/route.ts` (6) and `review-layout/route.ts` (4) — both already named in the doc's own "Remaining" list, and both already down from the doc's per-file counts. The doc's aggregate estimate (~25) is now stale-high; update it to 10. (Broader repo: `lib/` has 67, `components/` has 26 — outside the C4 scope as originally defined, but worth widening the item's scope — see Tier C.) |
| AI pipeline P0–P3 (Tasks 1–14), `ACADEMIC_REVIEWER_MASTER.md` §8–9 | ✅ All done | **Confirmed via the doc's own scorecard and Remaining-open-items table** — every task row reads ✅ done. `multiAgentDebate` UI checkbox is implemented in `thesis-review-panel.tsx` and wired to backend. Only JSON-Schema-mode structured decoding remains roadmap. |
| CI/tests: 4 new Round-3 test files actually run | Implied by doc | **Confirmed they run in CI**: `.github/workflows/ci.yml` runs `pnpm test -- --run` (the full Vitest suite, which includes `__tests__/api/rate-limit-coverage.test.ts`, `safe-api-error.test.ts`, `snapshot-restore.test.ts`, `workspace-isolation.test.ts`) before the Playwright step. |
| Playwright/Yjs CI gap ("e2e boots `next dev`, not `server.ts`") | Known issue (not in HARDENING_AUDIT.md, but a standing architectural fact) | **Confirmed still real.** `playwright.config.ts`: `command: process.env.CI ? 'pnpm exec next dev --port 3333' : 'pnpm run dev'`. In CI (`CI=true` is set in the workflow), the webServer is plain `next dev`, which does **not** run the custom `server.ts` that mounts the Yjs WebSocket. Any e2e assertion that depends on real-time collaboration is exercising a different server topology than production. `tests/collaboration.spec.ts` exists — its CI runs are not exercising the real transport. |

## Executive summary

- **New Tier A finding**: `app/api/ingestion/parse/route.ts:686` leaks a raw `String(err)` to the client over SSE on DB-persistence failure, inconsistent with the file's own `NODE_ENV`-gated pattern two catches later — a narrow, one-line fix. (impact: low-medium; confidence: high — file:line verified)
- **CI never exercises the real collaboration server.** `playwright.config.ts` runs plain `next dev` in CI instead of `server.ts`, so `tests/collaboration.spec.ts` never touches the actual Yjs WebSocket path that production uses. This is a known-shaped gap, now re-confirmed against the current config rather than assumed. (impact: medium; confidence: high)
- **`GET /api/workspaces` is unbounded** — no `take`/pagination on the per-user workspace list with a nested `outputs` include; fine at current scale, a real cost as workspace count per user grows. (impact: low-medium; confidence: high, Tier B — not yet load-tested)
- **C4 `any`-cleanup is further along than `HARDENING_AUDIT.md` credits**: 10 remaining in `app/api/**`, not ~25 — the doc's own outstanding-work count is stale and should be corrected, not re-litigated as if still large. (impact: low; confidence: high)
- **A3's "38 routes, all rate-limited" claim re-verified as still exactly true** post-`f021ae9`, using a stricter check (async variant specifically) than the doc's own grep — worth stating plainly rather than re-auditing from scratch. (impact: none — confirms clean; confidence: high)
- **No unsandboxed `spawn`/`exec` found** beyond the four call sites in `HARDENING_AUDIT.md`'s "Compiler Sandboxing" list; grep hits elsewhere in `app/api` were all `RegExp.prototype.exec()` false positives, checked individually. (impact: none — confirms clean; confidence: high)
- **`ACADEMIC_REVIEWER_MASTER.md` has already absorbed and closed nearly all P0–P3 AI-pipeline roadmap items**; `multiAgentDebate` UI toggle is implemented, leaving only JSON-Schema-constrained decoding as future roadmap. (impact: n/a — reconciliation, not a new finding)

## Tier A — verified, ready to execute

### A-N1: SSE error leak in ingestion parse route
- **Current behavior (proof):** `app/api/ingestion/parse/route.ts:680-688` — on `prisma.$transaction` failure while persisting extracted assets, the code sends `{ type: "error", error: "Failed to save extracted assets to database", detail: String(err) }` over the SSE stream, unconditionally, to the client.
- **Desired behavior:** Match the pattern already used at line 743 in the same file's outer catch: only include raw error detail when `process.env.NODE_ENV === "development"`, otherwise omit `detail` or use a generic message.
- **Fix:** Change line 686 to `detail: process.env.NODE_ENV === "development" ? String(err) : undefined,`
- **Acceptance check:** `Select-String -Path app\api\ingestion\parse\route.ts -Pattern "detail:\s*String\(err\)"` returns 0 matches; a forced DB failure in a production-mode run returns no raw error text in the SSE `error` event.

## Tier B — verify-then-fix

### B-N1: Unpaginated `GET /api/workspaces`
- **First pass done:** `app/api/workspaces/route.ts:14-30` — `prisma.workspace.findMany({ where: { OR: [{ userId }, { members: { some: { userId } } }] }, include: { outputs: {...} } })` has no `take`/`skip`/cursor.
- **Not yet traced:** whether any real deployment has users with enough workspaces (tens to hundreds) for this to matter in practice, and whether the frontend workspace switcher (`components/workspace-selector.tsx`) already assumes an unbounded list (i.e. whether adding pagination is a backend-only change or needs UI work too).
- **Next step to run:** `grep -rn "api/workspaces\b" components/ hooks/` to find every caller, then check max observed workspace count in `prisma/dev.db` or ask the team.

### B-N2: `any` usage outside `app/api/**`
- **First pass done:** `lib/` has 67 occurrences of `: any`, `components/` has 26 — both outside the scope `HARDENING_AUDIT.md`'s C4 item was written against (`app/api/**` only).
- **Not yet traced:** per-file breakdown, or how many are in test files (lower priority) vs. production `lib/` modules.
- **Next step to run:** `Get-ChildItem -Path lib -Recurse -Include *.ts,*.tsx | Where-Object { $_.FullName -notmatch '__tests__' } | Select-String ": any" | Group-Object Path | Sort-Object Count -Descending` to get a prioritized file list before deciding whether to fold this into a widened C4 or leave it as-is.

### B-N3: `prisma/schema.prisma` diff in `f021ae9` (168 lines changed)
- **Not yet traced:** this pass read the migration name only (`20260902120000_vector_graph_thesis`) referenced in `ACADEMIC_REVIEWER_MASTER.md`, not the actual schema diff. Given the commit message explicitly says "workspace path consolidation," any model/field renames here could affect other Tier B items (e.g. whether `WorkspaceSnapshot` retention logic in `history/route.ts` still matches the current schema).
- **Next step to run:** `git show f021ae9 -- prisma/schema.prisma` and diff against `HARDENING_AUDIT.md`'s A-1 "schema/migration drift" finding to confirm it's still fully resolved, not just resolved as of the migration's creation.

## Tier C — roadmap, not a spec

### C-N1: Widen the `any`-elimination effort beyond `app/api`
Confirmed missing: no lint rule currently fails the build on `: any` outside whatever CONTRIBUTING.md documents as a convention (not enforced by `eslint.config.mjs` as a hard error, per the C4 "Remaining" framing being advisory). A `no-explicit-any` ESLint rule set to `error` (with a scoped `// eslint-disable-next-line` allowance for the two known `app/api` files until B-N2 lands) would make regressions visible in CI rather than requiring periodic manual greps like this one. First step: add the rule in `warn` mode first, get a clean count, then flip to `error` once `lib/`'s 67 occurrences are triaged (not before — see B-N2).

### C-N2: JSON-Schema-constrained decoding
`multiAgentDebate` UI control is now implemented in `thesis-review-panel.tsx`. JSON-Schema-constrained decoding remains identified as "Future" in `ACADEMIC_REVIEWER_MASTER.md` §8's "Remaining open items" table — not re-specified here since the source doc already frames it as roadmap, not ready-to-execute.

## Product notes

- **Ingestion flow**: the SSE progress stream (`app/api/ingestion/parse/route.ts`) is well-instrumented with granular `stage`/`progress` events, which is good UX for a multi-minute MinerU parse — but the one raw-error leak (Tier A-N1) means a DB hiccup after a successful parse currently surfaces internal error text in whatever toast/panel renders the `error` SSE event.
- **Thesis-review UX**: per `ACADEMIC_REVIEWER_MASTER.md` §3's own verdict, `professionalMode` is still off-by-default for most reviews unless `reviewKind === "paper"` or a reporting standard is detected — Task 1 added a manual checkbox, but the default path a typical thesis review takes is still the single-shot generation, now augmented with deterministic checks and grounding (Task 11) rather than the full evidence-anchoring/epistemic-tagging pipeline. This is already the doc's own headline finding, not new — flagging here only because it's the single most consequential UX fact about the reviewer for someone reading this document without also reading the source doc.
- No new product-flow gaps surfaced walking `components/ingestion/`, `components/thesis-review/`, or the compile/export routes beyond what's already covered above — this pass did not do a full manual click-through of every flow (compile → export → thesis-review end-to-end), so treat "walked the routes and components read this session" as the actual scope, not a full UAT pass.

## Dimensions covered

- **A. Security & correctness** — Checked: Tier A/B claims from `HARDENING_AUDIT.md` spot-verified against current files (not just re-read the doc); new route count vs. rate-limit coverage re-derived independently (38/38, matches doc); grepped for unsandboxed `spawn`/`exec` across `app/`, `lib/`, `scripts/` (none found beyond the 4 known sandboxed sites); found one new raw-error-leak instance the doc's own verification grep doesn't catch (Tier A-N1).
- **B. AI layer quality** — Checked against `ACADEMIC_REVIEWER_MASTER.md`, which already supersedes the two docs this prompt expected to find separately; all P0–P3 tasks confirmed done per that doc's own scorecard, two "Future" items correctly left as roadmap, not re-derived from scratch per instruction.
- **C. Code quality & maintainability** — Checked: current `any` count in `app/api` (10, down from doc's stated ~25) and confirmed it's now concentrated in exactly the 2 files the doc names; did not re-run `knip` this pass (Tier B/unverified — no evidence gathered either way on whether its output is acted on); did not get a full TODO/FIXME breakdown by file, only a raw repo-wide count (69).
- **D. Architecture & reliability** — Checked: `review-layout` wsl-spawn removal confirmed fixed; did not trace the in-memory rate-limit fallback behavior under real concurrent load, or the Yjs collaboration server's failure modes beyond confirming CI doesn't exercise it (folded into Tier A/G finding on the Playwright gap).
- **E. Performance** — Checked: grepped every `findMany` call in `app/api/**` for missing pagination; found one real gap (`GET /api/workspaces`, Tier B-N1) and confirmed `history/route.ts`'s snapshot listing is already correctly bounded (`take: MAX_SNAPSHOTS`) — did not check client/server component boundaries or bundle size this pass.
- **F. Product usefulness** — Checked at the level of reading route/component code for the flows discussed above; did not do a live click-through UAT pass.
- **G. Testing & CI** — Checked: confirmed the 4 Round-3 test files run in `pnpm test -- --run` inside `ci.yml`; confirmed the Playwright/Yjs gap is still real by reading `playwright.config.ts`'s CI-conditional `webServer.command`. Did not audit every other test file for mock-only assertions beyond this.
