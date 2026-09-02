/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod"

// 1. Card Generation
export const CardGenerationSchema = z.preprocess((raw: any) => {
  if (raw && typeof raw === "object") {
    const bullets = raw.bullets || raw.points || raw.items || raw.paragraphs || raw.content || []
    return {
      title: raw.title || raw.cardTitle || raw.topic,
      bullets: Array.isArray(bullets) ? bullets.map(String) : (typeof bullets === "string" ? [bullets] : []),
      assignedAssets: Array.isArray(raw.assignedAssets)
        ? raw.assignedAssets
        : Array.isArray(raw.assets)
        ? raw.assets
        : []
    }
  }
  return raw
}, z.object({
  title: z.string().optional(),
  bullets: z.array(z.string()),
  assignedAssets: z.array(
    z.object({
      slot: z.string(),
      assetId: z.string()
    })
  ).optional()
}))
export type CardGenerationResult = z.infer<typeof CardGenerationSchema>

// 2. Review Tips
export const ReviewTipSchema = z.preprocess((item: any) => {
  if (item && typeof item === "object") {
    return {
      severity: item.severity || "info",
      category: item.category || "content",
      message: item.message || item.tip || item.text || item.description || "Review tip"
    }
  }
  return item
}, z.object({
  severity: z.enum(["error", "warning", "info"]).catch("info"),
  category: z.enum(["citation", "typo", "figure", "layout", "content", "grounding"]).catch("content"),
  message: z.string()
}))

export const ReviewTipsSchema = z.preprocess((raw: any) => {
  if (Array.isArray(raw)) return { tips: raw }
  if (raw && typeof raw === "object") {
    const tips = raw.tips || raw.review || raw.issues || raw.feedback || raw.suggestions || []
    if (Array.isArray(tips)) return { tips }
  }
  return raw
}, z.object({
  tips: z.array(ReviewTipSchema)
}))
export type ReviewTipsResult = z.infer<typeof ReviewTipsSchema>

// 3. Compile Patch
export const CompilePatchSchema = z.preprocess((raw: any) => {
  if (raw && typeof raw === "object") {
    return {
      id: String(raw.id || raw.cardId || ""),
      content: String(raw.content || raw.patch || raw.text || "")
    }
  }
  return raw
}, z.object({
  id: z.string(),
  content: z.string() // The updated card content
}))

export const CompileFixesSchema = z.preprocess((raw: any) => {
  if (Array.isArray(raw)) return { patches: raw }
  if (raw && typeof raw === "object") {
    const patches = raw.patches || raw.fixes || raw.corrections || []
    if (Array.isArray(patches)) {
      return { explanation: raw.explanation || raw.message, patches }
    }
  }
  return raw
}, z.object({
  explanation: z.string().optional(),
  patches: z.array(CompilePatchSchema)
}))
export type CompileFixesResult = z.infer<typeof CompileFixesSchema>

// 4. Layout Warnings (VLM Review)
export const LayoutWarningSchema = z.object({
  cardId: z.string().optional(),
  cardTitle: z.union([z.string(), z.number()]).transform(v => String(v)).optional().default("Untitled"),
  issue: z.union([z.string(), z.number()]).transform(v => String(v)).optional().default("Layout overflow detected"),
  recommendation: z.union([z.string(), z.number()]).transform(v => String(v)).optional().default("Reduce content or adjust layout to fit."),
  estimatedOverflowCharacters: z.preprocess((val) => {
    if (typeof val === "number") return val
    if (typeof val === "string") {
      const parsed = parseInt(val.replace(/\D/g, ""), 10)
      return isNaN(parsed) ? undefined : parsed
    }
    return undefined
  }, z.number().optional()),
  compiledRevision: z.number().optional()
})

