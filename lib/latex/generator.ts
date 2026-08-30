import type { Project, OutputConfig } from "@/lib/poster-types"
import type { OutputType } from "@/lib/output-types"
import type { LatexGenerator } from "./types"
import { TikzPosterGenerator, generateLatexForCard } from "./generator-poster"
import { StandardPaperGenerator } from "./generator-paper"
import { BeamerSlidesGenerator } from "./generator-slides"
import { ThesisReviewLatexGenerator } from "./generator-thesis-review"
import { assetUrlToLatexPath } from "./helpers"

export { assetUrlToLatexPath, generateLatexForCard }

/**
 * Factory to get the appropriate generator for a given output type and template.
 */
export function getGenerator(outputType: OutputType, templateId: string): LatexGenerator {
  const key = `${outputType}/${templateId}`
  
  if (outputType === "paper") return new StandardPaperGenerator(templateId)
  if (outputType === "slides") return new BeamerSlidesGenerator(templateId)
  if (outputType === "poster") return new TikzPosterGenerator(templateId)
  if (outputType === "thesis-review") return new ThesisReviewLatexGenerator(templateId)

  throw new Error(`No generator found for ${key}`)
}

/**
 * Generate a complete document by finding the right generator for the provided output config.
 */
export function generateFullTemplate(project: Project, outputConfig: OutputConfig, workspaceId = ""): string {
  const generator = getGenerator(outputConfig.outputType, outputConfig.templateId)
  return generator.generateDocument(project, outputConfig, workspaceId)
}
