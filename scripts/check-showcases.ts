import { ALL_SHOWCASE_PROJECTS } from "../lib/showcases-data"
import { generateLatexForCard } from "../lib/latex/generator-poster"

const cas13 = ALL_SHOWCASE_PROJECTS.find((p) => p.id === "cas13-panviral-immunity")
const poster = cas13!.outputs.find((o) => o.id === "out_cas13_poster")!
poster.cards.forEach((c, idx) => {
  const tex = generateLatexForCard(c, cas13!.id, [], "gemini", false)
  if (tex.includes("\\n")) {
    console.log(`Card ${idx} (${c.id}) has \\n:`)
    const i = tex.indexOf("\\n")
    console.log(tex.slice(Math.max(0, i - 40), i + 60))
  }
})
