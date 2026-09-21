# MISIA v2: Hĺbkový technický audit PosterApp
*(novelizovaná verzia pôvodného promptu — pridané: dôkazová disciplína o úrovni vyššie, anti-duplikačné pravidlo voči existujúcim auditom, environment-blocker protokol, záložné verifikačné stratégie, povinná verifikačná fáza, registry-cross-check matica. Pôvodné štruktúry a pokrytie zostávajú.)*

Vystupuj ako seniorný full-stack architekt, expert na TypeScript/Next.js, PostgreSQL, Prisma, akademické publikačné systémy a LaTeX. Máš prístup k celému repozitáru PosterApp a môžeš spúšťať príkazy.

Tvojou úlohou je vykonať systematickú, **exekučne podloženú** analýzu:

1. architektúry aplikácie,
2. doménovej a aplikačnej logiky,
3. dátového modelu a perzistencie,
4. generovania a kompilácie LaTeXu,
5. podpory posterov, prezentácií, článkov a posudkov,
6. validačných a bezpečnostných mechanizmov,
7. technického dlhu, chýb a rizík,
8. možností ďalšieho rozvoja.

---

## 0. PRAVIDLÁ DÔKAZNEJ DISCIPLÍNY (nové, najvyššia priorita)

1. **Kód je jediný zdroj pravdy.** Komentáre, README, docs a staré audity môžu klamat. Ak dokumentácia odporuje implementácii, rozpor explicitne uveď.
2. **Každý nález označ tagom dôkazu:**
   - `▶ EXEC` — reprodukované spustením kódu v sandboxe (uvedieš príkaz a verbatim výstup),
   - `✎ STATIC` — odvodené čítaním kódu s citáciou `súbor:riadok`,
   - `? UNVERIFIED` — nedá sa v tomto prostredí overiť (povieš prečo a čo by ho overilo).
3. **Žiadne tvrdenie „funguje/nefunguje" iba podľa názvu súboru.** Pre každé kritické správanie napíš minimálny repro cez `pnpm exec tsx` alebo existujúci test.
4. **Anti-duplikácia:** Pred tvorbou nálezov si prečítaj `docs/audit/*.md`. Pre každý starý nález udeľ status: `STILL-OPEN` / `FIXED` (s dôkazom) / `REGRESSED`. Nové nálezy musia byť nové — nehlaš znovu opravené problémy.
5. **Nie fatálne ≠ správne.** Rozlišuj tri triedy výsledku: (a) compile-fatal, (b) compile-ok ale vizuálne/sémanticky zlé, (c) kozmetika.
6. **Nevypisuj tajomstvá.**connection stringy, kľúče, obsah `.env*`.
7. **Žiadne deštruktívne DB operácie.**
8. **Environment blocker protokol:** Keď nástroj chýba (napr. pdflatex, Prisma engine), najprv dokumentuj presne čo je blokované a kde (doména/príkaz/chyba), potom použij **náhradnú stratégiu** zo sekcie 4.4 — blokér nikdy neznamená „skip analýzy", len „iná forma dôkazu".

---

## 1. POVINNÁ VERIFIKAČNÁ FÁZA (spusti pred čítaním kódu)

V tejto sekvencii zaznamenaj verbatim výstupy do správy (§ Test & Compilation Results):

```bash
git log --oneline -5 && git status --short
pnpm install --frozen-lockfile
pnpm exec vitest run            # celá suita; zaznamenaj pass/fail + dôvody pádov
pnpm typecheck                  # zaznamenaj chyby a klasifikuj: produkt vs env
pnpm lint
```

Potom zisti dostupnosť toolchainu a výsledok zapíš (neodhaduj):

```bash
which pdflatex xelatex bibtex latexmk docker
```

---

## 2. MAPA ARCHITEKTÚRY

Identifikuj a podlož cestami k súborom: verziu Next.js a routing, React architektúru, správu stavu (klient!), DB vrstvu, authN/authZ, file storage, AI/RAG integrácie, background joby, LaTeX toolchain, test tooling, build/deploy.

Preskúmaj minimálne: `package.json`, `tsconfig.json`, `next.config.*`, `server.ts`, `app/`, `components/`, `hooks/`, `lib/`, `prisma/`, `scripts/`, `public/latex-styles/`, Docker/deploy súbory.

Vytvor vrstvový diagram UI → state → API → domain services → Prisma/FS/external → LaTeX → compiler → PDF; ku každej vrstve zodpovednosti a vlastnícke súbory.

---

## 3. DOMÉNOVÁ LOGIKA

### 3.1 Hlavné scenáre end-to-end
Zrekonštruuj krok po kroku (UI komponenta → store → API → zod schéma → DB operácie → modely → chybové stavy → race conditions → autorizačné kontroly):

vytvorenie a načítanie workspace · save celého grafu · pridanie/prepnutie outputu · CRUD karty · priradenie assetu · AI generate/autofill · layout validácia · LaTeX generovanie · kompilácia a cache · export ZIP · thesis review workflow · RAG ingest a retrieval.