export const LayoutWarningsSchema = z.preprocess((raw: any) => {
  if (Array.isArray(raw)) {
    return { warnings: raw }
  }
  if (raw && typeof raw === "object") {
    const list = raw.warnings || raw.issues || raw.layoutWarnings || raw.results || raw.data || raw.tips || raw.overflows
    if (Array.isArray(list)) {
      return { warnings: list }
    }
    if (!raw.warnings) {
      return { warnings: [] }
    }
  }
  return raw
}, z.object({
  warnings: z.array(
    z.preprocess((item: any) => {
      if (item && typeof item === "object") {
        return {
          cardTitle: item.cardTitle || item.title || item.card || item.slideTitle || item.sectionTitle || item.heading || "Untitled",
          issue: item.issue || item.description || item.message || item.overflow || item.problem || "Layout overflow detected",
          recommendation: item.recommendation || item.fix || item.suggestion || item.solution || "Reduce content or adjust layout to fit.",
          estimatedOverflowCharacters: item.estimatedOverflowCharacters ?? item.overflowCharacters ?? item.chars ?? item.overflowChars,
          cardId: item.cardId,
          compiledRevision: item.compiledRevision,
        }
      }
      return item
    }, LayoutWarningSchema)
  ).default([])
}))
export type LayoutWarningsResult = z.infer<typeof LayoutWarningsSchema>

// 5. Shrink Content Patch
export const ShrinkContentSchema = z.preprocess((raw: any) => {
  if (typeof raw === "string") return { content: raw }
  if (raw && typeof raw === "object") {
    const content = raw.content || raw.shrunkContent || raw.text || raw.summary || ""
    return { content: Array.isArray(content) ? content.join("\n\n") : String(content) }
  }
  return raw
}, z.object({
  content: z.string().min(1)
}))
export type ShrinkContentResult = z.infer<typeof ShrinkContentSchema>

// 6. Document Structure Generation
export const StructureCardDefSchema = z.preprocess((raw: any) => {
  if (raw && typeof raw === "object") {
    const pattern = raw.pattern || "bullets"
    const validPatterns = [
      "bullets", "bullets-image", "bullets-two-images", "bullets-table",
      "image-focused", "title-slide", "figure-slide", "two-column",
      "section", "section-figure", "section-table", "section-two-figures", "references"
    ]
    return {
      title: String(raw.title || "Section"),
      pattern: validPatterns.includes(pattern) ? pattern : "bullets",
      column: typeof raw.column === "number" ? raw.column : undefined
    }
  }
  return raw
}, z.object({
  title: z.string(),
  pattern: z.string(),
  column: z.number().int().min(1).max(3).optional()
}))

export const StructureGenerationSchema = z.preprocess((raw: any) => {
  if (Array.isArray(raw)) return { cards: raw }
  if (raw && typeof raw === "object") {
    const cards = raw.cards || raw.sections || raw.slides || raw.blocks || []
    if (Array.isArray(cards)) return { cards }
  }
  return raw
}, z.object({
  cards: z.array(StructureCardDefSchema)
}))
export type StructureGenerationResult = z.infer<typeof StructureGenerationSchema>

// 7. Vision Captioning & Naming
export const VisionCaptionSchema = z.preprocess((raw: any) => {
  if (raw && typeof raw === "object") {
    return {
      name: raw.name || raw.filename || raw.title || "",
      originalCaption: raw.originalCaption || raw.caption || raw.label || "",
      description: raw.description || raw.summary || raw.details || ""
    }
  }
  return raw
}, z.object({
  name: z.string().optional().default(""),
  originalCaption: z.string().optional().default(""),
  description: z.string().optional().default(""),
}))
export type VisionCaptionResult = z.infer<typeof VisionCaptionSchema>

// 8. Vision OCR & Multimodal Document Extraction
export const VisionOcrEquationSchema = z.preprocess((item: any) => {
  if (typeof item === "string") {
    return { formula: item, name: "Equation" }
  }
  if (item && typeof item === "object") {
    return {
      key: item.key || undefined,
      name: item.name || item.title || "Equation",
      formula: String(item.formula || item.latex || item.math || ""),
      description: item.description || item.meaning || undefined,
    }
  }
  return item
}, z.object({
  key: z.string().optional(),
  name: z.string().optional().default("Equation"),
  formula: z.string(),
  description: z.string().optional(),
}))

