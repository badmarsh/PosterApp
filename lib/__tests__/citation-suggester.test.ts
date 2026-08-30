import { describe, it, expect, vi, beforeEach } from "vitest"
import { suggestCitationsForText, suggestCitationsWithAI } from "../services/citation-suggester"
import { parseBibEntries } from "../bib-types"

global.fetch = vi.fn()

const sampleBib = `
@article{ATLAS2008,
  author = {ATLAS Collaboration},
  title = {The ATLAS Experiment at the CERN Large Hadron Collider},
  journal = {JINST},
  year = {2008}
}

@article{tile_calorimeter_paper,
  author = {ATLAS Collaboration},
  title = {Operation and performance of the ATLAS Tile Calorimeter in Run 2},
  journal = {Eur. Phys. J. C},
  year = {2021}
}

@misc{higgs_discovery,
  author = {Aad, Georges and others},
  title = {Observation of a new particle in the search for the Standard Model Higgs boson},
  year = {2012}
}
`

describe("citation-suggester", () => {
  const entries = parseBibEntries(sampleBib)

  beforeEach(() => {
    vi.resetAllMocks()
    process.env.AI_API_URL = "http://mock-api.com"
    process.env.AI_API_KEY = "mock-key"
  })

  it("suggests citations based on keyword and title overlap", () => {
    const cardText = `
* The ATLAS Experiment operates at the CERN Large Hadron Collider.
* Energy measurements are performed using the ATLAS Tile Calorimeter in Run 2.
    `

    const suggestions = suggestCitationsForText(cardText, entries)

    expect(suggestions.length).toBeGreaterThanOrEqual(1)
    const keys = suggestions.map((s) => s.bibKey)
    expect(keys).toContain("tile_calorimeter_paper")
    expect(keys).toContain("ATLAS2008")
  })

  it("does not suggest citations that are already present in the card", () => {
    const cardText = `
* The ATLAS Experiment operates at CERN \\cite{ATLAS2008}.
* We analyze Tile Calorimeter Run 2 data.
    `

    const suggestions = suggestCitationsForText(cardText, entries)
    const keys = suggestions.map((s) => s.bibKey)
    expect(keys).not.toContain("ATLAS2008")
    expect(keys).toContain("tile_calorimeter_paper")
  })

  it("suggests citations via AI response when available", async () => {
    const mockAiResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                bibKey: "higgs_discovery",
                targetBulletText: "Discovery of the 125 GeV Higgs boson",
                reason: "Direct experimental reference for Higgs boson discovery",
              },
            ]),
          },
        },
      ],
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAiResponse,
    } as Response)

    const suggestions = await suggestCitationsWithAI(
      "Discovery of the 125 GeV Higgs boson at LHC",
      entries,
      "Results"
    )

    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].bibKey).toBe("higgs_discovery")
    expect(suggestions[0].confidence).toBe(0.9)
  })
})
