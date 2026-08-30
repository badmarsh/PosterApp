/**
 * Faculty Rubric Template Library & Dynamic Weight Engine.
 *
 * Provides specialized academic rubric weighting profiles for different universities,
 * faculties, and disciplines (STEM, Informatics, Economics, Humanities, Medicine).
 * Enforces that weights sum to exactly 100% and provides auto-normalization.
 */

import { THESIS_CRITERIA, type ThesisCriterion, type ReviewLanguage } from "./thesis-rubric"

export interface FacultyRubricTemplate {
  id: string
  name: Record<ReviewLanguage, string>
  faculty: string
  university: string
  discipline: "stem" | "informatics" | "economics" | "humanities" | "medicine"
  description: Record<ReviewLanguage, string>
  criteria: Array<ThesisCriterion & { defaultWeight: number }>
}

export const FACULTY_RUBRIC_TEMPLATES: FacultyRubricTemplate[] = [
  {
    id: "uk_prirodovedecka_stem",
    name: {
      sk: "Univerzita Komenského — Prírodovedecká fakulta (STEM/Fyzika)",
      cs: "Univerzita Komenského — Přírodovědecká fakulta (STEM/Fyzika)",
      en: "Comenius University — Faculty of Natural Sciences (STEM/Physics)",
    },
    faculty: "Prírodovedecká fakulta",
    university: "Univerzita Komenského v Bratislave",
    discipline: "stem",
    description: {
      sk: "Zvýšený dôraz na metodológiu, experimentálne overenie a reprodukovateľnosť výsledkov.",
      cs: "Zvýšený důraz na metodologii, experimentální ověření a reprodukovatelnost.",
      en: "Enhanced focus on methodology, experimental validation, and reproducibility.",
    },
    criteria: [
      { ...THESIS_CRITERIA[0], weight: 10, defaultWeight: 10 }, // Formal
      { ...THESIS_CRITERIA[1], weight: 15, defaultWeight: 15 }, // Goals
      { ...THESIS_CRITERIA[2], weight: 25, defaultWeight: 25 }, // Methodology
      { ...THESIS_CRITERIA[3], weight: 25, defaultWeight: 25 }, // Results
      { ...THESIS_CRITERIA[4], weight: 10, defaultWeight: 10 }, // Originality
      { ...THESIS_CRITERIA[5], weight: 5, defaultWeight: 5 },   // Language
      { ...THESIS_CRITERIA[6], weight: 10, defaultWeight: 10 }, // Citations
    ],
  },
  {
    id: "stu_fiit_informatics",
    name: {
      sk: "STU Bratislava — FIIT / FEI (Informatika & Softvérové inžinierstvo)",
      cs: "STU Bratislava — FIIT / FEI (Informatika & Softwarové inženýrství)",
      en: "STU Bratislava — FIIT / FEI (Informatics & Software Engineering)",
    },
    faculty: "Fakulta informatiky a informačných technológií",
    university: "Slovenská technická univerzita v Bratislave",
    discipline: "informatics",
    description: {
      sk: "Dôraz na technickú implementáciu, architektúru softvéru, testovanie a praktickú využiteľnosť.",
      cs: "Důraz na technickou implementaci, architekturu, testování a praktickou využitelnost.",
      en: "Emphasis on technical implementation, software architecture, testing, and practical utility.",
    },
    criteria: [
      { ...THESIS_CRITERIA[0], weight: 10, defaultWeight: 10 },
      { ...THESIS_CRITERIA[1], weight: 10, defaultWeight: 10 },
      { ...THESIS_CRITERIA[2], weight: 20, defaultWeight: 20 },
      { ...THESIS_CRITERIA[3], weight: 30, defaultWeight: 30 }, // Implementation & Results
      { ...THESIS_CRITERIA[4], weight: 15, defaultWeight: 15 },
      { ...THESIS_CRITERIA[5], weight: 5, defaultWeight: 5 },
      { ...THESIS_CRITERIA[6], weight: 10, defaultWeight: 10 },
    ],
  },
  {
    id: "euba_economics",
    name: {
      sk: "Ekonomická univerzita v Bratislave (Ekonómia & Manažment)",
      cs: "Ekonomická univerzita v Bratislavě (Ekonomie & Management)",
      en: "University of Economics in Bratislava (Economics & Management)",
    },
    faculty: "Fakulta manažmentu / Národohospodárska fakulta",
    university: "Ekonomická univerzita v Bratislave",
    discipline: "economics",
    description: {
      sk: "Dôraz na teoretické vymedzenie, analýzu dát a formuláciu praktických odporúčaní pre prax.",
      cs: "Důraz na teoretické vymezení, analýzu dat a doporučení pro praxi.",
      en: "Focus on theoretical grounding, empirical data analysis, and practical managerial recommendations.",
    },
    criteria: [
      { ...THESIS_CRITERIA[0], weight: 10, defaultWeight: 10 },
      { ...THESIS_CRITERIA[1], weight: 15, defaultWeight: 15 },
      { ...THESIS_CRITERIA[2], weight: 15, defaultWeight: 15 },
      { ...THESIS_CRITERIA[3], weight: 20, defaultWeight: 20 },
      { ...THESIS_CRITERIA[4], weight: 20, defaultWeight: 20 }, // Contribution & Recommendations
      { ...THESIS_CRITERIA[5], weight: 10, defaultWeight: 10 },
      { ...THESIS_CRITERIA[6], weight: 10, defaultWeight: 10 },
    ],
  },
  {
    id: "upjs_humanities",
    name: {
      sk: "UPJŠ Košice — Filozofická fakulta (Spoločenské vedy & Humanitné odbory)",
      cs: "UPJŠ Košice — Filozofická fakulta (Společenské vědy & Humanitní obory)",
      en: "Pavol Jozef Šafárik University — Faculty of Arts (Humanities & Social Sciences)",
    },
    faculty: "Filozofická fakulta",
    university: "Univerzita Pavla Jozefa Šafárika v Košiciach",
    discipline: "humanities",
    description: {
      sk: "Dôraz na prácu s primárnymi a sekundárnymi zdrojmi, terminologickú čistotu a jazykovú kultúru.",
      cs: "Důraz na práci se zdroji, terminologii a jazykovou úroveň.",
      en: "Focus on primary and secondary source criticism, terminological precision, and language style.",
    },
    criteria: [
      { ...THESIS_CRITERIA[0], weight: 10, defaultWeight: 10 },
      { ...THESIS_CRITERIA[1], weight: 15, defaultWeight: 15 },
      { ...THESIS_CRITERIA[2], weight: 15, defaultWeight: 15 },
      { ...THESIS_CRITERIA[3], weight: 15, defaultWeight: 15 },
      { ...THESIS_CRITERIA[4], weight: 15, defaultWeight: 15 },
      { ...THESIS_CRITERIA[5], weight: 15, defaultWeight: 15 }, // High Language weight
      { ...THESIS_CRITERIA[6], weight: 15, defaultWeight: 15 }, // High Citations weight
    ],
  },
]

