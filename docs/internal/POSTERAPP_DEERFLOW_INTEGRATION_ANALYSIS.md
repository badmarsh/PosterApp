# PosterApp × DeerFlow Integration — Analysis & What's Next

> **Status:** Decision document / pre-build analysis (not an audit)
> **Date:** 2026-09-04
> **Author:** Arena agent session (`arena/01a06a87-posterapp`)
> **Baseline:** `2f4cf293e7853cbff25e47046bce2d5b712a5d48` (main, HEAD of this branch)
> **External baseline:** `bytedance/deer-flow` @ main, commit `683d146` (2026-09-04)

---

## 0. TL;DR

- **DeerFlow 2.0** (ByteDance, MIT, ~81.3k stars, actively maintained — latest commit 2026-09-04) is a **long-horizon SuperAgent harness**: a `lead_agent` that plans, spawns sub-agents, uses tools, runs code inside **Docker/K8s sandboxes**, keeps **long-term memory**, and streams progress over **SSE**. It speaks an OpenAI-compatible model layer, so PosterApp's existing `AI_API_URL`/`AI_API_KEY` ecosystem can power it.
- **PosterApp's AI today is "single-shot structured calls"**: one HTTP round-trip per card generation, chat message, review, or thesis review. It has no long-horizon loops, no autonomous tool execution, no agent memory, no sub-agent fan-out. The rich products (review engine, rubric, RAG, evidence validator) are *deterministic orchestrators around one well-prompted LLM call* — excellent quality per dollar, but bounded in scope per run.
- **The integration opportunity is not "replace the AI layer"** — it is to add a **second, long-horizon execution tier** for the few workflows that genuinely need it:
  1. **Deep literature/web research** for a poster or thesis (multi-hour, multi-source, iterative) — currently PosterApp only has per-request academic connectors (Crossref/OpenAlex/Semantic Scholar/arXiv/Tavily) used piecemeal.
  2. **Autonomous poster-building loops** (research → outline → draft → compile → fix → iterate). PosterApp's autofix loop is capped at 3 attempts; DeerFlow can run open-ended, sandboxed iterations.
  3. **Multi-agent review panels** (several "reviewer personas" + grader + adversarial critic) — PosterApp has `multiAgentDebate` (2 calls) and reviewer calibration, but no true multi-agent orchestration.
  4. **Reusable "skills"** (department-specific rubrics, layout rules, citation styles) installable per workspace — PosterApp hardcodes rubrics in `lib/ai/`.
- **Recommended architecture: sidecar via HTTP (Option A).** DeerFlow runs as its own Docker Compose service (Gateway mode — no LangGraph Platform license needed), PosterApp talks to it **server-side only** through a thin bridge (`lib/deerflow/`), with a per-workspace thread mapping in Postgres, SSE re-emission through a Next.js route, and **structured deliverable contracts** validated with Zod before anything is applied to a workspace. Never let the browser touch DeerFlow directly; never give DeerFlow write access to Postgres or workspace files — the handoff is a **reviewed JSON "proposal"** that the human confirms, then PosterApp applies it through its own revision-gated, rate-limited, sandboxed routes.
- **What's next (phased):** Phase 0 plumbing spike (1–2 days) → Phase 1 "Deep research + poster-research copilot" MVP (main value, ~1 week) → Phase 2 autonomous build/fix loop → Phase 3 multi-agent review panel + skills → Phase 4 memory + IM channels. **Phase 0/1 is the right scope for the next coding pass** — its megaprompt is in `POSTERAPP_MEGAPROMPT_DEERFLOW.md`.

---

## 1. DeerFlow — verified snapshot (2026-09-04)

### 1.1 What it is

`bytedance/deer-flow` is an open-source (MIT) **SuperAgent harness** built on **LangGraph/LangChain**. V2.0 (early 2026) is a ground-up rewrite and a general-purpose agent platform: instead of a chat model producing text, agents get a **filesystem, bash, installed packages, tools, memory, sub-agents, and skills**, and are designed to run tasks that take **minutes to hours** (deep research, data analysis, code, presentations, reports).

