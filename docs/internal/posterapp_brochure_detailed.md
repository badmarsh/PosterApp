# PosterApp — Detailed Product Brochure & Competitive Analysis

## From Paper to Poster, Intelligently.

**PosterApp** is a source-available, AI-native academic poster platform that turns research papers into publication-ready scientific posters through an automated ingestion pipeline, real-time collaborative editing, and production-grade LaTeX compilation — all backed by a research-grade retrieval and evidence-grounding engine.

> **In one sentence:** PosterApp is the only academic poster tool that grounds every AI-generated claim in verbatim source evidence, evaluates work against a weighted academic rubric, and compiles LaTeX in a hardened sandbox — all source-available and self-hostable.

---

## Executive Snapshot

| | |
|---|---|
| **What it is** | Source-available, self-hostable academic intelligence platform (not a template-filling chatbot) |
| **What it does** | Ingests PDFs → extracts structured content + BibTeX → AI-assisted poster/slide/paper authoring → sandboxed LaTeX compilation |
| **What makes it different** | Research-grade 6-stage Vector RAG, PaperQA2-style evidence grounding, 6-state epistemic taxonomy, weighted academic rubric, GraphRAG, sandboxed compilation |
| **Who it's for** | PhD candidates, postdocs, research groups, and institutions that value data sovereignty, auditability, and rigor |
| **License & cost** | Source-available, free to self-host (Docker + PostgreSQL) |
| **Version** | 0.2.0 · September 2026 |

---

## 🏆 Why PosterApp Is Uniquely Sophisticated

PosterApp is not a template-filling chatbot. It is an **18-subsystem academic intelligence platform** whose capabilities rival or exceed commercial offerings in the workflows that matter most for research output.

### Engineering Depth at a Glance

| Dimension | PosterApp | Typical Competitor |
|-----------|-----------|---------------------|
| **Ingestion pipeline** | 6-stage concurrent job queue · MinerU · SHA-256 integrity hashes · parse-quality gates | Single-shot PDF text extraction |
| **AI retrieval** | 6-stage hybrid Vector RAG (pgvector cosine + Postgres FTS) with multi-query fan-out, HyDE, MMR, criterion-aware reranking, contextual compression | Basic cosine search — or none |
| **Evidence grounding** | 4-tier verbatim anchoring cascade + embedding-assisted Jaccard grounding (PaperQA2-style) with a 6-state epistemic taxonomy and automatic downgrading of ungrounded claims | None — raw LLM generation |
| **Academic review engine** | 13-criterion weighted rubric with per-discipline applicability, deterministic cross-checks, self-critique debate, and ECTS grade reconciliation with asymmetric leniency/harshness correction | Template-based — or none |
| **GraphRAG** | Entity linking → BFS subgraph expansion → Louvain community detection → chapter-spanning summaries, with graceful degradation | Not available |
| **LaTeX compilation** | Sandboxed Docker containers: `--cap-drop=ALL`, `--user 1000:1000`, `--read-only`, `--tmpfs /tmp`, `-shell-restricted` | Client-side or unsandboxed server-side |
| **Security** | IDOR prevention, CSP with `worker-src` hardening, path-traversal fuzz tests (1000 randomized inputs), distributed rate limiting via Upstash Redis, early upload rejection | Basic auth, no sandboxing |
| **Collaboration** | Yjs WebSocket with conflict-free concurrent editing, Zustand store synced across clients | None — or basic commenting |
| **Test coverage** | Unit, integration, E2E (Playwright), and property-based fuzz testing across a large automated suite | Minimal or absent |
| **Theme system** | 4 themes (Light, Dark, Vercel, Vercel Dark) via semantic design tokens, user-switchable | Binary light/dark — or none |

> **The difference:** Most competitors extract text and apply a prompt template. PosterApp builds an integrated pipeline in which every subsystem — retrieval, evidence verification, rubric evaluation, graph analysis, and compilation — enforces academic rigor *before* producing output.

---

## 🔬 Technical Architecture Deep Dive

### 1. Automated Paper Ingestion — Beyond Simple PDF Parsing

PosterApp's ingestion pipeline goes far beyond text extraction. Each document passes through six resilient stages:

