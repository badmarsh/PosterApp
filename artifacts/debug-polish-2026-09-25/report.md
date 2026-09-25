# Debug & Polish Sprint — Report (2026-09-25)

**Branch:** `arena/01a0d958-posterapp` · **Prompt:** `docs/prompts/debug-polish-prompt.md`
**Method:** evidence-backed (▶ EXEC / ✎ STATIC / ? UNVERIFIED per prompt §0)

---

## 1. Verification log (verbatim summary)

| Gate | Before | After | Evidence |
|---|---|---|---|
| `pnpm typecheck` | **215 errors** (Prisma-stub baseline) | **0 errors, exit 0** | ▶ EXEC `pnpm typecheck` → `exit 0`; the 215 were cleared by the repo's own `pnpm prisma:types` (real `prisma generate` blocked — see §4) |
| `pnpm lint` | **1 error**, 372 warnings | **0 errors**, 364 warnings | ▶ EXEC `pnpm lint` → `✖ 364 problems (0 errors, 364 warnings)` |
| `pnpm lint:a11y` | pass | pass | ▶ EXEC → `all icon-only controls have accessible names ✓` |
| `pnpm exec vitest run` | 197 files, 2019 passed / 1 skipped / **0 failed** | 197 files, **2027 passed** / 1 skipped / 0 failed | ▶ EXEC (twice: baseline + post-fix); +8 = new regression tests |
| `pnpm deadcode` (knip) | 12 unused files, config hints | **0 unused files**, hints resolved | ▶ EXEC `pnpm deadcode` |
| `pnpm build` | not run | **exit 0**, all routes compiled | ▶ EXEC `pnpm build` → route table emitted, `Proxy (Middleware)` wired |
| server boot | — | ▶ EXEC `tsx server.ts` → `Next.js ready`, `Yjs WebSocket ready`, `GET /healthz` → `{"ok":true}`, `GET /` → **HTTP 200** (live preview) |

---

## 2. Bugs found & fixed (P-class per prompt §2)

### P1 — feature shipped but dead
- **`components/showcase-gallery.tsx` (677 lines) was imported nowhere.** ✎ STATIC — repo-wide grep found zero importers (knip agreed: "unused file"). Category filters, elite badges, triad previews, search and open/duplicate actions existed but no user could ever reach them.
  **Fix (user decision: wire it):** mounted in `WorkspaceSelector`'s "showcases" tab, replacing the flagship-only grid — every seeded showcase is now browsable, with duplicate/open wired to the existing handlers. Commit `8604d44`.

### P2 — silent user-facing failures (prompt §2.4, feedback matrix)
All eight were `console.error`-only on user-initiated actions (▶ EXEC: file:line for each):

| # | Action that failed silently | Fix | Commit |
|---|---|---|---|
| 1 | Figure editor **Accept** — swallowed server 409 "max versions reached" | toast with server message; failure keeps state | `76466f1` |
| 2 | Figure editor **Discard** — cleared UI before API confirmed | awaited; clears only on success | `76466f1` |
| 3 | Figure **upload** (figures-tab) | `toast.error` | `76466f1` |
| 4 | **Logo upload** (project settings) | `toast.error` | `76466f1` |
| 5 | Agent **key revoke** — non-OK response did nothing | `toast.error` both branches | `76466f1` |
| 6 | **BibTeX import** (citation issues panel) | `toast.error` | `76466f1` |
| 7 | **Source-file delete** (thesis metadata) | `toast.error` | `76466f1` |
| 8 | Ingest **file rename** — optimistic rename diverged on failure | `notify.error` (dedup-aware store channel) | `76466f1` |
| 9 | **Academic search failure rendered "No results"** — a 429/offline looked like empty results | new `searchFailed` state + retry EmptyState, sk/cs/en strings | `76466f1` |
| 10 | Workspace-selector **demo fallback** (clone failure) silent | `toast.info("Demo rezim")` matching sibling path | `8604d44` |

### P2 — lint *error* was a real purity defect
- `workspace-selector.tsx:99` — `react-hooks/purity`: `Date.now()` called in render scope (the only eslint **error** in the repo). ✎ EXEC `pnpm exec eslint components/workspace-selector.tsx`.
  **Fix:** module-scope `copyIdSuffix()` helper (event-time ID generation), commit `8604d44`.

---

## 3. Polish sweep

