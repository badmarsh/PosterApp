/**
 * Parent / child context expansion.
 *
 * The retrieval unit and the reading unit are different things. A 250-token paragraph is a
 * good *retrieval* unit (precise, embeddable inside the model window) and a bad *reading* unit
 * (no framing, no neighbouring result, no table it refers to). A section is the reverse.
 *
 * So retrieval happens on children and reading happens on parents:
 *
 *   retrieveSmallChunks()      → precise child chunks
 *   expandToParentContext()    → the section each hit belongs to
 *   expandToNeighborContext()  → the chunks immediately before/after
 *   expandToRelatedElements()  → the table / equation / figure / citation a hit refers to
 *
 * Expansion is budgeted. Widening context is only useful while the added tokens still answer
 * the question; past that it dilutes the evidence and burns the prompt. `expansionBudgetChars`
 * is therefore enforced, and expansion stops when it is exhausted.
 *
 * @module parent-context
 */

import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import type { RetrievalCandidate } from "./retrievers/types"

/** A chunk with everything the evidence layer needs. */
export interface ContextChunk {
  id: string
  documentId: string
  heading: string | null
  content: string
  tokens: number
  kind: string
  chunkType: string
  sectionPath: string | null
  pageStart: number | null
  pageEnd: number | null
  parentChunkId: string | null
  previousChunkId: string | null
  nextChunkId: string | null
  sourceElementIds: string[]
  /** Anthropic-style contextual prefix (index/FTS only — never part of `content`). */
  contextPrefix: string | null
  /** Position in document order — used to re-sort expanded context. */
  ordinal: number
  /** Why this chunk is in the context set. */
  role: "retrieved" | "parent" | "neighbor" | "related-element"
  /** Fused retrieval score, when this chunk was itself retrieved. */
  score?: number
  /** Provenance of the retrieval that produced it. */
  sources?: string[]
}

/** Column projection shared by every context fetch. */
export const CONTEXT_SELECT_COLUMNS = `id, "documentId", heading, content, tokens, kind, "chunkType",
  "sectionPath", "pageStart", "pageEnd", "parentChunkId", "previousChunkId", "nextChunkId",
  "sourceElementIds", ordinal, "contextPrefix"`

/**
 * The projection as a SQL fragment.
 *
 * Deliberately a function, not a module-level constant: `(Prisma as any).raw` does not exist until the
 * client is generated, and evaluating it at import time made this whole module un-importable in
 * any environment without a generated client (tests included). Building it per call costs
 * nothing and turns a load-time crash into an ordinary call-time one.
 */
function contextSelect(): any {
  return (Prisma as any).raw(CONTEXT_SELECT_COLUMNS)
}

interface ContextRow {
  id: string
  documentId: string
  heading: string | null
  content: string
  tokens: number
  kind: string
  chunkType: string
  sectionPath: string | null
  pageStart: number | null
  pageEnd: number | null
  parentChunkId: string | null
  previousChunkId: string | null
  nextChunkId: string | null
  sourceElementIds: string[] | null
  ordinal: number | null
  contextPrefix: string | null
}

function toContextChunk(row: ContextRow, role: ContextChunk["role"], score?: number, sources?: string[]): ContextChunk {
  return {
    id: row.id,
    documentId: row.documentId,
    heading: row.heading,
    content: row.content,
    tokens: row.tokens ?? 0,
    kind: row.kind ?? "prose",
    chunkType: row.chunkType ?? "paragraph",
    sectionPath: row.sectionPath ?? null,
    pageStart: row.pageStart ?? null,
    pageEnd: row.pageEnd ?? null,
    parentChunkId: row.parentChunkId ?? null,
    previousChunkId: row.previousChunkId ?? null,
    nextChunkId: row.nextChunkId ?? null,
    sourceElementIds: Array.isArray(row.sourceElementIds) ? row.sourceElementIds : [],
    contextPrefix: row.contextPrefix ?? null,
    ordinal: row.ordinal ?? 0,
    role,
    score,
    sources,
  }
}

