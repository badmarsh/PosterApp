# TASK: PosterApp Debug & Polish Sprint — Find Real Bugs, Fix Them, Then Make It Feel Finished

You are a senior full-stack engineer and product-minded QA agent working on **PosterApp** — a Next.js 16 (App Router) + React 19 + TypeScript academic poster/slide/paper/thesis-review editor with a custom `server.ts` (Next.js + Yjs WebSocket on one port), Zustand editor store, Prisma 5 / PostgreSQL+pgvector, a sandboxed pdflatex pipeline, and a large `lib/ai/**` RAG stack.

You have full read access to the repository and can run commands. Your job has two halves:

1. **DEBUG** — find real, user-visible defects, prove them with execution, root-cause them, and fix them with regression tests.
2. **POLISH** — once the defects are fixed, sweep the product for rough edges: inconsistent UX, dead feedback, accessibility gaps, design-token drift, dead code, and misleading docs.

This is an **execution-backed** task. A finding that you cannot demonstrate (or, when the environment blocks demonstration, cannot pin to `file:line` with a concrete failure argument) does not ship in the report.

---

## 0. Evidence & Conduct Rules (highest priority)

1. **Code is the single source of truth.** README, `AGENTS.md`, comments, and old audits can lie. If docs contradict implementation, report the contradiction.
2. **Tag every finding:**
   - `▶ EXEC` — reproduced by running something (paste the command and the verbatim output/stack).
   - `✎ STATIC` — derived by reading code; cite `file:line` and the concrete failure path.
   - `? UNVERIFIED` — cannot be verified in this environment; say why and what would verify it.
3. **Repro before fix.** For every bug: write the failing test or minimal repro FIRST, watch it fail, then fix, then watch it pass. A fix without a repro is `? UNVERIFIED` and must be flagged as such.
4. **Anti-duplication:** Read `docs/audit/*.md` and `docs/audits/addendum-fixes-2026-09-21.md` before reporting. Findings F-01…F-25 from the 2026-09-21 round are mostly **implemented** (see addendum table) — do NOT re-report them as new; instead give each status `FIXED (verify)` / `STILL-OPEN` / `REGRESSED` with evidence. Deferred roadmap items (F-13, F-15, F-16, F-21, F-23, F-25) are known and out of scope unless you find they regressed.
5. **Do not re-do other prompts' work.** Objectives already specified in `docs/prompts/ui-excellence-upgrade-prompt.md` (inline quick-edit, occupancy heatmap, i18n unification, monolith decomposition, 5-theme contrast audit) are a *different* sprint — mention overlap in one line, don't implement it here unless a bug forces your hand.
6. **No secrets, no destructive ops.** Never print `.env*` contents, connection strings, or API keys. No `prisma migrate reset`, no dropping tables, no deleting user workspaces.
7. **Environment-blocker protocol:** If a tool is missing (`pdflatex`, Docker, Prisma engine downloads — historically blocked in sandboxes), document exactly what is blocked (`which <tool>`, the verbatim error), then switch to a fallback: structural harness, unit test against pure functions, or `ctx.skip()` guards that preserve loud-fail design (see the pattern in `lib/ai/eval/__tests__/pgvector-live.test.ts`). A blocker changes the *form* of evidence, never excuses skipping the area.

---

## 1. Mandatory Verification Phase (run before reading code)

Record verbatim results of each command in the final report:

```bash
git log --oneline -5 && git status --short
pnpm install --frozen-lockfile
pnpm typecheck            # classify every error: product vs pre-existing/env baseline
pnpm lint                 # must be zero NEW warnings vs baseline
pnpm lint:a11y
pnpm test -- --run        # full Vitest suite; triage every failure: product vs env
pnpm deadcode             # knip — report unused exports/files you may remove
```

Then probe the runtime toolchain (do not guess):

```bash
which pdflatex xelatex bibtex latexmk docker node pnpm; node -v; pnpm -v
```

**Baseline discipline:** capture `tsc` and test failures BEFORE touching any file. Your gate is *zero new* type errors, *zero new* lint warnings, and *zero test regressions* relative to that baseline — plus removal of any product-class failures you claim as fixes.

---

