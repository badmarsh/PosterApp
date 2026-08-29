import { prisma } from "../lib/prisma"
import * as fs from "fs"
import * as path from "path"
import { generateSampleAssets } from "./generate-sample-assets"

const sharedBibContent = `@article{vaswani2017attention,
  author = {Vaswani, Ashish and Shazeer, Noam and Parmar, Niki and Uszkoreit, Jakob and Jones, Llion and Gomez, Aidan N and Kaiser, {\\L}ukasz and Polosukhin, Illia},
  title = {Attention is All You Need},
  journal = {Advances in Neural Information Processing Systems},
  volume = {30},
  year = {2017}
}

@inproceedings{he2016deep,
  author = {He, Kaiming and Zhang, Xiangyu and Ren, Shaoqing and Sun, Jian},
  title = {Deep Residual Learning for Image Recognition},
  booktitle = {Proceedings of the IEEE Conference on Computer Vision and Pattern Recognition},
  pages = {770--778},
  year = {2016}
}

@article{devlin2018bert,
  author = {Devlin, Jacob and Chang, Ming-Wei and Lee, Kenton and Toutanova, Kristina},
  title = {BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding},
  journal = {arXiv preprint arXiv:1810.04805},
  year = {2018}
}

@article{brown2020language,
  author = {Brown, Tom and Mann, Benjamin and Ryder, Nick and Subbiah, Melanie and Kaplan, Jared and Dhariwal, Prafulla and Neelakantan, Arvind and Shyam, Pranav and Sastry, Girish and Askell, Amanda and others},
  title = {Language Models are Few-Shot Learners},
  journal = {Advances in Neural Information Processing Systems},
  volume = {33},
  pages = {1877--1901},
  year = {2020}
}`

const sharedBibKeys = ["vaswani2017attention", "he2016deep", "devlin2018bert", "brown2020language"]

const sourceMarkdownContent = `# Adaptive Variational Gating for Real-Time Multimodal Transformers

**Authors:** A. Reyes, M. Okafor, L. Petrova, D. Chen  
**Affiliations:** Department of Computer Science & Artificial Intelligence Laboratory  
**Venue:** International Conference on Machine Learning & Computing (ICMLC 2026)

---

## Abstract
We present a unified neural architecture designed for high-throughput multimodal processing in resource-constrained environments. By combining adaptive attention gating \\cite{vaswani2017attention} with residual feature refinement \\cite{he2016deep}, our method achieves state-of-the-art accuracy while reducing inference latency by 34% compared to baseline transformer models. We validate our framework across benchmark computer vision and natural language processing tasks, demonstrating robust scaling characteristics and superior parameter efficiency.

---

## 1. Introduction and Mathematical Formulation
Deep neural networks have revolutionized modern representation learning across scientific domains. However, deploying multi-billion parameter foundation models \\cite{brown2020language, devlin2018bert} remains computationally demanding on edge hardware.

To mitigate this constraint, we introduce a structured variational loss objective $\\mathcal{L}_{\\text{total}}$ parameterized by latent state $z \\in \\mathbb{R}^d$:

$$\\mathcal{L}_{\\text{total}}(\\theta, \\phi) = \\mathbb{E}_{q_\\phi(z|x)} [\\log p_\\theta(x|z)] - \\beta D_{\\text{KL}}(q_\\phi(z|x) \\,\\|\\, p(z)) + \\lambda \\sum_{i=1}^L \\|W_i\\|_F^2$$

where $\\sum_{i=1}^L \\|W_i\\|_F^2$ enforces weight regularization across layers, and $\\beta > 0$ controls information bottleneck compression.

Adaptive attention gating allows models to focus compute on salient multi-scale tokens \\cite{vaswani2017attention}, yielding superior parameter efficiency compared to fixed receptive fields.

---

## 2. System Architecture
The model pipeline consists of three tightly coupled stages: a multi-scale perceptual tokenizer, a cross-attention fusion trunk, and a decoupled prediction head. Feature representations are dynamically routed through sparse feed-forward blocks to maintain low memory bandwidth utilization during batch evaluation.

$$\\text{GatedAttn}(Q, K, V) = \\sigma(W_g [Q, K]) \\odot \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right) V$$

Furthermore, sparse Top-K token routing is computed via:

$$y = \\sum_{i \\in \\text{TopK}(H(x), k)} \\text{Softmax}(H(x))_i \\cdot \\text{FFN}_i(x)$$

![Figure 1: Multi-scale tokenizer and sparse cross-attention transformer architecture.](assets/fig_architecture.png)

---

## 3. Dual Model Comparison and Scalability
We compare the convergence rates and parameter utilization of the proposed architecture against standard deep residual networks \\cite{he2016deep}. As shown below, our method scales linearly with sequence length while maintaining stable gradient norms during distributed mixed-precision training.

Linear scaling with respect to sequence length is maintained through sparse MoE layers, preventing quadratic memory explosion during batch inference \\cite{he2016deep, brown2020language}.

![Figure 2: Training loss convergence and gradient stability across 100 epochs.](assets/fig_convergence_plot.png)
![Figure 3: Throughput (samples/sec) scaling comparison as a function of batch size.](assets/fig_throughput_benchmark.png)

---

## 4. Quantitative Benchmark Results
We evaluate model performance on standardized benchmarks across multiple compute budgets. The table below highlights accuracy, parameter count, and inference latency measured on an NVIDIA A100 GPU (FP16 precision).

| Model Architecture | Parameters (M) | Top-1 Acc (%) | Latency (ms) | Energy (J/sample) |
|---|---|---|---|---|
| Baseline ResNet-50 | 25.6 | 76.8 | 4.2 | 0.14 |
| Vision Transformer (ViT-B) | 86.4 | 81.2 | 9.8 | 0.32 |
| BERT-Base | 110.0 | 84.5 | 12.4 | 0.41 |
| Ours (Compact) | 28.2 | 82.4 | 4.6 | 0.15 |
| Ours (Full Model) | 74.0 | 86.9 | 7.1 | 0.22 |

---

## 5. Ablation Studies
Systematic isolation of individual components reveals the specific contributions of attention gating, residual bridges, and variational regularization.

| Configuration | Gating | Residual | Bottleneck Beta | Top-1 (%) | Inference (ms) |
|---|---|---|---|---|---|
| Vanilla Trunk | No | No | 0.0 | 78.4 | 6.8 |
| + Residuals | No | Yes | 0.0 | 81.2 | 6.9 |
| + Gating | Yes | Yes | 0.0 | 84.7 | 5.1 |
| + Variational (Ours) | Yes | Yes | 0.05 | 86.9 | 4.6 |

![Figure 4: Component ablation bar chart.](assets/fig_ablation_study.png)
![Figure 5: Cross-modal attention weight heatmap.](assets/fig_attention_heatmap.png)

---

## 6. Conclusions and Future Work
In this paper, we presented an efficient neural architecture that achieves superior parameter efficiency and high inference throughput across diverse benchmarks. By decoupling feature routing and incorporating variational regularization, our system establishes a new Pareto frontier for real-time edge processing. Future work will investigate self-supervised pre-training on trillion-token corpora.

---

## References
- Vaswani et al., "Attention is All You Need", NeurIPS 2017.
- He et al., "Deep Residual Learning for Image Recognition", CVPR 2016.
- Devlin et al., "BERT: Pre-training of Deep Bidirectional Transformers", 2018.
- Brown et al., "Language Models are Few-Shot Learners", NeurIPS 2020.
`

