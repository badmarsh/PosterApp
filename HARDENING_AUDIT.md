# Security Hardening Audit — Round 3

**Target commit:** `7bc0945` (main)  
**Date:** 2026-09-02  
**Auditor:** AI Agent (Hardening Round 3 session)

This document records the security hardening claims, corrections, and fixes applied during Round 3 of the PosterApp security audit. It supersedes the previous `HARDENING_AUDIT.md` that was deleted at commit `7bc0945`.

---

> **Round 4 (2026-09-03):** an independent read-only audit of `f2930ad6` re-verified the claims below and found four divergences that are now fixed on this branch — remote-figure SSRF in `lib/latex/remote-assets.ts` (no host/DNS/redirect validation; bytes retrievable via export), incomplete optimistic-revision gating on card/asset routes, a CSP that still allowed `'unsafe-eval'` in production, and a production start script (`next start`) that did not host the Yjs WebSocket. See `CHANGELOG.md` → *Hardening Round 4* for the complete list of changes and the regression tests added (`lib/latex/__tests__/remote-assets.test.ts`, `lib/__tests__/e2e-bypass.test.ts`, `__tests__/api/card-route-isolation.test.ts`, `lib/latex/__tests__/validation.test.ts`).

## Tier A — Security Correctness (All ✅)

### A1: Workspace DELETE requires owner-only access
- **Claim:** `DELETE /api/workspaces/[id]` guarded by `requireWorkspaceOwner`
- **Status:** ✅ Fixed
- **File:** `app/api/workspaces/[id]/route.ts`
- **Evidence:** Line imports `requireWorkspaceOwner`, handler calls it

### A2: No raw error string leaks in API responses
- **Claim:** All JSON error responses use `safeApiError()` from `lib/security.ts`
- **Status:** ✅ Fixed (10 routes updated)
- **Files:** `route.ts` files in workspaces/[id], history, compile, equations, thesis-review, etc.
- **Verification:** `grep -rnE "error: String\(" app/api` returns 0 matches

### A3: Rate limiting on all mutating routes
- **Claim:** Every `POST`/`PUT`/`PATCH`/`DELETE` route imports and calls `rateLimitAsync`
- **Status:** ✅ Fixed (38 routes covered)
- **Regression test:** `__tests__/api/rate-limit-coverage.test.ts`

### A4: Zod body validation on assets route
- **Claim:** `POST /api/workspaces/[id]/assets` validates body with Zod schema
- **Status:** ✅ Fixed
- **File:** `app/api/workspaces/[id]/assets/route.ts`

### A5: Early upload rejection + import-url guards
- **Claim:** `assets/upload` rejects missing/zero `Content-Length` or `transfer-encoding: chunked`
- **Claim:** `import-url` checks `Content-Length`, validates resolved URL via `assertSafeExternalUrl`
- **Status:** ✅ Fixed
- **Files:** `app/api/workspaces/[id]/assets/upload/route.ts`, `app/api/ingestion/import-url/route.ts`

### A6: Viewer write gating (Yjs + collaboration ticket)
- **Claim:** Viewers cannot obtain write tickets; Zustand→Yjs subscription gated on `canWrite`
- **Status:** ✅ Fixed
- **Files:** `app/api/workspaces/[id]/collaboration-ticket/route.ts` (uses `requireWorkspaceEditor`), `components/store/use-yjs.tsx` (lines 102–256 gate on `canWrite`)

---

## Tier B — Correctness & Config Drift (All ✅)

### B1: Environment variable naming
- **Claim:** `NEXT_PUBLIC_YJS_WS_URL` (not `NEXT_PUBLIC_YJS_URL`)
- **Status:** ✅ Fixed
- **Verification:** `grep -rn NEXT_PUBLIC_YJS_URL` returns 0 matches

### B2: Snapshot restore includes all output fields
- **Claim:** `POST /history/[snapId]` restores `authors`, `venue`, `logoUrl`, `secondaryLogoUrl`
- **Status:** ✅ Fixed
- **File:** `app/api/workspaces/[id]/history/[snapId]/route.ts` (lines 136–164)

### B3: Compile mutex for atomic PDF install
- **Claim:** Per-workspace promise mutex prevents concurrent PDF writes
- **Status:** ✅ Fixed
- **File:** `app/api/workspaces/[id]/compile/route.ts` (lines 14–16 declare `workspaceCompileLocks`, lines 122–140 implement mutex)

### B4: BibTeX source resolution extracted
- **Claim:** `resolveBibSource()` in `lib/latex/bib-source.ts` used by compile + export
- **Status:** ✅ Fixed
- **Files:** `lib/latex/bib-source.ts`, `app/api/workspaces/[id]/compile/route.ts` (line 8), `app/api/workspaces/[id]/export/route.ts` (line 10)

