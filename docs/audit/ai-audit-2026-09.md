# PosterApp — Applied-AI Audit (RAG · Prompts · Agents · Reliability · AI UX)

**Date:** 2026-09-03 · **Scope:** `main` (f2930ad) + local Round 4/5 edits on `arena/01a0685a-posterapp` (547c9e1) · **Mode:** read-only, evidence-based
**Method:** full read of `lib/ai/client.ts`, `vector-rag.ts`, `local-embeddings.ts`, `document-chunker.ts`, `chunking-config.ts`, `context.ts`, `prompts.ts`, `prompts-thesis.ts`, `evidence-validator.ts`, key paths of `review-engine.ts`, `thesis-context.ts`, `contracts.ts`, `models.ts`, `graph-extractor.ts`, `services/vision-service.ts`; API routes `thesis-review`, `cards/[cardId]/generate`, `autofix-compile`, `chat`, `review`, `ingestion/parse`; store slices `project-slice.ts`, `ui-slice.ts`. Two algorithms were executed in isolation (`splitIntoSubchunks`, `resolveThesisDomainContext`) to confirm behaviour. No Vercel AI SDK is used (`generateText/generateObject/streamObject`: 0 hits) — everything goes through the custom OpenAI-compatible client.

Legend: **Confirmed** = reproduced or read directly in code; **Hypothetical** = depends on runtime data/provider behaviour I could not execute here (no DB, no model download). Findings that touch files I modified in Round 4/5 are marked ⚠️R5.

---

## 1. Executive AI Verdict

PosterApp's AI layer is unusually thoughtful for a self-hosted app: evidence quotes are verified against the source text, epistemic status is enforced deterministically, grades are derived from finding severity rather than trusted from the model, untrusted context is wrapped and sanitised, and retrieval is a real 6-stage pipeline running entirely on local MiniLM + pgvector. The design intent is academic-grade. The implementation, however, has three defects that undermine that intent before any prompt is ever sent. **The single biggest risk is silent index corruption in `splitIntoSubchunks` (`lib/ai/document-chunker.ts:62`): the sentence regex drops every fragment that ends in a period not followed by whitespace, so "94.2 %", "p<0.05", "obr. 4.2", "kap. 3.1.4" and every Markdown table row are partially or wholly deleted from the vector index** — in my reproduction a 3,360-char results paragraph was indexed as 1,679 chars beginning with `"2% (tab. 3). 05 bola významná."`. Every downstream stage (RRF, MMR, reranker, compression, LLM quoting, quote verification) then operates on mutilated evidence, and a model that quotes the chunk faithfully will be marked *unverified* because the fragment does not exist in the real document.

Second, in Path A (bachelor reviews) the entire vector-RAG output is almost always sliced to zero because the 60 k budget is first consumed by the keyword-routed context (`thesis-review/route.ts:323-326`); in professional mode (master/PhD) the model sees only the **first 80 k characters** of the thesis (`review-engine.ts:567` → `thesis-context.ts:784-789`), i.e. front matter and literature review, never results or conclusions for a typical 200–400 k-char thesis. Third, the ranking maths mix incompatible scales: RRF sums (~0.02–0.06) are added to fixed boosts of +0.15/+0.05 and compared against Jaccard similarity (0–1), so retrieval order is effectively decided by heading keyword hits and duplicate suppression, not by semantic similarity. Provider reliability is solid (timeouts, retry with capped Retry-After, provider failover, one JSON repair round) but there is no circuit breaker, no token accounting, and the vision fallback chain can take 10 models × 2 attempts × 60 s per image.

**Is it resilient enough for academic-grade work?** Not yet for grading decisions: the review scaffolding is academic-grade, but the evidence it reasons over is truncated and partially corrupted, so reviewers must currently treat every RAG-sourced finding as "needs human verification".

---

## 2. RAG Pipeline Assessment

### Strengths (confirmed)
- **Fully local embeddings** (`Xenova/paraphrase-multilingual-MiniLM-L12-v2`, 384-d, WASM) with a serialized inference queue (`local-embeddings.ts:118-147`), a 1,024-entry LRU keyed by SHA-256 (`:34-49`), warm-up on boot via `instrumentation.ts:11`, and health telemetry surfaced in the RAG status panel (`rag-index-status-panel.tsx:196-201`). No reason to replace this model — its multilingual SK/CS/EN coverage is right for the domain.
- **Heading-path–prefixed chunk embeddings** (`document-chunker.ts:292-297`) — cheap contextual retrieval that works well with MiniLM.
- **Hybrid retrieval in a single SQL round-trip** (`vector-rag.ts:218-266`) using HNSW cosine (`prisma/migrations…:146-147`) + Postgres FTS, workspace- and document-scoped.
- **Non-blocking ingestion**: embedding runs in `setImmediate` after the SSE response (`ingestion/parse/route.ts:374-400`), `vectorStatus` is set to `indexing` *synchronously* before hand-off, and the review route converts that status into a user-facing warning (`thesis-review/route.ts:240-256`). Good UX discipline.
- **Evidence verification chain**: exact → whitespace-normalised → 60-char-anchor approximate → semantic (`evidence-validator.ts:76-135`, threshold 0.6 at `:257`), with `SUPPORTED_FACT` forcibly downgraded when nothing verifies (`:208-213`).