export const VisionOcrTableSchema = z.preprocess((item: any) => {
  if (item && typeof item === "object") {
    return {
      caption: item.caption || item.title || "",
      markdown: item.markdown || item.text || "",
      rows: Array.isArray(item.rows) ? item.rows : undefined,
    }
  }
  return item
}, z.object({
  caption: z.string().optional().default(""),
  markdown: z.string().optional().default(""),
  rows: z.array(z.array(z.string())).optional(),
}))

export const VisionOcrSchema = z.preprocess((raw: any) => {
  if (raw && typeof raw === "object") {
    const equations = raw.equations || raw.formulas || raw.math || []
    const tables = raw.tables || (raw.table ? [raw.table] : [])
    return {
      text: String(raw.text || raw.transcription || raw.content || raw.markdown || ""),
      mode: raw.mode || "auto",
      title: raw.title || raw.name || "Scanned Content",
      summary: raw.summary || raw.description || "",
      equations: Array.isArray(equations) ? equations : [],
      tables: Array.isArray(tables) ? tables : [],
    }
  }
  return raw
}, z.object({
  text: z.string().default(""),
  mode: z.enum(["auto", "equation", "table", "text", "figure"]).catch("auto"),
  title: z.string().optional().default("Scanned Content"),
  summary: z.string().optional().default(""),
  equations: z.array(VisionOcrEquationSchema).default([]),
  tables: z.array(VisionOcrTableSchema).default([]),
}))
export type VisionOcrResult = z.infer<typeof VisionOcrSchema>


// 9. Thesis Review Section
export const EctsGradeSchema = z.enum(["A", "B", "C", "D", "E", "FX"])
export type EctsGrade = z.infer<typeof EctsGradeSchema>

export const ThesisSectionRatingSchema = z.enum(["A", "B", "C", "D", "E", "FX", "pending"]).catch("pending")

export const ThesisReviewSectionSchema = z.preprocess((raw: any) => {
  if (raw && typeof raw === "object") {
    return {
      sectionId: String(raw.sectionId || raw.id || raw.criterionId || "").trim(),
      criterionId: String(raw.criterionId || raw.sectionId || raw.id || "").trim(),
      text: String(raw.text || raw.content || raw.assessment || raw.comment || "").trim(),
      rating: raw.rating || raw.grade || raw.score || "pending",
      numericScore: typeof raw.numericScore === "number" ? raw.numericScore : undefined,
      suggestions: Array.isArray(raw.suggestions)
        ? raw.suggestions.map((s: any) => String(s).trim()).filter(Boolean)
        : [],
    }
  }
  return raw
}, z.object({
  sectionId: z.string(),
  criterionId: z.string(),
  text: z.string(),
  rating: ThesisSectionRatingSchema,
  numericScore: z.number().min(0).max(100).optional(),
  suggestions: z.array(z.string()).default([]),
}))
export type ThesisReviewSection = z.infer<typeof ThesisReviewSectionSchema>

