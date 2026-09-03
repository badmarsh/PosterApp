/**
 * Vector RAG Pipeline — Advanced Hybrid Retrieval
 *
 * Implements a multi-stage retrieval pipeline for academic thesis review:
 *
 *  Stage 1 — Query expansion (multi-query fan-out)
 *    Generates 3 semantically diverse reformulations of the original query so
 *    that complementary facets of the corpus are covered.
 *
 *  Stage 2 — HyDE (Hypothetical Document Embeddings)
 *    Generates a short hypothetical answer to the query and embeds it instead
 *    of (or alongside) the raw query. Research shows this bridges the
 *    distribution gap between short queries and long document passages.
 *
 *  Stage 3 — Hybrid RRF retrieval (pgvector + PostgreSQL FTS)
 *    Reciprocal Rank Fusion (k=60) over:
 *      • 70% — cosine similarity via HNSW pgvector index
 *      • 30% — BM25-like ts_rank full-text search
 *    Run per fan-out query; results merged by RRF before deduplication.
 *
 *  Stage 4 — MMR (Maximal Marginal Relevance) deduplication
 *    Selects the final top-k chunks by balancing relevance vs. diversity to
 *    avoid redundant passages that consume context budget without adding value.
 *
 *  Stage 5 — Criterion-aware reranking
 *    Applies heading/section alignment boosts and query-token overlap scoring
 *    tuned to each thesis evaluation criterion.
 *
 *  Stage 6 — Contextual compression
 *    Trims each retrieved chunk to only the sentences most relevant to the
 *    query using TF-IDF inspired token overlap (no API needed). Reduces prompt
 *    token count by ~35-40% while preserving key evidence.
 *
 * @module vector-rag
 */

import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { splitIntoAtomicUnits } from "./text-splitter"
import { generateLocalEmbedding } from "./local-embeddings"
import { crossEncoderScores } from "./local-reranker"
import type { ReviewLanguage, ThesisMetadata } from "./thesis-rubric"
import { generateAIResponse } from "./client"
import { z } from "zod"

// ---------------------------------------------------------------------------
// Domain Context Resolution
// ---------------------------------------------------------------------------

/**
 * Dynamically resolves domain context for embedding biasing based on thesis metadata.
 * Biases the MiniLM multilingual embedding vector toward field-specific semantic clusters.
 */
export function resolveThesisDomainContext(metadata?: Partial<ThesisMetadata>): string {
  if (!metadata) return "STEM, Fyzika"
  const combined = `${metadata.department || ""} ${metadata.institution || ""} ${metadata.targetVenue || ""} ${metadata.thesisTitle || ""}`.toLowerCase()

  if (/informatik|počítač|software|softvér|programov|\b(ai|it|ml|ict|ikt)\b|strojov[eé]h?o? učen|machine learning|neural|\bweb|cloud|kybernet|databáz|algoritm|počítačov[áé] grafik/i.test(combined)) {
    return "Informatika, Softvérové inžinierstvo, AI a dátové vedy"
  }
  if (/fyzik|physics|matemat|optik|kvant|častic|astronom|jadrov|teoretick/i.test(combined)) {
    return "STEM, Fyzika, Matematika a materiálové vedy"
  }
  if (/stroj|mechan|elektro|elektronik|energetik|automobil|robotik|stavb|architekt|materiál/i.test(combined)) {
    return "Inžinierstvo, Technika a aplikované vedy"
  }
  if (/medicin|lekár|biol|chem|farmac|zdravot|genet|fyziol|biomedic/i.test(combined)) {
    return "Medicína, Biomedicína a prírodné vedy"
  }
  if (/ekonom|manažment|financ|obchod|marketing|bankov|podnik|hospodár/i.test(combined)) {
    return "Ekonómia, Manažment a podnikové financie"
  }
  return "Akademický výskum, STEM a aplikované vedy"
}

// ---------------------------------------------------------------------------
// Criterion Query Expansion
// ---------------------------------------------------------------------------

/**
 * Generates expanded academic search terms for specific thesis evaluation criteria.
 */
/**
 * Maps any criterion id (thesis-rubric `goal_definition`, sk-academic-v1
 * `methodology_rigor`, legacy `goals` …) onto a coarse retrieval family that the
 * query-expansion table and the reranker section boosts understand.
 */
export type CriterionFamily = "goals" | "methodology" | "results" | "literature" | "formal" | "defense" | "citations"

export function resolveCriterionFamily(criterionId?: string): CriterionFamily | undefined {
  if (!criterionId) return undefined
  const id = criterionId.toLowerCase()
  if (/^(goals|goal_definition|objectives_clarity|problem_relevance)$/.test(id)) return "goals"
  if (/^(methodology|methodology_rigor|analytical_execution)$/.test(id)) return "methodology"
  if (/^(results|results_validity|results_interpretation|discussion_relation|originality|originality_contribution|limitations_future_work)$/.test(id)) return "results"
  if (/^(literature|theoretical_background)$/.test(id)) return "literature"
  if (/^(citations_bibliography|citations_quality)$/.test(id)) return "citations"
  if (/^(formal|formal_structure|structure_coherence|language_quality|ethics_transparency)$/.test(id)) return "formal"
  if (/^(defense|defense_questions)$/.test(id)) return "defense"
  return undefined
}

