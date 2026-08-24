import { prisma } from "@/lib/prisma"

export async function generateSnapshotLabelAsync(snapshotId: string, diff: string[]) {
  if (diff.length === 0) return // No meaningful changes to summarize

  try {
    const aiUrl = process.env.AI_API_URL
    const aiKey = process.env.AI_API_KEY
    if (!aiUrl || !aiKey) return

    const diffText = diff.join("\n- ")
    const modelToUse = process.env.AI_MODEL || "gemini-3-flash"

    const systemPrompt = `You are a developer summarizing document edits. 
Write a 2-5 word label summarizing the most important change from the list below.
For example: 'Edited Methodology', 'Added 2 figures', 'Updated title'.
Do not use punctuation at the end. Return ONLY the label string. Do not use quotes.`

    const userPrompt = `Changes:\n- ${diffText}`

    const response = await fetch(aiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${aiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 15
      }),
      // Abort gracefully after 45s (AI APIs can be slow on cold starts)
      signal: AbortSignal.timeout(45_000)
    })

    if (!response.ok) {
      console.error("[ai-labeler] HTTP Error:", await response.text())
      return
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content?.trim()
    
    if (content) {
      // Remove any surrounding quotes just in case
      const cleanLabel = content.replace(/^["'](.*)["']$/, '$1')
      await prisma.workspaceSnapshot.update({
        where: { id: snapshotId },
        data: { label: cleanLabel }
      })
    }
  } catch (err) {
    console.error("[ai-labeler] Failed to generate label:", err)
  }
}
