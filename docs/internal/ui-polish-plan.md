# PosterApp — UI / UX / Accessibility Polish Plan

**Status:** Draft for approval
**Branch:** `arena/01a06985-posterapp`
**Date:** 2026-09-04
**Execution model:** Five sequential phases. Each phase is a **single focused commit**. Every phase ends with the verification gate below. Nothing ships to `main` until all phases are done and green.

---

## 0. Audit methodology & key findings

Before writing this plan, the codebase was audited (greps + line-level reads of every `components/ui/*` file, the layout shell, top bar, sidebars, inspector panels, the full `thesis-review/*` and `ingestion/*` trees, all Zustand slices, and `app/globals.css`). The recurring problems, in order of impact:

| # | Finding | Evidence (file:line) |
|---|---------|---------------------|
| F1 | **Two parallel feedback systems.** Zustand slices report *only* via `pushEvent` (agent event log in the Agent panel). If the Agent panel is closed, save/duplicate/switch/generate failures are invisible. Meanwhile some UI code uses Sonner `toast` directly. | `components/store/project-slice.ts` (21× `pushEvent`, 0× `toast`), `components/store/ingestion-slice.ts`, vs `components/structure-sidebar.tsx:174-181` (toast) |
| F2 | **Raw Tailwind palette colors bypass the design system** — breaks the `vercel`, `vercel-dark`, and `midnight` themes (their tokens are never referenced). Concentrated in `thesis-review/*` and a few spots elsewhere. | `thesis-review/analysis-plan-panel.tsx:65-659` (blue/green/red/purple/slate), `evidence-viewer.tsx:185` (`dark:bg-zinc-950/60`), `header-inspector.tsx:176,540,563` (`text-blue-500/600`), `ingestion/upload-zone.tsx` (`fill-amber-500`), `top-bar.tsx` (Live Collab uses `bg-chart-3`) |
| F3 | **Dead scrollbar utilities.** `globals.css` defines only `.no-scrollbar`, but `asset-list.tsx` uses `scrollbar-thin` / `scrollbar-none` — no such utilities exist, so they silently do nothing. No global thin-scrollbar styling exists. | `app/globals.css:341-347`, `components/ingestion/asset-list.tsx:577,739,827` |
| F4 | **Hand-rolled overlays without focus management.** `IngestionDrawer` (`role="dialog" aria-modal="true"` on a plain `<aside>`), `HistoryPanel` (plain `<div onClick>` backdrop, no Escape handling), `WorkspaceSelector` — none trap focus or return focus on close. | `ingestion/ingestion-drawer.tsx:47-52`, `history-panel.tsx:127-130` |
| F5 | **Inconsistent focus-ring spec.** Primitives mostly use `focus-visible:ring-1 focus-visible:ring-ring/40`, but `Badge` uses `focus:ring-2 … ring-offset-2` (mouse + keyboard, different width), and some raw `<button>`s have no ring at all (e.g. structure-sidebar search clear button). | `components/ui/badge.tsx:12`, `components/structure-sidebar.tsx:369-376` |
| F6 | **Destructive actions without confirmation.** Card delete in `CardInspector` (and the card-row trash button / context menu in the structure sidebar) deletes immediately; `ConfirmDialog` exists but is unused here. | `components/card-inspector.tsx:1035-1042` |
| F7 | **Loading states that don't match final layout.** `RightSidebar` project-switching state replaces the whole pane (incl. tab bar) with a bare spinner → layout shift. `AppSkeleton` omits the right sidebar & agent panel columns. | `components/right-sidebar.tsx:44-52`, `components/layout/shell.tsx:297-331` |
| F8 | **Heading-level skips** (h2 → h3 → h5 in the ingestion drawer; h5 used for asset titles) and a handful of icon-only buttons without `aria-label`. | `ingestion/ingestion-drawer.tsx:63,105` + `ingestion/asset-list.tsx:205,538,859`, `structure-sidebar.tsx:369` |
| F9 | **Silent error swallowing.** `top-bar.tsx` `refreshWorkspaces` → `.catch(() => {})`; `structure-sidebar.tsx` fetches `/api/workspaces` into state that is **never read** (dead fetch on every project switch). | `components/top-bar.tsx:100-105`, `components/structure-sidebar.tsx:333-338` |
| F10 | **No visual feedback on save buttons in inspectors.** `Save Project` / `Save Card` in `CardInspector` are disabled while generating but show no spinner while `isSaving`. | `components/card-inspector.tsx:1023-1054` |

Also verified as **already good** (do not regress): base-ui-driven primitives with focus rings, `ConfirmDialog` shared component, reduced-motion media query in `globals.css`, `aria-pressed` on top-bar toggles, `aria-current` on card rows, `role="status"` + `sr-only` on the structure sidebar skeleton, Sonner wired to `next-themes`, `CommandEmpty` support in the palette.