### 3.2 Multi-output invarianty — povinne exekučne over tieto otázky
- Môže mať workspace **nula alebo dva aktívne** outputy? Je invariant chránený DB, app kódom, alebo nijako? Čo sa stane pri kompilácii v týchto stavoch?
- Ktoré polia output dedí z workspace a v akom poradí? (`resolveOutputMetadata`)
- Čo sa deje pri mazaní outputu/karty/assetu (FK, cascade, asset assignedCardId)?
- Môžu karty ukazovať na neexistujúce assety? Čo potom (UI vs `\includegraphics`)?
- Sú JSON stĺpce (`Card.table/figures/grounding`, `ThesisReview.sections`, `Output.sourceIds`) **runtime validované**? Konstantou alebo schémou?
- Sú TypeScript typy, Prisma modely a zod payloady zhodné 1:1? Vyrob drift-tabuľku.

### 3.3 Registry cross-check matica (nové)
Pre patterns a templates **porovnaj všetky štyri zdroje pravdy** a označ každý rozdiel:
`lib/output-types.ts` (registry) ↔ `lib/poster-types.ts` (typy) ↔ zod schémy ↔ AI prompty ↔ UI formuláre ↔ jednotlivé generátory (čo reálne renderujú).
Explicitne: či každý pattern z defaultných štruktúr existuje v `PATTERNS_FOR_TYPE` a či ho generátor daného typu podporuje.

### 3.4 Layout engine
Analyzuj `estimateHeight*`, `columnBudgetFor`, `suggestReductions`: determinizmus, modelovanie tabuliek/figúr/aspect-ratio/math, per-template kalibrácia, možnosť „valid ale pretečené". Navrhni compile-fit spätnú väzbu (meranie bounding boxov z PDF + iteratívna korekcia rozpočtov).

---

## 4. LATEX ENGINE (ťažisko auditu)

### 4.1 Matica šablón
Pre každý template (7 poster + 5 slides + 17 paper + 6 posudok): document class, orientácia, stĺpce, externé balíky, vendrované štýly z `public/latex-styles/`, farby, podpora figures/tables, `figure*` vs single-column, bibliographystyle (deklarovaný vs venue-očakávaný), amsmath prítomnosť (kvôli `\begin{equation*}`).

### 4.2 Parser — povinné behaviorálne testy
Napíš a spusti harness cez `tsx` minimálne na tieto vstupy a verbatim cituj výstupy:
- backslash v texte, `%`, `_`, `&`, `#`, `{`, `}`, `~`, `^`, `$5 and $10`,
- inline/display matematika vrátane `\begin{aligned}` a dlhých rovníc (`\fitmath`),
- surové LaTeX príkazy mimo math (majú sa escapovať?) a **vnútri** math (blocklist),
- markdown linky s `_%&#` v URL, DOI linky,
- `[@pandoc]` citácie, `\cite{...}` passthrough, neexistujúce bib kľúče,
- slovenská/česká/nemecká/poľská/maďarská diakritika,
- Unicode: grécke písmená, ‑‑, —, „“, ≤∞∑∫∂∇√ℏ⊕≪, emoji,
- vnorené a numerované zoznamy, `<`/`>`, HTML tagy.

Pre každý vstup klasifikuj: compile-fatal / vizuálne zlý / OK.

### 4.3 Kompilačná pipeline
Zdokumentuj staging, kopírovanie štýlov/assetov/logo, `references.bib` zdroj (`resolveBibSource`), počet pdflatex behov, bibtex kroky, timeouty, log sanitizáciu, cleanup, **cache kľúč a čo všetko nepokrýva**, mutex, paralelné kompilácie, Tier fallback docker→local. Samostatná bezpečnostná analýza: shell-escape, kpathsea env, shell injection cez buildCmd, path traversal, škodlivé `.sty`, veľkostné limity.

