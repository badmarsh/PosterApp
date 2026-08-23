import type { Project, Card } from "./poster-types"
import { randomUUID } from "crypto"

export const sampleProject: Project = {
  id: "demo_ws",
  name: "Advanced Layouts & Latent Dynamics",
  authors: "A. Reyes, M. Okafor, L. Petrova, D. Chen",
  venue: "Robotics & Learning Lab - CoRL 2026",
  activeOutputId: "out_poster_1",
  outputs: [
    {
      id: "out_poster_1",
      outputType: "poster",
      templateId: "gemini",
      title: "Advanced Layouts & Latent Dynamics (Poster)",
      isActive: true,
      cards: [
        {
          id: randomUUID(),
          title: "Introduction",
          column: 1,
          order: 0,
          pattern: "primary",
          content: "The ability to accurately model latent dynamics is critical in modern robotic environments. In this paper, we explore a novel approach for combining hindsight relabeling with continuous reinforcement learning. Our results indicate substantial improvements on both sample efficiency and final asymptotic performance.",
          sourceIds: [],
          figures: [],
          figureLayout: "auto",
          validation: "ok"
        },
        {
          id: randomUUID(),
          title: "Mathematical Framework",
          column: 1,
          order: 1,
          pattern: "primary",
          content: "We define the state transition model in the latent space $\\mathcal{Z}$ parameterized by $\\theta$. The objective is to maximize the evidence lower bound (ELBO):\n\n$$ \\mathcal{L}(\\theta, \\phi) = \\mathbb{E}_{q_\\phi(z|x)} [\\log p_\\theta(x|z)] - D_{\\text{KL}}(q_\\phi(z|x) || p(z)) $$\n\nWhere the prior $p(z)$ is updated via the transition dynamics $p(z_t | z_{t-1}, a_{t-1})$. This continuous-time formulation allows handling missing observations gracefully.",
          sourceIds: [],
          figures: [],
          figureLayout: "auto",
          validation: "ok"
        },
        {
          id: randomUUID(),
          title: "System Architecture",
          column: 2,
          order: 0,
          pattern: "primary",
          content: "The overall architecture uses a recurrent state-space model (RSSM). The encoder maps high-dimensional inputs to the latent distribution, while a deterministic recurrent unit predicts the temporal evolution of the mean and variance.",
          sourceIds: [],
          figures: [],
          figureLayout: "auto",
          validation: "ok"
        },
        {
          id: randomUUID(),
          title: "Results & Discussion",
          column: 2,
          order: 1,
          pattern: "primary",
          content: "Our method achieves **82.6% mean success rate** vs **64.2%** for the strongest baseline across 6 simulated tasks (Push, Stack, PegInsert, DoorOpen, Pour, CableRoute).\n\nAs shown in the table below, long-horizon tasks benefit the most from hindsight subgoal relabeling.",
          sourceIds: [],
          figures: [],
          table: {
            id: randomUUID(),
            caption: "Table 1: Success rates across tasks.",
            rows: [
              ["Task", "Baseline", "Ours"],
              ["Push", "89%", "95%"],
              ["Stack", "55%", "82%"],
              ["CableRoute", "30%", "78%"]
            ]
          },
          figureLayout: "auto",
          validation: "ok"
        },
        {
          id: randomUUID(),
          title: "Conclusion",
          column: 3,
          order: 0,
          pattern: "primary",
          content: "- Latent subgoal structure jointly regularizes exploration and model rollout.\n- Code and pre-trained weights are available at `github.com/example/latent-rl`.\n- Future work involves deploying directly onto physical quadrupeds.",
          sourceIds: [],
          figures: [],
          figureLayout: "auto",
          validation: "ok"
        }
      ]
    },
    {
      id: "out_paper_1",
      outputType: "paper",
      templateId: "article-twocol",
      title: "Advanced Layouts & Latent Dynamics",
      isActive: false,
      cards: [
        {
          id: randomUUID(),
          title: "Abstract",
          column: 1,
          order: 0,
          pattern: "primary",
          content: "We present a robust method for continuous latent dynamics using hindsight relabeling. We evaluate our approach on 6 demanding robotic manipulation tasks, demonstrating a 28% relative improvement in sample efficiency.",
          sourceIds: [],
          figures: [],
          figureLayout: "auto",
          validation: "ok"
        },
        {
          id: randomUUID(),
          title: "Lagrangian Formulation",
          column: 1,
          order: 1,
          pattern: "primary",
          content: "In addition to standard RL, our physics-informed prior utilizes Lagrangian mechanics to constrain the learned latent space:\n\n$$ \\frac{d}{dt} \\left( \\frac{\\partial \\mathcal{L}}{\\partial \\dot{q}} \\right) - \\frac{\\partial \\mathcal{L}}{\\partial q} = Q_{nc} $$\n\nThis ensures the decoded trajectories are physically plausible even in low-data regimes.",
          sourceIds: [],
          figures: [],
          figureLayout: "auto",
          validation: "ok"
        }
      ]
    },
    {
      id: "out_slides_1",
      outputType: "slides",
      templateId: "metropolis",
      title: "Advanced Layouts & Latent Dynamics (Slides)",
      isActive: false,
      cards: [
        {
          id: randomUUID(),
          title: "Motivation",
          column: 1,
          order: 0,
          pattern: "primary",
          content: "Why latent dynamics?\n- Real-world robotics suffers from partial observability.\n- Standard pixels-to-actions architectures overfit quickly.\n- We need a compact representation of the world.",
          sourceIds: [],
          figures: [],
          figureLayout: "auto",
          validation: "ok"
        },
        {
          id: randomUUID(),
          title: "Our Equation",
          column: 1,
          order: 1,
          pattern: "primary",
          content: "By optimizing the ELBO:\n$$ \\mathcal{L} = \\mathbb{E}_{q} [\\log p(x|z)] - \\beta D_{\\text{KL}}(q || p) $$\nWe balance reconstruction fidelity against prior matching.",
          sourceIds: [],
          figures: [],
          figureLayout: "auto",
          validation: "ok"
        }
      ]
    }
  ],
  assets: [],
  ingestFiles: []
}
