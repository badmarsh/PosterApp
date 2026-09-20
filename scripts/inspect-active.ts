
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { prisma } from '../lib/prisma';

async function main() {
  for (const wsId of ['attention-is-all-you-need', 'resnet-deep-residual-learning']) {
    const ws = await prisma.workspace.findUnique({
      where: { id: wsId },
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
    const active = ws?.outputs.find(o => o.isActive) || ws?.outputs[0];
    console.log(`=== ${ws?.name} (${ws?.id}) ===`);
    console.log("Active Output:", active?.id, "templateId:", active?.templateId, "themeColor:", active?.themeColor);
    console.log("Assets:", ws?.assets.map(a => ({ id: a.id, name: a.name, url: a.url, type: a.type })));
    for (const c of active?.cards ?? []) {
      console.log(`  [Col ${c.column} #${c.order}] ${c.title} (pattern: ${c.pattern})`);
      console.log("    content:", c.content.slice(0, 100));
      if (c.figures) console.log("    figures:", c.figures);
      if (c.table) console.log("    table:", c.table);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

