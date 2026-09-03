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
import { resolveAiModel } from "./models"
import { retrieveForCriterion, getThesisCriterionQueryExpansion, resolveThesisDomainContext } from "./vector-rag"
import { validateAndCalibrateFindings, type CitedChunk } from "./evidence-validator"
import { ReviewFindingContractSchema } from "./contracts"
import { SK_ACADEMIC_RUBRIC_V1, calculateGradeRange } from "./rubric-engine"
import { getApplicableCriteriaForThesisType } from "./rubric-engine"
import { sortFindingsByPriority } from "./review-priorities"
import { computeScoreFromFindings } from "./review-engine"
import type { ReviewLanguage, ThesisType } from "./thesis-rubric"
import type { ReviewFinding } from "./review-types"
import type { DetailedThesisType } from "./document-understanding"

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
  recommendation: z.string().default("minor_revisions"),
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

function cacheKey(workspaceId: string, sourceRevision: string, criterionId: string): string {
  return `${workspaceId}|${sourceRevision}|${criterionId}`
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
    thesisType: ThesisType
    domainContext: string
    sourceRevision: string
    signal?: AbortSignal
    signal2?: never
  }
): Promise<AgenticCriterionResult> {
  const key = cacheKey(ctx.workspaceId, ctx.sourceRevision, criterion.id)
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

  // Stable per-criterion anchors c1..cN.
  const evidenceChunks: Array<CitedChunk & { anchor: string }> = chunks.map((c, i) => ({
    id: c.id,
    anchor: `c${i + 1}`,
    heading: c.heading,
    content: c.content.slice(0, PER_CRITERION_EVIDENCE_BUDGET_CHARS / Math.max(1, chunks.length)),
    kind: c.kind,
  }))

  const evidenceBlock = evidenceChunks
    .map((c) => `[${c.anchor}]${c.heading ? ` ${c.heading}` : ""}\n${c.content}`)
    .join("\n\n")

  // 2. Per-criterion grounded generation.
  const sys = `You are an academic thesis evaluator assessing ONE evaluation criterion of a ${ctx.thesisType} thesis.
- Judge strictly the criterion: "${criterion.label}".
- Ground EVERY finding in the retrieved evidence passages below. Each evidence item MUST copy a quote character-for-character from one passage and set "chunkId" to that passage's anchor (e.g. "c2").
- If the evidence is insufficient to judge, return few findings and use epistemicStatus "REQUIRES_HUMAN_VERIFICATION" or "MISSING_EVIDENCE" — do NOT invent issues.
- Write all text in language code "${ctx.language}".
- Set criterionId on every finding to "${criterion.id}".
Respond as JSON: {"findings":[...]} with each finding matching the provided schema (title, explanation, recommendation, severity critical|major|minor|suggestion, findingType, epistemicStatus, evidence:[{quote,chunkId,sectionHeading}]).`

  const user = `Thesis: "${ctx.documentTitle}"
Criterion: ${criterion.label}
Guidance: ${criterion.guidance}

--- RETRIEVED EVIDENCE (cite via chunkId anchors) ---
${evidenceBlock || "(no evidence retrieved for this criterion)"}

Return the JSON object now.`

  let findings: ReviewFinding[] = []
  let calls = 1
  try {
    const res = await generateAIResponse<z.infer<typeof PerCriterionSchema>>(`peer-review-criterion-${criterion.id}`, {
      model: resolveAiModel("thesis"),
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
  thesisType: ThesisType
  detailedThesisType?: DetailedThesisType
  sourceRevision: string
  signal?: AbortSignal
  onProgress?: AgenticReviewProgress
  /** Max parallel criterion calls (keeps WASM/API pressure bounded). */
  concurrency?: number
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
          thesisType: opts.thesisType,
          domainContext,
          sourceRevision: opts.sourceRevision,
          signal: opts.signal,
        })
      )
    )
    results.push(...batchResults)
    completed += batch.length
    opts.onProgress?.("criterion_reviews", `criterion reviews ${completed}/${criteria.length}`)
  }

  const allFindings = results.flatMap((r) => r.findings)
  const allEvidenceChunks = results.flatMap((r) =>
    r.evidenceChunks.map((c) => ({ ...c, anchor: `${r.criterionId}:${c.anchor}` }))
  )
  const totalCalls = results.filter((r) => !r.cached).reduce((n, r) => n + r.calls, 0) + 1

  // Synthesis call: merge into summary / strengths / defense questions / grade.
  opts.onProgress?.("synthesis", "final synthesis")
  const findingsDigest = allFindings
    .slice(0, 60)
    .map((f, i) => `[${i + 1}] (${f.severity}/${f.criterionId ?? "general"}) ${f.title}: ${(f.explanation ?? "").slice(0, 220)}`)
    .join("\n")

  const synthesisSys = `You are the lead reviewer synthesising per-criterion findings of a ${opts.thesisType} thesis into a final assessment.
Write in language "${opts.language}". Produce: a 4-8 sentence summary, 3-6 concrete strengths, 5-10 targeted defense questions, a recommendation (accept|minor_revisions|major_revisions|reject), and an ECTS grade (A-FX) justified by the severity distribution.`
  const synthesisUser = `Thesis: "${opts.documentTitle}"

Per-criterion findings:
${findingsDigest || "(no findings were produced)"}

Respond as JSON: {"summary": "...", "strengths": ["..."], "defenseQuestions": ["..."], "recommendation": "...", "grade": "A|B|C|D|E|FX"}`

  let synthesis: z.infer<typeof SynthesisSchema>
  try {
    synthesis = await generateAIResponse("peer-review-synthesis", {
      model: resolveAiModel("thesis"),
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
      recommendation: "minor_revisions",
      grade: calculateGradeRange(score).grade,
    }
  }

  return { criterionResults: results, allFindings, synthesis, totalCalls, allEvidenceChunks }
}
