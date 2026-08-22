const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.workspace.findMany().then(r => {
  console.log(JSON.stringify(r.map(w => ({ id: w.id, name: w.name, userId: w.userId })), null, 2));
  prisma.$disconnect();
}).catch(e => {
  console.error(e);
  prisma.$disconnect();
});
