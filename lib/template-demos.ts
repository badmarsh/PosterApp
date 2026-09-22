import type { OutputConfig, Card, BlockPattern, FigureLayout } from "./poster-types"
import type { OutputType } from "./output-types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function card(
  templateId: string,
  index: number,
  title: string,
  pattern: BlockPattern,
  content: string,
  opts?: {
    table?: { hasHeader: boolean; caption: string; rows: string[][] }
    figures?: { id: string; url: string; caption: string }[]
    figureLayout?: FigureLayout
  },
): Card {
  return {
    id: `demo_${templateId}_${index}`,
    title,
    column: null,
    order: index,
    pattern,
    content,
    table: opts?.table ?? { hasHeader: false, caption: "", rows: [] },
    figures: opts?.figures ?? [],
    figureLayout: opts?.figureLayout ?? "single",
    sourceIds: [],
    validation: "valid",
  }
}

// ---------------------------------------------------------------------------
// Shared slide content
// ---------------------------------------------------------------------------

const SLIDES_OUTLINE = `- Motivation \\& Problem Statement
- Related Work \\& Background
- Theoretical Framework (ELBO + Lagrangian Prior)
- Model Architecture \\& Physics-Informed Prior
- Training \\& Implementation Details
- Experimental Setup \\& Benchmarks
- Ablation Study
- Conclusion \\& Future Directions`

const SLIDES_MOTIVATION = `- Sample efficiency remains the central bottleneck in continuous robotic control: state-of-the-art model-free methods require $>10^6$ environment steps \\cite{sac2018,ddpg2016}
- Model-based RL improves data efficiency but suffers from compounding model errors over long horizons \\cite{mbpo2019}
- Existing latent dynamics models lack structured inductive biases: learned transitions violate energy conservation and rigid-body constraints
- **Key question:** Can we embed Lagrangian mechanics into a variational latent dynamics model to achieve sample-efficient, physics-consistent continuous control?`

const SLIDES_RELATED_LEFT = `**Prior model-based approaches:**

- DreamerV3 \\cite{dreamer2021}: world-model in latent space; no physics prior
- MBPO \\cite{mbpo2019}: short-horizon rollouts from learned ensemble
- Lagrangian NNs \\cite{lagrangian2022}: structured dynamics, not RL-integrated`

const SLIDES_RELATED_RIGHT = `**Limitations of prior work:**

- DreamerV3: 73.4% on Stack; degrades past 200-step horizons
- SAC \\cite{sac2018}: requires 3M steps for 55% Stack success
- No prior work combines ELBO + Lagrangian prior + hindsight relabeling \\cite{hindsight2017}`

const SLIDES_THEORY = `**Evidence Lower Bound (ELBO):**
$$\\mathcal{L}(\\theta, \\phi) = \\mathbb{E}_{q_\\phi(\\mathbf{z}|\\mathbf{x})} [\\log p_\\theta(\\mathbf{x}|\\mathbf{z})] - \\beta\\, D_{\\mathrm{KL}}(q_\\phi(\\mathbf{z}|\\mathbf{x}) \\| p(\\mathbf{z}))$$

**Latent Transition Model:**
$$p_\\theta(\\mathbf{z}_{t+1} | \\mathbf{z}_t, \\mathbf{a}_t) = \\mathcal{N}(\\mu_\\theta(\\mathbf{z}_t, \\mathbf{a}_t),\\; \\sigma^2_\\theta(\\mathbf{z}_t, \\mathbf{a}_t))$$

- Annealed $\\beta$: linear warm-up from 0.01 to 0.1 over 50k steps
- Prevents posterior collapse while maintaining reconstruction fidelity ($\\text{RMSE} < 0.042$)`

const SLIDES_ARCHITECTURE = `- **Encoder** $q_\\phi$: ResNet-18 backbone maps $84 \\times 84$ RGB observations to $\\mathbf{z} \\in \\mathbb{R}^{128}$
- **Transition** $p_\\theta$: GRU-based recurrent state-space model with Lagrangian constraint layer
- **Decoder** $p_\\psi$: Transposed CNN reconstructs observations for auxiliary loss
- **Policy** $\\pi_\\omega$: Soft Actor-Critic head \\cite{sac2018} operating on $\\mathbf{z}_t$ with entropy regularisation`

const SLIDES_PHYSICS = `**Euler--Lagrange Constraint:**
$$\\frac{d}{dt} \\frac{\\partial \\mathcal{L}}{\\partial \\dot{q}_i} - \\frac{\\partial \\mathcal{L}}{\\partial q_i} = Q_{\\mathrm{nc},i}$$

- Generalised coordinates $q_i$ map to learned latent dimensions via a differentiable projection
- Kinetic energy $T = \\frac{1}{2} \\dot{\\mathbf{q}}^\\top \\mathbf{M}(\\mathbf{q}) \\dot{\\mathbf{q}}$ with positive-definite mass matrix
- Energy conservation penalty: $\\mathcal{L}_{\\mathrm{phys}} = \\|\\Delta E\\|^2$ added to ELBO with weight $\\lambda = 0.05$
- Reduces model error by 38% on long-horizon tasks compared to unconstrained transitions`