### Math / logic flaws

| # | Stage | Flaw | Status |
|---|---|---|---|
| R1 | **Chunking** `document-chunker.ts:62` | `sentencePattern = /[^.!?\n]+(?:[.!?\n]+(?:\s+|$)|$)/g`. When `.` is followed by a non-space (decimal, abbreviation, section number, table cell) the group fails, the engine backtracks and *advances past the characters*, discarding them. Reproduced: 3,360 → 1,679 chars; `"Model dosiahol presnosť 94.2% (tab. 3)."` indexed as `"2% (tab. 3)."`; a 12-row Markdown table (2,240 chars) survives only as `"87 |"` per table. Applies to every section longer than `maxChunkChars` (1,800 / 3,000), i.e. essentially every chapter body. | **Confirmed** |
| R2 | **Chunking / embedding length** | `CHUNK_SIZE_LONG = 3000` chars (`chunking-config.ts:25`) + heading-path prefix. The model's `model_max_length` is 512 tokens (HF tokenizer_config) and the pipeline truncates (`transformers/src/pipelines.js:704`). Slovak tokenises at ~2.5–3 chars/token, so PhD chunks are ~1,000–1,200 tokens: the second half of every long chunk is never embedded. Even 1,800-char chunks sit at the limit. | **Confirmed** (length), effect on recall hypothetical |
| R3 | **FTS leg is dead for criterion queries** `vector-rag.ts:240-247` | `plainto_tsquery('simple', q)` ANDs every term. The criterion query is `${label} ${guidance}`.slice(0,300) (`thesis-review/route.ts:300`) = 30–45 Slovak words; the probability a 1,800-char chunk contains all of them is ~0, and `'simple'` does no Slovak stemming. The "30 % keyword" leg therefore contributes nothing; the *documented* 70/30 hybrid is de facto 100 % vector. | **Confirmed** (logic) |
| R4 | **Inner RRF discarded** `vector-rag.ts:250-252` vs `:318-329` | The SQL computes `0.7/(60+rank_vec) + 0.3/(60+rank_fts)`, orders by it, then the JS layer *re-ranks by position* `1/(60+rank+1)` and (correctly) refuses to reuse the inner score. Net effect: the 0.7/0.3 weighting only affects candidate *order inside each set*, never the final score. Harmless but the header comment ("70 % cosine HNSW / 30 % ts_rank") is misleading. | Confirmed |
| R5 | **MMR scale mismatch** `vector-rag.ts:355-420` | `relevance` = summed RRF ≈ 0.016 (single hit at rank 1) … ≈ 0.065 (rank 1 in all 4 sets); `maxSim` = Jaccard ∈ [0,1]. With λ=0.7: `0.7·Δrelevance ≤ 0.035` while `0.3·maxSim` reaches 0.035 at Jaccard = 0.12. Any chunk sharing ~12 % n-grams with an already-selected one loses to a chunk that was retrieved at the bottom of one list. After the first pick, MMR is effectively pure diversity. λ needs scale-normalised inputs (min-max the RRF scores to [0,1] first) or λ ≈ 0.98 on raw scores. | **Confirmed** (arithmetic) |
| R6 | **Reranker boosts swamp retrieval** `vector-rag.ts:445-465` | `score = rrf (≤0.065) + 0.15 per query token in heading + 0.05 per token in content`. Query tokens = every word > 3 chars of the 300-char query (~30 tokens). A chunk under heading "Výsledky a diskusia" with 2 heading hits (+0.30) and 10 content hits (+0.50) beats the best semantic hit by 12×. Retrieval order is thus decided by keyword density, which R3 already failed to do properly. Also `criterionId === "results"/"methodology"/"literature"/"goals"` are compared against IDs that in `rubric-engine.ts` are named `results_interpretation`, `methodology_rigor`, `citations_quality`, `objectives_clarity` … → the section-alignment boost never fires. | **Confirmed** |
| R7 | **HyDE without LLM is a domain-prior, not a hypothesis** `vector-rag.ts:155-200` | Templates are ~25 words, keyed on 3–4 substrings of the query, and *embed the criterion query text itself* (`addressing ${query}`). They pull toward generic "this thesis presents results in ${domain}" language, which is closest to abstract/introduction boilerplate. Not harmful (only 1 of 4 fan-out embeddings) but the FTS query for the HyDE set falls back to the raw query (`:305`), so it adds a 4th identical FTS AND-query. | Confirmed (design), impact hypothetical |
| R8 | **Domain-context regex** `vector-rag.ts:56` | `/…|ai|…|it\b/i` matches inside words: `"Interný audit v bankovom sektore"`, `"Rozpočtový deficit"`, `"Detailná analýza fotosyntézy"` all → "Informatika, Softvérové inžinierstvo, AI a dátové vedy", which is then prepended to every query embedding and shifts them toward CS vocabulary. Reproduced. | **Confirmed** |
| R9 | **Compression sentence splitter** `vector-rag.ts:531-541` | `/[^.!?]*[.!?]+["']?/g` splits at decimals too (`"94."` / `"2% …"`), and text after the last terminal punctuation (typical for table rows / list items) is dropped. Sentences ≤ 20 chars are dropped (`:540`) — this removes equation lines like `$$E=mc^2$$`. Threshold 0.05 with `hits / words` means a 25-word sentence needs ≥ 2 partial hits; short numeric sentences fail. The claimed "~35–40 % token reduction" is unmeasured (no metric is recorded). | Confirmed |
| R10 | **Budget starvation of vector RAG (Path A)** `thesis-review/route.ts:262-265` and `:322-326` | `routedContext` is built to fill `THESIS_CONTEXT_BUDGETS.fullGeneration` (60 k) (per-criterion `min(6000, 60000/13)` ≈ 4.6 k × 13). Then `vectorBudget = 60000 − routed − audit − 1000`, typically **0–5 k**, and the whole 6-stage output is `.slice(0, vectorBudget)`. The pipeline runs (~4 embeddings + 4 SQL queries × 13 criteria) and its result is thrown away. Graph budget (`:338-345`) is computed the same way and is also ≈ 0. | **Confirmed** (arithmetic; exact number depends on thesis length) |
| R11 | **Prefix truncation in professional mode** `review-engine.ts:557-567` → `thesis-context.ts:784-789` | `loadThesisContext({maxChars: 80_000})` concatenates files in sorted order and keeps the **first** 80 k chars. No section routing is applied to `rag.fullText`, which is what the professional prompt injects (`review-engine.ts:684`). For a 250 k-char master thesis the model never sees chapters 4–6. `ragStats.truncated` is reported for Path A only; professional mode reports no truncation. | **Confirmed** |
| R12 | **HNSW post-filter recall** `vector-rag.ts:229-236` | `ORDER BY embedding <=> q LIMIT n` inside a CTE with `WHERE workspaceId = …`. pgvector < 0.8 evaluates HNSW with `ef_search = 40` *before* the filter; in a multi-tenant table a small workspace can receive < n (even 0) candidates. | Hypothetical (depends on pgvector version, not pinned in repo) |
| R13 | **Reindex race** `document-chunker.ts:279` | `deleteMany` runs before re-embedding; reviews started during a reindex (minutes for a PhD on WASM) retrieve from an empty/partial index with `vectorStatus = "indexing"` — the warning exists, but the retrieval silently degrades rather than waiting. | Confirmed |

