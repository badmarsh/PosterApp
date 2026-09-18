# PosterApp UI excellence audit

**Audit date:** 2026-09-18  
**Branch:** `arena/01a0b1ce-posterapp`  
**Feature commit:** `c1e931b` (`feat: upgrade grounded poster editing UX`)

## Executive summary

PosterApp's editor now treats generated poster content as grounded, structured data instead of unlabelled text. Card generation persists citation evidence, suggested assets, and layout truth; the preview and inspector expose those records as source-jump chips, attachable suggestions, budget deltas, and an auto-shrink action.

The UI was decomposed without moving Zustand state out of `components/store/`, and the preview now has a responsive sheet/pane shell below the 1280px desktop breakpoint. The editor chrome has one typed Slovak/Czech/English dictionary and a visible language switcher. Preview Markdown/LaTeX remains CSP-safe: ReactMarkdown is used instead of HTML injection, raw Markdown is sanitized before KaTeX, and KaTeX is configured with `trust: false`.

The audit also completed a semantic-token sweep across production `app/`, `components/`, and `lib/` source. The supported theme tokens were recalibrated and checked against WCAG 2.2 AA's 4.5:1 normal-text threshold. The verification matrix is below.

## Refactoring and design-system metrics

| Area | Result |
| --- | --- |
| Feature files changed from `main` (`5730cb4` → `c1e931b`) | 37 files, +2,129 / -1,043 lines |
| Follow-up audit changes before this report | 25 files, +298 / -247 lines, including token cleanup, sanitizer hardening, SVG color cleanup, and stale test corrections |
| Preview decomposition | 5 live modules: `poster-canvas`, `slide-deck-view`, `paper-document-view`, `preview-toolbar`, `column-occupancy-meter` |
| Inspector decomposition | 5 live modules: `content-tab`, `figures-tab`, `table-tab`, `validation-tab`, `quick-fixes-panel` |
| Grounding UI modules | `evidence-chip`, `layout-truth-banner`, `suggested-assets-tray` |
| State architecture | Project/UI/collaboration behavior remains in `components/store/`; no Redux/Jotai replacement |
| UI languages | `sk`, `cs`, `en` in `lib/i18n/ui.ts`; switcher in `components/language-switcher.tsx` |
| New runtime dependency | `rehype-sanitize@6.0.0`; no heavy UI library added |
| Production hardcoded Tailwind palette scan | No palette utility matches in production source; the only remaining match is a negative assertion in `lib/__tests__/ux-polish.test.ts` |
| Accessibility script | `lint:a11y` reports all icon-only controls have accessible names |

## Theme contrast matrix

The matrix uses the computed OKLCH values in `app/globals.css`, converts them to sRGB, and calculates WCAG relative-luminance contrast. Each column is a semantic foreground/background pair used by a solid control or status surface. Values are ratios; **all values are at least 4.50:1** for normal text.

| Theme | foreground / background | primary | muted | accent | success | warning | info | destructive | risk | minimum |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| root | 7.35 | 4.79 | 4.52 | 5.98 | 4.60 | 4.70 | 4.54 | 4.87 | 4.93 | **4.52** |
| dark | 8.72 | 7.60 | 4.95 | 4.71 | 7.79 | 8.10 | 7.43 | 7.47 | 7.50 | **4.71** |
| vercel | 21.00 | 21.00 | 4.60 | 19.69 | 4.62 | 4.67 | 4.58 | 4.73 | 4.66 | **4.58** |
| vercel-dark | 21.00 | 21.00 | 7.63 | 12.29 | 10.60 | 10.97 | 12.92 | 6.53 | 9.71 | **6.53** |
| midnight | 11.57 | 7.81 | 4.57 | 5.45 | 7.94 | 8.23 | 8.59 | 7.58 | 7.59 | **4.57** |
| forest | 6.29 | 4.58 | 4.67 | 4.68 | 4.58 | 4.60 | 4.70 | 4.87 | 4.93 | **4.58** |
| ocean | 6.66 | 4.60 | 4.67 | 4.54 | 4.58 | 4.60 | 5.25 | 4.87 | 4.93 | **4.54** |
| plum | 6.38 | 4.76 | 4.54 | 6.26 | 4.58 | 4.60 | 4.54 | 4.87 | 4.93 | **4.54** |
| ember | 8.68 | 4.88 | 4.55 | 4.54 | 5.17 | 5.54 | 4.88 | 11.29 | 4.80 | **4.54** |
| sage | 9.37 | 5.40 | 4.73 | 4.58 | 5.54 | 5.58 | 4.87 | 10.65 | 4.80 | **4.58** |

The light themes use darker semantic status colors for text and light foreground tokens for solid badges/buttons. Dark themes use bright status colors with ink foregrounds. Sidebar primary/accent pairs are aliases of the audited primary/accent pairs so the same guarantee applies to the navigation chrome.

## Feature journeys

### 1. Generate → ground → inspect → cite

1. `POST /api/workspaces/[id]/cards/[cardId]/generate` retrieves RAG chunks and persists `grounding.citations`, evidence anchors/quotes, suggested assets, and layout metadata.
2. `CardInspector`'s content and figures tabs render `EvidenceChip` and `SuggestedAssetsTray`.
3. An evidence chip opens a text-only excerpt popover; **Jump to source excerpt** dispatches a scoped event consumed by `SourceMarkdownView` and scrolls to the matching source anchor.
4. An asset suggestion can be attached with one action through the project slice; the attached state disables the action to prevent duplicate insertion.

