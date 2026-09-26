import { ALL_SHOWCASE_PROJECTS } from "../lib/showcases-data"
import { compileWorkspace } from "../lib/latex/compile-workspace"

async function testAll() {
  console.log("Testing compilation baseline for all showcases...")
  const results = []
  for (const s of ALL_SHOWCASE_PROJECTS) {
    for (const out of s.outputs) {
      if (out.outputType === "thesis-review") continue
      process.stdout.write(`Compiling ${s.id} -> ${out.outputType} (${out.id}, template: ${out.templateId})... `)
      try {
        const res = await compileWorkspace(s.id, {
          output: out,
          cards: out.cards,
          installPdf: false,
          forceRecompile: true,
          timeoutMs: 60000,
        })
        if (res.ok) {
          console.log("OK")
          results.push({ id: s.id, type: out.outputType, outId: out.id, ok: true })
        } else {
          console.log("FAILED")
          const lines = (res.log || "").split("\n")
          const errLines = lines.filter((l) => l.startsWith("!") || l.includes("Error:")).slice(0, 5).join(" | ")
          console.log("   -->", errLines || res.error?.message || "No error line found in log")
          results.push({ id: s.id, type: out.outputType, outId: out.id, ok: false, error: errLines || res.error?.message, log: res.log })
        }
      } catch (err: any) {
        console.log("ERROR EXCEPTION:", err.message)
        results.push({ id: s.id, type: out.outputType, outId: out.id, ok: false, error: err.message })
      }
    }
  }
  const passed = results.filter((r) => r.ok).length
  console.log(`\n========================================`)
  console.log(`Summary: ${passed}/${results.length} passed.`)
  console.log(`========================================`)
  if (results.some((r) => !r.ok)) {
    console.log("Failures:")
    for (const r of results.filter((r) => !r.ok)) {
      console.log(` - ${r.id} [${r.type}] (${r.outId}): ${r.error}`)
    }
  }
  process.exit(0)
}

testAll()
