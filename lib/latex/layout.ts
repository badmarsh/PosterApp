import type { Card } from "@/lib/poster-types"

export const COLUMN_BUDGET = 900

export function estimateHeight(card: Card): number {
  let h = 70 // title + chrome
  if (card.pattern === "references") return h + 150

  h += Math.floor(card.content.length / 60) * 14
  const bulletCount = (card.content.match(/^[-*]\s/gm) || []).length
  h += bulletCount * 10

  if (card.pattern === "bullets-table") {
    h += 30 + (Array.isArray(card.table?.rows) ? card.table.rows.length : 0) * 26
  }
  if (card.pattern === "bullets-image" || card.pattern === "image-focused") {
    h += card.pattern === "image-focused" ? 260 : 190
  }
  if (card.pattern === "bullets-two-images") h += 150
  return h
}

