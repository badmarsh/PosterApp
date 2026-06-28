import { NextRequest, NextResponse } from "next/server"
import * as fs from "fs"
import * as path from "path"

const WORKSPACES_DIR = path.join(process.cwd(), "workspaces")

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  const { id: workspaceId, cardId } = await params
  
  if (!process.env.AI_API_URL || !process.env.AI_API_KEY) {
    return NextResponse.json({ error: "AI API configuration missing" }, { status: 503 })
  }

  try {
    const body = await req.json()
    const { topic, assets, sourceIds, characterLimit = 300 } = body

    if (!topic) {
      return NextResponse.json({ error: "Card topic is required" }, { status: 400 })
    }

    // 1. Load all source markdown files
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
          sourceContext += `\n\n--- Source Document: ${file} ---\n\n${content}`
        }
      }
    }

    if (!sourceContext) {
      return NextResponse.json({ error: "No parsed documents found in workspace. Please ingest PDFs first." }, { status: 400 })
    }

    // 2. Format available assets
    const availableAssets = (assets || []).map((a: {id: string, kind: string, caption?: string, snippet?: string}) => ({
      id: a.id,
      kind: a.kind,
      caption: a.caption,
      snippet: a.snippet
    }))

    // 3. Prompt Gemini through local proxy
    const isAutonomous = topic === "Untitled card" || topic.trim() === ""
    const topicInstruction = isAutonomous 
      ? `The user has NOT specified a topic. You must autonomously analyze the <Source Material> and <Available Figures/Tables>, and decide on the most compelling scientific section to create for this poster (e.g., "Methodology", "Key Results", "Conclusion"). Choose the topic that has the most solid content and supporting figures.`
      : `The user explicitly wants a poster section about: "${topic}". You must focus ONLY on this topic.`

    const prompt = `You are an expert academic assistant tasked with writing a section for a scientific poster.

<Source Material>
${sourceContext}
</Source Material>

<Available Figures/Tables>
${JSON.stringify(availableAssets, null, 2)}
</Available Figures/Tables>

${topicInstruction}

IMPORTANT constraints:
- STRICT GROUNDING: You MUST base your content STRICTLY and ONLY on the provided <Source Material>. Do NOT use outside knowledge, do NOT search the web, and do NOT hallucinate facts.
- The TOTAL combined length of all text you generate MUST be strictly around ${characterLimit} characters to fit the physical constraints of the poster layout.
- Each bullet should be no longer than 1-2 sentences.

Also, review the available figures/tables. If any of them strongly support the points you made, assign them to 'figure1' or 'figure2'. You can assign up to 2 assets.

Respond EXACTLY in this JSON format with no markdown wrappers:
{
  "title": "The topic title you wrote about (e.g. 'Methods', 'Results')",
  "bullets": ["Point 1...", "Point 2..."],
  "assignedAssets": [
    { "slot": "figure1", "assetId": "..." },
    { "slot": "figure2", "assetId": "..." }
  ]
}`

    const response = await fetch(process.env.AI_API_URL as string, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.AI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gemini-3-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`OpenAI API failed: ${errText}`)
    }

    const data = await response.json()
    const responseText = data.choices[0].message.content
    
    if (!responseText) {
      throw new Error("Empty response from Gemini")
    }
    
    const parsed = JSON.parse(responseText)
    
    return NextResponse.json(parsed)
  } catch (err: unknown) {
    console.error("Gemini card generation failed:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate card content" },
      { status: 500 }
    )
  }
}
