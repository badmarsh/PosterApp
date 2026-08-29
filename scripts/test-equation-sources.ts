import fs from "fs"
import path from "path"

function extractEquationsFromMarkdown(mdContent: string) {
  const extracted: { formula: string; title: string }[] = []
  const seen = new Set<string>()

  // Matches display math blocks $$ ... $$ or LaTeX equation environments
  const displayMathRegex = /\$\$([\s\S]+?)\$\$|\\begin\{(?:equation|align|gather|multline)\*?\}([\s\S]+?)\\end\{(?:equation|align|gather|multline)\*?\}/g
  let match
  let eqCount = 1

  while ((match = displayMathRegex.exec(mdContent)) !== null) {
    const rawFormula = (match[1] || match[2] || "").trim()
    // Skip empty or trivial formulas
    if (rawFormula.length >= 3 && !seen.has(rawFormula)) {
      seen.add(rawFormula)
      extracted.push({
        formula: rawFormula,
        title: `Equation ${eqCount++}`,
      })
    }
  }

  return extracted
}

async function testEquationSources() {
  console.log("==========================================================")
  console.log("🔬 TESTING EQUATION EXTRACTION ON REAL WORKSPACE SOURCES")
  console.log("==========================================================\n")

  const sourcesDir = path.join(process.cwd(), "workspaces", "demo_mt6u6y7a", "sources")
  if (!fs.existsSync(sourcesDir)) {
    console.log("No sources dir found.")
    return
  }

  const files = fs.readdirSync(sourcesDir).filter((f) => f.endsWith(".md"))
  console.log(`Found ${files.length} parsed markdown sources in demo workspace.\n`)

  let totalEquations = 0
  for (const file of files) {
    const fullPath = path.join(sourcesDir, file)
    const content = fs.readFileSync(fullPath, "utf-8")
    const equations = extractEquationsFromMarkdown(content)

    if (equations.length > 0) {
      console.log(`📄 Source: "${file}" (${equations.length} equations extracted):`)
      equations.slice(0, 5).forEach((eq, idx) => {
        const preview = eq.formula.replace(/\n\s*/g, " ")
        console.log(`   [${idx + 1}] ${preview.slice(0, 75)}${preview.length > 75 ? "..." : ""}`)
      })
      if (equations.length > 5) {
        console.log(`   ... and ${equations.length - 5} more equations`)
      }
      console.log()
      totalEquations += equations.length
    }
  }

  console.log("==========================================================")
  console.log(`✅ Total extracted equations across sources: ${totalEquations}`)
  console.log("==========================================================")
}

testEquationSources().catch(console.error)
