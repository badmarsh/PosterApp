/**
 * POST /api/workspaces/[id]/thesis-review
 *
 * Generates a complete thesis assessment (posudok) using:
 *  1. RAG from MinerU-parsed thesis documents
 *  2. Academic Connector for citation verification
 *  3. AI generation via ThesisReviewGenerationSchema
 *
 * Rate limit: 3 requests per 5 minutes per user.
 */

import { NextRequest, NextResponse } from "next/server"
import { rateLimitAsync } from "@/lib/rate-limit"
import { requireWorkspaceEditor } from "@/lib/auth"
import { generateAIResponse } from "@/lib/ai/client"
import { ThesisReviewGenerationSchema } from "@/lib/ai/contracts"
import { resolveAiModel, AI_TIMEOUTS } from "@/lib/ai/models"
import { wrapUntrustedContext } from "@/lib/ai/prompts"
import { loadThesisContext, buildThesisContextHeader } from "@/lib/ai/thesis-context"
import {
  THESIS_CRITERIA,
  gradeToRecommendation,
  type ThesisMetadata,
  type ReviewLanguage,
} from "@/lib/ai/thesis-rubric"
import { auditThesisCitations } from "@/lib/services/academic-connector"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const ThesisMetadataSchema = z.object({
  studentName: z.string().min(1).max(200),
  thesisTitle: z.string().min(1).max(500),
  thesisType: z.enum(["bachelor", "master", "phd"]).default("master"),
  reviewerRole: z.enum(["supervisor", "opponent"]).default("opponent"),
  reviewerName: z.string().max(200).optional(),
  institution: z.string().max(300).optional(),
  department: z.string().max(300).optional(),
  language: z.enum(["sk", "cs", "en"]).default("sk"),
  academicYear: z.string().max(20).optional(),
})

const RequestBodySchema = z.object({
  thesisMetadata: ThesisMetadataSchema,
  /** Optional: restrict generation to specific criterion IDs */
  focusCriteria: z.array(z.string()).optional(),
  /** Skip Academic Connector citation audit (faster but less thorough) */
  skipCitationAudit: z.boolean().default(false),
})

// ---------------------------------------------------------------------------
// System/User prompt builders
// ---------------------------------------------------------------------------

function buildSystemPrompt(lang: ReviewLanguage): string {
  const texts: Record<ReviewLanguage, string> = {
    sk: `Si expertný hodnotiteľ akademických prác na slovenských vysokých školách. 
Píšeš posudky diplomových, bakalárskych a dizertačných prác.
Tvoje hodnotenia musia byť:
- Konkrétne, merateľné a odôvodnené textom práce
- Formálne a akademicky korektné
- V súlade so štandardmi ISO 690 pre citácie
- Písané v slovenčine s odbornou terminológiou`,
    cs: `Jsi expertní hodnotitel akademických prací na českých vysokých školách.
Píšeš posudky diplomových, bakalářských a dizertačních prací.
Tvá hodnocení musí být konkrétní, měřitelná a odůvodněná textem práce.
Piš česky s odbornou terminologií.`,
    en: `You are an expert academic thesis reviewer at a European university.
You write formal assessments for bachelor's, master's, and PhD dissertations.
Your evaluations must be specific, measurable, and grounded in the thesis text.
Write in formal academic English.`,
  }
  return texts[lang]
}

