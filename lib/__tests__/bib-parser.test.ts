import { describe, it, expect } from "vitest"
import { parseBibKeys, formatCiteKey, extractCiteKeys } from "../bib-parser"
import { parseBibEntries, formatBibEntry, slugifyCiteKey, academicPaperToBibEntry } from "../bib-types"

describe("BibParser", () => {
  describe("parseBibKeys", () => {
    it("extracts keys from multi-entry .bib string", () => {
      const bib = `
        @article{Author2020,
          title = {Hello}
        }
        @inproceedings{Other2021,
          title = {World}
        }
      `
      expect(parseBibKeys(bib)).toEqual(["Author2020", "Other2021"])
    })

    it("returns [] for empty string", () => {
      expect(parseBibKeys("")).toEqual([])
    })

    it("handles @inproceedings, @article, @techreport entry types", () => {
      const bib = `@techreport{A,} @article{B,} @inproceedings{C,}`
      expect(parseBibKeys(bib)).toEqual(["A", "B", "C"])
    })
  })

  describe("formatCiteKey", () => {
    it("formats cite key", () => {
      expect(formatCiteKey("Author2020")).toBe("\\cite{Author2020}")
    })
  })

  describe("extractCiteKeys", () => {
    it("finds single cite", () => {
      expect(extractCiteKeys("This is a \\cite{A} text")).toEqual(["A"])
    })

    it("finds multiple cites", () => {
      expect(extractCiteKeys("This is \\cite{A,B,C} text")).toEqual(["A", "B", "C"])
    })

    it("returns empty for no cites", () => {
      expect(extractCiteKeys("This is a text")).toEqual([])
    })

    it("deduplicates repeated keys", () => {
      expect(extractCiteKeys("This is \\cite{A,B} and \\cite{B,C}")).toEqual(["A", "B", "C"])
    })
  })

  describe("parseBibEntries & formatBibEntry", () => {
    it("parses structured BibEntry objects from raw BibTeX", () => {
      const bib = `
@article{ATLAS2008,
  author = {ATLAS Collaboration},
  title = {The ATLAS Experiment at the CERN Large Hadron Collider},
  journal = {JINST},
  volume = {3},
  pages = {S08003},
  year = {2008},
  doi = {10.1088/1748-0221/3/08/S08003}
}
      `
      const entries = parseBibEntries(bib)
      expect(entries).toHaveLength(1)
      expect(entries[0].key).toBe("ATLAS2008")
      expect(entries[0].type).toBe("article")
      expect(entries[0].title).toBe("The ATLAS Experiment at the CERN Large Hadron Collider")
      expect(entries[0].authorString).toBe("ATLAS Collaboration")
      expect(entries[0].year).toBe("2008")
      expect(entries[0].doi).toBe("10.1088/1748-0221/3/08/S08003")
    })

    it("formats a BibEntry object into valid BibTeX string", () => {
      const formatted = formatBibEntry({
        key: "smith2024_neural",
        type: "article",
        title: "Neural Networks for Physics",
        authorString: "Smith, John and Doe, Jane",
        journal: "Nature",
        year: "2024",
      })
      expect(formatted).toContain("@article{smith2024_neural,")
      expect(formatted).toContain("title = {Neural Networks for Physics}")
      expect(formatted).toContain("author = {Smith, John and Doe, Jane}")
      expect(formatted).toContain("year = {2024}")
    })

    it("generates clean cite keys from author and title", () => {
      const key = slugifyCiteKey("Aad, Georges", "2012", "Observation of a new particle")
      expect(key).toBe("aad2012_observation_of")
    })

    it("converts AcademicPaperResult to structured BibEntry with rawBibtex", () => {
      const entry = academicPaperToBibEntry({
        title: "Deep Residual Learning for Image Recognition",
        authors: ["He, Kaiming", "Zhang, Xiangyu", "Ren, Shaoqing", "Sun, Jian"],
        year: 2016,
        venue: "IEEE Conference on Computer Vision and Pattern Recognition",
        doi: "10.1109/CVPR.2016.90",
        arxivId: "1512.03385",
      })

      expect(entry.key).toContain("he2016")
      expect(entry.title).toBe("Deep Residual Learning for Image Recognition")
      expect(entry.authors).toHaveLength(4)
      expect(entry.authorString).toBe("He, Kaiming and Zhang, Xiangyu and Ren, Shaoqing and Sun, Jian")
      expect(entry.doi).toBe("10.1109/CVPR.2016.90")
      expect(entry.rawBibtex).toContain("@article{")
      expect(entry.rawBibtex).toContain("doi = {10.1109/CVPR.2016.90}")
    })
  })
})
