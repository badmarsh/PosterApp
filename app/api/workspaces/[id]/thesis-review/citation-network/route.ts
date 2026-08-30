import { NextRequest } from "next/server"
import { requireWorkspaceEditor } from "@/lib/auth"
import { loadThesisContext } from "@/lib/ai/thesis-context"
import { searchOpenAlexWorks } from "@/lib/services/openalex-service"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params

  try {
    await requireWorkspaceEditor(workspaceId)
  } catch (err) {
    if (err instanceof Response) return err
    return new Response("Unauthorized", { status: 401 })
  }

  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  let isClosed = false

  const sendEvent = async (event: string, data: any) => {
    if (isClosed || req.signal.aborted) return
    try {
      await writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
    } catch {
      isClosed = true
    }
  }

  const closeStream = async () => {
    if (isClosed) return
    isClosed = true
    try {
      await writer.close()
    } catch {}
  }

  ;(async () => {
    try {
      await sendEvent("status", { message: "Loading thesis context..." })

      const ragContext = await loadThesisContext({
        workspaceId,
        thesisMetadata: {
          studentName: "Student",
          thesisTitle: "Thesis",
          thesisType: "master",
          reviewerRole: "opponent",
          language: "sk",
        },
        maxChars: 120_000,
      })

      if (req.signal.aborted || isClosed) return

      const titles = ragContext.referencesTitles || []
      
      await sendEvent("init_graph", { 
        thesisNode: { id: "thesis", label: "Analyzovaná práca", type: "central" },
        totalCitations: titles.length
      })

      if (titles.length === 0) {
        await sendEvent("status", { message: "Nenašli sa žiadne citácie." })
        await closeStream()
        return
      }

      await sendEvent("status", { message: `Extrahovaných ${titles.length} citácií. Spúšťam OpenAlex validáciu (2 req/s)...` })

      // 2 requests per second rate limiting (500ms delay per request)
      for (let i = 0; i < titles.length; i++) {
        if (req.signal.aborted || isClosed) break

        const title = titles[i]
        await sendEvent("verifying", { index: i + 1, total: titles.length, title })
        
        let statusColor = "slate-400"
        let enrichedData = null

        // Clean and sanitize query
        const query = (title || "").replace(/^[\s?*+!#%&/\\-]+/, "").trim()
        if (query.length >= 3) {
          try {
            const results = await searchOpenAlexWorks(query, 1, { signal: req.signal })
            if (results && results.length > 0) {
              const bestMatch = results[0]
              enrichedData = bestMatch
              if (bestMatch.publicationYear && bestMatch.publicationYear < 2014) {
                statusColor = "amber-400"
              } else {
                statusColor = "emerald-400"
              }
            }
          } catch (err) {
            console.error(`[CitationNetwork] Error looking up ${title}:`, err)
          }
        }

        if (req.signal.aborted || isClosed) break

        await sendEvent("node_resolved", {
          id: `cite_${i}`,
          label: title.slice(0, 40) + (title.length > 40 ? "..." : ""),
          fullTitle: title,
          statusColor,
          year: enrichedData?.publicationYear,
          authors: enrichedData?.authors,
        })

        // Rate limit: ~500ms between requests to respect OpenAlex guidelines
        if (i < titles.length - 1) {
          await new Promise(r => setTimeout(r, 500))
        }
      }

      if (!req.signal.aborted && !isClosed) {
        await sendEvent("status", { message: "Validácia citačnej siete dokončená." })
        await sendEvent("done", {})
      }
    } catch (error) {
      if (!req.signal.aborted && !isClosed) {
        console.error("SSE Error:", error)
        await sendEvent("error", { message: "Nastala chyba pri generovaní siete." })
      }
    } finally {
      await closeStream()
    }
  })()

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
