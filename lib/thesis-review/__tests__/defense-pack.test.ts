import { describe, it, expect } from "vitest"
import {
  defenseQuestionRiskScore,
  riskLevel,
  sortQuestionsByRisk,
  summarizeDefenseReadiness,
  buildDefensePackMarkdown,
  type DefensePackQuestion,
} from "@/lib/thesis-review/defense-pack"

function q(partial: Partial<DefensePackQuestion> & { id: string; questionText: string }): DefensePackQuestion {
  return {
    category: "Metodológia",
    difficulty: "standard",
    suggestedTalkingPoints: ["Prvý bod", "Druhý bod"],
    ...partial,
  }
}

describe("defenseQuestionRiskScore", () => {
  it("ranks by difficulty", () => {
    const base = { id: "1", questionText: "?", category: "Prezentácia", suggestedTalkingPoints: ["a", "b"], recommendedEvidenceQuote: "cit." }
    const standard = defenseQuestionRiskScore({ ...base, difficulty: "standard" })
    const probing = defenseQuestionRiskScore({ ...base, difficulty: "probing" })
    const challenging = defenseQuestionRiskScore({ ...base, difficulty: "challenging" })
    expect(standard).toBeLessThan(probing)
    expect(probing).toBeLessThan(challenging)
  })

  it("adds risk for high-stakes categories", () => {
    const base = { id: "1", questionText: "?", difficulty: "probing" as const, suggestedTalkingPoints: ["a", "b"], recommendedEvidenceQuote: "cit." }
    const withHighStakes = defenseQuestionRiskScore({ ...base, category: "Štatistická rigoróznosť" })
    const neutral = defenseQuestionRiskScore({ ...base, category: "Prezentácia a štýl" })
    expect(withHighStakes).toBeGreaterThan(neutral)
  })

  it("adds risk when evidence or talking points are missing", () => {
    const base = { id: "1", questionText: "?", category: "Prezentácia", difficulty: "standard" as const, suggestedTalkingPoints: ["a", "b"], recommendedEvidenceQuote: "cit." }
    const prepared = defenseQuestionRiskScore(base)
    const noEvidence = defenseQuestionRiskScore({ ...base, recommendedEvidenceQuote: undefined })
    const noPoints = defenseQuestionRiskScore({ ...base, suggestedTalkingPoints: [] })
    expect(noEvidence).toBeGreaterThan(prepared)
    expect(noPoints).toBeGreaterThan(prepared)
    const neither = defenseQuestionRiskScore({ ...base, suggestedTalkingPoints: [], recommendedEvidenceQuote: undefined })
    expect(neither).toBeGreaterThan(noEvidence)
  })

  it("clamps to 0–100", () => {
    const worst = defenseQuestionRiskScore({
      id: "1",
      questionText: "?",
      category: "Metodológia a validácia",
      difficulty: "challenging",
      suggestedTalkingPoints: [],
    })
    expect(worst).toBeLessThanOrEqual(100)
  })
})

describe("riskLevel & sortQuestionsByRisk", () => {
  it("maps scores to low/medium/high", () => {
    expect(riskLevel(20)).toBe("low")
    expect(riskLevel(45)).toBe("medium")
    expect(riskLevel(70)).toBe("high")
    expect(riskLevel(95)).toBe("high")
  })

  it("sorts highest-risk first and is stable for ties", () => {
    const items = [
      q({ id: "a", questionText: "easy", difficulty: "standard", recommendedEvidenceQuote: "x" }),
      q({ id: "b", questionText: "hard", difficulty: "challenging" }),
      q({ id: "c", questionText: "mid", difficulty: "probing", recommendedEvidenceQuote: "x" }),
    ]
    expect(sortQuestionsByRisk(items).map((x) => x.id)).toEqual(["b", "c", "a"])
    // stable: equal scores keep authored order
    const ties = [q({ id: "x1", questionText: "1" }), q({ id: "x2", questionText: "2" })]
    expect(sortQuestionsByRisk(ties).map((x) => x.id)).toEqual(["x1", "x2"])
  })

  it("does not mutate the input array", () => {
    const items = [q({ id: "a", questionText: "easy", difficulty: "standard" }), q({ id: "b", questionText: "hard", difficulty: "challenging" })]
    sortQuestionsByRisk(items)
    expect(items.map((x) => x.id)).toEqual(["a", "b"])
  })
})

describe("summarizeDefenseReadiness", () => {
  it("is ready when every question has evidence and low/medium risk", () => {
    const items = [
      q({ id: "1", questionText: "a", difficulty: "standard", recommendedEvidenceQuote: "x" }),
      q({ id: "2", questionText: "b", difficulty: "standard", recommendedEvidenceQuote: "y" }),
    ]
    const summary = summarizeDefenseReadiness(items)
    expect(summary.verdict).toBe("ready")
    expect(summary.evidenceCoverage).toBe(100)
  })

  it("flags at-risk when many questions are high-risk", () => {
    const items = [
      q({ id: "1", questionText: "a", difficulty: "challenging" }),
      q({ id: "2", questionText: "b", difficulty: "challenging" }),
      q({ id: "3", questionText: "c", difficulty: "standard", recommendedEvidenceQuote: "x" }),
    ]
    const summary = summarizeDefenseReadiness(items)
    expect(summary.highRisk).toBe(2)
    expect(summary.verdict).toBe("at-risk")
  })

  it("handles the empty case", () => {
    const summary = summarizeDefenseReadiness([])
    expect(summary.total).toBe(0)
    expect(summary.verdict).toBe("ready")
    expect(summary.recommendation).toContain("Žiadne otázky")
  })
})

describe("buildDefensePackMarkdown", () => {
  const items = [
    q({ id: "1", questionText: "Ako ste riešili validáciu?", difficulty: "probing", recommendedEvidenceQuote: "Model bol testovaný na CIFAR-10.", derivedFromFindingTitle: "Chýbajúca externá validácia" }),
    q({ id: "2", questionText: "Prečo bez korekcie na mnohonásobné testovanie?", difficulty: "challenging" }),
  ]

  it("emits a header with thesis title and readiness summary", () => {
    const md = buildDefensePackMarkdown({ title: "Vid učenia", author: "Jane Doe" }, items)
    expect(md).toContain("# Balíček na obhajobu — Vid učenia")
    expect(md).toContain("**Kandidát:** Jane Doe")
    expect(md).toContain("Súhrn pripravenosti")
    expect(md).toContain("2 otázok")
  })

  it("orders questions by risk and includes evidence + talking points", () => {
    const md = buildDefensePackMarkdown({ title: "T" }, items)
    const hardIdx = md.indexOf("Prečo bez korekcie")
    const probingIdx = md.indexOf("Ako ste riešili validáciu")
    expect(hardIdx).toBeGreaterThanOrEqual(0)
    expect(probingIdx).toBeGreaterThan(hardIdx)
    expect(md).toContain("„Model bol testovaný na CIFAR-10.“")
    expect(md).toContain("- **Argumentačná línia:**")
    expect(md).toContain("Odvodené zo zistenia")
  })

  it("falls back to a placeholder when there are no questions", () => {
    const md = buildDefensePackMarkdown({ title: "T" }, [])
    expect(md).toContain("Žiadne otázky na obhajobu")
  })
})
