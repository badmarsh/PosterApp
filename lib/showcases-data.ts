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
  {
    id: "mamba-selective-ssm",
    title: "Mamba: Selective State Space Models",
    subtitle: "Input-dependent state-space scans replace quadratic attention, matching Transformers at 5× throughput on million-length sequences.",
    category: "AI & Robotics",
    tags: ["Selective SSM", "Linear-Time Models", "Hardware-aware Scan", "State Space Models", "arXiv"],
    outputs: ["poster", "slides", "paper"], accent: "#0F766E",
    highlights: [{ value: "5×", label: "inference throughput" }, { value: "1M", label: "token context" }, { value: "3B ≈ 6B", label: "vs Transformer params" }],
  },
  {
    id: "aurora-topological-photonics",
    title: "Aurora: Topological Photonic Crystals",
    subtitle: "Synthetic frequency dimensions enable non-Abelian braiding with 42 dB topological isolation.",
    category: "Physics",
    tags: ["Photonics", "Topology", "Synthetic Dimensions", "Nature"],
    outputs: ["poster", "slides", "paper"], accent: "#6C3CE0",
    highlights: [{ value: "42 dB", label: "isolation" }, { value: "0.98", label: "braiding fidelity" }, { value: "21", label: "synthetic sites" }],
  },
  {
    id: "landscape-ocean-circulation",
    title: "Landscape: AMOC Tipping Early Warning",
    subtitle: "High-resolution ocean model quantifies critical slowing down 38 years before collapse.",
    category: "Physics",
    tags: ["Climate", "Tipping Points", "Ocean", "HPC"],
    outputs: ["poster", "slides", "paper"], accent: "#0F4C75",
    highlights: [{ value: "0.32 Sv", label: "tipping threshold" }, { value: "38 yr", label: "early warning" }, { value: "0.91", label: "AUC" }],
  },
  {
    id: "betterposter-single-cell-atlas",
    title: "Betterposter: Human Cell Atlas",
    subtitle: "11.7M-cell variational atlas discovers ultra-rare niches at 0.02% frequency.",
    category: "Biomedicine",
    tags: ["scRNA-seq", "Atlas", "Trajectory", "Cell"],
    outputs: ["poster", "slides", "paper"], accent: "#E63946",
    highlights: [{ value: "11.7M", label: "cells" }, { value: "284", label: "clusters" }, { value: "0.94", label: "kBET" }],
  }]

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
  "mamba-selective-ssm",
  "aurora-topological-photonics",
  "landscape-ocean-circulation",
  "betterposter-single-cell-atlas",
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
            "content": "Two-particle Bose-Einstein correlations (BEC) of like-sign charged hadrons provide a direct space-time probe of the particle-emitting source in high-energy particle collisions.\n\n- **Quantum Interference:** Identical bosons exhibit constructive wave-function symmetrization, enhancing pairs emitted with small relative momentum ($Q \\to 0$).\n- **Space-Time Geometry:** The correlation function directly maps the spatial Fourier transform of the hadronization freeze-out region.\n- **LHC Run 2 at 13 TeV:** Highest proton-proton collision energy offers unprecedented access to ultra-high charged-particle multiplicities ($N_{\\text{ch}} \\ge 60$).\n- **Historical Context:** First observed by Goldhaber et al. (1960) in $\\bar{p}p$ annihilation; since confirmed in $e^+e^-$, $ep$, and hadronic collisions across three orders of magnitude in energy.\n- **Levy-Stable Sources:** Stretched-exponential $\\Omega(Q,R,\\alpha)=e^{-(QR)^{\\alpha}}$ with $\\alpha\\simeq0.5$ indicates a Levy stable source geometry.",
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
            "content": "**High-Multiplicity Track Trigger & Subsystems:**\n- **Inner Detector:** Pixel and Semiconductor Tracker (SCT) within a 2T solenoidal field provide precision vertex reconstruction.\n- **Tile Calorimeter (TileCal):** Steel/scintillating-tile sampling calorimeter for jet energy measurement and minimum-bias trigger verification.\n- **Dataset:** 151 $\\mu\\text{b}^{-1}$ minimum-bias and 8.4 $\\text{nb}^{-1}$ high-multiplicity trigger streams.\n- **Readout Chain:** Analogue summing boards feed 10-bit ADCs; signal integrated over 25 ns bunch-crossing window.\n- **Track Resolution:** Transverse impact-parameter resolution $\\sigma(d_0)<15\\,\\mu\\text{m}$ at $p_\\text{T}=10\\,\\text{GeV}$.",
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
            "content": "- **Primary Interaction Vertex:** Reconstructed primary vertex required with $\\ge 2$ associated tracks of transverse momentum $p_{\\text{T}} > 100\\text{ MeV}$.\n- **Kinematic Acceptance:** Full pseudorapidity coverage $|\\eta| < 2.5$, with track quality cuts requiring $\\ge 1$ Pixel hit and $\\ge 6$ SCT silicon hits.\n- **Pileup Rejection:** Low beam-luminosity operation with average pileup $\\langle \\mu \\rangle \\le 0.005$ eliminates overlapping collision events per bunch crossing.\n- **Shared-Track Cleaning:** Strict vertex association rejects secondary tracks from strange hadron decays.\n- **Efficiency Correction:** Per-track $\\varepsilon(p_\\text{T},\\eta)$ from GEANT4 simulation applied as event-weight prior to pair counting.\n- **Quality Flags:** $\\chi^2/\\text{ndf}<5$ for track fit; Pixel and SCT layer holes vetoed to suppress misreconstructed trajectories.",
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
            "content": "The two-particle correlation function is measured as the ratio of like-sign pion pairs to an uncorrelated reference sample in bins of relative momentum:\n\n$$C_2(Q) = \\frac{N(Q)}{N_{\\text{ref}}(Q)} = C_0 \\left[1 + \\lambda \\Omega(Q, R)\\right](1 + \\delta Q)$$\n\n- **Lorentz Invariant Relative Momentum:** $Q = \\sqrt{-(p_1 - p_2)^2} = \\sqrt{M^2_{\\pi\\pi} - 4m_\\pi^2}$, where $m_\\pi = 139.57\\text{ MeV}$.\n- **Source Radii $R$ & Strength $\\lambda$:** $\\Omega(Q, R) = e^{-(QR)}$ parameterizes the exponential source distribution in four dimensions.\n- **Baseline Normalization:** $C_0$ normalizes the tail ($Q > 0.8\\text{ GeV}$) while $\\delta$ models long-range phase-space correlations.\n- **Levy Extension:** $\\Omega=e^{-(QR)^{\\alpha}}$ with $\\alpha<1$ tests fractal source distributions; compared against Gaussian and exponential parametrisations.\n- **2D Analysis:** $Q_{\\text{LCMS}}$ decomposed into $Q_L$ and $Q_T$ extracting $R_L$, $R_{\\text{out}}$, $R_{\\text{side}}$ in the longitudinally co-moving system.",
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
            "content": "**Exponential Fit & Extraction of Emitter Dimensions:**\n- **Double-Exponential Superiority:** Successfully fits both the sharp core and long-range non-Gaussian tails.\n- **Emitter Radius:** Measured source radius $R = 1.42 \\pm 0.03\\,\\text{(stat)} \\pm 0.08\\,\\text{(syst)}\\text{ fm}$.\n- **Correlation Strength:** $\\lambda = 0.68 \\pm 0.02$, demonstrating partial coherence and long-lived decay contamination.\n- **Energy Evolution:** $R$ grows from $1.21\\,\\text{fm}$ at 900 GeV to $1.42\\,\\text{fm}$ at 13 TeV, consistent with $\\ln^2\\!\\sqrt{s}$ scaling.\n- **Multiplicity Scaling:** $R\\propto\\langle N_\\text{ch}\\rangle^{1/3}$ across 10 bins from $N_\\text{ch}\\le5$ to $N_\\text{ch}\\ge60$.",
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
            "content": "- **Opposite-Sign Pion Pairs:** Primary uncorrelated reference baseline after subtracting hadronic resonance contributions ($\\rho^0, \\omega, K^0_S$).\n- **Gamow Coulomb Factor:** Relativistic Coulomb interaction correction $A_{\\text{c}}(Q) = \\frac{2\\pi \\eta_c}{e^{2\\pi \\eta_c} - 1}$ with $\\eta_c = \\alpha m_\\pi / Q$ applied to like-sign and opposite-sign pairs.\n- **Mixed-Event Cross-Check:** Secondary reference constructed by pairing pions from distinct events with matching vertex positions and track multiplicities.\n- **Closure Test:** Both reference methods yield consistent $R$ and $\\lambda$ within 1.5%, confirming baseline purity.\n- **Coulomb Systematic:** Varying $\\eta_c$ by $\\pm10\\%$ shifts $R$ by less than 0.5%.",
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
            "content": "- **ATLAS Collaboration**, Eur. Phys. J. C 82, 608 (2022).\n- **G. Goldhaber et al.**, Phys. Rev. 120, 300 (1960).\n- **ATLAS TileCal Group**, JINST 9, P02008 (2014).\n- **Goldhaber et al.**, Phys. Rev. 120, 300 (1960) -- first BEC observation.\n- **Lednicky and Lyuboshitz**, Sov. J. Nucl. Phys. 35, 770 (1982) -- source formalism.",
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
            "id": "card_atlas_s1_title",
            "title": "Title",
            "pattern": "title-slide",
            "content": "Two-Particle Bose-Einstein Correlations in 13 TeV pp Collisions with ATLAS",
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
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_atlas_s2_motivation",
            "title": "Femtoscopy & Physics Motivation",
            "pattern": "bullets",
            "content": "- **Space-Time Geometry:** Two-particle Bose-Einstein correlations (BEC) measure emitter dimensions at the femtometer (10^{-15} m) scale.\n- **Wavefunction Symmetrization:** Constructive quantum interference enhances like-sign boson pairs at low relative momentum Q -> 0.\n- **LHC Run 2 at 13 TeV:** Access to highest particle densities (N_ch >= 60) in proton-proton collisions.",
            "column": null,
            "order": 1,
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
            "heightBudget": null
          },
          {
            "id": "card_atlas_s3_theory",
            "title": "Correlation Function Formulation",
            "pattern": "two-column",
            "content": "$$C_2(Q) = \\frac{N(Q)}{N_{\\text{ref}}(Q)} = C_0 [1 + \\lambda \\Omega(Q, R)](1 + \\delta Q)$$\n\n- Q: Lorentz invariant relative momentum.\n- \\Omega(Q, R) = e^{-(QR)}: exponential source distribution.\n- \\lambda: correlation strength parameter.",
            "column": null,
            "order": 2,
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
            "heightBudget": null
          },
          {
            "id": "card_atlas_s4_detector",
            "title": "ATLAS Instrumentation & TileCal",
            "pattern": "figure-slide",
            "content": "Inner Detector silicon trackers and TileCal scintillators provide track reconstruction and minimum-bias trigger verification.",
            "column": null,
            "order": 3,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_tilecal_s",
                "url": "/api/workspaces/atlas-bose-einstein-correlations/assets/fig_tilecal_module.png",
                "caption": "ATLAS Tile Calorimeter module instrumentation."
              }
            ],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_atlas_s5_selection",
            "title": "Event & Track Selection Criteria",
            "pattern": "bullets",
            "content": "- **Interaction Vertex:** Reconstructed primary vertex with >= 2 tracks of p_T > 100 MeV.\n- **Silicon Hits:** >= 1 Pixel hit and >= 6 SCT micro-strip hits across |eta| < 2.5.\n- **Low Pileup:** Run conditions with <mu> <= 0.005 eliminate vertex overlap.",
            "column": null,
            "order": 4,
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
            "heightBudget": null
          },
          {
            "id": "card_atlas_s6_coulomb",
            "title": "Reference Sample & Coulomb Corrections",
            "pattern": "two-column",
            "content": "Opposite-sign pion pairs (pi^+ pi^-) corrected by the relativistic Gamow factor serve as the primary baseline.\n\nMixed-event reference validates baseline purity.",
            "column": null,
            "order": 5,
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
            "heightBudget": null
          },
          {
            "id": "card_atlas_s7_fit",
            "title": "Correlation Fit & Radius Extraction",
            "pattern": "figure-slide",
            "content": "Measured correlation function C_2(Q) at 13 TeV fitted with double-exponential parameterization.",
            "column": null,
            "order": 6,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_bec_fit_s",
                "url": "/api/workspaces/atlas-bose-einstein-correlations/assets/fig_bec_correlation_fit.png",
                "caption": "C_2(Q) distribution and Data/Fit ratio."
              }
            ],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_atlas_s8_multiplicity",
            "title": "Multiplicity Scaling",
            "pattern": "bullets",
            "content": "- **Linear Scaling:** Source radius follows R ~ <N_ch>^{1/3} across 10 multiplicity intervals.\n- **Inclusive Value:** R = 1.42 +- 0.03 (stat) +- 0.08 (syst) fm.\n- **High Multiplicity:** Source expands to R = 2.36 +- 0.08 fm for N_ch >= 60.",
            "column": null,
            "order": 7,
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
            "heightBudget": null
          },
          {
            "id": "card_atlas_s9_systematics",
            "title": "Systematic Uncertainty Audit",
            "pattern": "bullets-table",
            "content": "Dominant uncertainties on source radius R and strength lambda:",
            "column": null,
            "order": 8,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": true,
              "caption": "Systematic errors at 13 TeV",
              "rows": [
                [
                  "Source",
                  "Delta R / R",
                  "Delta lambda / lambda"
                ],
                [
                  "Tracking Efficiency",
                  "2.1%",
                  "1.8%"
                ],
                [
                  "Reference Sample",
                  "3.4%",
                  "2.9%"
                ],
                [
                  "Coulomb Modeling",
                  "1.7%",
                  "2.2%"
                ],
                [
                  "Total Uncertainty",
                  "5.6%",
                  "5.4%"
                ]
              ]
            },
            "figures": [],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_atlas_s10_hydro",
            "title": "Collective Behavior & Flow",
            "pattern": "two-column",
            "content": "Decrease of R with increasing pair transverse momentum k_T confirms strong space-momentum correlations.\n\nConsistent with hydrodynamic expansion observed in relativistic heavy-ion collisions.",
            "column": null,
            "order": 9,
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
            "heightBudget": null
          },
          {
            "id": "card_atlas_s11_conclusion",
            "title": "Conclusions & Summary",
            "pattern": "bullets",
            "content": "- Successful measurement of BEC at the highest LHC energy of 13 TeV.\n- Clear confirmation of R ~ <N_ch>^{1/3} collective scaling in pp interactions.\n- Precision input for Lund string fragmentation and multi-parton interaction models.",
            "column": null,
            "order": 10,
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
            "heightBudget": null
          },
          {
            "id": "card_atlas_s12_refs",
            "title": "Key References",
            "pattern": "references",
            "content": "\\cite{goldhaber1960,tilecal2014,atlas2022bec,lednicky1982}",
            "column": null,
            "order": 11,
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
            "heightBudget": null
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
            "id": "card_atlas_p_abstract",
            "title": "Abstract",
            "pattern": "section",
            "content": "Two-particle Bose-Einstein correlations (BEC) of like-sign charged hadrons provide a direct space-time probe of the particle-emitting source in high-energy collisions. We present measurements in proton-proton collisions at sqrt(s) = 13 TeV with the ATLAS detector at the Large Hadron Collider. Using minimum-bias and high-multiplicity trigger streams, the correlation function C_2(Q) is measured as a function of the Lorentz-invariant momentum difference Q up to charged-particle multiplicities N_ch >= 60. An exponential emitter parameterization yields an invariant radius of R = 1.42 +- 0.03 (stat) +- 0.08 (syst) fm and correlation strength lambda = 0.68 +- 0.02. The source radius increases with charged-particle multiplicity as R ~ <N_ch>^{1/3}, consistent with hydrodynamic expansion prior to thermal freeze-out.",
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
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_atlas_p_intro",
            "title": "Introduction & Physical Motivation",
            "pattern": "section-figure",
            "content": "Femtoscopy based on two-particle Bose-Einstein correlations between identical bosons serves as a fundamental diagnostic of the space-time dimensions and coherence properties of the hadronizing source in relativistic collisions. The correlation arises from the constructive interference of symmetric wave functions for identical bosons emitted with small relative four-momentum Q. In the high-multiplicity regime of 13 TeV proton-proton interactions, particle densities approach those observed in peripheral heavy-ion collisions, enabling search for collective hydrodynamic behavior in small systems.",
            "column": null,
            "order": 1,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_tilecal",
                "url": "/api/workspaces/atlas-bose-einstein-correlations/assets/fig_tilecal_module.png",
                "caption": "Figure 1: ATLAS Tile Calorimeter instrumentation used for minimum-bias triggering and energy sampling."
              }
            ],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_atlas_p_theory",
            "title": "Bose-Einstein Correlation Formalism",
            "pattern": "section",
            "content": "The two-particle correlation function is defined experimentally as the ratio of the like-sign pair density to an uncorrelated reference distribution:\n\n$$C_2(Q) = \\frac{N(Q)}{N_{\\text{ref}}(Q)} = C_0 \\left[1 + \\lambda \\Omega(Q, R)\\right](1 + \\delta Q)$$\n\nwhere \\Omega(Q, R) = e^{-(QR)} describes an exponential source density in four dimensions. The parameter \\lambda quantifies the correlation strength, constrained by source coherence and long-lived resonance decays. The linear term (1 + \\delta Q) accounts for long-range kinematic and phase-space correlations, and C_0 is the baseline normalization factor evaluated in the tail region Q > 0.8 GeV. Non-Gaussian source profiles are also tested using the generalized Levy distribution \\Omega(Q,R,\\alpha) = e^{-(QR)^\\alpha}.",
            "column": null,
            "order": 2,
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
            "heightBudget": null
          },
          {
            "id": "card_atlas_p_detector",
            "title": "ATLAS Detector & Instrumentation",
            "pattern": "section",
            "content": "The ATLAS inner detector reconstructs charged-particle trajectories within pseudo-rapidity |eta| < 2.5 using high-granularity silicon Pixel detectors, Semiconductor Tracker (SCT) micro-strips, and a Transition Radiation Tracker (TRT) inside a 2 T axial magnetic field. Calorimetric verification and fast minimum-bias trigger confirmation are provided by the scintillating-tile TileCal barrel sampling calorimeter. The low-luminosity dataset corresponds to an integrated luminosity of 151 mub^{-1} for minimum bias and 8.4 nb^{-1} for high-multiplicity triggers, with an average pileup of <mu> <= 0.005 to suppress multiple overlapping collision vertices.",
            "column": null,
            "order": 3,
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
            "heightBudget": null
          },
          {
            "id": "card_atlas_p_selection",
            "title": "Event Selection & Reference Sample",
            "pattern": "section",
            "content": "Events are selected by requiring a primary interaction vertex formed by at least two tracks with transverse momentum p_T > 100 MeV. Track quality cuts require >= 1 hit in the insertable B-layer or innermost Pixel layer and >= 6 silicon hits. The reference distribution N_ref(Q) is constructed using opposite-sign pion pairs (pi^+ pi^-) corrected for Coulomb interaction via the Gamow factor. Resonances (rho^0, omega, K^0_S) in the opposite-sign sample are excluded by kinematic vetoes and verified against mixed-event reference baselines.",
            "column": null,
            "order": 4,
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
            "heightBudget": null
          },
          {
            "id": "card_atlas_p_results",
            "title": "Correlation Fits & Radius Extraction",
            "pattern": "section-figure",
            "content": "The correlation function C_2(Q) is fitted in the interval 0.02 < Q < 2.0 GeV using a double-exponential profile that resolves both the low-Q Bose-Einstein enhancement peak and the wide tail. The extracted parameters at 13 TeV for inclusive minimum-bias interactions are R = 1.42 +- 0.03 fm and lambda = 0.68 +- 0.02. In high-multiplicity events (N_ch >= 60), the source radius expands to R = 2.36 +- 0.08 fm, demonstrating a systematic increase with the cube root of charged-particle density.",
            "column": null,
            "order": 5,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_bec_fit",
                "url": "/api/workspaces/atlas-bose-einstein-correlations/assets/fig_bec_correlation_fit.png",
                "caption": "Figure 2: Measured two-particle correlation function C_2(Q) at 13 TeV with double-exponential fit and Data/Fit ratio."
              }
            ],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_atlas_p_systematics",
            "title": "Multiplicity Scaling & Systematic Uncertainties",
            "pattern": "section-table",
            "content": "Systematic uncertainties on the extracted radius R and correlation strength lambda were evaluated by varying track reconstruction requirements, reference sample definition, Coulomb Gamow factor, and fit ranges:",
            "column": null,
            "order": 6,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": true,
              "caption": "Table 1: Systematic uncertainty breakdown for source radius R and correlation strength lambda.",
              "rows": [
                [
                  "Uncertainty Component",
                  "Delta R / R (%)",
                  "Delta lambda / lambda (%)"
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
                  "Fit Range Variation",
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
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_atlas_p_discussion",
            "title": "Discussion: Space-Time Freeze-Out Dynamics",
            "pattern": "section",
            "content": "The scaling R ~ <N_ch>^{1/3} confirms the geometric expansion of the hadronizing volume prior to freeze-out, consistent with hydrodynamic models developed for heavy-ion collisions. Furthermore, the transverse momentum dependence shows a monotonic decrease of R with increasing average pair k_T, direct evidence of strong space-momentum correlations induced by collective radial flow.",
            "column": null,
            "order": 7,
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
            "heightBudget": null
          },
          {
            "id": "card_atlas_p_refs",
            "title": "References",
            "pattern": "references",
            "content": "\\cite{goldhaber1960,tilecal2014,atlas2022bec,lednicky1982}",
            "column": null,
            "order": 8,
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
            "heightBudget": null
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
            "id": "card_q_s1_title",
            "title": "Title",
            "pattern": "title-slide",
            "content": "Quantum Supremacy on 53-Qubit Sycamore",
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
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_q_s2_supremacy",
            "title": "The Supremacy Horizon",
            "pattern": "bullets",
            "content": "- **Milestone:** First demonstration of a computational task executed exponentially faster on a quantum processor.\n- **Sycamore Run Time:** 200 seconds to sample 1,000,000 bitstrings.\n- **Classical Supercomputer (Summit):** Estimated 10,000 years for equivalent task.",
            "column": null,
            "order": 1,
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
            "heightBudget": null
          },
          {
            "id": "card_q_s3_chip",
            "title": "Sycamore Processor Architecture",
            "pattern": "figure-slide",
            "content": "53 functional transmon qubits arranged in a 2D square lattice with 86 adjustable couplers.",
            "column": null,
            "order": 2,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_q_chip_s",
                "url": "/api/workspaces/quantum-supremacy-sycamore/assets/fig_sycamore_chip.png",
                "caption": "Sycamore processor die layout."
              }
            ],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_q_s4_rcs",
            "title": "Random Circuit Sampling Protocol",
            "pattern": "two-column",
            "content": "Generates pseudo-random quantum superposition across 2^{53} ~ 9 x 10^{15} Hilbert dimensions.\n\n- Alternating single-qubit gates and 2-qubit couplers.\n- Reaches Porter-Thomas distribution in 20 cycles.",
            "column": null,
            "order": 3,
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
            "heightBudget": null
          },
          {
            "id": "card_q_s5_gates",
            "title": "Gate Fidelities & Calibration",
            "pattern": "bullets",
            "content": "- **Single-Qubit Gates:** Average Pauli error 0.15% in 25 ns.\n- **Two-Qubit Gates:** Average error 0.36% in 32 ns.\n- **Readout Fidelity:** 96.2% single-shot discrimination.",
            "column": null,
            "order": 4,
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
            "heightBudget": null
          },
          {
            "id": "card_q_s6_xeb",
            "title": "Linear Cross-Entropy Benchmarking",
            "pattern": "two-column",
            "content": "$$F_{\\text{XEB}} = 2^n \\langle P(x) \\rangle - 1$$\n\nStatistical metric measuring correlation between experimental samples and classical probabilities.",
            "column": null,
            "order": 5,
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
            "heightBudget": null
          },
          {
            "id": "card_q_s7_fidelity_curve",
            "title": "Measured Fidelity vs. Circuit Depth",
            "pattern": "figure-slide",
            "content": "Cross-entropy fidelity maintained across increasing circuit depth up to 53 qubits and 20 cycles.",
            "column": null,
            "order": 6,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_xeb_s",
                "url": "/api/workspaces/quantum-supremacy-sycamore/assets/fig_xeb_fidelity.png",
                "caption": "XEB fidelity curve."
              }
            ],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_q_s8_classical_limit",
            "title": "Sycamore vs. Summit Supercomputer",
            "pattern": "bullets-table",
            "content": "Computational benchmark comparison:",
            "column": null,
            "order": 7,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": true,
              "caption": "Runtime comparison",
              "rows": [
                [
                  "Platform",
                  "Algorithm",
                  "Time",
                  "Power"
                ],
                [
                  "Sycamore",
                  "Quantum Sampling",
                  "200 s",
                  "15 kW"
                ],
                [
                  "Summit Supercomputer",
                  "Full Simulation",
                  "10,000 years",
                  "14 MW"
                ]
              ]
            },
            "figures": [],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_q_s9_error_model",
            "title": "Independence of Gate Errors",
            "pattern": "two-column",
            "content": "System fidelity matches the non-interacting product of constituent gate fidelities.\n\nProves that correlated multi-qubit decoherence does not invalidate scalability.",
            "column": null,
            "order": 8,
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
            "heightBudget": null
          },
          {
            "id": "card_q_s10_verification",
            "title": "Classical Verification Protocol",
            "pattern": "bullets",
            "content": "- Verified on simplified and patch circuits where classical simulation is feasible.\n- Continuous extrapolation confirms fidelity in the classically intractable supremacy regime.\n- Statistical confidence exceeds 5 sigma.",
            "column": null,
            "order": 9,
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
            "heightBudget": null
          },
          {
            "id": "card_q_s11_outlook",
            "title": "Roadmap to Fault-Tolerance",
            "pattern": "bullets",
            "content": "- Sycamore establishes the precision baseline required for surface code logical qubits.\n- Next step: scalable quantum error correction with physical-to-logical error suppression.\n- Foundation for quantum chemistry, materials simulation, and cryptography.",
            "column": null,
            "order": 10,
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
            "heightBudget": null
          },
          {
            "id": "card_q_s12_refs",
            "title": "References",
            "pattern": "references",
            "content": "\\cite{arute2019,boixo2018,preskill2018,feynman1982}",
            "column": null,
            "order": 11,
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
            "heightBudget": null
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
            "id": "card_q_p_abstract",
            "title": "Abstract",
            "pattern": "section",
            "content": "The promise of quantum computers is that certain computational tasks might be executed exponentially faster on a quantum processor than on a classical supercomputer. We demonstrate quantum supremacy using a programmable superconducting processor with 53 active qubits. Our processor, named Sycamore, takes approximately 200 seconds to sample one instance of a quantum circuit one million times. In comparison, a state-of-the-art classical supercomputer would require approximately 10,000 years to execute the equivalent task. The cross-entropy benchmarking fidelity exceeds 0.1% with high statistical significance, establishing experimental evidence that the computational complexity of quantum mechanics can be harnessed in physical hardware.",
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
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_q_p_intro",
            "title": "Introduction & Computational Complexity",
            "pattern": "section-figure",
            "content": "A computational task that is verifiable in polynomial time but intractable for classical computers provides the operational benchmark for quantum computational supremacy. Random Circuit Sampling (RCS) generates pseudo-random quantum states in an exponentially large Hilbert space (2^{53} ~ 9.0 x 10^{15} dimensions). In this regime, classical state-vector simulation suffers from memory bottlenecks and exponential tensor-network contraction costs.",
            "column": null,
            "order": 1,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_sycamore_chip",
                "url": "/api/workspaces/quantum-supremacy-sycamore/assets/fig_sycamore_chip.png",
                "caption": "Figure 1: Sycamore superconducting quantum processor chip layout with 53 transmon qubits in a 2D square lattice."
              }
            ],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_q_p_architecture",
            "title": "Processor Architecture & Qubit Control",
            "pattern": "section",
            "content": "The Sycamore processor comprises a 2D array of 54 transmon qubits interconnected in a square lattice with 86 adjustable couplers (one qubit was inoperative, leaving 53 active). Each transmon qubit has two inductive Josephson junctions forming a SQUID loop, enabling fast flux tuning of the qubit transition frequency between 5 and 7 GHz. The adjustable couplers allow dynamic tuning of the effective inter-qubit exchange coupling from 0 to 40 MHz, eliminating parasitic crosstalk during single-qubit gates.",
            "column": null,
            "order": 2,
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
            "heightBudget": null
          },
          {
            "id": "card_q_p_gates",
            "title": "Gate Calibration & Fast Flux Control",
            "pattern": "section",
            "content": "Single-qubit microwave driving gates (25 ns) are executed simultaneously with an average Pauli error of 0.15%. Two-qubit entangling gates are realized via an adjustable iSWAP-like fermionic simulation gate (fSim) executed in 32 ns with a mean error of 0.36%. Readout is performed via frequency-multiplexed superconducting resonators with single-shot discrimination fidelity of 96.2%.",
            "column": null,
            "order": 3,
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
            "heightBudget": null
          },
          {
            "id": "card_q_p_rcs",
            "title": "Random Circuit Sampling Protocol",
            "pattern": "section",
            "content": "Each cycle of the RCS benchmark consists of applying single-qubit gates randomly chosen from {sqrt(X), sqrt(Y), sqrt(W)} followed by two-qubit entangling couplers applied in a four-pattern alternating cycle (A, B, C, D). As circuit depth m increases from 12 to 20 cycles, quantum entanglement spreads across all 53 qubits, producing Porter-Thomas output state distributions.",
            "column": null,
            "order": 4,
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
            "heightBudget": null
          },
          {
            "id": "card_q_p_fidelity",
            "title": "Cross-Entropy Benchmarking (XEB)",
            "pattern": "section-figure",
            "content": "To verify circuit execution, we compute the linear cross-entropy benchmarking (XEB) fidelity:\n\n$$F_{\\text{XEB}} = 2^n \\langle P(x) \\rangle - 1$$\n\nwhere P(x) is the probability of bitstring x computed from classical simulation. For the full 53-qubit, 20-cycle circuit, we measure F_XEB = (0.224 +- 0.021)%, demonstrating that the quantum processor maintains phase coherence throughout the multi-qubit computational volume.",
            "column": null,
            "order": 5,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_xeb_fidelity",
                "url": "/api/workspaces/quantum-supremacy-sycamore/assets/fig_xeb_fidelity.png",
                "caption": "Figure 2: Linear cross-entropy benchmarking fidelity across circuit depths up to 20 cycles for 53 qubits."
              }
            ],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_q_p_supercomputer",
            "title": "Classical Supercomputer Benchmarks",
            "pattern": "section-table",
            "content": "Classical simulation complexity was validated on the Summit supercomputer at Oak Ridge National Laboratory using tensor contraction and Schrodinger-Feynman algorithms:",
            "column": null,
            "order": 6,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": true,
              "caption": "Table 1: Execution time and memory requirements for Sycamore vs. Summit classical supercomputer.",
              "rows": [
                [
                  "Architecture",
                  "Qubits",
                  "Circuit Depth",
                  "Sampling Time",
                  "Energy / Power"
                ],
                [
                  "Sycamore Processor",
                  "53",
                  "20 cycles",
                  "200 seconds",
                  "~15 kW (cryostat)"
                ],
                [
                  "Summit (Tensor Network)",
                  "53",
                  "14 cycles (elided)",
                  "2 hours",
                  "~14 MW"
                ],
                [
                  "Summit (Full State-Vector)",
                  "53",
                  "20 cycles",
                  "10,000 years (est.)",
                  "~1.2 TWh"
                ],
                [
                  "Summit (qsim S-F hybrid)",
                  "53",
                  "20 cycles",
                  "Several days (disk)",
                  "~500 MWh"
                ]
              ]
            },
            "figures": [],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_q_p_discussion",
            "title": "Error Independence & Fault-Tolerance Path",
            "pattern": "section",
            "content": "Crucially, the total circuit fidelity agrees with the product of individual gate and readout fidelities (product e_i). This proves that no catastrophic multi-body decoherence mechanisms emerge as the quantum system scales to 53 qubits, validating the physical assumptions underlying quantum error correction and the surface code.",
            "column": null,
            "order": 7,
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
            "heightBudget": null
          },
          {
            "id": "card_q_p_refs",
            "title": "References",
            "pattern": "references",
            "content": "\\cite{arute2019,boixo2018,preskill2018,feynman1982}",
            "column": null,
            "order": 8,
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
            "heightBudget": null
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
            "content": "Proteins fold into complex 3D atomic structures that dictate biological catalytic function.\n\n- **Levinthal Paradox:** Polypeptide chains possess astronomical conformational search spaces ($10^{300}$ states), yet fold spontaneously in milliseconds.\n- **CASP Stagnation:** Computational approaches hovered at 40-50 GDT score for two decades.\n- **Atomic Breakthrough:** AlphaFold 2 achieves a median score of 92.4 GDT, rivaling experimental Cryo-EM and X-ray crystallographic accuracy.\n- **MSA Depth:** Alignments of up to 16,384 homologous sequences provide deep covariation signals encoding co-evolutionary residue-pair constraints.\n- **Template Search:** HHsearch retrieves up to 4 structural templates projected into the pair representation before Evoformer iterations.\n- **Physics Prior:** Invariant Point Attention (IPA) operates on backbone frames; FAPE auxiliary losses penalise bond-length, bond-angle, and steric clashes.",
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
            "id": "card_af_s1_title",
            "title": "Title",
            "pattern": "title-slide",
            "content": "AlphaFold 2: Accurate Protein Structure Prediction",
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
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_af_s2_challenge",
            "title": "The 50-Year Biological Mystery",
            "pattern": "bullets",
            "content": "- **The Problem:** How does an amino acid sequence fold into a functional 3D molecular machine?\n- **Experimental Limitations:** X-ray crystallography and Cryo-EM require months to years per structure.\n- **The Breakthrough:** AlphaFold 2 achieves atomic-level accuracy computationally.",
            "column": null,
            "order": 1,
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
            "heightBudget": null
          },
          {
            "id": "card_af_s3_evoformer",
            "title": "Evoformer Architecture",
            "pattern": "figure-slide",
            "content": "Iterative reasoning between multiple sequence alignments (MSA) and spatial pair representations.",
            "column": null,
            "order": 2,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_evo_s",
                "url": "/api/workspaces/alphafold-protein-folding/assets/fig_evoformer_arch.png",
                "caption": "Evoformer architecture layout."
              }
            ],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_af_s4_axial_attn",
            "title": "Axial Attention & Triangle Updates",
            "pattern": "two-column",
            "content": "Row-wise and column-wise attention captures evolutionary covariation.\n\nTriangle inequality updates enforce consistent 3D distances in the pair representation.",
            "column": null,
            "order": 3,
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
            "heightBudget": null
          },
          {
            "id": "card_af_s5_ipa",
            "title": "Invariant Point Attention (IPA)",
            "pattern": "two-column",
            "content": "Operates directly on residue rigid-body frames (R_i, x_i) in SE(3).\n\nPreserves physical invariance under global rotation and translation.",
            "column": null,
            "order": 4,
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
            "heightBudget": null
          },
          {
            "id": "card_af_s6_loss",
            "title": "Frame Aligned Point Error (FAPE)",
            "pattern": "bullets",
            "content": "- Directly penalizes coordinate error in local reference frames.\n- Robust to domain hinge motions and global rigid shifts.\n- Combined with auxiliary side-chain and backbone angle losses.",
            "column": null,
            "order": 5,
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
            "heightBudget": null
          },
          {
            "id": "card_af_s7_casp14",
            "title": "CASP14 Blind Assessment Accuracy",
            "pattern": "figure-slide",
            "content": "AlphaFold predictions match experimental crystal structures with sub-angstrom accuracy.",
            "column": null,
            "order": 6,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_casp_s",
                "url": "/api/workspaces/alphafold-protein-folding/assets/fig_casp14_predictions.png",
                "caption": "CASP14 overlay of predicted vs. ground-truth structures."
              }
            ],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_af_s8_table",
            "title": "Benchmark Comparison on Difficult Targets",
            "pattern": "bullets-table",
            "content": "CASP14 Free Modeling evaluation:",
            "column": null,
            "order": 7,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": true,
              "caption": "CASP14 results",
              "rows": [
                [
                  "Model",
                  "Median GDT",
                  "RMSD"
                ],
                [
                  "AlphaFold 2",
                  "92.4",
                  "0.96 A"
                ],
                [
                  "RoseTTAFold",
                  "74.8",
                  "1.92 A"
                ],
                [
                  "Zhang Lab",
                  "67.1",
                  "2.61 A"
                ]
              ]
            },
            "figures": [],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_af_s9_uncertainty",
            "title": "Per-Residue Confidence Estimation",
            "pattern": "two-column",
            "content": "pLDDT score (0-100) predicts local coordinate accuracy.\n\nPredicted Aligned Error (PAE) matrices identify relative domain orientations.",
            "column": null,
            "order": 8,
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
            "heightBudget": null
          },
          {
            "id": "card_af_s10_proteome",
            "title": "The AlphaFold Protein Database",
            "pattern": "bullets",
            "content": "- 200M+ structures predicted across human, bacterial, plant, and viral proteomes.\n- Open-access structural biology resource freely available to the global scientific community.\n- Accelerates drug discovery, protein engineering, and enzyme design.",
            "column": null,
            "order": 9,
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
            "heightBudget": null
          },
          {
            "id": "card_af_s11_impact",
            "title": "Impact on Modern Science",
            "pattern": "bullets",
            "content": "- Solves protein complex structures and macromolecular assemblies.\n- Illuminates orphan genes and uncharacterized disease variants.\n- Foundation for generative de novo protein design (RFdiffusion, AlphaFold 3).",
            "column": null,
            "order": 10,
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
            "heightBudget": null
          },
          {
            "id": "card_af_s12_refs",
            "title": "References",
            "pattern": "references",
            "content": "\\cite{jumper2021,senior2020,baek2021,anfinsen1973}",
            "column": null,
            "order": 11,
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
            "heightBudget": null
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
            "id": "card_af_p_abstract",
            "title": "Abstract",
            "pattern": "section",
            "content": "Proteins are essential to life, and understanding their structure can provide key insights into their function. Despite decades of effort, determining protein structures experimentally has remained laborious and costly. Here we demonstrate AlphaFold 2, a computational method that predicts protein 3D structures with atomic accuracy even when no homologous structure is known. Validated blindly at the 14th Critical Assessment of Structure Prediction (CASP14), our model achieved a median backbone accuracy of 0.96 A r.m.s.d. and an overall global distance test (GDT_TS) score of 92.4, rivaling crystallographic experimental resolution. The architecture combines an Evoformer that reasons jointly about evolutionary sequences and spatial relationships with an Invariant Point Attention structure module.",
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
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_af_p_intro",
            "title": "Introduction & The 50-Year Grand Challenge",
            "pattern": "section-figure",
            "content": "Since Christian Anfinsen's 1972 Nobel lecture postulating that amino acid sequence uniquely determines 3D native structure, computational protein folding has represented a central challenge in structural biology. AlphaFold 2 resolves this bottleneck by integrating deep learning directly with physical and evolutionary constraints, processing multi-sequence alignments and pair representations simultaneously.",
            "column": null,
            "order": 1,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_evoformer_arch",
                "url": "/api/workspaces/alphafold-protein-folding/assets/fig_evoformer_arch.png",
                "caption": "Figure 1: Evoformer architecture with coupled row/column MSA attention and triangle spatial updates."
              }
            ],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_af_p_msa",
            "title": "Evolutionary Covariation & MSA Processing",
            "pattern": "section",
            "content": "Co-variation between amino acid positions across evolution reflects spatial contact constraints in the folded structure. AlphaFold constructs multiple sequence alignments (MSAs) containing up to 16,384 homologous sequences extracted from UniRef90 and BFD. Rather than summarizing the MSA into a static covariance matrix, the MSA representation is maintained and iteratively refined alongside a 2D pair representation.",
            "column": null,
            "order": 2,
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
            "heightBudget": null
          },
          {
            "id": "card_af_p_evoformer",
            "title": "The Evoformer Architecture",
            "pattern": "section",
            "content": "The Evoformer block consists of 48 stacked transformer-like layers that exchange information bidirectionally between the MSA representation (s x r) and pair representation (r x r). It incorporates axial self-attention, outer-product mean pooling, and triangle updates (multiplicative updates and triangle self-attention) that enforce geometric triangle inequality constraints on predicted inter-residue distances.",
            "column": null,
            "order": 3,
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
            "heightBudget": null
          },
          {
            "id": "card_af_p_ipa",
            "title": "Invariant Point Attention (IPA) Structure Module",
            "pattern": "section",
            "content": "The Structure Module operates directly on 3D Euclidean coordinates using rigid-body frames for each residue backbone (R_i, x_i) in SE(3). Invariant Point Attention (IPA) computes attention over coordinate frames that are invariant under global rotations and translations, iteratively updating residue orientations and positions without generating unphysical bond geometries.",
            "column": null,
            "order": 4,
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
            "heightBudget": null
          },
          {
            "id": "card_af_p_casp14",
            "title": "CASP14 Blind Assessment Performance",
            "pattern": "section-figure",
            "content": "In the CASP14 blind assessment, AlphaFold 2 placed first among all participating groups by an unprecedented margin, achieving high-accuracy predictions across both template-based modeling (TBM) and free modeling (FM) categories.",
            "column": null,
            "order": 5,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_casp14_predictions",
                "url": "/api/workspaces/alphafold-protein-folding/assets/fig_casp14_predictions.png",
                "caption": "Figure 2: CASP14 blind assessment comparison of AlphaFold predictions (blue) with experimental structures (green)."
              }
            ],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_af_p_benchmarks",
            "title": "Comparative Benchmark on Difficult Targets",
            "pattern": "section-table",
            "content": "Comparison on CASP14 Free Modeling (FM) targets with no known structural homologs:",
            "column": null,
            "order": 6,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": true,
              "caption": "Table 1: Benchmark evaluation on CASP14 difficult protein targets.",
              "rows": [
                [
                  "Pipeline",
                  "Median GDT_TS",
                  "All-Atom RMSD (A)",
                  "Backbone RMSD (A)"
                ],
                [
                  "AlphaFold 2",
                  "92.4",
                  "1.46",
                  "0.96"
                ],
                [
                  "Baker Lab (RoseTTAFold)",
                  "74.8",
                  "2.84",
                  "1.92"
                ],
                [
                  "Bhattacharya Group",
                  "68.2",
                  "3.62",
                  "2.45"
                ],
                [
                  "Zhang Lab",
                  "67.1",
                  "3.85",
                  "2.61"
                ],
                [
                  "Standard Homology Baseline",
                  "42.3",
                  "7.12",
                  "5.40"
                ]
              ]
            },
            "figures": [],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_af_p_discussion",
            "title": "Confidence Metrics & Biological Impact",
            "pattern": "section",
            "content": "AlphaFold provides well-calibrated per-residue confidence estimates (pLDDT, 0-100) and Predicted Aligned Error (PAE) matrices to distinguish rigid functional domains from intrinsically disordered regions. This enables genome-scale structural annotation, covering over 200 million protein structures across the tree of life.",
            "column": null,
            "order": 7,
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
            "heightBudget": null
          },
          {
            "id": "card_af_p_refs",
            "title": "References",
            "pattern": "references",
            "content": "\\cite{jumper2021,senior2020,baek2021,anfinsen1973}",
            "column": null,
            "order": 8,
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
            "heightBudget": null
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
            "id": "card_pos_review_meta",
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
            "id": "card_pos_review_goals",
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
            "id": "card_pos_review_theory",
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
            "id": "card_pos_review_experiments",
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
            "id": "card_pos_review_questions",
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
            "id": "card_pos_review_conclusion",
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
            "content": "An attention function maps queries $Q$, keys $K$, and values $V$ to output vectors:\n\n$$\\text{Attention}(Q,K,V) = \\text{softmax}\\left(\\frac{QK^\\top}{\\sqrt{d_k}}\\right)V$$\n\n- **Why Scale by $1/\\sqrt{d_k}$?** For large dimensions ($d_k=64$), dot products grow large, pushing softmax into vanishing gradient regions. Scaling preserves variance 1 and numerical stability.\n- **Matrix Parallelism:** Evaluated on entire sequences simultaneously via highly optimized matrix multiplication routines.\n- **Causal Masking:** Decoder self-attention masks future positions with $-\\infty$ to preserve autoregressive factorization.\n- **Complexity Trade-off:** $O(n^2 d)$ vs. recurrent $O(nd^2)$; for NLP sequences the quadratic-in-sequence term is manageable and enables full training parallelism.\n- **Kernel Approximations:** Performers and Linformer reduce to $O(n)$ via random features, but the original softmax remains dominant for translation quality.",
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
            "content": "Since self-attention contains no recurrence or convolution, sequence order information is injected via sinusoidal positional functions:\n\n$$PE_{(pos, 2i)} = \\sin(pos / 10000^{2i/d_{\\text{model}}}), \\quad PE_{(pos, 2i+1)} = \\cos(pos / 10000^{2i/d_{\\text{model}}})$$\n\n- **Relative Offset Invariance:** Enables the model to attend by relative positions since for any fixed offset $k$, $PE_{pos+k}$ is a linear function of $PE_{pos}$.\n- **Generalization to Arbitrary Lengths:** Allows the network to extrapolate to longer sequences than encountered during training without adding learnable weights.\n- **Learned Alternative:** Learned position embeddings yield near-identical WMT14 EN-DE BLEU, confirming uniqueness matters more than the specific encoding form.\n- **Relative Bias:** Modern successors (RoPE, ALiBi) encode relative positions, improving length extrapolation beyond the training window.",
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
            "content": "- **Two Linear Transformations:** Applied to each position separately:\n$$\\text{FFN}(x) = \\max(0, xW_1 + b_1)W_2 + b_2$$\n- **Inner Dimensionality:** Hidden dimension $d_{ff} = 2048$, with ReLU activation function.\n- **Position-Wise Operation:** The same two-layer MLP applies identically at every position, providing non-linear per-token mixing complementary to linear attention.\n- **Ablation:** Removing FFN sub-layers while keeping attention reduces WMT14 EN-DE BLEU by 2.1 points.",
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
            "content": "**WMT 2014 Translation Benchmarks:**\n- **WMT 2014 English-to-German:** 28.4 BLEU, improving by +2.0 BLEU over previous state-of-the-art.\n- **WMT 2014 English-to-French:** 41.0 BLEU, establishing a new record.\n- **Training Compute:** Trained in 3.5 days on 8 P100 GPUs, a fraction of previous RNN costs.\n- **Byte-Pair Encoding:** Shared 37000-token BPE vocabulary enables open-vocabulary translation without unknown-word heuristics.\n- **Label Smoothing:** $\\varepsilon_{ls}=0.1$ prevents overconfident distributions, simultaneously improving BLEU and perplexity.",
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
            "content": "- **Foundation of Modern LLMs:** Direct ancestor of GPT-4, Claude, Gemini, LLaMA, and Vision Transformers.\n- **Scaling Law Hypothesis:** Constant path length enables massive parameter scaling with predictable empirical gains.\n- **Acceptance-Rejection Theorem:** Each candidate token accepted with probability $\\min(1,q/p)$; preserves token-level marginal distributions exactly.\n- **Martingale Bound:** Acceptance tree forms a martingale; optional stopping theorem yields provable latency guarantees independent of draft quality.\n- **Empirical Acceptance Rate:** 82% on coding tasks and 74% on open-domain generation when using a 7B Llama-3 draft for a 70B target.",
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
            "content": "- **3-Layer Stack:** Uses $1\\times 1$, $3\\times 3$, and $1\\times 1$ convolutions for ResNet-50/101/152.\n- **Dimension Reduction:** $1\\times 1$ layers reduce and then restore dimensions, leaving the $3\\times 3$ layer with smaller input/output channels.\n- **Parameter Efficiency:** ResNet-50 uses 25.6M parameters for 24.7% top-1 error vs. VGG-16 at 138M parameters for 28.1% -- a 5.4x reduction for better accuracy.\n- **Projection Shortcuts:** $1\\times1$ convolutions match channel dimensions across stages with negligible extra computation.",
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
            "content": "- **Residual Paradigm:** Residual shortcuts are now universally used in Transformers, ConvNeXts, and Diffusion models.\n- **Extreme Depth:** Demonstrated that networks can scale to 100+ layers without optimization degradation.\n- **Architectural DNA:** Skip connections are universal in Transformers, ConvNeXts, and Stable Diffusion U-Nets -- the most impactful single architectural innovation of the deep-learning era.\n- **Theoretical Insight:** Residual learning enables implicit ensembling over shallower sub-networks, explaining monotonic improvement with depth.",
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
            "content": "Standard language models (such as OpenAI GPT) were strictly unidirectional, constrained to left-to-right attention.\n\n- **Suboptimal for Token-Level Tasks:** Question answering and Named Entity Recognition require incorporating context from *both* directions simultaneously.\n- **BERT Solution:** Pre-trains deep bidirectional representations from unlabelled text by jointly conditioning on left and right context across all attention layers.\n- **Bidirectional vs. Unidirectional:** GPT processes tokens left-to-right only; ELMo shallowly concatenates LR and RL LSTMs. BERT solves true bidirectionality via masked prediction without causal constraints.\n- **Corpus Scale:** Trained on BooksCorpus (800M words) and English Wikipedia (2,500M words) for 1M gradient steps on 64 TPU v3 chips.",
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
            "content": "- **80.5%** GLUE Benchmark Score | +7.7% absolute gain over prior state-of-the-art\n- **93.2** SQuAD 1.1 F1 Score | Surpasses human performance (91.2 F1)\n- **340M** Parameters (Large) | 24 layers, 1024 hidden size, 16 attention heads\n- **11 NLP Tasks** New SOTA | Universal fine-tuning with zero task-specific architectures\n- **BERT-Large:** 24 layers, $d_{\\text{model}}=1024$, 16 attention heads, 340M parameters.\n- **BERT-Base:** 12 layers, $d_{\\text{model}}=768$, 12 heads, 110M parameters -- already surpasses GPT on all GLUE benchmarks.",
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
            "content": "- **WordPiece Tokenization:** 30,000 token vocabulary handling out-of-vocabulary words via subwords.\n- **Segment Embeddings:** Distinguishes sentence pair inputs $(A, B)$ separated by $[\\text{SEP}]$ boundary markers.\n- **Position Embeddings:** Learned position encodings supporting sequences up to 512 input tokens.\n- **Summed Embeddings:** Input representation is the element-wise sum of token, segment, and positional embeddings.\n- **Segment Embedding:** Distinguishes Sentence A vs. Sentence B in NSP, enabling sentence-pair reasoning for QA, NLI, and paraphrase detection.\n- **Positional Embedding:** Learned (not sinusoidal), supporting sequences up to 512 tokens, with a separate embedding vector per position.",
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
            "content": "**Novel Self-Supervised Pre-training Tasks:**\n- **Masked Language Model (MLM):** Masks 15% of input tokens at random (80% [MASK], 10% random token, 10% unchanged). Prevents words from attending to themselves in deep bidirectional layers.\n- **Next Sentence Prediction (NSP):** Binary classification predicting whether Sentence B logically follows Sentence A.\n- **NSP Utility:** Downstream tasks such as SQuAD and MultiNLI benefit from sentence-pair reasoning learned during NSP.\n- **Masking Rate:** 15% of tokens masked; of those, 80% replaced with [MASK], 10% with random token, 10% left unchanged to close pre-train/fine-tune mismatch.",
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
            "content": "- **Single-Sentence Classification:** Feeds final $[\\text{CLS}]$ hidden vector $C \\in \\mathbb{R}^H$ into a classification layer with weights $W \\in \\mathbb{R}^{K \\times H}$ to compute cross-entropy loss $\\log(\\text{softmax}(CW^\\top))$.\n- **Question Answering (SQuAD):** Introduces start vector $S$ and end vector $E$; probability of word $i$ being start of answer span is $P_i = \\frac{e^{S \\cdot T_i}}{\\sum_j e^{S \\cdot T_j}}$.\n- **Named Entity Recognition (NER):** Final hidden representations $T_i$ for each token are fed directly into a linear classification layer over NER label set without CRF.\n- **Minimal Fine-Tuning Overhead:** All model parameters are fine-tuned jointly end-to-end within 2-4 epochs on a single Cloud TPU (minutes to hours).\n- **Task-Specific Heads:** A single linear layer on [CLS] or per-token representations handles classification, tagging, QA span extraction, and paraphrase scoring -- no architectural changes needed.\n- **Few-Shot Efficiency:** With only 1,000 fine-tuning examples, BERT-Large outperforms full task-specific architectures trained on the complete dataset.",
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
            "content": "**Dominance Across Diverse NLU Benchmarks:**\n- Outperforms all prior models across all 9 GLUE benchmark tasks.\n- Large gains on Multi-Genre NLI (MNLI matched 86.7%), Question NLI (QNLI 92.7%), and MRPC (88.9% F1).\n- Achieves +7.7% absolute average improvement over OpenAI GPT and ELMo baselines.\n- **CoNLL-2003 NER:** 92.8 F1 (BERT-Large) vs. 90.1 (GPT), demonstrating token-level representation superiority for sequence labeling.\n- **Legacy:** BERT's masked objective directly inspired RoBERTa, DeBERTa, ALBERT, XLNet, and multilingual mBERT, now deployed across all major NLP production systems.",
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
            "content": "- **The Pre-train & Fine-tune Era:** Replaced specialized task engineering with general pre-trained bidirectional representations.\n- **Bidirectional Context:** Demonstrated that joint left-and-right conditioning is essential for deep language comprehension.\n- **Foundation for Modern NLP:** Established the dominant encoder architecture for search ranking, dense retrieval, and intent classification.\n- **Model Scale Validation:** Validated that larger models yield substantial improvements on small downstream tasks without overfitting.\n- **Key Insight:** Pre-training acts as a Bayesian prior: pretrained weights encode structural language knowledge that prevents overfitting even when fine-tuning data is scarce.\n- **Computational Cost:** BERT-Large fine-tuning on GLUE tasks requires only 16 TPU-hours -- three orders of magnitude less than pre-training from scratch.",
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
            "content": "- **The Counterfeiter & Police Analogy:** $G$ acts as counterfeiters producing fake currency; $D$ acts as police detecting fakes.\n- **Competition Breeds Quality:** Competition drives both models to improve until counterfeit currency is indistinguishable from genuine currency.\n- **Direct Backpropagation:** Both models are trained simultaneously with conventional backpropagation and dropout.\n- **No Approximate Inference:** Bypasses Markov chain sampling and variational bounds entirely.\n- **Training Signal:** Discriminator output $D(x)$ provides a rich, differentiable signal to $G$ via backpropagation through $D$ -- no explicit density estimation required.\n- **Architecture:** Both $G$ and $D$ are multilayer perceptrons; $G$ maps $z\\sim p_z(z)$ to data space; $D$ maps samples to a scalar plausibility score.",
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
            "content": "- **0 Markov Chains** Required | Direct feedforward backpropagation sampling\n- **JS Divergence** Minimized | Equals Jensen-Shannon divergence at equilibrium\n- **D*(x) = 0.5** Equilibrium | Discriminator cannot distinguish real from fake\n- **10,000+** Derived Models | CycleGAN, StyleGAN, Pix2Pix, BigGAN revolution\n- **Conditional GAN:** Conditioning $G$ and $D$ on class label $y$ enables class-conditional synthesis; BigGAN achieves IS=166 on 512-class ImageNet.\n- **Mode Collapse:** Without explicit diversity objectives, GANs may ignore modes; Wasserstein GAN (WGAN) addresses this by replacing JSD with Earth Mover distance.",
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
            "content": "- **Sharp Visual Generations:** Eliminates the blurry averaging artifacts characteristic of mean-squared-error reconstruction losses.\n- **Continuous Latent Representation:** Interpolating vectors in noise space $z$ yields smooth semantic transitions between generated digits and faces.\n- **Disentangled Representations:** InfoGAN maximises mutual information between a subset of noise dimensions and outputs, learning interpretable factors (rotation, style, width) without supervision.\n- **Manifold Quality:** Linear interpolation in $z$-space yields semantically coherent transitions, confirming the generator learned a smooth data manifold.",
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
            "content": "When $D = D^*(x)$, the minimax objective reformulates directly as:\n\n$$C(G) = -\\log(4) + 2 \\cdot D_{\\text{JS}}(p_{\\text{data}} \\parallel p_g)$$\n\nSince $D_{\\text{JS}} \\ge 0$, the global minimum is achieved precisely when distributions match.\n- **Training Dynamics:** Balanced training (1 $D$ step per $G$ step) prevents premature discriminator saturation.\n- **Feature Matching:** Matching intermediate $D$ representations rather than final outputs stabilises training and improves sample diversity.",
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
            "content": "- **Adversarial Optimization:** Established game-theoretic optimization as a core pillar of machine learning.\n- **Foundation for Generative AI:** Catalyzed the entire visual AI revolution, directly inspiring modern diffusion guidance and neural rendering.\n- **Broad Impact:** Essential for domain adaptation, super-resolution, and synthetic scientific data generation.\n- **Medical Imaging:** GANs synthesise rare pathological examples to augment clinical datasets, improving radiologist-level classification accuracy by up to 12% on rare conditions.\n- **Physics Simulation:** High-energy physics uses GANs to emulate calorimeter showers at 1,000x the speed of GEANT4, enabling rapid Monte Carlo for LHC analyses.",
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
  },
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
            "id": "card_vla_poster_clinical",
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
            "id": "card_vla_poster_objective",
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
            "id": "card_vla_poster_architecture",
            "title": "System Architecture",
            "pattern": "bullets-image",
            "content": "Stereo endoscopy and force telemetry feed the 7B VLA foundation model, predicting 42 Hz sub-millimetre actions.\n- **Backbone:** 7B-parameter OpenVLA processes 1080p stereo frames and natural-language task description at 14 ms inference latency.\n- **Force Fusion:** 6-axis force/torque at 5 mN resolution fused with visual features via gated cross-attention, improving contact detection by 23%.\n- **Safety Shield:** QP-based Control Barrier Function projects actions to safe set in 3.2 ms, guaranteeing zero vascular penetrations.",
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
            "id": "card_vla_poster_metrics",
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
            "id": "card_vla_poster_benchmark",
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
            "id": "card_vla_poster_analysis",
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
            "id": "card_vla_poster_takeaway",
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
            "id": "card_vla_poster_references",
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
            "id": "card_vla_s1_title",
            "title": "Title",
            "pattern": "title-slide",
            "content": "SurgiVLA: Autonomous Microsurgery",
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
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_vla_s2_clinical_need",
            "title": "The Microsurgical Challenge",
            "pattern": "bullets",
            "content": "- **Sub-Millimetre Target:** Vascular anastomosis and cannulation on 0.5-1.0 mm vessels.\n- **Human Physiological Tremor:** 100 um tremor limits manual surgical precision.\n- **The Failure Mode of AI:** Unconstrained policies exhibit unpredictable tail excursions.",
            "column": null,
            "order": 1,
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
            "heightBudget": null
          },
          {
            "id": "card_vla_s3_objective",
            "title": "Constrained Optimization & Safety",
            "pattern": "two-column",
            "content": "$$\\min_u \\|u - \\pi_{\\theta}(o, l)\\|^2_2 \\quad \\text{s.t.} \\quad \\dot{h}(x, u) + \\alpha h(x) \\ge 0$$\n\nControl Barrier Functions guarantee that the surgical tool cannot penetrate forbidden tissue boundaries.",
            "column": null,
            "order": 2,
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
            "heightBudget": null
          },
          {
            "id": "card_vla_s4_pipeline",
            "title": "SurgiVLA System Architecture",
            "pattern": "figure-slide",
            "content": "Stereo endoscopy and force telemetry feed the 7B foundation policy with a real-time QP shield.",
            "column": null,
            "order": 3,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_vla_arch_s",
                "url": "/api/workspaces/vla-autonomous-surgery/assets/architecture.png",
                "caption": "End-to-end control pipeline."
              }
            ],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_vla_s5_sensing",
            "title": "Multi-Modal Sensor Fusion",
            "pattern": "two-column",
            "content": "1080p stereo vision at 42 Hz fused with 6-axis sub-millinewton force telemetry.\n\nKalman filter tracks dynamic tissue elasticity and surface boundaries.",
            "column": null,
            "order": 4,
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
            "heightBudget": null
          },
          {
            "id": "card_vla_s6_shield",
            "title": "Real-Time Barrier Shield",
            "pattern": "bullets",
            "content": "- Quadratic program solved in 3.2 ms via OSQP.\n- Guaranteed forward invariance of safe operating sets.\n- Intervenes only when policy outputs approach tissue margins.",
            "column": null,
            "order": 5,
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
            "heightBudget": null
          },
          {
            "id": "card_vla_s7_benchmark",
            "title": "Empirical Evaluation Benchmark",
            "pattern": "figure-slide",
            "content": "Primary evaluation across 1,240 ex-vivo micro-cannulation and anastomosis trials.",
            "column": null,
            "order": 6,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_vla_bench_s",
                "url": "/api/workspaces/vla-autonomous-surgery/assets/benchmark.png",
                "caption": "Task success and error distribution."
              }
            ],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_vla_s8_comparison",
            "title": "Performance vs. Baselines",
            "pattern": "bullets-table",
            "content": "Comparative surgical benchmark:",
            "column": null,
            "order": 7,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": true,
              "caption": "Results summary",
              "rows": [
                [
                  "Model",
                  "Success",
                  "Error",
                  "Violations"
                ],
                [
                  "OpenVLA",
                  "86.2%",
                  "0.71 mm",
                  "17"
                ],
                [
                  "RT-2",
                  "79.8%",
                  "0.93 mm",
                  "29"
                ],
                [
                  "SurgiVLA",
                  "98.7%",
                  "0.31 mm",
                  "0"
                ]
              ]
            },
            "figures": [],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_vla_s9_ablation",
            "title": "Ablation Analysis",
            "pattern": "two-column",
            "content": "Force telemetry reduces median error by 46%.\n\nBarrier shield completely eliminates critical boundary violations.",
            "column": null,
            "order": 8,
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
            "heightBudget": null
          },
          {
            "id": "card_vla_s10_stress",
            "title": "Stress Testing & Sensor Dropout",
            "pattern": "bullets",
            "content": "- Robust to 20% visual occlusion from smoke or blood droplets.\n- Safe-stop triggered gracefully if force sensor fails.\n- Generalizes across multiple surgeon hand styles.",
            "column": null,
            "order": 9,
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
            "heightBudget": null
          },
          {
            "id": "card_vla_s11_conclusion",
            "title": "Conclusions & Clinical Roadmap",
            "pattern": "bullets",
            "content": "- Proves foundation models can operate within certified safety envelopes in surgery.\n- 0.31 mm accuracy exceeds human baseline precision.\n- Pre-clinical trials scheduled under ISO 13485 standards.",
            "column": null,
            "order": 10,
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
            "heightBudget": null
          },
          {
            "id": "card_vla_s12_refs",
            "title": "References",
            "pattern": "references",
            "content": "\\cite{chen2027vla,brohan2023rt2,ames2019cbf}",
            "column": null,
            "order": 11,
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
            "heightBudget": null
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
            "id": "card_vla_p_abstract",
            "title": "Abstract",
            "pattern": "section",
            "content": "Sub-millimetre robotic microsurgery requires both adaptive motor skills and rigorous safety guarantees. Unconstrained deep reinforcement learning and imitation policies achieve high task completion but suffer from uncertified tail actions that risk catastrophic tissue puncture. Here we introduce SurgiVLA, a safety-constrained vision-language-action foundation model for sub-millimetre robotic manipulation. SurgiVLA couples a 7B-parameter multimodal transformer to a real-time Control Barrier Function (CBF) quadratic programming shield executed at 42 Hz. Evaluated across 1,240 ex-vivo micro-cannulation and vessel anastomosis trials, SurgiVLA achieves a 98.7% task completion rate with 0.31 mm median endpoint error and zero vascular boundary breaches.",
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
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_vla_p_intro",
            "title": "Clinical Need & Safety Envelope Deficits",
            "pattern": "section-figure",
            "content": "Ophthalmic and micro-vascular interventions involve maneuvering instruments within micrometers of delicate membranes where involuntary tremors or policy hallucinations cause irreversible trauma. Existing foundation models (RT-2, OpenVLA) lack verifiable safety constraints, generating unpredictable excursions under visual occlusion or soft-tissue deformation.",
            "column": null,
            "order": 1,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_vla_arch_p",
                "url": "/api/workspaces/vla-autonomous-surgery/assets/architecture.png",
                "caption": "Figure 1: SurgiVLA architecture coupling 7B VLA foundation model with 42 Hz Control Barrier Function safety shield."
              }
            ],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_vla_p_related",
            "title": "Related Work: VLA Models & Barrier Certificates",
            "pattern": "section",
            "content": "Vision-Language-Action architectures have demonstrated remarkable cross-embodiment generalization in general manipulation. However, applying them to surgery requires formal safety envelopes. Control Barrier Functions (CBFs) provide forward invariance guarantees for safety-critical dynamical systems, converting non-convex policy outputs into certified actions via convex quadratic programming.",
            "column": null,
            "order": 2,
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
            "heightBudget": null
          },
          {
            "id": "card_vla_p_methods",
            "title": "Formal Problem Formulation & Barrier Shield",
            "pattern": "section",
            "content": "We formulate surgical manipulation as a constrained optimization problem:\n\n$$\\min_{u} \\|u - \\pi_{\\theta}(o_{\\le t}, l)\\|^2_2 \\quad \\text{s.t.} \\quad \\dot{h}(x, u) + \\alpha h(x) \\ge 0$$\n\nwhere \\pi_\\theta is the VLA policy generating candidate joint velocities, and h(x) >= 0 defines the safe set enforcing tool-tip distance bounds from critical tissue boundaries. The quadratic program is solved in 3.2 ms, ensuring deterministic compliance within the 24 ms control cycle.",
            "column": null,
            "order": 3,
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
            "heightBudget": null
          },
          {
            "id": "card_vla_p_architecture",
            "title": "Sensor Fusion & 42 Hz Real-Time Loop",
            "pattern": "section",
            "content": "SurgiVLA consumes 1080p stereo endoscopic video and 6-axis force telemetry sampled at 1 kHz. A Kalman filter estimates dynamic tissue deformation states, which continuously update the barrier function gradient \\nabla h(x). A diffusion action decoder predicts 16-step chunked trajectory proposals conditioned on language intent.",
            "column": null,
            "order": 4,
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
            "heightBudget": null
          },
          {
            "id": "card_vla_p_experiments",
            "title": "Controlled Ex-Vivo Surgical Benchmarks",
            "pattern": "section-table",
            "content": "Empirical evaluation across 1,240 ex-vivo trials (porcine retinal vessels and 1.0 mm synthetic micro-cannulation):",
            "column": null,
            "order": 5,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": true,
              "caption": "Table 1: Benchmark performance against state-of-the-art vision-language-action baselines.",
              "rows": [
                [
                  "Method",
                  "Success Rate (%)",
                  "Median Error (mm)",
                  "Safety Violations",
                  "Control Latency (ms)"
                ],
                [
                  "BC-Z (Behavior Cloning)",
                  "71.4",
                  "1.42",
                  "48 / 1,240",
                  "18.0"
                ],
                [
                  "RT-2 (PaLI-X 55B)",
                  "79.8",
                  "0.93",
                  "29 / 1,240",
                  "96.4"
                ],
                [
                  "OpenVLA (7B Base)",
                  "86.2",
                  "0.71",
                  "17 / 1,240",
                  "61.2"
                ],
                [
                  "SurgiVLA (Unshielded)",
                  "94.1",
                  "0.42",
                  "8 / 1,240",
                  "16.8"
                ],
                [
                  "SurgiVLA (Certified)",
                  "98.7",
                  "0.31",
                  "0 / 1,240",
                  "23.8"
                ]
              ]
            },
            "figures": [],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_vla_p_ablation",
            "title": "Ablation Studies & Safety Analysis",
            "pattern": "section-figure",
            "content": "Ablation studies reveal that removing the QP safety shield results in 8 boundary violations in high-strain tissue regions, while removing force telemetry increases error from 0.31 mm to 0.58 mm.",
            "column": null,
            "order": 6,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_vla_bench_p",
                "url": "/api/workspaces/vla-autonomous-surgery/assets/benchmark.png",
                "caption": "Figure 2: Success rate, trajectory error distributions, and latency scaling across baselines."
              }
            ],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_vla_p_discussion",
            "title": "Clinical Translation & Regulatory Roadmap",
            "pattern": "section",
            "content": "SurgiVLA demonstrates that foundation models can achieve zero-violation safety in medical robotics. Future work addresses in-vivo physiological motion compensation (pulsatile blood flow and respiratory excursion) and multicenter clinical trials under ISO 13485 protocols.",
            "column": null,
            "order": 7,
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
            "heightBudget": null
          },
          {
            "id": "card_vla_p_refs",
            "title": "References",
            "pattern": "references",
            "content": "\\cite{chen2027vla,brohan2023rt2,ames2019cbf}",
            "column": null,
            "order": 8,
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
            "heightBudget": null
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
            "id": "card_vla_review_criterion_1_novelty",
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
            "id": "card_nqs_poster_superconductivity",
            "title": "Superconductivity at Megabar Pressure",
            "pattern": "bullets",
            "content": "Metastable LaH10-xNx exhibits room-temperature superconductivity under extreme compression.\n\n- **Anharmonic Effects:** Strong phonon coupling defies standard harmonic approximations.\n- **Neural Quantum State:** E(3)-equivariant wavefunctions parameterize correlated ground states.\n- **Variational Accuracy:** 2.4 meV energy error over 65,536 walkers.\n- **Benchmark vs. DMC:** Achieves quantum Monte Carlo accuracy at 8.1x higher sampling throughput via vectorised WASM-compatible inference.\n- **Training Cost:** 48 GPU-hours on 8xA100 for full LaH$_{10}$ at 250 GPa; natural gradient optimisation via stochastic reconfiguration.\n- **Anharmonic Coupling:** Path-integral molecular dynamics coupled to the wavefunction increases predicted $T_c$ by 22 K vs. the harmonic approximation.",
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
            "id": "card_nqs_poster_formulation",
            "title": "Equivariant Formulation",
            "pattern": "bullets",
            "content": "$$\\Psi_\\theta(R) = \\det[\\phi_i(r_j)] \\exp[J_\\theta(R)]$$\n\nOrbital and Jastrow components respect permutation and rotational symmetry groups.\n- **Equivariant Orbital Network:** Message-passing over the crystal graph encodes local coordination; orbital envelopes enforce correct asymptotic decay.\n- **Jastrow Factor:** Three-body electron--electron--ion correlations captured by a permutation-equivariant network, recovering 98.6% of correlation energy.\n- **Pressure Grid:** Calculations at 150, 182, 210, and 250 GPa; $T_c$ peaks at 287 K for LaH$_{10}$ at 182 GPa, within experimental error of the measured 250-260 K.",
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
            "id": "card_nqs_poster_architecture",
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
            "id": "card_nqs_poster_transition",
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
            "id": "card_nqs_poster_comparison",
            "title": "Hydride Comparison Table",
            "pattern": "bullets-table",
            "content": "Comparison against standard DFT and quantum Monte Carlo.\n- **DFT Baseline:** PBE functional underestimates electron-phonon coupling $\\lambda$ by 31\\% due to missing van der Waals and anharmonic corrections.\n- **DMC Accuracy:** Diffusion Monte Carlo at fixed-node approximation achieves $\\pm3\\,\\text{meV}$ energy error -- our neural wavefunction matches DMC at 8.1x higher throughput.\n- **Key Result:** Predicted $T_c = 287\\,\\text{K}$ at 182 GPa for LaH$_{10}$; experimental reports cluster at 250--260 K, within our 12 K uncertainty band from anharmonic corrections.",
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
            "id": "card_nqs_poster_phase",
            "title": "Phase Diagram & Pairing Map",
            "pattern": "bullets-two-images",
            "content": "Pairing symmetry and gap function mapped across pressure gradients.\n- **Gap Function:** Isotropic $s$-wave pairing symmetry confirmed across all pressure points; anisotropy parameter $\\Delta_k/\\Delta_0 < 0.08$ consistent with conventional phonon-mediated mechanism.\n- **Pressure Dependence:** $T_c$ rises steeply from 190 K at 150 GPa, peaks at 287 K at 182 GPa, then decreases to 241 K at 250 GPa as the Fermi surface topology changes.\n- **Phonon Renormalisation:** Self-consistent phonon theory with neural force constants reduces zone-centre imaginary frequencies by 64\\% vs. harmonic DFT, confirming lattice stability.",
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
            "id": "card_nqs_poster_takeaway",
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
            "id": "card_nqs_poster_references",
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
            "id": "card_nqs_s1_title",
            "title": "Title",
            "pattern": "title-slide",
            "content": "Neural Quantum States for Hydride Superconductors",
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
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_nqs_s2_motivation",
            "title": "The Megabar Superconductivity Frontier",
            "pattern": "bullets",
            "content": "- **Room-Temperature Goal:** Superconductivity at ambient temperature transforms energy transmission and quantum hardware.\n- **Megabar Hydrides:** LaH_{10} reaches T_c ~ 250-260 K under extreme pressure (>170 GPa).\n- **The Theory Gap:** Classical harmonic approximations underestimate critical temperatures.",
            "column": null,
            "order": 1,
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
            "heightBudget": null
          },
          {
            "id": "card_nqs_s3_formulation",
            "title": "Equivariant Many-Body Wavefunction",
            "pattern": "two-column",
            "content": "$$\\Psi_{\\theta}(\\mathbf{R}) = \\det[\\phi_i(\\mathbf{r}_j)] \\exp[J_{\\theta}(\\mathbf{R})]$$\n\n- E(3)-equivariant orbital network preserves lattice rotational and translation symmetries.\n- Jastrow factor captures multi-body correlation.",
            "column": null,
            "order": 2,
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
            "heightBudget": null
          },
          {
            "id": "card_nqs_s4_architecture",
            "title": "Eq-NQS Architecture",
            "pattern": "figure-slide",
            "content": "Crystal graph message passing neural network coupled to path-integral quantum nuclear dynamics.",
            "column": null,
            "order": 3,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_nqs_arch_s",
                "url": "/api/workspaces/neural-wavefunction-superconductors/assets/architecture.png",
                "caption": "Neural quantum state architecture."
              }
            ],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_nqs_s5_jastrow",
            "title": "Quantum Nuclear Anharmonicity",
            "pattern": "two-column",
            "content": "Hydrogen zero-point motion causes large anharmonic nuclear fluctuations.\n\nPath-integral molecular dynamics stabilizes the lattice at lower pressures.",
            "column": null,
            "order": 4,
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
            "heightBudget": null
          },
          {
            "id": "card_nqs_s6_stochastic",
            "title": "Stochastic Reconfiguration Optimization",
            "pattern": "bullets",
            "content": "- Natural gradient descent in non-orthogonal Hilbert space.\n- 65,536 walkers sample the electronic-nuclear probability distribution.\n- Energy error reduced to 2.4 meV per atom.",
            "column": null,
            "order": 5,
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
            "heightBudget": null
          },
          {
            "id": "card_nqs_s7_results",
            "title": "Predicted Tc vs. Pressure Phase Diagram",
            "pattern": "figure-slide",
            "content": "Calculations across 150-250 GPa predict peak Tc = 287 K at 182 GPa.",
            "column": null,
            "order": 6,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_nqs_bench_s",
                "url": "/api/workspaces/neural-wavefunction-superconductors/assets/benchmark.png",
                "caption": "Phase diagram and Tc predictions."
              }
            ],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_nqs_s8_comparison",
            "title": "Methodological Benchmark Comparison",
            "pattern": "bullets-table",
            "content": "Comparison on LaH10 at 182 GPa:",
            "column": null,
            "order": 7,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": true,
              "caption": "Accuracy across methods",
              "rows": [
                [
                  "Method",
                  "T_c (K)",
                  "Energy Error",
                  "Speedup"
                ],
                [
                  "DFT-PBE",
                  "214",
                  "18.7 meV",
                  "1.0x"
                ],
                [
                  "FermiNet-VMC",
                  "268",
                  "4.8 meV",
                  "1.7x"
                ],
                [
                  "Eq-NQS (Ours)",
                  "287",
                  "2.4 meV",
                  "8.1x"
                ]
              ]
            },
            "figures": [],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_nqs_s9_anharmonic",
            "title": "Isotropic s-Wave Symmetry",
            "pattern": "two-column",
            "content": "Eliashberg gap equations confirm isotropic s-wave electron-phonon pairing.\n\nPhonon renormalisation eliminates imaginary frequencies at the zone centre.",
            "column": null,
            "order": 8,
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
            "heightBudget": null
          },
          {
            "id": "card_nqs_s10_speedup",
            "title": "WASM Inference & HPC Scaling",
            "pattern": "bullets",
            "content": "- 8.1x sampling speedup enables interactive exploration.\n- Fully portable WASM runtime for lightweight client-side verification.\n- Multi-GPU parallel scaling tested up to 64 A100 nodes.",
            "column": null,
            "order": 9,
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
            "heightBudget": null
          },
          {
            "id": "card_nqs_s11_conclusion",
            "title": "Conclusions & Discovery Outlook",
            "pattern": "bullets",
            "content": "- First first-principles prediction of T_c = 287 K with full nuclear anharmonicity.\n- Opens high-throughput computational search for ternary hydrides.\n- Validates neural quantum states as a primary tool for megabar condensed matter.",
            "column": null,
            "order": 10,
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
            "heightBudget": null
          },
          {
            "id": "card_nqs_s12_refs",
            "title": "References",
            "pattern": "references",
            "content": "\\cite{okafor2027nqs,pfau2020abinitio,drozdov2019lah}",
            "column": null,
            "order": 11,
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
            "heightBudget": null
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
            "id": "card_nqs_p_abstract",
            "title": "Abstract",
            "pattern": "section",
            "content": "High-temperature conventional superconductivity in compressed hydrides holds promise for room-temperature quantum technologies, but theoretical characterization is impeded by strong electron-electron correlation and extreme quantum nuclear motion. We introduce an E(3)-equivariant neural quantum state (Eq-NQS) architecture that accurately models the ground-state electronic-nuclear wavefunction under megabar pressures. In lanthanum decahydride (LaH_{10}) at 182 GPa, Eq-NQS predicts a superconducting transition temperature of T_c = 287 K, resolving discrepancies between harmonic density functional theory and experiment. The equivariant network recovers 98.6% of correlation energy while achieving an 8.1x sampling speedup over diffusion Monte Carlo.",
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
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_nqs_p_intro",
            "title": "The Megabar Superconductivity Frontier",
            "pattern": "section-figure",
            "content": "Since the discovery of superconductivity above 200 K in H_3S at 155 GPa, compressed polyhydrides have revitalized the search for room-temperature superconductors. However, standard harmonic approximations fail because light hydrogen nuclei exhibit large zero-point quantum fluctuations.",
            "column": null,
            "order": 1,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_nqs_arch_p",
                "url": "/api/workspaces/neural-wavefunction-superconductors/assets/architecture.png",
                "caption": "Figure 1: Equivariant neural quantum state architecture mapping many-body electronic-nuclear wavefunctions."
              }
            ],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_nqs_p_theory",
            "title": "Many-Body Wavefunction Formalism",
            "pattern": "section",
            "content": "The full electronic-nuclear state is parameterized as an antisymmetric neural trial wavefunction:\n\n$$\\Psi_{\\theta}(\\mathbf{R}) = \\det[\\phi_i(\\mathbf{r}_j)] \\exp[J_{\\theta}(\\mathbf{R})]$$\n\nwhere \\phi_i are equivariant single-particle orbitals and J_\\theta is a permutation-invariant Jastrow correlation factor incorporating two- and three-body electron-electron and electron-ion terms. Wavefunction optimization is performed via Variational Monte Carlo (VMC) utilizing the stochastic reconfiguration algorithm with natural gradient preconditioning.",
            "column": null,
            "order": 2,
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
            "heightBudget": null
          },
          {
            "id": "card_nqs_p_methods",
            "title": "E(3)-Equivariance & Nuclear Anharmonicity",
            "pattern": "section",
            "content": "To satisfy the continuous spatial symmetries of the crystal lattice, orbital features transform equivariantly under 3D Euclidean rotations and translations. Quantum nuclear motion is simulated by coupling path-integral molecular dynamics (PIMD) with the neural force field, capturing strongly anharmonic phonon modes in the high-pressure Fm-3m phase.",
            "column": null,
            "order": 3,
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
            "heightBudget": null
          },
          {
            "id": "card_nqs_p_experiments",
            "title": "Transition Temperature Benchmarks for LaH10",
            "pattern": "section-table",
            "content": "Comparison of predicted superconducting transition temperatures T_c and variational energy accuracy across methods at 182 GPa:",
            "column": null,
            "order": 4,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": true,
              "caption": "Table 1: Superconducting transition temperature and computational performance across methods.",
              "rows": [
                [
                  "Method",
                  "T_c (K) Predicted",
                  "Energy Error (meV/atom)",
                  "Sampling Speedup",
                  "Anharmonicity"
                ],
                [
                  "Harmonic DFT-PBE",
                  "214",
                  "18.7",
                  "1.0x (baseline)",
                  "Excluded"
                ],
                [
                  "Self-Consistent DFT",
                  "242",
                  "11.3",
                  "0.4x",
                  "Mean-field only"
                ],
                [
                  "FermiNet-VMC",
                  "268",
                  "4.8",
                  "1.7x",
                  "Electronic only"
                ],
                [
                  "Diffusion Monte Carlo",
                  "281",
                  "3.1",
                  "0.2x",
                  "Fixed-node"
                ],
                [
                  "Eq-NQS (Ours)",
                  "287",
                  "2.4",
                  "8.1x",
                  "Fully Anharmonic"
                ]
              ]
            },
            "figures": [],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_nqs_p_ablation",
            "title": "Sampling Convergence & Phase Diagram",
            "pattern": "section-figure",
            "content": "Eq-NQS achieves variational convergence with 65,536 walkers in 48 GPU-hours on 8x NVIDIA A100s, producing an isotropic s-wave gap function that matches experimental diamond anvil cell measurements across the 150-250 GPa regime.",
            "column": null,
            "order": 5,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_nqs_bench_p",
                "url": "/api/workspaces/neural-wavefunction-superconductors/assets/benchmark.png",
                "caption": "Figure 2: Energy convergence and Tc phase diagram across megabar pressure gradients."
              }
            ],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_nqs_p_discussion",
            "title": "Lattice Stability & Future Hydride Discovery",
            "pattern": "section",
            "content": "The incorporation of full quantum nuclear anharmonicity stabilizes the Fm-3m lattice at 182 GPa, lowering the required stabilization pressure by 38 GPa compared to classical ion simulations. This methodology enables high-throughput computational screening of ternary and quaternary hydride superconductors.",
            "column": null,
            "order": 6,
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
            "heightBudget": null
          },
          {
            "id": "card_nqs_p_conclusion",
            "title": "Conclusion",
            "pattern": "section",
            "content": "Equivariant neural quantum states bridge the gap between high-accuracy many-body physics and scalable computational materials discovery, providing quantitative prediction of room-temperature superconductivity in megabar hydrides.",
            "column": null,
            "order": 7,
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
            "heightBudget": null
          },
          {
            "id": "card_nqs_p_refs",
            "title": "References",
            "pattern": "references",
            "content": "\\cite{okafor2027nqs,pfau2020abinitio,drozdov2019lah}",
            "column": null,
            "order": 8,
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
            "heightBudget": null
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
            "id": "card_cas13_poster_escape",
            "title": "Targeting Viral Escape Mutations",
            "pattern": "bullets",
            "content": "RNA respiratory viruses rapidly acquire single-nucleotide escape variants.\n\n- **Guide Ensembles:** Multi-guide cocktail prevents single-point resistance emergence.\n- **Secondary Structure:** Structure-aware scoring eliminates steric accessibility traps.\n- **In-Vitro Validation:** 0 escape cultures out of 48 serial challenges.\n- **Pan-Viral Scope:** Ensemble simultaneously suppresses SARS-CoV-2, Influenza A/H1N1, RSV, and two coronaviruses across 480 replicates -- zero escape despite 30 serial passages.\n- **Delivery:** LNP-formulated Cas13d-guide RNP achieves >90% lung epithelial transfection in Syrian hamster models with no detectable off-target effects at 10x therapeutic dose.\n- **Design Speed:** Structure-aware GNN screens 12-guide ensembles in 6.8 hours on a single A100, enabling rapid pandemic response.",
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
            "id": "card_cas13_poster_selection",
            "title": "Selection Optimization",
            "pattern": "bullets",
            "content": "$$\\max_{\\mathcal{S} \\subseteq \\mathcal{G}, |\\mathcal{S}| \\le 4} f_{\\text{coverage}}(\\mathcal{S}) - \\lambda f_{\\text{off-target}}(\\mathcal{S})$$\n\nSubmodular greedy selection achieves provable $(1 - 1/e)$ approximation bound.\n- **Accessibility Scoring:** A pangenome transformer rates guide binding efficiency across 50,000 viral variants; guides with accessibility $>0.8$ are prioritised to ensure activity in low-GC-content secondary structures.\n- **Multi-Target Redundancy:** At least 3 active guides per target region ensure viral suppression even after single-nucleotide mutations in any one binding site.\n- **Experimental Validation:** All 12 ensemble guides validated by RNA-seq knockdown assay; only guides with $>95\\%$ depletion at 10 nM Cas13d concentration are included.",
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
            "id": "card_cas13_poster_architecture",
            "title": "EvoGuide Architecture",
            "pattern": "bullets-image",
            "content": "Pangenome transformer scores accessibility and escape risk across viral phylogenies.\n- **Input Representation:** Crystal structure of Cas13d-crRNA complex (PDB 6IV9) provides steric constraints; torsional angles encoded as equivariant SO(3) features.\n- **Training Data:** Fine-tuned on 2.4 million guide-target efficiency pairs from CRISPR screen libraries spanning 28 RNA viruses.\n- **Zero-Shot Transfer:** Without retraining, achieves 0.81 Spearman correlation on held-out guide activities for novel Orthopneumovirus targets.",
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
            "id": "card_cas13_poster_efficacy",
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
            "id": "card_cas13_poster_benchmark",
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
            "id": "card_cas13_poster_culture",
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
            "id": "card_cas13_poster_takeaway",
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
            "id": "card_cas13_poster_references",
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
            "id": "card_cas13_s1_title",
            "title": "Title",
            "pattern": "title-slide",
            "content": "Programmable Cas13 Pan-Viral Immunity",
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
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_cas13_s2_crisis",
            "title": "The Viral Mutation Dilemma",
            "pattern": "bullets",
            "content": "- **Pandemic Threat:** RNA viruses (Coronaviruses, Influenza, RSV) mutate rapidly under drug pressure.\n- **The Failure of Monotherapy:** Single-guide and monoclonal therapies fail within days due to point mutations.\n- **The Need:** A universal, escape-resistant programmable RNA therapeutic.",
            "column": null,
            "order": 1,
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
            "heightBudget": null
          },
          {
            "id": "card_cas13_s3_approach",
            "title": "Structure-Aware Cas13 Ensembles",
            "pattern": "two-column",
            "content": "$$\\mathcal{L} = \\mathcal{L}_{\\text{cleavage}} + 0.4 \\mathcal{L}_{\\text{access}} + 0.7 \\max_v \\mathcal{L}_{\\text{escape}}(v)$$\n\nSimultaneous optimization of cleavage activity, secondary structure accessibility, and escape resistance.",
            "column": null,
            "order": 2,
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
            "heightBudget": null
          },
          {
            "id": "card_cas13_s4_pipeline",
            "title": "EvoGuide Design Pipeline",
            "pattern": "figure-slide",
            "content": "Pangenome transformer screens millions of viral sequences to design synergistic guide cocktails.",
            "column": null,
            "order": 3,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_cas13_arch_s",
                "url": "/api/workspaces/cas13-panviral-immunity/assets/architecture.png",
                "caption": "EvoGuide computational pipeline."
              }
            ],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_cas13_s5_transformer",
            "title": "Pangenome Transformer Scoring",
            "pattern": "two-column",
            "content": "Bidirectional transformer trained on 4.8M viral genomes.\n\nPredicts SHAPE-MaP accessibility and cross-species conservation.",
            "column": null,
            "order": 4,
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
            "heightBudget": null
          },
          {
            "id": "card_cas13_s6_submodular",
            "title": "Submodular Optimization Guarantee",
            "pattern": "bullets",
            "content": "- Monotone submodular objective guarantees (1 - 1/e) approximation.\n- Greedy selection runs in <10 minutes for entire viral families.\n- Zero human heuristic tuning required.",
            "column": null,
            "order": 5,
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
            "heightBudget": null
          },
          {
            "id": "card_cas13_s7_benchmark",
            "title": "Efficacy Across 480 Replicates",
            "pattern": "figure-slide",
            "content": "99.2% viral load reduction across SARS-CoV-2, Influenza A, and RSV challenges.",
            "column": null,
            "order": 6,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_cas13_bench_s",
                "url": "/api/workspaces/cas13-panviral-immunity/assets/benchmark.png",
                "caption": "Viral knockdown and clearance curves."
              }
            ],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_cas13_s8_table",
            "title": "Comparative Benchmark",
            "pattern": "bullets-table",
            "content": "In-vitro validation results:",
            "column": null,
            "order": 7,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": true,
              "caption": "Results comparison",
              "rows": [
                [
                  "Strategy",
                  "Knockdown",
                  "Escape (30 days)",
                  "Off-Targets"
                ],
                [
                  "siRNA",
                  "72.1%",
                  "19 / 48",
                  "7"
                ],
                [
                  "Cas13 Single",
                  "91.6%",
                  "11 / 48",
                  "3"
                ],
                [
                  "EvoGuide-4",
                  "99.2%",
                  "0 / 48",
                  "0"
                ]
              ]
            },
            "figures": [],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_cas13_s9_passaging",
            "title": "Zero Mutational Escape",
            "pattern": "two-column",
            "content": "0 out of 48 cultures showed viral breakthrough after 30 serial passages.\n\nCombinatorial targeting creates high genetic barrier to escape.",
            "column": null,
            "order": 8,
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
            "heightBudget": null
          },
          {
            "id": "card_cas13_s10_lnp",
            "title": "Aerosolized LNP Delivery",
            "pattern": "bullets",
            "content": "- In-vivo delivery via lipid nanoparticles (LNPs) to lung epithelium.\n- >90% transfection efficiency in animal models.\n- Zero transcriptome-wide off-target cleavages detected.",
            "column": null,
            "order": 9,
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
            "heightBudget": null
          },
          {
            "id": "card_cas13_s11_conclusion",
            "title": "Rapid Pandemic Deployment",
            "pattern": "bullets",
            "content": "- Full design cycle completed in 6.8 hours upon novel pathogen sequencing.\n- Pan-viral scope protects against unforeseen emerging strains.\n- Foundation for programmable synthetic immunology.",
            "column": null,
            "order": 10,
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
            "heightBudget": null
          },
          {
            "id": "card_cas13_s12_refs",
            "title": "References",
            "pattern": "references",
            "content": "\\cite{alsayed2027cas13,abudayyeh2017rna,cox2017crispr}",
            "column": null,
            "order": 11,
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
            "heightBudget": null
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
            "id": "card_cas13_p_abstract",
            "title": "Abstract",
            "pattern": "section",
            "content": "RNA viruses present recurring pandemic threats due to rapid mutational escape under targeted therapies. The RNA-guided ribonuclease CRISPR-Cas13 can target diverse viral genomes, but designing guide ensembles that prevent viral escape remains an open problem. We introduce EvoGuide, a structure-aware machine learning framework for automated design of Cas13 pan-viral guide ensembles. EvoGuide combines a pangenome transformer that scores sequence conservation and secondary structure accessibility with submodular optimization to construct redundant guide cocktails. Tested across 480 biological replicates spanning SARS-CoV-2, Influenza A, RSV, and common cold coronaviruses, our 4-guide ensemble achieves 99.2% viral knockdown and yields zero escape cultures across 30 serial passages.",
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
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_cas13_p_intro",
            "title": "RNA Virus Mutation & Therapeutic Escape",
            "pattern": "section-figure",
            "content": "Monovalent antiviral agents and single-guide CRISPR therapies fail against high-mutation RNA viruses due to rapid selection of single-nucleotide escape mutants. Overcoming this challenge requires simultaneous targeting of multiple conserved, structurally accessible viral loci.",
            "column": null,
            "order": 1,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_cas13_arch_p",
                "url": "/api/workspaces/cas13-panviral-immunity/assets/architecture.png",
                "caption": "Figure 1: EvoGuide pipeline integrating pangenome transformer scoring and submodular guide selection."
              }
            ],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_cas13_p_related",
            "title": "CRISPR-Cas13 Diagnostics & Therapeutics",
            "pattern": "section",
            "content": "Cas13 ribonucleases (such as Cas13a and Cas13d/RfxCas13d) feature robust programmable RNA cleavage with no protospacer adjacent motif (PAM) restriction. However, collateral cleavage and RNA secondary structure accessibility vary widely across targets, necessitating multi-objective predictive modeling.",
            "column": null,
            "order": 2,
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
            "heightBudget": null
          },
          {
            "id": "card_cas13_p_methods",
            "title": "Pangenome Transformer Scoring Framework",
            "pattern": "section",
            "content": "EvoGuide models viral target sequences using a bidirectional pangenome transformer trained on 4.8 million viral genomes from GISAID and NCBI. The objective function balances on-target cleavage, RNA secondary structure accessibility, and worst-case escape probability across known viral variants:\n\n$$\\mathcal{L} = \\mathcal{L}_{\\text{cleavage}} + 0.4 \\mathcal{L}_{\\text{access}} + 0.7 \\max_{v \\in \\mathcal{V}} \\mathcal{L}_{\\text{escape}}(v)$$\n\nStructural accessibility is predicted using equivariant graph networks trained on SHAPE-MaP chemical probing data.",
            "column": null,
            "order": 3,
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
            "heightBudget": null
          },
          {
            "id": "card_cas13_p_submodular",
            "title": "Submodular Optimization for Guide Ensembles",
            "pattern": "section",
            "content": "Selecting a k-guide ensemble from thousands of candidate target sites is NP-hard. We formalize ensemble selection as maximizing a monotone submodular coverage function subject to off-target penalty constraints, solved via greedy forward selection with a provable (1 - 1/e) approximation guarantee.",
            "column": null,
            "order": 4,
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
            "heightBudget": null
          },
          {
            "id": "card_cas13_p_experiments",
            "title": "Knockdown & Escape Benchmark Results",
            "pattern": "section-table",
            "content": "In-vitro validation in human lung epithelial cells (A549) across diverse respiratory viral challenges:",
            "column": null,
            "order": 5,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": true,
              "caption": "Table 1: Antiviral efficacy and escape resistance compared to standard guide designs.",
              "rows": [
                [
                  "Design Strategy",
                  "Targeting",
                  "Knockdown (%)",
                  "Escape Cultures (30 pass.)",
                  "Off-Targets"
                ],
                [
                  "siRNA Monotherapy",
                  "Single site",
                  "72.1",
                  "19 / 48",
                  "7"
                ],
                [
                  "Cas13d Single Guide",
                  "Single conserved",
                  "91.6",
                  "11 / 48",
                  "3"
                ],
                [
                  "Heuristic Top-4",
                  "4 conserved",
                  "96.8",
                  "4 / 48",
                  "2"
                ],
                [
                  "EvoGuide-4 (Ours)",
                  "4 redundant",
                  "99.2",
                  "0 / 48",
                  "0"
                ]
              ]
            },
            "figures": [],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_cas13_p_ablation",
            "title": "Serial Passaging & Escape Dynamics",
            "pattern": "section-figure",
            "content": "Under continuous selective pressure over 30 passages, cultures treated with monovalent guides developed escape mutations within 8-14 days, whereas EvoGuide-4 maintained complete viral suppression throughout the 30-day assay.",
            "column": null,
            "order": 6,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_cas13_bench_p",
                "url": "/api/workspaces/cas13-panviral-immunity/assets/benchmark.png",
                "caption": "Figure 2: Viral load suppression curves and serial passaging escape dynamics across guide strategies."
              }
            ],
            "sourceIds": [
              "manuscript"
            ],
            "heightBudget": null
          },
          {
            "id": "card_cas13_p_discussion",
            "title": "LNP In-Vivo Delivery & Pandemic Readiness",
            "pattern": "section",
            "content": "Aerosolized delivery of Cas13d-guide ribonucleoprotein (RNP) complexes using ionizable lipid nanoparticles (LNPs) achieved >90% transfection in the respiratory tract of Syrian hamsters, with zero detectable off-target cleavage by whole-transcriptome RNA-seq.",
            "column": null,
            "order": 7,
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
            "heightBudget": null
          },
          {
            "id": "card_cas13_p_refs",
            "title": "References",
            "pattern": "references",
            "content": "\\cite{alsayed2027cas13,abudayyeh2017rna,cox2017crispr}",
            "column": null,
            "order": 8,
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
            "heightBudget": null
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
  },
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
            "content": "**\\fitstat{$1.1 \\times 10^7 M_\\odot$}** Subhalo Mass Limit | 95\\% Bayesian credible interval\n**\\fitstat{0.028''}** Astrometric Resolution | 3.4$\\times$ finer than HST ACS\n**\\fitstat{$5.8\\sigma$}** Detection Confidence | SMACS J0723 arc perturber",
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
            "content": "**\\fitstat{$10^7 M_\\odot$}** Cold Dark Matter Sensitivity | rules out sterile neutrino $m_s < 12$ keV\n**\\fitstat{0}** Unphysical Mass Pixels | guaranteed by Poisson consistency",
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
            "id": "card_jwst_review_criterion_1_originality_novelt",
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
            "id": "card_jwst_review_criterion_2_theoretical_formul",
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
            "id": "card_jwst_review_criterion_3_computational_meth",
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
            "id": "card_jwst_review_criterion_4_observational_data",
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
            "id": "card_jwst_review_criterion_5_statistical_rigor",
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
            "id": "card_jwst_review_criterion_6_empirical_results",
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
            "id": "card_jwst_review_criterion_7_astrophysical_vali",
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
            "id": "card_jwst_review_criterion_8_reproducibility_op",
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
            "id": "card_jwst_review_criterion_9_scientific_writing",
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
            "id": "card_jwst_review_criterion_10_research_ethics_a",
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
            "id": "card_jwst_review_criterion_11_discussion_of_lim",
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
            "id": "card_jwst_review_criterion_12_astrophysical_imp",
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
            "content": "**\\fitstat{$3.42\\times$}** Wall-Clock Speedup | on Llama-3-70B across MT-Bench\n**\\fitstat{0.0\\%}** Distribution Drift | TV distance $D_{\\text{TV}} = 0.000$\n**\\fitstat{$18.2\\text{ ms}$}** Token Latency (p99) | 62\\% reduction vs baseline",
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
            "content": "**\\fitstat{$66.3\\text{ tok/s}$}** Frontier 70B Throughput | vs 19.4 tok/s vanilla\n**\\fitstat{0 Error}** Bitwise Numerical Equivalence | verified across 100k queries",
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
            "content": "Large language models (LLMs) underpin transformative advances in reasoning and code generation, but their interactive deployment is severely constrained by memory bandwidth limitations \\cite{leviathan2023fast}. Autoregressive token generation loads all model weights into high-bandwidth memory for every token produced, resulting in low arithmetic intensity (<1 FLOP/byte) and high per-token latency \\cite{chen2023accelerating}. Speculative decoding breaks this memory-bandwidth bottleneck by pairing a high-capacity target model with a small draft model. While prior works explore heuristic tree topologies \\cite{miao2024specinfer}, they lack formal non-asymptotic latency guarantees, frequently degrading into worst-case tail stalls.\n- **Root Cause:** Rejection sampling in prior methods cannot bound the number of draft re-rolls, leading to unbounded tail latency.\n- **Martingale Solution:** SurgiVLA's acceptance tree reformulates sampling as a martingale stopping time, providing the first non-asymptotic $O(1)$-step guarantee.",
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
            "content": "Ablation experiments confirm that Martingale stopping eliminates tail latency spikes without sacrificing throughput. Compared to unconstrained tree search, 99th-percentile token latency is reduced from 48.6 ms to 18.2 ms.\n- **Acceptance-Rejection:** Each token accepted with probability $\\min(1,q/p)$, preserving exact target distribution.\n- **Martingale Guarantee:** Acceptance tree forms a martingale; optional stopping theorem yields provable latency bounds independent of draft quality.\n- **Hardware Efficiency:** Batch-parallel draft evaluation achieves 94% A100 utilisation vs. 42% for sequential autoregressive decoding.",
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
,
{
    "id": "mamba-selective-ssm",
    "name": "Mamba: Selective State Space Models",
    "posterTitle": "Mamba: Linear-Time Sequence Modeling with Selective State Spaces",
    "authors": "Albert Gu, Tri Dao",
    "venue": "arXiv:2312.00752 (2023)",
    "templateName": "conference",
    "activeOutputId": "out_mamba_poster",
    "outputs": [
      {
        "id": "out_mamba_poster",
        "outputType": "poster",
        "templateId": "conference",
        "title": "Mamba: Linear-Time Sequence Modeling with Selective State Spaces",
        "themeColor": "#0F766E",
        "cards": [
          {
            "id": "card_mamba_c1_problem",
            "title": "The Quadratic Attention Tax",
            "column": 1,
            "order": 0,
            "pattern": "bullets",
            "content": "Dense self-attention maps every token to every other token, so both compute and memory grow as $O(L^2)$.\n\n- **Context wall:** Training and serving million-length sequences is dominated by the attention matrix, not by parameter count.\n- **LSI vs. LTI:** Prior state-space models (S4, S5) are linear time-invariant: their dynamics cannot select information as a function of the current token.\n- **Mamba:** A selective SSM (S6) makes $\\Delta$, $B$ and $C$ input-dependent, recovering content-aware routing at $O(L)$ cost.",
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
            "id": "card_mamba_c1_stats",
            "title": "Scaling Headlines",
            "column": 1,
            "order": 1,
            "pattern": "stats",
            "content": "- **5×** Inference Throughput | vs. a same-size Transformer on long sequences\n- **1M** Token Context | linear scan, no attention window\n- **3B ≈ 6B** Quality Parity | Mamba-3B matches a Transformer-6B on language\n- **O(L)** Compute | vs. $O(L^2)$ dense attention",
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
            "id": "card_mamba_c1_select",
            "title": "Selection: Input-Dependent Dynamics",
            "column": 1,
            "order": 2,
            "pattern": "bullets",
            "content": "Classical SSMs discretize a linear ODE $h'(t) = A h(t) + B x(t)$ with a fixed step $\\Delta$. Mamba predicts $\\Delta, B, C$ from $x_t$:\n\n$$h_t = \\bar{A}(x_t) h_{t-1} + \\bar{B}(x_t) x_t, \\qquad y_t = C(x_t) h_t$$\n\n- **Selective $\\Delta$:** Large $\\Delta$ forgets state (reset); small $\\Delta$ persists it — a data-dependent gate without an extra softmax.\n- **Selective $B, C$:** The input and output projections filter which features enter or leave the hidden state.\n- **Mechanical interpretation:** Selection is the missing ingredient that lets an SSM perform associative recall.",
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
            "id": "card_mamba_c2_arch",
            "title": "Homogeneous Mamba Block",
            "column": 2,
            "order": 0,
            "pattern": "bullets-image",
            "content": "**One block replaces attention + MLP:**\n- **Expansion:** Linear projection expands the model width, followed by a short 1D convolution and SiLU.\n- **S6 mixer:** The selective SSM is the only sequence mixer; there is no separate attention head.\n- **Gated residual:** A SiLU gate (as in GLU) multiplies the SSM output before the residual add.",
            "figureLayout": "single",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_mamba_arch",
                "url": "/api/workspaces/mamba-selective-ssm/assets/architecture.png",
                "caption": "Figure 1: Mamba block — expansion, short conv, selective SSM (S6), and gated residual."
              }
            ],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_mamba_c2_hw",
            "title": "Hardware-Aware Parallel Scan",
            "column": 2,
            "order": 1,
            "pattern": "bullets",
            "content": "A naive selective recurrence is sequential in $L$ and materializes a large state in HBM.\n\n- **Fused scan:** The work-efficient parallel prefix scan is fused so $\\bar{A}, \\bar{B}$ never live in HBM; SRAM holds the running state.\n- **Recomputation:** Backward recomputes the scan instead of storing $O(L \\times N)$ intermediates, cutting activation memory.\n- **Throughput:** The kernel saturates GPU memory bandwidth, yielding up to $5\\times$ tokens/s versus FlashAttention Transformers at long $L$.",
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
            "id": "card_mamba_c2_disc",
            "title": "Discretization of the Selective SSM",
            "column": 2,
            "order": 2,
            "pattern": "bullets",
            "content": "Zero-order hold maps continuous $(A,B)$ to discrete $(\\bar{A}, \\bar{B})$ with a per-token step size:\n\n$$\\bar{A} = \\exp(\\Delta A), \\qquad \\bar{B} = (\\Delta A)^{-1}(\\exp(\\Delta A) - I)\\, \\Delta B$$\n\n- **Diagonal $A$:** $A$ is stored in log-space as a real diagonal, keeping the scan $O(N)$ per channel.\n- **Stability:** Restricting $\\Delta > 0$ via a softplus keeps $\\bar{A}$ contractive without extra clipping.",
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
            "id": "card_mamba_c3_table",
            "title": "Quality vs. Compute Across Modalities",
            "column": 3,
            "order": 0,
            "pattern": "bullets-table",
            "content": "Mamba matches or beats same-size Transformers on language, audio, and genomics while scaling linearly in length:",
            "figureLayout": "single",
            "table": {
              "hasHeader": true,
              "caption": "Table 1: Representative downstream results (Gu & Dao, arXiv:2312.00752)",
              "rows": [
                [
                  "Setting",
                  "Mamba",
                  "Transformer",
                  "Note"
                ],
                [
                  "Language (3B)",
                  "Mamba-3B",
                  "Transformer-6B",
                  "matched perplexity"
                ],
                [
                  "Inference",
                  "5× tok/s",
                  "1× baseline",
                  "long-context decode"
                ],
                [
                  "Audio (YouTubeMix)",
                  "SOTA",
                  "—",
                  "raw waveform"
                ],
                [
                  "Genomics (HG38)",
                  "SOTA",
                  "Hyena",
                  "DNA LM"
                ]
              ]
            },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_mamba_c3_long",
            "title": "Million-Length Extrapolation",
            "column": 3,
            "order": 1,
            "pattern": "bullets-two-images",
            "content": "- **Length generalization:** Trained at 2K–8K, Mamba keeps perplexity flat out to $10^6$ tokens where attention saturates.\n- **No windowing:** The recurrent state is a constant-size summary; there is no sliding-window or sink-token hack.",
            "figureLayout": "two-up",
            "table": {
              "hasHeader": false,
              "caption": "",
              "rows": []
            },
            "figures": [
              {
                "id": "fig_mamba_bench",
                "url": "/api/workspaces/mamba-selective-ssm/assets/benchmark.png",
                "caption": "Figure 2: Perplexity vs. context length; Mamba stays flat to 1M tokens."
              },
              {
                "id": "fig_mamba_arch2",
                "url": "/api/workspaces/mamba-selective-ssm/assets/architecture.png",
                "caption": "Figure 3: Fused scan keeps the state in SRAM."
              }
            ],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_mamba_c3_takeaway",
            "title": "Takeaways",
            "column": 3,
            "order": 2,
            "pattern": "bullets",
            "content": "- **Selection, not just SSMs:** Time-invariant S4-style models fail associative recall; input-dependent $\\Delta$ is the difference.\n- **Systems co-design:** The algorithm is only practical because the fused scan avoids HBM round-trips.\n- **A Transformer alternative:** A homogeneous selective-SSM stack is competitive on language at half the parameters and linear scaling.",
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
        "id": "out_mamba_slides",
        "outputType": "slides",
        "templateId": "beamer-metropolis",
        "title": "Mamba: Selective State Spaces",
        "themeColor": "#0F766E",
        "cards": [
          {
            "id": "card_mamba_slides_mamba_selective_state_spaces",
            "title": "Mamba: Selective State Spaces",
            "column": 1,
            "order": 0,
            "pattern": "bullets",
            "content": "- Selective state-space model with linear-time scaling\n- Input-dependent dynamics replace quadratic self-attention\n- 5× throughput, million-token context, 3B matches 6B Transformer",
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
            "id": "card_mamba_slides_the_quadratic_attention_bottle",
            "title": "The Quadratic Attention Bottleneck",
            "column": 1,
            "order": 1,
            "pattern": "bullets",
            "content": "Dense self-attention computes pairwise token interactions with $O(L^2)$ time and memory cost.\n\n- Training and serving million-length sequences is dominated by the attention matrix, not by parameter count\n- Prior state-space models (S4, S5) are linear time-invariant: their dynamics cannot condition on the current token\n- Mamba introduces input-dependent selection that recovers content-aware routing at $O(L)$ cost",
            "figureLayout": "single",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_mamba_slides_selective_state_spaces_s6",
            "title": "Selective State Spaces (S6)",
            "column": 1,
            "order": 2,
            "pattern": "bullets",
            "content": "The core innovation is making the SSM parameters input-dependent rather than fixed:\n\n- $\\Delta_t = \\text{softplus}(W_\\Delta x_t + b_\\Delta)$: step size adapts to each token\n- $B_t = W_B x_t$ and $C_t = W_C x_t$: input and output projections vary with content\n- This selection mechanism enables the model to filter irrelevant context and retain salient information in its hidden state",
            "figureLayout": "single",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_mamba_slides_hardware_aware_parallel_scan",
            "title": "Hardware-Aware Parallel Scan",
            "column": 1,
            "order": 3,
            "pattern": "bullets",
            "content": "A naive selective recurrence is sequential in $L$ and materializes a large state in HBM.\n\n- The work-efficient parallel prefix scan is fused so intermediate states never leave SRAM\n- Backward pass recomputes the scan instead of storing $O(L \\times N)$ intermediates\n- The kernel saturates GPU memory bandwidth, yielding up to $5\\times$ tokens/s versus FlashAttention at long sequences",
            "figureLayout": "single",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_mamba_slides_mamba_block_architecture",
            "title": "Mamba Block Architecture",
            "column": 1,
            "order": 4,
            "pattern": "bullets-image",
            "content": "Each Mamba block replaces the Transformer's attention sublayer with a selective SSM, wrapped in a gated residual path:\n\n- Linear projection expands the hidden dimension by a factor of $E=2$\n- A 1D convolution provides local context before the SSM\n- SiLU gating on the skip branch modulates the output\n- The stack is homogeneous: no attention layers at all",
            "figureLayout": "single",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [{ "id": "fig_mamba_arch_s", "url": "/api/workspaces/mamba-selective-ssm/assets/architecture.png", "caption": "Mamba block architecture" }],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_mamba_slides_discretization",
            "title": "Discretization",
            "column": 1,
            "order": 5,
            "pattern": "bullets",
            "content": "The continuous SSM is discretized via a zero-order hold (ZOH) rule for numerical integration:\n\n- $\\bar{A} = \\exp(\\Delta A)$, $\\bar{B} = (\\Delta A)^{-1}(\\exp(\\Delta A) - I) \\cdot \\Delta B$\n- Input-dependent $\\Delta$ means the effective time constant adapts per token\n- Larger $\\Delta$ values cause the model to attend to longer-range dependencies",
            "figureLayout": "single",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_mamba_slides_language_modeling_results",
            "title": "Language Modeling Results",
            "column": 1,
            "order": 6,
            "pattern": "bullets",
            "content": "Mamba matches or exceeds Transformers of equivalent compute budget on standard language benchmarks:\n\n- Mamba-3B achieves the same perplexity as a Transformer-6B on The Pile\n- Zero-shot downstream accuracy on LAMBADA, HellaSwag, PIQA, and WinoGrande is competitive with models twice its size\n- Pretraining throughput is 3--5$\\times$ higher due to linear scaling",
            "figureLayout": "single",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_mamba_slides_long_context_extrapolation",
            "title": "Long-Context Extrapolation",
            "column": 1,
            "order": 7,
            "pattern": "bullets-image",
            "content": "Trained on 2K--8K token sequences, Mamba extrapolates to $10^6$ tokens without degradation:\n\n- Perplexity remains flat beyond the training context window\n- No sliding-window, sink-token, or position-encoding hack is required\n- The recurrent state is a constant-size summary regardless of sequence length",
            "figureLayout": "single",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [{ "id": "fig_mamba_bench_s", "url": "/api/workspaces/mamba-selective-ssm/assets/benchmark.png", "caption": "Long-context perplexity vs. Transformers" }],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_mamba_slides_multi_modal_benchmarks",
            "title": "Multi-Modal Benchmarks",
            "column": 1,
            "order": 8,
            "pattern": "bullets",
            "content": "Mamba generalizes beyond language to audio and genomics:\n\n- Speech Commands (SC09): 98.3\\% accuracy, surpassing S4 and Transformer baselines\n- Genomics: state-of-the-art on the Great Lakes species classification benchmark\n- These results demonstrate that the selective scan mechanism transfers across modalities without architecture changes",
            "figureLayout": "single",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_mamba_slides_ablation_selection_is_essentia",
            "title": "Ablation: Selection Is Essential",
            "column": 1,
            "order": 9,
            "pattern": "bullets",
            "content": "Controlled ablations isolate the contribution of input-dependent dynamics:\n\n- Removing $\\Delta$ selectivity (reverting to S4-style fixed dynamics) drops associative recall accuracy from 99.8\\% to chance\n- Making $B$ and $C$ static degrades language perplexity by 0.4 nats\n- The selection mechanism is the critical differentiator, not the SSM formulation itself",
            "figureLayout": "single",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_mamba_slides_limitations_and_future_work",
            "title": "Limitations and Future Work",
            "column": 1,
            "order": 10,
            "pattern": "bullets",
            "content": "- In-context learning on tasks requiring exact copying lags behind attention-based models\n- Mixture-of-experts and hybrid SSM-attention architectures may combine the strengths of both paradigms\n- Scaling laws for selective SSMs beyond 3B parameters remain to be characterized\n- The fused scan kernel is CUDA-specific and has not been ported to other accelerator backends",
            "figureLayout": "single",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_mamba_slides_conclusion",
            "title": "Conclusion",
            "column": 1,
            "order": 11,
            "pattern": "bullets",
            "content": "Mamba demonstrates that a pure selective state-space architecture can match Transformer quality at half the parameters and linear scaling:\n\n- Selection, not just SSMs, is the key innovation\n- Systems co-design (fused parallel scan) makes the algorithm practical\n- A homogeneous selective-SSM stack is a viable Transformer alternative for language, audio, and genomics",
            "figureLayout": "single",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          }
        ]
      },
      {
        "id": "out_mamba_paper",
        "outputType": "paper",
        "templateId": "neurips",
        "title": "Mamba: Linear-Time Sequence Modeling with Selective State Spaces",
        "themeColor": "#0F766E",
        "cards": [
          {
            "id": "card_mamba_paper_abstract",
            "title": "Abstract",
            "column": 1,
            "order": 0,
            "pattern": "bullets",
            "content": "We introduce Mamba, a selective state space model that achieves linear-time sequence modeling by making SSM parameters functions of the input. Unlike prior structured state space models (S4, S5) whose dynamics are time-invariant, Mamba's selection mechanism conditions the step size $\\Delta$, input matrix $B$, and output matrix $C$ on each token. Combined with a hardware-aware parallel scan implementation that keeps all intermediate states in SRAM, Mamba achieves up to $5\\times$ inference throughput over Transformers of equivalent quality. A 3-billion-parameter Mamba model matches a 6-billion-parameter Transformer on The Pile language modeling benchmark while scaling to million-token contexts without architectural modifications.",
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
            "id": "card_mamba_paper_introduction",
            "title": "Introduction",
            "column": 1,
            "order": 1,
            "pattern": "section",
            "content": "Foundation models built on the Transformer architecture have driven rapid advances across language, vision, and scientific domains. However, the self-attention mechanism at the core of Transformers computes pairwise token interactions with $O(L^2)$ time and memory complexity, creating a fundamental bottleneck for long-sequence tasks. Structured state space models (SSMs) offer an alternative by processing sequences through linear recurrences that scale as $O(L)$, but prior SSM variants such as S4 and S5 use time-invariant dynamics that cannot selectively filter information based on content. This work bridges the gap by introducing Mamba, a selective SSM that makes its transition dynamics input-dependent while retaining linear scaling through a custom hardware-aware parallel scan algorithm.",
            "figureLayout": "single",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_mamba_paper_related_work",
            "title": "Related Work",
            "column": 1,
            "order": 2,
            "pattern": "section",
            "content": "Efficient sequence modeling has been explored along several axes. Linear attention variants (Katharopoulos et al., 2020; Choromanski et al., 2021) approximate softmax attention with kernel feature maps but sacrifice expressivity. Structured state space models, beginning with HiPPO (Gu et al., 2020) and S4 (Gu et al., 2022), parameterize linear recurrences via structured matrices for efficient long-range modeling. H3 (Fu et al., 2023) interleaves SSM layers with multiplicative gating but retains time-invariant dynamics. RWKV (Peng et al., 2023) and RetNet (Sun et al., 2023) propose recurrent alternatives to attention with competitive language modeling results but rely on linear recurrences without content-based selection. Mamba differs by making all SSM parameters functions of the input, recovering the ability to selectively propagate or forget information along the sequence.",
            "figureLayout": "single",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_mamba_paper_methods",
            "title": "Methods",
            "column": 1,
            "order": 3,
            "pattern": "section",
            "content": "The selective state space model (S6) extends the continuous-time SSM $h'(t) = Ah(t) + Bx(t)$, $y(t) = Ch(t)$ by parameterizing $\\Delta$, $B$, and $C$ as learned projections of the input token $x_t$. Discretization via the zero-order hold yields $\\bar{A}_t = \\exp(\\Delta_t A)$ and $\\bar{B}_t = (\\Delta_t A)^{-1}(\\exp(\\Delta_t A) - I) \\cdot \\Delta_t B_t$. Because these matrices now vary across time steps, the recurrence cannot be expressed as a single convolution. Instead, we implement the scan using a work-efficient parallel prefix sum algorithm with a custom CUDA kernel that fuses discretization, scan, and multiplication into a single memory-bound pass, keeping all intermediate states in SRAM. The Mamba block wraps this selective SSM in a gated residual architecture: a linear expansion by factor $E=2$, a short 1D convolution for local context, the selective SSM, SiLU gating, and a linear projection back to the model dimension.",
            "figureLayout": "single",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_mamba_paper_experiments",
            "title": "Experiments",
            "column": 1,
            "order": 4,
            "pattern": "section",
            "content": "We evaluate Mamba across three modalities. On language modeling with The Pile, Mamba-3B matches Transformer++-6B perplexity while training $3\\times$ faster and serving $5\\times$ faster at 2048-token context. Zero-shot downstream evaluation on LAMBADA (82.1\\%), HellaSwag (71.4\\%), PIQA (78.9\\%), and WinoGrande (65.5\\%) is competitive with Transformers of equivalent compute. On the Speech Commands SC09 audio classification benchmark, Mamba achieves 98.3\\% accuracy, surpassing both S4 (98.0\\%) and a Transformer baseline (96.2\\%). On the Great Lakes genomics species classification task, Mamba sets a new state of the art, demonstrating that the selective scan mechanism transfers across modalities without architecture changes.",
            "figureLayout": "single",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_mamba_paper_ablation_studies",
            "title": "Ablation Studies",
            "column": 1,
            "order": 5,
            "pattern": "section",
            "content": "We isolate the contribution of each selective parameter through controlled ablations on the synthetic associative recall task. Removing $\\Delta$ selectivity (reverting to S4-style fixed dynamics) drops accuracy from 99.8\\% to chance level, confirming that input-dependent step sizes are critical for content-based filtering. Making $B$ static while keeping $\\Delta$ and $C$ selective reduces language perplexity by only 0.1 nats, while making $C$ static has a larger 0.3-nat impact, indicating that output selectivity is more important than input selectivity for language. Replacing SiLU gating with a simple residual connection degrades perplexity by 0.15 nats, confirming the importance of the multiplicative interaction.",
            "figureLayout": "single",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_mamba_paper_discussion",
            "title": "Discussion",
            "column": 1,
            "order": 6,
            "pattern": "section",
            "content": "Mamba demonstrates that a homogeneous stack of selective SSM blocks, without any attention layers, can match Transformer quality while scaling linearly. The key insight is that selection, not the SSM formulation itself, is the critical capability. Time-invariant SSMs fail on tasks requiring content-based filtering despite their favorable scaling, while selective SSMs recover this ability. The hardware-aware implementation is equally important: a mathematically elegant algorithm is only practical if it saturates available memory bandwidth. Limitations include weaker in-context learning on exact-copy tasks compared to attention, and the CUDA-specific kernel implementation. Future directions include hybrid architectures that combine selective SSMs with sparse attention for tasks requiring exact retrieval, and scaling studies beyond 3B parameters.",
            "figureLayout": "single",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_mamba_paper_conclusion",
            "title": "Conclusion",
            "column": 1,
            "order": 7,
            "pattern": "section",
            "content": "We presented Mamba, a selective state space model that replaces quadratic self-attention with input-dependent linear recurrences. The selection mechanism, which makes the SSM step size, input matrix, and output matrix functions of the current token, enables content-aware information propagation while maintaining $O(L)$ computational cost. A hardware-aware parallel scan implementation keeps all intermediate states in SRAM, achieving $5\\times$ inference throughput over FlashAttention-equipped Transformers. A 3B-parameter Mamba model matches a 6B Transformer on The Pile and extrapolates to million-token sequences without modification. Results on audio and genomics benchmarks confirm cross-modal generality. Mamba establishes selective state spaces as a viable foundation model architecture.",
            "figureLayout": "single",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          },
          {
            "id": "card_mamba_paper_references",
            "title": "References",
            "column": 1,
            "order": 8,
            "pattern": "references",
            "content": "",
            "figureLayout": "single",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": [],
            "validation": "valid"
          }
        ]
      }
    ],
    "assets": [
      {
        "id": "ast_mamba_arch",
        "fileId": "architecture.png",
        "filename": "architecture.png",
        "url": "/api/workspaces/mamba-selective-ssm/assets/architecture.png",
        "kind": "figure",
        "page": 1,
        "confidence": "high",
        "caption": "Mamba block architecture"
      },
      {
        "id": "ast_mamba_bench",
        "fileId": "benchmark.png",
        "filename": "benchmark.png",
        "url": "/api/workspaces/mamba-selective-ssm/assets/benchmark.png",
        "kind": "figure",
        "page": 1,
        "confidence": "high",
        "caption": "Long-context perplexity vs. Transformers"
      }
    ],
    "ingestFiles": []
  },
  {
    "id": "aurora-topological-photonics",
    "name": "Aurora: Topological Photonic Crystals with Synthetic Dimensions",
    "posterTitle": "Aurora Topological Photonic Crystals: Non-Abelian Braiding in Synthetic Frequency Dimensions",
    "authors": "Kenji Tanaka, Elena Varga, Amir Hassan, Sophia Liu",
    "venue": "Nature Photonics 2027 • Topological Photonics",
    "templateName": "aurora",
    "activeOutputId": "out_aurora_poster",
    "outputs": [
      {
        "id": "out_aurora_poster",
        "outputType": "poster",
        "templateId": "aurora",
        "title": "Topological Photonic Crystals: Non-Abelian Braiding in Synthetic Dimensions",
        "themeColor": "#6C3CE0",
        "cards": [
          {
            "id": "card_aurora_intro_challenge",
            "title": "Topological Photonics Challenge",
            "pattern": "bullets",
            "content": "Topological protection promises disorder-robust routing of light, but scalable on-chip implementations face fundamental limits.\n\n- **Scalability Bottleneck:** Conventional 2D photonic crystals require $\\gtrsim 10^4$ unit cells for robust edge states at $\\lambda = 1550$ nm, exceeding foundry reticle limits.\n- **Synthetic Dimensions:** Mapping frequency modes $\\omega_n = \\omega_0 + n \\cdot \\Omega$ to a lattice coordinate enables $(2+1)$D topology in a single ring resonator \cite{yuan2018photonic}.\n- **Non-Abelian Gap:** Achieving non-Abelian braiding requires $\\mathcal{PT}$-symmetric gain/loss balance with $\\gamma < 0.3 \\kappa$, where $\\kappa$ is the inter-mode coupling.",
            "column": 1,
            "order": 0,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": []
          },
          {
            "id": "card_aurora_theory_hamiltonian",
            "title": "Synthetic Frequency Hamiltonian",
            "pattern": "bullets",
            "content": "$$\\hat{H} = \\sum_{n} \\omega_n \\hat{a}^{\\dagger}_n \\hat{a}_n + \\kappa \\sum_{n} (e^{i \\phi(t)} \\hat{a}^{\\dagger}_{n+1} \\hat{a}_n + \\text{h.c.}) + i\\gamma \\sum_n (-1)^n \\hat{a}^{\\dagger}_n \\hat{a}_n$$\n\nThe Floquet modulation phase $\\phi(t) = \\phi_0 + \\delta \\phi \\sin(\\Omega t)$ induces an effective gauge field $A_{\\text{eff}} = \\delta \\phi \\cdot \\Omega / \\kappa$ with Chern number $C = 1$ in the $(k, \\phi)$ Brillouin zone. Edge states exhibit unidirectional transport with $> 40$ dB isolation.",
            "column": 1,
            "order": 1,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": []
          },
          {
            "id": "card_aurora_design_architecture",
            "title": "Aurora Device Architecture",
            "pattern": "bullets-image",
            "content": "Silicon nitride microring ($\\mathbf{Q = 2.1 \\times 10^6}$) with integrated electro-optic modulators realizes the synthetic lattice.\n\n- **Ring Geometry:** Radius $R = 120$ \\textmu m, FSR $\\Omega / 2\\pi = 25$ GHz, providing $N = 21$ accessible frequency sites within the 500 GHz modulation bandwidth.\n- **Modulation:** Two-tone RF drive at $\\Omega$ and $2\\Omega$ creates next-nearest-neighbor coupling $\\kappa_2 = 0.35 \\kappa$ for flat-band engineering \cite{ozawa2019topological}.\n- **Readout:** Heterodyne spectroscopy resolves individual synthetic lattice sites with $> 35$ dB extinction.",
            "column": 2,
            "order": 0,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [{ "id": "fig_aurora_arch", "url": "/api/workspaces/aurora-topological-photonics/assets/architecture.png", "caption": "Aurora Device: Microring with Synthetic Frequency Lattice" }],
            "sourceIds": []
          },
          {
            "id": "card_aurora_results_metrics",
            "title": "Topological Transport Metrics",
            "pattern": "stats",
            "content": "**42 dB** Isolation | unidirectional edge transport\n**0.98** Fidelity | non-Abelian braiding\n**21** Sites | synthetic lattice size",
            "column": 2,
            "order": 1,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": []
          },
          {
            "id": "card_aurora_benchmark_table",
            "title": "Benchmark vs. State of the Art",
            "pattern": "bullets-table",
            "content": "Aurora exceeds electronic and photonic baselines in isolation and lattice size.",
            "column": 3,
            "order": 0,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": true,
              "caption": "Topological Platform Comparison",
              "rows": [
                ["Platform", "Isolation (dB)", "Sites", "Loss (dB/cm)"],
                ["2D Photonic Crystal", "28", "—", "2.1"],
                ["Coupled Rings", "34", "8", "1.4"],
                ["Fiber Loop Synthetic", "31", "15", "0.8"],
                ["Aurora (This Work)", "42", "21", "0.12"]
              ]
            },
            "figures": [],
            "sourceIds": []
          },
          {
            "id": "card_aurora_braiding_results",
            "title": "Non-Abelian Braiding Demonstration",
            "pattern": "bullets-two-images",
            "content": "Adiabatic encircling of exceptional points braids $\\mathbf{\\Psi}_1$ and $\\mathbf{\\Psi}_2$ with fidelity $\\mathcal{F} = |\\langle \\Psi_{\\text{target}} | \\Psi_{\\text{out}} \\rangle|^2 = 0.98 \\pm 0.01$ across $n=500$ trials.",
            "column": 3,
            "order": 1,
            "figureLayout": "two-up",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [
              { "id": "fig_aurora_braid", "url": "/api/workspaces/aurora-topological-photonics/assets/benchmark.png", "caption": "Braiding Fidelity vs. Encircling Rate" },
              { "id": "fig_aurora_edge", "url": "/api/workspaces/aurora-topological-photonics/assets/architecture.png", "caption": "Edge State Dispersion" }
            ],
            "sourceIds": []
          },
          {
            "id": "card_aurora_takeaway_conclusion",
            "title": "Outlook",
            "pattern": "metric-card",
            "content": "**21-site** Synthetic Lattice | largest to date\n**$\\mathcal{PT}$-Symmetric** | exceptional-point braiding",
            "column": 1,
            "order": 2,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": []
          },
          {
            "id": "card_aurora_references_citations",
            "title": "References",
            "pattern": "references",
            "content": "\\cite{yuan2018photonic,ozawa2019topological,el2018non}",
            "column": 2,
            "order": 2,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": []
          }
        ]
      },
      {
        "id": "out_aurora_slides",
        "outputType": "slides",
        "templateId": "beamer-editorial",
        "title": "Aurora Topological Photonics: Slides",
        "themeColor": "#6C3CE0",
        "cards": [
          {
            "id": "card_aurora_slides_title",
            "title": "Title",
            "pattern": "title-slide",
            "content": "Aurora: Topological Photonic Crystals with Synthetic Dimensions",
            "column": null,
            "order": 0,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_aurora_slides_motivation",
            "title": "Why Synthetic Dimensions?",
            "pattern": "bullets",
            "content": "- **Topological Protection:** Immunity to fabrication disorder requires large lattices.\n- **Synthetic Advantage:** Frequency lattice compresses $(2+1)$D topology into a single resonator with $N=21$ sites.\n- **Application:** Non-Abelian braiding for topologically protected photonic gates.",
            "column": null,
            "order": 1,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_aurora_slides_hamiltonian",
            "title": "Hamiltonian & Gauge Field",
            "pattern": "two-column",
            "content": "$$\\hat{H} = \\sum_n \\omega_n \\hat{a}^{\\dagger}_n \\hat{a}_n + \\kappa \\sum_n (e^{i\\phi(t)}\\hat{a}^{\\dagger}_{n+1}\\hat{a}_n + h.c.)$$ Synthetic gauge field $A_{\\text{eff}} = \\delta\\phi \\cdot \\Omega / \\kappa$ yields Chern number $C=1$.",
            "column": null,
            "order": 2,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_aurora_slides_device",
            "title": "Aurora Device",
            "pattern": "figure-slide",
            "content": "SiN microring with $Q=2.1\\times10^6$, $R=120$ \\textmu m, FSR 25 GHz, two-tone modulation for $\\kappa_2$ coupling.",
            "column": null,
            "order": 3,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [{ "id": "fig_aurora_dev_s", "url": "/api/workspaces/aurora-topological-photonics/assets/architecture.png", "caption": "Device schematic" }],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_aurora_slides_results",
            "title": "Braiding & Transport",
            "pattern": "bullets",
            "content": "- **Isolation:** 42 dB unidirectional edge transport.\n- **Fidelity:** 0.98 braiding fidelity ($n=500$).\n- **Lattice:** 21 synthetic sites, largest to date.",
            "column": null,
            "order": 4,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_aurora_slides_conclusion",
            "title": "Conclusion",
            "pattern": "bullets",
            "content": "- Synthetic frequency dimensions compress topology into single resonator.\n- Non-Abelian braiding at 0.98 fidelity enables photonic gates.\n- Next: scaling to $N=51$ with lithium niobate modulators.",
            "column": null,
            "order": 5,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          }
        ]
      },
      {
        "id": "out_aurora_paper",
        "outputType": "paper",
        "templateId": "article-twocol",
        "title": "Aurora: Paper",
        "themeColor": "#6C3CE0",
        "cards": [
          {
            "id": "card_aurora_paper_abstract",
            "title": "Abstract",
            "pattern": "section",
            "content": "We demonstrate non-Abelian braiding of photonic modes in a synthetic frequency dimension realized by a modulated silicon nitride microring. By mapping $N=21$ frequency modes to lattice sites with tunable coupling $\\kappa/2\\pi = 180$ MHz and implementing $\\mathcal{PT}$-symmetric gain/loss $\\gamma = 0.25\\kappa$, we realize a $(2+1)$D Chern insulator with $C=1$. Adiabatic encircling of exceptional points braids degenerate edge states with fidelity $0.98 \\pm 0.01$. Unidirectional edge transport exhibits 42 dB isolation, surpassing 2D photonic crystal baselines by 14 dB. Our 120-\\textmu m single-resonator platform compresses $10^4$-cell topology into CMOS-compatible footprint, opening routes to topologically protected photonic logic.",
            "column": null,
            "order": 0,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_aurora_paper_intro",
            "title": "Introduction",
            "pattern": "section",
            "content": "Topological photonics leverages band topology to achieve disorder-robust light transport \\cite{lu2014topological}. However, 2D implementations require large footprints and precise disorder control. Synthetic dimensions offer an alternative by using internal degrees of freedom as lattice coordinates \\cite{yuan2018photonic}. Frequency synthetic dimensions are particularly attractive: a single resonator hosts $N \\sim 20$ modes within telecom bandwidth, and electro-optic modulation provides reconfigurable coupling. Non-Abelian braiding, essential for topological quantum gates, further requires exceptional-point encircling in non-Hermitian systems. Here we unite these concepts in the Aurora platform.",
            "column": null,
            "order": 1,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [{ "id": "fig_aurora_intro_p", "url": "/api/workspaces/aurora-topological-photonics/assets/architecture.png", "caption": "Figure 1: Aurora synthetic dimension concept and device." }],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_aurora_paper_methods",
            "title": "Hamiltonian Engineering",
            "pattern": "section",
            "content": "The synthetic lattice Hamiltonian is $\\hat{H} = \\sum_n \\omega_n \\hat{a}^{\\dagger}_n \\hat{a}_n + \\kappa \\sum_n (e^{i\\phi(t)}\\hat{a}^{\\dagger}_{n+1}\\hat{a}_n + \\text{h.c.}) + i\\gamma \\sum_n (-1)^n \\hat{a}^{\\dagger}_n \\hat{a}_n$ with Floquet phase $\\phi(t)=\\phi_0+\\delta\\phi \\sin(\\Omega t)$. The effective gauge field $A_{\\text{eff}} = \\delta\\phi \\Omega / \\kappa$ opens a topological gap $\\Delta_{\\text{top}} = 2\\kappa \\sqrt{1-(\\gamma/\\kappa)^2} \\approx 1.9\\kappa$ for $\\gamma=0.25\\kappa$. Two-tone modulation adds $\\kappa_2=0.35\\kappa$ next-nearest-neighbor coupling to flatten the edge dispersion to $v_g$ variation $<5\\%$.",
            "column": null,
            "order": 2,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_aurora_paper_results",
            "title": "Results: Braiding & Isolation",
            "pattern": "section-table",
            "content": "We characterize edge transport and braiding fidelity:",
            "column": null,
            "order": 3,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": true,
              "caption": "Table 1: Topological metrics vs. baselines.",
              "rows": [
                ["Platform", "Isolation (dB)", "Sites", "Fidelity"],
                ["2D PhC", "28", "—", "—"],
                ["Coupled Rings", "34", "8", "0.82"],
                ["Fiber Loop", "31", "15", "0.88"],
                ["Aurora", "42", "21", "0.98"]
              ]
            },
            "figures": [],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_aurora_paper_discussion",
            "title": "Discussion",
            "pattern": "section",
            "content": "Aurora's 42 dB isolation exceeds prior synthetic dimension records by 8 dB, attributable to the high $Q=2.1\\times10^6$ and low propagation loss 0.12 dB/cm. The 0.98 braiding fidelity is limited by residual non-adiabatic transitions ($\\approx 1.2\\%$) and detection shot noise ($0.8\\%$). Scaling to $N=51$ requires 1.2 THz bandwidth, achievable with thin-film lithium niobate modulators ($V_\\pi=1.2$ V). Hybrid integration with superconducting detectors could enable single-photon topological gates with $g^{(2)}(0) < 0.05$.",
            "column": null,
            "order": 4,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [{ "id": "fig_aurora_braid_p", "url": "/api/workspaces/aurora-topological-photonics/assets/benchmark.png", "caption": "Figure 2: Braiding fidelity and isolation spectra." }],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_aurora_paper_conclusion",
            "title": "Conclusion",
            "pattern": "section",
            "content": "We realized non-Abelian braiding in a synthetic frequency dimension with 21 sites, 42 dB topological isolation, and 0.98 fidelity. The single-resonator Aurora platform demonstrates that synthetic dimensions can compress large-scale topology into foundry-compatible footprints while preserving non-Hermitian braiding capabilities. This establishes synthetic frequency lattices as a platform for topologically protected photonic information processing.",
            "column": null,
            "order": 5,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_aurora_paper_references",
            "title": "References",
            "pattern": "references",
            "content": "\\cite{yuan2018photonic,ozawa2019topological,el2018non,lu2014topological}",
            "column": null,
            "order": 6,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          }
        ]
      }
    ],
    "assets": [
      { "id": "ast_aurora_arch", "fileId": "architecture.png", "filename": "architecture.png", "url": "/api/workspaces/aurora-topological-photonics/assets/architecture.png", "kind": "figure", "page": 1, "confidence": "high", "caption": "Aurora device architecture" },
      { "id": "ast_aurora_bench", "fileId": "benchmark.png", "filename": "benchmark.png", "url": "/api/workspaces/aurora-topological-photonics/assets/benchmark.png", "kind": "figure", "page": 1, "confidence": "high", "caption": "Braiding and transport benchmarks" }
    ],
    "ingestFiles": []
  },
  {
    "id": "landscape-ocean-circulation",
    "name": "Landscape: Atlantic Meridional Overturning Early Warning",
    "posterTitle": "Early Warning of AMOC Tipping: Landscape Analysis of Critical Slowing Down",
    "authors": "Isabella Rossi, Kwame Asante, Yuki Nakamura, Pierre Dubois",
    "venue": "Nature Climate Change 2027 • Tipping Points",
    "templateName": "landscape",
    "activeOutputId": "out_landscape_poster",
    "outputs": [
      {
        "id": "out_landscape_poster",
        "outputType": "poster",
        "templateId": "landscape",
        "title": "Early Warning of AMOC Tipping: Critical Slowing Down in a $1/12^\\circ$ Ocean Model",
        "themeColor": "#0F4C75",
        "cards": [
          {
            "id": "card_landscape_intro_motivation",
            "title": "AMOC Tipping Risk",
            "pattern": "bullets",
            "content": "The Atlantic Meridional Overturning Circulation (AMOC) transports $\\sim 18$ Sv ($1$ Sv $=10^6$ m$^3$/s) northward, regulating European climate by $\\sim 5^{\\circ}$C. Paleo records show abrupt $\\Delta T > 8^{\\circ}$C collapses within decades.\n\n- **Model Spread:** CMIP6 models disagree on tipping threshold: freshwater forcing $F_{\\text{crit}} = 0.18$–$0.42$ Sv.\n- **Early Warning:** Critical slowing down predicts variance $\\sigma^2 \\propto (\\lambda)^{-1}$ and autocorrelation $\\rho_1 \\to 1$ as eigenvalue $\\lambda \\to 0$.\n- **Resolution Gap:** $1^\\circ$ models misrepresent mesoscale eddies ($\\sim 10$ km) that stabilize AMOC by $\\Delta F \\approx 0.1$ Sv \cite{weijer2019atlantic}.",
            "column": 1,
            "order": 0,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": []
          },
          {
            "id": "card_landscape_theory_dynamical",
            "title": "Dynamical Landscape Theory",
            "pattern": "bullets",
            "content": "$$\\frac{d\\mathbf{x}}{dt} = -\\nabla U(\\mathbf{x}; \\mu) + \\sigma \\eta(t), \\quad U(x; \\mu) = \\frac{1}{4}x^4 - \\frac{1}{2}\\mu x^2 - hx$$\n\nCusp catastrophe with bifurcation at $\\mu_c = 0$; restoring rate $\\lambda = U''(x^*; \\mu)$ vanishes as $\\lambda \\sim \\sqrt{\\mu - \\mu_c}$. Variance and lag-1 autocorrelation: $\\text{Var} = \\sigma^2/(2\\lambda)$, $\\rho_1 = \\exp(-\\lambda \\Delta t) \\approx 1 - \\lambda \\Delta t$. Detrended fluctuation analysis exponent $\\alpha \\to 1.5$ at tipping.",
            "column": 1,
            "order": 1,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": []
          },
          {
            "id": "card_landscape_model_hr",
            "title": "High-Resolution Ocean Model",
            "pattern": "bullets-image",
            "content": "$1/12^\\circ$ NEMO4-SI$^3$ global configuration (2.3B grid cells) forced by JRA-55 reanalysis plus idealized freshwater hosing.\n\n- **Resolution:** 8 km at $50^\\circ$N resolves mesoscale eddies; Gent-McWilliams parameterization disabled, explicit eddy transport.\n- **Integration:** 1,200-year spin-up + 800-year hosing ramps $F = 0$ to $0.6$ Sv at $0.05$ Sv/century; $\\Delta t = 270$ s, 4.2M core-hours on Levante HPC.\n- **Observable:** AMOC strength $\\Psi_{\\max}$ at $26.5^\\circ$N, plus fingerprint SST dipole $\\Delta\\text{SST} = \\text{SST}_{\\text{subpolar}} - \\text{SST}_{\\text{Gulf Stream}}$ \\cite{caesar2018observed}.",
            "column": 2,
            "order": 0,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [{ "id": "fig_landscape_model", "url": "/api/workspaces/landscape-ocean-circulation/assets/architecture.png", "caption": "Model Bathymetry and AMOC Streamfunction" }],
            "sourceIds": []
          },
          {
            "id": "card_landscape_metrics_ewi",
            "title": "Early Warning Indicators",
            "pattern": "stats",
            "content": "**3.2×** Variance Rise | 50 yr before tipping\n**0.92** $\\rho_1$ | at $F=0.28$ Sv\n**18 yr** Lead Time | $\\alpha$ cross 1.2",
            "column": 2,
            "order": 1,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": []
          },
          {
            "id": "card_landscape_comparison_table",
            "title": "Early Warning Skill",
            "pattern": "bullets-table",
            "content": "Landscape indicators outperform classical variance-only methods.",
            "column": 3,
            "order": 0,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": true,
              "caption": "EWI Performance (AUC) on Synthetic Tipping Ensembles",
              "rows": [
                ["Indicator", "AUC", "Lead (yr)", "False Pos."],
                ["Variance only", "0.68", "12", "0.31"],
                ["$\\rho_1$ only", "0.71", "15", "0.28"],
                ["DFA $\\alpha$", "0.79", "22", "0.18"],
                ["Landscape (all)", "0.91", "38", "0.07"]
              ]
            },
            "figures": [],
            "sourceIds": []
          },
          {
            "id": "card_landscape_spatial_results",
            "title": "Spatial Tipping Map & Hysteresis",
            "pattern": "bullets-two-images",
            "content": "Restoring rate $\\lambda$ mapped via $\\text{Var}/\\rho_1$ inversion shows weakest stability in Labrador Sea ($\\lambda = 0.08$ yr$^{-1}$ vs basin mean $0.21$ yr$^{-1}$). Hysteresis width $\\Delta F = 0.18$ Sv implies 180 yr recovery timescale.",
            "column": 3,
            "order": 1,
            "figureLayout": "two-up",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [
              { "id": "fig_landscape_map", "url": "/api/workspaces/landscape-ocean-circulation/assets/benchmark.png", "caption": "Spatial $\\lambda$ Map" },
              { "id": "fig_landscape_hyst", "url": "/api/workspaces/landscape-ocean-circulation/assets/architecture.png", "caption": "Hysteresis Loop $\\Psi(F)$" }
            ],
            "sourceIds": []
          },
          {
            "id": "card_landscape_takeaway_policy",
            "title": "Policy Implication",
            "pattern": "metric-card",
            "content": "**$F_{\\text{crit}} = 0.32 \\pm 0.03$ Sv** | high-res estimate\n**2025 $F\\approx0.14$ Sv** | 44\\% to tipping",
            "column": 1,
            "order": 2,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": []
          },
          {
            "id": "card_landscape_references_citations",
            "title": "References",
            "pattern": "references",
            "content": "@article{weijer2019atlantic,\n  title={Stability of the Atlantic Meridional Overturning Circulation},\n  author={Weijer, Wilbert and others},\n  journal={Rev. Geophys.},\n  volume={57},\n  pages={675--709},\n  year={2019}\n}\n\n@article{caesar2018observed,\n  title={Observed fingerprint of a weakening Atlantic Ocean overturning circulation},\n  author={Caesar, Levke and others},\n  journal={Nature},\n  volume={556},\n  pages={191--196},\n  year={2018}\n}\n\n@article{boettner2021critical,\n  title={Critical slowing down in the Atlantic Meridional Overturning Circulation},\n  author={B{\"o}ttner, Christoph and Boers, Niklas},\n  journal={Nat. Clim. Change},\n  volume={11},\n  pages={680--688},\n  year={2021}\n}\n\n@article{ditlevsen2023warning,\n  title={Warning of a forthcoming collapse of the Atlantic meridional overturning circulation},\n  author={Ditlevsen, Peter and Ditlevsen, Susanne},\n  journal={Nat. Commun.},\n  volume={14},\n  pages={4254},\n  year={2023}\n}",
            "column": 2,
            "order": 2,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": []
          }
        ]
      },
      {
        "id": "out_landscape_slides",
        "outputType": "slides",
        "templateId": "beamer-default",
        "title": "AMOC Early Warning: Slides",
        "themeColor": "#0F4C75",
        "cards": [
          {
            "id": "card_landscape_slides_title",
            "title": "Title",
            "pattern": "title-slide",
            "content": "Early Warning of AMOC Tipping: Landscape Analysis",
            "column": null,
            "order": 0,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_landscape_slides_risk",
            "title": "AMOC Tipping Risk",
            "pattern": "bullets",
            "content": "- **18 Sv** northward transport, $5^{\\circ}$C European warming.\n- **CMIP6 spread:** $F_{\\text{crit}} = 0.18$–$0.42$ Sv.\n- **Critical slowing down:** $\\sigma^2 \\propto 1/\\lambda$, $\\rho_1 \\to 1$.",
            "column": null,
            "order": 1,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_landscape_slides_theory",
            "title": "Landscape Theory",
            "pattern": "two-column",
            "content": "$$U(x;\\mu)=\\frac14x^4-\\frac12\\mu x^2-hx,\\quad \\lambda=U''(x^*;\\mu)\\to0$$ Variance $\\sigma^2/2\\lambda$, $\\rho_1=e^{-\\lambda\\Delta t}$.",
            "column": null,
            "order": 2,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_landscape_slides_model",
            "title": "$1/12^\\circ$ Ocean Model",
            "pattern": "figure-slide",
            "content": "NEMO4 global 2.3B cells, 8 km at $50^\\circ$N, 800-yr hosing ramp $0$–$0.6$ Sv.",
            "column": null,
            "order": 3,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [{ "id": "fig_landscape_model_s", "url": "/api/workspaces/landscape-ocean-circulation/assets/architecture.png", "caption": "Streamfunction" }],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_landscape_slides_results",
            "title": "Early Warning Results",
            "pattern": "bullets",
            "content": "- **3.2× variance** 50 yr before tipping.\n- **$\\rho_1=0.92$** at $F=0.28$ Sv.\n- **AUC 0.91**, 38 yr lead, 7\\% false positives.",
            "column": null,
            "order": 4,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_landscape_slides_conclusion",
            "title": "Conclusion",
            "pattern": "bullets",
            "content": "- $F_{\\text{crit}}=0.32\\pm0.03$ Sv, 44\\% of tipping distance covered by 2025.\n- Landscape indicators give 38-yr lead vs 12-yr for variance alone.\n- Policy: track Labrador Sea $\\lambda$ via $\\Delta$SST.",
            "column": null,
            "order": 5,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          }
        ]
      },
      {
        "id": "out_landscape_paper",
        "outputType": "paper",
        "templateId": "ieee-conf",
        "title": "Landscape: Paper",
        "themeColor": "#0F4C75",
        "cards": [
          {
            "id": "card_landscape_paper_abstract",
            "title": "Abstract",
            "pattern": "section",
            "content": "We present a 1/12$^\\circ$ global ocean simulation to quantify early warning signals of Atlantic Meridional Overturning Circulation (AMOC) collapse. Across 800-year freshwater hosing ramps ($0$–$0.6$ Sv), we track variance, lag-1 autocorrelation $\\rho_1$, and detrended fluctuation exponent $\\alpha$ of the AMOC strength $\\Psi_{\\max}$ and SST dipole $\\Delta$SST. The high-resolution model, which explicitly resolves mesoscale eddies, yields $F_{\\text{crit}} = 0.32 \\pm 0.03$ Sv, 0.10 Sv higher than $1^\\circ$ counterparts. A combined landscape indicator achieves AUC $0.91$ with 38-year lead time and 7\\% false-positive rate, vs AUC $0.68$ for variance alone. Spatial mapping of the restoring rate $\\lambda$ identifies the Labrador Sea as the stability bottleneck ($\\lambda=0.08$ yr$^{-1}$). Hysteresis width $\\Delta F=0.18$ Sv implies centennial recovery times. Current freshwater input $F\\approx0.14$ Sv in 2025 places the system at 44\\% of the tipping distance.",
            "column": null,
            "order": 0,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_landscape_paper_intro",
            "title": "Introduction",
            "pattern": "section",
            "content": "The AMOC is a key tipping element with paleo evidence for abrupt transitions \\cite{weijer2019atlantic}. CMIP6 $1^\\circ$ models span $F_{\\text{crit}}=0.18$–$0.42$ Sv due to eddy parameterization uncertainty \\cite{caesar2018observed}. Critical slowing down theory predicts $\\text{Var} \\propto \\lambda^{-1}$, $\\rho_1 \\to 1$ near bifurcation, but skill on high-resolution dynamics is untested. We address this with the first $1/12^\\circ$ early warning assessment using the NEMO4-SI$^3$ framework on Levante HPC (4.2M core-hours).",
            "column": null,
            "order": 1,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [{ "id": "fig_landscape_intro_p", "url": "/api/workspaces/landscape-ocean-circulation/assets/architecture.png", "caption": "Figure 1: Model and AMOC mean state." }],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_landscape_paper_model",
            "title": "High-Resolution Model & Hosing Protocol",
            "pattern": "section",
            "content": "NEMO4 at $1/12^\\circ$ ($\\approx 8$ km at $50^\\circ$N, 2.3B cells, 75 vertical levels) with explicit eddies (Gent-McWilliams disabled) is spun up 1,200 years under JRA-55 forcing. Freshwater hosing applies $F(t)=r t$ with $r=0.05$ Sv/century uniformly over $50$–$70^\\circ$N, $\\Delta t=270$ s. We diagnose $\\Psi_{\\max}$ at $26.5^\\circ$N and $\\Delta$SST, detrending with 50-year Gaussian kernel before computing $\\sigma^2$, $\\rho_1$ (50-year windows), and DFA $\\alpha$ (window $10$–$100$ yr).",
            "column": null,
            "order": 2,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_landscape_paper_evaluation",
            "title": "Early Warning Skill",
            "pattern": "section-table",
            "content": "Landscape combination outperforms single-indicator baselines:",
            "column": null,
            "order": 3,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": true,
              "caption": "Table 1: EWI AUC on 200-member synthetic tipping ensemble.",
              "rows": [
                ["Indicator", "AUC", "Lead (yr)", "FPR"],
                ["Variance", "0.68", "12", "0.31"],
                ["$\\rho_1$", "0.71", "15", "0.28"],
                ["DFA $\\alpha$", "0.79", "22", "0.18"],
                ["Landscape", "0.91", "38", "0.07"]
              ]
            },
            "figures": [],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_landscape_paper_spatial",
            "title": "Spatial Structure & Hysteresis",
            "pattern": "section-figure",
            "content": "Inversion of $\\lambda$ from $\\sigma^2$ and $\\rho_1$ yields a spatial stability map: Labrador Sea $\\lambda=0.08$ yr$^{-1}$ (weakest), Irminger Sea $0.14$ yr$^{-1}$, basin mean $0.21$ yr$^{-1}$. Hysteresis experiments (reverse hosing) show recovery at $F_{\\text{rec}}=0.14$ Sv vs collapse at $0.32$ Sv, width $\\Delta F=0.18$ Sv, implying $\\tau_{\\text{rec}} \\sim \\Delta F / r \\approx 360$ yr at current rates. This asymmetry challenges reversibility assumptions in integrated assessment models.",
            "column": null,
            "order": 4,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [{ "id": "fig_landscape_spatial_p", "url": "/api/workspaces/landscape-ocean-circulation/assets/benchmark.png", "caption": "Figure 2: Spatial $\\lambda$ and hysteresis." }],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_landscape_paper_conclusion",
            "title": "Conclusion",
            "pattern": "section",
            "content": "High-resolution eddy-resolving simulation raises $F_{\\text{crit}}$ by 0.10 Sv vs coarse models and enables 38-year early warning lead time via landscape indicators. The Labrador Sea emerges as the sentinel region for monitoring via $\\Delta$SST. With $F\\approx0.14$ Sv in 2025 (44\\% to tipping), sustained observation of $\\rho_1$ and $\\alpha$ is warranted. Future work couples the ocean landscape to an active atmosphere for fully coupled tipping risk.",
            "column": null,
            "order": 5,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_landscape_paper_references",
            "title": "References",
            "pattern": "references",
            "content": "@article{weijer2019atlantic,\n  title={Stability of the Atlantic Meridional Overturning Circulation},\n  author={Weijer, Wilbert and others},\n  journal={Rev. Geophys.},\n  volume={57},\n  pages={675--709},\n  year={2019}\n}\n\n@article{caesar2018observed,\n  title={Observed fingerprint of a weakening Atlantic Ocean overturning circulation},\n  author={Caesar, Levke and others},\n  journal={Nature},\n  volume={556},\n  pages={191--196},\n  year={2018}\n}\n\n@article{boettner2021critical,\n  title={Critical slowing down in the Atlantic Meridional Overturning Circulation},\n  author={B{\"o}ttner, Christoph and Boers, Niklas},\n  journal={Nat. Clim. Change},\n  volume={11},\n  pages={680--688},\n  year={2021}\n}\n\n@article{ditlevsen2023warning,\n  title={Warning of a forthcoming collapse of the Atlantic meridional overturning circulation},\n  author={Ditlevsen, Peter and Ditlevsen, Susanne},\n  journal={Nat. Commun.},\n  volume={14},\n  pages={4254},\n  year={2023}\n}",
            "column": null,
            "order": 6,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          }
        ]
      }
    ],
    "assets": [
      { "id": "ast_landscape_arch", "fileId": "architecture.png", "filename": "architecture.png", "url": "/api/workspaces/landscape-ocean-circulation/assets/architecture.png", "kind": "figure", "page": 1, "confidence": "high", "caption": "Ocean model and streamfunction" },
      { "id": "ast_landscape_bench", "fileId": "benchmark.png", "filename": "benchmark.png", "url": "/api/workspaces/landscape-ocean-circulation/assets/benchmark.png", "kind": "figure", "page": 1, "confidence": "high", "caption": "Early warning indicators" }
    ],
    "ingestFiles": []
  },
  {
    "id": "betterposter-single-cell-atlas",
    "name": "Betterposter: Human Cell Atlas at Single-Cell Resolution",
    "posterTitle": "Mapping 12M Cells: Betterposter Atlas of Human Tissue Niches",
    "authors": "Fatima Al-Zahra, James Park, Lina Gomez, David Kim",
    "venue": "Cell 2027 • Human Cell Atlas",
    "templateName": "betterposter",
    "activeOutputId": "out_betterposter_poster",
    "outputs": [
      {
        "id": "out_betterposter_poster",
        "outputType": "poster",
        "templateId": "betterposter",
        "title": "Mapping 12M Cells: Single-Cell Atlas of Human Tissue Niches",
        "themeColor": "#E63946",
        "cards": [
          {
            "id": "card_betterposter_intro_challenge",
            "title": "Atlas Challenge",
            "pattern": "bullets",
            "content": "The Human Cell Atlas aims to map all $\\sim 37.2 \\times 10^{12}$ cells across 200+ cell types, but batch effects and rare cell detection limit completeness.\n\n- **Scale:** 12M cells from 48 donors, 18 tissues, 3′ scRNA-seq plus CITE-seq (184 surface proteins). Rare niches ($<0.05\\%$) require $>10$M cells for $95\\%$ detection power.\n- **Batch:** $N_{\\text{batch}}=142$ 10x lanes with donor, tissue, and chemistry confounders; kBET acceptance $<0.6$ before correction.\n- **Trajectory:** Differentiation continua (e.g., hematopoiesis) violate discrete clustering assumptions ($\\sim 30\\%$ of cells in transition states).",
            "column": 1,
            "order": 0,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": []
          },
          {
            "id": "card_betterposter_theory_model",
            "title": "Latent Space Model",
            "pattern": "bullets",
            "content": "$$\\mathbf{z}_n \\sim \\mathcal{N}(0, I),\\quad \\mathbf{\\rho}_n = f_{\\theta}(\\mathbf{z}_n, s_n),\\quad x_{ng} \\sim \\text{NB}(\\ell_n \\rho_{ng}, \\theta_g)$$\n\nVariational autoencoder with batch covariate $s_n$ and library size $\\ell_n$; decoder $f_{\\theta}$ is a 3-layer MLP (128-128-256). Loss: $\\mathcal{L} = \\mathbb{E}_{q}[\\log p(x|z,s)] - \\beta \\cdot \\text{KL}(q(z|x)||p(z))$ with $\\beta=0.6$ annealing. Graph-based clustering on $k=30$ NN graph of $\\mathbf{z}$ with Leiden $\\gamma=1.2$ yields 284 clusters.",
            "column": 1,
            "order": 1,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": []
          },
          {
            "id": "card_betterposter_methods_pipeline",
            "title": "Betterposter Pipeline",
            "pattern": "bullets-image",
            "content": "Harmony-SCVI hybrid: scVI batch correction followed by Harmony on $\\mathbf{z}$.\n\n- **QC:** 11.7M cells pass (97.5\\% retention) after QC (mito <15\\%).\n- **Integration:** kBET $0.94$ vs $0.58$ before; LISI $2.1$.\n- **Annotation:** CellTypist logistic regression + manual curation; 284 clusters map to 187 types \cite{domcke2020human}.",
            "column": 2,
            "order": 0,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [{ "id": "fig_betterposter_pipeline", "url": "/api/workspaces/betterposter-single-cell-atlas/assets/architecture.png", "caption": "Integration Pipeline" }],
            "sourceIds": []
          },
          {
            "id": "card_betterposter_metrics_stats",
            "title": "Atlas Scale Metrics",
            "pattern": "stats",
            "content": "**11.7M** Cells | after QC\n**284** Clusters | 187 types\n**0.94** kBET | integration score",
            "column": 2,
            "order": 1,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": []
          },
          {
            "id": "card_betterposter_discovery_table",
            "title": "Novel Niches Discovered",
            "pattern": "bullets-table",
            "content": "Rare cell discovery enabled by scale and trajectory analysis.",
            "column": 3,
            "order": 0,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": true,
              "caption": "Novel Populations (Validated by smFISH)",
              "rows": [
                ["Niche", "Freq.", "Marker", "Tissue"],
                ["ALVEOLAR_ION", "0.03%", "FOXI1+CFTR high", "Lung"],
                ["CRYPT_PLASTIC", "0.08%", "LGR5+KRT19+", "Colon"],
                ["STELLATE_AXON", "0.02%", "GFAP+NGFR+", "Liver"]
              ]
            },
            "figures": [],
            "sourceIds": []
          },
          {
            "id": "card_betterposter_trajectory_results",
            "title": "Trajectory & Validation",
            "pattern": "bullets-two-images",
            "content": "Pseudotime via diffusion maps ($\\mathbf{P} = \\mathbf{D}^{-1} \\mathbf{W}$, $\\psi_t = \\sum_i \\lambda_i^t \\psi_i$) recovers hematopoietic branching with $0.89$ correlation to known lineage \\cite{trapnell2014pseudo}. smFISH validation confirms spatial colocalization ($p < 10^{-6}$).",
            "column": 3,
            "order": 1,
            "figureLayout": "two-up",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [
              { "id": "fig_betterposter_traj", "url": "/api/workspaces/betterposter-single-cell-atlas/assets/benchmark.png", "caption": "Diffusion Pseudotime" },
              { "id": "fig_betterposter_spatial", "url": "/api/workspaces/betterposter-single-cell-atlas/assets/architecture.png", "caption": "smFISH Validation" }
            ],
            "sourceIds": []
          },
          {
            "id": "card_betterposter_takeaway_impact",
            "title": "Impact",
            "pattern": "metric-card",
            "content": "**3 Novel** Niches | $<0.1\\%$ frequency\n**0.89** Trajectory $r$ | vs lineage",
            "column": 1,
            "order": 2,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": []
          },
          {
            "id": "card_betterposter_references_citations",
            "title": "References",
            "pattern": "references",
            "content": "\\cite{domcke2020human,trapnell2014pseudo,rozenblatt2018human}",
            "column": 2,
            "order": 2,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": []
          }
        ]
      },
      {
        "id": "out_betterposter_slides",
        "outputType": "slides",
        "templateId": "beamer-madrid",
        "title": "Single-Cell Atlas: Slides",
        "themeColor": "#E63946",
        "cards": [
          {
            "id": "card_betterposter_slides_title",
            "title": "Title",
            "pattern": "title-slide",
            "content": "Mapping 12M Cells: Human Tissue Niches",
            "column": null,
            "order": 0,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_betterposter_slides_challenge",
            "title": "Why 12M Cells?",
            "pattern": "bullets",
            "content": "- **Rare niches** $<0.05\\%$ need $>10$M cells for detection.\n- **Batch:** 142 lanes, kBET $0.58$ before correction.\n- **Continuum:** 30\\% cells in transition states.",
            "column": null,
            "order": 1,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_betterposter_slides_model",
            "title": "Generative Model",
            "pattern": "two-column",
            "content": "$$\\mathbf{z}_n\\sim\\mathcal{N}(0,I),\\quad x_{ng}\\sim\\text{NB}(\\ell_n\\rho_{ng},\\theta_g)$$ $\\rho_n=f_{\\theta}(z_n,s_n)$, scVI+Harmony, kBET 0.94.",
            "column": null,
            "order": 2,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_betterposter_slides_results",
            "title": "Discovery",
            "pattern": "figure-slide",
            "content": "284 clusters, 187 types, 3 novel niches validated by smFISH, diffusion pseudotime $r=0.89$.",
            "column": null,
            "order": 3,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [{ "id": "fig_betterposter_res_s", "url": "/api/workspaces/betterposter-single-cell-atlas/assets/benchmark.png", "caption": "Atlas UMAP" }],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_betterposter_slides_conclusion",
            "title": "Conclusion",
            "pattern": "bullets",
            "content": "- 11.7M-cell atlas with 0.94 kBET integration.\n- 3 novel rare niches at $<0.1\\%$ frequency.\n- Trajectory model enables regenerative target discovery.",
            "column": null,
            "order": 4,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          }
        ]
      },
      {
        "id": "out_betterposter_paper",
        "outputType": "paper",
        "templateId": "acm-sigconf",
        "title": "Betterposter: Paper",
        "themeColor": "#E63946",
        "cards": [
          {
            "id": "card_betterposter_paper_abstract",
            "title": "Abstract",
            "pattern": "section",
            "content": "We present a single-cell atlas of 11.7M cells from 48 donors and 18 tissues, integrating 3' scRNA-seq and CITE-seq (184 proteins) via a scVI-Harmony hybrid latent space ($\\mathbf{z}\\in\\mathbb{R}^{30}$). The model $x_{ng}\\sim\\text{NB}(\\ell_n\\rho_{ng},\\theta_g)$ with $\\rho_n=f_{\\theta}(z_n,s_n)$ achieves kBET acceptance $0.94$ and LISI $2.1$, correcting 142 batch lanes. Leiden clustering ($\\gamma=1.2$, $k=30$) yields 284 clusters mapping to 187 reference types at 0.92 precision. We discover three ultra-rare niches ($<0.1\\%$ frequency) validated by smFISH and recover hematopoietic trajectories with $r=0.89$ lineage correlation via diffusion pseudotime. The atlas is the largest harmonized human tissue resource to date and identifies progenitor plasticity states for regenerative medicine.",
            "column": null,
            "order": 0,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_betterposter_paper_intro",
            "title": "Introduction",
            "pattern": "section",
            "content": "The Human Cell Atlas (HCA) seeks complete molecular maps of human tissues \\cite{roznblatt2018human}. Prior atlases ($\\sim 1$M cells) lack power for niches at $0.05\\%$ frequency, requiring $>10$M cells for 95\\% detection \\cite{domcke2020human}. Batch effects across donors and chemistries further confound integration, with kBET often $<0.6$. We address both with a 12M-cell resource spanning 18 tissues, using variational autoencoders with explicit batch covariates and graph-based trajectory inference \\cite{trapnell2014pseudo}.",
            "column": null,
            "order": 1,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [{ "id": "fig_betterposter_intro_p", "url": "/api/workspaces/betterposter-single-cell-atlas/assets/architecture.png", "caption": "Figure 1: Atlas overview." }],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_betterposter_paper_methods",
            "title": "Generative Model & Integration",
            "pattern": "section",
            "content": "We model counts as $x_{ng}\\sim\\text{NB}(\\ell_n\\rho_{ng},\\theta_g)$ where $\\ell_n$ is library size, $\\rho_n=\\text{softmax}(f_{\\theta}(z_n,s_n))$, $z_n\\sim\\mathcal{N}(0,I)$, $s_n$ is batch embedding, $f_{\\theta}$ is 3-layer MLP. Variational posterior $q_{\\phi}(z_n|x_n,s_n)=\\mathcal{N}(\\mu_{\\phi}(x_n,s_n),\\text{diag}(\\sigma^2_{\\phi}))$. Training optimizes ELBO $\\mathcal{L}=\\mathbb{E}_q[\\log p(x|z,s)]-\\beta\\cdot\\text{KL}$ with $\\beta$ annealing 0$\\to$0.6 over 10k steps. Post-scVI, Harmony corrects residual tissue effects on $z$ with $\\theta=2.0$. Clustering uses $k=30$ NN + Leiden $\\gamma=1.2$; annotation via CellTypist + manual curation.",
            "column": null,
            "order": 2,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_betterposter_paper_results",
            "title": "Atlas Scale & Novel Niches",
            "pattern": "section-table",
            "content": "QC retains 11.7M cells (97.5\\%); kBET rises from 0.58 to 0.94, LISI from 1.3 to 2.1. Three novel niches validated by smFISH:",
            "column": null,
            "order": 3,
            "figureLayout": "single",
            "validation": "valid",
            "table": {
              "hasHeader": true,
              "caption": "Table 1: Novel niches.",
              "rows": [
                ["Niche", "Freq.", "Marker", "Tissue"],
                ["ALVEOLAR_ION", "0.03%", "FOXI1+CFTR high", "Lung"],
                ["CRYPT_PLASTIC", "0.08%", "LGR5+KRT19+", "Colon"],
                ["STELLATE_AXON", "0.02%", "GFAP+NGFR+", "Liver"]
              ]
            },
            "figures": [],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_betterposter_paper_trajectory",
            "title": "Trajectory Inference",
            "pattern": "section-figure",
            "content": "Diffusion pseudotime ($\\mathbf{P}=\\mathbf{D}^{-1}\\mathbf{W}$, $\\psi_t=\\sum_i \\lambda_i^t\\psi_i$) on hematopoietic cells (n=340k) recovers stem$\\to$myeloid/lymphoid branching with $r=0.89$ to FACS-sorted ground truth. The CRYPT_PLASTIC population lies at a bifurcation point (branch probability $0.52$), suggesting transdifferentiation potential. smFISH colocalization $p<10^{-6}$ confirms spatial adjacency to LGR5+ stem cells.",
            "column": null,
            "order": 4,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [{ "id": "fig_betterposter_traj_p", "url": "/api/workspaces/betterposter-single-cell-atlas/assets/benchmark.png", "caption": "Figure 2: Trajectory and validation." }],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_betterposter_paper_conclusion",
            "title": "Conclusion",
            "pattern": "section",
            "content": "The 11.7M-cell atlas demonstrates that variational batch-corrected latent spaces enable rare niche discovery at $<0.1\\%$ frequency. The three validated niches expand known human cell diversity and point to progenitor plasticity for regeneration. The resource, with 0.94 kBET integration, is available via CELLxGENE. Future work scales to 50M cells with spatial transcriptomics overlay.",
            "column": null,
            "order": 5,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          },
          {
            "id": "card_betterposter_paper_references",
            "title": "References",
            "pattern": "references",
            "content": "\\cite{domcke2020human,trapnell2014pseudo,roznblatt2018human,becht2018umap}",
            "column": null,
            "order": 6,
            "figureLayout": "single",
            "validation": "valid",
            "table": { "hasHeader": false, "caption": "", "rows": [] },
            "figures": [],
            "sourceIds": ["manuscript"],
            "heightBudget": null
          }
        ]
      }
    ],
    "assets": [
      { "id": "ast_betterposter_arch", "fileId": "architecture.png", "filename": "architecture.png", "url": "/api/workspaces/betterposter-single-cell-atlas/assets/architecture.png", "kind": "figure", "page": 1, "confidence": "high", "caption": "Pipeline" },
      { "id": "ast_betterposter_bench", "fileId": "benchmark.png", "filename": "benchmark.png", "url": "/api/workspaces/betterposter-single-cell-atlas/assets/benchmark.png", "kind": "figure", "page": 1, "confidence": "high", "caption": "Trajectory benchmarks" }
    ],
    "ingestFiles": []
  }
];
export const getShowcaseById = (id: string): Project | undefined => {
  return ALL_SHOWCASE_PROJECTS.find(p => p.id === id);
};
