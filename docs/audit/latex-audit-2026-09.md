# PosterApp — LaTeX Domain Audit (Generation · Validation · Compilation · Export)

**Date:** 2026-09-03 · **Scope:** local working tree on `arena/01a06941-posterapp`, branched from `main@5ea5c2c` · **Mode:** read-first, evidence-based, then Tier A execution
**Domain:** `lib/latex/**` + `public/latex-styles/**` only. Anything outside the LaTeX pipeline is logged in the "Noticed, out of scope" appendix and left alone.

**Baseline test state at start of pass:** `vitest run` → 110 passed / 5 failed suites, 891 tests passed. The 5 failures (`__tests__/api/thesis-review-dedup`, `lib/__tests__/document-chunker`, `structure-chunker`, `vector-rag-pipeline`, `vector-rag`) all fail identically with `Cannot find module '.prisma/client/index'` — the Prisma client cannot be generated in this sandbox (binary download blocked). Pre-existing, environment-only, unrelated to LaTeX.

---

## 0. Files read this pass

| File | Lines read | Why |
|---|---|---|
| `lib/latex/parser.ts` | 1–172 (full) | Central escaper/markdown renderer for poster/slides/paper |
| `lib/latex/generator-thesis-review.ts` | 1–310 (full) | Second, drifted escaper; thesis report assembly |
| `lib/latex/generator-poster.ts` | 1–173 (full) | Table/figure emission, block layout |
| `lib/latex/generator-paper.ts` | 1–50, grep of full | Third table/figure impl + local `cleanCaption` |
| `lib/latex/generator-slides.ts` | grep of full | Fourth table/figure impl |
| `lib/latex/generator.ts` | 1–88 (full) | Factory, `detectDocumentLanguage`, `ensureEncodingPreamble` |
| `lib/latex/validation.ts` | 1–171 (full) | Blocklist + `validateCard` |
| `lib/latex/layout.ts` | 1–22 (full) | `estimateHeight`, `COLUMN_BUDGET` |
| `lib/latex/helpers.ts` | 1–43 (full) | `normalizeLatexPath`, canonical `cleanCaption` |
| `lib/latex/bib-source.ts` | 1–16 (full) | `resolveBibSource` |
| `lib/latex/remote-assets.ts` | 1–150 (full) | Download + rewrite |
| `lib/latex/compiler-runner.ts` | 1–67 (full) | Sandbox policy |
| `lib/latex/templates.ts` | grep (exports, preamble lines) | Template inventory / geometry |
| `lib/latex/templates-thesis.ts` | 1–40 | Thesis preamble (`inputenc`/`fontenc`/babel) |
| `lib/latex/types.ts` | full | Generator interface |
| `lib/latex/__tests__/*.test.ts` | all 10 files (parser, thesis-review, validation read in full) | Coverage baseline |
| `__tests__/latex/figures-sparse.test.ts`, `tests/api/latex-resilience.spec.ts` | full | Test-tree layering |
| `app/api/workspaces/[id]/compile/route.ts`, `export/route.ts`, `autofix-compile/route.ts`, `thesis-review/[reviewId]/export/route.ts` | traced call sites | Touchpoints |

Two behaviours were **executed** in a scratch vitest file (deleted afterwards) rather than reasoned about: `parseMarkdownToLatex` on URLs with specials, and `generator-thesis-review.escapeLatex` on Greek/dash/smart-quote/markdown input. Outputs are quoted verbatim below.

---

## 1. Executive summary

The LaTeX pipeline is structurally sound where it matters most for safety: compilation runs in a no-network, cap-dropped, read-only Docker container with `openin_any=p openout_any=p shell_escape=f` (`compiler-runner.ts:37-67`), paths are stripped rather than escaped before hitting `\includegraphics` (`helpers.ts:30-35`), remote figures are SSRF-checked, size-capped and content-sniffed (`remote-assets.ts:58-104`), and math regions are scanned for dangerous primitives before being restored unescaped (`parser.ts:34-60`). That is a better foundation than most self-hosted TeX-generating apps have.

The weakness is **drift between four generators and two escapers**. The single most consequential finding is that **thesis-review — the one output type whose body text is entirely LLM-generated academic prose — is the only one that does not go through `parser.ts`**. Its private `escapeLatex` (`generator-thesis-review.ts:20-52`) handles the ASCII special set and nothing else. Executed here:

