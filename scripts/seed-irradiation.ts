import { prisma } from "../lib/prisma"
import * as fs from "fs"
import * as path from "path"

const posterCards = [
  {
    id: "blk_irrad_p1",
    title: "The ATLAS Hadronic Tile Calorimeter (TileCal)",
    column: 1,
    order: 0,
    pattern: "bullets-two-images",
    content: `* The **ATLAS** detector is a multi-purpose particle physics experiment at the CERN Large Hadron Collider (LHC). The High-Luminosity LHC (HL-LHC) upgrade will drastically increase the collision rate, delivering an unprecedented integrated luminosity of up to 4000 fb$^{-1}$.

* The **Tile Calorimeter** is a hadronic calorimeter composed of wedge-shaped modules arranged in a Long Barrel (LB) and two Extended Barrels (EB). It consists of 256 modules containing 5182 calorimetric cells, utilizing scintillating tiles and wavelength shifting fibers to transfer light to photomultiplier tubes (PMTs). Most cells are read out by two PMTs, except for special E1--E4 gap/crack cells read out by one PMT.

* Components located in the highest radiation regions of TileCal, particularly the LB LVPS and readout electronics close to the detector gap regions, must tolerate elevated TID and NIEL levels.

* **1792 $\\times$ Low Voltage power supply bricks (LVPS)**: Utilize switching DC-DC converters at 300 kHz to step down a bulk 200 V input to distribute stable power to the on-detector readout electronics.
* **~1000 $\\times$ new PMTs**: Hamamatsu R11187, Quantum Efficiency >15%.
* **9852 $\\times$ Active Dividers**: Provide stable high voltage division for the PMTs to minimize gain variations at high event rates.
* **9852 $\\times$ FENICS cards**: PMT pulse shaping with bi-gain amplification (1:40). Current integrator for luminosity measurements and Cs calibration.
* **896 $\\times$ MainBoards (MB)**: Control and configuration, FENICS signal digitization, 2 $\\times$ 12-bit ADCs @ 40 Msps, and 1 $\\times$ 16-bit ADC for integrator.
* **896 $\\times$ DaughterBoards (DB)**: Central communication hub of each module. They transmit ~35 Tbps of physics data (digitized PMT signals) to off-detector systems via 3584 optical uplinks (9.6 Gbps), while receiving configuration and timing commands via 1792 downlinks (4.8 Gbps).`,
    figures: [
      { id: "fig_p1_1", url: "assets/plot1.pdf", caption: "Figure 1: ATLAS Tile Calorimeter (left) and module slice (right) [1]." },
      { id: "fig_p1_2", url: "assets/fig_architecture.png", caption: "Figure 2: Tile HL-LHC On-detector architecture." }
    ],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_irrad_p2",
    title: "Radiation Criteria",
    column: 1,
    order: 1,
    pattern: "bullets-table",
    content: `* Total Ionizing Dose (TID), Non-Ionizing Energy Loss (NIEL), and Single Event Effects (SEE), in particular Single Event Upsets (SEU) and Single Event Latch-ups (SEL), must be evaluated and mitigated.

* Different safety factors were applied to the expected doses according to the internal ATLAS guidelines.`,
    table: {
      hasHeader: true,
      caption: "Table 1: Simulated worst-case doses for 4000 fb$^{-1}$ (no safety factors), only higher doses from Barrel/Endcap are shown.",
      rows: [
        ["Component", "TID [Gy]", "NIEL [n/cm$^2$]", "SEE [p/cm$^2$]"],
        ["PMT Divider - Barrel", "17.6", "2.0 x 10^{12}", "1.9 x 10^{11}"],
        ["FENICS - Barrel", "10.6", "1.6 x 10^{12}", "1.8 x 10^{11}"],
        ["MB - Barrel", "10.0", "1.4 x 10^{12}", "9.2 x 10^{10}"],
        ["LVPS - Barrel", "53.6", "3.5 x 10^{12}", "5.3 x 10^{11}"],
        ["DB - Endcap", "6.8", "9.7 x 10^{11}", "4.9 x 10^{10}"]
      ]
    },
    figures: [],
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_irrad_p3",
    title: "FENICS & Active Divider Radiation Qualification",
    column: 2,
    order: 0,
    pattern: "bullets-two-images",
    content: `**FENICS Boards**
* Over 40 FENICS boards (plus pre-production tracking) were irradiated with X-rays and neutrons to test for TID and NIEL limits (up to 51 Gy and $4.7 \\times 10^{12}$ n/cm$^2$).
* Fast channels showed no performance degradation. Slow channels exhibited a reasonable and fully acceptable noise increase, officially certifying all active Commercial Off-The-Shelf (COTS) components for production.

**Active Dividers**
* Qualified at 424 Gy TID, $1.37 \\times 10^{13}$ n/cm$^2$ NIEL, and $2.97 \\times 10^{12}$ had/cm$^2$ SEE.
* Extensive proton, gamma, and neutron beam tests: **No SEEs were observed during irradiation**.
* Relative PMT gain decrease due to TID effects (at 480 Gy) remained strictly within tolerances at just $-1.92 \\pm 0.20$%.`,
    figures: [
      { id: "fig_p3_1", url: "assets/fig_fenics_test.png", caption: "Figure 5: FENICS channel noise level over burn-in time." },
      { id: "fig_p3_2", url: "assets/fig_divider_test.png", caption: "Figure 6: Active Divider relative TID effects on channels." }
    ],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_irrad_p4",
    title: "DB Radiation Qualification",
    column: 2,
    order: 1,
    pattern: "bullets-image",
    content: `* **DB Qualification:** Requires 108 Gy TID and $13.16 \\times 10^{12}$ n/cm$^2$ NIEL limits. Kintex Ultrascale (KU) and ProASIC FPGAs successfully withstood over 108 Gy and $14 \\times 10^{12}$ n/cm$^2$. No SEL was observed in the selected KU FPGAs. Measured SEU rates for the KU FPGA were effectively mitigated by Xilinx SEM.`,
    figures: [
      { id: "fig_p4_1", url: "assets/fig_db6_tid_test_part_0.png", caption: "Figure 4: Monitored KU FPGA temperatures and currents during 54 MeV proton beam TID testing [5]." }
    ],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_irrad_p5",
    title: "MB Radiation Qualification",
    column: 3,
    order: 0,
    pattern: "bullets",
    content: `* All components passed TID (up to 640 Gy) and NIEL (up to $1.4 \\times 10^{13}$ n/cm$^2$) tests with no performance degradation.
* Critical components (Fast ADCs, FPGAs) showed zero SEU effects up to $10^{13}$ p/cm$^2$ during 800 MeV proton testing. Point-of-Load regulators successfully passed stringent testing at 570 Gy TID and $1.2 \\times 10^{13}$ n/cm$^2$ NIEL.`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_irrad_p6",
    title: "LVPS Component Radiation Testing",
    column: 3,
    order: 1,
    pattern: "bullets-table",
    content: `**LVPS Design**
* 8 identical bricks for LB modules and 6 bricks for EB modules inside a box convert the 200 V input to a 10 V output at a nominal power of 23 W. Each brick powers an independent side of the readout electronics, preserving the TileCal dual-PMT cell redundancy.
* Replacing original STB57N65M5 power MOSFETs with SIHFS9N60A reduced gate-source capacitance and switching losses. Efficiency improved from 58% to 72%, meeting the 77 kW TileCal cooling system capacity.

**Radiation Testing**
* SIHFS9N60A MOSFET (main high-power switching transistor): 2.5 V shift in gate-source threshold observed after 200 Gy of TID, minimal deviation from NIEL.
* SI8920 Isolation Amplifier (safe analog signal isolation for over-voltage protection): Initial tests showed voltage fluctuations at 150 mV, but performance is completely stable below 100 mV. Selected for final production with circuits restricting the input voltage.
* LT1681 Controller (feedback loop & switching pulse generator) & LT3080 Regulator (maintains stable local voltages): TID tests at 502 Gy/h showed minor drifts (<= 5%) in output voltages, within acceptable limits.`,
    table: {
      hasHeader: true,
      caption: "Table 2: Summary of SEE tests conditions and results for different components [3].",
      rows: [
        ["Component", "Flux [p/cm$^2$/s]", "Fluence [p/cm$^2$]", "SEE Count", "Cross Section [cm$^2$]"],
        ["LT1681", "2.4 x 10^8", "7.05 x 10^{11}", "64 (2 chips)", "4.54 x 10^{-11}"],
        ["LTC6241", "2.4 x 10^8", "7.05 x 10^{11}", "133 (4 op-amps)", "4.72 x 10^{-11}"],
        ["LT3080", "2.4 x 10^8", "7.05 x 10^{11}", "198 (4 chips)", "7.02 x 10^{-11}"],
        ["IR2110", "3.5 x 10^8", "3.4 x 10^{11}", "None (2 chips)", ">1.47 x 10^{-12}"],
        ["SIHFS9N60A", "3.5 x 10^8", "3.4 x 10^{11}", "None (8 chips)", ">3.67 x 10^{-13}"],
        ["SI8920", "1 x 10^7", "1.96 x 10^{11}", "1 (20 chips)", "2.55 x 10^{-13}"]
      ]
    },
    figures: [
      { id: "fig_p6_1", url: "assets/Moayedi_2026_J._Inst._21_C05002_slide_7_item_1.png", caption: "Figure 3: SIHFS9N60A MOSFET characterization after 200 Gy TID and NIEL tests [3]." }
    ],
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_irrad_p7",
    title: "Conclusions",
    column: 3,
    order: 2,
    pattern: "bullets",
    content: `* The optimized power distribution scheme improves readout reliability and power efficiency, and mitigates failure impact by utilizing identical and independent LVPS bricks.
* All critical components for the upgrade of the TileCal on-detector electronics successfully passed TID, NIEL, and SEE qualification, meeting the ATLAS radiation requirements for production.`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_irrad_p8",
    title: "References",
    column: 3,
    order: 3,
    pattern: "references",
    content: `@article{atlas_experiment,
  title={The ATLAS Experiment at the CERN Large Hadron Collider},
  journal={JINST},
  volume={3},
  pages={S08003},
  year={2008},
  doi={10.1088/1748-0221/3/08/S08003}
}

@techreport{atlas_tdr,
  title={Technical Design Report for the Phase-II Upgrade of the ATLAS Tile Calorimeter},
  institution={CERN},
  number={CERN-LHCC-2017-019},
  year={2017}
}

@article{moayedi_paper,
  author={Moayedi, S.},
  title={Upgrade of the ATLAS Tile Calorimeter front-end power supply for the HL-LHC},
  journal={JINST},
  volume={21},
  pages={C05002},
  year={2026}
}

@misc{moayedi_slide,
  author={Moayedi, S.},
  title={Upgrade of the ATLAS Tile Calorimeter Front-End Power Supply for the HL-LHC},
  howpublished={ATL-TILECAL-SLIDE-2025-552},
  year={2025}
}

@article{valdes_jinst,
  author={Vald{\\'e}s Santurio, E. and others},
  title={Radiation studies performed on the High Luminosity ATLAS TileCal link Daughterboard},
  journal={JINST},
  volume={18},
  pages={C04011},
  year={2023}
}`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  }
]

