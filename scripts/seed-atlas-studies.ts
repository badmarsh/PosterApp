import { prisma } from "../lib/prisma"
import * as fs from "fs"
import * as path from "path"

const disPaperCards = [
  {
    id: "blk_dis_s0",
    title: "Abstract",
    column: null,
    order: 0,
    pattern: "section",
    content: `The Tile Calorimeter (TileCal) is a sampling hadronic calorimeter covering the central region of the ATLAS experiment, with steel as absorber and plastic scintillators as active medium. The scintillators are read-out by the wavelength shifting fibres coupled to the photomultiplier tubes (PMTs). The analogue signals from the PMTs are amplified, shaped, digitized by sampling the signal every 25 ns and stored on detector until a trigger decision is received. The TileCal front-end electronics reads out the signals produced by about 10000 channels measuring energies ranging from about 30 MeV to about 2 TeV. Each stage of the signal production from scintillation light to the signal reconstruction is monitored and calibrated. During LHC Run-2, high-momentum isolated muons have been used to study and validate the electromagnetic scale, while hadronic response has been probed with isolated hadrons. The calorimeter time resolution has been studied with multi-jet events. First results using early LHC Run-3 data will be shown. A summary of the performance results, including the calibration, stability, absolute energy scale, uniformity and time resolution, will be presented.`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_dis_s1",
    title: "1 Tile Calorimeter",
    column: null,
    order: 1,
    pattern: "section-two-figures",
    content: `The Tile Calorimeter (TileCal) is the central hadronic calorimeter of the ATLAS detector \\cite{ATLAS} at the Large Hadron Collider (LHC) \\cite{LHC}, covering pseudorapidity of $|\\eta| < 1.7$. Its purpose is identification and energy measurements of hadrons, jets and tau leptons decaying hadronically and also measurements of missing transverse energy.

It is divided into 4 partitions: 2 halves of central long barrel (LB) and 2 extended barrels (EB). Each barrel consists of 64 modules in azimuthal direction $\\varphi$. Each module consists of plastic scintillating tiles serving as active medium and steel plates serving as absorber. Light produced by particles passing through scintillating tiles is transmitted to photomultipliers (PMTs) via the wavelength-shifting fibres. In radial direction, the readout cells are divided into 3 layers in LB (A, BC, and D) and 3 layers in EB (A, B, and D). Typically, there are 2 PMTs (channels) for a given readout cell, accounting for a total of 9852 readout channels for the 5182 cells (special E1 - E4 cells have single readout). Signals from channels are divided into 2 branches: low gain (LG) and high gain (HG) and amplified with a relative ratio of 1:64.`,
    figures: [
      { id: "fig_dis_1", url: "assets/plot1.pdf", caption: "The ATLAS calorimeter system." },
      { id: "fig_dis_2", url: "assets/plot2.pdf", caption: "Components and mechanical structure of a single TileCal module." }
    ],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_dis_s2",
    title: "2 Calibration Systems",
    column: null,
    order: 2,
    pattern: "section-figure",
    content: `Various calibration systems used to calibrate each step of the TileCal cell energy reconstruction are utilized. The reconstructed energy $E$ is calculated from the signal amplitude $A$ in analogue to digital converter (ADC) counts using calibration constants:

$$ E \\text{ [GeV]} = \\frac{A\\text{[ADC]}}{{C_{\\text{ADC}\\rightarrow\\text{pC}}} \\times {C_{\\text{pC}\\rightarrow\\text{GeV}}} \\times {C_{\\text{Cs}}} \\times {C_{\\text{MB}}} \\times {C_{\\text{Las}}}} $$

where $C_{\\text{Cs}}$, $C_{\\text{MB}}$, $C_{\\text{Las}}$, and $C_{\\text{ADC}\\rightarrow\\text{pC}}$ are determined using Cesium, Minimum Bias, Laser and Charge Injection System calibrations while the conversion from pC to GeV ($C_{\\text{pC}\\rightarrow\\text{GeV}}$) is determined by measuring the response of the calorimeter to electrons (EM scale) in test beam campaigns \\cite{tile_performance_paper}.`,
    figures: [
      { id: "fig_dis_3", url: "assets/plot5.pdf", caption: "The signal paths for calibration systems used by the TileCal." }
    ],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_dis_s3",
    title: "2.1 Cesium System",
    column: null,
    order: 3,
    pattern: "section-two-figures",
    content: `Calibration with the Cesium system is performed on a monthly basis and is able to calibrate variations of the entire readout chain (optical components as well as PMTs). A capsule containing $^{137}$Cs (radioactive $\\gamma$-source with $E_{\\gamma} = 0.662$ MeV) is moved by a hydraulic system through the calorimeter system measuring the response of every single tile. The signals are read out by a dedicated integrator system separate from the standard readout system.

For typical cells, the precision of cesium calibration is $\\sim 0.3\\%$. Down-drifts in the response variation are caused by degradation in the fibers, scintillating tiles, and PMTs, followed by recovery in periods without collisions. Highest degradation is seen for A layer cells as they are closest to the beam pipe.`,
    figures: [
      { id: "fig_dis_4", url: "assets/plot6.png", caption: "Average response variation to 137Cs source relative to expected value." },
      { id: "fig_dis_5", url: "assets/plot8.pdf", caption: "PMT response variation obtained from Laser calibration runs." }
    ],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_dis_s4",
    title: "2.2 Laser, CIS, and Minimum Bias Systems",
    column: null,
    order: 4,
    pattern: "section",
    content: `**Laser System**
The laser system monitors and calibrates the PMT gains and readout electronics independently of the optical tiles. Short light pulses ($\\sim 10$ ns) at a wavelength of 532 nm are sent to all PMTs simultaneously every few days with sub-percent precision.

**Charge Injection System (CIS)**
The CIS calibrates the front-end electronics by injecting precisely known charges into the readout channels across both low-gain and high-gain modes. It establishes the ADC-to-pC conversion factors ($C_{\\text{ADC}\\rightarrow\\text{pC}}$) with an accuracy better than 0.7%.

**Minimum Bias System (MB)**
The Minimum Bias system monitors the average current drawn by the PMTs during $pp$ collision runs. Since the current is proportional to the instantaneous LHC luminosity, this provides a continuous cross-check of calorimeter response during data taking.`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_dis_s5",
    title: "3 Performance with Collision Data",
    column: null,
    order: 5,
    pattern: "section",
    content: `**Isolated Muons**
High-energy isolated muons originating from $W \\to \\mu\\nu$ decays serve as standard candles to test the electromagnetic energy scale in situ. The measured energy loss per unit length $\\langle \\Delta E / \\Delta x \\rangle$ in data agrees with Monte Carlo simulations to within 1-2% across all layers and pseudorapidities.

**Single Isolated Hadrons**
Hadronic response and linearity are tested with isolated charged hadrons selected with track momentum $p < 20$ GeV. The ratio $E/p$ exhibits excellent consistency between Run-2 and early Run-3 measurements, validating the hadronic shower reconstruction.

**Time Resolution**
Precise timing is vital for pile-up mitigation and searches for long-lived particles. Using high-energy jet events, the TileCal channel time resolution is measured to be better than 1 ns for cell energies above 2 GeV.`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_dis_s6",
    title: "4 Conclusions",
    column: null,
    order: 6,
    pattern: "section",
    content: `The ATLAS Tile Calorimeter has demonstrated outstanding operational stability and precision throughout LHC Run-2 and the start of Run-3. The multifaceted calibration suite (Cesium, Laser, CIS, and Minimum Bias) guarantees an energy scale stability at the level of $\\sim 1\\%$. Performance validations using isolated muons, hadrons, and timing distributions confirm that TileCal continues to deliver top-tier calorimetry for ATLAS physics analyses.`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_dis_s7",
    title: "References",
    column: null,
    order: 7,
    pattern: "references",
    content: `@article{ATLAS,
  author = {ATLAS Collaboration},
  title = {The ATLAS Experiment at the CERN Large Hadron Collider},
  journal = {JINST},
  volume = {3},
  pages = {S08003},
  year = {2008}
}

@article{LHC,
  author = {Evans, L. and Bryant, P.},
  title = {LHC Machine},
  journal = {JINST},
  volume = {3},
  pages = {S08001},
  year = {2008}
}

@article{tile_performance_paper,
  author = {ATLAS Collaboration},
  title = {Operation and performance of the ATLAS Tile Calorimeter in Run 2},
  journal = {Eur. Phys. J. C},
  volume = {81},
  pages = {982},
  year = {2021}
}

@misc{tile_public,
  author = {ATLAS Collaboration},
  title = {Tile Calorimeter Run-2 and Run-3 Public Results},
  howpublished = {ATL-PHYS-PUB-2024-001},
  year = {2024}
}`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  }
]

