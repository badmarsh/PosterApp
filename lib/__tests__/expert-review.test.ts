import { describe, it, expect } from "vitest"
import {
  EvidenceReferenceSchema,
  ReviewFindingContractSchema,
  ReportingGuidelineCheckContractSchema,
  ProfessionalReviewGenerationSchema,
} from "@/lib/ai/contracts"
import {
  formatReviewToMarkdown,
  formatReviewToPlainText,
} from "@/lib/export/review-formatters"
import { generateThesisReviewDocx } from "@/lib/docx/generator-review"
import { anchorEvidenceQuotes } from "@/lib/ai/review-engine"
import type { ThesisRAGContext } from "@/lib/ai/thesis-context"
import type { ThesisReviewRecord } from "@/components/thesis-review/use-thesis-review-store"

describe("Expert Review Contracts & Validation", () => {
  it("validates EvidenceReferenceSchema with offsets and quotes", () => {
    const raw = {
      sectionHeading: "3.2 Methodology",
      quote: "We used a learning rate of 1e-4 with AdamW optimizer.",
      startOffset: 1200,
      endOffset: 1254,
    }
    const parsed = EvidenceReferenceSchema.parse(raw)
    expect(parsed.sectionHeading).toBe("3.2 Methodology")
    expect(parsed.quote).toContain("learning rate")
    expect(parsed.startOffset).toBe(1200)
  })

  it("validates ReviewFindingContractSchema and normalizes severity and status", () => {
    const raw = {
      title: "Missing baseline comparison",
      explanation: "The paper does not compare against ResNet-50 on ImageNet.",
      recommendation: "Include benchmark table with ResNet-50.",
      severity: "MAJOR",
      category: "METHODOLOGY",
      confidence: 0.95,
      evidence: [
        {
          quote: "Our model outperforms prior work.",
        },
      ],
    }
    const parsed = ReviewFindingContractSchema.parse(raw)
    expect(parsed.severity).toBe("major")
    expect(parsed.category).toBe("methodology")
    expect(parsed.status).toBe("unreviewed")
    expect(parsed.includeInExport).toBe(true)
    expect(parsed.evidence).toHaveLength(1)
  })

  it("validates ReportingGuidelineCheckContractSchema", () => {
    const raw = {
      item: "Randomization sequence",
      category: "Methodology",
      status: "compliant",
      notes: "Computer-generated pseudorandom sequence properly documented.",
    }
    const parsed = ReportingGuidelineCheckContractSchema.parse(raw)
    expect(parsed.status).toBe("compliant")
    expect(parsed.item).toBe("Randomization sequence")
  })

  it("validates ProfessionalReviewGenerationSchema", () => {
    const raw = {
      summary: "This paper proposes a novel attention mechanism.",
      strengths: ["Strong experimental results", "Clear writing"],
      findings: [
        {
          title: "Missing ablation study",
          explanation: "Individual components are not evaluated separately.",
          severity: "major",
          category: "results",
        },
      ],
      reportingStandard: "ml_reproducibility",
      questionsForAuthors: ["How sensitive is the model to random seeds?"],
      recommendation: "minor_revisions",
    }
    const parsed = ProfessionalReviewGenerationSchema.parse(raw)
    expect(parsed.summary).toBe("This paper proposes a novel attention mechanism.")
    expect(parsed.strengths).toHaveLength(2)
    expect(parsed.findings).toHaveLength(1)
    expect(parsed.reportingStandard).toBe("ml_reproducibility")
  })
})