---

## 1. Global conventions (enforced in every phase)

These are the "one right answer" rules. When a file conflicts with them, the file changes — the tokens do not.

### 1.1 Focus ring spec
- **Primitives & controls** (Button, Input, Select, Switch, Tabs, Accordion, ScrollArea viewport):
  `outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/40` (already the de-facto standard; keep).
- **Raw `<button>`/interactive elements** (card rows, nav buttons, dashed empty-state buttons):
  `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`.
- Never bare `focus:ring` (fires on mouse click). Never omit the ring.

### 1.2 Colors
- Only semantic tokens: `background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, success, warning, info, sidebar*, chart*, status-*, severity-*`.
- Raw-palette migration map (for F2):
  | Raw | → Token |
  |---|---|
  | `blue-*` (informational) | `info` |
  | `green-*` (OK/compliant/confirmed) | `success` |
  | `red-*` (missing/error) | `destructive` |
  | `purple-*` (ambiguous/epistemic) | `status-ambiguous` |
  | `amber-*` / `yellow-*` | `warning` |
  | `slate-*` / `gray-*` | `muted` / `muted-foreground` |
  | `zinc-950` (dark backdrop) | `background` / `card` |
  | `text-chart-3` as "saved/valid" | `success` |
  | `text-chart-4` as "warning" | `warning` |
- Exceptions that may stay hardcoded, **with an explanatory comment**: QR-code white background (scan contrast requirement — `header-inspector.tsx:1044`), collaborator avatar `text-white` on colored discs (`top-bar.tsx`, `collaborators-layer.tsx`).

### 1.3 Radius scale
- Interactive controls: `rounded-lg`; compact controls (`xs`): `rounded-md`; containers/dialogs/cards: `rounded-xl`. (Matches `--radius-*` in `globals.css`.)

### 1.4 Feedback rules (F1)
- **Sonner toast** = user-facing outcome of an action (success / error / warning). Every async action the user initiated must end in exactly one toast (errors always; successes for save/duplicate/export/create/delete).
- **`pushEvent`** = AI/agent activity log (generation progress, validation runs). Kept for the Agent panel, never the *only* channel for errors.
- New shared helper **`lib/notify.ts`**: `notify.success(title, description?)`, `notify.error(...)`, `notify.warning(...)` — single place for wording, `richColors`-friendly descriptions, and dedupe (identical error within 3 s → no duplicate toast). Slices may import it (client-safe).
- Every async button: `disabled={pending}` + `<Loader2 className="size-3.5 animate-spin" aria-hidden />` + unchanged label (no "Saving…" label swaps that change width).

### 1.5 Skeletons (F7)
- A skeleton must replicate the final layout: same paddings, row heights, and visible section chrome (headers/tab bars stay rendered; only content rows are skeletons).
- Wrap in `role="status"` + one `sr-only` sentence.

### 1.6 Empty states
- Shared **`components/ui/empty-state.tsx`** (created in Phase 1): icon in a `size-10` `rounded-full border bg-muted` circle, `text-sm font-medium` title, `text-[12px] text-muted-foreground` description (max-w ~18rem), optional primary/outline CTA `<Button size="sm">`. Centered with `justify-center`.
- Every list/view must have one with a CTA that performs the obvious next action.

### 1.7 Motion
- `transition-all duration-200 ease-in-out` (or `transition-colors` for color-only) on interactive elements; `tw-animate-css` enter/exit for overlays; respect existing `prefers-reduced-motion` block (no new always-on animations).

### 1.8 i18n
- `thesis-review/*` uses inline `{ sk, cs, en }` dictionaries — keep the pattern; when touching a string, ensure all three languages are present. Do not introduce a new i18n framework in this effort.

---

## 2. Phase 1 — Primitives & Design System

**Goal:** every `components/ui/*` primitive + global CSS follows §1 conventions. No behavior changes.

**Files & tasks**

