import { generateAIResponse } from "@/lib/ai/client"
import { resolveAiModel, AI_TIMEOUTS } from "@/lib/ai/models"
import { wrapUntrustedContext } from "@/lib/ai/prompts"
import { z } from "zod"

const EquationCaptionSchema = z.object({
  name: z.string(),
  originalCaption: z.string().optional(),
  description: z.string().optional(),
})

export async function generateEquationCaption(
  formula: string,
  context?: string
): Promise<{ caption: string; snippet: string; name: string; description: string }> {
  try {
    const wrappedContext = wrapUntrustedContext("context", context || "No surrounding text provided.")
    const userPrompt = `Analyze this mathematical equation from a scientific document:

$$
${formula}
$$

Surrounding context from paper:
${wrappedContext}

Generate JSON with:
1. "name": A concise, descriptive 3-8 word scientific title or name identifying what this equation defines or calculates (e.g. "PMT Anode Current Gain Formulation", "Relative Gain Variance Under Radiation", "Threshold Current for Linear Response", "Radiation Tolerance Criteria for TID"). Never return generic names like "Equation 1" or "Formula".
2. "originalCaption": The equation number or label if mentioned in the context (e.g. "Equation (2.1)"). If unknown, return "".
3. "description": A 1-2 sentence explanation of the variables, physical/mathematical meaning, and relevance.

Respond STRICTLY in JSON.`

    const result = await generateAIResponse("equation-caption", {
      model: resolveAiModel("generation"),
      userPrompt,
      schema: EquationCaptionSchema,
      temperature: 0.1,
      signal: AbortSignal.timeout(AI_TIMEOUTS.generation),
    })

    const name = result.name?.trim() || ""
    const originalCaption = result.originalCaption?.trim() || ""
    const description = result.description?.trim() || ""

    const bestCaption = name || originalCaption || `Equation: ${formula.slice(0, 40)}`

    return {
      caption: bestCaption,
      snippet: formula,
      name: name || bestCaption,
      description,
    }
  } catch (err) {
    console.warn("[Equation Caption] Generation failed:", err)
    return {
      caption: `Equation: ${formula.slice(0, 40)}`,
      snippet: formula,
      name: `Equation: ${formula.slice(0, 40)}`,
      description: "",
    }
  }
}
