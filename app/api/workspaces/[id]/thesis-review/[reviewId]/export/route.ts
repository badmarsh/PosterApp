/**
 * POST /api/workspaces/[id]/thesis-review/[reviewId]/export
 *
 * Generates a PDF from a thesis review record using the LaTeX compiler.
 * Uses the same Docker/WSL compiler pipeline as the main compile route.
 *
 * Returns: { ok: true } with main.pdf saved to workspaces/[id]/thesis-[reviewId].pdf
 * Or streams PDF directly as application/pdf.
 */

import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import os from "os"
import { spawn } from "child_process"
import { requireWorkspaceEditor } from "@/lib/auth"
import { rateLimitAsync } from "@/lib/rate-limit"
import { prisma } from "@/lib/prisma"
import { generateThesisReviewLatex } from "@/lib/latex/generator-thesis-review"
import { reportLanguageFor, type ThesisReviewTemplate } from "@/lib/latex/templates-thesis"
import type { ThesisSection } from "@/lib/ai/thesis-rubric"
import { deserializeThesisReview } from "@/lib/ai/review-serializer"
import { safeContentDisposition, sanitizeFilename } from "@/lib/security"
import { WORKSPACES_ROOT, workspacePath } from "@/lib/workspace-files"
import { safeLog, runSandboxedLatex } from "@/lib/latex/compiler-runner"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string }> }
) {
  const { id: workspaceId, reviewId } = await params

  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId) || !/^[a-zA-Z0-9_-]+$/.test(reviewId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 })
  }

  let userId: string
  try {
    const access = await requireWorkspaceEditor(workspaceId)
    userId = access.userId
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { allowed, retryAfterMs } = await rateLimitAsync(
    `${userId}:${workspaceId}:export-review`,
    5,
    60_000
  )
  if (!allowed) {
    return NextResponse.json(
      { error: `Rate limited — try again in ${Math.ceil(retryAfterMs / 1000)}s` },
      { status: 429 }
    )
  }

  const review = await prisma.thesisReview.findFirst({
    where: { id: reviewId, workspaceId },
  })

  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 })
  }

  // Parse body for optional template override and audience / confidentiality flags
  let template: ThesisReviewTemplate = "posudok-sk"
  let includeConfidential = false
  try {
    const body = await req.json().catch(() => ({}))
    if (body.includeConfidential === true || body.audience === "committee" || body.audience === "supervisor") {
      includeConfidential = true
    }
    if (body.template) template = body.template as ThesisReviewTemplate
    else if (review.language === "en") template = "posudok-en"
    else if (review.language === "cs") template = "posudok-cs"
    // de/pl/hu are render-only report languages: the AI review itself is
    // still produced in sk/cs/en, but the PDF can be typeset for a German,
    // Polish or Hungarian faculty by passing an explicit `template`.
  } catch { /* use default */ }

  let stage = ""
  try {
    // Build LaTeX document safely using deserializer
    const deserialized = deserializeThesisReview(review)
    const sections: ThesisSection[] = deserialized.sections
    const defenseQuestions: string[] = deserialized.defenseQuestions
    const citationIssues: string[] = deserialized.citationIssues

    const tex = generateThesisReviewLatex({
      studentName: review.studentName,
      thesisTitle: review.thesisTitle,
      thesisType: review.thesisType as "bachelor" | "master" | "phd",
      reviewerRole: review.reviewerRole,
      reviewerName: review.reviewerName,
      institution: review.institution,
      department: review.department,
      grade: review.grade,
      recommendation: review.recommendation,
      sections,
      defenseQuestions,
      citationIssues,
      language: reportLanguageFor(template),
      template,
      confidentialComments: review.confidentialComments,
      includeConfidential,
    })

    // Create temp directory
    stage = await fs.mkdtemp(path.join(os.tmpdir(), `posudok-${reviewId}-`))
    await fs.writeFile(path.join(stage, "main.tex"), tex, "utf8")

    // Copy LaTeX styles if available
    const stylesDir = path.join(process.cwd(), "public", "latex-styles")
    await fs.cp(stylesDir, stage, { recursive: true, force: true, errorOnExist: false }).catch(() => undefined)

    // Run compiler
    const buildCmd = "pdflatex -shell-restricted -interaction=nonstopmode -halt-on-error main.tex && pdflatex -shell-restricted -interaction=nonstopmode -halt-on-error main.tex"
    const image = process.env.LATEX_COMPILER_IMAGE
    await runSandboxedLatex({ stage, buildCmd, timeoutMs: 90_000, image })

    // Read and return PDF
    const pdfPath = path.join(stage, "main.pdf")
    const pdfBuffer = await fs.readFile(pdfPath)

    // Also save a copy to workspace directory
    const targetDir = workspacePath(workspaceId)
    await fs.mkdir(targetDir, { recursive: true })
    await fs.writeFile(path.join(targetDir, `thesis-review-${reviewId}.pdf`), pdfBuffer)

    const pdfFilename = `posudok-${sanitizeFilename(review.studentName, "student")}.pdf`
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": safeContentDisposition(pdfFilename, "attachment"),
        "Content-Length": String(pdfBuffer.length),
      },
    })
  } catch (error) {
    if (error instanceof Response) return error
    const msg = error instanceof Error ? error.message : "Unknown error"
    if (msg.includes("COMPILER_UNAVAILABLE")) {
      return NextResponse.json({ error: "LaTeX compiler not configured" }, { status: 503 })
    }
    console.error("[thesis-review export] Error:", msg.slice(0, 500))
    return NextResponse.json({ error: "PDF compilation failed", log: safeLog(msg) }, { status: 422 })
  } finally {
    if (stage) await fs.rm(stage, { recursive: true, force: true }).catch(() => undefined)
  }
}

