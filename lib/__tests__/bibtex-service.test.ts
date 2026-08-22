import { describe, it, expect } from "vitest"
import { extractBibTeX } from "../services/bibtex-service"
import { vi } from "vitest"

describe("bibtex-service", () => {
  describe("extractBibTeX", () => {
    it("should handle empty or invalid results gracefully", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "" } }] })
      })
      const result = await extractBibTeX("Some reference text", "ws-id")
      // Since it returns void, we just expect it to not throw
      expect(result).toBeUndefined()
    })
  })
})
