import { ALL_SHOWCASE_PROJECTS } from "../lib/showcases-data"

const failedKeys = [
  { ws: "landscape-ocean-circulation", out: "out_landscape_paper" },
]

async function debugFailed() {
  for (const { ws, out: outId } of failedKeys) {
    console.log(`\n======================================================`)
    console.log(`DEBUGGING ${ws} (${outId})`)
    console.log(`======================================================`)
    const s = ALL_SHOWCASE_PROJECTS.find((p) => p.id === ws)!
    const out = s.outputs.find((o) => o.id === outId)!

    const res = await fetch(`http://localhost:3333/api/workspaces/${ws}/compile?revision=1`, {
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
    console.log(`HTTP ${res.status}, ok: ${data.ok}`)
    const log = data.log || data.error?.details || ""
    const lines = log.split("\n")
    const errorIndices = lines
      .map((l: string, i: number) => (l.startsWith("!") || l.includes("Error:") ? i : -1))
      .filter((i: number) => i !== -1)
    console.log(`Found ${errorIndices.length} error lines.`)
    for (const idx of errorIndices) {
      console.log(`--- Error at line ${idx} ---`)
      const start = Math.max(0, idx - 10)
      const end = Math.min(lines.length, idx + 20)
      console.log(lines.slice(start, end).join("\n"))
    }
  }
}

debugFailed()