// -----------------------------------------------------------------------------
// Paper Cards Generator
// -----------------------------------------------------------------------------
function makePaperCards(wsId: string, outputId: string) {
  const fileId = "file_paper_neural_rep"
  return [
    {
      id: `card_${outputId}_s0`,
      title: "Abstract",
      column: null,
      order: 0,
      pattern: "section",
      content: `We present a unified neural architecture designed for high-throughput multimodal processing in resource-constrained environments. By combining adaptive attention gating \\cite{vaswani2017attention} with residual feature refinement \\cite{he2016deep}, our method achieves state-of-the-art accuracy while reducing inference latency by 34% compared to baseline transformer models. We validate our framework across benchmark computer vision and natural language processing tasks, demonstrating robust scaling characteristics and superior parameter efficiency.`,
      figures: [],
      table: { hasHeader: true, caption: "", rows: [] },
      figureLayout: "single",
      sourceIds: [fileId],
      validation: "valid"
    },
    {
      id: `card_${outputId}_s1`,
      title: "Introduction and Mathematical Formulation",
      column: null,
      order: 1,
      pattern: "section",
      content: `Deep neural networks have revolutionized modern representation learning across scientific domains. However, deploying multi-billion parameter foundation models \\cite{brown2020language, devlin2018bert} remains computationally demanding on edge hardware.

To mitigate this constraint, we introduce a structured variational loss objective $\\mathcal{L}_{\\text{total}}$ parameterized by latent state $z \\in \\mathbb{R}^d$:

$$ \\mathcal{L}_{\\text{total}}(\\theta, \\phi) = \\mathbb{E}_{q_\\phi(z|x)} [\\log p_\\theta(x|z)] - \\beta D_{\\text{KL}}(q_\\phi(z|x) \\,|\\, p(z)) + \\lambda \\sum_{i=1}^L \\|W_i\\|_F^2 $$

where $\\Omega(\\theta) = \\sum_{i=1}^L \\|W_i\\|_F^2$ enforces weight regularization across layers, and $\\beta > 0$ controls information bottleneck compression.

Adaptive attention gating allows models to focus compute on salient multi-scale tokens \\cite{vaswani2017attention}, yielding superior parameter efficiency compared to fixed receptive fields.`,
      figures: [],
      table: { hasHeader: true, caption: "", rows: [] },
      figureLayout: "single",
      sourceIds: [fileId],
      validation: "valid"
    },
    {
      id: `card_${outputId}_s2`,
      title: "System Architecture",
      column: null,
      order: 2,
      pattern: "section-figure",
      content: `The model pipeline consists of three tightly coupled stages: a multi-scale perceptual tokenizer, a cross-attention fusion trunk, and a decoupled prediction head. Feature representations are dynamically routed through sparse feed-forward blocks to maintain low memory bandwidth utilization during batch evaluation:

$$\\text{GatedAttn}(Q, K, V) = \\sigma(W_g [Q, K]) \\odot \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right) V$$

Furthermore, sparse Top-K token routing is computed via:

$$y = \\sum_{i \\in \\text{TopK}(H(x), k)} \\text{Softmax}(H(x))_i \\cdot \\text{FFN}_i(x)$$`,
      figures: [
        {
          id: `fig_${outputId}_arch`,
          url: `/api/workspaces/${wsId}/assets/fig_architecture.png`,
          caption: "Multi-scale tokenizer and sparse cross-attention transformer architecture."
        }
      ],
      table: { hasHeader: true, caption: "", rows: [] },
      figureLayout: "single",
      sourceIds: [fileId],
      validation: "valid"
    },
    {
      id: `card_${outputId}_s3`,
      title: "Dual Model Comparison and Scalability",
      column: null,
      order: 3,
      pattern: "section-two-figures",
      content: `We compare the convergence rates and parameter utilization of the proposed architecture against standard deep residual networks \\cite{he2016deep}. As shown below, our method scales linearly with sequence length while maintaining stable gradient norms during distributed mixed-precision training.`,
      figures: [
        {
          id: `fig_${outputId}_plot1`,
          url: `/api/workspaces/${wsId}/assets/fig_convergence_plot.png`,
          caption: "Training loss convergence and gradient stability across 100 epochs."
        },
        {
          id: `fig_${outputId}_plot2`,
          url: `/api/workspaces/${wsId}/assets/fig_throughput_benchmark.png`,
          caption: "Throughput scaling (samples/sec) as a function of batch size."
        }
      ],
      table: { hasHeader: true, caption: "", rows: [] },
      figureLayout: "two-up",
      sourceIds: [fileId],
      validation: "valid"
    },
    {
      id: `card_${outputId}_s4`,
      title: "Quantitative Benchmark Results",
      column: null,
      order: 4,
      pattern: "section-table",
      content: `We evaluate model performance on standardized benchmarks across multiple compute budgets. The table below highlights accuracy, parameter count, and inference latency measured on an NVIDIA A100 GPU (FP16 precision).`,
      table: {
        hasHeader: true,
        caption: "Quantitative comparison of model accuracy, parameter footprint, and latency.",
        rows: [
          ["Model Architecture", "Parameters (M)", "Top-1 Acc (%)", "Latency (ms)", "Energy (J/sample)"],
          ["Baseline ResNet-50", "25.6", "76.8", "4.2", "0.14"],
          ["Vision Transformer (ViT-B)", "86.4", "81.2", "9.8", "0.32"],
          ["BERT-Base", "110.0", "84.5", "12.4", "0.41"],
          ["Ours (Compact)", "28.2", "82.4", "4.6", "0.15"],
          ["Ours (Full Model)", "74.0", "86.9", "7.1", "0.22"]
        ]
      },
      figures: [],
      figureLayout: "single",
      sourceIds: [fileId],
      validation: "valid"
    },
    {
      id: `card_${outputId}_s5`,
      title: "Ablation Studies",
      column: null,
      order: 5,
      pattern: "section-figure",
      content: `Systematic isolation of individual components reveals the specific contributions of attention gating, residual bridges, and variational regularization.

$$\\mathcal{L}_{\\text{reg}}(\\theta) = \\lambda \\sum_{i=1}^L \\|W_i\\|_F^2$$`,
      figures: [
        {
          id: `fig_${outputId}_ablation`,
          url: `/api/workspaces/${wsId}/assets/fig_ablation_study.png`,
          caption: "Component-wise ablation comparing accuracy vs latency trade-offs."
        }
      ],
      table: {
        hasHeader: true,
        caption: "Component ablation of gating mechanisms, residual links, and variational regularization.",
        rows: [
          ["Configuration", "Gating", "Residual", "Bottleneck Beta", "Top-1 (%)", "Inference (ms)"],
          ["Vanilla Trunk", "No", "No", "0.0", "78.4", "6.8"],
          ["+ Residuals", "No", "Yes", "0.0", "81.2", "6.9"],
          ["+ Gating", "Yes", "Yes", "0.0", "84.7", "5.1"],
          ["+ Variational (Ours)", "Yes", "Yes", "0.05", "86.9", "4.6"]
        ]
      },
      figureLayout: "single",
      sourceIds: [fileId],
      validation: "valid"
    },
    {
      id: `card_${outputId}_s6`,
      title: "Conclusions and Future Work",
      column: null,
      order: 6,
      pattern: "section",
      content: `In this paper, we presented an efficient neural architecture that achieves superior parameter efficiency and high inference throughput across diverse benchmarks. By decoupling feature routing and incorporating variational regularization, our system establishes a new Pareto frontier for real-time edge processing. Future work will investigate self-supervised pre-training on trillion-token corpora.`,
      figures: [],
      table: { hasHeader: true, caption: "", rows: [] },
      figureLayout: "single",
      sourceIds: [fileId],
      validation: "valid"
    },
    {
      id: `card_${outputId}_s7`,
      title: "References",
      column: null,
      order: 7,
      pattern: "references",
      content: sharedBibContent,
      figures: [],
      table: { hasHeader: true, caption: "", rows: [] },
      figureLayout: "single",
      sourceIds: [fileId],
      validation: "valid"
    }
  ]
}

