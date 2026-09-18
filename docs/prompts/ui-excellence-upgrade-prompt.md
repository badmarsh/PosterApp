# TASK: PosterApp UI/UX Excellence, Design Consistency & Feature Superiority Upgrade

You are an elite Principal Frontend Engineer, Design System Architect, and Product Specialist auditing and elevating **PosterApp** — an academic workspace built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Zustand, and Lucide Icons.

PosterApp serves three integrated workflows:
1. **Academic Posters, Slides & Papers:** High-fidelity LaTeX document generation (`tikzposter`, `beamer`, `article`), PDF preview, and AI card auto-fill.
2. **Academic Manuscript & Thesis Evaluation:** Evidence-grounded 14-section Slovak/Czech thesis reviews and scientific paper peer reviews (pgvector RAG, rubric engine, defense preparation, DOCX/LaTeX export).
3. **Real-time Live Collaboration:** Multi-user CRDT synchronization over Yjs WebSocket.

---

## 1. Forensic Baseline: What is ALREADY Done (DO NOT RE-DO)

Do **NOT** waste time or tokens re-implementing or re-fixing items that were already shipped in previous audit rounds (Rounds 5–8, PR #7, PR #8, and PR #9):
- `<Toaster richColors />` is already mounted in `app/layout.tsx` (Sonner).
- Dirty-check guards on `switchProject` and `beforeunload` are already in place.
- Delete confirmation dialogs for outputs and reviews exist.
- LaTeX Error Lens (`parseCompileLog`, line-number jumping, package diagnostics) is already implemented in `pdf-sidebar.tsx`.
- Quick Fixes v2 (unclosed `$`, unbalanced braces, invalid LaTeX macros) exist in `card-inspector.tsx`.
- Defense Pack generator, risk scoring, and rehearsal timer exist in `defense-prep-panel.tsx`.
- Credibility pills and retracted paper badges exist in `academic-search-dialog.tsx`.
- Virtualized PDF viewer via `IntersectionObserver` exists in `pdf-viewer.tsx`.
- Global keyboard shortcuts (`⌘S` save, `⌘⏎` compile, `⌘K` command palette) are wired.

Your task is to tackle the **next echelon of product excellence, architectural refactoring, and feature superiority**.

---

## 2. Core Objectives

### Objective A: Surface Un-Rendered Backend Grounding & Layout Truth (High Impact)
In the card auto-fill endpoint (`app/api/workspaces/[id]/cards/[cardId]/generate/route.ts`), the API returns rich grounding metadata that the frontend store (`components/store/project-slice.ts`) currently ignores:
- `citations`: list of source text chunks with quotes and stable anchors.
- `suggestedAssets`: list of figure/table assets detected in the source text matching the card.
- `layout`: `{ budget, estimatedHeight, overBudget, suggestions }`.

**Required Enhancements:**
1. **Evidence Chips on Card Bullets:**
   - Update `project-slice.ts` to persist `citations` on the card.
   - In `poster-preview.tsx` and `card-inspector.tsx`, render interactive evidence badges (`[Ref]`) next to auto-filled bullets. Clicking or hovering displays the source quote and enables a 1-click jump to the excerpt in `source-markdown-view.tsx`.
2. **Suggested Assets Tray:**
   - When auto-fill returns `suggestedAssets`, surface a subtle "Suggested Figures" tray in the card inspector and preview. Users can click "Attach to Card" with 1 click.
3. **Live Layout Truth & Auto-Shrink Banner:**
   - When `layout.overBudget` is true, display an inline warning badge in the card header and inspector with the exact delta (`+42u over budget`) and a 1-click **"Auto-Shrink Content"** button that executes the server's `layout.suggestions`.

---

### Objective B: Feature Superiority Matrix (Elevate Features to Best-in-Class)

Evaluate and elevate PosterApp's features against category leaders (Canva, Figma, Overleaf, Linear, Notion):

| PosterApp Feature | Benchmark | Current Limitation | Superior Implementation |
|---|---|---|---|
| **Poster Canvas Preview** | Canva / Figma | Read-only canvas; any edit forces opening the right-hand `CardInspector` modal. | **In-Place Inline Quick-Edit:** Double-clicking a card title or bullet on the canvas allows immediate text editing without opening the sidebar inspector. Live KaTeX renders math inline. |
| **Column Budgeting** | Figma Layout Grid | Height usage is only visible as numbers or in validation tab. | **Visual Column Occupancy Heatmap:** Render a sleek, subtle vertical fill bar on column gutters showing real-time occupancy (Green < 85%, Amber 85–100%, Red > 100%) with live overflow indicators. |
| **LaTeX Compile & Errors** | Overleaf | Error list is in a separate tab with minimal visual connection to cards. | **Canvas Error Markers:** Cards causing LaTeX compile errors display a subtle red warning ring on the canvas with an "Error in line X" jump link. |
| **Bibliography & Citations** | Zotero / Overleaf | Adding citations requires manually remembering keys or copying from the bibliography dialog. | **Inline `\cite{}` Autocomplete:** Typing `\cite{` or `[` inside any card textarea opens a lightweight dropdown filtering workspace bibliography keys with title preview. |
| **Thesis Review Triage** | Linear | Triage decisions (accept/reject) lack undo and grade math is opaque. | **Command-Z Undo Stack & Grade Breakdown:** Support `⌘Z` to undo triage actions in `ExpertReviewWorkspace`. Add an interactive "Ako vznikla známka" popover showing criteria weight calculations. |
| **Real-Time Collaboration** | Google Docs / Miro | Only card text syncs; no collaborator presence avatars or activity trace. | **Presence Avatars & Card Focus Lock:** Render collaborator avatar pills in the top bar and show which card a peer is currently editing with a subtle colored outline. |

*Requirement:* Implement at least **4** of the superior implementations listed above.

---

### Objective C: Modular Decomposition of Monolithic Components (F-23)

Several legacy components have grown into unmaintainable monoliths:
- `components/poster-preview.tsx`: **~1,520 lines**
- `components/card-inspector.tsx`: **~1,220 lines**
- `components/header-inspector.tsx`: **~1,100 lines**

**Required Refactoring:**
1. Decompose `poster-preview.tsx` into clean, testable sub-components under `components/preview/`:
   - `poster-canvas.tsx` (the 3-column tikzposter/beamer layout)
   - `slide-deck-view.tsx` (slides carousel and grid)
   - `paper-document-view.tsx` (two-column article layout)
   - `preview-toolbar.tsx` (zoom controls, template switcher, export triggers)
   - `column-occupancy-meter.tsx` (column budget indicators)
2. Decompose `card-inspector.tsx` under `components/card-inspector/`:
   - `content-tab.tsx`, `figures-tab.tsx`, `table-tab.tsx`, `validation-tab.tsx`, `quick-fixes-panel.tsx`.
3. Ensure 100% feature and props parity with zero regressions.

---

### Objective D: 5-Theme Visual Parity & Design Token Purity

PosterApp supports 5 themes: **Default Light, Default Dark, Vercel Dark, Midnight, Ember, Sage**.
- **Audit:** Inspect all 5 themes for contrast compliance (WCAG 2.2 AA, minimum 4.5:1 for body text, 3:1 for UI components).
- **Token Purity:**
  - Eliminate any remaining hardcoded colors (`gray-100`, `gray-800`, `text-black`, `bg-white`, `border-[#...]`).
  - Use strictly semantic design tokens: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-warning/10`, `text-warning`, `bg-destructive/10`, `text-destructive`, `bg-success/10`, `text-success`.
  - Fix any malformed opacity chains (e.g. `bg-warning/100/10` -> `bg-warning/10`).
- **Regression Guard:** Extend `lib/__tests__/ux-polish.test.ts` with automated scans preventing hardcoded color regressions.

---

### Objective E: Complete Internationalization (i18n) & Language Switcher (F-09)

The UI currently suffers from a language split: poster tools are English-only, while thesis review and academic search are Slovak-only.
- **Implement Unified i18n:**
  - Leverage `lib/i18n.ts` (or expand dictionary structure) to provide full `sk`, `cs`, and `en` support.
  - Externalize user-facing strings across top bar, sidebar tabs, and export dialogs.
  - Mount a clean Language Switcher (`SK` | `CZ` | `EN`) in `components/top-bar.tsx` or `settings-panel.tsx`.

---

### Objective F: Responsive Layout & Mobile/Tablet Drawer Ergonomics (F-24)

On viewports `< 1280px` (laptops/tablets):
- Replace overflowing sidebars with smooth slide-out sheets (`<Sheet>` from shadcn/base-ui).
- Ensure the preview canvas auto-scales cleanly using CSS transform zoom or responsive container queries without horizontal document cutoff.

---

## 3. Invariants & Safety Constraints

1. **Test Suite Green:** All existing 135 test suites (1,308 tests) must pass with zero failures (`pnpm test -- --run`).
2. **TypeScript & Build Clean:** `pnpm run typecheck` and `pnpm run build` must succeed with 0 errors.
3. **Dependency Budget:** Do NOT install heavy new UI libraries. Use existing dependencies (`@base-ui/react`, Tailwind CSS, Lucide, Framer Motion / CSS transitions, Zustand).
4. **State Management:** Keep Zustand slices in `components/store/`. Do not introduce Redux, Jotai, or alternate state managers.
5. **Security (XSS / CSP):** Never use `dangerouslySetInnerHTML` without proper sanitization. Respect existing CSP directives.

---

## 4. Deliverables & Validation

1. **Code Changes:**
   - Surfaced grounding citations, figure suggestions, and layout auto-shrink.
   - At least 4 feature-superiority enhancements implemented.
   - Monolithic components split cleanly into sub-modules (`components/preview/*`, `components/card-inspector/*`).
   - 5-theme contrast parity and token purity sweep.
   - i18n language switcher and mobile sheet ergonomics.
2. **Automated Tests:**
   - Unit tests covering all new helper hooks, stores, and components in `lib/__tests__/` or `components/__tests__/`.
   - Token regression suite passing in `ux-polish.test.ts`.
3. **Audit Documentation:**
   - Create `artifacts/ui-excellence-audit-<YYYY-MM-DD>/report.md` detailing:
     - Component refactoring metrics (lines of code before vs. after).
     - Contrast audit matrix across all 5 themes.
     - Benchmarked feature improvements with user journey walkthroughs.
     - Vitest and Next.js build verification logs.