### B5: Centralized `WORKSPACES_ROOT`
- **Claim:** No hardcoded `path.join(process.cwd(), "workspaces")` in `app/` or `lib/`
- **Status:** ✅ Fixed
- **File:** `lib/workspace-files.ts` (lines 9–18 define `WORKSPACES_ROOT`)
- **Verification:** `grep -rn 'process.cwd.*workspaces' app lib` returns 0 matches (scripts remain but are dev-only)

### B6: Parse route improvements
- **Claim:** Error messages derive from constants; UUIDs via `crypto.randomUUID()`
- **Status:** ✅ Fixed
- **File:** `app/api/ingestion/parse/route.ts` (line 110 derives MB from `MAX_UPLOAD_BYTES`, lines 340/491/609/694 use `randomUUID()`)

---

## Tier C — Tests, Dead Code, Performance

### C1: Test coverage (✅ Done)
- **New tests:**
  - `__tests__/api/rate-limit-coverage.test.ts` — lint-style guard for rate limiting
  - `__tests__/api/safe-api-error.test.ts` — asserts error sanitization
  - `__tests__/api/snapshot-restore.test.ts` — round-trip snapshot validation
  - `__tests__/api/workspace-isolation.test.ts` — DELETE workspace isolation tests added

### C2: Dead code removal (✅ Done)
- **Deleted:**
  - `components/thesis-review/citation-network.tsx`
  - `lib/audit/audit-trail.ts` + `lib/__tests__/audit-trail.test.ts`
  - `lib/services/webhook-notifications.ts`
  - `lib/services/firecrawl-service.ts`
- **Removed from package.json:** `d3`, `@types/d3`
- **Added:** `knip` devDependency + `"deadcode": "knip"` script

### C3: Performance improvements (✅ Done)
- **Batch card writes:** `app/api/workspaces/[id]/route.ts` line 163 uses `$transaction`
- **Streaming file responses:** `app/api/workspaces/[id]/assets/[...filename]/route.ts` uses `createReadStream` → `ReadableStream`

### C4: `any` type cleanup (⚠️ In Progress)
- **Status:** Partially fixed (~15 of ~40 `any` usages removed)
- **Files updated:**
  - `lib/auth.ts` — added `WorkspaceWithMembers` type
  - `lib/prisma.ts` — exported `Prisma` type
  - `app/api/workspaces/[id]/chat/route.ts` — removed all `any` usages
- **Remaining:** `compile/route.ts` (5), `route.ts` (3), `review-layout/route.ts` (4), `shrink/route.ts` (1), `export/route.ts` (2), `thesis-review/route.ts` (6), `history/route.ts` (1), `backfill-captions/route.ts` (1), `parse/route.ts` (5)

---

## Tier D — Documentation (All ✅)

### D1: HARDENING_AUDIT.md (✅ Recreated)
- **Status:** This file

### D2: README.md YJS docs (✅ Done)
- **Evidence:** Line 70 references `NEXT_PUBLIC_YJS_WS_URL`

### D3: .env.example test gates (✅ Done)
- **Added:** `LATEX_AVAILABLE=` and `YJS_E2E=` (lines 73–75)

### D4: CHANGELOG.md (✅ Done)
- **Evidence:** [Unreleased] section includes security entries

### D5: CONTRIBUTING.md rules (✅ Done)
- **Added:** No-`any` rule, `rateLimitAsync` requirement, `safeApiError` requirement (lines 17–19)

---

## Verification Checklist

```bash
# All must pass:
pnpm typecheck && pnpm lint && pnpm test

# Security guards in place:
grep -rn requireWorkspaceOwner app | wc -l                         # ≥ 1 ✅
grep -rnE "error: String\(" app/api | wc -l                        # 0 ✅
grep -rn NEXT_PUBLIC_YJS_URL . --include=*.mjs --include=*.ts      # 0 ✅
grep -rn 'process.cwd.*workspaces' app lib --include="*.ts"        # 0 ✅

# Dead code removed:
ls components/thesis-review/citation-network.tsx                   # ENOENT ✅
ls lib/audit/                                                      # ENOENT ✅
grep -n '"d3"' package.json                                        # 0 ✅

# Knip added:
grep -n knip package.json                                          # 2 matches ✅
```

---

## Outstanding Work

- **C4 (`any` cleanup):** ~25 `any` usages remain in `app/api/**`, primarily in:
  - `thesis-review/route.ts` (professional mode findings, sections)
  - `compile/route.ts` (Prisma JSON fields via `asProject`)
  - `export/route.ts` (card parsing)
  - `review-layout/route.ts` (workspace typing)

  These are lower-risk (internal JSON manipulation, not user input) but should be addressed in a follow-up pass using Prisma's `Prisma.WorkspaceGetPayload` and `JsonValue` types.

---

## Summary

**Round 3 Status:** 90% complete  
- ✅ Tier A: 6/6 security fixes applied  
- ✅ Tier B: 6/6 correctness fixes applied  
- ✅ Tier C: C1–C3 complete; C4 partially complete  
- ✅ Tier D: 5/5 documentation updates applied  

**Remaining:** C4 `any` type cleanup (~25 occurrences) — functional but not type-safe.