Verified facts (README / `backend/docs/API.md` / `skills/public/claude-to-deerflow/SKILL.md` / DeepWiki, 2026-09-04):

| Item | Value |
|---|---|
| Repo | `github.com/bytedance/deer-flow` @ main |
| Activity | 3,131 commits; latest `683d146` (2026-09-04) — **very fast-moving; pin a commit or tagged image** |
| License | MIT |
| Stack | Python 3.11/3.12+ (uv), Node 22+, Docker; LangGraph + LangChain; FastAPI gateway |
| Services | nginx `:2026` (single entry) · Gateway API `:8001` (embedded agent runtime in "Gateway mode") · provisioner `:8002` (optional, K8s sandboxes) · Redis `:6379` (cross-worker SSE stream bridge) |
| Runtime modes | **Standard** (4 processes; production images historically tied to LangGraph Platform license) vs **Gateway mode** (3 processes, runtime embedded in the FastAPI Gateway, no Platform license) — Gateway mode is the one to deploy |
| Sandbox modes | local · Docker · Kubernetes (via provisioner) |
| Models | any OpenAI-compatible provider via `config.yaml` (OpenAI, Anthropic, Gemini, DeepSeek, Kimi, **OpenRouter**…); long-context + tool-calling models recommended |
| Skills | `.agent/skills`, `skills/public/…`; installed/enabled per deployment (`POST /api/skills/{name}/enable`) — e.g. `pdf-processing`, `claude-to-deerflow` |
| Memory | short-term (in-context) + long-term (persistent, summarized/offloaded) |
| Channels | Feishu/Lark, Slack, Telegram, Discord, DingTalk, WeChat/WeCom (post-Phase 4) |
| Clients | HTTP (REST + SSE), LangGraph SDK, embedded Python `DeerFlowClient` |

### 1.2 API surfaces (the only contract PosterApp needs)

**LangGraph-compatible API** (base `/api/langgraph`, served by Gateway through nginx):

- `POST /api/langgraph/threads` → `{ thread_id, created_at, metadata }` — create a conversation thread.
- `POST /api/langgraph/threads/{thread_id}/runs` — start a run (fire-and-forget).
- `POST /api/langgraph/threads/{thread_id}/runs/stream` — start a run and **stream SSE events** (`Accept: text/event-stream`). This is the primary interaction for PosterApp.
- `DELETE /api/threads/{thread_id}` (Gateway) — remove local thread data.

**Run request essentials** (from the official skill doc):

```jsonc
{
  "assistant_id": "lead_agent",              // or a custom agent name
  "input": {
    "messages": [{ "type": "human", "content": [{ "type": "text", "text": "…" }] }]
  },
  "stream_mode": ["values", "messages-tuple", "custom"],  // "custom" = agent events
  "stream_subgraphs": true,
  "config": { "recursion_limit": 1000, "configurable": { "model_name": "…" } },
  "context": { "thinking_enabled": true, "is_plan_mode": true, "subagent_enabled": true, "thread_id": "…" }
}
```

**Gateway API** (base `/api`, direct port `:8001`): `GET /api/models`, `GET /api/mcp/config`, `/api/skills` (list/enable), `/api/memory` (long-term facts), `POST /api/threads/{id}/uploads` (file upload; nginx caps **100 MB**), artifacts.

**Deployment note:** the frontend at `:2026` is DeerFlow's own Next.js UI. PosterApp should **not** reuse it — it should embed the agent as a *capability* behind PosterApp's own UI, or optionally link out.

---

## 2. PosterApp — current-state snapshot

### 2.1 What exists (verified against this branch)