/** Fetches chunks by id, workspace-scoped. Never returns rows from another tenant. */
export async function fetchContextChunksByIds(workspaceId: string, ids: string[]): Promise<Map<string, ContextChunk>> {
  const unique = Array.from(new Set(ids.filter(Boolean)))
  if (unique.length === 0) return new Map()
  const rows = await prisma.$queryRaw<Array<ContextRow>>`
    SELECT ${contextSelect()}
    FROM "DocumentChunk"
    WHERE "workspaceId" = ${workspaceId}
      AND id IN (${(Prisma as any).join(unique)})
  `
  const map = new Map<string, ContextChunk>()
  for (const r of rows) map.set(r.id, toContextChunk(r, "retrieved"))
  return map
}

export interface ExpansionOptions {
  /** Total characters the expanded context may add. */
  expansionBudgetChars?: number
  /** Neighbours to pull in on each side. */
  neighborWindow?: number
  includeParents?: boolean
  includeNeighbors?: boolean
  includeRelatedElements?: boolean
  signal?: AbortSignal
}

export const DEFAULT_EXPANSION_BUDGET_CHARS = 12_000
export const DEFAULT_NEIGHBOR_WINDOW = 1

/**
 * Small-unit retrieval: the child chunks only.
 *
 * Section-level parent chunks are excluded from the ranked list — they are summaries, and
 * ranking a summary above the paragraph that actually contains the evidence is how reviews end
 * up citing a paraphrase instead of the source.
 */
export function selectRetrievalUnits(candidates: Array<{ id: string; chunkType?: string; meta?: Record<string, unknown> }>): string[] {
  return candidates.filter((c) => (c.chunkType ?? "paragraph") !== "section").map((c) => c.id)
}

/**
 * Widens each retrieved child to the section it belongs to.
 *
 * Only parents that are not already in the set are added, and the budget is spent
 * highest-scored-first so the most relevant sections win.
 */
export async function expandToParentContext(
  workspaceId: string,
  retrieved: ContextChunk[],
  opts: { budgetChars?: number; signal?: AbortSignal } = {}
): Promise<ContextChunk[]> {
  const budget = opts.budgetChars ?? DEFAULT_EXPANSION_BUDGET_CHARS
  const parentIds = Array.from(
    new Set(retrieved.map((c) => c.parentChunkId).filter((id): id is string => Boolean(id)))
  )
  if (parentIds.length === 0) return []
  const have = new Set(retrieved.map((c) => c.id))
  const wanted = parentIds.filter((id) => !have.has(id))
  if (wanted.length === 0) return []

  const parents = await fetchContextChunksByIds(workspaceId, wanted)
  const byScore = [...retrieved].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  const out: ContextChunk[] = []
  let spent = 0
  const added = new Set<string>()
  for (const c of byScore) {
    if (spent >= budget) break
    const pid = c.parentChunkId
    if (!pid || added.has(pid)) continue
    const parent = parents.get(pid)
    if (!parent) continue
    if (spent + parent.content.length > budget && out.length > 0) continue
    out.push({ ...parent, role: "parent" })
    added.add(pid)
    spent += parent.content.length
  }
  return out
}

/**
 * Pulls in the chunks immediately before/after each hit.
 *
 * Follows the persisted `previousChunkId` / `nextChunkId` links (document order), so the
 * neighbour is the real next paragraph rather than whatever happens to be adjacent in the
 * ranked list.
 */
