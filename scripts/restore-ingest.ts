import fs from "fs"
import path from "path"
import { prisma } from "../lib/prisma"

async function main() {
  const workspacesDir = path.join(process.cwd(), "workspaces")
  const dirs = fs.readdirSync(workspacesDir)
  for (const dir of dirs) {
    const wsPath = path.join(workspacesDir, dir)
    if (!fs.statSync(wsPath).isDirectory()) continue
    
    const sourcesDir = path.join(wsPath, "sources")
    if (!fs.existsSync(sourcesDir)) continue
    
    const files = fs.readdirSync(sourcesDir)
    for (const file of files) {
      if (!file.endsWith(".md")) continue
      const fileId = file.replace(".md", "")
      
      const existing = await prisma.ingestFile.findUnique({ where: { id: fileId }})
      if (!existing) {
        console.log(`Restoring ingest file: ${fileId} in workspace ${dir}`)
        await prisma.ingestFile.create({
          data: {
            id: fileId,
            workspaceId: dir,
            name: `Recovered Document (${fileId}).pdf`,
            size: 0,
            method: "mineru",
            status: "done",
            progress: 100
          }
        })
      }
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect())
