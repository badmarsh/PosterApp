
import fs from 'fs';
const file = 'scripts/populate_showcases.ts';
let content = fs.readFileSync(file, 'utf8');

// WS1 metrics
content = content.replace(
  `- **28.4 BLEU** EN-DE Translation (+2.0 over prior SOTA)\n- **41.0 BLEU** EN-FR Translation (Record single-model benchmark)\n- **3.5 Days** Training Time (8 × NVIDIA P100 GPUs)`,
  `- **28.4** | BLEU (EN-DE) | +2.0 over prior SOTA\n- **41.0** | BLEU (EN-FR) | Record benchmark\n- **3.5 d** | Training Time | 8 × P100 GPUs`
);

// WS2 metrics
content = content.replace(
  `- **3.57%** Top-5 Error (Surpassed human benchmark of 5.1%)\n- **1st Place** 5 Competition Tracks (Classification, Detection, Loc)\n- **152 Layers** Deepest Architecture (8× deeper than VGG-16)`,
  `- **3.57%** | Top-5 Error | Surpassed human 5.1%\n- **1st** | 5 Tracks Winner | All ILSVRC & COCO tasks\n- **152** | Layers | 8× deeper than VGG-16`
);

// Add Card 3 to WS2 Column 2
const bottleneckCard = `,
    {
      id: 'res_c2_bottleneck',
      outputId: out2.id,
      title: 'Bottleneck Design for Extreme Depth',
      column: 2,
      order: 2,
      pattern: 'bullets',
      content: `- **Dimension Reduction:** Uses $1 \\\\times 1$ conv to reduce feature dimensions (e.g. $256 \\\\to 64$), keeping computational cost bounded.
- **Efficient Spatial Features:** Applies $3 \\\\times 3$ conv on the reduced bottleneck representations.
- **Dimension Restoration:** Uses $1 \\\\times 1$ conv to restore channels ($64 \\\\to 256$) before the residual addition.
- **Lower FLOPs than VGG:** Enables ResNet-152 (11.3 GFLOPs) to remain computationally lighter than VGG-16 (15.3 GFLOPs) despite an $8\\\\times$ increase in depth.`,
      figureLayout: 'single',
      heightBudget: null,
      validation: 'valid',
      table: { hasHeader: false, caption: '', rows: [] },
      figures: [],
      sourceIds: [],
    }`;

content = content.replace("id: 'res_c2_gradient_flow',\n      outputId: out2.id,[\s\S]*?sourceIds: \[\]\n    \}", (m) => m + bottleneckCard);

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully updated populate script');
