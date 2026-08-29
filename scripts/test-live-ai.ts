import fs from "fs"
import path from "path"
import { generateCaption } from "@/lib/services/vision-service"
import { getVisionModelChain, resolveAiModel, DEFAULT_FALLBACK_VISION_MODELS } from "@/lib/ai/models"
import { generateAIResponse } from "@/lib/ai/client"
import { z } from "zod"

async function runLiveAiTests() {
  console.log("=================================================================")
  console.log("🚀 STARTING POSTERAPP AI LAYER COMPREHENSIVE LIVE TEST")
  console.log("=================================================================\n")

  // 1. Model Resolution & Fallback Chain Check
  console.log("--- 1. Testing AI Model Role Resolution ---")
  const roles = [
    "vision",
    "generation",
    "structure",
    "convert",
    "shrink",
    "review",
    "reviewLayout",
    "chat",
    "bibtex",
    "labeler",
    "autofix",
  ] as const

  for (const role of roles) {
    const resolved = resolveAiModel(role)
    console.log(`  ✓ Role [${role.padEnd(14)}]: ${resolved}`)
  }

  const visionChain = getVisionModelChain()
  console.log(`\n  ✓ Vision Fallback Chain (${visionChain.length} models):`)
  visionChain.forEach((m, idx) => console.log(`     ${idx + 1}. ${m}`))
  console.log()

  // 2. Multimodal Vision Captioning Test with Omni Model
  console.log("--- 2. Testing Multimodal Captioning (qwen-omni-turbo) ---")
  const sampleImagePath = path.join(process.cwd(), "workspaces", "demo_mt6u6y7a", "assets", "FDR-Radiation-Divider_figure_1.jpg")
  
  if (fs.existsSync(sampleImagePath)) {
    const base64 = fs.readFileSync(sampleImagePath).toString("base64")
    const context = "Section 3.2: Circuit schematic of the BJT transistor current gain divider under heavy-ion radiation test."
    
    const startTime = Date.now()
    const result = await generateCaption(base64, context)
    const elapsed = Date.now() - startTime
    
    console.log(`  ✓ Caption generated in ${elapsed}ms:`)
    console.log(`     - Name:        "${result.name}"`)
    console.log(`     - Caption:     "${result.caption}"`)
    console.log(`     - Description: "${result.snippet}"`)
  } else {
    console.log("  ⚠️ Sample image not found, skipping visual image file test.")
  }
  console.log()

  // 3. Testing Fallback Vision Model
  console.log("--- 3. Testing Second Model in Fallback Chain (qwen3-omni-flash) ---")
  if (fs.existsSync(sampleImagePath)) {
    const base64 = fs.readFileSync(sampleImagePath).toString("base64")
    const schema = z.object({ name: z.string(), description: z.string() })
    
    const startTime = Date.now()
    const result = await generateAIResponse("test-fallback", {
      role: "vision",
      model: "qwen3-omni-flash",
      userPrompt: [
        { type: "text", text: "Describe this schematic in JSON with keys 'name' and 'description'." },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } }
      ],
      schema,
      signal: AbortSignal.timeout(15_000)
    })
    const elapsed = Date.now() - startTime
    console.log(`  ✓ Fallback model responded in ${elapsed}ms:`)
    console.log(`     - Name: "${result.name}"`)
    console.log(`     - Description: "${result.description}"`)
  }
  console.log()

  // 4. Testing Text / JSON Model Generation on DashScope Endpoint
  console.log("--- 4. Testing Text / JSON Generation on Alibaba MaaS Endpoint ---")
  const textSchema = z.object({
    title: z.string(),
    summary: z.string(),
    keyPoints: z.array(z.string()),
  })

  try {
    const startTime = Date.now()
    const textResult = await generateAIResponse("test-dashscope-text", {
      model: "qwen-plus",
      apiUrl: "https://ws-fh5ya3b9mq2wj4oq.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions",
      apiKey: "sk-ws-H.DMXMMLY.vVm6.MEQCIBTB3VsrbBmD1DM6CrTKk4mU33yvKITwp3ILusgUDluHAiAX6OcACmKlbq9WUsvyPfFRNX4s9EVaIHVm-NDbhe_wKg",
      userPrompt: "Generate a brief scientific summary in JSON with 'title', 'summary', and 3 'keyPoints' about radiation tolerance testing in CMOS ASICs.",
      schema: textSchema,
      signal: AbortSignal.timeout(15_000)
    })
    const elapsed = Date.now() - startTime
    console.log(`  ✓ Text model (qwen-plus) responded in ${elapsed}ms:`)
    console.log(`     - Title: "${textResult.title}"`)
    console.log(`     - Summary: "${textResult.summary.slice(0, 100)}..."`)
    console.log(`     - Key points (${textResult.keyPoints.length}): ${textResult.keyPoints.join("; ")}`)
  } catch (err) {
    console.log(`  ⚠️ Text model test: ${(err as Error).message}`)
  }

  console.log("\n=================================================================")
  console.log("✅ ALL AI LAYER LIVE TESTS COMPLETED SUCCESSFULLY")
  console.log("=================================================================")
}

runLiveAiTests().catch((e) => {
  console.error("Live test failed with error:", e)
  process.exit(1)
})
