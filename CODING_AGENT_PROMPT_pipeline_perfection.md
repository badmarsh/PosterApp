# Coding Agent Prompt — Academic Review Pipeline: Phase 2 Structural Convergence

## Context (read first)

You are working in the PosterApp Academic Reviewer codebase (Next.js / TypeScript /
Prisma). `PIPELINE_ARCHITECTURE_AND_PERFECTION_ROADMAP.md` (repo root) is the analysis
document behind this file — read its §7–9 (the two rubric systems, the analysis-plan
classifier, PaperQA2 grounding), §13 (Phase 2 judgment-call recommendations), and §14
(a re-verification pass against current source that this file's tasks are grounded in)
before starting. This file is the **execution spec**; the roadmap is the rationale record.
Do not re-derive reasoning already worked out there — cite it and proceed.

**This is Phase 2.** It is sequence-dependent on Phase 1 — Tasks 1–8, fully specified in
the roadmap's §12 — already being merged. Task 4 in particular (wiring `cautionGuidance`/
`prohibitedInferences` and adding the optional `detailedThesisType` field to
`GenerateProfessionalReviewOptions`) is a hard prerequisite: Task 9 below feeds that field
automatically instead of leaving it unset. Do not start Task 9 or later until Phase 1 is
confirmed merged.

General rules (mirror the conventions already established in
`CODING_AGENT_PROMPT_grading_fixes.md` / `CODING_AGENT_PROMPT_audit_review.md`):
- Re-verify every file:line reference below against the actual working tree before
  editing — Phase 1 will have shifted some of them, and this document's own §14-style
  grounding pass is only as good as the moment it was taken.
- Do not modify the Prisma schema for any task in this file.
- Do not change the wire-format shape of `ThesisReviewSection`,
  `ThesisReviewGenerationSchema`, or `ProfessionalReviewGenerationSchema`
  (`contracts.ts`) — Task 10 changes what *feeds* `activeCriteria`, not the schema those
  criteria populate.
- Prefer small, surgical diffs over rewriting whole files.
- Run typecheck and the relevant test file(s) after each task, not only at the end —
  Tasks 9–11 are sequence-dependent, so a regression is more expensive to bisect here
  than in Phase 1.
- Add or update a unit test alongside any new logic, following this repo's existing
  Vitest-style conventions under `lib/__tests__/` / `__tests__/api/`.
- Document every new named constant (confidence thresholds, similarity thresholds,
  outlier thresholds) with a one-line comment noting it is a starting value that may
  need empirical tuning — do not present any of them as settled/derived.

## Sequencing within this file

Task 9 → Task 10 → Task 11, in order — Task 11 needs the unified criteria list from
Task 10 before it can decide how Path A's new deterministic-check output maps onto
sections; Task 10 needs `detailedThesisType` flowing (Task 9) to select applicable
criteria per thesis. Task 12 and Task 13 are independent of 9–11 and of each other —
they can be done in parallel or in either order. Task 14 is independent and small — do
it whenever convenient after Phase 1 lands.

---

## Task 9 — Auto-wire discipline/thesis-type classification into generation (P1)

**Files:** `app/api/workspaces/[id]/thesis-review/route.ts`, `lib/ai/review-engine.ts`,
`lib/ai/document-understanding.ts`, `lib/ai/analysis-plan.ts` (read-only reference)

**Context:** `classifyDisciplineAndThesisType` (`document-understanding.ts`) is
deterministic and zero-LLM-cost (roadmap §8); its only caller today is the opt-in
`analysis-plan.ts` preflight endpoint. Task 4 (Phase 1) added an optional
`detailedThesisType` field to `GenerateProfessionalReviewOptions`, defaulted to
`"unknown"` — but nothing populates it automatically yet. Roadmap §13 Item 9 splits this
into two different-risk decisions; this task implements both halves of that
recommendation directly.

**Fix:**
1. In `route.ts`'s `professionalMode` branch, before calling `generateProfessionalReview`,
   call `classifyDisciplineAndThesisType` directly against the already-loaded thesis
   context — do not route through the `analysis-plan` HTTP endpoint, call the underlying
   function. It is deterministic and cheap; safe to always run.