```
thesisEscape("χ² test with α=0.05 — “quoted” and **bold**")
  → 'χ² test with α=0.05 — “quoted” and **bold**'   (unchanged)
```

Under this document's own preamble (`templates-thesis.ts:23-24`, `inputenc[utf8]` + `fontenc[T1]`, no `textcomp`, no `newunicodechar`), `χ`, `²`, `α`, `—` and the curly quotes are **fatal** `Package inputenc Error: Unicode character ... not set up for use with LaTeX` — i.e. a reviewer whose AI wrote "χ² = 4.2 (α = 0.05)" gets a failed PDF export, not a degraded one. The same text through `parser.ts` yields `$\chi$$^2$ test with $\alpha$=0.05 --- ``quoted'' and \textbf{bold}`. This is Tier A.

Second Tier A item: **markdown link URLs are escaped before they are parsed**. `escapeLatex` runs over the whole string at `parser.ts:133`, the link regex at `:138`. Executed:

```
parseMarkdownToLatex("See [Paper](https://ex.com/a_b?x=1&y=2#sec%20a)")
  → 'See \href{https://ex.com/a\_b?x=1\&y=2\#sec\%20a}{Paper}'
```

`\href`'s URL argument is read with catcodes mostly frozen; the backslashes are literal characters in the emitted URL, so the produced hyperlink points at `https://ex.com/a\_b?x=1\&y=2\#sec\%20a`. Every DOI with an underscore, every UTM-tagged link, every anchor is silently wrong in the PDF. Math and citations are already protected with an extract/restore placeholder pattern (`parser.ts:5-31`, `:62-84`); links simply were never added to it.

Everything else is real but lower-stakes: dead babel entries and an SK-biased tie-break in `detectDocumentLanguage`, a `includes("@")` BibTeX sniff that an email address defeats, serial remote-figure downloads on the compile critical path, one flat `COLUMN_BUDGET = 900` shared by five poster templates with different geometry, and a third copy of `cleanCaption` living privately inside `generator-paper.ts` that has already drifted from the canonical one in `helpers.ts` (it lacks the `typeof` guard and its `Fig` regex requires the dot).

**Seed-verdict table** (which prompt-seeded findings survived contact with the tree):

| Seed | Verdict | Note |
|---|---|---|
| S1 escapers drifted | **Confirmed, promoted to A-01** | Reproduced. Also confirmed: `generator-thesis-review.test.ts` has zero Unicode/markdown cases (read in full — only the ASCII-special case at :8-26). Failure is *fatal*, not silent, given the thesis preamble. |
| S2 link URLs corrupted | **Confirmed, A-02** | Reproduced verbatim above. `parser.test.ts:18-20` only tests a clean URL, as predicted. |
| S3 dead babel + SK tie-break | **Confirmed, B-01** | `detectDocumentLanguage` returns `"sk"|"cs"|"en"` (`generator.ts:42`); `BABEL_BY_LANG` (`:54-61`) has de/pl/hu that no caller can reach — grep shows `ensureEncodingPreamble` is called only from `generateFullTemplate` (`:33`) with that detector's output, and from tests. Tie-break reproduced: shared-only Czech text → `"sk"`. |
| S4 `includes("@")` | **Confirmed, B-02** | Executed: a references card reading `"Contact me@uni.sk for refs"` shadows a valid `workspace.bibContent` and is written as `references.bib`. |
| S5 `hasUnsafeLatex` inconsistency | **Confirmed as described; verdict = document, don't thread** | Grep confirms exactly the call sites the seed lists. `compiler-runner.ts:31-36` already states the sandbox is the boundary. This is UX, and should say so in `validation.ts`. B-03. |
| S6 serial downloads | **Confirmed, B-04** | `remote-assets.ts:118-133`, `for...of` + `await`. 6 figures × up to 10 s = 60 s worst case ahead of a 60 s compile timeout. |
| S7 one budget for all templates | **Confirmed, B-05** | Five poster paths (`minimal`, `gemini`, `tikzposter`, `a0poster`, `atlas` — `generator-poster.ts:137-158`); `gemini` uses `0.31\textwidth` beamerposter columns, `atlas`/`tikzposter` use `\column{0.333}`, `a0poster` uses `multicols{3}` at a different base font size. One constant, five geometries. |
| S8 three test trees | Confirmed, C-01 | Note only. |
| S9 whole-document URL replace | Confirmed, C-02 | Note only. |
| — | **New, not seeded: `cleanCaption` exists twice** | `helpers.ts:37-43` (guarded, `Fig\.?`) vs `generator-paper.ts:8-12` (unguarded, `Fig\.` requires dot). Poster imports the helper; paper shadows it. B-06. |

