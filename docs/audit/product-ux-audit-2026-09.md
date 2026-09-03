# PosterApp — Product & UX Audit (read-only)

**Scope:** local tree of `main` after PR #2 (699ccafd).

> **Status (Round 5):** all findings F-01…F-22 have been addressed on branch `arena/01a0685a-posterapp`; see `CHANGELOG.md → Product & UX (Round 5)`. F-23 (file splitting) and F-24 (informational) remain as roadmap items. The text below is the original audit and is kept unchanged as the evidence record.
**Target user:** SK/CZ/EN PhD student or supervisor. **Method:** static reading of components, stores, API routes, generators; no live run (Prisma engine / pdflatex / MinerU unavailable in the sandbox).

---

## 1. Executive summary

**Product identity.** PosterApp is three products in one shell: (a) a LaTeX poster/slides/paper builder fed by PDF ingestion + AI card auto-fill, (b) a Slovak/Czech thesis-review workstation for supervisors/opponents (rubric, findings, defense questions, DOCX/LaTeX export), and (c) a Yjs live-collab layer over both. The poster editor is English; the thesis reviewer is Slovak-first. They share a workspace/output/card data model but not a language, a navigation model, or an error surface.

**Top 5 UX problems**
1. **Toasts are never displayed.** 10 `toast.*` calls across 5 components, but no `<Toaster>` is mounted anywhere (`git grep Toaster` → 0; `app/layout.tsx` L51-68). Workspace deleted, citation copied, fix-validation warnings, RAG indexing done/failed — all silent.
2. **Workspace creation is half-broken.** `workspace-selector.tsx` L101 POSTs `{id,name,templateName}`; the schema (`lib/validations/workspace.ts` L124-129) reads `outputType`/`templateId`. Template picker is dead; a workspace can only be born as a poster; user must type a slug ID.
3. **Data-loss paths without confirmation.** `switchProject` (`project-slice.ts` L42-88) ignores `isDirty`; deleting an output (`poster-preview.tsx` L598-604) and deleting a thesis review (`thesis-review-panel.tsx` L529-532) fire immediately; AI auto-fill overwrites content with no undo (no temporal middleware in repo).
4. **Long AI jobs have a black-box middle.** MinerU: progress jumps 20 → 50 with zero SSE events during up to 300 s (`app/api/ingestion/parse/route.ts` L163-213). Thesis review: indeterminate bar labelled "60 – 90 s" (`thesis-review-panel.tsx` L231-238) with no cancel, no elapsed time.
5. **Language split.** Poster editor 100 % English (0 diacritics in top-bar/card-inspector/structure-sidebar); thesis review and academic search 100 % Slovak (`academic-search-dialog.tsx` L50-229); `agent-panel.tsx` L551-556 mixes both in one handler. No locale switch exists.

**Top 5 strengths**
1. Expert-review workspace is a real keyboard-driven triage tool (`expert-review-workspace.tsx` L231-260: `/`, `?`, `j/k`, `a`, Esc).
2. Save is race-safe: `workspaceId` guards on save/generate completion (`project-slice.ts` L473-475, L873-876), 409 conflict surfaced, retry dedup (L25-31).
3. Compile is self-healing: auto-save before compile, 3 attempts with LaTeX auto-fix (`ui-slice.ts` L118-145).
4. Export ZIP is Overleaf-ready with README, `.bib`, materialised remote figures (`export/route.ts` L120-177).
5. ⌘K palette covers the full action surface (`command-palette.tsx` L134-213), including output/card jump.

**Verdict — would a PhD student use this daily?** *Not yet.* A supervisor writing SK/CZ thesis reviews would use it weekly once toasts/confirmations exist; a poster-building student will hit the broken workspace creation, silent feedback, and 5-minute opaque ingestion on day one and fall back to Overleaf.

---

## 2. User journey reconstruction