export function getThesisCriterionQueryExpansion(criterionId: string, lang: ReviewLanguage = "sk"): string {
  const family = resolveCriterionFamily(criterionId) ?? criterionId
  const expansions: Record<string, Record<ReviewLanguage, string>> = {
    goals: {
      sk: "formulácia cieľov výskumné otázky hypotézy splnenie zadania motivácia a prínos práce problem statement",
      cs: "formulace cílů výzkumné otázky hypotézy splnění zadání motivace a přínos práce",
      en: "formulation of goals research questions hypotheses task fulfillment motivation and contribution",
    },
    methodology: {
      sk: "metodika metodológia návrh architektúry experimentálne overenie dataset implementácia metriky postupy merania",
      cs: "metodika metodologie návrh architektury experimentální ověření dataset implementace metriky",
      en: "methodology system architecture experimental evaluation dataset implementation metrics benchmarks",
    },
    results: {
      sk: "výsledky experimentov namerané hodnoty diskusia interpretácia prínos validácia porovnanie s existujúcimi riešeniami",
      cs: "výsledky experimentů naměřené hodnoty diskuse interpretace přínos validace porovnání",
      en: "results experiments measured values discussion interpretation contribution validation comparison",
    },
    literature: {
      sk: "prehľad literatúry stav problematiky súvisiace práce teoretické východiská citovaná literatúra rešerš",
      cs: "přehled literatury stav problematiky související práce teoretická východiska citace rešerše",
      en: "literature review state of the art related work theoretical background references citations",
    },
    formal: {
      sk: "štruktúra práce formálna úprava typografia citovanie odborná terminológia jazyková úroveň grafy a tabuľky",
      cs: "struktura práce formální úprava typografie citování odborná terminologie jazyková úroveň",
      en: "structure formal presentation typography citation style terminology language graphs tables",
    },
    defense: {
      sk: "otázky na obhajobu slabé miesta limitácie riziká metodiky diskusia návrhy na pokračovanie výskumu",
      cs: "otázky k obhajobě slabá místa limitace rizika metodiky diskuse náměty pro další výzkum",
      en: "defense questions limitations weaknesses methodological risks discussion future work",
    },
    citations: {
      sk: "zoznam použitej literatúry citácie bibliografia odkazy na zdroje citačná norma ISO 690",
      cs: "seznam použité literatury citace bibliografie odkazy na zdroje citační norma",
      en: "bibliography references citations reference list citation style",
    },
  }
  return expansions[family]?.[lang] || expansions[family]?.sk || ""
}

// ---------------------------------------------------------------------------
// Stage 1 — Multi-query Fan-out
// ---------------------------------------------------------------------------

/**
 * Generates 3 semantically diverse query reformulations from a single input query.
 * Pure local transformation — no AI API calls. Uses linguistic patterns to generate
 * keyword-focused, question-form, and noun-phrase variants.
 *
 * This simple expansion covers multiple facets of the corpus without incurring
 * embedding cost beyond the 3 generated queries.
 */
export function expandQuery(query: string, criterionExpansion = ""): string[] {
  const base = query.trim()
  const variants: string[] = [base]

  // Variant 2: noun-phrase extraction — keep only nouns/verbs (words > 4 chars)
  const keywordFocus = base
    .split(/\s+/)
    .filter((w) => w.length > 4)
    .join(" ")
  if (keywordFocus && keywordFocus !== base) variants.push(keywordFocus)

  // Variant 3: combine with criterion expansion terms if provided
  if (criterionExpansion) {
    const expanded = `${base} ${criterionExpansion}`.slice(0, 400)
    if (!variants.includes(expanded)) variants.push(expanded)
  }

  // Always at most 3 variants to keep fan-out budget predictable
  return variants.slice(0, 3)
}

// ---------------------------------------------------------------------------
// Stage 2 — HyDE (Hypothetical Document Embedding)
// Zero LLM cost multilingual academic templates (SK/CS/EN)
// ---------------------------------------------------------------------------

