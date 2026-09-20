
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { prisma } from '../lib/prisma';

async function main() {
  console.log("Updating Showcase Workspaces in Prisma Database...");

  // =========================================================================
  // 1. Attention Is All You Need (attention-is-all-you-need)
  // =========================================================================
  const ws1Id = 'attention-is-all-you-need';
  const ws1 = await prisma.workspace.findUnique({
    where: { id: ws1Id },
    include: { outputs: true, assets: true }
  });

  if (!ws1) throw new Error("Workspace 1 not found: " + ws1Id);

  // Find or create active output
  let out1 = ws1.outputs.find(o => o.templateId === 'gemini');
  if (!out1) {
    out1 = ws1.outputs.find(o => o.isActive) || ws1.outputs[0];
  }

  await prisma.output.update({
    where: { id: out1.id },
    data: {
      templateId: 'gemini',
      themeColor: '#4F46E5',
      isActive: true,
      title: 'Attention Is All You Need',
      authors: 'Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N. Gomez, Lukasz Kaiser, Illia Polosukhin',
      venue: '31st Conference on Neural Information Processing Systems (NeurIPS 2017), Long Beach, CA, USA',
    }
  });

  // Ensure other outputs are not active
  for (const o of ws1.outputs) {
    if (o.id !== out1.id && o.isActive) {
      await prisma.output.update({ where: { id: o.id }, data: { isActive: false } });
    }
  }

  // Delete existing cards of this output and insert modernized cards
  await prisma.card.deleteMany({ where: { outputId: out1.id } });

  const ws1Cards = [
    // Column 1
    {
      id: 'c1_seq_bottleneck',
      outputId: out1.id,
      title: 'The Sequential RNN Bottleneck',
      column: 1,
      order: 0,
      pattern: 'bullets',
      content: `- **Strict Sequentiality:** Prior state-of-the-art models (LSTM, GRU) process sequences token-by-token, requiring $O(n)$ sequential operations for length $n$.
- **Parallelization Obstacle:** Inability to parallelize across training examples within a sequence severely limits training throughput on modern GPU accelerators.
- **Long-Range Degradation:** Information transfer between distant tokens must traverse intermediate hidden states, causing vanishing gradients and signal loss over long horizons.`,
      figureLayout: 'single',
      heightBudget: null,
      validation: 'valid',
      table: { hasHeader: false, caption: '', rows: [] },
      figures: [],
      sourceIds: [],
    },
    {
      id: 'c1_abstract',
      outputId: out1.id,
      title: 'Abstract & Core Innovation',
      column: 1,
      order: 1,
      pattern: 'bullets',
      content: `We present the **Transformer**, the first transduction model relying entirely on self-attention to compute representations of its input and output without using sequence-aligned RNNs or convolution.

- **Constant Path Length:** Connects all pairs of positions in $O(1)$ sequential operations, drastically improving gradient propagation.
- **Training Throughput:** Allows significantly greater parallelization during training, achieving superior translation quality in a fraction of previous training time.
- **SOTA Generalization:** Sets new records on WMT 2014 English-to-German (**28.4 BLEU**) and English-to-French (**41.0 BLEU**).`,
      figureLayout: 'single',
      heightBudget: null,
      validation: 'valid',
      table: { hasHeader: false, caption: '', rows: [] },
      figures: [],
      sourceIds: [],
    },
    {
      id: 'c1_scaled_attention',
      outputId: out1.id,
      title: 'Scaled Dot-Product Attention',
      column: 1,
      order: 2,
      pattern: 'bullets',
      content: `An attention function maps queries $Q$, keys $K$, and values $V$ to output vectors:

$$\\text{Attention}(Q,K,V) = \\text{softmax}\\left(\\frac{QK^\\top}{\\sqrt{d_k}}\\right)V$$

- **Why Scale by $\\frac{1}{\\sqrt{d_k}}$?** For large values of $d_k$, the dot products grow large in magnitude, pushing the softmax function into regions with extremely small gradients. The scaling factor $\\frac{1}{\\sqrt{d_k}}$ counteracts this effect.
- **Matrix Parallelism:** Evaluated on a set of queries simultaneously using highly optimized matrix multiplication routines ($QK^\\top$).`,
      figureLayout: 'single',
      heightBudget: null,
      validation: 'valid',
      table: { hasHeader: false, caption: '', rows: [] },
      figures: [],
      sourceIds: [],
    },

    // Column 2
    {
      id: 'c2_architecture',
      outputId: out1.id,
      title: 'The Transformer Architecture',
      column: 2,
      order: 0,
      pattern: 'bullets-image',
      content: `**Encoder-Decoder Structure:** Stack of $N=6$ identical layers for both encoder and decoder ($d_{\\text{model}}=512, d_{ff}=2048$):
- Each layer contains **Multi-Head Self-Attention** followed by position-wise **Feed-Forward Networks**.
- Employs residual connections around each sub-layer followed by layer normalization: $\\text{LayerNorm}(x + \\text{Sublayer}(x))$.`,
      figureLayout: 'single',
      heightBudget: null,
      validation: 'valid',
      table: { hasHeader: false, caption: '', rows: [] },
      figures: [
        {
          id: 'fig_transformer_arch',
          url: '/api/workspaces/attention-is-all-you-need/assets/fig_transformer_arch.png',
          caption: 'Figure 1: Full Transformer encoder-decoder architecture with stacked self-attention and point-wise feed-forward sublayers.',
        }
      ],
      sourceIds: [],
    },
    {
      id: 'c2_multihead',
      outputId: out1.id,
      title: 'Multi-Head Attention Mechanism',
      column: 2,
      order: 1,
      pattern: 'bullets-image',
      content: `Instead of performing a single attention function, we project queries, keys, and values $h=8$ times with learned linear projections to dimensions $d_k = d_v = d_{\\text{model}} / h = 64$:
$$\\text{MultiHead}(Q, K, V) = \\text{Concat}(\\text{head}_1, \\dots, \\text{head}_h)W^O$$
$$\\text{head}_i = \\text{Attention}(Q W_i^Q, K W_i^K, V W_i^V)$$

Multi-head attention allows the model to jointly attend to information from different representation subspaces at different positions, resolving syntactic and semantic dependencies.`,
      figureLayout: 'single',
      heightBudget: null,
      validation: 'valid',
      table: { hasHeader: false, caption: '', rows: [] },
      figures: [
        {
          id: 'fig_attention_heads',
          url: '/api/workspaces/attention-is-all-you-need/assets/fig_attention_heads.png',
          caption: 'Figure 2: Attention weight heatmaps in Layer 5 self-attention showing distinct heads tracking coreference and semantic relationships.',
        }
      ],
      sourceIds: [],
    },

    // Column 3
    {
      id: 'c3_hero_stats',
      outputId: out1.id,
      title: 'Empirical Breakthroughs & Highlights',
      column: 3,
      order: 0,
      pattern: 'stats',
      content: `Key milestone results establishing the Transformer as the dominant sequence transduction paradigm:
- **28.4 BLEU** EN-DE Translation (+2.0 over prior SOTA)
- **41.0 BLEU** EN-FR Translation (Record single-model benchmark)
- **3.5 Days** Training Time (8 × NVIDIA P100 GPUs)`,
      figureLayout: 'single',
      heightBudget: null,
      validation: 'valid',
      table: { hasHeader: false, caption: '', rows: [] },
      figures: [
        {
          id: 'fig_bleu_comparison',
          url: '/api/workspaces/attention-is-all-you-need/assets/fig_bleu_comparison.png',
          caption: 'Figure 3: WMT 2014 translation benchmark comparison showing state-of-the-art BLEU score at competitive training FLOPs.',
        }
      ],
      sourceIds: [],
    },
    {
      id: 'c3_wmt_table',
      outputId: out1.id,
      title: 'WMT 2014 Translation Benchmark',
      column: 3,
      order: 1,
      pattern: 'bullets-table',
      content: `Comparison of single-model translation performance on the WMT 2014 English-to-German and English-to-French test sets:`,
      figureLayout: 'single',
      heightBudget: null,
      validation: 'valid',
      table: {
        hasHeader: true,
        caption: 'Table 1: Translation BLEU scores and training costs ($10^{18}$ FLOPs) on WMT 2014.',
        rows: [
          ['Model Architecture', 'EN-DE BLEU', 'EN-FR BLEU', 'Training Cost'],
          ['ByteNet', '23.75', '—', '1.0 $\\times 10^{18}$'],
          ['Deep-Att + PosUnk', '24.60', '39.92', '1.2 $\\times 10^{18}$'],
          ['ConvS2S', '25.16', '40.46', '9.6 $\\times 10^{18}$'],
          ['MoE (Shazeer et al.)', '26.03', '40.56', '2.0 $\\times 10^{19}$'],
          ['Transformer (Base)', '27.30', '38.10', '3.3 $\\times 10^{18}$'],
          ['**Transformer (Big)**', '**28.40**', '**41.00**', '**2.3 $\\times 10^{19}$**']
        ]
      },
      figures: [],
      sourceIds: [],
    },
    {
      id: 'c3_legacy',
      outputId: out1.id,
      title: 'Industry Impact & Legacy',
      column: 3,
      order: 2,
      pattern: 'bullets',
      content: `- **Foundation of Frontier AI:** Directly spawned BERT (2018), GPT series (2018–present), T5, RoBERTa, LLaMA, Claude, and Gemini.
- **Cross-Domain Unification:** Expanded beyond NLP to Vision Transformers (ViT), Audio Transformers (Whisper), and Multi-Modal Foundation Models.
- **Massive Scalability:** Demonstrates exceptional empirical scaling laws, where test loss predictably scales as a power-law with model size and dataset tokens.`,
      figureLayout: 'single',
      heightBudget: null,
      validation: 'valid',
      table: { hasHeader: false, caption: '', rows: [] },
      figures: [],
      sourceIds: [],
    }
  ];

  for (const c of ws1Cards) {
    await prisma.card.create({ data: c });
  }

  // Register assets in DB
  await prisma.asset.deleteMany({ where: { workspaceId: ws1Id } });
  const ws1Assets = [
    { id: 'ast_tf_arch', workspaceId: ws1Id, fileId: 'fig_transformer_arch.png', filename: 'fig_transformer_arch.png', url: '/api/workspaces/attention-is-all-you-need/assets/fig_transformer_arch.png', kind: 'figure', page: 1, confidence: 'high', caption: 'Transformer Encoder-Decoder Architecture' },
    { id: 'ast_tf_attn', workspaceId: ws1Id, fileId: 'fig_attention_heads.png', filename: 'fig_attention_heads.png', url: '/api/workspaces/attention-is-all-you-need/assets/fig_attention_heads.png', kind: 'figure', page: 1, confidence: 'high', caption: 'Multi-Head Attention Weights' },
    { id: 'ast_tf_bleu', workspaceId: ws1Id, fileId: 'fig_bleu_comparison.png', filename: 'fig_bleu_comparison.png', url: '/api/workspaces/attention-is-all-you-need/assets/fig_bleu_comparison.png', kind: 'figure', page: 1, confidence: 'high', caption: 'BLEU vs Training FLOPs' },
  ];
  for (const a of ws1Assets) {
    await prisma.asset.create({ data: a });
  }
  console.log("Attention Is All You Need workspace successfully populated!");

  // =========================================================================
  // 2. Deep Residual Learning for Image Recognition (resnet-deep-residual-learning)
  // =========================================================================
  const ws2Id = 'resnet-deep-residual-learning';
  const ws2 = await prisma.workspace.findUnique({
    where: { id: ws2Id },
    include: { outputs: true, assets: true }
  });

  if (!ws2) throw new Error("Workspace 2 not found: " + ws2Id);

  let out2 = ws2.outputs.find(o => o.isActive) || ws2.outputs[0];

  await prisma.output.update({
    where: { id: out2.id },
    data: {
      templateId: 'gemini',
      themeColor: '#0EA5E9', // Modern Deep Cyan
      isActive: true,
      title: 'Deep Residual Learning for Image Recognition',
      authors: 'Kaiming He, Xiangyu Zhang, Shaoqing Ren, Jian Sun',
      venue: 'IEEE Conference on Computer Vision and Pattern Recognition (CVPR 2016) — Best Paper Award',
    }
  });

  // Delete existing cards of this output and insert modernized cards
  await prisma.card.deleteMany({ where: { outputId: out2.id } });

  const ws2Cards = [
    // Column 1
    {
      id: 'res_c1_degradation',
      outputId: out2.id,
      title: 'The Degradation Problem',
      column: 1,
      order: 0,
      pattern: 'bullets-image',
      content: `**The Paradox of Depth:** When deeper networks start converging, a degradation problem is exposed: with network depth increasing, accuracy gets saturated and then degrades rapidly.
- **Not Overfitting:** Degradation is **not caused by overfitting** — adding more layers leads to higher *training* error, as verified across CIFAR-10 and ImageNet.
- **Optimization Obstacle:** Extremely deep standard feedforward networks cannot easily optimize identity mappings, leading to vanishing/exploding gradients during backpropagation.`,
      figureLayout: 'single',
      heightBudget: null,
      validation: 'valid',
      table: { hasHeader: false, caption: '', rows: [] },
      figures: [
        {
          id: 'fig_convergence_curves',
          url: '/api/workspaces/resnet-deep-residual-learning/assets/fig_convergence_curves.png',
          caption: 'Figure 1: Training and validation error curves on ImageNet comparing Plain-34 (which suffers severe degradation) vs. ResNet architectures.',
        }
      ],
      sourceIds: [],
    },
    {
      id: 'res_c1_residual_learning',
      outputId: out2.id,
      title: 'Residual Learning Formulation',
      column: 1,
      order: 1,
      pattern: 'bullets-image',
      content: `Instead of hoping each few stacked layers directly fit an underlying mapping $\\mathcal{H}(x)$, we explicitly let these layers approximate a residual mapping:
$$\\mathcal{F}(x) := \\mathcal{H}(x) - x \\quad \\Longrightarrow \\quad \\mathcal{H}(x) = \\mathcal{F}(x) + x$$

- **Identity Shortcuts:** Realized by feedforward neural networks with **shortcut connections** skipping one or more layers.
- **Parameter-Free:** Identity shortcuts introduce neither extra parameters nor computational complexity ($O(1)$ additions).
- **Ease of Optimization:** If identity mappings are optimal, the solvers can simply drive the weights of multiple nonlinear layers toward zero to approach identity mappings.`,
      figureLayout: 'single',
      heightBudget: null,
      validation: 'valid',
      table: { hasHeader: false, caption: '', rows: [] },
      figures: [
        {
          id: 'fig_residual_block',
          url: '/api/workspaces/resnet-deep-residual-learning/assets/fig_residual_block.png',
          caption: 'Figure 2: Residual learning building block with identity skip-connection and element-wise addition.',
        }
      ],
      sourceIds: [],
    },

    // Column 2
    {
      id: 'res_c2_arch_table',
      outputId: out2.id,
      title: 'Network Architectures & Efficiency',
      column: 2,
      order: 0,
      pattern: 'bullets-table',
      content: `Comparison of convolutional architectures on ImageNet validation (single-crop $224 \\times 224$ test). ResNet-152 is $8\\times$ deeper than VGG-16 yet has fewer FLOPs:`,
      figureLayout: 'single',
      heightBudget: null,
      validation: 'valid',
      table: {
        hasHeader: true,
        caption: 'Table 1: ImageNet validation top-1 and top-5 error rates, parameter counts, and FLOPs.',
        rows: [
          ['Architecture', 'Layers', 'Params', 'FLOPs', 'Top-1 Error', 'Top-5 Error'],
          ['VGG-16 (Simonyan et al.)', '16', '138M', '15.3G', '28.07%', '9.33%'],
          ['GoogLeNet (Szegedy et al.)', '22', '6.8M', '1.5G', '—', '9.15%'],
          ['Plain-34 (Degraded)', '34', '21.8M', '3.6G', '28.54%', '10.02%'],
          ['ResNet-34', '34', '21.8M', '3.6G', '25.03%', '7.76%'],
          ['ResNet-50 (Bottleneck)', '50', '25.6M', '3.8G', '22.85%', '6.71%'],
          ['ResNet-101 (Bottleneck)', '101', '44.5M', '7.6G', '21.75%', '6.05%'],
          ['**ResNet-152 (Deepest)**', '**152**', '**60.2M**', '**11.3G**', '**21.43%**', '**5.71%**']
        ]
      },
      figures: [],
      sourceIds: [],
    },
    {
      id: 'res_c2_gradient_flow',
      outputId: out2.id,
      title: 'Skip-Connection Gradient Dynamics',
      column: 2,
      order: 1,
      pattern: 'bullets',
      content: `The crucial theoretical mechanism enabling gradient flow across hundreds of layers:

$$\\frac{\\partial \\mathcal{E}}{\\partial x_l} = \\frac{\\partial \\mathcal{E}}{\\partial x_L} \\frac{\\partial x_L}{\\partial x_l} = \\frac{\\partial \\mathcal{E}}{\\partial x_L} \\left( 1 + \\frac{\\partial}{\\partial x_l}\\sum_{i=l}^{L-1}\\mathcal{F}(x_i, W_i) \\right)$$

- **Additive Gradient Highway:** The term $+1$ ensures that the gradient $\\frac{\\partial \\mathcal{E}}{\\partial x_L}$ is directly transmitted back to any shallow layer $x_l$, regardless of how small the weight products become.
- **Vanishing Gradients Defeated:** Even if $\\frac{\\partial \\mathcal{F}}{\\partial x_l} \\approx 0$, the gradient term cannot vanish because of the non-zero identity multiplier.`,
      figureLayout: 'single',
      heightBudget: null,
      validation: 'valid',
      table: { hasHeader: false, caption: '', rows: [] },
      figures: [],
      sourceIds: [],
    },

    // Column 3
    {
      id: 'res_c3_hero_stats',
      outputId: out2.id,
      title: 'ILSVRC & COCO 2015 Sweeping Victory',
      column: 3,
      order: 0,
      pattern: 'stats',
      content: `ResNet won **1st place in all 5 major competition tracks** in ILSVRC & COCO 2015:
- **3.57%** Top-5 Error (Surpassed human benchmark of 5.1%)
- **1st Place** 5 Competition Tracks (Classification, Detection, Loc)
- **152 Layers** Deepest Architecture (8× deeper than VGG-16)`,
      figureLayout: 'single',
      heightBudget: null,
      validation: 'valid',
      table: { hasHeader: false, caption: '', rows: [] },
      figures: [
        {
          id: 'fig_imagenet_comparison',
          url: '/api/workspaces/resnet-deep-residual-learning/assets/fig_imagenet_comparison.png',
          caption: 'Figure 3: ImageNet classification top-5 benchmark comparing deep architectures against human accuracy.',
        }
      ],
      sourceIds: [],
    },
    {
      id: 'res_c3_coco_detection',
      outputId: out2.id,
      title: 'Generalization & Visual Recognition',
      column: 3,
      order: 1,
      pattern: 'bullets',
      content: `Superior representations translate immediately to downstream vision tasks:
- **COCO Object Detection:** **+6.0% mAP** improvement over VGG-16 baseline on Faster R-CNN (28% relative boost).
- **COCO Instance Segmentation:** 1st place in MS COCO segmentation challenge.
- **PASCAL VOC 2007 & 2012:** State-of-the-art mAP across object detection and semantic segmentation benchmarks.`,
      figureLayout: 'single',
      heightBudget: null,
      validation: 'valid',
      table: { hasHeader: false, caption: '', rows: [] },
      figures: [],
      sourceIds: [],
    },
    {
      id: 'res_c3_legacy',
      outputId: out2.id,
      title: 'Legacy: The Backbone of Modern AI',
      column: 3,
      order: 2,
      pattern: 'bullets',
      content: `- **Most Cited Paper in Modern Computer Science:** Over 200,000 citations, cementing residual connections as standard infrastructure.
- **Universal Architectural Principle:** Skip connections are adopted everywhere — in Transformers, ConvNeXt, U-Net, AlphaFold, and Stable Diffusion.
- **Scaling Milestone:** Proved that asymptotic depth without degradation is possible through identity shortcuts.`,
      figureLayout: 'single',
      heightBudget: null,
      validation: 'valid',
      table: { hasHeader: false, caption: '', rows: [] },
      figures: [],
      sourceIds: [],
    }
  ];

  for (const c of ws2Cards) {
    await prisma.card.create({ data: c });
  }

  // Register assets in DB
  await prisma.asset.deleteMany({ where: { workspaceId: ws2Id } });
  const ws2Assets = [
    { id: 'ast_res_block', workspaceId: ws2Id, fileId: 'fig_residual_block.png', filename: 'fig_residual_block.png', url: '/api/workspaces/resnet-deep-residual-learning/assets/fig_residual_block.png', kind: 'figure', page: 1, confidence: 'high', caption: 'Residual Learning Block Diagram' },
    { id: 'ast_res_conv', workspaceId: ws2Id, fileId: 'fig_convergence_curves.png', filename: 'fig_convergence_curves.png', url: '/api/workspaces/resnet-deep-residual-learning/assets/fig_convergence_curves.png', kind: 'figure', page: 1, confidence: 'high', caption: 'Convergence Curves' },
    { id: 'ast_res_imgnet', workspaceId: ws2Id, fileId: 'fig_imagenet_comparison.png', filename: 'fig_imagenet_comparison.png', url: '/api/workspaces/resnet-deep-residual-learning/assets/fig_imagenet_comparison.png', kind: 'figure', page: 1, confidence: 'high', caption: 'ImageNet Top-5 Comparison' },
  ];
  for (const a of ws2Assets) {
    await prisma.asset.create({ data: a });
  }
  console.log("Deep Residual Learning workspace successfully populated!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
