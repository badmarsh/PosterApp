import { describe, it, expect } from "vitest"
import {
  extractThesisSubmissionDate,
  isTemporalPriorArt,
  sampleRepresentativeThesisText,
} from "../novelty-detector"

describe("Novelty Detector - Temporal Gating and Claim Sampling", () => {
  describe("extractThesisSubmissionDate", () => {
    it("extracts year from Slovak month and year", () => {
      const text = "Univerzita Komenského v Bratislave\nDIPLOMOVÁ PRÁCA\n\nmáj 2021\nBc. Ján Novák"
      const res = extractThesisSubmissionDate(text)
      expect(res.year).toBe(2021)
      expect(res.date).toBe("2021-05-01")
    })

    it("extracts year from academic year format 2020/2021", () => {
      const text = "Akademický rok: 2020/2021\nBratislava"
      const res = extractThesisSubmissionDate(text)
      expect(res.year).toBe(2021)
      expect(res.date).toBe("2021-06-30")
    })

    it("extracts year from explicit submission date", () => {
      const text = "Dátum odovzdania: 15. mája 2019\nFakulta matematiky, fyziky a informatiky"
      const res = extractThesisSubmissionDate(text)
      expect(res.year).toBe(2019)
    })
  })

  describe("isTemporalPriorArt", () => {
    it("flags pre-dating paper as prior art", () => {
      const paper = { year: 2018, publishedAt: "2018-03-10" }
      const res = isTemporalPriorArt(paper, 2021, "2021-05-01")
      expect(res.isPriorArt).toBe(true)
      expect(res.paperYear).toBe(2018)
      expect(res.thesisYear).toBe(2021)
    })

    it("rejects post-dating paper from being flagged as missing prior art", () => {
      const paper = { year: 2024, publishedAt: "2024-01-15" }
      const res = isTemporalPriorArt(paper, 2021, "2021-05-01")
      expect(res.isPriorArt).toBe(false)
      expect(res.reason).toContain("post-dates")
    })

    it("handles same-year publications with precise ISO dates", () => {
      const earlierPaper = { year: 2021, publishedAt: "2021-02-01" }
      const resEarlier = isTemporalPriorArt(earlierPaper, 2021, "2021-05-15")
      expect(resEarlier.isPriorArt).toBe(true)

      const laterPaper = { year: 2021, publishedAt: "2021-09-01" }
      const resLater = isTemporalPriorArt(laterPaper, 2021, "2021-05-15")
      expect(resLater.isPriorArt).toBe(false)
    })

    it("falls back gracefully when thesis submission date is unknown", () => {
      const paper = { year: 2022 }
      const res = isTemporalPriorArt(paper, null, null)
      expect(res.isPriorArt).toBe(true)
    })
  })

  describe("sampleRepresentativeThesisText", () => {
    it("prioritizes methodology, results, and conclusion chunks", () => {
      const chunks = [
        { heading: "Preamble", sectionPath: "Intro", content: "Introduction background text that is long enough to meet threshold." },
        { heading: "Methodology", sectionPath: "Methods", content: "We design a novel neural network architecture for particle detection." },
        { heading: "Experimental Results", sectionPath: "Results", content: "Our model achieved 98.4% accuracy surpassing baseline." },
        { heading: "Conclusion", sectionPath: "Discussion", content: "In summary, our primary contribution is validated." },
      ]

      const sampled = sampleRepresentativeThesisText("", chunks, 5000)
      expect(sampled).toContain("Methodology")
      expect(sampled).toContain("Experimental Results")
      expect(sampled).toContain("Conclusion")
    })
  })
})
