import { ALL_SHOWCASE_PROJECTS } from "../lib/showcases-data"

async function run() {
  console.log("====================================================")
  console.log("Testing compilation for all showcases via HTTP API...")
  console.log("====================================================\n")

  const results: Array<{
    wsId: string
    outputType: string
    outId: string
    templateId: string
    ok: boolean
    status: number
    error?: string
    logSnippet?: string
  }> = []

  for (const s of ALL_SHOWCASE_PROJECTS) {
    for (const out of s.outputs) {
      if (out.outputType === "thesis-review") continue

      const label = `${s.id} -> ${out.outputType} (${out.templateId})`
      process.stdout.write(`Compiling ${label}... `)

      try {
        const res = await fetch(`http://localhost:3333/api/workspaces/${s.id}/compile?revision=1`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cards: out.cards,
            output: {
              id: out.id,
              outputType: out.outputType,
              templateId: (out as any).templateId,
              themeColor: (out as any).themeColor,
            },
            forceRecompile: true,
          }),
        })

        const data = await res.json().catch(() => ({}))

        if (res.ok && data.ok) {
          console.log("✅ OK")
          results.push({
            wsId: s.id,
            outputType: out.outputType,
            outId: out.id,
            templateId: (out as any).templateId,
            ok: true,
            status: res.status,
          })
        } else {
          console.log(`❌ FAILED (HTTP ${res.status})`)
          const log = data.log || data.error?.details || ""
          const lines = log.split("\n")
          const errLines = lines
            .filter((l: string) => l.startsWith("!") || l.includes("Error") || l.includes("Emergency stop"))
            .slice(0, 3)
            .join(" | ")
          const errMsg = data.error?.message || errLines || "Unknown failure"
          console.log(`   Error: ${errMsg}`)
          results.push({
            wsId: s.id,
            outputType: out.outputType,
            outId: out.id,
            templateId: (out as any).templateId,
            ok: false,
            status: res.status,
            error: errMsg,
            logSnippet: log.slice(-1000),
          })
        }
      } catch (err: any) {
        console.log(`💥 NETWORK ERROR: ${err.message}`)
        results.push({
          wsId: s.id,
          outputType: out.outputType,
          outId: out.id,
          templateId: (out as any).templateId,
          ok: false,
          status: 0,
          error: err.message,
        })
      }
    }
  }

  console.log("\n====================================================")
  const passed = results.filter((r) => r.ok).length
  console.log(`RESULTS: ${passed}/${results.length} PASSED`)
  console.log("====================================================\n")

  const failed = results.filter((r) => !r.ok)
  if (failed.length > 0) {
    console.log(`FAILURES (${failed.length}):`)
    failed.forEach((f) => {
      console.log(`\n--- [${f.wsId}] ${f.outputType} (${f.templateId}) ---`)
      console.log(`Error: ${f.error}`)
      if (f.logSnippet) {
        console.log(`Log:\n${f.logSnippet}`)
      }
    })
  }

  process.exit(0)
}

run()
