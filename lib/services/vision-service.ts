import { generateAIResponse } from "@/lib/ai/client"
import { VisionCaptionSchema } from "@/lib/ai/contracts"
import { getVisionModelChain, resolveAiModel, AI_TIMEOUTS } from "@/lib/ai/models"
import { wrapUntrustedContext } from "@/lib/ai/prompts"
import { decodeHtmlEntities } from "@/lib/utils"

function cleanCaptionOrName(val?: string): string {
  if (!val) return ""
  const trimmed = val.trim()
  const lower = trimmed.toLowerCase()
  // Filter out placeholder phrases
  if (
    lower === "not provided" ||
    lower === "none" ||
    lower === "n/a" ||
    lower === "na" ||
    lower === "null" ||
    lower === "undefined" ||
    lower === "unknown" ||
    lower === "no caption" ||
    lower === "no original caption" ||
    lower === "figure" ||
    lower === "table" ||
    lower === "image"
  ) {
    return ""
  }
  return trimmed
}

export async function generateCaption(
  base64Image: string,
  context: string
): Promise<{ caption: string; snippet: string; name: string }> {
  try {
    const contextContent = context ? context.trim() : "No surrounding text context provided."
    const wrappedContext = wrapUntrustedContext("context", contextContent)

    const textPrompt = `You are an expert scientific and technical assistant.
Analyze this figure or table along with the surrounding document context:

${wrappedContext}

Generate three fields in JSON:
1. "name": A concise, descriptive 3-8 word title or name identifying what this specific figure or table displays (e.g. "Radiation Tolerance Specifications", "SEE Fluence vs Time", "LVPS Power Distribution Diagram", "Thermal Simulation Mesh"). Never return generic names like "Figure 1", "Table", or "Not provided".
2. "originalCaption": The exact original caption text from the document if found or visible. If no original caption is present, return "".
3. "description": A concise 1-2 sentence description of key data, trends, or components. Do NOT start with phrases like "This figure shows", "This table displays", or "Image depicting".

Respond STRICTLY with valid JSON.`


    const imageUrl = base64Image.startsWith("data:")
      ? base64Image
      : `data:image/jpeg;base64,${base64Image}`

    const userPrompt = [
      { type: "text", text: textPrompt },
      { type: "image_url", image_url: { url: imageUrl } },
    ]

    const models = getVisionModelChain()
    let lastError: unknown = null

    for (const model of models) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const result = await generateAIResponse("vision-caption", {
            role: "vision",
            model,
            userPrompt,
            schema: VisionCaptionSchema,
            signal: AbortSignal.timeout(AI_TIMEOUTS.vision),
          })

          const name = decodeHtmlEntities(cleanCaptionOrName(result.name))
          const originalCaption = decodeHtmlEntities(cleanCaptionOrName(result.originalCaption))
          const description = decodeHtmlEntities((result.description || "").trim())

          // Determine the most informative caption/title
          const bestCaption = originalCaption || name || (description ? description.slice(0, 60) : "")

          return {
            caption: bestCaption,
            snippet: description || name,
            name: name || bestCaption,
          }
        } catch (err) {
          lastError = err
          const errMsg = err instanceof Error ? err.message : String(err)
          const isRateLimit = errMsg.includes("429") || errMsg.includes("rate limit")
          if (isRateLimit && attempt === 1) {
            console.warn(`[Vision] Model "${model}" rate limited (429), retrying after 1000ms...`)
            await new Promise((r) => setTimeout(r, 1000))
            continue
          }
          console.warn(`[Vision] Model "${model}" caption generation failed: ${errMsg}. Trying fallback...`)
          break
        }
      }
    }

    console.error("All vision fallback models failed:", lastError)
    return { caption: "", snippet: "", name: "" }
  } catch (e) {
    console.error("Vision caption generation failed:", e)
    return { caption: "", snippet: "", name: "" }
  }
}