const icnfpSlideCards = [
  {
    id: "blk_icnfp_c1",
    title: "Introduction",
    column: null,
    order: 0,
    pattern: "title-slide",
    content: `* The **Tile Calorimeter (TileCal)** is the sampling hadronic calorimeter of the ATLAS detector at CERN.
* Covers the central pseudorapidity range $|\\eta| < 1.7$.
* Identifies and measures the energy of hadrons, jets, and tau leptons.
* Provides essential inputs for the Level-1 Calorimeter Trigger and muon identification.`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_icnfp_c2",
    title: "Signal Reconstruction",
    column: null,
    order: 1,
    pattern: "two-column",
    content: `* TileCal consists of plastic scintillator tiles and steel absorbers.
* Light from scintillating tiles is collected by WLS fibres to PMTs.
* Signal shaped and digitized in front-end electronics.
* Two readout gains (high and low, 64:1 ratio).
* Signal sampled every 25 ns, reconstructed using optimal filtering algorithm.`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_icnfp_c3",
    title: "TileCal Readout Geometry",
    column: null,
    order: 2,
    pattern: "bullets",
    content: `* WLS fibres grouped to PMTs to form readout cell geometry.
* Two PMTs per readout cell, total of 9852 channels and 5182 cells.
* TileCal has four partitions: LBA, LBC, EBA, EBC.
* Readout cells divided into three radial layers in LB and EB.
* Each barrel has 64 modules in azimuthal direction.`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_icnfp_c4",
    title: "Energy Calibration",
    column: null,
    order: 3,
    pattern: "bullets",
    content: `* Several dedicated calibration systems:
  - **Cesium system** ($^{137}$Cs): whole optical chain
  - **Laser system**: PMT gains
  - **Charge Injection System (CIS)**: electronics readout
  - **Minimum-bias system**: continuous in situ monitoring
* Energy in GeV calculated as:
$$ E \\text{ [GeV]} = \\frac{A\\text{[ADC]}}{C_{\\text{ADC} \\to \\text{pC}} \\times C_{\\text{pC} \\to \\text{GeV}} \\times C_{\\text{Cs}} \\times C_{\\text{MB}} \\times C_{\\text{Las}}} $$`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_icnfp_c5",
    title: "Charge Injection System (CIS)",
    column: null,
    order: 4,
    pattern: "bullets",
    content: `* CIS calibrates front-end electronics by injecting defined charge into each channel.
* Covers the full dynamic range for both Low Gain and High Gain.
* Estimates conversion constant from ADC counts to pC with precision of $\\sim 0.7\\%$.`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_icnfp_c6",
    title: "Cesium System",
    column: null,
    order: 5,
    pattern: "bullets",
    content: `* Calibrates the entire readout chain (scintillating tiles, optical fibers, and PMTs).
* A $^{137}$Cs capsule ($\\gamma$-source, $E_\\gamma = 0.662$ MeV) passes through all modules via hydraulic pipes.
* Cesium scans performed monthly with accuracy of $\\sim 0.3\\%$.`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_icnfp_c7",
    title: "Laser System",
    column: null,
    order: 6,
    pattern: "bullets",
    content: `* Produces 10 ns light pulses at 532 nm distributed simultaneously to all PMTs.
* Calibrates readout variations and tracks short-term PMT gain changes.
* Calibration runs performed every 2-3 days, achieving precision better than $0.5\\%$.`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_icnfp_c8",
    title: "Minimum Bias System",
    column: null,
    order: 7,
    pattern: "bullets",
    content: `* Measures integrated PMT current proportional to instantaneous LHC luminosity.
* Data collected continuously with dedicated integrator readout system.
* Calibration constant $C_{\\text{MB}}$ compensates for response variations during high-luminosity runs.`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_icnfp_c9",
    title: "Time Calibration & Performance",
    column: null,
    order: 8,
    pattern: "bullets",
    content: `* Precise timing calibration is critical for the optimal filtering energy reconstruction algorithm.
* Time-of-flight measurements used for long-lived particle searches.
* Dedicated calibration corrects timing jumps, maintaining precision below 1 ns for high-energy deposits.`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_icnfp_c10",
    title: "Performance - Isolated Muons",
    column: null,
    order: 9,
    pattern: "bullets",
    content: `* Studied using isolated muons from $W \\to \\mu \\nu$ decays in collision data.
* Response quantified using $\\Delta E / \\Delta x$ distributions.
* Double ratio verifies scale uniformity:
$$ R = \\frac{\\langle\\Delta E / \\Delta x\\rangle_{\\text{Data}}}{\\langle\\Delta E / \\Delta x\\rangle_{\\text{MC}}} $$
* Data and Monte Carlo agree within 1-2% across all pseudorapidities.`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_icnfp_c11",
    title: "Performance - Single Isolated Hadrons",
    column: null,
    order: 10,
    pattern: "bullets",
    content: `* Isolated charged hadrons used to measure deposited hadronic energy.
* Track momentum selected with $p < 20$ GeV.
* Response characterized by $R = E/p$.
* Run-2 benchmark results: $\\langle E/p \\rangle = 0.5896 \\pm 0.0001$ (Data) vs $0.593 \\pm 0.001$ (MC).`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_icnfp_c12",
    title: "Summary & Run-3 Outlook",
    column: null,
    order: 11,
    pattern: "bullets",
    content: `* TileCal continues smooth operations in LHC Run-3.
* Multi-stage calibration guarantees excellent energy stability and uniformity.
* Performance studies validate procedures using isolated muons, hadrons, and multi-jet events.
* First Run-3 performance results show outstanding detector response.`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_icnfp_c13",
    title: "References",
    column: null,
    order: 12,
    pattern: "references",
    content: `@article{ATLAS, title={The ATLAS Experiment at the CERN LHC}, journal={JINST}, year={2008}}\n@article{tile_performance_paper, title={Operation and performance of the ATLAS Tile Calorimeter in Run 2}, journal={EPJC}, year={2021}}`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  }
]

