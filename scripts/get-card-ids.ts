import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const w = await prisma.workspace.findUnique({
    where: { id: 'demo_mt5hymsq' },
    include: { outputs: { include: { cards: true } } }
  });
  console.log(JSON.stringify(w?.outputs[0]?.cards.map(c => ({ id: c.id, pattern: c.pattern })), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
