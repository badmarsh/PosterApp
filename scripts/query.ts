import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const w = await prisma.workspace.findMany();
  console.log('Workspaces:', w.map(x=>({id:x.id, name:x.name})));
  
  const o = await prisma.output.findMany({include:{workspace:true}});
  console.log('Outputs:', o.map(x=>({id:x.id, wId:x.workspaceId, title:x.title, type:x.outputType, templateId:x.templateId, wName: x.workspace.name})));
}

run().finally(() => prisma.$disconnect());
