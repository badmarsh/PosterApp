export type ParseMethod = "MinerU" | "Pandoc" | "Auto"
export type ParseStatus = "queued" | "parsing" | "done" | "failed"
export type AssetKind = "text" | "figure" | "table" | "equation"
export type Confidence = "low" | "medium" | "high"
export type AssignSlot = "bullets" | "figure1" | "figure2" | "table" | "equation"

export type IngestFile = {
  id: string
  name: string
  /** bytes */
  size: number
  method: ParseMethod
  status: ParseStatus
  /** 0–100 */
  progress: number
  error?: string
  dismissed?: boolean
}

export type ExtractedAsset = {
  id: string
  fileId: string
  filename?: string
  url?: string
  kind: AssetKind
  page: number
  section?: string
  bbox?: string
  confidence: Confidence
  // text
  heading?: string
  snippet?: string
  // figure
  thumbnailUrl?: string
  caption?: string
  // table
  tableRows?: string[][]
  // promotion state
  assignedCardId?: string
  assignedSlot?: AssignSlot
}

export type ParseLogEntry = {
  id: string
  ts: string
  level: "info" | "warning" | "error"
  message: string
}

export const ASSET_KIND_LABEL: Record<AssetKind, string> = {
  text: "Text blocks",
  figure: "Figures",
  table: "Tables",
  equation: "Equations",
}

export const SLOT_LABEL: Record<AssignSlot, string> = {
  bullets: "Bullets",
  figure1: "Figure slot 1",
  figure2: "Figure slot 2",
  table: "Table",
  equation: "Equation",
}

/** Which target slots make sense for a given extracted asset kind. */
export function slotsForKind(kind: AssetKind): AssignSlot[] {
  switch (kind) {
    case "text":
      return ["bullets"]
    case "figure":
      return ["figure1", "figure2"]
    case "table":
      return ["table"]
    case "equation":
      return ["equation"]
    default:
      return []
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Pick a parser the way the backend pipeline would, based on file name. */
export function detectMethod(name: string): ParseMethod {
  const n = name.toLowerCase()
  if (n.endsWith(".pdf")) return "MinerU"
  if (n.endsWith(".docx") || n.endsWith(".md") || n.endsWith(".txt") || n.endsWith(".tex") || n.endsWith(".bib")) return "Pandoc"
  return "Auto"
}
