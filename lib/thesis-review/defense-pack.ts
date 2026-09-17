/**
 * Defense Pack — risk scoring, readiness summary and Markdown export for the
 * defense-prep panel (audit 2026-09-17, friction #4).
 *
 * The panel previously hardcoded three demo questions with no way to see
 * which of them could sink the defense. This module is the pure core:
 * scoring, sorting, a readiness verdict and a copyable Markdown pack. It is
 * deliberately UI-agnostic and fully unit-tested.
 */

export type DefenseDifficulty = "standard" | "probing" | "challenging"

export interface DefensePackQuestion {
  id: string
  category: string
  questionText: string
  difficulty: DefenseDifficulty
  derivedFromFindingTitle?: string
  suggestedTalkingPoints: string[]
  recommendedEvidenceQuote?: string
}

const BASE_RISK: Record<DefenseDifficulty, number> = {
  standard: 30,
  probing: 55,
  challenging: 80,
}

/**
 * Categories that historically dominate failed defenses — a hard question in
 * one of them weighs more than the same question about presentation style.
 */
const HIGH_STAKES_CATEGORY_FRAGMENTS = [
  "metodol", // metodológia / methodology
  "statist", // štatistika / statistics
  "validácia", // validation
  "validat", // validation (EN)
  "korektnosť", // correctness
  "novelt", // novelty
  "prínos", // contribution
]

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Lowercase + strip diacritics so "Štatistická" matches "statist". */
function normalizeCategory(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
}

/**
 * Heuristic risk 0–100: difficulty is the base; high-stakes categories add
 * up to +15; missing evidence or thin talking points add up to +15 more,
 * because the candidate cannot lean on prepared material.
 */
export function defenseQuestionRiskScore(question: DefensePackQuestion): number {
  let score = BASE_RISK[question.difficulty] ?? 50

  const category = normalizeCategory(question.category || "")
  const highStakes = HIGH_STAKES_CATEGORY_FRAGMENTS.some((f) => category.includes(f))
  if (highStakes) score += 15

  const hasEvidence = Boolean(question.recommendedEvidenceQuote?.trim())
  const points = question.suggestedTalkingPoints.filter((p) => p.trim().length > 0).length
  if (!hasEvidence) score += 10
  if (points === 0) score += 5
  else if (points === 1) score += 2

  return clamp(Math.round(score), 0, 100)
}

export type DefenseRiskLevel = "low" | "medium" | "high"

export function riskLevel(score: number): DefenseRiskLevel {
  if (score >= 70) return "high"
  if (score >= 45) return "medium"
  return "low"
}

/** Highest-risk first; stable for equal scores (keeps the authored order). */
export function sortQuestionsByRisk<T extends DefensePackQuestion>(questions: T[]): T[] {
  return [...questions]
    .map((q, i) => ({ q, i }))
    .sort((a, b) => {
      const diff = defenseQuestionRiskScore(b.q) - defenseQuestionRiskScore(a.q)
      return diff !== 0 ? diff : a.i - b.i
    })
    .map(({ q }) => q)
}

export interface DefenseReadiness {
  total: number
  byDifficulty: Record<DefenseDifficulty, number>
  highRisk: number
  mediumRisk: number
  lowRisk: number
  /** 0–100, share of questions with an evidence quote prepared. */
  evidenceCoverage: number
  verdict: "ready" | "needs-preparation" | "at-risk"
  /** One-line, human-readable recommendation (Slovak, matches the panel). */
  recommendation: string
}

