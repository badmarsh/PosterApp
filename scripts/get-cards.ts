import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const cards = await prisma.card.findMany({
    where: { output: { workspaceId: 'demo_mt5hymsq' } },
    select: { id: true, title: true, pattern: true, content: true }
  });
  console.log(JSON.stringify(cards, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
