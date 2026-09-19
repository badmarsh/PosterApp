import { describe, it, expect } from "vitest"
import { buildSystemPrompt, buildUserPrompt } from "../prompts-thesis"

describe("Prompts Thesis - SOTA Evidence and Forensic Rules", () => {
  const metadata = {
    studentName: "Ján Novák",
    thesisTitle: "Neurónové siete v časticovej fyzike",
    thesisType: "phd" as const,
    reviewerRole: "opponent" as const, language: "sk" as const,
  }

  it("injects SOTA evidence-first, numerical verification, and absence rules into constructive system prompt", () => {
    const prompt = buildSystemPrompt("sk", metadata, "constructive")
    expect(prompt).toContain("Prohibition of Spurious Proofs of Absence")
    expect(prompt).toContain("FORENZNÁ KONTROLA TABULIEK A ŠTATISTIKY")
    expect(prompt).toContain("Temporal Novelty")
    expect(prompt).toContain("NEPENALIZUJ OCR / PARSOVACIE ARTEFAKTY")
  })

  it("injects statutory § 67 doctoral posudok rules into Slovak doctoral opponent user prompt", () => {
    const prompt = buildUserPrompt(
      metadata,
      "Context Header",
      "Source Context",
      "Criteria List",
      "sk",
      "formal"
    )
    expect(prompt).toContain("Pravidlá oponentského posudku dizertačnej práce (zákon č. 131/2002 Z. z., § 67)")
    expect(prompt).toContain("aktuálnosť zvolenej témy")
    expect(prompt).toContain("prínos pre rozvoj vedy a techniky")
    expect(prompt).toContain("splnenie sledovaných cieľov")
  })
})
