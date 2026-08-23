import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const significaId = "user_3IGDYw03LkmHZaaCgKwWcBYxHQu";
  
  // 1. Delete the bad tutorial workspace
  await prisma.workspace.delete({
    where: { id: "workspace_tutorial_demo" }
  }).catch(() => console.log('Tutorial workspace already deleted'));
  
  // 2. Reassign the good CoRL workspace to the user
  await prisma.workspace.update({
    where: { id: "demo_mt5hymsq" },
    data: { userId: significaId }
  });
  
  console.log('Restored CoRL workspace and removed tutorial.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