2. Pass `classification.thesisType` as `detailedThesisType` on every professional-mode
   call — **no confidence gate** for this part (low risk per §13 Item 9: worst case is
   slightly-off guidance text, not a wrong mode or wrong cost).

3. For the higher-risk half — `recommendedReportingGuideline` potentially flipping
   `professionalMode`/`reportingStandard` on — add a confidence gate: define a named
   constant (e.g. `AUTO_APPLY_CONFIDENCE_THRESHOLD = 0.8`, documented as a starting
   value). If `classification.confidence` exceeds it AND
   `thesisMetadata.reportingStandard` is unset/`"none"` AND a recommended standard
   exists, auto-apply it before generation. Below threshold, do not change requested
   behavior — instead attach the classification + recommendation to the API response as
   a new, additive, optional field (e.g. `suggestedReportingStandard`) so a future UI
   change can prompt the reviewer to confirm it. Building that UI prompt is explicitly
   **out of scope** for this task — surfacing the data is enough.
4. Leave the existing `analysis-plan` preflight endpoint untouched and fully functional
   — it remains available for a reviewer who wants to preview the classification before
   generating (roadmap §13 Item 9's sequencing note: Task 1's manual checkbox, and by
   extension the preflight panel, stay the fallback path for low-confidence cases, not
   something this task obsoletes).

**Acceptance:** unit tests covering confidence above and below the threshold constant;
confirm the `analysis-plan` endpoint's existing tests still pass unmodified; confirm a
professional-mode generation call with a low-confidence classification does not silently
change `reportingStandard`.

---

## Task 10 — Unify the rubric systems: drive `activeCriteria` from `SK_ACADEMIC_RUBRIC_V1` (P1)

**Files:** `app/api/workspaces/[id]/thesis-review/route.ts`, `lib/ai/rubric-engine.ts`,
`lib/ai/thesis-rubric.ts` (read-only reference)

**Re-verification checkpoint — do this before writing any other code in this task:**
- Re-read `route.ts`'s current `activeCriteria` construction and the findings→sections
  bridge fresh (they were at roughly lines 259 and 440–450 at the time roadmap §14 was
  written; Phase 1 and Task 9 will have shifted them). Confirm the bug described in
  roadmap §14 finding A still exists as described: the bridge defines match rules only
  for `formal_structure`, `language_quality`, `methodology`, `results`,
  `citations_bibliography`, and falls through to `return true` (matching every finding)
  for `goal_definition`, `originality`, and `defense_questions`.
- Re-read every downstream consumer of `ThesisReviewSection.criterionId`/`sectionId`
  that relies on the exact 7 legacy IDs from `THESIS_CRITERIA` — the LaTeX/docx export
  generator, the DB `sections` JSON field's readers, and any frontend component keying
  off criterion IDs (grep `THESIS_CRITERIA`, `criterionId`, and each of the 7 literal ID
  strings across `components/` and `lib/`). This list determines how strict the
  backward-compat mapping in step (c) below needs to be — do not skip it and guess.

