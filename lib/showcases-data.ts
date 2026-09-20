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

import type { Project, Card, OutputConfig } from "./poster-types"
import type { ExtractedAsset } from "./ingestion"

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
] as const

export const ALL_SHOWCASE_PROJECTS: Project[] = [
  {
    "id": "atlas-bose-einstein-correlations",
    "name": "ATLAS: Bose-Einstein Correlations at 13 TeV",
    "posterTitle": "Two-Particle Bose-Einstein Correlations in 13 TeV pp Collisions with ATLAS",
    "authors": "Róbert Astaloš on behalf of the ATLAS Collaboration",
    "venue": "CERN LHC - European Organization for Nuclear Research & Comenius University",
    "templateName": "atlas",
    "activeOutputId": "out_atlas_poster",
    "logoUrl": "/api/workspaces/atlas-bose-einstein-correlations/logos/atlas_transparent.png",
    "secondaryLogoUrl": "/api/workspaces/atlas-bose-einstein-correlations/logos/uk_logo.png",
    "outputs": [
      {
        "id": "out_atlas_poster",
        "outputType": "poster",
        "templateId": "atlas",
        "title": "Two-Particle Bose-Einstein Correlations in 13 TeV pp Collisions with ATLAS",
        "themeColor": "#C8102E",
        "logoUrl": "/api/workspaces/atlas-bose-einstein-correlations/logos/atlas_transparent.png",
        "secondaryLogoUrl": "/api/workspaces/atlas-bose-einstein-correlations/logos/uk_logo.png",
        "cards": [
          {
            "id": "card_atlas_c1_intro",
            "title": "Abstract & Physics Motivation",
            "column": 1,
            "order": 0,
            "pattern": "bullets",
            "content": "Two-particle Bose-Einstein correlations (BEC) of like-sign charged hadrons provide a direct space-time probe of the particle-emitting source in high-energy particle collisions.\n\n- **Quantum Interference:** Identical bosons exhibit constructive wave-function symmetrization, enhancing pairs emitted with small relative momentum ($Q \\to 0$).\n- **Space-Time Geometry:** The correlation function directly maps the spatial Fourier transform of the hadronization freeze-out region.\n- **LHC Run 2 at 13 TeV:** Highest proton-proton collision energy offers unprecedented access to ultra-high charged-particle multiplicities ($N_{\\text{ch}} \\ge 60$).",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_atlas_c1_detector",
            "title": "ATLAS Detector & TileCal Instrumentation",
            "column": 1,
            "order": 1,
            "pattern": "bullets-image",
            "content": "**High-Multiplicity Track Trigger & Subsystems:**\n- **Inner Detector:** Pixel and Semiconductor Tracker (SCT) within a 2T solenoidal field provide precision vertex reconstruction.\n- **Tile Calorimeter (TileCal):** Steel/scintillating-tile sampling calorimeter for jet energy measurement and minimum-bias trigger verification.\n- **Dataset:** 151 $\\mu\\text{b}^{-1}$ minimum-bias and 8.4 $\\text{nb}^{-1}$ high-multiplicity trigger streams.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_tilecal",
                "url": "/api/workspaces/atlas-bose-einstein-correlations/assets/fig_tilecal_module.png",
                "caption": "Figure 1: ATLAS Tile Calorimeter barrel partitioning and readout scintillator instrumentation."
              }
            ],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_atlas_c1_selection",
            "title": "Event & Track Selection Criteria",
            "column": 1,
            "order": 2,
            "pattern": "bullets",
            "content": "- **Primary Interaction Vertex:** Reconstructed primary vertex required with $\\ge 2$ associated tracks of transverse momentum $p_{\\text{T}} > 100\\text{ MeV}$.\n- **Kinematic Acceptance:** Full pseudorapidity coverage $|\\eta| < 2.5$, with track quality cuts requiring $\\ge 1$ Pixel hit and $\\ge 6$ SCT silicon hits.\n- **Pileup Rejection:** Low beam-luminosity operation with average pileup $\\langle \\mu \\rangle \\le 0.005$ eliminates overlapping collision events per bunch crossing.\n- **Shared-Track Cleaning:** Strict vertex association rejects secondary tracks from strange hadron decays.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_atlas_c2_theory",
            "title": "BEC Correlation Function Formulation",
            "column": 2,
            "order": 0,
            "pattern": "bullets",
            "content": "The two-particle correlation function is measured as the ratio of like-sign pion pairs to an uncorrelated reference sample in bins of relative momentum:\n\n$$C_2(Q) = \\frac{N(Q)}{N_{\\text{ref}}(Q)} = C_0 \\left[1 + \\lambda \\Omega(Q, R)\\right](1 + \\delta Q)$$\n\n- **Lorentz Invariant Relative Momentum:** $Q = \\sqrt{-(p_1 - p_2)^2} = \\sqrt{M^2_{\\pi\\pi} - 4m_\\pi^2}$, where $m_\\pi = 139.57\\text{ MeV}$.\n- **Source Radii $R$ & Strength $\\lambda$:** $\\Omega(Q, R) = e^{-(QR)}$ parameterizes the exponential source distribution in four dimensions.\n- **Baseline Normalization:** $C_0$ normalizes the tail ($Q > 0.8\\text{ GeV}$) while $\\delta$ models long-range phase-space correlations.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_atlas_c2_fit",
            "title": "13 TeV Correlation Fits & Radius Extraction",
            "column": 2,
            "order": 1,
            "pattern": "bullets-image",
            "content": "**Exponential Fit & Extraction of Emitter Dimensions:**\n- **Double-Exponential Superiority:** Successfully fits both the sharp core and long-range non-Gaussian tails.\n- **Emitter Radius:** Measured source radius $R = 1.42 \\pm 0.03\\,\\text{(stat)} \\pm 0.08\\,\\text{(syst)}\\text{ fm}$.\n- **Correlation Strength:** $\\lambda = 0.68 \\pm 0.02$, demonstrating partial coherence and long-lived decay contamination.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_bec_fit",
                "url": "/api/workspaces/atlas-bose-einstein-correlations/assets/fig_bec_correlation_fit.png",
                "caption": "Figure 2: Two-particle correlation function $C_2(Q)$ in 13 TeV pp collisions with double-exponential fit and Data/Fit ratio."
              }
            ],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_atlas_c2_reference",
            "title": "Reference Sample & Coulomb Corrections",
            "column": 2,
            "order": 2,
            "pattern": "bullets",
            "content": "- **Opposite-Sign Pion Pairs:** Primary uncorrelated reference baseline after subtracting hadronic resonance contributions ($\\rho^0, \\omega, K^0_S$).\n- **Gamow Coulomb Factor:** Relativistic Coulomb interaction correction $A_{\\text{c}}(Q) = \\frac{2\\pi \\eta_c}{e^{2\\pi \\eta_c} - 1}$ with $\\eta_c = \\alpha m_\\pi / Q$ applied to like-sign and opposite-sign pairs.\n- **Mixed-Event Cross-Check:** Secondary reference constructed by pairing pions from distinct events with matching vertex positions and track multiplicities.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_atlas_c3_stats",
            "title": "Multiplicity Dependence & Collective Behavior",
            "column": 3,
            "order": 0,
            "pattern": "stats",
            "content": "- **13 TeV** Center-of-Mass Energy | Highest pp collision energy at CERN LHC\n- **R = 1.42 fm** Measured Source Radius | Exponential source parameterization\n- **N_ch >= 60** High Multiplicity | Clear scaling of $R \\propto \\langle N_{\\text{ch}} \\rangle^{1/3}$\n- **TileCal** Trigger & Veto | Fast minimum-bias scintillation detection",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_atlas_c3_systematics",
            "title": "Systematic Uncertainty Breakdown",
            "column": 3,
            "order": 1,
            "pattern": "bullets-table",
            "content": "Dominant relative systematic uncertainties on the extracted radius $R$ and strength $\\lambda$:",
            "figureLayout": "single",
            "table": {
              "hasHeader": true,
              "caption": "Table 1: Systematic error components at 13 TeV",
              "rows": [
                [
                  "Source of Uncertainty",
                  "$\\Delta R / R$ (%)",
                  "$\\Delta \\lambda / \\lambda$ (%)"
                ],
                [
                  "Track Reconstruction Efficiency",
                  "2.1",
                  "1.8"
                ],
                [
                  "Reference Sample Definition",
                  "3.4",
                  "2.9"
                ],
                [
                  "Coulomb Correction Modeling",
                  "1.7",
                  "2.2"
                ],
                [
                  "Resonance Decay Backgrounds",
                  "2.8",
                  "3.1"
                ],
                [
                  "Fit Interval Variation ($Q_{\\text{min}}, Q_{\\text{max}}$)",
                  "1.9",
                  "2.5"
                ],
                [
                  "Total Systematic Uncertainty",
                  "5.6",
                  "5.4"
                ]
              ]
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_atlas_c3_conclusion",
            "title": "Conclusions & Hadronization Dynamics",
            "column": 3,
            "order": 2,
            "pattern": "bullets",
            "content": "- **Hydrodynamic Scaling:** $R \\propto \\langle N_{\\text{ch}} \\rangle^{1/3}$ scaling confirms collective spatial expansion analogous to relativistic heavy-ion collisions.\n- **Transverse Momentum Dependence:** Significant decrease of $R$ with increasing $k_{\\text{T}}$ reveals intense space-momentum correlations during freeze-out.\n- **Model Constraints:** Sets precision constraints on PYTHIA 8 Lund string fragmentation and multi-parton interaction parameters.\n- **Universal BEC Freeze-out:** Consistent with continuous source expansion prior to chemical decoupling across LHC collision energies.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_atlas_c3_refs",
            "title": "Key References",
            "column": 3,
            "order": 3,
            "pattern": "bullets",
            "content": "- **ATLAS Collaboration**, Eur. Phys. J. C 82, 608 (2022).\n- **G. Goldhaber et al.**, Phys. Rev. 120, 300 (1960).\n- **ATLAS TileCal Group**, JINST 9, P02008 (2014).",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          }
        ]
      },
      {
        "id": "out_atlas_slides",
        "outputType": "slides",
        "templateId": "beamer-atlas",
        "title": "Two-Particle Bose-Einstein Correlations with ATLAS",
        "themeColor": "#C8102E",
        "cards": [
          {
            "id": "card_atlas_slide_1",
            "title": "Physics Motivation",
            "column": 1,
            "order": 0,
            "pattern": "bullets",
            "content": "- Space-time geometry of the hadronization region\n- Femtoscopy probe of particle emission radius $R$\n- 13 TeV pp minimum bias and high multiplicity triggers",
            "figures": [],
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figureLayout": "single",
            "validation": "valid",
            "sourceIds": []
          }
        ]
      },
      {
        "id": "out_atlas_paper",
        "outputType": "paper",
        "templateId": "epj-woc",
        "title": "Two-Particle Bose-Einstein Correlations in 13 TeV pp Collisions with ATLAS",
        "themeColor": "#C8102E",
        "cards": [
          {
            "id": "card_atlas_paper_1",
            "title": "Introduction",
            "column": 1,
            "order": 0,
            "pattern": "bullets",
            "content": "Bose-Einstein correlations of identical bosons are a standard femtoscopic technique in high-energy physics.",
            "figures": [],
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figureLayout": "single",
            "validation": "valid",
            "sourceIds": []
          }
        ]
      }
    ],
    "assets": [
      {
        "id": "ast_bec_fit",
        "fileId": "fig_bec_correlation_fit.png",
        "filename": "fig_bec_correlation_fit.png",
        "url": "/api/workspaces/atlas-bose-einstein-correlations/assets/fig_bec_correlation_fit.png",
        "kind": "figure",
        "page": 1,
        "confidence": "high",
        "caption": "Bose-Einstein Correlation Function Fit"
      },
      {
        "id": "ast_tilecal",
        "fileId": "fig_tilecal_module.png",
        "filename": "fig_tilecal_module.png",
        "url": "/api/workspaces/atlas-bose-einstein-correlations/assets/fig_tilecal_module.png",
        "kind": "figure",
        "page": 1,
        "confidence": "high",
        "caption": "TileCal Detector Module"
      },
      {
        "id": "ast_atlas_logo",
        "fileId": "atlas_transparent.png",
        "filename": "atlas_transparent.png",
        "url": "/api/workspaces/atlas-bose-einstein-correlations/logos/atlas_transparent.png",
        "kind": "figure",
        "page": 1,
        "confidence": "high",
        "caption": "ATLAS CERN Logo"
      },
      {
        "id": "ast_uk_logo",
        "fileId": "uk_logo.png",
        "filename": "uk_logo.png",
        "url": "/api/workspaces/atlas-bose-einstein-correlations/logos/uk_logo.png",
        "kind": "figure",
        "page": 1,
        "confidence": "high",
        "caption": "Comenius University Logo"
      }
    ],
    "ingestFiles": []
  },
  {
    "id": "quantum-supremacy-sycamore",
    "name": "Quantum Supremacy on 53-Qubit Sycamore",
    "posterTitle": "Quantum Supremacy Using a Programmable Superconducting Processor",
    "authors": "F. Arute, K. Arya, R. Babbush, J. M. Martinis, et al. (Google Quantum AI)",
    "venue": "Nature 574, 505–510 (2019)",
    "templateName": "betterposter",
    "activeOutputId": "out_quantum_poster",
    "outputs": [
      {
        "id": "out_quantum_poster",
        "outputType": "poster",
        "templateId": "betterposter",
        "title": "Quantum Supremacy Using a Programmable Superconducting Processor",
        "themeColor": "#1E40AF",
        "cards": [
          {
            "id": "card_q_left_theory",
            "title": "The Computational Frontier",
            "column": 1,
            "order": 0,
            "pattern": "bullets",
            "content": "Quantum computing promises exponential acceleration over classical supercomputers for targeted algorithms.\n\n- **Exponential State Space:** $n=53$ qubits span a Hilbert space of dimension $2^{53} \\approx 9.0 \\times 10^{15}$, prohibiting classical state storage.\n- **Computational Hardness:** Random Circuit Sampling (RCS) is classically intractable under standard complexity conjectures.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_q_left_arch",
            "title": "Sycamore Architecture & Gates",
            "column": 1,
            "order": 1,
            "pattern": "bullets-image",
            "content": "- **2D Transmon Lattice:** 54 qubits in a square grid with 86 frequency-tunable couplers.\n- **Gate Fidelities:** 12 ns single-qubit ($99.85\\%$) and 32 ns two-qubit ($99.64\\%$) gates with full parallel execution across all 53 qubits.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_sycamore",
                "url": "/api/workspaces/quantum-supremacy-sycamore/assets/fig_sycamore_chip.png",
                "caption": "Figure 1: Sycamore 53-qubit lattice with 86 tunable couplers."
              }
            ],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_q_center_hero",
            "title": "Google Sycamore achieved Quantum Supremacy by sampling 1,000,000 bitstrings in 200 seconds -- a task requiring 10,000 years on Summit supercomputer.",
            "column": 2,
            "order": 0,
            "pattern": "bullets",
            "content": "- **Physical Demonstration:** Conclusively proves that quantum speedup is physically realizable without unmodeled multi-body decoherence.\n- **Superpolynomial Scaling:** Computes in $O(1)$ constant circuit time what scales as $O(2^n)$ on classical supercomputers.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_q_center_bench",
            "title": "Cross-Entropy Benchmarking (XEB)",
            "column": 2,
            "order": 1,
            "pattern": "bullets-image",
            "content": "- **Linear XEB Metric:** Evaluates sampling fidelity via $F_{\\text{XEB}} = 2^n \\sum_{x} P(x) q(x) - 1$.\n- **Fidelity Retention:** At depth $m=20$, measured fidelity is $F_{\\text{XEB}} = (0.224 \\pm 0.021)\\%$, matching single- and two-qubit gate error models.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_xeb",
                "url": "/api/workspaces/quantum-supremacy-sycamore/assets/fig_xeb_fidelity.png",
                "caption": "Figure 2: Linear XEB fidelity vs depth and Sycamore 200 s vs 10,000 yr Summit supercomputer limit."
              }
            ],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_q_right_stats",
            "title": "Sycamore System Metrics",
            "column": 3,
            "order": 0,
            "pattern": "stats",
            "content": "- **53 Qubits** Active Transmons | 2D lattice with 86 tunable couplers\n- **200 Seconds** Quantum Sampling | 1,000,000 bitstrings generated\n- **10,000 Years** Classical Baseline | Summit Supercomputer barrier\n- **2^53 States** State Space | $9.0 \\times 10^{15}$ Hilbert dimensions",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_q_right_verification",
            "title": "Classical Verification Strategy",
            "column": 3,
            "order": 1,
            "pattern": "bullets",
            "content": "- **Patch Circuits:** Removing couplers divides the grid into 26-qubit sub-systems computable in minutes.\n- **Elided Circuits:** Removing entangling gates allows fast tensor contraction verification.\n- **Independence:** Proves gate errors remain independent without multi-body decoherence.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_q_right_outlook",
            "title": "The NISQ Era & Surface Codes",
            "column": 3,
            "order": 2,
            "pattern": "bullets",
            "content": "- **NISQ Applications:** Near-term benchmarking for quantum chemistry and random number generation.\n- **Fault-Tolerant Path:** Validates precision baseline needed for surface code logical qubits.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          }
        ]
      },
      {
        "id": "out_quantum_slides",
        "outputType": "slides",
        "templateId": "beamer-focus",
        "title": "Quantum Supremacy on Sycamore",
        "themeColor": "#1E40AF",
        "cards": [
          {
            "id": "card_q_slide_1",
            "title": "The Supremacy Horizon",
            "column": 1,
            "order": 0,
            "pattern": "bullets",
            "content": "- 53 superconducting qubits\n- $2^{53} \\approx 9 \\times 10^{15}$ dimensional Hilbert space\n- 200 seconds vs 10,000 years on classical supercomputer",
            "figures": [],
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figureLayout": "single",
            "validation": "valid",
            "sourceIds": []
          }
        ]
      },
      {
        "id": "out_quantum_paper",
        "outputType": "paper",
        "templateId": "revtex-aps",
        "title": "Quantum Supremacy Using a Programmable Superconducting Processor",
        "themeColor": "#1E40AF",
        "cards": [
          {
            "id": "card_q_paper_1",
            "title": "Abstract",
            "column": 1,
            "order": 0,
            "pattern": "bullets",
            "content": "We demonstrate quantum supremacy using a programmable superconducting processor with 53 active qubits.",
            "figures": [],
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figureLayout": "single",
            "validation": "valid",
            "sourceIds": []
          }
        ]
      }
    ],
    "assets": [
      {
        "id": "ast_q_chip",
        "fileId": "fig_sycamore_chip.png",
        "filename": "fig_sycamore_chip.png",
        "url": "/api/workspaces/quantum-supremacy-sycamore/assets/fig_sycamore_chip.png",
        "kind": "figure",
        "page": 1,
        "confidence": "high",
        "caption": "Sycamore 53-Qubit Chip Layout"
      },
      {
        "id": "ast_q_xeb",
        "fileId": "fig_xeb_fidelity.png",
        "filename": "fig_xeb_fidelity.png",
        "url": "/api/workspaces/quantum-supremacy-sycamore/assets/fig_xeb_fidelity.png",
        "kind": "figure",
        "page": 1,
        "confidence": "high",
        "caption": "XEB Fidelity vs Classical Runtime"
      }
    ],
    "ingestFiles": []
  },
  {
    "id": "alphafold-protein-folding",
    "name": "AlphaFold 2: Accurate Protein Structure Prediction",
    "posterTitle": "Highly Accurate Protein Structure Prediction with AlphaFold",
    "authors": "John Jumper, Richard Evans, Alexander Pritzel, Tim Green, Demis Hassabis, et al. (DeepMind)",
    "venue": "Nature 596, 583–589 (2021)",
    "templateName": "conference",
    "activeOutputId": "out_alphafold_poster",
    "outputs": [
      {
        "id": "out_alphafold_poster",
        "outputType": "poster",
        "templateId": "conference",
        "title": "Highly Accurate Protein Structure Prediction with AlphaFold",
        "themeColor": "#059669",
        "cards": [
          {
            "id": "card_af_c1_challenge",
            "title": "The 50-Year Grand Challenge",
            "column": 1,
            "order": 0,
            "pattern": "bullets",
            "content": "Proteins fold into complex 3D atomic structures that dictate biological catalytic function.\n\n- **Levinthal Paradox:** Polypeptide chains possess astronomical conformational search spaces ($10^{300}$ states), yet fold spontaneously in milliseconds.\n- **CASP Stagnation:** Computational approaches hovered at 40-50 GDT score for two decades.\n- **Atomic Breakthrough:** AlphaFold 2 achieves a median score of 92.4 GDT, rivaling experimental Cryo-EM and X-ray crystallographic accuracy.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_af_c1_msa",
            "title": "Evolutionary Couplings & Co-Variation",
            "column": 1,
            "order": 1,
            "pattern": "bullets",
            "content": "- **Homology Mining:** Deep genetic databases (UniRef90, BFD, MGnify) searched for evolutionary homologs.\n- **Co-Mutation Patterns:** Residue pairs that mutate in tandem reveal spatial contact constraints across millions of years of natural selection.\n- **Information Retention:** Replaces hand-crafted co-evolution features with learned continuous representations.\n- **Multiple Alignments:** Processes alignments of thousands of homologous sequences simultaneously.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_af_c1_metrics",
            "title": "CASP14 Breakthrough Performance",
            "column": 1,
            "order": 2,
            "pattern": "stats",
            "content": "- **92.4 GDT** Overall Median Score | Experimental accuracy threshold (>90)\n- **0.96 Å** Backbone Cα RMSD | Atomic resolution across diverse protein folds\n- **48 Blocks** Evoformer Depth | Direct co-evolutionary pair reasoning\n- **200M+** Predicted Structures | Universal AlphaFold Protein Database",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_af_c2_evoformer",
            "title": "Evoformer Architecture & Dual Representations",
            "column": 2,
            "order": 0,
            "pattern": "bullets-image",
            "content": "**End-to-End Evolutionary Transformer:**\n- **Dual Representations:** Maintains MSA matrix $s_{si}$ and residue-pair interaction matrix $z_{ij}$ with continuous two-way cross-talk.\n- **Triangular Attention:** Directly embeds the triangle inequality constraint into attention updates:\n\n$$z_{ij} \\leftarrow z_{ij} + \\sum_{k} (a_{ik} \\odot b_{jk})$$\n\n- **Axial Self-Attention:** Decouples row-wise sequence attention and column-wise residue attention.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_evoformer",
                "url": "/api/workspaces/alphafold-protein-folding/assets/fig_evoformer_arch.png",
                "caption": "Figure 1: Evoformer dual-track representation and Invariant Point Attention structure module."
              }
            ],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_af_c2_ipa",
            "title": "Invariant Point Attention (IPA) Module",
            "column": 2,
            "order": 1,
            "pattern": "bullets",
            "content": "- **3D Rigid Body Residue Frames:** Predicts Euclidean rotations and translations $(R_i, \\vec{t}_i) \\in \\text{SE}(3)$ for all amino acid backbones independently.\n- **Coordinate Independence:** Mathematical guarantee that computed attention weights remain strictly invariant to global rigid-body rotations and translations in 3D Euclidean space.\n- **Torsion Angle Predictions:** Predicts 7 backbone and side-chain dihedral angles per residue $(\\phi, \\psi, \\omega, \\chi_1, \\chi_2, \\chi_3, \\chi_4)$ from local reference frames.\n- **Iterative Refinement:** Structural module recycles backbones through 8 shared structural update iterations with stop-gradient propagation.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_af_c2_loss",
            "title": "Clamped FAPE Loss & Stereochemistry",
            "column": 2,
            "order": 2,
            "pattern": "bullets",
            "content": "- **Frame Aligned Point Error (FAPE):** Structural loss comparing local residue coordinates across ground-truth frames:\n\n$$\\mathcal{L}_{\\text{FAPE}} = \\frac{1}{N^2} \\sum_{i,j} \\min\\left(d_{\\text{clamp}}, \\|\\vec{x}_{ij}^{\\text{pred}} - \\vec{x}_{ij}^{\\text{true}}\\|\\right)$$\n\n- **Stereochemical Regularization:** Penalizes peptide bond length deviations and van der Waals steric overlap clashes without physical molecular dynamics simulations.\n- **pLDDT Confidence:** Predicts local distance difference test score per residue to estimate uncertainty.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_af_c3_benchmark",
            "title": "CASP14 Blind Assessment Accuracy",
            "column": 3,
            "order": 0,
            "pattern": "bullets-image",
            "content": "**Dominance Across Free-Modeling & Template Targets:**\n- **Free-Modeling (FM):** Achieves GDT_TS of 87.0 on hard free-modeling targets lacking homologous structures in PDB.\n- **Side-Chain Fidelity:** Highly accurate placement of rotamer conformations aligns with experimental electron density maps.\n- **Global Topology Resolution:** Accurately resolves complex all-beta sheet architectures and knots without human intervention.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_casp14",
                "url": "/api/workspaces/alphafold-protein-folding/assets/fig_casp14_benchmark.png",
                "caption": "Figure 2: CASP14 blind assessment median GDT scores across target domains."
              }
            ],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_af_c3_table",
            "title": "CASP14 Competitive Benchmark",
            "column": 3,
            "order": 1,
            "pattern": "bullets-table",
            "content": "Comparison with leading structural biology modeling pipelines at CASP14:",
            "figureLayout": "single",
            "table": {
              "hasHeader": true,
              "caption": "Table 1: Median accuracy and backbone RMSD comparison",
              "rows": [
                [
                  "Method / Group",
                  "Median GDT_TS",
                  "Cα RMSD (Å)",
                  "Free Modeling"
                ],
                [
                  "AlphaFold 2 (DeepMind)",
                  "92.4",
                  "0.96",
                  "87.0"
                ],
                [
                  "Baker Lab (RoseTTAFold)",
                  "61.2",
                  "2.85",
                  "54.2"
                ],
                [
                  "Zhang Lab (I-TASSER)",
                  "58.4",
                  "3.20",
                  "51.8"
                ],
                [
                  "FEIG-R (MD Refinement)",
                  "52.1",
                  "3.80",
                  "44.6"
                ],
                [
                  "Standard Physics (MD)",
                  "41.6",
                  "4.90",
                  "33.2"
                ]
              ]
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_af_c3_impact",
            "title": "Global Life Sciences Impact",
            "column": 3,
            "order": 2,
            "pattern": "bullets",
            "content": "- **Human Proteome Decoded:** Structural models provided for 98.5% of human proteins with residue confidence.\n- **Rational Drug Discovery:** Uncovers cryptic binding pockets and allosteric sites for small-molecule therapeutics.\n- **Protein Design & Synthesis:** Accelerates de novo binder generation and targeted plastic-degrading PETase enzymes.\n- **PDB Expansion:** Open-access structural database encompassing >200 million predicted macromolecules.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_af_c1_features",
            "title": "Input Embeddings & Representation",
            "column": 1,
            "order": 3,
            "pattern": "bullets",
            "content": "- **Target Sequence Encoding:** Amino acid residues are embedded into a 1D tensor of dimension $r \\times 384$.\n- **Pair Representation:** Residue pair features initialize a 2D relational matrix ($r \\times r \\times 128$) containing relative positional encodings $|i - j| \\le 32$.\n- **Template Structures:** High-confidence homologous PDB structural templates contribute initial pairwise distance distograms.\n- **Evolutionary Depth:** MSA representations with up to 16,384 sequences provide deep phylogenetic covariation signals.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          }
        ]
      },
      {
        "id": "out_alphafold_slides",
        "outputType": "slides",
        "templateId": "beamer-metropolis",
        "title": "Protein Structure Prediction with AlphaFold",
        "themeColor": "#059669",
        "cards": [
          {
            "id": "card_af_slide_1",
            "title": "The Protein Folding Challenge",
            "column": 1,
            "order": 0,
            "pattern": "bullets",
            "content": "- 50-year-old biological mystery solved\n- Evoformer MSA and pair representation\n- Invariant Point Attention (IPA) structure module",
            "figures": [],
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figureLayout": "single",
            "validation": "valid",
            "sourceIds": []
          }
        ]
      },
      {
        "id": "out_alphafold_paper",
        "outputType": "paper",
        "templateId": "springer-llncs",
        "title": "Highly Accurate Protein Structure Prediction with AlphaFold",
        "themeColor": "#059669",
        "cards": [
          {
            "id": "card_af_paper_1",
            "title": "Abstract",
            "column": 1,
            "order": 0,
            "pattern": "bullets",
            "content": "We predict 3D protein structures with atomic accuracy using a novel neural network architecture.",
            "figures": [],
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figureLayout": "single",
            "validation": "valid",
            "sourceIds": []
          }
        ]
      }
    ],
    "assets": [
      {
        "id": "ast_af_evo",
        "fileId": "fig_evoformer_arch.png",
        "filename": "fig_evoformer_arch.png",
        "url": "/api/workspaces/alphafold-protein-folding/assets/fig_evoformer_arch.png",
        "kind": "figure",
        "page": 1,
        "confidence": "high",
        "caption": "Evoformer Architecture"
      },
      {
        "id": "ast_af_casp",
        "fileId": "fig_casp14_benchmark.png",
        "filename": "fig_casp14_benchmark.png",
        "url": "/api/workspaces/alphafold-protein-folding/assets/fig_casp14_benchmark.png",
        "kind": "figure",
        "page": 1,
        "confidence": "high",
        "caption": "CASP14 Benchmark Results"
      }
    ],
    "ingestFiles": []
  },
  {
    "id": "posudok-diplomovka-ai",
    "name": "Posudok: Segmentácia medicínskych obrazov",
    "posterTitle": "Posudok vedúceho diplomovej práce: Hlboké reziduálne siete pre segmentáciu medicínskych obrazov",
    "authors": "doc. RNDr. Róbert Astaloš, PhD. (Vedúci práce)",
    "venue": "Univerzita Komenského v Bratislave, Fakulta matematiky, fyziky a informatiky",
    "templateName": "posudok-sk",
    "activeOutputId": "out_posudok_review",
    "outputs": [
      {
        "id": "out_posudok_review",
        "outputType": "thesis-review",
        "templateId": "posudok-sk",
        "title": "Posudok vedúceho diplomovej práce",
        "themeColor": "#0284C7",
        "cards": [
          {
            "id": "card_pos_meta",
            "title": "Identifikácia práce a zadanie",
            "column": 1,
            "order": 0,
            "pattern": "bullets",
            "content": "- **Autor práce:** Bc. Martin Kováč\n- **Názov diplomovej práce:** Hlboké reziduálne siete pre sémantickú segmentáciu medicínskych obrazov\n- **Študijný program:** Aplikovaná informatika a biofyzika\n- **Školiace pracovisko:** Katedra jadrovej fyziky a biofyziky, FMFI UK v Bratislave\n- **Cieľ práce:** Návrh a evaluácia modifikovanej ResNet/U-Net architektúry pre automatickú segmentáciu pľúcnych lézií z CT skenov.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_pos_ciele",
            "title": "Splnenie stanovených cieľov",
            "column": 1,
            "order": 1,
            "pattern": "bullets",
            "content": "Diplomant preukázal mimoriadnu samostatnosť a systematický prístup pri riešení všetkých bodov zadania.\n\n- **Kompletná realizácia:** Všetky čiastkové ciele formulované v zadaní diplomovej práce boli splnené v plnom rozsahu.\n- **Inovatívny prínos:** Integrácia hybridného dice-loss a attention-gated spojení priniesla signifikantné zvýšenie Dice koeficientu o 4.2% oproti existujúcim klinickým baseline modelom.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_pos_teoria",
            "title": "Odborná úroveň a teoretická báza",
            "column": 1,
            "order": 2,
            "pattern": "bullets",
            "content": "- **Práca s literatúrou:** Teoretická časť obsahuje reprezentatívny prehľad modernej literatúry (viac než 45 relevantných zahraničných zdrojov, vrátane IEEE TMI a Medical Image Analysis z rokov 2022-2026).\n- **Matematická formalizácia:** Konvolučné vrstvy, reziduálne prepojenia aj optimalizačné funkcie sú formalizované s vysokou matematickou presnosťou.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_pos_experimenty",
            "title": "Metodika, experimenty a softvér",
            "column": 1,
            "order": 3,
            "pattern": "bullets-image",
            "content": "**Experimentálna rigoróznosť a kódová báza:**\n- **Dataset:** Trénované a validované na verejnom referenčnom korpuse LIDC-IDRI (1018 pacientov) s prísnou 5-násobnou krížovou validáciou.\n- **Kvalita implementácie:** Repozitár v PyTorch je plne modulárny, pokrytý unit testami a pripravený na reprodukovateľný deployment.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_radar",
                "url": "/api/workspaces/posudok-diplomovka-ai/assets/fig_posudok_radar.png",
                "caption": "Hodnotiaci radarový diagram diplomovej práce podľa univerzitných kritérií."
              }
            ],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_pos_otazky",
            "title": "Otázky k obhajobe",
            "column": 1,
            "order": 4,
            "pattern": "bullets",
            "content": "1. Ako by navrhovaný model reagoval na prítomnosť obrazových artefaktov spôsobených pohybom pacienta pri nízko-dávkovom CT protokole?\n2. Aká je výpočtová zložitosť inferencie jedného 3D objemu a bolo by možné model nasadiť do real-time klinickej diagnostickej stanice?",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_pos_zaver",
            "title": "Záverečné zhodnotenie a klasifikácia",
            "column": 1,
            "order": 5,
            "pattern": "stats",
            "content": "- **Hodnotenie A** Výborne | Celkový priemer hodnotenia 96.4%\n- **Odporúčanie** Prácu odporúčam k obhajobe | Pred komisiou pre ŠSZ na FMFI UK\n- **Podpis vedúceho** doc. RNDr. Róbert Astaloš, PhD. | V Bratislave dňa 21. mája 2026",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          }
        ]
      }
    ],
    "assets": [
      {
        "id": "ast_pos_radar",
        "fileId": "fig_posudok_radar.png",
        "filename": "fig_posudok_radar.png",
        "url": "/api/workspaces/posudok-diplomovka-ai/assets/fig_posudok_radar.png",
        "kind": "figure",
        "page": 1,
        "confidence": "high",
        "caption": "Hodnotiaci diagram kritérií"
      }
    ],
    "ingestFiles": []
  },
  {
    "id": "attention-is-all-you-need",
    "name": "Attention Is All You Need",
    "posterTitle": "Attention Is All You Need",
    "authors": "Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N. Gomez, Łukasz Kaiser, Illia Polosukhin",
    "venue": "31st Conference on Neural Information Processing Systems (NeurIPS 2017), Long Beach, CA, USA",
    "templateName": "gemini",
    "activeOutputId": "out_attn_poster",
    "outputs": [
      {
        "id": "out_attn_poster",
        "outputType": "poster",
        "templateId": "gemini",
        "title": "Attention Is All You Need",
        "themeColor": "#4F46E5",
        "cards": [
          {
            "id": "card_tf_c1_abstract",
            "title": "Abstract & The Recurrent Bottleneck",
            "column": 1,
            "order": 0,
            "pattern": "bullets",
            "content": "Recurrent sequence models (LSTM, GRU) impose severe computational bottlenecks linking encoder and decoder representations.\n\n- **Sequential Dependency:** Tokens are processed step-by-step ($O(n)$ operations), prohibiting parallel computation across training sequences.\n- **Signal Loss:** Distance between interacting tokens scales linearly with separation, causing vanishing gradients.\n- **The Transformer Solution:** Eliminates recurrence entirely, computing representations via **self-attention** in $O(1)$ sequential operations.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_tf_c1_metrics",
            "title": "Breakthrough Benchmark Performance",
            "column": 1,
            "order": 1,
            "pattern": "stats",
            "content": "- **28.4 BLEU** EN-DE Benchmark | New SOTA (+2.0 over previous best)\n- **41.0 BLEU** EN-FR Benchmark | Surpasses all single models & ensembles\n- **3.5 Days** Training Cost | 8 × NVIDIA P100 GPUs (fraction of RNN cost)\n- **O(1)** Path Length | Constant sequential path for signal propagation",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_tf_c1_attention",
            "title": "Scaled Dot-Product Attention",
            "column": 1,
            "order": 2,
            "pattern": "bullets",
            "content": "An attention function maps queries $Q$, keys $K$, and values $V$ to output vectors:\n\n$$\\text{Attention}(Q,K,V) = \\text{softmax}\\left(\\frac{QK^\\top}{\\sqrt{d_k}}\\right)V$$\n\n- **Why Scale by $1/\\sqrt{d_k}$?** For large dimensions ($d_k=64$), dot products grow large, pushing softmax into vanishing gradient regions. Scaling preserves variance 1 and numerical stability.\n- **Matrix Parallelism:** Evaluated on entire sequences simultaneously via highly optimized matrix multiplication routines.\n- **Causal Masking:** Decoder self-attention masks future positions with $-\\infty$ to preserve autoregressive factorization.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_tf_c1_posenc",
            "title": "Positional Encodings",
            "column": 1,
            "order": 3,
            "pattern": "bullets",
            "content": "Since self-attention contains no recurrence or convolution, sequence order information is injected via sinusoidal positional functions:\n\n$$PE_{(pos, 2i)} = \\sin(pos / 10000^{2i/d_{\\text{model}}}), \\quad PE_{(pos, 2i+1)} = \\cos(pos / 10000^{2i/d_{\\text{model}}})$$\n\n- **Relative Offset Invariance:** Enables the model to attend by relative positions since for any fixed offset $k$, $PE_{pos+k}$ is a linear function of $PE_{pos}$.\n- **Generalization to Arbitrary Lengths:** Allows the network to extrapolate to longer sequences than encountered during training without adding learnable weights.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_tf_c2_arch",
            "title": "The Transformer Architecture",
            "column": 2,
            "order": 0,
            "pattern": "bullets-image",
            "content": "**Encoder-Decoder Structure:** Stack of $N=6$ identical layers ($d_{\\text{model}}=512, d_{ff}=2048, h=8$):\n- **Encoder:** Multi-Head Self-Attention followed by a position-wise Feed-Forward Network.\n- **Decoder:** Adds masked attention to prevent positions from attending to subsequent tokens.\n- **Residual Connections:** $\\text{LayerNorm}(x + \\text{Sublayer}(x))$ around every sub-layer.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_transformer_arch",
                "url": "/api/workspaces/attention-is-all-you-need/assets/fig_transformer_arch.png",
                "caption": "Figure 1: Full Transformer encoder-decoder architecture with self-attention and cross-attention sub-layers."
              }
            ],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_tf_c2_multihead",
            "title": "Multi-Head Attention Mechanism",
            "column": 2,
            "order": 1,
            "pattern": "bullets-image",
            "content": "Linearly projects queries, keys, and values $h=8$ times into subspaces:\n\n$$\\text{MultiHead}(Q,K,V) = \\text{Concat}(\\text{head}_1, \\dots, \\text{head}_h)W^O$$\n\nwhere $\\text{head}_i = \\text{Attention}(QW_i^Q, KW_i^K, VW_i^V)$. Allows the model to attend to syntactic, positional, and coreference information simultaneously.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_attention_heads",
                "url": "/api/workspaces/attention-is-all-you-need/assets/fig_attention_heads.png",
                "caption": "Figure 2: Attention heads attend to both semantic coreferences and syntactic structures."
              }
            ],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_tf_c2_ffn",
            "title": "Pointwise Feed-Forward Networks",
            "column": 2,
            "order": 2,
            "pattern": "bullets",
            "content": "- **Two Linear Transformations:** Applied to each position separately:\n$$\\text{FFN}(x) = \\max(0, xW_1 + b_1)W_2 + b_2$$\n- **Inner Dimensionality:** Hidden dimension $d_{ff} = 2048$, with ReLU activation function.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_tf_c3_results",
            "title": "Machine Translation SOTA & Efficiency",
            "column": 3,
            "order": 0,
            "pattern": "bullets-image",
            "content": "**WMT 2014 Translation Benchmarks:**\n- **WMT 2014 English-to-German:** 28.4 BLEU, improving by +2.0 BLEU over previous state-of-the-art.\n- **WMT 2014 English-to-French:** 41.0 BLEU, establishing a new record.\n- **Training Compute:** Trained in 3.5 days on 8 P100 GPUs, a fraction of previous RNN costs.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_bleu_comparison",
                "url": "/api/workspaces/attention-is-all-you-need/assets/fig_bleu_comparison.png",
                "caption": "Figure 3: Translation quality (BLEU) vs training FLOPs compared to previous architectures."
              }
            ],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_tf_c3_table",
            "title": "Layer Computational Complexity",
            "column": 3,
            "order": 1,
            "pattern": "bullets-table",
            "content": "Comparison of layer types for sequence length $n$ and dimension $d$:",
            "figureLayout": "single",
            "table": {
              "hasHeader": true,
              "caption": "Table 1: Maximum path length and per-layer complexity",
              "rows": [
                [
                  "Layer Type",
                  "Complexity",
                  "Seq. Ops",
                  "Max Path"
                ],
                [
                  "Self-Attention",
                  "$O(n^2 \\cdot d)$",
                  "$O(1)$",
                  "$O(1)$"
                ],
                [
                  "Recurrent",
                  "$O(n \\cdot d^2)$",
                  "$O(n)$",
                  "$O(n)$"
                ],
                [
                  "Convolutional",
                  "$O(k \\cdot n \\cdot d^2)$",
                  "$O(1)$",
                  "$O(\\log_k(n))$"
                ]
              ]
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_tf_c3_training",
            "title": "Training Details & Regularization",
            "column": 3,
            "order": 2,
            "pattern": "bullets",
            "content": "- **Adam Optimizer:** $\\beta_1=0.9, \\beta_2=0.98, \\epsilon=10^{-9}$ with linear warmup for 4000 steps.\n- **Residual Dropout:** $P_{\\text{drop}}=0.1$ applied to sub-layer outputs before normalization.\n- **Label Smoothing:** $\\epsilon_{ls}=0.1$, trading perplexity for higher BLEU.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_tf_c3_conclusion",
            "title": "Impact on Artificial Intelligence",
            "column": 3,
            "order": 3,
            "pattern": "bullets",
            "content": "- **Foundation of Modern LLMs:** Direct ancestor of GPT-4, Claude, Gemini, LLaMA, and Vision Transformers.\n- **Scaling Law Hypothesis:** Constant path length enables massive parameter scaling with predictable empirical gains.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          }
        ]
      }
    ],
    "assets": [
      {
        "id": "ast_tf_arch",
        "fileId": "fig_transformer_arch.png",
        "filename": "fig_transformer_arch.png",
        "url": "/api/workspaces/attention-is-all-you-need/assets/fig_transformer_arch.png",
        "kind": "figure",
        "page": 1,
        "confidence": "high",
        "caption": "Transformer Architecture"
      },
      {
        "id": "ast_tf_attn",
        "fileId": "fig_attention_heads.png",
        "filename": "fig_attention_heads.png",
        "url": "/api/workspaces/attention-is-all-you-need/assets/fig_attention_heads.png",
        "kind": "figure",
        "page": 1,
        "confidence": "high",
        "caption": "Multi-Head Attention Weights"
      },
      {
        "id": "ast_tf_bleu",
        "fileId": "fig_bleu_comparison.png",
        "filename": "fig_bleu_comparison.png",
        "url": "/api/workspaces/attention-is-all-you-need/assets/fig_bleu_comparison.png",
        "kind": "figure",
        "page": 1,
        "confidence": "high",
        "caption": "BLEU vs Training FLOPs"
      }
    ],
    "ingestFiles": []
  },
  {
    "id": "resnet-deep-residual-learning",
    "name": "Deep Residual Learning (ResNet)",
    "posterTitle": "Deep Residual Learning for Image Recognition",
    "authors": "Kaiming He, Xiangyu Zhang, Shaoqing Ren, Jian Sun",
    "venue": "IEEE Conference on Computer Vision and Pattern Recognition (CVPR 2016), Las Vegas, NV, USA",
    "templateName": "minimal",
    "activeOutputId": "out_resnet_poster",
    "outputs": [
      {
        "id": "out_resnet_poster",
        "outputType": "poster",
        "templateId": "minimal",
        "title": "Deep Residual Learning for Image Recognition",
        "themeColor": "#0D9488",
        "cards": [
          {
            "id": "card_res_c1_abstract",
            "title": "The Degradation Problem",
            "column": 1,
            "order": 0,
            "pattern": "bullets",
            "content": "Deeper neural networks are notoriously difficult to train.\n\n- **Degradation Phenomenon:** As network depth increases, accuracy saturates and degrades rapidly. This is *not* caused by overfitting: deeper networks exhibit higher *training error* than shallower counterparts.\n- **Optimization Impediment:** Solvers struggle to learn identity mappings across dozens of stacked non-linear layers due to gradient vanishing/exploding dynamics.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_res_c1_stats",
            "title": "ILSVRC 2015 Championship",
            "column": 1,
            "order": 1,
            "pattern": "stats",
            "content": "- **3.57%** Top-5 Error Rate | 1st Place ILSVRC 2015 Classification\n- **152 Layers** Deepest Network | 8x deeper than VGG while maintaining lower complexity\n- **5 Major Tasks** Won 1st Place | ImageNet classification, detection, localization, COCO\n- **0 Extra Params** Identity Shortcuts | Direct parameter-free residual flow",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_res_c1_identity",
            "title": "Identity Mapping Mathematical Analysis",
            "column": 1,
            "order": 2,
            "pattern": "bullets",
            "content": "- **Reformulation:** If multiple nonlinear layers approximate $\\mathcal{H}(x)$, they can asymptotically approximate the residual function $\\mathcal{F}(x) = \\mathcal{H}(x) - x$.\n- **Ease of Identity:** Pushing residual weights $\\mathcal{F}(x) \\to 0$ toward zero is significantly easier for stochastic gradient solvers than fitting an identity mapping from scratch through non-linearities.\n- **Uninhibited Gradients:** Additive identity shortcuts allow gradients to flow directly from deep layers back to early layers.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_res_c1_opt",
            "title": "Training & Batch Normalization",
            "column": 1,
            "order": 3,
            "pattern": "bullets",
            "content": "- **Batch Normalization (BN):** Applied immediately after each convolution ($3\\times 3$ and $1\\times 1$) and before activation, ensuring unit variance and stabilizing gradient flow across 152 stacked layers.\n- **Weight Initialization:** He normal initialization prevents signal attenuation and exploding gradients from onset.\n- **Optimization Protocol:** Trained with SGD (momentum 0.9, weight decay $10^{-4}$) and mini-batch size 256 on 8 GPUs.\n- **Learning Rate Dynamics:** Initial learning rate $\\eta=0.1$, decayed by a factor of 10 upon plateauing error curves.\n- **Data Augmentation:** Scale jittering with 224x224 crops and horizontal flipping prevents structural overfitting.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_res_c2_residual",
            "title": "Residual Learning Framework",
            "column": 2,
            "order": 0,
            "pattern": "bullets-image",
            "content": "**Formulation:** Instead of hoping stacked layers fit an underlying mapping $\\mathcal{H}(x)$, we explicitly let these layers fit a residual mapping:\n\n$$\\mathcal{F}(x) := \\mathcal{H}(x) - x \\implies \\mathcal{H}(x) = \\mathcal{F}(x) + x$$\n\n- **Shortcut Connections:** Feedforward networks with identity shortcuts performing element-wise addition.\n- **Zero Parameter Overhead:** Identity shortcuts introduce neither extra parameters nor computational complexity.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_residual_block",
                "url": "/api/workspaces/resnet-deep-residual-learning/assets/fig_residual_block.png",
                "caption": "Figure 1: Residual building block with identity skip connection: y = F(x, {Wi}) + x."
              }
            ],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_res_c2_convergence",
            "title": "Convergence Behavior & Error Curves",
            "column": 2,
            "order": 1,
            "pattern": "bullets-image",
            "content": "**Overcoming Degradation:**\n- **Plain Nets (Left):** 34-layer plain network suffers higher training and validation error than 18-layer network.\n- **ResNets (Right):** 34-layer ResNet achieves substantially lower training error and generalizes better, completely resolving the degradation curse.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_convergence_curves",
                "url": "/api/workspaces/resnet-deep-residual-learning/assets/fig_convergence_curves.png",
                "caption": "Figure 2: Training and validation error on ImageNet. Plain nets (dashed) degrade; ResNets improve monotonically."
              }
            ],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_res_c2_bottleneck",
            "title": "Deeper Bottleneck Architectures",
            "column": 2,
            "order": 2,
            "pattern": "bullets",
            "content": "- **3-Layer Stack:** Uses $1\\times 1$, $3\\times 3$, and $1\\times 1$ convolutions for ResNet-50/101/152.\n- **Dimension Reduction:** $1\\times 1$ layers reduce and then restore dimensions, leaving the $3\\times 3$ layer with smaller input/output channels.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_res_c3_imagenet",
            "title": "ImageNet Benchmark Comparisons",
            "column": 3,
            "order": 0,
            "pattern": "bullets-image",
            "content": "**Comparison with Milestone Architectures:**\n- **ResNet-152:** Achieves 4.49% top-5 error on ImageNet val set (single model).\n- **Ensemble Result:** 3.57% top-5 error on test set, winning 1st place in ILSVRC 2015 by a massive margin.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_imagenet_comparison",
                "url": "/api/workspaces/resnet-deep-residual-learning/assets/fig_imagenet_comparison.png",
                "caption": "Figure 3: ImageNet Top-5 classification error rate comparison across milestone architectures (2012-2015)."
              }
            ],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_res_c3_table",
            "title": "ResNet Architecture Depth & Error",
            "column": 3,
            "order": 1,
            "pattern": "bullets-table",
            "content": "Top-1 and Top-5 error rates on ImageNet validation set (single model):",
            "figureLayout": "single",
            "table": {
              "hasHeader": true,
              "caption": "Table 1: Error comparison across ResNet depths",
              "rows": [
                [
                  "Architecture",
                  "FLOPs",
                  "Top-1 Error (%)",
                  "Top-5 Error (%)"
                ],
                [
                  "VGG-16 (baseline)",
                  "15.3 × 10⁹",
                  "28.07",
                  "9.33"
                ],
                [
                  "ResNet-18",
                  "1.8 × 10⁹",
                  "30.24",
                  "10.76"
                ],
                [
                  "ResNet-34",
                  "3.6 × 10⁹",
                  "26.73",
                  "8.74"
                ],
                [
                  "ResNet-50",
                  "3.8 × 10⁹",
                  "24.76",
                  "7.60"
                ],
                [
                  "ResNet-101",
                  "7.6 × 10⁹",
                  "23.63",
                  "6.97"
                ],
                [
                  "ResNet-152",
                  "11.3 × 10⁹",
                  "23.01",
                  "6.62"
                ]
              ]
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_res_c3_coco",
            "title": "COCO Object Detection Generalization",
            "column": 3,
            "order": 2,
            "pattern": "bullets",
            "content": "- **Faster R-CNN Integration:** Replacing VGG-16 with ResNet-101 improves COCO mAP by +6.0% (28% relative gain).\n- **Feature Universality:** Proves representations generalize beyond classification to fine-grained localization.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_res_c3_conclusion",
            "title": "Legacy & Lasting Impact",
            "column": 3,
            "order": 3,
            "pattern": "bullets",
            "content": "- **Residual Paradigm:** Residual shortcuts are now universally used in Transformers, ConvNeXts, and Diffusion models.\n- **Extreme Depth:** Demonstrated that networks can scale to 100+ layers without optimization degradation.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          }
        ]
      }
    ],
    "assets": [
      {
        "id": "ast_res_block",
        "fileId": "fig_residual_block.png",
        "filename": "fig_residual_block.png",
        "url": "/api/workspaces/resnet-deep-residual-learning/assets/fig_residual_block.png",
        "kind": "figure",
        "page": 1,
        "confidence": "high",
        "caption": "Residual Block Diagram"
      },
      {
        "id": "ast_res_curves",
        "fileId": "fig_convergence_curves.png",
        "filename": "fig_convergence_curves.png",
        "url": "/api/workspaces/resnet-deep-residual-learning/assets/fig_convergence_curves.png",
        "kind": "figure",
        "page": 1,
        "confidence": "high",
        "caption": "ImageNet Convergence Curves"
      },
      {
        "id": "ast_res_imagenet",
        "fileId": "fig_imagenet_comparison.png",
        "filename": "fig_imagenet_comparison.png",
        "url": "/api/workspaces/resnet-deep-residual-learning/assets/fig_imagenet_comparison.png",
        "kind": "figure",
        "page": 1,
        "confidence": "high",
        "caption": "ILSVRC Error Comparison"
      }
    ],
    "ingestFiles": []
  },
  {
    "id": "bert-pre-training",
    "name": "BERT: Deep Bidirectional Transformers",
    "posterTitle": "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding",
    "authors": "Jacob Devlin, Ming-Wei Chang, Kenton Lee, Kristina Toutanova",
    "venue": "NAACL-HLT 2019, Minneapolis, MN, USA",
    "templateName": "conference",
    "activeOutputId": "out_bert_poster",
    "outputs": [
      {
        "id": "out_bert_poster",
        "outputType": "poster",
        "templateId": "conference",
        "title": "BERT: Pre-training of Deep Bidirectional Transformers",
        "themeColor": "#D97706",
        "cards": [
          {
            "id": "card_bert_c1_abstract",
            "title": "Unidirectional Limitations in NLP",
            "column": 1,
            "order": 0,
            "pattern": "bullets",
            "content": "Standard language models (such as OpenAI GPT) were strictly unidirectional, constrained to left-to-right attention.\n\n- **Suboptimal for Token-Level Tasks:** Question answering and Named Entity Recognition require incorporating context from *both* directions simultaneously.\n- **BERT Solution:** Pre-trains deep bidirectional representations from unlabelled text by jointly conditioning on left and right context across all attention layers.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_bert_c1_stats",
            "title": "GLUE & SQuAD Breakthroughs",
            "column": 1,
            "order": 1,
            "pattern": "stats",
            "content": "- **80.5%** GLUE Benchmark Score | +7.7% absolute gain over prior state-of-the-art\n- **93.2** SQuAD 1.1 F1 Score | Surpasses human performance (91.2 F1)\n- **340M** Parameters (Large) | 24 layers, 1024 hidden size, 16 attention heads\n- **11 NLP Tasks** New SOTA | Universal fine-tuning with zero task-specific architectures",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_bert_c1_embeddings",
            "title": "Input Representation: Token + Segment + Position",
            "column": 1,
            "order": 2,
            "pattern": "bullets",
            "content": "- **WordPiece Tokenization:** 30,000 token vocabulary handling out-of-vocabulary words via subwords.\n- **Segment Embeddings:** Distinguishes sentence pair inputs $(A, B)$ separated by $[\\text{SEP}]$ boundary markers.\n- **Position Embeddings:** Learned position encodings supporting sequences up to 512 input tokens.\n- **Summed Embeddings:** Input representation is the element-wise sum of token, segment, and positional embeddings.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_bert_c2_objectives",
            "title": "Pre-training Objectives: MLM & NSP",
            "column": 2,
            "order": 0,
            "pattern": "bullets-image",
            "content": "**Novel Self-Supervised Pre-training Tasks:**\n- **Masked Language Model (MLM):** Masks 15% of input tokens at random (80% [MASK], 10% random token, 10% unchanged). Prevents words from attending to themselves in deep bidirectional layers.\n- **Next Sentence Prediction (NSP):** Binary classification predicting whether Sentence B logically follows Sentence A.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_bert_arch",
                "url": "/api/workspaces/bert-pre-training/assets/fig_bert_arch.png",
                "caption": "Figure 1: BERT bidirectional pre-training with MLM & NSP vs OpenAI GPT (left-to-right) and ELMo."
              }
            ],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_bert_c2_finetuning",
            "title": "Universal Task-Specific Fine-Tuning",
            "column": 2,
            "order": 1,
            "pattern": "bullets",
            "content": "- **Single-Sentence Classification:** Feeds final $[\\text{CLS}]$ hidden vector $C \\in \\mathbb{R}^H$ into a classification layer with weights $W \\in \\mathbb{R}^{K \\times H}$ to compute cross-entropy loss $\\log(\\text{softmax}(CW^\\top))$.\n- **Question Answering (SQuAD):** Introduces start vector $S$ and end vector $E$; probability of word $i$ being start of answer span is $P_i = \\frac{e^{S \\cdot T_i}}{\\sum_j e^{S \\cdot T_j}}$.\n- **Named Entity Recognition (NER):** Final hidden representations $T_i$ for each token are fed directly into a linear classification layer over NER label set without CRF.\n- **Minimal Fine-Tuning Overhead:** All model parameters are fine-tuned jointly end-to-end within 2-4 epochs on a single Cloud TPU (minutes to hours).",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_bert_c2_ablation",
            "title": "Pre-training Ablation Studies",
            "column": 2,
            "order": 2,
            "pattern": "bullets",
            "content": "- **No Next Sentence Prediction (No NSP):** Removing NSP severely impairs performance on Natural Language Inference (MNLI -1.5%, QNLI -1.8%) and sentence pair tasks.\n- **Left-to-Right Unidirectional Constraint:** Restricting attention to left context drops SQuAD F1 score precipitously from 88.5 to 78.4 (-10.1 points absolute).\n- **Model Size Scaling:** Scaling from BERT-Base ($L=12, H=768$) to BERT-Large ($L=24, H=1024$) leads to substantial empirical gains even on tiny downstream datasets.\n- **Masking Strategy Sensitivity:** The 80-10-10 masking ratio prevents mismatched representations between pre-training and downstream inference.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_bert_c3_glue",
            "title": "GLUE Benchmark Performance",
            "column": 3,
            "order": 0,
            "pattern": "bullets-image",
            "content": "**Dominance Across Diverse NLU Benchmarks:**\n- Outperforms all prior models across all 9 GLUE benchmark tasks.\n- Large gains on Multi-Genre NLI (MNLI matched 86.7%), Question NLI (QNLI 92.7%), and MRPC (88.9% F1).\n- Achieves +7.7% absolute average improvement over OpenAI GPT and ELMo baselines.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_glue_benchmark",
                "url": "/api/workspaces/bert-pre-training/assets/fig_glue_benchmark.png",
                "caption": "Figure 2: Performance comparison on the General Language Understanding Evaluation (GLUE) benchmark."
              }
            ],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_bert_c3_squad",
            "title": "SQuAD Benchmark Results",
            "column": 3,
            "order": 1,
            "pattern": "bullets-table",
            "content": "Evaluation on Stanford Question Answering Dataset (SQuAD v1.1):",
            "figureLayout": "single",
            "table": {
              "hasHeader": true,
              "caption": "Table 1: SQuAD 1.1 test set results",
              "rows": [
                [
                  "Model / Architecture",
                  "Parameters",
                  "Exact Match (%)",
                  "F1 Score (%)"
                ],
                [
                  "Human Performance (benchmark)",
                  "-",
                  "82.3",
                  "91.2"
                ],
                [
                  "BiDAF + Self-Attention",
                  "5M",
                  "77.8",
                  "84.1"
                ],
                [
                  "QANet",
                  "12M",
                  "76.2",
                  "84.6"
                ],
                [
                  "BERT-Base",
                  "110M",
                  "80.8",
                  "88.5"
                ],
                [
                  "BERT-Large (single model)",
                  "340M",
                  "84.1",
                  "90.9"
                ],
                [
                  "BERT-Large (ensemble)",
                  "340M × 7",
                  "87.4",
                  "93.2"
                ]
              ]
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_bert_c3_conclusion",
            "title": "Significance for Modern NLP",
            "column": 3,
            "order": 2,
            "pattern": "bullets",
            "content": "- **The Pre-train & Fine-tune Era:** Replaced specialized task engineering with general pre-trained bidirectional representations.\n- **Bidirectional Context:** Demonstrated that joint left-and-right conditioning is essential for deep language comprehension.\n- **Foundation for Modern NLP:** Established the dominant encoder architecture for search ranking, dense retrieval, and intent classification.\n- **Model Scale Validation:** Validated that larger models yield substantial improvements on small downstream tasks without overfitting.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_bert_c1_corpus",
            "title": "Pre-training Corpus & Vocabulary",
            "column": 1,
            "order": 3,
            "pattern": "bullets",
            "content": "- **BooksCorpus & Wikipedia:** Pre-trained on BooksCorpus (800M words) and English Wikipedia (2,500M words) with document-level text extraction to capture long-distance coherence.\n- **WordPiece Vocabulary:** 30,000 token cased and uncased vocabulary derived via iterative character merge optimization.\n- **Sequence Length Scheduling:** Trained on sequence length 128 for 90% of steps, followed by length 512 for remaining 10% to train positional embeddings.\n- **Zero Cross-Entropy Leakage:** Masking ensures bidirectional context does not trivially leak ground-truth tokens.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          }
        ]
      }
    ],
    "assets": [
      {
        "id": "ast_bert_arch",
        "fileId": "fig_bert_arch.png",
        "filename": "fig_bert_arch.png",
        "url": "/api/workspaces/bert-pre-training/assets/fig_bert_arch.png",
        "kind": "figure",
        "page": 1,
        "confidence": "high",
        "caption": "BERT Architecture"
      },
      {
        "id": "ast_bert_glue",
        "fileId": "fig_glue_benchmark.png",
        "filename": "fig_glue_benchmark.png",
        "url": "/api/workspaces/bert-pre-training/assets/fig_glue_benchmark.png",
        "kind": "figure",
        "page": 1,
        "confidence": "high",
        "caption": "GLUE Benchmark Comparison"
      }
    ],
    "ingestFiles": []
  },
  {
    "id": "gans-goodfellow-2014",
    "name": "Generative Adversarial Nets (GANs)",
    "posterTitle": "Generative Adversarial Nets",
    "authors": "Ian J. Goodfellow, Jean Pouget-Abadie, Mehdi Mirza, Bing Xu, David Warde-Farley, Sherjil Ozair, Aaron Courville, Yoshua Bengio",
    "venue": "28th Conference on Neural Information Processing Systems (NeurIPS 2014), Montreal, QC, Canada",
    "templateName": "gemini",
    "activeOutputId": "out_gans_poster",
    "outputs": [
      {
        "id": "out_gans_poster",
        "outputType": "poster",
        "templateId": "gemini",
        "title": "Generative Adversarial Nets",
        "themeColor": "#DC2626",
        "cards": [
          {
            "id": "card_gan_c1_abstract",
            "title": "The Generative Modeling Dilemma",
            "column": 1,
            "order": 0,
            "pattern": "bullets",
            "content": "Prior generative approaches (Markov Random Fields, Deep Boltzmann Machines, VAEs) required intractable probabilistic computations or approximate inference.\n\n- **The Game-Theoretic Paradigm:** Pits two neural networks against each other in a two-player zero-sum minimax game.\n- **Generator $G$:** Captures the data distribution without explicitly evaluating probability likelihoods.\n- **Discriminator $D$:** Estimates the probability that a sample originated from the true training distribution rather than $G$.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_gan_c1_game",
            "title": "Adversarial Zero-Sum Framework",
            "column": 1,
            "order": 1,
            "pattern": "bullets",
            "content": "- **The Counterfeiter & Police Analogy:** $G$ acts as counterfeiters producing fake currency; $D$ acts as police detecting fakes.\n- **Competition Breeds Quality:** Competition drives both models to improve until counterfeit currency is indistinguishable from genuine currency.\n- **Direct Backpropagation:** Both models are trained simultaneously with conventional backpropagation and dropout.\n- **No Approximate Inference:** Bypasses Markov chain sampling and variational bounds entirely.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_gan_c1_stats",
            "title": "Key Theoretical Milestones",
            "column": 1,
            "order": 2,
            "pattern": "stats",
            "content": "- **0 Markov Chains** Required | Direct feedforward backpropagation sampling\n- **JS Divergence** Minimized | Equals Jensen-Shannon divergence at equilibrium\n- **D*(x) = 0.5** Equilibrium | Discriminator cannot distinguish real from fake\n- **10,000+** Derived Models | CycleGAN, StyleGAN, Pix2Pix, BigGAN revolution",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_gan_c1_algorithm",
            "title": "Minibatch Stochastic Gradient Descent",
            "column": 1,
            "order": 3,
            "pattern": "bullets",
            "content": "- **Step 1:** Sample $m$ noise vectors $\\{z^{(1)}, \\dots, z^{(m)}\\}$ from prior $p_z(z)$ and $m$ data samples $\\{x^{(1)}, \\dots, x^{(m)}\\}$ from $p_{\\text{data}}(x)$.\n- **Step 2:** Update discriminator $D$ by ascending its stochastic gradient on $\\frac{1}{m}\\sum_{i=1}^m [\\log D(x^{(i)}) + \\log(1 - D(G(z^{(i)})))]$.\n- **Step 3:** Update generator $G$ by descending its stochastic gradient on $\\frac{1}{m}\\sum_{i=1}^m \\log(1 - D(G(z^{(i)})))$.\n- **Alternating Schedule:** Runs $k=1$ discriminator step per generator update step to balance training rates.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_gan_c2_minimax",
            "title": "Two-Player Minimax Objective",
            "column": 2,
            "order": 0,
            "pattern": "bullets-image",
            "content": "**Value Function $V(G, D)$:**\n\n$$\\min_G \\max_D V(D, G) = \\mathbb{E}_{x \\sim p_{\\text{data}}} [\\log D(x)] + \\mathbb{E}_{z \\sim p_z} [\\log(1 - D(G(z)))]$$\n\n- **Optimal Discriminator:** For any fixed $G$, optimal discriminator is $D^*(x) = \\frac{p_{\\text{data}}(x)}{p_{\\text{data}}(x) + p_g(x)}$.\n- **Global Optimum:** The minimax game achieves its unique global optimum if and only if $p_g = p_{\\text{data}}$, where $V(G, D^*) = -\\log(4)$.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_gan_framework",
                "url": "/api/workspaces/gans-goodfellow-2014/assets/fig_gan_framework.png",
                "caption": "Figure 1: GAN framework showing generator G, discriminator D, and adversarial gradient flow."
              }
            ],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_gan_c2_samples",
            "title": "Generated Samples & Latent Space",
            "column": 2,
            "order": 1,
            "pattern": "bullets-image",
            "content": "- **Sharp Visual Generations:** Eliminates the blurry averaging artifacts characteristic of mean-squared-error reconstruction losses.\n- **Continuous Latent Representation:** Interpolating vectors in noise space $z$ yields smooth semantic transitions between generated digits and faces.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_gan_samples",
                "url": "/api/workspaces/gans-goodfellow-2014/assets/fig_gan_samples.png",
                "caption": "Figure 2: Synthetic generation grid sampled unconditionally from uniform noise."
              }
            ],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_gan_c2_jsdiv",
            "title": "Jensen-Shannon Divergence Equivalence",
            "column": 2,
            "order": 2,
            "pattern": "bullets",
            "content": "When $D = D^*(x)$, the minimax objective reformulates directly as:\n\n$$C(G) = -\\log(4) + 2 \\cdot D_{\\text{JS}}(p_{\\text{data}} \\parallel p_g)$$\n\nSince $D_{\\text{JS}} \\ge 0$, the global minimum is achieved precisely when distributions match.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_gan_c3_comparison",
            "title": "Generative Paradigms Comparison",
            "column": 3,
            "order": 0,
            "pattern": "bullets-table",
            "content": "Architectural comparison across generative deep learning paradigms:",
            "figureLayout": "single",
            "table": {
              "hasHeader": true,
              "caption": "Table 1: Generative model trade-offs and sampling characteristics",
              "rows": [
                [
                  "Paradigm",
                  "Likelihood",
                  "Sampling Speed",
                  "Sharpness"
                ],
                [
                  "GAN (Goodfellow 2014)",
                  "Implicit",
                  "Fast (single pass)",
                  "High (sharp)"
                ],
                [
                  "VAE (Kingma 2013)",
                  "Variational Lower Bound",
                  "Fast (single pass)",
                  "Low (blurry)"
                ],
                [
                  "PixelCNN (van den Oord)",
                  "Exact Likelihood",
                  "Very Slow (O(N))",
                  "High"
                ],
                [
                  "Boltzmann Machines",
                  "Intractable MCMC",
                  "Very Slow (Gibbs)",
                  "Moderate"
                ]
              ]
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_gan_c3_challenges",
            "title": "Training Dynamics & Mode Collapse",
            "column": 3,
            "order": 1,
            "pattern": "bullets",
            "content": "- **Vanishing Gradient:** Early in training when $D$ easily rejects samples, $\\log(1 - D(G(z)))$ saturates. Mitigated by training $G$ to maximize $\\log D(G(z))$.\n- **Mode Collapse:** $G$ maps multiple diverse noise vectors $z$ to identical high-scoring output modes, reducing sample diversity.\n- **Training Dynamics:** Simultaneous gradient descent without consensus optimization can cause non-convergent oscillatory limit cycles.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_gan_c3_conclusion",
            "title": "Conclusions & Generative AI Catalyst",
            "column": 3,
            "order": 2,
            "pattern": "bullets",
            "content": "- **Adversarial Optimization:** Established game-theoretic optimization as a core pillar of machine learning.\n- **Foundation for Generative AI:** Catalyzed the entire visual AI revolution, directly inspiring modern diffusion guidance and neural rendering.\n- **Broad Impact:** Essential for domain adaptation, super-resolution, and synthetic scientific data generation.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_gan_c3_theoretical",
            "title": "Theoretical Convergence & Nash Equilibrium",
            "column": 3,
            "order": 2,
            "pattern": "bullets",
            "content": "- **Non-Parametric Limit:** When $G$ and $D$ are given infinite capacity, the minimax game converges to the true data distribution $p_g = p_{\\text{data}}$ in function space.\n- **Convexity in Probability Density:** The value function $V(G, D)$ is convex in $p_g$, guaranteeing that subgradient ascent finds the unique global optimum.\n- **Simultaneous Gradient Descent:** In finite parametric space, alternating gradient updates approximate a saddle-point search (Nash equilibrium).\n- **Heuristic Generator Loss:** Maximizing $\\log D(G(z))$ instead of minimizing $\\log(1 - D(G(z)))$ provides large gradients early in learning when $D$ easily rejects samples.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          }
        ]
      }
    ],
    "assets": [
      {
        "id": "ast_gan_framework",
        "fileId": "fig_gan_framework.png",
        "filename": "fig_gan_framework.png",
        "url": "/api/workspaces/gans-goodfellow-2014/assets/fig_gan_framework.png",
        "kind": "figure",
        "page": 1,
        "confidence": "high",
        "caption": "GAN Framework Diagram"
      },
      {
        "id": "ast_gan_samples",
        "fileId": "fig_gan_samples.png",
        "filename": "fig_gan_samples.png",
        "url": "/api/workspaces/gans-goodfellow-2014/assets/fig_gan_samples.png",
        "kind": "figure",
        "page": 1,
        "confidence": "high",
        "caption": "Generated Sample Grid"
      }
    ],
    "ingestFiles": []
  }
