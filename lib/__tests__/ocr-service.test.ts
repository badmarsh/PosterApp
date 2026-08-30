import { describe, it, expect, vi, beforeEach } from "vitest"
import { processImageOcr } from "../services/ocr-service"

// Mock fetch for Vision AI endpoint
global.fetch = vi.fn()

describe("ocr-service", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env.AI_API_URL = "http://mock-api.com"
    process.env.AI_API_KEY = "mock-key"
  })

  it("should process image OCR and extract equations and markdown text", async () => {
    const mockVisionResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "Handwritten Energy Balance Derivation",
              summary: "Derivation of kinetic energy balance with relativistic correction.",
              text: "# Energy Balance\n\n$$\nE^2 = (pc)^2 + (m_0 c^2)^2\n$$\n\nWhere $p$ is momentum and $m_0$ is rest mass.",
              mode: "equation",
              equations: [
                {
                  key: "eq:relativistic_energy",
                  name: "Relativistic Energy-Momentum Relation",
                  formula: "$$ E^2 = (pc)^2 + (m_0 c^2)^2 $$",
                  description: "Relates total energy to momentum and rest mass",
                },
              ],
              tables: [],
            }),
          },
        },
      ],
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockVisionResponse,
    } as Response)

    const result = await processImageOcr("data:image/png;base64,mockBase64Data", "equation")

    expect(result.title).toBe("Handwritten Energy Balance Derivation")
    expect(result.equations).toHaveLength(1)
    // Should clean formula by stripping outer $$
    expect(result.equations[0].formula).toBe("E^2 = (pc)^2 + (m_0 c^2)^2")
    expect(result.equations[0].key).toBe("eq:relativistic_energy")
    expect(result.text).toContain("# Energy Balance")
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("should process table mode and return structured tables", async () => {
    const mockTableResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "Particle Detector Specifications",
              summary: "Comparison of detector energy resolutions across beam energies.",
              text: "| Detector | Energy (GeV) | Resolution (%) |\n|---|---|---|\n| Si-Strip | 100 | 1.2 |\n| Scintillator | 100 | 3.5 |",
              mode: "table",
              equations: [],
              tables: [
                {
                  caption: "Detector Specifications",
                  markdown: "| Detector | Energy (GeV) | Resolution (%) |\n|---|---|---|\n| Si-Strip | 100 | 1.2 |\n| Scintillator | 100 | 3.5 |",
                  rows: [
                    ["Detector", "Energy (GeV)", "Resolution (%)"],
                    ["Si-Strip", "100", "1.2"],
                    ["Scintillator", "100", "3.5"],
                  ],
                },
              ],
            }),
          },
        },
      ],
    }

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockTableResponse,
    } as Response)

    const result = await processImageOcr("data:image/jpeg;base64,mockJpeg", "table")

    expect(result.tables).toHaveLength(1)
    expect(result.tables[0].caption).toBe("Detector Specifications")
    expect(result.tables[0].rows).toHaveLength(3)
  })
})