const paperCards = [
  {
    id: "blk_irrad_s0",
    title: "Abstract",
    column: null,
    order: 0,
    pattern: "section",
    content: `The Tile Calorimeter (TileCal) is a sampling hadronic calorimeter covering the central region of the ATLAS experiment at the CERN Large Hadron Collider (LHC). It employs steel as the absorber material and plastic scintillators as the active medium. The High-Luminosity LHC (HL-LHC), scheduled to start operation in 2030, will deliver instantaneous luminosities significantly exceeding the baseline LHC design, imposing more stringent requirements on detector readout and trigger systems. Consequently, TileCal has to be capable of reliable operation under increased radiation levels and very high particle flux, while maintaining full compatibility with the upgraded ATLAS trigger architecture.

During the Long Shutdown period (2026–2030), the TileCal readout electronics will be entirely replaced with radiation-tolerant systems designed to handle data rates approximately an order of magnitude higher than those of the baseline LHC configuration. The photomultiplier tubes (PMTs) in the most highly irradiated regions will also be replaced with improved devices exhibiting enhanced stability and radiation tolerance.

To meet these challenges, the system design has been correspondingly optimized to ensure improved performance, efficiency and robustness in high-radiation environments, and an extensive irradiation testing program has been carried out. This contribution presents the resulting design developments of the TileCal system, together with the results obtained from the irradiation tests.`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_irrad_s1",
    title: "1 Introduction",
    column: null,
    order: 1,
    pattern: "section-two-figures",
    content: `The ATLAS detector is a multi-purpose particle physics experiment located at the CERN Large Hadron Collider (LHC) \\cite{atlas_experiment}. Over the next decade, the LHC will undergo a major upgrade to become the High-Luminosity LHC (HL-LHC). This upgrade is designed to significantly increase the collision rate, aiming to deliver an unprecedented integrated luminosity of up to 4000 fb$^{-1}$. While this vast amount of data will open new frontiers in high-energy physics, it also introduces a significantly more demanding radiation environment.

The ATLAS Hadronic Tile Calorimeter (TileCal) is a critical component for measuring the energy and direction of hadrons, jets, and missing transverse energy. TileCal is a sampling hadronic calorimeter consisting of wedge-shaped modules. These modules are arranged into a central Long Barrel (LB) and two Extended Barrels (EB). In total, the calorimeter contains 256 modules and is segmented into 5182 calorimetric cells. The active medium of the detector consists of scintillating plastic tiles, while steel is used as the absorber material. Ionizing particles traversing the plastic tiles produce scintillation light, which is collected and shifted to visible wavelengths by wavelength-shifting fibers. This light is then channeled to photomultiplier tubes (PMTs) located at the outer radius of the modules. To ensure redundancy and uniform response, most cells are read out by two PMTs, with the exception of the special E1--E4 gap/crack cells, which are read out by a single PMT. A macroscopic view of the ATLAS Tile Calorimeter and a wedge-shaped module slice is presented in figure 1.

Due to the increased instantaneous and integrated luminosity of the HL-LHC, components exposed to the highest radiation levels of TileCal must tolerate significantly elevated levels of ionizing and non-ionizing radiation. This is particularly crucial for the Long Barrel Low Voltage Power Supplies (LVPS) and the readout electronics situated close to the detector gap regions. Consequently, an entirely new on-detector architecture has been designed.`,
    figures: [
      { id: "fig_s1_1", url: "assets/plot1.pdf", caption: "The ATLAS Tile Calorimeter." },
      { id: "fig_s1_2", url: "assets/plot2.pdf", caption: "Internal structure of a wedge-shaped module slice." }
    ],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_irrad_s2",
    title: "2 TileCal HL-LHC On-Detector Architecture",
    column: null,
    order: 2,
    pattern: "section-figure",
    content: `The upcoming Phase-II upgrade entails a complete replacement of the on-detector readout electronics to cope with the increased data rates and radiation levels. The newly designed architecture is highly modular and incorporates modern radiation-tolerant commercial off-the-shelf (COTS) components alongside application-specific integrated circuits (ASICs).

The architecture is composed of several critical sub-systems:
* **Low Voltage Power Supply bricks (LVPS):** A total of 1792 LVPS bricks utilize switching DC-DC converters operating at 300 kHz. They step down a bulk 200 V input to distribute stable, low-voltage power to the sensitive on-detector readout electronics.
* **Photomultiplier Tubes (PMTs):** Approximately 1000 new PMTs (Hamamatsu R11187) will be installed in the most exposed regions, with a quantum efficiency exceeding 15% and enhanced radiation tolerance.
* **Active Dividers:** The system requires 9852 Active Dividers to provide stable high voltage division for the PMTs. Their active regulation minimizes gain variations even at the extremely high event rates expected at the HL-LHC.
* **FENICS Cards:** A matching set of 9852 Front-End for the New Infrastructure with Current and Signals (FENICS) cards are responsible for PMT pulse shaping with bi-gain amplification (1:40). They also feature a current integrator for continuous luminosity measurements and $^{137}$Cs calibration.
* **MainBoards (MB):** There will be 896 MainBoards serving as the central hub for module control and configuration. They perform the digitization of the FENICS signals utilizing two 12-bit Analog-to-Digital Converters (ADCs) running at 40 Msps, and one 16-bit ADC for the integrator readout.
* **DaughterBoards (DB):** Also totaling 896 units, the DaughterBoards function as the central communication hub of each module. They are responsible for transmitting approximately 35 Tbps of digitized physics data to off-detector systems via 3584 optical uplinks operating at 9.6 Gbps. Simultaneously, they receive critical configuration and timing commands via 1792 downlinks at 4.8 Gbps.`,
    figures: [
      { id: "fig_s2_1", url: "assets/fig_architecture.png", caption: "The Tile HL-LHC On-detector architecture block diagram." }
    ],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_irrad_s3",
    title: "3 Radiation Criteria and Expected Doses",
    column: null,
    order: 3,
    pattern: "section-table",
    content: `To ensure survivability and reliable operation throughout the HL-LHC lifespan, all on-detector electronics must be evaluated against three primary radiation damage mechanisms: Total Ionizing Dose (TID), which causes cumulative parametric shifts in semiconductor devices; Non-Ionizing Energy Loss (NIEL), which produces displacement damage in silicon lattices; and Single Event Effects (SEE), of which Single Event Upsets (SEU, non-destructive bit-flips) and Single Event Latch-ups (SEL, potentially destructive high-current shorts) are of primary concern.

Detailed simulations of the ATLAS radiation environment were performed to determine the expected doses for an integrated luminosity of 4000 fb$^{-1}$. During the qualification process, rigorous safety factors were applied to these simulated base values in accordance with internal ATLAS guidelines, establishing the final qualification thresholds for all approved components (e.g., 108 Gy TID and $13.16 \\times 10^{12}$ n/cm$^2$ NIEL for the DaughterBoards).`,
    table: {
      hasHeader: true,
      caption: "Simulated worst-case radiation doses for 4000 fb$^{-1}$ (no safety factors included). Only the highest doses from the Barrel and Endcap regions are shown.",
      rows: [
        ["Component", "TID [Gy]", "NIEL [n/cm$^2$]", "SEE [p/cm$^2$]"],
        ["PMT Divider - Barrel", "17.6", "2.0 x 10^{12}", "1.9 x 10^{11}"],
        ["FENICS - Barrel", "10.6", "1.6 x 10^{12}", "1.8 x 10^{11}"],
        ["MB - Barrel", "10.0", "1.4 x 10^{12}", "9.2 x 10^{10}"],
        ["LVPS - Barrel", "53.6", "3.5 x 10^{12}", "5.3 x 10^{11}"],
        ["DB - Endcap", "6.8", "9.7 x 10^{11}", "4.9 x 10^{10}"]
      ]
    },
    figures: [],
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_irrad_s4",
    title: "4 Front-End Electronics Qualification",
    column: null,
    order: 4,
    pattern: "section-two-figures",
    content: `The front-end electronics directly connected to the PMTs—specifically the FENICS boards and Active Dividers—were subjected to extensive irradiation campaigns to validate their performance.

**FENICS Boards**
Over 40 FENICS boards, in addition to pre-production tracking models, were irradiated with gamma rays and neutrons. The test campaigns evaluated TID limits up to 51 Gy and NIEL limits up to $4.7 \\times 10^{12}$ n/cm$^2$. During these tests, the fast signal channels demonstrated exceptional resilience, showing no observable performance degradation. The slow channels exhibited a slight, yet fully acceptable, increase in noise levels over the burn-in time. This confirmed that all active COTS components selected for the FENICS boards are officially certified for production.

**Active Dividers**
The Active Dividers underwent even more severe qualification tests, targeting 424 Gy of TID, $1.37 \\times 10^{13}$ n/cm$^2$ of NIEL, and $2.97 \\times 10^{12}$ had/cm$^2$ for SEE evaluation. Through extensive proton, gamma, and neutron beam tests, it was observed that no Single Event Effects occurred during irradiation. Furthermore, the relative PMT gain decrease attributable to TID effects remained strictly within operational tolerances. At an absorbed dose of 480 Gy, the gain deviation was measured at just $-1.92 \\pm 0.20$%.`,
    figures: [
      { id: "fig_s4_1", url: "assets/fig_fenics_test.png", caption: "Measured noise level of FENICS channels as a function of burn-in time during radiation testing." },
      { id: "fig_s4_2", url: "assets/fig_divider_test.png", caption: "Relative TID effects on the gain of the Active Divider channels up to 480 Gy." }
    ],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_irrad_s5",
    title: "5 On-Detector Readout Electronics Qualification",
    column: null,
    order: 5,
    pattern: "section-figure",
    content: `The centralized digital processing and communication hubs of the module—the DaughterBoards and MainBoards—rely heavily on FPGAs and ADCs which are inherently susceptible to radiation damage.

**DaughterBoards (DB)**
The qualification criteria for the DaughterBoards required survival up to 108 Gy TID and $13.16 \\times 10^{12}$ n/cm$^2$ NIEL. The DB utilizes Kintex Ultrascale (KU) and ProASIC FPGAs, which successfully withstood doses exceeding 108 Gy and fluences of $14 \\times 10^{12}$ n/cm$^2$. Crucially, no destructive Single Event Latch-ups (SEL) were observed in the selected KU FPGAs. While Single Event Upsets (SEU) did occur in the logic fabric, these non-destructive soft errors were effectively mitigated on-the-fly without data loss by the Xilinx Soft Error Mitigation (SEM) IP core and Triple Mode Redundancy (TMR). Sudden drops in current during proton testing prominently illustrate the active SEU corrections performed by the SEM and resets applied during uncorrectable multi-bit SEUs \\cite{valdes_jinst}.

**MainBoards (MB)**
Similar rigorous testing was applied to the MainBoards. All components passed TID testing up to 640 Gy and NIEL testing up to $1.4 \\times 10^{13}$ n/cm$^2$ without exhibiting any performance degradation. Critical components, including fast ADCs and FPGAs, showed zero SEU effects up to a fluence of $10^{13}$ p/cm$^2$ during 800 MeV proton testing, meaning they maintained full, uninterrupted functionality. Additionally, the Point-of-Load regulators passed stringent testing at 570 Gy TID and $1.2 \\times 10^{13}$ n/cm$^2$ NIEL, securing the robustness of the local power delivery network.`,
    figures: [
      { id: "fig_s5_1", url: "assets/fig_db6_tid_test_part_0.png", caption: "Monitored KU FPGA temperatures and currents during 54 MeV proton beam TID testing." }
    ],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_irrad_s6",
    title: "6 Low Voltage Power Supply Optimization and Testing",
    column: null,
    order: 6,
    pattern: "section-table",
    content: `The Low Voltage power supply system was subjected to both severe radiation testing and a significant design optimization process to improve its thermal footprint.

The LVPS architecture features 8 identical bricks for LB modules and 6 bricks for EB modules inside a shielded box. These bricks convert a bulk 200 V input to a 10 V output, operating at a nominal power of 23 W. To preserve the TileCal dual-PMT cell redundancy, each brick powers an independent side of the readout electronics.

A major design upgrade involved replacing the original STB57N65M5 power MOSFETs with SIHFS9N60A models. This change substantially reduced both the gate-source capacitance and the switching losses in the DC-DC converters. As a result, the power efficiency of the bricks was improved from 58% to 72%. This substantial reduction in dissipated heat is essential for meeting the strict 77 kW cooling system capacity limit of the TileCal detector.

The main high-power switching transistor, the SIHFS9N60A MOSFET, demonstrated excellent tolerance. A minor 2.5 V shift in the gate-source threshold was observed after 200 Gy of TID, and minimal deviation occurred following NIEL tests \\cite{moayedi_paper}. The SI8920 Isolation Amplifier performance proved to be completely stable below 100 mV, chosen to prevent false triggers in the over-voltage protection circuitry. Furthermore, the LT1681 Controller and LT3080 Regulator exhibited only minor output voltage drifts (<= 5%) after 502 Gy/h TID tests.`,
    table: {
      hasHeader: true,
      caption: "Summary of Single Event Effect (SEE) test conditions and results for different LVPS components \\cite{moayedi_paper}.",
      rows: [
        ["Component", "Flux [p/cm$^2$/s]", "Fluence [p/cm$^2$]", "SEE Count", "Cross Section [cm$^2$]"],
        ["LT1681", "2.4 x 10^8", "7.05 x 10^{11}", "64 (2 chips)", "4.54 x 10^{-11}"],
        ["LTC6241", "2.4 x 10^8", "7.05 x 10^{11}", "133 (4 op-amps)", "4.72 x 10^{-11}"],
        ["LT3080", "2.4 x 10^8", "7.05 x 10^{11}", "198 (4 chips)", "7.02 x 10^{-11}"],
        ["IR2110", "3.5 x 10^8", "3.4 x 10^{11}", "None (2 chips)", ">1.47 x 10^{-12}"],
        ["SIHFS9N60A", "3.5 x 10^8", "3.4 x 10^{11}", "None (8 chips)", ">3.67 x 10^{-13}"],
        ["SI8920", "1 x 10^7", "1.96 x 10^{11}", "1 (20 chips)", "2.55 x 10^{-13}"]
      ]
    },
    figures: [
      { id: "fig_s6_1", url: "assets/Moayedi_2026_J._Inst._21_C05002_slide_7_item_1.png", caption: "SIHFS9N60A MOSFET characterization curves at V_DS = 1V." }
    ],
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_irrad_s7",
    title: "7 Conclusions",
    column: null,
    order: 7,
    pattern: "section",
    content: `The ATLAS Tile Calorimeter readout electronics are undergoing a complete replacement to meet the unprecedented demands of the High-Luminosity LHC. The design optimization of the power distribution scheme has successfully enhanced readout reliability and significantly improved power efficiency from 58% to 72%, while effectively mitigating the impact of localized failures by utilizing identical, independent LVPS bricks.

Extensive irradiation campaigns have rigorously validated all design choices. All critical components for the upgrade of the TileCal on-detector electronics have successfully passed their target TID, NIEL, and SEE qualification thresholds. Having met or exceeded the stringent ATLAS radiation requirements, these components are fully certified and ready for mass production, ensuring the continued high-performance operation of the Tile Calorimeter throughout the HL-LHC era.`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  },
  {
    id: "blk_irrad_s8",
    title: "References",
    column: null,
    order: 8,
    pattern: "references",
    content: `@article{atlas_experiment,
  author={ATLAS Collaboration},
  title={The ATLAS Experiment at the CERN Large Hadron Collider},
  journal={JINST},
  volume={3},
  pages={S08003},
  year={2008}
}

@techreport{atlas_tdr,
  author={ATLAS collaboration},
  title={Technical Design Report for the Phase-II Upgrade of the ATLAS Tile Calorimeter},
  institution={CERN},
  number={CERN-LHCC-2017-019},
  year={2017}
}

@article{moayedi_paper,
  author={Moayedi, S.},
  title={Upgrade of the ATLAS Tile Calorimeter front-end power supply for the HL-LHC},
  journal={JINST},
  volume={21},
  pages={C05002},
  year={2026}
}

@misc{moayedi_slide,
  author={Moayedi, S.},
  title={Upgrade of the ATLAS Tile Calorimeter Front-End Power Supply for the HL-LHC},
  howpublished={ATL-TILECAL-SLIDE-2025-552},
  year={2025}
}

@article{valdes_jinst,
  author={Vald{\\'e}s Santurio, E. and others},
  title={Radiation studies performed on the High Luminosity ATLAS TileCal link Daughterboard},
  journal={JINST},
  volume={18},
  pages={C04011},
  year={2023}
}`,
    figures: [],
    table: { hasHeader: true, caption: "", rows: [] },
    figureLayout: "single",
    sourceIds: [],
    validation: "valid"
  }
]