- **Focus/keyboard a11y** (`88ec844`): 5 controls using mouse-focus `focus:ring-*` → `focus-visible:*`; composer textarea got the missing keyboard ring; autocomplete `role="option"` got `aria-selected`.
- **Design tokens** (`8604d44`, `88ec844`): 33 raw-palette occurrences converted — `showcase-gallery.tsx` (30: amber/rose/sky/indigo/blue/emerald → `warning/destructive/info/status-ambiguous/status-interpretation/success`), `deerflow-panel.tsx` (3 green/amber statuses → `success/warning`, removing `dark:` special-cases). Fixed-black overlay chips → themeable `bg-card/90` chrome; solid amber states → `bg-warning text-warning-foreground` (contrast verified against all 9 theme blocks).
- **KaTeX safety** (`88ec844`): every DOM-bound `katex.renderToString` now pins `trust: false` explicitly (5 call sites; default was already false — defense-in-depth).
- **Repo hygiene** (`a0dfdf2`): 31 tracked scratch files removed (Beamer experiments `test_*`, `texput.*`, patch payloads); `.gitignore` hardened with root-anchored patterns so `tests/` fixtures stay unaffected.
- **Dead code / tool truth** (`94851f5`): `lib/db.ts` (3-line alias, zero importers) deleted; knip entry model now matches reality (operator scripts `scripts/*.{ts,js,cjs}` declared — they are documented manual tools, not dead); 4 stale `eslint-disable` directives removed; `workspace-selector` state typed (`any[]` → `WorkspaceListItem`).
- **Regression suite +8 tests** (`88ec844`, `76466f1`): token sweep extended to gallery/deerflow; new KaTeX `trust:false` suite over all 5 HTML sink files; gallery/deerflow banned from raw palette + `text-white` + `bg-black/`.

---

## 4. Environment blockers (prompt §0.7 — verbatim)

1. **Prisma query engine download blocked:**
   `request to https://binaries.prisma.sh/.../libquery_engine.so.node.sha256 failed, reason: Client network socket disconnected before secure TLS connection was established`
   confirmed independently: `curl ...libquery_engine.so.node.gz` → `OpenSSL SSL_connect: SSL_ERROR_SYSCALL` (exit 35).
   *Fallback used:* repo script `pnpm prisma:types` (schema-derived types + SQL builders without engine) → typecheck fully green. **Runtime DB queries remain impossible in this sandbox** → `/api/workspaces` returns 500 in the preview (DB itself at `dev.significa.sk:5435` is reachable — the engine is the only blocker).
2. **No Clerk tenant credentials** (`.env.local` absent). Fallback: CI's own sanctioned mock keys (`pk_test_mock_…`, `.github/workflows/ci.yml:18-19`) + `E2E_AUTH_BYPASS=1` + `NEXT_PUBLIC_E2E_TEST=1` → app renders (root HTTP 200) and the static showcase gallery is fully interactive; auth and DB-backed flows are not.
3. **No `pdflatex` / Docker** in sandbox → compile matrix and Playwright E2E not executed here (CI runs both; unit suite covers the LaTeX parser).
4. **`next build`**: exit 0 (no blocker).

---

## 5. Deferred (documented, not silently skipped)

| Item | Size | Why deferred |
|---|---|---|
| **188 unused exports** (knip) | large | Needs per-file review; bulk removal without per-item ownership check is exactly the drive-by churn the prompt forbids. Best as its own focused pass with tsc as the safety net. |
| **364 lint warnings** (351 `no-explicit-any`, 10 `no-img-element`/`location.href`, misc `exhaustive-deps`) | large | Typing sweep + `next/image` conversions are behavior-risky in bulk; `window.location.href` full-reload after workspace delete is deliberate (state reset). |
| `extractProposalJsonCandidate` alias flagged by knip as duplicate export | — | Deliberate semantic alias, both names used (`runner.ts`, tests). |
| Playwright E2E | env | Requires real Clerk tenant + live DB — CI's job. |

---

## 6. Commits (this sprint)

```
94851f5 chore: align knip with reality, drop dead lib/db.ts, clean lint debt
88ec844 polish: focus-visible rings, semantic tokens, pinned KaTeX trust
76466f1 fix: surface silent user-facing failures with real feedback
8604d44 feat(workspace-selector): wire ShowcaseGallery; fix purity lint error
a0dfdf2 chore: untrack LaTeX/agent scratch files, harden .gitignore
edf1f0a docs: add debug & polish sprint prompt
```

**Final state:** typecheck 0 · lint 0 errors · a11y ✓ · 2027 tests green · production build green · live preview serving.
