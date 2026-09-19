import { describe, it, expect } from "vitest"
import {
  canonicalTitleKey,
  canonicalDoi,
  compareClaimToPaper,
} from "../scholarly-comparator"

describe("Scholarly Comparator & Prior-Art Classification", () => {
  it("normalizes titles across diacritics, case, and punctuation", () => {
    const key1 = canonicalTitleKey("Deep Learning v Bioinformatike: Prehľad a Metódy!")
    const key2 = canonicalTitleKey("deep learning v bioinformatike prehlad a metody")
    expect(key1).toBe(key2)
  })

  it("normalizes DOIs removing http/https dx.doi.org prefixes", () => {
    expect(canonicalDoi("https://doi.org/10.1145/3377325.3377533")).toBe("10.1145/3377325.3377533")
    expect(canonicalDoi("http://dx.doi.org/10.1016/j.jneumeth.2020.108852")).toBe("10.1016/j.jneumeth.2020.108852")
    expect(canonicalDoi("10.1000/182")).toBe("10.1000/182")
  })

  it("classifies post-dated papers as POSTDATED and never prior art", () => {
    const claim = "We propose a novel transformer architecture for particle collision detection."
    const paper = {
      title: "Particle collision detection using transformers",
      abstract: "We evaluate transformers for collision detection on CERN LHC dataset.",
      year: 2025,
    }
    const comparison = compareClaimToPaper(claim, paper, 2021, "2021-05-01", 0.92)
    expect(comparison.relation).toBe("POSTDATED")
    expect(comparison.isPriorArt).toBe(false)
    expect(comparison.temporalValidity).toBe("postdated")
  })

  it("identifies direct prior art with high problem and method overlap", () => {
    const claim = "We design a novel graph neural network model for anomaly detection on CERN dataset."
    const paper = {
      title: "Graph neural network model for anomaly detection on CERN benchmark",
      abstract: "A graph neural network framework for detecting anomalous collision events on CERN benchmark data.",
      year: 2019,
    }
    const comparison = compareClaimToPaper(claim, paper, 2021, "2021-05-01", 0.88)
    expect(comparison.relation).toBe("DIRECT_PRIOR_ART")
    expect(comparison.isPriorArt).toBe(true)
    expect(comparison.temporalValidity).toBe("valid")
  })

  it("marks low semantic overlap as NOT_MATERIAL", () => {
    const claim = "We design a novel graph neural network model for anomaly detection."
    const paper = {
      title: "Historical agricultural practices in medieval Europe",
      abstract: "A study of crop rotation and economic impact in 14th century France.",
      year: 2018,
    }
    const comparison = compareClaimToPaper(claim, paper, 2021, "2021-05-01", 0.1)
    expect(comparison.relation).toBe("NOT_MATERIAL")
    expect(comparison.isPriorArt).toBe(false)
  })
})