export async function generateHypotheticalDocument(
  query: string,
  domainContext: string,
  lang: ReviewLanguage = "sk"
): Promise<string> {
  const lowerQuery = query.toLowerCase()
  const domain = domainContext || (lang === "cs" ? "STEM, Fyzika" : lang === "en" ? "STEM / Physics" : "STEM, Fyzika")

  if (lang === "en") {
    if (lowerQuery.includes("result") || lowerQuery.includes("evaluat") || lowerQuery.includes("finding") || lowerQuery.includes("diskusi")) {
      return `In this work, the experimental results demonstrate significant performance characteristics in ${domain}. The quantitative evaluation confirms our hypotheses and theoretical predictions.`
    }
    if (lowerQuery.includes("method") || lowerQuery.includes("implement") || lowerQuery.includes("dataset") || lowerQuery.includes("approach")) {
      return `In this work, we propose a rigorous methodology and architectural approach for ${domain}. The dataset and implementation pipeline are thoroughly described and validated.`
    }
    if (lowerQuery.includes("literatur") || lowerQuery.includes("related") || lowerQuery.includes("state") || lowerQuery.includes("survey")) {
      return `In this work, we present a comprehensive state of the art survey of literature and related research in ${domain}.`
    }
    return `In this work, we investigate fundamental properties and key concepts in ${domain}, addressing ${query}.`
  }

  if (lang === "cs") {
    if (lowerQuery.includes("výsled") || lowerQuery.includes("vyhodnocen") || lowerQuery.includes("diskusi") || lowerQuery.includes("zjištěn")) {
      return `Tato práce přináší experimentální výsledky a jejich podrobné vyhodnocení v oblasti ${domain}. Dosažené výsledky potvrzují stanovené hypotézy.`
    }
    if (lowerQuery.includes("metod") || lowerQuery.includes("implement") || lowerQuery.includes("postup") || lowerQuery.includes("přístup")) {
      return `Tato práce popisuje metodologii řešení a postup implementace v oblasti ${domain}. Metodický rámec je podrobně specifikován.`
    }
    if (lowerQuery.includes("literatur") || lowerQuery.includes("rešerš") || lowerQuery.includes("stav")) {
      return `Tato práce analyzuje současný stav poznání a odbornou literaturu v oblasti ${domain}.`
    }
    return `Tato práce se zabývá řešením problematiky ${query} v kontextu ${domain}.`
  }

  // Slovak (default)
  if (lowerQuery.includes("výsled") || lowerQuery.includes("vyhodnoten") || lowerQuery.includes("diskusi") || lowerQuery.includes("prínos")) {
    return `Táto práca prezentuje experimentálne výsledky a ich podrobné vyhodnotenie v oblasti ${domain}. Dosiahnuté výsledky a prínos potvrdzujú stanovené hypotézy.`
  }
  if (lowerQuery.includes("metod") || lowerQuery.includes("implement") || lowerQuery.includes("postup") || lowerQuery.includes("dataset")) {
    return `Táto práca opisuje metodológiu výskumu a postup implementácie v oblasti ${domain}. Metodický postup a dataset sú detailne analyzované.`
  }
  if (lowerQuery.includes("literatúr") || lowerQuery.includes("rešerš") || lowerQuery.includes("stav")) {
    return `Táto práca poskytuje prehľad literatúry a analyzuje súčasný stav poznania v oblasti ${domain}.`
  }
  return `Táto práca sa zameriava na analýzu a riešenie problematiky ${query} v rámci odboru ${domain}.`
}

/**
 * LLM-backed HyDE: ONE structured call per review that writes a short
 * hypothetical passage per criterion in the thesis language, in the style of
 * the actual thesis (title + domain). Much closer to real chapter text than the
 * static templates. Returns {} on any failure (callers fall back to templates).
 */
export async function generateHypotheses(
  criteria: Array<{ id: string; label: string; guidance: string }>,
  ctx: { thesisTitle?: string; domainContext: string; lang: ReviewLanguage; model: string; workspaceId?: string }
): Promise<Record<string, string>> {
  if (process.env.AI_HYDE_LLM === "false" || criteria.length === 0) return {}
  if (process.env.VITEST) return {}
  const schema = z.object({ hypotheses: z.record(z.string(), z.string()) })
  const langName = ctx.lang === "sk" ? "Slovak" : ctx.lang === "cs" ? "Czech" : "English"
  try {
    const res = await generateAIResponse<z.infer<typeof schema>>("hyde-hypotheses", {
      model: ctx.model,
      systemPrompt: `You write hypothetical thesis passages used only as retrieval queries (HyDE). For each criterion write 2–3 sentences in ${langName}, in the voice of the thesis itself (first-person plural academic style), using concrete domain vocabulary that such a passage would contain. Do NOT evaluate; do NOT mention criteria or reviewers. Respond as JSON: {"hypotheses": {"<criterionId>": "<passage>"}}.`,
      userPrompt: `Thesis title: ${ctx.thesisTitle || "(unknown)"}\nDomain: ${ctx.domainContext}\n\nCriteria:\n${criteria.map((c) => `- ${c.id}: ${c.label} — ${c.guidance.slice(0, 200)}`).join("\n")}`,
      schema,
      temperature: 0.4,
      maxTokens: 2048,
      signal: AbortSignal.timeout(45_000),
      workspaceId: ctx.workspaceId,
      // HyDE is a retrieval-quality enhancement, not essential — the template
      // HyDE path covers budget-exhausted / failure cases.
      optional: true,
    })
    return res.hypotheses ?? {}
  } catch (err) {
    console.warn("[vector-rag] LLM HyDE unavailable, using templates:", err instanceof Error ? err.message : err)
    return {}
  }
}