export async function expandToNeighborContext(
  workspaceId: string,
  retrieved: ContextChunk[],
  opts: { window?: number; budgetChars?: number; signal?: AbortSignal } = {}
): Promise<ContextChunk[]> {
  const hops = Math.max(0, opts.window ?? DEFAULT_NEIGHBOR_WINDOW)
  if (hops === 0 || retrieved.length === 0) return []
  const budget = opts.budgetChars ?? DEFAULT_EXPANSION_BUDGET_CHARS
  const have = new Set(retrieved.map((c) => c.id))

  const out: ContextChunk[] = []
  const seen = new Set<string>()
  let spent = 0

  // Breadth-first along the persisted sibling links, one hop per round, so a
  // window of 2 really does reach two paragraphs out.
  let prevLevel = retrieved.map((c) => c.previousChunkId).filter((id): id is string => Boolean(id))
  let nextLevel = retrieved.map((c) => c.nextChunkId).filter((id): id is string => Boolean(id))

  for (let hop = 0; hop < hops; hop++) {
    const ids = Array.from(new Set([...prevLevel, ...nextLevel])).filter((id) => !have.has(id) && !seen.has(id))
    if (ids.length === 0) break
    const rows = await fetchContextChunksByIds(workspaceId, ids)
    const nextPrev: string[] = []
    const nextNext: string[] = []
    for (const id of ids) {
      const row = rows.get(id)
      if (!row) continue
      seen.add(id)
      if (spent + row.content.length > budget && out.length > 0) continue
      out.push({ ...row, role: "neighbor" })
      spent += row.content.length
      if (row.previousChunkId) nextPrev.push(row.previousChunkId)
      if (row.nextChunkId) nextNext.push(row.nextChunkId)
    }
    prevLevel = nextPrev
    nextLevel = nextNext
  }

  // Document order, so the assembled context reads as the thesis does.
  return out.sort((a, b) => a.documentId.localeCompare(b.documentId) || a.ordinal - b.ordinal)
}

/**
 * Attaches the structural elements a retrieved chunk refers to.
 *
 * A prose paragraph that says "the results in Table 4.1" is only half the evidence: the table
 * itself is the other half. This resolves that link two ways:
 *   1. shared `sourceElementIds` (same structural element, e.g. a caption and its table),
 *   2. same section + structural chunk type (table / equation / figure_caption), which catches
 *      the common case where the parser did not link them explicitly.
 */
export async function expandToRelatedElements(
  workspaceId: string,
  retrieved: ContextChunk[],
  opts: { budgetChars?: number; kinds?: string[]; signal?: AbortSignal } = {}
): Promise<ContextChunk[]> {
  const budget = opts.budgetChars ?? Math.floor(DEFAULT_EXPANSION_BUDGET_CHARS / 2)
  const kinds = opts.kinds ?? ["table", "equation", "figure_caption", "citation"]
  const have = new Set(retrieved.map((c) => c.id))
  const sectionPaths = Array.from(new Set(retrieved.map((c) => c.sectionPath).filter((p): p is string => Boolean(p))))
  if (sectionPaths.length === 0) return []

  const rows = await prisma.$queryRaw<Array<ContextRow>>`
    SELECT ${contextSelect()}
    FROM "DocumentChunk"
    WHERE "workspaceId" = ${workspaceId}
      AND "chunkType" IN (${(Prisma as any).join(kinds)})
      AND "sectionPath" IN (${(Prisma as any).join(sectionPaths)})
    ORDER BY ordinal ASC
    LIMIT 60
  `
  const out: ContextChunk[] = []
  let spent = 0
  for (const r of rows) {
    if (have.has(r.id)) continue
    if (spent + r.content.length > budget && out.length > 0) break
    out.push(toContextChunk(r, "related-element"))
    spent += r.content.length
  }
  return out
}

/**
 * Full expansion pass: retrieved children → parents → neighbours → related elements,
 * under one shared budget.
 *
 * Retrieved chunks are never dropped: the budget only limits how much *additional* context is
 * attached. Losing the evidence the retrieval actually selected would be worse than a long prompt.
 */
