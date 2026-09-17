#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

# Generated LaTeX templates must not contain doubled command prefixes.
if grep -nE '^\\\\\\\\(documentclass|usepackage|begin|end|section|title|author)' lib/latex/templates.ts; then
  echo "ERROR: doubled LaTeX command prefix found" >&2
  exit 1
fi

# Stable evidence anchors must remain identity-derived at every RAG call site.
rg -q 'stableEvidenceAnchor\(ch\.id\)' lib/ai/review-pipeline.ts
rg -q 'stableEvidenceAnchor\(c\.id\)' lib/ai/agentic-review.ts

# Paper exports must carry paper terminology and AI disclosure protections.
rg -q 'reviewKind.*paper' lib/latex/generator-thesis-review.ts
rg -q 'AI Assistance Disclosure' lib/docx/generator-review.ts

# Workspace-scoped review lookup is mandatory for exports.
rg -q 'where: \{ id: reviewId, workspaceId \}' 'app/api/workspaces/[id]/thesis-review/[reviewId]/export/route.ts'

echo "Static audit invariants passed."
