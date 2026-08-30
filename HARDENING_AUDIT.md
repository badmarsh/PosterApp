# PosterApp Production Hardening & Security Audit

## Executive Summary
This document establishes the comprehensive reliability, application security, and quality audit for **badmarsh/PosterApp**. The audit was executed from empirical verification of the codebase, reproducing test and build baselines, mapping attack surfaces across API routes, authentication/authorization boundaries, document ingestion/export, AI/RAG/vector search, and real-time collaboration.

---

## 1. Execution Environment & Baseline Outcomes

### Environment
- **Platform**: Windows 11 (OS: win32 x64), Node.js v20+, TypeScript 5.7.3, Next.js 16.2.11 (Turbopack)
- **Database**: PostgreSQL 16 (local port 5432) with `pgvector` extension
- **Package Manager**: pnpm (lockfile locked)

### Baseline Verification Commands & Results

| Check / Command | Result | Details |
|---|---|---|
| `pnpm typecheck` | **PASS (Exit 0)** | Zero TypeScript compilation errors across codebase. |
| `pnpm lint` | **FAIL (Exit 1)** | 2 JSX unescaped entities errors in `components/help-modal.tsx` (L329). 4 image element warnings. |
| `pnpm vitest run` | **PASS (Exit 0)** | 57 test files, 378 tests passed. |
| `pnpm build` | **PASS (Exit 0)** | Production build compiled successfully; static & dynamic routes generated. |
| `prisma migrate status` | **PASS (Exit 0)** | Migrations reconciled and verified up to date with schema. |
| Playwright E2E (`pnpm test:e2e`) | **PARTIAL / TIMEOUT** | 19 tests passed; tests requiring external live AI or long timeouts hit test fixture timeouts. |

---

## 2. Threat Model & Trust Boundaries

PosterApp operates in a multi-tenant environment handling sensitive academic manuscripts, theses, peer reviews, confidential reviewer remarks, source figures, and mathematical equations.

### Trust Boundaries:
1. **Client to Server Boundary**:
   - HTTP requests to `/api/**`: Query parameters, JSON payloads, multipart form data, route parameters.
   - All client claims (`userId`, `workspaceId`, `role`, `filename`, `mimeType`, `reviewId`) are untrusted.
2. **Multi-Tenant Data Boundary**:
   - Workspaces, outputs, cards, assets, snapshots, thesis reviews, ingest files, and document chunks must strictly be accessible only by authorized members (owner/editor/viewer).
3. **Document Ingestion & File System Boundary**:
   - Uploaded PDF files, extracted images/tables/equations, LaTeX compilation directories, and file paths.
   - Risks: Path traversal, arbitrary file writes, SSRF via external URL import, decompression bombs, and excessive memory/disk usage.
4. **AI & Model Output Boundary**:
   - External LLM responses, RAG prompt contexts, and vector retrieval.
   - Risks: Prompt injection from uploaded manuscripts altering review scores or system instructions; malformed JSON from models; schema non-compliance; cross-workspace vector chunk leakage.
5. **Real-time Collaboration (Yjs / WebSocket) Boundary**:
   - WebSocket connections to `/api/yjs`.
   - Risks: Unauthenticated connections, forged workspace subscriptions, unauthorized mutations, message replay.
6. **Confidentiality & Export Boundary**:
   - PDF/DOCX generation for thesis assessments.
   - Risks: Leaking confidential reviewer remarks to student/public exports, XML control character injection breaking Word files, and HTTP header injection via download filenames.

---

## 3. Vulnerability Findings & Prioritized Remediation Plan

### Severity: Critical (P0)

#### [FINDING-CRIT-01] Multi-Tenant Workspace Takeover in `app/api/workspaces/route.ts`
- **Affected Route**: `GET /api/workspaces`
- **Risk**: When a newly signed-in user has 0 workspaces, the handler queried all existing workspaces in the database and automatically upserted `WorkspaceMember` records granting the new user `owner` role for every workspace in the entire database.
- **Remediation**: Eliminate the cross-tenant takeover loop entirely. If a user has 0 workspaces, create a new sample project uniquely owned by `userId`.
- **Status**: **REMEDIATED & VERIFIED** (Tested in `__tests__/api/workspace-isolation.test.ts`).

#### [FINDING-CRIT-02] Thrown Response Swallowing in Catch Blocks (Auth Bypass / 500 Distortion)
- **Affected Routes**: `app/api/workspaces/[id]/assets/upload/route.ts`, `app/api/workspaces/[id]/assets/route.ts`, `app/api/workspaces/[id]/equations/route.ts`, `app/api/workspaces/[id]/cards/[cardId]/route.ts`, and 18 additional API handlers.
- **Risk**: `requireWorkspaceAccess` and `requireWorkspaceEditor` throw `apiError(...)` which is a `Response` object (401/403/404). Generic `catch (err)` blocks swallowed the response and returned `500 { error: String(err) }` or failed to reject unauthorized callers cleanly.
- **Remediation**: Updated all routes to check `if (err instanceof Response) return err` and use safe standardized error wrappers.
- **Status**: **REMEDIATED & VERIFIED** (All 20+ routes audited and updated).

