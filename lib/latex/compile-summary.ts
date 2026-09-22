import { generateAITextResponse } from "@/lib/ai/client"
import { resolveAiModelWithOverrides } from "@/lib/ai/models"
import type { AiModelRole } from "@/lib/ai/models"
import type { Card } from "@/lib/poster-types"

interface CompileSummaryOptions {
  signal?: AbortSignal
  apiKey?: string
  modelOverrides?: Partial<Record<AiModelRole, string>>
}

interface ParsedError {
  message: string
  line?: number
  hint?: string
}

const ERROR_PATTERNS: Array<{ re: RegExp; hint: string }> = [
  { re: /Missing \$ inserted/i, hint: "LaTeX expects a dollar sign ($) here. Wrap the formula in $...$."},
  { re: /Undefined control sequence/i, hint: "LaTeX encountered an unrecognized command or macro."},
  { re: /Emergency stop/i, hint: "LaTeX stopped early because of a fatal error."},
  { re: /Runaway argument/i, hint: "A command argument was not properly closed (check braces)."},
  { re: /File .* not found/i, hint: "A referenced file could not be found."},
  { re: /Too many }'s/i, hint: "There is an extra closing brace (}) in the document."},
  { re: /Extra \}/i, hint: "There is an extra closing brace (}) in the document."},
  { re: /Package .* Error/i, hint: "A LaTeX package reported an error."},
]

function cleanLine(line: string): string {
  return line.replace(/\(\[path\]/g, "").replace(/\[path\]/g, "").trim()
}

function extractFirstError(log: string): ParsedError | null {
  const lines = log.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.startsWith("!")) continue
    const message = cleanLine(line.replace(/^!\s*/, ""))
    let lineNo: number | undefined
    let hint: string | undefined
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const lMatch = lines[j].match(/^l\.(\d+)/)
      if (lMatch) { lineNo = parseInt(lMatch[1], 10); break }
    }
    for (const { re, hint: h } of ERROR_PATTERNS) {
      if (re.test(message)) { hint = h; break }
    }
    return { message, line: lineNo, hint }
  }
  return null
}

export function getDeterministicSummary(log: string, _cards?: Card[]): string {
  if (!log || !log.trim()) return "Compilation failed without compiler output."
  const err = extractFirstError(log)
  if (!err) {
    const ls = log.split(/\r?\n/).filter((l) => l.trim())
    const last = ls[ls.length - 1]
    return last ? cleanLine(last) : "Compilation failed — no specific error found in the log."
  }
  const parts: string[] = []
  const lineRef = err.line !== undefined ? " at line " + String(err.line) : ""
  parts.push("Compile error" + lineRef + ": " + err.message + ".")
  if (err.hint) parts.push(err.hint)
  return parts.join(" ")
}

export async function summarizeCompileError(
  log: string,
  cards?: Card[],
  opts: CompileSummaryOptions = {}
): Promise<string> {
  const { signal, apiKey, modelOverrides = {} } = opts
  const cardLines = (cards ?? []).map((c) => "  [" + c.id + "] " + (c.title ?? "(untitled)"))
  const cardContext = cardLines.length ? "Available cards:\n" + cardLines.join("\n") : ""
  const truncatedLog = log.length > 8_000 ? log.slice(0, 8_000) + "\n...(truncated)" : log
  const systemPrompt =
    "You are a LaTeX expert helping a researcher fix poster compilation errors. " +
    "When the log references a block id comment (e.g. % block id: card_xyz), mention the card id. " +
    "Be concise and actionable."
  const userPrompt = [cardContext, "Summarise the key errors in 2-3 sentences. State what caused the error and, if identifiable, which card or block is responsible.", "", "Compile log:", truncatedLog].filter(Boolean).join("\n")
  const model = resolveAiModelWithOverrides("vision", modelOverrides)
  try {
    const summary = await generateAITextResponse("compile-summary", {
      model, role: "vision", systemPrompt, userPrompt, maxTokens: 150, temperature: 0.1, signal, apiKey,
    })
    return summary.trim()
  } catch {
    return getDeterministicSummary(log, cards)
  }
}
