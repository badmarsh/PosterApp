import { prisma } from "@/lib/prisma"
import { generateAITextResponse } from "@/lib/ai/client"
import { resolveAiModel, AI_TIMEOUTS } from "@/lib/ai/models"
import { hasUnsafeLatex } from "@/lib/latex/validation"

/**
 * Validates that a BibTeX entry has a recognizable type, key, and balanced braces.
 */
function isValidBibtexEntry(entry: string): boolean {
  const trimmed = entry.trim()
  if (!trimmed.startsWith("@") || !trimmed.endsWith("}")) return false
  if (!/^@\w+\s*\{[^,]+,[\s\S]+\}$/.test(trimmed)) return false
  if (hasUnsafeLatex(trimmed).length > 0) return false
  return true
}

export async function extractBibTeX(mdContent: string, workspaceId: string): Promise<void> {
  try {
    const refMatch = mdContent.match(/#+\s*References?\s*\n([\s\S]+)$/i)
    if (!refMatch) {
      return
    }

    const refText = refMatch[1].substring(0, 8000) // Limit size to ~8k chars
    const prompt = `Convert the following references section from a research paper into valid BibTeX format. Make sure to generate cite keys in a standard format (e.g. FirstAuthorYear). Provide ONLY the raw BibTeX output, no markdown wrappers, no explanations.\n\n${refText}`

    let bibtex: string
    try {
      bibtex = await generateAITextResponse("bibtex-extract", {
        model: resolveAiModel("bibtex"),
        userPrompt: prompt,
        signal: AbortSignal.timeout(AI_TIMEOUTS.bibtex),
      })
    } catch {
      return
    }

    bibtex = bibtex.replace(/```bibtex/gi, "").replace(/```/g, "").trim()

    if (bibtex.length > 20) {
      const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } })
      if (!workspace) return

      const currentBib = workspace.bibContent || ""
      const oldKeys = new Set<string>((workspace.bibKeys as string[]) || [])

      const existingTitles = new Set<string>()
      for (const entry of currentBib.split(/(?=@\w+\{)/)) {
        const titleMatch = entry.match(/title\s*=\s*[\{"](.+?)[\}"]/i)
        if (titleMatch) {
          existingTitles.add(titleMatch[1].toLowerCase().replace(/[^a-z0-9]/g, ""))
        }
      }

      const entries = bibtex.split(/(?=@\w+\{)/)
      let deduplicatedBibtex = ""
      let newKeysCount = 0

      for (const rawEntry of entries) {
        const entry = rawEntry.trim()
        if (!entry) continue

        // Check structural validity before accepting
        if (!isValidBibtexEntry(entry)) {
          console.warn("[bibtex-service] Skipping structurally invalid BibTeX entry:", entry.slice(0, 50))
          continue
        }

        const match = /@\w+\{([^,]+),/.exec(entry)
        let isDuplicate = false
        const titleMatch = entry.match(/title\s*=\s*[\{"](.+?)[\}"]/i)
        const normalizedTitle = titleMatch ? titleMatch[1].toLowerCase().replace(/[^a-z0-9]/g, "") : null

        if (match) {
          const key = match[1].trim()
          if (oldKeys.has(key)) isDuplicate = true
        }
        if (normalizedTitle && existingTitles.has(normalizedTitle)) {
          isDuplicate = true
        }

        if (!isDuplicate) {
          deduplicatedBibtex += entry + "\n\n"
          if (match) oldKeys.add(match[1].trim())
          if (normalizedTitle) existingTitles.add(normalizedTitle)
          newKeysCount++
        }
      }

      deduplicatedBibtex = deduplicatedBibtex.trim()
      if (deduplicatedBibtex.length > 0) {
        const newBib = currentBib ? currentBib + "\n\n" + deduplicatedBibtex : deduplicatedBibtex
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            bibContent: newBib,
            bibKeys: JSON.stringify(Array.from(oldKeys)),
          },
        })
      }
    }
  } catch (err) {
    console.error("Failed to auto-extract BibTeX:", err)
  }
}
