/**
 * Agentic per-criterion review engine (auditable decomposition).
 *
 * The monolithic professional review is one ~80k-token call: when the prompt
 * exceeds the model's effective prefix window, later criteria get reviewed on
 * truncated context ("prefix-truncation problem"), and findings can't be
 * cached per source revision.
 *
 * This engine instead makes ONE call per active criterion — each with its own
 * ~6k-char evidence budget (13 small calls ≈ same total tokens as one 80k call,
 * but every call is fully grounded) — followed by a single synthesis call that
 * merges findings into summary / grade / defense questions. Results are cached
 * per (workspaceId, sourceRevision, criterionId) so re-runs after editing one
 * criterion are near-free.
 */

import { z } from "zod"
import { generateAIResponse } from "./client"
import { resolveAiModel, resolveAiModelWithOverrides, type AiModelRole } from "./models"
import { retrieveForCriterion, getThesisCriterionQueryExpansion, resolveThesisDomainContext } from "./vector-rag"
import {
  stableEvidenceAnchor,
  validateAndCalibrateFindings,
  type CitedChunk,
} from "./evidence-validator"
import { ReviewFindingContractSchema } from "./contracts"
import { SK_ACADEMIC_RUBRIC_V1, calculateGradeRange } from "./rubric-engine"
import { getApplicableCriteriaForThesisType } from "./rubric-engine"
import { sortFindingsByPriority } from "./review-priorities"
import { computeScoreFromFindings } from "./review-engine"
import type { ReviewLanguage, ThesisType } from "./thesis-rubric"
import type { ReviewFinding, ReviewKind } from "./review-types"
import type { DetailedThesisType } from "./document-understanding"
import { shouldApplyEctsGrading } from "./thesis-review-policy"

export interface CriterionCriterion {
  id: string
  label: string
  guidance: string
}

export interface AgenticCriterionResult {
  criterionId: string
  label: string
  findings: ReviewFinding[]
  /** Evidence chunks retrieved for this criterion (with [cN] anchors). */
  evidenceChunks: Array<CitedChunk & { anchor: string }>
  calls: number
  cached: boolean
}

export interface AgenticReviewProgress {
  (stage: string, detail?: string): void
}

const PerCriterionSchema = z.object({
  findings: z.array(ReviewFindingContractSchema).default([]),
})

const SynthesisSchema = z.object({
  summary: z.string().default(""),
  strengths: z.array(z.string()).default([]),
  defenseQuestions: z.array(z.string()).default([]),
  // No default: a fabricated "minor_revisions" verdict must never be
  // presented as a reviewer's recommendation, and for doctoral reviews the
  // legally required statement is a text, not a journal enum.
  recommendation: z.string().default(""),
  grade: z.string().optional(),
})

/** Per-criterion evidence budget in characters (~6k; see roadmap). */
const PER_CRITERION_EVIDENCE_BUDGET_CHARS = 6_000

// ---------------------------------------------------------------------------
// Revision-scoped cache (in-process, bounded). Re-indexing / editing a source
// changes its sourceRevision, which invalidates the criterion results.
// ---------------------------------------------------------------------------

interface CacheEntry {
  key: string
  result: AgenticCriterionResult
  at: number
}
const criterionCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 60 * 60 * 1000
const CACHE_MAX = 500

function cacheKey(workspaceId: string, sourceRevision: string, criterionId: string, reviewKind: ReviewKind): string {
  return `${workspaceId}|${sourceRevision}|${reviewKind}|${criterionId}`
}

/** Test helper. */
export function resetAgenticReviewCache(): void {
  criterionCache.clear()
}

/**
 * Runs one per-criterion grounded review call.
 *
 * Evidence chunks are presented with stable [cN] anchors; the model must copy
 * the anchor into each evidence item's `chunkId`, which is then remapped to the
 * real DB chunk id and verified by exact lookup.
 */
