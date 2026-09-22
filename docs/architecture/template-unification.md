# Template Unification — Architecture & Refactoring Plan

**Date:** 2026-09-22 · **Scope:** `lib/output-types.ts`, `lib/latex/**`, `lib/showcases-data.ts`,
`components/research-lab-templates.tsx`, `lib/template-preview-art.ts`, `lib/templates/unified-registry.ts`
· **Status:** phases 1–2 shipped; phase 3 planned.

## 1. The problem

The concept “an output template” was maintained in **four independent stores** that could (and
did) drift apart:

| Store | File(s) | What it carries | Drift risk |
|---|---|---|---|
| UI registry | `lib/output-types.ts` `TEMPLATE_REGISTRY` | label, palette, layout preview, `requiresClass`, description | High |
| LaTeX generators | `lib/latex/templates.ts` + `generator-poster/slides/paper.ts` | the actual preamble; wired by **string `switch`es** | High — a registry entry with no `switch` branch silently falls back to a default |
| Demo workspaces | `lib/showcases-data.ts`, `components/research-lab-templates.tsx` | full hand-written `Project` card graphs referencing a `templateId` (e.g. `"atlas"`) with **no schema link** back to the template | Medium — demos were designed *around* a template but don’t declare the constraint |
| Preview art | `components/poster-preview.tsx` (4 generic schematics) | `layoutPreview` enum → generic diagram | Medium — every poster looked identical |

Concrete symptoms this audit found, all traceable to the split:

1. `a0poster` was fully implemented in the LaTeX generator but **never registered** in the UI
   (dead in the picker). It also carried a fatal `\definecolor`-without-`xcolor` bug that went
   unnoticed because nothing exercised it.
2. The registry declares `requiresClass`, but the compile pipeline and the demos never consult a
   single place, so “which class does this need?” had three different answers.
3. Demo workspaces hard-code `templateId` strings; a rename of a LaTeX template would break them
   with a type-level silence (they are `as const` objects, not validated).
4. Preview artwork was keyed by a 4-value enum, so adding a distinctive template (`aurora`,
   `editorial`) added nothing visual in the picker.

## 2. Recommended architecture

A single **`TemplateDefinition`** record per template that *composes* the existing pieces rather
than replacing them in one risky change. It is the only object that knows, for one template:

```
TemplateDefinition
 ├─ meta:        TemplateDef              // existing UI registry shape (unchanged)
 ├─ colors:      TemplateColor[]
 ├─ latexClass:  string
 ├─ createGenerator(): LatexGenerator     // the actual LaTeX emitter (closes the switch gap)
 ├─ previewArt:  TemplatePreviewArt       // bespoke, palette-driven artwork
 ├─ renderPreview(width): string          // SVG
 └─ defaultCards: ScaffoldCard[]          // seed layout, validated per output type
```

Implemented in `lib/templates/unified-registry.ts`. It is built by **composing** the four stores,
so nothing moved and existing call sites keep working.

The key structural guarantee the registry enforces (and tests): **every registered id resolves to
a generator of the matching output type, has preview art, and offers a legal scaffold** — i.e. the
“registry entry with no generator branch” class of bug is now impossible to ship.

## 3. Migration plan (phased)

### Phase 1 — done (this change)
- `lib/template-preview-art.ts`: declarative per-template art + renderer (SVG).
- `scripts/generate-template-previews.mjs`: writes `public/template-previews/<id>.{svg,png}`.
- `components/poster-preview.tsx`: detail panel now shows the bespoke asset (`TemplatePreview`),
  falling back to the generic diagram if absent.
- `lib/templates/unified-registry.ts` + tests: the composed `TemplateDefinition`.
- New templates `aurora` (poster) and `beamer-editorial` (slides) registered end-to-end.

### Phase 2 — done (2026-09-22): route the generators through the registry
- Created `lib/latex/template-map.ts` as the single `templateId → preamble` dispatch table
  (`POSTER_PREAMBLE_BY_ID`, `SLIDES_PREAMBLE_BY_ID`, `PAPER_PREAMBLE_BY_ID` with helpers
  `getPosterPreamble`/`getSlidesPreamble`/`getPaperPreamble`).
- Replaced the duplicated string `switch`es in `generator-poster.ts` / `generator-slides.ts` /
  `generator-paper.ts` with lookups via `template-map.ts`; the generators no longer contain
  hard-coded preamble wiring.
- Extended `lib/templates/unified-registry.ts` to expose `TemplateDefinition.getPreamble()` and
  to build `createGenerator()` via direct class instantiation (no `require("@/lib/latex/generator")`
  cycle); the registry now composes `template-map.ts` and is the single source of truth for
  `templateId` resolution, preamble, generator, preview art, and scaffold.
- Added validation that every `TEMPLATE_REGISTRY` entry resolves to a preamble and a generator
  (covered by `lib/templates/__tests__/unified-registry.test.ts` + `lib/latex/__tests__/template-static-audit.test.ts`).

### Phase 3 — derive demo workspaces from scaffolds
- Generate the `lib/showcases-data.ts` card graphs from `defaultCards` + curated content, instead
  of hand-maintained JSON. The demos then inherit template constraints (patterns, column budgets)
  by construction.
- Validate `components/research-lab-templates.tsx` `SeedCard.pattern` values against
  `PATTERNS_FOR_TYPE` at build time (they currently use ad-hoc `"methods"`/`"results"` labels).

## 4. What we deliberately did NOT do (updated)

- Phase 2 kept the preamble strings in `lib/latex/templates.ts` and re-exported them via
  `lib/latex/template-map.ts` rather than inlining them into `unified-registry.ts`; this avoids
  a single massive file while still making the registry the only dispatch table.
- We did **not** change the DB schema; templates remain a code-level registry, which matches the
  current Prisma model (`Output.templateId` is a string, not an FK).

## 5. Validation

- `lib/templates/__tests__/unified-registry.test.ts` — registry ↔ generator ↔ art ↔ scaffold
  contract, plus “every demo workspace `templateId` resolves”.
- `lib/latex/__tests__/template-static-audit.test.ts` — every registered template generates a
  structurally clean document (see `lib/latex/static-checks.ts`).
