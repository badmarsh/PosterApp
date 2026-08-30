export interface PaperMetadata {
  title?: string
  authors?: string[]
  abstract?: string
  doi?: string
  arxivId?: string
  pdfUrl?: string
  publishedYear?: string
}

export function parseArxivId(input: string): string | null {
  const trimmed = input.trim()
  // Matches: 2301.12345, 2301.12345v2, arxiv:2301.12345, https://arxiv.org/abs/2301.12345, https://arxiv.org/pdf/2301.12345.pdf
  const match = trimmed.match(/(?:arxiv\.org\/(?:abs|pdf)\/|arxiv:\s*|^)(\d{4}\.\d{4,5}(?:v\d+)?)(?:\.pdf)?/i)
  if (match) {
    return match[1]
  }
  return null
}

export function resolvePdfUrl(input: string): { pdfUrl: string; arxivId?: string; filename: string } {
  const trimmed = input.trim()
  const arxivId = parseArxivId(trimmed)

  if (arxivId) {
    const cleanId = arxivId.replace(/v\d+$/, "")
    return {
      arxivId: cleanId,
      pdfUrl: `https://arxiv.org/pdf/${cleanId}.pdf`,
      filename: `arxiv_${cleanId.replace(/\./g, "_")}.pdf`,
    }
  }

  // Direct PDF URL
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const urlObj = new URL(trimmed)
    const baseName = urlObj.pathname.split("/").pop() || "downloaded_paper.pdf"
    const safeFilename = baseName.endsWith(".pdf") ? baseName : `${baseName}.pdf`
    return {
      pdfUrl: trimmed,
      filename: safeFilename.replace(/[^a-zA-Z0-9._-]/g, "_"),
    }
  }

  throw new Error("Invalid URL or arXiv identifier provided")
}

export async function fetchArxivMetadata(arxivId: string): Promise<PaperMetadata | null> {
  try {
    const cleanId = arxivId.replace(/v\d+$/, "")
    const apiUrl = `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(cleanId)}`
    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "PosterApp-Scientific-Paper-Importer/1.0" },
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) return null

    const xml = await res.text()
    // Simple regex extraction to avoid heavy XML parser dependencies
    const titleMatch = xml.match(/<entry>[\s\S]*?<title>([\s\S]*?)<\/title>/i)
    const summaryMatch = xml.match(/<entry>[\s\S]*?<summary>([\s\S]*?)<\/summary>/i)
    const publishedMatch = xml.match(/<entry>[\s\S]*?<published>(\d{4})/i)
    
    // Extract authors
    const authorMatches = Array.from(xml.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>/gi))
    const authors = authorMatches.map((m) => m[1].trim()).filter(Boolean)

    const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : undefined
    const abstract = summaryMatch ? summaryMatch[1].replace(/\s+/g, " ").trim() : undefined
    const publishedYear = publishedMatch ? publishedMatch[1] : undefined

    return {
      arxivId: cleanId,
      title,
      authors,
      abstract,
      publishedYear,
      pdfUrl: `https://arxiv.org/pdf/${cleanId}.pdf`,
    }
  } catch (err) {
    console.warn("Arxiv metadata fetch error:", err)
    return null
  }
}
