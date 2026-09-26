import fs from "fs"
import path from "path"

// 1. Patch templates.ts for IEEEtran safety
const templatesPath = path.join(process.cwd(), "lib/latex/templates.ts")
let templatesContent = fs.readFileSync(templatesPath, "utf8")

const ieeeTarget = /\\usepackage\{booktabs\}\s*(\r?\n)\s*\$\{FITMATH_MACRO\}/
const ieeeReplacement = `\\usepackage{booktabs}$1$1% Safety: prevent IEEEtran from crashing on empty bibliography$1\\makeatletter$1\\def\\endthebibliography{\\let\\@noitemerr\\relax\\endlist}$1\\makeatother$1$1\${FITMATH_MACRO}`

if (ieeeTarget.test(templatesContent)) {
  templatesContent = templatesContent.replace(ieeeTarget, ieeeReplacement)
  fs.writeFileSync(templatesPath, templatesContent, "utf8")
  console.log("Successfully patched lib/latex/templates.ts")
} else {
  console.log("Pattern not found in lib/latex/templates.ts (may already be patched)")
}

// 2. Patch showcases-data.ts for landscape-ocean-circulation
const showcasesPath = path.join(process.cwd(), "lib/showcases-data.ts")
let showcasesContent = fs.readFileSync(showcasesPath, "utf8")

// Fix SST dipole formula
const targetIdx = showcasesContent.indexOf("plus fingerprint SST dipole")
if (targetIdx !== -1) {
  const endIdx = showcasesContent.indexOf("\\\\cite{caesar2018observed}", targetIdx)
  if (endIdx !== -1) {
    const chunk = showcasesContent.slice(targetIdx, endIdx)
    showcasesContent = showcasesContent.replace(
      chunk,
      "plus fingerprint SST dipole $\\\\Delta\\\\text{SST} = \\\\text{SST}_{\\\\text{subpolar}} - \\\\text{SST}_{\\\\text{Gulf Stream}}$ "
    )
    console.log("Successfully replaced SST dipole formula via substring slicing")
  }
}

// Fix card_landscape_references_citations & card_landscape_paper_references
const bibEntries = `@article{weijer2019atlantic,\\n  title={Stability of the Atlantic Meridional Overturning Circulation},\\n  author={Weijer, Wilbert and others},\\n  journal={Rev. Geophys.},\\n  volume={57},\\n  pages={675--709},\\n  year={2019}\\n}\\n\\n@article{caesar2018observed,\\n  title={Observed fingerprint of a weakening Atlantic Ocean overturning circulation},\\n  author={Caesar, Levke and others},\\n  journal={Nature},\\n  volume={556},\\n  pages={191--196},\\n  year={2018}\\n}\\n\\n@article{boettner2021critical,\\n  title={Critical slowing down in the Atlantic Meridional Overturning Circulation},\\n  author={B{\\"o}ttner, Christoph and Boers, Niklas},\\n  journal={Nat. Clim. Change},\\n  volume={11},\\n  pages={680--688},\\n  year={2021}\\n}\\n\\n@article{ditlevsen2023warning,\\n  title={Warning of a forthcoming collapse of the Atlantic meridional overturning circulation},\\n  author={Ditlevsen, Peter and Ditlevsen, Susanne},\\n  journal={Nat. Commun.},\\n  volume={14},\\n  pages={4254},\\n  year={2023}\\n}`

const refPosterOld = `"id": "card_landscape_references_citations",\\r?\\n\\s*"title": "References",\\r?\\n\\s*"pattern": "references",\\r?\\n\\s*"content": "\\\\cite\\{weijer2019atlantic,caesar2018observed,boettner2021critical\\}"`
const refPosterRegex = new RegExp(refPosterOld)

const refPosterNew = `"id": "card_landscape_references_citations",\n            "title": "References",\n            "pattern": "references",\n            "content": "${bibEntries}"`

showcasesContent = showcasesContent.replace(refPosterRegex, refPosterNew)

const refPaperOld = `"id": "card_landscape_paper_references",\\r?\\n\\s*"title": "References",\\r?\\n\\s*"pattern": "references",\\r?\\n\\s*"content": "\\\\cite\\{weijer2019atlantic,caesar2018observed,boettner2021critical,ditlevsen2023warning\\}"`
const refPaperRegex = new RegExp(refPaperOld)

const refPaperNew = `"id": "card_landscape_paper_references",\n            "title": "References",\n            "pattern": "references",\n            "content": "${bibEntries}"`

showcasesContent = showcasesContent.replace(refPaperRegex, refPaperNew)

fs.writeFileSync(showcasesPath, showcasesContent, "utf8")
console.log("Successfully patched lib/showcases-data.ts")
