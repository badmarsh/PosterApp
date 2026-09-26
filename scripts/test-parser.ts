import { extractMath, parseMarkdownToLatex } from "../lib/latex/parser"

const test1 = "achieves provable $(1 - 1/e)$ approximation bound."
console.log("extractMath test1:", extractMath(test1))
console.log("parseMarkdownToLatex test1:", parseMarkdownToLatex(test1))

const test2 = "confirmed in $e^+e^-$, $ep$, and hadronic collisions"
console.log("extractMath test2:", extractMath(test2))
console.log("parseMarkdownToLatex test2:", parseMarkdownToLatex(test2))