export async function reviewCriterionWithEvidence(
  criterion: CriterionCriterion,
  ctx: {
    workspaceId: string
    sourceFileId?: string
    documentTitle: string
    language: ReviewLanguage
    reviewKind?: ReviewKind
    thesisType: ThesisType
    domainContext: string
    sourceRevision: string
    /** Pre-fetched GraphRAG subgraph serialized text (shared across criteria). */
    graphContext?: string
    signal?: AbortSignal
    apiKey?: string
    modelOverrides?: Partial<Record<AiModelRole, string>>
    signal2?: never
  }
): Promise<AgenticCriterionResult> {
  const reviewKind = ctx.reviewKind ?? "thesis"
  const key = cacheKey(ctx.workspaceId, ctx.sourceRevision, criterion.id, reviewKind)
  const cached = criterionCache.get(key)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { ...cached.result, cached: true }
  }

  // 1. Retrieve criterion-specific evidence (top chunks, compressed).
  const expansion = getThesisCriterionQueryExpansion(criterion.id, ctx.language)
  const query = `${criterion.label} ${criterion.guidance}`.slice(0, 300)
  const { chunks } = await retrieveForCriterion(ctx.workspaceId, query, {
    topK: 6,
    criterionId: criterion.id,
    criterionExpansion: expansion,
    domainContext: ctx.domainContext,
    documentId: ctx.sourceFileId,
    compress: true,
    lang: ctx.language,
  })

  // Stable anchors derive from chunk identity, not retrieval rank.
  const evidenceChunks: Array<CitedChunk & { anchor: string }> = chunks.map((c) => ({
    id: c.id,
    anchor: stableEvidenceAnchor(c.id),
    heading: c.heading,
    content: c.content.slice(0, PER_CRITERION_EVIDENCE_BUDGET_CHARS / Math.max(1, chunks.length)),
    kind: c.kind,
  }))

  const evidenceBlock = evidenceChunks
    .map((c) => `[${c.anchor}]${c.heading ? ` ${c.heading}` : ""}\n${c.content}`)
    .join("\n\n")

  // 2. Per-criterion grounded generation.
  const manuscriptLabel = reviewKind === "thesis" ? `${ctx.thesisType} thesis` : "scientific paper"
  const sys = `You are an academic ${reviewKind === "thesis" ? "thesis evaluator" : "peer reviewer"} assessing ONE evaluation criterion of a ${manuscriptLabel}.
- Judge strictly the criterion: "${criterion.label}".
- Ground substantive findings in the retrieved evidence passages below. When citing evidence, copy a quote character-for-character from one passage and set "chunkId" to that passage's anchor (e.g. "c2").
- If reporting a missing element or section that appears absent from the retrieved excerpts, do NOT attach an unrelated quote as fake evidence of absence. Instead set "evidence": [] and use epistemicStatus "REQUIRES_HUMAN_VERIFICATION" (or "MISSING_EVIDENCE").
- Positive merits and well-validated methods MUST be classified as findingType: "strength", severity: "suggestion", recommendation: "None" or "Pokračovať v tomto postupe". Do NOT classify strengths as weaknesses.
- Academic roles on title pages (Rector, Dekan, Promotor, Supervisor, Committee members) are university authorities, NOT conflicting authors. NEVER flag university officials on title pages as author inconsistencies.
- Do NOT penalize OCR or text extraction artifacts (e.g. LaTeX apostrophe diacritics like 'byt\'', 'vol\'nym', or dense merged multi-author physics bibliographies) as student academic errors.
- If the evidence is insufficient to judge, return few findings and use epistemicStatus "REQUIRES_HUMAN_VERIFICATION" or "MISSING_EVIDENCE" — do NOT invent issues.
- Write all text in language code "${ctx.language}".
- Set criterionId on every finding to "${criterion.id}".
Respond as JSON: {"findings":[...]} with each finding matching the provided schema (title, explanation, recommendation, severity critical|major|minor|suggestion, findingType, epistemicStatus, evidence:[{quote,chunkId,sectionHeading}]).`

  const graphBlock = ctx.graphContext
    ? `\n--- KNOWLEDGE GRAPH (entity relationships — use for multi-hop reasoning) ---\n${ctx.graphContext}`
    : ""

  const user = `${reviewKind === "thesis" ? "Thesis" : "Paper"}: "${ctx.documentTitle}"
Criterion: ${criterion.label}
Guidance: ${criterion.guidance}

--- RETRIEVED EVIDENCE (cite via chunkId anchors) ---
${evidenceBlock || "(no evidence retrieved for this criterion)"}${graphBlock}

Return the JSON object now.`

  let findings: ReviewFinding[] = []
  let calls = 1
  try {
    const res = await generateAIResponse<z.infer<typeof PerCriterionSchema>>(`peer-review-criterion-${criterion.id}`, {
      model: resolveAiModelWithOverrides("thesis", ctx.modelOverrides ?? {}),
      apiKey: ctx.apiKey,
      systemPrompt: sys,
      userPrompt: user,
      schema: PerCriterionSchema,
      temperature: 0.15,
      workspaceId: ctx.workspaceId,
      signal: ctx.signal,
      optional: false,
    })
    findings = res.findings as unknown as ReviewFinding[]
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err
    // A failed criterion call degrades to "no findings from this criterion"
    // rather than failing the whole review; synthesis notes the gap.
    console.warn(`[agentic-review] criterion ${criterion.id} call failed:`, err instanceof Error ? err.message : err)
    findings = []
  }

  // 3. Remap anchors → real chunk ids; verify by exact lookup.
  const anchorToId = new Map(evidenceChunks.map((c) => [c.anchor, c.id]))
  for (const f of findings) {
    f.criterionId = criterion.id
    f.criterionKey = criterion.id
    for (const ev of f.evidence || []) {
      if (ev.chunkId && anchorToId.has(ev.chunkId)) {
        ev.chunkId = anchorToId.get(ev.chunkId)
      }
    }
  }
  const validation = validateAndCalibrateFindings(
    findings,
    evidenceChunks.map((c) => c.content).join("\n\n"),
    [],
    ctx.sourceRevision,
    evidenceChunks.map((c) => ({ id: c.id, heading: c.heading, content: c.content, kind: c.kind }))
  )
  const validated = sortFindingsByPriority(validation.validatedFindings, ctx.language)

  const result: AgenticCriterionResult = {
    criterionId: criterion.id,
    label: criterion.label,
    findings: validated,
    evidenceChunks,
    calls,
    cached: false,
  }

  if (criterionCache.size >= CACHE_MAX) {
    const oldestKey = criterionCache.keys().next().value
    if (oldestKey) criterionCache.delete(oldestKey)
  }
  criterionCache.set(key, { key, result, at: Date.now() })
  return result
}

