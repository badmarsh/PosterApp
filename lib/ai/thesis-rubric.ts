/**
 * Thesis rubric: structured evaluation criteria for diploma/bachelor/PhD theses.
 *
 * Supports three languages: Slovak (sk), Czech (cs), English (en).
 * Each criterion has a machine ID, label, weight, and guidance text for the AI.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ThesisType = "bachelor" | "master" | "phd"
export type ReviewerRole = "supervisor" | "opponent"
export type ReviewLanguage = "sk" | "cs" | "en"
export type CriterionRating = "A" | "B" | "C" | "D" | "E" | "FX" | "pending"

export interface ThesisCriterion {
  id: string
  category: "formal" | "content" | "language" | "citations" | "defense"
  /** Weight in percent (all weights sum to 100 within a type) */
  weight: number
  labels: Record<ReviewLanguage, string>
  guidance: Record<ReviewLanguage, string>
}

export interface ThesisSection {
  id: string
  sectionId?: string
  criterionId: string
  /** Generated/user-edited assessment text */
  text: string
  /** Optional ECTS-style rating for this criterion */
  rating?: CriterionRating
  /** 0–100 numeric score (optional, for numeric grading schemes) */
  numericScore?: number
  /** AI-generated suggestions for improvement */
  suggestions?: string[]
}

export interface ThesisMetadata {
  studentName: string
  thesisTitle: string
  thesisType: ThesisType
  reviewerRole: ReviewerRole
  reviewerName?: string
  institution?: string
  department?: string
  language: ReviewLanguage
  grade?: string
  recommendation?: string
  academicYear?: string
  targetVenue?: string
  reviewKind?: "thesis" | "paper" | "grant"
}

export interface ThesisLevelProfile {
  evidenceExpectations: string[]
  originalityExpectation: string
  methodologyExpectation: string
  gradeAnchors: Record<Exclude<CriterionRating, "pending">, string>
}

export const THESIS_LEVEL_PROFILES: Record<ThesisType, ThesisLevelProfile> = {
  bachelor: {
    evidenceExpectations: [
      "Demonstrates clear comprehension of fundamentals and relevant literature",
      "Correct application of standard tools, frameworks, and methodologies",
      "Complete implementation fulfilling all specified project goals",
      "Readable, well-structured documentation following academic conventions",
    ],
    originalityExpectation: "Competent independent implementation or synthesis of established methods.",
    methodologyExpectation: "Sound application of existing methodologies with clear justification of tool choices.",
    gradeAnchors: {
      A: "Flawless execution, excellent understanding, rigorous testing, high quality documentation.",
      B: "Above-average execution with minor gaps in evaluation or slight documentation flaws.",
      C: "Good execution fulfilling all core requirements with average depth and minor flaws.",
      D: "Acceptable work meeting essential objectives with notable omissions in analysis or presentation.",
      E: "Barely sufficient work meeting minimal requirements with significant deficiencies.",
      FX: "Unacceptable work failing to meet core assignment objectives or demonstrating fundamental errors.",
    },
  },
  master: {
    evidenceExpectations: [
      "Independent synthesis of contemporary research and state of the art",
      "Methodological justification, critical analysis, and meaningful comparison against baselines",
      "Robust experimental evaluation with quantified metrics and statistical rigor",
      "Practical or scientific contribution with clear applicability",
    ],
    originalityExpectation: "Defensible originality, innovative problem formulation, or non-trivial extension of state of the art.",
    methodologyExpectation: "Rigorous methodology with formal design, thorough validation, and ablation/comparative study.",
    gradeAnchors: {
      A: "Outstanding research depth, rigorous comparative evaluation, publishable-quality results.",
      B: "Very good work with sound methodology and solid evaluation; minor depth or stylistic gaps.",
      C: "Good work meeting all objectives; evaluation is standard with limited critical depth.",
      D: "Satisfactory work fulfilling basic goals but lacking thorough experimental or analytical depth.",
      E: "Marginal work with major methodological or analytical weaknesses, barely passing standards.",
      FX: "Failing work with invalid methodology, missing goals, or inadequate evaluation.",
    },
  },
  phd: {
    evidenceExpectations: [
      "Significant, peer-review publishable original scientific contribution",
      "Exhaustive coverage of international state of the art with deep critical insight",
      "Reproducible, rigorous experimental methodology with formal validation",
      "Clear advancement of theoretical or applied frontiers of the field",
    ],
    originalityExpectation: "Substantial original scientific contribution with demonstrated novelty and impact.",
    methodologyExpectation: "Exemplary scientific rigor, theoretical soundness, and defensible experimental design.",
    gradeAnchors: {
      A: "Exceptional scientific contribution, international publication standard, groundbreaking insights.",
      B: "High-quality doctoral research with clear novelty and strong experimental validation.",
      C: "Adequate doctoral work with valid contribution but limited scope or incremental novelty.",
      D: "Marginally acceptable doctoral dissertation with weak theoretical backing or limited evaluation.",
      E: "Deficient doctoral work barely meeting formal dissertation requirements.",
      FX: "Unacceptable doctoral dissertation lacking scientific contribution or containing invalid methodology.",
    },
  },
}

