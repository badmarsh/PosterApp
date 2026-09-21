# Dodatok k auditu — implementácia opráv (2026-09-21)

Tento dokument uzatvára hlavný audit `docs/audit/deep-analysis-2026-09-21.md`
(prompty v `docs/prompts/`). Obsahuje presný zoznam implementovaných opráv,
charakter každej zmeny a výsledok verifikácie. Produkčný kód sa menil **až po**
dokončení auditného reportu, v súlade s pravidlami zadania.

## 1. Implementované opravy (Findings → Status)

| ID | Nález | Oprava | Stav |
|----|-------|--------|------|
| F-01 | Chained `.replace()` v `escapeLatex` korumpoval výstup backslashu (`\textbackslash\{\}`) | `lib/latex/parser.ts`: single-pass escaper cez `LATEX_SPECIALS` tabuľku | ✅ implementované + testy |
| F-01b | `<`/`>` sa sádzali ako invertované glyphy v T1 | pridané do `LATEX_SPECIALS` (`\textless{}`/`\textgreater{}`) | ✅ implementované + testy |
| F-02 | Unicode chyby (`∑ ∇ ∀ ⟨⟩ ₀ □` …) → tvrdé inputenc faile | rozšírená mapa na base-LaTeX-safe príkazy (žiadny amssymb), strip emoji/piktogramov (U+1F000–1FAFF, dingbaty, VS16, ZWJ) | ✅ implementované + testy |
| F-03 | epj-woc šablóna bez `amsmath` → `\fitmath` zlyhá | `\usepackage{amsmath}` pridaný | ✅ + test |
| F-04 | Kritériá thesis-review: zhodoval sa len deprecated 8-id rubric; produkčný pipeline zapisuje v1 12-id → sekcie sa ticho strácali | `resolveSectionCriterion`: v1 12-id → legacy 8-id → diakritika/case-fold match názvu → humanizovaný fallback (nikdy sa nezahodí) | ✅ + testy (v1, legacy, title-fold, never-drop) |
| F-05 | Seed `ThesisReview.sections` mal legacy tvar `{criterion,title,grade,evidence}` | prepísané na `ThesisSection[]` s v1 criterion id, ratingom A/B, numericScore | ✅ |
| F-06 | Export ZIP bez vendored styles/logot → venue šablóny nekompilovateľné mimo appky | `public/latex-styles/*` (.sty/.cls/.bst/.cfg/.clo) + `public/logos/*` pribalené; README v ZIPE rozšírené | ✅ |
| F-07 | Poster generátor čítal `project.activeOutputId` namiesto `outputConfig.cards` | 2 miesta prepnuté na `outputConfig.cards` (kompilácia neaktívneho outputu dávala PDF aktívneho) | ✅ + test |
| F-08 | `bullets-table` chýbal v PATTERNS_FOR_TYPE.slides; defaultCardCount=12 nekonzistentné | pridaný pattern; 12→7 | ✅ + test |
| F-09a | `\documentclass[option]{webofc}` placeholder v produkčnom .tex | `\documentclass{webofc}` | ✅ + test |
| F-09b | elsarticle abstract renderovaný mimo frontmatter (ako body text) | splice pred `\end{frontmatter}` (ako acm-sigconf) | ✅ + test |
| F-10 | Stale compile cache pri zmene bib/assets; resolveBibSource až za cache check; nedeterministické poradie outputov | fingerprint (sha256 bibContent + assets name:size:mtime) v cache key; resolveBibSource presunutý pred cache check; `orderBy createdAt asc` v GET; `asProject` sortuje outputs | ✅ + testy (match/stale) |
| F-11 | `lmodern` injektovaný do acmart → symbol redefinition errors | `ensureEncodingPreamble` skipne lmodern pri `acmart` dokumente | ✅ + testy |
| F-12 | stats/metric-card height odhad ignoroval table+figures, ktoré pattern vie rendernúť | pridané table (30+riadky·26) a figures (150/190) do breakdownu | ✅ + test |
| F-14 | academicYear label hardkódovaný slovensky `"Dátum / Rok:"` v de/pl/hu exportoch | `academicYearLabel` vo všetkých 6 lokalitách | ✅ + test (de kontrola) |
| F-20 | Seed: rovnica v slide bez `$…$` → renderuje sa ako text | zabalená do `$…$` | ✅ |
| F-22 | `\bibliographystyle{plain}` všade → venue-inkompatibilné biblio | `BIBSTYLE_BY_TEMPLATE` (12 venue štýlov, všetky TexLive/vendored, natbib-safe per-class) | ✅ + parametrizované testy (11 + default) |
| F-24 | >3 metric položky na 0.28 šírke v jednom rade | 0.46 pri layoute po dvoch radoch | ✅ + test |
| F-19 | `scripts/patch_showcase_cards.js` — ESLint parse error (nested template literal) | prepísaný bez vnorených template literálov; guarded no-op (ciele už neexistujú od PR #19) | ✅ eslint clean |
| pgvector-live | Sandbox s Prisma engine stubom → `Prisma.sql is not a function` v 3 testoch | `ctx.skip()` guard uchovávajúci loud-fail dizajn pre reálnu nedostupnosť DB | ✅ 12 skipped (nie failed) |

## 2. Vedome odložené (roadmap, nie bugfix tohto kola)

- **F-13** list-nesting parity (vs nested itemize) — mení togglable AI/dokument štruktúru, potrebný UX sign-off.
- **F-15** DB constraint migration (cascade path) — bez Prisma engine sandboxu nemigrovateľné bezpečne.
- **F-16** dedicated test lanes (unit/integration/live) — infra zmena CI.
- **F-21** `outputId` API param pre compile/pdf/export (potlačí poslednú edge-case F-07 vetvu).
- **F-23** `notes` option pri generovaní — rozsah produktu.
- **F-25** dokumentačný refresh (openapi, deployment runbook cross-linky).

## 3. Verifikácia

- **Vitest (celá suita):** 186/188 súborov pred opravami → po opravách **všetky súbory zelené** (1816 passed, 13 skipped, 0 failed). Nové: `audit-fixes-2026-09.test.ts` 28/28, parser 20/20, compile-cache 4/4.
- **ESLint:** 0 errors (22 warnings `no-explicit-any` — predexistujúci štýl, mimo rozsahu).
- **TypeScript:** 222 predexistujúcich chýb súvisiacich **výhradne zo stubnutým Prisma klientom** v tomto sandboxe (`binaries.prisma.sh` blokované → `prisma generate` nemožný). Nové/chytené chyby v dotknutých súboroch: 0. Environment blocker je zaznamenaný podľa pravidiel zadania, nepripisovaný aplikácii.
- **Prisma generate:** overené ako blokované (TLS disconnect na binaries.prisma.sh) — dôvod, prečo sa nepremigrovali žiadne DB schémy (F-15).

## 4. Regresná kontrola chytených správaní

- §/¶ ostávajú passthrough (inputenc ich sádza korektne) — nuansu F-02 upravenú po kolízii so statutory-clause testmi (`§ 67`).
- Existing `___tests__/api/compile-cache.test.ts` aktualizovaný o `contentHash` + nový test stale-fingerprint → recompile.

_Maintainer pozn.: ak sa F-15 migrácia otvorí, najskôr vygenerovať reálny Prisma klient v CI, potom pridať cascade constraints._
