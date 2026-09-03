import type { Card, ValidationMessage } from "@/lib/poster-types"
import { columnBudgetFor, estimateHeight, suggestReductions } from "./layout"

const DANGEROUS_LATEX_COMMANDS = [
  "\\write",
  "\\openout",
  "\\immediate",
  "\\input",
  "\\include",
  "\\catcode",
  "\\csname",
  "\\batchmode",
  "\\nonstopmode",
  "\\scrollmode",
  "\\errorstopmode",
  "\\def",
  "\\let",
  "\\gdef",
  "\\edef",
  "\\xdef",
  // Category-code / internal-macro escapes that bypass the simple names above
  "\\makeatletter",
  "\\@@input",
  "\\scantokens",
  "\\openin",
  "\\read",
  "\\pdffiledump",
  "\\pdffilesize",
  "\\pdfmdfivesum",
  "\\pdfobj",
  "\\pdfstrcmp",
  "\\directlua",
  "\\ShellEscape",
  "\\ifeof",
  "\\endinput",
  "\\lowercase",
  "\\uppercase",
  "\\expandafter",
  "\\noexpand",
  "\\special",
  "\\jobname",
  "\\everypar",
  "\\everyjob",
  "\\shipout",
  "\\usepackage",
  "\\RequirePackage",
  "\\documentclass",
]

/** Case-insensitive detection of active-character / caret-notation tricks (^^40 == @). */
const CARET_NOTATION = /\^\^[0-9a-f]{2}|\^\^[@-_]/i

export function hasUnsafeLatex(input: string): string[] {
  if (!input || typeof input !== "string") return []
  const found = new Set<string>()

  // Check for dangerous TeX primitives
  for (const cmd of DANGEROUS_LATEX_COMMANDS) {
    if (input.includes(cmd)) {
      found.add(`prohibited command ${cmd}`)
    }
  }
  if (CARET_NOTATION.test(input)) {
    found.add("prohibited caret notation (^^)")
  }

  // Count brace balance, ignoring escaped braces like \{ and \}
  let depth = 0
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    const prev = i > 0 ? input[i - 1] : ""
    if (ch === "{" && prev !== "\\") depth++
    else if (ch === "}" && prev !== "\\") depth--
    if (depth < 0) {
      found.add("unbalanced {}")
      break
    }
  }
  if (depth !== 0) found.add("unbalanced {}")

  return [...found]
}

/**
 * @param templateId Active template. Column geometry differs per template
 *   (portrait vs landscape vs Better Poster), so the overflow budget does
 *   too. Omitted -> the portrait default, matching previous behaviour.
 */
export function validateCard(card: Card, templateId?: string | null): ValidationMessage[] {
  const msgs: ValidationMessage[] = []

  if (!card.title.trim()) {
    msgs.push({ level: "error", field: "title", message: "Card title is required." })
  }
  if (!/^(blk|card)_[a-z0-9_]+$/.test(card.id)) {
    msgs.push({
      level: "error",
      field: "id",
      message: "Block ID must match blk_ or card_ prefix.",
    })
  }

  const needsContent = card.pattern !== "image-focused" && card.pattern !== "references" && card.pattern !== "figure-slide"
  if (needsContent && !card.content.trim()) {
    msgs.push({
      level: "error",
      field: "content",
      message: "This block pattern requires content.",
    })
  }

  const unsafe = hasUnsafeLatex(card.content)
  if (unsafe.length) {
    msgs.push({
      level: "warning",
      field: "content",
      message: `Potential LaTeX issue: ${unsafe.join(" ")}`,
    })
  }

  const needsTable = card.pattern === "bullets-table"
  if (needsTable) {
    if (!Array.isArray(card.table?.rows) || card.table.rows.length < 1) {
      msgs.push({ level: "error", field: "table", message: "Table has no rows." })
    }
    const widths = new Set(Array.isArray(card.table?.rows) ? card.table.rows.map((r) => Array.isArray(r) ? r.length : 0) : [])
    if (widths.size > 1) {
      msgs.push({
        level: "error",
        field: "table",
        message: "All table rows must have the same number of columns.",
      })
    }
  }

  const figureCount =
    card.pattern === "bullets-image" || card.pattern === "image-focused" || card.pattern === "section-figure" || card.pattern === "figure-slide"
      ? 1
      : card.pattern === "bullets-two-images" || card.pattern === "section-two-figures"
        ? 2
        : 0
  const presentFigures = Array.isArray(card.figures) ? card.figures.filter((f) => f && typeof f.url === "string" && f.url.trim()).length : 0
  if (figureCount > 0 && presentFigures < figureCount) {
    msgs.push({
      level: "error",
      field: "figures",
      message: `Pattern expects ${figureCount} image${figureCount > 1 ? "s" : ""}, found ${presentFigures}.`,
    })
  }

  const budget = columnBudgetFor(templateId)
  const height = estimateHeight(card)
  if (height > budget) {
    // Name the concrete edits that close the gap rather than leaving the
    // user to guess which part of the card is expensive.
    const fixes = suggestReductions(card, budget)
    const advice = fixes.length ? ` Options: ${fixes.join(", ")}.` : ""
    msgs.push({
      level: "warning",
      field: "content",
      message: `Estimated height ${height}u exceeds column budget ${budget}u by ${height - budget}u — likely overflow.${advice}`,
    })
  } else if (height > budget * 0.85) {
    msgs.push({
      level: "info",
      field: "content",
      message: `Estimated height ${height}u is close to the column budget (${budget}u).`,
    })
  }

  return msgs
}

export function levelFromMessages(
  msgs: ValidationMessage[],
): "valid" | "warning" | "invalid" {
  if (msgs.some((m) => m.level === "error")) return "invalid"
  if (msgs.some((m) => m.level === "warning")) return "warning"
  return "valid"
}