// -----------------------------------------------------------------------------
// Poster Cards Generator (3-column layout)
// -----------------------------------------------------------------------------
function makePosterCards(wsId: string, outputId: string) {
  const fileId = "file_poster_neural_rep"
  return [
    {
      id: `card_${outputId}_p1`,
      title: "1. Problem Motivation & Objectives",
      column: 1,
      order: 0,
      pattern: "bullets",
      content: `* Deploying foundation models \\cite{brown2020language, devlin2018bert} on edge hardware requires radical compression and latency optimizations.
* Standard vision-language transformers incur quadratic complexity with respect to token context length.
* **Core Objective**: Develop an end-to-end architecture with adaptive gating \\cite{vaswani2017attention} achieving $\\ge 85\\%$ accuracy at $<5\\text{ ms}$ latency.`,
      figures: [],
      table: { hasHeader: true, caption: "", rows: [] },
      figureLayout: "single",
      sourceIds: [fileId],
      validation: "valid"
    },
    {
      id: `card_${outputId}_p2`,
      title: "2. Dual Convergence & Scaling Benchmarks",
      column: 1,
      order: 1,
      pattern: "bullets-two-images",
      content: `* **Faster Convergence**: Variational objective $\\mathcal{L}_{\\text{total}}$ stabilizes early epoch dynamics.
* **Linear Throughput**: Sparse routing maintains constant latency across batch scaling.`,
      figures: [
        { id: `fig_${outputId}_p2_a`, url: `/api/workspaces/${wsId}/assets/fig_convergence_plot.png`, caption: "Training Loss vs. Epochs" },
        { id: `fig_${outputId}_p2_b`, url: `/api/workspaces/${wsId}/assets/fig_throughput_benchmark.png`, caption: "Throughput (samples/s)" }
      ],
      table: { hasHeader: true, caption: "", rows: [] },
      figureLayout: "two-up",
      sourceIds: [fileId],
      validation: "valid"
    },
    {
      id: `card_${outputId}_p3`,
      title: "3. System Architecture & Gated Attention",
      column: 2,
      order: 0,
      pattern: "image-focused",
      content: `* Complete pipeline diagram showing perceptual tokenizers, cross-modal gating, and decoupled heads:`,
      figures: [
        {
          id: `fig_${outputId}_p3`,
          url: `/api/workspaces/${wsId}/assets/fig_architecture.png`,
          caption: "End-to-end unified multimodal transformer architecture with adaptive gating."
        }
      ],
      table: { hasHeader: true, caption: "", rows: [] },
      figureLayout: "single",
      sourceIds: [fileId],
      validation: "valid"
    },
    {
      id: `card_${outputId}_p4`,
      title: "4. Benchmark Results & Model Footprint",
      column: 2,
      order: 1,
      pattern: "bullets-table",
      content: `* Outperforms standard ResNet-50 \\cite{he2016deep} and ViT-B baselines in accuracy and energy efficiency:`,
      table: {
        hasHeader: true,
        caption: "A100 Benchmark Results.",
        rows: [
          ["Model", "Params (M)", "Top-1 (%)", "Latency (ms)", "Energy (J)"],
          ["ResNet-50", "25.6", "76.8", "4.2", "0.14"],
          ["ViT-B", "86.4", "81.2", "9.8", "0.32"],
          ["Ours (Compact)", "28.2", "82.4", "4.6", "0.15"],
          ["Ours (Full)", "74.0", "86.9", "7.1", "0.22"]
        ]
      },
      figures: [],
      tableRows: [],
      figureLayout: "single",
      sourceIds: [fileId],
      validation: "valid"
    },
    {
      id: `card_${outputId}_p5`,
      title: "5. Component Ablation & Attention Heatmap",
      column: 3,
      order: 0,
      pattern: "bullets-image",
      content: `* Systematic ablation isolating gating mechanisms from residual connections.
* Variational ELBO adds $+2.2\\%$ accuracy with zero runtime latency penalty:`,
      figures: [
        {
          id: `fig_${outputId}_p5`,
          url: `/api/workspaces/${wsId}/assets/fig_ablation_study.png`,
          caption: "Accuracy vs. Latency trade-offs across architectural ablations."
        }
      ],
      table: { hasHeader: true, caption: "", rows: [] },
      figureLayout: "single",
      sourceIds: [fileId],
      validation: "valid"
    },
    {
      id: `card_${outputId}_p6`,
      title: "6. Conclusions & Future Impact",
      column: 3,
      order: 1,
      pattern: "bullets",
      content: `* **34% Latency Reduction**: Demonstrated real-time edge processing capability.
* **Unified Modality**: Handles vision, text, and sensor telemetry in a single forward pass.
* **Next Steps**: Extending to edge FPGA deployment and self-supervised video representations.`,
      figures: [],
      table: { hasHeader: true, caption: "", rows: [] },
      figureLayout: "single",
      sourceIds: [fileId],
      validation: "valid"
    },
    {
      id: `card_${outputId}_p7`,
      title: "References",
      column: 3,
      order: 2,
      pattern: "references",
      content: sharedBibContent,
      figures: [],
      table: { hasHeader: true, caption: "", rows: [] },
      figureLayout: "single",
      sourceIds: [fileId],
      validation: "valid"
    }
  ]
}

