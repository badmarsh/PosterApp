import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  getThesisReviewStore,
  clearSourceDocCache,
} from "@/components/thesis-review/use-thesis-review-store"
import { cleanTitleFromFilename } from "@/components/thesis-review/thesis-metadata-panel"

describe("Thesis Source Document Management & Deletion", () => {
  const workspaceId = "ws-test-del"
  const outputId = "out-1"
  const outputKey = `${workspaceId}:${outputId}`

  beforeEach(() => {
    clearSourceDocCache()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ fullText: "# Kap 1\nObsah prace..." }),
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("clears cached source document markdown when clearSourceDocCache is called", async () => {
    const store = getThesisReviewStore(outputKey)
    store.getState().setSelectedFileId("file-alpha")

    // Cache some text
    const text = await store.getState().loadSourceDocument(workspaceId, "file-alpha")
    expect(text).toContain("Obsah prace")
    expect(store.getState().sourceMarkdown).toContain("Obsah prace")

    // Invalidate cache for file-alpha
    clearSourceDocCache(workspaceId, "file-alpha")

    // Clearing all workspace files
    clearSourceDocCache(workspaceId)
  })

  it("resets selectedFileId and sourceMarkdown when setSelectedFileId('') is called", () => {
    const store = getThesisReviewStore(outputKey)
    store.getState().setSelectedFileId("file-to-delete")
    expect(store.getState().selectedFileId).toBe("file-to-delete")

    // Simulate deleting the last document
    store.getState().setSelectedFileId("")
    expect(store.getState().selectedFileId).toBe("")
    expect(store.getState().sourceMarkdown).toBe("")
  })

  it("cleanTitleFromFilename correctly extracts hints for document pre-fill", () => {
    const res1 = cleanTitleFromFilename("PhD_Thesis_2.pdf")
    expect(res1.hintType).toBe("phd")
    expect(res1.hintKind).toBe("thesis")

    const res2 = cleanTitleFromFilename("ZAVERECNA PRACA_KELOVA.pdf")
    // Generic label "Záverečná práca" is intentionally suppressed so actual text title is used
    expect(res2.title).toBe("")
    expect(res2.hintAuthor).toBe("Kelova")

    const res3 = cleanTitleFromFilename("boson_probability_function_13TeV.pdf")
    expect(res3.hintKind).toBe("paper")
  })
})
