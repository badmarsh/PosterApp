import fs from "fs"
import path from "path"
import { AGENT_TOOLS, generateManifest } from "../lib/agent-tools/registry"

const WIRE_NAME_REGEX = /^[a-zA-Z0-9_-]{1,64}$/

export function checkAgentTools(updateSnapshot = false): { ok: boolean; errors: string[] } {
  const errors: string[] = []

  // Check (b): wireName regex validity
  for (const tool of AGENT_TOOLS) {
    if (!WIRE_NAME_REGEX.test(tool.wireName)) {
      errors.push(
        `Tool '${tool.id}' has wireName '${tool.wireName}' which violates regex /^[a-zA-Z0-9_-]{1,64}$/`
      )
    }
  }

  // Check (c): wireName uniqueness
  const seenWireNames = new Set<string>()
  for (const tool of AGENT_TOOLS) {
    if (seenWireNames.has(tool.wireName)) {
      errors.push(`Duplicate wireName detected: '${tool.wireName}' in tool '${tool.id}'`)
    }
    seenWireNames.add(tool.wireName)
  }

  // Check (a): all posterapp.* literals in components/research-lab-templates.tsx match registered tool IDs
  const templatesPath = path.resolve(__dirname, "../components/research-lab-templates.tsx")
  if (fs.existsSync(templatesPath)) {
    const content = fs.readFileSync(templatesPath, "utf8")
    const matches = Array.from(content.matchAll(/["'](posterapp\.[a-zA-Z0-9_.-]+)["']/g))
    const registeredIds = new Set(AGENT_TOOLS.map((t) => t.id))

    for (const match of matches) {
      const toolLiteral = match[1]
      if (!registeredIds.has(toolLiteral as any)) {
        errors.push(
          `Template references unregistered tool ID '${toolLiteral}' in ${path.relative(process.cwd(), templatesPath)}`
        )
      }
    }
  }

  // Check (d): manifest snapshot in __fixtures__/agent-manifest.json matches generated manifest
  const fixturesDir = path.resolve(__dirname, "../__fixtures__")
  const snapshotPath = path.join(fixturesDir, "agent-manifest.json")
  const currentManifest = generateManifest()
  const currentManifestJson = JSON.stringify(currentManifest, null, 2) + "\n"

  if (updateSnapshot || !fs.existsSync(snapshotPath)) {
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true })
    }
    fs.writeFileSync(snapshotPath, currentManifestJson, "utf8")
    console.log(`[check-agent-tools] Wrote/updated snapshot at ${snapshotPath}`)
  } else {
    const existingSnapshot = fs.readFileSync(snapshotPath, "utf8")
    if (existingSnapshot.trim() !== currentManifestJson.trim()) {
      errors.push(
        `Manifest snapshot in __fixtures__/agent-manifest.json does not match current registry. Run with --update to update the snapshot intentionally.`
      )
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  }
}

// If run directly from CLI
if (require.main === module || process.argv[1]?.endsWith("check-agent-tools.ts")) {
  const isUpdate = process.argv.includes("--update") || process.argv.includes("-u")
  const result = checkAgentTools(isUpdate)

  if (!result.ok) {
    console.error(`[check-agent-tools] FAILED with ${result.errors.length} error(s):`)
    for (const err of result.errors) {
      console.error(` - ${err}`)
    }
    process.exit(1)
  } else {
    console.log(`[check-agent-tools] PASSED: All ${AGENT_TOOLS.length} tools verified.`)
    process.exit(0)
  }
}
