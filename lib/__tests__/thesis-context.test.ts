import { describe, it, expect } from "vitest"
import {
  normalizeHeading,
  classifySectionKind,
  parseDocumentSections,
  routeSectionsForCriterion,
  extractStructuredReferences,
  buildFullGenerationContext,
  THESIS_CONTEXT_BUDGETS,
  type ThesisDocumentSection,
  type ThesisRAGContext,
} from "@/lib/ai/thesis-context"

describe("Thesis Heading Normalization & Classification", () => {
  it("normalizes Slovak and Czech accented headings equivalently", () => {
    expect(normalizeHeading("1. Úvod")).toBe("uvod")
    expect(normalizeHeading("Kapitola 2. Metodológia a postup")).toBe("metodologia a postup")
    expect(normalizeHeading("3.1 Praktická časť")).toBe("prakticka cast")
    expect(normalizeHeading("4. Výsledky & Vyhodnotenie")).toBe("vysledky vyhodnotenie")
    expect(normalizeHeading("Príloha A: Zdrojové kódy")).toBe("priloha a zdrojove kody")
  })

  it("classifies standard thesis sections correctly", () => {
    expect(classifySectionKind("1. Úvod", "")).toBe("introduction")
    expect(classifySectionKind("2. Súčasný stav problematiky", "")).toBe("literature")
    expect(classifySectionKind("3. Metodika a návrh architektúry", "")).toBe("methodology")
    expect(classifySectionKind("4. Výsledky a diskusia", "")).toBe("results")
    expect(classifySectionKind("5. Diskusia a obmedzenia", "")).toBe("discussion")
    expect(classifySectionKind("6. Záver", "")).toBe("conclusion")
    expect(classifySectionKind("Zoznam použitej literatúry", "")).toBe("references")
    expect(classifySectionKind("Príloha A: Schémy", "")).toBe("appendix")
    expect(classifySectionKind("Abstrakt", "")).toBe("preamble")
  })
})

describe("Document Section Parsing", () => {
  it("parses ATX, Setext, and numbered headings into ordered sections", () => {
    const markdown = `# Diplomová práca: Detekcia anomálií

Abstrakt práce v slovenskom jazyku.

# 1. Úvod
Cieľom tejto práce je návrh neurónovej siete.

Metodika výskumu
----------------
Použili sme konvolučné siete a dataset CIFAR-10.

# 3. Experimentálne výsledky
Dosiahli sme presnosť 94.5%.

# Zoznam literatúry
[1] Vaswani, A. et al. Attention is all you need. 2017.

# Príloha A
Doplňujúce tabuľky a zdrojový kód.
`

    const sections = parseDocumentSections(markdown, "thesis.md")
    expect(sections.length).toBeGreaterThanOrEqual(6)

    expect(sections[0].kind).toBe("preamble")
    expect(sections[1].heading).toBe("1. Úvod")
    expect(sections[1].kind).toBe("introduction")

    const methodologySec = sections.find((s) => s.normalizedHeading.includes("metodika"))
    expect(methodologySec).toBeDefined()
    expect(methodologySec?.kind).toBe("methodology")

    const resultsSec = sections.find((s) => s.heading.includes("Experimentálne výsledky"))
    expect(resultsSec).toBeDefined()
    expect(resultsSec?.kind).toBe("results")

    const refSec = sections.find((s) => s.kind === "references")
    expect(refSec).toBeDefined()

    const appendixSec = sections.find((s) => s.kind === "appendix")
    expect(appendixSec).toBeDefined()
  })
})