export function summarizeDefenseReadiness(questions: DefensePackQuestion[]): DefenseReadiness {
  const byDifficulty: Record<DefenseDifficulty, number> = {
    standard: 0,
    probing: 0,
    challenging: 0,
  }
  let high = 0
  let medium = 0
  let low = 0
  let withEvidence = 0

  for (const q of questions) {
    byDifficulty[q.difficulty] = (byDifficulty[q.difficulty] ?? 0) + 1
    const level = riskLevel(defenseQuestionRiskScore(q))
    if (level === "high") high++
    else if (level === "medium") medium++
    else low++
    if (q.recommendedEvidenceQuote?.trim()) withEvidence++
  }

  const total = questions.length
  const evidenceCoverage = total === 0 ? 0 : Math.round((withEvidence / total) * 100)

  let verdict: DefenseReadiness["verdict"] = "ready"
  let recommendation = "Všetky otázky majú pripravenú argumentačnú líniu — odporúčame pred obhajobou ešte jeden nácvik."
  if (total === 0) {
    recommendation = "Žiadne otázky — najprv vygenerujte posudok, aby sa otázky odvodili zo zistení."
  } else if (high > Math.ceil(total / 3) || evidenceCoverage < 34) {
    verdict = "at-risk"
    recommendation = `${high} otázka/-ok je vysokej rizikovosti a evidencia pokrýva iba ${evidenceCoverage} % otázok — doplňte citácie a argumentačné body k otázkam s červeným rizikom.`
  } else if (high > 0 || evidenceCoverage < 67) {
    verdict = "needs-preparation"
    recommendation = `Pripravené s rezervami: ${high} vysokej a ${medium} strednej rizikovosti. Precvičte otázky zoradené podľa rizika a doplňte chýbajúce citácie.`
  }

  return { total, byDifficulty, highRisk: high, mediumRisk: medium, lowRisk: low, evidenceCoverage, verdict, recommendation }
}

export interface DefensePackMeta {
  /** Thesis / workspace title. */
  title?: string
  author?: string
  /** Review role header, e.g. "Oponentský posudok" — defaults to defense prep. */
  program?: string
}

function difficultyLabel(d: DefenseDifficulty): string {
  if (d === "challenging") return "Náročná"
  if (d === "probing") return "Hĺbková"
  return "Štandardná"
}

function riskLabel(level: DefenseRiskLevel): string {
  if (level === "high") return "VYSOKÉ"
  if (level === "medium") return "STREDNÉ"
  return "nízke"
}

/**
 * Build the copyable Defense Pack: every question with its risk score,
 * talking points and evidence quote, headed by a readiness summary. Markdown
 * so it pastes cleanly into Notion/Docs/Word or prints via a converter.
 */
export function buildDefensePackMarkdown(meta: DefensePackMeta, questions: DefensePackQuestion[]): string {
  const readiness = summarizeDefenseReadiness(questions)
  const lines: string[] = []

  lines.push(`# Balíček na obhajobu — ${meta.title?.trim() || "dizertačná práca"}`)
  if (meta.author?.trim()) lines.push(`**Kandidát:** ${meta.author.trim()}`)
  lines.push("")
  lines.push(
    `**Súhrn pripravenosti:** ${readiness.total} otázok · ${readiness.highRisk} vysoké / ${readiness.mediumRisk} stredné / ${readiness.lowRisk} nízke riziko · evidencia ${readiness.evidenceCoverage} %`
  )
  lines.push(`**Odporúčanie:** ${readiness.recommendation}`)
  lines.push("")

  if (questions.length === 0) {
    lines.push("_Žiadne otázky na obhajobu. Vygenerujte najprv posudok (krok 4/5)._")
    return lines.join("\n")
  }

  lines.push("## Otázky zoradené podľa rizika")
  lines.push("")
  sortQuestionsByRisk(questions).forEach((q, idx) => {
    const score = defenseQuestionRiskScore(q)
    const level = riskLevel(score)
    lines.push(`### ${idx + 1}. ${q.questionText}`)
    lines.push(`- **Kategória:** ${q.category} · **Náročnosť:** ${difficultyLabel(q.difficulty)} · **Riziko:** ${riskLabel(level)} (${score}/100)`)
    if (q.derivedFromFindingTitle) lines.push(`- **Odvodené zo zistenia:** ${q.derivedFromFindingTitle}`)
    if (q.suggestedTalkingPoints.length > 0) {
      lines.push("- **Argumentačná línia:**")
      for (const p of q.suggestedTalkingPoints) lines.push(`  - ${p}`)
    }
    if (q.recommendedEvidenceQuote) lines.push(`- **Evidencia z práce:** „${q.recommendedEvidenceQuote}“`)
    lines.push("")
  })

  return lines.join("\n").trimEnd() + "\n"
}
