/**
 * DeerFlow ↔ PosterApp deliverable contracts (server-only).
 *
 * DeerFlow output is untrusted and its JSON drifts between versions, so:
 *  - Lenient preprocess layers map common field aliases (same philosophy as
 *    lib/ai/contracts.ts).
 *  - The outer proposal object is STRICT: unknown top-level keys cause the
 *    whole proposal to be rejected (logged server-side) rather than silently
 *    dropped — a proposal must not smuggle unvalidated data into the app.
 *  - All arrays/strings are byte/Item-capped and asset ids are checked against
 *    the workspace's actual assets before anything is applied.
 */
import "server-only"
import { z } from "zod"

export const DeerflowLanguageSchema = z.enum(["sk", "cs", "en"])
export type DeerflowLanguage = z.infer<typeof DeerflowLanguageSchema>

export const DeerflowDepthSchema = z.enum(["fast", "standard", "deep"])
export type DeerflowDepth = z.infer<typeof DeerflowDepthSchema>

export const DeerflowKindSchema = z.enum(["poster_research"])

/** Body for `POST /api/workspaces/[id]/deerflow/runs`. */
export const DeerflowStartRunSchema = z.object({
  kind: DeerflowKindSchema.default("poster_research"),
  language: DeerflowLanguageSchema.default("sk"),
  /** Research focus — the agent's task statement. */
  focus: z.string().min(10).max(2000),
  /** Depth preset; maps to a duration/cost estimate. */
  depth: DeerflowDepthSchema.default("standard"),
  /** Allow the agent to reference workspace assets (ids only, never bytes). */
  includeAssets: z.boolean().default(true),
  /** Upper bound the user accepted (minutes, 1–30). Defaults by depth. */
  maxMinutes: z.number().int().min(1).max(30).optional(),
  /** Must be true — the UI always shows the estimate before starting. */
  confirmEstimate: z.boolean().default(false),
})
export type DeerflowStartRunInput = z.infer<typeof DeerflowStartRunSchema>

/** Body for `POST …/deerflow/estimate`. */
export const DeerflowEstimateSchema = z.object({
  depth: DeerflowDepthSchema.default("standard"),
})
export type DeerflowEstimateInput = z.infer<typeof DeerflowEstimateSchema>

// ---------------------------------------------------------------------------
// Proposal contracts
// ---------------------------------------------------------------------------

export const SourceRefSchema = z.object({
  doi: z.string().max(128).optional(),
  url: z.string().max(512).optional(),
  title: z.string().min(1).max(500),
  authors: z.array(z.string().min(1).max(200)).max(12).optional(),
  year: z
    .union([z.string(), z.number()])
    .transform((v) => String(v))
    .pipe(z.string().regex(/^\d{4}$/))
    .optional(),
  venue: z.string().max(300).optional(),
  retrievedFrom: z
    .enum(["crossref", "openalex", "semantic_scholar", "arxiv", "web"])
    .default("web"),
  confidence: z.number().min(0).max(1).default(0.5),
})
export type SourceRef = z.infer<typeof SourceRefSchema>

export const CitationSchema = z.object({
  key: z.string().max(64).optional(),
  type: z
    .enum(["article", "inproceedings", "book", "techreport", "misc", "unpublished", "phdthesis", "mastersthesis"])
    .default("misc"),
  title: z.string().min(1).max(500),
  authors: z.array(z.string().min(1).max(200)).max(12).default([]),
  year: z
    .union([z.string(), z.number()])
    .transform((v) => String(v))
    .pipe(z.string().regex(/^\d{4}$/))
    .optional(),
  venue: z.string().max(300).optional(),
  doi: z.string().max(128).optional(),
  url: z.string().max(512).optional(),
})
export type Citation = z.infer<typeof CitationSchema>

export const SectionDraftSchema = z.object({
  title: z.string().min(1).max(160),
  bullets: z.array(z.string().min(1).max(600)).max(8).default([]),
  /** Asset ids must exist in the workspace — server-filtered in normalizeProposal. */
  suggestedAssetIds: z.array(z.string().max(128)).max(3).default([]),
})
export type SectionDraft = z.infer<typeof SectionDraftSchema>

export const ProposalMetaSchema = z.object({
  estimatedUsd: z.number().min(0).max(1000).optional(),
  elapsedSeconds: z.number().min(0).max(86400).optional(),
  model: z.string().max(128).optional(),
})

/**
 * STRICT outer object: an unknown top-level key rejects the proposal.
 * Preprocess maps common aliases so mild DeerFlow drift still parses.
 */
export const PosterResearchProposalSchema = z.preprocess(
  (raw: unknown) => {
    if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>
      return {
        version: obj.version ?? "poster-research-v1",
        summary: obj.summary ?? obj.executiveSummary ?? obj.overview ?? "",
        sources: obj.sources ?? obj.references ?? obj.sourceRefs ?? [],
        citations: obj.citations ?? obj.bibEntries ?? obj.bibliography ?? [],
        sectionDrafts: obj.sectionDrafts ?? obj.sections ?? obj.cards ?? [],
        openQuestions: obj.openQuestions ?? obj.questions ?? [],
        meta: obj.meta ?? {},
      }
    }
    return raw
  },
  z
    .object({
      version: z.literal("poster-research-v1").default("poster-research-v1"),
      summary: z.string().max(4000).default(""),
      sources: z.array(SourceRefSchema).max(40).default([]),
      citations: z.array(CitationSchema).max(40).default([]),
      sectionDrafts: z.array(SectionDraftSchema).max(8).default([]),
      openQuestions: z.array(z.string().min(1).max(600)).max(10).default([]),
      meta: ProposalMetaSchema.default({}),
    })
    .strict()
)

