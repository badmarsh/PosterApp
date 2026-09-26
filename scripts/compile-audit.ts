#!/usr/bin/env node
/**
 * compile-audit.ts — Comprehensive LaTeX template compile audit
 * Iterates all 32 templates (9 poster, 6 slides, 17 paper),
 * compiles each via the local HTTP API, and produces a Markdown report.
 */

const BASE = "http://localhost:3333"
const WORKSPACE_ID = "demo_muamm3cq"

interface TemplateEntry {
  outputType: "poster" | "slides" | "paper"
  templateId: string
}

const TEMPLATES: TemplateEntry[] = [
  // Posters (9)
  { outputType: "poster", templateId: "minimal" },
  { outputType: "poster", templateId: "conference" },
  { outputType: "poster", templateId: "atlas" },
  { outputType: "poster", templateId: "gemini" },
  { outputType: "poster", templateId: "tikzposter" },
  { outputType: "poster", templateId: "a0poster" },
  { outputType: "poster", templateId: "landscape" },
  { outputType: "poster", templateId: "betterposter" },
  { outputType: "poster", templateId: "aurora" },
  // Slides (6)
  { outputType: "slides", templateId: "beamer-metropolis" },
  { outputType: "slides", templateId: "beamer-atlas" },
  { outputType: "slides", templateId: "beamer-madrid" },
  { outputType: "slides", templateId: "beamer-default" },
  { outputType: "slides", templateId: "beamer-focus" },
  { outputType: "slides", templateId: "beamer-editorial" },
  // Papers (17)
  { outputType: "paper", templateId: "article-twocol" },
  { outputType: "paper", templateId: "article-single" },
  { outputType: "paper", templateId: "ieee-conf" },
  { outputType: "paper", templateId: "acm-sigconf" },
  { outputType: "paper", templateId: "springer-llncs" },
  { outputType: "paper", templateId: "jinst-proceedings" },
  { outputType: "paper", templateId: "pos-proceedings" },
  { outputType: "paper", templateId: "elsarticle" },
  { outputType: "paper", templateId: "revtex-aps" },
  { outputType: "paper", templateId: "epj-woc" },
  { outputType: "paper", templateId: "iopart" },
  { outputType: "paper", templateId: "neurips" },
  { outputType: "paper", templateId: "icml" },
  { outputType: "paper", templateId: "iclr" },
  { outputType: "paper", templateId: "acl" },
  { outputType: "paper", templateId: "cvpr" },
  { outputType: "paper", templateId: "aaai" },
]

interface AuditResult {
  outputType: string
  templateId: string
  status: string
  errorType: string
  errorMessage: string
  errorLine: string
  rootCause: string
  autofixHelped: string
  compileTimeMs: number
}