const SLIDES_TRAINING_BULLETS = `- AdamW optimiser with cosine annealing learning rate schedule
- Hindsight Experience Replay \\cite{hindsight2017} with future-goal strategy ($k = 4$ relabeled goals per episode)
- Mixed-precision training on 4$\\times$ A100 GPUs; total training time 18.4 GPU-hours`

const SLIDES_TRAINING_TABLE = {
  hasHeader: true,
  caption: "Key hyperparameters and training settings.",
  rows: [
    ["Hyperparameter", "Value"],
    ["Learning rate", "3e-4 (cosine decay)"],
    ["Batch size", "256"],
    ["Latent dimension $d_z$", "128"],
    ["KL weight $\\beta$", "0.01 $\\to$20.1 (annealed)"],
    ["Imagination horizon $H$", "15 steps"],
    ["GPU hours (4$\\times$ A100)", "18.4 h"],
  ],
}

const SLIDES_SETUP = `- **RoboSuite** \\cite{robosuite2020}: 5 tabletop tasks (Push, Stack, PegInsert, DoorOpen, CableRoute); 500-step episodes
- **Meta-World ML10** \\cite{metaworld2019}: 10 manipulation tasks; 200-step episodes, multi-task evaluation
- **Baselines:** DDPG \\cite{ddpg2016}, SAC \\cite{sac2018}, DreamerV3 \\cite{dreamer2021}, MBPO \\cite{mbpo2019}
- **Evaluation:** 100 episodes per task, 5 seeds; report mean $\\pm$ std success rate
- **Ablations:** remove Lagrangian prior, hindsight relabeling, recurrent unit independently`

const SLIDES_RESULTS_BULLETS = `- Our method achieves **86.7%** mean success rate vs. 73.4% for the strongest baseline (DreamerV3)
- Largest gains on long-horizon contact-rich tasks: CableRoute +23.4 pp, PegInsert +18.5 pp
- Sample efficiency improved by 28.4% (measured as steps to 80% success threshold)`

const SLIDES_RESULTS_TABLE = {
  hasHeader: true,
  caption: "Success rate (%) on RoboSuite benchmark tasks (mean +/- std, 5 seeds).",
  rows: [
    ["Task", "DDPG", "SAC", "DreamerV3", "Ours"],
    ["Push", "82.4 $\\pm$ 1.2", "89.1 $\\pm$ 0.9", "91.5 $\\pm$ 0.7", "**96.8 $\\pm$ 0.4**"],
    ["Stack", "48.2 $\\pm$ 2.1", "55.0 $\\pm$ 1.8", "73.4 $\\pm$ 1.3", "**84.2 $\\pm$ 0.8**"],
    ["PegInsert", "31.5 $\\pm$ 2.5", "42.8 $\\pm$ 2.0", "61.0 $\\pm$ 1.5", "**79.5 $\\pm$ 1.1**"],
    ["DoorOpen", "67.0 $\\pm$ 1.8", "74.3 $\\pm$ 1.5", "88.2 $\\pm$ 0.8", "**94.6 $\\pm$ 0.5**"],
    ["CableRoute", "18.3 $\\pm$ 3.0", "30.1 $\\pm$ 2.5", "54.8 $\\pm$ 1.9", "**78.2 $\\pm$ 1.4**"],
  ],
}

const SLIDES_ABLATION_BULLETS = `- Removing the Lagrangian prior reduces success rate by 13.6 pp (73.1% vs. 86.7%)
- Hindsight relabeling contributes 18.3 pp; without it, long-horizon tasks degrade most
- Replacing GRU transitions with a feedforward MLP drops performance to 52.0%
- Physics-prior ablation shows largest effect on contact-rich tasks ($\\Delta > 20$ pp)`

const SLIDES_CONCLUSION = `**Key contributions:**
- First integration of Lagrangian physics priors with variational latent dynamics for continuous control
- State-of-the-art success rates on 5/5 RoboSuite tasks and 8/10 Meta-World tasks
- 28.4% improvement in sample efficiency over DreamerV3 \\cite{dreamer2021}

**Future directions:**
- Extend to real-robot transfer via sim-to-real domain randomisation
- Hierarchical latent spaces for multi-stage assembly tasks
- Integrate visual foundation models (e.g.\\ attention-based encoders \\cite{attention2017}) for richer observation encoding`

// ---------------------------------------------------------------------------
// Slides demo builder
// ---------------------------------------------------------------------------

