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

  it("does NOT include confidential comments when includeConfidential is false or omitted", () => {
    const tex = generateThesisReviewLatex({
      studentName: "Ján Novák",
      thesisTitle: "Záverečná práca",
      thesisType: "master",
      reviewerRole: "supervisor",
      sections: [],
      defenseQuestions: [],
      citationIssues: [],
      language: "sk",
      template: "posudok-sk",
      confidentialComments: "DÔVERNÁ POZNÁMKA: Študent pracoval s pomocou konzultanta.",
      includeConfidential: false,
    })

    expect(tex).not.toContain("DÔVERNÉ POZNÁMKY PRE KOMISIU")
    expect(tex).not.toContain("Študent pracoval s pomocou konzultanta")
  })

  it("includes confidential comments section when includeConfidential is true", () => {
    const tex = generateThesisReviewLatex({
      studentName: "Ján Novák",
      thesisTitle: "Záverečná práca",
      thesisType: "master",
      reviewerRole: "supervisor",
      sections: [],
      defenseQuestions: [],
      citationIssues: [],
      language: "sk",
      template: "posudok-sk",
      confidentialComments: "DÔVERNÁ POZNÁMKA: Študent pracoval mimoriadne samostatne & prekonal očakávania.",
      includeConfidential: true,
    })

    expect(tex).toContain("\\section{DÔVERNÉ POZNÁMKY PRE KOMISIU (NEZVEREJŇOVAŤ ŠTUDENTOVI)}")
    expect(tex).toContain("DÔVERNÁ POZNÁMKA: Študent pracoval mimoriadne samostatne \\& prekonal očakávania.")
  })
})

describe("Thesis review Unicode & markdown handling (A-01)", () => {
  const base = {
    studentName: "Ján Novák",
    thesisTitle: "Záverečná práca",
    thesisType: "master" as const,
    reviewerRole: "opponent" as const,
    sections: [],
    defenseQuestions: [],
    citationIssues: [],
    language: "sk" as const,
    template: "posudok-sk" as const,
  }

  it("maps Greek letters and superscripts in section text to LaTeX math", () => {
    const tex = generateThesisReviewLatex({
      ...base,
      sections: [
        {
          id: "s1",
          sectionId: "methodology",
          criterionId: "methodology",
          text: "Testovanie χ² pri α=0.05 dalo p≤0.01.",
          rating: "A",
          suggestions: [],
        },
      ],
    })
    expect(tex).not.toContain("χ")
    expect(tex).not.toContain("α")
    expect(tex).not.toContain("≤")
    expect(tex).toContain("$\\chi$")
    expect(tex).toContain("$\\alpha$")
    expect(tex).toContain("$\\le$")
  })

  it("maps em dashes and smart quotes in suggestions", () => {
    const tex = generateThesisReviewLatex({
      ...base,
      sections: [
        {
          id: "s1",
          sectionId: "methodology",
          criterionId: "methodology",
          text: "Text.",
          rating: "A",
          suggestions: ["Doplniť graf — najmä “konvergenciu”"],
        },
      ],
    })
    expect(tex).not.toContain("—")
    expect(tex).not.toContain("“")
    expect(tex).toContain("Doplniť graf --- najmä ``konvergenciu''")
  })

  it("renders markdown emphasis in confidential comments instead of literal asterisks", () => {
    const tex = generateThesisReviewLatex({
      ...base,
      confidentialComments: "Študent pracoval **mimoriadne** samostatne.",
      includeConfidential: true,
    })
    expect(tex).toContain("\\textbf{mimoriadne}")
    expect(tex).not.toContain("**mimoriadne**")
  })

  it("preserves inline math in defense questions instead of escaping it", () => {
    const tex = generateThesisReviewLatex({
      ...base,
      defenseQuestions: ["Ako ste odvodili $x^2 + y^2$?"],
    })
    expect(tex).toContain("$x^2 + y^2$")
    expect(tex).not.toContain("\\textasciicircum{}2")
  })

  it("maps Unicode in structural fields without turning them into markdown blocks", () => {
    const tex = generateThesisReviewLatex({
      ...base,
      thesisTitle: "Analýza α-rozpadu *in vivo*",
    })
    expect(tex).toContain("$\\alpha$-rozpadu")
    expect(tex).not.toContain("\\textit{in vivo}")
    expect(tex).toContain("*in vivo*")
  })

  it("maps Unicode in citation issues", () => {
    const tex = generateThesisReviewLatex({ ...base, citationIssues: ["Chýba DOI — položka ≥3"] })
    expect(tex).toContain("---")
    expect(tex).toContain("$\\ge$")
  })
})


describe("Report languages beyond the AI rubric (de/pl/hu)", () => {
  const base = {
    studentName: "Anna Müller",
    thesisTitle: "Analyse der Messunsicherheit",
    thesisType: "master" as const,
    reviewerRole: "opponent" as const,
    defenseQuestions: [],
    citationIssues: [],
    sections: [
      {
        id: "s1",
        sectionId: "methodology",
        criterionId: "methodology",
        text: "Die Methodik ist sorgfältig.",
        rating: "A" as const,
        suggestions: [],
      },
    ],
  }

  it.each([
    ["posudok-de", "de", "ngerman", "GUTACHTEN ZUR ABSCHLUSSARBEIT"],
    ["posudok-pl", "pl", "polish", "RECENZJA PRACY DYPLOMOWEJ"],
    ["posudok-hu", "hu", "magyar", "BÍRÁLAT A ZÁRÓDOLGOZATRÓL"],
  ] as const)("%s selects %s babel and localized headings", (template, lang, babel, heading) => {
    const tex = generateThesisReviewLatex({ ...base, language: lang, template })
    expect(tex).toContain(`\\usepackage[${babel}]{babel}`)
    expect(tex).toContain(heading)
    expect(tex).toContain("\\begin{document}")
    expect(tex).toContain("\\end{document}")
  })

  it("falls back to English criterion names for untranslated rubric languages", () => {
    const tex = generateThesisReviewLatex({ ...base, language: "de", template: "posudok-de" })
    // Must not leak the raw criterion id into the PDF
    expect(tex).not.toContain("methodology_rigor")
    expect(tex).not.toContain("\\subsection*{methodology ")
  })

  it("keeps Unicode-heavy localized labels compile-safe", () => {
    for (const [template, lang] of [["posudok-de", "de"], ["posudok-pl", "pl"], ["posudok-hu", "hu"]] as const) {
      const tex = generateThesisReviewLatex({ ...base, language: lang, template })
      // Greek/math Unicode must be mapped; plain accented Latin is fine under T1
      expect(tex).not.toMatch(/[χαβ≤≥→]/)
    }
  })
})
