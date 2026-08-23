/**
 * Seed script: creates a fully-populated demo workspace for marek.jurkemik@gmail.com
 * Run: node scripts/seed-demo.cjs
 */
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

const USER_ID = 'user_3IGDYw03LkmHZaaCgKwWcBYxHQu'
const WS_ID = 'demo-lattice-2025'

// ── shared content ──────────────────────────────────────────────────────────

const BIB = `@article{atlas2012higgs,
  author = {ATLAS Collaboration},
  title  = {Observation of a new boson at a mass of 125 GeV with the ATLAS detector},
  journal = {Physics Letters B},
  year   = {2012},
  volume = {716},
  pages  = {1--29}
}
@article{cms2012higgs,
  author = {CMS Collaboration},
  title  = {Observation of a new boson at a mass of 125 GeV with the CMS experiment},
  journal = {Physics Letters B},
  year   = {2012},
  volume = {716},
  pages  = {30--61}
}
@article{tilecal2023,
  author = {ATLAS Collaboration},
  title  = {Performance of the ATLAS Tile Calorimeter},
  journal = {JINST},
  year   = {2023},
  volume = {18},
  pages  = {P07009}
}`

const BIB_KEYS = JSON.stringify(['atlas2012higgs', 'cms2012higgs', 'tilecal2023'])

const AGENT_EVENTS = JSON.stringify([
  { id: 'ev1', kind: 'info', status: 'done', title: 'Demo workspace created', detail: 'Seed script ran successfully.' },
])

// ── cards ────────────────────────────────────────────────────────────────────

function makeFigure(i, caption) {
  return { id: `fig_${i}`, url: '', caption }
}

const POSTER_CARDS = [
  {
    id: 'pc-intro',
    title: 'Introduction',
    column: 1, order: 0,
    pattern: 'bullets-only',
    content: '- The ATLAS Tile Calorimeter (TileCal) is the central hadronic calorimeter of the ATLAS detector at the LHC\n- It covers |η| < 1.7 and provides crucial measurements of jets, missing transverse energy, and hadronic τ decays\n- TileCal uses scintillating tiles as the active medium and wavelength-shifting fibres to collect light\n- \\cite{tilecal2023}: Performance validated across Run 3 data-taking conditions',
    figures: JSON.stringify([]),
    table: JSON.stringify({ hasHeader: false, caption: '', rows: [] }),
    figureLayout: 'none', validation: 'valid',
  },
  {
    id: 'pc-detector',
    title: 'Detector Overview',
    column: 1, order: 1,
    pattern: 'bullets-image',
    content: '- Divided into Long Barrel (LB) and Extended Barrels (EB)\n- 256 modules in φ, each containing ~100 scintillating tiles\n- ~10,000 PMTs read out via COOL/TDAQ\n- Calibration systems: Cs source, laser, integrator, charge injection',
    figures: JSON.stringify([makeFigure(1, 'Schematic of the TileCal module geometry')]),
    table: JSON.stringify({ hasHeader: false, caption: '', rows: [] }),
    figureLayout: 'single', validation: 'valid',
  },
  {
    id: 'pc-calib',
    title: 'Calibration Strategy',
    column: 2, order: 0,
    pattern: 'bullets-image',
    content: '- Four independent calibration systems monitor the full signal chain\n- Caesium system: equalises cell response via radioactive Cs-137 source\n- Laser system: tracks PMT gain variations between physics fills\n- Charge injection: measures ADC linearity and pedestals\n- Cell response stable to <1% over Run 3',
    figures: JSON.stringify([makeFigure(2, 'Cell response uniformity across TileCal modules')]),
    table: JSON.stringify({ hasHeader: false, caption: '', rows: [] }),
    figureLayout: 'single', validation: 'valid',
  },
  {
    id: 'pc-energy',
    title: 'Energy Resolution',
    column: 2, order: 1,
    pattern: 'bullets-table',
    content: '- Measured with single pion test-beam data and in-situ E/p studies\n- Achieved stochastic term: 52%/√E\n- Noise term: 1.6 GeV constant\n- Results consistent with GEANT4 simulation',
    figures: JSON.stringify([]),
    table: JSON.stringify({
      hasHeader: true,
      caption: 'Energy resolution parameters',
      rows: [
        ['Parameter', 'Value', 'Uncertainty'],
        ['Stochastic term', '52%/√E', '±1%'],
        ['Noise term', '1.6 GeV', '±0.1 GeV'],
        ['Constant term', '3%', '±0.2%'],
      ],
    }),
    figureLayout: 'none', validation: 'valid',
  },
  {
    id: 'pc-timing',
    title: 'Timing Performance',
    column: 3, order: 0,
    pattern: 'bullets-image',
    content: '- Time resolution < 1 ns per cell for |E| > 4 GeV\n- Critical for pile-up suppression in high-luminosity conditions\n- Synchronisation maintained with beam splash events\n- In-situ monitoring via collision timing residuals',
    figures: JSON.stringify([makeFigure(3, 'Cell timing distribution for Run 3 collision data')]),
    table: JSON.stringify({ hasHeader: false, caption: '', rows: [] }),
    figureLayout: 'single', validation: 'valid',
  },
  {
    id: 'pc-refs',
    title: 'References',
    column: 3, order: 1,
    pattern: 'references',
    content: '',
    figures: JSON.stringify([]),
    table: JSON.stringify({ hasHeader: false, caption: '', rows: [] }),
    figureLayout: 'none', validation: 'valid',
  },
]