function buildSlidesDemo(templateId: string, venue: string, themeColor: string): OutputConfig {
  const id = `demo_slides_${templateId}`
  return {
    id,
    outputType: "slides",
    templateId,
    title: "Latent Dynamics Models for Sample-Efficient Continuous Control",
    authors: "A. Reyes, M. Okafor, L. Petrova, D. Chen",
    venue,
    themeColor,
    cards: [
      card(templateId, 0, "Title Slide", "title-slide", ""),
      card(templateId, 1, "Outline", "bullets", SLIDES_OUTLINE),
      card(templateId, 2, "Motivation \\& Problem Statement", "bullets", SLIDES_MOTIVATION),
      card(templateId, 3, "Related Work", "two-column", SLIDES_RELATED_LEFT + "\n\n" + SLIDES_RELATED_RIGHT),
      card(templateId, 4, "Theoretical Framework", "bullets", SLIDES_THEORY),
      card(templateId, 5, "Model Architecture", "bullets-image", SLIDES_ARCHITECTURE, {
        figures: [{ id: `fig_arch_${templateId}`, url: "assets/fig_architecture.png", caption: "Figure 1: Encoder--transition--decoder architecture with Lagrangian constraint layer." }],
      }),
      card(templateId, 6, "Physics-Informed Prior", "bullets", SLIDES_PHYSICS),
      card(templateId, 7, "Training \\& Implementation", "bullets-table", SLIDES_TRAINING_BULLETS, { table: SLIDES_TRAINING_TABLE }),
      card(templateId, 8, "Experimental Setup", "bullets", SLIDES_SETUP),
      card(templateId, 9, "Results \\& Benchmarks", "bullets-table", SLIDES_RESULTS_BULLETS, { table: SLIDES_RESULTS_TABLE }),
      card(templateId, 10, "Ablation Study", "bullets-image", SLIDES_ABLATION_BULLETS, {
        figures: [{ id: `fig_conv_${templateId}`, url: "assets/fig_convergence.png", caption: "Figure 2: Convergence curves across ablation configurations (5-seed average)." }],
      }),
      card(templateId, 11, "Conclusion \\& Future Work", "bullets", SLIDES_CONCLUSION),
      card(templateId, 12, "References", "references", ""),
    ],
  }
}

// ---------------------------------------------------------------------------
// Shared paper content — ML / RL topic
// ---------------------------------------------------------------------------

const PAPER_ABSTRACT = `We introduce a physics-informed variational latent dynamics model for sample-efficient continuous robotic control. Our approach combines a structured evidence lower bound (ELBO) training objective with a Lagrangian mechanics prior that enforces energy conservation in the learned latent transition dynamics. We further incorporate hindsight experience replay to improve goal-conditioned exploration in sparse-reward manipulation settings. Evaluated on five RoboSuite and ten Meta-World benchmark tasks, our method achieves a mean success rate of 86.7%, outperforming the strongest baseline (DreamerV3, 73.4%) by 13.3 percentage points while requiring 28.4% fewer environment interaction steps to reach the 80% success threshold. Ablation studies confirm that the Lagrangian prior and hindsight relabeling each contribute meaningfully, with the physics constraint proving especially important on contact-rich, long-horizon tasks.`

const PAPER_INTRO = `Reinforcement learning (RL) for continuous robotic control has achieved remarkable results in simulation, yet real-world deployment remains limited by the prohibitive sample complexity of model-free algorithms. State-of-the-art methods such as Soft Actor-Critic (SAC) \\cite{sac2018} and Deep Deterministic Policy Gradient (DDPG) \\cite{ddpg2016} require millions of environment steps to converge on moderately complex manipulation tasks, making direct training on physical hardware impractical.

Model-based reinforcement learning (MBRL) addresses this gap by learning a predictive dynamics model and planning through imagined rollouts. DreamerV3 \\cite{dreamer2021} demonstrates that learning a world model in a compact latent space can dramatically reduce sample requirements. However, purely data-driven latent transitions are prone to compounding prediction errors, particularly over the long horizons characteristic of multi-step manipulation. Model-based policy optimisation (MBPO) \\cite{mbpo2019} mitigates this by truncating rollout horizons, but at the cost of limiting the effective planning depth.

Recent work on Lagrangian Neural Networks \\cite{lagrangian2022} shows that embedding Newtonian structure into learned dynamics models can produce physically consistent predictions. Separately, hindsight experience replay (HER) \\cite{hindsight2017} has proven effective for sparse-reward goal-conditioned tasks by relabeling failed trajectories with achieved goals. Our work unifies these ideas within a single variational framework.

Our contributions are: (1) a variational latent dynamics model whose transition function is constrained by a differentiable Lagrangian prior; (2) an integrated training pipeline combining ELBO optimisation, the physics penalty, and hindsight relabeling; (3) state-of-the-art results on RoboSuite \\cite{robosuite2020} and Meta-World \\cite{metaworld2019} benchmarks with 28.4% improved sample efficiency; and (4) ablation experiments isolating the contribution of each component.`

