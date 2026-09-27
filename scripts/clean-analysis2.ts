import { readFileSync, writeFileSync } from "fs"
import { cleanExtractedPdfMarkdown } from "../lib/services/margin-line-numbers"

const raw = readFileSync("artifacts/analysis-2/manuscript.md", "utf8")
const cleaned = cleanExtractedPdfMarkdown(raw)
writeFileSync("artifacts/analysis-2/manuscript.clean.md", cleaned.text)
console.log(JSON.stringify({
  margin: cleaned.marginLinesStripped,
  headers: cleaned.runningHeadersStripped,
  chars: cleaned.text.length,
}))