export const ThesisReviewGenerationSchema = z.preprocess((raw: any) => {
  if (raw && typeof raw === "object") {
    const sections = raw.sections || raw.criteria || raw.evaluations || []
    const gradeRaw = raw.overallGrade || raw.grade || raw.overall
    const normalizedGrade = typeof gradeRaw === "string" ? gradeRaw.trim().toUpperCase() : undefined
    return {
      sections: Array.isArray(sections) ? sections : [],
      overallGrade: normalizedGrade && ["A", "B", "C", "D", "E", "FX"].includes(normalizedGrade) ? normalizedGrade : undefined,
      recommendation: String(raw.recommendation || raw.verdict || "").trim(),
      defenseQuestions: Array.isArray(raw.defenseQuestions)
        ? raw.defenseQuestions.map((q: any) => String(q).trim()).filter(Boolean)
        : Array.isArray(raw.questions) ? raw.questions.map((q: any) => String(q).trim()).filter(Boolean) : [],
      citationIssues: Array.isArray(raw.citationIssues)
        ? raw.citationIssues.map((i: any) => String(i).trim()).filter(Boolean)
        : Array.isArray(raw.issues) ? raw.issues.map((i: any) => String(i).trim()).filter(Boolean) : [],
    }
  }
  return raw
}, z.object({
  sections: z.array(ThesisReviewSectionSchema),
  overallGrade: EctsGradeSchema.optional(),
  recommendation: z.string(),
  defenseQuestions: z.array(z.string()).default([]),
  citationIssues: z.array(z.string()).default([]),
}))
export type ThesisReviewGenerationResult = z.infer<typeof ThesisReviewGenerationSchema>

// 10. Thesis Section (single criterion) Generation
export const ThesisSingleSectionSchema = z.preprocess((raw: any) => {
  if (raw && typeof raw === "object") {
    const gradeRaw = raw.rating || raw.grade
    const normalizedRating = typeof gradeRaw === "string" ? gradeRaw.trim().toUpperCase() : "pending"
    return {
      text: String(raw.text || raw.content || raw.assessment || raw.comment || "").trim(),
      rating: ["A", "B", "C", "D", "E", "FX", "pending"].includes(normalizedRating) ? normalizedRating : "pending",
      numericScore: typeof raw.numericScore === "number" ? raw.numericScore : undefined,
      suggestions: Array.isArray(raw.suggestions)
        ? raw.suggestions.map((s: any) => String(s).trim()).filter(Boolean)
        : [],
      defenseQuestions: Array.isArray(raw.defenseQuestions)
        ? raw.defenseQuestions.map((q: any) => String(q).trim()).filter(Boolean)
        : [],
    }
  }
  return raw
}, z.object({
  text: z.string(),
  rating: ThesisSectionRatingSchema,
  numericScore: z.number().min(0).max(100).optional(),
  suggestions: z.array(z.string()).default([]),
  defenseQuestions: z.array(z.string()).default([]),
}))
export type ThesisSingleSectionResult = z.infer<typeof ThesisSingleSectionSchema>

/**
 * Validates generated thesis review sections against expected criteria IDs.
 * Ensures every requested criterion is present exactly once and text is non-empty.
 */
export function validateGeneratedSections(
  sections: ThesisReviewSection[],
  expectedCriterionIds: string[]
): void {
  if (!sections || sections.length === 0) {
    throw new Error("No sections generated in thesis review.")
  }

  const seenIds = new Set<string>()
  const expectedSet = new Set(expectedCriterionIds)

  for (const section of sections) {
    const cid = section.criterionId || section.sectionId
    if (!cid) {
      throw new Error("Section is missing criterionId.")
    }
    if (!expectedSet.has(cid)) {
      throw new Error(`Unexpected criterion ID in generated review: "${cid}".`)
    }
    if (seenIds.has(cid)) {
      throw new Error(`Duplicate criterion ID in generated review: "${cid}".`)
    }
    seenIds.add(cid)

    if (!section.text || !section.text.trim()) {
      throw new Error(`Assessment text for criterion "${cid}" is empty.`)
    }
  }

  // Only require core evaluation criteria (defense questions are returned as top-level array)
  const coreExpected = expectedCriterionIds.filter((id) => id !== "defense_questions")
  for (const expected of coreExpected) {
    if (!seenIds.has(expected)) {
      throw new Error(`Missing expected criterion in generated review: "${expected}".`)
    }
  }
}