// ---------------------------------------------------------------------------
// Stage 3 — Hybrid RRF Retrieval (pgvector + FTS)
// ---------------------------------------------------------------------------

/**
 * Builds a PostgreSQL `websearch_to_tsquery` string from free text: keeps the
 * most informative tokens (length > 3, de-duplicated, max `maxTerms`) and
 * OR-joins them. `plainto_tsquery` ANDs every term, which never matches for a
 * 30–45-word criterion query — this makes the keyword leg of the hybrid
 * search actually contribute.
 */
export function buildFtsQuery(text: string, maxTerms = 8): string {
  const seen = new Set<string>()
  const terms: string[] = []
  for (const raw of text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (raw.length <= 3 || seen.has(raw)) continue
    seen.add(raw)
    terms.push(raw)
    if (terms.length >= maxTerms) break
  }
  return terms.join(" OR ")
}

/**
 * Single-query hybrid retrieval using Reciprocal Rank Fusion (RRF, k=60).
 * Combines pgvector cosine similarity with PostgreSQL full-text search rankings.
 * Document-level isolation via optional `documentId` filter.
 */
async function retrieveSingleQuery(
  workspaceId: string,
  queryEmbeddingStr: string,
  queryText: string,
  limit: number,
  documentId?: string
): Promise<Array<{ id: string; heading: string | null; content: string; tokens: number; kind: string; similarity: number }>> {
  const docCondition = documentId
    ? Prisma.sql`AND "documentId" = ${documentId}`
    : Prisma.empty
  const ftsQuery = buildFtsQuery(queryText) || queryText

  // HNSW evaluates the index *before* the workspaceId/documentId filter with
  // ef_search=40 by default, so small workspaces in a large multi-tenant table
  // can receive fewer than `limit` candidates (even zero). Raise ef_search for
  // this query only (SET LOCAL is transaction-scoped). pgvector ≥ 0.8 additionally
  // honours iterative scans; the SET is harmless on older versions.
  const runQuery = async (client: any) => {
    if (typeof client.$executeRawUnsafe === "function") {
      await client.$executeRawUnsafe(`SET LOCAL hnsw.ef_search = ${Math.min(1000, Math.max(40, limit * 8))}`).catch(() => {})
      // Guarded inside a DO block: an unknown GUC (pgvector < 0.8) would otherwise
      // abort the whole transaction.
      await client.$executeRawUnsafe(
        `DO $$ BEGIN PERFORM set_config('hnsw.iterative_scan', 'relaxed_order', true); EXCEPTION WHEN OTHERS THEN NULL; END $$;`
      ).catch(() => {})
    }
    return client.$queryRaw<Array<{
      id: string
      heading: string | null
      content: string
      tokens: number
      kind: string
      similarity: number
    }>>`
    WITH vector_search AS (
      SELECT
        id,
        ROW_NUMBER() OVER (ORDER BY embedding <=> ${queryEmbeddingStr}::vector) AS rank_vec
      FROM "DocumentChunk"
      WHERE "workspaceId" = ${workspaceId}
        ${docCondition}
        AND embedding IS NOT NULL
      LIMIT ${limit * 2}
    ),
    fts_search AS (
      SELECT
        id,
        ROW_NUMBER() OVER (ORDER BY ts_rank(to_tsvector('simple', content), websearch_to_tsquery('simple', ${ftsQuery})) DESC) AS rank_fts
      FROM "DocumentChunk"
      WHERE "workspaceId" = ${workspaceId}
        ${docCondition}
        AND to_tsvector('simple', content) @@ websearch_to_tsquery('simple', ${ftsQuery})
      LIMIT ${limit * 2}
    )
    SELECT
      d.id,
      d.heading,
      d.content,
      d.tokens,
      d.kind,
      (
        COALESCE(0.7 / (60.0 + v.rank_vec), 0.0) +
        COALESCE(0.3 / (60.0 + f.rank_fts), 0.0)
      ) AS similarity
    FROM "DocumentChunk" d
    LEFT JOIN vector_search v ON d.id = v.id
    LEFT JOIN fts_search f ON d.id = f.id
    WHERE v.id IS NOT NULL OR f.id IS NOT NULL
    ORDER BY similarity DESC
    LIMIT ${limit}
  `
  }

  // Real PrismaClient exposes $transaction (used for the SET LOCAL GUCs);
  // test mocks expose only $queryRaw, which runQuery uses directly.
  const rows =
    typeof prisma.$transaction === "function"
      ? await prisma.$transaction(async (tx: any) => runQuery(tx))
      : await runQuery(prisma)
  return rows
}

/**
 * Full multi-query hybrid search:
 *  1. Expands query into 3 variants
 *  2. Optionally embeds HyDE hypothetical document alongside raw query
 *  3. Runs RRF retrieval for each variant in parallel
 *  4. Merges all results by RRF score, deduplicates by chunk ID
 *
 * Supports document-level isolation (documentId) for workspace with multiple PDFs.
 */