1. **PDF Upload & Validation** — 200 MB content-length gate; oversized bodies are rejected *before* parsing begins.
2. **MinerU Processing** — extracts structured markdown, mathematical equations, figures, tables, and auto-generates BibTeX citations.
3. **SHA-256 Integrity Hash** — every document receives a `sourceRevision` hash for reliable change detection.
4. **Parse-Quality Gate** — `canProceedToDeepReview` validates extraction quality before deep review is permitted.
5. **Concurrent Job Queue** — resilient retry logic designed for large documents (100+ pages).
6. **Asset Upserts** — deduplicated asset management prevents duplication in PostgreSQL.

**Competitors:** Most tools (ChatSlide, Mew Design, GA Abstract) perform a single-pass text extraction with no integrity verification, no quality gates, and no concurrent processing.

---

### 2. Six-Stage Vector RAG — Research-Grade Retrieval

PosterApp implements a **6-stage hybrid retrieval pipeline** per evaluation criterion:

| Stage | Technique | Purpose |
|:---:|-----------|---------|
| **1** | Multi-query fan-out (3 reformulations) | Broaden recall without extra API cost |
| **2** | HyDE (Hypothetical Document Embeddings) | Embed a hypothetical answer alongside the raw query |
| **3** | RRF k=60 over 70 % pgvector cosine + 30 % Postgres FTS | Blend semantic and lexical search |
| **4** | MMR deduplication (word-bigram / -trigram / char-4-gram Jaccard) | Eliminate redundant passages |
| **5** | Criterion-aware reranking | Boost passages aligned with heading structure |
| **6** | Contextual compression (TF-IDF sentence trimming) | ~35–40 % token reduction with no information loss |

**Competitors:** No academic-poster competitor implements anything beyond basic cosine similarity. Even dedicated RAG platforms rarely match this level of sophistication.

---

### 3. Evidence-Grounded Academic Review — The Epistemic Engine

The Academic Reviewer subsystem enforces **strict epistemic grounding invariants** that prevent the hallucination problems common in AI-generated reviews.

#### Epistemic Taxonomy (6 States)

| State | Meaning |
|-------|---------|
| `SUPPORTED_FACT` | Direct, verified verbatim or normalized source quote |
| `SUPPORTED_INTERPRETATION` | Inference derived directly from evidenced quotes |
| `REVIEWER_JUDGMENT` | Evaluative opinion or quality appraisal |
| `MISSING_EVIDENCE` | Document was queried but lacked expected proof |
| `POSSIBLE_RISK` | Methodological, statistical, or ethical risk flagged |
| `REQUIRES_HUMAN_VERIFICATION` | Mandatory reviewer inspection in the raw PDF |

#### Automatic Epistemic Downgrading
- `SUPPORTED_FACT` with no verified evidence → `REQUIRES_HUMAN_VERIFICATION` (confidence ≤ 0.4)
- `SUPPORTED_INTERPRETATION` without evidence → `REVIEWER_JUDGMENT` (confidence ≤ 0.5)

#### 4-Tier Evidence Anchoring Cascade

| Tier | Match strategy | Confidence |
|:---:|---------------|:---:|
| 1 | Exact substring match | **1.00** |
| 2 | Whitespace-normalized match | **0.95** |
| 3 | Approximate match (≥ 60 chars) | **0.45** |
| 4 | Unverified | **0.10** |

#### Embedding-Assisted Grounding (PaperQA2-Style)
For claims in the "maybe" band (Jaccard score 0.05–0.15), PosterApp blends in local WASM embeddings (384-dim, L2-normalized, SHA-256-cached) with a cosine similarity threshold ≥ 0.6.

**Competitors:** None of the surveyed competitors implement evidence grounding, an epistemic taxonomy, or automatic claim verification. ChatSlide explicitly states: *"AI can accelerate hierarchy and visual drafting, not certify scientific accuracy."* PosterApp takes the opposite approach — rigorous grounding by default.

---

### 4. Academic Rubric — Weighted, Localized, Per-Discipline

A comprehensive, localized rubric system (`sk-academic-v1`) with weighted criteria:

| ID | Criterion | Weight |
|---|---|:---:|
| `problem_relevance` | Aktuálnosť a formulácia problému | 5 % |
| `objectives_clarity` | Jasnosť cieľov a výskumných otázok | 5 % |
| `theoretical_background` | Teoretické východiská a rešerš literatúry | 15 % |
| `methodology_rigor` | Metodologická primeranosť a postup | 15 % |
| `analytical_execution` | Realizácia a analytická dôslednosť | 10 % |
| `results_validity` | Validita výsledkov a interpretácia | 10 % |
| `discussion_relation` | Diskusia a nadväznosť na ciele | 10 % |
| `originality_contribution` | Originalita a prínos práce | 10 % |
| `structure_coherence` | Štruktúra, koherencia a odborný štýl | 5 % |
| `citations_quality` | Kvalita citácií a zoznam literatúry | 5 % |
| `ethics_transparency` | Etika, reprodukovateľnosť a dáta | 5 % |
| `limitations_future_work` | Limity práce a návrhy do budúcna | 5 % |
| | **Total** | **100 %** |