**Fix (a fix-and-generalize of the existing bridge, not a schema migration — see roadmap
§14's conclusion for why the lighter path is now the grounded choice):**

(a) Keep `ThesisReviewSection` / `ThesisReviewGenerationSchema` as the wire/DB output
    shape unchanged — no edits to `contracts.ts`.

(b) Change what `activeCriteria` is computed *from*: instead of filtering the 7-criterion
    `THESIS_CRITERIA`, call `getApplicableCriteriaForThesisType(detailedThesisType,
    SK_ACADEMIC_RUBRIC_V1)` (13 criteria, `detailedThesisType` now flowing from Task 9),
    filter out `"not_applicable"` results.

(c) Because downstream consumers (the checkpoint list above) expect the 7 legacy IDs,
    add an explicit mapping table from each `SK_ACADEMIC_RUBRIC_V1` criterion `key` to
    its legacy `THESIS_CRITERIA` id — enumerate the real 13 keys during the
    re-verification checkpoint above (do not guess them from this document; re-read
    `rubric-engine.ts`'s `criteria` array directly). The legacy 7 IDs remain what actually
    gets output in `sections`/DB/LaTeX; the 13-criterion rubric drives which guidance
    text and applicability logic feeds the LLM prompt. This is the same
    "backward-compatible mapping" direction roadmap §13 Item 9 already pointed at.

(d) Fix the coarse category fallback in the findings→sections bridge: replace the
    `return true` default with an explicit rule per legacy criterion id — `goal_definition`
    should match the problem/objectives-family categories from the mapping in (c);
    `originality` should match the contribution/originality-family category;
    `defense_questions` should be **excluded** from this findings-based section list
    entirely (it already gets populated from `professionalResult.questionsForAuthors`/
    `defenseQuestions` elsewhere in `route.ts` per Task 2, and never meaningfully held
    findings-derived section text in the first place).

**Acceptance:** `rubric-engine.test.ts` and existing `thesis-rubric` tests pass
unmodified. Add a test asserting no single finding is matched into more than one legacy
section incorrectly (replacing the old always-true fallback). Add a test asserting the
13→7 mapping table covers every `SK_ACADEMIC_RUBRIC_V1` key with no fallthrough case.

---

## Task 11 — Collapse the `professionalMode` fork: deterministic checks + pre-generation grounding run by default (P1)

**Files:** `app/api/workspaces/[id]/thesis-review/route.ts`, `lib/ai/academic-checks.ts`,
`lib/ai/evidence-validator.ts`, `lib/ai/review-engine.ts`

**Context:** roadmap §14 finding B confirmed `checkObjectiveAlignment` and
`auditCitationConsistency` (`academic-checks.ts`) take `(structure, ragOrText, lang)` and
*produce* `ReviewFinding[]` — they do not require Path B's findings/evidence schema as
input. They are professional-mode-gated today only because they were historically wired
solely from inside `generateProfessionalReview` (§5.4), not because of any structural
dependency. Task 5 (Phase 1) wires `groundClaimInChunks` into Path B's prompt as
pre-generation grounding on the same reasoning: it takes chunks + claim text, and needs
no professional-schema input either.

**Design goal:** on every review — regardless of `professionalMode` — the reviewer gets
rubric guidance (Tasks 4/10), pre-generation grounding (Task 5, extended here to Path A),
and the deterministic checks (§5.4). What stays optional/professional-only:
`multiAgentDebate` self-critique (§5.5 — a genuinely more expensive second LLM call), PhD
opponent enrichment (§5.9 — PhD+opponent only by design), and the full
findings/`epistemicStatus` schema itself (Path A keeps producing `ThesisReviewSection`,
not `ReviewFindingContract`).

**Fix:**
1. Re-verify the actual current call site of `checkObjectiveAlignment`/
   `auditCitationConsistency` (likely inside `review-engine.ts`'s
   `generateProfessionalReview`) and extract them to be callable independently from both
   branches of `route.ts` — a shared helper, not a duplicate implementation.
2. In Path A's branch (the non-`professionalMode` `else` in `route.ts`), after
   `generateAIResponse` returns and `validateGeneratedSections` passes, call the
   deterministic checks against the same structure/RAG context Path A already has
   (`loadThesisContext` runs unconditionally for both paths per §2.1). Merge the
   resulting findings into `result.citationIssues` (citation-check output) and the
   matching `result.sections[...].suggestions` (objective-alignment output, keyed via
   Task 10(c)'s mapping) — do not invent a new output field.
3. In Path A's prompt assembly (`buildSystemPrompt`/`buildUserPrompt`), inject
   `groundClaimInChunks` + `formatGroundedEvidenceBlock` per criterion the same way
   Task 5 wires it for Path B. Path A's prompt already receives the RAG context (§4); the
   grounding block specifically is what's missing.
4. Do **not** move `multiAgentDebate` or PhD enrichment out of the `professionalMode`
   gate — leave them exactly as they are.

**Acceptance:** a Path A (non-professional) generation call's constructed prompt now
contains the `"[Retrieved Evidence for ..."` marker from `formatGroundedEvidenceBlock`
when chunks are available — add a test asserting this. Add a test showing
`citationIssues` can be non-empty from the deterministic check alone even when the LLM's
own `citationIssues` output is empty. Existing Path A tests must keep passing unmodified
— this task adds signal, it must not change `validateGeneratedSections`'s pass/fail
behavior.

---

## Task 12 — Strengthen grounding beyond lexical Jaccard with embedding-assisted verification (P1/P2)

**Files:** `lib/ai/evidence-validator.ts` (edit); `lib/ai/local-embeddings.ts` (read-only
— pure consumer, no changes needed)

**Context:** roadmap §14 finding C. `groundClaimInChunks` is pure token-overlap Jaccard
scoring with a 0.15 minimum-overlap accept threshold and no embedding call anywhere in
it. `generateLocalEmbedding` is a cheap, SHA-256-cached, L2-normalized 384-dim
multilingual (sk/cs/en) embedding function already used elsewhere in this codebase
(GraphRAG entity-linking fallback, §2.5) — no external API cost, WASM in-process.

**Fix (blend, don't replace — Jaccard stays the cheap first pass):**
1. In `groundClaimInChunks`, keep the Jaccard scoring pass over all sentences but track
   a top-K candidate set (e.g. K=5 by `overlapScore`) instead of only the single best
   result.
2. For claims whose best Jaccard score falls in a "maybe" band — below the existing
   0.15 accept threshold but above a lower floor (e.g. 0.05, a case that returns `null`
   today) — call `generateLocalEmbedding` on the claim and on each top-K candidate
   sentence, compute cosine similarity (a plain dot product, since the vectors are
   already L2-normalized), and accept the best candidate if it clears a separate,
   higher-bar semantic threshold. Name and document the starting constant (e.g.
   `SEMANTIC_MATCH_THRESHOLD = 0.6`) as needing empirical tuning.
3. Only call `generateLocalEmbedding` on the pre-filtered top-K Jaccard candidates per
   claim per criterion — never on every sentence in every chunk (cost/latency). Reuse the
   existing embedding cache (already SHA-256-keyed) so repeated text isn't re-embedded.
4. Add `"semantic_embedding"` as a new value on `EvidenceReferenceSchema`'s
   `verificationMethod` enum (`contracts.ts`) so a supervisor/opponent can tell a
   verbatim-Jaccard match from an embedding-assisted one — consistent with roadmap §13
   Item 11's "make degradation visible, don't hide it" principle, applied here to
   grounding confidence instead of model fallback.

**Acceptance:** add paraphrased (non-verbatim-overlapping) claim/sentence pairs that fail
today's 0.15 Jaccard threshold but are genuinely supported — assert they now ground via
the embedding path with `verificationMethod: "semantic_embedding"`. Assert a genuinely
unrelated claim/sentence pair still returns `null`. Assert Jaccard-only matches
(score ≥ 0.15) skip the embedding call entirely — no latency regression on the common
case.

---

## Task 13 — Provider-level fallback in `client.ts`, alongside model-level fallback (P2/P3)

**Files:** `lib/ai/client.ts`, `lib/ai/models.ts`

**Context:** roadmap §14 finding D. Exactly one provider is configured today —
`AI_API_URL`/`AI_API_KEY` for text, `AI_VISION_API_URL`/`AI_VISION_API_KEY` for vision —
a role-based *selection*, not a fallback chain. `AIClientOptions` already accepts
per-call `apiUrl`/`apiKey` overrides (`client.ts:8–9`), ahead of environment defaults —
reuse that path rather than adding a new one. This task builds on top of Task 3's
(Phase 1) retry loop and roadmap §13 Item 11's model-fallback chain, in that order:
retry same provider/model → model fallback, same provider → provider fallback, only if
the provider itself appears down.

**Fix:**
1. Add **one** documented secondary provider pair via env (e.g.
   `AI_API_URL_FALLBACK`/`AI_API_KEY_FALLBACK`) — not an open-ended list, mirroring
   roadmap §13 Item 11's "2–3 hand-picked, not whatever's next in a long list" reasoning,
   applied here to providers instead of models.
2. In `generateAIResponse`/`generateAITextResponse`, after Task 3's retry budget is
   exhausted on the primary provider *and* the failure pattern indicates the provider
   itself is unreachable (connection failure/timeout on every attempt, or a 5xx on every
   model in Item 11's fallback chain — not a single model's outage), retry once against
   the fallback provider's `apiUrl`/`apiKey` using its default model for the requested
   `AiModelRole`.
3. Record which provider actually served the request, extending whichever field Item
   11's model-fallback visibility work already added — do not add a second, separate
   field for "provider" vs. "model" if one combined value can carry both (e.g.
   `"primary"` / `"fallback-model:<name>"` / `"fallback-provider:<name>"`).

**Acceptance:** unit test mocking `fetch` to fail entirely for the primary `apiUrl` and
succeed for the fallback `apiUrl` — assert the fallback response is returned and
correctly tagged. Assert a normal primary-provider success path never touches the
fallback (no wasted calls, no added latency on the common case).

---

## Task 14 — `reconcileGrade` harsh-outlier flag (P2, operationalizes roadmap §13 Item 10)

**File:** `lib/ai/review-engine.ts`

**Context:** roadmap §13 Item 10 already worked out the reasoning and the exact wanted
behavior — this task is a direct, specified edit, not a further design decision.

**Fix:**
1. In `reconcileGrade` (§5.6), after the existing leniency check (self-reported grade
   more than 15 ECTS-score points above derived → derived wins, note appended to
   `debateLog`), add a symmetric-but-different-consequence check on the harsh side: if
   the self-reported grade is more than a documented threshold (start at 20–25
   ECTS-score points, named e.g. `HARSH_OUTLIER_THRESHOLD`, distinct from the existing
   leniency constant) **below** derived, append a note to `debateLog` flagging the
   self-report as a likely miscalibration outlier, mirroring the existing
   leniency-correction note's wording style — but do **not** change the saved/returned
   grade in this branch. This asymmetry (leniency corrected, harshness only flagged) is
   the core behavior roadmap §13 Item 10 explicitly wants preserved.

**Acceptance:** a test case with a self-reported grade far harsher than derived — assert
the returned grade is unchanged from the self-report, and `debateLog` contains the new
flag text. A test case within the existing leniency threshold but below the new harsh
threshold on both sides — confirm no regression of existing leniency behavior.

---

## Acceptance criteria and verification steps (applies to Tasks 9–14 as a whole)

- Re-verify every file:line reference in this document against the working tree before
  editing — Phase 1 will have shifted some of them.
- Typecheck + full existing test suite after each task, not only at the end.
- No task changes the Prisma schema.
- No task changes the wire-format shape of `ThesisReviewSection` /
  `ThesisReviewGenerationSchema` / `ProfessionalReviewGenerationSchema`.
- Every new named constant carries a one-line "starting value, needs tuning" comment.
- After Task 11 lands, re-check a real DB record + the test suite (this roadmap's own
  opening verification methodology) to confirm Path A's output genuinely improved rather
  than just gaining unused fields.

## Final checklist

- [ ] Phase 1 (Tasks 1–8) confirmed merged before starting any task in this file
- [ ] Task 9 — classification auto-wired; confidence-gated `reportingStandard` suggestion
- [ ] Task 10 — `activeCriteria` driven by `SK_ACADEMIC_RUBRIC_V1`; 13→7 legacy-id
      mapping table complete; findings→sections bridge fallback bug fixed
- [ ] Task 11 — deterministic checks + pre-generation grounding run on Path A by
      default; `multiAgentDebate`/PhD enrichment still opt-in only
- [ ] Task 12 — embedding-assisted grounding blended with Jaccard; new
      `"semantic_embedding"` verification-method tag
- [ ] Task 13 — provider-level fallback, visible in saved output
- [ ] Task 14 — harsh-outlier flag in `reconcileGrade`; leniency-only correction
      behavior preserved
- [ ] Full test suite + typecheck green
- [ ] `PIPELINE_ARCHITECTURE_AND_PERFECTION_ROADMAP.md` updated with a closing note once
      all six tasks land, mirroring how §12/§13 close out Phase 1