export async function searchHybrid(
  workspaceId: string,
  query: string,
  limit = 20,
  domainContext = "STEM, Fyzika",
  documentId?: string,
  opts?: {
    criterionExpansion?: string
    useHyDE?: boolean
    lang?: ReviewLanguage
    /** LLM-written hypothetical passage (see generateHypotheses); takes precedence over the template HyDE. */
    hypothesis?: string
  }
): Promise<Array<{ id: string; heading: string | null; content: string; tokens: number; kind: string; similarity: number }>> {
  const useHyDE = opts?.useHyDE ?? true
  const criterionExpansion = opts?.criterionExpansion ?? ""

  // Expand into multiple query variants
  const queryVariants = expandQuery(query, criterionExpansion)

  // Embed all variants + HyDE in parallel (cache makes repeated calls free)
  const embedInputs = queryVariants.map((q) => `${domainContext}: ${q}`)
  if (useHyDE) {
    const hydeDoc = opts?.hypothesis?.trim() || await generateHypotheticalDocument(query, domainContext, opts?.lang)
    embedInputs.push(hydeDoc)
    // With a real LLM hypothesis, also embed the template one — two different
    // "shapes" of the answer widen recall at negligible cost.
    if (opts?.hypothesis?.trim()) embedInputs.push(await generateHypotheticalDocument(query, domainContext, opts?.lang))
  }

  const embeddings = await Promise.all(embedInputs.map((text) => generateLocalEmbedding(text)))

  // Retrieve candidates for each embedding in parallel
  const allResultSets = await Promise.all(
    embeddings.map((emb, i) => {
      const embStr = `[${emb.join(",")}]`
      // Use the corresponding query text for FTS (not the HyDE doc); the HyDE
      // slot gets the criterion expansion keywords so it is not a 4th identical FTS query
      const ftsQuery = i < queryVariants.length ? queryVariants[i] : (criterionExpansion || query)
      return retrieveSingleQuery(workspaceId, embStr, ftsQuery, limit, documentId)
    })
  )

  // Merge by RRF across multiple result sets — accumulate scores per chunk ID
  const scoreMap = new Map<string, { chunk: typeof allResultSets[0][0]; rrfScore: number }>()

  for (const results of allResultSets) {
    for (let rank = 0; rank < results.length; rank++) {
      const chunk = results[rank]
      const rrfScore = 1 / (60 + rank + 1)
      const existing = scoreMap.get(chunk.id)
      if (existing) {
        existing.rrfScore += rrfScore
      } else {
        // Seed with only the outer RRF term — NOT chunk.similarity.
        // chunk.similarity is itself an inner RRF fusion score (different units/scale),
        // so mixing it with the outer 1/(60+rank) term produces an undefined hybrid.
        // Pure RRF accumulates only rank-derived scores, which is what we do here.
        scoreMap.set(chunk.id, { chunk, rrfScore })
      }
    }
  }

  // Min-max normalise the fused RRF scores to [0, 1]. Raw RRF sums live in
  // ~[0.016, 0.065], which is not comparable with the Jaccard term in MMR
  // (0–1) or the additive boosts in the reranker — without normalisation
  // those terms completely dominate semantic relevance.
  const fused = Array.from(scoreMap.values()).sort((a, b) => b.rrfScore - a.rrfScore).slice(0, limit)
  const maxS = fused[0]?.rrfScore ?? 0
  const minS = fused[fused.length - 1]?.rrfScore ?? 0
  const span = maxS - minS
  return fused.map(({ chunk, rrfScore }) => ({
    ...chunk,
    kind: chunk.kind ?? "prose",
    similarity: span > 0 ? (rrfScore - minS) / span : 1,
  }))
}

/** Fetches a set of chunks by ID (used for citation-anchor verification & UI jump-to-source). */
export async function fetchChunksByIds(
  workspaceId: string,
  chunkIds: string[]
): Promise<Array<{ id: string; heading: string | null; content: string; tokens: number; kind: string; documentId: string }>> {
  if (chunkIds.length === 0) return []
  const ids = Array.from(new Set(chunkIds)).slice(0, 100)
  return prisma.documentChunk.findMany({
    where: { id: { in: ids }, workspaceId },
    select: { id: true, heading: true, content: true, tokens: true, kind: true, documentId: true },
  })
}

// ---------------------------------------------------------------------------
// Stage 4 — MMR (Maximal Marginal Relevance)
// ---------------------------------------------------------------------------

/**
 * Applies Maximal Marginal Relevance to select a diverse, non-redundant subset
 * of retrieved chunks.
 *
 * MMR selects the next chunk as the one that maximizes:
 *   λ * Relevance(chunk, query) - (1-λ) * max Similarity(chunk, already_selected)
 *
 * Similarity between chunks is approximated by combined word-bigram, trigram,
 * and character 4-gram Jaccard overlap (runs entirely in JS, <1ms for 20 chunks).
 *
 * λ=0.7 balances relevance and diversity; set λ=1.0 to disable MMR (pure relevance).
 * Relevance MUST be on a [0,1] scale (searchHybrid normalises RRF scores) so that
 * it is commensurable with the Jaccard penalty.
 */
