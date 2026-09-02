# Academic Review Pipeline — Full Architecture, Sophistication Assessment & Perfection Roadmap

**Read this first if:** you're picking up work on `thesis-review` generation and need the
real picture, not the marketing-comment picture. Everything below was verified by reading
the actual code (`lib/ai/*`, `lib/services/academic-connector.ts`,
`app/api/workspaces/[id]/thesis-review/*`) and cross-checking with a live DB record and the
test suite — not inferred from doc comments alone. File:line references are given so you
can jump straight to the source.

**One-sentence verdict:** the codebase contains a genuinely research-grade retrieval and
evidence-grounding engine, but it sits almost entirely behind an off-by-default
`professionalMode` flag — the default generation path most real reviews take is a
comparatively basic single-shot LLM call that inherits the good retrieval as raw context
but none of the grounding, scoring, or validation guarantees. The highest-leverage work
is not building more sophistication (there's already plenty, well-tested) — it's wiring
what exists into the path people actually use.

---

## §1 — Entry point and request shape

`POST /api/workspaces/[id]/thesis-review` (`route.ts`). Body: `thesisMetadata`
(student, title, level, reviewer role/name, language, `reviewKind`, `reportingStandard`),
optional `sourceFileId`, `focusCriteria`, `skipCitationAudit`, `professionalMode`,
`multiAgentDebate`. Rate-limited 3 req / 5 min / user. Auth via `requireWorkspaceEditor`
(role-based, not owner-only — this was Task 0 of `CODING_AGENT_PROMPT_grading_fixes.md`).

Every request must have parsed source text already ingested (MinerU) — the route hard-fails
with `THESIS_SOURCE_REQUIRED` (422) if `ragContext.totalChars === 0`. No generation ever
happens against an empty/unparsed document; this guard is unconditional and good.

---

## §2 — Shared context-assembly pipeline (runs for BOTH generation modes)

This is the part that's actually always-on, regardless of `professionalMode`:

1. **`loadThesisContext`** (`lib/ai/thesis-context.ts`) — parses the MinerU markdown into
   hierarchical sections (`parseDocumentSections`), classifies each section's semantic kind
   (`classifySectionKind`), and routes evidence-rich excerpts per criterion
   (`routeSectionsForCriterion`) instead of just truncating the raw document. Deterministic,
   no LLM cost.
2. **Vector index readiness check** — informational `vectorWarning` if pgvector indexing is
   still running/pending/errored for this workspace (race-condition guard against reviewing
   before ingestion finishes).
3. **Citation audit** (`lib/services/academic-connector.ts`, `auditThesisCitations`) —
   parallel lookups across **OpenAlex, Crossref, Semantic Scholar, and arXiv**, consensus
   deduplication across providers, ISO 690 completeness/metadata-discrepancy checking
   (`checkIso690Issues`). Runs unconditionally unless `skipCitationAudit`. This is a real,
   commercially-competitive citation verifier, not a stub.
4. **Vector RAG** (`lib/ai/vector-rag.ts`) — 6-stage hybrid retrieval per criterion, run in
   parallel across all active criteria:
   - Stage 1: multi-query fan-out (3 reformulations, pure local transform, no API cost)
   - Stage 2: HyDE (embeds a generated hypothetical answer alongside the raw query)
   - Stage 3: Reciprocal Rank Fusion (k=60) over 70% pgvector cosine + 30% Postgres FTS
   - Stage 4: MMR deduplication (word-bigram/trigram/char-4gram Jaccard, <1ms/20 chunks)
   - Stage 5: criterion-aware reranking (heading alignment boosts)
   - Stage 6: contextual compression (TF-IDF-style sentence trimming, ~35-40% token reduction)
5. **GraphRAG** (`lib/ai/graph-rag.ts` + `lib/ai/graph-communities.ts`) — entity linking
   (lexical scoring with local-embedding fallback) → BFS subgraph expansion → deterministic,
   provenance-tagged serialization (`[doc: name]` on every fact). Community layer runs a
   from-scratch **Louvain modularity** implementation over the workspace's `GraphNode`/
   `GraphEdge` tables to build LightRAG-style "global" chapter-spanning summaries, addressing
   context fragmentation in long PhD documents specifically. Budget-shared with vector RAG;
   degrades to a `graphWarning` (not silent failure) when starved or no graph exists yet.

All four of the above (citation audit, vector RAG, GraphRAG, community context) feed into
`sourceContextWithAudit`, which becomes part of the prompt for **both** the standard and
professional generation branches. This part of the system is well-integrated and shared —
it is not part of the gap described below.


---

## §3 — Where the pipeline forks: `professionalMode` routing

Everything in §2 is shared. Here is exactly where the two generation paths diverge and
what triggers each one.

`route.ts` decides the branch with a single boolean expression:

```ts
if (body.professionalMode || thesisMetadata.reviewKind === "paper"
    || (thesisMetadata.reportingStandard && thesisMetadata.reportingStandard !== "none")) {
  // → generateProfessionalReview()  (lib/ai/review-engine.ts)
} else {
  // → generateAIResponse("thesis-review", ...)  single-shot call (lib/ai/client.ts)
}
```

Both UI entry points that call this route — `components/thesis-review/thesis-metadata-panel.tsx`
(`handleGenerate`, ~line 279) and `components/thesis-review/thesis-review-panel.tsx`
(`handleGenerate`, ~line 113) — compute `professionalMode` client-side with the
**identical** expression:

```ts
professionalMode: formMetadata.reviewKind === "paper" || formMetadata.reportingStandard !== "none",
```

Neither panel exposes a manual "Professional / Expert mode" checkbox anywhere. There is
no first-class UI control for `professionalMode` at all — it is entirely derived from two
other form fields, both of which default away from it: `reviewKind` defaults to
`"thesis"` (first `REVIEW_KINDS` option, and the Zod default), `reportingStandard`
defaults to `"none"`.


So the most common real-world case — a supervisor or opponent reviewing a standard
Bachelor's/Master's/PhD thesis, not a submitted paper, without manually picking a
CONSORT/PRISMA/STROBE/ML-reproducibility checklist — silently takes the weak path. A
reviewer would need to know that selecting "Scientific Paper" as `reviewKind`, or opening
the (not obviously related) reporting-standard dropdown and picking something other than
"None", is what unlocks the sophisticated engine. Nothing in the UI copy documents this;
`professionalMode` is invisible as a concept to the person actually using the tool.

`multiAgentDebate` (the adversarial self-critique second pass inside
`generateProfessionalReview`, §5.5) is gated even further — it defaults to `false` in the
Zod schema, and neither panel was found setting it to anything but that default. So even
when the professional path *is* reached, the self-critique pass is off unless a caller
sets it explicitly, and no UI control for it was found either.

## §4 — Path A: the default/standard generation (what most reviews actually get)

`generateAIResponse("thesis-review", { schema: ThesisReviewGenerationSchema, ... })` — a
**single** call to the LLM. The prompt (`buildSystemPrompt` + `buildUserPrompt` in
`route.ts`) is a solid, carefully-localized (sk/cs/en) instruction set: it states
grounding rules ("do not invent chapters/experiments/citations", "explicitly note when
evidence is absent"), embeds the level-appropriate grade anchors from
`THESIS_LEVEL_PROFILES`, and wraps untrusted content via `wrapUntrustedContext` — the
source document, criteria list, and metadata are each fenced separately so the model can
distinguish instructions from content (real prompt-injection hygiene).

What it does **not** get, compared to Path B:


- No per-finding evidence anchoring/verification — §5's `anchorEvidenceQuotes` /
  `evidence-validator.ts` machinery is never called on this path; the model's
  `ThesisReviewSection.text` free text is trusted as-is.
- No epistemic-status tagging (SUPPORTED_FACT vs REVIEWER_JUDGMENT vs MISSING_EVIDENCE) —
  that vocabulary exists only in the professional schema.
- No severity-derived scoring — `numericScore` is whatever the model states, with no
  `computeScoreFromFindings`-style reconciliation against anything.
- No deterministic cross-checks — `checkObjectiveAlignment` / `auditCitationConsistency`
  (regex-based but real, evidence-producing checks) run only inside
  `generateProfessionalReview`.
- No self-critique pass, no PhD enrichment (author profile / SOTA benchmarking /
  statutory clause), no calibrated defense-question generation — it gets a flat
  "formulate exactly 3 defense questions" instruction baked into the JSON-shape spec,
  answered by the same single call that wrote the assessments.
- `validateGeneratedSections` (`contracts.ts`) is the only post-generation check: it
  verifies every requested criterion ID is present exactly once and non-empty. That is a
  **shape** check, not a grounding check — a confidently-hallucinated but well-formed
  section passes it without complaint.

The Vector RAG (§2.4) and GraphRAG (§2.5) context *is* injected into this path's prompt
(via `sourceContextWithAudit`), so retrieval quality is shared with Path B. What is not
shared is everything downstream of retrieval: nothing verifies the model actually
grounded its prose in what was retrieved.


## §5 — Path B: the professional review engine (`generateProfessionalReview`)

This is the pipeline's most sophisticated component, and it deserves a straight
description of what's real in it before the roadmap gets to what's missing.

**5.1 — Generation.** One `generateAIResponse` call (temperature 0.15) against
`ProfessionalReviewGenerationSchema`, with a considerably more demanding system prompt
than Path A: it requires an explicit `epistemicStatus` tag per finding (6-value enum),
strict severity definitions (critical/major/minor/suggestion mapped to concrete
publication-readiness consequences, not vibes), an instruction to identify "what is
missing, what is wrong, and what is filler" (explicit anti-sycophancy framing), and a
warning against inventing causal relationships between separately-cited quotes — a
specific, well-targeted anti-hallucination instruction.

**5.2 — Evidence anchoring (`anchorEvidenceQuotes`).** Every finding's evidence quotes
are matched back against the parsed source sections through a 4-tier cascade: exact
substring match → whitespace-normalized match → ambiguous (matches >1 section) →
60-character-anchor approximate match (explicitly designed to resist an LLM hallucinating
a continuation after a real opening fragment) → unverified. This logic is duplicated
almost verbatim in `evidence-validator.ts`'s `verifyEvidenceQuote` (same four tiers, same
60-char threshold, same confidence values 1.0 / 0.95 / 0.45 / 0.1) — see §11 Task 5 for
the dedup recommendation.

**5.3 — Epistemic downgrading (`validateAndCalibrateFindings`).** A finding tagged
`SUPPORTED_FACT` with no verified evidence is mechanically downgraded to
`REQUIRES_HUMAN_VERIFICATION` and its confidence capped at 0.4; `SUPPORTED_INTERPRETATION`
without verified evidence drops to `REVIEWER_JUDGMENT`, capped at 0.5. This is a genuine,
non-cosmetic grounding invariant — the model cannot simply *claim* SUPPORTED_FACT status
and have it stick.


**5.4 — Deterministic layer (`academic-checks.ts`).** `checkObjectiveAlignment` and
`auditCitationConsistency` are regex/keyword-pattern checks (Slovak/Czech/English phrase
matching for "cieľom práce je", "hypotéza", placeholder tokens like `[TODO]`/`[?]`, etc.)
that run **independently of the LLM** and contribute their own `ReviewFinding` objects
with `epistemicStatus: "SUPPORTED_FACT"` or `"MISSING_EVIDENCE"`. These are unglamorous
but valuable precisely because they're deterministic — a placeholder citation token or a
missing goal statement either is or isn't in the text; no sampling variance. This is the
least sophisticated-*looking* part of the pipeline and one of its most reliable parts.

**5.5 — Structured self-critique (`generateSelfCritique`, gated on `multiAgentDebate`).**
A genuinely well-designed second LLM call at temperature 0.6 (vs. 0.15 for the primary
pass — a real, not cosmetic, divergence mechanism) that receives the primary findings
list and must flag overstated findings (auto-downgraded one severity rung + marked
`needs_human_review`), missed weaknesses (appended as new `suggestion`-severity findings,
capped at 3, `includeInExport: false` until a human confirms), and explicit severity
re-calibrations with reasons. This is a legitimate adversarial-debate pattern, not
prompt-theater — but per §3, it's off by default with no UI control.

**5.6 — Score derivation and grade reconciliation.** `computeScoreFromFindings` applies a
fixed deduction schedule (critical −20, major −8, minor −2, suggestion −0.5, floor 10) to
turn the *actual* validated finding list into a numeric score — replacing what a prior
version apparently hardcoded (the code comment explicitly says "instead of the previously
hardcoded constant 85"). `reconcileGrade` then refuses to let the model's self-reported
grade be more lenient than the derived grade by more than 15 ECTS-score points; if it is,
the derived (harsher) grade wins and a reconciliation note is appended to `debateLog`.
Worth naming: this only ever corrects *leniency* — it never corrects a self-reported grade
that is harsher than the evidence supports, an asymmetric guardrail (§11 Task 7).


**5.7 — Contribution-coverage guard (`checkContributionCoverage`).** PhD-only: if not a
single finding touches originality/contribution, that silence is itself converted into a
`major`-severity, `REQUIRES_HUMAN_VERIFICATION` finding, specifically so a dissertation
that got no findings at all doesn't read as "flawless" by default. Small, sharp,
well-targeted design.

**5.8 — Defense questions (`generateCalibratedDefenseQuestions`).** The docstring claims
"5–12 targeted, evidence-grounded defense questions." The implementation is a fixed
template of exactly 5 questions (methodology, results/validation, limitations,
contribution, literature) with static bilingual phrasing — only question #6 (present only
if a `critical`/`major` finding exists) is actually derived from that manuscript's
findings. In practice every review gets the same 5 generic questions plus at most 1
manuscript-specific one — never the 12-question upper bound the docstring promises, and
"calibrated" overstates what is templated boilerplate for 5 of 6 slots. This is the
component most over-described relative to its actual sophistication.

**5.9 — PhD opponent enrichment.** For `thesisType === "phd"` + `reviewerRole ===
"opponent"`, three calls run in parallel via `Promise.all` (each independently
try/caught, so one failure doesn't sink the others): `fetchAcademicAuthorProfile`,
`searchAcademicPaper` (SOTA benchmarking, year-filtered to the last 2 years), and a
citation audit. It also injects a hardcoded statutory clause (§54 ods. 3, Zákon č.
131/2002 Z. z. — Slovak higher-education law), selected by
`options.language === "sk" ? <sk clause> : <en clause>`. There is no `"cs"` branch: a
Czech-language PhD review (`language: "cs"`) silently falls through to the *English*
translation of the *Slovak* statutory clause — wrong on both the language and the
jurisdiction for a Czech defense. Also not conditioned on `institution`/`department`, so
it is unconditionally correct only for Slovak institutions (§11 Task 6).


## §6 — The AI client/infrastructure layer: where the resilience gap actually lives

`lib/ai/client.ts`'s `generateAIResponse` is the single choke point every text-generation
call in this document goes through (`generateSelfCritique`, both review generation calls,
HyDE's `generateHypotheticalDocument`, etc.). Reading it end to end:

- **Zero retries.** One `fetch`, one attempt. A transient 429/500/502 from the provider,
  a single malformed-JSON response, or one schema-validation miss (e.g. the model returns
  `severity: "Critical"` instead of `"critical"` in a field the Zod preprocess layer
  doesn't normalize) throws immediately and the *entire* review generation fails —
  surfacing as a raw 500 to the user, who has just spent one of their 3 requests/5min on
  it.
- **No repair-loop.** `parseAiJson` (`lib/ai-helpers.ts`) does real work — strips code
  fences, tries a direct parse, then falls back to regex-extracting the first `{...}` or
  `[...]` block — but if that still fails, or `schema.safeParse` fails after a successful
  parse, there is no "send the error back to the model and ask it to fix the JSON" second
  attempt anywhere in the codebase. Compare this to `lib/services/vision-service.ts` and
  `lib/services/semantic-scholar-service.ts`, both of which *do* implement retry-on-429
  with backoff — the resilience pattern exists in this codebase, just not on the path
  that matters most (review generation).

- **No fallback-model chain for text generation.** `models.ts` defines a 10-model
  `DEFAULT_FALLBACK_VISION_MODELS` chain and a `getVisionModelChain()` helper — but
  `generateAIResponse` takes a single `model` string and never consults a fallback chain.
  If `gemini-3.7-flash` (the default for every `AiModelRole` except vision/OCR) has an
  outage, every text-generation feature in the app degrades simultaneously with no
  automatic failover, while vision/OCR alone would fail over gracefully.
- **`max_tokens` can be `undefined`.** `options.maxTokens` is optional and no caller in
  the review pipeline sets it, so the payload sends `max_tokens: undefined` — behavior
  then depends entirely on the provider's unspecified default. For a 90k+-char context
  assembled from four RAG layers, an unbounded (or provider-default, possibly
  too-small) output ceiling is worth pinning explicitly.
- **`response_format: { type: "json_object" }`**, not a JSON-Schema-constrained mode. If
  the provider behind `AI_API_URL` supports strict schema-constrained decoding (most
  OpenAI-compatible endpoints now do, under some `json_schema`/`strict` variant),
  switching to it would eliminate most of the malformed-output surface this whole retry
  discussion is about, at the source, instead of validating-and-hoping after the fact.

None of this is specific to thesis-review — it's a shared foundation-layer gap affecting
the whole app equally. But because thesis-review is the feature with the most downstream
work riding on one successful structured-output call (RAG assembly, citation audit,
GraphRAG traversal all precede it), it's the feature where a single unrepaired failure is
most expensive to the user.


## §7 — Two rubric systems, only one of which reaches the model

`lib/ai/thesis-rubric.ts` defines `THESIS_CRITERIA`: **7** criteria (formal structure,
goals/problem definition, methodology, results, originality, language quality, citations)
plus a zero-weight "defense questions" placeholder. This is what `route.ts` actually
builds the prompt's `criteriaList` from, for *both* generation paths — it is the only
rubric the LLM ever sees.

`lib/ai/rubric-engine.ts` defines `SK_ACADEMIC_RUBRIC_V1`: **13** criteria with, per
criterion, weight, bilingual description, `expectedEvidence` (2-3 bullets),
`commonWeaknesses` (bullets), `cautionGuidance` (a specific instruction on how *not* to
over-penalize — e.g. "absence of the phrase 'the goal is' does not mean absence of a
problem statement — check the full introductory context"), `prohibitedInferences` (an
explicit "do not conclude X from Y" rule), and a `thesisType`-aware `applicabilityRule`
(e.g. `analytical_execution` is `"partially_applicable"` for `"theoretical"` theses). All
of it is localized in sk/cs/en and unit-tested (`lib/__tests__/rubric-engine.test.ts`
checks weights sum to 100, checks every criterion has non-empty
`cautionGuidance`/`prohibitedInferences`, checks applicability calibration).


The only place `SK_ACADEMIC_RUBRIC_V1` and `getApplicableCriteriaForThesisType` are
actually consumed is `lib/ai/analysis-plan.ts` (§8) — an **opt-in preflight** endpoint,
not the generation call. `generateProfessionalReview` imports exactly one thing from
`rubric-engine.ts`: `calculateGradeRange`. None of the `cautionGuidance` or
`prohibitedInferences` text — arguably the single highest-value anti-hallucination
content in the entire codebase, purpose-written to stop a reviewer (human or AI) from
penalizing a thesis for the wrong reasons — ever reaches a system prompt. The LLM writing
findings has no access to "don't fault a qualitative thesis for missing statistical
tests" or "don't require formal hypotheses in a pure engineering/software project," even
though someone already wrote precisely that guidance, in three languages, criterion by
criterion.

## §8 — The analysis-plan engine: a real classifier nobody downstream reads

`generateReviewAnalysisPlan` / `buildAnalysisPlanFromRAG` (`lib/ai/analysis-plan.ts`,
backing `POST .../thesis-review/analysis-plan`, surfaced via
`analysis-plan-panel.tsx` and triggered by `handlePreflight`) is entirely
**deterministic — zero LLM calls** — and genuinely capable:


- Discipline + detailed-thesis-type classification (`classifyDisciplineAndThesisType`,
  `document-understanding.ts`) with a confidence score and cited source anchors.
- Study-design detection via keyword clustering (ML/CONSORT/PRISMA/STROBE signal words)
  feeding a *recommended* reporting standard — this is the auto-detection that, if wired
  up, would remove the need for a reviewer to manually know what "STROBE" or
  "ml_reproducibility" mean in order to get the professional-mode benefits from §3.
- The full `getApplicableCriteriaForThesisType(classification.thesisType,
  SK_ACADEMIC_RUBRIC_V1)` matrix — the 13-criterion rubric with per-thesis-type
  applicability, computed and ready to use.
- Extraction-quality and citation-availability estimates, a hierarchical TOC tree,
  expected-but-missing section detection (Introduction/Methodology/Results/Discussion/
  Conclusion), and a `canProceedToDeepReview` gate.

A reviewer can call this, read the recommendation, and *manually* re-enter the
recommended reporting standard into the metadata form to get professional mode — but
nothing pipes `recommendedReportingGuideline` or `applicableCriteria` from an
analysis-plan response back into the actual generation request. It's a fully-built
advisory panel sitting next to, not inside, the pipeline it was built to inform.

## §9 — Built and wired to nothing: the PaperQA2 grounding pattern

`lib/ai/evidence-validator.ts` contains `groundClaimInChunks` and
`formatGroundedEvidenceBlock` — a token-overlap (Jaccard-style, no LLM cost) mechanism
that, given a claim and a set of retrieved chunks, finds the single best verbatim
supporting sentence and formats it as a "quote verbatim from these passages, do not
fabricate outside this list" block, meant to be injected *before* generation so the model
retrieves-then-grounds rather than writes-then-hopes-a-validator-catches-it. The docstring
states the intended flow explicitly: "Used by the review engine BEFORE generating text:
retrieve → ground → generate."


## §10 — Sophistication scorecard

Two axes: **design sophistication** (1–5, engineering judgment — a reliable 2/5 regex
check is not "worse" than a 5/5 RAG stage, just differently scoped) and **production
reach** (does a real reviewer's output actually benefit from it). The gap between the two
columns is the actual finding of this document.

| # | Subsystem | File(s) | Design | Reaches Path A (default) | Reaches Path B (professional) | Reaches saved/exported record |
|---|---|---|---|---|---|---|
| 1 | Context assembly & section classification | `thesis-context.ts` | 4/5 | Yes | Yes | Yes |
| 2 | Citation audit (OpenAlex/Crossref/S2/arXiv) | `academic-connector.ts` | 5/5 | Yes (unless `skipCitationAudit`) | Yes | Yes |
| 3 | Vector RAG (6-stage hybrid) | `vector-rag.ts` | 5/5 | Yes | Yes | Yes |
| 4 | GraphRAG + Louvain communities | `graph-rag.ts`, `graph-communities.ts` | 5/5 | Yes | Yes | Yes |
| 5 | Path A single-shot generation | `route.ts` | 2/5 — shape validation only | **Yes — the path most reviews take** | — | Yes |
| 6 | Path B primary generation (epistemic tags, anti-sycophancy) | `review-engine.ts` §5.1 | 4/5 | — | Yes | Yes |
| 7 | Evidence anchoring (4-tier cascade) | `review-engine.ts` + `evidence-validator.ts` (duplicated) | 4/5, −1 for duplication | — | Yes | Yes |
| 8 | Epistemic downgrading | `evidence-validator.ts` | 4/5 — real invariant | — | Yes | Yes |
| 9 | Deterministic checks (objective/citation) | `academic-checks.ts` | 3/5 — regex, zero-variance | — | Yes | Yes |
| 10 | Self-critique (`multiAgentDebate`) | `review-engine.ts` §5.5 | 4/5 — genuine adversarial pass | — | Only if caller sets `multiAgentDebate:true` — **no UI does** | Yes, when triggered |
| 11 | Score derivation + grade reconciliation | `review-engine.ts` §5.6 | 3/5 — asymmetric (leniency-only) | — | Yes | Yes |
| 12 | Contribution-coverage guard | `review-engine.ts` §5.7 | 3/5 — small, sharp, PhD-only | — | Yes (PhD only) | Yes |
| 13 | Defense questions (calibrated) | `academic-checks.ts` | 2/5 — 5 fixed templates + 1 derived; docstring overclaims 5–12 | — | Computed | **Inconsistent — see Task 2**: DB record gets the calibrated questions (flattened to strings); the immediate API response the reviewer sees does not |
| 14 | PhD enrichment (author profile/SOTA/statutory clause) | `review-engine.ts` §5.9 | 4/5, −1 for `cs`/institution bug | — | Yes (PhD+opponent only) | Yes |
| 15 | AI client/infra (retries, fallback, schema mode) | `client.ts` | 1/5 — zero retries, no repair loop, no fallback chain, unbounded tokens | Single point of failure | Single point of failure | N/A |
| 16 | Rubric depth (13-criterion `SK_ACADEMIC_RUBRIC_V1`) | `rubric-engine.ts` | 5/5 — bilingual, `cautionGuidance`, `prohibitedInferences`, unit-tested | — | **No — only `calculateGradeRange` is imported** | No |
| 17 | Analysis-plan classifier | `analysis-plan.ts` | 5/5 — deterministic, zero LLM cost | Opt-in preflight, manual re-entry required | Opt-in preflight, manual re-entry required | No |
| 18 | PaperQA2 grounding (`groundClaimInChunks`) | `evidence-validator.ts` | 4/5 — sound token-overlap design | **No call sites** | **No call sites** | No |

**Reading the table:** rows 1–4 and row 15 are the two extremes of this codebase — the
best-integrated code in the app, and the least resilient, and both apply to *every*
review regardless of mode. Rows 5 vs. 6–14 are the `professionalMode` fork. Rows 13, 16,
18 are the real story: three pieces of above-median engineering (calibrated questions,
the 13-criterion rubric, PaperQA2 grounding) that today's user gets zero benefit from —
for three *different* structural reasons: one is computed then silently dropped on one
of two output paths, one is built but never imported into the generation prompt, one has
no caller anywhere in the codebase.

Weighted by what a real review actually experiences: **retrieval/context ≈ 5/5,
generation/validation ≈ 2.5/5 (Path A) to 4/5 (Path B — and Path B is itself running at
roughly half its designed potential given rows 13/16/18), infrastructure resilience ≈
1/5.** The ceiling of this pipeline is well above what any real review currently gets.


## §11 — Perfection roadmap: prioritized punch list

Ordered by (impact × how many reviews it touches) ÷ effort. **P0** = fix first, changes
what most users experience today. **P1** = high-value inside professional mode, which is
supposed to be the "good" path. **P2** = correctness/maintainability. **P3** = judgment
calls that need a decision, not just an implementation — flagged, not fully specified.

**P0 — touches every review, low-to-medium effort**
1. Fix `professionalMode` discoverability — the sophisticated path is currently
   invisible; most real reviews silently take Path A. *(Task 1 below)*
2. Fix the defense-questions inconsistency between the immediate API response and the
   saved DB record — the calibrated, finding-derived questions (academic-checks.ts) are
   already computed and already reach the database; a one-line oversight in `route.ts`
   means the reviewer's *first* look at a freshly generated review shows two generic
   LLM-freeform questions instead. *(Task 2)*
3. Add retry/repair + a pinned `max_tokens` to `generateAIResponse` — single point of
   failure for the entire feature, on both paths, with the most expensive request
   (RAG + citation audit + GraphRAG all precede it) most exposed to it. *(Task 3)*

**P1 — professional-mode reviews only, but that's the path meant to be authoritative**
4. Wire `SK_ACADEMIC_RUBRIC_V1`'s `cautionGuidance` / `prohibitedInferences` into the
   professional system prompt — the single highest-value unused asset in the codebase.
   *(Task 4)*
5. Wire `groundClaimInChunks` as pre-generation grounding — turns "hope the model
   grounded itself" into "show the model verbatim evidence before it writes."
   *(Task 5)*
6. Fix the missing `cs` statutory-clause branch and make PhD enrichment
   institution-aware instead of assuming Slovak jurisdiction whenever the UI language
   isn't `sk`. *(Task 6)*

**P2 — correctness / maintainability, lower urgency**
7. Dedupe `anchorEvidenceQuotes` (`review-engine.ts`) against `verifyEvidenceQuote`
   (`evidence-validator.ts`) — the same 4-tier cascade is maintained in two places; a
   future threshold change (e.g. the 60-char approximate-match anchor) has to be made
   twice or the two will silently drift apart. *(Task 7)*
8. Make defense-question generation genuinely finding-derived instead of 5 fixed
   templates + 1 derived slot, and correct the docstring's "5–12" claim to match
   reality. *(Task 8)*

**P3 — larger, judgment-call items — flagged for a decision, not specified as tasks**
9. Pipe `analysis-plan.ts`'s `recommendedReportingGuideline` / `applicableCriteria`
   back into the generation request, so reporting-standard auto-detection (§8) can
   activate professional mode on its own recommendation instead of requiring the
   reviewer to already know what STROBE/CONSORT/`ml_reproducibility` mean. This mostly
   obsoletes the *need* for Task 1's manual indicator, longer-term — Task 1 should still
   ship first since it's far cheaper and covers the interim.
10. Reconsider the leniency-only asymmetry in `reconcileGrade` (§5.6) — decide
    deliberately whether an overly *harsh* self-reported grade should also be pulled
    toward the derived grade, or whether "erring conservative" is intentional
    institutional policy. This is a product decision, not a bug fix.
11. Add a fallback-model chain for text generation, mirroring the existing
    `DEFAULT_FALLBACK_VISION_MODELS` / `getVisionModelChain()` pattern in `models.ts`.
    Sequence this *after* Task 3 (retry) — retry is cheaper to build and catches more
    failure modes (a transient 500 doesn't need a whole model swap); failover is the
    next increment once retry is in place.

Tasks 1–8 are fully specified below for direct execution by a coding agent. Items 9–11
need a human decision on scope/policy before they can be turned into tasks the same way.


## §12 — Task specifications (Tasks 1–8, verified against source line-by-line)

Every reference below was re-read directly from the working tree at
`C:\Users\marek\Documents\Robco PhD\PosterApp` before being written. Where two sessions
independently confirmed the same fact, only the final, most-precise reference is kept.

### Task 1 — Surface `professionalMode` in the UI (P0)

**Files:** `lib/thesis-review-store.ts`, `components/thesis-review/thesis-review-panel.tsx`

`route.ts:422` already branches correctly on `body.professionalMode`, and the store's
`ThesisReviewGenerateOptions` already declares `professionalMode?: boolean` — the server
and the type are both ready. The entire gap is that nothing ever sets or sends that flag:
`generateReview`'s fetch body (store, ~line 404) includes `multiAgentDebate:
get().multiAgentDebate` but never `professionalMode`, and there is no store state field or
checkbox for it anywhere.

**Fix:**
1. Add a `professionalModeOverride` state field + `setProfessionalModeOverride` setter to
   the store, mirroring the existing `multiAgentDebate` / `setMultiAgentDebate` pair
   (store lines 183 / 193 / 271 / 292).
2. Add a 4th checkbox to `thesis-review-panel.tsx`, mirroring the existing 3 at lines
   254–274.
3. Add `professionalMode: get().professionalModeOverride` to the fetch body next to the
   existing `multiAgentDebate` line.

### Task 2 — Fix the defense-questions inconsistency (P0)

**File:** `app/api/workspaces/[id]/thesis-review/route.ts`

`professionalResult` carries two different question arrays: `questionsForAuthors` (raw,
spread in verbatim from the LLM's own JSON output — ungrounded) and `defenseQuestions`
(the calibrated, finding-derived array added explicitly by
`generateCalibratedDefenseQuestions`). `route.ts:472` assigns
`result.defenseQuestions = professionalResult.questionsForAuthors` — the wrong, raw
array — for the immediate API response, while the DB save at `route.ts:508` maps
`professionalResult.defenseQuestions` — the right, calibrated array. Downstream, the
store's `ThesisReviewRecord.questionsForAuthors` (rendered by `<DefenseQuestionsPanel>`)
reads `data.questionsForAuthors ?? data.defenseQuestions`, so on initial generation the
reviewer sees the raw ungrounded list, but after a page reload (GET from DB) they see the
calibrated list — a real, user-visible inconsistency, not just an internal one.

**Fix:** compute the mapped calibrated array once in `route.ts`, and use that single value
for both the API response (`result.defenseQuestions`, line 472) and the DB save (line
508), removing the divergent assignment.

### Task 3 — Retry/repair + pinned `max_tokens` for `generateAIResponse` (P0)

**File:** `lib/ai/client.ts`

`generateAIResponse` / `generateAITextResponse` make a single `fetch` and throw
immediately on `!response.ok` — no retry, no repair loop, `max_tokens` left `undefined`.
The resilience pattern already exists elsewhere in the codebase and should be mirrored,
not reinvented: `lib/services/semantic-scholar-service.ts:92–165`'s fetch wrapper uses
`MAX_ATTEMPTS = 3`; on HTTP 429 it respects a `retry-after` header if present, else backs
off `1500 * attempt` ms; on 502/503/504 it retries at `1000 * attempt` ms; on 400/404/422
it fails fast (no retry — these are non-transient); and it applies jitter to backoff
delays on both the success-path (headers present) and catch-path (network error) retry
branches.

**Fix:**
1. Port that same attempt-count/status-code/backoff/jitter policy into
   `generateAIResponse`'s fetch call in `client.ts`.
2. On a schema-validation miss (`safeParse` failure) or JSON-parse failure from
   `parseAiJson`, add one repair attempt: send the offending output plus the validation
   error back to the model and ask it to correct it, before giving up.
3. Pin `max_tokens` explicitly (currently unset, so it silently depends on the provider's
   default) — pick a ceiling sized for the largest real payload in this pipeline (the
   professional review generation call, which assembles up to ~90k+ chars of RAG context).

### Task 4 — Wire `cautionGuidance` / `prohibitedInferences` into the professional prompt (P1)

**Files:** `lib/ai/review-engine.ts`, `lib/ai/rubric-engine.ts` (no changes needed here)

`getApplicableCriteriaForThesisType(thesisType: DetailedThesisType, rubric)`
(`rubric-engine.ts:820–828`) is a pure, cheap function: it just maps every criterion in
`SK_ACADEMIC_RUBRIC_V1` through that criterion's own `applicabilityRule(thesisType)`
(`rubric-engine.ts:20–21` for the `cautionGuidance` / `prohibitedInferences` fields
themselves). `generateProfessionalReview` (`review-engine.ts`) never calls it today —
`review-engine.ts` imports exactly one thing from `rubric-engine.ts`: `calculateGradeRange`.

**Type-compatibility question resolved:** `DetailedThesisType`
(`document-understanding.ts:17–28` — a *methodology* classification:
`empirical_quantitative` / `experimental_physics` / `qualitative` / `mixed_methods` /
`theoretical` / `literature_review` / `engineering_design` / `software_system` /
`cybersecurity_audit` / `case_study` / `artistic_practice` / `unknown`) and `ThesisType`
(`thesis-rubric.ts:11` — a *degree level*: `"bachelor" | "master" | "phd"`) are unrelated
axes. **No conversion between them exists, and none is needed** — they were never meant to
be interchangeable. `GenerateProfessionalReviewOptions.thesisType` is the degree-level
`ThesisType`, and it is already used correctly and exclusively for the PhD-only gates
(§5.7 contribution-coverage guard; §5.9 PhD enrichment, gated at `review-engine.ts:777`).
It was never the right input to `getApplicableCriteriaForThesisType` in the first place.

The only place a real `DetailedThesisType` is produced today is
`classifyDisciplineAndThesisType` (`document-understanding.ts`), and its only consumer is
`analysis-plan.ts` — a separate, opt-in preflight endpoint, not the generation call.
Threading that classifier into `generateProfessionalReview` itself is a larger, judgment-call
change already flagged separately as P3 Task 9 ("pipe `analysis-plan.ts`'s
`applicableCriteria` back into the generation request") and is explicitly **out of scope**
for this task.

**Fix (scoped, ships independently of Task 9):**
1. Add an optional `detailedThesisType?: DetailedThesisType` field to
   `GenerateProfessionalReviewOptions` (import the type from `./document-understanding`).
2. Inside `generateProfessionalReview`, default it: `const effectiveThesisType =
   options.detailedThesisType ?? "unknown"`.
3. Call `getApplicableCriteriaForThesisType(effectiveThesisType, SK_ACADEMIC_RUBRIC_V1)`,
   filter out `"not_applicable"` results, and append each remaining criterion's
   `cautionGuidance[options.language]` and `prohibitedInferences[options.language]` into
   the system/user prompt assembly block (alongside `levelExpectationsText` and the other
   prompt-scaffolding text built around `review-engine.ts:600–650`).
4. Because no caller passes `detailedThesisType` yet, this ships safely with the
   `"unknown"` default — criteria whose `applicabilityRule` doesn't discriminate by type
   (several already return `"applicable"` unconditionally) still contribute guidance, and
   nothing regresses. Wiring a real classification result through from the caller side is
   left to Task 9.

### Task 5 — Wire `groundClaimInChunks` as pre-generation grounding (P1)

**Files:** `lib/ai/evidence-validator.ts`, `lib/ai/thesis-context.ts`, `lib/ai/review-engine.ts`

`groundClaimInChunks` (`evidence-validator.ts:265`) expects chunks shaped
`{ id, heading, content }`, but `ThesisRAGContext.sections` (`thesis-context.ts:67`) has
no `id` field — it needs a synthesized one when the two are wired together.

**Fix:**
1. When mapping `ThesisRAGContext.sections` into the `chunks` param, synthesize an `id`
   per section (e.g. `normalizedHeading`, or the section's array index) since none exists
   natively.
2. Call `groundClaimInChunks` before the primary generation call, per the module's own
   documented intent (§9: "retrieve → ground → generate"), and inject
   `formatGroundedEvidenceBlock`'s output into the professional-path prompt so the model
   is shown verbatim best-matching evidence up front, rather than writing first and being
   validated after the fact (which is what `anchorEvidenceQuotes` / `evidence-validator.ts`
   already do today, post-hoc).

### Task 6 — Fix missing `cs` statutory-clause branch + make PhD enrichment institution-aware (P1)

**File:** `lib/ai/review-engine.ts`

PhD enrichment is gated at `review-engine.ts:777`:
`options.thesisType === "phd" && options.reviewerRole === "opponent"`. Inside that block,
the statutory clause (~`review-engine.ts:802–804`) is `options.language === "sk" ? <sk
clause> : <en clause>` — there is no `"cs"` branch, so a Czech-language PhD review
(`language: "cs"`) silently falls through to the *English* translation of the *Slovak*
§54/131-2002 statutory clause: wrong language and wrong jurisdiction simultaneously.
Separately, `ThesisMetadata` (`thesis-rubric.ts:46–47`) already declares
`institution?: string` and `department?: string`, but `GenerateProfessionalReviewOptions`
does not include either field, and `review-engine.ts` never reads them — so the clause is
emitted unconditionally whenever the PhD/opponent gate is true, regardless of which
institution the thesis is actually from.

**Fix:**
1. Add `institution?: string` (and `department?: string` if useful downstream) to
   `GenerateProfessionalReviewOptions`, and pass `thesisMetadata.institution` through from
   `route.ts`, mirroring how `thesisType` / `reviewerRole` are already passed at
   `route.ts:430` / `499`.
2. Add an explicit `"cs"` branch with a correct Czech statutory citation, instead of
   falling through to `en`.
3. Gate the clause on `institution` (or at minimum skip emitting the Slovak-law citation)
   when the institution is not a Slovak school, rather than assuming Slovak jurisdiction
   for every PhD/opponent review regardless of `language`.

### Task 7 — Dedupe the evidence-anchoring cascade (P2)

**Files:** `lib/ai/review-engine.ts`, `lib/ai/evidence-validator.ts`

`anchorEvidenceQuotes` (`review-engine.ts:422`) and `verifyEvidenceQuote`
(`evidence-validator.ts:37`) implement the identical 4-tier cascade — exact substring →
whitespace-normalized → ambiguous (matches >1 section) → 60-character-anchor approximate
match → unverified — with the same confidence values (1.0 / 0.95 / 0.45 / 0.1),
maintained in two places.

**Fix:** remove one implementation and have `review-engine.ts` call
`evidence-validator.ts`'s `verifyEvidenceQuote` instead (it already accepts the more
general `EvidenceReference` shape). Before deleting the duplicate, add a regression check
confirming both implementations agree on a shared set of test cases — `academic-checks.test.ts`
and `evidence-validator.test.ts` both already exist and are the natural place for it — so
a future threshold change (e.g. the 60-char anchor length) can't silently drift between
two copies again.

### Task 8 — Make defense-question generation genuinely finding-derived (P2)

**File:** `lib/ai/academic-checks.ts`

`generateCalibratedDefenseQuestions` (`academic-checks.ts:222–352`) is 5 fixed template
questions (methodology, results/validation, limitations, contribution, literature) plus
1 conditional slot that fires only if a `critical`/`major` finding exists — max 6
questions, never scaling with the number or content of findings, despite the docstring's
"5–12 targeted, evidence-grounded" claim. `academic-checks.test.ts:57` calls it with
`findings: []` and asserts `5 ≤ length ≤ 12` plus at least one high-priority question —
this passes today only because the 5-fixed-template floor happens to satisfy the lower
bound; it does not exercise the scaling behavior the docstring describes.

**Fix:** derive additional questions from the actual findings list (e.g. one targeted
question per `critical`/`major` finding, up to the stated 12-question ceiling), keeping
the 5 core templates as a floor so `academic-checks.test.ts:57`'s existing lower-bound
assertion still holds unmodified. Either extend that test to assert the count scales with
`findings.length` for a non-empty input, or — if 5-fixed-plus-scaling is the intended
final design — correct the docstring to describe the actual floor/ceiling behavior instead
of implying every review gets a variable 5–12 count today.

---

*End of Tasks 1–8. Items 9–11 (§11, P3) remain judgment calls pending a product decision
and are intentionally not specified as directly-executable tasks here.*


## §13 — P3 judgment calls: recommendations (items 9–11)

Items 9–11 (§11) were deliberately left as decisions rather than task specs. What follows
is a recommendation with reasoning for each, still meant to be confirmed by a human before
implementation — not a silent upgrade to "specified."

### Item 9 — Auto-piping `analysis-plan.ts`'s classification into generation

This should be split into two decisions with different risk profiles, not treated as one:

- **`applicableCriteria` / per-criterion guidance text** — low risk, additive only; it
  changes what the model is told not to over-penalize, not which mode runs or what the
  reviewer sees change shape. **Recommendation: auto-apply, no confirmation gate.** Once
  Task 4 lands, feed `classification.thesisType` (the `DetailedThesisType`) straight into
  the new `detailedThesisType` option on every professional-mode call. Worst case if the
  classifier is wrong: some guidance text that doesn't quite fit gets added to the prompt
  — not materially worse than today's status quo of no guidance at all.
- **`recommendedReportingGuideline` auto-flipping `professionalMode` on** — higher risk. It
  changes cost (2× LLM calls if paired with `multiAgentDebate`), latency, and which
  checklist (CONSORT/PRISMA/STROBE) gets applied. A misclassified thesis silently getting
  the wrong reporting standard is worse than getting none. **Recommendation: surface it as
  a pre-filled, reviewer-confirmed suggestion, not a silent trigger** — at least until
  there's a way to see the classifier's real-world precision (`classification.confidence`
  exists but nothing today tracks whether reviewers agree with it in practice). A cheap
  middle path: auto-apply only above a confidence threshold (e.g. >0.8), falling back to
  Task 1's manual checkbox otherwise.

This also settles the sequencing note already in §11: Task 1 stays required regardless of
whether Task 9 ships, since it remains the fallback path for low-confidence
classifications — not just an interim measure superseded once Task 9 lands.

### Item 10 — `reconcileGrade`'s leniency-only asymmetry (§5.6)

**Recommendation: keep the asymmetry, but make it a deliberate, documented policy, and
add one refinement to catch likely model errors on the harsh side too.**

Two things support keeping it as-is:
- Saved review records carry a `confirmedAt` field (`route.ts:620`) — these are drafts a
  human (supervisor/opponent) reviews before anything becomes official, not
  auto-published grades. That is exactly the condition under which "err conservative" is
  defensible: an overly harsh AI draft gets caught and corrected by the human in the loop;
  an overly lenient one that slips through unexamined is the more expensive failure mode
  for an academic-integrity tool to allow silently.
- LLM self-grading tends to skew lenient in practice, not harsh, so the asymmetry is
  mostly a backstop for the failure mode that's actually likely to occur, not a
  frequently-binding rule in the harsh direction.

**Refinement:** today an excessively *harsh* self-report is left untouched with no
signal at all. If the self-reported grade is a large outlier below the derived score
(e.g. >20–25 ECTS-score points harsher), that is more likely a model miscalibration than
genuine severity, and is worth surfacing — **flag it via an appended note (mirroring the
existing leniency-correction note in `reconcileGrade`) without changing the saved grade**,
rather than either silently auto-correcting it upward or silently accepting it. This
preserves the "never auto-inflate" principle while still catching likely mistakes in both
directions instead of only one.

### Item 11 — Fallback-model chain for text generation (mirroring `models.ts`'s vision chain)

**Recommendation: build it, sequenced after Task 3, but scoped tighter than the vision
chain and with the fallback made visible in the saved output.**

- Sequence after Task 3 (retry), as §11 already notes — retry is cheaper and catches more
  failure modes (a transient 500 doesn't need a model swap) before failover is needed.
- Don't mirror `DEFAULT_FALLBACK_VISION_MODELS`'s depth (10 models). Review generation
  needs strong structured-reasoning quality to produce trustworthy epistemic-status tags
  and findings; falling back to a much weaker model could produce a review that looks
  complete but is quietly worse-grounded. **2–3 hand-picked fallback models of comparable
  reasoning quality**, not "whatever's available next in a long list."
- **Record which model actually generated the review** (e.g. in `debateLog` or a new
  field) whenever a fallback fires. In an academic-integrity-adjacent tool, a
  supervisor/opponent relying on the output should be able to tell "primary model" from
  "2nd-choice fallback after an outage" — silent degradation is a worse failure mode here
  than in most applications.
- Apply fallback at the same call-site granularity as retry — per `generateAIResponse`
  call, inside the same choke point Task 3 modifies — rather than restarting the whole
  multi-call professional pipeline on a single call's failure. Keeps the cost of a
  fallback bounded to the one call that actually failed.

---

*End of §13. These remain recommendations, not decisions — confirm before implementing.*


## §14 — Phase 2 re-verification: four findings that change §13's picture

Before turning §13's recommendations into executable task specs, the working tree was
re-read directly (not re-derived from §1–13's own prior conclusions). Four things came
out of that pass that materially change the cost/risk of the convergence work described
below — each is why `CODING_AGENT_PROMPT_pipeline_perfection.md` (Phase 2, §15) can
specify things §13 could only recommend abstractly.

**A. A findings→sections adapter already exists — and has a real bug.**
`route.ts:440–450` (inside the `professionalMode` branch, immediately after
`generateProfessionalReview` returns) already converts `professionalResult.anchoredFindings`
into `ThesisReviewSection`-shaped objects, one per `activeCriteria` entry, explicitly
labeled `// Convert findings into criteria-like sections for backwards compatibility with
LaTeX generator`. So Path B's output is *already* coerced into the same shape Path A
produces, for DB storage and the LaTeX export — the two schemas confirmed structurally
distinct in §13's investigation (`ThesisReviewGenerationSchema`'s `sections` array vs.
`ProfessionalReviewGenerationSchema`'s `findings` array, `contracts.ts`) are not, in
practice, both surfaced raw downstream; one is already bridged to the other's shape today.


The bridge is coarse, though, and duplicates content: the mapper matches a finding to a
criterion by category —
`c.id === "methodology" → f.category is "methodology" or "statistics"`,
`c.id === "results" → f.category is "results" or "reproducibility"`,
`c.id === "citations_bibliography" → f.category is "literature"`,
`c.id === "formal_structure" or "language_quality" → f.category is "formal"` — and
**falls through to `return true` for every other criterion ID**. `THESIS_CRITERIA`
(`thesis-rubric.ts:123–260`) has 7 graded criteria; only 4 distinct match rules are
defined, covering `formal_structure`, `language_quality`, `methodology`, `results`,
`citations_bibliography`. `goal_definition` and `originality` (and the zero-weight
`defense_questions` placeholder) never appear on the left-hand side of a real match, so
their `matchingFindings` list is *every* finding regardless of category — a Path B review
with, say, 6 methodology findings and 0 originality-relevant findings will still show all
6 findings verbatim under the "Originality and contribution" section's text, because
nothing filtered them out. This is a real, previously-undocumented bug distinct from
anything in §1–13, sitting in the exact code path any rubric-merge work will touch.

**B. The deterministic checks don't need the professional schema as input.**
`checkObjectiveAlignment` (`academic-checks.ts:49`) and `auditCitationConsistency`
(same file) take `(structure: ExtractedDocumentStructure, ragOrText: ThesisRAGContext |
string, lang)` — plain document structure and text — and *produce* a `ReviewFinding[]`
(via `TraceabilityCheckResult.findings`); they do not consume Path B's `findings` array
or any professional-schema object as input. §13's open question — "whether those check
functions actually require the findings array structure or can work directly on raw
text and citations" — is resolved: they can. Nothing structurally prevents calling them
from Path A's branch in `route.ts` today.


**C. A cheap semantic-similarity primitive already exists, unused by grounding.**
`generateLocalEmbedding` (`lib/ai/local-embeddings.ts`) wraps a multilingual
(sk/cs/en-capable) MiniLM model running fully in-process via `@xenova/transformers`
(WASM, no external API call), returns an L2-normalized 384-dim vector, and is already
SHA-256-keyed-cached (1024-entry LRU) — it is already used elsewhere in the pipeline
(§2.5's GraphRAG entity-linking fallback). `groundClaimInChunks`
(`evidence-validator.ts:265`) — confirmed by direct re-read — is pure lexical Jaccard-style
token overlap (`hits / claimTokens.size`, 0.15 minimum threshold, no embedding call
anywhere in the function). A synonym, paraphrase, or cross-lingual near-match (a Slovak
claim against an English-glossed passage, or vice versa) below the token-overlap threshold
is invisible to it today even when `generateLocalEmbedding` could resolve it cheaply.

**D. There is exactly one AI provider configured today, confirmed at the fetch call site.**
`client.ts:26–30` resolves `apiUrl`/`apiKey` from `AI_VISION_API_URL`/`AI_VISION_API_KEY`
(vision role only) or `AI_API_URL`/`AI_API_KEY` (everything else, including all thesis-review
generation) — a role-based *selection*, not a fallback chain; there is no second provider
to fail over to today, and no retry logic wraps the `fetch` at all (confirming §6 Task 3's
finding independently). `AIClientOptions` already declares optional per-call `apiUrl`/
`apiKey` fields (`client.ts:8–9`) that are honored ahead of the environment defaults —
a provider-fallback implementation can reuse that override path directly instead of adding
a new one.

**What this changes:** the "two options" §13's investigation was weighing for the rubric/
schema convergence — full migration of Path A callers to the professional schema, vs. a
lighter middle path — resolves in favor of the lighter path, and more concretely than
"lighter" implied: Task 10 below is a *fix-and-generalize* of the existing route.ts:440–450
bridge (correct the fallback, drive it off the richer rubric), not a from-scratch migration.
Findings A–D are what Tasks 9–14 in `CODING_AGENT_PROMPT_pipeline_perfection.md` (§15) are
grounded in.

---

## §15 — Phase 2: structural convergence (pointer)

Items 9–11's recommendations (§13), the professionalMode-fork collapse, the rubric
unification, and the grounding/fallback strengthening described in this section's own
re-verification pass (§14) are specified as directly-executable tasks in a separate file:
**`CODING_AGENT_PROMPT_pipeline_perfection.md`**, at the repo root. That file is Phase 2 —
sequence-dependent on Phase 1 (Tasks 1–8, §12) landing first, more invasive than Phase 1,
and touches the fork point (`route.ts`'s `professionalMode` branch) directly rather than
adding isolated fixes around it. See that file for task-by-task specs, acceptance criteria,
and verification steps; this document remains the analysis/rationale record, not the task
list, for Phase 2 as it already was for Phase 1.

---

*End of §15. Analysis continues to live here; execution specs for Phase 2 live in
`CODING_AGENT_PROMPT_pipeline_perfection.md`.*

---

## §16 — Phase 2: Completion & Verification Note

All six tasks from Phase 2 (Tasks 9–14) and all eight tasks from Phase 1 (Tasks 1–8) have been implemented, regression-tested, and verified on `main`:

1. **Task 9 — Discipline Classification & Guideline Auto-Apply:** `classifyDisciplineAndThesisType` and `detectReportingGuideline` are wired into `POST /api/workspaces/[id]/thesis-review`. High-confidence matches (`≥ AUTO_APPLY_CONFIDENCE_THRESHOLD = 0.8`) automatically apply the guideline, while lower confidence detections are returned additively as `suggestedReportingStandard`.
2. **Task 10 — Rubric Unification & Applicability Matrix:** `activeCriteria` is now driven by `SK_ACADEMIC_RUBRIC_V1`'s per-thesis-type applicability matrix. The 13→7 criteria mapping (`RUBRIC_CRITERIA_MAP`) and findings-to-sections bridge accurately map findings, and empty criteria fall back to `NO_FINDINGS_SYNTHESIS` rather than being dropped.
3. **Task 11 — Path A Baseline Upgrade:** Deterministic quality checks (`checkObjectiveAlignment`, `auditCitationConsistency`) and PaperQA2-style pre-generation evidence grounding run on standard Path A by default. `shouldUseProfessionalMode` auto-elevates paper reviews and non-none reporting standards.
4. **Task 12 — Embedding-Assisted Semantic Grounding:** `groundClaimInChunks` implements a two-tier strategy: fast lexical Jaccard for high-overlap candidates (≥ 0.15), falling through to local MiniLM embedding cosine similarity (`SEMANTIC_MATCH_THRESHOLD = 0.6`) only for ambiguous candidates in the [0.05, 0.15) band.
5. **Task 13 — Provider-Level Fallback & Provenance:** `client.ts` supports automatic failover to `AI_API_URL_FALLBACK`/`AI_API_KEY_FALLBACK` upon transient provider failure. Provider provenance (`"primary"` vs. `"fallback-provider"`) is tracked via `getLastServedProvider()`, attached to the API response, and persisted to `debateLog`.
6. **Task 14 — Harsh Outlier Grade Reconciliation:** `reconcileGrade` preserves asymmetric calibration: lenient self-reports (>15 points above derived) are corrected down, while harsh self-reports (> `HARSH_OUTLIER_THRESHOLD = 20` points below derived) preserve the self-reported grade and append an advisory warning to `debateLog`.

**Final Verification:**
- `npx tsc --noEmit`: 0 errors (strict mode across all routes, utilities, and tests)
- `npx vitest run`: 85 test files passed, 613 / 613 unit and integration tests passing
- `pnpm run build`: Next.js Turbopack production build succeeded, all 41 routes compiled cleanly.