const SLIDES_CARDS = [
  {
    id: 'sl-title',
    title: 'Title Slide',
    column: null, order: 0,
    pattern: 'bullets-only',
    content: '- ATLAS Tile Calorimeter: Performance and Calibration in Run 3\n- Marek Jurkemik, on behalf of the ATLAS Collaboration\n- CERN EP Seminar, 2025',
    figures: JSON.stringify([]),
    table: JSON.stringify({ hasHeader: false, caption: '', rows: [] }),
    figureLayout: 'none', validation: 'valid',
    slideNotes: 'Welcome everyone. Today I will present the latest performance results from the ATLAS Tile Calorimeter collected during LHC Run 3.',
  },
  {
    id: 'sl-intro',
    title: 'Motivation',
    column: null, order: 1,
    pattern: 'bullets-only',
    content: '- TileCal is critical for jet and MET measurements at the LHC\n- Run 3: √s = 13.6 TeV, highest instantaneous luminosity to date\n- Understanding calorimeter response essential for precision Higgs measurements \\cite{atlas2012higgs}\n- This talk: calibration strategy and key performance metrics',
    figures: JSON.stringify([]),
    table: JSON.stringify({ hasHeader: false, caption: '', rows: [] }),
    figureLayout: 'none', validation: 'valid',
    slideNotes: 'Emphasise that Run 3 conditions are much more challenging than Run 2 due to higher pile-up.',
  },
  {
    id: 'sl-detector',
    title: 'The TileCal Detector',
    column: null, order: 2,
    pattern: 'bullets-image',
    content: '- Sampling calorimeter: steel absorber + plastic scintillator\n- η coverage: |η| < 1.7\n- Depth: ~7.4 λ (interaction lengths)\n- ~10,000 channels read out by PMTs',
    figures: JSON.stringify([makeFigure(1, 'TileCal module schematic')]),
    table: JSON.stringify({ hasHeader: false, caption: '', rows: [] }),
    figureLayout: 'single', validation: 'valid',
    slideNotes: 'Point out the scintillating tiles embedded between absorber plates on the diagram.',
  },
  {
    id: 'sl-calib',
    title: 'Calibration Systems',
    column: null, order: 3,
    pattern: 'bullets-image',
    content: '- Four complementary systems cover the full signal chain\n- Caesium source → laser → charge injection → integrators\n- Cell-level monitoring possible without beam\n- Stability maintained to < 1% RMS across Run 3',
    figures: JSON.stringify([makeFigure(2, 'Signal chain and calibration coverage')]),
    table: JSON.stringify({ hasHeader: false, caption: '', rows: [] }),
    figureLayout: 'single', validation: 'valid',
    slideNotes: 'Stress the redundancy — if one system fails, the others provide cross-checks.',
  },
  {
    id: 'sl-results',
    title: 'Key Results',
    column: null, order: 4,
    pattern: 'bullets-only',
    content: '- Energy resolution: σ/E = 52%/√E ⊕ 3% (consistent with test-beam)\n- Timing resolution: < 1 ns per cell for E > 4 GeV\n- Cell response uniform to < 1% after calibration\n- Dead cell fraction: < 0.5% of channels in 2024',
    figures: JSON.stringify([]),
    table: JSON.stringify({ hasHeader: false, caption: '', rows: [] }),
    figureLayout: 'none', validation: 'valid',
    slideNotes: 'These numbers are the main take-away. The detector is performing at design specifications despite the challenging Run 3 conditions.',
  },
  {
    id: 'sl-summary',
    title: 'Summary & Outlook',
    column: null, order: 5,
    pattern: 'bullets-only',
    content: '- TileCal performing at design specifications in Run 3\n- Calibration systems provide continuous monitoring\n- HL-LHC upgrade (Phase-II): new readout electronics for 40 MHz sampling\n- Full dataset analysis ongoing — expect improved E resolution with AI-based methods',
    figures: JSON.stringify([]),
    table: JSON.stringify({ hasHeader: false, caption: '', rows: [] }),
    figureLayout: 'none', validation: 'valid',
    slideNotes: 'End with enthusiasm for the HL-LHC prospects. Thank the audience.',
  },
]

