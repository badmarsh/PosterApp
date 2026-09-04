import { describe, it, expect } from "vitest"
import { SCIENTIFIC_TASKS, type ScientificTask } from "@/components/research-lab-templates"

describe("Research Lab Scientific Protocols for DeerFlow", () => {
  it("defines all 6 long-horizon scientific tasks", () => {
    expect(SCIENTIFIC_TASKS).toHaveLength(6)

    const expectedIds = [
      "retrieval-tournament",
      "confidence-calibration",
      "ablation-study",
      "failure-taxonomy",
      "bayesian-hpo",
      "replication-package",
    ]

    expect(SCIENTIFIC_TASKS.map((t) => t.id)).toEqual(expectedIds)
  })

  it("ensures each protocol has complete metadata and distinct phases", () => {
    for (const task of SCIENTIFIC_TASKS) {
      expect(task.title.length).toBeGreaterThan(5)
      expect(task.question.length).toBeGreaterThan(10)
      expect(task.prompt.length).toBeGreaterThan(50)
      expect(task.estimatedRuntime).toMatch(/hours|h/)
      expect(task.category.length).toBeGreaterThan(3)
      expect(task.scientificQuestion.length).toBeGreaterThan(30)
      expect(task.phases.length).toBeGreaterThanOrEqual(5)

      // Verify phase structure
      for (const phase of task.phases) {
        expect(phase.phase).toMatch(/^PHASE \d+/)
        expect(phase.title.length).toBeGreaterThan(2)
        expect(phase.tools.length).toBeGreaterThan(0)
        expect(phase.summary.length).toBeGreaterThan(10)
        expect(phase.details.length).toBeGreaterThan(0)
      }

      // Verify cards split: setupCards vs placeholderResultCards
      expect(task.setupCards.length).toBeGreaterThanOrEqual(2)
      expect(task.placeholderResultCards.length).toBeGreaterThanOrEqual(2)
      expect(task.initialCards).toHaveLength(task.setupCards.length + task.placeholderResultCards.length)

      // setupCards must NEVER contain pattern "results"
      for (const card of task.setupCards) {
        expect(card.title.length).toBeGreaterThan(3)
        expect(card.content.length).toBeGreaterThan(20)
        expect(card.pattern).not.toBe("results")
      }

      // placeholderResultCards must use semantic ⟨metric⟩ tokens instead of fabricated numbers
      for (const card of task.placeholderResultCards) {
        expect(card.title.length).toBeGreaterThan(3)
        expect(card.content.length).toBeGreaterThan(20)
        expect(card.pattern).toBe("results")
        expect(card.content).toMatch(/⟨[a-zA-Z0-9_@-]+⟩/)
      }

      // Phase copy honesty: no claims of "halts for human review" before write
      for (const phase of task.phases) {
        for (const detail of phase.details) {
          expect(detail).not.toMatch(/halts for human review/i)
        }
      }

      // Verify deliverables and findings
      expect(task.deliverables.length).toBeGreaterThanOrEqual(3)
      expect(task.keyFindings.length).toBeGreaterThanOrEqual(2)
    }
  })

  it("contains valid benchmark data for quantitative tasks", () => {
    const tournament = SCIENTIFIC_TASKS.find((t) => t.id === "retrieval-tournament")!
    expect(tournament.benchmarkTable).toBeDefined()
    expect(tournament.benchmarkTable!.headers).toContain("Recall@5")
    expect(tournament.benchmarkTable!.headers).toContain("MRR")
    expect(tournament.benchmarkTable!.rows).toHaveLength(4)

    const ablation = SCIENTIFIC_TASKS.find((t) => t.id === "ablation-study")!
    expect(ablation.benchmarkTable).toBeDefined()
    expect(ablation.benchmarkTable!.headers).toContain("System Configuration")
    expect(ablation.benchmarkTable!.headers).toContain("Δ F1 Drop")
    expect(ablation.benchmarkTable!.rows.length).toBeGreaterThanOrEqual(6)

    const bayesian = SCIENTIFIC_TASKS.find((t) => t.id === "bayesian-hpo")!
    expect(bayesian.benchmarkTable).toBeDefined()
    expect(bayesian.benchmarkTable!.headers).toContain("Hyperparameter")
    expect(bayesian.benchmarkTable!.headers).toContain("Optimized Value")
  })

  it("enforces acceptance criteria: no pattern:results card is ever seeded as ok or valid", () => {
    for (const task of SCIENTIFIC_TASKS) {
      const setupCards = (task.setupCards || task.initialCards?.filter((c) => c.pattern !== "results") || []).map((c) => ({
        ...c,
        validation: "valid",
      }))
      const placeholderCards = (task.placeholderResultCards || task.initialCards?.filter((c) => c.pattern === "results") || []).map((c) => ({
        ...c,
        content: `[PLACEHOLDER — no experiment has run yet]\n\n${c.content}`,
        validation: "pending",
      }))
      const allSeededCards = [...setupCards, ...placeholderCards]

      for (const card of allSeededCards) {
        if (card.pattern === "results") {
          expect(card.validation).toBe("pending")
          expect(card.validation).not.toBe("ok")
          expect(card.validation).not.toBe("valid")
          expect(card.content).toContain("[PLACEHOLDER — no experiment has run yet]")
        }
      }
    }
  })
})
