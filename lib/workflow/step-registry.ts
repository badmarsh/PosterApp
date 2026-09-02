/**
 * Config-Driven Workflow Step Registry for Academic Thesis Review.
 *
 * Supports dynamic pipelines ranging from legacy 4-step, standard 6-step,
 * to full academic 10-step workflows.
 */

import {
  FileUp,
  Cpu,
  Compass,
  SearchCode,
  FileEdit,
  Award,
  ShieldAlert,
  UserCheck,
  GraduationCap,
  Scale,
  GitCompare,
  type LucideIcon,
} from "lucide-react"

export type WorkflowPresetId = "fast_4_step" | "standard_6_step" | "academic_full_10_step" | "custom"

export type WorkflowStepId =
  | "document_integrity"      // Krok 1: Podklad & Integrita
  | "plagiarism_check"        // Modular: Plagiátorstvo & AI detekcia
  | "supervisor_signoff"      // Modular: Stanovisko vedúceho práce
  | "text_understanding"      // Krok 2: Porozumenie textu & metadáta
  | "plan_and_rubric"         // Krok 3: Pre-flight plán & rubrika
  | "evidence_analysis"       // Krok 4: Dôkazová analýza & RAG
  | "draft_review"            // Krok 5: Návrh posudku
  | "verification_and_export" // Krok 6: Verifikácia & Export
  | "reviewer_calibration"    // Modular: Kalibrácia viacerých posudzovateľov
  | "defense_prep"            // Modular: Príprava na obhajobu (Otázky)
  | "post_export_followup"    // Modular: Sledovanie zapracovania pripomienok

export interface WorkflowStepConfig {
  id: WorkflowStepId
  number: number
  title: string
  shortTitle: string
  description: string
  iconName: string
  category: "ingestion" | "planning" | "analysis" | "synthesis" | "decision" | "followup"
  isOptional?: boolean
  badge?: string
  checkDone: (ctx: WorkflowContext) => boolean
  checkAvailable: (ctx: WorkflowContext) => boolean
}

export interface WorkflowContext {
  hasDocument: boolean
  isParsing: boolean
  isIndexed: boolean
  chunkCount: number
  isFormValid: boolean
  hasPlan: boolean
  hasReview: boolean
  isConfirmed: boolean
  hasPlagiarismReport?: boolean
  hasSupervisorNotes?: boolean
  hasDefensePrep?: boolean
  hasCalibrationDiff?: boolean
  hasFollowupTasks?: boolean
  savedReviewsCount?: number
}

// Icon mapping lookup
export const STEP_ICON_MAP: Record<string, LucideIcon> = {
  FileUp,
  Cpu,
  Compass,
  SearchCode,
  FileEdit,
  Award,
  ShieldAlert,
  UserCheck,
  GraduationCap,
  Scale,
  GitCompare,
}