---

## 2. Tier A — execute this pass

### A-01 · Thesis-review escaping cannot represent the text it is given
**Files:** `lib/latex/generator-thesis-review.ts:20-52` (escaper), `:119-132`, `:135-160`, `:168` (call sites for free text) · `lib/latex/parser.ts:96-127`
**Reproduced:** see §1.
**Failure mode:** fatal compile error on any Greek letter, em dash, smart quote, `≤`, `±`, `→` in an AI-written comment/finding/suggestion/defense question; literal `**` in the PDF; a reviewer's `$x^2$` emitted as `\$x\textasciicircum{}2\$`.
**Decision taken (the prompt asks for one, explicitly):** **split by field role, do not unify into one mode-flagged function.**
- *Free-text fields* — section text, suggestions, defense questions, citation issues, confidential comments, recommendation — route through `parser.ts::parseMarkdownToLatex`. They are prose, they may legitimately contain math and emphasis, and the parser's dangerous-command scan (`parser.ts:36-51`) already makes restored math safe.
- *Structural fields* — student/reviewer/institution/department names, labels, grade, rating symbols, academic year, thesis title — keep the local escaper, because a title containing `*` or `$` is far more likely to be a literal character than markup, and because these land inside `tabularx` cells and `\ratingsymbol{}` arguments where an `itemize` or a display equation would break the layout.
- The local escaper additionally gains the **Unicode map only** (shared from `parser.ts`, exported), so a Greek letter in a *thesis title* also stops being fatal without turning titles into markdown.
This is one behaviour change per field, all justifiable, and it leaves exactly one Unicode table in the codebase.
**Tests first:** add to `lib/latex/__tests__/generator-thesis-review.test.ts` — Greek + superscript in section text, em dash + smart quotes in a suggestion, `**bold**` in confidential comments, `$x^2$` preserved in a defense question, and a title with `α` that must not become an `itemize`.

### A-02 · Markdown link URLs are escaped before extraction
**Files:** `lib/latex/parser.ts:129-146`
**Reproduced:** see §1; also `[X](https://doi.org/10.1_5/a)` → `\href{https://doi.org/10.1\_5/a}{X}`.
**Fix:** apply the pattern the file already uses twice. Add `extractLinks`/`restoreLinks` running *before* `escapeLatex` (alongside `extractMath`/`extractCitations`), storing the raw URL and the *unescaped* link text, then re-inserting `\href{<raw url>}{<escaped text>}` after the markdown pass. Non-`http(s)` targets keep today's behaviour (title only, no href). The URL itself must stay unescaped — that is what `\href` wants — while the link *text* must still be escaped.
**Guard against regression:** the placeholder must not be eaten by the bullet/emphasis passes (use the same `\x00`-delimited form).
**Tests first:** URLs containing `_ & % #`, a DOI, a link inside a bullet list, a link whose text contains `&`, and the existing clean-URL case must still pass byte-for-byte.

---

## 3. Tier B — verified, queued (not executed this pass)

