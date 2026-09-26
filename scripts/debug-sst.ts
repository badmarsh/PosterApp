import { parseMarkdownToLatex } from "../lib/latex/parser"

const line = `\\Delta$SST $= $ SST$_{\\text{subpolar}} - $SST$_{\\text{Gulf Stream}}$ \\cite{caesar2018observed}.`
console.log("Original:")
console.log(line)
console.log("Parsed:")
console.log(parseMarkdownToLatex(line))
