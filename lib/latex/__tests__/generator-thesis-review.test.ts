import { describe, it, expect } from "vitest"
import {
  escapeLatex,
  generateThesisReviewLatex,
} from "@/lib/latex/generator-thesis-review"

describe("LaTeX Escaping & Formatting", () => {
  it("escapes backslashes without corrupting subsequently added curly braces (single-pass)", () => {
    const input = "Path: C:\\Program Files\\App {2024} & 50% $100 #1 _var_ ~user^"
    const escaped = escapeLatex(input)

    // Verify backslash is textbackslash{} and NOT textbackslash\{\}
    expect(escaped).toContain("\\textbackslash{}")
    expect(escaped).not.toContain("\\textbackslash\\{\\}")
    expect(escaped).not.toContain("\\textbackslash{\\}")

    // Verify all special characters are escaped
    expect(escaped).toContain("\\&")
    expect(escaped).toContain("\\%")
    expect(escaped).toContain("\\$")
    expect(escaped).toContain("\\#")
    expect(escaped).toContain("\\_")
    expect(escaped).toContain("\\{2024\\}")
    expect(escaped).toContain("\\textasciitilde{}")
    expect(escaped).toContain("\\textasciicircum{}")
  })
})

describe("Thesis Review LaTeX Generator", () => {
  it("generates compilable LaTeX with tabularx, needspace, and localized running header", () => {
    const tex = generateThesisReviewLatex({
      studentName: "Ján Novák",
      thesisTitle: "Neurónové siete & hlboké učenie: C:\\Models\\V1",
      thesisType: "master",
      reviewerRole: "opponent",
      reviewerName: "prof. RNDr. Jozef Mrkvička, DrSc.",
      institution: "Slovenská technická univerzita",
      department: "Fakulta informatiky a informačných technológií",
      academicYear: "2023/2024",
      grade: "A",
      recommendation: "Prácu odporúčam na obhajobu.",
      sections: [
        {
          id: "s1",
          sectionId: "methodology",
          criterionId: "methodology",
          text: "Metodika je navrhnutá dôsledne. Testované na 100% dát.",
          rating: "A",
          numericScore: 95,
          suggestions: ["Doplniť konvergenčný graf"],
        },
      ],
      defenseQuestions: ["Ako ovplyvnil výber hyperparametrov výslednú presnosť?"],
      citationIssues: ["Chýba DOI pri citácii [2]"],
      language: "sk",
      template: "posudok-sk",
    })

    // LaTeX packages and structure
    expect(tex).toContain("\\usepackage{needspace}")
    expect(tex).toContain("\\usepackage{tabularx}")
    expect(tex).toContain("\\usepackage{enumitem}")
    expect(tex).toContain("\\lhead{\\small POSUDOK ZÁVEREČNEJ PRÁCE}")

    // Metadata tabularx
    expect(tex).toContain("\\begin{tabularx}{\\textwidth}{@{}l X@{}}")
    expect(tex).toContain("Ján Novák")
    expect(tex).toContain("2023/2024")

    // Page-break protection
    expect(tex).toContain("\\Needspace{6\\baselineskip}")
    expect(tex).toContain("\\Needspace{8\\baselineskip}")
    expect(tex).toContain("\\Needspace{10\\baselineskip}")

    // Escaped title and text
    expect(tex).toContain("Neurónové siete \\& hlboké učenie: C:\\textbackslash{}Models\\textbackslash{}V1")
    expect(tex).toContain("100\\% dát.")

    // Rating
    expect(tex).toContain("\\ratingsymbol{A}")
  })

  it("generates English review with English header and labels", () => {
    const tex = generateThesisReviewLatex({
      studentName: "John Doe",
      thesisTitle: "Autonomous Navigation with LiDAR & Cameras",
      thesisType: "phd",
      reviewerRole: "supervisor",
      reviewerName: "Prof. Alan Turing",
      institution: "MIT",
      department: "EECS",
      grade: "B",
      recommendation: "I recommend the thesis for defense.",
      sections: [
        {
          id: "s1",
          sectionId: "goal_definition",
          criterionId: "goal_definition",
          text: "The research objectives are well defined.",
          rating: "B",
          numericScore: 88,
          suggestions: [],
        },
      ],
      defenseQuestions: ["What are the failure modes in heavy rain?"],
      citationIssues: [],
      language: "en",
      template: "posudok-en",
    })

    expect(tex).toContain("\\lhead{\\small THESIS ASSESSMENT REPORT}")
    expect(tex).toContain("THESIS ASSESSMENT REPORT")
    expect(tex).toContain("Student:")
    expect(tex).toContain("John Doe")
    expect(tex).toContain("Autonomous Navigation with LiDAR \\& Cameras")
  })
})
