import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"
import { parseBibKeys } from "../lib/bib-parser"

const prisma = new PrismaClient()

async function main() {
  const workspacesDir = path.join(process.cwd(), "workspaces")
  const workspaces = fs.readdirSync(workspacesDir)
  
  for (const ws of workspaces) {
    const bibPath = path.join(workspacesDir, ws, "references.bib")
    if (fs.existsSync(bibPath)) {
      const bib = fs.readFileSync(bibPath, "utf-8")
      const keys = parseBibKeys(bib)
      await prisma.workspace.update({
        where: { id: ws },
        data: { 
          bibContent: bib,
          bibKeys: JSON.stringify(keys)
        }
      })
      console.log(`Restored bib for ${ws}`)
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
