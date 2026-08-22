import type { Project } from "@/lib/poster-types"
import type { ExportFormat } from "./types"
import { TikzPosterGenerator, generateLatexForCard } from "./generator-poster"
import { StandardPaperGenerator } from "./generator-paper"
import { assetUrlToLatexPath } from "./helpers"

export { assetUrlToLatexPath, generateLatexForCard }

export function generateFullTemplate(project: Project, workspaceId = "", format: ExportFormat = "poster"): string {
  if (format === "paper") {
    const generator = new StandardPaperGenerator()
    return generator.generateDocument(project, workspaceId)
  } else {
    const generator = new TikzPosterGenerator()
    return generator.generateDocument(project, workspaceId)
  }
}