### Edge cases: math & tables
- MinerU emits tables as Markdown pipes and equations as `$$…$$` blocks. Neither has sentence punctuation, so (R1) merges each table into the following sentence fragment and (R9) deletes short equation lines. There is **no table-aware or equation-aware chunk kind**: `classifySectionKind` (`document-chunker.ts:163`) keys only on headings. A "Výsledky" table with the thesis's main numbers is the *least* retrievable artefact in the index.
- Unicode: `applyMMR.tokenize` filters `w.length > 2` and `compressChunks` filters `t.length > 3` on raw whitespace splits, so Slovak diacritics survive, but punctuation stays glued to tokens (`"(tab."`), reducing overlap counts for both the reranker and compression.
- `tokens: Math.ceil(content.length / 4)` (`document-chunker.ts:184`, `vector-rag.ts:644`) underestimates Slovak by ~30–40 %; every "token" budget is really a character budget.

---

## 3. Agent & Workflow Findings Table

| ID | Impact | Confidence | Area | Title | Evidence | Failure Mode | Recommended Improvement | Effort |
|---|---|---|---|---|---|---|---|---|
| A-01 | **Critical** | Confirmed | RAG/Chunking | Sentence splitter deletes decimals, abbreviations and tables from the index | `lib/ai/document-chunker.ts:62-64`; reproduction: 3,360 → 1,679 chars, `"94.2%"` → `"2%"`, table → `"87 |"` | Quantitative evidence is unretrievable; model quotes fragments that fail verification → findings become `unverified`/`REQUIRES_HUMAN_VERIFICATION`; numbers in generated findings are hallucination-prone | Replace regex with a non-dropping splitter: `text.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ž0-9"(])/)` and treat `\n\n` as a hard boundary; add a regression test asserting `joined.length ≥ 0.98 × input.length` and that `"94.2%"` survives. Keep table blocks (`^\|.*\|$` runs) and `$$…$$` blocks atomic | 0.5 d |
| A-02 | **Critical** | Confirmed | RAG/Context | Professional review sees only first 80 k chars of thesis | `lib/ai/review-engine.ts:567`; `lib/ai/thesis-context.ts:784-789`; prompt injection `review-engine.ts:684` | Master/PhD reviews grade results/discussion chapters the model never read; "MISSING_EVIDENCE" findings about things that exist on p. 60+ | Pass `buildFullGenerationContext(rag, activeCriterionIds, 80_000)` (section-routed) instead of `rag.fullText`, or a head+per-chapter-sample selection; surface `truncated` in the professional response the same way Path A does | 0.5 d |
| A-03 | **High** | Confirmed | RAG/Budget | Vector- and Graph-RAG output sliced to ≈0 in Path A | `app/api/workspaces/[id]/thesis-review/route.ts:262-265, 322-326, 338-345` | 13× full retrieval cost (embeddings + SQL + community fetch) with no effect on the prompt; users see "RAG active" in stats while the model gets none | Reserve budgets up front: e.g. `routed = 60 %`, `vector = 30 %`, `graph = 10 %` of `fullGeneration`, and pass `maxChars = routedBudget` into `buildFullGenerationContext` | 0.5 d |
| A-04 | **High** | Confirmed | Ranking | Reranker boosts (+0.15/+0.05) dominate RRF scores (≤0.065) | `lib/ai/vector-rag.ts:445-465` | Final top-K is keyword-density order; semantic recall from MiniLM is effectively discarded | Min-max normalise RRF to [0,1] before boosting; cap boosts at 0.2 total; fix criterion IDs (`results_interpretation`, `methodology_rigor`, …) so the section-kind boost fires | 0.5 d |
| A-05 | **High** | Confirmed | Ranking | MMR compares RRF (~0.03) against Jaccard (0–1) | `lib/ai/vector-rag.ts:399-406` | After first pick, selection is pure diversity; a rank-40 chunk is preferred over a rank-1 near-paraphrase | Normalise `relevanceScores` to [0,1] (or use cosine of stored embeddings) and keep λ=0.7; add unit test with two identical-score chunks | 0.25 d |
| A-06 | **High** | Confirmed | Retrieval | FTS leg never matches criterion queries (AND of 30+ terms, `'simple'` config) | `lib/ai/vector-rag.ts:240-247`; query built at `thesis-review/route.ts:300` | Hybrid search is single-signal; failures of MiniLM on numeric/named-entity queries are not backstopped | Use `websearch_to_tsquery` with the top-6 criterion-expansion keywords OR-joined (`getThesisCriterionQueryExpansion` already exists), and `unaccent` + `'simple'`; keep the 300-char string for the embedding only | 0.5 d |
| A-07 | **High** | Confirmed | Cost | GraphRAG extraction: up to 60 LLM calls per ingested document, unbounded across uploads, no timeout signal | `lib/ai/document-chunker.ts:30, 227-247, 333-340`; `lib/ai/graph-extractor.ts:91-100`; enabled by default (`:26`) | A 5-file upload = up to 300 background completions at 8 k max_tokens each; reindex (`reindex/route.ts`) re-triggers them; no rate limit or kill switch per workspace | Gate behind an explicit "Build knowledge graph" action or a per-workspace daily cap; pass `signal: AbortSignal.timeout(AI_TIMEOUTS.structure)`; batch 3–4 chunks per call | 0.5 d |
| A-08 | **High** | Confirmed | Reliability | Vision fallback chain worst case 10 models × 2 attempts × 60 s per image | `lib/ai/models.ts:36-59`; `lib/services/vision-service.ts:61-97` | One dead provider stalls asset captioning for 20 min/image and burns 20 requests each; ingest of a 30-figure thesis can spend hours in background | Try at most 3 models; stop the chain on non-retryable 4xx (model-not-found) instead of `break`→next; share one deadline across the chain (`AbortSignal.timeout(90_000)`) | 0.25 d |
| A-09 | **Medium** | Confirmed | Prompts | Card generation runs at default temperature 0.7 under "STRICT GROUNDING" | `lib/ai/client.ts:111`; `cards/[cardId]/generate/route.ts:100-106` (no `temperature`) | Poster bullets paraphrase numbers/claims loosely; two runs of "Generate All" give different facts | Set `temperature: 0.2` for `generate-card`, `convert`, `shrink`; keep 0.7 only for chat | 0.1 d |
| A-10 | **Medium** | Confirmed | Agents | 3-attempt compile loop makes only **one** autofix request and never applies it | `components/store/ui-slice.ts:129-132, 229-247` | Loop breaks after the first failed compile with "Autofix ready"; `MAX_ATTEMPTS = 3` is dead code; users believe 3 fixes were tried | Either apply fixes automatically inside the loop (with undo snapshot) and recompile, or rename UI to "Compile + suggest fix" and drop the loop | 0.5 d |
| A-11 | **Medium** | Confirmed | Agents | `autoFillAllCardsAction` is strictly sequential and inherits the 10/min generate limit | `components/store/project-slice.ts:600-633`; `cards/[cardId]/generate/route.ts:40` | A 24-card poster = 3 forced 61 s pauses (~5 min wall time); each pause shown as "Rate limit hit" even though the limiter is the app's own | Give bulk runs a dedicated limiter key (`:bulk-generate`, e.g. 40/min) or run 2–3 cards concurrently with a client-side semaphore | 0.25 d |
| A-12 | **Medium** | Confirmed | Prompts/Schema | Self-critique can invent findings with `evidence: []` and `includeInExport: false`, but can also silently *downgrade* verified findings | `lib/ai/review-engine.ts:373-405` | A 0.6-temperature model listing an ID as "overstated" downgrades a `verified-exact`, `SUPPORTED_FACT` finding one rung and flags it — the critic never sees the manuscript, only 300-char quotes | Skip downgrade when `evidenceState ∈ {verified-exact, verified-normalized}` and `epistemicStatus === SUPPORTED_FACT`; require a `reason` for `overstatedIds` | 0.25 d |
| A-13 | **Medium** | Confirmed | Reliability | No token accounting or cost metrics; usage only `console.log`'d | `lib/ai/client.ts:140` | No way to detect a cost spike from A-07/A-08 or to show per-review cost | Persist `{operation, model, provider, prompt_tokens, completion_tokens, durationMs, workspaceId}` to a `AiUsage` table; expose in rag-stats | 0.5 d |
| A-14 | **Medium** | Confirmed | Reliability | No circuit breaker; every call re-tries the dead primary 3× (up to 3×30 s) before failover | `lib/ai/client.ts:20-21, 49-58, 217-240` | During a provider outage each review waits ≥ 90 s + before fallback; bulk autofill multiplies this | Add an in-process breaker (open after 3 consecutive 5xx/timeouts within 60 s, half-open after 30 s) keyed by `apiUrl`; skip straight to fallback while open | 0.5 d |
| A-15 | **Medium** | Confirmed | RAG/Embedding | Chunk size exceeds MiniLM 512-token window for Slovak | `lib/ai/chunking-config.ts:19-25`; HF `tokenizer_config.model_max_length = 512` | Tail of long chunks (esp. 3,000-char PhD chunks) never influences the vector | `CHUNK_SIZE_SHORT = 1200`, `CHUNK_SIZE_LONG = 1500`, overlap 150; log `tokenizer(text).input_ids.length` once per ingest to calibrate | 0.25 d |
| A-16 | **Medium** | Confirmed | RAG/Query | Domain-context regex matches `ai`/`it` inside words | `lib/ai/vector-rag.ts:56` — reproduced with "Interný audit…", "Rozpočtový deficit…", "fotosyntézy" | Economics/biology theses embedded with an "Informatika, AI" prefix; systematic retrieval bias | Use word boundaries: `/\b(ai|it|ml)\b/` and keep stems for the rest; add a unit test with the three phrases above | 0.1 d |
| A-17 | **Medium** | Confirmed | Prompts | Grade JSON (`"grade": "A…FX"`) requested from model, then reconciled — but professional path assigns the *same* overall grade to every criterion section | `thesis-review/route.ts:458-460` (`rating: professionalResult.grade`, `numericScore: derivedScore ?? 75`) | Per-criterion grades in the UI are fictitious duplicates of the global grade; `?? 75` silently invents a "C" when derivation is absent | Compute per-criterion score from findings filtered by `criterionId` (`computeScoreFromFindings(matchingFindings)`); render `—` instead of 75 when no findings | 0.5 d |
| A-18 | **Low** | Confirmed | Prompts | Truncated **text** completions are returned as success | `lib/ai/client.ts` (text path: `console.warn` on `finish_reason=length`, returns partial) — used by chat (`chat/route.ts:267`) | Chat `<fix>` blocks can be cut mid-Markdown and applied to a card | Append a visible `[response truncated]` marker and disable "Apply fix" when the `<fix>` tag is unclosed | 0.1 d |
| A-19 | **Low** | Confirmed | Reliability | JSON repair sends the invalid content back as an `assistant` turn — doubles prompt size on the largest calls | `lib/ai/client.ts:166-184` | For thesis review (60–80 k chars prompt) the repair call is ~2× cost; still fails on schema mismatches unrelated to truncation | Truncate `invalidContent` to the last 4 k chars in the repair message; include the Zod path list, not the whole message | 0.1 d |
| A-20 | **Low** | Hypothetical | Retrieval | HNSW post-filter under-retrieval for small workspaces in large tables | `lib/ai/vector-rag.ts:229-236`; pgvector version unpinned | Silent `chunks.length === 0` → review proceeds "with degraded grounding" without saying so | Pin pgvector ≥ 0.8 and set `hnsw.iterative_scan = relaxed_order` per session, or partition by `workspaceId` with partial indexes | 0.25 d |
| A-21 | **Low** | Confirmed ⚠️R5 | AI UX | `overBudget` is now surfaced (Round 5) but the threshold is 1.4× and the model is never told the *unit* it overshot in | `cards/[cardId]/generate/route.ts:109-110` | 39 % overflow is silently accepted; 41 % gets a toast; second attempt uses the same prompt | Feed `characterLimit` and the previous overshoot into a single "shrink" retry (`/shrink` exists) before surfacing to the user | 0.25 d |

