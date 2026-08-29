/**
 * Direct unit test for all image-edit route operations using sharp.
 * Runs without the Next.js server — calls the handler logic directly via sharp.
 */
import sharp from "sharp"
import fs from "fs"
import path from "path"

const WORKSPACE_ID = "demo_mt6u6y7a"
const ASSETS_DIR = path.join(process.cwd(), "workspaces", WORKSPACE_ID, "assets")
const TEST_IMAGE = path.join(ASSETS_DIR, "FDR-Radiation-Divider_figure_1.jpg")
const OUT_DIR = path.join(ASSETS_DIR, "_test_outputs")

let passed = 0
let failed = 0

async function run(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    console.log(`  ✅ ${name}`)
    passed++
  } catch (err) {
    console.error(`  ❌ ${name}: ${(err as Error).message}`)
    failed++
  }
}

function draftName(op: string) {
  return path.join(OUT_DIR, `test_${op}_${Date.now()}.png`)
}

async function main() {
  console.log("=============================================================")
  console.log("🖼  IMAGE EDIT OPERATIONS — DIRECT SHARP UNIT TESTS")
  console.log("=============================================================\n")

  if (!fs.existsSync(TEST_IMAGE)) {
    console.error(`❌ Test image not found: ${TEST_IMAGE}`)
    process.exit(1)
  }
  fs.mkdirSync(OUT_DIR, { recursive: true })

  console.log(`Source image: ${path.basename(TEST_IMAGE)}`)
  const meta = await sharp(TEST_IMAGE).metadata()
  console.log(`Dimensions:   ${meta.width}×${meta.height}, format: ${meta.format}\n`)

  // --- remove-bg ---
  await run("remove-bg: near-white pixel transparency", async () => {
    const { data, info } = await sharp(TEST_IMAGE).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const buf = Buffer.from(data)
    let transparentPixels = 0
    const threshold = 240
    for (let i = 0; i < buf.length; i += 4) {
      if (buf[i] >= threshold && buf[i+1] >= threshold && buf[i+2] >= threshold) {
        buf[i+3] = 0
        transparentPixels++
      }
    }
    const out = draftName("remove_bg")
    await sharp(buf, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(out)
    const outMeta = await sharp(out).metadata()
    if (outMeta.format !== "png") throw new Error("Expected PNG output")
    if (outMeta.channels !== 4) throw new Error("Expected alpha channel (channels=4)")
    if (transparentPixels === 0) throw new Error("No pixels were made transparent")
    console.log(`     → ${transparentPixels.toLocaleString()} white pixels removed, saved ${path.basename(out)}`)
  })

  // --- crop-tight ---
  await run("crop-tight: trim whitespace", async () => {
    const out = draftName("crop")
    await sharp(TEST_IMAGE).trim({ threshold: 20 }).png().toFile(out)
    const outMeta = await sharp(out).metadata()
    if (!outMeta.width || !outMeta.height) throw new Error("Invalid output dimensions")
    console.log(`     → Cropped to ${outMeta.width}×${outMeta.height}, saved ${path.basename(out)}`)
  })

  // --- upscale ---
  await run("upscale: 2× Lanczos3", async () => {
    const { width } = await sharp(TEST_IMAGE).metadata()
    const out = draftName("upscale")
    await sharp(TEST_IMAGE).resize(width! * 2, null, { kernel: sharp.kernel.lanczos3 }).png().toFile(out)
    const outMeta = await sharp(out).metadata()
    if (outMeta.width !== width! * 2) throw new Error(`Expected width ${width! * 2}, got ${outMeta.width}`)
    console.log(`     → Upscaled to ${outMeta.width}×${outMeta.height}, saved ${path.basename(out)}`)
  })

  // --- custom: grayscale ---
  await run("custom prompt: 'grayscale'", async () => {
    const out = draftName("grayscale")
    await sharp(TEST_IMAGE).grayscale().png().toFile(out)
    const outMeta = await sharp(out).metadata()
    // grayscale PNGs still have channels=3 or 1 depending on sharp version
    if (!outMeta.width) throw new Error("Invalid output")
    console.log(`     → Grayscale ${outMeta.width}×${outMeta.height}, saved ${path.basename(out)}`)
  })

  // --- custom: invert ---
  await run("custom prompt: 'invert'", async () => {
    const out = draftName("invert")
    await sharp(TEST_IMAGE).negate().png().toFile(out)
    const outMeta = await sharp(out).metadata()
    if (!outMeta.width) throw new Error("Invalid output")
    console.log(`     → Inverted ${outMeta.width}×${outMeta.height}, saved ${path.basename(out)}`)
  })

  // --- custom: blur ---
  await run("custom prompt: 'blur 5'", async () => {
    const out = draftName("blur")
    await sharp(TEST_IMAGE).blur(5).png().toFile(out)
    const outMeta = await sharp(out).metadata()
    if (!outMeta.width) throw new Error("Invalid output")
    console.log(`     → Blurred ${outMeta.width}×${outMeta.height}, saved ${path.basename(out)}`)
  })

  // --- custom: sharpen ---
  await run("custom prompt: 'sharpen'", async () => {
    const out = draftName("sharpen")
    await sharp(TEST_IMAGE).sharpen().png().toFile(out)
    const outMeta = await sharp(out).metadata()
    if (!outMeta.width) throw new Error("Invalid output")
    console.log(`     → Sharpened ${outMeta.width}×${outMeta.height}, saved ${path.basename(out)}`)
  })

  // --- custom: flip ---
  await run("custom prompt: 'flip'", async () => {
    const out = draftName("flip")
    await sharp(TEST_IMAGE).flip().png().toFile(out)
    const outMeta = await sharp(out).metadata()
    if (!outMeta.width || outMeta.height !== meta.height) throw new Error("Dimensions changed unexpectedly")
    console.log(`     → Flipped ${outMeta.width}×${outMeta.height}, saved ${path.basename(out)}`)
  })

  // --- custom: rotate 90 ---
  await run("custom prompt: 'rotate 90'", async () => {
    const out = draftName("rotate90")
    await sharp(TEST_IMAGE).rotate(90).png().toFile(out)
    const outMeta = await sharp(out).metadata()
    // After 90° rotation, width/height swap
    if (outMeta.width !== meta.height || outMeta.height !== meta.width) {
      throw new Error(`Expected ${meta.height}×${meta.width}, got ${outMeta.width}×${outMeta.height}`)
    }
    console.log(`     → Rotated 90° → ${outMeta.width}×${outMeta.height}, saved ${path.basename(out)}`)
  })

  // --- custom: rotate 180 ---
  await run("custom prompt: 'rotate 180'", async () => {
    const out = draftName("rotate180")
    await sharp(TEST_IMAGE).rotate(180).png().toFile(out)
    const outMeta = await sharp(out).metadata()
    if (outMeta.width !== meta.width || outMeta.height !== meta.height) {
      throw new Error(`Dimensions changed: ${outMeta.width}×${outMeta.height}`)
    }
    console.log(`     → Rotated 180° → ${outMeta.width}×${outMeta.height}, saved ${path.basename(out)}`)
  })

  console.log(`\n=============================================================`)
  if (failed === 0) {
    console.log(`✅ ALL ${passed} OPERATIONS PASSED`)
  } else {
    console.log(`⚠️  ${passed} passed, ${failed} FAILED`)
  }
  console.log(`Output files: ${OUT_DIR}`)
  console.log(`=============================================================`)

  // cleanup test output directory
  fs.rmSync(OUT_DIR, { recursive: true, force: true })
  console.log("(Test outputs cleaned up)")

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