export async function expandContext(
  workspaceId: string,
  candidates: RetrievalCandidate[],
  opts: ExpansionOptions = {}
): Promise<{ retrieved: ContextChunk[]; parents: ContextChunk[]; neighbors: ContextChunk[]; related: ContextChunk[]; totalChars: number }> {
  const budget = opts.expansionBudgetChars ?? DEFAULT_EXPANSION_BUDGET_CHARS
  const retrievedIds = candidates.map((c) => c.id)
  const fetched = await fetchContextChunksByIds(workspaceId, retrievedIds)

  const scoreById = new Map(candidates.map((c) => [c.id, c.score]))
  const sourcesById = new Map<string, string[]>()
  for (const c of candidates) {
    const s = sourcesById.get(c.id) ?? []
    s.push(c.source)
    sourcesById.set(c.id, s)
  }

  const retrieved: ContextChunk[] = []
  for (const c of candidates) {
    const chunk = fetched.get(c.id)
    if (!chunk) continue
    retrieved.push({ ...chunk, role: "retrieved", score: scoreById.get(c.id), sources: sourcesById.get(c.id) })
  }

  const remaining = Math.max(0, budget - retrieved.reduce((s, c) => s + c.content.length, 0))
  const split = Math.max(200, Math.floor(remaining / 3))

  const [parents, neighbors, related] = await Promise.all([
    opts.includeParents === false ? Promise.resolve([]) : expandToParentContext(workspaceId, retrieved, { budgetChars: split, signal: opts.signal }),
    opts.includeNeighbors === false ? Promise.resolve([]) : expandToNeighborContext(workspaceId, retrieved, { window: opts.neighborWindow ?? DEFAULT_NEIGHBOR_WINDOW, budgetChars: split, signal: opts.signal }),
    opts.includeRelatedElements === false ? Promise.resolve([]) : expandToRelatedElements(workspaceId, retrieved, { budgetChars: split, signal: opts.signal }),
  ])

  return {
    retrieved,
    parents,
    neighbors,
    related,
    totalChars:
      retrieved.reduce((s, c) => s + c.content.length, 0) +
      parents.reduce((s, c) => s + c.content.length, 0) +
      neighbors.reduce((s, c) => s + c.content.length, 0) +
      related.reduce((s, c) => s + c.content.length, 0),
  }
}

// ---------------------------------------------------------------------------
// Evidence assembly (the LLM-facing context format)
// ---------------------------------------------------------------------------

export interface EvidenceBlock {
  criterion?: string
  question?: string
  expectedEvidence?: string[]
  direct: ContextChunk[]
  counter: ContextChunk[]
  graph: string[]
  citation: ContextChunk[]
  numerical: string[]
  priorArt: string[]
  uncertainties: string[]
  maxChars?: number
}

/**
 * Renders the structured evidence context handed to the reviewer model.
 *
 * The reviewer does not receive "the top-k blob". It receives labelled sections, so an
 * assertion in the review can be traced to the block it came from — and so the model cannot
 * present counter-evidence as support or vice versa.
 */
export function buildEvidenceContext(block: EvidenceBlock): string {
  const maxChars = block.maxChars ?? 24_000
  const parts: string[] = []
  const push = (s: string) => {
    if (parts.join("\n").length + s.length > maxChars) return
    parts.push(s)
  }

  if (block.criterion) push(`CRITERION: ${block.criterion}`)
  if (block.question) push(`QUESTION: ${block.question}`)
  if (block.expectedEvidence?.length) push(`EXPECTED EVIDENCE: ${block.expectedEvidence.join("; ")}`)

  const renderChunk = (c: ContextChunk) => {
    const locator = [c.sectionPath, c.pageStart ? `p. ${c.pageStart}${c.pageEnd && c.pageEnd !== c.pageStart ? `–${c.pageEnd}` : ""}` : null]
      .filter(Boolean)
      .join(", ")
    return `[${c.id}]${locator ? ` (${locator})` : ""}${c.heading ? ` ${c.heading}` : ""}\n${c.content}`
  }

  if (block.direct.length) push(`DIRECT EVIDENCE:\n${block.direct.map(renderChunk).join("\n\n")}`)
  if (block.counter.length) push(`COUNTER-EVIDENCE (qualifies or contradicts the above):\n${block.counter.map(renderChunk).join("\n\n")}`)
  if (block.graph.length) push(`GRAPH EVIDENCE:\n${block.graph.join("\n")}`)
  if (block.citation.length) push(`CITATION EVIDENCE:\n${block.citation.map(renderChunk).join("\n\n")}`)
  if (block.numerical.length) push(`NUMERICAL EVIDENCE (machine-checked, not model-generated):\n${block.numerical.join("\n")}`)
  if (block.priorArt.length) push(`PRIOR-ART EVIDENCE:\n${block.priorArt.join("\n")}`)
  if (block.uncertainties.length) push(`UNCERTAINTIES (state these explicitly; do not resolve them by guessing):\n${block.uncertainties.join("\n")}`)

  return parts.join("\n\n")
}