- **App shell:** Next.js 16 App Router behind `server.ts` (`:3333`, Next + Yjs WebSocket), Clerk auth, PostgreSQL + **pgvector** (Prisma, 7 migrations), custom Dockerfile + `docker-compose.yml` (Postgres only today).
- **AI client (`lib/ai/client.ts`):** one generic OpenAI-compatible structured-call client (retries 429/502/503/504, 180 s hard timeout, Zod-decoded, JSON repair, random fallback models). **No streaming to the client from AI routes**, no tool use, no multi-step loops.
- **Model config (`lib/ai/models.ts`):** role-based model resolution (`generation`, `structure`, `review`, `chat`, `thesis`, `autofix`, vision chains…), per-request override header, fallback chains, timeouts.
- **Reliability/cost:** circuit breaker per provider (`lib/ai/telemetry.ts`), daily soft budget + cost ledger (`lib/ai/cost-ledger.ts`, default `$2/day`), distributed rate limiting (`lib/rate-limit.ts`, Upstash fallback).
- **Core AI features:** card auto-fill (`cards/[cardId]/generate`), bulk generate, shrink (height budget), structure generation, chat (`workspaces/[id]/chat` — single-shot, non-streaming, 20 msgs / 40k chars context, image support), poster review + layout review (vision), **thesis review** (14-section composer, rubric engine `sk-academic-v1`, evidence validator with quote-anchoring, defense questions, novelty detector, graph communities, citation network, RAG stats).
- **RAG:** vector (local MiniLM, 384-d), PG FTS, Hybrid RRF + MMR + reranker + HyDE; GraphRAG (entity extraction, communities); section routing; adaptive chunking; reindex jobs.
- **Academic connectors:** Crossref, OpenAlex, Semantic Scholar, arXiv, Tavily (`lib/services/`), academic search UI, BibTeX suggest/lookup.
- **Compile/export:** sandboxed `pdflatex` (`-shell-restricted`, cap-drop, read-only tmpfs, `LATEX_COMPILER_IMAGE`), autofix loop (≤3 attempts, multi-card undo), export to PDF/DOCX, QR, history/snapshots, Yjs live collab with revision gating.
- **Workflow UI:** `lib/workflow/step-registry.ts` — config-driven steps for thesis review (4/6/10-step presets) + `components/thesis-review/` panels; `components/agent-panel.tsx` (assistant-ui chat + agent event feed).

### 2.2 Why DeerFlow is complementary, not a replacement

| PosterApp today | → DeerFlow adds | Verdict |
|---|---|---|
| Single-shot, well-prompted LLM calls with deterministic orchestration | Long-horizon loops (minutes–hours), plan → sub-agents → synthesize | Both tiers needed; keep PosterApp's calls as the cheap/fast path |
| Deterministic per-criterion pipeline (rubric, RAG, evidence) | Adaptive reasoning about *what to check* when the rubric doesn't fit, and open-ended exploration | Use DeerFlow for the *investigation*, keep PosterApp for the *grading/formatting* |
| Autofix compile loop capped at 3 attempts, in-process | Sandboxed iteration with real filesystem/bash, packages, unlimited bounded loop | Phase 2; must stay inside PosterApp's compiler sandbox rules |
| Academic connectors called per-request from server routes | Autonomous multi-source research + synthesis + citation audit | **Phase 1 flagship use case** |
| Rubrics/templates hardcoded in `lib/ai/` | Installable skills per workspace/department | Phase 3 |
| No memory across sessions besides Yjs docs/DB | Long-term agent memory (per workspace/user) | Phase 4 |
| `multiAgentDebate` = 2 calls, reviewer calibration = compare saved reviews | True multi-agent panel (several reviewer roles + grader + critic) | Phase 3 |
| Chat is context-aware but single-turn | Chat + tool use + may become genuinely agentic when it needs to | Phase 1 (poster research copilot) |

### 2.3 Boundaries that must NOT move