function classifyError(log: string, errorMsg: string): { errorType: string; rootCause: string } {
  const lowerLog = log.toLowerCase()
  const lowerMsg = errorMsg.toLowerCase()
  
  if (/undefined control sequence/i.test(errorMsg)) {
    // Extract the undefined command
    const cmdMatch = log.match(/! Undefined control sequence\.\s*(?:l\.\d+\s*)?[\s\S]*?(\\[a-zA-Z@]+)/)
    const cmd = cmdMatch?.[1] || ""
    let rootCause = "Undefined command " + cmd
    
    if (/\\tikzposter/i.test(cmd) || /tikzposter\.cls/i.test(log)) {
      rootCause = "tikzposter.cls not available in Docker/TeX image"
    } else if (/\\gemini/i.test(cmd) || /gemini/i.test(log)) {
      rootCause = "gemini theme/cls not available"  
    } else if (/\\fitmath|\\fittext/i.test(cmd)) {
      rootCause = cmd + " undefined — missing custom .sty"
    } else if (/\\usetheme/i.test(cmd)) {
      rootCause = "Beamer theme not found in TeX distribution"
    } else if (cmd) {
      rootCause = cmd + " not defined — likely missing package or .sty"
    }
    
    return { errorType: "undefined-control-sequence", rootCause }
  }
  
  if (/Missing \$|not in math mode/i.test(errorMsg)) {
    return { errorType: "missing-dollar", rootCause: "Math mode delimiter issue in card content or generator" }
  }
  
  if (/File.*not found|I can't find file/i.test(errorMsg)) {
    const fileMatch = errorMsg.match(/File [`']([^']+)'/i) || errorMsg.match(/find file [`']([^']+)'/i)
    const file = fileMatch?.[1] || "unknown"
    let rootCause = file + " not found"
    if (/\.cls$/i.test(file)) rootCause = file + " class file not in TeX distribution"
    else if (/\.sty$/i.test(file)) rootCause = file + " package not installed"
    else if (/\.bst$/i.test(file)) rootCause = file + " bibliography style not found"
    return { errorType: "file-not-found", rootCause }
  }
  
  if (/Package.*Error/i.test(errorMsg)) {
    const pkgMatch = errorMsg.match(/Package ([^ ]+) Error/i)
    return { errorType: "package-error", rootCause: (pkgMatch?.[1] || "unknown") + " package conflict or misconfiguration" }
  }
  
  if (/Emergency stop/i.test(errorMsg)) {
    // Look at preceding lines for actual cause
    const lines = log.split("\n")
    const emergIdx = lines.findIndex(l => /Emergency stop/i.test(l))
    const context = lines.slice(Math.max(0, emergIdx - 10), emergIdx).join("\n")
    let rootCause = "Fatal error — TeX cannot proceed"
    if (/File.*not found/i.test(context)) rootCause = "Fatal: required class/package file missing"
    else if (/Undefined/i.test(context)) rootCause = "Fatal: too many undefined commands"
    return { errorType: "fatal", rootCause }
  }
  
  if (/COMPILE_TIMEOUT|timed? ?out/i.test(errorMsg) || /COMPILE_TIMEOUT/i.test(log)) {
    return { errorType: "timeout", rootCause: "Compilation exceeded time limit" }
  }
  
  if (/Overfull/i.test(errorMsg)) {
    return { errorType: "overfull", rootCause: "Content overflows box — layout issue" }
  }
  
  if (/COMPILER_UNAVAILABLE/i.test(log) || /COMPILER_UNAVAILABLE/i.test(errorMsg)) {
    return { errorType: "compiler-unavailable", rootCause: "Docker/pdflatex not running" }
  }
  
  return { errorType: "other", rootCause: "Unknown — inspect full log" }
}

function extractErrorInfo(log: string): { errorMessage: string; errorLine: string } {
  const lines = log.split("\n")
  const errorLine = lines.find(l => l.startsWith("!"))
  const errorMessage = errorLine?.replace(/^!\s*/, "").slice(0, 120) ?? ""
  const lineNum = lines.find(l => /^l\.\d+/.test(l))?.match(/^l\.(\d+)/)?.[1] ?? ""
  return { errorMessage, errorLine: lineNum }
}

async function compileTemplate(entry: TemplateEntry): Promise<AuditResult> {
  const startMs = Date.now()
  
  // Use the appropriate output ID based on outputType
  const outputIdMap: Record<string, string> = {
    poster: "out_poster_muamm3cr_lppk",
    paper: "out_paper_muamm3cr_fi0p",
    slides: "out_slides_muamm3cr_bwod",
  }
  
  const outputId = outputIdMap[entry.outputType]
  
  const body = {
    forceRecompile: true,
    output: {
      id: outputId,
      outputType: entry.outputType,
      templateId: entry.templateId,
    },
  }
  
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 120_000)
    
    const resp = await fetch(BASE + "/api/workspaces/" + WORKSPACE_ID + "/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    
    clearTimeout(timeout)
    const elapsed = Date.now() - startMs
    const data = await resp.json()
    
    if (data.ok) {
      return {
        outputType: entry.outputType,
        templateId: entry.templateId,
        status: "PASS",
        errorType: "",
        errorMessage: "",
        errorLine: "",
        rootCause: "",
        autofixHelped: "",
        compileTimeMs: elapsed,
      }
    }
    
    // FAIL — extract error info
    const log = data.log || data.error?.details || data.error?.message || ""
    const { errorMessage, errorLine } = extractErrorInfo(log)
    const { errorType, rootCause } = classifyError(log, errorMessage || data.error?.message || "")
    
    return {
      outputType: entry.outputType,
      templateId: entry.templateId,
      status: "FAIL",
      errorType,
      errorMessage: errorMessage || data.error?.message || "Unknown error",
      errorLine,
      rootCause,
      autofixHelped: "",
      compileTimeMs: elapsed,
    }
  } catch (err: any) {
    const elapsed = Date.now() - startMs
    return {
      outputType: entry.outputType,
      templateId: entry.templateId,
      status: "FAIL",
      errorType: err.name === "AbortError" ? "timeout" : "network-error",
      errorMessage: err.message?.slice(0, 120) || "Network/fetch error",
      errorLine: "",
      rootCause: err.name === "AbortError" ? "Compilation timed out (>120s)" : "HTTP request failed",
      autofixHelped: "",
      compileTimeMs: elapsed,
    }
  }
}

