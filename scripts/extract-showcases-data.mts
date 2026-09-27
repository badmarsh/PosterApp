/**
 * One-shot extraction: lib/showcases-data.ts -> data/showcases/*.json
 * Run: pnpm exec tsx scripts/extract-showcases-data.mts
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { ELITE_SHOWCASES, ALL_SHOWCASE_PROJECTS } from "../lib/showcases-data.ts"

mkdirSync("data/showcases", { recursive: true })

writeFileSync(
  "data/showcases/elite-showcases.json",
  JSON.stringify(ELITE_SHOWCASES, null, 2) + "\n",
)
writeFileSync(
  "data/showcases/all-showcase-projects.json",
  JSON.stringify(ALL_SHOWCASE_PROJECTS, null, 2) + "\n",
)

console.log(`elite-showcases: ${ELITE_SHOWCASES.length} entries`)
console.log(`all-showcase-projects: ${ALL_SHOWCASE_PROJECTS.length} projects`)