// GET — check if compiled PDF exists or export raw .tex source
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; reviewId: string }> }
) {
  const { id: workspaceId, reviewId } = await params

  try {
    await requireWorkspaceEditor(workspaceId)
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const review = await prisma.thesisReview.findFirst({
    where: { id: reviewId, workspaceId },
  })

  if (!review) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 })
  }

  const format = req.nextUrl.searchParams.get("format")
  const includeConfidential = req.nextUrl.searchParams.get("confidential") === "true"

  if (format === "docx") {
    if (review.reviewerRole === "self") {
      return NextResponse.json(
        {
          error: "DOCX_UNAVAILABLE_FOR_SELF_TRIAGE",
          message: "Pre-consultation triage reviews should be exported as structured Markdown, not a signed formal DOCX posudok.",
        },
        { status: 400 }
      )
    }
    const { generateThesisReviewDocx } = await import("@/lib/docx/generator-review")
    const deserialized = deserializeThesisReview(review)
    const blob = await generateThesisReviewDocx(deserialized as any, { includeConfidential })
    const arrayBuffer = await blob.arrayBuffer()
    const docxFilename = `posudok-${sanitizeFilename(review.studentName, "student")}${includeConfidential ? "-confidential" : ""}.docx`
    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": safeContentDisposition(docxFilename, "attachment"),
      },
    })
  }

  if (format === "md" || format === "markdown") {
    const { composeFullReviewNarrative } = await import("@/lib/ai/review-composer")
    const deserialized = deserializeThesisReview(review)
    const composed = composeFullReviewNarrative(deserialized as any, includeConfidential ? "editor" : "author", review.language as any)
    const prefix = review.reviewerRole === "self" ? "predkonzultacny-rozbor" : "posudok"
    const mdFilename = `${prefix}-${sanitizeFilename(review.studentName, "student")}.md`
    return new Response(composed.markdownText, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": safeContentDisposition(mdFilename, "attachment"),
      },
    })
  }

  if (format === "tex") {
    let template: ThesisReviewTemplate = "posudok-sk"
    if (review.language === "en") template = "posudok-en"
    else if (review.language === "cs") template = "posudok-cs"

    const deserialized = deserializeThesisReview(review)
    const sections: ThesisSection[] = deserialized.sections
    const defenseQuestions: string[] = deserialized.defenseQuestions
    const citationIssues: string[] = deserialized.citationIssues

    const tex = generateThesisReviewLatex({
      studentName: review.studentName,
      thesisTitle: review.thesisTitle,
      thesisType: review.thesisType as "bachelor" | "master" | "phd",
      reviewerRole: review.reviewerRole,
      reviewerName: review.reviewerName,
      institution: review.institution,
      department: review.department,
      grade: review.grade,
      recommendation: review.recommendation,
      sections,
      defenseQuestions,
      citationIssues,
      language: reportLanguageFor(template),
      template,
      confidentialComments: review.confidentialComments,
      includeConfidential,
    })

    const texFilename = `posudok-${sanitizeFilename(review.studentName, "student")}${includeConfidential ? "-confidential" : ""}.tex`
    return new Response(tex, {
      status: 200,
      headers: {
        "Content-Type": "text/x-tex; charset=utf-8",
        "Content-Disposition": safeContentDisposition(texFilename, "attachment"),
      },
    })
  }

  const pdfPath = workspacePath(workspaceId, `thesis-review-${reviewId}.pdf`)
  const exists = await fs.access(pdfPath).then(() => true).catch(() => false)

  return NextResponse.json({ exists, url: exists ? `/api/workspaces/${workspaceId}/thesis-review/${reviewId}/pdf` : null })
}