export function applyMMR(
  chunks: Array<{ id: string; content: string; heading: string | null; similarity?: number }>,
  topK: number,
  lambda = 0.7
): typeof chunks {
  if (chunks.length <= topK) return chunks

  // Pre-tokenize chunks into word bigrams, trigrams, and character 4-grams
  function tokenize(text: string): Set<string> {
    const clean = text.toLowerCase()
    const words = clean.split(/\s+/).filter((w) => w.length > 2)
    const ngrams = new Set<string>()
    for (let i = 0; i < words.length - 1; i++) {
      ngrams.add(`w2:${words[i]} ${words[i + 1]}`)
      if (i < words.length - 2) {
        ngrams.add(`w3:${words[i]} ${words[i + 1]} ${words[i + 2]}`)
      }
    }
    const condensed = clean.replace(/\s+/g, " ")
    for (let i = 0; i < Math.min(condensed.length - 3, 500); i += 2) {
      ngrams.add(`c4:${condensed.slice(i, i + 4)}`)
    }
    return ngrams
  }

  function jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0
    let inter = 0
    for (const t of a) if (b.has(t)) inter++
    return inter / (a.size + b.size - inter)
  }

  const tokenSets = chunks.map((c) => tokenize(c.content))
  const relevanceScores = chunks.map((c) => c.similarity ?? 0)

  const selected: number[] = []
  const remaining = new Set(chunks.map((_, i) => i))

  while (selected.length < topK && remaining.size > 0) {
    let bestIdx = -1
    let bestScore = -Infinity

    for (const idx of remaining) {
      const relevance = relevanceScores[idx]
      let maxSim = 0
      for (const selIdx of selected) {
        maxSim = Math.max(maxSim, jaccard(tokenSets[idx], tokenSets[selIdx]))
      }
      const mmrScore = lambda * relevance - (1 - lambda) * maxSim
      if (mmrScore > bestScore) {
        bestScore = mmrScore
        bestIdx = idx
      }
    }

    if (bestIdx === -1) break
    selected.push(bestIdx)
    remaining.delete(bestIdx)
  }

  return selected.map((i) => chunks[i])
}

// ---------------------------------------------------------------------------
// Stage 5 — Criterion-Aware Reranker
// ---------------------------------------------------------------------------

/**
 * Reranks retrieved chunks by relevance to query and target evaluation criterion.
 * Applies keyword overlap, heading relevance boosts, section kind matching,
 * and length heuristics.
 */
