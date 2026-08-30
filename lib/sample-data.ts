import type { EquationItem } from "./equation-types"
import type { ExtractedAsset } from "./ingestion"

/**
 * 5 Rich scientific sample equations spanning variational inference,
 * transformers, physics-informed latent dynamics, loss formulations, and RL.
 */
export const SAMPLE_EQUATIONS: EquationItem[] = [
  {
    id: "eq_sample_elbo",
    key: "eq:elbo_variational",
    name: "Evidence Lower Bound (ELBO)",
    formula: "\\mathcal{L}(\\theta, \\phi) = \\mathbb{E}_{q_\\phi(z|x)} \\left[ \\log p_\\theta(x|z) \\right] - D_{\\text{KL}}\\left( q_\\phi(z|x) \\parallel p(z) \\right)",
    description: "Variational inference objective balancing reconstruction log-likelihood against KL prior divergence.",
    contextSnippet: "Optimizing the evidence lower bound in latent dynamics variational models.",
    page: 2,
    workspaceId: "demo_ws",
  },
  {
    id: "eq_sample_attention",
    key: "eq:attention_transformer",
    name: "Scaled Dot-Product Attention",
    formula: "\\text{Attention}(Q, K, V) = \\text{softmax}\\left( \\frac{Q K^\\top}{\\sqrt{d_k}} \\right) V",
    description: "Transformer self-attention mechanism with query-key scaling factor sqrt(d_k).",
    contextSnippet: "Scaled attention weights over query and key feature vectors in latent state encoders.",
    page: 3,
    workspaceId: "demo_ws",
  },
  {
    id: "eq_sample_lagrange",
    key: "eq:euler_lagrange",
    name: "Euler-Lagrange Equation of Motion",
    formula: "\\frac{d}{dt} \\left( \\frac{\\partial \\mathcal{L}}{\\partial \\dot{q}} \\right) - \\frac{\\partial \\mathcal{L}}{\\partial q} = Q_{\\text{nc}}",
    description: "Physics-informed Lagrangian dynamics governing generalized coordinates and non-conservative forces.",
    contextSnippet: "Constraining latent trajectory dynamics with physics-informed conservation laws.",
    page: 4,
    workspaceId: "demo_ws",
  },
  {
    id: "eq_sample_cross_entropy",
    key: "eq:cross_entropy",
    name: "Categorical Cross-Entropy Loss",
    formula: "\\mathcal{L}_{\\text{CE}} = - \\frac{1}{N} \\sum_{i=1}^N \\sum_{c=1}^C y_{i,c} \\log \\hat{y}_{i,c}",
    description: "Logarithmic classification loss penalizing divergence from ground-truth class labels.",
    contextSnippet: "Softmax cross-entropy loss for supervised classification and policy training.",
    page: 5,
    workspaceId: "demo_ws",
  },
  {
    id: "eq_sample_bellman",
    key: "eq:bellman_optimality",
    name: "Bellman Optimality Equation",
    formula: "Q^*(s, a) = R(s, a) + \\gamma \\max_{a'} \\mathbb{E}_{s' \\sim P(\\cdot|s, a)} \\left[ Q^*(s', a') \\right]",
    description: "Dynamic programming recurrence for the optimal state-action value function in reinforcement learning.",
    contextSnippet: "Bellman backup operator for continuous Q-learning and value iteration.",
    page: 6,
    workspaceId: "demo_ws",
  },
]

export interface SampleTablePreset {
  id: string
  name: string
  caption: string
  rows: string[][]
}

/**
 * 5 Rich scientific sample tables covering manipulation benchmarks,
 * model complexity, component ablation, hyperparameters, and dataset stats.
 */
