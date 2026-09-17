#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

corepack pnpm exec vitest run \
  lib/latex/__tests__/parser.test.ts \
  lib/latex/__tests__/encoding-preamble.test.ts \
  lib/latex/__tests__/template-registry.test.ts \
  lib/latex/__tests__/generator.test.ts \
  lib/latex/__tests__/figure-generation.test.ts \
  lib/latex/__tests__/layout-budget.test.ts \
  lib/latex/__tests__/generator-thesis-review.test.ts \
  lib/__tests__/academic-checks.test.ts \
  lib/__tests__/evidence-validator.test.ts \
  lib/__tests__/review-composer.test.ts \
  lib/__tests__/review-engine-grading.test.ts \
  lib/__tests__/professional-mode-default.test.ts \
  lib/__tests__/phd-enrichment-institution.test.ts \
  lib/__tests__/vector-rag-pipeline.test.ts \
  __tests__/lib/docx-confidential.test.ts \
  __tests__/api/workspace-isolation.test.ts

corepack pnpm exec tsc --noEmit --pretty false
