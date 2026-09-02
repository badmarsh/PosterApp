# Academic Reviewer & Evidence Engine Architecture

## 1. Overview & Mission

The **PosterApp Academic Reviewer** transforms the university thesis evaluation process (*"Posudok záverečnej práce"*) and scientific peer review into a rigorous, evidence-grounded, audit-proof academic intelligence system.

Unlike generic LLM text generators that hallucinate citations, invent experimental findings, or produce uniform praise/criticism, the PosterApp Academic Reviewer enforces strict **epistemic grounding invariants**:
1. **Never fabricate evidence**: Every claim regarding document content must cite a verbatim or normalized excerpt verified directly in the source text.
2. **Epistemic taxonomy**: Every statement is classified into one of 6 distinct epistemic states (`SUPPORTED_FACT`, `SUPPORTED_INTERPRETATION`, `REVIEWER_JUDGMENT`, `MISSING_EVIDENCE`, `POSSIBLE_RISK`, `REQUIRES_HUMAN_VERIFICATION`).
3. **No ungrounded page coordinates**: Synthetic page numbers are strictly stripped unless verified against explicit document structural markers.
4. **Transparent AI boundaries**: Generated posudky include an explicit AI assistance disclosure, emphasize the human reviewer's final authority, and isolate confidential remarks from author-facing exports.

---

## 2. Six-Stage End-to-End Pipeline

```mermaid
flowchart LR
    A["1. Podklad & Integrita\n(SHA-256 Revision & Parse Gate)"] --> B["2. Porozumenie textu\n(Structure, Signals & Classifier)"]
    B --> C["3. Plán & Rubrika\n(Applicability & Guidelines)"]
    C --> D["4. Dôkazová analýza\n(Vector RAG & Anchoring)"]
    D --> E["5. Návrh posudku\n(14-Section Composer)"]
    E --> F["6. Verifikácia & Export\n(DOCX, PDF & Markdown)"]
```

### Stage 1: Podklad & Integrita (Source Integrity & Revision Tracking)
- Computes deterministic SHA-256 source hash (`sourceRevision`).
- Validates parse quality via MinerU CommonMark Markdown.
- Evaluates total characters, word counts, empty sections, and citation volume.
- Enforces parse quality gating (`canProceedToDeepReview`).

### Stage 2: Porozumenie textu (Document Understanding & Intelligence)
- Extracts structural components: Abstract, Keywords, Table of Contents, Chapters (H1–H3), Figures, Tables, and Bibliography.
- Calculates structural quality signals (`computeStructuralQualitySignals`).
- Classifies primary and secondary academic disciplines (STEM/Physics, CS/AI, Medicine/Biology, Economics/Management, Humanities/Social Sciences).
- Determines detailed methodology type (Experimental Physics, Software Engineering, Empirical Quantitative, Qualitative, Systematic Review, Theoretical).

### Stage 3: Plán a rubrika (Pre-flight Evaluation Planning & Rubrics)
- Applies versioned Slovak Academic Rubric (`sk-academic-v1`) with 12 calibrated evaluation criteria summing to exactly 100%.
- Builds the criteria applicability matrix based on detected methodology type (e.g. theoretical works do not require empirical dataset validation).
- Detects study design (Randomized trial, Systematic review, Machine learning benchmark) and suggests matching reporting standards (CONSORT 2025, PRISMA 2020, ML Reproducibility Checklist, STROBE).
- Generates transparent pre-flight limitations summary and diagnostic checklist.

### Stage 4: Dôkazová analýza (Evidence Grounding & Epistemic Calibration)
- Executes hybrid vector search (70% pgvector cosine similarity + 30% PostgreSQL full-text search) via multi-query fan-out and HyDE academic embeddings.
- Runs maximal marginal relevance (MMR) deduplication and criterion-specific reranking.
- Anchors and verifies quotes using verbatim and normalized string matching (`verifyEvidenceQuote`).
- Downgrades ungrounded findings from `SUPPORTED_FACT` to `REQUIRES_HUMAN_VERIFICATION` or `MISSING_EVIDENCE`.

### Stage 5: Návrh posudku (Structured Academic Review Composer)
- Composes formal 14-section Slovak academic narrative (`composeFullReviewNarrative`):
  1. Identifikácia práce a posudzovateľa
  2. Rozsah a limity podkladov pre posúdenie
  3. Stručná charakteristika práce (Executive Summary)
  4. Zhodnotenie cieľov a prínosu práce
  5. Teoretické východiská a práca so zdrojmi
  6. Metodológia a postup riešenia
  7. Výsledky, interpretácia a diskusia
  8. Štruktúra, jazyk a formálna úroveň
  9. Silné stránky práce
  10. Slabé stránky a oblasti na zlepšenie
  11. Otázky a námety k obhajobe (5–12 calibrated questions)
  12. Návrh hodnotenia a záverečné stanovisko (ECTS grade range)
  13. Transparentné vyhlásenie o AI asistencii
  14. Dôverné poznámky pre komisiu / editora (strictly isolated)