export const SAMPLE_TABLE_PRESETS: SampleTablePreset[] = [
  {
    id: "table_sample_benchmark",
    name: "Benchmark Success Rates",
    caption: "Table 1: Policy Success Rate Across Manipulation Benchmarks",
    rows: [
      ["Task", "DDPG Baseline", "SAC Baseline", "DreamerV3", "Ours (Latent Dyn.)"],
      ["Push", "82.4%", "89.1%", "91.5%", "96.8% ± 0.4%"],
      ["Stack Cube", "48.2%", "55.0%", "73.4%", "84.2% ± 0.8%"],
      ["Peg Insert", "31.5%", "42.8%", "61.0%", "79.5% ± 1.1%"],
      ["Door Open", "67.0%", "74.3%", "88.2%", "94.6% ± 0.5%"],
      ["Cable Route", "18.3%", "30.1%", "54.8%", "78.2% ± 1.4%"],
    ],
  },
  {
    id: "table_sample_complexity",
    name: "Model Architecture & Latency Profile",
    caption: "Table 2: Model Architecture and Inference Latency Profile",
    rows: [
      ["Model Variant", "Params (M)", "FLOPs (G)", "Latency (ms)", "Throughput (fps)"],
      ["Latent-Tiny", "14.2", "3.8", "4.2 ms", "238"],
      ["Latent-Base", "48.6", "12.4", "9.8 ms", "102"],
      ["Latent-Large", "124.0", "34.6", "21.5 ms", "46"],
      ["Latent-XL (Ensemble)", "310.5", "88.2", "48.0 ms", "21"],
    ],
  },
  {
    id: "table_sample_ablation",
    name: "Component Ablation Study",
    caption: "Table 3: Component Ablation Study on Latent State Estimation",
    rows: [
      ["Ablation Configuration", "ELBO Loss", "Recon RMSE", "Success Rate (%)", "Sample Eff. (+%)"],
      ["Full Architecture (Ours)", "-14.2", "0.042", "86.7%", "+28.4%"],
      ["w/o Lagrangian Prior", "-22.8", "0.078", "73.1%", "+12.1%"],
      ["w/o Hindsight Relabeling", "-18.5", "0.061", "68.4%", "+8.5%"],
      ["w/o Recurrent Latent Unit", "-35.1", "0.114", "52.0%", "-4.2%"],
      ["Standard VAE Baseline", "-48.6", "0.165", "41.8%", "0.0%"],
    ],
  },
  {
    id: "table_sample_hyperparams",
    name: "Hyperparameters & Training Settings",
    caption: "Table 4: Key Hyperparameter & Training Settings",
    rows: [
      ["Hyperparameter", "Symbol", "Search Range", "Selected Value"],
      ["Learning Rate", "α", "[1e-5, 1e-3]", "3e-4 (AdamW)"],
      ["Discount Factor", "γ", "[0.95, 0.999]", "0.99"],
      ["KL Divergence Weight", "β", "[0.01, 1.0]", "0.1 (annealed)"],
      ["Batch Size", "B", "[64, 512]", "256"],
      ["Latent State Dimension", "d_z", "[32, 256]", "128"],
    ],
  },
  {
    id: "table_sample_dataset",
    name: "Demonstration Dataset Statistics",
    caption: "Table 5: Demonstration Dataset Statistics & Partitions",
    rows: [
      ["Task Domain", "Episodes", "Total Steps", "Train / Val / Test", "Expert Success"],
      ["RoboSuite Tabletop", "1,200", "480,000", "80% / 10% / 10%", "98.5%"],
      ["Meta-World v2", "2,500", "1,250,000", "70% / 15% / 15%", "95.2%"],
      ["D4RL Manipulation", "800", "320,000", "80% / 10% / 10%", "92.0%"],
      ["Real Robot Demonstrations", "350", "140,000", "80% / 10% / 10%", "91.4%"],
    ],
  },
]

/**
 * 5 Sample ExtractedAsset objects representing tables for ingestion/asset stores.
 */
export const SAMPLE_TABLE_ASSETS: ExtractedAsset[] = SAMPLE_TABLE_PRESETS.map((t, idx) => ({
  id: t.id,
  fileId: "file_sample_data",
  filename: `table_${idx + 1}_${t.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.csv`,
  kind: "table",
  page: idx + 5,
  confidence: "high",
  caption: t.caption,
  heading: t.name,
  tableRows: t.rows,
}))

/**
 * Formats a 2D array of rows into standard GitHub-flavored Markdown table syntax.
 */
export function formatMarkdownTable(rows: string[][], hasHeader: boolean = true): string {
  if (!rows || rows.length === 0) return ""
  const colCount = Math.max(...rows.map((r) => r.length), 1)
  const normalizedRows = rows.map((r) => {
    const copy = [...r]
    while (copy.length < colCount) copy.push("")
    return copy
  })

  if (normalizedRows.length === 1 && hasHeader) {
    const header = `| ${normalizedRows[0].join(" | ")} |`
    const sep = `| ${Array(colCount).fill("---").join(" | ")} |`
    return `${header}\n${sep}`
  }

  const headerRow = normalizedRows[0]
  const dataRows = hasHeader ? normalizedRows.slice(1) : normalizedRows
  const headerStr = `| ${headerRow.join(" | ")} |`
  const sepStr = `| ${Array(colCount).fill("---").join(" | ")} |`
  const dataStr = dataRows.map((r) => `| ${r.join(" | ")} |`).join("\n")

  return hasHeader ? `${headerStr}\n${sepStr}\n${dataStr}` : `${sepStr}\n${dataStr}`
}