// ---------------------------------------------------------------------------
// Rubric definitions
// ---------------------------------------------------------------------------

export const THESIS_CRITERIA: ThesisCriterion[] = [
  // --- Formal ---
  {
    id: "formal_structure",
    category: "formal",
    weight: 10,
    labels: {
      sk: "Formálna štruktúra a úprava",
      cs: "Formální struktura a úprava",
      en: "Formal structure and layout",
    },
    guidance: {
      sk: "Hodnoťte členenie práce (úvod, jadro, záver, zoznam literatúry, prílohy), dodržiavanie predpísaného rozsahu, typografickú úpravu, číslovanie strán, tabuliek a obrázkov.",
      cs: "Hodnoťte členění práce, rozsah, typografickou úpravu, číslování stran, tabulek a obrázků.",
      en: "Evaluate the structure (introduction, body, conclusion, references, appendices), prescribed length compliance, typography, page/table/figure numbering.",
    },
  },
  {
    id: "goal_definition",
    category: "content",
    weight: 15,
    labels: {
      sk: "Definícia cieľov a problematiky",
      cs: "Definice cílů a problematiky",
      en: "Definition of goals and problem statement",
    },
    guidance: {
      sk: "Posúďte jasnosť definovania cieľov práce, vymedzenie problematiky, stav riešenia v literatúre a odôvodnenie aktuálnosti témy.",
      cs: "Posuďte jasnost cílů, vymezení problematiky, stav řešení v literatuře a odůvodnění aktuálnosti tématu.",
      en: "Assess clarity of goals, problem scope, state of the art in literature, and justification of the topic's relevance.",
    },
  },
  {
    id: "methodology",
    category: "content",
    weight: 20,
    labels: {
      sk: "Metodológia a postup riešenia",
      cs: "Metodologie a postup řešení",
      en: "Methodology and approach",
    },
    guidance: {
      sk: "Hodnoťte vhodnosť zvolených metód, správnosť ich aplikácie, logickú nadväznosť krokov riešenia a schopnosť pracovať s odbornými zdrojmi.",
      cs: "Hodnoťte vhodnost zvolených metod, správnost jejich aplikace, logickou návaznost kroků a schopnost pracovat s odbornými zdroji.",
      en: "Evaluate appropriateness of methods, correctness of their application, logical progression of solution steps, and use of academic sources.",
    },
  },
  {
    id: "results",
    category: "content",
    weight: 20,
    labels: {
      sk: "Výsledky a ich vyhodnotenie",
      cs: "Výsledky a jejich vyhodnocení",
      en: "Results and their evaluation",
    },
    guidance: {
      sk: "Posúďte dosiahnuté výsledky, ich úplnosť voči stanoveným cieľom, správnosť interpretácie, porovnanie s existujúcimi riešeniami.",
      cs: "Posuďte výsledky, jejich úplnost, správnost interpretace, porovnání s existujícími řešeními.",
      en: "Assess achieved results, completeness relative to stated goals, correctness of interpretation, comparison with existing solutions.",
    },
  },
  {
    id: "originality",
    category: "content",
    weight: 15,
    labels: {
      sk: "Originalita a prínos práce",
      cs: "Originalita a přínos práce",
      en: "Originality and contribution",
    },
    guidance: {
      sk: "Zhodnoťte mieru vlastného prínosu autora, inovatívnosť prístupu, prínos pre prax alebo vedu.",
      cs: "Zhodnoťte míru vlastního přínosu, inovativnost přístupu, přínos pro praxi nebo vědu.",
      en: "Evaluate the extent of the author's own contribution, novelty of approach, and impact for practice or science.",
    },
  },
  {
    id: "language_quality",
    category: "language",
    weight: 10,
    labels: {
      sk: "Jazyková a štylistická úroveň",
      cs: "Jazyková a stylistická úroveň",
      en: "Language and style quality",
    },
    guidance: {
      sk: "Hodnoťte gramatickú správnosť, odbornosť terminológie, zrozumiteľnosť textu, štylistickú úroveň.",
      cs: "Hodnoťte gramatickou správnost, odbornost terminologie, srozumitelnost textu, stylistickou úroveň.",
      en: "Evaluate grammatical correctness, appropriateness of terminology, clarity of text, stylistic level.",
    },
  },
  {
    id: "citations_bibliography",
    category: "citations",
    weight: 10,
    labels: {
      sk: "Citácie a zoznam literatúry",
      cs: "Citace a seznam literatury",
      en: "Citations and bibliography",
    },
    guidance: {
      sk: "Skontrolujte správnosť a úplnosť citácií podľa normy ISO 690, aktuálnosť a relevantnosť citovanej literatúry, konzistentnosť citačného štýlu.",
      cs: "Zkontrolujte správnost citací dle ISO 690, aktuálnost a relevanci citované literatury, konzistenci citačního stylu.",
      en: "Check correctness and completeness of citations (ISO 690 / APA), currency and relevance of cited literature, consistency of citation style.",
    },
  },
  {
    id: "defense_questions",
    category: "defense",
    weight: 0, // Not weighted in overall grade — but required for the review document
    labels: {
      sk: "Otázky a pripomienky k obhajobe",
      cs: "Otázky a připomínky k obhajobě",
      en: "Questions and remarks for the defense",
    },
    guidance: {
      sk: "Sformulujte konkrétne otázky na obhajobu, ktoré overujú porozumenie kľúčovým aspektom práce. Otázky musia byť merateľné a jednoznačné.",
      cs: "Formulujte konkrétní otázky k obhajobě, které ověřují porozumění klíčovým aspektům práce.",
      en: "Formulate specific defense questions that test the candidate's understanding of key aspects of the work.",
    },
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getCriterionById(id: string): ThesisCriterion | undefined {
  return THESIS_CRITERIA.find((c) => c.id === id)
}

export function getCriteriaForRole(role: ReviewerRole): ThesisCriterion[] {
  // Opponents typically don't evaluate goal_definition with full weight
  // and always include defense_questions
  return THESIS_CRITERIA
}

export function getWeightedCriteria(): ThesisCriterion[] {
  return THESIS_CRITERIA.filter((c) => c.weight > 0)
}

/**
 * Compute a numeric aggregate score from section ratings.
 * Uses a simple weighted average of numeric scores where provided,
 * falling back to ECTS → numeric mapping.
 * Clamps numeric scores to [0, 100] and rejects duplicate criteria.
 */
export function computeOverallScore(sections: ThesisSection[]): number | null {
  const ectsMap: Record<string, number> = { A: 95, B: 85, C: 75, D: 65, E: 55, FX: 20 }
  let totalWeight = 0
  let weightedSum = 0
  const seenCriteria = new Set<string>()

  for (const section of sections) {
    const criterionId = section.criterionId || section.sectionId || section.id
    if (!criterionId || seenCriteria.has(criterionId)) continue
    seenCriteria.add(criterionId)

    const criterion = getCriterionById(criterionId)
    if (!criterion || criterion.weight === 0) continue

    let score: number | null = null
    if (typeof section.numericScore === "number" && !isNaN(section.numericScore)) {
      score = Math.min(100, Math.max(0, section.numericScore))
    } else if (section.rating && section.rating !== "pending") {
      score = ectsMap[section.rating] ?? null
    }

    if (score == null) continue
    weightedSum += score * criterion.weight
    totalWeight += criterion.weight
  }

  if (totalWeight === 0) return null
  return Math.round(weightedSum / totalWeight)
}

/**
 * Convert numeric score to ECTS grade (Slovak/EU convention).
 */
export function scoreToEctsGrade(score: number): string {
  if (score >= 90) return "A"
  if (score >= 80) return "B"
  if (score >= 70) return "C"
  if (score >= 60) return "D"
  if (score >= 50) return "E"
  return "FX"
}

/**
 * Returns recommendation text based on grade and language.
 */
export function gradeToRecommendation(grade: string, lang: ReviewLanguage): string {
  const recs: Record<string, Record<ReviewLanguage, string>> = {
    pass: {
      sk: "Prácu odporúčam na obhajobu.",
      cs: "Práci doporučuji k obhajobě.",
      en: "I recommend the thesis for defense.",
    },
    fail: {
      sk: "Prácu neodporúčam na obhajobu.",
      cs: "Práci nedoporučuji k obhajobě.",
      en: "I do not recommend the thesis for defense.",
    },
  }
  const outcome = grade === "FX" ? "fail" : "pass"
  return recs[outcome][lang]
}