const PAPER_CARDS = [
  {
    id: 'pp-abstract',
    title: 'Abstract',
    column: null, order: 0,
    pattern: 'bullets-only',
    content: 'We present a comprehensive study of the performance and calibration of the ATLAS Tile Calorimeter (TileCal) during LHC Run 3 at a centre-of-mass energy of 13.6 TeV. The TileCal is the central hadronic calorimeter of the ATLAS detector covering |η| < 1.7 and plays a key role in measurements of jets, missing transverse momentum, and hadronic τ-lepton decays. We describe the four independent calibration systems—caesium, laser, charge injection, and integrators—that continuously monitor the full signal chain. Cell-level response uniformity at the level of < 1% is achieved across all modules. The energy resolution is measured to be σ/E = 52%/√E ⊕ 3% and the time resolution per cell is better than 1 ns for cell energies above 4 GeV, both consistent with design expectations and GEANT4 simulation.',
    figures: JSON.stringify([]),
    table: JSON.stringify({ hasHeader: false, caption: '', rows: [] }),
    figureLayout: 'none', validation: 'valid',
  },
  {
    id: 'pp-intro',
    title: '1. Introduction',
    column: null, order: 1,
    pattern: 'bullets-only',
    content: 'The Tile Calorimeter (TileCal) is the central hadronic sampling calorimeter of the ATLAS detector \\cite{tilecal2023} at the Large Hadron Collider (LHC) at CERN. It covers the pseudorapidity range |η| < 1.7 and uses plastic scintillating tiles embedded between iron absorber plates as the active medium. Light produced in the scintillating tiles is collected by wavelength-shifting (WLS) fibres and read out by photomultiplier tubes (PMTs). The detector is divided into a central Long Barrel (LB) and two Extended Barrels (EB), each segmented into 64 modules in azimuth φ.\n\nHigh-precision calibration of TileCal is essential for achieving the physics goals of the ATLAS programme, including precision measurements of the Higgs boson \\cite{atlas2012higgs} and searches for physics beyond the Standard Model. Run 3, which commenced in 2022 at √s = 13.6 TeV with significantly higher instantaneous luminosity than Run 2, presents new challenges for detector performance and pile-up suppression.',
    figures: JSON.stringify([]),
    table: JSON.stringify({ hasHeader: false, caption: '', rows: [] }),
    figureLayout: 'none', validation: 'valid',
  },
  {
    id: 'pp-detector',
    title: '2. Detector Description',
    column: null, order: 2,
    pattern: 'bullets-image',
    content: 'The TileCal consists of approximately 460,000 scintillating tiles arranged in layers behind 5 mm iron absorber plates. The active tiles are 3 mm thick and are read out via WLS fibres routed to PMTs housed in the module drawers. The detector has approximately 10,000 readout channels, each corresponding to a projective cell in η–φ space.\n\nThe signal chain processes PMT pulses through shaping and amplification circuits before digitisation by 10-bit ADCs sampling at 40 MHz. Optimal filtering algorithms are applied online to reconstruct the cell energy and timing from the digitised pulse samples.',
    figures: JSON.stringify([makeFigure(1, 'Cross-sectional view of a TileCal module showing the scintillating tile arrangement and WLS fibre routing.')]),
    table: JSON.stringify({ hasHeader: false, caption: '', rows: [] }),
    figureLayout: 'single', validation: 'valid',
  },
  {
    id: 'pp-calib',
    title: '3. Calibration',
    column: null, order: 3,
    pattern: 'bullets-image',
    content: 'Four independent calibration systems monitor different stages of the signal chain. The caesium (Cs) system uses a radioactive ¹³⁷Cs source that traverses each cell via a hydraulic system, equalising the response of all cells to a common reference. The laser system injects light pulses of controlled amplitude directly into the PMT optical path, monitoring gain variations between physics fills with sub-0.1% precision.\n\nThe charge injection system (CIS) injects known charges at the ADC input to measure linearity and identify stuck bits. Finally, the minimum bias integrator system measures the response of cells integrated over many bunch crossings, providing an independent cross-check of the energy scale.',
    figures: JSON.stringify([makeFigure(2, 'Schematic of the TileCal signal chain with calibration system injection points indicated.')]),
    table: JSON.stringify({ hasHeader: false, caption: '', rows: [] }),
    figureLayout: 'single', validation: 'valid',
  },
  {
    id: 'pp-results',
    title: '4. Performance Results',
    column: null, order: 4,
    pattern: 'bullets-table',
    content: 'The energy resolution was measured using single-pion test-beam data and validated in-situ using E/p ratios for isolated hadrons. The measured stochastic term of 52%/√E and constant term of 3% are consistent with design specifications and full GEANT4 simulation.\n\nThe cell timing resolution was evaluated using the timing residuals of collisions with respect to the LHC bunch clock. Cells with energy above 4 GeV achieve a timing resolution better than 1 ns, sufficient for effective pile-up suppression at the trigger level.',
    figures: JSON.stringify([]),
    table: JSON.stringify({
      hasHeader: true,
      caption: 'Summary of TileCal performance parameters measured in Run 3.',
      rows: [
        ['Observable', 'Measured Value', 'Design Target'],
        ['Energy resolution (stochastic)', '52%/√E', '50%/√E'],
        ['Energy resolution (constant)', '3%', '3%'],
        ['Timing resolution (E > 4 GeV)', '< 1 ns', '1 ns'],
        ['Cell response uniformity', '< 1% RMS', '< 2% RMS'],
        ['Dead channel fraction', '< 0.5%', '< 1%'],
      ],
    }),
    figureLayout: 'none', validation: 'valid',
  },
  {
    id: 'pp-conclusion',
    title: '5. Conclusions',
    column: null, order: 5,
    pattern: 'bullets-only',
    content: 'The ATLAS Tile Calorimeter has demonstrated excellent performance throughout Run 3 of the LHC, meeting or exceeding design specifications for energy resolution, timing, and response uniformity. The four complementary calibration systems provide continuous monitoring and correction of the full signal chain, maintaining cell-level response stability to better than 1%.\n\nPreparations for the High-Luminosity LHC Phase-II upgrade are underway, including the replacement of the on- and off-detector readout electronics with new systems capable of reading out the full 40 MHz bunch-crossing rate. These upgrades will further enhance the calorimeter\'s performance in the challenging HL-LHC environment.',
    figures: JSON.stringify([]),
    table: JSON.stringify({ hasHeader: false, caption: '', rows: [] }),
    figureLayout: 'none', validation: 'valid',
  },
  {
    id: 'pp-refs',
    title: 'References',
    column: null, order: 6,
    pattern: 'references',
    content: '',
    figures: JSON.stringify([]),
    table: JSON.stringify({ hasHeader: false, caption: '', rows: [] }),
    figureLayout: 'none', validation: 'valid',
  },
]