const bibContent = `@article{atlas_experiment,
  author={ATLAS Collaboration},
  title={The ATLAS Experiment at the CERN Large Hadron Collider},
  journal={JINST},
  volume={3},
  pages={S08003},
  year={2008},
  doi={10.1088/1748-0221/3/08/S08003}
}

@techreport{atlas_tdr,
  author={ATLAS collaboration},
  title={Technical Design Report for the Phase-II Upgrade of the ATLAS Tile Calorimeter},
  institution={CERN},
  number={CERN-LHCC-2017-019},
  year={2017}
}

@article{moayedi_paper,
  author={Moayedi, S.},
  title={Upgrade of the ATLAS Tile Calorimeter front-end power supply for the HL-LHC},
  journal={JINST},
  volume={21},
  pages={C05002},
  year={2026}
}

@misc{moayedi_slide,
  author={Moayedi, S.},
  title={Upgrade of the ATLAS Tile Calorimeter Front-End Power Supply for the HL-LHC},
  howpublished={ATL-TILECAL-SLIDE-2025-552},
  year={2025}
}

@article{valdes_jinst,
  author={Vald{\\'e}s Santurio, E. and others},
  title={Radiation studies performed on the High Luminosity ATLAS TileCal link Daughterboard},
  journal={JINST},
  volume={18},
  pages={C04011},
  year={2023}
}`