- **PosterApp stays the source of truth.** Workspace state, cards, assets, Yjs doc, revision counter, snapshots. DeerFlow never writes to Postgres (`DATABASE_URL` must not be exposed to it) and never writes into `workspaces/<id>/`.
- **Human-in-the-loop on any workspace mutation.** DeerFlow output arrives as a validated, previewable **proposal**; only explicit user confirmation applies it (same UX philosophy as the autofix "Undo" and review confirmation).
- **LaTeX compilation stays in PosterApp's sandboxed compiler** (`lib/latex/compiler-runner.ts`, `runSandboxedLatex`). DeerFlow may *recommend* patches; it does not compile.
- **All existing guardrails remain on every new route:** `zod`, `readJsonBodyCapped`, `rateLimitAsync`, `safeApiError`, `requireWorkspaceEditor`, revision gating, no raw `String(err)` leaks.
- **No new runtime deps in `package.json` unless justified** — the DeerFlow bridge is pure `fetch` + `ReadableStream` parsing (SSE), no SDK needed server-side.

---

## 3. Integration architecture

### 3.1 Options considered

| Option | Description | Pros | Cons | Verdict |
|---|---|---|---|---|
| **A. Sidecar via HTTP** | DeerFlow in Docker Compose (Gateway mode, `:8001` internal or `:2026` unified); PosterApp proxies server-side; threads mapped in Postgres | Clean separation, no license issue, no Python in Node image, PosterApp keeps auth/rates/budgets, easy to A-B toggle, can run on-prem | Second runtime to operate; SSE bridge plumbing; cost telemetry must be inferred from events | **Recommended** |
| B. Embedded Python client | `DeerFlowClient` in-process inside a Python service that PosterApp calls | No HTTP layer between | Still needs a Python sidecar; no real benefit over A for our topology; harder to isolate | Rejected |
| C. Reimplement subset natively (LangGraph.js / custom runner) | Port the needed agent loop into the Node app | One runtime, full control | Months of work; lose sandboxes/skills/memory/multi-agent maturity; duplicates DeerFlow's core value | Rejected for now |
| D. User-facing only (link-out) | PosterApp embeds a link to DeerFlow UI/IM channels | Zero integration work | No workspace context, no validated handoff, agent can't see the poster | Acceptable stopgap only |

### 3.2 Recommended topology (Option A)

```
Browser (PosterApp UI, Clerk session)
   │  POST /api/workspaces/[id]/deerflow/runs/stream   (same-origin, rate-limited, zod-validated)
   ▼
Next.js route handler (server, `requireWorkspaceEditor`)
   │  bridge: lib/deerflow/client.ts  (service token, timeouts, SSE parser, error mapping)
   │  budget gate (cost-ledger + per-workspace daily cap) → 429 if exhausted
   ▼
DeerFlow nginx :2026  ──►  Gateway :8001 (lead_agent, skills, memory, uploads)
   │        ├── sandboxes: Docker (network-restricted, no DATABASE_URL, no host workspace mounts)
   │        └── models: same AI_API_URL/AI_API_KEY family (OpenRouter-compatible)
   ▼
SSE events re-emitted to UI  (status, plan, tool calls, progress, final deliverable event)
   │
   ▼  final event carries a Zod-validated Proposal
lib/deerflow/contracts.ts → UI preview drawer → user confirms
   ▼
Existing safe routes apply the proposal (cards PUT with ?revision=, assets via existing upload,
bib via existing endpoints) → Yjs syncs to collaborators → compile as usual
```

### 3.3 Threading & data model

- **1 PosterApp workspace ↔ 1 DeerFlow thread** (per "agent run" context; a run may spawn sub-threads internally, invisible to us). Optionally 1 thread per *agent tab* later.
- New Prisma models (migration `20260xxx_deerflow`), all server-only:

