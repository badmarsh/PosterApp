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
    id: "jwst-gravitational-lensing",
    title: "JWST Gravitational Lensing: Dark Matter Substructures",
    subtitle: "Forward neural ray-tracing resolves sub-kpc dark matter subhalos in cosmic dawn clusters.",
    category: "Physics",
    tags: ["Gravitational Lensing", "JWST", "Dark Matter", "Astrophysics"],
    outputs: ["poster", "slides", "paper", "thesis-review"], accent: "#0284C7",
    highlights: [{ value: "10^7 M_☉", label: "subhalo threshold" }, { value: "0.028″", label: "astrometric resolution" }, { value: "5.8σ", label: "detection confidence" }],
  },
  {
    id: "speculative-decoding-guarantees",
    title: "Speculative Decoding with Provable Latency Guarantees",
    subtitle: "Martingale-bounded acceptance trees achieve lossless 3.4× acceleration on frontier LLMs.",
    category: "AI & Robotics",
    tags: ["Speculative Decoding", "Inference Acceleration", "Martingale Bounds", "NeurIPS"],
    outputs: ["poster", "slides", "paper"], accent: "#6366F1",
    highlights: [{ value: "3.42×", label: "latency speedup" }, { value: "0.0%", label: "distribution drift" }, { value: "18.2 ms", label: "token latency (p99)" }],
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
  "jwst-gravitational-lensing",
  "speculative-decoding-guarantees",
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
,
{
  "id": "jwst-gravitational-lensing",
  "name": "JWST: Dark Matter Substructures in Strong Lens SMACS J0723",
  "posterTitle": "Sub-Kiloparsec Dark Matter Substructure Imaging with JWST Strong Lensing",
  "authors": "Alistair Vance, Elena Rostova, Marcus Thorne, Tariq Mansoor",
  "venue": "The Astrophysical Journal Letters (ApJL) • High Energy Astrophysics",
  "templateName": "conference",
  "activeOutputId": "out_jwst_poster",
  "logoUrl": null,
  "secondaryLogoUrl": null,
  "outputs": [
    {
      "id": "out_jwst_poster",
      "outputType": "poster",
      "templateId": "conference",
      "title": "Sub-Kiloparsec Dark Matter Substructure Imaging with JWST Strong Lensing",
      "themeColor": "#0284C7",
      "cards": [
        {
          "id": "card_jwst_c1_motivation",
          "title": "Astrophysical Motivation & Dark Halos",
          "column": 1,
          "order": 0,
          "pattern": "bullets",
          "content": "Halos below $10^8 M_\\odot$ remain devoid of stars, making strong lensing the sole probe of sub-galactic cold dark matter.\n\n- **Missing Satellites:** $\\Lambda\\text{CDM}$ predicts thousands of subhalos; local dwarf galaxy counts show an order-of-magnitude deficit.\n- **Warm Dark Matter:** Thermal relics impose a free-streaming cutoff $k_{\\text{fs}}$, damping perturbations below $M_{\\text{cut}}$.\n- **Cosmic Dawn Lensing:** JWST NIRCam reveals multiply imaged galaxies at $z > 6$ magnified by massive clusters.\n- **Sub-kpc Perturbations:** Subhalos near critical curves induce localized astrometric kinks in giant arcs.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_jwst_c1_theory",
          "title": "Gravitational Deflection & Lens Equation",
          "column": 1,
          "order": 1,
          "pattern": "bullets",
          "content": "Light rays from source $\\vec{\\beta}$ are deflected by potential $\\psi(\\vec{\\theta})$ to angles $\\vec{\\theta}$ via Fermat's principle:\n\n$$\\vec{\\beta} = \\vec{\\theta} - \\vec{\\alpha}(\\vec{\\theta}) = \\vec{\\theta} - \\frac{1}{\\pi} \\int_{\\mathbb{R}^2} \\kappa(\\vec{\\theta}') \\frac{\\vec{\\theta} - \\vec{\\theta}'}{|\\vec{\\theta} - \\vec{\\theta}'|^2} \\, d^2\\theta'$$\n\n- **Convergence Field:** $\\kappa(\\vec{\\theta}) \\equiv \\Sigma(\\vec{\\theta})/\\Sigma_{\\text{crit}}$ with $\\Sigma_{\\text{crit}} = \\frac{c^2 D_s}{4\\pi G D_d D_{ds}}$.\n- **Magnification Matrix:** $\\mathcal{A}(\\vec{\\theta}) = \\partial \\vec{\\beta}/\\partial \\vec{\\theta}$; diverges at critical curves where $\\det \\mathcal{A} = 0$.\n- **Subhalo Perturbation:** $\\kappa = \\kappa_{\\text{macro}} + \\delta\\kappa_{\\text{sub}}$ decouples macro potential from sub-kpc clumps.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_jwst_c1_objective",
          "title": "Substructure Field Optimization",
          "column": 1,
          "order": 2,
          "pattern": "bullets",
          "content": "We formulate substructure reconstruction as joint optimization over continuous deflection and source morphology:\n\n$$\\min_{\\phi, I_{\\text{src}}} \\frac{1}{2} \\left\\| I_{\\text{obs}} - \\mathcal{P} \\ast \\left( I_{\\text{src}} \\circ \\left( \\text{Id} - \\vec{\\alpha}_\\phi \\right) \\right) \\right\\|_{\\mathbf{C}_n^{-1}}^2 + \\lambda_{\\text{sub}} \\mathcal{R}_{\\text{sparse}}(\\delta\\kappa) + \\tau \\|\\nabla^2 \\psi_{\\text{macro}}\\|_2^2$$\n\n- **PSF Deconvolution:** $\\mathcal{P}$ models NIRCam WebbPSF field-dependent spatial wavefront kernels.\n- **Sparsity Prior:** $\\mathcal{R}_{\\text{sparse}}(\\delta\\kappa) = \\int \\sqrt{|\\delta\\kappa|^2 + \\epsilon^2} \\, d^2\\theta$ penalizes unphysical diffuse perturbations.\n- **Noise Covariance:** $\\mathbf{C}_n$ captures correlated pixel noise from multi-drizzle stacking and Poisson background.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_jwst_c2_pipeline",
          "title": "Differentiable Forward Lens Pipeline",
          "column": 2,
          "order": 0,
          "pattern": "bullets-image",
          "content": "Our differentiable neural pipeline integrates JWST multi-band drizzled mosaics with coordinate-based implicit ray tracers:\n\n- **Multi-Band Input:** Co-added NIRCam F115W, F200W, and F444W frames provide chromatic constraint on source morphology.\n- **Implicit Neural Deflection:** Multi-resolution hash grids parameterize $\\vec{\\alpha}_\\phi(\\vec{\\theta})$ with analytical curl-free constraints.\n- **End-to-End Autodiff:** Fully differentiable ray-tracer updates subhalo coordinates via AdamW with backpropagation through 14 lensed arc systems.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [
            {
              "id": "fig_jwst_arch",
              "url": "/api/workspaces/jwst-gravitational-lensing/assets/architecture.png",
              "caption": "Figure 1: End-to-end forward neural ray-tracing pipeline with multi-resolution hash grid deflection."
            }
          ],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_jwst_c2_model",
          "title": "Neural Deflection Field & Poisson Solver",
          "column": 2,
          "order": 1,
          "pattern": "bullets",
          "content": "To eliminate unphysical line-of-sight mass degeneracies, our solver enforces exact gravitational potential Poisson consistency:\n\n$$\\nabla^2 \\psi(\\vec{\\theta}) = 2\\kappa(\\vec{\\theta}) = 2\\left[\\kappa_{\\text{macro}}(\\vec{\\theta}) + \\sum_{k=1}^K \\kappa_{\\text{NFW}}(\\vec{\\theta}; M_k, r_{s,k}, \\vec{\\theta}_k)\\right]$$\n\n- **Harmonic Consistency:** Spectral boundary projection ensures $\\nabla \\times \\vec{\\alpha} \\equiv 0$ identically across the entire $120'' \\times 120''$ mosaic field.\n- **Adaptive Resolution:** Quadtree ray grid dynamically refines sampling near caustic folds down to $0.005''$ per ray.\n- **Subhalo Mass Spectrum:** Hierarchical Bayes estimates subhalo mass function slope $dN/dM \\propto M^{-\\alpha}$ with $\\alpha = 1.89 \\pm 0.08$.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_jwst_c2_metrics",
          "title": "Headline Astronomical Metrics",
          "column": 2,
          "order": 2,
          "pattern": "stats",
          "content": "**\\fitstat{1.1 \\times 10^7 M_\\odot}** Subhalo Mass Limit | 95% Bayesian credible interval\n**\\fitstat{0.028''}** Astrometric Resolution | 3.4× finer than HST ACS\n**\\fitstat{5.8\\sigma}** Detection Confidence | SMACS J0723 arc perturber",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_jwst_c3_bench",
          "title": "Controlled Substructure Benchmark",
          "column": 3,
          "order": 0,
          "pattern": "bullets-table",
          "content": "Controlled benchmark on 50 simulated cluster fields with injection-recovery subhalos (95% CI):",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": true,
            "caption": "Table 1: Substructure Detection Benchmark Across Lensing Suites",
            "rows": [
              [
                "Method",
                "Mass Limit ↓",
                "Astrometry ↓",
                "GPU-h ↓"
              ],
              [
                "LENSTOOL v7.2",
                "3.8e8 M☉",
                "0.095''",
                "48.0 h"
              ],
              [
                "PyAutoLens v2.6",
                "8.5e7 M☉",
                "0.052''",
                "26.5 h"
              ],
              [
                "NeuralLens (Ours)",
                "1.1e7 M☉",
                "0.028''",
                "1.8 h"
              ]
            ]
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_jwst_c3_ablation",
          "title": "Ablation Studies & Wavefront Modeling",
          "column": 3,
          "order": 1,
          "pattern": "bullets-two-images",
          "content": "- **Wavefront Modeling:** Removing NIRCam empirical PSF increases astrometric bias by 2.6×.",
          "figureLayout": "two-up",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [
            {
              "id": "fig_jwst_b1",
              "url": "/api/workspaces/jwst-gravitational-lensing/assets/benchmark.png",
              "caption": "Figure 2: Mass sensitivity vs astrometry."
            },
            {
              "id": "fig_jwst_b2",
              "url": "/api/workspaces/jwst-gravitational-lensing/assets/architecture.png",
              "caption": "Figure 3: Pipeline verification."
            }
          ],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_jwst_c3_impact",
          "title": "Take-home Message",
          "column": 3,
          "order": 2,
          "pattern": "metric-card",
          "content": "**\\fitstat{10^7 M_\\odot}** Cold Dark Matter Sensitivity | rules out sterile neutrino m_s < 12 keV\n**\\fitstat{0}** Unphysical Mass Pixels | guaranteed by Poisson consistency",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_jwst_c3_refs",
          "title": "Literature Foundations",
          "column": 3,
          "order": 3,
          "pattern": "references",
          "content": "\\cite{treu2022jwst,hezaveh2016alma,vegetti2014gravitational,meneghetti2020dark}",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        }
      ]
    },
    {
      "id": "out_jwst_slides",
      "outputType": "slides",
      "templateId": "beamer-metropolis",
      "title": "JWST Strong Lensing: Dark Matter Substructures",
      "themeColor": "#0284C7",
      "cards": [
        {
          "id": "card_jwst_s1_title",
          "title": "Dark Matter Substructure Imaging with JWST",
          "column": null,
          "order": 0,
          "pattern": "title-slide",
          "content": "Sub-Kiloparsec Dark Matter Substructure Imaging with JWST Strong Lensing\n\nDr. Alistair Vance, Elena Rostova, Marcus Thorne, Tariq Mansoor\n\nKavli Institute for Particle Astrophysics & European Southern Observatory",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ],
          "slideNotes": "Frame 1: Welcome everyone. Today we present direct observational constraints on sub-galactic dark matter structures using JWST NIRCam strong gravitational lensing."
        },
        {
          "id": "card_jwst_s2_motivation",
          "title": "The Sub-Galactic Dark Matter Frontier",
          "column": null,
          "order": 1,
          "pattern": "bullets",
          "content": "Why target sub-kiloparsec dark matter clumps?\n\n- **Cold Dark Matter (CDM):** Predicts scale-invariant hierarchical structure down to Earth-mass microhalos.\n- **Alternative Candidates:** Warm Dark Matter (WDM) and Fuzzy Dark Matter (FDM) impose sharp sub-galactic cutoffs.\n- **Baryonic Blindness:** Halos below $10^8 M_\\odot$ fail to ignite star formation, rendering them completely dark.\n- **Gravitational Lensing:** Gravitational deflection depends purely on mass, providing an unbiased astronomical scale.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ],
          "slideNotes": "Frame 2: Emphasize that below 10^8 solar masses, halos are invisible to traditional telescopes because no stars form. Lensing is our sole direct window."
        },
        {
          "id": "card_jwst_s3_theory",
          "title": "Strong Gravitational Lensing Physics",
          "column": null,
          "order": 2,
          "pattern": "two-column",
          "content": "Light rays undergo relativistic deflection governed by the 2D Poisson equation:\n\n$$\\vec{\\beta} = \\vec{\\theta} - \\vec{\\alpha}(\\vec{\\theta}), \\quad \\nabla^2 \\psi(\\vec{\\theta}) = 2\\kappa(\\vec{\\theta})$$\n\nMagnification diverges at caustic boundaries:\n$$\\det \\mathcal{A}(\\vec{\\theta}) = (1 - \\kappa)^2 - \\gamma^2 = 0$$\n\nSubhalos crossing caustic folds produce astrometric kinks and anomalous flux ratios.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ],
          "slideNotes": "Frame 3: Review Fermat potential and the lens equation. Note how critical curves magnify background sources by factors exceeding 50."
        },
        {
          "id": "card_jwst_s4_pipeline",
          "title": "Forward Neural Ray-Tracing Architecture",
          "column": null,
          "order": 3,
          "pattern": "figure-slide",
          "content": "Continuous multi-resolution coordinate hash grid parameterizes the deflection potential with exact Poisson consistency.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [
            {
              "id": "fig_jwst_s4_arch",
              "url": "/api/workspaces/jwst-gravitational-lensing/assets/architecture.png",
              "caption": "Evidence-to-action differentiable lens inversion architecture."
            }
          ],
          "sourceIds": [
            "manuscript"
          ],
          "slideNotes": "Frame 4: Highlight the modular architecture connecting raw JWST drizzle products, neural deflection fields, and differentiable ray-tracing."
        },
        {
          "id": "card_jwst_s5_data",
          "title": "JWST NIRCam Observational Data",
          "column": null,
          "order": 4,
          "pattern": "bullets-image",
          "content": "Multi-band observations of galaxy cluster SMACS J0723.3-7327 ($z = 0.39$):\n\n- **Spectral Coverage:** F115W ($1.15\\,\\mu\\text{m}$), F200W ($2.0\\,\\mu\\text{m}$), F444W ($4.4\\,\\mu\\text{m}$).\n- **Spatial Sampling:** $0.031''$ per drizzled pixel with WebbPSF field-dependent kernels.\n- **Target Arcs:** Multiply imaged high-redshift starburst galaxy at $z = 1.425$ stretched across $15''$.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [
            {
              "id": "fig_jwst_s5_data",
              "url": "/api/workspaces/jwst-gravitational-lensing/assets/architecture.png",
              "caption": "NIRCam filter mosaic and drizzled PSF convolution."
            }
          ],
          "sourceIds": [
            "manuscript"
          ],
          "slideNotes": "Frame 5: Detail the observational dataset and the importance of NIRCam's exquisite infrared point spread function."
        },
        {
          "id": "card_jwst_s6_objective",
          "title": "Differentiable Optimization Objective",
          "column": null,
          "order": 5,
          "pattern": "bullets",
          "content": "Joint maximum a posteriori formulation over deflection field $\\phi$ and source plane $I_{\\text{src}}$:\n\n$$\\mathcal{L}(\\phi, I_{\\text{src}}) = \\frac{1}{2} \\left\\| I_{\\text{obs}} - \\mathcal{P} \\ast I_{\\text{mod}}(\\phi) \\right\\|_{\\mathbf{C}_n^{-1}}^2 + \\lambda \\mathcal{R}_{\\text{sparse}}(\\delta\\kappa) + \\gamma \\|\\nabla^2 \\psi_{\\text{macro}}\\|_2^2$$\n\n- **Exact Gradient Propagation:** Full auto-differentiation backpropagates pixel residuals to subhalo positions.\n- **Charbonnier Prior:** Suppresses diffuse reconstruction noise while allowing compact subhalo cusps.\n- **AdamW Optimization:** 5,000 iterations converge in 1.8 GPU-hours on a single NVIDIA A100.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ],
          "slideNotes": "Frame 6: Explain the regularized likelihood and why Charbonnier sparsity prevents false-positive diffuse artifacts."
        },
        {
          "id": "card_jwst_s7_benchmark",
          "title": "Substructure Sensitivity Benchmark",
          "column": null,
          "order": 6,
          "pattern": "figure-slide",
          "content": "Controlled benchmark demonstrates a 7.7x sensitivity gain over legacy grid and parametric algorithms.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [
            {
              "id": "fig_jwst_s7_bench",
              "url": "/api/workspaces/jwst-gravitational-lensing/assets/benchmark.png",
              "caption": "Primary substructure mass detection limit with 95% bootstrap confidence intervals."
            }
          ],
          "sourceIds": [
            "manuscript"
          ],
          "slideNotes": "Frame 7: Walk through the benchmark chart. Point out our 1.1e7 solar mass limit with narrow 95% confidence intervals."
        },
        {
          "id": "card_jwst_s8_substructure",
          "title": "Detection of 1.1x10^7 M_☉ Subhalo",
          "column": null,
          "order": 7,
          "pattern": "two-column",
          "content": "Unambiguous localized detection in SMACS J0723:\n\n- **Mass:** $M_{\\text{sub}} = (1.1 \\pm 0.2) \\times 10^7 M_\\odot$\n- **Significance:** $5.8\\sigma$ above smooth macro-model\n- **Position:** $\\Delta\\vec{\\theta} = (+1.42'', -0.88'')$ relative to Arc 1 BCG\n- **Bayes Factor:** $\\ln \\mathcal{B} = 18.4$ (decisive preference)\n\nResidual image shows zero systematic dipolar patterns remaining after subhalo inclusion.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ],
          "slideNotes": "Frame 8: Announce the primary astronomical detection. Emphasize the 5.8 sigma statistical significance."
        },
        {
          "id": "card_jwst_s9_ablation",
          "title": "Ablation Studies & Robustness",
          "column": null,
          "order": 8,
          "pattern": "two-column",
          "content": "Rigorous ablation on synthetic injection challenges:\n\n- **Wavefront Model:** Neglecting empirical WebbPSF increases astrometric error from $0.028''$ to $0.073''$.\n- **Multi-Band Synergy:** Monochromatic inversion suffers 38% higher false-alarm rates due to dust unmixing ambiguities.\n- **Noise Injection:** Stable recovery maintained under 40% added correlated noise.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ],
          "slideNotes": "Frame 9: Discuss ablations. Note that accounting for WebbPSF wavefront errors is mandatory for sub-pixel astrometry."
        },
        {
          "id": "card_jwst_s10_wdm",
          "title": "Cosmological Warm Dark Matter Limits",
          "column": null,
          "order": 9,
          "pattern": "bullets-image",
          "content": "Inferring the subhalo mass function down to $10^7 M_\\odot$:\n\n- **Power-Law Slope:** Measured $dN/dM \\propto M^{-\\alpha}$ with $\\alpha = 1.89 \\pm 0.08$.\n- **CDM Compatibility:** Perfectly consistent with cold dark matter N-body simulations ($\\alpha \\approx 1.90$).\n- **Thermal Relic Exclusion:** Constrains warm dark matter particle mass $m_{\\text{wdm}} > 9.4\\text{ keV}$ ($95\\%$ CL).",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [
            {
              "id": "fig_jwst_s10_wdm",
              "url": "/api/workspaces/jwst-gravitational-lensing/assets/benchmark.png",
              "caption": "Subhalo mass function constraints against WDM free-streaming models."
            }
          ],
          "sourceIds": [
            "manuscript"
          ],
          "slideNotes": "Frame 10: Relate the astronomical detection back to fundamental physics and sterile neutrino dark matter exclusions."
        },
        {
          "id": "card_jwst_s11_limitations",
          "title": "Systematics & Astrophysical Caveats",
          "column": null,
          "order": 10,
          "pattern": "bullets",
          "content": "Remaining observational and computational limitations:\n\n- **Line-of-Sight Contamination:** Intervening field halos along the pencil beam can mimic cluster subhalos.\n- **Source Morphology Complexity:** Multi-component starburst knots require careful regularization to prevent degeneracies.\n- **Intra-Cluster Light (ICL):** Stellar micro-lensing causes high-frequency stochastic magnification fluctuations.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ],
          "slideNotes": "Frame 11: Honestly acknowledge limitations. Line-of-sight mass contamination requires multi-plane redshift tomography in future work."
        },
        {
          "id": "card_jwst_s12_conclusion",
          "title": "Summary & Future Horizons",
          "column": null,
          "order": 11,
          "pattern": "bullets",
          "content": "Key Takeaways:\n\n- **Direct Sub-kpc Probing:** Proved subhalos down to $1.1 \\times 10^7 M_\\odot$ are directly measurable with JWST.\n- **Differentiable Speed:** 14.7x faster than legacy Markov Chain Monte Carlo algorithms.\n- **Open Science:** Complete code, WebbPSF kernels, and calibrated pipeline released on GitHub.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ],
          "slideNotes": "Frame 12: Summarize our core conclusions and highlight that the open-source pipeline is containerized and available to the community."
        },
        {
          "id": "card_jwst_s13_refs",
          "title": "References & Citations",
          "column": null,
          "order": 12,
          "pattern": "references",
          "content": "\\cite{treu2022jwst,hezaveh2016alma,vegetti2014gravitational,meneghetti2020dark}",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ],
          "slideNotes": "Frame 13: Citations and bibliography."
        }
      ]
    },
    {
      "id": "out_jwst_paper",
      "outputType": "paper",
      "templateId": "revtex-aps",
      "title": "Sub-Kiloparsec Dark Matter Substructure Imaging with JWST Strong Lensing",
      "themeColor": "#0284C7",
      "cards": [
        {
          "id": "card_jwst_p_abstract",
          "title": "Abstract",
          "column": null,
          "order": 0,
          "pattern": "section",
          "content": "Standard cold dark matter ($\\Lambda\\text{CDM}$) cosmology predicts an abundant population of low-mass subhalos ($M < 10^8 M_\\odot$) orbiting massive galaxy cluster lenses. Because star formation is heavily suppressed below this mass scale, these primordial structures remain dark and can only be detected via their gravitational perturbation on magnified background arcs. Here we present a differentiable neural ray-tracing framework that inverts JWST NIRCam high-resolution multi-band mosaics (F115W, F200W, F444W) of the lensing cluster SMACS J0723.3-7327 ($z = 0.39$). By coupling a multi-resolution hash grid to a Poisson-consistent deflection solver ($\\nabla^2 \\psi = 2\\kappa$), our method achieves a subhalo mass detection limit of $1.1 \\times 10^7 M_\\odot$ at $5.8\\sigma$ significance with an astrometric resolution of $0.028''$. This represents a $7.7\\times$ sensitivity gain over Hubble Space Telescope baselines, ruling out thermal relic warm dark matter candidates with particle masses $m_{\\text{wdm}} < 9.4\\text{ keV}$ at $95\\%$ confidence.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_jwst_p_intro",
          "title": "Introduction",
          "column": null,
          "order": 1,
          "pattern": "section-figure",
          "content": "The nature of dark matter on sub-galactic scales remains one of the fundamental open frontiers in modern cosmology \\cite{meneghetti2020dark}. While collisionless cold dark matter ($\\Lambda\\text{CDM}$) successfully reproduces large-scale cosmic structure, local dwarf galaxy counts exhibit apparent discrepancies including the 'missing satellites' and 'too-big-to-fail' problems \\cite{vegetti2014gravitational}. Distinguishing whether these discrepancies arise from baryonic feedback or alternative dark matter physics (such as warm or fuzzy dark matter) requires measuring the subhalo mass function in systems completely devoid of stars. Strong gravitational lensing by massive galaxy clusters provides an ideal natural telescope, magnifying high-redshift background galaxies across critical curves where localized perturbations induce detectable astrometric distortions \\cite{treu2022jwst}.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [
            {
              "id": "fig_jwst_p_arch",
              "url": "/api/workspaces/jwst-gravitational-lensing/assets/architecture.png",
              "caption": "Figure 1: Overview of the differentiable forward lens modeling pipeline."
            }
          ],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_jwst_p_related",
          "title": "Related Work & Baseline Methods",
          "column": null,
          "order": 2,
          "pattern": "section",
          "content": "Traditional gravitational lens modeling relies either on parametric mass profiles (e.g., LENSTOOL \\cite{treu2022jwst}) or pixelated source and potential grid inversions (e.g., PyAutoLens \\cite{vegetti2014gravitational}). Parametric models restrict subhalo geometries to rigid analytic forms (such as Navarro-Frenk-White or truncated pseudo-Jaffe profiles), preventing the discovery of non-standard perturbers. Pixelated potential corrections alleviate profile rigidity but suffer from severe ill-posedness and prohibitive computational costs, requiring tens of GPU-hours per system \\cite{hezaveh2016alma}. Recent developments in neural radiance fields and coordinate networks offer continuous representations, yet prior implementations lacked exact Poisson consistency and empirical optical wavefront convolution.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_jwst_p_methods",
          "title": "Formal Methods & Neural Ray-Tracing",
          "column": null,
          "order": 3,
          "pattern": "section",
          "content": "We parameterize the total convergence field as $\\kappa(\\vec{\\theta}) = \\kappa_{\\text{macro}}(\\vec{\\theta}; \\mathbf{w}) + \\delta\\kappa_{\\text{sub}}(\\vec{\\theta}; \\mathbf{\\phi})$, where $\\kappa_{\\text{macro}}$ models cluster-scale halos and member galaxies, and $\\delta\\kappa_{\\text{sub}}$ is parameterized via a 16-level multi-resolution hash grid. Deflection angles are computed via spectral projection $\\vec{\\alpha}_\\phi(\\vec{\\theta}) = \\nabla(\\nabla^{-2}[2\\kappa(\\vec{\\theta})])$, ensuring $\\nabla \\times \\vec{\\alpha} \\equiv 0$. The forward surface brightness is predicted by ray-tracing through the reconstructed deflection field and convolving with the empirical WebbPSF kernel $\\mathcal{P}(\\vec{\\theta})$. We optimize parameters end-to-end using the regularized objective:\n\n$$\\mathcal{L}(\\phi, I_{\\text{src}}) = \\frac{1}{2} \\left\\| I_{\\text{obs}} - \\mathcal{P} \\ast I_{\\text{mod}}(\\phi) \\right\\|_{\\mathbf{C}_n^{-1}}^2 + \\lambda_{\\text{sub}} \\mathcal{R}_{\\text{sparse}}(\\delta\\kappa) + \\gamma \\|\\nabla^2 \\psi_{\\text{macro}}\\|_2^2$$",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_jwst_p_experiments",
          "title": "Experimental Evaluation & Benchmark",
          "column": null,
          "order": 4,
          "pattern": "section-table",
          "content": "We evaluate our framework across 50 simulated cluster lensing fields with injected dark subhalos ranging from $10^7 M_\\odot$ to $10^9 M_\\odot$. Each method was evaluated on identical synthetic datasets with matched noise and stopping criteria across 5 random seeds.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": true,
            "caption": "Table 1: Controlled Benchmark Comparison across Substructure Inversion Methods",
            "rows": [
              [
                "Method",
                "Mass Limit ↓",
                "Astrometry ↓",
                "Src PSNR ↑",
                "GPU-h ↓"
              ],
              [
                "Analytic NFW",
                "1.4e9 M☉",
                "0.180''",
                "24.2 dB",
                "12.4 h"
              ],
              [
                "LENSTOOL v7.2",
                "3.8e8 M☉",
                "0.095''",
                "28.7 dB",
                "48.0 h"
              ],
              [
                "PyAutoLens v2.6",
                "8.5e7 M☉",
                "0.052''",
                "32.1 dB",
                "26.5 h"
              ],
              [
                "NeuralLens (Ours)",
                "1.1e7 M☉",
                "0.028''",
                "38.4 dB",
                "1.8 h"
              ]
            ]
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_jwst_p_ablation",
          "title": "Ablation Studies & Sensitivity Analysis",
          "column": null,
          "order": 5,
          "pattern": "section-two-figures",
          "content": "Ablation analysis reveals that incorporating empirical WebbPSF wavefront kernels provides the single largest improvement in astrometric fidelity, cutting centroid reconstruction bias by $2.6\\times$. Multi-band joint fitting over F115W, F200W, and F444W eliminates chromatic source-lens degeneracies.",
          "figureLayout": "two-up",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [
            {
              "id": "fig_jwst_p_b1",
              "url": "/api/workspaces/jwst-gravitational-lensing/assets/benchmark.png",
              "caption": "Primary substructure mass detection sensitivity."
            },
            {
              "id": "fig_jwst_p_b2",
              "url": "/api/workspaces/jwst-gravitational-lensing/assets/architecture.png",
              "caption": "Differentiable lens modeling stages."
            }
          ],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_jwst_p_discussion",
          "title": "Astrophysical Discussion & Cosmological Impact",
          "column": null,
          "order": 6,
          "pattern": "section",
          "content": "Applying our method to JWST NIRCam observations of cluster SMACS J0723.3-7327 yields a definitive $5.8\\sigma$ detection of a $(1.1 \\pm 0.2) \\times 10^7 M_\\odot$ dark subhalo. The measured subhalo mass function slope $\\alpha = 1.89 \\pm 0.08$ is in excellent agreement with cold dark matter simulations and rules out sterile neutrino warm dark matter models with $m_s < 12\\text{ keV}$. Line-of-sight mass projection remains the principal systematic uncertainty, requiring future multi-plane tomography.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_jwst_p_conclusion",
          "title": "Conclusion",
          "column": null,
          "order": 7,
          "pattern": "section",
          "content": "We have demonstrated that differentiable forward neural ray-tracing enables direct sub-kiloparsec dark matter substructure imaging in JWST strong lensing clusters. By resolving dark subhalos down to $10^7 M_\\odot$, this approach establishes a scalable pathway to test dark matter particle candidates at cosmic dawn.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_jwst_p_refs",
          "title": "References",
          "column": null,
          "order": 8,
          "pattern": "references",
          "content": "\\cite{treu2022jwst,hezaveh2016alma,vegetti2014gravitational,meneghetti2020dark}",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        }
      ]
    },
    {
      "id": "out_jwst_review",
      "outputType": "thesis-review",
      "templateId": "posudok-en",
      "title": "Opponent Assessment — Sub-Kiloparsec Dark Matter Lensing",
      "themeColor": "#003366",
      "cards": [
        {
          "id": "card_jwst_rev_1",
          "title": "Criterion 1: Originality & Novelty",
          "column": null,
          "order": 0,
          "pattern": "section",
          "content": "Grade **A**. The manuscript delivers a rigorous, breakthrough treatment of originality & novelty. The integration of JWST NIRCam WebbPSF empirical wavefronts with differentiable ray-tracing provides an unprecedented observational test of dark matter physics at sub-kiloparsec scales.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_jwst_rev_2",
          "title": "Criterion 2: Theoretical Formulation",
          "column": null,
          "order": 1,
          "pattern": "section",
          "content": "Grade **A**. The manuscript delivers a rigorous, breakthrough treatment of theoretical formulation. The integration of JWST NIRCam WebbPSF empirical wavefronts with differentiable ray-tracing provides an unprecedented observational test of dark matter physics at sub-kiloparsec scales.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_jwst_rev_3",
          "title": "Criterion 3: Computational Methods",
          "column": null,
          "order": 2,
          "pattern": "section",
          "content": "Grade **A**. The manuscript delivers a rigorous, breakthrough treatment of computational methods. The integration of JWST NIRCam WebbPSF empirical wavefronts with differentiable ray-tracing provides an unprecedented observational test of dark matter physics at sub-kiloparsec scales.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_jwst_rev_4",
          "title": "Criterion 4: Observational Data Provenance",
          "column": null,
          "order": 3,
          "pattern": "section",
          "content": "Grade **A**. The manuscript delivers a rigorous, breakthrough treatment of observational data provenance. The integration of JWST NIRCam WebbPSF empirical wavefronts with differentiable ray-tracing provides an unprecedented observational test of dark matter physics at sub-kiloparsec scales.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_jwst_rev_5",
          "title": "Criterion 5: Statistical Rigor & Bayes Analysis",
          "column": null,
          "order": 4,
          "pattern": "section",
          "content": "Grade **A**. The manuscript delivers a rigorous, breakthrough treatment of statistical rigor & bayes analysis. The integration of JWST NIRCam WebbPSF empirical wavefronts with differentiable ray-tracing provides an unprecedented observational test of dark matter physics at sub-kiloparsec scales.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_jwst_rev_6",
          "title": "Criterion 6: Empirical Results & Sensitivity",
          "column": null,
          "order": 5,
          "pattern": "section",
          "content": "Grade **A**. The manuscript delivers a rigorous, breakthrough treatment of empirical results & sensitivity. The integration of JWST NIRCam WebbPSF empirical wavefronts with differentiable ray-tracing provides an unprecedented observational test of dark matter physics at sub-kiloparsec scales.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_jwst_rev_7",
          "title": "Criterion 7: Astrophysical Validation & Robustness",
          "column": null,
          "order": 6,
          "pattern": "section",
          "content": "Grade **A**. The manuscript delivers a rigorous, breakthrough treatment of astrophysical validation & robustness. The integration of JWST NIRCam WebbPSF empirical wavefronts with differentiable ray-tracing provides an unprecedented observational test of dark matter physics at sub-kiloparsec scales.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_jwst_rev_8",
          "title": "Criterion 8: Reproducibility & Open Science",
          "column": null,
          "order": 7,
          "pattern": "section",
          "content": "Grade **A**. The manuscript delivers a rigorous, breakthrough treatment of reproducibility & open science. The integration of JWST NIRCam WebbPSF empirical wavefronts with differentiable ray-tracing provides an unprecedented observational test of dark matter physics at sub-kiloparsec scales.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_jwst_rev_9",
          "title": "Criterion 9: Scientific Writing & Presentation",
          "column": null,
          "order": 8,
          "pattern": "section",
          "content": "Grade **A**. The manuscript delivers a rigorous, breakthrough treatment of scientific writing & presentation. The integration of JWST NIRCam WebbPSF empirical wavefronts with differentiable ray-tracing provides an unprecedented observational test of dark matter physics at sub-kiloparsec scales.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_jwst_rev_10",
          "title": "Criterion 10: Research Ethics & Attribution",
          "column": null,
          "order": 9,
          "pattern": "section",
          "content": "Grade **A**. The manuscript delivers a rigorous, breakthrough treatment of research ethics & attribution. The integration of JWST NIRCam WebbPSF empirical wavefronts with differentiable ray-tracing provides an unprecedented observational test of dark matter physics at sub-kiloparsec scales.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_jwst_rev_11",
          "title": "Criterion 11: Discussion of Limitations",
          "column": null,
          "order": 10,
          "pattern": "section",
          "content": "Grade **B+**. The manuscript delivers a rigorous, breakthrough treatment of discussion of limitations. The integration of JWST NIRCam WebbPSF empirical wavefronts with differentiable ray-tracing provides an unprecedented observational test of dark matter physics at sub-kiloparsec scales.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_jwst_rev_12",
          "title": "Criterion 12: Astrophysical Impact & Outlook",
          "column": null,
          "order": 11,
          "pattern": "section",
          "content": "Grade **A**. The manuscript delivers a rigorous, breakthrough treatment of astrophysical impact & outlook. The integration of JWST NIRCam WebbPSF empirical wavefronts with differentiable ray-tracing provides an unprecedented observational test of dark matter physics at sub-kiloparsec scales.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        }
      ]
    }
  ],
  "assets": [
    {
      "id": "ast_jwst_arch",
      "fileId": "architecture.png",
      "filename": "architecture.png",
      "url": "/api/workspaces/jwst-gravitational-lensing/assets/architecture.png",
      "kind": "figure",
      "page": 1,
      "confidence": "high",
      "caption": "JWST NIRCam forward neural ray-tracing pipeline"
    },
    {
      "id": "ast_jwst_bench",
      "fileId": "benchmark.png",
      "filename": "benchmark.png",
      "url": "/api/workspaces/jwst-gravitational-lensing/assets/benchmark.png",
      "kind": "figure",
      "page": 1,
      "confidence": "high",
      "caption": "Subhalo detection limit and astrometric precision comparison"
    }
  ],
  "ingestFiles": []
},
{
  "id": "speculative-decoding-guarantees",
  "name": "MartingaleTree: Lossless Speculative Decoding",
  "posterTitle": "Speculative Decoding with Provable Latency and Lossless Verification",
  "authors": "Julian Richter, Maya Lin, Aris Thorne, Sunita Deshmukh",
  "venue": "NeurIPS 2026 • Machine Learning Systems & Efficiency",
  "templateName": "gemini",
  "activeOutputId": "out_spec_poster",
  "logoUrl": null,
  "secondaryLogoUrl": null,
  "outputs": [
    {
      "id": "out_spec_poster",
      "outputType": "poster",
      "templateId": "gemini",
      "title": "Speculative Decoding with Provable Latency and Lossless Verification",
      "themeColor": "#6366F1",
      "cards": [
        {
          "id": "card_spec_c1_problem",
          "title": "Memory-Bound Autoregressive Bottleneck",
          "column": 1,
          "order": 0,
          "pattern": "bullets",
          "content": "Autoregressive generation in large foundation models is memory-bandwidth bound, transferring hundreds of gigabytes per token.\n\n- **Memory Bandwidth Bottleneck:** Modern accelerator FLOP utilization rarely exceeds 15% during single-sequence autoregressive decoding.\n- **Speculative Acceleration:** A lightweight draft model generates candidate sequences verified in parallel by the target model.\n- **The Tail Latency Pitfall:** When draft alignment deteriorates, speculative verification degenerates into wasteful forward passes.\n- **Heuristic Tree Limits:** Heuristic tree search introduces unbounded verification latency without formal guarantees.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_spec_c1_formulation",
          "title": "Lossless Speculative Rejection Formulation",
          "column": 1,
          "order": 1,
          "pattern": "bullets",
          "content": "Target model distribution $p(x_t \\mid x_{<t})$ verifies draft distribution $q(x_t \\mid x_{<t})$ via modified rejection sampling:\n\n$$r_i = \\min\\left(1, \\frac{p(x_{t+i} \\mid x_{<t+i})}{q(x_{t+i} \\mid x_{<t+i})}\\right), \\qquad p_{\\text{res}}(x) = \\frac{\\max(0, p(x) - q(x))}{1 - \\sum_y \\min(p(y), q(y))}$$\n\n- **Lossless Guarantee:** Total variation distance $D_{\\text{TV}}(P_{\\text{spec}}, P_{\\text{tgt}}) \\equiv 0$ identically across all vocabulary tokens.\n- **Sequential Acceptance:** Candidates are accepted with probability $r_i$; upon rejection, residual resampling guarantees target distribution fidelity.\n- **KV-Cache Alignment:** Cache pointers update transactionally, avoiding re-computation for validated prefix tokens.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_spec_c1_martingale",
          "title": "Martingale Latency Stopping Bounds",
          "column": 1,
          "order": 2,
          "pattern": "bullets",
          "content": "We frame the likelihood ratio along speculative candidate branches as a non-negative sub-martingale process:\n\n$$M_k = \\prod_{j=1}^k \\frac{p(x_{t+j} \\mid x_{<t+j})}{q(x_{t+j} \\mid x_{<t+j})}, \\qquad \\mathbb{P}\\left(\\sup_{1 \\le k \\le K} M_k \\ge \\lambda\\right) \\le \\frac{1}{\\lambda}$$\n\n- **Ville's Inequality Bound:** Establishes non-asymptotic bounds on alignment divergence before branch execution.\n- **Dynamic Stopping Time:** $\\tau = \\inf \\{k \\in [1, K] : M_k < 1 - \\delta\\}$ cuts branches when expected acceptance decays.\n- **Zero Latency Regressions:** Pruning guarantees that worst-case step latency never exceeds $1.15\\times$ standard autoregressive decoding.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_spec_c2_pipeline",
          "title": "Tree Pipelining & Verification Architecture",
          "column": 2,
          "order": 0,
          "pattern": "bullets-image",
          "content": "Our end-to-end architecture pairs draft tree generation with a fused Triton verification kernel and ring-buffer KV cache:\n\n- **Tree Draft Expansion:** 1.5B parameter draft generates $K=16$ branching candidates in $4.2\\text{ ms}$.\n- **Fused Tree Attention:** Custom 2D causal attention mask $M_{i,j}$ verifies all $K$ candidates in a single batched target forward pass.\n- **Zero-Copy Reclaim:** Rollback pointers immediately free discarded candidate KV slots with zero memory fragmentation.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [
            {
              "id": "fig_spec_arch",
              "url": "/api/workspaces/speculative-decoding-guarantees/assets/architecture.png",
              "caption": "Figure 1: MartingaleTree speculative pipeline with dynamic stopping and tree attention."
            }
          ],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_spec_c2_kernel",
          "title": "Fused Triton Tree-Attention Kernel",
          "column": 2,
          "order": 1,
          "pattern": "bullets",
          "content": "Custom fused GPU kernels eliminate host-device synchronization barriers during tree verification:\n\n$$\\text{Attn}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}} + M_{\\text{tree}}\\right) V$$\n\n- **Triton Tree Kernel:** Computes non-linear tree-causal attention across 128 streaming multiprocessors without materialized masks.\n- **Batch Efficiency:** Amortizes memory bandwidth across 4.12 accepted tokens per verification pass.\n- **Dynamic Tree Pruning:** Prunes underperforming branches in-flight based on prefix likelihood ratios.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_spec_c2_stats",
          "title": "Headline Acceleration Metrics",
          "column": 2,
          "order": 2,
          "pattern": "stats",
          "content": "**\\fitstat{3.42\\times}** Wall-Clock Speedup | on Llama-3-70B across MT-Bench\n**\\fitstat{0.0\\%}** Distribution Drift | TV distance D_TV = 0.000\n**\\fitstat{18.2\\text{ ms}}** Token Latency (p99) | 62% reduction vs baseline",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_spec_c3_bench",
          "title": "Controlled Inference Benchmark",
          "column": 3,
          "order": 0,
          "pattern": "bullets-table",
          "content": "Controlled throughput and latency benchmark on Llama-3-70B across 5 independent seeds (95% CI):",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": true,
            "caption": "Table 1: Controlled Inference Speedup Benchmark on Llama-3-70B",
            "rows": [
              [
                "Inference Framework",
                "Throughput ↑",
                "Latency ↓",
                "Speedup ↑"
              ],
              [
                "Standard Spec (K=4)",
                "42.1 tok/s",
                "23.8 ms",
                "2.17×"
              ],
              [
                "EAGLE Tree Spec",
                "53.6 tok/s",
                "18.7 ms",
                "2.76×"
              ],
              [
                "MartingaleTree (Ours)",
                "66.3 tok/s",
                "15.1 ms",
                "3.42×"
              ]
            ]
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_spec_c3_ablation",
          "title": "Ablation Studies & Dynamic Stopping",
          "column": 3,
          "order": 1,
          "pattern": "bullets-two-images",
          "content": "- **Martingale Stopping:** Removing dynamic depth pruning increases p99 tail latency by 2.67×.",
          "figureLayout": "two-up",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [
            {
              "id": "fig_spec_b1",
              "url": "/api/workspaces/speculative-decoding-guarantees/assets/benchmark.png",
              "caption": "Figure 2: Speedup comparison."
            },
            {
              "id": "fig_spec_b2",
              "url": "/api/workspaces/speculative-decoding-guarantees/assets/architecture.png",
              "caption": "Figure 3: Pipelined execution."
            }
          ],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_spec_c3_impact",
          "title": "Key Takeaway & Guarantee",
          "column": 3,
          "order": 2,
          "pattern": "metric-card",
          "content": "**\\fitstat{66.3\\text{ tok/s}}** Frontier 70B Throughput | vs 19.4 tok/s vanilla\n**\\fitstat{0\\text{ Error}}** Bitwise Numerical Equivalence | verified across 100k queries",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_spec_c3_refs",
          "title": "Foundational References",
          "column": 3,
          "order": 3,
          "pattern": "references",
          "content": "\\cite{leviathan2023fast,chen2023accelerating,miao2024specinfer,ville1939etude}",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        }
      ]
    },
    {
      "id": "out_spec_slides",
      "outputType": "slides",
      "templateId": "beamer-metropolis",
      "title": "MartingaleTree: Provable Speculative Decoding",
      "themeColor": "#6366F1",
      "cards": [
        {
          "id": "card_spec_s1_title",
          "title": "Speculative Decoding with Provable Latency",
          "column": null,
          "order": 0,
          "pattern": "title-slide",
          "content": "Speculative Decoding with Provable Latency Guarantees and Lossless Verification\n\nJulian Richter, Maya Lin, Aris Thorne, Sunita Deshmukh\n\nSystems and Machine Learning Laboratory, ETH Zürich & Stanford University",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ],
          "slideNotes": "Frame 1: Welcome everyone. We present MartingaleTree: exact, lossless speculative decoding with provable latency bounds."
        },
        {
          "id": "card_spec_s2_bottleneck",
          "title": "The Memory Bandwidth Wall in LLMs",
          "column": null,
          "order": 1,
          "pattern": "bullets",
          "content": "Why is large foundation model inference slow?\n\n- **Memory Bandwidth Bound:** Decoding a 70B model requires moving 140 GB of weights per single token.\n- **Low Hardware Utilization:** Arithmetic intensity is <1 FLOP/byte during batch=1 autoregressive decoding.\n- **Speculative Decoding Concept:** Hypothesize $K$ tokens via small draft model; verify simultaneously in target model.\n- **The Heuristic Tree Pitfall:** Without stopping rules, speculative verification produces tail latency stalls.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ],
          "slideNotes": "Frame 2: Explain memory-bandwidth bottlenecks. Single-token autoregression leaves GPUs mostly idle."
        },
        {
          "id": "card_spec_s3_formulation",
          "title": "Modified Rejection Sampling",
          "column": null,
          "order": 2,
          "pattern": "two-column",
          "content": "Exact distribution equivalence requires sampling from residual distributions:\n\n$$r_i = \\min\\left(1, \\frac{p(x_{t+i} \\mid x_{<t+i})}{q(x_{t+i} \\mid x_{<t+i})}\\right)$$\n\nResidual upon rejection at node $k$:\n$$p_{\\text{res}}(x) = \\frac{\\max(0, p(x) - q(x))}{1 - \\sum_y \\min(p(y), q(y))}$$\n\nTotal variation distance is identically zero: $D_{\\text{TV}}(P_{\\text{spec}}, P_{\\text{tgt}}) \\equiv 0$.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ],
          "slideNotes": "Frame 3: Present the rejection sampling mathematics. Emphasize that output sequences have bitwise identical distributions."
        },
        {
          "id": "card_spec_s4_pipeline",
          "title": "Lossless Tree-Speculative Architecture",
          "column": null,
          "order": 3,
          "pattern": "figure-slide",
          "content": "End-to-end pipelined execution combining draft proposal, Triton tree verification, and memory ring-buffer reclamation.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [
            {
              "id": "fig_spec_s4_arch",
              "url": "/api/workspaces/speculative-decoding-guarantees/assets/architecture.png",
              "caption": "MartingaleTree four-stage pipeline."
            }
          ],
          "sourceIds": [
            "manuscript"
          ],
          "slideNotes": "Frame 4: Trace the four pipeline stages from draft generation through fused verification and rollback."
        },
        {
          "id": "card_spec_s5_tree_attn",
          "title": "Fused Triton Tree-Attention Kernel",
          "column": null,
          "order": 4,
          "pattern": "bullets-image",
          "content": "Parallel verification of all tree candidates in a single batched forward pass:\n\n- **2D Tree Attention Mask:** Tokens only attend to causal tree ancestors.\n- **Hardware Fusion:** Eliminates intermediate global memory materialization of dense attention matrices.\n- **SRAM Staging:** Tiles $Q, K, V$ chunks directly into GPU shared memory.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [
            {
              "id": "fig_spec_s5_kernel",
              "url": "/api/workspaces/speculative-decoding-guarantees/assets/architecture.png",
              "caption": "Tree attention matrix and kernel execution."
            }
          ],
          "sourceIds": [
            "manuscript"
          ],
          "slideNotes": "Frame 5: Detail the Triton kernel implementation and how it eliminates host-device sync overheads."
        },
        {
          "id": "card_spec_s6_acceptance",
          "title": "Sequential Path Acceptance Dynamics",
          "column": null,
          "order": 5,
          "pattern": "bullets",
          "content": "How candidate tree branches are verified:\n\n- **Root-to-Leaf Traversal:** Traverses draft candidates along highest-probability prefix paths.\n- **Greedy Path Selection:** Maximizes expected accepted token count per forward pass.\n- **Mean Acceptance Length:** Reaches 4.12 accepted tokens per step on Llama-3-70B.\n- **Distribution Invariance:** Zero degradation across perplexity, GSM8K, and HumanEval.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ],
          "slideNotes": "Frame 6: Explain sequential tree traversal and empirical acceptance lengths."
        },
        {
          "id": "card_spec_s7_benchmark",
          "title": "Controlled Inference Speedup Benchmark",
          "column": null,
          "order": 6,
          "pattern": "figure-slide",
          "content": "MartingaleTree achieves 3.42x wall-clock speedup on Llama-3-70B across standard evaluation suites.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [
            {
              "id": "fig_spec_s7_bench",
              "url": "/api/workspaces/speculative-decoding-guarantees/assets/benchmark.png",
              "caption": "Controlled throughput and latency benchmark with 95% bootstrap CI."
            }
          ],
          "sourceIds": [
            "manuscript"
          ],
          "slideNotes": "Frame 7: Present the benchmark results comparing our framework against vanilla autoregression and EAGLE."
        },
        {
          "id": "card_spec_s8_martingale",
          "title": "Martingale Stopping Bounds via Ville's Inequality",
          "column": null,
          "order": 7,
          "pattern": "two-column",
          "content": "The likelihood ratio process forms a non-negative martingale:\n\n$$M_k = \\prod_{j=1}^k \\frac{p(x_{t+j} \\mid x_{<t+j})}{q(x_{t+j} \\mid x_{<t+j})}, \\quad \\mathbb{E}[M_k] = 1$$\n\nVille's Maximal Inequality:\n$$\\mathbb{P}\\left(\\sup_{k \\ge 1} M_k \\ge \\lambda\\right) \\le \\frac{1}{\\lambda}$$\n\nStopping time $\\tau = \\inf \\{k : M_k < 1 - \\delta\\}$ dynamically stops speculative branches before tail latency spikes.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ],
          "slideNotes": "Frame 8: Highlight the martingale theoretical bound. Ville's inequality provides rigorous non-asymptotic safety."
        },
        {
          "id": "card_spec_s9_ablation",
          "title": "Tail Latency & Pruning Ablation",
          "column": null,
          "order": 8,
          "pattern": "two-column",
          "content": "Ablation on stopping strategies and tree topologies:\n\n- **Unconstrained Tree Search:** p99 latency degrades to 48.6 ms under low alignment queries.\n- **With Martingale Bound:** p99 latency stabilized at 18.2 ms (62% improvement).\n- **Draft Size Tradeoff:** 1.5B draft provides optimal Pareto efficiency versus 0.5B and 3B models.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ],
          "slideNotes": "Frame 9: Discuss tail latency ablation and the stabilization delivered by Martingale stopping."
        },
        {
          "id": "card_spec_s10_memory",
          "title": "Ring-Buffer KV-Cache Management",
          "column": null,
          "order": 9,
          "pattern": "bullets-image",
          "content": "Zero-copy GPU memory management for speculative branches:\n\n- **Ring-Buffer Slot Allocation:** Candidate tokens write to pre-allocated ring-buffer slots.\n- **Transactional Commit:** Only accepted branch tokens are committed to main KV cache.\n- **Instant Rollback:** Rejected branches freed via $O(1)$ pointer reset; 0% memory fragmentation.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [
            {
              "id": "fig_spec_s10_mem",
              "url": "/api/workspaces/speculative-decoding-guarantees/assets/architecture.png",
              "caption": "Zero-copy KV-cache rollback and transaction management."
            }
          ],
          "sourceIds": [
            "manuscript"
          ],
          "slideNotes": "Frame 10: Explain the zero-copy ring-buffer memory mechanism and why it prevents CUDA memory fragmentation."
        },
        {
          "id": "card_spec_s11_limitations",
          "title": "System Constraints & Scope",
          "column": null,
          "order": 10,
          "pattern": "bullets",
          "content": "Scope of applicability and operational boundaries:\n\n- **Draft Compatibility:** Requires draft tokenizer alignment; cross-vocabulary speculation needs projection matrices.\n- **High Concurrency Saturation:** Under massive batch sizes (batch > 128), decode becomes compute-bound, reducing gains.\n- **Hardware Requirement:** Requires modern Tensor Cores (Ampere/Hopper/Blackwell) for optimal Triton kernel speed.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ],
          "slideNotes": "Frame 11: Discuss practical system constraints including high-concurrency saturation."
        },
        {
          "id": "card_spec_s12_conclusion",
          "title": "Summary & Open Artifacts",
          "column": null,
          "order": 11,
          "pattern": "bullets",
          "content": "Conclusion:\n\n- **3.42x Lossless Speedup:** Exact preservation of target model token distribution.\n- **Provable Latency Guarantees:** Martingale stopping eliminates catastrophic tail latency.\n- **Open-Source Release:** Fused Triton kernels, vLLM integration, and benchmark harnesses released.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ],
          "slideNotes": "Frame 12: Conclude with key achievements and open artifacts."
        },
        {
          "id": "card_spec_s13_refs",
          "title": "References",
          "column": null,
          "order": 12,
          "pattern": "references",
          "content": "\\cite{leviathan2023fast,chen2023accelerating,miao2024specinfer,ville1939etude}",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ],
          "slideNotes": "Frame 13: Citations and foundational literature."
        }
      ]
    },
    {
      "id": "out_spec_paper",
      "outputType": "paper",
      "templateId": "neurips",
      "title": "Speculative Decoding with Provable Latency Guarantees and Lossless Verification",
      "themeColor": "#6366F1",
      "cards": [
        {
          "id": "card_spec_p_abstract",
          "title": "Abstract",
          "column": null,
          "order": 0,
          "pattern": "section",
          "content": "Speculative decoding accelerates large language model (LLM) generation by employing a lightweight draft model to hypothesize sequences of candidate tokens, followed by parallel verification under the target foundation model. However, standard speculative decoding faces severe tail-latency bottlenecks under distribution drift, and heuristic tree search introduces unbounded verification latency. Here we introduce MartingaleTree, an exact speculative decoding architecture equipped with provable latency bounds and lossless verification. By framing the sequential acceptance of draft branches as a stopped sub-martingale, we derive dynamic pruning thresholds via Ville's inequality that terminate speculative verification before tail latency degradation occurs. Coupled with a customized fused Triton tree-attention kernel and zero-copy ring-buffer KV-cache reuse, MartingaleTree achieves a $3.42\\times$ wall-clock speedup on Llama-3-70B across MT-Bench, GSM8K, and HumanEval with strictly zero divergence from the target autoregressive token distribution ($D_{\\text{TV}} = 0.000$, $\\text{KL} = 0.000$).",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_spec_p_intro",
          "title": "Introduction",
          "column": null,
          "order": 1,
          "pattern": "section-figure",
          "content": "Large language models (LLMs) underpin transformative advances in reasoning and code generation, but their interactive deployment is severely constrained by memory bandwidth limitations \\cite{leviathan2023fast}. Autoregressive token generation loads all model weights into high-bandwidth memory for every token produced, resulting in low arithmetic intensity (<1 FLOP/byte) and high per-token latency \\cite{chen2023accelerating}. Speculative decoding breaks this memory-bandwidth bottleneck by pairing a high-capacity target model with a small draft model. While prior works explore heuristic tree topologies \\cite{miao2024specinfer}, they lack formal non-asymptotic latency guarantees, frequently degrading into worst-case tail stalls.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [
            {
              "id": "fig_spec_p_arch",
              "url": "/api/workspaces/speculative-decoding-guarantees/assets/architecture.png",
              "caption": "Figure 1: The MartingaleTree speculative decoding architecture."
            }
          ],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_spec_p_related",
          "title": "Related Work",
          "column": null,
          "order": 2,
          "pattern": "section",
          "content": "Speculative decoding was pioneered by Leviathan et al. \\cite{leviathan2023fast} and Chen et al. \\cite{chen2023accelerating}, demonstrating that modified rejection sampling guarantees exact distribution equivalence. Subsequent works expanded linear speculation into tree structures (SpecInfer \\cite{miao2024specinfer}, Medusa, EAGLE). However, these architectures rely on heuristic branch pruning based on static confidence thresholds, which fail to adapt to dynamic token entropy and lead to tail latency spikes. Martingale probability theory, rooted in Ville's classic study \\cite{ville1939etude}, provides non-asymptotic concentration bounds that have never previously been unified with speculative inference systems.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_spec_p_methods",
          "title": "Martingale Bounds & Fused Tree Verification",
          "column": null,
          "order": 3,
          "pattern": "section",
          "content": "Let $p(x_t \\mid x_{<t})$ and $q(x_t \\mid x_{<t})$ denote target and draft distributions over vocabulary $\\mathcal{V}$. Candidates are verified via rejection sampling $r_i = \\min(1, p(x_i)/q(x_i))$ with residual sampling $p_{\\text{res}}(x) = \\frac{\\max(0, p(x)-q(x))}{1 - \\sum_y \\min(p(y), q(y))}$, ensuring $D_{\\text{TV}}(P_{\\text{spec}}, P_{\\text{tgt}}) \\equiv 0$. Along any candidate branch, the likelihood ratio $M_k = \\prod_{j=1}^k \\frac{p(x_{t+j})}{q(x_{t+j})}$ forms a non-negative martingale with $\\mathbb{E}[M_k] = 1$. By Ville's inequality, $\\mathbb{P}(\\sup_{1 \\le k \\le K} M_k \\ge \\lambda) \\le 1/\\lambda$. We construct stopping rule $\\tau = \\inf \\{k : M_k < 1 - \\delta\\}$, dynamically pruning low-confidence branches. Verification is computed via a fused Triton kernel implementing causal 2D tree attention mask $M_{i,j}$.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_spec_p_experiments",
          "title": "Experimental Evaluation & Controlled Benchmark",
          "column": null,
          "order": 4,
          "pattern": "section-table",
          "content": "We evaluate MartingaleTree using Llama-3-70B-Instruct as the target foundation model and Llama-3-1.5B as the draft model on 8× NVIDIA H100 SXM5 GPUs. Benchmarking spans MT-Bench (multi-turn conversation), GSM8K (mathematical reasoning), and HumanEval (code synthesis) across 5 independent seeds.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": true,
            "caption": "Table 1: Controlled Benchmark Comparison on Llama-3-70B",
            "rows": [
              [
                "Inference Method",
                "Throughput ↑",
                "Latency ↓",
                "Peak VRAM ↓",
                "Speedup ↑"
              ],
              [
                "Autoregressive",
                "19.4 tok/s",
                "51.5 ms",
                "142 GB",
                "1.00×"
              ],
              [
                "Standard Spec (K=4)",
                "42.1 tok/s",
                "23.8 ms",
                "146 GB",
                "2.17×"
              ],
              [
                "EAGLE Tree Spec",
                "53.6 tok/s",
                "18.7 ms",
                "154 GB",
                "2.76×"
              ],
              [
                "MartingaleTree (Ours)",
                "66.3 tok/s",
                "15.1 ms",
                "147 GB",
                "3.42×"
              ]
            ]
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_spec_p_ablation",
          "title": "Ablation Studies & Latency Distribution",
          "column": null,
          "order": 5,
          "pattern": "section-two-figures",
          "content": "Ablation experiments confirm that Martingale stopping eliminates tail latency spikes without sacrificing throughput. Compared to unconstrained tree search, 99th-percentile token latency is reduced from 48.6 ms to 18.2 ms.",
          "figureLayout": "two-up",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [
            {
              "id": "fig_spec_p_b1",
              "url": "/api/workspaces/speculative-decoding-guarantees/assets/benchmark.png",
              "caption": "Throughput benchmark across draft depths."
            },
            {
              "id": "fig_spec_p_b2",
              "url": "/api/workspaces/speculative-decoding-guarantees/assets/architecture.png",
              "caption": "Speculative tree verification execution."
            }
          ],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_spec_p_discussion",
          "title": "Discussion & Systems Analysis",
          "column": null,
          "order": 6,
          "pattern": "section",
          "content": "Across 100,000 generated tokens, empirical Total Variation distance is identically 0.000, confirming zero loss in generation fidelity. Accuracy on GSM8K (92.4% vs 92.4%) and HumanEval (84.1% vs 84.1%) matches vanilla autoregressive decoding bitwise. Peak GPU memory overhead is restricted to +4.8% due to our zero-copy ring-buffer cache reuse.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_spec_p_conclusion",
          "title": "Conclusion",
          "column": null,
          "order": 7,
          "pattern": "section",
          "content": "MartingaleTree resolves the long-standing tension between speculative decoding speedup and tail-latency predictability. By establishing Ville-bounded stopping times on speculative trees, it provides a principled foundation for high-throughput foundation model deployment.",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        },
        {
          "id": "card_spec_p_refs",
          "title": "References",
          "column": null,
          "order": 8,
          "pattern": "references",
          "content": "\\cite{leviathan2023fast,chen2023accelerating,miao2024specinfer,ville1939etude}",
          "figureLayout": "single",
          "validation": "valid",
          "table": {
            "hasHeader": false,
            "caption": "",
            "rows": []
          },
          "figures": [],
          "sourceIds": [
            "manuscript"
          ]
        }
      ]
    }
  ],
  "assets": [
    {
      "id": "ast_spec_arch",
      "fileId": "architecture.png",
      "filename": "architecture.png",
      "url": "/api/workspaces/speculative-decoding-guarantees/assets/architecture.png",
      "kind": "figure",
      "page": 1,
      "confidence": "high",
      "caption": "Lossless Tree-Speculative Decoding Pipeline"
    },
    {
      "id": "ast_spec_bench",
      "fileId": "benchmark.png",
      "filename": "benchmark.png",
      "url": "/api/workspaces/speculative-decoding-guarantees/assets/benchmark.png",
      "kind": "figure",
      "page": 1,
      "confidence": "high",
      "caption": "Throughput and Latency Benchmark on Llama-3-70B"
    }
  ],
  "ingestFiles": []
}
];
export const getShowcaseById = (id: string): Project | undefined => {
  return ALL_SHOWCASE_PROJECTS.find(p => p.id === id);
};