---

## 4. Prompt & Grounding Critique

### P-1 Professional review user prompt — `lib/ai/review-engine.ts:651-735`

**What's wrong**
1. The 80 k-char manuscript prefix is labelled `--- MANUSCRIPT EXCERPTS ---` but the system prompt demands "Quote specific sentences … `MISSING_EVIDENCE`: Required information that could not be verified in the supplied text." Nothing tells the model that *the supplied text is a prefix* and that absence ≠ omission. Failure example (typical for a 250 k master thesis): `{"title":"Chýba diskusia limitácií","epistemicStatus":"MISSING_EVIDENCE","severity":"major"}` while chapter 6 "Limitácie" exists at offset 190 k.
2. The example JSON says `"sourceRevision": "The source revision hash provided in the metadata"` — some models echo the sentence literally; the contract's preprocess doesn't validate the hash, so evidence gets `sourceRevision = "The source revision hash…"` → `verifyEvidenceQuote` flags it **stale** (`evidence-validator.ts:63-73`).
3. Quotes are requested with no length or count guidance; long quotes routinely fail exact/normalised match on line-wrap differences and fall to the 60-char prefix path with confidence 0.45.

**Rewrite (drop-in replacement for the excerpt header and the evidence sub-schema)**
```text
--- MANUSCRIPT EXCERPTS (PARTIAL) ---
Coverage: characters 0–${rag.fullText.length} of ${rag.totalChars} (${Math.round(100*rag.fullText.length/rag.totalChars)} %). Sections present: ${rag.sections.map(s=>s.heading).join(" | ")}.
If a required element is not in these excerpts, use epistemicStatus "REQUIRES_HUMAN_VERIFICATION" (not "MISSING_EVIDENCE") and name the section you would expect it in.
${wrapUntrustedContext("manuscript_text", rag.fullText)}
```
```json
"sourceRevision": "${sourceRevision}",
"evidence": [
  { "sectionHeading": "exact heading from the excerpts",
    "quote": "verbatim, copied character-for-character, 8–40 words, no ellipsis, no paraphrase" }
]
```
Add to system rule 2: *"Each finding must cite 1–3 quotes. If you cannot copy a verbatim quote, set evidence to [] and epistemicStatus to REVIEWER_JUDGMENT."*