const PAPER_RELATED = `**Model-based reinforcement learning.**
World models that learn environment dynamics in a latent space have become a dominant paradigm for sample-efficient RL. The Dreamer family \\cite{dreamer2021} trains a recurrent state-space model (RSSM) end-to-end with an actor-critic that operates entirely in imagination. MBPO \\cite{mbpo2019} uses short model-generated rollouts to augment a replay buffer, achieving near-model-free asymptotic performance with substantially fewer real samples. PlaNet learns directly from images using a deterministic-stochastic latent model but does not incorporate structured physics priors.

**Physics-informed machine learning.**
Hamiltonian Neural Networks and Lagrangian Neural Networks \\cite{lagrangian2022} embed conservation laws directly into network architectures, producing dynamics models that respect energy conservation by construction. Deep Lagrangian Networks (DeLaN) extend this to articulated rigid bodies. These methods have been applied to system identification and trajectory prediction, but their integration with policy learning in a variational RL setting has not been explored.

**Latent dynamics and variational inference.**
Variational autoencoders (VAEs) \\cite{vae2014} provide the probabilistic foundation for learning compact latent representations. Sequential VAEs extend this to temporal data by coupling the generative model with recurrent transitions. Our work builds on this line but adds a structured Lagrangian prior to the transition kernel and combines the ELBO with hindsight relabeling \\cite{hindsight2017} for goal-conditioned tasks. Attention mechanisms \\cite{attention2017} have recently been used to improve observation encoding in model-based RL; we leave their integration to future work.`

const PAPER_METHOD = `Our model consists of four components: (i) an observation encoder $q_\\phi(\\mathbf{z}_t | \\mathbf{x}_t)$ that maps high-dimensional inputs to a stochastic latent state, (ii) a Lagrangian-constrained transition model $p_\\theta(\\mathbf{z}_{t+1} | \\mathbf{z}_t, \\mathbf{a}_t)$, (iii) a decoder $p_\\psi(\\mathbf{x}_t | \\mathbf{z}_t)$ providing a reconstruction signal, and (iv) a policy $\\pi_\\omega(\\mathbf{a}_t | \\mathbf{z}_t)$ trained via Soft Actor-Critic \\cite{sac2018} in the latent space.

The training objective maximises the evidence lower bound:
$$\\mathcal{L}(\\theta, \\phi, \\psi) = \\sum_{t=1}^{T} \\Big[ \\mathbb{E}_{q_\\phi} [\\log p_\\psi(\\mathbf{x}_t | \\mathbf{z}_t)] - \\beta\\, D_{\\mathrm{KL}}\\big(q_\\phi(\\mathbf{z}_t | \\mathbf{x}_t) \\,\\|\\, p_\\theta(\\mathbf{z}_t | \\mathbf{z}_{t-1}, \\mathbf{a}_{t-1})\\big) \\Big]$$

To enforce physical consistency, we augment the objective with a Lagrangian penalty. Let $\\mathbf{q} = f_{\\mathrm{proj}}(\\mathbf{z})$ project the latent state onto generalised coordinates. The Euler--Lagrange residual is:
$$r_i = \\frac{d}{dt} \\frac{\\partial \\mathcal{L}}{\\partial \\dot{q}_i} - \\frac{\\partial \\mathcal{L}}{\\partial q_i} - Q_{\\mathrm{nc},i}$$
where $\\mathcal{L} = T - V$ is the Lagrangian with kinetic energy $T = \\frac{1}{2} \\dot{\\mathbf{q}}^\\top \\mathbf{M}(\\mathbf{q}) \\dot{\\mathbf{q}}$ and a learnable potential $V(\\mathbf{q})$. The physics loss $\\mathcal{L}_{\\mathrm{phys}} = \\lambda \\sum_i r_i^2$ is added to the ELBO with $\\lambda = 0.05$.

For goal-conditioned tasks we apply Hindsight Experience Replay \\cite{hindsight2017}: each trajectory is stored with its original goal and $k = 4$ additional relabeled goals sampled from future achieved states. This substantially improves exploration in sparse-reward settings without additional environment interaction.`

const PAPER_EXPERIMENTS = `We evaluate on five tasks from RoboSuite \\cite{robosuite2020} (Push, Stack, PegInsert, DoorOpen, CableRoute) with 500-step episodes and ten tasks from Meta-World ML10 \\cite{metaworld2019} with 200-step episodes. All experiments use 5 random seeds; we report mean $\\pm$ standard deviation of the success rate over 100 evaluation episodes per seed.

Baselines include DDPG \\cite{ddpg2016}, SAC \\cite{sac2018}, DreamerV3 \\cite{dreamer2021}, and MBPO \\cite{mbpo2019}, each tuned with published hyperparameters. Our method trains for 500k environment steps on RoboSuite and 300k on Meta-World. The encoder uses a ResNet-18 backbone; the transition model is a 256-unit GRU with the Lagrangian constraint layer; the latent dimension is $d_z = 128$. Training uses AdamW with learning rate $3 \\times 10^{-4}$ and cosine annealing, batch size 256, and mixed-precision on 4$\\times$ A100 GPUs (18.4 GPU-hours total).

As shown in Table~1, our method achieves the highest success rate on all five RoboSuite tasks, with the largest improvements on contact-rich tasks (CableRoute: $+23.4$ pp over DreamerV3; PegInsert: $+18.5$ pp). On Meta-World ML10, our method ranks first on 8 of 10 tasks, with a mean success rate of 81.3% versus 68.7% for DreamerV3.`