export interface RubricWeightValidationResult {
  isValid: boolean
  totalWeight: number
  difference: number
  message?: string
}

/**
 * Validates whether criterion weights sum to 100%.
 */
export function validateRubricWeights(criteria: Array<{ weight: number }>): RubricWeightValidationResult {
  const totalWeight = criteria.reduce((sum, c) => sum + (Number(c.weight) || 0), 0)
  const difference = 100 - totalWeight
  const isValid = Math.abs(difference) < 0.01

  return {
    isValid,
    totalWeight,
    difference,
    message: isValid
      ? "Váhy sú vyvážené (100%)."
      : difference > 0
      ? `Súčet váh je ${totalWeight}%. Chýba ${difference}%.`
      : `Súčet váh je ${totalWeight}%. Presahuje o ${Math.abs(difference)}%.`,
  }
}

/**
 * Pro-rata normalizes an array of criteria weights so they sum exactly to 100%.
 */
export function normalizeRubricWeights<T extends { weight: number }>(criteria: T[]): T[] {
  if (criteria.length === 0) return criteria

  const total = criteria.reduce((sum, c) => sum + Math.max(0, Number(c.weight) || 0), 0)
  if (total <= 0) {
    const equalWeight = Math.round((100 / criteria.length) * 10) / 10
    return criteria.map((c, i) => ({
      ...c,
      weight: i === criteria.length - 1 ? 100 - equalWeight * (criteria.length - 1) : equalWeight,
    }))
  }

  let distributed = 0
  const normalized = criteria.map((c, i) => {
    if (i === criteria.length - 1) {
      const remaining = Math.round((100 - distributed) * 10) / 10
      return { ...c, weight: Math.max(1, remaining) }
    }
    const scaled = Math.round(((c.weight / total) * 100) * 10) / 10
    distributed += scaled
    return { ...c, weight: scaled }
  })

  return normalized
}

/**
 * Retrieves a faculty template by ID or falls back to STEM default.
 */
export function getFacultyRubricTemplate(templateId?: string): FacultyRubricTemplate {
  return (
    FACULTY_RUBRIC_TEMPLATES.find((t) => t.id === templateId) ||
    FACULTY_RUBRIC_TEMPLATES[0]
  )
}