// -----------------------------------------------------------------------------
// Slides Cards Generator (Beamer Slides)
// -----------------------------------------------------------------------------
function makeSlidesCards(wsId: string, outputId: string) {
  const fileId = "file_slides_neural_rep"
  return [
    {
      id: `card_${outputId}_sl1`,
      title: "Adaptive Variational Gating for Multimodal Transformers",
      column: null,
      order: 0,
      pattern: "title-slide",
      content: `**A. Reyes, M. Okafor, L. Petrova, D. Chen**\n\n*ICMLC 2026 International Conference*`,
      figures: [],
      table: { hasHeader: true, caption: "", rows: [] },
      figureLayout: "single",
      sourceIds: [fileId],
      validation: "valid"
    },
    {
      id: `card_${outputId}_sl2`,
      title: "Motivation: Scaling vs. Edge Hardware Constraints",
      column: null,
      order: 1,
      pattern: "two-column",
      content: `* Large foundation models \\cite{brown2020language, devlin2018bert} demand tens of gigabytes of VRAM.
* Real-time robotics and edge detectors require sub-5ms decision loops.
* Our work bridges this gap through structured variational gating \\cite{vaswani2017attention}.`,
      figures: [],
      table: { hasHeader: true, caption: "", rows: [] },
      figureLayout: "single",
      sourceIds: [fileId],
      validation: "valid"
    },
    {
      id: `card_${outputId}_sl3`,
      title: "Mathematical Formulation & Loss Objective",
      column: null,
      order: 2,
      pattern: "bullets",
      content: `* We formulate the training objective using an Evidence Lower Bound (ELBO):

$$ \\mathcal{L}_{\\text{total}}(\\theta, \\phi) = \\mathbb{E}_{q_\\phi(z|x)} [\\log p_\\theta(x|z)] - \\beta D_{\\text{KL}}(q_\\phi(z|x) \\,\\|\\, p(z)) + \\lambda \\sum_{i=1}^L \\|W_i\\|_F^2 $$

* The hyperparameter $\\beta > 0$ controls the information bottleneck compression.`,
      figures: [],
      table: { hasHeader: true, caption: "", rows: [] },
      figureLayout: "single",
      sourceIds: [fileId],
      validation: "valid"
    },
    {
      id: `card_${outputId}_sl4`,
      title: "End-to-End System Architecture",
      column: null,
      order: 3,
      pattern: "bullets-image",
      content: `* Multi-scale tokenizer coupled with adaptive cross-attention gates:`,
      figures: [
        {
          id: `fig_${outputId}_sl4`,
          url: `/api/workspaces/${wsId}/assets/fig_architecture.png`,
          caption: "Overview of the end-to-end tokenizer and transformer pipeline."
        }
      ],
      table: { hasHeader: true, caption: "", rows: [] },
      figureLayout: "single",
      sourceIds: [fileId],
      validation: "valid"
    },
    {
      id: `card_${outputId}_sl5`,
      title: "Experimental Convergence & Throughput",
      column: null,
      order: 4,
      pattern: "bullets-two-images",
      content: `* Fast, monotonic loss convergence across 100 epochs.
* Throughput scales linearly up to $B=64$ batch size:`,
      figures: [
        { id: `fig_${outputId}_sl5_a`, url: `/api/workspaces/${wsId}/assets/fig_convergence_plot.png`, caption: "Loss Convergence" },
        { id: `fig_${outputId}_sl5_b`, url: `/api/workspaces/${wsId}/assets/fig_throughput_benchmark.png`, caption: "Throughput (samples/sec)" }
      ],
      table: { hasHeader: true, caption: "", rows: [] },
      figureLayout: "two-up",
      sourceIds: [fileId],
      validation: "valid"
    },
    {
      id: `card_${outputId}_sl6`,
      title: "Benchmark Results & Comparisons",
      column: null,
      order: 5,
      pattern: "bullets-table",
      content: `* Rigorous evaluation confirms top-tier accuracy at substantially lower computational cost:`,
      table: {
        hasHeader: true,
        caption: "Benchmark Accuracy and Latency Comparison.",
        rows: [
          ["Model", "Params (M)", "Top-1 (%)", "Latency (ms)"],
          ["ResNet-50", "25.6", "76.8", "4.2"],
          ["ViT-B", "86.4", "81.2", "9.8"],
          ["Ours (Compact)", "28.2", "82.4", "4.6"],
          ["Ours (Full)", "74.0", "86.9", "7.1"]
        ]
      },
      figures: [],
      figureLayout: "single",
      sourceIds: [fileId],
      validation: "valid"
    },
    {
      id: `card_${outputId}_sl7`,
      title: "Component Ablation & Insights",
      column: null,
      order: 6,
      pattern: "bullets-image",
      content: `* Accuracy gains vs inference speed across architectural variants:`,
      figures: [
        {
          id: `fig_${outputId}_sl7`,
          url: `/api/workspaces/${wsId}/assets/fig_ablation_study.png`,
          caption: "Ablation study showing performance trade-offs."
        }
      ],
      table: { hasHeader: true, caption: "", rows: [] },
      figureLayout: "single",
      sourceIds: [fileId],
      validation: "valid"
    },
    {
      id: `card_${outputId}_sl8`,
      title: "Conclusions & Summary",
      column: null,
      order: 7,
      pattern: "bullets",
      content: `* **State-of-the-Art Accuracy**: Demonstrates +5.7% gain over standard baselines.
* **Real-Time Efficiency**: 4.6 ms latency enables 200+ FPS real-time processing.
* **Extensible Architecture**: Fully compatible with vision, language, and detector data streams.`,
      figures: [],
      table: { hasHeader: true, caption: "", rows: [] },
      figureLayout: "single",
      sourceIds: [fileId],
      validation: "valid"
    },
    {
      id: `card_${outputId}_sl9`,
      title: "References",
      column: null,
      order: 8,
      pattern: "references",
      content: sharedBibContent,
      figures: [],
      table: { hasHeader: true, caption: "", rows: [] },
      figureLayout: "single",
      sourceIds: [fileId],
      validation: "valid"
    }
  ]
}

