import type { OutputType } from "./output-types"
import eliteShowcasesJson from "@/data/showcases/elite-showcases.json"
import allShowcaseProjectsJson from "@/data/showcases/all-showcase-projects.json"
import type { Project, Card, OutputConfig } from "./poster-types"
import type { ExtractedAsset } from "./ingestion"

/**
 * Flagship, fully populated workspaces used by the public showcase and seed tooling.
 *
 * The heavy literal payloads live in `data/showcases/*.json` (extracted from what used
 * to be a ~9,500-line TypeScript data module). To regenerate the JSON after editing
 * this module's demo workspaces, run:
 *
 *   pnpm exec tsx scripts/extract-showcases-data.mts
 */
export type ShowcaseWorkspace = {
  id: string
  title: string
  subtitle: string
  category: "AI & Robotics" | "Physics" | "Biomedicine"
  tags: string[]
  outputs: OutputType[]
  accent: string
  highlights: { value: string; label: string }[]
}

export const ELITE_SHOWCASES: ShowcaseWorkspace[] = eliteShowcasesJson as ShowcaseWorkspace[]

export const SHOWCASES_BY_ID = Object.fromEntries(ELITE_SHOWCASES.map((item) => [item.id, item]))

export interface ShowcaseMetadata {
  id: string
  category: "physics" | "quantum" | "biology" | "ai-foundations" | "thesis-review"
  tags: string[]
  highlightStat: string
  featured?: boolean
}

export const SHOWCASE_CATEGORIES = [
  { id: "all", label: "Všetky ukážky" },
  { id: "ai-foundations", label: "AI & Deep Learning" },
  { id: "physics", label: "Časticová fyzika (CERN)" },
  { id: "quantum", label: "Kvantové počítače" },
  { id: "biology", label: "Biológia & AlphaFold" },
  { id: "thesis-review", label: "Akademické posudky" },
] as const

export const DEMO_WORKSPACE_IDS = [
  "demo_ws",
  "atlas-bose-einstein-correlations",
  "quantum-supremacy-sycamore",
  "alphafold-protein-folding",
  "posudok-diplomovka-ai",
  "attention-is-all-you-need",
  "resnet-deep-residual-learning",
  "bert-pre-training",
  "gans-goodfellow-2014",
  "vla-autonomous-surgery",
  "neural-wavefunction-superconductors",
  "cas13-panviral-immunity",
  "jwst-gravitational-lensing",
  "speculative-decoding-guarantees",
  "mamba-selective-ssm",
  "aurora-topological-photonics",
  "landscape-ocean-circulation",
  "betterposter-single-cell-atlas",
] as const

export const ALL_SHOWCASE_PROJECTS: Project[] = allShowcaseProjectsJson as Project[]

export const getShowcaseById = (id: string): Project | undefined => {
  return ALL_SHOWCASE_PROJECTS.find(p => p.id === id);
};
