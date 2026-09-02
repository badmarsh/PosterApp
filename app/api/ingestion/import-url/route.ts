import { NextRequest, NextResponse } from "next/server"
import { requireWorkspaceEditor } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { resolvePdfUrl, fetchArxivMetadata } from "@/lib/services/arxiv-service"
import { prisma } from "@/lib/prisma"
import { parseBibEntries, formatBibEntry, slugifyCiteKey } from "@/lib/bib-types"
import { assertSafeExternalUrl } from "@/lib/security"

const MAX_PDF_BYTES = 50 * 1024 * 1024 // 50 MB

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { workspaceId, url } = body

    if (!workspaceId || typeof workspaceId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(workspaceId)) {
      return NextResponse.json({ error: "Valid workspace ID is required" }, { status: 400 })
    }

    if (!url || typeof url !== "string" || !url.trim()) {
      return NextResponse.json({ error: "Valid paper URL or arXiv ID is required" }, { status: 400 })
    }

    let userId: string
    try {
      const access = await requireWorkspaceEditor(workspaceId)
      userId = access.userId
    } catch (err) {
      if (err instanceof Response) return err
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:paper-import`, 10, 60_000)
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limited. Please wait before importing more papers.", retryAfterMs },
        {
          status: 429,
          headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() },
        }
      )
    }

    const { pdfUrl, arxivId, filename } = resolvePdfUrl(url)

    // Validate initial URL for SSRF protection
    assertSafeExternalUrl(pdfUrl)

    // Safe fetch with manual redirect validation loop (max 5 hops)
    let currentUrl = pdfUrl
    let pdfResponse: Response | null = null
    const MAX_REDIRECTS = 5

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      assertSafeExternalUrl(currentUrl)

      const res = await fetch(currentUrl, {
        headers: {
          "User-Agent": "PosterApp-Paper-Downloader/1.0 (academic research tool)",
        },
        redirect: "manual",
        signal: AbortSignal.timeout(60_000), // 1 minute download timeout
      })

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get("location")
        if (!location) {
          return NextResponse.json({ error: "Redirect location header missing" }, { status: 502 })
        }
        currentUrl = new URL(location, currentUrl).toString()
        continue
      }

      pdfResponse = res
      break
    }

    if (!pdfResponse || !pdfResponse.ok) {
      return NextResponse.json(
        { error: `Failed to download PDF from source (HTTP ${pdfResponse?.status ?? 502})` },
        { status: 502 }
      )
    }

    // Check Content-Length header before buffering (A5)
    const clHeader = pdfResponse.headers.get("content-length")
    if (clHeader) {
      const declaredLen = Number(clHeader)
      if (Number.isFinite(declaredLen) && declaredLen > MAX_PDF_BYTES) {
        return NextResponse.json({ error: "PDF file is too large (max 50MB)" }, { status: 413 })
      }
    }

    // Stream the body with a byte cap to prevent memory exhaustion (A5)
    if (!pdfResponse.body) {
      return NextResponse.json({ error: "Empty response body" }, { status: 502 })
    }

    const reader = pdfResponse.body.getReader()
    const chunks: Uint8Array[] = []
    let totalBytes = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        totalBytes += value.length
        if (totalBytes > MAX_PDF_BYTES) {
          await reader.cancel()
          return NextResponse.json({ error: "PDF file is too large (max 50MB)" }, { status: 413 })
        }
        chunks.push(value)
      }
    }

    const buffer = Buffer.concat(chunks)

    // Optional: fetch arXiv metadata if available
    let metadata = null
    if (arxivId) {
      metadata = await fetchArxivMetadata(arxivId)
      if (metadata && metadata.title) {
        // Automatically add to bibliography
        try {
          const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { bibContent: true },
          })
          const currentBib = workspace?.bibContent || ""
          const citeKey = slugifyCiteKey(
            metadata.authors?.[0] || "arxiv",
            metadata.publishedYear || new Date().getFullYear().toString(),
            metadata.title
          )

          const existingEntries = parseBibEntries(currentBib)
          if (!existingEntries.some((e) => e.key === citeKey)) {
            const newBib = formatBibEntry({
              key: citeKey,
              type: "article",
              title: metadata.title,
              authorString: metadata.authors?.join(" and ") || "Unknown",
              year: metadata.publishedYear,
              journal: `arXiv preprint arXiv:${arxivId}`,
              url: `https://arxiv.org/abs/${arxivId}`,
            })
            const mergedBib = currentBib.trim() ? `${currentBib.trim()}\n\n${newBib}` : newBib
            await prisma.workspace.update({
              where: { id: workspaceId },
              data: { bibContent: mergedBib },
            })
          }
        } catch (bibErr) {
          console.warn("Auto-bib addition error:", bibErr)
        }
      }
    }

    // Return the base64 or forward to MinerU
    // We create a File-like blob/base64 response so the client or parser can process it seamlessly
    const base64Pdf = buffer.toString("base64")

    return NextResponse.json({
      ok: true,
      filename,
      fileSize: buffer.length,
      pdfBase64: base64Pdf,
      metadata,
    })
  } catch (err: unknown) {
    console.error("Paper URL import error:", err)
    const message = err instanceof Error ? err.message : "Failed to import paper from URL"
    const isClientError = message.includes("SSRF") || message.includes("Invalid URL") || message.includes("Unsupported protocol")
    return NextResponse.json(
      { error: isClientError ? message : "Failed to import paper from URL" },
      { status: isClientError ? 400 : 500 }
    )
  }
}
