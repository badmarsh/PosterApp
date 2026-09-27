# TASK: PosterApp Academic Retrieval — Audit, Test, Optimize, Compare

You are a senior backend/IR engineer acting as an execution-backed auditor for the
**Academic Retrieval** subsystem of **PosterApp** (Next.js 16 App Router, TypeScript,
Vitest 5). "Academic retrieval" means the **Academic Connector** — the Perplexity-style
multi-source literature search + citation-verification engine — *not* the internal
pgvector RAG over ingested PDFs (that one has its own harness: `pnpm eval:retrieval`,
`lib/ai/retrieval-eval.ts`; leave it alone).

Scope (read all of it before you write a single finding):

| Layer | Files |
|---|---|
| Orchestrator | `lib/services/academic-connector.ts` — `searchAcademicPaper`, `verifySingleCitation`, `auditThesisCitations`, `checkIso690Issues`, `mergePaperRecords`, `normalizeTitleKey`, `fetchAcademicAuthorProfile` |
| Providers | `lib/services/openalex-service.ts`, `lib/services/crossref-service.ts`, `lib/services/semantic-scholar-service.ts`, `lib/services/arxiv-service.ts`, `lib/services/tavily-service.ts` |
| Ranking / trust | `lib/services/search-quality.ts` (`credibilityAssessment`) |
| HTTP surface | `app/api/academic/search/route.ts` (auth + rate limit + Zod) |
| Consumers | `components/academic-search-dialog.tsx`, `lib/ai/review-engine.ts` (PhD enrichment), `lib/ai/review-pipeline.ts` (citation audit), `lib/ai/novelty-detector.ts` (`findRelatedPapers`), `lib/bib-types.ts` (`academicPaperToBibEntry`) |
| Adjacent (report-only) | `app/api/workspaces/[id]/bib/lookup/route.ts` (LLM-only BibTeX lookup that never touches the connector) |
| Existing tests | `lib/__tests__/academic-connector.test.ts` (8 tests), `lib/__tests__/academic-checks.test.ts` |

You have full repo access and can run commands. The task has four halves that must be done
**in order** — AUDIT → TEST → OPTIMIZE → COMPARE — because each one produces the evidence
the next one needs.

---

## 0. Evidence & Conduct Rules (highest priority)