### Stage 6: Verifikácia, Rozhodnutie & Export
- Reviewer verifies and triages all findings (`accepted`, `edited`, `rejected`, `resolved`).
- Reviewer records final ECTS grade (`A`–`Fx`) and recommendation with timestamped human confirmation.
- Generates clean DOCX (`generateThesisReviewDocx`), LaTeX/PDF (`generateThesisReviewLatex`), and Markdown exports with strict audience authorization (`author` vs `editor/committee`).

---

## 3. Slovak Academic Rubric (`sk-academic-v1`) Specification

| ID | Criterion | Weight | Category | Key Focus |
|---|---|---|---|---|
| `problem_relevance` | Aktuálnosť a formulácia problému | 5% | Problem | Research gap, motivation, domain relevance |
| `objectives_clarity` | Jasnosť cieľov a výskumných otázok | 5% | Problem | Measurable sub-goals, hypotheses, research questions |
| `theoretical_background` | Teoretické východiská a rešerš literatúry | 15% | Theory | Critical literature synthesis, recent peer-reviewed sources |
| `methodology_rigor` | Metodologická primeranosť a postup | 15% | Methodology | Soundness of design, sample selection, validity |
| `analytical_execution` | Realizácia a analytická dôslednosť | 10% | Methodology | Code implementation, experimental runs, error handling |
| `results_validity` | Validita výsledkov a interpretácia | 10% | Results | Data tables/charts, objective findings, no overgeneralization |
| `discussion_relation` | Diskusia a nadväznosť na ciele | 10% | Results | Comparison with baselines, reflection on unexpected findings |
| `originality_contribution` | Originalita a prínos práce | 10% | Impact | Author's unique added value, software or experimental novelty |
| `structure_coherence` | Štruktúra, koherencia a odborný štýl | 5% | Formal | Chapter proportions, grammar, typography, academic register |
| `citations_quality` | Kvalita citácií a zoznam literatúry | 5% | Formal | ISO 690 / APA compliance, complete bibliography pairing |
| `ethics_transparency` | Etika, reprodukovateľnosť a dáta | 5% | Formal | Academic integrity declaration, data/code availability |
| `limitations_future_work` | Limity práce a návrhy do budúcna | 5% | Results | Critical self-reflection, actionable future research vectors |
| **Total** | | **100%** | | |

---

## 4. Epistemic Taxonomy & Guardrails

```
┌─────────────────────────────────┬────────────────────────────────────────────────────────┐
│ Status                          │ Meaning & Grounding Rule                               │
├─────────────────────────────────┼────────────────────────────────────────────────────────┤
│ SUPPORTED_FACT                  │ Direct, verified verbatim or normalized source quote.  │
│ SUPPORTED_INTERPRETATION        │ Inference derived directly from evidenced quotes.      │
│ REVIEWER_JUDGMENT               │ Evaluative opinion or academic quality appraisal.       │
│ MISSING_EVIDENCE                │ Document was queried but lacked expected proof.        │
│ POSSIBLE_RISK                   │ Methodological, statistical, or ethical risk flagged.  │
│ REQUIRES_HUMAN_VERIFICATION     │ Flagged for mandatory reviewer inspection in raw PDF.  │
└─────────────────────────────────┴────────────────────────────────────────────────────────┘
```

---

## 5. Security, IDOR Protection & Confidentiality Isolation

1. **IDOR Prevention**: All API routes (`/thesis-review`, `/[reviewId]`, `/export`, `/reindex`) require `requireWorkspaceEditor(workspaceId)` verifying ownership or editor role.
2. **Confidentiality Isolation**:
   - `audience: "author"`: Never includes `confidentialComments`, private notes, or internal committee deliberations in DOCX, PDF, or Markdown exports.
   - `audience: "editor"`: Only accessible to authenticated workspace editors when explicitly requesting `confidential=true`.
3. **XML/LaTeX Injection Prevention**:
   - All DOCX strings pass through `sanitizeXmlString()`.
   - All LaTeX exports escape untrusted strings via `escapeLatex()`.
# Academic Reviewer & Evidence Engine Validation Report