### First-time user
1. `/` mounts with `project = sampleProjects[0]` (id `demo_ws`, `project-slice.ts` L34; `mock-data.ts` L5). `shell.tsx` L309-320 opens `WorkspaceSelector` only when `lastWorkspaceId` is null or equals `"prj_lattice"` — **stale ID**: mock is now `demo_ws`, so the second branch (L317) never fires; if the user closes the selector (`workspace-selector.tsx` L128 `showCloseButton`) they edit the demo project, and Save PUTs `/api/workspaces/demo_ws` → 404 → "Auto-save Pending" event forever, retried every 3 s (L25-31, L905-908).
2. Selector empty state: "No workspaces yet." (`workspace-selector.tsx` L195), no illustration/CTA; user must fill **ID slug + name** (L207) and pick a template that is ignored (L226-231 → L101).
3. New workspace = poster with default template. To review a thesis the user must discover the "+" tab in the preview header → `AddOutputDialog` (`poster-preview.tsx` L364-470, default `"slides"`), pick `thesis-review`.
4. No onboarding, no tour; `help-modal.tsx` (388 lines, Slovak) is the only guide, and it describes a 3-expert debate panel that doesn't exist (L377; see F-08).

### Returning user
- `lastWorkspaceId` restores the workspace (L311). Unsaved edits from the previous session are gone unless they hit Save — autosave is deliberately off (`shell.tsx` L296, `top-bar.tsx` L253) but only `beforeunload` guards it; in-app navigation (workspace switch) does not.
- Event feed (`agentEvents`) is persisted and rehydrated in full (`ui-slice.ts` L41-44, L95-101; `[id]/route.ts` L190-193) → grows without bound across sessions.

### Happy path A — PDF → poster
Upload (`upload-zone.tsx`) → SSE parse → assets in `asset-list.tsx` → "Auto-fill all" (`command-palette.tsx` L151) → cards filled → compile → PDF in right sidebar → export ZIP.
- **Friction:** progress bar frozen at 20 % for the whole MinerU wait; captions phase reports per-image (L435) but parse phase does not. Auto-fill silently drops hallucinated `assetIds` and clears existing figures (`project-slice.ts` L480-505); server `overBudget` flag never displayed (generate route L108-115, 0 client refs). Review tips (`ReviewTipSchema`, `contracts.ts` L32-45) carry no `cardId` → "Found 4 issues" list has no click-to-card (`agent-panel.tsx` L163-200, 0 `onClick`).
- **Dead end:** `duplicateProject` is a "coming soon" event (`project-slice.ts` L843) yet listed in ⌘K (L155).

### Happy path B — thesis review
Add thesis-review output → upload thesis PDF → RAG index (`rag-index-status-panel.tsx`) → metadata (`thesis-metadata-panel.tsx`) → optional analysis plan → Generate → `ExpertReviewWorkspace` triage → final decision → DOCX/LaTeX export.
- **Friction:** generation screen has no cancel and no elapsed timer (L214-240); "Multi-Agent Debate" toggle (L304) doubles cost with no visible artefact (F-08). Finding accept/reject via `a` key has no undo (grep undo → 0 in thesis-review). Manual "Uložiť" button (`expert-review-workspace.tsx` L495) with no dirty indicator — user cannot tell whether triage decisions are saved. DOCX export is good (see §4).
- **Unsurfaced:** the sk-academic-v1 rubric is only named inside the analysis-plan panel (`analysis-plan-panel.tsx` L565); criteria weights are visible (`thesis-criteria-card.tsx` L113-114) but the score→grade derivation is not explained anywhere in the UI.

### Happy path C — co-author collaboration
Click "Live Collab" (`top-bar.tsx` L367-378) → ticket → Yjs WS → cards map synced per active output (`use-yjs.tsx` L185-209) → granular thesis-review maps (L212-235).
- **Friction:** no invite/share flow — the other person must already have access to the same workspace ID; there is no member list, no link copy, no presence beyond `collaborators-layer.tsx`. Sync covers `cards` only — header/theme/layout changes are not in the Y.Doc (grep header|theme|layout in use-yjs → 0). Every Zustand state change re-diffs all cards by `JSON.stringify` (L194-208), no debounce.

---

## 3. Findings table

