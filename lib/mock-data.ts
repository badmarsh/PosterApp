import type { Card, Project } from "./poster-types"

function card(c: Partial<Card> & Pick<Card, "id" | "title" | "column" | "order" | "pattern">): Card {
  return {
    content: "",
    table: { hasHeader: true, caption: "", rows: [] },
    figures: [],
    figureLayout: "single",
    validation: "valid",
    ...c,
  }
}

const posterCards: Card[] = [
  // ---------- Column 1 ----------
  card({
    id: "blk_abstract",
    title: "Abstract",
    column: 1,
    order: 0,
    pattern: "bullets",
    content: "- We study sample-efficient policy learning for long-horizon robotic manipulation under sparse rewards.\n- Our method, LATTICE, couples a learned latent dynamics model with hindsight subgoal relabeling.\n- Across 6 benchmarks LATTICE improves success rate by 18.4 points over the strongest baseline.",
    validation: "valid",
  }),
  card({
    id: "blk_introduction",
    title: "Introduction & Motivation",
    column: 1,
    order: 1,
    pattern: "bullets",
    content: "- Sparse-reward manipulation remains hard: exploration cost grows exponentially with horizon.\n- Model-based RL improves efficiency but compounds prediction error over long rollouts.\n- We ask: can latent subgoal structure regularize both exploration and model rollout?\n\nKey insight: subgoals act as anchors that bound latent rollout drift.",
    validation: "valid",
  }),
  card({
    id: "blk_problem_setup",
    title: "Problem Setup",
    column: 1,
    order: 2,
    pattern: "bullets-table",
    content: "- Goal-conditioned MDP with state s, action a, and goal g.\n- Reward is binary success at the terminal step only.",
    table: {
      hasHeader: true,
      caption: "Table 1. Notation used throughout the poster.",
      rows: [
        ["Symbol", "Meaning"],
        ["z_t", "latent state at step t"],
        ["phi", "encoder parameters"],
        ["g", "task goal embedding"],
      ],
    },
    validation: "valid",
  }),

  // ---------- Column 2 ----------
  card({
    id: "blk_dataset",
    title: "Dataset & Environments",
    column: 2,
    order: 0,
    pattern: "bullets-image",
    content: "- 6 simulated tasks: Push, Stack, PegInsert, DoorOpen, Pour, CableRoute.\n- 240k offline transitions collected from a scripted exploration policy.",
    figures: [
      {
        id: "fig_dataset",
        url: "/images/fig-dataset.png",
        caption: "Figure 1. Representative observations across the six tasks.",
      },
    ],
    figureLayout: "single",
    validation: "valid",
  }),
  card({
    id: "blk_architecture",
    title: "LATTICE Architecture",
    column: 2,
    order: 1,
    pattern: "image-focused",
    content: "",
    figures: [
      {
        id: "fig_arch",
        url: "/images/fig-architecture.png",
        caption:
          "Figure 2. Latent dynamics model with hindsight subgoal relabeling.",
      },
    ],
    figureLayout: "single",
    validation: "generating",
  }),
  card({
    id: "blk_main_results",
    title: "Main Results",
    column: 2,
    order: 2,
    pattern: "bullets-two-images",
    content: "- LATTICE reaches 82.6% mean success vs 64.2% for the strongest baseline.\n- Gains are largest on long-horizon tasks (Stack, CableRoute).",
    figures: [
      {
        id: "fig_res_a",
        url: "/images/fig-results-a.png",
        caption: "Figure 3a. Success rate vs environment steps.",
      },
      {
        // missing url -> invalid
        id: "fig_res_b",
        url: "",
        caption: "Figure 3b. Per-task breakdown.",
      },
    ],
    figureLayout: "two-up",
    validation: "invalid",
  }),

  // ---------- Column 3 ----------
  card({
    id: "blk_ablation",
    title: "Ablation Study",
    column: 3,
    order: 0,
    pattern: "bullets-table",
    content: "- Removing subgoal relabeling drops success by 14.1 points.\n- Removing the latent model drops success by 21.7 points and destabilizes training.\n- Subgoal count k=4 is the sweet spot; k>8 increases variance with no gain.\n- Latent dimension 64 balances reconstruction and rollout accuracy.\n- Longer rollout horizons help only when paired with subgoal anchoring.\n- Reward shaping provides no additional benefit over hindsight relabeling.",
    table: {
      hasHeader: true,
      caption: "Table 2. Component ablations (mean success over 5 seeds).",
      rows: [
        ["Variant", "Success", "Δ"],
        ["LATTICE (full)", "82.6", "—"],
        ["no relabeling", "68.5", "-14.1"],
        ["no latent model", "60.9", "-21.7"],
        ["no subgoal anchor", "71.2", "-11.4"],
      ],
    },
    validation: "warning",
  }),
  card({
    id: "blk_conclusion",
    title: "Conclusion",
    column: 3,
    order: 1,
    pattern: "bullets",
    content: "- Latent subgoal structure jointly regularizes exploration and model rollout.\n- LATTICE sets a new state of the art on sparse-reward manipulation benchmarks.\n- Future work: transfer to real-robot hardware and dynamic obstacles.",
    validation: "valid",
  }),
  card({
    id: "blk_references",
    title: "References & Funding",
    column: 3,
    order: 2,
    pattern: "bullets",
    content: "- Hafner et al., Dream to Control, ICLR 2020.\n- Andrychowicz et al., Hindsight Experience Replay, NeurIPS 2017.\n- Supported by grant #DE-AC02 & the Robotics Lab fund {2024}.",
    validation: "warning",
  }),
]

import { ExtractedAsset as Asset, IngestFile, ParseLogEntry } from "./ingestion"

export const sampleProject: Project = {
  id: "prj_lattice",
  name: "LATTICE — CoRL 2025",
  posterTitle:
    "LATTICE: Latent Subgoal Anchoring for Sample-Efficient Long-Horizon Manipulation",
  authors: "A. Reyes, M. Okafor, L. Petrova, D. Chen",
  venue: "Robotics & Learning Lab · CoRL 2025",
  templateName: "atlas",
  cards: posterCards,
  assets: [], // will be initialAssets below if needed
  ingestFiles: [], // will be initialIngestFiles below if needed
  outputs: [
    {
      id: "out_poster_atlas",
      outputType: "poster",
      templateId: "atlas",
      title: "LATTICE: Latent Subgoal Anchoring for Sample-Efficient Long-Horizon Manipulation",
      cards: posterCards,
    },
  ],
  activeOutputId: "out_poster_atlas",
}

export const otherProjects: Pick<Project, "id" | "name">[] = [
  { id: "prj_lattice", name: "LATTICE — CoRL 2025" },
  { id: "prj_difftrack", name: "DiffTrack — CVPR 2025" },
  { id: "prj_genome", name: "Genome QC Pipeline — Bio Symposium" },
]

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

export const initialAssets: Asset[] = [
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

sampleProject.assets = initialAssets
sampleProject.ingestFiles = initialIngestFiles