- **B-01 `detectDocumentLanguage` dead entries + SK tie-break** (`generator.ts:42-61`). ✅ **Partly done** (Round 8) — the de/pl/hu babel entries are no longer dead: `posudok-de/pl/hu` reach them through `ReportLanguage`, and `de` was corrected from `german` to `ngerman`. The SK tie-break for shared-only diacritics is **still open** and still needs a product decision. Recommendation: trim `de`/`pl`/`hu` from `BABEL_BY_LANG` **or** extend the detector — but not both half-way. Given no Settings-language path reaches `ensureEncodingPreamble` (verified by grep: only `generateFullTemplate:33`), trimming plus an explicit comment ("poster/slides/paper auto-detect SK/CZ/EN only; other languages fall back to english hyphenation by design") is the honest option, with the de/pl/hu diacritic sets kept in a comment for whoever implements it. Separately, change the shared-only fall-through from `return "sk"` to `return "en"` **only if** product confirms SK is not the house default — the current bias is plausibly deliberate for this app's user base, so this needs a product answer, not a code guess.
- **B-02 `resolveBibSource` `@` sniff** (`bib-source.ts:11`). Replace with `/@[A-Za-z]+\s*\{[^,\s]+\s*,/` (entry type + key + comma). One-line change, needs a test with an email-bearing references card and one with a real `@article{...}`.
- **B-03 Document that `hasUnsafeLatex` is UX, not a security control.** Add a header comment to `validation.ts` mirroring `compiler-runner.ts:31-36`, naming the sandbox as the boundary and stating that the blocklist deliberately runs at authoring/patch time, not on save. Prevents a future "fix" that threads it into `cards/[cardId]` PUT and starts rejecting legitimate `\def`-containing pasted TeX.
- **B-04 Parallelise `materializeRemoteFigures`** (`remote-assets.ts:115-134`). Bounded concurrency (4) over `collectRemoteFigureUrls`, writes still awaited. No change to the returned mapping; the existing `remote-assets.test.ts` should pass unmodified, which is the point.
- **B-05 Template-aware column budget** (`layout.ts:3`). ✅ **Done** (Round 8) — `COLUMN_BUDGET_BY_TEMPLATE` + `columnBudgetFor()`, threaded through `validateCard`, both preview gauges, the inspector and the autofill budget. Constants remain structural estimates, not PDF measurements. Introduce `COLUMN_BUDGET_BY_TEMPLATE` with the current 900 as the default, and let `validateCard` accept an optional template id. Requires threading one argument through `validateCard` call sites in `poster-preview.tsx:678` and `project-slice.ts:434-441`; keep the no-arg signature working so nothing outside the domain breaks. Calibration numbers must come from measured PDFs, not guesses — until someone measures, this is a structure change with the same constant, which is still worth it because it makes the wrongness expressible.
- **B-06 Third `cleanCaption`** (`generator-paper.ts:8-12` shadows `helpers.ts:37-43`). Delete the local copy, import the helper. Behaviour changes slightly for captions written `"Fig 3 – …"` (the helper strips it, the local one doesn't) and for non-string captions (the helper is guarded, the local one throws) — both are improvements, both need a test.

---

## 4. Tier C — roadmap notes

- **C-01 Three test trees.** `lib/latex/__tests__/` (10 unit files), `__tests__/latex/` (1 file, `figures-sparse.test.ts` — pure unit, indistinguishable in kind from its neighbours), `tests/api/latex-resilience.spec.ts` (Playwright `test.describe` but contains no browser usage — it is a unit test wearing a Playwright import). Verdict: **accidental drift, not intentional layering.** Convention going forward: LaTeX unit tests live in `lib/latex/__tests__/`. Do not migrate as part of this pass; move opportunistically when a file is next touched.
- **C-02 `rewriteTexRemoteUrls` is a whole-document `split/join`** (`remote-assets.ts:139-150`). Works because URLs are long and specific, not because it is scoped. If a caption ever legitimately quotes a figure's URL as text, that text silently becomes a local path. Low priority; note the assumption in a comment.
- **C-03 Four table renderers, four figure renderers.** `generator-poster.ts:8-58`, `generator-paper.ts:14-95`, `generator-slides.ts:98-103` (tables) and the slides figure branches. They already disagree: poster wraps tables in `\resizebox` with no float, paper uses `table`/`table*` with `\caption`, slides use `table` + `resizebox` and drop the caption entirely (a slides table caption is silently lost — verify before fixing; it may be deliberate). A shared `renderTable(rows, opts)` / `renderFigures(figs, opts)` in a new `lib/latex/render-blocks.ts`, with per-generator options for float env and caption command, would collapse ~120 duplicated lines. This is the correct long-term home for the A-01/B-06 class of drift.
- **C-04 No compile-log → user-facing diagnostic mapping.** `compiler-runner.ts:8` `safeLog` redacts paths and truncates to 8 kB; nothing translates `! LaTeX Error: File 'x.png' not found` into "figure 2 failed to download". The information is present in the log and the mapping from `remote-assets.ts` is in memory at the same moment.

---

## 5. Genius idea — actionable overflow advice from data already computed

`estimateHeight` (`layout.ts:5-21`) currently collapses a card into one integer and throws away *how it got there*. `validateCard` (`validation.ts:146-158`) then tells the user "Estimated height 1040u exceeds column budget 900u — likely overflow." and stops. The user's only recourse is to delete text at random and re-render.

But the function already computes, separately, every term of that sum: chrome (70), prose (`length/60*14`), per-bullet (10 each), table rows (26 each), figure block (150–260). **Change the return type to a breakdown, keep the scalar as a derived field, and validation can name the cheapest specific edit that closes the gap.**

```
estimateHeight(card) → { total, parts: { chrome, prose, bullets, table, figures } }
```

Then `validateCard` emits, instead of a bare warning:

> Estimated height 1040u exceeds budget 900u by 140u. Options: drop the 3 shortest bullets (−30u), shrink the figure to two-thirds width (−87u), or move 2 table rows to a second card (−52u).

Every number in that sentence is already in the sum. The deltas are exact within the model's own terms, so the advice is self-consistent even where the model is miscalibrated — and it becomes *more* useful, not less, once B-05 gives each template its real budget.

Three things fall out of this almost for free, which is why it is worth doing as a data-shape change rather than a message tweak:

1. **The shrink route stops guessing.** `cards/[cardId]/shrink/route.ts` currently asks the model to "make this shorter". With a breakdown it can be told *"remove 140u; prose is 620u of the 1040u"* — a budget the model can actually target, and a result the server can verify deterministically by re-running `estimateHeight` before accepting the patch. That turns shrink from a hope into a loop with a termination condition.
2. **Auto-balance gets a real objective.** `project-slice.ts:434-441` already computes `remainingBudget` per column. With per-part attribution, a column rebalance can prefer moving *figure-heavy* cards (large, indivisible) and splitting *table-heavy* ones (naturally divisible) instead of treating all cards as fungible blobs.
3. **The estimator becomes calibratable.** Once the parts are named, a single measured PDF per template yields five correction coefficients instead of one opaque constant — and a fixture test can assert that the parts sum to the total, which is the only property of the current heuristic that is actually checkable today.

The bar for this section was "changes how good the output can be". Warning a user about overflow is safety. Telling them *which two bullets to cut* — and then letting the shrink endpoint cut them against a verified budget — is the difference between a linter and an editor.

**Secondary idea, cheaper:** the pipeline knows every `\cite` key it emitted (`extractCiteKeys` fan-in at `generator-poster.ts:102-109`, mirrored in paper and slides) *and* the resolved bib source (`bib-source.ts`). Nothing currently diffs them. A pre-compile check that reports "3 cited keys are missing from references.bib: `smith2020`, …" would catch the single most common cause of a `[?]` in a finished poster, before the compile, using two values that are already sitting in the same request scope.

---

## 6. Noticed, out of scope

- `app/api/workspaces/[id]/thesis-review/[reviewId]/export/route.ts:15` imports `spawn` from `child_process` directly while also importing `runSandboxedLatex` from `compiler-runner`. Whether the raw `spawn` is still used is a compile-orchestration question that touches the route's auth/rate-limit flow; not a LaTeX-generation bug. Flagged, untouched.
- `__tests__/api/thesis-review-dedup.test.ts` and the four vector-RAG suites cannot run without a generated Prisma client. That is an environment/CI concern (AI-layer + tooling), not LaTeX.
- `tests/api/latex-resilience.spec.ts` is a Playwright-imported test with no browser interaction, so it never runs under `vitest` and adds a browser boot under `playwright`. Test-infrastructure, noted in C-01, not fixed.

---

## 7. Dimensions covered

| Dimension | Verified this pass | How |
|---|---|---|
| Escaping correctness (ASCII specials) | ✅ | Both escapers read in full; existing tests re-read |
| Escaping correctness (Unicode) | ✅ | Executed both escapers on Greek/dash/quote input |
| Markdown rendering (bold/italic/code/bullets) | ✅ | Read + executed |
| Markdown links | ✅ | Executed; bug reproduced |
| Math protection & dangerous-command scan | ✅ | Read `parser.ts:34-60`; existing tests cover `\input` in math |
| Citation extraction/restore | ✅ | Read `parser.ts:62-90` |
| Bib source resolution | ✅ | Executed with an email-bearing card |
| Language detection / babel | ✅ | Executed tie-break case; grepped all callers |
| Path normalisation | ✅ | Read `helpers.ts:30-35`; `backslash-path-matrix.test.ts` read |
| Remote asset download (SSRF, size, sniff) | ✅ | Read in full; `remote-assets.test.ts` read |
| Remote asset concurrency | ✅ | Read; latency estimated, **not measured** |
| Compile sandbox policy | ✅ | Read `compiler-runner.ts` in full |
| Validation blocklist coverage & call sites | ✅ | Grepped every call site |
| Layout heuristic accuracy | ⚠️ **Partial** | Structure verified; **no calibration against a real PDF was possible — no `pdflatex` and no Docker image in this sandbox.** B-05's numbers remain unmeasured. |
| Actual `pdflatex` behaviour on unmapped Unicode | ⚠️ **Inferred, not executed** | Conclusion ("fatal under `inputenc[utf8]` without `newunicodechar`/`textcomp`") is from reading `templates-thesis.ts:23-24` and standard `inputenc` semantics; **not empirically confirmed here.** Treat as high-confidence, not measured. |
| `\href` tolerance of `\_` in its URL argument | ⚠️ **Inferred** | Same limitation. The emitted string is confirmed wrong; whether hyperref errors or merely produces a dead link was not executed. Either way it is a defect. |
| Template geometry per poster template | ⚠️ Partial | Preamble column widths read; font sizes and margins not tabulated |
| `public/latex-styles/**` | ❌ Not read | Ran out of budget before the style files; flagged for next pass |
| Export route (`export/route.ts`) end-to-end | ⚠️ Partial | Remote-asset call sites traced (`:120-121`); zip/DOCX branches not read |
| Equation service / registry touchpoints | ❌ Not read | `lib/services/equation-service.ts`, `equation-registry-dialog.tsx` untouched this pass |

---

---

## 8. Round 8 addendum — template expansion (2026-09-04)

Triggered by a review of an external template catalogue (trybibby.com/latex/templates, 1732 entries). Most of that catalogue is not addable: PosterApp is a card→pattern→generator pipeline, not a document gallery, so résumés/invoices/letters would each need a new `OutputType`, generator, pattern set and prompts. Ten venue styles, two poster layouts and three review locales did map cleanly.

**Added:** 10 paper venues — HEP (`elsarticle`, `revtex-aps`, `epj-woc`, `iopart`) and ML/CS (`neurips`, `icml`, `iclr`, `acl`, `cvpr`, `aaai`); 2 poster layouts (`landscape`, `betterposter`); 3 review locales (`posudok-de/pl/hu`). Registry went 20 → 35 templates.

**Two bugs found while doing it** (neither seeded, both pre-existing):

- **R8-1 — single-column paper templates emitted `figure*`/`table*`.** `generator-paper.ts` computed `isTwoColumn = templateId !== "article-single"`, so `springer-llncs`, `jinst-proceedings` and `pos-proceedings` — all single-column classes — produced starred floats. `figure*` is undefined outside a `twocolumn` class, so any wide table or two-figure section in an LLNCS or JINST paper **aborted the compile**. Replaced with an explicit `SINGLE_COLUMN_TEMPLATES` set; regression test asserts the invariant across all 17 paper templates.
- **R8-2 — thesis-review export could disagree with itself.** Both the PDF and `.tex` paths chose a `template` (honouring a `body.template` override) but then passed `review.language` independently, so an override produced a document whose babel and labels disagreed. Both now derive language from the template.

**New guard:** `lib/latex/__tests__/template-registry.test.ts` — every registry entry must produce a brace-balanced document with a *distinct* preamble. A registry entry with no generator branch previously fell through to the default template silently, giving the user the wrong venue format with no error.

**`requiresClass`** was added to `TemplateDef` for styles that are neither in a base TeX Live install nor vendored in `public/latex-styles/`; the template detail panel warns up front rather than letting the user discover it as an opaque failed compile.

**Genius-idea groundwork landed:** `estimateHeightBreakdown()` now returns per-part attribution and `suggestReductions()` converts it into concrete advice, so overflow warnings name the edit ("drop the 3 shortest bullets (−30u)") instead of only stating the problem. The shrink-endpoint half of that idea (§5.1) is still open.

---
*Status: Tier A (A-01, A-02) executed. Round 8 additionally closed B-05 and most of B-01. B-02, B-03, B-04, B-06 and Tier C remain open.*
