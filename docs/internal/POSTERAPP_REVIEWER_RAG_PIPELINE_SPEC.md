# PosterApp Reviewer RAG Pipeline — presná technická špecifikácia (handoff)

**Dátum:** 2026-09-19 · **Zdroj:** čítanie kódu na branchi `arena/01a0b84f-posterapp` (commit `f8c5cf1`)
**Účel:** presný, overený popis toho, ako reálne funguje reviewer RAG pipeline — ako vstup pre model, ktorý ju bude rozširovať. Každá vetva má odkaz na súbor. Nič tu nie je z monstergrafu ani z dokumentácie — všetko je overené v kóde. Tam, kde niečo **nie je zapojené** do produkčnej cesty, je to explicitne uvedené (časť 8).

Kontext: PosterApp generuje akademický posudok (šk. „posudok" / review) k bakalárskym, diplomovým a dizertačným prácam aj článkom. Jazyky: SK / CS / EN. Stack: Next.js + PostgreSQL + pgvector, lokálne ONNX embeddingy cez `@xenova/transformers`, externé LLM (Gemini/OpenAI-kompatibilné) len na generovanie textu posudku.

---

## 1. Celkový tok

```
PDF ──▶ MinerU (externý HTTP parser) ──▶ Markdown + middle_json
     └─(fallback)─▶ pdftotext / pdfjs-dist ─▶ Markdown
                    │
                    ▼
        INGESTION (raz za dokument)
        document-chunker.ts / chunker-v2.ts ─▶ DocumentChunk (structural chunks)
        model-registry.ts ─▶ embedding (384-d) ─▶ pgvector + HNSW
        graph-extractor.ts ─▶ GraphNode / GraphEdge
        graph-communities.ts ─▶ GraphCommunity (zhrnutia)
                    │
                    ▼
        QUERY-TIME RETRIEVAL (raz za kritérium)
        review-pipeline.ts ─▶ retrieveForCriterion() ─▶ hybrid-retrieval.ts::retrieveEvidence()
          1 route ─▶ 2 transform ─▶ 3 embed ─▶ 4 generate (7 legs) ─▶ 5 fuse (RRF)
          ─▶ 6 MMR ─▶ 7 rerank ─▶ 8 parent-context expansion ─▶ 9 assemble (labelled context)
                    │
                    ▼
        REVIEW GENERATION (LLM)
        rubric (sk-academic-v1, 12 kritérií) ─▶ agentic per-criterion ALEBO monolit
        ─▶ evidence anchoring ([cN] kotvy) ─▶ adjudikácia ─▶ kompozícia ─▶ persist
```

---

## 2. Dátový model (prisma/schema.prisma)

**`DocumentChunk`** — atomická jednotka indexu:
- `content` — **verbatim** text chunku (nikdy sa nemešká s dôkazovými citáciami), `contextPrefix` — Anthropic-style prefix (titulok práce, doména, breadcrumb sekcie, cieľ sekcie), ktorý sa pripája **len pri embedding/FTS indexácii**, nikdy do `content`
- `embedding vector(384)` + HNSW index (`document_chunk_embedding_hnsw`); `embeddingDimensions` + `embeddingModelVersion` + `indexVersion` (manifestKey) — radšej hlásia mismatch model/stálosť indexu, ako aby 384-d vektor čítal ako 1024-d
- štruktúra: `kind` (prose|table|equation|figure_caption), `chunkType` (paragraph|table|equation|figure_caption|citation|section), `ordinal`, `pageStart/pageEnd` (nikdy sa nesynthetizujú), `chapter/section/subsection`, `sectionPath` (breadcrumb „Kapitola 3 > 3.1 Návrh"), `parentChunkId` (sekcia = reading unit), `previousChunkId/nextChunkId`, `sourceElementIds`, `contentHash` (SHA-256, idempotné reindexovanie), `parserVersion`/`chunkerVersion`/`tokenEstimatorVersion`
- izolácia: všetko je pod `workspaceId`

**`Evidence`** — verbatim, page-anchored span, ktorý finding cituje; finding musí odkazovať na Evidence row, nie na free text (to robí „každý tvrdý claim má zdroj" vynútiteľným).

**`GraphNode` / `GraphEdge` / `GraphCommunity`** — GraphRAG vrstva (entity, relation, label/description; komunity so `summaryEmbedding`).

**`IngestFile.vectorStatus`** — stavový automat `pending → indexing → ready|error` + `vectorChunks`/`vectorIndexedAt`; review pipeline z toho stavu **varuje** („index sa ešte buduje"), nie failuje.

---

## 3. Ingestion pipeline

1. **Parsing:** MinerU (externá služba, `md_content` CommonMark + `middle_json` s tabuľkami/rovnicami/stránkami). Fallback keď je MinerU dole: `lib/services/pdf-fallback-parser.ts` — `pdftotext -layout`, potom pdfjs-dist; výstup vždy formátovaný ako `# {titulok}` + `<!-- Page N -->` markery.
2. **Chunking (`lib/ai/chunker-v2.ts`, verzia 2.0.0, `PARSER_VERSION = "mineru-md-1"`):** hierarchický — sekcia sa rozloží na elementy (paragraph/table/equation/figure_caption/citation; pipe-riadky = tabuľka, `$$` = display math), tie sa napackujú do token budgetov: **child ≤ 256 tokenov, parent (section) ≤ 1024 tokenov, rezerva pre prefix 96 tokenov** (`DEFAULT_CHILD_MAX_TOKENS/PARENT_MAX_TOKENS/PREFIX_RESERVE_TOKENS`). Tabuľky/rovice/captions sa **nikdy nesplitujú** (prípadne `oversized: true`). Legacy v1 cesta (`document-chunker.ts`): 1800 znakov (Bc/MSc/článok) resp. 3000 (PhD > 200k znakov), sentence-aware, breadcrumb prefix. `contextPrefix` sa generuje v `chunk-context.ts`.
3. **Embedding (`lib/ai/model-registry.ts`):** default `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (384-d, 512-token okno, WASM/ONNX in-process). Prepínateľné cez `EMBEDDING_MODEL`/`EMBEDDING_DIM`/`EMBEDDING_BACKEND` (backendy: `xenova-v2` | `hf-v3` | `openai-compatible` | `reference-ngram` — posledný je deterministický hash vektorizér pre offline CI, explicitne NOT neural). E5-štýl modely vyžadujú `query:`/`passage:` prefixy — registry ich rieši. `assertVectorWidth` + manifest (`index-version.ts`) strážia konzistenciu šírky vektora s stĺpcom.
4. **HNSW:** m=16, ef_construction=128 (migrácie). Dotazové `ef_search` skaluje `efSearchFor(limit) = clamp(100, 1000, limit×20)` — premerané v `artifacts/eval/pgvector-live.json`, nie zhladičbené.
5. **GraphRAG extrakcia (`graph-extractor.ts`):** default ON (`GRAPH_RAG_ENABLED`), batchovane (3 chunky/LLM call), entity+relation do GraphNode/GraphEdge s canonicalizáciou mien a placeholder-filtrami (`graph-rag.ts::isPlaceholderEntity`). Komunity (`graph-communities.ts`) dostávajú `summaryEmbedding` — vektor komunity sa nikdy neporovnáva s vektorom iného modelu (model version v riadku).

---

## 4. Query-time retrieval — `hybrid-retrieval.ts::retrieveEvidence()`

Vstup: `{ workspaceId, query, criterionId?, documentId(s)?, topK=8, maxContextChars=24 000, ablation?, lang? }`. Deviats krokov, všetky s timings do `trace`:

1. **Route (`query-router.ts`):** 9 kategórií (`exact-fact, definitional, numerical, methodological, novelty-prior-art, limitations, citation, structural, global-synthesis`) rozpoznaných multilingválnymi regex signálmi (váha 1–3; napr. `accuracy|presnos|f1|p-hodnot…` → numerical; `[Autor, 2019]` → prior-art). Route určuje: **ktoré legs bežia a s akými limitmi/váhami**, preferované sekcie (boost), structural typy, expanznú politiku, či sa čaká counter-evidence. Route sa merged s criterion profile (`criterion-profiles.ts`).
2. **Query transform:** (a) fan-out — `expandQuery()` (base + keyword-focus + criterion-expanded varianty; expansion per kritérium z `vector-rag.ts::getThesisCriterionQueryExpansion`), (b) **HyDE** — `generateHypotheticalDocument()`: viacjazyčné šablóny (žiadne LLM, nulová cena), keď route chce. Zlyhanie HyDE nič nestojí (try/catch).
3. **Embed variantov** (`embedTexts(variants, "query")`). Ak embedding padne, dense leg proste nebeží — lexical/metadata/citation áno.
4. **Generate (`retrievers/generators.ts`)** — 7 nezávislých generátorov, každý: rovnaký workspace-isolation filter, vracia `[]` (nie exception) pri zlyhaní, reportuje vlastnú latenciu:
   - **dense** — pgvector kozín: `1.0 - (embedding <=> q)` cez HNSW; per variant `LIMIT max(10, ceil(limit×1.5))`; `SET LOCAL hnsw.ef_search` + `hnsw.iterative_scan='relaxed_order'` (v `retrieval-sql.ts::applyHnswSessionTuning`, v transakcii kvôli PgBouncer). Keď hybrid vráti menej riadkov než žiadané (malý workspace, prerezané HNSW vetvy), doplní **exact scan** `ORDER BY embedding <=> q` bez indexu (vypnuteľné `RAG_EXACT_FALLBACK=false`).
   - **lexical** — PostgreSQL FTS: `websearch_to_tsquery` z tokenov > 3 znaky OR-joinuté (`buildFtsQuery` — `plainto_tsquery` by AND-ol všetko a nikdy nič nenašiel), `ts_rank`.
   - **metadata** — štrukturálne filtre (kind/chunkType/page) + `AND (…OR…)` prefix match na sectionPath.
   - **citation** — regex `[Autor, 2019]` / `[3]` / `(2019)` (`CITATION_MARKER_RE`) naparsuje referencie z query a nájde chunky, ktoré ich obsahujú.
   - **graph** — `linkQueryEntities` napojí query entity na GraphNode-y, sleduje GraphEdge (skóre: name hit > label hit > description hit), vracia chunky dokumentov napojené na node.
   - **community** — GraphCommunity summary skórované token overlap + summaryEmbedding similaritou; **nie sú to chunky** — vytiahnu sa pred fúziou ako `globalContext` (LightRAG-style „globálny kontext" pre cross-chapter otázky).
   - **prior-art** — rezervovaný pre novelty (scholarly comparator flow).
   - Po generovaní: **section boost ×1.15** pre chunky, ktorých `sectionPath` sedí na preferované sekcie route — soft boost, nikdy nefiltruje.
5. **Fuse (`fusion.ts`):** **weighted RRF** — `score(d) = Σ_m w_m/(k + rank_m)`, `k = 60` (z RRF paperu). Default váhy: `dense 1.0, lexical 0.9, graph 0.6, citation 0.6, metadata 0.4, community 0.5, prior-art 0.5` (route ich prepisuje). Fúzia používa **iba rank pozície** — cosine 0.83 a ts_rank 0.041 nie sú porovnateľné, ale „3. v dense" a „3. v lexical" sú. Fúzný pool: 200 kandidátov (`DEFAULT_FUSION_POOL`). Každý kandidát nesie `sources[]` s podielom príspevku per zdroj (plná atribúcia pre audit).
6. **Diversity (MMR):** λ = 0.8 default (`ablation.lambda`), pool = `min(topK×4, …)`. Similarita v MMR je **lexikálna** (word bigramy+trigramy + char-4-gramy, Jaccard) — fused pool nenesie embeddingy a predstieranie opačného by z MRR spravilo čistý relevance.
7. **Rerank (`retrieval-ranking.ts::rerankCandidates`):** pool = `max(topK×3, 12)`; **reálny cross-encoder** `Xenova/bge-reranker-v2-m3` (model-registry, `RERANKER_MODEL`/`RERANKER_ENABLED`); blend rerank×fusion. Keď model nie je načítaný, pipeline to **prizná** (`scorer: "lexical-heuristic"`, `usedNeuralReranker: false`) — lexikálny heuristic sa nikdy nepredáva ako cross-encoder.
8. **Expand (`parent-context.ts::expandContext`):** selected chunky (topK) sa rozšíria na čitateľský kontext **v rámci jedného budgetu** (`maxContextChars` 24k): **parent** (sekcia cez `parentChunkId`), **neighbours** (`previousChunkId/nextChunkId` okno z route), **related elements** (tabuľky/rovice/captions napojené cez `sourceElementIds`); retrieved chunky sa **nikdy nestrácajú**, budget len limituje dodatočný kontext. Roly: `retrieved | parent | neighbor | related-element`. Plus **counter-evidence**: pasívny `selectCounterEvidence` (lexikálne negation/limitation markery — len labeluje, nerozhoduje) + aktívny `retrieveActiveCounterEvidence` (limit 4, patterny z route) keď kritérium čaká protidôkazy.
9. **Assemble (`buildEvidenceContext`):** reviewer LLM nedostáva „top-k blob", ale **labelované sekcie**: `CRITERION / QUESTION / EXPECTED EVIDENCE / DIRECT EVIDENCE / COUNTER-EVIDENCE (qualifies or contradicts the above) / GRAPH / CITATION / NUMERICAL (machine-checked, not model-generated) / PRIOR-ART / UNCERTAINTIES (state these explicitly; do not resolve them by guessing)`. Každý chunk renderovaný ako `[chunkId] (sectionPath, p. X–Y) heading\ncontent`. Celý `trace` (route, transformy, per-leg latencie/errory/degradácie, fusion váhy, MMR λ, rerank scorer, expanzia, embedding model health) sa vracia volajúcemu.

**Legacy path (`vector-rag.ts::retrieveForCriterion`)** — toto je entrypoint, ktorý používa review pipeline: 6-stupňová pipeline (fan-out 3 varianty, HyDE, hybrid RRF 70/30 v jednom SQL, MMR λ=0.7, criterion-aware rerank, TF-IDF kompresia ~35–40 % tokenov). Default ale **deleguje na multi-source pipeline** (`RETRIEVAL_PIPELINE=legacy` vracia staré správanie). Vracia `{ chunks, communityContext }`, chunky s `relevanceScore`.

**Ablation API:** `RetrieveEvidenceOptions.ablation` — `disableSources[]/onlySources[]/fusionMethod/disableRerank/disableExpansion/disableQueryTransform/lambda` — vypnuté legs sa stále reportujú v trace ako `enabled: false`.

---

## 5. Review orchestration (`review-pipeline.ts::runReviewPipeline`)

Stages (SSE progres + job manager): `queued → loading_context → retrieval → criterion_reviews → primary_review → self_critique → synthesis → persisting → done` (+ `error/cancelled`).

1. **loading_context:** `loadThesisContext` (section-aware loader, max 120k znakov fulltextu); prázdny zdroj → 422 „Upload and parse a thesis document first". `computeSourceRevision` (SHA-256) — kotvy a citácie sa viažu na revíziu zdroja (stale detection). `classifyDisciplineAndThesisType` + `detectReportingGuideline` (CONSORT/PRISMA/STROBE…; auto-aplikuje len nad confidence threshold, inak len navrhne).
2. **Rubrik:** `sk-academic-v1` — 12 kritérií: `problem_relevance, objectives_clarity, theoretical_background, methodology_rigor, analytical_execution, results_validity, discussion_relation, originality_contribution, structure_coherence, citations_quality, ethics_transparency, limitations_future_work`. Aplikovateľnosť per thesis type (Bc/MSc/PhD), caution guidance + prohibited inferences prenesené do promptu („Neusudzujte: …"). Váhy: default / faculty template / custom.
3. **retrieval:** per-kritérium `retrieveForCriterion(workspaceId, "label + guidance", { topK, criterionId, includeCommunityContext, kinds })` v batchoch po 3 kritériá; chunky dostanú **stabilné kotvy** `stableEvidenceAnchor(chunkId)` = `c-` + SHA-256(chunkId)[0:16] — stabilné naprieč poradím kritérií, async completion aj deduplikáciou. Vedľa toho GraphRAG subgraph (budget share) + citation audit (`auditThesisCitations` cez Semantic Scholar / Crossref, max 20 referencií, ISO 690 issue check s potlačením false positives).
4. **Generovanie — dve cesty:**
   - **Agentic (default pre professional mode):** `agentic-review.ts::runAgenticPerCriterionReview` — per-kritérium LLM call s evidenciou, concurrency batche, cache kľúč = `(workspaceId, sourceRevision, criterionId, reviewKind)`; primárky na temperature 0.15, self-critique 0.2.
   - **Monolit:** `review-engine.ts::generateProfessionalReview` — jeden call s celým kontextom; Path A (štandard) keď professional mode nesedí.
5. **Evidence anchoring:** `anchorEvidenceQuotes` + `evidence-validator.ts` — každý quote z findingu sa overuje: `[cN]` kotva musí existovať v retrieved chunk mape, quote (alebo ≥60-znakový prefix) musí byť v chunku **po whitespace normalizácii**; verbatim match = `verified-exact`, normalized = `verified-normalized`, inak `unverified` + confidence 0.45. Stale sourceRevision → flag. Epistemic statuses (REVIEWER_JUDGMENT vs GROUNDED…) sa kalibrujú v `validateAndCalibrateFindings`.
6. **Adjudikácia (`review-adjudicator.ts::adjudicateFindings`):** deterministické pravidlá — critical bez evidence → downgrade na major; confidence < 0.3 bez evidence → remove; critic downgrade odmietnutý, ak finding má verified-exact quote a námietka je plytká (< 25 znakov); kritická numerická diskrepancia → eskalácia severity. Akcie: ACCEPT/DOWNGRADE/UPGRADE/REMOVE/REQUIRES_HUMAN_VERIFICATION. *(Deterministické if/else — nie Bayesian LLR, aj keď stará dokumentácia tvrdila opak.)*
7. **Kompozícia:** `review-composer.ts` — 14-sekčný formálny posudok, epistemic badges, ECTS grading (pre thesis; pre papers len publication verdicts, ECTS polia sa deterministicky mažú), AI disclosure. Skóre: `computeScoreFromFindings` (critical −20, major −8, minor −2, suggestion −0.5) → ECTS range. Doctoral opponent musí mať záverok; keď ho model negeneroval, pripojí sa zákonná veta + „pending" (nikdy nevyzerá ako AI verdikt).
8. **Persist:** `ThesisReview` row + `persistFindingsEvidence` — findings → `Evidence` rows (verbatim quotes, page anchors, chunkId).

---

## 6. Konfigurácia (env) a defaults

| Premenná | Default | Význam |
|---|---|---|
| `EMBEDDING_MODEL` | `Xenova/paraphrase-multilingual-MiniLM-L12-v2` | embedding model (registry) |
| `EMBEDDING_BACKEND` | `xenova-v2` | xenova-v2 / hf-v3 / openai-compatible / reference-ngram |
| `EMBEDDING_DIM` | podľa modelu | šírka vektora (musí sedieť na stĺpec + manifest) |
| `RERANKER_MODEL` / `RERANKER_ENABLED` | `Xenova/bge-reranker-v2-m3` / on | cross-encoder reranker |
| `RETRIEVAL_PIPELINE` | multi-source | `legacy` vracia starý single-statement hybrid |
| `GRAPH_RAG_ENABLED` | true | graph extrakcia pri ingeste |
| `RAG_EXACT_FALLBACK` | true | exact-scan doplnenie pri málo riadkoch |
| `DENSE_RETRIEVAL_ENABLED` | true | vypína dense leg |
| `AI_AGENTIC_REVIEW` | true | agentic per-criterion cesta |

Kľúčové konštanty: `topK=8`, `maxContextChars=24 000`, fusion pool 200, RRF k=60, MMR λ=0.8 (multi-source) / 0.7 (legacy), rerank pool `max(3×topK, 12)`, section boost ×1.15, dense per-variant `max(10, 1.5×limit)`, `efSearchFor = clamp(100, 1000, 20×limit)`, chunker-v2 child/parent 256/1024 tokenov (prefix rezerva 96), THESIS_CONTEXT_BUDGETS: fullGeneration = `AI_CONTEXT_BUDGET_CHARS` env alebo 120 000 znakov, perCriterion 9 000 znakov.

---

## 7. Degradácie a failure politika (filozofia kódu)

- Retrieval **nikdy nehodí** výnimku pre degradovanú leg — menej kandidátov + `trace.degraded[]`; „retrieval padol → žiadne findings" je najhorší možný výsledok, takže sa nedeje.
- Reranker zlyhá → fused order, priznané v trace. Embedding zlyhá → lexical/metadata/citation bežia ďalej. HyDE zlyhá → nič.
- HNSW ef_search a iterative_scan cez `SET LOCAL` v transakcii — PgBouncer-safe, nič neleakuje medzi požiadavkami.
- Approximate-match threshold ≥ 60 znakov, confidence 0.45 — zámerné zdvihnutie z 35/0.7 (menej false positives pri citátoch).
- Page numbers sa nikdy nesynthetizujú; chýbajú → NULL.
- `vectorStatus` warning v UI pred generovaním review (index sa buduje / failol / pending).

---

## 8. Čo NIE JE zapojené / čo NIE JE pravda (dôležité pre rozšírenie!)

Overené grepom na produčnej cesti (vylúčené testy a eval harness):

1. **`graph-drift-retrieval.ts::retrieveDriftGraphContext`** („DRIFT-style" iteratívna expanzia) — **nie je volaná z žiadneho produkčného kódu**. Existuje ako modul + testy. Je to bounded BFS frontier (maxIterations 3, maxNodes 40, maxTimeMs 500, marginal gain < 0.05), nie Microsoft GraphRAG DRIFT (žiadne follow-up queries, žiadne community guidance). Ak ju chcete zapojiť, miesto je graph leg v `retrievers/generators.ts`.
2. **`claim-verifier.ts::verifyClaim`, `numerical-verifier.ts`, `equation-consistency.ts`, `scholarly-comparator.ts::compareClaimToPaper`** — deterministické verifikátory **sú reálne implementované, ale ich volanie v review flow nie je zapojené** — používajú ich (momentálne simulované) eval harnessy a claim-flow. Numerical/equation verifikácia je regex/range (žiadny AST/symbolická matematika) — `NUMERICAL_PARAM_RE` zachytáva p-value/accuracy/F1/AUC/energie s jednotkami, tolerancia 1 %, severity > 10 % = critical. Scholarly comparator robí titul/DOI/rok matching → `DIRECT_PRIOR_ART…POSTDATED` + `isPriorArt`.
3. **Adjudikátor je deterministický if/else** ( časť 5.6), nie Bayesian log-likelihood-ratio model, ako tvrdil starý monstergraf (§2.4/A.3).
4. **Eval/benchmark vrstva (`lib/ai/eval/*`) je simulovaná** — `competitive-benchmark.ts`/`ablation-runner.ts` (default path)/`unified-eval-runner.ts` generujú čísla z pravdepodobnostného modelu, nie z meraní. Produkčný retrieval kód je reálny; jeho *čísla výkonnosti* zatiaľ nikto nenameralal. Detaily: `docs/benchmarks/EMPIRICAL_METHODOLOGY.md`.
5. **Default embedding je 384-d multilingual MiniLM-L12** — napriek tomu, čo tvrdili staré benchmark tabuľky (BGE-M3). Model je vymeniteľný cez registry, ale stĺpec `vector(384)` + manifest musia súhlasiť (resize + reindex).

---

## 9. Kam rozširovať (prirodzené extension points)

1. **Zapojiť verifikátory do review flow** — `verifyClaim`/`verifyNumericalConsistency`/`checkEquationSanity` nad findingmi + `Evidence` rowmi pred adjudikáciou (review-engine ich má pripravené pole `numericalDiscrepancies` v `AdjudicationInput`, ale nič ho napĺňa).
2. **Zapojiť DRIFT expanziu** do graph legu ( časť 8.1) alebo ju nahradiť community-guided iteráciou.
3. **Upgrade embedding modelu** cez registry (BGE-M3 1024-d) — vyžaduje column resize + reindex + manifest bump.
4. **Skutočný AST/symbolický verifier** rovníc (momentálne regex) — napr. cez sympy-style parséř nad LaTeX chunkmi.
5. **Reálny benchmark** — `docs/benchmarks/EMPIRICAL_METHODOLOGY.md` §5 (corpus, qrels, reálne behy baselín); eval API (`ablation` konfig v `retrieveEvidence`) je na to pripravené.
6. **Reranker** — model-registry už podporuje výmenu; chýba reálne premeranie na workload.

## 10. Kľúčové súbory

| Súbor | Role |
|---|---|
| `lib/ai/hybrid-retrieval.ts` | multi-source pipeline orchestrator (9 krokov + trace) |
| `lib/ai/retrievers/generators.ts` | 7 kandidátových generátorov |
| `lib/ai/fusion.ts` | weighted RRF + atribúcia |
| `lib/ai/retrieval-ranking.ts` | MMR, rerank, novelty drift |
| `lib/ai/parent-context.ts` | expanzia, roles, buildEvidenceContext, counter-evidence |
| `lib/ai/query-router.ts` + `criterion-profiles.ts` | routing + sufficiency pravidlá |
| `lib/ai/vector-rag.ts` | legacy cesta + query transformy + retrieveForCriterion |
| `lib/ai/retrieval-sql.ts` | zdieľané SQL fragmenty, ef_search, FTS builder |
| `lib/ai/model-registry.ts` | embeddingy/reranker, backendy, health |
| `lib/ai/chunker-v2.ts` / `document-chunker.ts` / `chunk-context.ts` / `chunking-config.ts` | chunking |
| `lib/ai/review-pipeline.ts` | orchestrácia review (stages, persist) |
| `lib/ai/review-engine.ts` | monolit review, anchoring, adjudikácia call |
| `lib/ai/agentic-review.ts` | per-criterion agentic cesta |
| `lib/ai/evidence-validator.ts` | quote anchoring/verifikácia |
| `lib/ai/review-adjudicator.ts` | deterministická adjudikácia |
| `lib/ai/rubric-engine.ts` | sk-academic-v1 (12 kritérií) |
| `lib/ai/numerical-verifier.ts` / `equation-consistency.ts` / `claim-verifier.ts` / `scholarly-comparator.ts` | deterministické verifikátory (nezapojené vo flow) |
| `lib/ai/graph-rag.ts` / `graph-extractor.ts` / `graph-communities.ts` / `graph-drift-retrieval.ts` | GraphRAG vrstva |
