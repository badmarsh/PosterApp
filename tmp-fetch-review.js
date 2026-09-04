const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const latestReview = await prisma.thesisReview.findFirst({
    orderBy: { createdAt: 'desc' },
    include: {
      workspace: true
    }
  });

  if (!latestReview) {
    console.log('No reviews found in the database.');
    return;
  }

  console.log(JSON.stringify(latestReview, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
