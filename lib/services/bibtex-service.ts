import { prisma } from "@/lib/prisma"

export async function extractBibTeX(mdContent: string, workspaceId: string): Promise<void> {
  try {
    const refMatch = mdContent.match(/#+\s*References?\s*\n([\s\S]+)$/i)
    if (!refMatch || !process.env.AI_API_URL || !process.env.AI_API_KEY) {
      return
    }

    const refText = refMatch[1].substring(0, 8000) // Limit size to ~8k chars
    const prompt = `Convert the following references section from a research paper into valid BibTeX format. Make sure to generate cite keys in a standard format (e.g. FirstAuthorYear). Provide ONLY the raw BibTeX output, no markdown wrappers, no explanations.\n\n${refText}`
    
    const res = await fetch(process.env.AI_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.AI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }]
      })
    })

    if (!res.ok) return

    const data = await res.json()
    let bibtex = data.choices?.[0]?.message?.content || ""
    bibtex = bibtex.replace(/```bibtex/gi, "").replace(/```/g, "").trim()
    
    if (bibtex.length > 20) {
      const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } })
      if (!workspace) return
      
      const currentBib = workspace.bibContent || ""
      const oldKeysStr = workspace.bibKeys || "[]"
      const oldKeys = new Set<string>(JSON.parse(oldKeysStr))
      
      const existingTitles = new Set<string>()
      for (const entry of currentBib.split(/(?=@\w+\{)/)) {
        const titleMatch = entry.match(/title\s*=\s*[\{"](.+?)[\}"]/i)
        if (titleMatch) {
          existingTitles.add(titleMatch[1].toLowerCase().replace(/[^a-z0-9]/g, ''))
        }
      }
      
      const entries = bibtex.split(/(?=@\w+\{)/)
      let deduplicatedBibtex = ""
      let newKeysCount = 0

      for (const entry of entries) {
        if (!entry.trim()) continue
        const match = /@\w+\{([^,]+),/.exec(entry)
        
        let isDuplicate = false
        const titleMatch = entry.match(/title\s*=\s*[\{"](.+?)[\}"]/i)
        const normalizedTitle = titleMatch ? titleMatch[1].toLowerCase().replace(/[^a-z0-9]/g, '') : null
        
        if (match) {
          const key = match[1].trim()
          if (oldKeys.has(key)) isDuplicate = true
        }
        if (normalizedTitle && existingTitles.has(normalizedTitle)) {
          isDuplicate = true
        }

        if (!isDuplicate) {
          deduplicatedBibtex += entry.trim() + "\n\n"
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
            bibKeys: JSON.stringify(Array.from(oldKeys))
          }
        })
        console.log(`Successfully extracted ${newKeysCount} new BibTeX citations for workspace ${workspaceId}`)
      }
    }
  } catch (err) {
    console.error("Failed to auto-extract BibTeX:", err)
  }
}
