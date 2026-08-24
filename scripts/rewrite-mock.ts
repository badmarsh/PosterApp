import * as fs from 'fs';
import * as path from 'path';

const file = path.join(process.cwd(), 'lib/mock-data.ts');
let content = fs.readFileSync(file, 'utf8');

const newOutputsStr = `  outputs: [
    {
      id: "out_poster_1",
      outputType: "poster",
      templateId: "gemini",
      title: "Advanced Layouts & Latent Dynamics",
      cards: [
        {
          id: "poster_card_1",
          title: "Introduction",
          column: 1,
          order: 0,
          pattern: "bullets",
          content: "The ability to accurately model latent dynamics is critical in modern robotic environments. In this paper, we explore a novel approach for combining hindsight relabeling with continuous reinforcement learning. Our results indicate substantial improvements on both sample efficiency and final asymptotic performance.",
          sourceIds: ["asset_txt_1"],
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
          pattern: "bullets-two-images",
          content: "We define the state transition model in the latent space $\\\\mathcal{Z}$ parameterized by $\\\\theta$. The objective is to maximize the evidence lower bound (ELBO):\\n\\n$$ \\\\mathcal{L}(\\\\theta, \\\\phi) = \\\\mathbb{E}_{q_\\\\phi(z|x)} [\\\\log p_\\\\theta(x|z)] - D_{\\\\text{KL}}(q_\\\\phi(z|x) || p(z)) $$\\n\\nWhere the prior $p(z)$ is updated via the transition dynamics $p(z_t | z_{t-1}, a_{t-1})$. This continuous-time formulation allows handling missing observations gracefully. [@reyes2026]",
          sourceIds: ["asset_eq_1"],
          figures: [
            { id: "fig_mock_1a", url: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=400&q=80", caption: "Model architecture diagram" },
            { id: "fig_mock_1b", url: "https://images.unsplash.com/photo-1589254065878-42c9da997008?w=400&q=80", caption: "Physical robot setup" }
          ],
          table: { hasHeader: false, caption: "", rows: [] },
          figureLayout: "single",
          validation: "valid"
        },
        {
          id: "poster_card_3",
          title: "System Architecture",
          column: 2,
          order: 0,
          pattern: "image-focused",
          content: "The overall architecture uses a recurrent state-space model (RSSM). The encoder maps high-dimensional inputs to the latent distribution, while a deterministic recurrent unit predicts the temporal evolution of the mean and variance.",
          sourceIds: [],
          figures: [
            {
              id: "fig_mock",
              url: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&q=80",
              caption: "System Architecture: Recurrent state-space model."
            }
          ],
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
          content: "Our method achieves **82.6% mean success rate** vs **64.2%** for the strongest baseline across 6 simulated tasks (Push, Stack, PegInsert, DoorOpen, Pour, CableRoute).\\n\\nAs shown in the table below, long-horizon tasks benefit the most from hindsight subgoal relabeling.",
          sourceIds: ["asset_table_1"],
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
          title: "References",
          column: 3,
          order: 0,
          pattern: "references",
          content: "@article{reyes2026,\\n  title={Latent Dynamics for Robotics},\\n  author={Reyes, A. and Okafor, M. and Petrova, L. and Chen, D.},\\n  journal={CoRL},\\n  year={2026}\\n}",
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
          sourceIds: ["asset_txt_1"],
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
          pattern: "section-two-figures",
          content: "In addition to standard RL, our physics-informed prior utilizes Lagrangian mechanics to constrain the learned latent space:\\n\\n$$ \\\\frac{d}{dt} \\\\left( \\\\frac{\\\\partial \\\\mathcal{L}}{\\\\partial \\\\dot{q}} \\\\right) - \\\\frac{\\\\partial \\\\mathcal{L}}{\\\\partial q} = Q_{nc} $$\\n\\nThis ensures the decoded trajectories are physically plausible even in low-data regimes. [@reyes2026]",
          sourceIds: ["asset_eq_1"],
          figures: [
            { id: "fig_mock_2a", url: "https://images.unsplash.com/photo-1589254065878-42c9da997008?w=400&q=80", caption: "Robot joint configuration" },
            { id: "fig_mock_2b", url: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=400&q=80", caption: "Latent space visualization" }
          ],
          table: { hasHeader: false, caption: "", rows: [] },
          figureLayout: "single",
          validation: "valid"
        },
        {
          id: "paper_card_3",
          title: "Architecture",
          column: null,
          order: 2,
          pattern: "section-figure",
          content: "The system is composed of an RSSM with a CNN backbone.",
          sourceIds: [],
          figures: [
            {
              id: "fig_mock_p3",
              url: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&q=80",
              caption: "Model Architecture"
            }
          ],
          table: { hasHeader: false, caption: "", rows: [] },
          figureLayout: "single",
          validation: "valid"
        },
        {
          id: "paper_card_4",
          title: "Results",
          column: null,
          order: 3,
          pattern: "section-table",
          content: "Evaluation on CoRL benchmarks.",
          sourceIds: ["asset_table_1"],
          figures: [],
          table: {
            hasHeader: true,
            caption: "Benchmark Results",
            rows: [
              ["Task", "Baseline", "Ours"],
              ["Push", "89%", "95%"],
              ["Stack", "55%", "82%"]
            ]
          },
          figureLayout: "single",
          validation: "valid"
        },
        {
          id: "paper_card_5",
          title: "References",
          column: null,
          order: 4,
          pattern: "references",
          content: "@article{reyes2026,\\n  title={Latent Dynamics for Robotics},\\n  author={Reyes, A. and others},\\n  journal={CoRL},\\n  year={2026}\\n}",
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
      templateId: "beamer-metropolis",
      title: "Advanced Layouts & Latent Dynamics",
      cards: [
        {
          id: "slide_card_1",
          title: "Motivation",
          column: null,
          order: 0,
          pattern: "title-slide",
          content: "Why latent dynamics?\\n- Real-world robotics suffers from partial observability.\\n- Standard pixels-to-actions architectures overfit quickly.\\n- We need a compact representation of the world.",
          sourceIds: ["asset_txt_1"],
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
          content: "By optimizing the ELBO:\\n$$ \\\\mathcal{L} = \\\\mathbb{E}_{q} [\\\\log p(x|z)] - \\\\beta D_{\\\\text{KL}}(q || p) $$\\nWe balance reconstruction fidelity against prior matching.",
          sourceIds: ["asset_eq_1"],
          figures: [],
          table: { hasHeader: false, caption: "", rows: [] },
          figureLayout: "single",
          validation: "valid"
        },
        {
          id: "slide_card_3",
          title: "Architecture",
          column: null,
          order: 2,
          pattern: "figure-slide",
          content: "The RSSM backbone handles temporal state estimation.",
          sourceIds: [],
          figures: [
            {
              id: "fig_mock_3",
              url: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&q=80",
              caption: "Model Architecture"
            }
          ],
          table: { hasHeader: false, caption: "", rows: [] },
          figureLayout: "single",
          validation: "valid"
        },
        {
          id: "slide_card_4",
          title: "Results",
          column: null,
          order: 3,
          pattern: "bullets-image",
          content: "Significant gains across all 6 environments.\\n- Push: 95%\\n- Stack: 82%\\n- CableRoute: 78%",
          sourceIds: ["asset_table_1"],
          figures: [
            {
              id: "fig_mock_4",
              url: "https://images.unsplash.com/photo-1589254065878-42c9da997008?w=800&q=80",
              caption: "Performance overview"
            }
          ],
          table: { hasHeader: false, caption: "", rows: [] },
          figureLayout: "single",
          validation: "valid"
        },
        {
          id: "slide_card_5",
          title: "References",
          column: null,
          order: 4,
          pattern: "references",
          content: "@article{reyes2026,\\n  title={Latent Dynamics for Robotics},\\n  author={Reyes, A. and others},\\n  journal={CoRL},\\n  year={2026}\\n}",
          sourceIds: [],
          figures: [],
          table: { hasHeader: false, caption: "", rows: [] },
          figureLayout: "single",
          validation: "valid"
        }
      ]
    }
  ],`;

content = content.replace(/outputs:\s*\[[\s\S]*?\]\s*,\s*assets/m, newOutputsStr + '\n  assets');
fs.writeFileSync(file, content);
