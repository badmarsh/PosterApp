import { describe, it, expect } from "vitest"
import { generateQRCodePngBuffer } from "../services/qr-service"

describe("qr-service", () => {
  it("generates a valid PNG Buffer from a URL", async () => {
    const buffer = await generateQRCodePngBuffer({
      url: "https://arxiv.org/abs/2301.12345",
      width: 400,
    })

    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(100)
    // Verify PNG header bytes: 0x89 0x50 0x4E 0x47 (PNG signature)
    expect(buffer[0]).toBe(0x89)
    expect(buffer[1]).toBe(0x50)
    expect(buffer[2]).toBe(0x4e)
    expect(buffer[3]).toBe(0x47)
  })
})
