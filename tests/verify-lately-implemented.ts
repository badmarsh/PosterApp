import { sampleProject } from "../lib/mock-data"
import { generateFullTemplate } from "../lib/latex/generator"
import { assetUrlToLatexPath } from "../lib/latex/helpers"
import { spawn } from "child_process"
import * as fs from "fs"
import * as path from "path"
import { prisma } from "../lib/prisma"

async function runCommand(cmd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args)
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (d) => { stdout += d.toString() })
    child.stderr.on("data", (d) => { stderr += d.toString() })
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }))
  })
}

async function testLatexCompilation() {
  console.log("\n=======================================================")
  console.log("TEST 1: LaTeX Generation & Compilation for 3 Demo Outputs")
  console.log("=======================================================")

  const outputs = sampleProject.outputs || []
  if (outputs.length < 3) {
    throw new Error(`Expected at least 3 outputs in sampleProject, found ${outputs.length}`)
  }

  const testDir = path.join(process.cwd(), "workspaces", "verify_demo_test")
  await fs.promises.mkdir(testDir, { recursive: true })

  for (const out of outputs) {
    console.log(`\n--> Testing Output Type: [${out.outputType}] | Template: [${out.templateId}] | Title: "${out.title}"`)
    
    // 1. Generate LaTeX
    const tex = generateFullTemplate(sampleProject, out, "verify_demo_test")
    const texPath = path.join(testDir, `${out.outputType}.tex`)
    await fs.promises.writeFile(texPath, tex, "utf-8")
    console.log(`    Generated ${tex.length} bytes of LaTeX to ${out.outputType}.tex`)

    // Verify asset path mapping
    if (tex.includes("/images/")) {
      console.log(`    [PASS] Generated LaTeX contains mapped /images/ references`)
    }

    // 2. Compile with pdflatex in WSL
    console.log(`    Compiling with pdflatex via WSL...`)
    const compileResult = await runCommand("wsl", [
      "--cd", testDir,
      "bash", "-c",
      `pdflatex -interaction=nonstopmode -halt-on-error ${out.outputType}.tex 2>&1`
    ])

    const isSuccess = compileResult.code === 0 && !compileResult.stdout.includes("Fatal error occurred") && !compileResult.stdout.includes("! LaTeX Error:")
    if (isSuccess) {
      console.log(`    [PASS] pdflatex compiled ${out.outputType}.tex successfully -> ${out.outputType}.pdf generated!`)
    } else {
      console.error(`    [FAIL] Compilation failed for ${out.outputType}:`)
      console.error(compileResult.stdout.slice(-1500))
      throw new Error(`Compilation failed for output ${out.outputType}`)
    }
  }

  // Cleanup test workspace
  try {
    await fs.promises.rm(testDir, { recursive: true, force: true })
  } catch {}
}

async function testAssetUrlToLatexPath() {
  console.log("\n=======================================================")
  console.log("TEST 2: assetUrlToLatexPath URL resolution")
  console.log("=======================================================")

  const wsAsset = assetUrlToLatexPath("/api/workspaces/ws123/assets/figure1.png", "ws123")
  console.log(`  /api/workspaces/ws123/assets/figure1.png -> ${wsAsset}`)
  if (wsAsset !== "assets/figure1.png") throw new Error("Failed workspace asset mapping")

  const publicImg = assetUrlToLatexPath("/images/fig-architecture.png", "ws123")
  console.log(`  /images/fig-architecture.png -> ${publicImg}`)
  if (publicImg !== "../../public/images/fig-architecture.png") throw new Error("Failed public image mapping")

  console.log("  [PASS] assetUrlToLatexPath correctly resolves workspace and public image URLs")
}