const PAPER_RESULTS_TABLE = {
  hasHeader: true,
  caption: "Table 1: Success rate (%) on RoboSuite tasks (mean +/- std, 5 seeds). Best in bold.",
  rows: [
    ["Task", "DDPG", "SAC", "DreamerV3", "MBPO", "Ours"],
    ["Push", "82.4 $\\pm$ 1.2", "89.1 $\\pm$ 0.9", "91.5 $\\pm$ 0.7", "87.3 $\\pm$ 1.0", "**96.8 $\\pm$ 0.4**"],
    ["Stack", "48.2 $\\pm$ 2.1", "55.0 $\\pm$ 1.8", "73.4 $\\pm$ 1.3", "64.1 $\\pm$ 1.6", "**84.2 $\\pm$ 0.8**"],
    ["PegInsert", "31.5 $\\pm$ 2.5", "42.8 $\\pm$ 2.0", "61.0 $\\pm$ 1.5", "53.7 $\\pm$ 1.8", "**79.5 $\\pm$ 1.1**"],
    ["DoorOpen", "67.0 $\\pm$ 1.8", "74.3 $\\pm$ 1.5", "88.2 $\\pm$ 0.8", "81.4 $\\pm$ 1.2", "**94.6 $\\pm$ 0.5**"],
    ["CableRoute", "18.3 $\\pm$ 3.0", "30.1 $\\pm$ 2.5", "54.8 $\\pm$ 1.9", "42.6 $\\pm$ 2.3", "**78.2 $\\pm$ 1.4**"],
  ],
}

const PAPER_ABLATION = `To isolate the contribution of each component, we conduct ablation experiments on the five RoboSuite tasks. We remove each component independently while keeping all other hyperparameters fixed.

The Lagrangian prior contributes a 13.6 pp improvement in mean success rate (Table~2). Its effect is most pronounced on tasks involving sustained contact (CableRoute: $-21.8$ pp without prior). Hindsight relabeling provides an additional 18.3 pp, primarily by improving exploration in sparse-reward tasks. Replacing the GRU-based transition with a feedforward MLP degrades performance to 52.0%, confirming the importance of temporal memory in the latent state. The standard VAE baseline without any of our components achieves only 41.8%.`

const PAPER_ABLATION_TABLE = {
  hasHeader: true,
  caption: "Table 2: Component ablation study on RoboSuite (mean over 5 tasks, 5 seeds).",
  rows: [
    ["Configuration", "ELBO", "Recon RMSE", "Success (%)", "Sample Eff. (%)"],
    ["Full model (ours)", "-14.2", "0.042", "86.7", "+28.4"],
    ["w/o Lagrangian prior", "-22.8", "0.078", "73.1", "+12.1"],
    ["w/o hindsight relabeling", "-18.5", "0.061", "68.4", "+8.5"],
    ["w/o recurrent transition", "-35.1", "0.114", "52.0", "-4.2"],
    ["Standard VAE baseline", "-48.6", "0.165", "41.8", "0.0"],
  ],
}

const PAPER_CONCLUSION = `We presented a variational latent dynamics model for continuous robotic control that integrates a differentiable Lagrangian prior with hindsight experience replay within an ELBO training framework. Experiments on RoboSuite and Meta-World demonstrate state-of-the-art sample efficiency and asymptotic performance, with ablations confirming the complementary contributions of the physics constraint and the relabeling strategy.

Limitations include the reliance on known generalised-coordinate structure for the Lagrangian prior, which may not transfer directly to deformable-object tasks, and the computational overhead of the physics penalty (approximately 12% wall-clock increase). Future work will explore sim-to-real transfer via domain randomisation, hierarchical latent spaces for multi-stage assembly, and the integration of vision-language foundation models for richer semantic observation encoding \\cite{attention2017}.`

// ---------------------------------------------------------------------------
// Shared paper content — Physics / detector simulation topic
// ---------------------------------------------------------------------------

