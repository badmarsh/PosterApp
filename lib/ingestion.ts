export type ParseMethod = "MinerU" | "Pandoc" | "Auto"
export type ParseStatus = "queued" | "parsing" | "done" | "failed"
export type AssetKind = "text" | "figure" | "table"
export type Confidence = "low" | "medium" | "high"
export type AssignSlot = "bullets" | "figure1" | "figure2" | "table"

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
}

export type ExtractedAsset = {
  id: string
  fileId: string
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
}

export const SLOT_LABEL: Record<AssignSlot, string> = {
  bullets: "Bullets",
  figure1: "Figure slot 1",
  figure2: "Figure slot 2",
  table: "Table",
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
  if (n.includes("poster") || n.includes("scan") || n.includes("figure")) return "MinerU"
  if (n.endsWith(".docx") || n.includes("draft") || n.includes("notes")) return "Pandoc"
  return "Auto"
}

let assetSeq = 0
function aid(prefix: string) {
  assetSeq += 1
  return `${prefix}_${assetSeq}`
}

/**
 * Simulated extraction output for a freshly-parsed file. In a real app this is
 * the structured response from the MinerU / Pandoc pipeline.
 */
export function syntheticAssetsForFile(file: IngestFile): ExtractedAsset[] {
  const fid = file.id
  const figurePool = [
    "/images/fig-results-a.png",
    "/images/fig-architecture.png",
    "/images/fig-dataset.png",
  ]
  return [
    {
      id: aid("ext"),
      fileId: fid,
      kind: "text",
      page: 1,
      section: "Abstract",
      confidence: "high",
      heading: "Abstract",
      snippet:
        "We present a sample-efficient approach to long-horizon manipulation that couples a learned latent dynamics model with hindsight subgoal relabeling.",
    },
    {
      id: aid("ext"),
      fileId: fid,
      kind: "text",
      page: 2,
      section: "Method",
      confidence: "medium",
      heading: "Latent relabeling",
      snippet:
        "Subgoals are sampled from achieved latent states and relabeled into the replay buffer, densifying the otherwise sparse reward signal.",
    },
    {
      id: aid("ext"),
      fileId: fid,
      kind: "figure",
      page: 3,
      bbox: "x:142 y:88 w:512 h:330",
      confidence: "high",
      thumbnailUrl: figurePool[0],
      caption: "Success rate vs. environment steps across six benchmarks.",
    },
    {
      id: aid("ext"),
      fileId: fid,
      kind: "table",
      page: 4,
      section: "Results",
      confidence: "low",
      caption: "Per-task success rate (%) at 1M steps.",
      tableRows: [
        ["Task", "Ours", "Best baseline"],
        ["Push", "94.2", "81.0"],
        ["Stack", "88.6", "63.4"],
        ["Insert", "71.9", "52.1"],
      ],
    },
  ]
}

export const initialIngestFiles: IngestFile[] = [
  {
    id: "file_lattice_paper",
    name: "lattice_neurips_camera_ready.pdf",
    size: 4_812_140,
    method: "Auto",
    status: "done",
    progress: 100,
  },
  {
    id: "file_prev_poster",
    name: "iclr_poster_v3_scan.pdf",
    size: 9_233_980,
    method: "MinerU",
    status: "done",
    progress: 100,
  },
  {
    id: "file_review_notes",
    name: "reviewer_notes_draft.pdf",
    size: 188_402,
    method: "Pandoc",
    status: "failed",
    progress: 100,
    error: "Encrypted stream on p.2 — could not extract text layer.",
  },
]

export const initialAssets: ExtractedAsset[] = [
  {
    id: "ext_abstract",
    fileId: "file_lattice_paper",
    kind: "text",
    page: 1,
    section: "Abstract",
    confidence: "high",
    heading: "Abstract",
    snippet:
      "We study sample-efficient policy learning for long-horizon robotic manipulation under sparse rewards, introducing LATTICE.",
    assignedCardId: "blk_abstract",
    assignedSlot: "bullets",
  },
  {
    id: "ext_contrib",
    fileId: "file_lattice_paper",
    kind: "text",
    page: 1,
    section: "Introduction",
    confidence: "medium",
    heading: "Contributions",
    snippet:
      "A latent dynamics model with hindsight subgoal relabeling that improves success rate by 18.4 points over the strongest baseline.",
  },
  {
    id: "ext_arch_fig",
    fileId: "file_lattice_paper",
    kind: "figure",
    page: 3,
    bbox: "x:96 y:120 w:604 h:288",
    confidence: "high",
    thumbnailUrl: "/images/fig-architecture.png",
    caption: "LATTICE architecture: encoder, latent dynamics, and policy head.",
  },
  {
    id: "ext_results_fig",
    fileId: "file_prev_poster",
    kind: "figure",
    page: 1,
    bbox: "x:210 y:540 w:480 h:300",
    confidence: "medium",
    thumbnailUrl: "/images/fig-results-a.png",
    caption: "Success rate vs. environment steps (poster panel, re-extracted).",
  },
  {
    id: "ext_results_table",
    fileId: "file_lattice_paper",
    kind: "table",
    page: 6,
    section: "Results",
    confidence: "low",
    caption: "Per-task success rate (%) at 1M environment steps.",
    tableRows: [
      ["Task", "LATTICE", "DreamerV3", "TD-MPC2"],
      ["Push", "94.2", "81.0", "84.7"],
      ["Stack", "88.6", "63.4", "70.2"],
      ["Insert", "71.9", "52.1", "58.0"],
    ],
  },
]

export const initialParseLog: ParseLogEntry[] = [
  {
    id: "log_1",
    ts: "loaded",
    level: "info",
    message: "lattice_neurips_camera_ready.pdf → Auto router selected Pandoc for text, MinerU for figures.",
  },
  {
    id: "log_2",
    ts: "loaded",
    level: "info",
    message: "Image on p.3 extracted via MinerU; caption inferred from surrounding text.",
  },
  {
    id: "log_3",
    ts: "loaded",
    level: "warning",
    message: "Table on p.6 has merged header cells — column alignment is low confidence.",
  },
  {
    id: "log_4",
    ts: "loaded",
    level: "error",
    message: "reviewer_notes_draft.pdf: encrypted stream on p.2 — parse failed, no assets produced.",
  },
]