export const ALL_WORKFLOW_STEPS: Record<WorkflowStepId, Omit<WorkflowStepConfig, "number">> = {
  document_integrity: {
    id: "document_integrity",
    title: "Podklad & Integrita",
    shortTitle: "Integrita",
    description: "Nahratie PDF rukopisu a verifikácia integrity textu",
    iconName: "FileUp",
    category: "ingestion",
    checkDone: (ctx) => ctx.hasDocument && !ctx.isParsing,
    checkAvailable: () => true,
  },
  plagiarism_check: {
    id: "plagiarism_check",
    title: "Plagiátorstvo & AI detekcia",
    shortTitle: "Plagiáty",
    description: "Analýza zhody textu, parafráz a syntetických vzorov",
    iconName: "ShieldAlert",
    category: "ingestion",
    isOptional: true,
    badge: "Integrita",
    checkDone: (ctx) => Boolean(ctx.hasPlagiarismReport),
    checkAvailable: (ctx) => ctx.hasDocument && !ctx.isParsing,
  },
  supervisor_signoff: {
    id: "supervisor_signoff",
    title: "Stanovisko školiteľa",
    shortTitle: "Školiteľ",
    description: "Zadanie poznámok a hodnotenia vedúceho práce pred oponentským posudkom",
    iconName: "UserCheck",
    category: "planning",
    isOptional: true,
    badge: "Vstup",
    checkDone: (ctx) => Boolean(ctx.hasSupervisorNotes),
    checkAvailable: (ctx) => ctx.hasDocument,
  },
  text_understanding: {
    id: "text_understanding",
    title: "Porozumenie textu",
    shortTitle: "Porozumenie",
    description: "Automatická extrakcia štruktúry a klasifikácia odboru",
    iconName: "Cpu",
    category: "planning",
    checkDone: (ctx) => ctx.hasDocument && !ctx.isParsing && ctx.isFormValid,
    checkAvailable: (ctx) => ctx.hasDocument && !ctx.isParsing,
  },
  plan_and_rubric: {
    id: "plan_and_rubric",
    title: "Plán & Rubrika",
    shortTitle: "Plán",
    description: "Konfigurácia váh fakulty a pre-flight evaluačný plán",
    iconName: "Compass",
    category: "planning",
    checkDone: (ctx) => Boolean(ctx.hasPlan || (ctx.isIndexed && ctx.isFormValid)),
    checkAvailable: (ctx) => ctx.isFormValid && ctx.hasDocument,
  },
  evidence_analysis: {
    id: "evidence_analysis",
    title: "Dôkazová analýza",
    shortTitle: "Dôkazy",
    description: "Vektorový RAG prieskum a ukotvenie citácií s char-offsetmi",
    iconName: "SearchCode",
    category: "analysis",
    checkDone: (ctx) => ctx.hasReview,
    checkAvailable: (ctx) => ctx.isIndexed && ctx.isFormValid,
  },
  draft_review: {
    id: "draft_review",
    title: "Návrh posudku",
    shortTitle: "Návrh",
    description: "14-sekčný akademický posudok s ECTS známkami",
    iconName: "FileEdit",
    category: "synthesis",
    checkDone: (ctx) => ctx.hasReview,
    checkAvailable: (ctx) => ctx.isFormValid && (ctx.isIndexed || ctx.hasDocument),
  },
  verification_and_export: {
    id: "verification_and_export",
    title: "Verifikácia & Export",
    shortTitle: "Export",
    description: "Potvrdenie konečnej známky človekom a export do DOCX/PDF/AIS2",
    iconName: "Award",
    category: "decision",
    checkDone: (ctx) => ctx.isConfirmed,
    checkAvailable: (ctx) => ctx.hasReview,
  },
  reviewer_calibration: {
    id: "reviewer_calibration",
    title: "Kalibrácia posudzovateľov",
    shortTitle: "Kalibrácia",
    description: "Porovnanie a detekcia rozdielov medzi školiteľom a oponentom",
    iconName: "Scale",
    category: "decision",
    isOptional: true,
    badge: "Konsenzus",
    checkDone: (ctx) => Boolean(ctx.hasCalibrationDiff),
    checkAvailable: (ctx) => (ctx.savedReviewsCount || 0) >= 2 || ctx.hasReview,
  },
  defense_prep: {
    id: "defense_prep",
    title: "Príprava na obhajobu",
    shortTitle: "Obhajoba",
    description: "Generovanie cielených otázok a bodov argumentácie na obhajobu",
    iconName: "GraduationCap",
    category: "followup",
    isOptional: true,
    badge: "Otázky",
    checkDone: (ctx) => Boolean(ctx.hasDefensePrep),
    checkAvailable: (ctx) => ctx.hasReview,
  },
  post_export_followup: {
    id: "post_export_followup",
    title: "Zapracovanie pripomienok",
    shortTitle: "Sledovanie",
    description: "Sledovanie stavu riešenia návrhov na zlepšenie v opravenej verzii",
    iconName: "GitCompare",
    category: "followup",
    isOptional: true,
    badge: "Revízia",
    checkDone: (ctx) => Boolean(ctx.hasFollowupTasks),
    checkAvailable: (ctx) => ctx.hasReview && ctx.isConfirmed,
  },
}

export const WORKFLOW_PRESETS: Record<WorkflowPresetId, { name: string; description: string; stepIds: WorkflowStepId[] }> = {
  standard_6_step: {
    name: "Štandardný akademický posudok (6 krokov)",
    description: "Oficiálny odporúčaný postup pre záverečné a rigorózne práce",
    stepIds: [
      "document_integrity",
      "text_understanding",
      "plan_and_rubric",
      "evidence_analysis",
      "draft_review",
      "verification_and_export",
    ],
  },
  academic_full_10_step: {
    name: "Kompletný expertný proces s obhajobou (10 krokov)",
    description: "Rozšírený proces s kontrolou plagiátov, stanoviskom školiteľa, kalibráciou a otázkami na obhajobu",
    stepIds: [
      "document_integrity",
      "plagiarism_check",
      "supervisor_signoff",
      "text_understanding",
      "plan_and_rubric",
      "evidence_analysis",
      "draft_review",
      "verification_and_export",
      "reviewer_calibration",
      "defense_prep",
    ],
  },
  fast_4_step: {
    name: "Rýchly prehľad (4 kroky - Legacy kompatibilný)",
    description: "Základný zrýchlený režim pre rýchle overenie rukopisu",
    stepIds: [
      "document_integrity",
      "text_understanding",
      "evidence_analysis",
      "draft_review",
    ],
  },
  custom: {
    name: "Vlastný prispôsobený proces",
    description: "Užívateľom nakonfigurované kroky podľa interných predpisov katedry",
    stepIds: [
      "document_integrity",
      "plagiarism_check",
      "text_understanding",
      "plan_and_rubric",
      "evidence_analysis",
      "draft_review",
      "verification_and_export",
      "defense_prep",
      "post_export_followup",
    ],
  },
}

/**
 * Builds an array of ordered WorkflowStepConfig objects for the active preset.
 */
export function buildWorkflowSteps(
  presetId: WorkflowPresetId = "standard_6_step",
  customStepIds?: WorkflowStepId[]
): WorkflowStepConfig[] {
  const stepIds = customStepIds && customStepIds.length > 0
    ? customStepIds
    : WORKFLOW_PRESETS[presetId]?.stepIds || WORKFLOW_PRESETS.standard_6_step.stepIds

  return stepIds.map((id, index) => {
    const stepDef = ALL_WORKFLOW_STEPS[id] || ALL_WORKFLOW_STEPS.document_integrity
    return {
      ...stepDef,
      number: index + 1,
    }
  })
}

