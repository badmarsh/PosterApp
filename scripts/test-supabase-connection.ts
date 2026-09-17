import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: ["error", "warn"],
});

async function main() {
  console.log("=== Testing Supabase Connection with Prisma ===");

  // 1. Check workspace count
  const workspaceCount = await prisma.workspace.count();
  console.log(`[PASS] Total Workspaces in Supabase: ${workspaceCount}`);

  // 2. Fetch sample workspaces
  const sampleWorkspaces = await prisma.workspace.findMany({
    take: 3,
    select: {
      id: true,
      name: true,
      authors: true,
      venue: true,
      _count: {
        select: {
          outputs: true,
          assets: true,
          documentChunks: true,
        },
      },
    },
  });
  console.log("[PASS] Sample workspaces:", JSON.stringify(sampleWorkspaces, null, 2));

  // 3. Check DocumentChunk count and vector embeddings
  const chunkCount = await prisma.documentChunk.count();
  console.log(`[PASS] Total DocumentChunks: ${chunkCount}`);

  // 4. Test vector cosine distance query via Prisma $queryRaw
  const vectorTest: any[] = await prisma.$queryRaw`
    SELECT id, "workspaceId", heading, 1 - (embedding <=> (SELECT embedding FROM "DocumentChunk" WHERE embedding IS NOT NULL LIMIT 1)) as similarity
    FROM "DocumentChunk"
    WHERE embedding IS NOT NULL
    ORDER BY similarity DESC
    LIMIT 3;
  `;
  console.log("[PASS] Vector similarity search query via Prisma:", vectorTest);

  // 5. Test Write / Transaction (create temporary workspace and remove it)
  const testId = `test-supabase-${Date.now()}`;
  const created = await prisma.workspace.create({
    data: {
      id: testId,
      name: "Supabase Migration Verification",
      authors: "Tester",
      venue: "Cloud Test",
      userId: "test-user-id",
    },
  });
  console.log(`[PASS] Successfully created test workspace: ${created.id}`);

  // 6. Delete the test workspace
  await prisma.workspace.delete({
    where: { id: testId },
  });
  console.log(`[PASS] Successfully cleaned up test workspace: ${testId}`);

  console.log("\n=== ALL SUPABASE PRISMA TESTS PASSED SUCCESSFULLY! ===");
}

main()
  .catch((e) => {
    console.error("Migration test failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