// 11. Evidence Reference Schema
export const EvidenceReferenceSchema = z.preprocess((raw: any) => {
  if (raw && typeof raw === "object") {
    return {
      id: raw.id ? String(raw.id) : undefined,
      evidenceType: raw.evidenceType ? String(raw.evidenceType) : "quote",
      sourceDocumentId: raw.sourceDocumentId ? String(raw.sourceDocumentId) : undefined,
      sourceRevision: raw.sourceRevision ? String(raw.sourceRevision) : undefined,
      chunkId: raw.chunkId ? String(raw.chunkId) : undefined,
      page: typeof raw.page === "number" ? raw.page : undefined,
      pageNumber: typeof raw.pageNumber === "number" ? raw.pageNumber : (typeof raw.page === "number" ? raw.page : undefined),
      sectionHeading: String(raw.sectionHeading || raw.sectionTitle || raw.section || raw.heading || "").trim() || undefined,
      sectionTitle: String(raw.sectionTitle || raw.sectionHeading || raw.section || raw.heading || "").trim() || undefined,
      quote: String(raw.quote || raw.exactQuote || raw.text || raw.snippet || "").trim(),
      exactQuote: raw.exactQuote ? String(raw.exactQuote).trim() : undefined,
      normalizedSummary: raw.normalizedSummary ? String(raw.normalizedSummary).trim() : undefined,
      relevanceExplanation: raw.relevanceExplanation ? String(raw.relevanceExplanation).trim() : undefined,
      confidence: typeof raw.confidence === "number" ? raw.confidence : undefined,
      startOffset: typeof raw.startOffset === "number" ? raw.startOffset : undefined,
      endOffset: typeof raw.endOffset === "number" ? raw.endOffset : undefined,
      verified: typeof raw.verified === "boolean" ? raw.verified : undefined,
      state: raw.state ? String(raw.state) : undefined,
      verificationMethod: raw.verificationMethod ? String(raw.verificationMethod) : undefined,
      staleAt: raw.staleAt ? String(raw.staleAt) : undefined,
    }
  }
  return raw
}, z.object({
  id: z.string().optional(),
  evidenceType: z.enum(["quote", "section_summary", "structural_signal", "metadata", "citation_record", "retrieval_result"]).default("quote"),
  sourceDocumentId: z.string().optional(),
  sourceRevision: z.string().optional(),
  chunkId: z.string().optional(),
  page: z.number().optional(),
  pageNumber: z.number().optional(),
  sectionHeading: z.string().optional(),
  sectionTitle: z.string().optional(),
  quote: z.string(),
  exactQuote: z.string().optional(),
  normalizedSummary: z.string().optional(),
  relevanceExplanation: z.string().optional(),
  confidence: z.number().optional(),
  startOffset: z.number().optional(),
  endOffset: z.number().optional(),
  verified: z.boolean().optional(),
  state: z.enum(["verified-exact", "verified-normalized", "approximate", "unverified", "stale", "ambiguous", "verified"]).optional(),
  verificationMethod: z.enum(["exact", "whitespace_normalized", "approximate", "structural", "manual", "semantic_embedding"]).optional(),
  staleAt: z.string().optional(),
}))
export type EvidenceReferenceContract = z.infer<typeof EvidenceReferenceSchema>