function buildUserPrompt(
  metadata: ThesisMetadata,
  contextHeader: string,
  sourceContext: string,
  criteriaList: string,
  lang: ReviewLanguage
): string {
  const taskTexts: Record<ReviewLanguage, string> = {
    sk: `Na základe nasledujúcich informácií vypracuj posudok diplomovej práce.
Pre každé kritérium napíš hodnotenie v slovenčine (2-4 vety).
Navrhni tiež 3 konkrétne otázky na obhajobu.
Uveď celkovú navrhovanú klasifikáciu (A/B/C/D/E/FX) a odporúčanie k obhajobe.`,
    cs: `Na základě následujících informací vypracuj posudek diplomové práce.
Pro každé kritérium napiš hodnocení v češtině (2-4 věty).
Navrhni také 3 konkrétní otázky k obhajobě.
Uveď celkovou navrhovanou klasifikaci (A/B/C/D/E/FX) a doporučení k obhajobě.`,
    en: `Based on the information below, write a formal thesis assessment.
For each criterion, write an evaluation (2-4 sentences) in English.
Also suggest 3 specific defense questions.
Provide an overall recommended grade (A/B/C/D/E/FX) and recommendation.`,
  }

  return `${wrapUntrustedContext("ThesisMetadata", contextHeader)}

${wrapUntrustedContext("ThesisSourceDocument", sourceContext || "No thesis document uploaded. Base your assessment on the metadata only and note this limitation.")}

${wrapUntrustedContext("EvaluationCriteria", criteriaList)}

${wrapUntrustedContext("Task", `${taskTexts[lang]}

Return EXACTLY this JSON (no markdown):
{
  "sections": [
    {
      "sectionId": "<criterionId>",
      "criterionId": "<criterionId>",
      "text": "<assessment text in ${lang}>",
      "rating": "<A|B|C|D|E|FX|pending>",
      "numericScore": <0-100>,
      "suggestions": ["<improvement suggestion>"]
    }
  ],
  "overallGrade": "<A|B|C|D|E|FX>",
  "recommendation": "<formal recommendation sentence>",
  "defenseQuestions": ["<question 1>", "<question 2>", "<question 3>"],
  "citationIssues": ["<issue 1>"]
}`)}`
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params

  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId)) {
    return NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 })
  }

  let userId: string
  try {
    const access = await requireWorkspaceEditor(workspaceId)
    userId = access.userId
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { allowed, retryAfterMs } = await rateLimitAsync(`${userId}:thesis-review`, 3, 300_000)
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limited", retryAfterMs },
      { status: 429, headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() } }
    )
  }

  let body: z.infer<typeof RequestBodySchema>
  try {
    const raw = await req.json()
    body = RequestBodySchema.parse(raw)
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body", details: String(err) }, { status: 400 })
  }

  const { thesisMetadata, focusCriteria, skipCitationAudit } = body
  const lang = thesisMetadata.language as ReviewLanguage

  try {
    // 1. Load RAG context from MinerU-parsed documents
    const ragContext = await loadThesisContext({
      workspaceId,
      thesisMetadata,
      focusSections: focusCriteria,
      maxChars: 70_000,
    })

    // 2. Academic citation audit (optional, skip for speed)
    let citationAuditSummary = ""
    if (!skipCitationAudit && ragContext.referencesTitles.length > 0) {
      try {
        const audit = await auditThesisCitations(ragContext.referencesTitles.slice(0, 20))
        const issues = audit.results
          .filter((r) => !r.verification.found || r.iso690Issues.length > 0)
          .map((r) => {
            const msgs = r.iso690Issues.length > 0 ? r.iso690Issues.join("; ") : `Unverified: "${r.citedText.slice(0, 60)}"`
            return msgs
          })
        if (issues.length > 0) {
          citationAuditSummary = `\nCitation audit found ${audit.unverified} unverified references:\n` + issues.join("\n")
        }
      } catch (err) {
        console.warn("[thesis-review] Citation audit failed, continuing:", err)
      }
    }

    // 3. Build AI prompt
    const contextHeader = buildThesisContextHeader(thesisMetadata, lang)

    const activeCriteria = focusCriteria?.length
      ? THESIS_CRITERIA.filter((c) => focusCriteria.includes(c.id))
      : THESIS_CRITERIA

    const criteriaList = activeCriteria
      .map((c) => `[${c.id}] ${c.labels[lang]} (weight: ${c.weight}%)\nGuidance: ${c.guidance[lang]}`)
      .join("\n\n")

    const sourceContext = ragContext.fullText.slice(0, 65_000) +
      (citationAuditSummary ? `\n\n[Citation Audit]\n${citationAuditSummary}` : "")

    const systemPrompt = buildSystemPrompt(lang)
    const userPrompt = buildUserPrompt(thesisMetadata, contextHeader, sourceContext, criteriaList, lang)

    // 4. AI generation
    const result = await generateAIResponse("thesis-review", {
      model: resolveAiModel("thesis"),
      systemPrompt,
      userPrompt,
      schema: ThesisReviewGenerationSchema,
      temperature: 0.15,
      signal: AbortSignal.timeout(AI_TIMEOUTS.thesis),
    })

    // 5. Compute recommendation if not provided
    if (!result.recommendation && result.overallGrade) {
      result.recommendation = gradeToRecommendation(result.overallGrade, lang)
    }

    // 6. Save to database
    const saved = await prisma.thesisReview.create({
      data: {
        workspaceId,
        studentName: thesisMetadata.studentName,
        thesisTitle: thesisMetadata.thesisTitle,
        thesisType: thesisMetadata.thesisType,
        reviewerRole: thesisMetadata.reviewerRole,
        reviewerName: thesisMetadata.reviewerName ?? null,
        institution: thesisMetadata.institution ?? null,
        department: thesisMetadata.department ?? null,
        grade: result.overallGrade ?? null,
        recommendation: result.recommendation,
        sections: JSON.stringify(result.sections),
        defenseQuestions: JSON.stringify(result.defenseQuestions),
        citationIssues: JSON.stringify([
          ...result.citationIssues,
          ...(citationAuditSummary ? [citationAuditSummary] : []),
        ]),
        status: "draft",
        language: lang,
      },
    })

    return NextResponse.json({
      id: saved.id,
      ...result,
      ragStats: {
        totalChars: ragContext.totalChars,
        referencesFound: ragContext.referencesTitles.length,
        citationAuditRan: !skipCitationAudit && ragContext.referencesTitles.length > 0,
      },
    })
  } catch (error: unknown) {
    if (error instanceof Response) return error
    console.error("[thesis-review POST] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// GET — list all thesis reviews for a workspace
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params

  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId)) {
    return NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 })
  }

  try {
    const access = await requireWorkspaceEditor(workspaceId)
    void access
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const reviews = await prisma.thesisReview.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      studentName: true,
      thesisTitle: true,
      thesisType: true,
      reviewerRole: true,
      reviewerName: true,
      grade: true,
      recommendation: true,
      status: true,
      language: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ reviews })
}
