import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const workspaces = await prisma.workspace.findMany({
    select: { id: true, userId: true, name: true }
  });
  console.log(JSON.stringify(workspaces, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
