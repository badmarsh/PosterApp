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

import { assertSafeExternalUrl, sanitizeFilename } from "@/lib/security"
import { ACADEMIC_TIMEOUTS_MS, boundedSignal, isAbortLike } from "./academic-http"
import { stripDoi } from "./academic-identifiers"

export function resolvePdfUrl(input: string): { pdfUrl: string; arxivId?: string; filename: string } {
  const trimmed = input.trim()
  const arxivId = parseArxivId(trimmed)

  if (arxivId) {
    const cleanId = arxivId.replace(/v\d+$/, "")
    return {
      arxivId: cleanId,
      pdfUrl: `https://arxiv.org/pdf/${cleanId}.pdf`,
      filename: sanitizeFilename(`arxiv_${cleanId.replace(/\./g, "_")}.pdf`, "arxiv_paper.pdf"),
    }
  }

  // Direct PDF URL with SSRF protection
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const urlObj = assertSafeExternalUrl(trimmed)
    const baseName = urlObj.pathname.split("/").pop() || "downloaded_paper.pdf"
    const safeFilename = baseName.endsWith(".pdf") ? baseName : `${baseName}.pdf`
    return {
      pdfUrl: urlObj.href,
      filename: sanitizeFilename(safeFilename, "downloaded_paper.pdf"),
    }
  }

  throw new Error("Invalid URL or arXiv identifier provided")
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
}

export async function fetchArxivMetadata(
  arxivId: string,
  options?: { signal?: AbortSignal }
): Promise<PaperMetadata | null> {
  try {
    const cleanId = arxivId.replace(/v\d+$/, "")
    const apiUrl = `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(cleanId)}`
    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "PosterApp-Scientific-Paper-Importer/1.0" },
      signal: boundedSignal(options?.signal, ACADEMIC_TIMEOUTS_MS.arxiv),
    })

    if (!res.ok) return null

    const xml = await res.text()
    const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/i)
    if (!entryMatch) return null
    const entry = entryMatch[1]

    // Simple regex extraction to avoid heavy XML parser dependencies
    const titleMatch = entry.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const summaryMatch = entry.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)
    const publishedMatch = entry.match(/<published>(\d{4})/i)
    const doiMatch = entry.match(/<arxiv:doi[^>]*>([\s\S]*?)<\/arxiv:doi>/i)

    // Extract authors
    const authorMatches = Array.from(entry.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>/gi))
    const authors = authorMatches.map((m) => decodeXmlEntities(m[1]).trim()).filter(Boolean)

    const title = titleMatch ? decodeXmlEntities(titleMatch[1]).replace(/\s+/g, " ").trim() : undefined
    const abstract = summaryMatch ? decodeXmlEntities(summaryMatch[1]).replace(/\s+/g, " ").trim() : undefined
    const publishedYear = publishedMatch ? publishedMatch[1] : undefined
    const doi = doiMatch ? stripDoi(doiMatch[1]) || undefined : undefined

    return {
      arxivId: cleanId,
      title,
      authors,
      abstract,
      doi,
      publishedYear,
      pdfUrl: `https://arxiv.org/pdf/${cleanId}.pdf`,
    }
  } catch (err) {
    if (!isAbortLike(err)) console.warn("Arxiv metadata fetch error:", err)
    return null
  }
}
