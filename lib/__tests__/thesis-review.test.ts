import { describe, it, expect } from "vitest"
import {
  THESIS_CRITERIA,
  computeOverallScore,
  scoreToEctsGrade,
  gradeToRecommendation,
  type ThesisSection,
} from "@/lib/ai/thesis-rubric"
import {
  ThesisReviewSectionSchema,
  ThesisReviewGenerationSchema,
  ThesisSingleSectionSchema,
} from "@/lib/ai/contracts"
import { generateThesisReviewLatex } from "@/lib/latex/generator-thesis-review"

describe("Thesis Rubric and Scoring", () => {
  it("defines standard thesis evaluation criteria", () => {
    expect(THESIS_CRITERIA.length).toBeGreaterThanOrEqual(7)
    const formal = THESIS_CRITERIA.find((c) => c.id === "formal_structure")
    expect(formal).toBeDefined()
    expect(formal?.labels.sk).toContain("Formálna štruktúra")
    expect(formal?.labels.en).toContain("Formal structure")
  })

  it("computes overall weighted score from ECTS ratings correctly", () => {
    const sections: ThesisSection[] = [
      { id: "1", sectionId: "formal_structure", criterionId: "formal_structure", text: "OK", rating: "A" },
      { id: "2", sectionId: "goal_definition", criterionId: "goal_definition", text: "OK", rating: "A" },
      { id: "3", sectionId: "methodology", criterionId: "methodology", text: "OK", rating: "B" },
      { id: "4", sectionId: "results", criterionId: "results", text: "OK", rating: "B" },
      { id: "5", sectionId: "originality", criterionId: "originality", text: "OK", rating: "A" },
      { id: "6", sectionId: "language_quality", criterionId: "language_quality", text: "OK", rating: "A" },
      { id: "7", sectionId: "citations_bibliography", criterionId: "citations_bibliography", text: "OK", rating: "A" },
    ]

    const score = computeOverallScore(sections)
    expect(score).not.toBeNull()
    expect(score).toBeGreaterThanOrEqual(85)
    expect(score).toBeLessThanOrEqual(95)

    const grade = scoreToEctsGrade(score!)
    expect(["A", "B"]).toContain(grade)
  })

  it("maps numeric and failing scores correctly", () => {
    const failingSections: ThesisSection[] = [
      { id: "1", sectionId: "formal_structure", criterionId: "formal_structure", text: "Poor", rating: "FX" },
      { id: "2", sectionId: "methodology", criterionId: "methodology", text: "Poor", rating: "FX" },
    ]
    const score = computeOverallScore(failingSections)
    expect(score).toBe(20)
    expect(scoreToEctsGrade(score!)).toBe("FX")
  })

  it("maps ECTS grade to localized recommendations", () => {
    expect(gradeToRecommendation("A", "sk")).toContain("odporúčam")
    expect(gradeToRecommendation("FX", "sk")).toContain("neodporúčam")
    expect(gradeToRecommendation("A", "en")).toContain("recommend")
    expect(gradeToRecommendation("FX", "en")).toContain("do not recommend")
    expect(gradeToRecommendation("B", "cs")).toContain("doporučuji")
  })
  it("clamps numeric scores to [0, 100] and avoids double-counting duplicate criteria", () => {
    const duplicateSections: ThesisSection[] = [
      { id: "1", sectionId: "methodology", criterionId: "methodology", text: "Good", numericScore: 150 }, // clamped to 100 (weight 20)
      { id: "1_dup", sectionId: "methodology", criterionId: "methodology", text: "Dup", numericScore: 20 }, // ignored
      { id: "2", sectionId: "results", criterionId: "results", text: "OK", numericScore: -50 }, // clamped to 0 (weight 20)
    ]
    const score = computeOverallScore(duplicateSections)
    expect(score).toBe(50) // (100*20 + 0*20) / 40 = 50
    expect(scoreToEctsGrade(score!)).toBe("E")
  })

  it("provides distinct rubric level profiles for Bachelor, Master, and PhD degrees", async () => {
    const { THESIS_LEVEL_PROFILES } = await import("@/lib/ai/thesis-rubric")
    expect(THESIS_LEVEL_PROFILES.bachelor.evidenceExpectations.length).toBeGreaterThanOrEqual(3)
    expect(THESIS_LEVEL_PROFILES.master.originalityExpectation).toContain("originality")
    expect(THESIS_LEVEL_PROFILES.phd.evidenceExpectations[0]).toContain("publishable")
  })
})