const PHYS_ABSTRACT = `We present a neural surrogate for fast detector simulation in high-energy particle physics, trained with a calibrated log-likelihood objective on full GEANT4 Monte Carlo samples. The model parameterises calorimeter shower development using a variational latent dynamics framework with an energy-conservation constraint derived from the Lagrangian of electromagnetic shower propagation. Evaluated on single-pion and single-electron samples at energies from 10 to 200~GeV, the surrogate reproduces longitudinal and lateral shower profiles with a mean Wasserstein-1 distance of $0.018 \\pm 0.003$ relative to GEANT4, while achieving a per-shower generation speedup of $4{,}200\\times$. Systematic closure tests confirm that downstream physics observables (jet energy resolution, $\\pi^0$ mass peak) remain within 1.5% of the full-simulation reference.`

const PHYS_INTRO = `Full detector simulation based on GEANT4 accounts for more than 50% of the computing budget of LHC experiments, with projections for the HL-LHC indicating a factor-of-ten shortfall under current resource assumptions. Fast simulation alternatives, ranging from parametric shower libraries to generative adversarial networks and normalising flows, have been explored extensively, yet most sacrifice either fidelity or physical consistency.

We propose a variational latent dynamics surrogate that learns the stochastic evolution of electromagnetic and hadronic showers layer by layer, constrained by a differentiable energy-conservation penalty inspired by the Lagrangian formulation of calorimeter energy deposition. Unlike earlier GAN-based approaches, our model produces calibrated likelihoods, enabling direct use in profile-likelihood fits and reweighting workflows.

Our contributions are: (1) a variational latent dynamics model for layer-wise shower generation with a physics-informed energy-conservation prior; (2) a calibrated log-likelihood training objective that replaces adversarial losses; (3) validation on GEANT4 single-particle samples at 10--200~GeV showing sub-2% closure on downstream observables; and (4) a generation speedup of $4{,}200\\times$ per shower on a single A100 GPU.`

const PHYS_RELATED = `**Fast calorimeter simulation.**
AtlFast3 combines a frozen-shower library with a GAN-based refinement step and is the current production fast-simulation tool in ATLAS. CaloGAN and its successors use Wasserstein GANs to generate shower images in a single forward pass, trading physical constraints for speed. CaloFlow applies normalising flows with exact likelihoods but does not enforce energy conservation. Our approach differs by modelling the layer-by-layer stochastic dynamics explicitly, with a Lagrangian prior.

**Physics-informed generative models.**
Lagrangian Neural Networks and Hamiltonian Neural Networks embed conservation laws into learned dynamics. In the detector simulation context, CaloDiffusion uses diffusion models with an energy-conditioning mechanism. We instead impose a hard constraint via the Euler--Lagrange residual on the latent transition, which avoids the need for post-hoc recalibration.

**Variational methods in HEP.**
Variational autoencoders have been applied to jet generation, anomaly detection, and unfolding. Sequential VAEs extend this to temporal data; our work adapts the sequential framework to the layer-wise structure of calorimeter showers, treating each sampling layer as a time step in the latent dynamics.`

const PHYS_METHOD = `The detector geometry is discretised into $L$ longitudinal sampling layers. At each layer $\\ell$, the model predicts the energy deposition vector $\\mathbf{e}_\\ell \\in \\mathbb{R}^{N_{\\mathrm{cells}}}$ via a latent transition:
$$p_\\theta(\\mathbf{z}_{\\ell+1} | \\mathbf{z}_\\ell, E_{\\mathrm{inc}}) = \\mathcal{N}(\\mu_\\theta(\\mathbf{z}_\\ell, E_{\\mathrm{inc}}),\\; \\sigma^2_\\theta(\\mathbf{z}_\\ell, E_{\\mathrm{inc}}))$$
where $E_{\\mathrm{inc}}$ is the incident particle energy. The training objective is the calibrated log-likelihood:
$$\\mathcal{L}_{\\mathrm{cal}} = \\sum_{\\ell=1}^{L} \\Big[ \\mathbb{E}_{q_\\phi} [\\log p_\\psi(\\mathbf{e}_\\ell | \\mathbf{z}_\\ell)] - \\beta\\, D_{\\mathrm{KL}}(q_\\phi(\\mathbf{z}_\\ell | \\mathbf{e}_\\ell) \\| p_\\theta(\\mathbf{z}_\\ell | \\mathbf{z}_{\\ell-1})) \\Big] - \\lambda \\sum_\\ell r_\\ell^2$$

The energy-conservation residual $r_\\ell = \\sum_c e_{\\ell,c} + \\Delta E_{\\mathrm{leak},\\ell} - E_{\\mathrm{remaining},\\ell}$ penalises violations of the energy budget at each layer. The Lagrangian formulation treats $E_{\\mathrm{deposited}}$ as generalised coordinates and derives the constraint from the stationary-action principle applied to shower development. The weight $\\lambda = 0.05$ is annealed jointly with $\\beta$.`

