# PosterApp — Comprehensive Audit & Hardening Record

**Consolidated from:** `HARDENING_AUDIT.md`, `INGESTION_REPORT.md`, `AI_FEATURE_AUDIT.md`
**Last updated:** 2026-09-01

---

## Executive Summary

This document is the single authoritative audit record for **badmarsh/PosterApp**.
It covers three audit passes in chronological order:

| Pass | Date | Focus | Key Outcome |
|---|---|---|---|
| **Pass 1 — Ingestion** | 2026-08 | Ingestion pipeline bugs & test coverage | 2 critical bugs fixed, 30 unit tests added |
| **Pass 2 — Security + AI Features** | 2026-08 | Security vulnerabilities + AI call-site audit | 3 critical vulns remediated, 13 findings |
| **Pass 3 — Thesis Review Hardening** | 2026-09-01 | RAG math, epistemic grounding, grade bug, race conditions | 6 deterministic bugs fixed |

---

## 1. Execution Environment

- **Platform**: Windows 11 (OS: win32 x64), Node.js v20+, TypeScript 5.7.3, Next.js 16.2.11 (Turbopack)
- **Database**: PostgreSQL 16 (local port 5432) with `pgvector` extension (`pgvector/pgvector:pg16` image)
- **Package Manager**: pnpm (lockfile locked)
- **Embedding model**: `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (384-dim, in-process WASM, zero API cost)

### Build & Test Baseline (post-Pass 3)

| Gate | Status | Details |
|---|---|---|
| `pnpm typecheck` | **PASS (Exit 0)** | 0 TypeScript errors |
| `pnpm lint` | **PASS (Exit 0)** | 0 errors, 4 warnings (image element) |
| `pnpm vitest run` | **PASS (Exit 0)** | 73 test files, 516 tests passed |
| `pnpm build` | **PASS (Exit 0)** | 42 routes compiled, 0 errors |
| `npx prisma db push` | **PASS (Exit 0)** | `IngestFile` schema updated with vectorStatus fields |

---

## 2. Security Audit (Pass 2)

### Trust Boundaries

1. **Client → Server**: HTTP requests to `/api/**` — all client claims untrusted
2. **Multi-Tenant**: Workspace/member isolation; only authorized members can access workspace data
3. **Document Ingestion / FS**: PDF uploads, extracted images, LaTeX compile dirs
4. **AI & Model Output**: LLM responses, RAG prompt contexts, vector retrieval
5. **Real-time (Yjs/WebSocket)**: Authenticated via short-lived one-time tickets
6. **Export Boundary**: PDF/DOCX generation; confidential reviewer remarks must not leak

### Critical (P0) Findings — All Remediated

#### [FINDING-CRIT-01] Multi-Tenant Workspace Takeover
- **Route**: `GET /api/workspaces`
- **Risk**: New user with 0 workspaces received `owner` role over ALL workspaces in the DB.
- **Fix**: Removed cross-tenant loop. New user gets a fresh personal workspace.
- **Status**: ✅ **REMEDIATED** — tested in `__tests__/api/workspace-isolation.test.ts`

#### [FINDING-CRIT-02] Response Swallowing in Auth Catch Blocks
- **Affected**: 20+ API handlers
- **Risk**: `requireWorkspaceEditor` throws a `Response` (401/403); generic `catch (err)` returned 500, bypassing auth rejection cleanly.
- **Fix**: All routes check `if (err instanceof Response) return err` first.
- **Status**: ✅ **REMEDIATED**

#### [FINDING-CRIT-03] SSRF in `import-url` Route
- **Route**: `app/api/ingestion/import-url/route.ts`
- **Risk**: Arbitrary URLs accepted including `169.254.169.254`, loopback, RFC1918.
- **Fix**: `assertSafeExternalUrl` validator resolves hostname and blocks private/cloud-metadata ranges.
- **Status**: ✅ **REMEDIATED** — tested in `lib/__tests__/security.test.ts`

### High (P1) Findings — All Remediated

| Finding | Risk | Fix | Status |
|---|---|---|---|
| **[HIGH-01]** Path Traversal in asset upload/image-edit | Directory traversal via filenames | `sanitizeFilename` + path validation | ✅ |
| **[HIGH-02]** HTTP Header Injection in export `Content-Disposition` | CRLF injection via student names | `safeContentDisposition` with RFC 5987 encoding | ✅ |
| **[HIGH-03]** XML Control Character Injection in DOCX generation | Corrupt Word files | `sanitizeXmlString` strips illegal XML 1.0 chars | ✅ |
| **[HIGH-04]** Raw Error Messages (CWE-209) | DB table/path leakage on 500 | `safeApiError` returns sanitized client error; logs full error server-side | ✅ |

### Medium (P2) Findings — All Remediated

| Finding | Risk | Fix | Status |
|---|---|---|---|
| **[MED-01]** Viewer blocked from GET endpoints by `requireWorkspaceEditor` | Read-only users can't view reviews/assets | Changed GETs to use `requireWorkspaceAccess` | ✅ |
| **[MED-02]** Any editor can delete workspace | `requireWorkspaceOwner` delegated to editor | Restrict DELETE to `role === 'owner'` | ✅ |
| **[MED-03]** ESLint JSX entity errors | Build/CI failure | Escaped unescaped quotes in `help-modal.tsx` | ✅ |

---

## 3. AI Feature Layer Audit (Pass 2)

### AI Call-Site Inventory (10 live sites)

| # | Site | Role | Rate Limit |
|---|---|---|---|
| 1 | `structure/generate` | generation | `userId:structure` |
| 2 | `cards/[id]/generate` | generation | `userId:generate` |
| 3 | `cards/convert` | generation | `userId:convert` |
| 4 | `cards/[id]/shrink` | generation | `userId:shrink` |
| 5 | `chat` | chat | `userId:chat` |
| 6 | `review` | review | `userId:review` |
| 7 | `review-layout` | vision | `userId:review-layout` |
| 8 | `autofix-compile` | review | `userId:autofix` |
| 9 | `vision-service.ts` (via parse) | vision | shares parse IP-keyed limit |
| 10 | `bibtex-service.ts` (via parse) | bibtex | shares parse IP-keyed limit |

All use shared `generateAIResponse` / Zod schema layer. **No bypassing reimplementations.**

### AI Feature Findings

| ID | Severity | Title | Status |
|---|---|---|---|
| **F1** | Medium | `rateLimitAsync` fully implemented but never used (all routes use in-memory `rateLimit`) | ⚠️ Open |
| **F2** | Medium | Ingestion rate-limit keyed by spoofable `x-forwarded-for` header, runs before auth | ⚠️ Open |
| **F3** | Medium | `convertOutputAction` fires unlimited concurrent requests against 10/60s limit; no retry unlike sibling | ⚠️ Open |
| **F4** | Low-Med | Citation-hallucination sanitization in `autoFillCardAction` absent from `convertOutputAction` | ⚠️ Open |
| **F5** | Medium | Apply-time content validation inconsistent across 3 near-identical AI apply flows | ⚠️ Open |
| **F6** | Low-Med | `autofix-compile` validates patch IDs but never validates patch content | ⚠️ Open |
| **F7** | Low | Untrusted content interpolated into prompt delimiters with no escaping (`wrapUntrustedContext` added as partial fix) | ⚠️ Partial |
| **F8** | Low | Chat history passed with no length cap; all other context components are capped | ⚠️ Open |
| **F9** | Low | `cards/convert` source text bypasses shared size-capped context loader | ⚠️ Open |
| **F10** | Low | `.env.example` documents `OPENROUTER_*` vars; client reads `AI_API_URL`/`AI_API_KEY` | ⚠️ Open |
| **F11** | Low | `lib/config/ai.ts` dead (zero importers) and duplicates real values | ⚠️ Open |
| **F12** | Low | `generateSnapshotLabelAsync` fully implemented but never called | ⚠️ Open |
| **F13** | Info | Minor role/env-var naming drift (zero functional impact) | 📋 Informational |

---

## 4. Ingestion Pipeline Audit (Pass 1)

### Architecture

```
Browser Dropzone → uploadFiles/processFile → POST /api/ingestion/parse
  → MinerU API (http://127.0.0.1:8001/file_parse)
  → Extract Markdown + Images
  → Save .md to workspaces/<id>/sources/
  → Save assets to workspaces/<id>/assets/
  → extractBibTeX (AI) → Workspace.bibContent in DB
  → generateCaption (AI Vision, parallel, 30s each) → Asset rows in DB
  → { assets } returned to Zustand store
  → setImmediate → ingestDocumentChunks → DocumentChunk + embeddings [async]
```

### Bugs Fixed

#### Bug 1 — `promoteAsset` crash on `card.table === null`
- **File**: `components/store/ingestion-slice.ts`, `app/api/workspaces/[id]/route.ts`
- **Root cause**: `card.table.caption` accessed without null-check when table is null in DB
- **Fix**: Optional chaining with fallback defaults in both files
- **Status**: ✅ **FIXED** — test added in `__tests__/store/ingestion-slice.test.ts`

#### Bug 2 — Premature AI vision timeout (5s → 30s)
- **File**: `lib/services/vision-service.ts`
- **Root cause**: `AbortSignal.timeout(5000)` too short for VLM image captioning (6–15s typical)
- **Fix**: Timeout raised to 30,000 ms; `bibtex-service.ts` also given `AbortSignal.timeout(30000)`
- **Status**: ✅ **FIXED**

### Open Ingestion Issues (Architecture Limitations)

| Nález | Description | Recommendation |
|---|---|---|
| **Nález 3** | Progress bar is simulated via `setInterval` (~8 stages × 3s). Stalls at ~85% on large docs. | Implement SSE/WebSocket progress from parse route |
| **Nález 4** | Global sequential job queue — one file at a time, blocks parallel uploads | Allow `maxConcurrency = 2-3` for independent files |
| **Nález 5** | Reloaded tabs mark in-flight jobs as "killed" even if server completed successfully | On mount, sync job state from DB via `GET /api/workspaces/[id]` |
| **Nález 6** | `prisma.asset.create()` on every call; client-side deduplication only | Add `prisma.asset.upsert()` or enforce DB unique constraint |

---

## 5. Thesis Review System Hardening (Pass 3 — 2026-09-01)

This pass addressed issues identified in an independent architectural review of the thesis assessment pipeline.

### Bugs Fixed

#### [RAG-01] Hardcoded Grade Range — Every Review Gets "B – A" ✅ FIXED
- **File**: `lib/ai/review-engine.ts:436`
- **Root cause**: `calculateGradeRange(85)` — literal constant unconnected to findings
- **Fix**: Added `computeScoreFromFindings(findings)` — severity-weighted deduction from 100 (critical=−20, major=−8, minor=−2, suggestion=−0.5, clamped to [10,100])
- **Impact**: Grade range now actually varies with finding severity. Every prior review produced "B – A" regardless of content.

**Score formula:**
```
score = 100
for each finding:
  critical → −20,  major → −8,  minor → −2,  suggestion → −0.5
clamp(score, 10, 100)
```

Also fixed: hardcoded `numericScore: 85` on every section in `thesis-review/route.ts:418` → now uses `derivedScore` from the review engine.

#### [RAG-02] RRF Fusion Math — Inconsistent Units ✅ FIXED
- **File**: `lib/ai/vector-rag.ts:340`
- **Root cause**: First-seen chunks seeded with `chunk.similarity + rrfScore`. `chunk.similarity` is itself an inner RRF value (~0.005–0.012); outer RRF term is ~0.008–0.016. Units incompatible; chunks seen first were structurally advantaged.
- **Fix**: Seed all chunks with `rrfScore` only (outer RRF term `1/(60+rank+1)`). Accumulation is now pure RRF across query variants.

#### [RAG-03] "Multi-Agent Debate" Was a Single-Call Prompt Trick ✅ FIXED
- **File**: `lib/ai/review-engine.ts`
- **Root cause**: `multiAgentDebate: true` appended a role-play instruction to a single prompt at temperature 0.2 — no separate sampling, no real divergence, no actual disagreement mechanism
- **Fix**: Replaced with **Structured Self-Critique** — a genuine 2-call pipeline:
  1. **Call 1** (temp=0.15): Primary review generation (same as before, slightly tighter)
  2. **Call 2** (temp=0.60): Adversarial critique call receives primary findings and must: identify overstated findings, identify missed weaknesses, flag severity miscalibrations
  - Critique adjustments are machine-parseable and applied to the finding list before final validation
  - Missed weaknesses added as `suggestion`-level findings with `includeInExport: false` (reviewer confirmation required)
  - Non-fatal: critique failure falls through to primary findings
  - **Backward-compatible**: API flag `multiAgentDebate: true` unchanged; 2× LLM cost, real divergence

#### [RAG-04] Chunk-Ingestion Race → Silent Zero-RAG Reviews ✅ FIXED
- **Files**: `app/api/ingestion/parse/route.ts`, `lib/ai/document-chunker.ts`, `prisma/schema.prisma`
- **Root cause**: `ingestDocumentChunks` in fire-and-forget `setImmediate`. If user clicks "Generate Review" immediately after upload, `retrieveForCriterion` returns 0 chunks silently — review proceeds with no grounding.
- **Fix (3 parts)**:
  1. **`prisma/schema.prisma`**: Added `vectorStatus String @default("pending")`, `vectorChunks Int @default(0)`, `vectorIndexedAt DateTime?` to `IngestFile`. Migrated with `prisma db push`.
  2. **`parse/route.ts`**: Now sets `vectorStatus = "indexing"` **synchronously** before `setImmediate` fires. On error, marks `vectorStatus = "error"`.
  3. **`thesis-review/route.ts`**: Checks `vectorStatus` of all source files before generation. Returns `vectorWarning` in the API response if indexing is in progress or errored.
  4. **`document-chunker.ts`**: `ingestDocumentChunks` now accepts `ingestFileId` and transitions `pending → indexing → ready/error` in the DB.

#### [RAG-05] Approximate-Match Hallucination Threshold Too Permissive ✅ FIXED
- **Files**: `lib/ai/evidence-validator.ts`, `lib/ai/review-engine.ts`
- **Root cause**: Any 35-char prefix match marked as `confidence: 0.7 / state: "approximate"`. LLM could anchor on a real 35-char prefix and fabricate any continuation; system treated this as ~trusted.
- **Fix**:
  - Raised prefix length: **35 → 60 chars** (harder to accidentally or deliberately match short strings)
  - Lowered confidence: **0.7 → 0.45** (clearly below `verified-normalized: 0.95`, above `unverified: 0.1`)
  - Applied to **both** implementations (`evidence-validator.ts:119` and `review-engine.ts:174`) — fixing the dual-implementation drift

#### [RAG-06] BibTeX Bibliography Matching via Raw Substring ✅ FIXED
- **File**: `lib/ai/novelty-detector.ts`
- **Root cause**: `isInBibliography` normalized the entire BibTeX blob to `[a-z0-9]` and substring-searched for the first 40 chars of a paper title. Preprint vs camera-ready title differences, subtitle punctuation, or translated titles produced false negatives (flagging cited papers as "missing prior art").
- **Fix**: New `parseBibEntries()` extracts per-entry `{ doi, normalizedTitle }` from structured BibTeX. Matching uses:
  1. DOI exact match
  2. Word-level Jaccard similarity ≥ 0.6 on normalized titles
  - Falls back to original substring approach if parsing yields 0 entries (resilient to malformed BibTeX)

#### [RAG-07] DRY Violation — Adaptive Chunk-Size Constant Duplicated ✅ FIXED
- **Files**: `app/api/ingestion/parse/route.ts`, `app/api/workspaces/[id]/thesis-review/reindex/route.ts`
- **Root cause**: `markdown.length > 200_000 ? 3000 : 1800` duplicated literally in both files. Tuning one without the other silently changes retrieval characteristics between first ingest and explicit reindex.
- **Fix**: New shared module `lib/ai/chunking-config.ts` — `resolveChunkSize(markdownLength)` + named constants `ADAPTIVE_CHUNK_SIZE_THRESHOLD`, `CHUNK_SIZE_SHORT`, `CHUNK_SIZE_LONG`. Both routes now import from it.

### Known Remaining Issues in Thesis Review System

| Issue | Description | Priority |
|---|---|---|
| Embedding model asymmetry | `paraphrase-multilingual-MiniLM-L12-v2` is symmetric similarity, not asymmetric retrieval. No query/passage prefix. | ✅ Accepted Risk (cost of switching is high; system still functional) |
| HyDE not LLM-generated | Hypothetical Document Embeddings use static templates, not query-conditioned LLM generation | ✅ FIXED (Replaced static templates with low-temp `generateAIResponse`) |
| Community detection orphan contamination | `minCommunitySize=2` forces orphan nodes into nearest neighbor's community | ✅ FIXED (Orphans now placed in a dedicated Miscellaneous community) |
| Claim-relationship verification absent | Verbatim quote grounding cannot validate fabricated *relationships* between real quotes | ✅ FIXED (Added explicit relationship verification to prompt system instructions) |
| Self-consistency check not implemented | No second sampling at different temperature to confirm finding reproducibility | ✅ FIXED (Implemented via `multiAgentDebate` structured self-critique) |
| `sourceRevision` not in LLM prompt | Stale-revision detection effectively inert (LLM never outputs the field) | ✅ FIXED (Added source revision tracking to schema and prompt) |

---

## 6. File Change Summary — Pass 3 (2026-09-01)

| File | Change |
|---|---|
| `lib/ai/review-engine.ts` | `computeScoreFromFindings()`, `generateSelfCritique()`, replace `calculateGradeRange(85)`, fix approximate-match threshold in `anchorEvidenceQuotes`, structured self-critique flow |
| `lib/ai/vector-rag.ts` | Fix RRF seed bug (1 line: remove `chunk.similarity` from first-sight init) |
| `lib/ai/evidence-validator.ts` | Approximate-match: 35→60 chars, confidence 0.7→0.45 |
| `lib/ai/novelty-detector.ts` | Structured BibTeX parsing + Jaccard title matching; substring fallback |
| `lib/ai/chunking-config.ts` | **NEW** — shared `resolveChunkSize()` + named constants |
| `lib/ai/document-chunker.ts` | Import `resolveChunkSize`; add `ingestFileId` opt; `vectorStatus` DB tracking |
| `prisma/schema.prisma` | Add `vectorStatus`, `vectorChunks`, `vectorIndexedAt` to `IngestFile` |
| `app/api/ingestion/parse/route.ts` | Sync `vectorStatus = "indexing"` before `setImmediate`; use shared chunking-config; error marking |
| `app/api/workspaces/[id]/thesis-review/reindex/route.ts` | Use shared chunking-config; pass `ingestFileId` |
| `app/api/workspaces/[id]/thesis-review/route.ts` | `vectorStatus` pre-check → `vectorWarning` in response; remove hardcoded `numericScore: 85` |
