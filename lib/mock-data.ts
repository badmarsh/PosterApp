import type { Project, Card } from "./poster-types"

export const sampleProject: Project = {
  id: "demo_ws",
  name: "Advanced Layouts & Latent Dynamics",
  posterTitle: "Advanced Layouts & Latent Dynamics (Poster)",
  authors: "A. Reyes, M. Okafor, L. Petrova, D. Chen",
  venue: "Robotics & Learning Lab - CoRL 2026",
  templateName: "gemini",
  cards: [],
  activeOutputId: "out_poster_1",
  outputs: [
    {
      id: "out_poster_1",
      outputType: "poster",
      templateId: "gemini",
      title: "Advanced Layouts & Latent Dynamics (Poster)",
      cards: [
        {
          id: "poster_card_1",
          title: "Introduction",
          column: 1,
          order: 0,
          pattern: "bullets",
          content: "The ability to accurately model latent dynamics is critical in modern robotic environments. In this paper, we explore a novel approach for combining hindsight relabeling with continuous reinforcement learning. Our results indicate substantial improvements on both sample efficiency and final asymptotic performance.",
          sourceIds: [],
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
          pattern: "bullets",
          content: "We define the state transition model in the latent space $\\mathcal{Z}$ parameterized by $\\theta$. The objective is to maximize the evidence lower bound (ELBO):\n\n$$ \\mathcal{L}(\\theta, \\phi) = \\mathbb{E}_{q_\\phi(z|x)} [\\log p_\\theta(x|z)] - D_{\\text{KL}}(q_\\phi(z|x) || p(z)) $$\n\nWhere the prior $p(z)$ is updated via the transition dynamics $p(z_t | z_{t-1}, a_{t-1})$. This continuous-time formulation allows handling missing observations gracefully.",
          sourceIds: [],
          figures: [],
          table: { hasHeader: false, caption: "", rows: [] },
          figureLayout: "single",
          validation: "valid"
        },
        {
          id: "poster_card_3",
          title: "System Architecture",
          column: 2,
          order: 0,
          pattern: "bullets",
          content: "The overall architecture uses a recurrent state-space model (RSSM). The encoder maps high-dimensional inputs to the latent distribution, while a deterministic recurrent unit predicts the temporal evolution of the mean and variance.",
          sourceIds: [],
          figures: [],
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
          sourceIds: [],
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
          title: "Conclusion",
          column: 3,
          order: 0,
          pattern: "bullets",
          content: "- Latent subgoal structure jointly regularizes exploration and model rollout.\n- Code and pre-trained weights are available at `github.com/example/latent-rl`.\n- Future work involves deploying directly onto physical quadrupeds.",
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
          sourceIds: [],
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
          pattern: "section",
          content: "In addition to standard RL, our physics-informed prior utilizes Lagrangian mechanics to constrain the learned latent space:\n\n$$ \\frac{d}{dt} \\left( \\frac{\\partial \\mathcal{L}}{\\partial \\dot{q}} \\right) - \\frac{\\partial \\mathcal{L}}{\\partial q} = Q_{nc} $$\n\nThis ensures the decoded trajectories are physically plausible even in low-data regimes.",
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
      templateId: "metropolis",
      title: "Advanced Layouts & Latent Dynamics (Slides)",
      cards: [
        {
          id: "slide_card_1",
          title: "Motivation",
          column: null,
          order: 0,
          pattern: "title-slide",
          content: "Why latent dynamics?\n- Real-world robotics suffers from partial observability.\n- Standard pixels-to-actions architectures overfit quickly.\n- We need a compact representation of the world.",
          sourceIds: [],
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
          content: "By optimizing the ELBO:\n$$ \\mathcal{L} = \\mathbb{E}_{q} [\\log p(x|z)] - \\beta D_{\\text{KL}}(q || p) $$\nWe balance reconstruction fidelity against prior matching.",
          sourceIds: [],
          figures: [],
          table: { hasHeader: false, caption: "", rows: [] },
          figureLayout: "single",
          validation: "valid"
        }
      ]
    }
  ],
  assets: [],
  ingestFiles: []
}

// ensure cards fallback matches the active output for legacy code
const activeOut = sampleProject.outputs.find(o => o.id === sampleProject.activeOutputId)
if (activeOut) {
  sampleProject.cards = activeOut.cards
}