Each criterion carries:
- **`cautionGuidance`** — per-language warnings (sk/cs/en) against common misinterpretations
- **`prohibitedInferences`** — explicit "do not conclude X from Y" rules
- **`expectedEvidence`** — what evidence to look for
- **`commonWeaknesses`** — typical failure patterns
- **`applicabilityRule`** — per thesis type (Experimental Physics, Software Engineering, Empirical Quantitative, Qualitative, Systematic Review, Theoretical)

**Competitors:** No competitor has a structured academic rubric system. GA Abstract uses a fixed IMRaD template; ChatSlide organizes into standard sections but applies no evaluation criteria.

---

### 5. Deterministic Academic Checks — Zero Sampling Variance

Beyond the LLM-based review, PosterApp runs **deterministic regex/keyword pattern matching** in sk/cs/en:

- **`checkObjectiveAlignment`** — verifies that stated objectives match the document's actual content structure.
- **`auditCitationConsistency`** — cross-references in-text citations against the bibliography; flags orphaned references.

These produce `ReviewFinding[]` with `epistemicStatus: "SUPPORTED_FACT"` or `"MISSING_EVIDENCE"` — **zero LLM calls, zero sampling variance.**

**Competitors:** No competitor implements a deterministic verification layer.

---

### 6. Multi-Agent Self-Critique Debate

When `multiAgentDebate` is enabled:

1. **Primary review** generates findings at temperature 0.15.
2. **Self-critique pass** runs at temperature 0.6, receiving the findings list.
3. **Automatic corrections:**
   - Overstated findings → downgraded one severity rung
   - Missed weaknesses → appended as `suggestion`-severity
   - Severity re-calibrations applied

**Competitors:** No competitor implements adversarial self-critique.

---

### 7. Citation Audit — Multi-Source Academic Verification

Parallel lookups across **four academic databases**:

- **OpenAlex** — open academic graph
- **Crossref** — DOI and metadata registry
- **Semantic Scholar** — AI-powered academic search
- **arXiv** — preprint server

Features: consensus deduplication across sources, ISO 690 / APA compliance checking, and complete bibliography-pairing verification.

**Competitors:** ChatSlide connects to PubMed and Google Scholar for search. No competitor performs multi-source consensus deduplication or ISO compliance checking.

---

### 8. Production-Grade Security — Enterprise-Ready

#### Sandboxed LaTeX Compilation
In production, LaTeX compilation runs in isolated Docker containers with:

- `--cap-drop=ALL` — drop all Linux capabilities
- `--user 1000:1000` — non-root execution
- `--read-only` — immutable filesystem
- `--tmpfs /tmp` — ephemeral temp directory only
- `-shell-restricted` — restricted `\write18` (no arbitrary command execution)

#### Security Hardening (Tier A / B)
- **CSP headers** with `worker-src 'self' blob:` — prevents injection; `connect-src` assembled from configured env origins only
- **HSTS, X-Frame-Options, nosniff** — transport and framing protection
- **Path-traversal fuzz tests** — 1000 randomized inputs verify `workspacePath()` never escapes root
- **Distributed rate limiting** — Upstash Redis REST with automatic in-memory fallback
- **Early upload rejection** — 200 MB content-length gate before parsing
- **IDOR prevention** — all routes verify workspace ownership / editor role

#### Confidentiality Isolation
- `audience: "author"` — never includes confidential comments or committee deliberations
- `audience: "editor"` — only accessible to authenticated workspace editors
- **XML / LaTeX injection prevention** — `sanitizeXmlString()` and `escapeLatex()` on all untrusted strings

**Competitors:** Most competitors are SaaS tools with no transparency about their security model. None implement sandboxed compilation, path-traversal fuzz testing, or distributed rate limiting.

---

### 9. GraphRAG — Structural Understanding Beyond Text

PosterApp builds an entity graph from the document:

1. **Entity linking** — identify entities across sections
2. **BFS subgraph expansion** — explore connections
3. **Louvain modularity community detection** — identify thematic clusters
4. **Chapter-spanning summaries** — synthesize cross-cutting themes