// -----------------------------------------------------------------------------
// Ingested Assets Helper
// -----------------------------------------------------------------------------
interface IngestedCardMapping {
  cardIntro: string
  cardArch: string
  cardEval: string
  cardTable: string
}

function makeIngestedAssets(wsId: string, fileId: string, mapping: IngestedCardMapping) {
  return [
    // ── Figures ──
    {
      id: `asset_${wsId}_fig_arch`,
      fileId,
      filename: "fig_architecture.png",
      url: `/api/workspaces/${wsId}/assets/fig_architecture.png`,
      thumbnailUrl: `/api/workspaces/${wsId}/assets/fig_architecture.png`,
      kind: "figure",
      page: 2,
      section: "System Architecture",
      bbox: "[100, 150, 500, 420]",
      confidence: "high",
      heading: "Figure 1: Pipeline Overview",
      caption: "Multi-scale tokenizer and sparse cross-attention transformer architecture.",
      assignedCardId: mapping.cardArch,
      assignedSlot: "figure1",
    },
    {
      id: `asset_${wsId}_fig_conv`,
      fileId,
      filename: "fig_convergence_plot.png",
      url: `/api/workspaces/${wsId}/assets/fig_convergence_plot.png`,
      thumbnailUrl: `/api/workspaces/${wsId}/assets/fig_convergence_plot.png`,
      kind: "figure",
      page: 3,
      section: "Dual Model Comparison and Scalability",
      bbox: "[80, 200, 480, 450]",
      confidence: "high",
      heading: "Figure 2: Loss Convergence",
      caption: "Training loss convergence and gradient stability across 100 epochs.",
      assignedCardId: mapping.cardEval,
      assignedSlot: "figure1",
    },
    {
      id: `asset_${wsId}_fig_tp`,
      fileId,
      filename: "fig_throughput_benchmark.png",
      url: `/api/workspaces/${wsId}/assets/fig_throughput_benchmark.png`,
      thumbnailUrl: `/api/workspaces/${wsId}/assets/fig_throughput_benchmark.png`,
      kind: "figure",
      page: 3,
      section: "Dual Model Comparison and Scalability",
      bbox: "[80, 500, 480, 750]",
      confidence: "high",
      heading: "Figure 3: Throughput Scaling",
      caption: "Throughput (samples/sec) scaling comparison as a function of batch size.",
      assignedCardId: mapping.cardEval,
      assignedSlot: "figure2",
    },
    {
      id: `asset_${wsId}_fig_ablation`,
      fileId,
      filename: "fig_ablation_study.png",
      url: `/api/workspaces/${wsId}/assets/fig_ablation_study.png`,
      thumbnailUrl: `/api/workspaces/${wsId}/assets/fig_ablation_study.png`,
      kind: "figure",
      page: 5,
      section: "Ablation Studies",
      bbox: "[120, 180, 520, 460]",
      confidence: "high",
      heading: "Figure 4: Ablation Bar Chart",
      caption: "Component ablation of attention gating against residual links.",
      assignedCardId: null,
      assignedSlot: null,
    },
    {
      id: `asset_${wsId}_fig_attn`,
      fileId,
      filename: "fig_attention_heatmap.png",
      url: `/api/workspaces/${wsId}/assets/fig_attention_heatmap.png`,
      thumbnailUrl: `/api/workspaces/${wsId}/assets/fig_attention_heatmap.png`,
      kind: "figure",
      page: 5,
      section: "Ablation Studies",
      bbox: "[120, 500, 520, 780]",
      confidence: "high",
      heading: "Figure 5: Attention Heatmap",
      caption: "Cross-attention weight heatmap across multi-modal perceptual tokens.",
      assignedCardId: null,
      assignedSlot: null,
    },

    // ── Tables ──
    {
      id: `asset_${wsId}_tbl_bench`,
      fileId,
      filename: null,
      url: null,
      thumbnailUrl: null,
      kind: "table",
      page: 4,
      section: "Quantitative Benchmark Results",
      heading: "Table 1: Benchmark Comparisons",
      caption: "Quantitative comparison of model accuracy, parameter footprint, and latency.",
      confidence: "high",
      tableRows: [
        ["Model Architecture", "Parameters (M)", "Top-1 Acc (%)", "Latency (ms)", "Energy (J/sample)"],
        ["Baseline ResNet-50", "25.6", "76.8", "4.2", "0.14"],
        ["Vision Transformer (ViT-B)", "86.4", "81.2", "9.8", "0.32"],
        ["BERT-Base", "110.0", "84.5", "12.4", "0.41"],
        ["Ours (Compact)", "28.2", "82.4", "4.6", "0.15"],
        ["Ours (Full Model)", "74.0", "86.9", "7.1", "0.22"]
      ],
      assignedCardId: mapping.cardTable,
      assignedSlot: "table",
    },
    {
      id: `asset_${wsId}_tbl_ablation`,
      fileId,
      filename: null,
      url: null,
      thumbnailUrl: null,
      kind: "table",
      page: 5,
      section: "Ablation Studies",
      heading: "Table 2: Ablation Results",
      caption: "Component ablation of gating mechanisms, residual links, and variational regularization.",
      confidence: "high",
      tableRows: [
        ["Configuration", "Gating", "Residual", "Bottleneck Beta", "Top-1 (%)", "Inference (ms)"],
        ["Vanilla Trunk", "No", "No", "0.0", "78.4", "6.8"],
        ["+ Residuals", "No", "Yes", "0.0", "81.2", "6.9"],
        ["+ Gating", "Yes", "Yes", "0.0", "84.7", "5.1"],
        ["+ Variational (Ours)", "Yes", "Yes", "0.05", "86.9", "4.6"]
      ],
      assignedCardId: null,
      assignedSlot: null,
    },

    // ── Equations ──
    {
      id: `asset_${wsId}_eq_variational`,
      fileId,
      filename: null,
      url: null,
      thumbnailUrl: null,
      kind: "equation",
      page: 1,
      section: "Introduction and Mathematical Formulation",
      heading: "Eq. (1) Variational ELBO Objective",
      snippet: "\\mathcal{L}_{\\text{total}}(\\theta, \\phi) = \\mathbb{E}_{q_\\phi(z|x)} [\\log p_\\theta(x|z)] - \\beta D_{\\text{KL}}(q_\\phi(z|x) \\,\\|\\, p(z)) + \\lambda \\sum_{i=1}^L \\|W_i\\|_F^2",
      caption: "Structured variational loss objective with L2 Frobenius weight regularization.",
      confidence: "high",
      assignedCardId: mapping.cardIntro,
      assignedSlot: "bullets",
    },
    {
      id: `asset_${wsId}_eq_cross_attention`,
      fileId,
      filename: null,
      url: null,
      thumbnailUrl: null,
      kind: "equation",
      page: 2,
      section: "System Architecture",
      heading: "Eq. (2) Gated Cross-Attention",
      snippet: "\\text{GatedAttn}(Q, K, V) = \\sigma(W_g [Q, K]) \\odot \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right) V",
      caption: "Gated cross-attention formulation with dynamic channel routing.",
      confidence: "high",
      assignedCardId: mapping.cardArch,
      assignedSlot: "bullets",
    },
    {
      id: `asset_${wsId}_eq_sparse_routing`,
      fileId,
      filename: null,
      url: null,
      thumbnailUrl: null,
      kind: "equation",
      page: 2,
      section: "System Architecture",
      heading: "Eq. (3) Top-K MoE Routing",
      snippet: "y = \\sum_{i \\in \\text{TopK}(H(x), k)} \\text{Softmax}(H(x))_i \\cdot \\text{FFN}_i(x)",
      caption: "Sparse mixture-of-experts token routing function.",
      confidence: "high",
      assignedCardId: mapping.cardArch,
      assignedSlot: "bullets",
    },

    // ── Text / Citations ──
    {
      id: `asset_${wsId}_txt_attn`,
      fileId,
      filename: null,
      url: null,
      thumbnailUrl: null,
      kind: "text",
      page: 1,
      section: "Introduction and Mathematical Formulation",
      heading: "Attention Mechanism Background",
      snippet: "Adaptive attention gating allows models to focus compute on salient multi-scale tokens \\cite{vaswani2017attention}, yielding superior parameter efficiency compared to fixed receptive fields.",
      confidence: "high",
      assignedCardId: mapping.cardIntro,
      assignedSlot: "bullets",
    },
    {
      id: `asset_${wsId}_txt_scaling`,
      fileId,
      filename: null,
      url: null,
      thumbnailUrl: null,
      kind: "text",
      page: 3,
      section: "Dual Model Comparison and Scalability",
      heading: "Empirical Scaling Behavior",
      snippet: "Linear scaling with respect to sequence length is maintained through sparse MoE layers, preventing quadratic memory explosion during batch inference \\cite{he2016deep, brown2020language}.",
      confidence: "high",
      assignedCardId: mapping.cardEval,
      assignedSlot: "bullets",
    },
    {
      id: `asset_${wsId}_txt_bert`,
      fileId,
      filename: null,
      url: null,
      thumbnailUrl: null,
      kind: "text",
      page: 1,
      section: "Introduction",
      heading: "Foundation Models in Edge Deployments",
      snippet: "Deploying multi-billion parameter foundation models \\cite{brown2020language, devlin2018bert} requires aggressive pruning or distillation to operate within edge power envelopes.",
      confidence: "high",
      assignedCardId: mapping.cardIntro,
      assignedSlot: "bullets",
    }
  ]
}