const bibKeys = ["atlas_experiment", "atlas_tdr", "moayedi_paper", "moayedi_slide", "valdes_jinst"]

async function seed() {
  console.log("Seeding prj_irradiation workspace...")

  // Copy assets from poster4/Project/assets if available
  const srcAssetsDir = path.resolve(__dirname, "../../poster4/Project/assets")
  const dstAssetsDir = path.resolve(__dirname, "../workspaces/prj_irradiation/assets")
  const dstSourcesDir = path.resolve(__dirname, "../workspaces/prj_irradiation/sources")

  fs.mkdirSync(dstAssetsDir, { recursive: true })
  fs.mkdirSync(dstSourcesDir, { recursive: true })

  if (fs.existsSync(srcAssetsDir)) {
    const files = fs.readdirSync(srcAssetsDir)
    for (const f of files) {
      fs.copyFileSync(path.join(srcAssetsDir, f), path.join(dstAssetsDir, f))
    }
    console.log(`Copied ${files.length} asset files to ${dstAssetsDir}`)
  }

  // Also copy logos if available
  const srcLogosDir = path.resolve(__dirname, "../../poster4/Project/logos")
  const dstLogosDir = path.resolve(__dirname, "../workspaces/prj_irradiation/logos")
  fs.mkdirSync(dstLogosDir, { recursive: true })
  if (fs.existsSync(srcLogosDir)) {
    const logos = fs.readdirSync(srcLogosDir)
    for (const l of logos) {
      fs.copyFileSync(path.join(srcLogosDir, l), path.join(dstLogosDir, l))
    }
    console.log(`Copied ${logos.length} logo files to ${dstLogosDir}`)
  }

  // Clean up existing workspace
  const workspaceId = "prj_irradiation"
  try {
    await prisma.workspace.delete({ where: { id: workspaceId } })
  } catch (_) {}

  const activeUserId = "user_3IGDYw03LkmHZaaCgKwWcBYxHQu"

  const ws = await prisma.workspace.create({
    data: {
      id: workspaceId,
      userId: activeUserId,
      name: "ATLAS TileCal HL-LHC Irradiation",
      authors: "R\\'obert Astalo\\v{s} (Comenius University Bratislava), on behalf of the ATLAS Tile Calorimeter System",
      venue: "28th International Workshop on Radiation Imaging Detectors, Ghent, 28.6. - 02.07.2026",
      logoUrl: "logos/uk_logo.png",
      secondaryLogoUrl: "logos/atlas_transparent.png",
      bibContent,
      bibKeys,
      revision: 1,
      outputs: {
        create: [
          {
            id: "out_poster_irradiation",
            outputType: "poster",
            templateId: "atlas",
            title: "Irradiation Studies and Design Optimization of the ATLAS Tile Calorimeter for the High-Luminosity LHC",
            themeColor: "#9e2b2f",
            isActive: true,
            cards: {
              create: posterCards.map(c => ({
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
            id: "out_paper_irradiation",
            outputType: "paper",
            templateId: "jinst-proceedings",
            title: "Irradiation Studies and Design Optimization of the ATLAS Tile Calorimeter for the High-Luminosity LHC",
            isActive: false,
            cards: {
              create: paperCards.map(c => ({
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
  console.log(`Created workspace prj_irradiation for user ${activeUserId}`)

  // Populate Asset records for extracted assets
  if (fs.existsSync(dstAssetsDir)) {
    const assetFiles = fs.readdirSync(dstAssetsDir)
    for (const filename of assetFiles) {
      const ext = path.extname(filename).toLowerCase()
      const isImg = [".png", ".jpg", ".jpeg", ".pdf"].includes(ext)
      if (!isImg) continue
      const isTable = filename.toLowerCase().includes("table")
      const kind = isTable ? "table" : "figure"
      const assetId = `ast_${workspaceId}_${filename.replace(/[^a-zA-Z0-9_-]/g, "_")}`
      
      try {
        await prisma.asset.create({
          data: {
            id: assetId,
            workspaceId,
            fileId: "file_irradiation_study",
            filename,
            url: `/api/workspaces/${workspaceId}/assets/${filename}`,
            thumbnailUrl: `/api/workspaces/${workspaceId}/assets/${filename}`,
            kind,
            page: 1,
            confidence: "high",
            caption: filename.replace(/_/g, " ").replace(/\.[^/.]+$/, ""),
          }
        })
      } catch (err) {
        // ignore duplicate
      }
    }
    console.log(`Populated assets for ${workspaceId}`)
  }

  console.log("Seeding complete!")
}

seed()
  .catch(err => {
    console.error("Seed failed:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
