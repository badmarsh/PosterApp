
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { prisma } from '../lib/prisma';

async function main() {
  // Update WS1 c3_hero_stats
  await prisma.card.update({
    where: { id: 'c3_hero_stats' },
    data: {
      content: `Key milestone results establishing the Transformer as the dominant sequence transduction paradigm:
- **28.4** | BLEU (EN-DE) | +2.0 over prior SOTA
- **41.0** | BLEU (EN-FR) | Record benchmark
- **3.5 d** | Training Time | 8 × P100 GPUs`
    }
  });

  // Update WS2 res_c3_hero_stats
  await prisma.card.update({
    where: { id: 'res_c3_hero_stats' },
    data: {
      content: `ResNet won **1st place in all 5 major competition tracks** in ILSVRC & COCO 2015:
- **3.57%** | Top-5 Error | Surpassed human 5.1%
- **1st** | 5 Tracks Winner | All ILSVRC & COCO tasks
- **152** | Layers | 8× deeper than VGG-16`
    }
  });

  // Check if res_c2_bottleneck exists
  const existingBottleneck = await prisma.card.findUnique({ where: { id: 'res_c2_bottleneck' } });
  const ws2 = await prisma.workspace.findUnique({ where: { id: 'resnet-deep-residual-learning' }, include: { outputs: true } });
  const out2 = ws2?.outputs.find(o => o.isActive) || ws2?.outputs[0];

  if (!existingBottleneck && out2) {
    await prisma.card.create({
      data: {
        id: 'res_c2_bottleneck',
        outputId: out2.id,
        title: 'Bottleneck Design for Extreme Depth',
        column: 2,
        order: 2,
        pattern: 'bullets',
        content: `- **Dimension Reduction:** Uses $1 \\times 1$ conv to reduce feature dimensions (e.g. $256 \\to 64$), keeping computational cost bounded.
- **Efficient Spatial Features:** Computes $3 \\times 3$ conv on the reduced bottleneck representation.
- **Dimension Restoration:** Uses $1 \\times 1$ conv to restore channels ($64 \\to 256$) before the residual addition.
- **Lower FLOPs than VGG:** Enables ResNet-152 (11.3 GFLOPs) to remain computationally lighter than VGG-16 (15.3 GFLOPs) despite an $8\\times$ increase in depth.`,
        figureLayout: 'single',
        heightBudget: null,
        validation: 'valid',
        table: { hasHeader: false, caption: '', rows: [] },
        figures: [],
        sourceIds: [],
      }
    });
  }

  console.log("Direct update complete!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
