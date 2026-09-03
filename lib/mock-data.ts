import type { Project, Card } from "./poster-types"

export const sampleProjects: Project[] = [
  {
  id: "demo_ws",
  name: "Advanced Layouts & Latent Dynamics",
  posterTitle: "Advanced Layouts & Latent Dynamics",
  authors: "A. Reyes, M. Okafor, L. Petrova, D. Chen",
  venue: "Robotics & Learning Lab - CoRL 2026",
  templateName: "gemini",
  activeOutputId: "out_poster_1",
          outputs: [
    {
      id: "out_poster_1",
      outputType: "poster",
      templateId: "gemini",
      title: "Advanced Layouts & Latent Dynamics",
      cards: [
        {
          id: "poster_card_1",
          title: "Introduction",
          column: 1,
          order: 0,
          pattern: "bullets",
          content: "The ability to accurately model latent dynamics is critical in modern robotic environments. In this paper, we explore a novel approach for combining hindsight relabeling with continuous reinforcement learning. Our results indicate substantial improvements on both sample efficiency and final asymptotic performance.",
          sourceIds: ["asset_txt_1"],
          figures: [],
          table: { hasHeader: false, caption: "", rows: [] },
          figureLayout: "single",
          validation: "valid"
        },
        {
          id: "poster_card_2",
          title: "Mathematical Framework",
          column: 1,
          order: 1,
          pattern: "bullets-two-images",
          content: "We define the state transition model in the latent space $\\mathcal{Z}$ parameterized by $\\theta$. The objective is to maximize the evidence lower bound (ELBO):\n\n$ \\mathcal{L}(\\theta, \\phi) = \\mathbb{E}_{q_\\phi(z|x)} [\\log p_\\theta(x|z)] - D_{\\text{KL}}(q_\\phi(z|x) || p(z)) $\n\nWhere the prior $p(z)$ is updated via the transition dynamics $p(z_t | z_{t-1}, a_{t-1})$. This continuous-time formulation allows handling missing observations gracefully. [@reyes2026]",
          sourceIds: ["asset_eq_1"],
          figures: [
            { id: "fig_mock_1a", url: "/api/workspaces/demo_ws/assets/fig_mock_1a.png", caption: "Model architecture diagram" },
            { id: "fig_mock_1b", url: "/api/workspaces/demo_ws/assets/fig_mock_1b.png", caption: "Physical robot setup" }
          ],
          table: { hasHeader: false, caption: "", rows: [] },
          figureLayout: "single",
          validation: "valid"
        },
        {
          id: "poster_card_3",
          title: "System Architecture",
          column: 2,
          order: 0,
          pattern: "image-focused",
          content: "The overall architecture uses a recurrent state-space model (RSSM). The encoder maps high-dimensional inputs to the latent distribution, while a deterministic recurrent unit predicts the temporal evolution of the mean and variance.",
          sourceIds: [],
          figures: [
            {
              id: "fig_mock",
              url: "/api/workspaces/demo_ws/assets/fig_mock.png",
              caption: "System Architecture: Recurrent state-space model."
            }
          ],
          table: { hasHeader: false, caption: "", rows: [] },
          figureLayout: "single",
          validation: "valid"
        },
        {
          id: "poster_card_4",
          title: "Results & Discussion",
          column: 2,
          order: 1,
          pattern: "bullets-table",
          content: "Our method achieves **82.6% mean success rate** vs **64.2%** for the strongest baseline across 6 simulated tasks (Push, Stack, PegInsert, DoorOpen, Pour, CableRoute).\n\nAs shown in the table below, long-horizon tasks benefit the most from hindsight subgoal relabeling.",
          sourceIds: ["asset_table_1"],
          figures: [],
          table: {
            hasHeader: true,
            caption: "Success rates across tasks.",
            rows: [
              ["Task", "Baseline", "Ours"],
              ["Push", "89%", "95%"],
              ["Stack", "55%", "82%"],
              ["CableRoute", "30%", "78%"]
            ]
          },
          figureLayout: "single",
          validation: "valid"
        },
        {
          id: "poster_card_5",
          title: "References",
          column: 3,
          order: 0,
          pattern: "references",
          content: "@article{reyes2026,\n  title={Latent Dynamics for Robotics},\n  author={Reyes, A. and Okafor, M. and Petrova, L. and Chen, D.},\n  journal={CoRL},\n  year={2026}\n}",
          sourceIds: [],
          figures: [],
          table: { hasHeader: false, caption: "", rows: [] },
          figureLayout: "single",
          validation: "valid"
        }
      ]
    },
    {
      id: "out_paper_1",
      outputType: "paper",
      templateId: "article-twocol",
      title: "Advanced Layouts & Latent Dynamics",
      cards: [
        {
          id: "paper_card_1",
          title: "Abstract",
          column: null,
          order: 0,
          pattern: "section",
          content: "We present a robust method for continuous latent dynamics using hindsight relabeling. We evaluate our approach on 6 demanding robotic manipulation tasks, demonstrating a 28% relative improvement in sample efficiency.",
          sourceIds: ["asset_txt_1"],
          figures: [],
          table: { hasHeader: false, caption: "", rows: [] },
          figureLayout: "single",
          validation: "valid"
        },
        {
          id: "paper_card_2",
          title: "Lagrangian Formulation",
          column: null,
          order: 1,
          pattern: "section-two-figures",
          content: "In addition to standard RL, our physics-informed prior utilizes Lagrangian mechanics to constrain the learned latent space:\n\n$ \\frac{d}{dt} \\left( \\frac{\\partial \\mathcal{L}}{\\partial \\dot{q}} \\right) - \\frac{\\partial \\mathcal{L}}{\\partial q} = Q_{nc} $\n\nThis ensures the decoded trajectories are physically plausible even in low-data regimes. [@reyes2026]",
          sourceIds: ["asset_eq_1"],
          figures: [
            { id: "fig_mock_2a", url: "/api/workspaces/demo_ws/assets/fig_mock_2a.png", caption: "Robot joint configuration" },
            { id: "fig_mock_2b", url: "/api/workspaces/demo_ws/assets/fig_mock_2b.png", caption: "Latent space visualization" }
          ],
          table: { hasHeader: false, caption: "", rows: [] },
          figureLayout: "single",
          validation: "valid"
        },
        {
          id: "paper_card_3",
          title: "Architecture",
          column: null,
          order: 2,
          pattern: "section-figure",
          content: "The system is composed of an RSSM with a CNN backbone.",
          sourceIds: [],
          figures: [
            {
              id: "fig_mock_p3",
              url: "/api/workspaces/demo_ws/assets/fig_mock_p3.png",
              caption: "Model Architecture"
            }
          ],
          table: { hasHeader: false, caption: "", rows: [] },
          figureLayout: "single",
          validation: "valid"
        },
        {
          id: "paper_card_4",
          title: "Results",
          column: null,
          order: 3,
          pattern: "section-table",
          content: "Evaluation on CoRL benchmarks.",
          sourceIds: ["asset_table_1"],
          figures: [],
          table: {
            hasHeader: true,
            caption: "Benchmark Results",
            rows: [
              ["Task", "Baseline", "Ours"],
              ["Push", "89%", "95%"],
              ["Stack", "55%", "82%"]
            ]
          },
          figureLayout: "single",
          validation: "valid"
        },
        {
          id: "paper_card_5",
          title: "References",
          column: null,
          order: 4,
          pattern: "references",
          content: "@article{reyes2026,\n  title={Latent Dynamics for Robotics},\n  author={Reyes, A. and others},\n  journal={CoRL},\n  year={2026}\n}",
          sourceIds: [],
          figures: [],
          table: { hasHeader: false, caption: "", rows: [] },
          figureLayout: "single",
          validation: "valid"
        }
      ]
    },
    {
      id: "out_slides_1",
      outputType: "slides",
      templateId: "beamer-metropolis",
      title: "Advanced Layouts & Latent Dynamics",
      cards: [
        {
          id: "slide_card_1",
          title: "Motivation",
          column: null,
          order: 0,
          pattern: "title-slide",
          content: "Why latent dynamics?\n- Real-world robotics suffers from partial observability.\n- Standard pixels-to-actions architectures overfit quickly.\n- We need a compact representation of the world.",
          sourceIds: ["asset_txt_1"],
          figures: [],
          table: { hasHeader: false, caption: "", rows: [] },
          figureLayout: "single",
          validation: "valid"
        },
        {
          id: "slide_card_2",
          title: "Our Equation",
          column: null,
          order: 1,
          pattern: "two-column",
          content: "By optimizing the ELBO:\n$ \\mathcal{L} = \\mathbb{E}_{q} [\\log p(x|z)] - \\beta D_{\\text{KL}}(q || p) $\nWe balance reconstruction fidelity against prior matching.",
          sourceIds: ["asset_eq_1"],
          figures: [],
          table: { hasHeader: false, caption: "", rows: [] },
          figureLayout: "single",
          validation: "valid"
        },
        {
          id: "slide_card_3",
          title: "Architecture",
          column: null,
          order: 2,
          pattern: "figure-slide",
          content: "The RSSM backbone handles temporal state estimation.",
          sourceIds: [],
          figures: [
            {
              id: "fig_mock_3",
              url: "/api/workspaces/demo_ws/assets/fig_mock_3.png",
              caption: "Model Architecture"
            }
          ],
          table: { hasHeader: false, caption: "", rows: [] },
          figureLayout: "single",
          validation: "valid"
        },
        {
          id: "slide_card_4",
          title: "Results",
          column: null,
          order: 3,
          pattern: "bullets-image",
          content: "Significant gains across all 6 environments.\n- Push: 95%\n- Stack: 82%\n- CableRoute: 78%",
          sourceIds: ["asset_table_1"],
          figures: [
            {
              id: "fig_mock_4",
              url: "/api/workspaces/demo_ws/assets/fig_mock_4.png",
              caption: "Performance overview"
            }
          ],
          table: { hasHeader: false, caption: "", rows: [] },
          figureLayout: "single",
          validation: "valid"
        },
        {
          id: "slide_card_5",
          title: "References",
          column: null,
          order: 4,
          pattern: "references",
          content: "@article{reyes2026,\n  title={Latent Dynamics for Robotics},\n  author={Reyes, A. and others},\n  journal={CoRL},\n  year={2026}\n}",
          sourceIds: [],
          figures: [],
          table: { hasHeader: false, caption: "", rows: [] },
          figureLayout: "single",
          validation: "valid"
        }
      ]
    }
  ],
  assets: [
    {
      id: "asset_img_1",
      fileId: "file_1",
      filename: "architecture_fig_1.png",
      url: "/api/workspaces/demo_ws/assets/architecture_fig_1.png",
      kind: "figure",
      page: 3,
      confidence: "high",
      caption: "System Architecture: Recurrent state-space model mapping high-dimensional inputs to latent distribution."
    },
    {
      id: "asset_img_2",
      fileId: "file_1",
      filename: "results_plot.png",
      url: "/api/workspaces/demo_ws/assets/results_plot.png",
      kind: "figure",
      page: 6,
      confidence: "high",
      caption: "Success rates across 6 simulated tasks.",
    },
    {
      id: "asset_txt_1",
      fileId: "file_1",
      kind: "text",
      page: 1,
      confidence: "high",
      heading: "Abstract",
      snippet: "The ability to accurately model latent dynamics is critical in modern robotic environments. In this paper, we explore a novel approach for combining hindsight relabeling with continuous reinforcement learning..."
    },
    {
      id: "asset_eq_1",
      fileId: "file_1",
      kind: "equation",
      page: 2,
      confidence: "high",
      heading: "eq:elbo_variational",
      caption: "Evidence Lower Bound (ELBO)",
      snippet: "\\mathcal{L}(\\theta, \\phi) = \\mathbb{E}_{q_\\phi(z|x)} \\left[ \\log p_\\theta(x|z) \\right] - D_{\\text{KL}}\\left( q_\\phi(z|x) \\parallel p(z) \\right)",
      section: "Variational inference objective balancing reconstruction log-likelihood against KL prior divergence."
    },
    {
      id: "asset_eq_2",
      fileId: "file_1",
      kind: "equation",
      page: 3,
      confidence: "high",
      heading: "eq:attention_transformer",
      caption: "Scaled Dot-Product Attention",
      snippet: "\\text{Attention}(Q, K, V) = \\text{softmax}\\left( \\frac{Q K^\\top}{\\sqrt{d_k}} \\right) V",
      section: "Transformer self-attention mechanism with query-key scaling factor sqrt(d_k)."
    },
    {
      id: "asset_eq_3",
      fileId: "file_1",
      kind: "equation",
      page: 4,
      confidence: "high",
      heading: "eq:euler_lagrange",
      caption: "Euler-Lagrange Equation of Motion",
      snippet: "\\frac{d}{dt} \\left( \\frac{\\partial \\mathcal{L}}{\\partial \\dot{q}} \\right) - \\frac{\\partial \\mathcal{L}}{\\partial q} = Q_{\\text{nc}}",
      section: "Physics-informed Lagrangian dynamics governing generalized coordinates and non-conservative forces."
    },
    {
      id: "asset_eq_4",
      fileId: "file_1",
      kind: "equation",
      page: 5,
      confidence: "high",
      heading: "eq:cross_entropy",
      caption: "Categorical Cross-Entropy Loss",
      snippet: "\\mathcal{L}_{\\text{CE}} = - \\frac{1}{N} \\sum_{i=1}^N \\sum_{c=1}^C y_{i,c} \\log \\hat{y}_{i,c}",
      section: "Logarithmic classification loss penalizing divergence from ground-truth class labels."
    },
    {
      id: "asset_eq_5",
      fileId: "file_1",
      kind: "equation",
      page: 6,
      confidence: "high",
      heading: "eq:bellman_optimality",
      caption: "Bellman Optimality Equation",
      snippet: "Q^*(s, a) = R(s, a) + \\gamma \\max_{a'} \\mathbb{E}_{s' \\sim P(\\cdot|s, a)} \\left[ Q^*(s', a') \\right]",
      section: "Dynamic programming recurrence for the optimal state-action value function in reinforcement learning."
    },
    {
      id: "table_sample_benchmark",
      fileId: "file_1",
      kind: "table",
      page: 5,
      confidence: "high",
      heading: "Benchmark Success Rates",
      caption: "Table 1: Policy Success Rate Across Manipulation Benchmarks",
      tableRows: [
        ["Task", "DDPG Baseline", "SAC Baseline", "DreamerV3", "Ours (Latent Dyn.)"],
        ["Push", "82.4%", "89.1%", "91.5%", "96.8% ± 0.4%"],
        ["Stack Cube", "48.2%", "55.0%", "73.4%", "84.2% ± 0.8%"],
        ["Peg Insert", "31.5%", "42.8%", "61.0%", "79.5% ± 1.1%"],
        ["Door Open", "67.0%", "74.3%", "88.2%", "94.6% ± 0.5%"],
        ["Cable Route", "18.3%", "30.1%", "54.8%", "78.2% ± 1.4%"]
      ]
    },
    {
      id: "table_sample_complexity",
      fileId: "file_1",
      kind: "table",
      page: 6,
      confidence: "high",
      heading: "Model Architecture & Latency Profile",
      caption: "Table 2: Model Architecture and Inference Latency Profile",
      tableRows: [
        ["Model Variant", "Params (M)", "FLOPs (G)", "Latency (ms)", "Throughput (fps)"],
        ["Latent-Tiny", "14.2", "3.8", "4.2 ms", "238"],
        ["Latent-Base", "48.6", "12.4", "9.8 ms", "102"],
        ["Latent-Large", "124.0", "34.6", "21.5 ms", "46"],
        ["Latent-XL (Ensemble)", "310.5", "88.2", "48.0 ms", "21"]
      ]
    },
    {
      id: "table_sample_ablation",
      fileId: "file_1",
      kind: "table",
      page: 7,
      confidence: "high",
      heading: "Component Ablation Study",
      caption: "Table 3: Component Ablation Study on Latent State Estimation",
      tableRows: [
        ["Ablation Configuration", "ELBO Loss", "Recon RMSE", "Success Rate (%)", "Sample Eff. (+%)"],
        ["Full Architecture (Ours)", "-14.2", "0.042", "86.7%", "+28.4%"],
        ["w/o Lagrangian Prior", "-22.8", "0.078", "73.1%", "+12.1%"],
        ["w/o Hindsight Relabeling", "-18.5", "0.061", "68.4%", "+8.5%"],
        ["w/o Recurrent Latent Unit", "-35.1", "0.114", "52.0%", "-4.2%"],
        ["Standard VAE Baseline", "-48.6", "0.165", "41.8%", "0.0%"]
      ]
    },
    {
      id: "table_sample_hyperparams",
      fileId: "file_1",
      kind: "table",
      page: 8,
      confidence: "high",
      heading: "Hyperparameters & Training Settings",
      caption: "Table 4: Key Hyperparameter & Training Settings",
      tableRows: [
        ["Hyperparameter", "Symbol", "Search Range", "Selected Value"],
        ["Learning Rate", "α", "[1e-5, 1e-3]", "3e-4 (AdamW)"],
        ["Discount Factor", "γ", "[0.95, 0.999]", "0.99"],
        ["KL Divergence Weight", "β", "[0.01, 1.0]", "0.1 (annealed)"],
        ["Batch Size", "B", "[64, 512]", "256"],
        ["Latent State Dimension", "d_z", "[32, 256]", "128"]
      ]
    },
    {
      id: "table_sample_dataset",
      fileId: "file_1",
      kind: "table",
      page: 9,
      confidence: "high",
      heading: "Demonstration Dataset Statistics",
      caption: "Table 5: Demonstration Dataset Statistics & Partitions",
      tableRows: [
        ["Task Domain", "Episodes", "Total Steps", "Train / Val / Test", "Expert Success"],
        ["RoboSuite Tabletop", "1,200", "480,000", "80% / 10% / 10%", "98.5%"],
        ["Meta-World v2", "2,500", "1,250,000", "70% / 15% / 15%", "95.2%"],
        ["D4RL Manipulation", "800", "320,000", "80% / 10% / 10%", "92.0%"],
        ["Real Robot Demonstrations", "350", "140,000", "80% / 10% / 10%", "91.4%"]
      ]
    }
  ],
  ingestFiles: [
    {
      id: "file_1",
      name: "latent_dynamics_coRL.pdf",
      size: 4500000,
      method: "MinerU",
      status: "done",
      progress: 100,
    }
  ]
}
]

/** ID of the in-memory demo project shown before a workspace is selected. */
export const DEMO_PROJECT_ID = sampleProjects[0].id
export const isDemoProject = (id: string) => id === DEMO_PROJECT_ID