const qcdSlideCards = [
  {
    id: "blk_qcd_c1",
    title: "Charged Particle Correlations with ATLAS",
    column: null,
    order: 0,
    pattern: "title-slide",
    content: `* **Topic**: Two-particle and multi-particle azimuthal correlations in $pp$, $p\\text{--}\\text{Pb}$, and $\\text{Pb}\\text{--}\\text{Pb}$ collisions.
* **Physics Motivation**: Probing collective dynamics, quark-gluon plasma (QGP) droplet formation, and initial-state geometry fluctuations.
* **Key Observables**: Two-particle correlation functions $C(\\Delta\\eta, \\Delta\\phi)$, Fourier flow harmonics $v_n$, and multi-particle cumulants $c_n\\{k\\}$.`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_qcd_c2",
    title: "The ATLAS Detector & Tracking Acceptance",
    column: null,
    order: 1,
    pattern: "two-column",
    content: `* **Inner Detector (ID)**: Pixel, Semiconductor Tracker (SCT), and Transition Radiation Tracker (TRT) inside 2T solenoid.
* Full azimuthal coverage $|\\eta| < 2.5$ for charged particles down to $p_T > 0.4$ GeV.
* Forward Calorimeter (FCal) covering $3.1 < |\\eta| < 4.9$ used for event activity and centrality determination.
* Large acceptance allows measuring long-range correlations over $|\Delta\\eta| > 2.0$.`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_qcd_c3",
    title: "Ridge Phenomenon in Small Systems",
    column: null,
    order: 2,
    pattern: "bullets",
    content: `* In high-multiplicity $pp$ (13 TeV) and $p\\text{--}\\text{Pb}$ (5.02 / 8.16 TeV) collisions, a **long-range near-side ridge** ($\Delta\\phi \\approx 0$, large $|\Delta\\eta|$) emerges.
* Similar in structure to the collective ridge observed in heavy-ion $\\text{Pb}\\text{--}\\text{Pb}$ collisions.
* Suggests possible hydrodynamic collective behavior in small systems.`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_qcd_c4",
    title: "Long-Range Azimuthal Harmonics ($v_2, v_3, v_4$)",
    column: null,
    order: 3,
    pattern: "bullets",
    content: `* Two-particle correlation function expanded in Fourier series:
$$ C(\\Delta\\phi) \\propto 1 + 2 \\sum_{n=1}^\\infty v_{n,n} \\cos(n\\Delta\\phi) $$
* Single-particle flow coefficients factorize: $v_{n,n}(p_T^a, p_T^b) = v_n(p_T^a) v_n(p_T^b)$.
* Significant elliptic ($v_2$), triangular ($v_3$), and quadrangular ($v_4$) flow coefficients observed across all system sizes.`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_qcd_c5",
    title: "Multi-Particle Cumulants & Non-Flow Subtraction",
    column: null,
    order: 4,
    pattern: "bullets",
    content: `* Non-flow correlations (dijets, resonance decays) are suppressed using:
  - **Template fit method**: separating peripheral dijet baseline from ridge component.
  - **Multi-particle cumulants** ($c_2\\{4\\}, c_2\\{6\\}, c_2\\{8\\}$): genuine multi-particle collectivity.
* Negative $c_2\\{4\\}$ and consistent $v_2\\{4\\} \\approx v_2\\{6\\} \\approx v_2\\{8\\}$ confirm genuine collective origin.`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_qcd_c6",
    title: "Flow Harmonics vs Transverse Momentum ($p_T$)",
    column: null,
    order: 5,
    pattern: "bullets",
    content: `* $v_2(p_T)$ increases with $p_T$ up to 3-4 GeV, reaching a maximum of $\\sim 15\\%$, then decreases at higher $p_T$.
* Characteristic hydrodynamic mass ordering observed at low $p_T$.
* In high-$p_T$ regime ($p_T > 10$ GeV), residual $v_2$ reflects path-length dependent jet energy loss (jet quenching).`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_qcd_c7",
    title: "System Size Dependence ($pp$, $p\\text{--}\\text{Pb}$, $\\text{Pb}\\text{--}\\text{Pb}$)",
    column: null,
    order: 6,
    pattern: "bullets",
    content: `* Comparison of $v_n$ at similar charged particle multiplicities:
  - $v_2$ in $pp$ and $p\\text{--}\\text{Pb}$ is remarkably close in magnitude.
  - $v_3$ is nearly independent of collision system at matching multiplicity, supporting initial-state fluctuation models.
* Smooth evolution from small systems to large nucleus-nucleus collisions.`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_qcd_c8",
    title: "Longitudinal Decorrelation of Flow Harmonics",
    column: null,
    order: 7,
    pattern: "bullets",
    content: `* Event-plane angle fluctuates along pseudorapidity $\\eta$, breaking boost invariance.
* Quantified by factorization ratio $r_n(\\eta^a, \\eta^b)$:
$$ r_n(\\eta^a, \\eta^b) = \\frac{\\langle \\cos(n[\\Psi_n(\\eta^a) - \\Psi_n(\\eta^b)]) \\rangle}{\\dots} $$
* Linear decorrelation observed, providing unique constraints on 3D initial conditions of the fireball.`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_qcd_c9",
    title: "Conclusions & Summary",
    column: null,
    order: 8,
    pattern: "bullets",
    content: `* ATLAS has performed comprehensive measurements of azimuthal correlations across $pp$, $p\\text{--}\\text{Pb}$, and $\\text{Pb}\\text{--}\\text{Pb}$ collisions.
* Multi-particle cumulant measurements establish genuine collective nature of small-system flow.
* Precise measurements of $v_n(p_T)$, system size scaling, and longitudinal decorrelation provide stringent constraints on QGP transport coefficients $(\\eta/s)$ and 3D initial-state geometry.`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_qcd_c10",
    title: "References",
    column: null,
    order: 9,
    pattern: "references",
    content: `@article{atlas_ridge_pp, author={ATLAS Collaboration}, title={Observation of Long-Range, Near-Side Angular Correlations in 13 TeV pp Collisions}, journal={Phys. Rev. Lett.}, volume={116}, pages={172301}, year={2016}}\n@article{atlas_cumulants, author={ATLAS Collaboration}, title={Measurement of multi-particle azimuthal correlations in pp, p-Pb and low-multiplicity Pb-Pb collisions}, journal={Eur. Phys. J. C}, volume={77}, pages={428}, year={2017}}`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  }
]

