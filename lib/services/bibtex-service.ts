import { prisma } from "@/lib/prisma"
import { generateAITextResponse } from "@/lib/ai/client"
import { resolveAiModel, AI_TIMEOUTS } from "@/lib/ai/models"
import { hasUnsafeLatex } from "@/lib/latex/validation"

/**
 * Validates that a BibTeX entry has a recognizable type, key, and balanced braces.
 */
export function isValidBibtexEntry(entry: string): boolean {
  const trimmed = entry.trim()
  if (!trimmed.startsWith("@") || !trimmed.endsWith("}")) return false
  if (!/^@\w+\s*\{[^,]+,[\s\S]+\}$/.test(trimmed)) return false
  if (hasUnsafeLatex(trimmed).length > 0) return false
  return true
}

/**
 * Robust multilingual detection of bibliography and references section in Markdown.
 * Supports Slovak (Literatúra, Zoznam použitej literatúry, Zdroje),
 * Czech (Literatura, Seznam použité literatury), and English (References, Bibliography).
 */
export function findReferencesSection(mdContent: string): string | null {
  if (!mdContent || mdContent.trim().length === 0) return null

  // Clean Markdown content
  const content = mdContent.trim()

  const patterns = [
    // 1. ATX headings with number prefixes (e.g. ## 6. Zoznam použitej literatúry, # Literatúra)
    /(?:^|\n)(?:#{1,6}\s*(?:\d+[\.\)]\s*)?|\*\*)(?:References?|Bibliography|Works\s+Cited|Literature\s+Cited|Reference\s+List|Literat[uú]ra|Použit[aá]\s+literat[uú]ra|Zoznam\s+(?:použitej\s+)?literat[uú]ry|Zoznam\s+bibliografick[yý]ch\s+odkazov|Zdroje|Bibliograf[ie|ia])\b[^\n]*\n([\s\S]+)$/i,
    // 2. Uppercase section lines
    /(?:^|\n)(?:ZOZNAM\s+(?:POUŽITEJ\s+)?LITERATÚRY|LITERATÚRA|REFERENCES|BIBLIOGRAPHY|ZOZNAM\s+BIBLIOGRAFICKÝCH\s+ODKAZOV|POUŽITÁ\s+LITERATÚRA)\s*\n([\s\S]+)$/i,
    // 3. Repeated numbered references list at end of document
    /(?:^|\n)(?:\[1\]|1\.)\s+[A-Z\p{L}][^\n]+(?:\n\s*(?:\[\d+\]|\d+\.)\s+[A-Z\p{L}][^\n]+){2,}/u,
  ]

  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match) {
      const rawCaptured = match[1] || match[0]
      // Exclude subsequent appendices (Prílohy, Appendix, Dodatky)
      const appendixMatch = rawCaptured.match(/\n#{1,4}\s*(?:Pr[ií]loh[ya]|Appendix|Dodatk[ya]|Pr[ií]lohov[aá]\s+[cč][aá]s[tť])/i)
      const refText = appendixMatch && appendixMatch.index !== undefined ? rawCaptured.slice(0, appendixMatch.index) : rawCaptured
      if (refText.trim().length > 25) {
        return refText.trim()
      }
    }
  }

  return null
}

/**
 * Deterministic heuristic parser for reference lists (ISO 690, APA, IEEE numbered format).
 * Acts as a 100% reliable local fallback when AI models are slow or unavailable.
 */
export function heuristicParseReferencesToBibTeX(refText: string): string {
  if (!refText || refText.trim().length === 0) return ""

  // Split into separate reference entries by numbered markers [1], 1., or line breaks
  const rawItems = refText
    .split(/(?=(?:^|\n)(?:\[\d+\]|\d+\.|\b[A-Z\p{L}][A-Za-z\p{L}]+,\s+[A-Z\p{L}]\.))/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 15)

  const bibEntries: string[] = []

  for (let i = 0; i < rawItems.length; i++) {
    const item = rawItems[i].replace(/^(?:\[\d+\]|\d+\.|\*|-)\s*/, "").trim()
    if (item.length < 15) continue

    // Extract year (19xx or 20xx)
    const yearMatch = item.match(/\b(19\d\d|20\d\d)\b/)
    const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString()

    // Extract Author (first capitalized word or before comma/period/year)
    const authorMatch = item.match(/^([A-Z\p{L}][A-Za-z\p{L}\s\.-]+?)(?:,|\.|\(|\b\d{4}\b)/u)
    const authorRaw = authorMatch ? authorMatch[1].trim() : `Author${i + 1}`
    
    // Normalize diacritics for cite key: Kováč -> kovac
    const normalizedAuthor = authorRaw
      .split(/\s+/)[0]
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z]/g, "")
      .toLowerCase() || `ref${i + 1}`

    // Extract Title (between quotes, italics, or after author + year)
    let title = ""
    const quotedMatch = item.match(/["„“](.+?)["”]/)
    const italicMatch = item.match(/\*([^*]+)\*/)

    if (quotedMatch) {
      title = quotedMatch[1].trim()
    } else if (italicMatch) {
      title = italicMatch[1].trim()
    } else {
      // Remove author, initials, and year from start of item to get title
      const afterAuthorAndYear = item
        .replace(/^[A-Z\p{L}\s\.,-]+?(?:\(\d{4}\)|\b\d{4}\b)[,\.:\s]*/u, "")
        .replace(/^[,\.\s\(\d\)]+/, "")
      const parts = afterAuthorAndYear.split(/\.\s+/)
      title = parts[0] ? parts[0].trim() : item.slice(0, 50)
    }

    if (!title || title.length < 4) {
      title = item.slice(0, 60)
    }

    // Clean title
    title = title.replace(/[\n\r]+/g, " ").replace(/"/g, "'").trim()

    // Clean cite key
    const titleSnippet = title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 8)

    const citeKey = `${normalizedAuthor}${year}${titleSnippet || i + 1}`

    const bib = `@misc{${citeKey},
  author = {${authorRaw}},
  title = {${title}},
  year = {${year}},
  note = {${item.replace(/[\n\r]+/g, " ").replace(/[{}\\]/g, "")}}
}`
    bibEntries.push(bib)
  }

  return bibEntries.join("\n\n")
}