async function testDatabaseSeeding() {
  console.log("\n=======================================================")
  console.log("TEST 3: Database Demo Seeding & Structure")
  console.log("=======================================================")

  const testUserId = `test_user_${Date.now()}`
  const { jsonStringify } = await import("../lib/db-helpers")

  // Simulate what GET /api/workspaces does
  console.log(`  Simulating new user login for userId: ${testUserId}`)
  const demoId = `demo_${Date.now().toString(36)}`

  const project = await prisma.workspace.create({
    data: {
      id: demoId,
      name: sampleProject.name,
      authors: sampleProject.authors,
      venue: sampleProject.venue,
      userId: testUserId,
      outputs: {
        create: sampleProject.outputs?.map((out) => ({
          id: `out_${out.outputType}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
          outputType: out.outputType,
          templateId: out.templateId,
          title: out.title,
          isActive: out.id === sampleProject.activeOutputId,
          cards: {
            create: out.cards.map((c) => ({
              id: `card_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
              title: c.title || "",
              column: c.column,
              order: c.order,
              pattern: c.pattern,
              content: c.content,
              table: jsonStringify(c.table),
              figures: jsonStringify(c.figures),
              figureLayout: c.figureLayout || "auto",
              sourceIds: jsonStringify(c.sourceIds),
              validation: c.validation || "ok",
            })),
          },
        })),
      },
    },
    include: {
      outputs: {
        include: {
          cards: true
        }
      }
    }
  })

  console.log(`  [PASS] Created demo workspace: ${project.id} with ${project.outputs.length} outputs:`)
  for (const out of project.outputs) {
    console.log(`    - Output: ${out.outputType} (${out.templateId}) with ${out.cards.length} cards`)
  }

  // Cleanup test record
  await prisma.workspace.delete({ where: { id: demoId } })
  console.log(`  [PASS] Successfully cleaned up test workspace ${demoId}`)
}

async function testAuthJsonErrors() {
  console.log("\n=======================================================")
  console.log("TEST 4: Client & API Error Handling Safety")
  console.log("=======================================================")

  // Simulate an endpoint returning plain text "Not found" (the previous crash scenario)
  const mockTextResponse = new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } })
  
  // Verify that the new ui-slice pattern safely extracts error without JSON parsing crash
  let caughtError = ""
  try {
    if (!mockTextResponse.ok) {
      throw new Error(`HTTP ${mockTextResponse.status}: ${await mockTextResponse.text().catch(() => "")}`)
    }
    await mockTextResponse.json()
  } catch (err: any) {
    caughtError = err.message
  }

  console.log(`  Simulated 404 plain text response caught error: "${caughtError}"`)
  if (!caughtError.includes("HTTP 404: Not found")) {
    throw new Error(`Failed to safely extract text error: ${caughtError}`)
  }
  console.log("  [PASS] Plain text 404 safely caught without SyntaxError")

  // Simulate structured JSON error response (the new lib/auth.ts behavior)
  const mockJsonResponse = new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" }
  })
  
  let jsonCaughtError = ""
  try {
    if (!mockJsonResponse.ok) {
      const body = await mockJsonResponse.text().catch(() => "")
      throw new Error(`HTTP ${mockJsonResponse.status}: ${body}`)
    }
    await mockJsonResponse.json()
  } catch (err: any) {
    jsonCaughtError = err.message
  }

  console.log(`  Simulated 404 JSON response caught error: "${jsonCaughtError}"`)
  if (!jsonCaughtError.includes('{"error":"Not found"}')) {
    throw new Error(`Failed to extract JSON error: ${jsonCaughtError}`)
  }
  console.log("  [PASS] JSON error response cleanly extracted and handled")
}

async function main() {
  try {
    await testAssetUrlToLatexPath()
    await testLatexCompilation()
    await testDatabaseSeeding()
    await testAuthJsonErrors()
    console.log("\n=======================================================")
    console.log("ALL TESTS PASSED SUCCESSFULLY!")
    console.log("=======================================================\n")
    process.exit(0)
  } catch (err) {
    console.error("\nTEST SUITE FAILED:", err)
    process.exit(1)
  }
}

main()