- [ ] `components/ui/badge.tsx` — replace `focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2` with `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40`; verify dark/vercel/midnight contrast of `secondary` variant text.
- [ ] `components/ui/button.tsx` — add focus-visible ring to `link` variant (currently only `hover:underline`); verify `icon-xs`/`xs` hit targets ≥ 24 px; no other changes.
- [ ] `components/ui/input.tsx` — audit against §1.1 (already compliant); remove double-dimming `disabled:bg-input/50 disabled:opacity-50` → keep `disabled:opacity-50` only.
- [ ] `components/ui/textarea.tsx` — same disabled-state cleanup as input.
- [ ] `components/ui/select.tsx` — verify trigger/item focus rings; check `min-w-[max(var(--anchor-width,0px),16rem)]` doesn't overflow at 320 px (guard exists via `max-w-[min(94vw,38rem)]` — verify visually); audit `text-xs` item size (keep, document as intentional density).
- [ ] `components/ui/dialog.tsx` — verify overlay `bg-black/10` reads on all 5 themes; keep `rounded-xl`, `ring-1 ring-foreground/10`; confirm `max-w-[calc(100%-2rem)]` mobile math.
- [ ] `components/ui/popover.tsx`, `components/ui/dropdown-menu.tsx`, `components/ui/context-menu.tsx` — audit focus rings, radius (`rounded-lg`), shadow consistency (`shadow-md` vs `shadow-lg` — standardize popovers to `shadow-md`, select/command to `shadow-lg`, document).
- [ ] `components/ui/command.tsx` — audit `no-scrollbar` usage, input focus ring, `CommandEmpty` styling.
- [ ] `components/ui/tabs.tsx` — audit line-variant underline contrast in `vercel` themes (foreground-based, OK — verify).
- [ ] `components/ui/switch.tsx` — audit thumb colors in `vercel` (inverted) theme: `data-checked:bg-primary-foreground` / `data-unchecked:bg-foreground` must stay visible in all 5 themes.
- [ ] `components/ui/accordion.tsx` — audit focus ring on trigger (present), verify hover-underline doesn't conflict with `focus-visible`.
- [ ] `components/ui/scroll-area.tsx` — thumb `bg-border` is nearly invisible → `bg-muted-foreground/25 hover:bg-muted-foreground/40` (subtle, theme-correct).
- [ ] `components/ui/skeleton.tsx` — keep `rounded-md bg-muted animate-pulse`; add optional `className` default for line-height rows used by Phase 3 skeletons (no API change).
- [ ] `components/ui/separator.tsx`, `components/ui/label.tsx`, `components/ui/card.tsx`, `components/ui/progress.tsx`, `components/ui/input-group.tsx`, `components/ui/tooltip.tsx`, `components/ui/sonner.tsx` — audit pass (label spacing, card `p-6` vs app density — keep API, document that dense layouts override padding).
- [ ] `components/ui/confirm-dialog.tsx` — verify focus lands on Cancel (it does: `autoFocus`), Enter = confirm only when destructive=false, Escape disabled while `busy` (currently `onOpenChange` guarded — verify keyboard Escape also blocked while busy).
- [ ] **NEW** `components/ui/empty-state.tsx` — per §1.6, with `variant?: "center" | "inline"` and optional CTA slot.
- [ ] `app/globals.css` — add **global thin scrollbar** styling: `scrollbar-width: thin` + `scrollbar-color: var(--input) transparent` on `*` (Firefox), `::-webkit-scrollbar` (10 px), `::-webkit-scrollbar-thumb` (`var(--input)`, `rounded-full`, hover `var(--muted-foreground)/30`) with the `.no-scrollbar` override kept; add `@media (prefers-reduced-motion: reduce)` already present (verify).
- [ ] `components/status.tsx` — `text-chart-3` → `text-success`, `text-chart-4` → `text-warning` in `StatusIcon`/`StatusBadge` (F2).
- [ ] Repo-wide: delete/replace the 3 dead `scrollbar-thin`/`scrollbar-none` classes in `components/ingestion/asset-list.tsx` (577, 739, 827) with `no-scrollbar` (F3).

**Gate:** §6 verification. Visual diff of a dialog/popover/select/command in all 5 themes × light/dark.

---

## 3. Phase 2 — Global Layouts & Navigation

**Goal:** shell, top bar, and the three sidebars are responsive, transition smoothly, and load without layout shift.

**Files & tasks**

- [ ] `components/layout/shell.tsx`
  - [ ] `AppSkeleton`: add right-sidebar (`lg:w-[26rem]`) + agent-panel skeleton columns so desktop first paint matches final geometry (F7).
  - [ ] Desktop toggle consistency: `structureOpen` unmounts `ProjectSettingsSidebar` while `agentOpen` keeps `AgentPanel` mounted (`display:none`) — keep the AgentPanel behavior (documented PDF resize-observer reason), but lift `ProjectSettingsSidebar` local state into the store or keep it mounted with `display:none` too, so toggling structure no longer loses in-progress edits (verify what state it holds first).
  - [ ] Verify `WorkspaceSelector` z-index stacks above the ingestion drawer & history panel (all `z-50` — define explicit order: selector 60 > history 55 > drawer 50) or document.
  - [ ] Mobile nav: add `aria-current="page"` (present ✓) — verify no horizontal overflow at 320 px; keep `animate-in fade-in duration-200` pane transition.