describe("Evidence Quote Grounding & State Classification", () => {
  const sampleRAG: ThesisRAGContext = {
    fullText: "Full document text for RAG",
    sections: [
      {
        id: "s-1",
        sourceFile: "paper.md",
        heading: "1. Úvod",
        normalizedHeading: "1. uvod",
        level: 1,
        startOffset: 0,
        content: "V tejto práci navrhujeme neurónovú sieť s presnosťou 94.5% na CIFAR-10.",
        kind: "introduction",
      },
      {
        id: "s-2",
        sourceFile: "paper.md",
        heading: "3. Metodológia",
        normalizedHeading: "3. metodologia",
        level: 1,
        startOffset: 100,
        content: "Trénovanie prebiehalo s learning rate 1e-4 a batch size 64. Trénovanie prebiehalo opakovane.",
        kind: "methodology",
      },
      {
        id: "s-3",
        sourceFile: "paper.md",
        heading: "4. Výsledky",
        normalizedHeading: "4. vysledky",
        level: 1,
        startOffset: 200,
        content: "Model dosiahol výrazné zlepšenie oproti predchádzajúcim baseline modelom.",
        kind: "results",
      },
      {
        id: "s-4",
        sourceFile: "paper.md",
        heading: "5. Diskusia",
        normalizedHeading: "5. diskusia",
        level: 1,
        startOffset: 300,
        content: "Trénovanie prebiehalo s learning rate 1e-4 a batch size 64 v druhej fáze.",
        kind: "discussion",
      },
    ],
    references: [],
    referencesTitles: [],
    totalChars: 2000,
    truncated: false,
    sourceFiles: ["paper.md"],
  }

  it("classifies single exact quote match as verified-exact", () => {
    const findings = anchorEvidenceQuotes(
      [
        {
          id: "f-1",
          title: "Presnosť na CIFAR-10",
          explanation: "Presnosť bola 94.5%",
          recommendation: "Doplniť konfidenčný interval",
          confidence: 0.95,
          status: "unreviewed",
          includeInExport: true,
          createdBy: "ai",
      audience: "author",
          severity: "minor",
          category: "results",
          evidence: [{ quote: "presnosťou 94.5% na CIFAR-10" }],
        },
      ],
      sampleRAG
    )

    expect(findings).toHaveLength(1)
    expect(findings[0].evidence[0].state).toBe("verified-exact")
    expect(findings[0].evidence[0].verified).toBe(true)
    expect(findings[0].evidenceState).toBe("verified-exact")
  })

  it("classifies quote with whitespace differences as verified-normalized", () => {
    const findings = anchorEvidenceQuotes(
      [
        {
          id: "f-2",
          title: "Zlepšenie baseline",
          explanation: "Model prekonal baseline",
          recommendation: "Doplniť tabuľku",
          confidence: 0.9,
          status: "unreviewed",
          includeInExport: true,
          createdBy: "ai",
      audience: "author",
          severity: "minor",
          category: "results",
          evidence: [{ quote: "Model  dosiahol   výrazné   zlepšenie" }],
        },
      ],
      sampleRAG
    )

    expect(findings[0].evidence[0].state).toBe("verified-normalized")
    expect(findings[0].evidence[0].verified).toBe(true)
    expect(findings[0].evidenceState).toBe("verified-normalized")
  })

  it("classifies quote matching in multiple sections as ambiguous", () => {
    const findings = anchorEvidenceQuotes(
      [
        {
          id: "f-3",
          title: "Opakovaný popis hyperparametrov",
          explanation: "Hyperparametre sa opakujú",
          recommendation: "Zjednotiť popis",
          confidence: 0.85,
          status: "unreviewed",
          includeInExport: true,
          createdBy: "ai",
      audience: "author",
          severity: "minor",
          category: "methodology",
          evidence: [{ quote: "Trénovanie prebiehalo s learning rate 1e-4" }],
        },
      ],
      sampleRAG
    )

    expect(findings[0].evidence[0].state).toBe("ambiguous")
    expect(findings[0].evidenceState).toBe("ambiguous")
  })

  it("classifies partial match of long quote as approximate", () => {
    const findings = anchorEvidenceQuotes(
      [
        {
          id: "f-4",
          title: "Približná citácia",
          explanation: "Dlhá citácia s malou zmenou na konci",
          recommendation: "Skontrolovať citáciu",
          confidence: 0.85,
          status: "unreviewed",
          includeInExport: true,
          createdBy: "ai",
      audience: "author",
          severity: "minor",
          category: "results",
          evidence: [{ quote: "Model dosiahol výrazné zlepšenie oproti starým baseline modelom na novom testovacom datasete" }],
        },
      ],
      sampleRAG
    )

    expect(findings[0].evidence[0].state).toBe("approximate")
    expect(findings[0].evidence[0].verified).toBe(false)
    expect(findings[0].evidenceState).toBe("approximate")
  })

  it("classifies quote missing from document as unverified", () => {
    const findings = anchorEvidenceQuotes(
      [
        {
          id: "f-5",
          title: "Vymyslený citát",
          explanation: "V texte sa nenachádza",
          recommendation: "Odstrániť citát",
          confidence: 0.7,
          status: "unreviewed",
          includeInExport: true,
          createdBy: "ai",
          audience: "author",
          severity: "major",
          category: "results",
          evidence: [{ quote: "Použili sme kvantový počítač D-Wave s 5000 qubitmi." }],
        },
      ],
      sampleRAG
    )

    expect(findings[0].evidence[0].state).toBe("unverified")
    expect(findings[0].evidence[0].verified).toBe(false)
    expect(findings[0].evidenceState).toBe("unverified")
  })
})