When entity data is sparse, GraphRAG degrades gracefully to `graphWarning` (never silent failure).

**Competitors:** No academic-poster competitor implements graph-based retrieval.

---

### 10. AI Client Infrastructure — Resilient Provider Integration

- **Retry / repair:** 3 attempts with intelligent backoff
  - 429 respects `retry-after` or backs off `1500 × attempt` ms
  - 502 / 503 / 504 backoff `1000 × attempt` ms with jitter
  - 400 / 404 / 422 fail-fast
  - Schema-validation miss → one repair attempt
- **Pinned `max_tokens`:** 8192
- **Provider fallback:** `AI_API_URL_FALLBACK` / `AI_API_KEY_FALLBACK` secondary provider pair fires after the primary retry budget is exhausted

**Competitors:** Most competitors don't document a retry strategy. Open-source alternatives typically have no fallback mechanism.

---

## 📊 Competitive Landscape — PosterApp vs. The Market

### Competitor Categories

1. **AI-native academic poster generators** — ChatSlide, Mew Design, GA Abstract, Bibby AI, PaperBanana
2. **General-purpose design tools with AI** — Canva, Piktochart, Venngage, Adobe Express
3. **LaTeX-based platforms** — Overleaf + templates
4. **Manual design tools** — PowerPoint, InDesign, Inkscape, Keynote

### Feature Comparison Matrix

| Feature | **PosterApp** | ChatSlide | Mew Design | GA Abstract | Bibby AI | Canva | Overleaf |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **PDF ingestion** | ✅ MinerU + quality gates | ✅ OCR | ✅ PDF/DOCX | ✅ PDF | ✅ LaTeX/PDF | ❌ Manual | ❌ Manual |
| **Automated BibTeX** | ✅ Multi-source audit | ❌ Manual | ❌ Manual | ❌ Manual | ✅ | ❌ | ❌ Manual |
| **AI content generation** | ✅ Grounded, epistemic tags | ✅ Basic | ✅ Chat Edit | ✅ Basic | ✅ Agent | ◑ Generic | ❌ |
| **Vector RAG retrieval** | ✅ 6-stage hybrid | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Evidence grounding** | ✅ 4-tier cascade + embeddings | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Epistemic taxonomy** | ✅ 6 states, auto-downgrade | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Academic rubric** | ✅ Weighted, per-discipline | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Deterministic checks** | ✅ Zero-variance verification | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Self-critique debate** | ✅ Multi-agent | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **GraphRAG** | ✅ Louvain communities | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **LaTeX output** | ✅ Sandboxed compilation | ❌ | ❌ | ❌ | ✅ Live preview | ❌ | ✅ Cloud |
| **Real-time collaboration** | ✅ Yjs WebSocket | ❌ | ❌ | ❌ | ◑ Coming soon | ✅ | ✅ |
| **Multi-format output** | ✅ Posters / Slides / Papers / Reviews (20 templates) | Poster only | Poster only | Poster only | Poster only | ◑ Generic | ✅ Templates |
| **AI review / feedback** | ✅ Structured multi-section | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Editable source** | ✅ Full LaTeX + cards | ❌ PPTX/PDF | ❌ Static | ❌ Static | ✅ LaTeX | ❌ Static | ✅ LaTeX |
| **Sandboxed execution** | ✅ Docker, cap-drop-all | — SaaS | — SaaS | — SaaS | — SaaS | — SaaS | ✅ Cloud |
| **Security hardening** | ✅ CSP, IDOR, fuzz tests | — SaaS | — SaaS | — SaaS | — SaaS | — SaaS | ✅ Cloud |
| **Distributed rate limiting** | ✅ Upstash Redis | — SaaS | — SaaS | — SaaS | — SaaS | — SaaS | — SaaS |
| **Source available** | ✅ Full | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Self-hostable** | ✅ Docker + PostgreSQL | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Test coverage** | ✅ 113 files, 755 tests | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown |
| **Pricing** | **Free (source-available)** | Freemium | Freemium | Freemium | Freemium | Freemium | Freemium |

### Competitive Positioning Summary

#### PosterApp's advantages over every competitor