describe("Thesis Review Contracts / Schemas", () => {
  it("parses valid ThesisReviewGenerationSchema output with strict ECTS grade", () => {
    const raw = {
      overallGrade: "A",
      recommendation: "Prácu odporúčam na obhajobu.",
      sections: [
        {
          sectionId: "methodology",
          criterionId: "methodology",
          text: "Metodológia práce je zvolená vhodne a logicky nadväzuje na ciele.",
          rating: "A",
          numericScore: 92,
          suggestions: ["Doplniť detailnejší popis architektúry"],
        },
      ],
      defenseQuestions: [
        "Aké boli hlavné obmedzenia pri trénovaní modelu?",
        "Ako by sa navrhnutý prístup škáloval na väčšie datasety?",
      ],
      citationIssues: [],
    }

    const parsed = ThesisReviewGenerationSchema.safeParse(raw)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.overallGrade).toBe("A")
      expect(parsed.data.sections).toHaveLength(1)
      expect(parsed.data.defenseQuestions).toHaveLength(2)
    }
  })

  it("validates generated sections against expected criterion IDs", async () => {
    const { validateGeneratedSections } = await import("@/lib/ai/contracts")

    const validSections = [
      { sectionId: "formal_structure", criterionId: "formal_structure", text: "OK", rating: "A" as const, suggestions: [] },
      { sectionId: "methodology", criterionId: "methodology", text: "Good", rating: "B" as const, suggestions: [] },
    ]

    expect(() => validateGeneratedSections(validSections, ["formal_structure", "methodology"])).not.toThrow()

    // Missing criterion
    expect(() => validateGeneratedSections(validSections, ["formal_structure", "methodology", "results"])).toThrow(/Missing expected criterion/)

    // Duplicate criterion
    const duplicateSections = [
      ...validSections,
      { sectionId: "methodology", criterionId: "methodology", text: "Dup", rating: "B" as const, suggestions: [] },
    ]
    expect(() => validateGeneratedSections(duplicateSections, ["formal_structure", "methodology"])).toThrow(/Duplicate criterion ID/)

    // Empty text
    const emptyTextSections = [
      { sectionId: "formal_structure", criterionId: "formal_structure", text: "   ", rating: "A" as const, suggestions: [] },
    ]
    expect(() => validateGeneratedSections(emptyTextSections, ["formal_structure"])).toThrow(/is empty/)
  })

  it("resiliently preprocesses single section response", () => {
    const raw = {
      content: "Jazyková úroveň práce je výborná, bez závažných gramatických chýb.",
      grade: "A",
      numericScore: 95,
      suggestions: ["Zjednotiť terminológiu v kapitole 3"],
    }

    const parsed = ThesisSingleSectionSchema.safeParse(raw)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.text).toContain("Jazyková úroveň")
      expect(parsed.data.rating).toBe("A")
      expect(parsed.data.numericScore).toBe(95)
      expect(parsed.data.suggestions).toHaveLength(1)
    }
  })
})

describe("Thesis Review LaTeX Generator", () => {
  it("generates compilable Slovak LaTeX with metadata and escaped content", () => {
    const tex = generateThesisReviewLatex({
      studentName: "Janko Hraško",
      thesisTitle: "Analýza & syntéza $N$-telových systémov",
      thesisType: "master",
      reviewerRole: "opponent",
      reviewerName: "Doc. RNDr. Peter Kováč, CSc.",
      institution: "Univerzita Komenského v Bratislave",
      department: "Katedra teoretickej fyziky",
      grade: "A",
      recommendation: "Prácu odporúčam na obhajobu.",
      sections: [
        {
          id: "s1",
          sectionId: "methodology",
          criterionId: "methodology",
          text: "Práca využíva Monte Carlo simulácie & pokročilé algoritmy.",
          rating: "A",
          suggestions: ["Doplniť konvergenčné grafy"],
        },
      ],
      defenseQuestions: ["Ako ovplyvňuje parameter $\\alpha$ stabilitu systému?"],
      citationIssues: ["Chýba DOI pri citácii [3]"],
      language: "sk",
      template: "posudok-sk",
    })

    expect(tex).toContain("\\documentclass[12pt,a4paper]{article}")
    expect(tex).toContain("POSUDOK ZÁVEREČNEJ PRÁCE")
    expect(tex).toContain("Janko Hraško")
    expect(tex).toContain("\\ratingsymbol{A}")
    expect(tex).toContain("OTÁZKY K OBHAJOBE")
    expect(tex).toContain("Analýza \\& syntéza")
    expect(tex).toContain("\\end{document}")
  })

  it("generates English thesis assessment LaTeX template", () => {
    const tex = generateThesisReviewLatex({
      studentName: "Alice Smith",
      thesisTitle: "Deep Generative Models in Robotics",
      thesisType: "phd",
      reviewerRole: "supervisor",
      reviewerName: "Prof. John Doe",
      grade: "A",
      recommendation: "I recommend the thesis for defense.",
      sections: [
        {
          id: "s1",
          sectionId: "methodology",
          criterionId: "methodology",
          text: "State-of-the-art methodology.",
          rating: "A",
        },
      ],
      defenseQuestions: ["What are the failure modes?"],
      citationIssues: [],
      language: "en",
      template: "posudok-en",
    })

    expect(tex).toContain("THESIS ASSESSMENT REPORT")
    expect(tex).toContain("Alice Smith")
    expect(tex).toContain("DEFENSE QUESTIONS")
  })
})