describe("Review Export Formatters & DOCX Generation", () => {
  const mockReview: ThesisReviewRecord = {
    id: "rev-test-1",
    studentName: "Martin Kováč",
    thesisTitle: "Detekcia anomálií v sieťovej prevádzke",
    thesisType: "master",
    reviewerRole: "opponent",
    reviewerName: "doc. Ing. Peter Novák, PhD.",
    institution: "STU v Bratislave",
    department: "Katedra informatiky",
    grade: "B",
    recommendation: "Prácu odporúčam na obhajobu.",
    summary: "Diplomová práca sa zaoberá detekciou anomálií s využitím strojového učenia.",
    strengths: ["Kvalitná experimentálna časť", "Dôkladný prehľad literatúry"],
    findings: [
      {
        id: "f-1",
        category: "statistics",
        title: "Chýbajúca štatistická signifikancia",
        explanation: "Výsledky neobsahujú p-hodnoty ani intervaly spoľahlivosti.",
        recommendation: "Doplniť t-test alebo Wilcoxonov test.",
        severity: "major",
        confidence: 0.9,
        evidence: [{ quote: "Model dosiahol 98% presnosť." }],
        status: "accepted",
        includeInExport: true,
        createdBy: "ai",
      },
      {
        id: "f-2",
        category: "formal",
        title: "Preklepy v kapitole 2",
        explanation: "Na strane 14 sa vyskytujú drobné gramatické chyby.",
        recommendation: "Opraviť pravopis.",
        severity: "minor",
        confidence: 0.8,
        evidence: [{ quote: "algoritmus bol vybraný..." }],
        status: "accepted",
        includeInExport: true,
        createdBy: "ai",
      },
    ],
    sections: [],
    defenseQuestions: ["Aký je výpočtový čas navrhnutého modelu v reálnej prevádzke?"],
    citationIssues: [],
    status: "draft",
    language: "sk",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  it("formats review into structured Markdown with major and minor concerns", () => {
    const md = formatReviewToMarkdown(mockReview)
    expect(md).toContain("# Posudok / Peer Review: Detekcia anomálií v sieťovej prevádzke")
    expect(md).toContain("Martin Kováč")
    expect(md).toContain("1. Zhrnutie práce")
    expect(md).toContain("2. Silné stránky práce")
    expect(md).toContain("3. Zásadné pripomienky")
    expect(md).toContain("Chýbajúca štatistická signifikancia")
    expect(md).toContain("4. Drobné pripomienky")
    expect(md).toContain("Preklepy v kapitole 2")
    expect(md).toContain("Aký je výpočtový čas")
  })

  it("formats review into plain text for ScholarOne / Editorial Manager", () => {
    const text = formatReviewToPlainText(mockReview)
    expect(text).not.toContain("#")
    expect(text).not.toContain("**")
    expect(text).toContain("Martin Kováč")
    expect(text).toContain("Chýbajúca štatistická signifikancia")
  })

  it("generates a valid DOCX blob from review record", async () => {
    const blob = await generateThesisReviewDocx(mockReview)
    expect(blob).toBeDefined()
    expect(blob.size).toBeGreaterThan(1000)
    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
  })
})
