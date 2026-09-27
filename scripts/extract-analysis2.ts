import { mkdirSync, readFileSync, writeFileSync } from "fs"
import { parsePdfWithFallback } from "../lib/services/pdf-fallback-parser"

async function main() {
  const buf = readFileSync("Analysis_2.pdf")
  console.log("pdf bytes", buf.length)
  const parsed = await parsePdfWithFallback(buf, "Analysis_2.pdf")
  mkdirSync("artifacts/analysis-2", { recursive: true })
  writeFileSync("artifacts/analysis-2/manuscript.md", parsed.md_content)
  console.log("pages", parsed.pageCount, "chars", parsed.md_content.length)
  console.log("--- head ---")
  console.log(parsed.md_content.slice(0, 3000))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
