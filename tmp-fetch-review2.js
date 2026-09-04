const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const reviews = await prisma.thesisReview.findMany({
    orderBy: { createdAt: 'desc' },
    take: 1
  });

  if (reviews.length === 0) {
    console.log('No reviews found.');
    return;
  }

  const review = reviews[0];
  console.log('Review ID:', review.id);
  console.log('Created At:', review.createdAt);
  
  // Parse finding structure
  const findings = typeof review.findings === 'string' ? JSON.parse(review.findings) : review.findings;
  
  const relevantFindings = findings.filter(f => {
    const text = JSON.stringify(f).toLowerCase();
    return text.includes('bose') || text.includes('einstein') || text.includes('qcd') || text.includes('plane wave');
  });

  console.log('\n--- Relevant Findings ---');
  console.log(JSON.stringify(relevantFindings, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