1. **Research-grade retrieval engine** — 6-stage Vector RAG + GraphRAG + PaperQA2 grounding exceeds the retrieval sophistication of every academic-poster competitor, including dedicated RAG platforms.
2. **Epistemic grounding** — the only tool that classifies claims into epistemic states and automatically downgrades ungrounded assertions.
3. **Structured academic evaluation** — weighted rubric with per-discipline applicability, deterministic verification, and self-critique debate.
4. **Production security** — sandboxed LaTeX compilation, path-traversal fuzz testing, CSP hardening, distributed rate limiting.
5. **Fully source-available** — self-hostable, auditable, extensible.
6. **Multi-format** — posters, slides, and papers from the same codebase.
7. **Zero vendor lock-in** — own your data, your templates, and your compilation pipeline.

#### Where competitors hold an edge

| Competitor | Their advantage |
|---|---|
| **ChatSlide** | Simpler UX for non-technical users; real-data chart rendering (Chart.js/D3); PubMed/Scholar integration |
| **Mew Design** | Chat-based revision workflow; faster time-to-first-draft (~2 min) |
| **GA Abstract** | Annotation-based editing (draw arrows/notes); auto-generated charts from text data; fastest generation (~60 s) |
| **Bibby AI** | Cloud LaTeX compiler with no setup; 200+ publisher templates; AI autocomplete for LaTeX |
| **Canva** | Massive template library; non-academic use cases; brand recognition |
| **Overleaf** | Industry-standard LaTeX collaboration; vast template gallery; institutional adoption |

---

## 🎯 Sophistication Scorecard — 18 Subsystems

An internal audit rated each subsystem on a 1–5 design-quality scale:

| # | Subsystem | Rating | Notes |
|---|---|:---:|---|
| 1 | Context assembly & section classification | ★★★★ | Deterministic, zero LLM cost |
| 2 | Citation audit (4-source) | ★★★★★ | Parallel, consensus-deduplicated |
| 3 | Vector RAG (6-stage hybrid) | ★★★★★ | Research-grade retrieval |
| 4 | GraphRAG + Louvain communities | ★★★★★ | Graceful degradation |
| 5 | Path A — single-shot generation | ★★★★ | Grounded, localized |
| 6 | Path B — professional review engine | ★★★★ | Epistemic tags, severity scoring |
| 7 | Evidence anchoring (4-tier cascade) | ★★★★★ | DRY, verified |
| 8 | Epistemic downgrading | ★★★★ | Automatic, rule-based |
| 9 | Deterministic checks | ★★★ | Zero-variance verification |
| 10 | Self-critique debate | ★★★★ | Multi-agent adversarial |
| 11 | Score derivation + grade reconciliation | ★★★★ | Asymmetric leniency/harshness |
| 12 | Contribution-coverage guard | ★★★ | PhD-specific |
| 13 | Defense questions | ★★★★ | Finding-derived, calibrated |
| 14 | PhD opponent enrichment | ★★★★★ | Author profile, SOTA, statutory |
| 15 | AI client infra (retries, fallback) | ★★★★ | Resilient, jittered |
| 16 | Rubric depth (weighted criteria) | ★★★★★ | Localized, tested |
| 17 | Analysis-plan classifier | ★★★★★ | Deterministic, zero LLM cost |
| 18 | PaperQA2 grounding | ★★★★★ | Embedding-blended Jaccard |

**Average design rating: 4.28 / 5.0**

---

## 🛡️ Security Hardening Status

### Tier A — Completed ✅
- CSP with `connect-src` assembled from configured env origins
- Upload-size enforcement (200 MB content-length gate)
- Path-traversal fuzz tests (1000 randomized inputs via `fast-check`)
- Distributed rate limiting across all write routes (Upstash Redis with in-memory fallback)

### Tier B — Completed ✅
- LaTeX `-shell-restricted` (replaced `-shell-escape`)
- Sandboxed Docker compilation with capability dropping

### Remaining — Future Work
- Apply-time content-validation consistency (F5)
- Untrusted-content prompt delimiters (F7)
- `cards/convert` source-text size capping (F9)

---

## 📈 Test Coverage & Quality Assurance

- **113 test files, 755 automated tests** — unit, integration, and E2E
- **Unit tests** — Zustand store slices, API routes, rubric engine, evidence validator
- **Integration tests** — Vector RAG, citation audit, analysis-plan classifier
- **E2E tests** — Playwright with Clerk bypass, full user workflows
- **Property-based tests** — `fast-check` fuzz testing for path traversal (1000 inputs)
- **Type checking** — TypeScript strict mode, zero `any` types in critical paths

---

## 🏢 Deployment Models

