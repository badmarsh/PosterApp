import { prisma } from "@/lib/prisma"
import { generateAITextResponse } from "@/lib/ai/client"
import { resolveAiModel, AI_TIMEOUTS } from "@/lib/ai/models"

export async function generateSnapshotLabelAsync(snapshotId: string, diff: string[]) {
  if (diff.length === 0) return // No meaningful changes to summarize

  try {
    const diffText = diff.join("\n- ")

    const systemPrompt = `You are a developer summarizing document edits. 
Write a 2-5 word label summarizing the most important change from the list below.
For example: 'Edited Methodology', 'Added 2 figures', 'Updated title'.
Do not use punctuation at the end. Return ONLY the label string. Do not use quotes.`

    const userPrompt = `Changes:\n- ${diffText}`

    const content = await generateAITextResponse("snapshot-label", {
      model: resolveAiModel("labeler"),
      systemPrompt,
      userPrompt,
      temperature: 0.1,
      maxTokens: 15,
      signal: AbortSignal.timeout(AI_TIMEOUTS.labeler),
    })

    if (content) {
      // Remove any surrounding quotes just in case
      const cleanLabel = content.trim().replace(/^["'](.*)["']$/, "$1")
      await prisma.workspaceSnapshot.update({
        where: { id: snapshotId },
        data: { label: cleanLabel },
      })
    }
  } catch (err) {
    console.error("[ai-labeler] Failed to generate label:", err)
  }
}
