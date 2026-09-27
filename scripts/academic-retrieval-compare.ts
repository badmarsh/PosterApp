/**
 * Merge two Academic Connector benchmark artifacts into a before/after comparison.
 *
 *   pnpm exec tsx scripts/academic-retrieval-compare.ts \
 *     artifacts/academic-retrieval-audit-2026-09-27/baseline.json \
 *     artifacts/academic-retrieval-audit-2026-09-27/optimized.json \
 *     artifacts/academic-retrieval-audit-2026-09-27/comparison.json
 *
 * Writes `comparison.json` and prints Markdown tables (pasted into report.md).
 * Artifacts are produced by the benchmark test with ACADEMIC_WRITE_ARTIFACTS=<name>.
 */

import fs from "node:fs"
import path from "node:path"
import { compareReports, type GoldenRunReport } from "../lib/services/academic-retrieval-eval"
import { RANKING_TUNABLES } from "../lib/services/academic-connector"
import { ACADEMIC_TIMEOUTS_MS } from "../lib/services/academic-http"

const [baselinePath, optimizedPath, outPath] = process.argv.slice(2)
if (!baselinePath || !optimizedPath) {
  console.error("usage: tsx scripts/academic-retrieval-compare.ts <baseline.json> <optimized.json> [comparison.json]")
  process.exit(1)
}

const read = (p: string): GoldenRunReport => JSON.parse(fs.readFileSync(path.resolve(p), "utf8")) as GoldenRunReport
const baseline = read(baselinePath)
const optimized = read(optimizedPath)
const comparison = compareReports(baseline, optimized)

const fmt = (v: number | null, metric: string) => {
  if (v === null) return "n/a"
  if (/Rows|Leaks|violations|unavailable/i.test(metric)) return String(Math.round(v))
  return v.toFixed(3)
}
const arrow = { up: "▲ better", down: "▼ worse", same: "=", "n/a": "n/a" } as const

const lines: string[] = []
lines.push("| Metric | Baseline | Optimized | Δ | |")
lines.push("|---|---:|---:|---:|---|")
for (const row of comparison.aggregate) {
  const delta = row.delta === null ? "n/a" : (row.delta >= 0 ? "+" : "") + fmt(row.delta, row.metric)
  lines.push(`| ${row.metric} | ${fmt(row.baseline, row.metric)} | ${fmt(row.optimized, row.metric)} | ${delta} | ${arrow[row.better]} |`)
}
lines.push("")
lines.push("| Case | Baseline top-3 | Optimized top-3 | Baseline violations | Optimized violations |")
lines.push("|---|---|---|---|---|")
for (const q of comparison.perQuery) {
  const cell = (xs: string[]) => xs.map((x, i) => `${i + 1}. ${x}`).join("<br>") || "—"
  lines.push(`| ${q.id} | ${cell(q.baselineTop)} | ${cell(q.optimizedTop)} | ${q.baselineViolations.join("; ") || "—"} | ${q.optimizedViolations.join("; ") || "—"} |`)
}
lines.push("")
lines.push("| Citation | Baseline | Optimized | Pass (base → opt) |")
lines.push("|---|---|---|---|")
for (const c of comparison.citations) {
  lines.push(`| ${c.id} | ${c.baseline} | ${c.optimized} | ${c.baselinePass ? "✅" : "❌"} → ${c.optimizedPass ? "✅" : "❌"} |`)
}

const output = {
  generatedAt: new Date().toISOString(),
  mode: { baseline: baseline.mode, optimized: optimized.mode },
  tunables: { ranking: RANKING_TUNABLES, timeoutsMs: ACADEMIC_TIMEOUTS_MS },
  ...comparison,
  markdown: lines.join("\n"),
}

if (outPath) {
  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true })
  fs.writeFileSync(path.resolve(outPath), JSON.stringify(output, null, 2))
  console.error(`wrote ${outPath}`)
}
console.log(lines.join("\n"))
