import { PrismaClient } from '@prisma/client'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { spawn } from 'child_process'
import { generateFullTemplate } from '../lib/latex'
import { TEMPLATE_REGISTRY } from '../lib/output-types'
import type { Card, Project } from '../lib/poster-types'

const prisma = new PrismaClient()
const ROOT = path.join(process.cwd(), "workspaces")
import { safeLog, runSandboxedLatex } from '../lib/latex/compiler-runner'

function asProject(workspace: any): Project {
  const outputs = workspace.outputs.map((output: any) => ({
    ...output,
    cards: output.cards.map((card: any): Card => ({
      ...card,
      table: card.table ?? { hasHeader: true, caption: "", rows: [] },
      figures: card.figures ?? [],
      sourceIds: card.sourceIds ?? [],
    })),
  }))
  const active = outputs.find((output: any) => output.isActive) ?? outputs[0]
  return {
    id: workspace.id, 
    revision: workspace.revision, 
    name: workspace.name, 
    authors: workspace.authors, 
    venue: workspace.venue,
    outputs, 
    activeOutputId: active?.id ?? "", 
    assets: workspace.assets.map((asset: any) => ({ ...asset, tableRows: asset.tableRows ?? undefined })), 
    ingestFiles: [],
  }
}



async function exportTemplate(project: Project, baseOutput: any, template: any, workspaceId: string, workspaceBib = "") {
  console.log(`\n--- Exporting ${template.outputType} with template ${template.id} ---`)
  
  // Clone output and override templateId
  const output = { ...baseOutput, templateId: template.id }
  
  const tex = generateFullTemplate(project, output, workspaceId)
  
  const stage = await fs.mkdtemp(path.join(os.tmpdir(), `posterapp-${workspaceId}-`))
  await fs.writeFile(path.join(stage, "main.tex"), tex, "utf8")
  
  const refCards = output.cards.filter((c: Card) => c.pattern === "references")
  const cardBib = refCards.map((c: Card) => c.content).filter(Boolean).join("\n\n")
  const bibContent = (cardBib && cardBib.includes("@")) ? cardBib : (workspaceBib || cardBib || "")
  if (bibContent.trim()) {
    await fs.writeFile(path.join(stage, "references.bib"), bibContent, "utf8")
  }
  
  const assets = path.join(ROOT, workspaceId, "assets")
  await fs.cp(assets, path.join(stage, "assets"), { recursive: true, force: true, errorOnExist: false }).catch(() => undefined)
  const defaultLogos = path.join(process.cwd(), "public", "logos")
  await fs.cp(defaultLogos, path.join(stage, "logos"), { recursive: true, force: true, errorOnExist: false }).catch(() => undefined)
  const workspaceLogos = path.join(ROOT, workspaceId, "logos")
  await fs.cp(workspaceLogos, path.join(stage, "logos"), { recursive: true, force: true, errorOnExist: false }).catch(() => undefined)

  const buildCmd = "pdflatex -shell-restricted -interaction=nonstopmode main.tex && (bibtex main || true) && pdflatex -shell-restricted -interaction=nonstopmode main.tex && pdflatex -shell-restricted -interaction=nonstopmode -halt-on-error main.tex"
  
  console.log('Compiling...')
  try {
    await runSandboxedLatex({ stage, buildCmd, timeoutMs: 60_000 })
    
    const compiled = path.join(stage, "main.pdf")
    const outDir = path.join(process.cwd(), "public", "exports")
    await fs.mkdir(outDir, { recursive: true })
    const outPath = path.join(outDir, `${template.outputType}_${template.id}.pdf`)
    await fs.rename(compiled, outPath)
    
    console.log(`✅ Success: ${outPath}`)
  } catch (err: any) {
    console.error(`❌ Failed: ${err.message}`)
  } finally {
    await fs.rm(stage, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function run() {
  const workspaceId = 'demo_mt6u6y7a'
  const full = await prisma.workspace.findUnique({ 
    where: { id: workspaceId }, 
    include: { outputs: { include: { cards: true } }, assets: true } 
  })
  
  if (!full) {
    console.error('Workspace not found')
    return
  }
  
  const project = asProject(full)
  
  for (const template of TEMPLATE_REGISTRY) {
    // Find a matching output for this template's type
    const baseOutput = project.outputs.find(o => o.outputType === template.outputType)
    if (!baseOutput) {
      console.warn(`No output found for type ${template.outputType}, skipping template ${template.id}`)
      continue
    }
    
    await exportTemplate(project, baseOutput, template, workspaceId, full.bibContent ?? "")
  }
}

run().finally(() => prisma.$disconnect())