- [ ] `components/top-bar.tsx`
  - [ ] `refreshWorkspaces`: `.catch(() => {})` → `notify.error("Couldn't load workspaces", { description, action: { label: "Retry" } })` (F9).
  - [ ] `exportTex`: keep `pushEvent`, **add** `notify.success` on download, `notify.error` on failure (F1).
  - [ ] Live Collab button: `bg-chart-3 hover:bg-chart-3/90` → `bg-success hover:bg-success/90` (F2).
  - [ ] Mobile fit audit: at 360 px verify zones 1–6 fit (labels already collapse `hidden md:inline`); if overflow, group zone-4 actions into a single `More` dropdown below `md` (do not shrink icon buttons below `size-8`).
  - [ ] Save button: keep (already model behavior — Loader2 + disabled + "Saved" state).
- [ ] `components/right-sidebar.tsx`
  - [ ] Project-switching state: keep the tab bar rendered; render a skeleton (2 rows + 1 wide row, §1.5) inside the active pane instead of replacing the whole pane (F7).
  - [ ] "Edit {OutputTypeName} Settings + Ops" trigger label is long — shorten to `Edit {Type} Header` at `sm` (truncation audit).
- [ ] `components/structure-sidebar.tsx`
  - [ ] Remove dead `workspaces` fetch/state (F9) — TopBar owns workspace switching.
  - [ ] Search: add `aria-label="Clear card filter"` to the XCircle button + §1.1 focus ring (F5/F8); add `aria-label="Filter cards"` to the input (placeholder-only today).
  - [ ] Static `ChevronDown` in column headers implies collapse that doesn't exist — either implement column collapse (store in `ui-slice`) or swap for a neutral non-interactive dot/`•` (prefer: implement collapse, default open).
  - [ ] Column empty state already good (dashed CTA) — restyle with the new `EmptyState` (inline variant) for consistency.
  - [ ] Overflow-warning block: shrink-error path uses `pushEvent` → also `notify.error` (F1); success already toasts ✓.
- [ ] `components/project-settings-sidebar.tsx` — audit pass: same conventions (this is the *desktop* structure panel; keep divergence with `StructureSidebar` minimal or document why it exists separately).
- [ ] `components/workspace-selector.tsx`
  - [ ] Error state: on fetch failure show an error panel (icon + message + **Retry** button) instead of skeleton loop (F1/F9 — has 7 catch blocks; verify each path).
  - [ ] Empty state: "No workspaces yet" + primary CTA (create) when API returns `[]`.
  - [ ] Verify focus trap + Escape + focus return (custom overlay) — if missing, move to Phase 5 checklist as a known gap.
- [ ] `components/command-palette.tsx` — verify `CommandEmpty` copy ("No results for …") and that theme commands render icons consistently; keyboard shortcuts shown via `CommandShortcut`.
- [ ] `components/help-modal.tsx` — content scroll container gets themed scrollbar (Phase 1 global rule covers it — verify); `h4` sections under dialog title are acceptable within the dialog (document).
- [ ] `components/history-panel.tsx`
  - [ ] Escape-to-close (missing — only backdrop click / button).
  - [ ] Backdrop `<div onClick>` → add `role="presentation"`, keep button close; focus the drawer on open, return focus to the Clock trigger on close (full focus-trap treatment lands in Phase 5; wire Escape + initial focus here).
  - [ ] Labeling: PATCH failure currently only `finally` (silent) → `notify.error` (F1).
- [ ] `components/collaborators-layer.tsx` — verify `pointer-events-none`, `aria-hidden` on the whole layer (decorative cursors/avatars), keep `text-white` on colored discs (documented exception).

**Gate:** §6 verification + manual matrix: 320 / 375 / 768 / 1280 / 2560 px widths, light & dark, toggle every panel open/closed rapidly (no state loss), project switch mid-keystroke.

---

## 4. Phase 3 — Core Workflows

**Goal:** the heavy interactive views are aligned, have polished empty states, and skeletons match final layout.

**Files & tasks**

- [ ] `components/card-inspector.tsx`
  - [ ] Delete (footer button, structure-sidebar row + context menu): route through existing `ConfirmDialog` ("Delete this block? This can't be undone.") with `busy` wired to the store (F6).
  - [ ] `Save Project` / `Save Card`: add `isSaving` → `disabled` + `Loader2` (F10).
  - [ ] Tab empty states: verify `Table` (no columns yet → CTA "Add column"), `Figures` (no images → CTA "Open ingestion"), `Content` when card has no content (CTA "Auto-fill with AI" wired to `autoFillCardAction`), each via `EmptyState`.
  - [ ] `TabsList` overflow at 320 px: verify horizontal scroll + momentum; keep `overflow-x-auto`.
  - [ ] Section labels use `Label` — verify `htmlFor`/`id` pairing on every input (a11y baseline here, full sweep Phase 5).