## 2. DEBUG — Target Areas (ordered by user damage)

Triage findings into: **P0** data loss / wrong output shipped to user / security · **P1** feature broken or silently degraded · **P2** wrong-but-visible UX behavior · **P3** cosmetic. Aim for at least one executed repro per P-class you claim exists.

### 2.1 LaTeX generation & compile pipeline (historically the richest bug source)
- Escaping: chained `.replace()` regressions, backslash/`<`/`>` rendering, `% _ & # { } ~ ^`, `$5 and $10`, raw commands inside vs outside math.
- Unicode coverage: scientific symbols (`∑ ∫ ∞ ∂ ∇ √ ℏ ⊕`), subscripts/superscripts, diacritics (sk/cs/de/hu/pl), emoji stripping — anything that is compile-fatal for `pdflatex`/`inputenc`.
- Per-template package matrix: every `outputType × template × pattern` needs its packages (`amsmath`, `graphicx`, venue `.cls` requirements) and the right `bibliographystyle` (`BIBSTYLE_BY_TEMPLATE`).
- **Compile-cache staleness:** cache key must cover bib content and asset bytes (F-10 fix) — try to regress it: change an image or bibliography without bumping `revision`, confirm you do NOT get a stale PDF.
- Parallel compiles, mutex behavior, timeout/cleanup, log sanitization, docker→local tier fallback.
- **Fallback if `pdflatex` absent:** structural harness — brace balance, `\begin/\end` stack, feature→package map, cite-key↔bib-key cross-check, asset path existence — each hit tagged `✎ STATIC` with what CI-with-TeXLive would prove.

### 2.2 Multi-output & state correctness
- Zero or two active outputs — which invariant protects this (DB, app code, none)? What does compile do in each state?
- Compiling/exporting when the active output isn't the one the user is viewing (the F-07 class of bug): does any path still read `activeOutputId` instead of the passed `outputConfig`?
- Cards referencing deleted assets; delete cascades (output/card/asset); JSON columns (`Card.table/figures/grounding`, `ThesisReview.sections`, `Output.sourceIds`) runtime-validated or trust-the-caller?
- Optimistic `revision` lock races on `PUT /api/workspaces/[id]` — concurrent saves from two tabs (Yjs vs REST path).

### 2.3 Ingestion, RAG & AI routes
- Ingestion job queue: concurrent parse, retry idempotency, partial-failure state (file stuck `pending`/`indexing` forever?).
- Vector chunking race: `vectorStatus` transitions (`pending → indexing → ready/error`) vs review generation (F-… race documented in `AGENTS.md`).
- Evidence validation: quote anchoring thresholds (≥60 chars, confidence 0.45) — find inputs where a verbatim quote is wrongly rejected or a fabricated one accepted.
- AI routes: timeout/fallback paths must surface errors, never hang the UI; rate-limit fail-safe behavior in production vs dev.

### 2.4 Feedback & error-surfacing audit (the "silent failure" class)
- Grep for `.catch(() => {})`, `catch {}`, `console.error` without user feedback, `pushEvent`-only failures when the Agent panel is closed, and fetches whose state is never read.
- Every user-initiated action (save, generate, compile, export, delete, switch project, ingestion) must end in one of: visible success, visible error, or visible progress. Produce a table: Action → success feedback / error feedback / verdict.

### 2.5 Collaboration & persistence
- Yjs ticket auth (`posterapp-yjs-v1` protocol), reconnect behavior with pending edits, `YPERSISTENCE` durability assumption.
- localStorage-persisted store vs server reload: does `tests/persistence.spec.ts`-style recovery actually hold (run it if the env allows)?

---

## 3. POLISH — Sweep (only after P0/P1 fixes are in)

Execute these as small, verifiable passes. Each pass: grep/read → list of concrete instances (`file:line`) → fix → gate.