describe("Scored Criterion Routing", () => {
  const sampleSections: ThesisDocumentSection[] = [
    {
      id: "s1",
      sourceFile: "thesis.md",
      heading: "Abstrakt",
      normalizedHeading: "abstrakt",
      level: 1,
      startOffset: 0,
      content: "Tento abstrakt stručne popisuje hlavné ciele práce.",
      kind: "preamble",
    },
    {
      id: "s2",
      sourceFile: "thesis.md",
      heading: "1. Úvod a ciele",
      normalizedHeading: "uvod a ciele",
      level: 1,
      startOffset: 100,
      content: "Hlavným cieľom práce je preskúmať možnosti transformerov. Vymedzujeme 3 výskumné otázky.",
      kind: "introduction",
    },
    {
      id: "s3",
      sourceFile: "thesis.md",
      heading: "2. Metodika a experimentálny návrh",
      normalizedHeading: "metodika a experimentalny navrh",
      level: 1,
      startOffset: 500,
      content: "Navrhujeme vlastnú architektúru ResNet-Transformer. Používame PyTorch a AdamW optimalizátor s cosine learning rate schedule.",
      kind: "methodology",
    },
    {
      id: "s4",
      sourceFile: "thesis.md",
      heading: "3. Výsledky a vyhodnotenie",
      normalizedHeading: "vysledky a vyhodnotenie",
      level: 1,
      startOffset: 1000,
      content: "Model dosiahol F1-skóre 92.4% na testovacej množine, čo prekonáva baseline model o 4.1%.",
      kind: "results",
    },
    {
      id: "s5",
      sourceFile: "thesis.md",
      heading: "4. Záver a prínosy",
      normalizedHeading: "zaver a prinosy",
      level: 1,
      startOffset: 1500,
      content: "Práca úspešne splnila všetky ciele. Hlavným prínosom je nový hybridný algoritmus.",
      kind: "conclusion",
    },
    {
      id: "s6",
      sourceFile: "thesis.md",
      heading: "Zoznam literatúry",
      normalizedHeading: "zoznam literatury",
      level: 1,
      startOffset: 2000,
      content: "[1] Goodfellow, I. Deep Learning. MIT Press, 2016.\n[2] He, K. Deep residual learning, 2016. DOI: 10.1109/CVPR.2016.90",
      kind: "references",
    },
    {
      id: "s7",
      sourceFile: "thesis.md",
      heading: "Príloha A: Hyperparametre",
      normalizedHeading: "priloha a hyperparametre",
      level: 1,
      startOffset: 2500,
      content: "Zoznam hyperparametrov pre grid search: lr=1e-4, batch=64.",
      kind: "appendix",
    },
  ]

  it("routes methodology criterion to methodology section", () => {
    const excerpt = routeSectionsForCriterion("methodology", sampleSections, 3000)
    expect(excerpt.evidenceAvailable).toBe(true)
    expect(excerpt.text).toContain("Navrhujeme vlastnú architektúru")
    expect(excerpt.sectionIds).toContain("s3")
  })

  it("routes results criterion to results section rather than preamble", () => {
    const excerpt = routeSectionsForCriterion("results", sampleSections, 3000)
    expect(excerpt.evidenceAvailable).toBe(true)
    expect(excerpt.text).toContain("F1-skóre 92.4%")
    expect(excerpt.sectionIds).toContain("s4")
  })

  it("penalizes appendices and excludes them when primary evidence exists", () => {
    const excerpt = routeSectionsForCriterion("methodology", sampleSections, 3000)
    expect(excerpt.sectionIds).not.toContain("s7")
  })

  it("samples document across head, middle, and tail for language quality", () => {
    const excerpt = routeSectionsForCriterion("language_quality", sampleSections, 3000)
    expect(excerpt.evidenceAvailable).toBe(true)
    expect(excerpt.sectionIds.length).toBeGreaterThanOrEqual(2)
  })

  it("extracts structured references and bibliographies", () => {
    const rawRefs = `
[1] Vaswani, A., Shazeer, N., Parmar, N. 2017. Attention is all you need. In: NIPS 2017. DOI: 10.5555/3295222.3295349
[2] Goodfellow, I., Bengio, Y. 2016. Deep Learning. MIT Press. ISBN: 9780262035613.
[3] Devlin, J. 2018. BERT: Pre-training of Deep Bidirectional Transformers. arXiv:1810.04805.
[4] W3C. 2023. Web Architecture. [cit. 2023-05-01]. Dostupné z: https://www.w3.org
`
    const extracted = extractStructuredReferences(rawRefs)
    expect(extracted).toHaveLength(4)

    expect(extracted[0].doi).toBe("10.5555/3295222.3295349")
    expect(extracted[0].year).toBe(2017)
    expect(extracted[0].sourceType).toBe("chapter")

    expect(extracted[1].year).toBe(2016)
    expect(extracted[1].sourceType).toBe("book")

    expect(extracted[2].arxivId).toBe("1810.04805")
    expect(extracted[2].sourceType).toBe("preprint")

    expect(extracted[3].sourceType).toBe("web")
  })

  it("builds full generation context within budget", () => {
    const ragContext: ThesisRAGContext = {
      fullText: sampleSections.map((s) => s.content).join("\n\n"),
      sections: sampleSections,
      references: [],
      referencesTitles: ["Attention is all you need"],
      totalChars: 3000,
      truncated: false,
      sourceFiles: ["thesis.md"],
    }

    const { contextText, selectedChars, truncated } = buildFullGenerationContext(
      ragContext,
      ["goal_definition", "methodology", "results", "originality"],
      THESIS_CONTEXT_BUDGETS.fullGeneration
    )

    expect(contextText).toContain("Evidence for Criterion [goal_definition]")
    expect(contextText).toContain("Evidence for Criterion [methodology]")
    expect(contextText).toContain("Evidence for Criterion [results]")
    expect(selectedChars).toBeLessThanOrEqual(THESIS_CONTEXT_BUDGETS.fullGeneration)
    expect(truncated).toBe(false)
  })
})
