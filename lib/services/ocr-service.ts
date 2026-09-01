import { generateAIResponse } from "@/lib/ai/client"
import { VisionOcrSchema, type VisionOcrResult } from "@/lib/ai/contracts"
import { getVisionModelChain, AI_TIMEOUTS } from "@/lib/ai/models"
import { cleanFormula, slugifyEquationKey } from "@/lib/equation-types"
import { decodeHtmlEntities } from "@/lib/utils"

export type OcrMode = "auto" | "equation" | "table" | "text" | "figure"

export async function processImageOcr(
  base64Image: string,
  mode: OcrMode = "auto",
  customInstruction?: string
): Promise<VisionOcrResult> {
  const imageUrl = base64Image.startsWith("data:")
    ? base64Image
    : `data:image/jpeg;base64,${base64Image}`

  const modeInstructions: Record<OcrMode, string> = {
    auto: "Automatically detect and transcribe all contents (LaTeX mathematical formulas, markdown tables, diagrams/figures with callouts, and structured prose text).",
    equation: "Focus strictly on mathematical formulations, scientific equations, and variable definitions. Transcribe all equations into clean, valid LaTeX math code without outer $$ delimiters.",
    table: "Focus on tables and data grids. Transcribe the table into a clean Markdown table with headers and provide a 2D array of string cells.",
    text: "Focus on transcribing handwritten or printed text notes, bullet points, headers, and paragraphs into formatted Markdown.",
    figure: "Analyze this scientific chart, plot, or schematic diagram. Transcribe all axes labels, legend keys, units, and data trends, and provide a concise summary of findings.",
  }

  const promptText = `You are a high-precision scientific Optical Character Recognition (OCR) and technical document vision assistant.

Task:
${modeInstructions[mode] || modeInstructions.auto}
${customInstruction ? `User specific instruction: "${customInstruction}"` : ""}

Required JSON Structure:
{
  "title": "Short descriptive 3-8 word title of the scanned content",
  "summary": "1-2 sentence technical summary of the image content",
  "text": "Full high-fidelity Markdown transcription of the image text, notes, or structured description",
  "mode": "${mode}",
  "equations": [
    {
      "key": "eq:suggested_slug_key",
      "name": "Descriptive Equation Name (e.g. Current Gain Variance)",
      "formula": "LaTeX formula without enclosing delimiters (e.g. \\Delta I = k \\cdot V_T)",
      "description": "Short explanation of variables and meaning"
    }
  ],
  "tables": [
    {
      "caption": "Table Caption/Title",
      "markdown": "| Col 1 | Col 2 |\\n|---|---|\\n| Val 1 | Val 2 |",
      "rows": [["Col 1", "Col 2"], ["Val 1", "Val 2"]]
    }
  ]
}

Guidelines:
1. For mathematical symbols, fractions, indices, summations, matrices, and greek letters, produce exact, standard LaTeX commands.
2. If equations are detected, populate the "equations" list so the user can import them into the workspace Equation Registry.
3. If tabular data is detected, populate both "markdown" and "rows" in "tables".
4. Ensure "text" contains the comprehensive formatted transcription.
5. Respond STRICTLY with valid JSON.`

  const userPrompt = [
    { type: "text", text: promptText },
    { type: "image_url", image_url: { url: imageUrl } },
  ]

  const models = getVisionModelChain()
  let lastError: unknown = null

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await generateAIResponse<VisionOcrResult>("vision-ocr", {
          role: "vision",
          model,
          userPrompt,
          schema: VisionOcrSchema,
          signal: AbortSignal.timeout(AI_TIMEOUTS.ocr),
        })

        // Clean and normalize equations
        const cleanedEquations = (result.equations || []).map((eq, idx) => {
          const formula = cleanFormula(eq.formula)
          const name = eq.name || `Equation ${idx + 1}`
          const key = eq.key || slugifyEquationKey(name, idx + 1)
          return {
            key,
            name,
            formula,
            description: eq.description || undefined,
          }
        }).filter(eq => eq.formula.length > 0)

        // Clean tables and decode entities
        const cleanedTables = (result.tables || []).map((t) => ({
          caption: decodeHtmlEntities(t.caption || ""),
          markdown: decodeHtmlEntities(t.markdown || ""),
          rows: (t.rows || []).map((row) =>
            Array.isArray(row) ? row.map((cell) => decodeHtmlEntities(String(cell ?? ""))) : []
          ),
        }))

        return {
          title: decodeHtmlEntities(result.title || "Scanned Content"),
          summary: decodeHtmlEntities(result.summary || ""),
          text: decodeHtmlEntities(result.text || ""),
          mode: result.mode || mode,
          equations: cleanedEquations,
          tables: cleanedTables,
        }
      } catch (err) {
        lastError = err
        const errMsg = err instanceof Error ? err.message : String(err)
        const isRateLimit = errMsg.includes("429") || errMsg.includes("rate limit")
        if (isRateLimit && attempt === 1) {
          await new Promise((r) => setTimeout(r, 1200))
          continue
        }
        console.warn(`[OCR] Model "${model}" failed: ${errMsg}. Trying fallback...`)
        break
      }
    }
  }

  console.error("All vision OCR models failed:", lastError)
  throw lastError || new Error("Failed to perform OCR on image")
}