```prisma
model DeerflowThread {
  id          String   @id @default(cuid())
  workspaceId String
  userId      String
  deerThreadId String  @unique          // DeerFlow thread_id
  status      String   @default("idle") // idle | queued | running | done | failed | cancelled
  kind        String                    // "deep_research" | "poster_copilot" | …
  proposal    Json?                     // last validated deliverable
  costEstimateUsd Float?
  startedAt   DateTime?
  finishedAt  DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

- **Lifecycle rules:** thread created lazily on first run; `DELETE /api/threads/{id}` on workspace delete; orphan sweep job (older than N days, not running) in the existing job-queue style.

### 3.4 Deliverable contracts (the handoff API)

DeerFlow never returns "any JSON". Each run kind maps to a Zod schema in `lib/deerflow/contracts.ts`, with a lenient preprocess layer (DeerFlow's JSON may drift — same philosophy as `lib/ai/contracts.ts`). Phase 1 kinds:

- `poster_research` → `{ sources: SourceRef[], thesis: string, citations: BibEntry[], sectionDrafts: { title, bullets[], suggestedAssets[] }[], openQuestions: string[], cost: { estimatedUsd } }`
- `review_deep_dive` → `{ summary, findings: Finding[], evidence: EvidenceRef[], suggestedGradeBand, defenseQuestions[] }` mapped into existing thesis-review types where possible.

Every contract has: `maxItems` bounds, string length caps, asset-id whitelist (only assets already in this workspace may be referenced), and a human-readable `proposalVersion`.

---

## 4. What's next — phased roadmap

### Phase 0 — Plumbing spike (≈1–2 days) **do first**
- Docker Compose `deerflow` service (Gateway mode, pinned commit/image, `:2026` internal), health check, no model keys hardcoded (reuse the same `.env` OpenAI-compatible vars; verify `config.yaml` accepts OpenRouter).
- `lib/deerflow/client.ts`: `createThread`, `startRun(stream)`, SSE parser (`values`/`messages-tuple`/`custom`), timeout + cancellation + error taxonomy (maps DeerFlow 4xx/5xx → PosterApp `safeApiError` shapes).
- Fake-gateway test harness (in-repo `tests/fixtures/deerflow-server.mjs` or a mocked `fetch`) so unit tests never need a live DeerFlow.
- Cost measurement: one real run → tokens vs. elapsed vs. quality, then **set the per-workspace daily cap** (default `DEERFLOW_DAILY_BUDGET_USD=3.00`).

### Phase 1 — MVP: "**Deep research copilot**" for a poster/paper (≈1 week)
- New agent tab in `agent-panel.tsx` ("DeerFlow"): task presets (deep literature review, related-work synthesis, poster outline w/ evidence, thesis defense prep research).
- Context injection: the workspace's corpus summary (existing RAG/context builders) + selected source documents, **never raw full PDFs** (upload ≤100 MB allowance is bounded by contract but keep context tight).
- SSE progress in the existing `AgentEvent` feed; final `poster_research` proposal opens in a review drawer; **"Apply to workspace"** creates cards (via `cards` POST with `?revision=`), registers `sources` in the bib, surfaces citations for confirmation.
- Budget/limits: pre-flight estimate call; kill switch; per-user rate limit (e.g. `deerflow:run` 3/h); existing 20/min pattern reused.

### Phase 2 — Autonomous build & fix loop (≈1 week)
- "Improve poster" run: proposal = card patches + LaTeX fixes; PosterApp compiles in its sandbox, returns the error window to the agent, loops **bounded** (max N=5 iterations, wall-clock cap), each iteration writes to a new snapshot (undo).

### Phase 3 — Multi-agent review panel + skills (≈1–2 weeks)
- Panel of reviewers (external/internal/statistician/layperson) driven by DeerFlow sub-agents, each persona writing findings against `sk-academic-v1` criteria; PosterApp's evidence validator and grade derivation stay authoritative.
- Skills: `posterapp-thesis-rubric-sk`, `posterapp-layout-rules`, `posterapp-citation-sk` — enabled per workspace, versioned, human-reviewed before enable.

### Phase 4 — Memory + channels (later)
- Workspace memory ("what this lab's posters do"), user preferences; optional Slack/Telegram bot to submit a PDF and receive a draft review.

---

## 5. Security, cost & operations

| Area | Decision / mitigation |
|---|---|
| **Network** | DeerFlow sandboxes get **network egress only to its own model/search providers**; no host network; no `DATABASE_URL`, no `CLERK_SECRET_KEY`, no `AI_API_KEY` passed into sandboxes (only the gateway holds them) |
| **Secrets** | `DEERFLOW_SERVICE_TOKEN` generated, stored server-side; every bridge call checks it; browser calls only same-origin PosterApp routes |
| **SSRF** | The bridge only talks to the configured `DEERFLOW_URL` (validated host); PosterApp's `safeFetch` rules still govern anything DeerFlow's output triggers (e.g. remote-asset import) |
| **Prompt injection** | All DeerFlow output is untrusted — rendered escaped, wrapped by the existing `wrapUntrustedContext`/verbatim rules; never `dangerouslySetInnerHTML`; proposals validated by Zod before UI display |
| **Workspace mutation** | Only via existing routes (revision-gated, rate-limited); everything visible in a diff/preview first |
| **Cost** | Per-workspace daily cap + per-user rate limits + pre-flight estimate + kill switch; record into `cost-ledger` shapes so `rag-stats`-style dashboards keep working; **cap recursion_limit and run wall-clock** |
| **Latency/UX** | Runs can take minutes → SSE + background jobs; UI must be tolerant of cancellation and partial failure |
| **Ops** | `docker-compose` profile `deerflow` (off by default); healthcheck; upgrade = pinned image/commit; measured footprint (≈8 vCPU/16 GB recommended); Redis needed for multi-worker SSE |
| **Data residency** | Source PDFs stay in `workspaces/`; only summaries/context go to DeerFlow; opt-out per workspace (`settings` flag) |
| **License** | Deploy **Gateway mode** (no LangGraph Platform license); MIT for the harness itself — verify any bundled vendored deps in your pinned image |

---

## 6. Risks

1. **Fast-moving upstream** (3k+ commits, weekly changes) → pin image/commit; keep the bridge thin so API drift is localized in `lib/deerflow/client.ts`.
2. **Cost blowout** on long research runs → hard caps + estimate + confirm-before-start UX.
3. **Quality/grounding drift** — long agentic runs can produce confident hallucinated citations → DeerFlow output stays *proposal*; PosterApp's `evidence-validator` + `academic-checks` still gate anything that becomes a graded claim; cited sources must round-trip through existing Crossref/DOI lookups.
4. **Sandbox escape / tool abuse** → least-privilege sandbox, no secrets, no workspace mounts, kill switch, audit logs of runs.
5. **Scope creep** — do not let DeerFlow become *the* AI layer; keep the single-shot path for 95 % of interactions.

## 7. Open decisions (please answer before Phase 1 build)

1. **Product scope:** research copilot only (Phase 1), or also autonomous build/fix (Phase 2) in the same pass?
2. **Deployment:** Docker Compose on-prem only, or also expected on the production cluster (then: provisioner/K8s sandboxes, Redis, image registry pin)?
3. **Model:** use the existing `AI_API_URL`/`AI_API_KEY` (Gemini/OpenRouter) for DeerFlow, or a separate long-context model for the agent?
4. **Budget:** default per-workspace daily cap (`$3.00`?) and per-user rate (3 runs/hour?) — confirm numbers.
5. **Language:** DeerFlow prompts/results in SK/CS/EN (existing `ReviewLanguage` gates) — confirm the agent should follow the workspace language.

---

## 8. Sources

- GitHub repo + README: `github.com/bytedance/deer-flow` (fetched 2026-09-04; commit `683d146`)
- `backend/docs/API.md` — LangGraph-compatible + Gateway API reference
- `skills/public/claude-to-deerflow/SKILL.md` — run/stream request contract, env vars, sandbox/artifact notes
- DeepWiki `bytedance/deer-flow` — service topology (nginx 2026 / gateway 8001 / provisioner 8002 / Redis 6379), request routing, Gateway vs standard modes
- Community overviews (flowtivity review 2026-04; landscape.jimmysong.io; toolworthy) — used only for framing/history, not for API claims
- PosterApp repo state on this branch — all §2 claims verified by file reads (see `.agents/AGENTS.md`)