- [ ] `components/header-inspector.tsx`
  - [ ] `text-blue-500/600` (176, 540, 563) → `text-info` (F2).
  - [ ] "Generate All" (line ~560): `disabled` while `generatingIds.length > 0` + `Loader2` (F10).
  - [ ] QR section: keep `bg-white` on the QR frame — add `/* QR requires light background for scan contrast */` comment (documented exception).
  - [ ] Footer `Done & Lock Header`: add confirmation? (no — non-destructive, keep direct). Audit section spacing (`space-y` consistency with card-inspector).
- [ ] `components/ingestion/ingestion-drawer.tsx`
  - [ ] Visual pass: summary strip mono text, parsing pulse indicator (keep), header icon chip.
  - [ ] (Focus trap / Escape / focus-return: implemented in Phase 5 — keep the hand-rolled structure unless migration is trivial.)
- [ ] `components/ingestion/upload-zone.tsx`
  - [ ] `fill-amber-500` (processing node star) → `fill-warning` (F2).
  - [ ] Per-file status list: error rows get a `Retry` button (already `RotateCw` — verify it calls `retryFile` and shows `notify.error` on repeated failure).
  - [ ] Drag-over state: verify `scale-102`/border color reads in dark + midnight.
- [ ] `components/ingestion/asset-list.tsx`
  - [ ] Replace dead `scrollbar-thin`/`scrollbar-none` with `no-scrollbar` (moved here from Phase 1 file list — doing it in the same commit as the ingestion visual pass; Phase 1 keeps the `globals.css` definitions).
  - [ ] Empty state: no ingest files → `EmptyState` with CTA "Upload PDFs" (scroll/focus upload zone) + drag hint.
  - [ ] Headings: `h5` (205, 538, 859) → `h4` (drawer: h2 title → h3 "Extraction results" → h4 asset titles — no skips) (F8).
  - [ ] Asset row actions (promote / discard / dismiss): verify icon buttons have `aria-label`s + focus rings; destructive `discard` → confirm? (keep direct — assets are recoverable from the file; document).
- [ ] `components/ingestion/figure-editor.tsx`, `promote-popover.tsx`, `parse-log-panel.tsx`, `ingestion-badges.tsx` — audit pass (focus rings on figure crop controls, parse-log row states, badge tokens).
- [ ] `components/thesis-review/*` (25 files) — **largest block of Phase 3**, executed in 4 sub-commits-of-one-commit (single squashed commit):
  - [ ] **Sub-block A — theme tokenization (F2).** In `analysis-plan-panel.tsx`, `citation-issues-panel.tsx`, `defense-prep-panel.tsx`, `defense-questions-panel.tsx`, `evidence-viewer.tsx`, `expert-review-workspace.tsx`, `finding-card.tsx`, `grade-derivation-popover.tsx`, `reporting-checklist-panel.tsx`, `review-role-badge.tsx`, `rubric-template-modal.tsx`, `supervisor-signoff-panel.tsx`, `thesis-criteria-card.tsx`, `thesis-metadata-panel.tsx`, `rag-index-status-panel.tsx`, `criterion-comments.tsx`: apply the §1.2 map (blue→info, green→success, red→destructive, purple→status-ambiguous, zinc→background/card, slate→muted). Verify in `vercel`, `vercel-dark`, `midnight` — this is what makes the 5 themes actually work in this module.
  - [ ] **Sub-block B — empty states.** Every panel that renders a list gets the §1.6 treatment + CTA: `defense-questions-panel` (currently an italic one-liner → `EmptyState` + "Generate questions" CTA), `citation-issues-panel`, `reporting-checklist-panel`, `defense-prep-panel`, `analysis-plan-panel`, `rag-index-status-panel` (no index → CTA "Build index").
  - [ ] **Sub-block C — loading alignment.** `thesis-review-panel.tsx:237` (large `size-12` spinner replacing content) → skeleton layout matching the final grid (§1.5); `review-generation-progress.tsx` keep stage icons (good) but add `role="status"` + progress bar (existing `Progress` primitive) for determinate stages.
  - [ ] **Sub-block D — i18n consistency.** Every touched string present in `sk`/`cs`/`en`; audit untouched panels for missing-locale fallbacks (default `en`).
- [ ] `components/poster-preview.tsx`
  - [ ] Compile/loading states: verify PDF-compile spinner + error banner styling (tokens), add `role="alert"` to the error banner.
  - [ ] Empty state: output with zero cards → centered `EmptyState` "No blocks yet" + CTAs (Add card / Ingest sources).
  - [ ] Zoom & layout-warning affordances: verify icon buttons have `aria-label`s (full check Phase 5), warning overlays use `warning` token.