async function seedTestWorkspaces() {
  console.log("Seeding test workspaces with full templates, figures, tables, equations and ingested documents...")

  // Generate all PNG figures
  await generateSampleAssets()

  const existingWorkspaces = await prisma.workspace.findMany({ select: { id: true, userId: true } })
  const activeUserId =
    existingWorkspaces.find((w) => w.userId.startsWith("user_") && w.userId !== "user_test_default")?.userId ||
    "user_3IGDYw03LkmHZaaCgKwWcBYxHQu"
  console.log(`Using target user ID: ${activeUserId}`)

  function copyAssetsToWorkspace(wsId: string) {
    const sharedAssetsDir = path.join(process.cwd(), "workspaces", "prj_atlas_studies", "assets")
    const sharedLogosDir = path.join(process.cwd(), "workspaces", "prj_atlas_studies", "logos")
    const dstAssets = path.join(process.cwd(), "workspaces", wsId, "assets")
    const dstLogos = path.join(process.cwd(), "workspaces", wsId, "logos")
    const dstSources = path.join(process.cwd(), "workspaces", wsId, "sources")

    fs.mkdirSync(dstAssets, { recursive: true })
    fs.mkdirSync(dstLogos, { recursive: true })
    fs.mkdirSync(dstSources, { recursive: true })

    // Write source markdown file
    fs.writeFileSync(path.join(dstSources, "source_neural_rep.md"), sourceMarkdownContent, "utf-8")

    if (fs.existsSync(sharedAssetsDir)) {
      const files = fs.readdirSync(sharedAssetsDir)
      for (const f of files) {
        fs.copyFileSync(path.join(sharedAssetsDir, f), path.join(dstAssets, f))
      }
    }
    if (fs.existsSync(sharedLogosDir)) {
      const logos = fs.readdirSync(sharedLogosDir)
      for (const l of logos) {
        fs.copyFileSync(path.join(sharedLogosDir, l), path.join(dstLogos, l))
      }
    }
  }

  // ===========================================================================
  // 1. WORKSPACE: Tests - paper (7 Paper Templates)
  // ===========================================================================
  const wsPaperId = "ws_tests_paper"
  copyAssetsToWorkspace(wsPaperId)

  try { await prisma.workspace.delete({ where: { id: wsPaperId } }) } catch (_) {}

  const paperTemplates = [
    { id: "article-twocol", name: "Two-Column Article", themeColor: "#111827" },
    { id: "article-single", name: "Single-Column Article", themeColor: "#1E40AF" },
    { id: "ieee-conf", name: "IEEE Conference", themeColor: "#111827" },
    { id: "acm-sigconf", name: "ACM SIGCONF", themeColor: "#111827" },
    { id: "springer-llncs", name: "Springer LLNCS", themeColor: "#1A56DB" },
    { id: "jinst-proceedings", name: "JINST Proceedings", themeColor: "#111827" },
    { id: "pos-proceedings", name: "PoS Proceedings", themeColor: "#111827" },
  ]

  const paperFileId = "file_paper_neural_rep"

  await prisma.workspace.create({
    data: {
      id: wsPaperId,
      userId: activeUserId,
      name: "Tests - paper",
      authors: "A. Reyes, M. Okafor, L. Petrova, D. Chen",
      venue: "International Conference on Machine Learning & Computing (ICMLC 2026)",
      logoUrl: "logos/uk_logo.png",
      secondaryLogoUrl: "logos/atlas_transparent.png",
      bibContent: sharedBibContent,
      bibKeys: sharedBibKeys,
      revision: 1,
      ingestFiles: {
        create: [
          {
            id: paperFileId,
            name: "neural_representations_icmlc2026.pdf",
            size: 1485200,
            method: "MinerU",
            status: "done",
            progress: 100,
            dismissed: false,
          }
        ]
      },
      outputs: {
        create: paperTemplates.map((t, idx) => {
          const outId = `out_paper_${t.id.replace(/-/g, "_")}`
          return {
            id: outId,
            outputType: "paper",
            templateId: t.id,
            title: `Neural Representation Learning (${t.name})`,
            themeColor: t.themeColor,
            isActive: idx === 0,
            cards: {
              create: makePaperCards(wsPaperId, outId).map(c => ({
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
        })
      }
    }
  })

  // Insert assets after cards exist
  await prisma.asset.createMany({
    data: makeIngestedAssets(wsPaperId, paperFileId, {
      cardIntro: "card_out_paper_article_twocol_s1",
      cardArch: "card_out_paper_article_twocol_s2",
      cardEval: "card_out_paper_article_twocol_s3",
      cardTable: "card_out_paper_article_twocol_s4",
    }).map(a => ({
      id: a.id,
      workspaceId: wsPaperId,
      fileId: a.fileId,
      filename: a.filename,
      url: a.url,
      thumbnailUrl: a.thumbnailUrl,
      kind: a.kind,
      page: a.page,
      section: a.section,
      bbox: a.bbox,
      confidence: a.confidence,
      heading: a.heading,
      caption: a.caption,
      snippet: (a as any).snippet,
      tableRows: (a as any).tableRows,
      assignedCardId: a.assignedCardId,
      assignedSlot: a.assignedSlot,
    }))
  })
  console.log(`Created workspace "${wsPaperId}" with 7 Paper template outputs and ingested assets.`)

  // ===========================================================================
  // 2. WORKSPACE: Tests - poster (5 Poster Templates)
  // ===========================================================================
  const wsPosterId = "ws_tests_poster"
  copyAssetsToWorkspace(wsPosterId)

  try { await prisma.workspace.delete({ where: { id: wsPosterId } }) } catch (_) {}

  const posterTemplates = [
    { id: "atlas", name: "ATLAS Poster", themeColor: "#C8102E" },
    { id: "minimal", name: "Minimal Blue Poster", themeColor: "#2563EB" },
    { id: "gemini", name: "Gemini Beamerposter", themeColor: "#4F46E5" },
    { id: "tikzposter", name: "tikzposter Board", themeColor: "#1D4ED8" },
    { id: "a0poster", name: "Classic A0 Poster", themeColor: "#111827" },
  ]

  const posterFileId = "file_poster_neural_rep"

  await prisma.workspace.create({
    data: {
      id: wsPosterId,
      userId: activeUserId,
      name: "Tests - poster",
      authors: "A. Reyes, M. Okafor, L. Petrova, D. Chen",
      venue: "International Poster Symposium on AI & High-Energy Physics 2026",
      logoUrl: "logos/uk_logo.png",
      secondaryLogoUrl: "logos/atlas_transparent.png",
      bibContent: sharedBibContent,
      bibKeys: sharedBibKeys,
      revision: 1,
      ingestFiles: {
        create: [
          {
            id: posterFileId,
            name: "neural_representations_icmlc2026.pdf",
            size: 1485200,
            method: "MinerU",
            status: "done",
            progress: 100,
            dismissed: false,
          }
        ]
      },
      outputs: {
        create: posterTemplates.map((t, idx) => {
          const outId = `out_poster_${t.id.replace(/-/g, "_")}`
          return {
            id: outId,
            outputType: "poster",
            templateId: t.id,
            title: `Neural Representation Learning (${t.name})`,
            themeColor: t.themeColor,
            isActive: idx === 0,
            cards: {
              create: makePosterCards(wsPosterId, outId).map(c => ({
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
        })
      }
    }
  })

  await prisma.asset.createMany({
    data: makeIngestedAssets(wsPosterId, posterFileId, {
      cardIntro: "card_out_poster_atlas_p1",
      cardArch: "card_out_poster_atlas_p3",
      cardEval: "card_out_poster_atlas_p2",
      cardTable: "card_out_poster_atlas_p4",
    }).map(a => ({
      id: a.id,
      workspaceId: wsPosterId,
      fileId: a.fileId,
      filename: a.filename,
      url: a.url,
      thumbnailUrl: a.thumbnailUrl,
      kind: a.kind,
      page: a.page,
      section: a.section,
      bbox: a.bbox,
      confidence: a.confidence,
      heading: a.heading,
      caption: a.caption,
      snippet: (a as any).snippet,
      tableRows: (a as any).tableRows,
      assignedCardId: a.assignedCardId,
      assignedSlot: a.assignedSlot,
    }))
  })
  console.log(`Created workspace "${wsPosterId}" with 5 Poster template outputs and ingested assets.`)

  // ===========================================================================
  // 3. WORKSPACE: Tests - slides (5 Slides Templates)
  // ===========================================================================
  const wsSlidesId = "ws_tests_slides"
  copyAssetsToWorkspace(wsSlidesId)

  try { await prisma.workspace.delete({ where: { id: wsSlidesId } }) } catch (_) {}

  const slideTemplates = [
    { id: "beamer-metropolis", name: "Metropolis Slides", themeColor: "#2D3748" },
    { id: "beamer-atlas", name: "ATLAS Beamer Slides", themeColor: "#C8102E" },
    { id: "beamer-madrid", name: "Madrid Beamer Slides", themeColor: "#1D4ED8" },
    { id: "beamer-default", name: "Default Beamer Slides", themeColor: "#1E40AF" },
    { id: "beamer-focus", name: "Focus Dark Slides", themeColor: "#1C1C1C" },
  ]

  const slidesFileId = "file_slides_neural_rep"

  await prisma.workspace.create({
    data: {
      id: wsSlidesId,
      userId: activeUserId,
      name: "Tests - slides",
      authors: "A. Reyes, M. Okafor, L. Petrova, D. Chen",
      venue: "Conference on Neural Information Processing Systems (NeurIPS 2026)",
      logoUrl: "logos/uk_logo.png",
      secondaryLogoUrl: "logos/atlas_transparent.png",
      bibContent: sharedBibContent,
      bibKeys: sharedBibKeys,
      revision: 1,
      ingestFiles: {
        create: [
          {
            id: slidesFileId,
            name: "neural_representations_icmlc2026.pdf",
            size: 1485200,
            method: "MinerU",
            status: "done",
            progress: 100,
            dismissed: false,
          }
        ]
      },
      outputs: {
        create: slideTemplates.map((t, idx) => {
          const outId = `out_slides_${t.id.replace(/-/g, "_")}`
          return {
            id: outId,
            outputType: "slides",
            templateId: t.id,
            title: `Neural Representation Learning (${t.name})`,
            themeColor: t.themeColor,
            isActive: idx === 0,
            cards: {
              create: makeSlidesCards(wsSlidesId, outId).map(c => ({
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
        })
      }
    }
  })

  await prisma.asset.createMany({
    data: makeIngestedAssets(wsSlidesId, slidesFileId, {
      cardIntro: "card_out_slides_beamer_metropolis_sl3",
      cardArch: "card_out_slides_beamer_metropolis_sl4",
      cardEval: "card_out_slides_beamer_metropolis_sl5",
      cardTable: "card_out_slides_beamer_metropolis_sl6",
    }).map(a => ({
      id: a.id,
      workspaceId: wsSlidesId,
      fileId: a.fileId,
      filename: a.filename,
      url: a.url,
      thumbnailUrl: a.thumbnailUrl,
      kind: a.kind,
      page: a.page,
      section: a.section,
      bbox: a.bbox,
      confidence: a.confidence,
      heading: a.heading,
      caption: a.caption,
      snippet: (a as any).snippet,
      tableRows: (a as any).tableRows,
      assignedCardId: a.assignedCardId,
      assignedSlot: a.assignedSlot,
    }))
  })
  console.log(`Created workspace "${wsSlidesId}" with 5 Slides template outputs and ingested assets.`)

  console.log("All 3 test workspaces successfully seeded with rich figures, tables, equations, citations, and ingested assets!")
}

seedTestWorkspaces()
  .catch(err => {
    console.error("Test workspaces seed failed:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
