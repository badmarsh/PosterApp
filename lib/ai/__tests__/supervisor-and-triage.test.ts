import { describe, it, expect } from "vitest"
import { buildSystemPrompt, buildUserPrompt } from "@/lib/ai/prompts-thesis"
import { shouldUseProfessionalMode } from "@/app/api/workspaces/[id]/thesis-review/route"
import type { ThesisMetadata } from "@/lib/ai/thesis-rubric"

describe("TASK 1 & 4: Supervisor-Mode Tone and Pre-consultation Triage", () => {
  const supervisorMetadata: ThesisMetadata = {
    studentName: "Ján Novák",
    thesisTitle: "Simulácia Higgsovho bozónu",
    thesisType: "master",
    reviewerRole: "supervisor",
    institution: "FMFI UK",
    department: "Katedra jadrovej fyziky",
    language: "sk",
  }

  const selfMetadata: ThesisMetadata = {
    studentName: "Ján Novák",
    thesisTitle: "Rozpracovaná kapitola 3",
    thesisType: "phd",
    reviewerRole: "self",
    language: "sk",
  }

  const opponentMetadata: ThesisMetadata = {
    studentName: "Ján Novák",
    thesisTitle: "Simulácia Higgsovho bozónu",
    thesisType: "master",
    reviewerRole: "opponent",
    language: "sk",
  }

  it("builds constructive system prompt for supervisor with explicit mentoring guidance", () => {
    const prompt = buildSystemPrompt("sk", supervisorMetadata, "constructive")
    expect(prompt).toContain("DÔLEŽITÉ POKYNY K TÓNU A POSLANIU HODNOTENIA (SUPERVISOR / ŠKOLITEĽ)")
    expect(prompt).toContain("Do not write this as a final judgment. Write this as constructive guidance for the student. Frame weaknesses as areas for improvement before submission.")
    expect(prompt).toContain("Neformuluj posudok ako definitívny odsudzujúci rozsudok, ale ako konštruktívne vedenie a podklady na konzultáciu so študentom.")
    expect(prompt).toContain("Všetky nedostatky formuluj ako konkrétne oblasti na dopracovanie a zlepšenie pred finálnym odovzdaním práce.")
  })

  it("builds constructive system prompt in English with verbatim required instructions", () => {
    const prompt = buildSystemPrompt("en", supervisorMetadata, "constructive")
    expect(prompt).toContain("Do not write this as a final judgment.")
    expect(prompt).toContain("Write this as constructive guidance for the student.")
    expect(prompt).toContain("Frame weaknesses as areas for improvement before submission.")
  })

  it("builds formal system prompt for opponent", () => {
    const prompt = buildSystemPrompt("sk", opponentMetadata, "formal")
    expect(prompt).toContain("Si expertný hodnotiteľ akademických prác na vysokých školách.")
    expect(prompt).not.toContain("DÔLEŽITÉ POKYNY K TÓNU A POSLANIU HODNOTENIA (SUPERVISOR / ŠKOLITEĽ)")
  })

  it("builds user prompt with constructive guidance for student consultation", () => {
    const userPrompt = buildUserPrompt(
      supervisorMetadata,
      "Metadata Header",
      "Source Context",
      "Criteria List",
      "sk",
      "constructive"
    )
    expect(userPrompt).toContain("vypracuj konštruktívne metodické hodnotenie a odporúčania pre študenta")
    expect(userPrompt).toContain("rady a podnety na dopracovanie pred odovzdaním")
    expect(userPrompt).toContain("otázky alebo témy na konzultáciu")
  })

  it("forces professionalMode to true when reviewerRole is self", () => {
    expect(shouldUseProfessionalMode(false, "thesis", "none", "bachelor", "self")).toBe(true)
    expect(shouldUseProfessionalMode(undefined, undefined, undefined, undefined, "self")).toBe(true)
  })

  it("auto-elevates professionalMode for master and phd thesis reviews", () => {
    expect(shouldUseProfessionalMode(false, "thesis", "none", "master")).toBe(true)
    expect(shouldUseProfessionalMode(false, "thesis", "none", "phd")).toBe(true)
    expect(shouldUseProfessionalMode(false, "thesis", "none", "bachelor")).toBe(false)
  })
})