/**
 * Picks chunks that qualify rather than support the finding.
 *
 * Deliberately lexical and conservative: it looks for negation / limitation markers inside the
 * retrieved evidence, and only ever *labels* a chunk — it never decides the verdict. A
 * counter-evidence set produced by a keyword scan is auditable; one produced by a model's
 * opinion is not.
 */
export function selectCounterEvidence(chunks: ContextChunk[], patterns: string[] = []): ContextChunk[] {
  const markers = [
    /\b(however|but|although|nevertheless|limitation|limited|caveat|exception)\b/i,
    /\b(ale|avšak|napriek tomu|napriek|obmedzen|limitovan|výhrad|neplatí)\b/i,
    /\b(ale|avšak|přesto|navzdory|omezen|limitovan|výhrad|neplatí)\b/i,
    /\b(ne|nie|not|no|never|fails?|failed|nezodpoved|nesplň)\b/i,
  ]
  const extra = patterns.map((p) => new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 60), "i")).filter((re) => re.source.length > 2)
  return chunks.filter((c) => {
    const text = c.content
    if (text.length < 40) return false
    return markers.some((re) => re.test(text)) || extra.some((re) => re.test(text))
  })
}


/**
 * Actively searches for contrary evidence, limitations, and contradictory findings
 * across the workspace chunks using targeted negation/limitation queries.
 */
export async function retrieveActiveCounterEvidence(
  workspaceId: string,
  claimOrQuery: string,
  opts: {
    documentId?: string
    documentIds?: string[]
    limit?: number
    patterns?: string[]
  } = {}
): Promise<ContextChunk[]> {
  const limit = opts.limit ?? 5
  const patterns = opts.patterns ?? []
  
  // Construct targeted limitation & contradiction keywords
  const counterKeywords = [
    "limitation", "limitations", "threats to validity", "negative result", "inconclusive",
    "failure", "failed", "discrepancy", "obmedzenie", "limity", "nedostatok", "neplatí",
    "nesúlad", "odchýlka", "problém", "omezení", "neshoda", "rozpor", ...patterns
  ]

  const ftsTerms = counterKeywords.slice(0, 10).map((k) => `"${k}"`).join(" OR ")

  try {
    const rows = await prisma.$queryRaw<Array<ContextRow>>`
      SELECT ${contextSelect()}
      FROM "DocumentChunk"
      WHERE "workspaceId" = ${workspaceId}
        ${opts.documentId ? (Prisma as any).sql`AND "documentId" = ${opts.documentId}` : (Prisma as any).empty}
        ${opts.documentIds && opts.documentIds.length > 0 ? (Prisma as any).sql`AND "documentId" IN (${(Prisma as any).join(opts.documentIds)})` : (Prisma as any).empty}
        AND (
          to_tsvector('simple', COALESCE("contextPrefix", '') || ' ' || content) @@ to_tsquery('simple', 'limitation | obmedzen | limit | neplatí | failed | rozpor')
          OR content ~* '\b(however|limitation|caveat|although|ale|avšak|obmedzen|neplatí|rozpor)\b'
        )
      ORDER BY ordinal ASC
      LIMIT ${limit}
    `
    return rows.map((r) => toContextChunk(r, "retrieved", 0.7, ["active-counter"]))
  } catch (err) {
    console.warn("[retrieveActiveCounterEvidence] Active counter-retrieval fallback:", err)
    return []
  }
}