| ID | Impact | Confidence | Area | Title | Evidence | User symptom | Recommended improvement | Effort |
|---|---|---|---|---|---|---|---|---|
| F-01 | Critical | High | Feedback | `<Toaster>` never mounted | `git grep Toaster` → 0; `app/layout.tsx` L51-68; callers `manage-workspaces.tsx` L55/57, `academic-search-dialog.tsx` L127/135, `structure-sidebar.tsx` L164/178, `agent-panel.tsx` L287/560, `rag-index-status-panel.tsx` L128/132 | "Workspace deleted", "Citation copied", validation warnings, RAG failures never appear | Add `components/ui/sonner.tsx` and `<Toaster richColors position="bottom-right" />` in `app/layout.tsx` | 0.5 h |
| F-02 | High | High | Onboarding | Workspace create sends wrong field names | `workspace-selector.tsx` L101 vs `lib/validations/workspace.ts` L124-129 | Template choice ignored; always poster+default; cannot create thesis-review workspace directly | Send `{outputType, templateId}`; add output-type radio; auto-generate ID slug from name | 2 h |
| F-03 | High | High | Data loss | `switchProject` ignores `isDirty` | `project-slice.ts` L42-88; guard only in `shell.tsx` L297-306 (`beforeunload`) | Switching workspace from ⌘K/selector drops unsaved edits silently | Prompt "Save / Discard / Cancel" when `isDirty` before `cancelAll()` at L45 | 2 h |
| F-04 | High | High | First run | Stale mock-ID check `"prj_lattice"` | `shell.tsx` L311/317 vs `mock-data.ts` L5 (`demo_ws`) | Closing selector leaves user editing an unsaveable demo; Save → 404 → infinite 3 s retry (L905-908) | Compare against `sampleProjects[0].id`; make demo read-only or block Save with CTA | 1 h |
| F-05 | High | High | Destructive | Output delete and review delete have no confirm | `poster-preview.tsx` L598-604; `thesis-review-panel.tsx` L529-532 | One mis-hover-click deletes a whole slides deck or a finished review | Reuse the confirm pattern from `manage-workspaces.tsx` L23-57 / `history-panel.tsx` L45-77 | 2 h |
| F-06 | High | High | Ingestion | SSE silent during MinerU parse (20 → 50 %) | `app/api/ingestion/parse/route.ts` L163-213 (0 `sendEvent` between submit and completion); client `ingestion-slice.ts` L152-163 | Bar frozen for up to 5 min; users assume hang and re-upload | Heartbeat event every 10 s with elapsed time + "large PDFs take 2-5 min"; show cancel (abort exists at L239) | 3 h |
| F-07 | High | Medium | AI auto-fill | No undo; silent drops; `overBudget` hidden | `project-slice.ts` L480-505 (L494 clears figures); generate route L108-115; 0 refs to `overBudget` in components | Card content replaced with no way back; over-length card silently accepted | Snapshot card before apply and add "Undo auto-fill" action on the event; surface `overBudget` as warning event | 4 h |
| F-08 | High | High | Thesis AI | "Multi-Agent Debate" output never rendered; help text inaccurate | Toggle `thesis-review-panel.tsx` L304; `help-modal.tsx` L377 (3 experts); impl `review-engine.ts` L80-89, L292-320, L745-764 (single self-critique); `debateLog` L869 has 0 render sites | User pays ~2× tokens, sees nothing different, help promises Pesimista/Optimista/Metodik | Either render `debateLog` as a collapsible "Kritická revízia" section per finding, or rename toggle to "Self-critique pass" and fix help text | 1 d |
| F-09 | High | High | i18n | Hard language split with no switch | Poster shell EN (0 diacritics in `top-bar.tsx`, `card-inspector.tsx`, `structure-sidebar.tsx`); `academic-search-dialog.tsx` L50-229 SK-only; `agent-panel.tsx` L551-556 mixed; DOCX bilingual labels `generator-review.ts` L52-128 | English-speaking co-supervisor cannot use review UI; Slovak student sees English editor + Slovak search | Introduce `lib/i18n` with `sk/cs/en` dictionaries; start with the ~120 strings in thesis-review + academic-search; language selector in settings-panel | 3 d |
| F-10 | Medium | High | Unbounded state | `agentEvents`/`chatMessages` never pruned, persisted whole | `ui-slice.ts` L95-101, L41-44; `[id]/route.ts` L190-193 | Every Save payload grows; agent panel list grows forever | Cap at 200 events / 100 messages in `pushEvent`; persist only last 50 | 1 h |
| F-11 | Medium | High | Errors | Only 5 dialog boundaries + shell panes; none inside `poster-preview.tsx` (1462 lines) or `ExpertReviewWorkspace` (1284) | `shell.tsx` L76-93, L191-208, L330-342 | A single bad card renders blank "Poster Preview" pane; a bad finding blanks the whole review | Add `ErrorBoundary` around each `MiniBlock`/`SlideCard`/`PaperSection` (`poster-preview.tsx` L632/1063/1130) and around `FindingCard` | 2 h |
| F-12 | Medium | High | Review tips | Tips lack `cardId`, not actionable | `contracts.ts` L32-45; `agent-panel.tsx` L163-200 (0 onClick) | "Found 4 issues" but no jump-to-card or apply | Add optional `cardId` to `ReviewTipSchema`, ask model for it in `review/route.ts` L159 prompt, render as link → `selectCard` | 3 h |
| F-13 | Medium | High | IA | Dead menu item in ⌘K | `command-palette.tsx` L155 → `project-slice.ts` L843 "coming soon" | Palette action that does nothing | Remove from palette until implemented | 10 min |
| F-14 | Medium | High | Collaboration | No invite/share UX; sync covers cards only; no debounce | `top-bar.tsx` L367-378; `use-yjs.tsx` L185-209 (JSON.stringify per state change), no header/theme sync | Toggle "Live Collab" and nothing tells you how to bring a co-author; header edits diverge | Add "Copy invite link" using `collaboration-ticket`; sync header/theme maps; debounce 150 ms | 2 d |
| F-15 | Medium | Medium | Thesis save | No dirty indicator for review edits; manual "Uložiť" only | `expert-review-workspace.tsx` L495; store has no `dirty` flag (grep → 0) | Reviewer closes tab after 40 min of triage unsure if saved | Track `reviewDirty` in store; auto-save 2 s after accept/reject; show "Uložené o 14:03" | 3 h |
| F-16 | Medium | Medium | Thesis AI | Self-critique only sees title + 200 chars, not source | `review-engine.ts` L292-320 | Critique cannot detect hallucinated evidence — the thing reviewers fear most | Pass `evidenceExcerpts` for each finding to the critique prompt; ask for `verified: boolean` | 4 h |
| F-17 | Medium | High | Rubric | sk-academic-v1 named only in plan panel; score→grade math invisible | `analysis-plan-panel.tsx` L565; `thesis-criteria-card.tsx` L113 | Supervisor cannot defend the proposed grade to a committee | Add "Ako vznikla známka" popover listing weights × scores and deductions per finding | 1 d |
| F-18 | Medium | High | Perf | react-pdf renders all pages eagerly | `pdf-viewer.tsx` L101-116 (`Array.from({length:numPages})`) | 60-page thesis PDF = 60 canvases; scroll jank, memory | Virtualise: render pages within ±2 of viewport via IntersectionObserver | 4 h |
| F-19 | Medium | Medium | Perf | WASM embedding cold start + silent fallback vector | `local-embeddings.ts` L16, L101-108 | First RAG query hangs 10-30 s; on failure returns hash-based pseudo-vector → nonsense retrieval with no warning | Warm up on server boot; return `{ vector, degraded: true }` and show badge in `rag-index-status-panel` | 3 h |
| F-20 | Medium | High | LaTeX | No `fontenc`/`babel` in poster/slides/paper templates | `lib/latex/templates.ts` L86-551 (only `inputenc`); babel only in `templates-thesis.ts` L16-25 | Slovak/Czech posters: bad hyphenation, bitmap-ish diacritics under pdflatex | Add `\usepackage[T1]{fontenc}\usepackage{lmodern}` and babel from `project.language` to all templates | 2 h |
| F-21 | Low | High | Hygiene | Empty catch swallows figure-editor error | `figure-editor.tsx` L74 | Crop failure = nothing happens | Push error event | 15 min |
| F-22 | Low | High | Keyboard | No ⌘S; ⌘K only global shortcut in poster mode | grep `metaKey` → `shell.tsx` L39 only | Muscle-memory save does nothing while autosave is off | Add ⌘S → `saveProject`, ⌘⏎ → compile | 1 h |
| F-23 | Low | High | Components | 17 files > 500 lines, 4 over 1 000 | `poster-preview.tsx` 1462, `expert-review-workspace.tsx` 1284, `header-inspector.tsx` 1096, `card-inspector.tsx` 1056 | Slow iteration, hard to boundary/test | Split preview by output type (Poster/Slides/Paper renderers already memoised at L632/1063/1130) | 2 d |
| F-24 | Info | High | Dialog pattern | All 15 overlays use `Dialog`; 0 `Sheet` | grep results | Consistent, but ingestion drawer + agent fix panel would suit side sheets | Keep; consider Sheet for ingestion on mobile only | — |