const PHYS_EXPERIMENTS = `We train on single-pion ($\\pi^+$) and single-electron ($e^-$) samples generated with GEANT4 10.7 using the ATLAS calorimeter geometry (7 electromagnetic + 4 hadronic longitudinal layers, $\\eta$--$\\phi$ granularity of $0.025 \\times 0.025$). Training uses 500k showers per particle type at energies uniformly sampled in 10--200~GeV. Evaluation uses 100k held-out showers; we report the Wasserstein-1 distance between generated and GEANT4 shower profiles.

Table~1 compares our method against CaloGAN, CaloFlow, and full GEANT4. Our surrogate achieves the lowest mean $W_1$ distance ($0.018 \\pm 0.003$) while being $4{,}200\\times$ faster than GEANT4 (0.8~ms vs. 3.4~s per shower on a single A100). The closure test on jet energy resolution shows agreement within 1.2% of full simulation, and the reconstructed $\\pi^0$ mass peak is within 1.5%.`

const PHYS_RESULTS_TABLE = {
  hasHeader: true,
  caption: "Table 1: Comparison of fast-simulation methods on single-pion samples (mean over 100k showers).",
  rows: [
    ["Method", "W1 (long.)", "W1 (lat.)", "Time/shower", "Speedup", "JER closure"],
    ["GEANT4 (ref.)", "---", "---", "3.4 s", "1x", "---"],
    ["CaloGAN", "0.042 $\\pm$ 0.008", "0.051 $\\pm$ 0.010", "1.2 ms", "2800x", "3.8%"],
    ["CaloFlow", "0.031 $\\pm$ 0.005", "0.038 $\\pm$ 0.007", "2.1 ms", "1600x", "2.4%"],
    ["Ours", "**0.014 $\\pm$ 0.002**", "**0.022 $\\pm$ 0.004**", "0.8 ms", "4200x", "**1.2%**"],
  ],
}

const PHYS_ABLATION = `Table~2 reports the ablation study. Removing the energy-conservation prior increases the Wasserstein-1 distance by 67% (from 0.018 to 0.030) and degrades the JER closure from 1.2% to 3.1%, confirming that the physics constraint is essential for downstream fidelity. Replacing the GRU-based transition with an MLP produces showers with correct marginal energy distributions but poor layer-to-layer correlations ($W_1 = 0.045$). Using an adversarial (GAN) loss instead of the calibrated log-likelihood yields comparable shower quality but eliminates the calibrated likelihood needed for profile fits.`

const PHYS_ABLATION_TABLE = {
  hasHeader: true,
  caption: "Table 2: Ablation study on single-pion samples (mean W1, JER closure, likelihood calibration).",
  rows: [
    ["Configuration", "W1 (mean)", "JER closure", "Calib. LL", "Speedup"],
    ["Full model (ours)", "0.018", "1.2%", "Yes", "4200x"],
    ["w/o energy prior", "0.030", "3.1%", "Yes", "4200x"],
    ["w/o recurrent transition", "0.045", "4.8%", "Yes", "4500x"],
    ["GAN loss (adversarial)", "0.021", "1.6%", "No", "4100x"],
    ["CaloFlow baseline", "0.031", "2.4%", "Yes", "1600x"],
  ],
}

const PHYS_CONCLUSION = `We presented a variational latent dynamics surrogate for fast detector simulation that combines a calibrated log-likelihood objective with a Lagrangian energy-conservation prior. The model reproduces GEANT4 calorimeter showers with sub-2% closure on downstream observables while achieving a $4{,}200\\times$ speedup. The calibrated likelihood enables direct integration into statistical inference pipelines, an advantage over GAN-based alternatives.

Limitations include the restriction to single-particle showers; extension to full hadronic jets is ongoing. The model currently targets a fixed geometry; future work will generalise to arbitrary calorimeter segmentations using geometry-aware attention layers. We also plan to validate the surrogate within the full ATLAS simulation chain for HL-LHC Monte Carlo production.`

// ---------------------------------------------------------------------------
// Paper demo builder — ML/RL topic
// ---------------------------------------------------------------------------

function buildPaperDemoML(templateId: string, venue: string): OutputConfig {
  const id = `demo_paper_${templateId}`
  return {
    id,
    outputType: "paper",
    templateId,
    title: "Latent Dynamics Models for Sample-Efficient Continuous Control",
    authors: "A. Reyes, M. Okafor, L. Petrova, D. Chen",
    venue,
    themeColor: null,
    cards: [
      card(templateId, 0, "Abstract", "section", PAPER_ABSTRACT),
      card(templateId, 1, "1 Introduction", "section", PAPER_INTRO),
      card(templateId, 2, "2 Related Work", "section", PAPER_RELATED),
      card(templateId, 3, "3 Method", "section-figure", PAPER_METHOD, {
        figures: [{ id: `fig_arch_${templateId}`, url: "assets/fig_architecture.png", caption: "Figure 1: Overview of the variational latent dynamics architecture with Lagrangian constraint layer." }],
      }),
      card(templateId, 4, "4 Experiments", "section-table", PAPER_EXPERIMENTS, { table: PAPER_RESULTS_TABLE }),
      card(templateId, 5, "5 Ablation Study", "section-table", PAPER_ABLATION, { table: PAPER_ABLATION_TABLE }),
      card(templateId, 6, "6 Conclusion", "section", PAPER_CONCLUSION),
      card(templateId, 7, "References", "references", ""),
    ],
  }
}