#### [FINDING-CRIT-03] Server-Side Request Forgery (SSRF) in `app/api/ingestion/import-url/route.ts`
- **Affected Files**: `app/api/ingestion/import-url/route.ts`, `lib/services/arxiv-service.ts`
- **Risk**: `resolvePdfUrl` accepted arbitrary `http://` and `https://` URLs without validating destination IPs or hostnames, allowing attackers to target internal cloud metadata services (`169.254.169.254`), loopback (`127.0.0.1`), or private subnets.
- **Remediation**: Implemented `assertSafeExternalUrl` validator that resolves hostnames and blocks loopback, link-local, cloud metadata, and RFC1918 private IP ranges.
- **Status**: **REMEDIATED & VERIFIED** (Tested in `lib/__tests__/security.test.ts`).

---

### Severity: High (P1)

#### [FINDING-HIGH-01] Path Traversal and Unsafe Filenames in Asset Upload and Image Edit
- **Affected Files**: `app/api/ingestion/image-edit/route.ts`, `app/api/workspaces/[id]/assets/upload/route.ts`
- **Risk**: `body.originalFilename` and `resolveAssetPath` accepted unvalidated filenames that could attempt directory traversal or invalid characters.
- **Remediation**: Apply `sanitizeFilename` and strict path validation against `workspacePath(...)`.
- **Status**: **REMEDIATED & VERIFIED** (Path traversal sequences stripped, tested in `lib/__tests__/security.test.ts`).

#### [FINDING-HIGH-02] HTTP Header Injection via `Content-Disposition` in Export Routes
- **Affected Files**: `app/api/workspaces/[id]/thesis-review/[reviewId]/export/route.ts`, `app/api/workspaces/[id]/export/route.ts`
- **Risk**: Unsanitized student names or titles containing `\r`, `\n`, `"`, or `;` placed directly into `Content-Disposition` header values.
- **Remediation**: Implement `safeContentDisposition` utility that strips control characters and quotes, providing an ASCII-safe fallback and RFC 5987 `filename*` encoding.
- **Status**: **REMEDIATED & VERIFIED** (Tested in `lib/__tests__/security.test.ts`).

#### [FINDING-HIGH-03] XML Control Character Injection in DOCX Generation
- **Affected Files**: `lib/docx/generator-review.ts`, `lib/docx/generator.ts`, `lib/docx/helpers.ts`
- **Risk**: OpenXML / Word documents fail to open and report corruption if text contains ASCII control characters (`\x00` - `\x08`, `\x0B`, `\x0C`, `\x0E` - `\x1F`).
- **Remediation**: Introduce `sanitizeXmlString` in docx helpers that strips illegal XML 1.0 control characters while preserving valid formatting.
- **Status**: **REMEDIATED & VERIFIED** (Tested in `lib/__tests__/security.test.ts`).

#### [FINDING-HIGH-04] Information Disclosure via Raw Error Messages (CWE-209)
- **Affected Routes**: Multiple handlers in `app/api/workspaces/**`
- **Risk**: Returning `String(err)` on 500 errors leaks internal database table names, connection strings, or system paths.
- **Remediation**: Return sanitized, structured error responses (`safeApiError`) and log full errors server-side with context.
- **Status**: **REMEDIATED & VERIFIED** (Server-side context logged; generic client errors returned).

---

### Severity: Medium (P2)

#### [FINDING-MED-01] Inconsistent Role Checks on GET Endpoints (Viewer vs Editor)
- **Affected Files**: `app/api/workspaces/[id]/assets/[...filename]/route.ts`, `app/api/workspaces/[id]/thesis-review/route.ts`
- **Risk**: Read-only viewers (`viewer` role) were blocked from loading assets or viewing reviews because handlers incorrectly used `requireWorkspaceEditor` instead of `requireWorkspaceAccess`.
- **Remediation**: Use `requireWorkspaceAccess` for read-only GET routes, and `requireWorkspaceEditor` for mutations.
- **Status**: **REMEDIATED & VERIFIED**.

#### [FINDING-MED-02] Workspace Deletion Authorization
- **Affected File**: `lib/auth.ts`, `app/api/workspaces/[id]/route.ts`
- **Risk**: `requireWorkspaceOwner` delegated to `requireWorkspaceEditor`, allowing any editor to permanently delete a workspace.
- **Remediation**: Restrict workspace deletion explicitly to `requireWorkspaceOwner` (role === 'owner').
- **Status**: **REMEDIATED & VERIFIED** (Tested in `__tests__/api/workspace-isolation.test.ts`).

#### [FINDING-MED-03] ESLint JSX Entity Errors in `components/help-modal.tsx`
- **Affected File**: `components/help-modal.tsx`
- **Risk**: Build/CI failures during linting.
- **Remediation**: Escape unescaped double quotes in JSX.
- **Status**: **REMEDIATED & VERIFIED** (`pnpm lint` exits with 0 errors).

---

## 4. Final Verification Gate Summary

| Gate / Command | Initial Status | Post-Hardening Status | Outcome |
|---|---|---|---|
| `pnpm typecheck` | PASS (0 errors) | **PASS (0 errors, Exit 0)** | TypeScript type safety verified |
| `pnpm lint` | FAIL (2 errors) | **PASS (0 errors, 4 warnings, Exit 0)** | Clean ESLint pass |
| `pnpm vitest run` | PASS (57 files, 378 tests) | **PASS (59 files, 408 tests, Exit 0)** | +30 new security & isolation tests added |
| `pnpm build` | PASS (Exit 0) | **PASS (Exit 0)** | Next.js production build succeeded |
| `prisma migrate status` | Reconciled | **PASS (Database in sync)** | Prisma schema & migrations verified |