### P-2 Path A thesis prompt — `lib/ai/prompts-thesis.ts:184-208` (+ context assembly `thesis-review/route.ts:380-384`)

**What's wrong**
1. The `Task` block asks for per-criterion `numericScore` **and** `rating` and separately says "Strictly align numericScore with ECTS grade", but the grade anchors (`formatGradeAnchorsText`) are in the *system* prompt while the score bands (`calculateGradeRange`, `rubric-engine.ts:836`) are never shown to the model — it guesses bands. Failure example seen in this design: `"rating":"B","numericScore":68` (68 is `C` in the app's table) → UI shows a B badge over a C-derived bar.
2. Vector and graph evidence are appended *after* `routedContext` under bare labels `[Vector-Retrieved Evidence]` — there is no instruction that these are *retrieved snippets that may repeat sections above* and no chunk IDs, so the model cannot say where a quote came from, and nothing prevents it from counting the same paragraph twice as "evidence".
3. `wrapUntrustedContext("EvaluationCriteria", criteriaList)` and `wrapUntrustedContext("Task", …)` wrap **trusted** app text as untrusted, which (a) breaks every `<` in the JSON example (`<criterionId>` → `< criterionId>`) and (b) dilutes the meaning of the tag for the model.

**Rewrite (Task block)**
```text
<Task>
For each criterion listed in <EvaluationCriteria>, write 2–4 sentences in ${lang}, then assign numericScore (0–100) and rating using EXACTLY these bands:
A 91–100 · B 81–90 · C 71–80 · D 61–70 · E 51–60 · FX 0–50.
Evidence rules: quote verbatim from <ThesisSourceDocument>; snippets under [Vector-Retrieved Evidence] are retrieved excerpts of the same document — cite their "### heading" and do not count them as additional evidence for the same claim.
Return ONLY this JSON (no markdown):
{"sections":[{"sectionId":"criterion id","criterionId":"criterion id","text":"…","rating":"A|B|C|D|E|FX","numericScore":0,"suggestions":["…"]}],
 "overallGrade":"A|B|C|D|E|FX","recommendation":"…","defenseQuestions":["…","…","…"],"citationIssues":["…"]}
</Task>
```
(Emit the band table from `calculateGradeRange` so the two can never drift.) Wrap only `ThesisSourceDocument` and `ThesisMetadata` with `wrapUntrustedContext`; emit `EvaluationCriteria`/`Task` as plain tags.

### P-3 Card generation prompt — `cards/[cardId]/generate/route.ts:140-190`

**What's wrong**
1. `groundingRule` says "Use ONLY information from the source material" but `sourceContext` is the **first 80 k chars of all sources concatenated** (`context.ts:59-79`, `AI_CONFIG.generation.maxSourceChars`), not the part relevant to `topic`. For a "Results" card the model sees introduction/lit-review and dutifully invents results-flavoured bullets "grounded" in nothing. No retrieval is used here although `searchHybrid` exists.
2. Figure assignment: "assign up to 2 … `{ "slot": "figure1", "assetId": "..." }`" with no rule against inventing IDs; the client drops unknown IDs (`project-slice.ts:533-541`, counted in `droppedAssets`) but the model receives no feedback, so the next card repeats it.
3. Temperature is the client default 0.7 (A-09).

**Rewrite (poster branch, rules section)**
```text
<Source Material>   ← replace loadSourceContext() with top-8 searchHybrid(workspaceId, topic, 8) chunks, each prefixed "### {heading}"
…
POSTER CARD WRITING RULES:
- STRICT GROUNDING: every number, dataset name and claim must appear in <Source Material>. If the material does not cover "${topic}", return {"bullets":["[No source material covers this topic — add a source or edit the card title]"],"assignedAssets":[]}.
- Figures: assignedAssets[].assetId MUST be one of ${JSON.stringify(availableAssets.map(a=>a.id))}. If none fits, return [].
- Total length of all bullets: ${Math.round(characterLimit*0.9)}–${characterLimit} characters. Count before answering.
```
and call with `temperature: 0.2`.

---

## 5. Security & Cost Vulnerabilities

**Prompt injection (confirmed mitigations, remaining gaps)**
- `wrapUntrustedContext` (`prompts.ts:56-76`) strips control/bidi chars, neutralises `]]>`, `?>` and `<`+non-space. Good. Gaps: (a) it does not neutralise Markdown/role-play injections ("Ignore prior instructions…"), which is fine as long as the system prompt says the block is data — the thesis prompts do (`prompts-thesis.ts:83`), but the **professional** system prompt (`review-engine.ts:606-650`) and **card generation** prompt do not contain any "treat as data, never instructions" sentence; (b) `autofix-compile` feeds the raw pdflatex log (attacker-controllable via card content) and returns `patches[].content` that the user applies with one click — an injected log line can steer the model to rewrite *other* cards ("Do not return patches for cards that are correct" is advisory only). Recommend: only accept patches for card IDs that appear in the error window (`route.ts:60-66`) and diff-preview before apply.
- Chat: the `<fix>` protocol (`chat/route.ts:208-214`, parsed at `agent-panel.tsx:497`) has no card-ID binding — the fix applies to whatever card is selected at click time.

**Timeouts / hangs**
- Good: hard 180 s per request (`client.ts:25-33`), `AbortSignal.any` composition, `TimeoutError` not retried (`:81`), Retry-After capped at 30 s (`:52-53`).
- Gap: the timeout signal is created once per `requestCompletion`, so it correctly bounds all 3 fetch attempts — but the **repair** call gets a *fresh* 180 s, and provider failover another 2 × 180 s: worst case per structured call ≈ 12 min. Thesis review may run primary + critique → 24 min with no user-visible progress and Path A's route holds the HTTP connection open the whole time (no job/SSE).
- Background: GraphRAG extraction (`graph-extractor.ts:91`) has no `signal` → 180 s default × 60 calls; nothing cancels it when the workspace is deleted.

**Failover**
- Correct: 4xx (≠429) and `AIValidationError` are not failed over (`client.ts:229-238`). Missing: no breaker (A-14), `lastServedProvider` is a process-global (the per-call `provenance` bag was added correctly, but `getLastServedProvider()` is still exported and used by older callers — verify before relying on it).
- Vision chain (A-08) does not distinguish "model not found" from "provider down", so a typo in `AI_VISION_FALLBACK_MODELS` costs 2 attempts per bad name.

**Cost**
- Uncapped: GraphRAG (A-07), vision chain (A-08), JSON repair on 80 k prompts (A-19), Path A recomputing 13 retrievals whose result is discarded (A-03). Rate limits exist per route (`thesis-review` 3/5 min, `generate` 10/min, `autofix` 3/min) but not for background work, and none are cost-aware.
- No telemetry to notice any of the above (A-13).

---

## 6. Quick Wins (< 1 day each, in priority order)

1. **Fix `splitIntoSubchunks` regex** (A-01) + regression test; then trigger reindex. *Highest value per hour in the codebase.*
2. **Professional mode: section-routed context instead of 80 k prefix** (A-02): one-line change to call `buildFullGenerationContext(rag, activeCriterionIds, 80_000).contextText` and surface `truncated`.
3. **Reserve budgets** for routed/vector/graph before building context (A-03).
4. **Temperatures**: `generate-card`, `convert`, `shrink` → 0.2; `vision-caption` → 0.1; leave review 0.15 / critique 0.6 / chat 0.7. Also set `temperature: 0` for `GraphRAG-Extraction` (already 0.1 — fine).
5. **Normalise RRF scores to [0,1]** before MMR and reranker; fix criterion-ID mismatch in `rerankChunks` (A-04/A-05).
6. **FTS query**: OR-join the top-6 expansion keywords via `websearch_to_tsquery` (A-06).
7. **Word-boundary domain regex** (A-16) — 5 minutes plus test.
8. **Vision chain**: limit to 3 models, single shared deadline (A-08).
9. **GraphRAG kill switch**: default `GRAPH_RAG_ENABLED=false` in `.env.example` until batched (A-07).
10. **Protect verified findings from critique downgrades** (A-12).
11. **Chunk size 1200/1500** (A-15) — combine with the reindex from item 1 so users reindex once.

---

## 7. AI Roadmap Recommendations

**0–1 month — make the evidence trustworthy**
- Structure-aware chunker: emit `table`, `equation`, `figure_caption` chunk kinds (MinerU already marks them in Markdown); embed tables as "heading + column names + row text"; never split inside `$$…$$` or pipe blocks.
- Per-call token/cost ledger + per-workspace daily budget with a soft stop; expose in the RAG status panel next to the embedding health you already show.
- Move Path A / professional review behind the existing `jobQueue` (or an SSE stream) so 5–20-minute generations report stage progress ("retrieval 13/13 · primary review · self-critique") and can be cancelled — the plumbing for `vectorWarning`/`ragStats` is already there.

**1–3 months — make retrieval actually hybrid and measurable**
- Build a 30–50 query golden set from real SK/CS theses (criterion → expected sections) and record Recall@K / MRR in a vitest that runs with `TEST_REAL_EMBEDDINGS=1`; use it to tune λ, boosts and chunk size instead of the current comments.
- Replace the heuristic reranker with a small local cross-encoder (e.g. `Xenova/ms-marco-MiniLM-L-6-v2` is English-only, so prefer `bge-reranker-v2-m3` ONNX if you can afford ~560 MB; otherwise keep heuristics but normalised). This stays within the self-hosted design.
- Citation-anchored generation: pass chunk IDs (`[c17]`) in the prompt and require `evidence[].chunkId`; verification then becomes exact lookup instead of substring search, and the UI can jump to the chunk.

**3–6 months — agentic review that is auditable**
- Split the monolithic review into per-criterion calls with their own 6 k evidence budget (13 small calls ≈ same tokens as one 80 k call, but each is grounded and cacheable per `sourceRevision`), then a final synthesis call for summary/grade. This removes the prefix-truncation problem structurally and makes A-17 (per-criterion grades) real.
- Self-critique with tools: give the critic `searchHybrid` access ("find text supporting/contradicting finding 3") rather than 300-char quotes, so downgrades and "missed weaknesses" are evidence-based.
- Provider health model: breaker + latency/cost per model in the ledger, used to pick vision/primary models dynamically instead of a static 10-model chain.

---
*Status: **remediated in Round 6** (see `CHANGELOG.md` → "Applied AI (Round 6)"). All A-01…A-21 and R1–R13 items have code fixes; roadmap items in §7 remain open. Existing workspaces must be re-indexed to pick up the chunker fix.*