---

## 4. AI feature assessment

| Feature | Quality (static) | Biggest prompt/logic improvement | Missing validation | Non-technical readiness |
|---|---|---|---|---|
| **Card auto-fill** (`generate/route.ts`, `CardGenerationSchema` `contracts.ts` L5-28) | Solid contract with alias preprocessing; budget check exists server-side | Return `overBudget` + `wordCount` to UI and ask the model to self-trim on second pass | Client drops unknown `assetIds` silently (L480-505); no check that `\cite{}` keys exist before *sanitising* them away | Medium — one-click works, but the "why did my figure disappear" moment is unexplained |
| **Poster review** (`review/route.ts` L159, `ReviewTipsSchema`) | Grounded prompt; severity enum with `.catch("info")` | Ask for `cardId` + `suggestedFix` per tip so tips become actions | No de-dup of repeated tips; no cap on count | Low-medium — output is a passive list |
| **Thesis review** (`review-engine.ts`, rubric-engine, analysis-plan) | Most mature: rubric anti-over-penalisation guidance (L666), evidence excerpts, citation audit, defense questions | Give self-critique the evidence (F-16); render `debateLog` (F-08) | Findings accepted via keyboard with no undo; no check that `proposedGrade` is consistent with weighted score before export | Medium-high for SK supervisors; zero for EN users (Slovak-only UI) |
| **Academic search** (`academic-search-dialog.tsx`) | Good filters (field/year), copy-cite, add-to-bib | Show which aggregator each hit came from + DOI resolution status | Toasts for "added to .bib" never appear (F-01) → user re-adds duplicates | Low for EN users (SK-only labels L50-229) |
| **Image editing / figure editor** (`figure-editor.tsx`) | Crop/label works | — | Empty catch L74 | Medium |
| **OCR** (`scanner/image-ocr-dialog.tsx` 732 lines) | Vision OCR → LaTeX/markdown | Add confidence display per equation block | No preview compile of extracted LaTeX before insert | Medium |
| **LaTeX auto-fix** (`autofix-compile`, `ui-slice.ts` L118-145) | Best-in-class loop: save → compile → fix → retry ×3 | Show diff of what was changed per attempt in the event detail | Patch schema accepts empty `content` (`CompilePatchSchema` L60-66) | High |

