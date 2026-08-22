import type { Project } from "@/lib/poster-types"

export type ExportFormat = "poster" | "paper"

export interface LatexGenerator {
  generateDocument(project: Project, workspaceId?: string): string
}
