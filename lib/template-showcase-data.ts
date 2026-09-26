/**
 * Curated template galleries.
 *
 * Every registered output template ships with a *real* example built from the
 * input data the template is designed for — not the same twelve cards with a
 * different colour. Four research subjects are written out in full (an HEP
 * resonance search, a CRISPR antiviral study, an inference-acceleration paper
 * and a surgical-robotics system), each with its own prose, numbers, tables and
 * figures drawn from the demo figure set in `public/figures/`.
 *
 * Why this matters beyond cosmetics:
 *
 *  - Poster templates have different board geometry (portrait A0, landscape A0,
 *    Better Poster's asymmetric 0.28/0.42/0.28). A gallery built for a portrait
 *    board overflows or underfills a landscape one, so the card *column
 *    assignments here are per template* and verified against the template's own
 *    budget by `lib/__tests__/template-gallery.test.ts`.
 *  - Single-column paper venues must not receive `figure*`-shaped content, and
 *    proceedings formats want an abstract card that the generator splices into
 *    the frontmatter. The seeds below are chosen per output type accordingly.
 *  - Because the content is source-controlled and card ids are stable
 *    (`card_<template>_<slug>`, per AGENTS.md), the LaTeX `% block id:` mapping
 *    used by AI autofix / DeerFlow improvement keeps working on demo output.
 */

import type { BibEntry } from "./bib-types"
import type { BlockPattern, Card, ColumnIndex, Figure, OutputConfig } from "./poster-types"
import { TEMPLATE_REGISTRY, getTemplateDef, type OutputType } from "./output-types"
import { planPosterColumns, posterBoardFor } from "./latex/layout"
import { formatBibEntry } from "./bib-types"


/**
 * Fallback speaker notes by slide slug.
 *
 * The demo decks are meant to be *presented*, so every content slide carries
 * notes. Hand-written notes win; this map makes sure no slide ships bare — a
 * template gallery with empty notes frames looks unfinished in a demo, and the
 * same four roles recur across all four subjects.
 */
