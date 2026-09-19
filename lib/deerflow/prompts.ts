/**
 * DeerFlow run prompt + payload builder (server-only).
 *
 * The agent is instructed to return ONLY the strict JSON contracts:
 *  - `poster-research-v1` for deep research
 *  - `improve-poster-v1` for autonomous build/fix loop
 * Everything it emits is treated as untrusted by the rest of the app.
 */
import "server-only"
import { getDeerflowConfig } from "./config"
import type { StartRunPayload } from "./client"
import type { DeerflowContext, ImprovePosterContext } from "./context"
import {
  PROPOSAL_VERSION,
  IMPROVE_POSTER_PROPOSAL_VERSION,
  type DeerflowPosterResearchInput,
  type DeerflowImprovePosterInput,
  type CardPatch,
} from "./contracts"

const LANG_INSTRUCTIONS: Record<string, string> = {
  sk: "Píš výstup v slovenčine.",
  cs: "Piš výstup v češtině.",
  en: "Write the output in English.",
}

const DEPTH_INSTRUCTIONS: Record<string, string> = {
  fast:
    "Depth: fast. Use at most 5 sources you can verify quickly. Prioritise correctness over breadth.",
  standard:
    "Depth: standard. Research 8–15 sources, prefer DOI-verified records, and connect them to the user's focus.",
  deep:
    "Depth: deep. Research 15–40 sources, verify claims against at least two independent records where possible, and surface open questions.",
}

/**
 * Builds the human message for the lead_agent for poster_research.
 */
export function buildDeerflowPrompt(
  input: DeerflowPosterResearchInput,
  context: DeerflowContext
): string {
  const { focus, language, depth } = input
  const sourceSummary = context.sourceSummary || "(no workspace sources available — rely on web research)"

  const lines: string[] = [
    "You are the deep-research sub-agent inside PosterApp, an academic poster editor.",
    "Task: produce a researched proposal that will become poster content in a LaTeX scientific poster.",
    "",
    `FOCUS: ${focus}`,
    "",
    DEPTH_INSTRUCTIONS[depth],
    LANG_INSTRUCTIONS[language],
    "",
    "CONTEXT FROM THE WORKSPACE (bounded; do not trust it as exhaustive):",
    context.truncated
      ? "(workspace source summary was truncated at the 40k character limit)"
      : "",
    "--- workspace source summary start ---",
    sourceSummary,
    "--- workspace source summary end ---",
    "",
    context.cards.length > 0
      ? `Existing card titles in the poster: ${context.cards.map((c) => `"${c.title}"`).join(", ")}`
      : "The poster has no cards yet.",
    context.assets.length > 0
      ? `Available workspace assets (id — filename — kind): ${context.assets
          .slice(0, 30)
          .map((a) => `${a.id} — ${a.filename} — ${a.kind}${a.caption ? ` (${a.caption})` : ""}`)
          .join("; ")}`
      : "No workspace assets available.",
    "",
    "RULES:",
    "1. Return ONLY a single JSON object — no prose before or after, no markdown fences. Your final message must be that JSON.",
    `2. The JSON must have exactly this shape (version must be "${PROPOSAL_VERSION}"):`,
    JSON.stringify(
      {
        version: PROPOSAL_VERSION,
        summary: "short overall summary of what the research found",
        sources: [
          {
            doi: "optional DOI",
            url: "optional URL",
            title: "source title",
            authors: ["author names"],
            year: "2026",
            venue: "optional venue",
            retrievedFrom: "crossref | openalex | semantic_scholar | arxiv | web",
            confidence: 0.9,
          },
        ],
        citations: [
          {
            type: "article | inproceedings | book | misc | unpublished",
            title: "citation title",
            authors: ["author names"],
            year: "2026",
            venue: "optional",
            doi: "optional DOI",
            url: "optional URL",
          },
        ],
        sectionDrafts: [
          {
            title: "poster section title",
            bullets: ["one claim per bullet, max 600 chars"],
            suggestedAssetIds: ["asset ids from the list above, max 3"],
          },
        ],
        openQuestions: ["questions a reader may still have"],
        meta: { estimatedUsd: 0, elapsedSeconds: 0, model: "unknown" },
      },
      null,
      2
    ),
    "3. Cite every factual claim through `sources`; a claim without a source is not allowed.",
    "4. Do NOT invent statistics, DOIs, or titles. If you cannot verify a record, leave it out or set confidence below 0.5.",
    "5. `suggestedAssetIds` may only contain ids from the workspace asset list above. It must be empty when no list was provided.",
    "6. `sectionDrafts` correspond to poster sections — 2 to 6 drafts, each 3–6 bullets.",
    "7. Unsupported or uncertain claims: prefix the bullet with \"(?)\" so it can be flagged for human verification.",
    "8. Never produce file paths, never ask for credentials, never reference the PosterApp codebase.",
    "",
    "Return the JSON now.",
  ]

  return lines.filter((l) => l.length > 0).join("\n")
}