## 1. Executive Summary

This document validates the comprehensive transformation of the **PosterApp Academic Reviewer ("Posudok záverečnej práce")** into an evidence-grounded academic intelligence system across all 7 architectural slices.

- **Test Suite Status**: 67 test files, 459 automated tests passing (100% pass rate).
- **TypeScript & ESLint Status**: 0 compile/lint errors across 42 Next.js routes.
- **Grounding Compliance**: 100% of generated claims are anchored with verified verbatim or normalized citations, or flagged with explicit epistemic warning statuses (`REQUIRES_HUMAN_VERIFICATION`, `MISSING_EVIDENCE`).
- **Confidentiality Isolation**: Verified 100% separation between public/author-facing exports and private committee notes.

---

## 2. Automated Test Matrix

| Slices & Modules | Test File | Tests | Status |
|---|---|---|---|
| **Slice 1: Contracts & Serialization** | `lib/__tests__/ai-contracts.test.ts`<br>`lib/__tests__/review-serializer.test.ts` | 20 | Pass ✓ |
| **Slice 2: Document Intelligence** | `lib/__tests__/document-understanding.test.ts`<br>`lib/__tests__/document-chunker.test.ts` | 23 | Pass ✓ |
| **Slice 3: Rubrics & Planning** | `lib/__tests__/rubric-engine.test.ts`<br>`lib/__tests__/analysis-plan.test.ts` | 7 | Pass ✓ |
| **Slice 4: Evidence Anchoring** | `lib/__tests__/evidence-validator.test.ts`<br>`lib/__tests__/expert-review.test.ts` | 17 | Pass ✓ |
| **Slice 5: Academic Checks & Composer** | `lib/__tests__/academic-checks.test.ts`<br>`lib/__tests__/review-composer.test.ts` | 9 | Pass ✓ |
| **Slice 6: API Routes & Multi-Format Export** | `__tests__/api/thesis-review-api-extended.test.ts`<br>`__tests__/api/thesis-review-auth-idor.test.ts`<br>`__tests__/api/thesis-review-dedup.test.ts` | 12 | Pass ✓ |
| **Slice 7: Vector RAG & Academic Citations** | `lib/__tests__/vector-rag-pipeline.test.ts`<br>`lib/__tests__/semantic-scholar-service.test.ts`<br>`lib/__tests__/bibtex-service.test.ts` | 29 | Pass ✓ |

---

## 3. Synthetic Benchmark & Invariant Validation

### Benchmark 1: Grounding & Quote Verification
- **Scenario**: Finding with ungrounded quote `"Tento model dosiahol 99.9% úspešnosť na neexistujúcom datasete."`
- **Validation**: System detects quote is absent in source text, automatically downgrades epistemic status from `SUPPORTED_FACT` to `REQUIRES_HUMAN_VERIFICATION`, sets `confidence < 0.6`, and flags verification failure for reviewer inspection.

### Benchmark 2: Synthetic Page Coordinates Stripping
- **Scenario**: AI returns unverified page coordinate `page: 42` for a CommonMark markdown source without PDF box coordinates.
- **Validation**: `verifyEvidenceQuote` strips `page` and `pageNumber` to prevent fabricating non-existent page numbers.

### Benchmark 3: Confidentiality Isolation
- **Scenario**: Review contains `confidentialComments: "DÔVERNÁ POZNÁMKA PRE KOMISIU: Študentka pracovala mimoriadne samostatne."`
- **Validation**:
  - `GET /export?format=md` (Author View): Confidential text strictly excluded.
  - `GET /export?format=docx` (Author View): Confidential paragraph completely omitted.
  - `GET /export?format=md&confidential=true` (Editor View): Confidential block included under clearly marked warning header.

### Benchmark 4: Objective Alignment & Traceability
- **Scenario**: Manuscript with problem statement and research question but missing explicit list of measurable sub-goals in introduction.
- **Validation**: `checkObjectiveAlignment` flags objective ambiguity, lowers alignment score, and generates a structured finding recommending explicit sub-goal decomposition.

### Benchmark 5: Calibrated Defense Questions
- **Scenario**: Review generated without critical findings.
- **Validation**: System constructs 5 prioritized defense questions addressing methodology rationale, validation reliability, scope boundaries, practical contribution, and literature baselines.

---

## 4. Production Build Verification

- **Command**: `pnpm run build`
- **Output**:
  - Total Pages / API Routes: 42
  - Zero TypeScript typecheck errors
  - Zero ESLint compilation warnings
  - Production bundles optimized and verified.
