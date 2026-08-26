import type { Card, ValidationMessage } from "@/lib/poster-types"
import { COLUMN_BUDGET, estimateHeight } from "./layout"

export function hasUnsafeLatex(input: string): string[] {
  const found = new Set<string>()

  let depth = 0
  for (const ch of input) {
    if (ch === "{") depth++
    else if (ch === "}") depth--
    if (depth < 0) { found.add("unbalanced {}"); break }
  }
  if (depth !== 0) found.add("unbalanced {}")

  return [...found]
}

export function validateCard(card: Card): ValidationMessage[] {
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

  const height = estimateHeight(card)
  if (height > COLUMN_BUDGET) {
    msgs.push({
      level: "warning",
      field: "content",
      message: `Estimated height ${height}u exceeds column budget ${COLUMN_BUDGET}u — likely overflow.`,
    })
  } else if (height > COLUMN_BUDGET * 0.85) {
    msgs.push({
      level: "info",
      field: "content",
      message: `Estimated height ${height}u is close to the column budget.`,
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

