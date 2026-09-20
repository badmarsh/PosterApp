
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { prisma } from '../lib/prisma';

async function main() {
  const ws1 = await prisma.workspace.findUnique({
    where: { id: 'attention-is-all-you-need' },
    include: {
      outputs: {
        include: {
          cards: {
            orderBy: [{ column: 'asc' }, { order: 'asc' }]
          }
        }
      },
      assets: true
    }
  });

  const ws2 = await prisma.workspace.findUnique({
    where: { id: 'resnet-deep-residual-learning' },
    include: {
      outputs: {
        include: {
          cards: {
            orderBy: [{ column: 'asc' }, { order: 'asc' }]
          }
        }
      },
      assets: true
    }
  });

  console.log("=== WS1 (Attention) ===");
  console.log("ID:", ws1?.id, "Name:", ws1?.name, "Authors:", ws1?.authors, "Venue:", ws1?.venue);
  console.log("Outputs:", ws1?.outputs.map(o => ({ id: o.id, name: o.name, templateId: o.templateId, themeColor: o.themeColor, isActive: o.isActive, cardsCount: o.cards.length })));
  if (ws1?.outputs?.[0]) {
    console.log("Cards in Output 0:");
    for (const c of ws1.outputs[0].cards) {
      console.log(`  [Col ${c.column} #${c.order}] ${c.title} (pattern: ${c.pattern})`);
    }
  }

  console.log("\n=== WS2 (ResNet) ===");
  console.log("ID:", ws2?.id, "Name:", ws2?.name, "Authors:", ws2?.authors, "Venue:", ws2?.venue);
  console.log("Outputs:", ws2?.outputs.map(o => ({ id: o.id, name: o.name, templateId: o.templateId, themeColor: o.themeColor, isActive: o.isActive, cardsCount: o.cards.length })));
  if (ws2?.outputs?.[0]) {
    console.log("Cards in Output 0:");
    for (const c of ws2.outputs[0].cards) {
      console.log(`  [Col ${c.column} #${c.order}] ${c.title} (pattern: ${c.pattern})`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

