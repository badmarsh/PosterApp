import { describe, it, expect } from "vitest"
import { buildAnalysisPlanFromRAG } from "@/lib/ai/analysis-plan"
import type { ThesisRAGContext } from "@/lib/ai/thesis-context"

describe("Analysis Plan & Pre-flight Diagnostics Engine", () => {
  const sampleMLRAG: ThesisRAGContext = {
    fullText: "In this paper we propose a novel deep learning neural network for transformer image classification. The model achieves 95.2% accuracy on the CIFAR-10 benchmark. We tuned hyperparameters including learning rate 1e-4 and Adam optimizer.",
    sections: [
      {
        id: "s-1",
        sourceFile: "paper.md",
        heading: "1. Introduction",
        normalizedHeading: "1. introduction",
        level: 1,
        startOffset: 0,
        content: "In this paper we propose a novel deep learning neural network...",
        kind: "introduction",
      },
      {
        id: "s-2",
        sourceFile: "paper.md",
        heading: "2. Methodology & Architecture",
        normalizedHeading: "2. methodology",
        level: 1,
        startOffset: 100,
        content: "We describe the model architecture and hyperparameter training on CIFAR-10 benchmark.",
        kind: "methodology",
      },
      {
        id: "s-3",
        sourceFile: "paper.md",
        heading: "3. Results & Evaluation",
        normalizedHeading: "3. results",
        level: 1,
        startOffset: 200,
        content: "Table 1 shows accuracy and loss function comparisons.",
        kind: "results",
      },
      {
        id: "s-4",
        sourceFile: "paper.md",
        heading: "4. Conclusion",
        normalizedHeading: "4. conclusion",
        level: 1,
        startOffset: 300,
        content: "We presented a robust transformer architecture.",
        kind: "conclusion",
      },
    ],
    references: [],
    referencesTitles: Array.from({ length: 18 }, (_, i) => `Reference Paper ${i + 1}`),
    totalChars: 18_000,
    truncated: false,
    sourceFiles: ["paper.md"],
  }

  it("detects machine learning study design and recommends ML Reproducibility checklist", () => {
    const plan = buildAnalysisPlanFromRAG(sampleMLRAG, { thesisTitle: "Deep Learning Classifier", reviewKind: "paper" }, "en")

    expect(plan.detectedType).toBe("paper")
    expect(plan.studyDesign).toBe("empirical")
    expect(plan.recommendedReportingGuideline).toBe("ml_reproducibility")
    expect(plan.guidelineReason).toContain("ML Reproducibility Checklist")
    expect(plan.extractionQuality).toBe("high")
    expect(plan.citationAvailability).toBe("rich")
    expect(plan.hasTablesAndFigures).toBe(true)
    expect(plan.canProceedToDeepReview).toBe(true)
  })

  it("detects clinical trials and recommends CONSORT 2025", () => {
    const clinicalRAG: ThesisRAGContext = {
      ...sampleMLRAG,
      fullText: "A randomized controlled trial with 200 patients in the control group and 200 in the intervention group.",
    }

    const plan = buildAnalysisPlanFromRAG(clinicalRAG, { thesisTitle: "Clinical Trial", reviewKind: "paper" }, "sk")
    expect(plan.recommendedReportingGuideline).toBe("consort")
    expect(plan.guidelineReason).toContain("CONSORT 2025")
  })

  it("detects systematic reviews and recommends PRISMA 2020", () => {
    const systematicRAG: ThesisRAGContext = {
      ...sampleMLRAG,
      fullText: "We performed a systematic review and meta-analysis following PRISMA search strategy across PubMed and IEEE Xplore.",
    }

    const plan = buildAnalysisPlanFromRAG(systematicRAG, { thesisTitle: "Systematic Review", reviewKind: "paper" }, "sk")
    expect(plan.recommendedReportingGuideline).toBe("prisma")
    expect(plan.studyDesign).toBe("systematic_review")
    expect(plan.guidelineReason).toContain("PRISMA 2020")
  })

  it("identifies missing sections and computes actionable limitations", () => {
    const incompleteRAG: ThesisRAGContext = {
      fullText: "A short manuscript draft with minimal content.",
      sections: [
        {
          id: "s-1",
          sourceFile: "paper.md",
          heading: "1. Introduction",
          normalizedHeading: "1. introduction",
          level: 1,
          startOffset: 0,
          content: "Only introduction exists.",
          kind: "introduction",
        },
      ],
      references: [],
      referencesTitles: [],
      totalChars: 1200,
      truncated: false,
      sourceFiles: ["paper.md"],
    }

    const plan = buildAnalysisPlanFromRAG(incompleteRAG, { thesisTitle: "Incomplete Work", reviewKind: "thesis" }, "sk")
    expect(plan.extractionQuality).toBe("low")
    expect(plan.citationAvailability).toBe("none")
    expect(plan.expectedMissingSections).toContain("Metodológia / Metódy")
    expect(plan.expectedMissingSections).toContain("Výsledky")
    expect(plan.limitations.length).toBeGreaterThan(0)
  })
})
