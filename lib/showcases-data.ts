import type { OutputType } from "./output-types"

/** Flagship, fully populated workspaces used by the public showcase and seed tooling. */
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

export const ELITE_SHOWCASES: ShowcaseWorkspace[] = [
  {
    id: "vla-autonomous-surgery",
    title: "SurgiVLA: Autonomous Microsurgery",
    subtitle: "A safety-constrained vision-language-action foundation model for sub-millimetre robotic manipulation.",
    category: "AI & Robotics",
    tags: ["Vision-Language-Action", "Robotics", "Safety", "CVPR"],
    outputs: ["poster", "slides", "paper", "thesis-review"], accent: "#00A6A6",
    highlights: [{ value: "98.7%", label: "task success" }, { value: "0.31 mm", label: "median error" }, { value: "42 Hz", label: "closed-loop control" }],
  },
  {
    id: "neural-wavefunction-superconductors",
    title: "Neural Quantum States for Hydride Superconductors",
    subtitle: "Equivariant neural wavefunctions map anharmonic pairing under megabar pressure.",
    category: "Physics",
    tags: ["Quantum Matter", "Neural Wavefunctions", "Superconductivity", "APS"],
    outputs: ["poster", "slides", "paper"], accent: "#6D5DFB",
    highlights: [{ value: "287 K", label: "predicted Tc" }, { value: "−2.4 meV", label: "energy error" }, { value: "8.1×", label: "sampling speedup" }],
  },
  {
    id: "cas13-panviral-immunity",
    title: "Programmable Cas13 Pan-Viral Immunity",
    subtitle: "Structure-aware guide ensembles suppress escape across diverse respiratory RNA viruses.",
    category: "Biomedicine",
    tags: ["CRISPR-Cas13", "RNA Therapeutics", "Viral Escape", "NeurIPS"],
    outputs: ["poster", "slides", "paper"], accent: "#E45756",
    highlights: [{ value: "99.2%", label: "viral knockdown" }, { value: "0/48", label: "escape cultures" }, { value: "6.8 h", label: "design cycle" }],
  },
]

export const SHOWCASES_BY_ID = Object.fromEntries(ELITE_SHOWCASES.map((item) => [item.id, item]))
