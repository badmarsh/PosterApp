import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest"
import fs from "fs/promises"
import path from "path"
import os from "os"

// Mock WORKSPACES_ROOT before importing the module under test
const tempRoot = path.join(os.tmpdir(), "download-image-test")
vi.mock("@/lib/workspace-files", () => ({
  WORKSPACES_ROOT: tempRoot,
}))

let downloadRemoteImage: typeof import("../download-image").downloadRemoteImage

describe("downloadRemoteImage", () => {
  beforeAll(async () => {
    const mod = await import("../download-image")
    downloadRemoteImage = mod.downloadRemoteImage
  })
  beforeEach(async () => {
    await fs.mkdir(tempRoot, { recursive: true })
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => undefined)
  })

  it("downloads a remote image and saves it to the workspace assets directory", async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    vi.stubGlobal("fetch", vi.fn(async () => new Response(pngBytes, { status: 200 })))

    const localUrl = await downloadRemoteImage("https://example.com/img.png", "ws-1", "test-image.png")

    expect(localUrl).toBe("/api/workspaces/ws-1/assets/test-image.png")

    const saved = await fs.readFile(path.join(tempRoot, "ws-1", "assets", "test-image.png"))
    expect(new Uint8Array(saved)).toEqual(pngBytes)
  })

  it("returns the original URL if download fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })))

    const result = await downloadRemoteImage("https://example.com/missing.png", "ws-1", "missing.png")

    expect(result).toBe("https://example.com/missing.png")
  })

  it("returns the original URL if fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Network error") }))

    const result = await downloadRemoteImage("https://example.com/error.png", "ws-1", "error.png")

    expect(result).toBe("https://example.com/error.png")
  })

  it("creates the assets directory if it does not exist", async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    vi.stubGlobal("fetch", vi.fn(async () => new Response(pngBytes, { status: 200 })))

    await downloadRemoteImage("https://example.com/new-dir.png", "ws-new", "new-img.png")

    const filePath = path.join(tempRoot, "ws-new", "assets", "new-img.png")
    const stat = await fs.stat(filePath)
    expect(stat.isFile()).toBe(true)
  })

  it("handles query parameters in the URL", async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    vi.stubGlobal("fetch", vi.fn(async () => new Response(pngBytes, { status: 200 })))

    const result = await downloadRemoteImage("https://img.example.com/photo.jpg?w=800&h=600", "ws-1", "photo.jpg")

    expect(result).toBe("/api/workspaces/ws-1/assets/photo.jpg")
  })
})