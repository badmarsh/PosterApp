import { ALL_SHOWCASE_PROJECTS } from "../lib/showcases-data"
import { parseMarkdownToLatex } from "../lib/latex/parser"

const s = ALL_SHOWCASE_PROJECTS.find((p) => p.id === "betterposter-single-cell-atlas")!
const out = s.outputs.find((o) => o.id === "out_betterposter_paper")!
const card = out.cards.find((c) => c.title === "Trajectory Inference")!

console.log("RAW CONTENT:")
console.log(card.content)
console.log("\nPARSED LATEX:")
console.log(parseMarkdownToLatex(card.content))
