import { ALL_SHOWCASE_PROJECTS } from "../lib/showcases-data"
import { parseMarkdownToLatex } from "../lib/latex/parser"

const s = ALL_SHOWCASE_PROJECTS.find((p) => p.id === "landscape-ocean-circulation")!
const poster = s.outputs.find((o) => o.id === "out_landscape_poster")!
console.log("LANDSCAPE POSTER:")
poster.cards.forEach((c) => {
  const parsed = parseMarkdownToLatex(c.content)
  if (parsed.includes("\\$") || parsed.includes("Missing") || parsed.includes("fitinline")) {
    console.log(`--- Card ${c.id} (${c.title}) ---`)
    console.log(parsed)
  }
})

const paper = s.outputs.find((o) => o.id === "out_landscape_paper")!
console.log("\nLANDSCAPE PAPER:")
paper.cards.forEach((c) => {
  const parsed = parseMarkdownToLatex(c.content)
  console.log(`--- Card ${c.id} (${c.title}) [${c.pattern}] ---`)
  console.log(parsed)
})
