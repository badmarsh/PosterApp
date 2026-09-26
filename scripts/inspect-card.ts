import { ALL_SHOWCASE_PROJECTS } from "../lib/showcases-data"
import { generateLatexForCard } from "../lib/latex/generator-poster"

const atlas = ALL_SHOWCASE_PROJECTS.find((p) => p.id === "atlas-bose-einstein-correlations")
const poster = atlas!.outputs.find((o) => o.id === "out_atlas_poster")!
console.log("Cards count:", poster.cards.length)
poster.cards.forEach((card, i) => {
  console.log(`--- CARD ${i} [${card.id}] "${card.title}" ---`)
  const tex = generateLatexForCard(card, atlas!.id, [], "atlas", false)
  console.log(tex)
})