1. **Design-token purity:** no raw Tailwind palette (`gray-*`, `blue-*`, `text-black`, `bg-white`, `border-[#…]`) in component trees; use semantic tokens (`background`, `foreground`, `muted`, `destructive`, `warning`, `success`, `info`, `chart-*`). Fix malformed opacity chains (`bg-warning/100/10`). Verify across themes with the dev server if runnable.
2. **Focus & keyboard:** one focus-ring spec (`focus-visible:ring-1 ring-ring/40` for primitives, `ring-2` for raw buttons), no bare `focus:ring`, Escape works in every overlay, focus trapped in modals and returned on close. `pnpm lint:a11y` must be clean.
3. **Destructive-action safety:** every delete (card, output, review, asset, workspace) goes through `ConfirmDialog` or an undo path; no one-click data loss.
4. **Loading truth:** spinners match final layout (no layout shift), save/generate buttons show busy state, skeletons cover all columns of the shell.
5. **Copy & i18n consistency:** no half-Slovak/half-English surfaces in the same flow; labels that are hardcoded per-locale (the `academicYearLabel` class of bug) fixed; user-facing strings free of dev jargon and leaky IDs.
6. **Dead weight:** remove files/exports knip flags (after confirming no dynamic references), remove dead fetches, unused CSS utilities, empty test artifacts at repo root (`test_*.tex/.nav/.out/.snm/.toc/.vrb`, `texput.*`) if they are indeed scratch — check `.gitignore` conventions first.
7. **Docs honesty:** `README.md`, `AGENTS.md`, `.env.example` must match reality (scripts, ports, service URLs). One-line corrections only; no doc rewrites.

---

## 4. Invariants & Safety Constraints (non-negotiable)

1. **Test suite:** zero regressions vs the pre-run baseline; any test you touched must pass 3× consecutively (flaky tests you meet are reported, not silently re-tried).
2. **`pnpm typecheck` and `pnpm lint`:** zero NEW errors/warnings; you must state the pre-existing baseline counts.
3. **No new runtime dependencies** for polish work. Use Tailwind, existing `@base-ui/react`, Lucide, Zustand, Framer Motion/CSS.
4. **State stays in Zustand slices** under `components/store/`; no new state libraries.
5. **Security:** no `dangerouslySetInnerHTML` without sanitization; respect CSP; LaTeX sandbox flags untouched; no secrets in logs, reports, or test fixtures.
6. **DB:** read-only against the real database unless a migration is the fix; no destructive SQL. If Prisma engine is blocked, follow rule 0.7.
7. **Commit discipline:** one focused commit per fix/pass (e.g., `fix(latex): …`, `fix(store): …`, `polish(a11y): …`), each with its regression test in the same commit. No drive-by reformatting.

---

## 5. Deliverables

1. **Fixes** with regression tests, committed as focused commits on the working branch.
2. **Report** at `artifacts/debug-polish-<YYYY-MM-DD>/report.md` containing:
   - **Verification log:** verbatim outputs of §1 commands (before and after).
   - **Findings table:** `ID | P-class | title | evidence tag | file:line | repro command | status (FIXED / STILL-OPEN / DEFERRED / NOT-A-BUG) | commit`.
   - **Audit cross-check:** status of F-01…F-25 (`FIXED (verify)` / `STILL-OPEN` / `REGRESSED`) — one row each, evidence-backed.
   - **Feedback matrix** from §2.4 (Action → success/error/progress → verdict).
   - **Polish sweep tables:** token violations found/fixed per area, focus-ring exceptions fixed, destructive actions now guarded.
   - **Environment blockers:** what was blocked, the verbatim error, and the fallback evidence used.
3. **Deferred list:** anything not fixed, with the one-sentence reason and the smallest next step.

## 6. Acceptance Criteria

The sprint is done when all of the following hold:

1. Every P0/P1 finding is either `FIXED` with a passing regression test, or `DEFERRED` with an explicit environmental/product reason.
2. `pnpm typecheck`, `pnpm lint`, `pnpm lint:a11y` show zero new issues vs baseline; `pnpm test -- --run` shows zero regressions (env-only failures documented, tagged `? UNVERIFIED`).
3. The feedback matrix has no silent-failure row left unaddressed (each either fixed or explicitly accepted with rationale).
4. The report exists at the required path, every `▶ EXEC` row includes a command + verbatim output, and no secret material appears anywhere in it.
5. Repo root scratch artifacts are either justified or removed, and knip output shows no newly introduced dead code.