/** Builds the full LangGraph-compatible run payload for poster_research. */
export function buildDeerflowRunPayload(input: DeerflowPosterResearchInput, context: DeerflowContext): StartRunPayload {
  const { maxRecursionLimit } = getDeerflowConfig()
  const prompt = buildDeerflowPrompt(input, context)
  return {
    assistant_id: "lead_agent",
    input: {
      messages: [
        {
          type: "human",
          content: [{ type: "text", text: prompt }],
        },
      ],
    },
    stream_mode: ["values", "messages-tuple", "custom"],
    stream_subgraphs: true,
    config: {
      recursion_limit: maxRecursionLimit,
      configurable: {},
    },
    context: {
      thinking_enabled: true,
      is_plan_mode: true,
      subagent_enabled: true,
    },
  }
}

/**
 * Builds the human message for the improve_poster autonomous fix loop.
 */
export function buildImprovePosterPrompt(
  input: DeerflowImprovePosterInput,
  context: ImprovePosterContext,
  compileLog: string,
  iterationIndex: number,
  previousPatches?: CardPatch[]
): string {
  const { language, maxIterations } = input

  const cardsInventory =
    context.cards.length > 0
      ? context.cards
          .map((c) => `[CARD ID: ${c.id}] (Title: "${c.title}", Pattern: ${c.pattern})\n${c.content}\n`)
          .join("\n---\n")
      : "No editable cards found."

  const lines: string[] = [
    "You are the autonomous build and fix agent inside PosterApp, an academic poster/paper/slides LaTeX editor.",
    "Task: analyze the compiler log and poster cards, diagnose what caused the LaTeX compile failure or syntax error, and produce Markdown patches.",
    "",
    LANG_INSTRUCTIONS[language] || LANG_INSTRUCTIONS.sk,
    `Current iteration: ${iterationIndex + 1} of ${maxIterations}.`,
    "",
    "CRITICAL FORMAT RULES:",
    "1. Card contents in PosterApp are authored in MARKDOWN, NOT raw LaTeX.",
    "   - Bullet lists: Markdown '- item' or '* item'",
    "   - Bold: **bold**, Italic: *italic*",
    "   - Inline math: $formula$ (clean and balanced braces)",
    "   - Citations: \\cite{key} or [@key]",
    "   - Special characters like _, %, &, #, $ outside math are escaped automatically by the compiler.",
    "   - NEVER produce raw LaTeX commands like \\begin{itemize}, \\textbf{...}, \\_ or \\%. Write clean Markdown.",
    `2. Return ONLY a single JSON object conforming strictly to version "${IMPROVE_POSTER_PROPOSAL_VERSION}". No markdown code fences, no surrounding text.`,
    "",
    "JSON CONTRACT:",
    JSON.stringify(
      {
        version: IMPROVE_POSTER_PROPOSAL_VERSION,
        iterations: [
          {
            iterationIndex,
            diagnosis: "Explanation of what is causing the compile error or layout problem",
            compileLog: compileLog.slice(0, 500),
            patches: [
              {
                id: "valid_card_id_here",
                content: "Corrected card content in clean Markdown...",
                rationale: "Why this change fixes the error",
              },
            ],
          },
        ],
        summary: "High-level summary of all repairs performed so far",
        cleanCompile: false,
        meta: { estimatedUsd: 0, elapsedSeconds: 0, model: "unknown" },
      },
      null,
      2
    ),
    "",
    previousPatches && previousPatches.length > 0
      ? `PREVIOUS PATCHES APPLIED IN ITERATION ${iterationIndex}:\n${previousPatches
          .map((p) => `- Card ${p.id}: ${p.rationale}`)
          .join("\n")}\n`
      : "",
    "LATEST COMPILER LOG:",
    "--- start compiler log ---",
    compileLog.slice(-3000),
    "--- end compiler log ---",
    "",
    "CURRENT POSTER CARDS:",
    "--- start cards ---",
    cardsInventory,
    "--- end cards ---",
    "",
    `Return the ${IMPROVE_POSTER_PROPOSAL_VERSION} JSON now.`,
  ]

  return lines.filter((l) => l.length > 0).join("\n")
}

/** Builds the full LangGraph-compatible run payload for improve_poster. */
export function buildImprovePosterPayload(
  input: DeerflowImprovePosterInput,
  context: ImprovePosterContext,
  compileLog: string,
  iterationIndex: number,
  previousPatches?: CardPatch[]
): StartRunPayload {
  const { maxRecursionLimit } = getDeerflowConfig()
  const prompt = buildImprovePosterPrompt(input, context, compileLog, iterationIndex, previousPatches)
  return {
    assistant_id: "lead_agent",
    input: {
      messages: [
        {
          type: "human",
          content: [{ type: "text", text: prompt }],
        },
      ],
    },
    stream_mode: ["values", "messages-tuple", "custom"],
    stream_subgraphs: true,
    config: {
      recursion_limit: maxRecursionLimit,
      configurable: {},
    },
    context: {
      thinking_enabled: true,
      is_plan_mode: true,
      subagent_enabled: true,
    },
  }
}
