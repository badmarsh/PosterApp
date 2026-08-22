import { NextRequest, NextResponse } from "next/server"
import * as fs from "fs"
import * as path from "path"
import { rateLimit } from "@/lib/rate-limit"
import { parseAiJson } from "@/lib/ai-helpers"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const WORKSPACES_DIR = path.join(process.cwd(), "workspaces")

// Max characters of source context to send to the AI (≈ 60k tokens safe limit)
const MAX_SOURCE_CHARS = 80_000

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  const { id: workspaceId, cardId } = await params
  
  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId) || !/^[a-zA-Z0-9_-]+$/.test(cardId)) {
    return NextResponse.json({ error: 'Invalid workspace or card ID' }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const { allowed, retryAfterMs } = rateLimit(ip, 10, 60_000)
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited', retryAfterMs }, { status: 429, headers: { 'Retry-After': Math.ceil(retryAfterMs / 1000).toString() } })
  }

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId, userId }
  })
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found or unauthorized" }, { status: 404 })
  }

  if (!process.env.AI_API_URL || !process.env.AI_API_KEY) {
    return NextResponse.json({ error: "AI API configuration missing" }, { status: 503 })
  }

  try {
    const body = await req.json()
    const { topic, assets, sourceIds, characterLimit = 300, bibKeys = [], outputType = "poster" } = body

    if (!topic) {
      return NextResponse.json({ error: "Card topic is required" }, { status: 400 })
    }

    // 1. Load source markdown files (with token budget cap)
    const sourcesDir = path.join(WORKSPACES_DIR, workspaceId, "sources")
    let sourceContext = ""
    if (fs.existsSync(sourcesDir)) {
      const files = await fs.promises.readdir(sourcesDir)
      for (const file of files) {
        if (file.endsWith(".md")) {
          const id = file.replace(".md", "")
          // If sourceIds is provided and not empty, skip files not in the array
          if (Array.isArray(sourceIds) && sourceIds.length > 0 && !sourceIds.includes(id)) {
            continue
          }
          const content = await fs.promises.readFile(path.join(sourcesDir, file), "utf-8")
          const chunk = `\n\n--- Source Document: ${file} ---\n\n${content}`
          // Stop adding sources once we approach the token budget
          if (sourceContext.length + chunk.length > MAX_SOURCE_CHARS) {
            // Truncate this chunk to fit the remaining budget
            const remaining = MAX_SOURCE_CHARS - sourceContext.length
            if (remaining > 500) {
              sourceContext += chunk.slice(0, remaining) + "\n\n[...truncated for length...]"
            }
            break
          }
          sourceContext += chunk
        }
      }
    }

    if (!sourceContext) {
      return NextResponse.json({ error: "No parsed documents found in workspace. Please ingest PDFs first." }, { status: 400 })
    }

    // 2. Format available assets
    const availableAssets = (assets || []).map((a: {id: string, kind: string, caption?: string, snippet?: string, filename?: string}) => ({
      id: a.id,
      filename: a.filename,
      kind: a.kind,
      caption: a.caption,
      snippet: a.snippet
    }))

    // 3. Build prompt
    const isAutonomous = topic === "Untitled card" || topic.trim() === ""
    const typeLabel = outputType === "paper" ? "an academic paper" : outputType === "slides" ? "presentation slides" : "a scientific poster"
    const topicInstruction = isAutonomous 
      ? `The user has NOT specified a topic. You must autonomously analyze the <Source Material> and <Available Figures/Tables>, and decide on the most compelling scientific section to create for this ${outputType} (e.g., "Methodology", "Key Results", "Conclusion"). Choose the topic that has the most solid content and supporting figures.`
      : `The user explicitly wants a ${outputType} section about: "${topic}". You must focus ONLY on this topic.`

    const formatConstraint = outputType === "paper" 
      ? `- Write cohesive academic paragraphs. Return the paragraphs as an array of strings (one string per paragraph) in the "bullets" JSON field. Do not use markdown bullet syntax (*), just return raw paragraphs.`
      : outputType === "slides"
      ? `- Write very short, punchy bullet points suitable for presentation slides. Each bullet must be at most 1 sentence.`
      : `- Each bullet should be no longer than 1-2 sentences.`

    const prompt = `You are an expert academic assistant tasked with writing a section for ${typeLabel}.

<Source Material>
${sourceContext}
</Source Material>

<Available Figures/Tables>
${JSON.stringify(availableAssets, null, 2)}
</Available Figures/Tables>

<Valid Cite Keys>
${JSON.stringify(bibKeys)}
</Valid Cite Keys>

${topicInstruction}

IMPORTANT constraints:
- STRICT GROUNDING: You MUST base your content STRICTLY and ONLY on the provided <Source Material>. Do NOT use outside knowledge, do NOT search the web, and do NOT hallucinate facts.
- NO HALLUCINATED CITATIONS: If you use the \\cite{} command, you MUST ONLY use keys from the <Valid Cite Keys> array. If the array is empty, do not use citations.
- INLINE EQUATIONS: If the topic involves equations or math from the source text, you may reproduce them verbatim in the bullets as LaTeX math (e.g. $E=mc^2$ or $$...$$).
- The TOTAL combined length of all text you generate MUST be strictly around ${characterLimit} characters to fit the physical constraints of the ${outputType} layout.
${formatConstraint}

Also, review the available figures/tables. If any of them strongly support the points you made, assign them to 'figure1' or 'figure2'. You can assign up to 2 assets. To accurately identify the assets, look for their \`filename\` in the <Source Material>.

Respond EXACTLY in this JSON format with no markdown wrappers:
{
  "title": "The topic title you wrote about (e.g. 'Methods', 'Results')",
  "bullets": ["Point 1...", "Point 2..."],
  "assignedAssets": [
    { "slot": "figure1", "assetId": "..." },
    { "slot": "figure2", "assetId": "..." }
  ]
}`

    const model = process.env.AI_GENERATION_MODEL || process.env.AI_MODEL || "gemini-3-flash"

    const response = await fetch(process.env.AI_API_URL as string, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.AI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      }),
      signal: AbortSignal.timeout(60_000)
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`AI API failed (${response.status}): ${errText}`)
    }

    const data = await response.json()

    // Safe null-check: model may return 0 choices on safety block / rate limit
    if (!data.choices?.length) {
      throw new Error("AI returned no choices — possible rate limit or safety block")
    }

    const responseText = data.choices[0].message?.content
    
    if (!responseText) {
      throw new Error("Empty response from AI")
    }
    
    const { data: parsed, error } = parseAiJson(responseText)
    if (error) {
      throw new Error(error)
    }
    
    return NextResponse.json(parsed)
  } catch (err: unknown) {
    console.error("Card generation failed:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate card content" },
      { status: 500 }
    )
  }
}
