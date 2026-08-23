import type { Card } from "@/lib/poster-types"

export function computeWorkspaceDiff(oldWs: any, newWs: any): string[] {
  const changes: string[] = []

  if (!oldWs) {
    return ["Created initial project layout."]
  }

  // Check top-level metadata
  if (oldWs.name !== newWs.name) changes.push(`Renamed project to "${newWs.name}"`)
  if (oldWs.authors !== newWs.authors) changes.push(`Updated authors list`)
  
  // Find active output cards
  const oldActiveOutput = (oldWs.outputs || []).find((o: any) => o.isActive) || (oldWs.outputs || [])[0]
  const newActiveOutput = (newWs.outputs || []).find((o: any) => o.isActive) || (newWs.outputs || [])[0]

  const oldCards: Card[] = oldActiveOutput?.cards || oldWs.cards || []
  const newCards: Card[] = newActiveOutput?.cards || newWs.cards || []

  // Compare cards by ID
  const oldCardMap = new Map(oldCards.map(c => [c.id, c]))
  const newCardMap = new Map(newCards.map(c => [c.id, c]))

  for (const newCard of newCards) {
    if (!oldCardMap.has(newCard.id)) {
      changes.push(`Added new card: "${newCard.title || 'Untitled'}"`)
      continue
    }
    const oldCard = oldCardMap.get(newCard.id)!
    
    // Check title
    if (oldCard.title !== newCard.title) {
      changes.push(`Renamed card to "${newCard.title}"`)
    }

    // Check content (only flag if meaningful delta)
    const oldLen = (oldCard.content || "").length
    const newLen = (newCard.content || "").length
    if (Math.abs(oldLen - newLen) > 30) {
      if (newLen > oldLen) changes.push(`Expanded content in "${newCard.title}" (+${newLen - oldLen} chars)`)
      else changes.push(`Shortened content in "${newCard.title}" (-${oldLen - newLen} chars)`)
    } else if (oldCard.content !== newCard.content) {
      // Minor edit, maybe ignore to save LLM tokens if it's the only thing, but we'll include it.
      changes.push(`Edited text in "${newCard.title}"`)
    }

    // Check figures
    const oldFigs = (oldCard.figures || []).length
    const newFigs = (newCard.figures || []).length
    if (newFigs > oldFigs) changes.push(`Added figure to "${newCard.title}"`)
    else if (oldFigs > newFigs) changes.push(`Removed figure from "${newCard.title}"`)
  }

  for (const oldCard of oldCards) {
    if (!newCardMap.has(oldCard.id)) {
      changes.push(`Deleted card: "${oldCard.title || 'Untitled'}"`)
    }
  }

  // Compare assets globally
  const oldAssets = oldWs.assets || []
  const newAssets = newWs.assets || []
  if (newAssets.length > oldAssets.length) {
    changes.push(`Imported ${newAssets.length - oldAssets.length} new asset(s)`)
  } else if (oldAssets.length > newAssets.length) {
    changes.push(`Deleted ${oldAssets.length - newAssets.length} asset(s)`)
  }

  return changes
}