export type PosterResearchProposal = z.infer<typeof PosterResearchProposalSchema>

export const PROPOSAL_VERSION = "poster-research-v1" as const

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

export type NormalizeProposalResult =
  | { ok: true; proposal: PosterResearchProposal; rejected: { unknownKeys: string[]; unknownAssets: string[] } }
  | { ok: false; issues: Array<{ path: string; message: string }> }

/**
 * Validates a raw DeerFlow proposal, enforces all caps, and checks asset ids
 * against the workspace's asset set. Unknown top-level keys reject the
 * proposal (logged by the caller) instead of being silently dropped into
 * workspace state.
 */
export function normalizeProposal(
  raw: unknown,
  opts: { allowedAssetIds: ReadonlySet<string> }
): NormalizeProposalResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, issues: [{ path: "$", message: "Proposal must be a JSON object" }] }
  }

  const parsed = PosterResearchProposalSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join(".") || "$",
        message: i.message,
      })),
    }
  }

  const proposal = parsed.data
  const unknownKeys = Object.keys(raw as Record<string, unknown>).filter(
    (k) =>
      ![
        "version",
        "summary",
        "sources",
        "citations",
        "sectionDrafts",
        "openQuestions",
        "meta",
        // accepted aliases handled by preprocess
        "executiveSummary",
        "overview",
        "references",
        "sourceRefs",
        "bibEntries",
        "bibliography",
        "sections",
        "cards",
        "questions",
      ].includes(k)
  )

  // Strict contract: unknown top-level keys reject the whole proposal rather
  // than being silently dropped — nothing unvalidated may reach workspace state.
  if (unknownKeys.length > 0) {
    return {
      ok: false,
      issues: [
        {
          path: "$",
          message: `Unknown top-level proposal keys: ${unknownKeys.slice(0, 5).join(", ")}`,
        },
      ],
    }
  }

  const unknownAssets: string[] = []
  const dedupAssetIds = new Set<string>()
  for (const draft of proposal.sectionDrafts) {
    const kept: string[] = []
    for (const assetId of draft.suggestedAssetIds) {
      if (dedupAssetIds.has(assetId) || !opts.allowedAssetIds.has(assetId)) {
        unknownAssets.push(assetId)
        continue
      }
      dedupAssetIds.add(assetId)
      kept.push(assetId)
    }
    draft.suggestedAssetIds = kept
  }

  return { ok: true, proposal, rejected: { unknownKeys, unknownAssets } }
}

/**
 * Extracts a JSON payload candidate from DeerFlow's final `values` event.
 * DeerFlow's lead_agent returns a chat message; we instruct it to end with a
 * single JSON object. This scans the final assistant text for a fenced or raw
 * JSON object without trusting anything else about the output.
 */
export function extractProposalJsonCandidate(valuesValue: unknown): unknown | undefined {
  if (!valuesValue || typeof valuesValue !== "object") return undefined
  const obj = valuesValue as Record<string, unknown>
  if (!Array.isArray(obj.messages)) return undefined

  let lastText = ""
  for (let i = obj.messages.length - 1; i >= 0; i--) {
    const message = obj.messages[i] as Record<string, unknown>
    if (!message || typeof message !== "object") continue
    const content = message.content
    const text = Array.isArray(content)
      ? content
          .map((part: unknown) => {
            if (part && typeof part === "object") {
              const p = part as Record<string, unknown>
              return typeof p.text === "string" ? p.text : ""
            }
            return ""
          })
          .join("\n")
      : typeof content === "string"
        ? content
        : ""
    if (text.trim()) {
      lastText = text
      break
    }
  }
  if (!lastText) return undefined

  // 1) Try the whole text as JSON.
  const whole = lastText.trim()
  try {
    const parsed = JSON.parse(whole)
    if (parsed && typeof parsed === "object") return parsed
  } catch {
    // fall through
  }

  // 2) Fenced ```json … ``` block.
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(lastText)
  if (fenced) {
    try {
      const parsed = JSON.parse(fenced[1].trim())
      if (parsed && typeof parsed === "object") return parsed
    } catch {
      // fall through
    }
  }

  // 3) First balanced JSON object.
  const start = lastText.indexOf("{")
  if (start !== -1) {
    let depth = 0
    let inString = false
    let escape = false
    for (let i = start; i < lastText.length; i++) {
      const ch = lastText[i]
      if (escape) {
        escape = false
        continue
      }
      if (ch === "\\") {
        escape = true
        continue
      }
      if (ch === '"') {
        inString = !inString
        continue
      }
      if (inString) continue
      if (ch === "{") depth++
      if (ch === "}") {
        depth--
        if (depth === 0) {
          try {
            const parsed = JSON.parse(lastText.slice(start, i + 1))
            if (parsed && typeof parsed === "object") return parsed
          } catch {
            return undefined
          }
        }
      }
    }
  }
  return undefined
}