,
{
    "id": "vla-autonomous-surgery",
    "name": "SurgiVLA: Autonomous Microsurgery",
    "posterTitle": "SurgiVLA: Safety-Constrained Vision-Language-Action Microsurgery",
    "authors": "Maya Chen, Elias Novak, Priya Raman, Luca Moretti",
    "venue": "CVPR 2027 • Embodied AI for Medicine",
    "templateName": "betterposter",
    "activeOutputId": "out_vla_poster",
    "outputs": [
      {
        "id": "out_vla_poster",
        "outputType": "poster",
        "templateId": "betterposter",
        "title": "SurgiVLA: Safety-Constrained Vision-Language-Action Microsurgery",
        "themeColor": "#00A6A6",
        "cards": [
          {
            "id": "card_vla_p1",
            "title": "Clinical Need & Safety Gaps",
            "pattern": "bullets",
            "content": "Sub-millimetre microsurgery demands sub-millimetre precision with guaranteed safety limits.\n\n- **Current Limitations:** Unconstrained imitation learning suffers from tail errors (>2 mm).\n- **Barrier Functions:** Real-time control-barrier certificates provide safety envelopes.\n- **Dataset:** 1,240 ex-vivo anastomosis and micro-cannulation procedures.",
            "column": 1,
            "order": 0,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": []
          },
          {
            "id": "card_vla_p2",
            "title": "Formal Objective",
            "pattern": "bullets",
            "content": "$$\\min_{\\pi} \\mathbb{E}[\\mathcal{L}_{\\text{task}}] \\quad \\text{s.t.} \\quad \\dot{h}(x, u) + \\alpha h(x) \\ge 0$$\n\nSafe set $\\mathcal{C}$ ensures tool tip cannot violate critical vascular boundaries under any predicted action trajectory.",
            "column": 1,
            "order": 1,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": []
          },
          {
            "id": "card_vla_p3",
            "title": "System Architecture",
            "pattern": "bullets-image",
            "content": "Stereo endoscopy and force telemetry feed the 7B VLA foundation model, predicting 42 Hz sub-millimetre actions.",
            "column": 2,
            "order": 0,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_vla_arch",
                "url": "/api/workspaces/vla-autonomous-surgery/assets/architecture.png",
                "caption": "SurgiVLA End-to-End Architecture"
              }
            ],
            "sourceIds": []
          },
          {
            "id": "card_vla_p4",
            "title": "Headline Metrics",
            "pattern": "stats",
            "content": "**98.7%** Success Rate | 1,240 trials\n**0.31 mm** Median Error | vs 0.71 mm OpenVLA\n**42 Hz** Control Loop | <24 ms latency",
            "column": 2,
            "order": 1,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": []
          },
          {
            "id": "card_vla_p5",
            "title": "Controlled Benchmark",
            "pattern": "bullets-table",
            "content": "SurgiVLA consistently outperforms current vision-language-action baselines.",
            "column": 3,
            "order": 0,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": true,
              "caption": "Comparative Benchmark",
              "rows": [
                [
                  "Method",
                  "Success",
                  "Error",
                  "Latency"
                ],
                [
                  "BC-Z",
                  "71.4%",
                  "1.42 mm",
                  "18 ms"
                ],
                [
                  "RT-2",
                  "79.8%",
                  "0.93 mm",
                  "96 ms"
                ],
                [
                  "OpenVLA",
                  "86.2%",
                  "0.71 mm",
                  "61 ms"
                ],
                [
                  "SurgiVLA",
                  "98.7%",
                  "0.31 mm",
                  "23.8 ms"
                ]
              ]
            },
            "figures": [],
            "sourceIds": []
          },
          {
            "id": "card_vla_p6",
            "title": "Benchmark & Failure Analysis",
            "pattern": "bullets-two-images",
            "content": "Benchmark results across 5 seeds; zero vascular penetrations observed.",
            "column": 3,
            "order": 1,
            "figureLayout": "two-up",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_vla_b1",
                "url": "/api/workspaces/vla-autonomous-surgery/assets/benchmark.png",
                "caption": "Success Rate Comparison"
              },
              {
                "id": "fig_vla_b2",
                "url": "/api/workspaces/vla-autonomous-surgery/assets/architecture.png",
                "caption": "Safety Shield Flow"
              }
            ],
            "sourceIds": []
          },
          {
            "id": "card_vla_p7",
            "title": "Take-home Message",
            "pattern": "metric-card",
            "content": "**+42%** Throughput | over human baselines\n**0** Safety Violations | across 1,240 trials",
            "column": 3,
            "order": 2,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": []
          },
          {
            "id": "card_vla_p8",
            "title": "References",
            "pattern": "references",
            "content": "\\cite{vaswani2017attention,brohan2023rt2,pfau2020abinitio,abudayyeh2017rna}",
            "column": 1,
            "order": 2,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": []
          }
        ]
      },
      {
        "id": "out_vla_slides",
        "outputType": "slides",
        "templateId": "beamer-metropolis",
        "title": "SurgiVLA: Evidence, Method, Impact",
        "themeColor": "#00A6A6",
        "cards": [
          {
            "id": "card_vla_slide_1",
            "title": "Introduction",
            "pattern": "title-slide",
            "content": "SurgiVLA: A Safety-Constrained Foundation Model for Robotic Microsurgery",
            "column": null,
            "order": 0,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": []
          }
        ]
      },
      {
        "id": "out_vla_paper",
        "outputType": "paper",
        "templateId": "cvpr",
        "title": "SurgiVLA: Autonomous Microsurgery",
        "themeColor": "#00A6A6",
        "cards": [
          {
            "id": "card_vla_paper_1",
            "title": "Abstract",
            "pattern": "section",
            "content": "SurgiVLA couples a multimodal policy to a control-barrier safety shield, achieving 98.7% success.",
            "column": null,
            "order": 0,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": []
          }
        ]
      },
      {
        "id": "out_vla_review",
        "outputType": "thesis-review",
        "templateId": "posudok-en",
        "title": "Opponent Assessment — SurgiVLA",
        "themeColor": "#003366",
        "cards": [
          {
            "id": "card_vla_review_1",
            "title": "Criterion 1: Novelty",
            "pattern": "section",
            "content": "Grade A. Outstanding formal safety treatment and extensive experimental evaluation.",
            "column": null,
            "order": 0,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": []
          }
        ]
      }
    ],
    "assets": [
      {
        "id": "ast_vla_arch",
        "fileId": "architecture.png",
        "filename": "architecture.png",
        "url": "/api/workspaces/vla-autonomous-surgery/assets/architecture.png",
        "kind": "figure",
        "page": 1,
        "confidence": "high",
        "caption": "Evidence-to-action architecture"
      },
      {
        "id": "ast_vla_bench",
        "fileId": "benchmark.png",
        "filename": "benchmark.png",
        "url": "/api/workspaces/vla-autonomous-surgery/assets/benchmark.png",
        "kind": "figure",
        "page": 1,
        "confidence": "high",
        "caption": "Controlled primary benchmark"
      }
    ],
    "ingestFiles": []
  },
  {
    "id": "neural-wavefunction-superconductors",
    "name": "Neural Quantum States for Hydride Superconductors",
    "posterTitle": "Equivariant Neural Wavefunctions for Hydride Superconductors",
    "authors": "Amara Okafor, Jonas Klein, Sofia Petrov",
    "venue": "APS March Meeting 2027 • Quantum Matter",
    "templateName": "atlas",
    "activeOutputId": "out_nqs_poster",
    "outputs": [
      {
        "id": "out_nqs_poster",
        "outputType": "poster",
        "templateId": "atlas",
        "title": "Equivariant Neural Wavefunctions for Hydride Superconductors",
        "themeColor": "#6D5DFB",
        "cards": [
          {
            "id": "card_nqs_p1",
            "title": "Superconductivity at Megabar Pressure",
            "pattern": "bullets",
            "content": "Metastable LaH10-xNx exhibits room-temperature superconductivity under extreme compression.\n\n- **Anharmonic Effects:** Strong phonon coupling defies standard harmonic approximations.\n- **Neural Quantum State:** E(3)-equivariant wavefunctions parameterize correlated ground states.\n- **Variational Accuracy:** 2.4 meV energy error over 65,536 walkers.",
            "column": 1,
            "order": 0,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": []
          },
          {
            "id": "card_nqs_p2",
            "title": "Equivariant Formulation",
            "pattern": "bullets",
            "content": "$$\\Psi_\\theta(R) = \\det[\\phi_i(r_j)] \\exp[J_\\theta(R)]$$\n\nOrbital and Jastrow components respect permutation and rotational symmetry groups.",
            "column": 1,
            "order": 1,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": []
          },
          {
            "id": "card_nqs_p3",
            "title": "VMC Sampler Architecture",
            "pattern": "bullets-image",
            "content": "Crystal graph neural network drives stochastic reconfiguration optimization.",
            "column": 2,
            "order": 0,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_nqs_arch",
                "url": "/api/workspaces/neural-wavefunction-superconductors/assets/architecture.png",
                "caption": "Equivariant NQS Architecture"
              }
            ],
            "sourceIds": []
          },
          {
            "id": "card_nqs_p4",
            "title": "Critical Transition",
            "pattern": "stats",
            "content": "**287 K** Predicted $T_c$ | Room-temperature regime\n**2.4 meV** Energy Error | 5x improvement\n**8.1x** Sampling Speed | VMC scaling",
            "column": 2,
            "order": 1,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": []
          },
          {
            "id": "card_nqs_p5",
            "title": "Hydride Comparison Table",
            "pattern": "bullets-table",
            "content": "Comparison against standard DFT and quantum Monte Carlo.",
            "column": 3,
            "order": 0,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": true,
              "caption": "Transition Temperature Comparison",
              "rows": [
                [
                  "Method",
                  "Tc (K)",
                  "Energy Err",
                  "Speed"
                ],
                [
                  "DFT-PBE",
                  "214",
                  "18.7 meV",
                  "1.0x"
                ],
                [
                  "SCDFT",
                  "242",
                  "11.3 meV",
                  "0.4x"
                ],
                [
                  "FermiNet",
                  "268",
                  "4.8 meV",
                  "1.7x"
                ],
                [
                  "Eq-NQS",
                  "287",
                  "2.4 meV",
                  "8.1x"
                ]
              ]
            },
            "figures": [],
            "sourceIds": []
          },
          {
            "id": "card_nqs_p6",
            "title": "Phase Diagram & Pairing Map",
            "pattern": "bullets-two-images",
            "content": "Pairing symmetry and gap function mapped across pressure gradients.",
            "column": 3,
            "order": 1,
            "figureLayout": "two-up",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_nqs_b1",
                "url": "/api/workspaces/neural-wavefunction-superconductors/assets/benchmark.png",
                "caption": "Predicted Tc vs Pressure"
              },
              {
                "id": "fig_nqs_b2",
                "url": "/api/workspaces/neural-wavefunction-superconductors/assets/architecture.png",
                "caption": "Pairing Mechanism"
              }
            ],
            "sourceIds": []
          },
          {
            "id": "card_nqs_p7",
            "title": "Take-home",
            "pattern": "metric-card",
            "content": "**287 K** $T_c$ at 182 GPa\n**Stable** Hydride Phase",
            "column": 3,
            "order": 2,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": []
          },
          {
            "id": "card_nqs_p8",
            "title": "References",
            "pattern": "references",
            "content": "\\cite{pfau2020abinitio,brohan2023rt2,vaswani2017attention}",
            "column": 1,
            "order": 2,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": []
          }
        ]
      },
      {
        "id": "out_nqs_slides",
        "outputType": "slides",
        "templateId": "beamer-metropolis",
        "title": "Neural Quantum States: Hydride Superconductors",
        "themeColor": "#6D5DFB",
        "cards": [
          {
            "id": "card_nqs_slide_1",
            "title": "Overview",
            "pattern": "title-slide",
            "content": "Equivariant Neural Wavefunctions for Hydride Superconductors",
            "column": null,
            "order": 0,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": []
          }
        ]
      },
      {
        "id": "out_nqs_paper",
        "outputType": "paper",
        "templateId": "revtex-aps",
        "title": "Equivariant Neural Wavefunctions for Hydride Superconductors",
        "themeColor": "#6D5DFB",
        "cards": [
          {
            "id": "card_nqs_paper_1",
            "title": "Abstract",
            "pattern": "section",
            "content": "An E(3)-equivariant neural quantum state resolves anharmonic electron-phonon coupling.",
            "column": null,
            "order": 0,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": []
          }
        ]
      }
    ],
    "assets": [
      {
        "id": "ast_nqs_arch",
        "fileId": "architecture.png",
        "filename": "architecture.png",
        "url": "/api/workspaces/neural-wavefunction-superconductors/assets/architecture.png",
        "kind": "figure",
        "page": 1,
        "confidence": "high",
        "caption": "Equivariant NQS Architecture"
      },
      {
        "id": "ast_nqs_bench",
        "fileId": "benchmark.png",
        "filename": "benchmark.png",
        "url": "/api/workspaces/neural-wavefunction-superconductors/assets/benchmark.png",
        "kind": "figure",
        "page": 1,
        "confidence": "high",
        "caption": "Predicted Tc Benchmark"
      }
    ],
    "ingestFiles": []
  },
  {
    "id": "cas13-panviral-immunity",
    "name": "Programmable Cas13 Pan-Viral Immunity",
    "posterTitle": "EvoGuide: Structure-Aware Cas13 Pan-Viral Immunity",
    "authors": "Noor Al-Sayed, Hannah Brooks, Kenji Watanabe, Ana Silva",
    "venue": "Nature Biotechnology Methods Forum 2027",
    "templateName": "gemini",
    "activeOutputId": "out_cas13_poster",
    "outputs": [
      {
        "id": "out_cas13_poster",
        "outputType": "poster",
        "templateId": "gemini",
        "title": "EvoGuide: Structure-Aware Cas13 Pan-Viral Immunity",
        "themeColor": "#E45756",
        "cards": [
          {
            "id": "card_cas13_p1",
            "title": "Targeting Viral Escape Mutations",
            "pattern": "bullets",
            "content": "RNA respiratory viruses rapidly acquire single-nucleotide escape variants.\n\n- **Guide Ensembles:** Multi-guide cocktail prevents single-point resistance emergence.\n- **Secondary Structure:** Structure-aware scoring eliminates steric accessibility traps.\n- **In-Vitro Validation:** 0 escape cultures out of 48 serial challenges.",
            "column": 1,
            "order": 0,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": []
          },
          {
            "id": "card_cas13_p2",
            "title": "Selection Optimization",
            "pattern": "bullets",
            "content": "$$\\max_{\\mathcal{S} \\subseteq \\mathcal{G}, |\\mathcal{S}| \\le 4} f_{\\text{coverage}}(\\mathcal{S}) - \\lambda f_{\\text{off-target}}(\\mathcal{S})$$\n\nSubmodular greedy selection achieves provable $(1 - 1/e)$ approximation bound.",
            "column": 1,
            "order": 1,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": []
          },
          {
            "id": "card_cas13_p3",
            "title": "EvoGuide Architecture",
            "pattern": "bullets-image",
            "content": "Pangenome transformer scores accessibility and escape risk across viral phylogenies.",
            "column": 2,
            "order": 0,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_cas13_arch",
                "url": "/api/workspaces/cas13-panviral-immunity/assets/architecture.png",
                "caption": "EvoGuide Pipeline Architecture"
              }
            ],
            "sourceIds": []
          },
          {
            "id": "card_cas13_p4",
            "title": "Efficacy Metrics",
            "pattern": "stats",
            "content": "**99.2%** Viral Knockdown | in-vitro viral load\n**0 / 48** Escape Cultures | 30-day serial passaging\n**6.8 h** Design Cycle | automated synthesis pipeline",
            "column": 2,
            "order": 1,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": []
          },
          {
            "id": "card_cas13_p5",
            "title": "Controlled Benchmark",
            "pattern": "bullets-table",
            "content": "Knockdown and escape suppression compared to standard guide designs.",
            "column": 3,
            "order": 0,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": true,
              "caption": "Knockdown & Escape Benchmark",
              "rows": [
                [
                  "Design",
                  "Knockdown",
                  "Escape Cultures",
                  "Off-targets"
                ],
                [
                  "siRNA",
                  "72.1%",
                  "19/48",
                  "7"
                ],
                [
                  "Cas13-single",
                  "91.6%",
                  "11/48",
                  "3"
                ],
                [
                  "Random-4",
                  "96.8%",
                  "4/48",
                  "2"
                ],
                [
                  "EvoGuide-4",
                  "99.2%",
                  "0/48",
                  "0"
                ]
              ]
            },
            "figures": [],
            "sourceIds": []
          },
          {
            "id": "card_cas13_p6",
            "title": "Long-term Culture Analysis",
            "pattern": "bullets-two-images",
            "content": "Serial passage viral titre quantification over 30 days.",
            "column": 3,
            "order": 1,
            "figureLayout": "two-up",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_cas13_b1",
                "url": "/api/workspaces/cas13-panviral-immunity/assets/benchmark.png",
                "caption": "Viral Titre vs Days"
              },
              {
                "id": "fig_cas13_b2",
                "url": "/api/workspaces/cas13-panviral-immunity/assets/architecture.png",
                "caption": "Guide Interaction Map"
              }
            ],
            "sourceIds": []
          },
          {
            "id": "card_cas13_p7",
            "title": "Take-home",
            "pattern": "metric-card",
            "content": "**99.2%** Knockdown\n**Zero** Escape Variants",
            "column": 3,
            "order": 2,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": []
          },
          {
            "id": "card_cas13_p8",
            "title": "References",
            "pattern": "references",
            "content": "\\cite{abudayyeh2017rna,vaswani2017attention}",
            "column": 1,
            "order": 2,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": []
          }
        ]
      },
      {
        "id": "out_cas13_slides",
        "outputType": "slides",
        "templateId": "beamer-metropolis",
        "title": "EvoGuide: Cas13 Pan-Viral Immunity",
        "themeColor": "#E45756",
        "cards": [
          {
            "id": "card_cas13_slide_1",
            "title": "Overview",
            "pattern": "title-slide",
            "content": "Structure-Aware Cas13 Pan-Viral Immunity",
            "column": null,
            "order": 0,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": []
          }
        ]
      },
      {
        "id": "out_cas13_paper",
        "outputType": "paper",
        "templateId": "neurips",
        "title": "Programmable Cas13 Pan-Viral Immunity",
        "themeColor": "#E45756",
        "cards": [
          {
            "id": "card_cas13_paper_1",
            "title": "Abstract",
            "pattern": "section",
            "content": "EvoGuide designs structure-aware Cas13d guide ensembles that knock down 99.2% of viral RNA.",
            "column": null,
            "order": 0,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [],
            "sourceIds": []
          }
        ]
      }
    ],
    "assets": [
      {
        "id": "ast_cas13_arch",
        "fileId": "architecture.png",
        "filename": "architecture.png",
        "url": "/api/workspaces/cas13-panviral-immunity/assets/architecture.png",
        "kind": "figure",
        "page": 1,
        "confidence": "high",
        "caption": "EvoGuide Architecture"
      },
      {
        "id": "ast_cas13_bench",
        "fileId": "benchmark.png",
        "filename": "benchmark.png",
        "url": "/api/workspaces/cas13-panviral-immunity/assets/benchmark.png",
        "kind": "figure",
        "page": 1,
        "confidence": "high",
        "caption": "Controlled Benchmark"
      }
    ],
    "ingestFiles": []
  }
];
export const getShowcaseById = (id: string): Project | undefined => {
  return ALL_SHOWCASE_PROJECTS.find(p => p.id === id);
};