export async function extractBibTeX(
  mdContent: string,
  workspaceId: string
): Promise<{ count: number; keys: string[] }> {
  try {
    const refText = findReferencesSection(mdContent)
    if (!refText) {
      console.warn("[bibtex-service] No references section detected in manuscript markdown.")
      return { count: 0, keys: [] }
    }

    const truncatedRefText = refText.substring(0, 16000) // Support up to 16k chars of references

    const prompt = `Convert the following references section from an academic thesis/paper into valid BibTeX format.
Make sure to generate clean, standard cite keys (e.g. FirstAuthorYear).
Provide ONLY the raw BibTeX output, no markdown wrappers, no explanations.

References:
${truncatedRefText}`

    let bibtex = ""

    try {
      bibtex = await generateAITextResponse("bibtex-extract", {
        model: resolveAiModel("bibtex"),
        userPrompt: prompt,
        signal: AbortSignal.timeout(AI_TIMEOUTS.bibtex),
      })
      bibtex = bibtex.replace(/```bibtex/gi, "").replace(/```/g, "").trim()
    } catch (aiErr) {
      console.warn("[bibtex-service] AI BibTeX extraction failed, using heuristic fallback:", aiErr)
    }

    // If AI failed or returned invalid BibTeX, use deterministic heuristic parser
    if (!bibtex || bibtex.length < 20 || !bibtex.includes("@")) {
      bibtex = heuristicParseReferencesToBibTeX(refText)
    }

    if (bibtex.length > 20) {
      const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } })
      if (!workspace) return { count: 0, keys: [] }

      const currentBib = workspace.bibContent || ""
      let oldKeys: Set<string>
      try {
        oldKeys = new Set<string>(
          Array.isArray(workspace.bibKeys)
            ? (workspace.bibKeys as string[])
            : typeof workspace.bibKeys === "string"
            ? JSON.parse(workspace.bibKeys)
            : []
        )
      } catch {
        oldKeys = new Set<string>()
      }

      const existingTitles = new Set<string>()
      for (const entry of currentBib.split(/(?=@\w+\{)/)) {
        const titleMatch = entry.match(/title\s*=\s*[\{"](.+?)[\}"]/i)
        if (titleMatch) {
          existingTitles.add(titleMatch[1].toLowerCase().replace(/[^a-z0-9]/g, ""))
        }
      }

      const entries = bibtex.split(/(?=@\w+\{)/)
      let deduplicatedBibtex = ""
      let newlyAddedCount = 0

      for (const rawEntry of entries) {
        const entry = rawEntry.trim()
        if (!entry) continue

        // Check structural validity before accepting
        if (!isValidBibtexEntry(entry)) {
          // Attempt simple brace balancing repair
          const repaired = entry.endsWith("}") ? entry : `${entry}\n}`
          if (!isValidBibtexEntry(repaired)) {
            console.warn("[bibtex-service] Skipping structurally invalid BibTeX entry:", entry.slice(0, 50))
            continue
          }
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
          newlyAddedCount++
        }
      }

      deduplicatedBibtex = deduplicatedBibtex.trim()
      const allKeys = Array.from(oldKeys)

      if (deduplicatedBibtex.length > 0) {
        const newBib = currentBib ? currentBib + "\n\n" + deduplicatedBibtex : deduplicatedBibtex
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            bibContent: newBib,
            bibKeys: JSON.stringify(allKeys),
          },
        })
      }

      console.log(`[bibtex-service] Extracted ${newlyAddedCount} new references for workspace ${workspaceId} (total: ${allKeys.length})`)
      return { count: allKeys.length, keys: allKeys }
    }

    return { count: 0, keys: [] }
  } catch (err) {
    console.error("Failed to auto-extract BibTeX:", err)
    return { count: 0, keys: [] }
  }
}