const SLIDE_NOTE_FALLBACK: Record<string, string> = {
  motivation: "Open with the constraint, not the method: the audience needs the problem before the solution.",
  problem: "State the failure mode in one sentence and move on — the evidence is in the next slides.",
  architecture: "Walk the diagram left to right; the audience should be able to redraw it afterwards.",
  method: "Explain the mechanism at the level of the figure, then say where the equations live.",
  pipeline: "Stress the cycle time: design latency is what makes the platform usable.",
  design: "Point out that the ranking is structure-driven, not sequence-driven.",
  dataset: "Mention that trigger efficiency is measured in data, not taken from simulation.",
  background: "Say the signal region was blinded while the model was chosen.",
  selection: "Do not read the table; point at the last row and move on.",
  results: "Lead with the headline number, then give the uncertainty in the same breath.",
  knockdown: "Four biological replicates per bar; the ensemble is the highlighted bar.",
  escape: "Emphasise that escape was called by sequencing, not by a plaque assay alone.",
  dose: "EC₅₀ values are in the table if asked; the curve is about the shift, not the absolute value.",
  latency: "Point at the dashed budget line: anything below it fits the control loop.",
  tail: "The left tail is the quantity the paper guarantees — the mean is secondary.",
  numbers: "Leave this slide up for questions; it answers most of them.",
  headline: "Leave this slide up for questions; it answers most of them.",
  tasks: "Say which subtask is hardest and why before showing the numbers.",
  ablation: "This is the 'why it works' slide: spend the time here rather than on the table.",
  systematics: "The dominant term is the one to defend; name it and give the mitigation.",
  specificity: "If asked about collagen damage, the answer is the RNA-seq column.",
  exactness: "Be precise: the claim is distributional equivalence, not identical logits.",
  next: "One sentence per item — the audience wants the bottleneck, not the roadmap.",
  conclusion: "Finish on the single number that matters; do not re-list the talk.",
  acknowledgements: "Keep it short and thank the facility staff by name if they are in the room.",
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CardSeed = {
  slug: string
  title: string
  pattern: BlockPattern
  content: string
  column?: ColumnIndex
  table?: { hasHeader: boolean; caption: string; rows: string[][] }
  figures?: Array<{ url: string; caption: string }>
  notes?: string
}

export type GallerySubject = {
  id: "hep" | "bio" | "vla" | "nlp"
  title: string
  authors: string
  /** Venue per output type — a journal name reads wrong on a poster and vice versa. */
  venue: { poster: string; slides: string; paper: string }
  /** Two references minimum: a gallery with an empty bibliography is not a demo. */
  bibEntries: BibEntry[]
  poster: CardSeed[]
  slides: CardSeed[]
  paper: CardSeed[]
  /**
   * Edition material. A template's gallery is assembled from these pools so
   * that two templates showing the same study still show *different documents*:
   * a Better Poster gets a single hero finding, an a0poster gets the dense
   * method/implementation cards, a landscape board gets the side-by-side
   * result pair, and a proceedings paper drops the sections it cannot afford.
   */
  /**
   * Per-subject slugs for the roles an edition needs. Subjects name their
   * sections differently ("Detector" vs "Architecture"), and an edition that
   * guessed would silently emit an empty card.
   */
  roles: {
    problem: string
    method: string
    result: string
    conclusion: string
    section: string
  }
  extras: {
    poster: { keyFinding: CardSeed; sideBySide: CardSeed; details: CardSeed; spare: CardSeed }
    slides: { statement: CardSeed; summary: CardSeed }
    paper: { implementation: CardSeed; limitations: CardSeed }
  }
}

const FIG = (name: string) => `/figures/${name}.png`

function bib(
  id: string,
  type: BibEntry["type"],
  title: string,
  authors: string[],
  year: string,
  extra: Partial<BibEntry> = {},
): BibEntry {
  const entry: BibEntry = {
    id,
    key: id,
    type,
    title,
    authors,
    authorString: authors.join(" and "),
    year,
    ...extra,
    rawBibtex: "",
  }
  // Rendered once here so every consumer (store seeding, API seeding, the
  // BibTeX pane) gets the same sourced entry without a second pass.
  entry.rawBibtex = formatBibEntry(entry)
  return entry
}

// ---------------------------------------------------------------------------
// Subject 1 — HEP resonance search
// ---------------------------------------------------------------------------

const HEP: GallerySubject = {
  id: "hep",
  title: "Search for a 630 GeV Resonance in the Di-Photon Channel with an Upgraded Tracker",
  authors: "M. Horák, J. Lindqvist, A. Ramirez, P. Novotný, and the HEP-UPG Collaboration",
  venue: {
    poster: "ICHEP 2026 · Prague",
    slides: "ICHEP 2026 · Parallel Session, Beyond the Standard Model",
    paper: "Journal of Instrumentation — Proceedings of the 21st Pisa Meeting on Advanced Detectors",
  },
  bibEntries: [
    bib("hep2026tracker", "article", "A radiation-hard silicon tracker for HL-LHC phase-II upgrades", ["A. Ramirez", "K. Tanaka"], "2026", { journal: "Nucl. Instrum. Methods A", volume: "1072", pages: "169884" }),
    bib("hep2025resonance", "article", "Di-photon resonance searches beyond the Standard Model: a review", ["L. Moretti", "S. Bhattacharya"], "2025", { journal: "Phys. Rept.", volume: "1188", pages: "1-94" }),
    bib("hep2024pythia", "misc", "PYTHIA 8.4: physics and manual", ["T. Sjöstrand"], "2024", { eprint: "2401.01234" }),
    bib("hep2023cowan", "book", "Statistical Data Analysis", ["G. Cowan"], "2023", { publisher: "Oxford University Press" }),
  ],
  poster: [
    {
      slug: "overview",
      title: "Search Overview",
      pattern: "bullets",
      column: 1,
      content:
        "- We search for a narrow scalar resonance $X$ decaying to $\\gamma\\gamma$ in 139 fb$^{-1}$ of $\\sqrt{s} = 13$ TeV $pp$ collisions \\cite{hep2025resonance}\n- The analysis is motivated by the 630 GeV excess reported by the upgraded tracker commissioning run\n- Background is modelled with a parametric fit to the di-photon invariant mass spectrum, validated in three control regions\n- Sensitivity is improved by 22% relative to the published result thanks to the new radiation-hard inner tracker \\cite{hep2026tracker}",
    },
    {
      slug: "detector",
      title: "Detector & Dataset",
      pattern: "bullets-image",
      column: 1,
      figures: [{ url: FIG("detector-cross-section"), caption: "Figure 1: Longitudinal view of the upgraded tracker with acceptance regions used in this analysis." }],
      content:
        "- Pixel layers at $r = 32$–$96$ mm with 12 µm per-hit resolution\n- Photon candidates: $E_T > 25$ GeV, $|\\eta| < 2.37$, excluding the 1.37–1.52 transition region\n- 139 fb$^{-1}$ at $\\sqrt{s} = 13$ TeV, 2022–2024 runs",
    },
    {
      slug: "selection",
      title: "Event Selection",
      pattern: "bullets-table",
      column: 1,
      table: {
        hasHeader: true,
        caption: "Table 1: Cut flow for the di-photon selection.",
        rows: [
          ["Selection stage", "Events", "Efficiency"],
          ["Di-photon triggers", "1 284 500", "—"],
          ["$|\\eta| < 2.37$", "1 187 400", "92.4%"],
          ["Isolation + $p_T$ cuts", "842 900", "71.0%"],
          ["$m_{\\gamma\\gamma}$ window", "48 320", "5.7%"],
        ],
      },
      content: "- Mass window 600–660 GeV retains the signal region while keeping the background estimate data-driven",
    },
    {
      slug: "spectrum",
      title: "Mass Spectrum",
      pattern: "image-focused",
      column: 2,
      figures: [{ url: FIG("mass-spectrum"), caption: "Figure 2: Di-photon invariant mass spectrum with the signal-plus-background fit; a narrow excess is visible near 630 GeV." }],
      content: "The observed spectrum is fitted with a fourth-order Bernstein polynomial for the background and a Gaussian signal shape.",
    },
    {
      slug: "results",
      title: "Results",
      pattern: "stats",
      column: 2,
      content:
        "**5.8 σ** | local significance\n**1.4 σ** | look-elsewhere corrected\n**630.4 ± 1.1 GeV** | fitted mass\n**0.9 fb** | cross section upper limit",
    },
    {
      slug: "limits",
      title: "Limits & Interpretation",
      pattern: "bullets-table",
      column: 2,
      table: {
        hasHeader: true,
        caption: "Table 2: 95% CL upper limits on σ × BR as a function of the assumed width.",
        rows: [
          ["Width Γ (GeV)", "Expected (fb)", "Observed (fb)"],
          ["1.0", "0.34", "0.41"],
          ["2.5", "0.51", "0.62"],
          ["5.0", "0.88", "0.94"],
        ],
      },
      content:
        "- Limits are derived with the $\\text{CL}_s$ prescription including profiling over the background nuisance parameters \\cite{hep2023cowan}\n- Signal samples are generated with PYTHIA 8.4 \\cite{hep2024pythia} and passed through the full detector simulation",
    },
    {
      slug: "systematics",
      title: "Systematic Uncertainties",
      pattern: "bullets",
      column: 2,
      content:
        "- Luminosity: 1.7% (measured with van-der-Meer scans)\n- Photon energy scale: 0.4% (calibrated on $Z \\to ee$ events)\n- Background modelling: 3.1% (envelope of three fit orders)\n- Pile-up reweighting: 1.2% (varying the mean interactions by ±5%)",
    },
    {
      slug: "conclusion",
      title: "Conclusions & Next Steps",
      pattern: "bullets",
      column: 3,
      content:
        "- A localized excess at $m_{\\gamma\\gamma} = 630.4$ GeV is observed with 5.8 σ local (1.4 σ global) significance\n- The upgraded tracker improves the mass resolution by 18% and the acceptance by 9% versus the 2022 configuration\n- Storing the full high-level trigger stream for 2026 will allow a width scan over 0.5–8 GeV",
    },
    {
      slug: "outlook",
      title: "Outlook",
      pattern: "bullets-image",
      column: 3,
      figures: [{ url: FIG("training-curves"), caption: "Figure 3: Projected significance versus integrated luminosity for three detector configurations." }],
      content:
        "- With 300 fb$^{-1}$ the expected significance for the nominal signal hypothesis reaches 8.3 σ\n- The same selection will be applied to the 2026 heavy-ion run with modified isolation",
    },
    {
      slug: "acknowledgements",
      title: "Acknowledgements",
      pattern: "bullets",
      column: 3,
      content:
        "- Supported by the national research infrastructure grant INFRA-2026-114\n- Computing resources provided by the Tier-1 centre at CERN\n- We thank the accelerator operations team for the dedicated low-pile-up runs",
    },
    {
      slug: "references",
      title: "References",
      pattern: "references",
      column: 3,
      content: "",
    },
  ],
  roles: { problem: "overview", method: "detector", result: "spectrum", conclusion: "conclusion", section: "selection" },
  extras: {
    poster: {
      keyFinding: {
        slug: "keyfinding",
        title: "One Discovery, One Sentence",
        pattern: "stats",
        content:
          "**630.4 GeV** | fitted di-photon resonance mass\n**5.8 σ** | local significance (1.4 σ global)\n**139 fb⁻¹** | analysed luminosity",
      },
      sideBySide: {
        slug: "glance",
        title: "Results at a Glance",
        pattern: "bullets-image",
        content:
          "- Two fits bracket the central value: orders three and five of the Bernstein polynomial differ by 0.4 GeV\n- The 2022 configuration (no upgraded tracker) sees 3.1 σ at the same mass",
        figures: [
          { url: FIG("mass-spectrum"), caption: "Observed spectrum with the signal-plus-background fit." },
          { url: FIG("training-curves"), caption: "Significance versus luminosity for three detector configurations." },
        ],
      },
      spare: {
        slug: "performance",
        title: "Detector Performance vs. 2022",
        pattern: "bullets-table",
        table: {
          hasHeader: true,
          caption: "Table 3: Tracking performance before and after the phase-II upgrade.",
          rows: [
            ["Metric", "2022", "Upgraded"],
            ["Hit resolution", "24 µm", "12 µm"],
            ["$|\\eta|$ coverage", "2.5", "4.0"],
            ["Mass resolution at 630 GeV", "1.9 GeV", "1.6 GeV"],
            ["Photon acceptance", "0.81", "0.89"],
          ],
        },
        content: "- The gain in mass resolution is what narrows the signal window and reduces the background under the peak",
      },
      details: {
        slug: "calibration",
        title: "Calibration & Reconstruction",
        pattern: "bullets",
        content:
          "- Photon energy scale calibrated on $Z \to ee$ events, residual non-linearity below 0.2% over 500–800 GeV\n- Cluster containment corrected with a 9×9 crystal window matched to the shower profile\n- Vertex selection uses a neural-network regression with a 12 µm longitudinal resolution\n- Trigger efficiency measured with a tag-and-probe selection; plateau reached at $E_T = 30$ GeV",
      },
    },
    slides: {
      statement: {
        slug: "statement",
        title: "The Question in One Line",
        pattern: "two-column",
        content:
          "**Claim**\nA narrow scalar at 630 GeV would appear as a localized excess in the di-photon mass spectrum.\n\n**Test**\nFit the spectrum with a parametric background model frozen before unblinding, then count the excess in the signal window.",
        notes: "Keep this slide on screen while explaining that the fit range excludes the signal window.",
      },
      summary: {
        slug: "summary",
        title: "One-Slide Summary",
        pattern: "stats",
        content: "**5.8 σ** | local excess\n**1.4 σ** | global\n**0.94 fb** | observed limit\n**18%** | resolution gain",
        notes: "The closing slide: say the global significance out loud and that the result is not yet evidence for new physics.",
      },
    },
    paper: {
      implementation: {
        slug: "implementation",
        title: "Implementation Details",
        pattern: "section",
        content:
          "Events are reconstructed with the standard offline sequence, modified only in the forward region where the upgraded modules contribute hits beyond $|\eta| = 2.5$. Photon identification uses a boosted decision tree trained on simulated samples with the same detector conditions as the data. The background fit is performed with a fourth-order Bernstein polynomial over 550–750 GeV; the signal region, defined as 615–645 GeV, is excluded from the fit and unblinded only after the model and its systematic uncertainties are frozen. Pseudo-experiments (50 000 toys) are used to validate the coverage of the limit-setting procedure.",
      },
      limitations: {
        slug: "limitations",
        title: "Limitations",
        pattern: "section",
        content:
          "The result is limited by statistics in the signal region: the expected background is 39 events with a 6% uncertainty, and the observed excess corresponds to 41 events. The background-model uncertainty, taken as the envelope over polynomial orders three to five, is the second largest contribution. The width scan is restricted to $\Gamma \leq 5$ GeV because wider signals are degenerate with the background shape over the available mass range; extending the scan requires the larger dataset of the 2026 run.",
      },
    },
  },
  slides: [
    {
      slug: "title",
      title: "Title",
      pattern: "title-slide",
      content: "",
      notes: "Open with the physics question: is the 630 GeV excess real? State the datasets and the improvement over the published result.",
    },
    {
      slug: "motivation",
      title: "Motivation",
      pattern: "bullets",
      content:
        "- Narrow di-photon resonances are a clean signature of extended scalar sectors \\cite{hep2025resonance}\n- The published 2022 analysis was limited by tracker occupancy at $|\\eta| > 2$\n- The phase-II tracker upgrade doubles the hit resolution in the forward region\n- **Question:** does the 630 GeV excess survive with the upgraded detector?",
      notes: "Keep to one minute; the point is that the upgrade changes the acceptance, not just the statistics.",
    },
    {
      slug: "detector",
      title: "The Upgraded Tracker",
      pattern: "bullets-image",
      content: "- 4 pixel layers, 12 µm resolution, 3×10¹⁵ n$_{eq}$/cm² tolerance\n- Forward coverage extended to $|\\eta| = 4.0$\n- Readout rate 1 MHz with on-detector zero suppression",
      figures: [{ url: FIG("detector-cross-section"), caption: "Longitudinal view with the acceptance regions used here." }],
      notes: "Emphasise radiation hardness — this is why the forward acceptance is usable at all.",
    },
    {
      slug: "dataset",
      title: "Dataset & Triggers",
      pattern: "two-column",
      content:
        "**Collected**\n- 139 fb$^{-1}$ at $\\sqrt{s} = 13$ TeV (2022–2024)\n- Di-photon trigger with $E_T$ thresholds of 22/24 GeV\n- Average pile-up $\\langle\\mu\\rangle = 38$\n\n**Simulation**\n- PYTHIA 8.4 signal samples for $m_X = 600$–820 GeV \\cite{hep2024pythia}\n- Full Geant4 detector simulation and digitisation\n- Reweighted to the observed pile-up profile",
      notes: "Mention the trigger turn-on curve is measured in data with a tag-and-probe method.",
    },
    {
      slug: "selection",
      title: "Event Selection",
      pattern: "bullets-table",
      table: {
        hasHeader: true,
        caption: "Cut flow, cumulative.",
        rows: [
          ["Stage", "Events", "Efficiency"],
          ["Triggers", "1 284 500", "—"],
          ["Photon ID", "987 200", "76.9%"],
          ["Isolation", "842 900", "65.6%"],
          ["Mass window", "48 320", "3.8%"],
        ],
      },
      content: "- Isolated photons with $E_T > 25$ GeV\n- Transverse momentum balance $|\\sum p_T| < 20$ GeV",
      notes: "Do not read the whole table; point at the mass-window line.",
    },
    {
      slug: "background",
      title: "Background Modelling",
      pattern: "bullets",
      content:
        "- Background is smooth in $m_{\\gamma\\gamma}$ and modelled with a Bernstein polynomial\n- Fit range 550–750 GeV, signal region blinded during the fit\n- Three control regions validate the model at 0.5% level\n- Systematic from the fit-order envelope: 3.1%",
      notes: "The blinding procedure is a natural question — say the signal region was unblinded only after the model was frozen.",
    },
    {
      slug: "results",
      title: "Results",
      pattern: "graph",
      content: "A narrow excess is observed at $m_{\\gamma\\gamma} = 630.4 \\pm 1.1$ GeV with a local significance of 5.8 σ.",
      figures: [{ url: FIG("mass-spectrum"), caption: "Signal-plus-background fit to the di-photon invariant mass spectrum." }],
      notes: "Lead with the local significance, then immediately give the global one — do not let the audience discover it in questions.",
    },
    {
      slug: "numbers",
      title: "Headline Numbers",
      pattern: "stats",
      content:
        "**5.8 σ** | local significance\n**1.4 σ** | global (look-elsewhere)\n**0.94 fb** | observed limit, Γ = 5 GeV\n**1.7%** | luminosity uncertainty",
    },
    {
      slug: "systematics",
      title: "Systematics Summary",
      pattern: "bullets-table",
      table: {
        hasHeader: true,
        caption: "Relative uncertainties on the signal yield.",
        rows: [
          ["Source", "Uncertainty"],
          ["Luminosity", "1.7%"],
          ["Photon energy scale", "0.4%"],
          ["Background model", "3.1%"],
          ["Pile-up reweighting", "1.2%"],
        ],
      },
      content: "- Total: 3.9% (dominated by the background-model envelope)",
    },
    {
      slug: "outlook",
      title: "Outlook",
      pattern: "graph",
      content: "With 300 fb$^{-1}$ the expected significance reaches 8.3 σ, and the width scan extends to 8 GeV.",
      figures: [{ url: FIG("training-curves"), caption: "Projected significance versus integrated luminosity." }],
      notes: "Say explicitly that the tracker upgrade is what makes the forward acceptance usable at high pile-up.",
    },
    {
      slug: "conclusion",
      title: "Conclusions",
      pattern: "bullets",
      content:
        "- 5.8 σ local excess at 630.4 GeV in the di-photon channel\n- Upgraded tracker improves resolution by 18% and acceptance by 9%\n- Limits exclude a scalar with Γ = 5 GeV and σ × BR > 0.94 fb\n- Full 2026 trigger stream will enable a width scan over 0.5–8 GeV",
    },
    {
      slug: "references",
      title: "References",
      pattern: "references",
      content: "",
      notes: "Leave the slide up during questions.",
    },
  ],
  paper: [
    {
      slug: "abstract",
      title: "Abstract",
      pattern: "section",
      content:
        "A search for a narrow scalar resonance decaying into two photons is presented, using 139 fb$^{-1}$ of proton–proton collisions at $\\sqrt{s} = 13$ TeV recorded with the upgraded inner tracker. The di-photon invariant mass spectrum is fitted with a parametric background model whose uncertainty is constrained in three control regions. An excess is observed at $m_{\\gamma\\gamma} = 630.4 \\pm 1.1$ GeV with a local significance of 5.8 standard deviations, corresponding to 1.4 standard deviations after the look-elsewhere correction. Upper limits at 95% confidence level on the production cross section times branching fraction are set as a function of the assumed resonance width using the $\\text{CL}_s$ prescription.",
    },
    {
      slug: "introduction",
      title: "Introduction",
      pattern: "section",
      content:
        "Extensions of the Standard Model with an additional scalar singlet predict narrow resonances that couple to photons through a loop of charged particles. Searches in the di-photon final state are therefore among the most sensitive probes of such scenarios at the LHC \\cite{hep2025resonance}. The published analysis of the 2022 dataset was limited by the forward acceptance of the previous tracking detector, where the occupancy at $|\\eta| > 2$ degraded the reconstruction efficiency for high-$p_T$ photons.\n\nThe phase-II tracker upgrade replaces the forward modules with radiation-hard planar sensors, doubling the per-hit resolution and extending the coverage to $|\\eta| = 4.0$ \\cite{hep2026tracker}. This paper repeats the di-photon search on the full 2022–2024 dataset with the upgraded detector, and quantifies the resulting gain in sensitivity.",
    },
    {
      slug: "detector",
      title: "Detector and Dataset",
      pattern: "section-figure",
      content:
        "The inner tracker consists of four pixel layers at radii between 32 mm and 96 mm, each providing a single-point resolution of 12 µm and designed to withstand a fluence of $3 \\times 10^{15}$ n$_{eq}$/cm$^2$. Photon candidates are reconstructed from topological clusters in the electromagnetic calorimeter and required to have $E_T > 25$ GeV and $|\\eta| < 2.37$, excluding the transition region between barrel and end-cap. Events are selected by a di-photon trigger with thresholds of 22 and 24 GeV; the trigger efficiency is measured in data with a tag-and-probe method and exceeds 98% for the offline selection.",
      figures: [{ url: FIG("detector-cross-section"), caption: "Longitudinal view of the upgraded tracker showing the acceptance regions used in this analysis." }],
    },
    {
      slug: "selection",
      title: "Event Selection",
      pattern: "section-table",
      content:
        "Photons are required to be isolated, with the scalar sum of transverse energy in a cone of $\\Delta R = 0.4$ below 6 GeV after subtracting the expected pile-up contribution. The two leading photons must be separated by $\\Delta R > 0.4$ and satisfy $|\\sum p_T| < 20$ GeV to reject events with significant jet activity. Table 1 lists the cumulative cut flow.",
      table: {
        hasHeader: true,
        caption: "Cut flow for the di-photon selection; efficiencies are relative to the previous stage.",
        rows: [
          ["Selection stage", "Events", "Efficiency"],
          ["Di-photon triggers", "1 284 500", "—"],
          ["$|\\eta| < 2.37$", "1 187 400", "92.4%"],
          ["Isolation and $p_T$ cuts", "842 900", "71.0%"],
          ["$m_{\\gamma\\gamma}$ window", "48 320", "5.7%"],
        ],
      },
    },
    {
      slug: "background",
      title: "Background Model",
      pattern: "section",
      content:
        "The dominant background is irreducible prompt di-photon production, whose invariant mass spectrum is smooth and well described by a fourth-order Bernstein polynomial. The fit is performed over the range 550–750 GeV while the signal window is blinded; the number of parameters is chosen by an $F$-test on the sidebands, and the residual bias of the fit is estimated with pseudo-experiments. Systematic uncertainty from the background model is taken as the envelope over polynomial orders three to five, giving 3.1%.",
    },
    {
      slug: "results",
      title: "Results",
      pattern: "section-two-figures",
      content:
        "The fitted signal-plus-background model is shown in Figure 2. The excess corresponds to a signal yield of $41 \\pm 8$ events, with a fitted mass of $630.4 \\pm 1.1$ GeV and a width consistent with the detector resolution of 1.6 GeV. The local $p$-value of the background-only hypothesis is $3 \\times 10^{-9}$, i.e. 5.8 standard deviations; accounting for the number of independent search windows between 550 and 750 GeV the global significance is 1.4 standard deviations.",
      figures: [
        { url: FIG("mass-spectrum"), caption: "Signal-plus-background fit to the di-photon invariant mass spectrum." },
        { url: FIG("training-curves"), caption: "Projected significance as a function of integrated luminosity for three detector configurations." },
      ],
    },
    {
      slug: "limits",
      title: "Limits and Interpretation",
      pattern: "section-table",
      content:
        "Upper limits on the production cross section times branching fraction are derived with the $\\text{CL}_s$ prescription, profiling the background nuisance parameters \\cite{hep2023cowan}. Signal samples are generated with PYTHIA 8.4 \\cite{hep2024pythia} and passed through the full detector simulation. Table 2 gives the expected and observed limits for three assumed widths.",
      table: {
        hasHeader: true,
        caption: "95% confidence level upper limits on σ × BR as a function of the assumed resonance width.",
        rows: [
          ["Assumed width Γ (GeV)", "Expected (fb)", "Observed (fb)"],
          ["1.0", "0.34", "0.41"],
          ["2.5", "0.51", "0.62"],
          ["5.0", "0.88", "0.94"],
        ],
      },
    },
    {
      slug: "conclusion",
      title: "Conclusions",
      pattern: "section",
      content:
        "A search for a narrow di-photon resonance with the upgraded inner tracker observes a localized excess at 630.4 GeV with a local significance of 5.8 standard deviations. After correcting for the look-elsewhere effect the global significance is 1.4 standard deviations, so the excess is not yet evidence for new physics. The tracker upgrade improves the mass resolution by 18% and the forward acceptance by 9% with respect to the 2022 configuration. Recording the full high-level trigger stream in 2026 will allow the width scan to be extended to 0.5–8 GeV, where the sensitivity to a scalar singlet is maximal.",
    },
    {
      slug: "references",
      title: "References",
      pattern: "references",
      content: "",
    },
  ],
}

// ---------------------------------------------------------------------------
// Subject 2 — CRISPR antiviral programme
// ---------------------------------------------------------------------------

const BIO: GallerySubject = {
  id: "bio",
  title: "Structure-Aware Cas13 Guide Ensembles Suppress Escape in Respiratory RNA Viruses",
  authors: "E. Nováková, T. Oyelaran, S. Krishnan, M. Delgado, H. Watanabe",
  venue: {
    poster: "CRISPR 2026 · Vienna",
    slides: "CRISPR 2026 · Plenary Session, Antiviral Platforms",
    paper: "Molecular Therapy — Nucleic Acids",
  },
  bibEntries: [
    bib("bio2026cas13", "article", "Cas13d collateral activity is tunable by guide architecture", ["H. Watanabe", "S. Krishnan"], "2026", { journal: "Nat. Biotechnol.", volume: "44", pages: "312-324" }),
    bib("bio2025escape", "article", "Viral escape from single-guide CRISPR effectors: mechanisms and mitigation", ["M. Delgado"], "2025", { journal: "Cell Host Microbe", volume: "33", pages: "889-905" }),
    bib("bio2024struct", "article", "Cryo-EM structures of Cas13 in the pre-crRNA state", ["E. Nováková", "T. Oyelaran"], "2024", { journal: "Science", volume: "384", pages: "551-559" }),
  ],
  poster: [
    {
      slug: "problem",
      title: "The Escape Problem",
      pattern: "bullets",
      column: 1,
      content:
        "- Single-guide CRISPR antivirals select resistant variants within 4–6 passages \\cite{bio2025escape}\n- Escape maps show that a single mismatch in the seed region restores 60–90% of viral replication\n- Respiratory RNA viruses mutate at 10$^{-4}$ substitutions per site per replication cycle\n- **Goal:** an antiviral design that is robust to point mutation across the target genome",
    },
    {
      slug: "design",
      title: "Ensemble Design",
      pattern: "bullets-image",
      column: 1,
      figures: [{ url: FIG("pipeline-architecture"), caption: "Figure 1: Guide-ensemble design pipeline from structure prediction to pooled synthesis." }],
      content:
        "- Guides are ranked by predicted accessibility in the viral genome secondary structure \\cite{bio2024struct}\n- Ensembles of 4 guides target conserved stem regions with ≥ 2 mismatches to the human transcriptome\n- Pooled synthesis and lentiviral delivery in a single vector at MOI 0.3",
    },
    {
      slug: "knockdown",
      title: "Knockdown Efficiency",
      pattern: "image-focused",
      column: 1,
      figures: [{ url: FIG("knockdown-screen"), caption: "Figure 2: Viral RNA knockdown for individual guides and the four-guide ensemble; points are biological replicates." }],
      content: "The four-guide ensemble reaches 97% knockdown, compared with 62–94% for the best single guides.",
    },
    {
      slug: "dose",
      title: "Dose Response",
      pattern: "bullets-image",
      column: 2,
      figures: [{ url: FIG("dose-response"), caption: "Figure 3: Neutralisation curves for wild-type virus and two escape variants." }],
      content:
        "- EC$_{50}$ of the ensemble is 0.22 nM against wild type, a 5.2-fold improvement over the best single guide\n- The escape variant P22L shifts EC$_{50}$ only 1.4-fold under the ensemble, versus 8.1-fold under a single guide \\cite{bio2026cas13}",
    },
    {
      slug: "headline",
      title: "Headline Results",
      pattern: "stats",
      column: 2,
      content:
        "**97%** | viral RNA knockdown\n**0/48** | escape cultures at 25 passages\n**6.8 h** | design-to-synthesis cycle\n**0.22 nM** | EC₅₀ (wild type)",
    },
    {
      slug: "escape",
      title: "Escape Monitoring",
      pattern: "bullets-table",
      column: 2,
      table: {
        hasHeader: true,
        caption: "Table 1: Escape frequency after 25 serial passages.",
        rows: [
          ["Effector", "Cultures", "Escape mutations"],
          ["Single guide (g3)", "24", "9"],
          ["Two-guide pair", "24", "2"],
          ["Four-guide ensemble", "48", "0"],
        ],
      },
      content: "- Deep sequencing at 10$^5$× coverage found no fixed escape variant in the ensemble arm",
    },
    {
      slug: "qpcr",
      title: "Assay Performance",
      pattern: "bullets-table",
      column: 2,
      table: {
        hasHeader: true,
        caption: "Table 2: RT-qPCR efficiency per target, mean of three technical replicates.",
        rows: [
          ["Target", "Efficiency", "R²"],
          ["RdRp (gRNA-1 site)", "98.4%", "0.998"],
          ["N (gRNA-2 site)", "96.2%", "0.995"],
          ["ORF1ab (ensemble)", "99.1%", "0.999"],
        ],
      },
      content: "- Every quantification is against a five-point standard curve, so knockdown percentages are not relative-only",
    },
    {
      slug: "specificity",
      title: "Specificity",
      pattern: "bullets",
      column: 2,
      content:
        "- Predicted off-targets: 0 sites with ≤ 2 mismatches in the human transcriptome\n- RNA sequencing of treated A549 cells: 0 genes with differential expression beyond 1.4-fold\n- Collateral activity stays below 2% of the on-target signal at therapeutic dose \\cite{bio2026cas13}",
    },
    {
      slug: "mechanism",
      title: "Mechanism",
      pattern: "bullets",
      column: 3,
      content:
        "- Ensemble guides bind adjacent stem segments, so a single mismatch cannot release the complex\n- Cooperative binding raises the effective association rate 3.4-fold\n- Cleavage of one site does not require dissociation of the other three guides",
    },
    {
      slug: "next",
      title: "Next Steps",
      pattern: "bullets-image",
      column: 3,
      figures: [{ url: FIG("training-curves"), caption: "Figure 4: Fraction of cultures remaining escape-free versus passage number for three strategies." }],
      content:
        "- Aerosolised lipid-nanoparticle delivery is being tested in ferret models\n- The pipeline is being extended to influenza A and RSV with the same accessibility model",
    },
    {
      slug: "methods",
      title: "Methods",
      pattern: "bullets",
      column: 3,
      content:
        "- Viral RNA quantified by RT-qPCR against a standard curve (three technical replicates)\n- Escape selected by serial passage at MOI 0.01 for 25 rounds\n- Illumina 2×150 bp sequencing, variant calling at 3% allele frequency",
    },
    {
      slug: "ack",
      title: "Acknowledgements",
      pattern: "bullets",
      column: 3,
      content:
        "- Funded by the national antiviral programme AV-2026-08\n- Sequencing performed at the core genomics facility\n        - We thank the BSL-3 laboratory staff for passage support",
    },
    { slug: "references", title: "References", pattern: "references", column: 3, content: "" },
  ],
  roles: { problem: "problem", method: "design", result: "knockdown", conclusion: "next", section: "escape" },
  extras: {
    poster: {
      keyFinding: {
        slug: "keyfinding",
        title: "One Sentence",
        pattern: "stats",
        content:
          "**0/48** | escape cultures in 25 passages\n**97%** | viral RNA knockdown\n**0.22 nM** | EC₅₀ against wild type",
      },
      sideBySide: {
        slug: "glance",
        title: "Potency and Durability",
        pattern: "bullets-image",
        content:
          "- The ensemble keeps its advantage when the dose is halved, while single guides lose 40% of their effect\n- Escape-free cultures stay negative by RT-qPCR through passage 40",
        figures: [
          { url: FIG("knockdown-screen"), caption: "Knockdown per guide and for the ensemble." },
          { url: FIG("dose-response"), caption: "Neutralisation curves, wild type and escape variants." },
        ],
      },
      spare: {
        slug: "tolerability",
        title: "Delivery & Tolerability",
        pattern: "bullets-table",
        table: {
          hasHeader: true,
          caption: "Table 2: Viability and transduction efficiency by vector format.",
          rows: [
            ["Format", "Transduction", "Viability at 72 h"],
            ["Lentivirus, single guide", "78%", "94%"],
            ["Lentivirus, 4-guide cassette", "74%", "92%"],
            ["LNP, mRNA, 4 guides", "69%", "96%"],
          ],
        },
        content: "- The four-guide cassette costs 2 percentage points of viability relative to a single guide",
      },
      details: {
        slug: "assay",
        title: "Assay Details",
        pattern: "bullets",
        content:
          "- Viral RNA quantified by RT-qPCR against a five-point standard curve; efficiency 96.2–99.1%\n- All samples run in three technical replicates and two biological replicates\n- Passage performed at MOI 0.01 with a 72 h harvest interval\n- Deep sequencing at 10$^5$× coverage; variants called at a 3% allele-frequency threshold",
      },
    },
    slides: {
      statement: {
        slug: "statement",
        title: "The Claim",
        pattern: "two-column",
        content:
          "**Single guide**\nOne mismatch in the seed region restores replication. Escape in 9 of 24 cultures.\n\n**Ensemble**\nFour guides on adjacent stem segments. Escape in 0 of 48 cultures.",
        notes: "This is the whole argument in two lines — pause after the second row.",
      },
      summary: {
        slug: "summary",
        title: "One-Slide Summary",
        pattern: "stats",
        content: "**97%** | knockdown\n**0/48** | escape\n**0.22 nM** | EC₅₀\n**6.8 h** | design cycle",
        notes: "Close on delivery: the remaining barrier is aerosolised LNP formulation, not guide design.",
      },
    },
    paper: {
      implementation: {
        slug: "implementation",
        title: "Experimental Procedures",
        pattern: "section",
        content:
          "A549 cells were maintained in DMEM supplemented with 10% fetal bovine serum and passaged every three days. Guide cassettes were cloned into a lentiviral backbone under a U6 promoter and packaged at a titre of $4 \times 10^7$ TU/mL. Transduction was performed at a multiplicity of infection of 0.3, and puromycin selection started 48 h after transduction. Viral RNA was extracted at 72 h post-infection and quantified by RT-qPCR against a five-point standard curve with efficiencies between 96.2% and 99.1%. Escape was selected by serial passage at a multiplicity of infection of 0.01 for 25 rounds with a 72-hour harvest interval.",
      },
      limitations: {
        slug: "limitations",
        title: "Limitations",
        pattern: "section",
        content:
          "All escape measurements are in cell culture; the selective pressures of an intact respiratory tract, including interferon responses and mucus barriers, are not represented. The off-target analysis relies on predicted mismatches rather than an experimental target library, and collateral activity was measured with a reporter rather than transcriptome-wide. Delivery remains the open problem: the cassette fits a single lentiviral vector, but aerosolised lipid nanoparticles in a ferret model are still being characterised.",
      },
    },
  },
  slides: [
    { slug: "title", title: "Title", pattern: "title-slide", content: "", notes: "Frame the problem in one sentence: escape defeats single-guide antivirals." },
    {
      slug: "problem",
      title: "Why Single Guides Fail",
      pattern: "bullets",
      content:
        "- Escape variants appear within 4–6 passages under single-guide pressure \\cite{bio2025escape}\n- One seed-region mismatch restores 60–90% of replication\n- Respiratory viruses generate 10$^{-4}$ substitutions per site per cycle\n- **Design constraint:** robustness to point mutation, not maximum potency",
      notes: "The audience will ask about collateral activity — the specificity slide answers it.",
    },
    {
      slug: "pipeline",
      title: "Design Pipeline",
      pattern: "bullets-image",
      content: "- Structure-aware accessibility ranking\n- Four-guide ensembles over conserved stems\n- Pooled synthesis in one vector, 6.8 h cycle",
      figures: [{ url: FIG("pipeline-architecture"), caption: "From accessibility prediction to pooled synthesis." }],
      notes: "Stress that the ensemble is delivered as a single vector — no dosing complexity.",
    },
    {
      slug: "knockdown",
      title: "Knockdown",
      pattern: "graph",
      content: "The four-guide ensemble reaches 97% viral RNA knockdown versus 62–94% for individual guides.",
      figures: [{ url: FIG("knockdown-screen"), caption: "Knockdown per guide and for the ensemble (n = 4)." }],
    },
    {
      slug: "escape",
      title: "Escape at 25 Passages",
      pattern: "bullets-table",
      table: {
        hasHeader: true,
        caption: "Escape frequency by strategy.",
        rows: [
          ["Strategy", "Cultures", "Escape"],
          ["Single guide", "24", "9"],
          ["Two-guide pair", "24", "2"],
          ["Four-guide ensemble", "48", "0"],
        ],
      },
      content: "- No fixed escape variant detected by deep sequencing in the ensemble arm",
    },
    {
      slug: "specificity",
      title: "Specificity",
      pattern: "two-column",
      content:
        "**Predicted**\n- 0 off-target sites with ≤ 2 mismatches\n- 4 guides, each with ≥ 3 mismatch distance to the host transcriptome\n\n**Measured**\n- RNA-seq: no gene beyond 1.4-fold change\n- Collateral activity < 2% of on-target signal \\cite{bio2026cas13}",
      notes: "If asked for the raw RNA-seq numbers, they are in the supplementary table S3.",
    },
    {
      slug: "dose",
      title: "Dose Response",
      pattern: "graph",
      content: "EC₅₀ is 0.22 nM against wild type; the P22L escape variant shifts it only 1.4-fold under the ensemble.",
      figures: [{ url: FIG("dose-response"), caption: "Neutralisation curves, wild type and escape variants." }],
    },
    {
      slug: "headline",
      title: "Headline Numbers",
      pattern: "stats",
      content: "**97%** | knockdown\n**0/48** | escape cultures\n**6.8 h** | design cycle\n**0.22 nM** | EC₅₀",
    },
    {
      slug: "next",
      title: "Next Steps",
      pattern: "bullets",
      content:
        "- Aerosolised LNP delivery in ferrets (in progress)\n- Extension to influenza A and RSV\n- Multiplexed panels against conserved polymerase motifs",
    },
    { slug: "references", title: "References", pattern: "references", content: "" },
  ],
  paper: [
    {
      slug: "abstract",
      title: "Abstract",
      pattern: "section",
      content:
        "CRISPR-Cas13 effectors programmed with a single guide RNA suppress respiratory RNA viruses but select escape variants within a few passages. We show that escape is driven by seed-region mismatches that destabilise the guide–target duplex, and that this failure mode is removed when four guides are expressed as an ensemble from a single vector. The ensemble achieves 97% viral RNA knockdown in A549 cells, maintains an EC$_{50}$ of 0.22 nM against the wild type and 0.31 nM against the P22L escape variant, and produces no fixed escape mutations in 48 independent cultures passaged 25 times. Structure-aware guide ranking \\cite{bio2024struct} is what makes the ensemble compact enough to deliver in one vector.",
    },
    {
      slug: "introduction",
      title: "Introduction",
      pattern: "section",
      content:
        "Programmable nucleases have become a realistic antiviral strategy for RNA viruses, whose polymerases lack proofreading and therefore present a large mutational space \\cite{bio2025escape}. In practice, single-guide formats fail: a single mismatch in the seed region of the crRNA reduces cleavage efficiency enough for the variant to outgrow the population. Attempts to raise potency by targeting highly conserved motifs trade escape resistance for collateral cleavage of host transcripts \\cite{bio2026cas13}.\n\nWe take a different route. Instead of optimising one guide, we optimise a *set* of guides that bind adjacent segments of a conserved stem, so that destabilising any single duplex leaves the others bound. The resulting design problem is a covering problem over the viral secondary structure with a specificity constraint against the host transcriptome.",
    },
    {
      slug: "design",
      title: "Structure-Aware Ensemble Design",
      pattern: "section-figure",
      content:
        "Candidate guides are enumerated across the viral genome with a PAM-proximal seed of 12 nucleotides and scored by three terms: accessibility of the target site in the predicted secondary structure, conservation across 1 842 deposited isolates, and the minimum edit distance to any human transcript. Guides are then selected greedily so that every ranked site is covered by at least two guides; the final ensembles contain four guides and are synthesised as a single pooled cassette.",
      figures: [{ url: FIG("pipeline-architecture"), caption: "Guide-ensemble design pipeline: accessibility prediction, conservation filtering, specificity screening and pooled synthesis." }],
    },
    {
      slug: "results",
      title: "Knockdown and Escape",
      pattern: "section-two-figures",
      content:
        "The ensemble reduces viral RNA by 97% (Figure 2), compared with 62–94% for the best single guides in the same assay. Escape was measured by 25 serial passages at a multiplicity of infection of 0.01; nine of twenty-four single-guide cultures carried a fixed variant, two of twenty-four two-guide cultures did, and none of the forty-eight ensemble cultures did. Deep sequencing at 10$^5$× coverage found no variant exceeding 3% allele frequency in the ensemble arm.",
      figures: [
        { url: FIG("knockdown-screen"), caption: "Viral RNA knockdown for individual guides and the four-guide ensemble; points are biological replicates." },
        { url: FIG("dose-response"), caption: "Neutralisation curves for wild-type virus and two escape variants." },
      ],
    },
    {
      slug: "specificity",
      title: "Specificity",
      pattern: "section-table",
      content:
        "No gene showed a differential expression beyond 1.4-fold in treated A549 cells, and collateral cleavage accounted for less than 2% of the on-target signal at the therapeutic dose. The escape frequencies underlying these claims are summarised in Table 1.",
      table: {
        hasHeader: true,
        caption: "Escape frequency after 25 serial passages, by effector format.",
        rows: [
          ["Effector", "Cultures", "Escape mutations"],
          ["Single guide (g3)", "24", "9"],
          ["Two-guide pair", "24", "2"],
          ["Four-guide ensemble", "48", "0"],
        ],
      },
    },
    {
      slug: "discussion",
      title: "Discussion",
      pattern: "section",
      content:
        "The results support a simple design principle: escape resistance is a covering property, not a potency property. Because the four guides bind adjacent stem segments, a mismatch that weakens one duplex does not release the complex, and cooperative binding raises the effective association rate 3.4-fold. The remaining question is delivery: the cassette fits a single lentiviral vector at MOI 0.3, and aerosolised lipid nanoparticles are now being evaluated in ferrets, where the relevant barrier is deposition in the lower respiratory tract rather than cellular uptake.",
    },
    {
      slug: "conclusion",
      title: "Conclusions",
      pattern: "section",
      content:
        "Four-guide Cas13 ensembles eliminate detectable escape in 48 cultures over 25 passages while keeping collateral activity below 2% of the on-target signal. The design pipeline is structure-driven and therefore transferable: the same accessibility model is being applied to influenza A and respiratory syncytial virus, and to conserved polymerase motifs where single-guide designs are known to fail.",
    },
    { slug: "references", title: "References", pattern: "references", content: "" },
  ],
}

// ---------------------------------------------------------------------------
// Subject 3 — surgical robotics / VLA
// ---------------------------------------------------------------------------

const VLA: GallerySubject = {
  id: "vla",
  title: "SurgiVLA: A Safety-Constrained Vision-Language-Action Foundation Model for Sub-Millimetre Manipulation",
  authors: "D. Chen, R. Akgün, L. Petrova, W. Zhang, and the SurgiVLA Team",
  venue: {
    poster: "CVPR 2026 · Seattle",
    slides: "CVPR 2026 · Oral Session 3B, Robot Learning",
    paper: "IEEE Conference on Computer Vision and Pattern Recognition (CVPR) 2026",
  },
  bibEntries: [
    bib("vla2026vla", "inproceedings", "A vision-language-action foundation model for dexterous manipulation", ["D. Chen", "W. Zhang"], "2026", { booktitle: "CVPR" }),
    bib("vla2025cbf", "article", "Control barrier functions for safe learning-based control", ["R. Akgün", "L. Petrova"], "2025", { journal: "IEEE Trans. Robotics", volume: "41", pages: "778-795" }),
    bib("vla2024surge", "article", "Learning dexterous surgical subtasks from demonstration", ["L. Petrova"], "2024", { journal: "Sci. Robotics", volume: "9", pages: "eabq1234" }),
  ],
  poster: [
    {
      slug: "motivation",
      title: "Why Sub-Millimetre Is Different",
      pattern: "bullets",
      column: 1,
      content:
        "- Tissue deformation is not repeatable: 1 mm of tool deflection changes the visual field more than 10× the tool diameter\n- Error budgets are asymmetric — a 0.5 mm miss in simulation is a 0.5 mm miss on tissue, and the reverse is not true\n- Teleoperated systems recover from this with a human in the loop; autonomy cannot \\cite{vla2024surge}",
    },
    {
      slug: "architecture",
      title: "Model Architecture",
      pattern: "bullets-image",
      column: 1,
      figures: [{ url: FIG("pipeline-architecture"), caption: "Figure 1: SurgiVLA architecture with the control-barrier filter that gates every action before execution." }],
      content:
        "- Vision-language backbone: ViT-L/14 blocks fused with a 341 M-parameter language encoder \\cite{vla2026vla}\n- Latent dynamics head predicts the next 8 timesteps at 42 Hz for short-horizon lookahead\n- A control-barrier filter projects every proposed action onto the set of states with positive safety margin \\cite{vla2025cbf}",
    },
    {
      slug: "learning",
      title: "Learning Curves",
      pattern: "bullets-image",
      column: 1,
      figures: [{ url: FIG("training-curves"), caption: "Figure 2: Success rate versus environment steps for four policies; shaded bands are 95% confidence intervals over five seeds." }],
      content:
        "- 0.95 success rate after 300k steps, versus 0.74 for the strongest baseline\n- The constrained variant is 2.4× more sample-efficient to the 80% success threshold",
    },
    {
      slug: "latency",
      title: "Closed-Loop Latency",
      pattern: "image-focused",
      column: 2,
      figures: [{ url: FIG("latency-bars"), caption: "Figure 3: Per-stage p99 latency; the dashed line is the 20 ms control budget." }],
      content: "Decode is the dominant cost, and the only stage whose p99 exceeds the control budget in the monolithic baseline.",
    },
    {
      slug: "headline",
      title: "Headline Results",
      pattern: "stats",
      column: 2,
      content:
        "**98.7%** | task success (n = 1 200 trials)\n**0.31 mm** | median positional error\n**42 Hz** | closed-loop control rate\n**0/1 200** | safety violations",
    },
    {
      slug: "tasks",
      title: "Evaluation Suite",
      pattern: "bullets-table",
      column: 2,
      table: {
        hasHeader: true,
        caption: "Table 1: Success rate by surgical subtask (mean ± s.d. over five seeds).",
        rows: [
          ["Subtask", "Teleop", "BC baseline", "SurgiVLA"],
          ["Suture placement", "96.4%", "71.2 ± 3.1", "98.1 ± 0.6"],
          ["Vessel dissection", "94.8%", "64.5 ± 4.4", "97.9 ± 0.9"],
          ["Needle regrasp", "91.2%", "58.9 ± 5.2", "99.4 ± 0.4"],
          ["Tissue retraction", "97.1%", "76.8 ± 2.8", "99.2 ± 0.5"],
        ],
      },
      content: "- Each subtask is scored by an expert surgeon on a five-point task-specific checklist",
    },
    {
      slug: "ablation",
      title: "Ablation",
      pattern: "bullets-table",
      column: 2,
      table: {
        hasHeader: true,
        caption: "Table 2: Effect of removing each component.",
        rows: [
          ["Variant", "Success", "Violations"],
          ["Full model", "98.7%", "0"],
          ["− safety filter", "97.9%", "31"],
          ["− latent dynamics", "94.2%", "8"],
          ["− language encoder", "89.6%", "5"],
        ],
      },
      content: "- The safety filter is not a performance cost: it is what makes the failure mode a stop rather than a cut",
    },
    {
      slug: "safety",
      title: "Safety Envelope",
      pattern: "bullets",
      column: 3,
      content:
        "- Barrier function learned from 4.2 M demonstrations plus 180k synthetic constraint samples\n- Interventions logged in 0.7% of steps; every intervention stops the tool, never redirects it\n- Force limits enforced in hardware as the final arbitration layer",
    },
    {
      slug: "generalisation",
      title: "Generalisation",
      pattern: "bullets-image",
      column: 3,
      figures: [{ url: FIG("knockdown-screen"), caption: "Figure 4: Success on unseen phantom tissues and unseen lighting conditions." }],
      content:
        "- 94.1% success on phantoms from a different manufacturer\n- 92.6% under lighting conditions absent from training\n- Degradation is graceful: failures are aborted grasps, not slips",
    },
    {
      slug: "conclusion",
      title: "Conclusions",
      pattern: "bullets",
      column: 3,
      content:
        "- A VLA policy can reach 98.7% success on sub-millimetre manipulation without a human in the loop, provided every action passes a control-barrier filter\n- Safety filtering costs 0.8 percentage points of success and removes all 31 violations of the unfiltered model\n- Next: cadaveric evaluation and integration with a da Vinci research kit",
    },
    {
      slug: "ack",
      title: "Acknowledgements",
      pattern: "bullets",
      column: 3,
      content:
        "- We thank the surgical skills laboratory for access to the phantom suite\n- Compute provided by the university cluster (48 A100-hours)\n- Demo data collected under ethics approval 2026-114",
    },
    { slug: "references", title: "References", pattern: "references", column: 3, content: "" },
  ],
  roles: { problem: "motivation", method: "architecture", result: "latency", conclusion: "conclusion", section: "tasks" },
  extras: {
    poster: {
      keyFinding: {
        slug: "keyfinding",
        title: "One Number That Matters",
        pattern: "stats",
        content:
          "**98.7%** | task success, 1 200 trials\n**0.31 mm** | median positional error\n**0/1 200** | safety violations",
      },
      sideBySide: {
        slug: "glance",
        title: "Accuracy and Safety, Together",
        pattern: "bullets-image",
        content:
          "- The filter changes 0.7% of actions and costs 0.8 pp of success\n- Unfiltered, the same policy produces 31 violations in the same trial set",
        figures: [
          { url: FIG("training-curves"), caption: "Success rate versus environment steps for four policies." },
          { url: FIG("latency-bars"), caption: "Per-stage p99 latency against the control budget." },
        ],
      },
      spare: {
        slug: "failures",
        title: "Failure Taxonomy",
        pattern: "bullets-table",
        table: {
          hasHeader: true,
          caption: "Table 3: All 16 failures in the 1 200-trial suite, by category.",
          rows: [
            ["Category", "Count", "Recovery"],
            ["Grasp slip", "9", "Re-attempted, 7 succeeded"],
            ["Visibility loss", "4", "Procedure paused"],
            ["Force limit", "3", "Procedure paused"],
          ],
        },
        content: "- No failure mode involved tissue contact outside the annotated safe region",
      },
      details: {
        slug: "training",
        title: "Training & Data",
        pattern: "bullets",
        content:
          "- 4.2 M demonstrations from a da Vinci research kit plus 180k synthetic constraint samples\n- 48 A100-hours of training; the barrier head is trained last, on frozen policy features\n- Domain randomisation over lighting, tissue colour and camera pose\n- Actions normalised per joint with a 1 kHz reference trajectory as the target",
      },
    },
    slides: {
      statement: {
        slug: "statement",
        title: "The Claim",
        pattern: "two-column",
        content:
          "**Accuracy alone**\nA 0.5 mm miss is unrecoverable, and the unfiltered policy produced 31 violations.\n\n**Filtered policy**\nEvery action is projected onto the safe set: 98.7% success, 0 violations.",
        notes: "Be explicit that the filter is not a monitor that stops the robot — it reshapes the action.",
      },
      summary: {
        slug: "summary",
        title: "One-Slide Summary",
        pattern: "stats",
        content: "**98.7%** | success\n**0.31 mm** | median error\n**42 Hz** | control rate\n**0** | violations",
        notes: "Leave this up for questions; the cadaveric study is the honest answer to 'does it transfer'.",
      },
    },
    paper: {
      implementation: {
        slug: "implementation",
        title: "Implementation",
        pattern: "section",
        content:
          "The policy is trained in three stages: a vision-language encoder pre-trained on 1.1 M image-text pairs, a latent dynamics head trained with an evidence lower bound on 4.2 M demonstrations, and an action decoder fine-tuned with the barrier head frozen. The quadratic program inside the filter is solved with a projected-gradient method (12 iterations, 0.4 ms) on the same GPU that runs the policy, so the whole loop fits inside the 20 ms control budget. Demonstrations were collected with a da Vinci research kit at 1 kHz and downsampled to the control rate of 42 Hz.",
      },
      limitations: {
        slug: "limitations",
        title: "Limitations",
        pattern: "section",
        content:
          "All reported results are on phantoms. Success drops to 92.6% under lighting conditions absent from training and to 94.1% on phantoms from a different manufacturer, and we have not demonstrated transfer to cadaveric or porcine tissue. The barrier certificate is learned from demonstrations rather than derived analytically, so its validity is empirical: 0 violations in 1 200 trials bounds the violation rate at 0.25% with 95% confidence, which is not the same as a proof.",
      },
    },
  },
  slides: [
    { slug: "title", title: "Title", pattern: "title-slide", content: "", notes: "One sentence: autonomy at sub-millimetre scale needs a safety argument, not just a success number." },
    {
      slug: "problem",
      title: "The Problem",
      pattern: "bullets",
      content:
        "- Tissue deformation makes the visual field non-repeatable\n- Error budgets are asymmetric: a miss is not recoverable\n- Teleoperation recovers with a human in the loop; autonomy cannot \\cite{vla2024surge}",
      notes: "Use the vessel-dissection video (supplementary) here if time allows.",
    },
    {
      slug: "architecture",
      title: "Architecture",
      pattern: "bullets-image",
      content: "- Vision-language backbone, 42 Hz\n- Latent dynamics lookahead, 8 steps\n- Control-barrier filter gates every action",
      figures: [{ url: FIG("pipeline-architecture"), caption: "SurgiVLA with the control-barrier filter." }],
    },
    {
      slug: "results",
      title: "Results",
      pattern: "graph",
      content: "98.7% success at 300k steps, against 74% for the strongest baseline.",
      figures: [{ url: FIG("training-curves"), caption: "Success rate versus environment steps." }],
    },
    {
      slug: "latency",
      title: "Latency Budget",
      pattern: "graph",
      content: "Decode dominates the budget; speculative scheduling brings the p99 from 48.5 ms to 9.7 ms.",
      figures: [{ url: FIG("latency-bars"), caption: "Per-stage p99 latency against the 20 ms control budget." }],
    },
    {
      slug: "tasks",
      title: "Subtask Results",
      pattern: "bullets-table",
      table: {
        hasHeader: true,
        caption: "Success rate by subtask.",
        rows: [
          ["Subtask", "BC", "SurgiVLA"],
          ["Suture placement", "71.2%", "98.1%"],
          ["Vessel dissection", "64.5%", "97.9%"],
          ["Needle regrasp", "58.9%", "99.4%"],
          ["Tissue retraction", "76.8%", "99.2%"],
        ],
      },
      content: "- Scored by an expert surgeon on task-specific checklists",
    },
    {
      slug: "ablation",
      title: "Ablation",
      pattern: "two-column",
      content:
        "**Removing the filter**\n- Success 97.9% (−0.8 pp)\n- Violations 31 (from 0)\n\n**Removing latent dynamics**\n- Success 94.2% (−4.5 pp)\n- Violations 8",
      notes: "The takeaway: safety filtering is nearly free, and the unfiltered model still fails.",
    },
    {
      slug: "numbers",
      title: "Headline Numbers",
      pattern: "stats",
      content: "**98.7%** | success\n**0.31 mm** | median error\n**42 Hz** | control rate\n**0/1 200** | violations",
    },
    {
      slug: "next",
      title: "Next Steps",
      pattern: "bullets",
      content: "- Cadaveric evaluation in Q3\n- Integration with a da Vinci research kit\n- Extending the barrier certificate to multi-arm coordination",
    },
    { slug: "references", title: "References", pattern: "references", content: "" },
  ],
  paper: [
    {
      slug: "abstract",
      title: "Abstract",
      pattern: "section",
      content:
        "Sub-millimetre manipulation on deformable tissue requires policies that are not merely accurate but provably conservative. We introduce SurgiVLA, a vision-language-action model whose every action is projected onto the set of states with a positive control-barrier margin before it reaches the actuators. The policy is trained on 4.2 M demonstrations and a latent dynamics head predicts eight future timesteps at 42 Hz. Across four surgical subtasks the model reaches 98.7% success, a median positional error of 0.31 mm, and no safety violations in 1 200 trials; removing the barrier filter retains 97.9% success but produces 31 violations.",
    },
    {
      slug: "introduction",
      title: "Introduction",
      pattern: "section",
      content:
        "Learning-based manipulation has reached the accuracy required for surgical subtasks in laboratory settings \\cite{vla2024surge}, but accuracy is not the binding constraint in the operating theatre: the constraint is that no action may leave the safe set. Teleoperated platforms satisfy it with a human in the loop; an autonomous policy must satisfy it by construction. Existing safety layers either shape the reward during training, which offers no guarantee at deployment, or apply an external monitor that stops the robot, which converts a near-miss into a stalled procedure.\n\nThis paper takes a control-theoretic route: the policy proposes, and a control-barrier filter disposes. The filter is differentiable, evaluated at 42 Hz on the same latent state the policy uses, and learned from demonstrations augmented with synthetic constraint violations.",
    },
    {
      slug: "architecture",
      title: "Model and Safety Filter",
      pattern: "section-figure",
      content:
        "SurgiVLA fuses three input streams — endoscopic video, a language instruction, and proprioceptive state — through cross-attention over eight heads. A GRU-based latent dynamics head predicts the next eight states and is trained jointly with the action decoder under an evidence lower bound. The control-barrier filter solves a small quadratic program at every control step, minimising the deviation from the proposed action subject to the discrete-time barrier condition $h(z_{t+1}) - h(z_t) + \\alpha h(z_t) \\geq 0$, with $h$ the learned safety margin.",
      figures: [{ url: FIG("pipeline-architecture"), caption: "SurgiVLA architecture: modality encoders, cross-attention fusion, latent dynamics, and the control-barrier filter that gates every action." }],
    },
    {
      slug: "experiments",
      title: "Experiments",
      pattern: "section-table",
      content:
        "We evaluate on four surgical subtasks with 1 200 trials in total, scored by an expert surgeon on task-specific five-point checklists. Baselines are behaviour cloning with the same backbone, the unconstrained variant of our model, and teleoperation as an upper reference. Table 1 reports success rates; Figure 2 reports the learning curves.",
      table: {
        hasHeader: true,
        caption: "Success rate by surgical subtask; uncertainty is one standard deviation over five seeds.",
        rows: [
          ["Subtask", "Teleop", "BC baseline", "SurgiVLA"],
          ["Suture placement", "96.4%", "71.2 ± 3.1", "98.1 ± 0.6"],
          ["Vessel dissection", "94.8%", "64.5 ± 4.4", "97.9 ± 0.9"],
          ["Needle regrasp", "91.2%", "58.9 ± 5.2", "99.4 ± 0.4"],
          ["Tissue retraction", "97.1%", "76.8 ± 2.8", "99.2 ± 0.5"],
        ],
      },
    },
    {
      slug: "results",
      title: "Results and Ablations",
      pattern: "section-two-figures",
      content:
        "The full model reaches 98.7% mean success and a median positional error of 0.31 mm, and records no safety violations. Removing the barrier filter costs 0.8 percentage points of success but produces 31 violations, all of them tool-to-tissue contacts outside the annotated safe region. Removing the latent dynamics head costs 4.5 percentage points, and removing the language encoder 9.1. Latency analysis shows decode is the only stage whose p99 exceeds the 20 ms control budget in the monolithic baseline.",
      figures: [
        { url: FIG("training-curves"), caption: "Success rate versus environment steps for four policies; shaded bands are 95% confidence intervals over five seeds." },
        { url: FIG("latency-bars"), caption: "Per-stage p99 latency; the dashed line is the control budget." },
      ],
    },
    {
      slug: "discussion",
      title: "Discussion",
      pattern: "section",
      content:
        "The central empirical finding is that safety filtering is close to free: the barrier projection changes 0.7% of actions and costs 0.8 percentage points of success, while eliminating every violation of the unfiltered policy. That asymmetry argues for treating the filter as part of the model rather than as an external monitor. The remaining limitation is generalisation to tissue types absent from training: success drops to 92.6% under unseen lighting and 94.1% on phantoms from a different manufacturer, and we have not yet demonstrated transfer to cadaveric tissue.",
    },
    {
      slug: "conclusion",
      title: "Conclusions",
      pattern: "section",
      content:
        "SurgiVLA demonstrates that sub-millimetre manipulation can be both accurate and conservative when the policy is paired with a control-barrier filter evaluated in the same latent space. Future work covers cadaveric evaluation, multi-arm coordination with a shared barrier certificate, and integration with an existing teleoperation platform so that human takeover remains available at all times.",
    },
    { slug: "references", title: "References", pattern: "references", content: "" },
  ],
}

// ---------------------------------------------------------------------------
// Subject 4 — inference acceleration
// ---------------------------------------------------------------------------

const NLP: GallerySubject = {
  id: "nlp",
  title: "Speculative Decoding with Provable Latency Guarantees",
  authors: "S. Bhattacharya, Y. Kimura, F. Osei, N. Andersen",
  venue: {
    poster: "NeurIPS 2026 · Vancouver",
    slides: "NeurIPS 2026 · Poster Session 2, Efficient Inference",
    paper: "Advances in Neural Information Processing Systems 39 (NeurIPS 2026)",
  },
  bibEntries: [
    bib("nlp2026spec", "inproceedings", "Speculative decoding with adaptive draft lengths", ["S. Bhattacharya", "Y. Kimura"], "2026", { booktitle: "NeurIPS" }),
    bib("nlp2025serving", "article", "Serving tradeoffs in large language model inference", ["F. Osei"], "2025", { journal: "Proc. MLSys", volume: "7", pages: "221-238" }),
    bib("nlp2024martingale", "article", "Martingale methods for sequential decision under uncertainty", ["N. Andersen"], "2024", { journal: "Ann. Appl. Probab.", volume: "34", pages: "1102-1140" }),
  ],
  poster: [
    {
      slug: "setting",
      title: "Problem Setting",
      pattern: "bullets",
      column: 1,
      content:
        "- Speculative decoding accelerates autoregressive generation by verifying draft tokens in parallel \\cite{nlp2026spec}\n- Reported speedups are averages: tail latency at p99 is what determines whether a serving SLA is met\n- Nothing in the existing analysis bounds the *worst case* of an acceptance tree \\cite{nlp2025serving}",
    },
    {
      slug: "method",
      title: "Martingale-Bounded Acceptance",
      pattern: "bullets-image",
      column: 1,
      figures: [{ url: FIG("training-curves"), caption: "Figure 1: Acceptance rate versus draft length for three draft models, with the martingale bound overlaid." }],
      content:
        "- We model acceptance along a draft tree as a bounded-difference martingale \\cite{nlp2024martingale}\n- The bound yields a per-step acceptance guarantee, which converts into a p99 latency guarantee for the whole request\n- Draft depth is then chosen adaptively: deeper when the bound is tight, shallower when it is loose",
    },
    {
      slug: "latency",
      title: "Latency Breakdown",
      pattern: "image-focused",
      column: 1,
      figures: [{ url: FIG("latency-bars"), caption: "Figure 2: Per-stage p99 latency for three serving configurations; only the speculative pipeline keeps every stage inside the 20 ms budget." }],
      content: "Scheduler overhead falls by 55% because the adaptive depth stops pre-scheduling work that the verifier will reject.",
    },
    {
      slug: "headline",
      title: "Headline Results",
      pattern: "stats",
      column: 2,
      content:
        "**3.42×** | median speedup (lossless)\n**1.98×** | guaranteed speedup at p99\n**0.0%** | output distribution drift\n**18.2 ms** | p99 token latency",
    },
    {
      slug: "equivalence",
      title: "Exactness",
      pattern: "bullets",
      column: 2,
      content:
        "- The verifier accepts a draft token only when a uniform draw falls below the ratio of target to draft probability\n        - Output distribution is identical to the target model — verified by a two-sample test on 10$^6$ continuations ($p = 0.41$)\n- The latency bound does not require any change to the sampling procedure",
    },
    {
      slug: "benchmarks",
      title: "Benchmarks",
      pattern: "bullets-table",
      column: 2,
      table: {
        hasHeader: true,
        caption: "Table 1: Speedup versus the target-only baseline (greedy decoding, batch 8).",
        rows: [
          ["Workload", "Fixed depth 4", "Adaptive depth", "p99 bound"],
          ["Summarisation", "2.31×", "3.42×", "1.98×"],
          ["Code completion", "1.94×", "2.87×", "1.71×"],
          ["Translation", "2.12×", "3.04×", "1.88×"],
          ["Chat (short)", "1.48×", "2.11×", "1.42×"],
        ],
      },
      content: "- All numbers are on an 8×A100 node with a 70 B target and a 7 B draft model",
    },
    {
      slug: "tail",
      title: "Tail Behaviour",
      pattern: "bullets-image",
      column: 2,
      figures: [{ url: FIG("mass-spectrum"), caption: "Figure 3: Distribution of per-request speedups; the left tail is what the martingale bound controls." }],
      content:
        "- Fixed-depth speculation has a heavier left tail than the target-only baseline under load\n- Adaptive depth truncates the left tail at 1.98×, which is the quantity an SLA can be written against",
    },
    {
      slug: "theory",
      title: "The Bound",
      pattern: "bullets",
      column: 3,
      content:
        "- Acceptance along a draft path is a martingale with bounded increments $|X_k - X_{k-1}| \\leq 1$\n- Hoeffding–Azuma then gives $P(\\text{accepted} < k) \\leq \\exp(-2k^2/n)$ for a path of length $n$\n- Inverting the inequality gives the minimum draft depth needed for a target tail probability\n- The bound is tight to within 6% on all four workloads",
    },
    {
      slug: "practical",
      title: "Practical Notes",
      pattern: "bullets",
      column: 3,
      content:
        "- The draft model is trained with the same tokeniser; no retraining of the target is required\n- Batch size above 16 makes verification the bottleneck; above that, cap the depth at 3\n- The bound needs only per-step acceptance counts, so it can be estimated online",
    },
    {
      slug: "conclusion",
      title: "Conclusions",
      pattern: "bullets",
      column: 3,
      content:
        "- Speculative decoding can be given a p99 latency guarantee rather than an average speedup\n- Adaptive depth converts a 2.5× average win into a 1.98× guaranteed win\n- The guarantee is lossless: the output distribution is unchanged",
    },
    { slug: "references", title: "References", pattern: "references", column: 3, content: "" },
  ],
  roles: { problem: "setting", method: "method", result: "latency", conclusion: "conclusion", section: "benchmarks" },
  extras: {
    poster: {
      keyFinding: {
        slug: "keyfinding",
        title: "The Guarantee",
        pattern: "stats",
        content:
          "**3.42×** | median speedup, lossless\n**1.98×** | guaranteed at p99\n**0.0%** | distribution drift",
      },
      sideBySide: {
        slug: "glance",
        title: "Bound Meets Measurement",
        pattern: "bullets-image",
        content:
          "- The bound is within 6% of the measured acceptance on all four workloads\n- Adaptive depth keeps the p99 token latency at 18.2 ms against a 20 ms budget",
        figures: [
          { url: FIG("training-curves"), caption: "Acceptance rate versus draft length with the martingale bound." },
          { url: FIG("latency-bars"), caption: "Per-stage p99 latency for three serving configurations." },
        ],
      },
      spare: {
        slug: "boundcheck",
        title: "Bound vs. Measurement",
        pattern: "bullets-table",
        table: {
          hasHeader: true,
          caption: "Table 2: Predicted versus measured acceptance at the scheduled depth.",
          rows: [
            ["Workload", "Bound", "Measured", "Gap"],
            ["Summarisation", "0.71", "0.76", "6.6%"],
            ["Code completion", "0.64", "0.67", "4.5%"],
            ["Translation", "0.68", "0.72", "5.6%"],
            ["Chat (short)", "0.55", "0.58", "5.2%"],
          ],
        },
        content: "- The bound is conservative on every workload, which is the useful direction for an SLA",
      },
      details: {
        slug: "system",
        title: "Systems View",
        pattern: "bullets",
        content:
          "- 70 B target, 7 B draft, batch 8, eight A100 GPUs, tensor-parallel across four devices\n- Depth is re-estimated every step from a running acceptance average (window 64)\n- Above batch 16 verification saturates and the scheduler converges to depth 3 on its own\n- No change to the tokeniser; the draft model shares the target's vocabulary",
      },
    },
    slides: {
      statement: {
        slug: "statement",
        title: "The Claim",
        pattern: "two-column",
        content:
          "**Average speedup**\nReported as 2.5×, but the p99 can be *slower* than no speculation at all.\n\n**Guaranteed speedup**\nChoose the draft depth from a concentration bound: 1.98× at p99, never slower.",
        notes: "Mention that the bound is conservative in the direction an SLA needs.",
      },
      summary: {
        slug: "summary",
        title: "One-Slide Summary",
        pattern: "stats",
        content: "**3.42×** | median\n**1.98×** | p99 guarantee\n**18.2 ms** | p99 latency\n**0%** | drift",
        notes: "End on losslessness — no distribution drift is what makes this deployable without a quality audit.",
      },
    },
    paper: {
      implementation: {
        slug: "implementation",
        title: "Implementation",
        pattern: "section",
        content:
          "The serving prototype is built on a standard continuous-batching engine with two modifications: the draft tree is truncated per step from the scheduler's depth decision, and the verifier reads acceptance counters from the previous step to update the running estimate. The 70 B target model runs tensor-parallel across four A100 GPUs at bfloat16 precision, and the 7 B draft model runs on the remaining four. Depth is re-estimated every step from an exponentially weighted acceptance average with a window of 64 steps, which adds 0.03 ms per step.",
      },
      limitations: {
        slug: "limitations",
        title: "Limitations",
        pattern: "section",
        content:
          "The bound assumes that acceptance events along a draft path are independent, which holds under the verification rule but not when several requests in a batch share a prefix, so the guarantee is conservative in that regime. All experiments use greedy decoding at a fixed batch size; sampling with temperature and batch-size changes under load are left to future work. Finally, the draft model must share the target's tokeniser, which excludes cross-tokeniser draft models entirely.",
      },
    },
  },
  slides: [
    { slug: "title", title: "Title", pattern: "title-slide", content: "", notes: "Lead with the SLA angle: averages do not win contracts, p99 does." },
    {
      slug: "motivation",
      title: "Why Tail Latency",
      pattern: "bullets",
      content:
        "- Speculative decoding is reported as an average speedup \\cite{nlp2026spec}\n- Serving SLAs are written on p99\n- Under load, fixed-depth speculation can be *slower* than the baseline in the tail\n- **Contribution:** a martingale bound on acceptance that turns into a latency guarantee",
    },
    {
      slug: "method",
      title: "Method",
      pattern: "two-column",
      content:
        "**Model**\n- Acceptance along a draft path is a bounded-difference martingale\n- Hoeffding–Azuma bounds the acceptance count\n- Invert the bound for the minimum safe depth\n\n**System**\n- Depth is chosen per step from the estimated acceptance rate\n- Verification is unchanged\n- No retraining of the target model",
      notes: "The equations are on the poster; keep this slide conceptual.",
    },
    {
      slug: "results",
      title: "Speedup",
      pattern: "bullets-table",
      table: {
        hasHeader: true,
        caption: "Speedup by workload.",
        rows: [
          ["Workload", "Fixed depth", "Adaptive"],
          ["Summarisation", "2.31×", "3.42×"],
          ["Code completion", "1.94×", "2.87×"],
          ["Translation", "2.12×", "3.04×"],
          ["Chat (short)", "1.48×", "2.11×"],
        ],
      },
      content: "- 70 B target, 7 B draft, batch 8, 8×A100",
    },
    {
      slug: "acceptance",
      title: "Acceptance vs. Draft Length",
      pattern: "graph",
      content: "The martingale bound tracks measured acceptance within 6% and turns it into a depth decision.",
      figures: [{ url: FIG("training-curves"), caption: "Acceptance rate versus draft length for three draft models, with the bound overlaid." }],
      notes: "The point of the figure is the gap between the bound and the measurement — it is conservative, which is what an SLA needs.",
    },
    {
      slug: "latency",
      title: "Latency Stages",
      pattern: "graph",
      content: "Only the speculative pipeline keeps every stage inside the 20 ms control budget at p99.",
      figures: [{ url: FIG("latency-bars"), caption: "Per-stage p99 latency for three serving configurations." }],
    },
    {
      slug: "tail",
      title: "Tail Distribution",
      pattern: "graph",
      content: "Adaptive depth truncates the left tail of the per-request speedup distribution at 1.98×.",
      figures: [{ url: FIG("mass-spectrum"), caption: "Distribution of per-request speedups." }],
    },
    {
      slug: "exactness",
      title: "Losslessness",
      pattern: "bullets",
      content:
        "- Acceptance rule is the modified rejection sampler of the target distribution\n- Two-sample test on 10$^6$ continuations: $p = 0.41$\n- No change to the sampling procedure or the tokeniser",
      notes: "This is the slide people check — be precise that the test is on distributional equivalence, not on logits.",
    },
    {
      slug: "numbers",
      title: "Headline Numbers",
      pattern: "stats",
      content: "**3.42×** | median\n**1.98×** | p99 guarantee\n**18.2 ms** | p99 token latency\n**0%** | drift",
    },
    {
      slug: "conclusion",
      title: "Conclusions",
      pattern: "bullets",
      content: "- Latency, not throughput, is the deployable quantity\n- Adaptive depth is what makes the guarantee tight\n- Bound is within 6% of measured acceptance on four workloads",
    },
    { slug: "references", title: "References", pattern: "references", content: "" },
  ],
  paper: [
    {
      slug: "abstract",
      title: "Abstract",
      pattern: "section",
      content:
        "Speculative decoding accelerates autoregressive generation by proposing several tokens with a cheap draft model and verifying them in parallel with the target model. Reported speedups are averages over the request stream, whereas serving systems are governed by tail latency. We model acceptance along a draft path as a bounded-difference martingale and invert the resulting concentration inequality to obtain the minimum draft depth that guarantees a target acceptance probability. The resulting scheduler chooses the depth per step and delivers a 3.42× median speedup with a 1.98× guarantee at the 99th percentile, without altering the output distribution.",
    },
    {
      slug: "introduction",
      title: "Introduction",
      pattern: "section",
      content:
        "Speculative decoding has become the default acceleration technique for autoregressive inference \\cite{nlp2026spec}, and its analysis is usually reported as an average speedup over a benchmark stream. That metric is not what a serving system is operated against: admission control, batch composition and autoscaling all depend on tail latency, and the tail is precisely where fixed-depth speculation behaves worst \\cite{nlp2025serving}. When acceptance is low, the draft work is wasted and the verifier sees a batch that is smaller than the one it was scheduled for.\n\nWe treat acceptance as a stochastic process rather than a rate. Along any draft path, the cumulative number of accepted tokens is a martingale with increments bounded by one, which makes Hoeffding–Azuma applicable \\cite{nlp2024martingale}. Inverting the bound gives the draft depth required to keep the probability of a short acceptance below a chosen threshold.",
    },
    {
      slug: "method",
      title: "Martingale Bound and Scheduler",
      pattern: "section-figure",
      content:
        "Let $X_k$ denote the excess of accepted tokens over rejected ones after $k$ draft positions. Under the standard speculative sampling rule, $X_k$ is a martingale with increments in $[-1, 1]$, so Hoeffding–Azuma gives $\\Pr[X_n \\leq -t] \\leq \\exp(-t^2 / 2n)$. Requiring this to fall below a target tail probability $\\delta$ and solving for the depth $n$ yields the smallest draft length whose acceptance is guaranteed with probability $1 - \\delta$; the scheduler evaluates this expression once per step using an online estimate of the acceptance rate and truncates the draft tree accordingly. Verification itself is untouched, so the output distribution is unchanged by construction.",
      figures: [
        {
          url: FIG("training-curves"),
          caption: "Measured acceptance rate versus scheduled draft depth, with the martingale bound that the scheduler inverts.",
        },
      ],
    },
    {
      slug: "results",
      title: "Results",
      pattern: "section-table",
      content:
        "We evaluate on four workloads with a 70 B target model and a 7 B draft model on an eight-GPU node. Table 1 reports the speedup of fixed-depth speculation and of the adaptive scheduler alongside the guaranteed speedup at the 99th percentile. The adaptive scheduler is never slower than the baseline in the tail, whereas fixed depth falls behind on the chat workload, where acceptance is lowest.",
      table: {
        hasHeader: true,
        caption: "Speedup over the target-only baseline by workload (greedy decoding, batch size 8).",
        rows: [
          ["Workload", "Fixed depth 4", "Adaptive depth", "p99 guarantee"],
          ["Summarisation", "2.31×", "3.42×", "1.98×"],
          ["Code completion", "1.94×", "2.87×", "1.71×"],
          ["Translation", "2.12×", "3.04×", "1.88×"],
          ["Chat (short)", "1.48×", "2.11×", "1.42×"],
        ],
      },
    },
    {
      slug: "analysis",
      title: "Tail Analysis",
      pattern: "section-figure",
      content:
        "Figure 2 shows the distribution of per-request speedups. The left tail is the quantity the bound controls: with a fixed depth the slowest percentile of requests is slower than the non-speculative baseline, because rejected drafts still consume verifier capacity. With adaptive depth the left tail is truncated at the guaranteed speedup, and the theoretical bound is within 6% of the measured acceptance on all four workloads.",
      figures: [{ url: FIG("mass-spectrum"), caption: "Distribution of per-request speedups; the adaptive scheduler removes the slow left tail." }],
    },
    {
      slug: "discussion",
      title: "Discussion",
      pattern: "section",
      content:
        "Two practical consequences follow. First, the bound needs only per-step acceptance counts, so it can be estimated online without a calibration set. Second, the guarantee degrades gracefully with batch size: above a batch of sixteen, verification becomes the bottleneck and the optimal depth saturates at three, which the scheduler discovers on its own because the estimated acceptance rate falls. The main limitation is that the bound assumes independence across positions within a path, which holds under the verification rule but not when the same draft model is reused across a batch with shared prefixes.",
    },
    {
      slug: "conclusion",
      title: "Conclusions",
      pattern: "section",
      content:
        "Speculative decoding can be given a distributional guarantee that is useful for serving: a guaranteed speedup at a chosen tail probability, achieved by choosing the draft depth adaptively from a martingale concentration bound. On four workloads the scheduler delivers a 3.42× median speedup and a 1.98× guarantee at the 99th percentile, with no change to the output distribution and no retraining of either model.",
    },
    { slug: "references", title: "References", pattern: "references", content: "" },
  ],
}

export const GALLERY_SUBJECTS: GallerySubject[] = [HEP, BIO, VLA, NLP]

// ---------------------------------------------------------------------------
// Editions — how a template's gallery is assembled from a subject's pools
// ---------------------------------------------------------------------------

/**
 * Which subject each template shows, and in which edition. The mapping is
 * explicit rather than formulaic because it encodes editorial intent: an ATLAS
 * board shows a detector result, the ML venues show ML work, and no two
 * templates with the same subject use the same edition (asserted by
 * `lib/__tests__/template-gallery.test.ts`).
 */
type PosterEdition = "classic" | "dense" | "wide" | "hero"
type SlidesEdition = "classic" | "statement" | "editorial"
type PaperEdition =
  | "twocol-full"
  | "twocol-compact"
  | "singlecol"
  | "singlecol-compact"
  | "proceedings"
  | "proceedings-compact"
  | "proceedings-extended"

const POSTER_ASSIGNMENT: Record<string, { subject: GallerySubject["id"]; edition: PosterEdition }> = {
  atlas: { subject: "hep", edition: "classic" },
  conference: { subject: "bio", edition: "classic" },
  minimal: { subject: "nlp", edition: "classic" },
  gemini: { subject: "vla", edition: "classic" },
  tikzposter: { subject: "hep", edition: "dense" },
  landscape: { subject: "bio", edition: "wide" },
  betterposter: { subject: "nlp", edition: "hero" },
  aurora: { subject: "vla", edition: "dense" },
  a0poster: { subject: "bio", edition: "dense" },
}

const SLIDES_ASSIGNMENT: Record<string, { subject: GallerySubject["id"]; edition: SlidesEdition }> = {
  // Metropolis carries the VLA subject so that the flagship demo project
  // (gemini poster + metropolis deck + article-twocol paper) tells *one* story:
  // a project's outputs share a title, authors and venue, so they must not be
  // three unrelated studies.
  "beamer-metropolis": { subject: "vla", edition: "classic" },
  "beamer-atlas": { subject: "hep", edition: "classic" },
  "beamer-madrid": { subject: "bio", edition: "classic" },
  "beamer-default": { subject: "nlp", edition: "classic" },
  "beamer-focus": { subject: "nlp", edition: "statement" },
  "beamer-editorial": { subject: "bio", edition: "editorial" },
}

const PAPER_ASSIGNMENT: Record<string, { subject: GallerySubject["id"]; edition: PaperEdition }> = {
  "article-twocol": { subject: "vla", edition: "twocol-full" },
  "article-single": { subject: "vla", edition: "singlecol" },
  "ieee-conf": { subject: "vla", edition: "twocol-compact" },
  "acm-sigconf": { subject: "nlp", edition: "twocol-full" },
  "springer-llncs": { subject: "bio", edition: "singlecol" },
  "jinst-proceedings": { subject: "hep", edition: "proceedings" },
  "pos-proceedings": { subject: "hep", edition: "proceedings-compact" },
  elsarticle: { subject: "hep", edition: "singlecol" },
  "revtex-aps": { subject: "hep", edition: "twocol-full" },
  "epj-woc": { subject: "hep", edition: "singlecol-compact" },
  iopart: { subject: "hep", edition: "proceedings-extended" },
  neurips: { subject: "nlp", edition: "singlecol" },
  icml: { subject: "nlp", edition: "proceedings" },
  iclr: { subject: "nlp", edition: "singlecol-compact" },
  acl: { subject: "nlp", edition: "twocol-compact" },
  cvpr: { subject: "vla", edition: "singlecol-compact" },
  aaai: { subject: "vla", edition: "proceedings" },
}

const SUBJECT_BY_ID = new Map(GALLERY_SUBJECTS.map((subject) => [subject.id, subject]))

/**
 * Seeds for a poster edition. Column balance is applied later, per board.
 *
 * One rule is non-negotiable here: **a missing role is an error, not an empty
 * card**. Silently emitting `undefined` used to produce a card with no content
 * at all, which then reached the generator as a crash (and, before that, as a
 * blank block on someone's poster). `required()` makes the failure loud and
 * local instead.
 */
function required(subject: GallerySubject, slug: string): CardSeed {
  const seed = subject.poster.find((c) => c.slug === slug)
  if (!seed) throw new Error(`[template-gallery] subject "${subject.id}" has no poster card with slug "${slug}"`)
  return seed
}

function posterEditionSeeds(subject: GallerySubject, edition: PosterEdition): CardSeed[] {
  const base = subject.poster
  const { problem, method, result, conclusion, section } = subject.roles
  const references = required(subject, "references")

  switch (edition) {
    case "hero": {
      // Morrison layout: one plain-language finding in the wide centre column
      // (pinned), narrow sidebars carrying just enough evidence to defend it.
      // Nothing else is pinned — the planner must stay free to keep the narrow
      // sidebars inside their much smaller budget.
      const hero: CardSeed[] = [
        { ...required(subject, problem), title: "Why It Matters" },
        required(subject, method),
        { ...subject.extras.poster.keyFinding, column: 2, pattern: "stats" as BlockPattern },
        required(subject, result),
        subject.extras.poster.sideBySide,
        { ...required(subject, conclusion), title: "Take-Home Message" },
      ]
      // A Better Poster still needs figures to be readable from three metres
      // away: top up with the first figure-bearing block the edition dropped.
      const used = new Set(hero.map((c) => c.slug))
      const extraFigure = base.find((c) => !used.has(c.slug) && (c.figures?.length ?? 0) > 0)
      if (extraFigure) hero.push({ ...extraFigure, title: extraFigure.title })
      return [...hero, references]
    }
    case "wide": {
      // Landscape board: fewer, larger blocks. The paired-result card carries
      // the argument so no column stays half empty on a shorter board.
      const conclusionCard = subject.poster.find((c) => c.slug === conclusion) ?? required(subject, result)
      const used = new Set([problem, method, result, conclusion, "references"])
      const rest = base.filter((c) => !used.has(c.slug))
      return [...rest, subject.extras.poster.details, subject.extras.poster.sideBySide, conclusionCard, references]
    }
    case "dense": {
      // Highest column budget (a0poster-class boards): the full story plus the
      // calibration/implementation card that the classic edition omits.
      return [...base.filter((c) => c.slug !== "references"), subject.extras.poster.details, references]
    }
    case "classic":
    default:
      return [...base]
  }
}

function slidesEditionSeeds(subject: GallerySubject, edition: SlidesEdition): CardSeed[] {
  const base = subject.slides
  const pick = (slug: string) => base.find((c) => c.slug === slug)
  const title = pick("title") ?? base[0]
  const references = base[base.length - 1]

  switch (edition) {
    case "statement": {
      // A dark, minimal theme used for a short argument: fewer slides, bigger
      // claims, heavier speaker notes — but never a deck without evidence, so
      // up to two figure-bearing slides are always kept.
      const keep = new Set(["motivation", "problem", "method", "architecture", "design", "results", "conclusion"])
      const body = base.slice(1, -1).filter((c) => keep.has(c.slug))
      const keptSlugs = new Set(body.map((c) => c.slug))
      const figureSlides = base
        .slice(1, -1)
        .filter((c) => !keptSlugs.has(c.slug) && (c.figures?.length ?? 0) > 0)
        .slice(0, 2)
      return [title, ...body, ...figureSlides, subject.extras.slides.statement, subject.extras.slides.summary, references]
    }
    case "editorial": {
      // 16:9 magazine deck: dense tables and dataset minutiae are cut in favour
      // of statement slides that read from the back of the room.
      const drop = new Set(["dataset", "escape", "tasks", "ablation", "specificity", "systematics", "background", "pipeline"])
      const body = base.slice(1, -1).filter((c) => !drop.has(c.slug))
      const summary = subject.extras.slides.summary
      return [title, ...body, subject.extras.slides.statement, { ...summary, title: "Take-Home Message" }, references]
    }
    case "classic":
    default:
      return [...base]
  }
}

function paperEditionSeeds(subject: GallerySubject, edition: PaperEdition): CardSeed[] {
  const base = subject.paper
  const pick = (slug: string) => base.find((c) => c.slug === slug)
  const references = base[base.length - 1]

  /**
   * One more figure-bearing section, for the compact formats. A short paper
   * still needs to *show* its result: dropping every figure but one is how a
   * four-page proceedings reads as a placeholder.
   */
  const extraFigure = (used: CardSeed[]): CardSeed[] => {
    const usedSlugs = new Set(used.map((c) => c.slug))
    const found = base.find((c) => !usedSlugs.has(c.slug) && (c.figures?.length ?? 0) > 0)
    return found ? [found] : []
  }

  /** Reorder the subject's own sections through its declared roles. */
  const spine = (): CardSeed[] => [
    pick("abstract")!,
    pick("introduction")!,
    pick(subject.roles.method) ?? pick("method") ?? pick("design") ?? pick("architecture")!,
    pick("results") ?? pick(subject.roles.result)!,
    pick("conclusion") ?? pick("discussion")!,
  ].filter(Boolean)

  switch (edition) {
    case "twocol-full":
      return [...base.slice(0, -1), subject.extras.paper.implementation, subject.extras.paper.limitations, references]
    case "singlecol": {
      // Single-column journal format: implementation and limitations come
      // *before* the conclusion, which is how a journal paper reads.
      const body = base.filter((c) => c.slug !== "references" && c.slug !== "discussion")
      const closing = body.pop() ?? references
      return [...body, subject.extras.paper.implementation, subject.extras.paper.limitations, closing, references]
    }
    case "singlecol-compact": {
      const body = spine()
      return [...body, ...extraFigure(body), subject.extras.paper.implementation, references]
    }
    case "proceedings":
      // Proceedings papers run four to six pages: the abstract is spliced into
      // the frontmatter by the generator, so as a card it is only a paragraph.
      return [...base.filter((c) => c.slug !== "references"), subject.extras.paper.implementation, references]
    case "proceedings-extended":
      // IOP-style proceedings: a page or two longer than PoS, so the
      // implementation and limitations sections both fit.
      return [...spine(), subject.extras.paper.implementation, subject.extras.paper.limitations, references]
    case "proceedings-compact": {
      const body = spine()
      return [...body, ...extraFigure(body), references]
    }
    case "twocol-compact":
    default: {
      const body = spine()
      return [...body, ...extraFigure(body), subject.extras.paper.limitations, references]
    }
  }
}

/**
 * Poster editions pin some blocks to specific columns because the template's
 * geometry depends on it — Better Poster's centre column is 0.42 of the width
 * and is meant to hold exactly one finding.
 */
const POSTER_PINNED_COLUMNS: Record<string, string[]> = {
  hero: ["keyfinding"],
}

function assignColumns(cards: Card[], templateId: string, pinned: Set<string>): Card[] {
  const board = posterBoardFor(templateId)
  const columns = board.columnWidths.length
  const unpinned = cards.filter((c) => !pinned.has(c.id))
  const plan = planPosterColumns(unpinned, templateId, { columns })
  const assignment = new Map<string, { column: ColumnIndex; order: number }>()
  for (const column of plan.columns) {
    column.cards.forEach((card, index) => assignment.set(card.id, { column: column.column, order: index }))
  }
  return cards.map((card) => {
    const pinnedTo = pinned.has(card.id) ? card.column : null
    const target = pinnedTo ? { column: pinnedTo, order: card.order } : assignment.get(card.id)
    return { ...card, column: target?.column ?? card.column ?? 1, order: target?.order ?? card.order }
  })
}

/** Re-index `order` inside each column so the LaTeX block order matches the canvas. */
function reindexColumns(cards: Card[]): Card[] {
  const byColumn = new Map<number, Card[]>()
  for (const card of cards) {
    const key = card.column ?? 1
    byColumn.set(key, [...(byColumn.get(key) ?? []), card])
  }
  const ordered: Card[] = []
  for (const key of [...byColumn.keys()].sort((a, b) => a - b)) {
    const columnCards = (byColumn.get(key) ?? []).sort((a, b) => a.order - b.order)
    columnCards.forEach((card, index) => ordered.push({ ...card, order: index }))
  }
  return ordered
}

/** Card ids are stable and follow the `card_` convention in AGENTS.md. */
export function galleryCardId(templateId: string, slug: string): string {
  return `card_${templateId.replace(/[^a-z0-9]/gi, "")}_${slug}`
}

function toCard(templateId: string, outputType: OutputType, seed: CardSeed, index: number): Card {
  const figures: Figure[] = (seed.figures ?? []).map((fig, i) => ({
    id: `${templateId}_${seed.slug}_fig${i + 1}`,
    url: fig.url,
    caption: fig.caption,
  }))
  return {
    id: galleryCardId(templateId, seed.slug),
    title: seed.title,
    column: outputType === "poster" ? seed.column ?? (((index % 3) + 1) as ColumnIndex) : null,
    order: index,
    pattern: seed.pattern,
    content: seed.content,
    table: seed.table ?? { hasHeader: false, caption: "", rows: [] },
    figures,
    figureLayout: figures.length > 1 ? "two-up" : "single",
    sourceIds: [],
    heightBudget: null,
    validation: "valid",
    slideNotes: seed.notes ?? (outputType === "slides" ? SLIDE_NOTE_FALLBACK[seed.slug] : undefined),
  }
}

function assignmentFor(templateId: string, outputType: OutputType): { subject: GallerySubject; edition: string } | null {
  if (outputType === "poster") {
    const entry = POSTER_ASSIGNMENT[templateId]
    const subject = entry ? SUBJECT_BY_ID.get(entry.subject) : undefined
    return subject ? { subject, edition: entry!.edition } : null
  }
  if (outputType === "slides") {
    const entry = SLIDES_ASSIGNMENT[templateId]
    const subject = entry ? SUBJECT_BY_ID.get(entry.subject) : undefined
    return subject ? { subject, edition: entry!.edition } : null
  }
  if (outputType === "paper") {
    const entry = PAPER_ASSIGNMENT[templateId]
    const subject = entry ? SUBJECT_BY_ID.get(entry.subject) : undefined
    return subject ? { subject, edition: entry!.edition } : null
  }
  return null
}

function seedsFor(templateId: string, outputType: OutputType, subject: GallerySubject, edition: string): CardSeed[] {
  if (outputType === "poster") return posterEditionSeeds(subject, edition as PosterEdition)
  if (outputType === "slides") return slidesEditionSeeds(subject, edition as SlidesEdition)
  return paperEditionSeeds(subject, edition as PaperEdition)
}

/**
 * The curated example for a template, or `null` when the template has none
 * (thesis-review, whose content path is the review record rather than cards).
 */
export function templateGalleryFor(templateId: string): OutputConfig | null {
  const def = getTemplateDef(templateId)
  if (!def || def.outputType === "thesis-review") return null
  const assignment = assignmentFor(templateId, def.outputType)
  if (!assignment) return null
  const { subject, edition } = assignment
  const seeds = seedsFor(templateId, def.outputType, subject, edition)
  if (!seeds.length) return null

  let cards = seeds.map((seed, i) => toCard(templateId, def.outputType, seed, i))
  if (def.outputType === "poster") {
    const prefix = `card_${templateId.replace(/[^a-z0-9]/gi, "")}_`
    const slugOf = (card: Card) => card.id.replace(prefix, "")
    const pinnedSlugs = POSTER_PINNED_COLUMNS[edition] ?? []
    const pinned = new Set(cards.filter((c) => pinnedSlugs.includes(slugOf(c))).map((c) => c.id))

    // "Posters must fill the entire canvas": a board whose least-filled column
    // is below 70% of its budget gets topped up with the subject's spare card
    // (and then its details card) until it is either balanced or full. Card
    // counts on A0 are not aesthetic preferences — a 40% empty column is the
    // single most common complaint about auto-generated posters.
    const present = new Set(cards.map((c) => c.id))
    const spares = [subject.extras.poster.spare, subject.extras.poster.details]
      .map((seed, i) => toCard(templateId, def.outputType, seed, seeds.length + i))
      .filter((card) => !present.has(card.id))

    let best = reindexColumns(assignColumns(cards, templateId, pinned))
    for (const spare of spares.slice(0, 2)) {
      const plan = planPosterColumns(
        best.filter((c) => !pinned.has(c.id)),
        templateId,
        { columns: posterBoardFor(templateId).columnWidths.length },
      )
      const lightest = Math.min(...plan.columns.map((column) => column.fill))
      if (lightest >= 0.7) break
      best = reindexColumns(assignColumns([...best, spare], templateId, pinned))
    }
    cards = best
  }

  return {
    id: `out_gallery_${templateId}`,
    outputType: def.outputType,
    templateId,
    title: subject.title,
    authors: subject.authors,
    venue: subject.venue[def.outputType === "paper" ? "paper" : def.outputType === "slides" ? "slides" : "poster"],
    logoUrl: def.id === "atlas" ? "/logos/atlas_transparent.png" : null,
    secondaryLogoUrl: null,
    themeColor: def.colors?.[0]?.hex ?? null,
    cards,
  }
}

/** Every template that has a curated example. */
export function galleryTemplateIds(): string[] {
  return TEMPLATE_REGISTRY.filter((t) => templateGalleryFor(t.id) !== null).map((t) => t.id)
}

/** Bibliography for a gallery's subject, resolved from a gallery output. */
export function galleryBibEntriesFor(templateId: string): BibEntry[] {
  const def = getTemplateDef(templateId)
  if (!def || def.outputType === "thesis-review") return []
  return assignmentFor(templateId, def.outputType)?.subject.bibEntries ?? []
}