// 12. Review Finding Schema
export const ReviewFindingContractSchema = z.preprocess((raw: any) => {
  if (raw && typeof raw === "object") {
    const rawSev = String(raw.severity || "minor").toLowerCase().trim()
    const severity = ["critical", "major", "minor", "suggestion", "info"].includes(rawSev) ? rawSev : "minor"
    const rawCat = String(raw.category || "methodology").toLowerCase().trim()
    const category = ["methodology", "results", "statistics", "literature", "reproducibility", "ethics", "formal"].includes(rawCat) ? rawCat : "methodology"
    const rawStatus = String(raw.status || "unreviewed").toLowerCase().trim()
    const status = ["unreviewed", "accepted", "edited", "rejected", "resolved"].includes(rawStatus) ? rawStatus : "unreviewed"

    const rawEpistemic = String(raw.epistemicStatus || "").trim()
    const validEpistemic = [
      "SUPPORTED_FACT",
      "SUPPORTED_INTERPRETATION",
      "REVIEWER_JUDGMENT",
      "MISSING_EVIDENCE",
      "POSSIBLE_RISK",
      "REQUIRES_HUMAN_VERIFICATION",
    ]
    const epistemicStatus = validEpistemic.includes(rawEpistemic) ? rawEpistemic : "REVIEWER_JUDGMENT"

    const rawFindingType = String(raw.findingType || "weakness").toLowerCase().trim()
    const validFindingTypes = ["strength", "weakness", "risk", "missing_evidence", "question", "recommendation"]
    const findingType = validFindingTypes.includes(rawFindingType) ? rawFindingType : "weakness"

    const evidenceRaw = Array.isArray(raw.evidence) ? raw.evidence : (raw.evidence ? [raw.evidence] : [])
    const evidence = evidenceRaw.map((ev: any) => {
      if (typeof ev === "string") return { quote: ev }
      return ev
    })

    return {
      id: String(raw.id || `f-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
      criterionId: raw.criterionId ? String(raw.criterionId) : undefined,
      criterionKey: raw.criterionKey ? String(raw.criterionKey) : (raw.criterionId ? String(raw.criterionId) : undefined),
      category,
      title: String(raw.title || raw.heading || "Observation").trim(),
      findingType,
      epistemicStatus,
      explanation: String(raw.explanation || raw.description || raw.text || "").trim(),
      recommendation: String(raw.recommendation || raw.fix || raw.action || "").trim(),
      suggestedRevision: raw.suggestedRevision ? String(raw.suggestedRevision).trim() : undefined,
      severity,
      confidence: typeof raw.confidence === "number" ? Math.min(1, Math.max(0, raw.confidence)) : 0.85,
      impact: raw.impact ? String(raw.impact).trim() : undefined,
      evidence,
      status,
      decisionStatus: raw.decisionStatus && ["open", "accepted", "dismissed", "edited", "needs_human_review"].includes(String(raw.decisionStatus)) ? String(raw.decisionStatus) : "open",
      humanRationale: raw.humanRationale ? String(raw.humanRationale).trim() : undefined,
      reviewerNotes: raw.reviewerNotes ? String(raw.reviewerNotes).trim() : undefined,
      includeInExport: raw.includeInExport !== false,
      createdBy: raw.createdBy === "reviewer" ? "reviewer" : "ai",
      source: raw.source ? String(raw.source).trim() : undefined,
      audience: raw.audience && ["author", "editor", "committee", "private", "public"].includes(String(raw.audience)) ? String(raw.audience) : "author",
      sourceRevision: raw.sourceRevision ? String(raw.sourceRevision) : undefined,
      createdAt: raw.createdAt ? String(raw.createdAt) : undefined,
      updatedAt: raw.updatedAt ? String(raw.updatedAt) : undefined,
    }
  }
  return raw
}, z.object({
  id: z.string(),
  criterionId: z.string().optional(),
  criterionKey: z.string().optional(),
  category: z.enum(["methodology", "results", "statistics", "literature", "reproducibility", "ethics", "formal"]),
  title: z.string(),
  findingType: z.enum(["strength", "weakness", "risk", "missing_evidence", "question", "recommendation"]).default("weakness"),
  epistemicStatus: z.enum(["SUPPORTED_FACT", "SUPPORTED_INTERPRETATION", "REVIEWER_JUDGMENT", "MISSING_EVIDENCE", "POSSIBLE_RISK", "REQUIRES_HUMAN_VERIFICATION"]).default("REVIEWER_JUDGMENT"),
  explanation: z.string(),
  recommendation: z.string().default(""),
  suggestedRevision: z.string().optional(),
  severity: z.enum(["critical", "major", "minor", "suggestion", "info"]),
  confidence: z.number().min(0).max(1).default(0.85),
  impact: z.string().optional(),
  evidence: z.array(EvidenceReferenceSchema).default([]),
  status: z.enum(["unreviewed", "accepted", "edited", "rejected", "resolved"]).default("unreviewed"),
  decisionStatus: z.enum(["open", "accepted", "dismissed", "edited", "needs_human_review"]).default("open"),
  humanRationale: z.string().optional(),
  reviewerNotes: z.string().optional(),
  includeInExport: z.boolean().default(true),
  createdBy: z.enum(["ai", "reviewer"]).default("ai"),
  source: z.string().optional(),
  audience: z.enum(["author", "editor", "committee", "private", "public"]).default("author"),
  sourceRevision: z.string().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
}))
export type ReviewFindingContract = z.infer<typeof ReviewFindingContractSchema>

// 13. Reporting Guideline Check Schema
export const ReportingGuidelineCheckContractSchema = z.preprocess((raw: any) => {
  if (raw && typeof raw === "object") {
    const rawStat = String(raw.status || "compliant").toLowerCase().trim()
    const status = ["compliant", "partial", "missing", "not_applicable"].includes(rawStat) ? rawStat : "compliant"
    return {
      item: String(raw.item || raw.name || "Item").trim(),
      category: String(raw.category || "General").trim(),
      status,
      notes: String(raw.notes || raw.explanation || "").trim(),
      evidenceQuote: raw.evidenceQuote ? String(raw.evidenceQuote).trim() : undefined,
    }
  }
  return raw
}, z.object({
  item: z.string(),
  category: z.string(),
  status: z.enum(["compliant", "partial", "missing", "not_applicable"]),
  notes: z.string(),
  evidenceQuote: z.string().optional(),
}))
export type ReportingGuidelineCheckContract = z.infer<typeof ReportingGuidelineCheckContractSchema>

// 14. Full Professional Review Generation Output Schema
export const ProfessionalReviewGenerationSchema = z.preprocess((raw: any) => {
  if (raw && typeof raw === "object") {
    const strengths = Array.isArray(raw.strengths)
      ? raw.strengths.map((s: any) => String(s).trim()).filter(Boolean)
      : []
    const findings = Array.isArray(raw.findings) ? raw.findings : []
    const questionsForAuthors = Array.isArray(raw.questionsForAuthors)
      ? raw.questionsForAuthors.map((q: any) => String(q).trim()).filter(Boolean)
      : (Array.isArray(raw.defenseQuestions) ? raw.defenseQuestions.map((q: any) => String(q).trim()).filter(Boolean) : [])
    const reportingGuidelineChecks = Array.isArray(raw.reportingGuidelineChecks) ? raw.reportingGuidelineChecks : []

    return {
      summary: String(raw.summary || raw.executiveSummary || raw.overview || "").trim(),
      strengths,
      findings,
      reportingStandard: String(raw.reportingStandard || "none"),
      reportingGuidelineChecks,
      questionsForAuthors,
      confidentialComments: raw.confidentialComments ? String(raw.confidentialComments).trim() : undefined,
      debateLog: raw.debateLog ? String(raw.debateLog).trim() : undefined,
      recommendation: String(raw.recommendation || raw.verdict || "minor_revisions").trim(),
      grade: raw.grade ? String(raw.grade).trim().toUpperCase() : undefined,
    }
  }
  return raw
}, z.object({
  summary: z.string(),
  strengths: z.array(z.string()).default([]),
  findings: z.array(ReviewFindingContractSchema).default([]),
  reportingStandard: z.enum(["consort", "prisma", "strobe", "ml_reproducibility", "none"]).default("none"),
  reportingGuidelineChecks: z.array(ReportingGuidelineCheckContractSchema).default([]),
  questionsForAuthors: z.array(z.string()).default([]),
  confidentialComments: z.string().optional(),
  debateLog: z.string().optional(),
  recommendation: z.string().default("minor_revisions"),
  grade: z.string().optional(),
}))
export type ProfessionalReviewGenerationResult = z.infer<typeof ProfessionalReviewGenerationSchema>


