import { NextRequest, NextResponse } from "next/server"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params
  
  try {
    const project = await req.json()

    // Create a simplified representation of the project for the AI to review
    const projectSummary = {
      title: project.title,
      template: project.templateName,
      cards: project.cards.map((c: any) => ({
        id: c.id,
        title: c.title,
        column: c.column,
        heightBudget: c.heightBudget,
        contentLength: c.content?.length || 0,
        contentPreview: c.content?.substring(0, 500) + (c.content?.length > 500 ? "..." : ""),
        assignedAssets: c.assignedAssets
      })),
      assets: project.assets.map((a: any) => ({
        id: a.id,
        kind: a.kind,
        caption: a.caption
      }))
    }

    const prompt = `You are an expert academic reviewer evaluating a scientific poster layout.

Here is the current state of the poster workspace:
${JSON.stringify(projectSummary, null, 2)}

Please review the poster configuration and content for potential issues. Focus on:
1. Missing references (e.g. if a card talks about a study but no citation is present, though note we only have previews).
2. Layout constraints: Cards with very long content (>500 chars) might overflow their height budget. Cards with too little content might look empty.
3. Assets: Are there important figures that could be assigned? Are assigned assets appropriate?
4. Overall structure: Is the flow logical across the 3 columns? Is there a good balance of text and figures?

Return EXACTLY in this JSON format with no markdown wrappers:
{
  "tips": [
    "Tip 1...",
    "Tip 2..."
  ]
}`

    const response = await fetch("http://localhost:8045/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer sk-4c2ec6f80d904f35b2c1598b1464aaca",
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
      console.error("AI Review error:", errText)
      return NextResponse.json({ error: `AI Review failed: ${response.statusText}` }, { status: response.status })
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    
    if (!content) {
      return NextResponse.json({ error: "Empty response from AI" }, { status: 500 })
    }

    const parsed = JSON.parse(content)
    return NextResponse.json(parsed)

  } catch (error: any) {
    console.error("Error in AI Review:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