### 4.4 Kompilačná matica — so záložnými stratégiami
**Primárne (ak pdflatex existuje):** pre každé `outputType × template × pattern` vygeneruj reprezentatívny dokument (diakritika, %_&#, inline+display math, dlhá rovnica, 2 figúry, široká tabuľka, citácie, dlhý názov, asset s medzerou, chýbajúci asset, neplatný cite key) a skompiluj; report matica `Template × Pattern → Generated/Compiled/Warnings/Error-class`.

**Fallback A (bez pdflatexu):** štrukturálny harness — ballance `{ }`, begin/end stack, prítomnosť `\documentclass/\begin{document}/\end{document}`, feature→package mapa (equation*→amsmath, resizebox→graphicx, `figure*`→twocolumn class), cite↔bib key zhoda, path existence voči staging pravidlám. Každý výskyt explicitne taguj `✎ STATIC` a uveď, čím by sa overil (CI job s TeX Live).

**Fallback B (template-level):** z vendrovaných `.cls/.sty` vygrepuj `\RequirePackage` línie a zlucky do package matice.

### 4.5 Bibliografia
Over zhodu `\cite{key}` ↔ kľúčov v `bibContent`/`references` karte, správanie `\nocite`, duplicit, prázdneho bib, venue bibstyle konformitu (plain vs apsrev/elsarticle-num/ACM/acl_natbib/aaai/JHEP/woc/iopart/icml/neurips).

---

## 5. RAG, EVIDENCE A THESIS REVIEW

- Ingest→chunk→embed→retrieve→evidence→card/review tok; verbatim quote validácia, offsety, invalidácia po reindexe (`indexVersion`, contentHash), `sourceRevision` na review.
- Thesis review: 12 kritérií vynútenie, ECTS, suggested vs final vs `confirmedAt`, draft/final, defense questions, evidence väzba, 6 jazykov exportu, de/pl/hu fallbacky, auditovanie zmien, či môže AI prepísať human-final.
- **Povinne:** vygeneruj posudok (a) z `ThesisReview` záznamu v produkčnom tvare, (b) z Output+kariet, a porovnaj obsah — rozdiely klasifikuj ako nález.

---

## 6. DATABÁZA, API A BEZPEČNOSŤ

- Prisma audit: indexy (chýbajúce/redundantné), unique constraints, FK on-delete, JSON polia, vector index, migrácie, atomickosť transakcií, orphan riziká, back-compat.
- API inventár po doménach (workspaces, cards, assets, compile, export, chat/AI, RAG, thesis-review, history/snapshoty, members, agent API/MCP): metóda, auth, ownership, zod, transakčnosť, error handling, statusy, rate limits.
- Hľadaj: IDOR, cross-workspace leak, mass assignment, nevalidované JSON, path traversal, SSRF, prompt injection, upload zneužitie, DoS cez kompiláciu, race conditions, stratu dát pri concurrent save.

---

## 7. TESTY A TECHNICKÝ DLH

- Zmapuj coverage (unit/integration/API/E2E/LaTeX/security/RAG eval). Identifikuj testy závislé na prostredí (live DB, engine) a či patria do default lane.
- Technický dlh: duplicity medzi generátormi, `any`, drift blocklistov, dead code, legacy fallbacky, scratch skripty v `scripts/` a koreňových `test_*.tex` artefaktoch, tiché fallbacky.
- Pre každý nález: severity (Critical/High/Medium/Low), effort (S/M/L/XL), repro, dopad, oprava.

---

## 8. POVINNÝ VÝSTUP

Správa v tomto poradí (slovensky; techniky nechaj EN):

1. **Executive Summary** — max 15 bodov; vzťah k predchádzajúcim auditom (čo je opravené/otvorené).
2. **Architecture Map** — vrstvy + mermaid + vlastníctvo súborov.
3. **Domain Logic** — entity tabuľka (Zdroj pravdy/Validácia/Perzistencia/Riziká), invarianty, registry cross-check.
4. **LaTeX Feature Matrix** — kompletná, vrátane package/bibstyle amsmath stĺpcov.
5. **End-to-End LaTeX Pipeline** — s číslami riadkov a behaviorálnymi tabuľkami z 4.2.
6. **Findings** — ID | Severity | Oblasť | Súbor:riadok | Dôkaz(▶/✎/?) | Problém | Dopad | Oprava | Effort. Žiadny nález bez dôkazového tagu.
7. **Security Assessment** — authorization, filesystem, uploads, LaTeX compilation, AI/RAG, secrets, DB.
8. **Test & Compilation Results** — spustené príkazy, verbatim výsledky, klasifikácia chýb (produkt vs env), environment blockerspresne pomenované.
9. **Prioritized Roadmap** — P0 (hotfix do 3 dní), 30-dňový, 90-dňový, dlhodobý; acceptance criteria per položka.
10. **Final Verdict** — 1–10 pre: architektúru, dátový model, bezpečnosť, testovateľnosť, LaTeX spoľahlivosť, vizuálnu kvalitu, vedeckú reprodukovateľnosť, produkčnú pripravenosť; každé zdôvodni jednou vetou.

---

## 9. IMPLEMENTAČNÁ FÁZA (až po auditu)

Najprv navrhni implementačné balíky (LaTeX correctness; template compatibility; layout engine; DB integrita; API authz; RAG evidence integrity; thesis-review correctness; compilation-matrix CI; visual regression; refaktoring).
Per balík: cieľ, súbory, migračné riziko, test plán, acceptance criteria, odhad. Potom sa opýtaj, ktorý balík implementovať prvý. Žiadne produkčné zmeny pred schválením.

---

### Dodatok pre agenta s príkazovým prístupom
Počas analýzy spúšťaj read-only a bezpečné diagnostické príkazy, testy, lint, typecheck a — ak je toolchain dostupný — kompiláciu. Nemeň produkčnú databázu. Všetky environmentálne obmedzenia explicitne zaznamenaj; chýbajúci systémový balík nie je aplikačná chyba, ale musí byť uvedený v §8 správy spolu s náhradnou verifikáciou.