async function main() {
  console.log("=== PosterApp LaTeX Compile Audit ===")
  console.log("Workspace: " + WORKSPACE_ID)
  console.log("Templates: " + TEMPLATES.length)
  console.log("")

  const results: AuditResult[] = []
  
  for (let i = 0; i < TEMPLATES.length; i++) {
    const entry = TEMPLATES[i]
    const label = entry.outputType + "/" + entry.templateId
    process.stdout.write("[" + (i + 1) + "/" + TEMPLATES.length + "] " + label + " ... ")
    
    const result = await compileTemplate(entry)
    results.push(result)
    
    if (result.status === "PASS") {
      console.log("PASS (" + result.compileTimeMs + "ms)")
    } else {
      console.log("FAIL: " + result.errorType + " — " + result.errorMessage.slice(0, 60))
    }
  }

  // Sort: posters first, then slides, then papers; within category PASS before FAIL
  const typeOrder: Record<string, number> = { poster: 0, slides: 1, paper: 2 }
  results.sort((a, b) => {
    const td = (typeOrder[a.outputType] ?? 9) - (typeOrder[b.outputType] ?? 9)
    if (td !== 0) return td
    const sd = (a.status === "PASS" ? 0 : 1) - (b.status === "PASS" ? 0 : 1)
    return sd
  })

  // Markdown output
  console.log("")
  console.log("## Compile Audit Results")
  console.log("")
  console.log("| # | OutputType | TemplateID | Status | ErrorType | ErrorMessage | Line | RootCause | AutofixHelped |")
  console.log("|---|------------|------------|--------|-----------|--------------|------|-----------|---------------|")
  results.forEach((r, i) => {
    const status = r.status === "PASS" ? "\u2705 PASS" : "\u274C FAIL"
    console.log("| " + (i + 1) + " | " + r.outputType + " | " + r.templateId + " | " + status + " | " + r.errorType + " | " + r.errorMessage.slice(0, 80).replace(/\|/g, "\\|") + " | " + r.errorLine + " | " + r.rootCause.replace(/\|/g, "\\|") + " | " + r.autofixHelped + " |")
  })

  // Summary stats
  const passCount = results.filter(r => r.status === "PASS").length
  const failCount = results.length - passCount
  const errorTypes = results.filter(r => r.status === "FAIL").map(r => r.errorType)
  const typeCounts: Record<string, number> = {}
  for (const t of errorTypes) typeCounts[t] = (typeCounts[t] || 0) + 1
  const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])
  
  const missingCls = results.filter(r => 
    r.rootCause.includes("class file") || r.rootCause.includes(".cls") || r.rootCause.includes("not available")
  )

  console.log("")
  console.log("## Summary")
  console.log("")
  console.log("- **Pass rate:** " + passCount + "/" + results.length + " templates (" + Math.round(passCount / results.length * 100) + "%)")
  console.log("- **Most common error type:** " + (sortedTypes[0]?.[0] || "none") + " (" + (sortedTypes[0]?.[1] || 0) + " occurrences)")
  if (sortedTypes.length > 1) {
    console.log("- **Second most common:** " + sortedTypes[1][0] + " (" + sortedTypes[1][1] + " occurrences)")
  }
  if (missingCls.length > 0) {
    console.log("- **Templates requiring missing .cls files:** " + missingCls.map(r => r.templateId).join(", "))
  }
  console.log("")
  console.log("### Error Type Distribution")
  for (const [type, count] of sortedTypes) {
    console.log("- " + type + ": " + count)
  }
  
  // JSON dump for machine parsing
  console.log("")
  console.log("<!-- AUDIT_JSON_START")
  console.log(JSON.stringify(results, null, 2))
  console.log("AUDIT_JSON_END -->")
}

main().catch(err => {
  console.error("Fatal:", err)
  process.exit(1)
})

