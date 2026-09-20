# Implementation Plan pre Coding Agenta: PosterApp Eval SOTA Fixes

Tento dokument je inštruktážny plán pre autonómneho coding agenta, ktorý má za úlohu opraviť 6 identifikovaných vedeckých chýb v evaluácii PosterApp a nasadiť najlepšie dostupné modely.

## Ciele
1. Dosiahnuť 100% metodologickú čistotu (žiadne aproximácie a hardcodované hodnoty).
2. Maximalizovať využitie lokálnej 24GB RTX 3090.
3. Použiť najlepší embedder z AliProxy a Qwen Reranker.
4. Vyriešiť `Unauthorized` HF token error.

---

## Fáza 1: AliProxy Embedder & Dynamický HyDE

**Súbory na úpravu:** `lib/ai/eval/real-corpus-benchmark.ts`, `lib/ai/model-registry.ts`

1. **Best AliProxy Embedder:**
   - Zistili sme, že na `http://127.0.0.1:8080/v1/embeddings` funguje `text-embedding-v3` a `qwen3.7-text-embedding` (oba vracajú 1024-dim, status 200).
   - Agent prepíše baseline `bge-m3` na skutočný `text-embedding-v3` (príp. `qwen3.7-text-embedding`) a adekvátne premenuje architektúru na `ali-text-embedding-1024d`.
2. **Dynamický HyDE cez qwen-flash:**
   - Odstrániť 13 hardcodovaných `if (q.includes(...))` podmienok vo funkcii `generateBenchmarkHyDE`.
   - Nahradiť to skutočným API volaním na AliProxy `POST /v1/chat/completions` s modelom `qwen-flash`.
   - **Performance:** Implementovať persistentný JSON cache do `artifacts/eval/real/hyde-cache.json`. Ak query v cache existuje, zober ju; ak nie, volaj `qwen-flash` a ulož.

---

## Fáza 2: Qwen Reranker na lokálnej GPU & HF Token

**Súbory na úpravu:** `lib/ai/eval/qwen-reranker-server.py`, `lib/ai/model-registry.ts`

Užívateľ má 24GB GPU a chce Qwen reranker, no padá to na HF certifikácii (`Unauthorized access to file`).

1. **HuggingFace Token Fix:**
   - Agent upraví TypeScript wrapper (spawn proces), aby do prostredia odovzdal `HF_TOKEN` (načítaný z `.env.local` alebo procesného env). Užívateľov token bol odovzdaný v kontexte.
2. **Výber Qwen Reranker modelu:**
   - Predvolene použiť model `Qwen/Qwen3-Reranker-0.6B` (alebo vyššiu Qwen verziu, ak je k dispozícii). Lokálny reranker bude bežať cez `transformers` knižnicu na `cuda:0`.
3. **Reranker Batching Optimizácia:**
   - Prepísať Python skript, aby nerobil slučku po jednotlivých dokumentoch.
   - Pripraviť zoznam dvojíc `[[query, doc1], [query, doc2], ...]` a poslať to do modelu v jednom batchi (alebo v minibatches po 32/64). Na 24GB VRAM to prejde bleskovo a skreše latenciu z ~5000ms na zlomok sekundy.
   - Zvýšiť candidate pool size pred rerankerom z 30 na 100.

---

## Fáza 3: Vedecká integrita baseline-ov

**Súbory na úpravu:** `lib/ai/eval/real-corpus-benchmark.ts`

1. **Skutočný Okapi BM25:**
   - Zbaviť sa `ts_rank` z PostgreSQL (čo je obyčajné TF bez IDF normalizácie).
   - Napísať in-memory `OkapiBM25Index` triedu (corpus má len 117 chunkov). Trieda pri inicializácii spočíta dokumentové frekvencie (DF), a pri query použije štandardný Robertson vzorec (`k1=1.5`, `b=0.75`).
2. **Honest Taxonomy (Premenovanie architekúr):**
   - `bge-m3` -> `ali-1024d-dense`
   - `colbert` -> `maxsim-sentence-late-interaction`
3. **Nový kontrolný experiment (Control Row):**
   - Pridať 7. architektúru do evaluácie: `dense+reranker` (čisto dense vyhľadávanie + Qwen reranker na top 100).
   - Týmto sa dokáže, aký prínos má komplexná PosterApp RRF fúzia (BM25 + Dense + HyDE) oproti bežnému dvojkrokovému (Dense -> Reranker) pipeline-u.

---

## Fáza 4: Dokumentácia vonkajšej validity
- Keďže sa nedá algoritmicky vygenerovať druhý nezávislý ľudský anotátor, ani instantne nafúknuť korpus zo 117 na 10,000 dokumentov, agent do výstupného Markdown reportu fixne pridá sekciu **"Methodological Limitations"**, kde tieto veci (1 anotátor, úzky doménový set) jasne prizná, aby výsledky neboli napadnuteľné z hľadiska claimovania "SOTA".