---

## 5. Quick wins (< 1 day)

| # | Change | File | Impact |
|---|---|---|---|
| 1 | Mount `<Toaster />` | `app/layout.tsx` | Unblocks 10 existing feedback messages (F-01) |
| 2 | Fix create payload + slug auto-gen + output-type picker | `components/workspace-selector.tsx` L101, L207, L226 | Fixes onboarding (F-02) |
| 3 | Replace `"prj_lattice"` with `sampleProjects[0].id` | `components/layout/shell.tsx` L311/317 | Stops demo-save 404 loop (F-04) |
| 4 | Dirty-check in `switchProject` | `components/store/project-slice.ts` L42 | Prevents silent data loss (F-03) |
| 5 | Confirm dialogs for output/review delete | `poster-preview.tsx` L600; `thesis-review-panel.tsx` L531 | F-05 |
| 6 | Heartbeat SSE every 10 s during MinerU | `app/api/ingestion/parse/route.ts` ~L170 | F-06 |
| 7 | Cap `agentEvents` at 200 | `components/store/ui-slice.ts` L95 | F-10 |
| 8 | Remove `duplicateProject` from palette | `components/command-palette.tsx` L155 | F-13 |
| 9 | ⌘S save shortcut | `components/layout/shell.tsx` L37 | F-22 |
| 10 | Add `fontenc`/`lmodern`/babel to poster templates | `lib/latex/templates.ts` | F-20 |
| 11 | Rename toggle to "Kritická sebarevízia" + fix help text | `thesis-review-panel.tsx` L304; `help-modal.tsx` L377 | Honest labelling until F-08 is fully built |