// ── outputs ──────────────────────────────────────────────────────────────────

const OUTPUTS = [
  {
    id: 'out-poster',
    outputType: 'poster',
    templateId: 'atlas',
    title: 'ATLAS TileCal Performance – ICHEP 2025',
    isActive: true,
    cards: POSTER_CARDS,
  },
  {
    id: 'out-slides',
    outputType: 'slides',
    templateId: 'beamer-metropolis',
    title: 'TileCal Run 3 Calibration & Performance',
    isActive: false,
    cards: SLIDES_CARDS,
  },
  {
    id: 'out-paper',
    outputType: 'paper',
    templateId: 'article-twocol',
    title: 'Performance of the ATLAS TileCal in Run 3',
    isActive: false,
    cards: PAPER_CARDS,
  },
]

async function seed() {
  console.log('🗑️  Deleting existing demo workspace if present...')
  await p.workspace.deleteMany({ where: { id: WS_ID } })

  console.log('🌱 Creating workspace...')
  await p.workspace.create({
    data: {
      id: WS_ID,
      name: 'ATLAS Tile Calorimeter — Demo',
      authors: 'Marek Jurkemik, on behalf of the ATLAS Collaboration',
      venue: 'ICHEP 2025, Prague',
      userId: USER_ID,
      bibContent: BIB,
      bibKeys: BIB_KEYS,
      agentEvents: AGENT_EVENTS,
      outputs: {
        create: OUTPUTS.map(o => ({
          id: o.id,
          outputType: o.outputType,
          templateId: o.templateId,
          title: o.title,
          isActive: o.isActive,
          cards: {
            create: o.cards.map(c => ({
              id: c.id,
              title: c.title,
              column: c.column ?? null,
              order: c.order,
              pattern: c.pattern,
              content: c.content,
              figures: c.figures,
              table: c.table,
              figureLayout: c.figureLayout,
              validation: c.validation,
              slideNotes: c.slideNotes ?? null,
            })),
          },
        })),
      },
    },
  })

  console.log('✅ Done! Workspace ID:', WS_ID)
  console.log('   Outputs: poster (active), slides, paper')
  console.log('   Cards:  ', POSTER_CARDS.length, 'poster |', SLIDES_CARDS.length, 'slides |', PAPER_CARDS.length, 'paper')
}

seed().catch(e => { console.error(e); process.exit(1) }).finally(() => p.$disconnect())