/**
 * Full agentic review: one grounded call per active criterion (bounded
 * concurrency) + a synthesis call for summary/grade/defense questions.
 */
export async function runAgenticPerCriterionReview(opts: {
  workspaceId: string
  sourceFileId?: string
  documentTitle: string
  language: ReviewLanguage
  reviewKind?: ReviewKind
  thesisType: ThesisType
  /** Needed to require the statutory conclusive statement for doctoral opponent reviews. */
  reviewerRole?: string
  detailedThesisType?: DetailedThesisType
  sourceRevision: string
  signal?: AbortSignal
  onProgress?: AgenticReviewProgress
  /** Max parallel criterion calls (keeps WASM/API pressure bounded). */
  concurrency?: number
  apiKey?: string
  modelOverrides?: Partial<Record<AiModelRole, string>>
}): Promise<{
  criterionResults: AgenticCriterionResult[]
  allFindings: ReviewFinding[]
  synthesis: z.infer<typeof SynthesisSchema>
  totalCalls: number
  allEvidenceChunks: Array<CitedChunk & { anchor: string }>
}> {
  const applicable = getApplicableCriteriaForThesisType(
    (opts.detailedThesisType ?? "unknown") as DetailedThesisType,
    SK_ACADEMIC_RUBRIC_V1
  ).filter(({ applicability }) => applicability !== "not_applicable")

  const criteria: CriterionCriterion[] = applicable.map(({ criterion }) => ({
    id: criterion.id,
    label: criterion.labels[opts.language] ?? criterion.labels.en,
    guidance: criterion.description[opts.language] ?? criterion.description.en,
  }))

  const domainContext = resolveThesisDomainContext({ thesisTitle: opts.documentTitle })
  const concurrency = opts.concurrency ?? 3

  // Fetch the GraphRAG knowledge graph once — shared across all criteria.
  // Query combines the thesis title with all active criterion labels so the
  // BFS seed entity linking covers the broadest relevant subgraph.
  let sharedGraphContext: string | undefined
  try {
    const { retrieveGraphContext } = await import("@/lib/ai/graph-rag")
    const graphQuery = [opts.documentTitle, ...criteria.map((c) => c.label)].join(" ").slice(0, 600)
    const subgraph = await retrieveGraphContext(opts.workspaceId, graphQuery, {
      charBudget: 3000,
      documentId: opts.sourceFileId,
    })
    if (subgraph) sharedGraphContext = subgraph.serialized
  } catch (graphErr) {
    console.warn("[agentic-review] GraphRAG prefetch skipped:", graphErr)
  }

  const results: AgenticCriterionResult[] = []
  let completed = 0
  for (let i = 0; i < criteria.length; i += concurrency) {
    if (opts.signal?.aborted) {
      const err = new Error("Agentic review cancelled")
      err.name = "AbortError"
      throw err
    }
    const batch = criteria.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      batch.map((criterion) =>
        reviewCriterionWithEvidence(criterion, {
          workspaceId: opts.workspaceId,
          sourceFileId: opts.sourceFileId,
          documentTitle: opts.documentTitle,
          language: opts.language,
          reviewKind: opts.reviewKind,
          thesisType: opts.thesisType,
          domainContext,
          sourceRevision: opts.sourceRevision,
          graphContext: sharedGraphContext,
          signal: opts.signal,
          apiKey: opts.apiKey,
          modelOverrides: opts.modelOverrides,
        })
      )
    )
    results.push(...batchResults)
    completed += batch.length
    opts.onProgress?.("criterion_reviews", `criterion reviews ${completed}/${criteria.length}`)
  }

  const allFindings = results.flatMap((r) => r.findings)
  const allEvidenceChunks = Array.from(
    new Map(
      results.flatMap((result) => result.evidenceChunks).map((chunk) => [chunk.id, chunk])
    ).values()
  )
  const totalCalls = results.filter((r) => !r.cached).reduce((n, r) => n + r.calls, 0) + 1

  // Synthesis call: merge into summary / strengths / defense questions / grade.
  opts.onProgress?.("synthesis", "final synthesis")
  const findingsDigest = allFindings
    .slice(0, 60)
    .map((f, i) => `[${i + 1}] (${f.severity}/${f.criterionId ?? "general"}) ${f.title}: ${(f.explanation ?? "").slice(0, 220)}`)
    .join("\n")

  const applyEctsGrading = shouldApplyEctsGrading(opts.reviewKind)
  // A Slovak/Czech doctoral opponent review is a legally defined document: the
  // recommendation field must carry the conclusive statement, not a journal
  // verdict enum ("minor_revisions" has no legal meaning for a dizertačná práca).
  const isDoctoralOpponentReview =
    (opts.reviewKind ?? "thesis") === "thesis" && opts.thesisType === "phd" && opts.reviewerRole === "opponent"
  const doctoralRecommendationRule = isDoctoralOpponentReview
    ? `
Recommendation rule (mandatory): the "recommendation" value must be a complete sentence in language "${opts.language}" stating that the thesis meets the conditions for the defence under the applicable Higher Education Act (§ 67 of Act No. 131/2002 Coll. in Slovakia; § 54a of Act No. 111/1998 Sb. in Czechia) and recommending award of the PhD title with a pass/fail classification. Never output the tokens accept, minor_revisions, major_revisions or reject for a doctoral thesis review.`
    : ""
  const synthesisSys = `You are the lead reviewer synthesising per-criterion findings of a ${opts.reviewKind === "paper" ? "scientific paper" : `${opts.thesisType} thesis`} into a final assessment.
Write in language "${opts.language}". Produce: a 4-8 sentence summary, 3-6 concrete strengths, 5-10 targeted ${opts.reviewKind === "paper" ? "questions for the authors" : "defense questions"}, and a recommendation (accept|minor_revisions|major_revisions|reject)${applyEctsGrading ? ", plus an ECTS grade (A-FX) justified by the severity distribution" : ". Do not assign an ECTS or academic grade"}.${doctoralRecommendationRule}`
  const synthesisUser = `${opts.reviewKind === "paper" ? "Paper" : "Thesis"}: "${opts.documentTitle}"

Per-criterion findings:
${findingsDigest || "(no findings were produced)"}

Respond as JSON: {"summary": "...", "strengths": ["..."], "defenseQuestions": ["..."], "recommendation": "..."${applyEctsGrading ? ', "grade": "A|B|C|D|E|FX"' : ""}}`

  let synthesis: z.infer<typeof SynthesisSchema>
  try {
    synthesis = await generateAIResponse("peer-review-synthesis", {
      model: resolveAiModelWithOverrides("thesis", opts.modelOverrides ?? {}),
      apiKey: opts.apiKey,
      systemPrompt: synthesisSys,
      userPrompt: synthesisUser,
      schema: SynthesisSchema,
      temperature: 0.2,
      workspaceId: opts.workspaceId,
      signal: opts.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err
    console.warn("[agentic-review] synthesis call failed, using deterministic fallback:", err instanceof Error ? err.message : err)
    const score = computeScoreFromFindings(allFindings)
    synthesis = {
      summary: "",
      strengths: [],
      defenseQuestions: [],
      recommendation: "",
      grade: applyEctsGrading ? calculateGradeRange(score).grade : undefined,
    }
  }

  return { criterionResults: results, allFindings, synthesis, totalCalls, allEvidenceChunks }
}