- [ ] `components/pdf-viewer.tsx` + `components/pdf-sidebar.tsx` — loading (✓ has `Loader2`), error (✓ "Failed to load PDF document.") — polish: error state gets **Retry** button; zoom controls `aria-label` audit (Phase 5); `FileDown`/`Maximize` buttons ring check.
- [ ] `components/agent-panel.tsx`
  - [ ] `StatusStrip`: add `aria-live="polite"` so running→done transitions are announced (full a11y in Phase 5).
  - [ ] Composer: verify disabled while streaming + `Loader2` in the send button.
  - [ ] Job list (queue): cancel buttons `aria-label="Cancel {name}"`; progress bar uses `Progress` primitive consistently.
- [ ] `components/manage-workspaces.tsx` — CRUD: all 4 catch blocks → `notify.error` with retry context (F1); delete already via `ConfirmDialog`? (verify; if inline, route through it); empty state for zero workspaces; `h1` is the only h1 on this page ✓.
- [ ] `components/share-workspace-dialog.tsx` — invite flow: 7 catch blocks → toasts (F1); "Copy link" → spinner + success toast; invalid role select validation.
- [ ] `components/bibliography-dialog.tsx`, `components/academic-search-dialog.tsx`, `components/equation-registry-dialog.tsx`, `components/scanner/image-ocr-dialog.tsx` — per-dialog: loading skeletons matching result-card layout, empty states with CTAs, error toasts (all use `pushEvent`-only or silent catches in places — verify each), dialog `max-h` + internal scroll so they don't clip on short screens.

**Gate:** §6 verification + Playwright specs covering touched flows: `features.spec.ts`, `ingestion.spec.ts`, `thesis-review.spec.ts`, `add-output-dialog.spec.ts`, `workspace-selection.spec.ts`. Manual: run each workflow end-to-end in light & dark (upload → parse → promote; generate card content; run review generation; share workspace).

---

## 5. Phase 4 — Async Feedback & Micro-interactions

**Goal:** every async action = disabled + spinner + exactly one outcome toast. Centralize wording.

**Files & tasks**

- [ ] **NEW** `lib/notify.ts` — §1.4 helper over Sonner (`success`/`error`/`warning` + `action` slot + 3 s dedupe for identical errors). Client-only guard so it stays importable from slices.
- [ ] `components/store/project-slice.ts` — mirror user-facing failures to `notify.error` (keep `pushEvent` for the agent log): `switchProject` (1008-1015 already pushes error events — add toast), `saveProject` (success toast "Saved" on ⌘S/manual save; failure toast), `duplicateProject`, `autoFillCardAction` / `autoFillAllCardsAction` (failure toast; keep progress events), `generateNewOutputStructure`, `convertOutputAction`, `aiReview`.
- [ ] `components/store/ingestion-slice.ts` — `uploadFiles` (per-file failure toast with file name), `processFile`/`retryFile` (failure toast + keep parse log), `removeFile`/`discardAsset` (undo action via `toast(..., { action: { label: "Undo" } })`).
- [ ] `components/store/bib-slice.ts`, `components/store/equation-slice.ts`, `components/store/ui-slice.ts` — same treatment for their async actions (audit each `pushEvent` site).
- [ ] `components/store/use-yjs.tsx` — keep connection state visual (avatar stack + solo pill) — **no toasts** for connect/disconnect (noisy); add one `notify.error` only for *unexpected* disconnect while editing (verify current behavior).
- [ ] Button call-site audit (disabled + `Loader2` per §1.4) — verify each:
  - [ ] `top-bar.tsx`: Save (✓), Export items (synchronous — none), Ingest/Scan/Academic openers (instant — none needed).
  - [ ] `card-inspector.tsx`: Save Project / Save Card (added Phase 3 — verify wiring), Delete (confirm `busy`).
  - [ ] `header-inspector.tsx`: Generate All, Generate structure, QR (✓).
  - [ ] `structure-sidebar.tsx`: Auto-Shrink (✓ already).
  - [ ] `manage-workspaces.tsx`: create/delete/rename rows (busy state per row).
  - [ ] `share-workspace-dialog.tsx`: send invite / copy link.
  - [ ] `workspace-selector.tsx`: open workspace (per-row spinner).
  - [ ] `thesis-review/*`: "Generate review", stage retry buttons, index build.
  - [ ] `command-palette.tsx`: items that trigger async actions close palette immediately (non-blocking, §3 UX principle) — verify + the action still toasts its outcome (Phase 4 slices guarantee this).
