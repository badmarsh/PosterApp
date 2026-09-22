# Template Unification — Architecture & Refactoring Plan

**Date:** 2026-09-22 · **Scope:** `lib/output-types.ts`, `lib/latex/**`, `lib/showcases-data.ts`,
`components/research-lab-templates.tsx`, `lib/template-preview-art.ts`, `lib/templates/unified-registry.ts`
· **Status:** phase 1 shipped; phases 2–3 planned.

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

### Phase 2 — route the generators through the registry
- Replace the string `switch`es in `generator-poster/slides/paper.ts` with a lookup keyed by
  `TemplateDefinition.createGenerator()`. This deletes the duplicated `templateId → preamble`
  mapping and makes the registry the only dispatch table.
- Move each LaTeX preamble into a `TemplateDefinition.latex.preamble(project, ctx)` closure (or
  keep `lib/latex/templates.ts` functions but reference them from the registry), so a template can
  no longer be “registered but unwired”.

### Phase 3 — derive demo workspaces from scaffolds
- Generate the `lib/showcases-data.ts` card graphs from `defaultCards` + curated content, instead
  of hand-maintained JSON. The demos then inherit template constraints (patterns, column budgets)
  by construction.
- Validate `components/research-lab-templates.tsx` `SeedCard.pattern` values against
  `PATTERNS_FOR_TYPE` at build time (they currently use ad-hoc `"methods"`/`"results"` labels).

## 4. What we deliberately did NOT do

- We did **not** move the LaTeX preamble strings into the registry yet (phase 2) — that is a large
  mechanical change best done behind the new dispatch table.
- We did **not** change the DB schema; templates remain a code-level registry, which matches the
  current Prisma model (`Output.templateId` is a string, not an FK).

## 5. Validation

- `lib/templates/__tests__/unified-registry.test.ts` — registry ↔ generator ↔ art ↔ scaffold
  contract, plus “every demo workspace `templateId` resolves”.
- `lib/latex/__tests__/template-static-audit.test.ts` — every registered template generates a
  structurally clean document (see `lib/latex/static-checks.ts`).
