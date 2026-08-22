import type { Project, OutputConfig } from "@/lib/poster-types"
import type { OutputType } from "@/lib/output-types"

/** @deprecated Use OutputType from output-types.ts instead */
export type ExportFormat = "poster" | "paper"

/**
 * Interface for all LaTeX document generators.
 * Each generator produces a complete .tex document string
 * for a specific output type + template combination.
 */
export interface LatexGenerator {
  readonly outputType: OutputType
  readonly templateId: string
  generateDocument(project: Project, outputConfig: OutputConfig, workspaceId?: string): string
}