- [ ] Micro-interactions sweep: `hover:` on every clickable row/card (card rows ✓), `active:translate-y-px` (Button has it ✓), tooltip on every icon-only top-bar button (✓) — extend tooltips to icon-only buttons in `pdf-sidebar` / `figure-editor` where missing (low cost, high clarity).
- [ ] Optimistic updates: verify Yjs-driven edits render immediately (they do) — ensure failed server save *reverts visible indicator only* (isDirty), not content.

**Gate:** §6 verification + scripted pass: trigger a save with network killed (Playwright `route.abort`) → exactly one error toast, button re-enabled; repeat 3× → dedupe holds.

---

## 6. Phase 5 — Accessibility (a11y) Sweep

**Goal:** 100% keyboard navigable, zero icon buttons without accessible names, no heading-level skips, overlays trap focus.

**Files & tasks**

- [ ] **Focus management for custom overlays** (F4):
  - [ ] `ingestion/ingestion-drawer.tsx` — migrate to base-ui `Dialog` (asides → `DialogContent` with `align="end"` style) **or** add: initial focus to close button, `Tab` cycling (focus trap), Escape (✓ has it), focus return to "Ingest" trigger on close. Prefer migration if < ~50 line diff; else trap.
  - [ ] `history-panel.tsx` — same (Escape wired in Phase 2; trap + focus return here).
  - [ ] `workspace-selector.tsx` — same.
- [ ] **Icon-only button accessible names** (audit all 43 `size="icon*"` usages + raw icon `<button>`s):
  - [ ] `structure-sidebar.tsx` search-clear (done in Phase 2 — verify).
  - [ ] `pdf-sidebar.tsx`: `Minus`/`Plus`/`FileDown`/`Maximize`/`ChevronDown` — each `aria-label` ("Zoom out", "Zoom in", "Download PDF", "Open in tab", collapse).
  - [ ] `pdf-viewer.tsx`: toolbar controls (page nav, zoom, rotate) — labels + `aria-valuenow` on the zoom control (`role="slider"` or labeled buttons).
  - [ ] `agent-panel.tsx`: `PanelRightClose`, `Undo2`, job cancel `XCircle`.
  - [ ] `figure-editor.tsx`, `promote-popover.tsx`, `equation-registry-dialog.tsx`, `image-ocr-dialog.tsx`: every close/rotate/crop/delete icon.
  - [ ] Repo rule: an icon-only `Button` without `aria-label` or adjacent text is a lint violation — add a tiny ESLint rule or a `pnpm lint:a11y` grep script to `scripts/` to keep this at zero going forward.
