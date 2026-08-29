import { prisma } from "@/lib/prisma"

async function listEquations() {
  const eqs = await prisma.asset.findMany({
    where: { kind: "equation" },
    orderBy: { id: "asc" },
  })

  console.log(`Found ${eqs.length} extracted equations in database:\n`)
  for (let i = 0; i < eqs.length; i++) {
    const eq = eqs[i]
    console.log(`[${i + 1}] ID: ${eq.id}`)
    console.log(`    Caption: "${eq.caption}"`)
    console.log(`    Formula: ${eq.snippet}\n`)
  }

  await prisma.$disconnect()
}

listEquations().catch(console.error)
