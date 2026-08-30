import { generateAIResponse } from "@/lib/ai/client"
import { resolveAiModel, AI_TIMEOUTS } from "@/lib/ai/models"
import { wrapUntrustedContext } from "@/lib/ai/prompts"
import { cleanFormula, slugifyEquationKey } from "@/lib/equation-types"
import { z } from "zod"
import katex from "katex"

const EquationCaptionSchema = z.object({
  name: z.string(),
  key: z.string().optional(),
  originalCaption: z.string().optional(),
  description: z.string().optional(),
})

export async function generateEquationCaption(
  formula: string,
  context?: string
): Promise<{ caption: string; snippet: string; name: string; key: string; description: string }> {
  const cleaned = cleanFormula(formula)
  try {
    const wrappedContext = wrapUntrustedContext("context", context || "No surrounding text provided.")
    const userPrompt = `Analyze this mathematical equation from a scientific document:

$$
${cleaned}
$$

Surrounding context from paper:
${wrappedContext}

Generate JSON with:
1. "name": A concise, descriptive 3-8 word scientific title or name identifying what this equation defines or calculates (e.g. "PMT Anode Current Gain Formulation", "Relative Gain Variance Under Radiation", "Threshold Current for Linear Response", "Radiation Tolerance Criteria for TID"). Never return generic names like "Equation 1" or "Formula".
2. "key": A clean, concise LaTeX label slug prefixed with eq: (e.g. "eq:gain_variance", "eq:current_gain", "eq:threshold_current").
3. "originalCaption": The equation number or label if mentioned in the context (e.g. "Equation (2.1)"). If unknown, return "".
4. "description": A 1-2 sentence explanation of the variables, physical/mathematical meaning, and relevance.

Respond STRICTLY in JSON.`

    const result = await generateAIResponse("equation-caption", {
      model: resolveAiModel("generation"),
      userPrompt,
      schema: EquationCaptionSchema,
      temperature: 0.1,
      signal: AbortSignal.timeout(AI_TIMEOUTS.generation),
    })

    const name = result.name?.trim() || ""
    const key = result.key?.trim() ? (result.key.startsWith("eq:") ? result.key : `eq:${result.key}`) : slugifyEquationKey(name)
    const originalCaption = result.originalCaption?.trim() || ""
    const description = result.description?.trim() || ""

    const bestCaption = name || originalCaption || `Equation: ${cleaned.slice(0, 40)}`

    return {
      caption: bestCaption,
      snippet: cleaned,
      name: name || bestCaption,
      key,
      description,
    }
  } catch (err) {
    console.warn("[Equation Caption] Generation failed:", err)
    const fallbackName = `Equation: ${cleaned.slice(0, 40)}`
    return {
      caption: fallbackName,
      snippet: cleaned,
      name: fallbackName,
      key: slugifyEquationKey(fallbackName),
      description: "",
    }
  }
}

/**
 * Validate a LaTeX mathematical formula using KaTeX.
 * Returns valid=true and rendered HTML if syntax is correct, or valid=false and error message.
 */
export function validateEquationKaTeX(formula: string): { valid: boolean; error?: string; html?: string } {
  const cleaned = cleanFormula(formula)
  if (!cleaned) {
    return { valid: false, error: "Formula is empty" }
  }

  try {
    const html = katex.renderToString(cleaned, {
      throwOnError: true,
      displayMode: true,
    })
    return { valid: true, html }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err)
    // Extract human-friendly KaTeX error message
    const cleanMsg = msg.replace(/^KaTeX parse error:\s*/i, "")
    return { valid: false, error: cleanMsg }
  }
}