### 2. Edit a compact poster without leaving the canvas

1. Double-clicking a card title/body in `poster-preview.tsx` opens the inline draft controls.
2. The preview renders compact card content with ReactMarkdown + `remark-math` + KaTeX (`throwOnError: false`, `strict: false`, `trust: false`).
3. `ColumnOccupancyMeter` turns estimated column height into an accessible meter/heatmap, with semantic success/warning/destructive tones and an over-budget marker.
4. The preview toolbar exposes layout truth, over-budget deltas, compile state, and a one-click auto-shrink path backed by `project-slice.ts`.

### 3. Thesis review triage → grade rationale → confirm

1. The expert review workspace keeps severity/status triage visible and preserves the existing dirty-save guard.
2. Findings remain human-reviewable and auditable; the grade derivation popover shows rubric score, finding score, mapped ECTS grade, and proposed range before confirmation.
3. The reviewer confirms the final grade/recommendation explicitly; existing Defense Pack, timer, and badge behavior remains intact.

### 4. Collaboration presence and safe sync

1. Collaboration stays opt-in in the UI slice and obtains a same-origin short-lived ticket.
2. `use-yjs.tsx` connects to `/api/yjs` on the current preview origin, publishes cursor/user awareness, and renders collaborator presence through `CollaboratorsLayer`.
3. Remote card/output/review changes hydrate through the Zustand store while local edits remain protected by the existing dirty and reconnect behavior.
4. The server validates workspace access before accepting a Yjs upgrade; no browser code calls `localhost` for the browser-facing connection.

### 5. Responsive and multilingual chrome

1. At `min-width: 1280px`, the existing multi-sidebar desktop layout remains available.
2. Below that breakpoint, the shell uses sheet/drawer ergonomics and mobile navigation controls; the poster surface remains horizontally scrollable instead of forcing the whole page to overflow.
3. The language switcher is visible in the top bar and updates the typed editor UI dictionary for `sk`, `cs`, and `en` without altering manuscript/generated content.

## Security and CSP review

- No new `dangerouslySetInnerHTML` was introduced.
- `InlineCardContent` and `SourceMarkdownView` render through ReactMarkdown component mappings.
- `SourceMarkdownView` now uses `rehypeRaw → rehypeSanitize → rehypeKatex`, with KaTeX `trust: false`.
- Grounding quotes, headings, filenames, and evidence labels are rendered as text nodes.
- Browser collaboration uses same-origin relative fetch/WebSocket paths; no `localhost` dependency is present in browser-facing code.
- Existing shipped CSP, dirty-check, confirmation, LaTeX Error Lens, Quick Fixes v2, Defense Pack, credibility/retraction, PDF virtualization, and keyboard shortcut behavior was retained rather than reimplemented.

## Verification log

| Command / check | Result |
| --- | --- |
| `corepack pnpm test -- --run` | **PASS** — 140 files, 1,359 passed, 1 skipped (1,360 total) |
| `corepack pnpm exec vitest run lib/__tests__/ux-polish.test.ts __tests__/api/cards-generate-rag.test.ts` | **PASS** — 2 files, 35 tests |
| `corepack pnpm run lint` | **PASS** — 0 errors, 248 existing warning-level `any`/a11y-style findings |
| `corepack pnpm run lint:a11y` | **PASS** — all icon-only controls have accessible names |
| `git diff --check` | **PASS** |
| Direct custom server smoke (`HOST=0.0.0.0 PORT=3333 pnpm exec tsx server.ts`) | **PASS** — server listened on `0.0.0.0:3333`; `/healthz` returned `200` JSON |
| `corepack pnpm run typecheck` | **BLOCKED** — local generated Prisma client is the 3.9 KB fallback stub; it lacks the schema model/types and produces baseline implicit-any/Prisma namespace errors |
| `corepack pnpm run build` | **BLOCKED after compilation** — Next.js optimized compilation passed; TypeScript stopped on the same incomplete generated Prisma client |
| `corepack pnpm exec prisma generate` | **BLOCKED by environment** — Prisma engine download from `binaries.prisma.sh`/S3 fails TLS/network resolution in this sandbox |
| Authenticated UI route smoke | **BLOCKED by environment** — no Clerk publishable key is present; `/healthz` is healthy, while protected page rendering reports Clerk's expected missing-key error |

The build/typecheck blockers are environmental and pre-existing to the UI changes: run Prisma generation in a network-enabled checkout, then rerun the two commands above before merging. The optimized Next.js compilation stage passed with the updated CSS, decomposed components, sanitizer, and semantic classes.

## Acceptance mapping

- Grounded card metadata and evidence affordances: **implemented and covered by API/UI tests**.
- Preview/inspector decomposition with prop parity: **implemented and checked by `ux-polish.test.ts`**.
- Four UX upgrades: **implemented** — inline math quick-edit, occupancy heatmap, thesis grade breakdown/triage, and collaboration presence; existing LaTeX error markers remain integrated.
- Semantic tokens and theme audit: **implemented; matrix minimum 4.50:1**.
- `sk`/`cs`/`en` UI dictionary and visible switcher: **implemented**.
- Sub-1280px sheet ergonomics and responsive preview: **implemented**.
- Zustand/CSP/XSS constraints: **implemented and reviewed**.
- Required verification: **tests/lint/a11y green; typecheck/build await Prisma engine generation in a network-enabled environment**.