- [ ] **Heading hierarchy** (F8) — target map: one `h1` per top-level page/dialog surface (manage-workspaces ✓, dialog `DialogTitle` serves as the accessible title), `h2` = panel/section, `h3` = subsection, `h4` = item. Fixes:
  - [ ] `ingestion/ingestion-drawer.tsx` (h2 → h3 → **h4** asset titles) + `ingestion/asset-list.tsx` h5s (done in Phase 3 — verify no residual skips).
  - [ ] `bibliography-dialog.tsx`: h3 → h4 → h3 → h4 sequence (328, 480, 576, 623, 654) — flatten to one consistent level per nesting depth.
  - [ ] `help-modal.tsx`: h4 sections are fine *within the dialog* — document.
  - [ ] `thesis-review/*` panels: verify each panel's top title is a single level below the workspace h2; item cards h4 (finding-card ✓).
  - [ ] `template-header.tsx` `h2` (poster card title inside the *rendered poster*) — decorative duplicate of card inspector title: change to `p` (it's canvas content, not page structure).
- [ ] **Live regions:**
  - [ ] `agent-panel.tsx` `StatusStrip` → `aria-live="polite"` (started in Phase 3 — verify).
  - [ ] Save indicator (`isSaving`) → keep visual-only (toasts announce, avoids chatter).
  - [ ] Loading skeletons keep `role="status"` (structure-sidebar ✓; ensure new Phase 3 skeletons inherit it).
- [ ] **Forms:** verify every `Input`/`Textarea`/`Select` in `card-inspector.tsx`, `header-inspector.tsx`, `settings-panel.tsx`, `thesis-metadata-panel.tsx`, `rubric-template-modal.tsx`, `supervisor-signoff-panel.tsx`, `share-workspace-dialog.tsx` has a programmatic label (`Label htmlFor` + `id`) or `aria-label`; error text linked via `aria-describedby` where validation exists (`hasUnsafeLatex` messages).
- [ ] **Keyboard flows to script-test** (Playwright, keyboard-only):
  - [ ] ⌘K palette: arrow/enter/escape.
  - [ ] Structure sidebar: Tab to card row → Enter selects → Tab to trash → Enter (confirm dialog → Tab to Delete → Enter).
  - [ ] Ingestion drawer: open via keyboard, Tab cycles inside, Escape closes, focus returns to Ingest button.
  - [ ] Tabs in right sidebar & card inspector: arrow-key navigation (base-ui ✓ — verify).
  - [ ] Every dialog: Tab trap, Escape, focus return.
- [ ] **Contrast & text size audit:** `text-muted-foreground/60|/70|/80` opacity stacks (e.g. `structure-sidebar.tsx` dt `text-muted-foreground/70`, `status.tsx` none) — remove opacity stacking below ~4.5:1 (check in dark + vercel themes); `text-[9px]` (`CardTypeBadge`, some ingestion labels) → bump to `text-[10px]` min; `text-[10px]` kept only for truly secondary mono metadata.
- [ ] **Semantic roles:** card rows are `role="button"` divs with Enter/Space handling (✓) — verify focus order; `role="group"` on avatar stack ✓; `role="presentation"` on decorative icon wrappers.
- [ ] Add `aria-hidden` to all decorative `lucide` icons that aren't the sole content of a labeled control (spot check; `Button` already sets `[&_svg]:pointer-events-none` but not `aria-hidden` — add global `[&_svg:not([aria-label])]:aria-hidden`? Prefer: per-use `aria-hidden` in the top-traffic components only, to avoid surprises).
- [ ] Final pass: `lang` (en ✓), `color-scheme` ✓, document title, `prefers-reduced-motion` ✓ (verify nothing new violates it).

**Gate:** §6 verification + full keyboard script + contrast spot-checks in all 5 themes.

---

## 7. Per-phase verification gate (all phases)

1. `pnpm lint` — zero new warnings.
2. `pnpm typecheck` — clean.
3. `pnpm test` (vitest) — green; if a touched component has unit tests, update assertions (e.g. removed `workspaces` fetch).
4. Targeted Playwright: run the specs listed under the phase's gate (requires local Postgres: `pnpm start:db`; auth bypass via `NEXT_PUBLIC_E2E_TEST=1`).
5. Manual visual matrix (dev server): **light / dark / vercel / vercel-dark / midnight** × **320 / 768 / 1280 px** for every view touched; check: focus rings visible in each theme, no raw-palette colors remain in touched files (`grep -nE "(text|bg|border|fill)-(blue|green|red|purple|slate|zinc|amber|gray)-" <touched files>` → zero), no layout shift on load (skeletons match), toasts exactly one per action.
6. No dead code introduced/kept (knip if quick): removed `workspaces` fetch, removed dead scrollbar classes.

## 8. Commit strategy

| Phase | Commit message |
|-------|----------------|
| 1 | `ui(polish): standardize primitives, tokens, focus rings, global scrollbars (Phase 1/5)` |
| 2 | `ui(polish): stabilize shell, top bar, sidebars — responsive + no layout shift (Phase 2/5)` |
| 3 | `ui(polish): core workflows — empty states, skeletons, confirm dialogs, tokenized thesis review (Phase 3/5)` |
| 4 | `ui(polish): async feedback — notify() helper, slice error toasts, spinner parity (Phase 4/5)` |
| 5 | `ui(polish): accessibility — focus traps, aria-labels, heading hierarchy, live regions (Phase 5/5)` |

Push after each phase to `arena/01a06985-posterapp`; no PR until Phase 5 is green.

## 9. Explicitly out of scope

- Backend/API changes, Prisma schema, AI prompt changes.
- New i18n framework (inline `{sk,cs,en}` pattern is kept).
- Redesign of the poster canvas rendering (LaTeX→PDF pipeline) — only its chrome/status UI.
- Performance work (bundle size, lazy loading) except where a loading state requires it.
- New Playwright accessibility tooling (axe) — the grep-lint script for aria-labels in Phase 5 is the only new check.

## 10. Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| base-ui `Dialog` migration of IngestionDrawer changes DOM structure and could break PDF/asset reflows | Decide migrate-vs-trap on line-count of the diff at execution time; run `ingestion.spec.ts` immediately after |
| Thesis-review tokenization touches ~16 files → large diff | Sub-blocks A–D executed sequentially within the phase commit; per-sub-block `git diff --stat` review; theme spot-check after each sub-block |
| Toast dedupe could swallow distinct-but-similar errors | Dedupe key = title + description, 3 s window; errors from different cards/assets have different descriptions |
| Global `scrollbar-color` on `*` could affect the PDF canvas scrollbar | Scope webkit rules to `:not(.pdf-canvas *)` if react-pdf renders native scrollbars (verify during Phase 1) |