1. **Code is the single source of truth.** `README.md`, `AGENTS.md`, file-header comments and
   older audits (`docs/audit-2026-09-17.md` #4/#6/#7, `artifacts/debug-polish-2026-09-25/report.md` #9)
   can be stale. If docs contradict implementation, report the contradiction — do not re-report
   what those audits already fixed (credibility pill, retraction flag, `searchFailed` state).
2. **Tag every finding:**
   - `▶ EXEC` — reproduced by running something (paste the command + verbatim output).
   - `✎ STATIC` — derived by reading code; cite `file:line` and the concrete failure path.
   - `? UNVERIFIED` — cannot be verified in this environment; say why and what would verify it.
3. **Repro before fix.** For every bug: failing test first → watch it fail → fix → watch it pass.
   A fix without a red test is `? UNVERIFIED` and must be flagged.
4. **Upstream-network protocol.** OpenAlex / Crossref / Semantic Scholar / arXiv / Tavily are
   third-party services. Probe reachability first (`curl -s -o /dev/null -w '%{http_code}' <url>`).
   If egress is blocked, **do not fake a live run**: switch to *recorded fixtures* — real API
   response bodies (trimmed with the providers' own `select=` / `fields=` parameters) checked in
   under `__fixtures__/academic/` with a `_meta` block (capture date, URL, trimming). Every
   later metric must state whether it came from `live` or `recorded` mode.
5. **No secrets, no paid calls by accident.** Never print `.env*`. Tavily is a paid API — it must
   stay mocked/unset in tests. Never commit API keys inside fixtures (strip `api_key`, `x-api-key`).
6. **No new runtime dependencies.** Node 20+ `fetch`, `AbortSignal.any/timeout`, Vitest, Zod only.
7. **Keep the public contract.** `AcademicPaperResult`, `searchAcademicPaper(query, limit, options)`,
   `verifySingleCitation`, `auditThesisCitations`, and the `{ results }` JSON shape of
   `POST /api/academic/search` are consumed elsewhere — extend, never break. Adding fields is fine.

---

## 1. Mandatory Verification Phase (before reading code in depth)

Record verbatim outputs in the report:

```bash
git log --oneline -3 && git status --short
pnpm install --frozen-lockfile
pnpm typecheck                                   # classify errors: product vs pre-existing baseline
pnpm exec eslint lib/services app/api/academic components/academic-search-dialog.tsx
pnpm exec vitest run lib/__tests__/academic-connector.test.ts lib/__tests__/academic-checks.test.ts
# upstream reachability (decides live vs recorded mode)
for u in "https://api.openalex.org/works?search=quantum&per_page=1" \
         "https://api.crossref.org/works?query=quantum&rows=1" \
         "https://api.semanticscholar.org/graph/v1/paper/search?query=quantum&limit=1" \
         "https://export.arxiv.org/api/query?id_list=1706.03762"; do
  printf '%s -> ' "$u"; curl -s -o /dev/null -w '%{http_code} %{time_total}s\n' --max-time 15 "$u"; done
```

**Baseline discipline:** the gate is *zero new* type errors, *zero new* lint warnings, *zero*
test regressions relative to this baseline.

---

## 2. AUDIT — what to look for (ordered by user damage)

Triage every finding as **P0** wrong result shipped to the user / unbounded hang / silent data
loss · **P1** feature silently degraded · **P2** wrong-but-visible behavior · **P3** hygiene.
Give each an ID `AR-nn`.

### 2.1 Correctness of merge & deduplication (`academic-connector.ts`)
- Dedup key is `doi:` **or** normalized title — never both. Construct the case where OpenAlex
  carries the DOI and Semantic Scholar carries the same paper *without* a DOI (or with the
  DataCite `10.48550/arXiv.*` DOI) and show the duplicate row.
- `normalizeTitleKey` strips everything outside `[a-z0-9]`. What happens to a Cyrillic / CJK /
  Slovak-diacritic title? (Hint: empty key → `if (key)` → the record is dropped silently.)
- Provider sentinels: OpenAlex and Crossref emit `authors: ["Unknown Author"]`. Trace it through
  `mergePaperRecords` (`primary.authors.length > 0 ? primary : secondary`) — does the sentinel win
  over the real Semantic Scholar author list? Do the same for `influentialCitationCount`, `tldr`,
  `paperId`.
- DOI extraction regex in `searchAcademicPaper` and the copy in `thesis-context.ts` — trailing
  sentence punctuation (`10.1038/nature14539.`), `doi.org/` prefixes, uppercase.

### 2.2 Ranking quality
- Final order is `sort((a,b) => b.citationCount - a.citationCount)`. Enumerate what this does to:
  an exact-title query whose match has fewer citations than a famous neighbour; Crossref-only hits
  (no citation count mapped even though Crossref returns `is-referenced-by-count`); Tavily hits;
  recent papers under the UI's "last 2 years" filter; provider relevance order (discarded).
- Year filters: which providers actually receive `yearFrom/yearTo`? Is the merged list
  post-filtered? (Test: OpenAlex filtered, S2 & Crossref not → out-of-range rows leak through.)
- `domain` is validated by the route and accepted by `AcademicSearchOptions` — is it used
  anywhere? The dialog instead prefixes the query with words (`"computer science machine learning "`).

### 2.3 Resilience, timeouts, cancellation
- Every provider call must be bounded even when the caller passes an `AbortSignal`. Look for
  `signal: options?.signal || AbortSignal.timeout(n)` — passing a long-lived signal *removes*
  the per-request timeout. Compare with `ssFetch` (`AbortSignal.any([...])`, the correct pattern).
- `fetchArxivMetadata` takes no signal; `searchTavily` has **no timeout at all** when no signal is
  passed — since `searchAcademicPaper` awaits `Promise.all` over all providers, one hung provider
  hangs the whole search. Prove it with a never-resolving mocked `fetch` and fake timers.
- `ssFetch` honours `Retry-After`. What happens with `Retry-After: 120` inside the 25 s
  `auditThesisCitations` budget? Is the sleep abortable / capped?
- `verifyCitation` inspects only `papers[0]`. Show a top-3 list where hit #2 is the exact title.
- DOI verification path uses S2 + OpenAlex only — a DOI that only Crossref knows (very new
  papers) is reported `not_found` → a *correct* citation gets flagged in a thesis review.

### 2.4 Observability & contract
- The route returns `200 { results: [] }` whether every provider failed, one was rate-limited, or
  there genuinely are no papers. Propose/implement an additive `providers` diagnostics block
  (`status`, `count`, `latencyMs` per provider) and `mode` (`doi` | `arxiv` | `search`).
- Payload hygiene: OpenAlex works are 20–60 KB each without `select=`; Crossref supports `select=`
  too. Quantify (`▶ EXEC` on a recorded body or `✎ STATIC` on documented field lists).

### 2.5 Docs honesty (report-only, one-line fixes allowed)
- `semantic-scholar-service.ts` header says "100 req/s without API key"; `AGENTS.md` says
  "100/5min without". Which is right per current S2 policy? Fix the wrong one.
- `bib/lookup` route generates BibTeX with an LLM and never consults the connector — flag the
  hallucination risk and the ready-made grounded path (`searchAcademicPaper` → `academicPaperToBibEntry`).

---

## 3. TEST — build the harness before optimizing

1. **Golden set** (`lib/services/__tests__/academic-golden-set.ts` or similar): ≥ 8 queries that
   each exercise a different code path — exact title, DOI (with and without trailing punctuation),
   arXiv id, topical keyword query, diacritics/non-Latin title, "recent only" (yearFrom), a paper
   known to be retracted, and a citation string as it appears in a Slovak/Czech thesis
   (`AUTHOR, A. Year. Title. In: ...`). Each entry declares `expectedTop` (DOI or normalized title),
   `mustNotDuplicate`, and `mustContain` / `mustNotContain` invariants.
2. **Fixture-replay `fetch`** — a URL-pattern router that serves recorded provider bodies and
   supports fault injection: `hang`, `429 + Retry-After`, `500`, malformed JSON, empty result.
3. **Metrics** (pure functions, unit-tested themselves): `P@1`, `MRR`, `duplicateRate`,
   `fieldCompleteness` (share of results with `doi`, `year`, `venue`, `abstract`, `citationCount`),
   `providerAgreement` (share of top-k present in ≥ 2 providers), wall-clock per query, and
   for `auditThesisCitations`: `verifiedRate`, `falseNotFound`, `p95 latency`.
4. **Regression tests** for every `AR-nn` you intend to fix (red first — rule 0.3).
5. The whole harness must run in **< 10 s** offline (fake timers for the hang cases) so it can
   live in the normal `pnpm test` run, plus an opt-in `ACADEMIC_LIVE=1` mode that swaps the
   replay `fetch` for the real network when egress exists.

---

## 4. OPTIMIZE — allowed changes (smallest diff that moves a metric)

Implement only what the harness can measure. Candidate list (pick by evidence, not by taste):

- **Bounded timeouts everywhere**: `AbortSignal.any([callerSignal, AbortSignal.timeout(PER_PROVIDER_MS)])`
  in OpenAlex, Crossref, arXiv, Tavily; cap `Retry-After` sleeps; make sleeps abortable.
- **Dedup v2**: two-key identity (DOI *and* normalized title, arXiv-DOI ↔ arXivId equivalence,
  Unicode-aware `normalizeTitleKey` via NFKD + `\p{L}\p{N}`), sentinel-aware merge
  (`"Unknown Author"` never beats a real list), merge all enrichment fields.
- **Ranking v2**: reciprocal-rank fusion over provider relevance orders + exact/near title-match
  boost + log-scaled citation prior + provider-agreement bonus + mild recency term; Crossref
  `is-referenced-by-count` mapped to `citationCount` so Crossref hits stop sinking.
- **Year filter parity**: pass `year` to Semantic Scholar (`year=YYYY-YYYY`) and Crossref
  (`filter=from-pub-date:...`), then post-filter the merged list defensively.
- **Payload trimming**: `select=` for OpenAlex and Crossref; keep every field the parsers read.
- **Verification recall**: best-of-top-3 in `verifyCitation`; Crossref added to the DOI path.
- **Diagnostics**: additive `providers` / `mode` / `timings` in the route response via a
  `searchAcademicPaperDetailed()` that the old `searchAcademicPaper()` wraps.

Do **not** touch the dialog's visual design, i18n strings, or the RAG stack.

---

## 5. COMPARE — before vs after, same inputs, same mode

Run the golden set through the **baseline** connector (`git stash` / `git worktree` of the
pre-change tree, or the baseline ranking function kept side-by-side in the harness) and the
**optimized** connector, in the same mode (`recorded` or `live`), and write:

- `artifacts/academic-retrieval-audit-<YYYY-MM-DD>/comparison.json` — per query: baseline vs
  optimized top-5 (title, doi, source, citationCount), metrics, timings, provider statuses.
- `artifacts/academic-retrieval-audit-<YYYY-MM-DD>/report.md` — see §6.

A metric that did not move is reported as unchanged, not omitted. A metric that got worse is
reported with an explanation and a decision (keep / revert).

---

## 6. Deliverables

1. **Fixes** with regression tests, committed as focused commits on the working branch
   (`fix(academic): …`, `perf(academic): …`, `test(academic): …`). No drive-by reformatting.
2. **Harness**: golden set, fixture-replay fetch, metrics module, benchmark test that runs offline
   in `pnpm test` and optionally live.
3. **Fixtures** under `__fixtures__/academic/` with `_meta` (date, source URL, trimming applied).
4. **Report** at `artifacts/academic-retrieval-audit-<YYYY-MM-DD>/report.md` containing:
   - Verification log (§1 verbatim, before and after) and the **mode** used (`live`/`recorded`).
   - Findings table: `ID | P-class | title | evidence tag | file:line | repro | status (FIXED / STILL-OPEN / DEFERRED / NOT-A-BUG) | commit`.
   - Comparison table (§5) with every metric, plus a per-query diff of the top-3 where order changed.
   - Cross-check of prior audits (`docs/audit-2026-09-17.md` #4/#6/#7, debug-polish #9): `FIXED (verify)` / `STILL-OPEN` / `REGRESSED`.
   - "What a live run would add" — exactly which numbers are recorded-mode only.
   - Deferred items with the reason and the smallest next step.
5. **Docs**: one-line corrections to `AGENTS.md` / `.env.example` where they lie; a `CHANGELOG.md`
   entry in the repo's existing style.

---

## 7. Invariants (non-negotiable)

1. Zero regressions in `pnpm test`; any test you touched passes 3× consecutively.
2. `pnpm typecheck` and the scoped `eslint` run: zero **new** errors/warnings (state the baseline).
3. Existing public signatures and the route JSON contract stay backward-compatible.
4. Tests never hit the real network unless `ACADEMIC_LIVE=1`; paid providers (Tavily) never run in tests.
5. No secrets in fixtures, logs, or the report.