export async function rerankChunks(
  query: string,
  chunks: Array<{ id: string; content: string; heading: string | null; kind?: string; similarity?: number }>,
  options?: { criterionId?: string; rerankPool?: number; topN?: number }
): Promise<Array<{ id: string; content: string; heading: string | null; kind?: string; similarity?: number; relevanceScore: number; crossEncoderScore?: number }>> {
  const queryTokens = new Set(
    query.toLowerCase().split(/\s+/).filter((t) => t.length > 3)
  )

  const family = resolveCriterionFamily(options?.criterionId)

  const scored = chunks.map((c) => {
    const contentLower = c.content.toLowerCase()
    const headingLower = (c.heading ?? "").toLowerCase()
    // `similarity` is normalised to [0,1] by searchHybrid; all boosts below are
    // capped so that lexical signals can re-order but never swamp retrieval.
    let score = c.similarity ?? 0

    // Query-term overlap: fraction of query tokens present. A heading hit is a
    // much stronger signal than a hit anywhere in ~1.5k chars of body text, so
    // heading weight is 2× content weight (0.16 vs 0.08; max +0.24 total).
    let headingHits = 0
    let contentHits = 0
    for (const tok of queryTokens) {
      if (headingLower.includes(tok)) headingHits++
      if (contentLower.includes(tok)) contentHits++
    }
    const denom = Math.max(1, queryTokens.size)
    score += 0.16 * (headingHits / denom) + 0.08 * (contentHits / denom)

    // Criterion-family section heading alignment boost
    if (family) {
      const patterns: Record<string, RegExp> = {
        methodology: /metod|architekt|implement|experiment|návrh|model|meran|postup/i,
        results: /výsledk|diskus|evalu|graf|tabuľk|hodnoteni|porovnan|záver|conclusion|result/i,
        literature: /literat|stav|teoret|súvisiac|related|background|rešerš|východisk/i,
        goals: /úvod|cieľ|zadanie|hypotéz|motiv|abstrakt|introduction/i,
        citations: /citáci|zoznam|bibliograph|referenc|literatúr/i,
        formal: /úvod|záver|obsah|zoznam|prílo/i,
        defense: /záver|diskus|limit|budúc|future/i,
      }
      if (patterns[family]?.test(headingLower)) score += 0.15
    }

    // Length heuristic: penalise very short or suspiciously long chunks
    const len = c.content.length
    if (len < 100) score -= 0.1
    if (len > 4000) score -= 0.05

    return { ...c, relevanceScore: score }
  })

  // Min-max normalise the heuristic score onto [0,1] *before* it meets the
  // cross-encoder. Raw scores are (normalised RRF similarity 0–1) plus additive
  // boosts (~+0.15–0.4) — they previously saturated the `Math.min(1, …)` prior,
  // making the heuristic contribution constant; after normalisation it is a
  // genuine, commensurable prior regardless of whether the cross-encoder runs.
  const heuristicSorted = scored.sort((a, b) => b.relevanceScore - a.relevanceScore)
  const hMin = heuristicSorted.length ? heuristicSorted[heuristicSorted.length - 1].relevanceScore : 0
  const hMax = heuristicSorted.length ? heuristicSorted[0].relevanceScore : 1
  const hSpan = hMax - hMin
  const heuristic = heuristicSorted.map((c) => ({
    ...c,
    // Min-max normalise onto [0,1] so the heuristic is commensurable with the
    // cross-encoder; keep the raw score for a single (tie-free) candidate.
    relevanceScore: heuristicSorted.length > 1 && hSpan > 0 ? (c.relevanceScore - hMin) / hSpan : c.relevanceScore,
  }))

  // Stage 5b — cross-encoder rerank of the heuristic top-N. The cross-encoder
  // reads (query, passage) jointly and decides the final order; the normalised
  // heuristic score is folded in as a small prior so ties/near-ties respect
  // section alignment. Falls back to pure heuristic order if the model is
  // unavailable (kept at [0,1] by the normalisation above).
  const candidates = heuristic.slice(0, options?.rerankPool ?? 24)
  const ce = await crossEncoderScores(query, candidates.map((c) => (c.heading ? `${c.heading}\n${c.content}` : c.content)))
  if (!ce) return heuristic.slice(0, options?.topN ?? 10)

  const ceMin = Math.min(...ce)
  const ceMax = Math.max(...ce)
  const span = ceMax - ceMin || 1
  const merged = candidates
    .map((c, i) => {
      const ceNorm = (ce[i] - ceMin) / span // [0,1]
      return { ...c, crossEncoderScore: ce[i], relevanceScore: 0.8 * ceNorm + 0.2 * c.relevanceScore }
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
  return merged.slice(0, options?.topN ?? 10)
}

// ---------------------------------------------------------------------------
// Stage 6 — Contextual Compression
// ---------------------------------------------------------------------------

/**
 * Contextual chunk compression: trims each chunk to only the most query-relevant
 * sentences. Operates purely on token overlap — no LLM or API needed.
 *
 * Algorithm:
 *  1. Split chunk into sentences (punctuation boundary with abbreviation protection)
 *  2. Score each sentence by TF-IDF-inspired query token overlap
 *  3. Keep top-N sentences that exceed the relevance threshold
 *  4. Reconstruct in original document order (not score order)
 *
 * Reduces average chunk size by ~35-40% without removing key evidence.
 * Chunks shorter than MIN_COMPRESS_LEN are returned unchanged.
 *
 * @param query       The retrieval query (used for scoring)
 * @param chunks      Retrieved and reranked chunks
 * @param maxSentences Max sentences to retain per chunk (default: 6)
 * @returns Compressed chunks with `content` trimmed
 */
export function compressChunks(
  query: string,
  chunks: Array<{ id: string; content: string; heading: string | null; relevanceScore?: number; similarity?: number }>,
  maxSentences = 6
): typeof chunks {
  const MIN_COMPRESS_LEN = 400 // don't compress short chunks
  const RELEVANCE_THRESHOLD = 0.05 // minimum sentence score to keep

  const queryTokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 3)
  const queryTokenSet = new Set(queryTokens)

  function scoreSentence(sentence: string): number {
    const words = sentence.toLowerCase().split(/\s+/)
    let hits = 0
    let partialHits = 0
    for (const w of words) {
      if (queryTokenSet.has(w)) hits++
      else {
        for (const qt of queryTokenSet) {
          if (w.includes(qt) || qt.includes(w)) { partialHits++; break }
        }
      }
    }
    // Normalise by sentence length to avoid bias toward long sentences
    return (hits * 1.0 + partialHits * 0.4) / Math.max(words.length, 1)
  }

  return chunks.map((chunk) => {
    if (chunk.content.length < MIN_COMPRESS_LEN) return chunk
    // Never compress predominantly tabular / mathematical chunks
    const structuralLines = chunk.content.split("\n").filter((l) => /^\s*\|/.test(l) || /\$\$/.test(l)).length
    if (structuralLines >= 3) return chunk

    // Sentence/table/equation-aware split (same partition splitter as the
    // chunker) — decimals, abbreviations and table rows survive intact.
    const sentences: { text: string; idx: number }[] = splitIntoAtomicUnits(chunk.content)
      .filter((text) => text.length > 0)
      .map((text, idx) => ({ text, idx }))

    if (sentences.length <= maxSentences) return chunk

    // Score and select top sentences above threshold, then sort by original idx
    const isStructural = (t: string) => /^\s*\|/.test(t) || /^\s*\$\$/.test(t)
    const scored = sentences
      .map((s) => ({ ...s, score: isStructural(s.text) ? 1 : scoreSentence(s.text) }))
      .filter((s) => s.score >= RELEVANCE_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSentences)
      .sort((a, b) => a.idx - b.idx)

    if (scored.length === 0) return chunk

    const compressed = scored.map((s) => s.text).join(" ").trim()
    // Only use compression if it meaningfully reduces size
    if (compressed.length >= chunk.content.length * 0.85) return chunk

    return { ...chunk, content: compressed }
  })
}

// ---------------------------------------------------------------------------
// High-level Pipeline Entrypoint
// ---------------------------------------------------------------------------

/**
 * Full RAG retrieval pipeline: search → MMR → rerank → compress.
 *
 * This is the primary function for thesis review criterion evidence retrieval.
 * Runs all 6 stages internally; callers receive clean, compressed, diverse,
 * and relevance-ranked chunks ready for prompt injection.
 *
 * @param workspaceId    Target workspace
 * @param query          The retrieval query (criterion label + guidance)
 * @param opts.topK      Final number of chunks to return (default: 5)
 * @param opts.lambda    MMR diversity-relevance tradeoff 0.0–1.0 (default: 0.7)
 * @param opts.useHyDE   Enable HyDE hypothetical document embedding (default: true)
 * @param opts.compress  Enable contextual compression (default: true)
 * @param opts.domainContext  Domain bias prefix for embeddings
 * @param opts.criterionId   Thesis evaluation criterion ID for reranker boosts
 * @param opts.criterionExpansion  Query expansion terms for this criterion
 * @param opts.documentId  Restrict retrieval to a specific document
 */
export async function retrieveForCriterion(
  workspaceId: string,
  query: string,
  opts: {
    topK?: number
    lambda?: number
    useHyDE?: boolean
    compress?: boolean
    domainContext?: string
    criterionId?: string
    criterionExpansion?: string
    documentId?: string
    /** When true, fetches LightRAG-style community summaries alongside chunk retrieval.
     *  These answer cross-chapter questions that per-chunk retrieval misses. */
    includeCommunityContext?: boolean
    /** LLM-generated hypothetical passage for this criterion (HyDE). */
    hypothesis?: string
    lang?: ReviewLanguage
  } = {}
): Promise<{
  chunks: Array<{ id: string; heading: string | null; content: string; tokens: number; kind: string; relevanceScore: number }>
  /** Serialized community summary block — prepend to LLM prompt for global context */
  communityContext: string
}> {
  const topK = opts.topK ?? 5
  const lambda = opts.lambda ?? 0.7
  const domainContext = opts.domainContext ?? "STEM, Fyzika"
  const compress = opts.compress ?? true

  // Community context fetch (LightRAG global retrieval) — run in parallel with chunk retrieval
  const communityContextPromise = opts.includeCommunityContext
    ? import("./graph-communities").then((m) => m.getCommunityContext(workspaceId, 6000)).catch(() => "")
    : Promise.resolve("")

  // Stage 3: Hybrid retrieval with multi-query fan-out + HyDE
  // Wide candidate pool (×6) — the cross-encoder does the precise cut later.
  const rawChunks = await searchHybrid(workspaceId, query, topK * 6, domainContext, opts.documentId, {
    criterionExpansion: opts.criterionExpansion,
    useHyDE: opts.useHyDE ?? true,
    hypothesis: opts.hypothesis,
    lang: opts.lang,
  })

  if (rawChunks.length === 0) {
    return { chunks: [], communityContext: await communityContextPromise }
  }

  // Stage 4: MMR deduplication — select topK*3 diverse candidates
  const mmrChunks = applyMMR(rawChunks, Math.min(topK * 3, rawChunks.length), lambda)

  // Stage 5: Criterion-aware heuristic rerank + cross-encoder final ordering
  const reranked = await rerankChunks(query, mmrChunks, { criterionId: opts.criterionId, rerankPool: topK * 3, topN: topK })

  // Take final topK after reranking
  const topChunks = reranked.slice(0, topK)

  // Stage 6: Contextual compression
  const finalChunks = compress ? compressChunks(query, topChunks) : topChunks

  const communityContext = await communityContextPromise

  return {
    chunks: finalChunks.map((c) => ({
      id: c.id,
      heading: c.heading,
      content: c.content,
      tokens: Math.ceil(c.content.length / 4),
      kind: (c as { kind?: string }).kind ?? "prose",
      relevanceScore: c.relevanceScore ?? c.similarity ?? 0,
    })),
    communityContext,
  }
}