// ---------------------------------------------------------------------------
// Paper demo builder — Physics / detector simulation topic
// ---------------------------------------------------------------------------

function buildPaperDemoPhysics(templateId: string, venue: string): OutputConfig {
  const id = `demo_paper_${templateId}`
  return {
    id,
    outputType: "paper",
    templateId,
    title: "Neural Surrogate for Fast Calorimeter Simulation with Energy-Conservation Priors",
    authors: "A. Reyes, M. Okafor, L. Petrova, D. Chen",
    venue,
    themeColor: null,
    cards: [
      card(templateId, 0, "Abstract", "section", PHYS_ABSTRACT),
      card(templateId, 1, "1 Introduction", "section", PHYS_INTRO),
      card(templateId, 2, "2 Related Work", "section", PHYS_RELATED),
      card(templateId, 3, "3 Method", "section-figure", PHYS_METHOD, {
        figures: [{ id: `fig_arch_${templateId}`, url: "assets/fig_architecture.png", caption: "Figure 1: Layer-wise variational latent dynamics architecture for calorimeter shower generation." }],
      }),
      card(templateId, 4, "4 Experiments", "section-table", PHYS_EXPERIMENTS, { table: PHYS_RESULTS_TABLE }),
      card(templateId, 5, "5 Ablation Study", "section-table", PHYS_ABLATION, { table: PHYS_ABLATION_TABLE }),
      card(templateId, 6, "6 Conclusion", "section", PHYS_CONCLUSION),
      card(templateId, 7, "References", "references", ""),
    ],
  }
}

// ---------------------------------------------------------------------------
// Template demo registry
// ---------------------------------------------------------------------------

const TEMPLATE_DEMOS: Record<string, OutputConfig> = {
  // Slides
  "beamer-metropolis": buildSlidesDemo("beamer-metropolis", "CoRL 2026", "#23373b"),
  "beamer-atlas": buildSlidesDemo("beamer-atlas", "CERN — 44th ICHEP 2026", "#C8102E"),
  "beamer-madrid": buildSlidesDemo("beamer-madrid", "NeurIPS 2026", "#2E86C1"),
  "beamer-default": buildSlidesDemo("beamer-default", "ICML 2026", "#1B6CA8"),
  "beamer-focus": buildSlidesDemo("beamer-focus", "AAAI 2026", "#E8E8E8"),

  // Papers — ML / RL topic (two-column ML templates)
  "article-twocol": buildPaperDemoML("article-twocol", "Preprint — CoRL 2026"),
  "ieee-conf": buildPaperDemoML("ieee-conf", "IEEE ICRA 2026"),
  "acm-sigconf": buildPaperDemoML("acm-sigconf", "ACM SIGCHI 2026"),
  "icml": buildPaperDemoML("icml", "ICML 2026"),
  "acl": buildPaperDemoML("acl", "ACL 2026"),
  "cvpr": buildPaperDemoML("cvpr", "CVPR 2026"),
  "aaai": buildPaperDemoML("aaai", "AAAI 2026"),

  // Papers — ML / RL topic (single-column ML templates)
  "article-single": buildPaperDemoML("article-single", "Preprint — CoRL 2026"),
  "neurips": buildPaperDemoML("neurips", "NeurIPS 2026"),
  "iclr": buildPaperDemoML("iclr", "ICLR 2026"),
  "springer-llncs": buildPaperDemoML("springer-llncs", "Springer LNCS — ECML 2026"),

  // Papers — Physics / detector simulation topic
  "jinst-proceedings": buildPaperDemoPhysics("jinst-proceedings", "JINST — 21st Pisa Meeting on Advanced Detectors"),
  "pos-proceedings": buildPaperDemoPhysics("pos-proceedings", "PoS — ICHEP 2026"),
  "elsarticle": buildPaperDemoPhysics("elsarticle", "Nuclear Instruments and Methods A"),
  "revtex-aps": buildPaperDemoPhysics("revtex-aps", "Physical Review D"),
  "epj-woc": buildPaperDemoPhysics("epj-woc", "EPJ Web of Conferences — CHEP 2026"),
  "iopart": buildPaperDemoPhysics("iopart", "Journal of Physics: Conference Series"),
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns a fully populated demo OutputConfig for the given template,
 * or null if no demo exists for that template.
 */
export function getTemplateDemoOutput(templateId: string): OutputConfig | null {
  return TEMPLATE_DEMOS[templateId] ?? null
}

/** All template IDs that have demo content. */
export function getAllDemoTemplateIds(): string[] {
  return Object.keys(TEMPLATE_DEMOS)
}
