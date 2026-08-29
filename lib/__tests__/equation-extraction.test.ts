import { describe, it, expect } from "vitest"

describe("Equation Extraction Logic", () => {
  it("extracts standalone and block equations from markdown content", () => {
    const mdContent = `
# Section 2: Theoretical Formulation

The total collector current in a bipolar junction transistor under radiation is governed by:

$$
I_C = I_S \\left( e^{\\frac{V_{BE}}{V_T}} - 1 \\right)
$$

The relationship between base and collector current gain is expressed as:

\\begin{equation}
\\beta_T = \\frac{I_C}{I_B}
\\end{equation}

Furthermore, the relative gain change is modeled by:

\\begin{align}
\\Delta \\beta = \\beta_0 - \\beta(D) = k \\cdot \\Phi_n
\\end{align}

And inline text like $\\alpha = 0.99$ is preserved in body text.
`

    const extractedEquations: { formula: string; page: number; title: string }[] = []
    const seenEquations = new Set<string>()

    const displayMathRegex = /\$\$([\s\S]+?)\$\$|\\begin\{(?:equation|align|gather|multline)\*?\}([\s\S]+?)\\end\{(?:equation|align|gather|multline)\*?\}/g
    let match
    let eqCount = 1
    while ((match = displayMathRegex.exec(mdContent)) !== null) {
      const rawFormula = (match[1] || match[2] || "").trim()
      if (rawFormula.length >= 3 && !seenEquations.has(rawFormula)) {
        seenEquations.add(rawFormula)
        extractedEquations.push({
          formula: rawFormula,
          page: 1,
          title: `Equation ${eqCount++}`,
        })
      }
    }

    expect(extractedEquations.length).toBe(3)
    expect(extractedEquations[0].formula).toContain("I_C = I_S")
    expect(extractedEquations[1].formula).toContain("\\beta_T = \\frac{I_C}{I_B}")
    expect(extractedEquations[2].formula).toContain("\\Delta \\beta = \\beta_0 - \\beta(D)")
  })

  it("extracts equations from MinerU middle_json pdf_info tree", () => {
    const middleJson = {
      pdf_info: [
        {
          page_idx: 0,
          blocks: [
            {
              type: "interline_equation",
              text: "$$ R = 100 \\times \\frac{X - X_0}{X_0} $$",
              latex: "R = 100 \\times \\frac{X - X_0}{X_0}",
            },
            {
              type: "text",
              text: "Some descriptive paragraph.",
            },
          ],
        },
        {
          page_idx: 1,
          blocks: [
            {
              type: "equation",
              text: "TID = \\int_{0}^{t} \\dot{D}(\\tau) d\\tau",
            },
          ],
        },
      ],
    }

    const extractedEquations: { formula: string; page: number; title: string }[] = []
    const seenEquations = new Set<string>()

    let pageNum = 1
    for (const p of middleJson.pdf_info || []) {
      const searchEquations = (obj: any) => {
        if (!obj) return
        if (typeof obj === "object") {
          if ((obj.type === "equation" || obj.type === "interline_equation") && (obj.text || obj.latex)) {
            const rawFormula = (obj.latex || obj.text || "").trim()
            const cleanFormula = rawFormula.replace(/^\$\$|\$\$$/g, "").trim()
            if (cleanFormula.length >= 3 && !seenEquations.has(cleanFormula)) {
              seenEquations.add(cleanFormula)
              extractedEquations.push({
                formula: cleanFormula,
                page: pageNum,
                title: `Equation: ${cleanFormula.slice(0, 45)}`,
              })
            }
          }
          for (const key of Object.keys(obj)) {
            searchEquations(obj[key])
          }
        }
      }
      searchEquations(p)
      pageNum++
    }

    expect(extractedEquations.length).toBe(2)
    expect(extractedEquations[0].formula).toBe("R = 100 \\times \\frac{X - X_0}{X_0}")
    expect(extractedEquations[0].page).toBe(1)
    expect(extractedEquations[1].formula).toBe("TID = \\int_{0}^{t} \\dot{D}(\\tau) d\\tau")
    expect(extractedEquations[1].page).toBe(2)
  })

  it("deduplicates equations present in both middle_json and md_content", () => {
    const formula = "E = m c^2"
    const extractedEquations: { formula: string; page: number; title: string }[] = []
    const seenEquations = new Set<string>()

    // First from middle_json
    seenEquations.add(formula)
    extractedEquations.push({
      formula,
      page: 1,
      title: `Equation: ${formula}`,
    })

    // Then scanned in md_content
    const mdContent = `$$ ${formula} $$`
    const displayMathRegex = /\$\$([\s\S]+?)\$\$/g
    let match
    while ((match = displayMathRegex.exec(mdContent)) !== null) {
      const rawFormula = match[1].trim()
      if (rawFormula.length >= 3 && !seenEquations.has(rawFormula)) {
        seenEquations.add(rawFormula)
        extractedEquations.push({
          formula: rawFormula,
          page: 1,
          title: "Duplicate",
        })
      }
    }

    expect(extractedEquations.length).toBe(1)
  })

  it("formats equation properly when promoted into card content", () => {
    let cardContent = "- Prior bullet point."
    const equationSnippet = "V_{out} = A_v \\cdot (V_+ - V_-)"
    
    const formattedFormula = equationSnippet.includes("$$") || equationSnippet.includes("\\[")
      ? equationSnippet
      : `$$\n${equationSnippet}\n$$`
    
    const prefix = cardContent.trim() ? "\n\n" : ""
    cardContent = cardContent + prefix + formattedFormula

    expect(cardContent).toBe("- Prior bullet point.\n\n$$\nV_{out} = A_v \\cdot (V_+ - V_-)\n$$")
  })
})