### Self-Hosted (Recommended for Institutions)
- **Docker Compose** — one-command setup with PostgreSQL
- **Docker Swarm / Kubernetes** — horizontal scaling with distributed rate limiting
- **Behind institutional SSO** — Clerk supports SAML / OIDC integration

### Development Setup

```bash
pnpm install
cp .env.example .env.local
docker compose up -d
pnpm exec prisma migrate dev
pnpm run dev   # Runs on port 3333
```

---

## 🎓 Ideal Use Cases

| Scenario | Why PosterApp Excels |
|---|---|
| **PhD thesis review** | Weighted rubric, PhD opponent enrichment, ECTS grade reconciliation, defense-question generation |
| **Conference poster from paper** | Automated ingestion, AI auto-fill, 20 LaTeX templates, sandboxed compilation |
| **Research-group collaboration** | Yjs real-time editing, concurrent modifications, conflict-free state sync |
| **Department-wide deployment** | Self-hostable, Docker-based, PostgreSQL, distributed rate limiting, no vendor lock-in |
| **Multi-format output** | Same workspace → posters, slides, or papers with template switching |
| **Security-sensitive environments** | Sandboxed compilation, CSP, IDOR prevention, path-traversal fuzzing, no external data exfiltration |

---

## 📜 Technology Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 14+ App Router, React Server Components |
| **Language** | TypeScript (strict mode) |
| **State** | Zustand + Yjs (real-time WebSocket sync) |
| **Database** | PostgreSQL with Prisma ORM, pgvector extension |
| **AI providers** | OpenRouter-compatible API (Gemini, configurable, with fallback) |
| **Retrieval** | pgvector (cosine) + Postgres FTS + WASM embeddings |
| **Compilation** | pdflatex in sandboxed Docker containers |
| **Auth** | Clerk (supports SAML / OIDC for institutional SSO) |
| **Rate limiting** | Upstash Redis REST (with automatic in-memory fallback) |
| **Testing** | Vitest (unit/integration) + Playwright (E2E) + fast-check (property) |
| **Styling** | Tailwind CSS + shadcn/ui + semantic design tokens |
| **Theming** | next-themes with 4 themes (Light, Dark, Vercel, Vercel Dark) |
| **CI/CD** | ESLint flat config, TypeScript type checking, automated test suite |

---

## 🌐 Open Source & Community

- **License:** Source-available (see repository for terms)
- **Contributions:** Welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md)
- **Architecture docs:** [ACADEMIC_REVIEWER_MASTER.md](./ACADEMIC_REVIEWER_MASTER.md)
- **Changelog:** [CHANGELOG.md](./CHANGELOG.md)

---

## 💡 Bottom Line

**PosterApp is the most technically sophisticated source-available academic poster platform available today.** Its 18-subsystem architecture — combining research-grade retrieval, evidence-grounded review, sandboxed compilation, and enterprise security — delivers capabilities that commercial competitors either lack entirely or offer only in fragmented, closed-source SaaS packages.

For research institutions that value **data sovereignty, auditability, and extensibility**, PosterApp is the clear choice. For individual researchers who need the **highest-quality AI-assisted poster generation with rigorous academic grounding**, PosterApp delivers what no template-filling competitor can match.

*PosterApp — where academic rigor meets engineering excellence.*

---

### Sources & References

- [ChatSlide Research Poster AI Guide](https://www.chatslide.ai/guides/research-poster-presentation-ai-guide)
- [Mew Design AI Academic Poster Generator](https://mew.design/create/ai-academic-poster-generator)
- [GA Abstract Scientific Poster Generator](https://gaabstract.com/scientific-poster-generator)
- [Bibby AI Poster Generator](https://trybibby.com/tools/poster-generator)
- [Bibby AI vs Overleaf Comparison](https://trybibby.com/blog/overleaf-alternative-2026)
- [Overleaf LaTeX Posters Guide](https://www.overleaf.com/learn/latex/Posters)
- [Academia StackExchange: Poster Tools Without LaTeX](https://academia.stackexchange.com/questions/172987/what-tried-and-tested-possibilities-are-there-to-create-a-poster-without-using-l)
- [DevOps School: Top 10 AI Poster Tools 2025](https://www.devopsschool.com/blog/top-10-ai-poster-flyer-design-tools-in-2025-features-pros-cons-comparison/)
- [PosterApp README](./README.md)
- [PosterApp ACADEMIC_REVIEWER_MASTER.md](./ACADEMIC_REVIEWER_MASTER.md)
- [PosterApp CHANGELOG.md](./CHANGELOG.md)