const bibContent = `@article{ATLAS,
  author = {ATLAS Collaboration},
  title = {The ATLAS Experiment at the CERN Large Hadron Collider},
  journal = {JINST},
  volume = {3},
  pages = {S08003},
  year = {2008}
}

@article{LHC,
  author = {Evans, L. and Bryant, P.},
  title = {LHC Machine},
  journal = {JINST},
  volume = {3},
  pages = {S08001},
  year = {2008}
}

@article{tile_performance_paper,
  author = {ATLAS Collaboration},
  title = {Operation and performance of the ATLAS Tile Calorimeter in Run 2},
  journal = {Eur. Phys. J. C},
  volume = {81},
  pages = {982},
  year = {2021}
}

@misc{tile_public,
  author = {ATLAS Collaboration},
  title = {Tile Calorimeter Run-2 and Run-3 Public Results},
  howpublished = {ATL-PHYS-PUB-2024-001},
  year = {2024}
}

@article{atlas_ridge_pp,
  author = {ATLAS Collaboration},
  title = {Observation of Long-Range, Near-Side Angular Correlations in 13 TeV pp Collisions},
  journal = {Phys. Rev. Lett.},
  volume = {116},
  pages = {172301},
  year = {2016}
}

@article{atlas_cumulants,
  author = {ATLAS Collaboration},
  title = {Measurement of multi-particle azimuthal correlations in pp, p-Pb and low-multiplicity Pb-Pb collisions},
  journal = {Eur. Phys. J. C},
  volume = {77},
  pages = {428},
  year = {2017}
}`