---

## 6. Roadmap tracks

**Core workflow polish (weeks 1-2)** — F-01…F-07, F-10, F-13, F-22. Goal: a student can create a workspace, ingest a PDF with visible progress, auto-fill with undo, and never lose work.

**Power user (weeks 3-4)** — Actionable review tips with jump-to-card (F-12); per-attempt auto-fix diff; virtualised PDF viewer (F-18); ⌘-shortcut sheet in poster mode mirroring the thesis workspace's `?` overlay; split `poster-preview.tsx` by output type (F-23).

**Collaboration maturity (weeks 5-7)** — Invite link + presence list (F-14); sync header/theme/layout maps; debounce Yjs diff; show "who changed this card" using existing snapshot diff (`lib/snapshot-diff.ts`); conflict banner when 409 occurs during collab.

**Academic credibility (weeks 5-8)** — Render self-critique/debate log (F-08); evidence-aware critique (F-16); grade derivation popover (F-17); i18n SK/CS/EN (F-09); degraded-embedding badge (F-19); export-time consistency check (grade vs. weighted score, all exported findings have evidence) before DOCX/LaTeX.

---

## 7. Positive findings

- **Race safety after PR #2:** `workspaceId` capture on generate (`project-slice.ts` L473-475), save (L873-876), ingestion (`ingestion-slice.ts` L153-156); `jobQueue.cancelAll()` on switch (L45).
- **Compile loop** with auto-save-before-compile and revision pinning (`ui-slice.ts` L131-145).
- **Export ZIP** materialises remote figures, bundles `.bib`, writes a bilingual-friendly README with Overleaf steps (`export/route.ts` L120-177); compile stage copies default logos and workspace `.sty/.cls/.bst` (`compile/route.ts` L88-97).
- **DOCX review export** (`generator-review.ts`, 368 lines) mirrors the Slovak opponent-review form: bilingual labels, numbered sections 1-5, criteria table, signature line, confidentiality footer.
- **Thesis LaTeX** selects babel per language (`templates-thesis.ts` L16-25).
- **Keyboard triage** in `ExpertReviewWorkspace` (L231-260) and `role="button"`/`tabIndex`/Enter-Space on canvas cards (`poster-preview.tsx` L694-699, L1082-1086).
- **Confirm patterns exist** and are good where present (`manage-workspaces.tsx`, `history-panel.tsx`).
- Sub-renderers are memoised (`MiniBlock`, `SlideCard`, `PaperSection`).
- `embeddingQueue` serialises WASM inference and bounds the cache (`local-embeddings.ts` L64-115).

---

## 8. Audit limitations

- Static reading only; no browser session, no MinerU, no pdflatex, no Prisma engine → runtime behaviour (actual toast absence, PDF jank, Yjs latency) is inferred from code, not observed.
- LaTeX output quality judged from template source, not compiled PDFs.
- Prompt quality judged from prompt text and schemas, not from sampled model outputs.
- Remote GitHub access is closed for this session; findings reference the local tree at 699ccafd.
- Mobile shell (`shell.tsx` L162-215) was not separately audited.
