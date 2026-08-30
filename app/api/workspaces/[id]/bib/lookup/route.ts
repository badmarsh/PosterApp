import { NextRequest, NextResponse } from "next/server"
import { requireWorkspaceEditor } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { generateAITextResponse } from "@/lib/ai/client"
import { resolveAiModel, AI_TIMEOUTS } from "@/lib/ai/models"
import { parseBibEntries } from "@/lib/bib-types"
import { wrapUntrustedContext } from "@/lib/ai/prompts"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params

  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId)) {
    return NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 })
  }

  let userId: string
  try {
    const access = await requireWorkspaceEditor(workspaceId)
    userId = access.userId
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:bib-lookup`, 25, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limited. Please wait.", retryAfterMs },
      {
        status: 429,
        headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() },
      }
    )
  }

  try {
    const body = await req.json()
    const { query } = body

    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 })
    }

    const trimmedQuery = query.trim()

    // Prompt AI to generate high-accuracy academic BibTeX for the query (title, DOI, or arXiv)
    const prompt = `You are a scientific bibliography and reference retrieval engine.
Generate an accurate, standard BibTeX entry for the following paper query, DOI, or arXiv reference:

${wrapUntrustedContext("Query", trimmedQuery)}

Requirements:
1. Generate standard citekey (e.g. FirstAuthorYear or CollaborationYear_Keyword).
2. Include fields: author, title, journal/booktitle, year, volume, pages, doi, url, and abstract if known.
3. Respond ONLY with the raw BibTeX entry (e.g. @article{...}), no markdown code blocks, no explanations.`

    const bibtex = await generateAITextResponse("bib-lookup", {
      model: resolveAiModel("bibtex"),
      userPrompt: prompt,
      temperature: 0.1,
      signal: AbortSignal.timeout(AI_TIMEOUTS.bibtex),
    })

    const cleanedBibtex = bibtex.replace(/```bibtex/gi, "").replace(/```/g, "").trim()
    const parsedEntries = parseBibEntries(cleanedBibtex)

    if (parsedEntries.length === 0) {
      return NextResponse.json(
        { error: "Could not generate valid BibTeX for this query" },
        { status: 422 }
      )
    }

    return NextResponse.json({
      ok: true,
      entry: parsedEntries[0],
      rawBibtex: cleanedBibtex,
    })
  } catch (err: unknown) {
    console.error("Bib lookup error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to lookup citation" },
      { status: 500 }
    )
  }
}