const bibKeys = ["ATLAS", "LHC", "tile_performance_paper", "tile_public", "atlas_ridge_pp", "atlas_cumulants"]

async function seed() {
  console.log("Seeding prj_atlas_studies workspace...")

  const workspaceId = "prj_atlas_studies"
  const activeUserId = "user_3IGDYw03LkmHZaaCgKwWcBYxHQu"

  // Setup workspace directory
  const dstAssetsDir = path.resolve(__dirname, `../workspaces/${workspaceId}/assets`)
  const dstLogosDir = path.resolve(__dirname, `../workspaces/${workspaceId}/logos`)
  fs.mkdirSync(dstAssetsDir, { recursive: true })
  fs.mkdirSync(dstLogosDir, { recursive: true })

  // Copy assets from prj_irradiation or poster4 if available
  const srcAssetsDir = path.resolve(__dirname, `../workspaces/prj_irradiation/assets`)
  if (fs.existsSync(srcAssetsDir)) {
    const files = fs.readdirSync(srcAssetsDir)
    for (const f of files) {
      fs.copyFileSync(path.join(srcAssetsDir, f), path.join(dstAssetsDir, f))
    }
    console.log(`Copied ${files.length} assets to ${dstAssetsDir}`)
  }

  // Copy logos
  const srcLogosDir = path.resolve(__dirname, `../public/logos`)
  if (fs.existsSync(srcLogosDir)) {
    const logos = fs.readdirSync(srcLogosDir)
    for (const l of logos) {
      fs.copyFileSync(path.join(srcLogosDir, l), path.join(dstLogosDir, l))
    }
  }

  // Delete existing if any
  try {
    await prisma.workspace.delete({ where: { id: workspaceId } })
  } catch (_) {}

  const ws = await prisma.workspace.create({
    data: {
      id: workspaceId,
      userId: activeUserId,
      name: "ATLAS Detector & Physics Studies",
      authors: "R\\'obert Astalo\\v{s}, Tade\\'a\\v{s} Petr\\'u, on behalf of the ATLAS Collaboration",
      venue: "CERN / ATLAS Collaboration Research",
      logoUrl: "logos/uk_logo.png",
      secondaryLogoUrl: "logos/atlas_transparent.png",
      bibContent,
      bibKeys,
      revision: 1,
      outputs: {
        create: [
          {
            id: "out_paper_tilecal_dis",
            outputType: "paper",
            templateId: "pos-proceedings",
            title: "Performance and calibration of the ATLAS Tile Calorimeter",
            isActive: true,
            cards: {
              create: disPaperCards.map(c => ({
                id: c.id,
                title: c.title,
                column: c.column,
                order: c.order,
                pattern: c.pattern,
                content: c.content,
                table: c.table as any,
                figures: c.figures as any,
                figureLayout: c.figureLayout,
                sourceIds: c.sourceIds,
                validation: c.validation,
              }))
            }
          },
          {
            id: "out_slides_tilecal_icnfp",
            outputType: "slides",
            templateId: "beamer-atlas",
            title: "Performance and Calibration of the ATLAS Tile Calorimeter",
            themeColor: "#9e2b2f",
            isActive: false,
            cards: {
              create: icnfpSlideCards.map(c => ({
                id: c.id,
                title: c.title,
                column: c.column,
                order: c.order,
                pattern: c.pattern,
                content: c.content,
                table: c.table as any,
                figures: c.figures as any,
                figureLayout: c.figureLayout,
                sourceIds: c.sourceIds,
                validation: c.validation,
              }))
            }
          },
          {
            id: "out_slides_qcd_ichep",
            outputType: "slides",
            templateId: "beamer-metropolis",
            title: "Charged particle correlations with ATLAS",
            themeColor: "#1C1C1C",
            isActive: false,
            cards: {
              create: qcdSlideCards.map(c => ({
                id: c.id,
                title: c.title,
                column: c.column,
                order: c.order,
                pattern: c.pattern,
                content: c.content,
                table: c.table as any,
                figures: c.figures as any,
                figureLayout: c.figureLayout,
                sourceIds: c.sourceIds,
                validation: c.validation,
              }))
            }
          }
        ]
      }
    }
  })

  console.log(`Created workspace ${workspaceId} with 3 outputs: DIS Paper, TileCal Slides, QCD Slides!`)
}

seed()
  .catch(err => {
    console.error("Seed failed:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
