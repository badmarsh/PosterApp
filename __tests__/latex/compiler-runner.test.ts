import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { safeLog, runSandboxedLatex } from "@/lib/latex/compiler-runner"
import os from "os"
import fs from "fs"
import path from "path"

describe("compiler-runner", () => {
  describe("safeLog", () => {
    it("masks Windows absolute paths", () => {
      const log = "Error in C:\\Users\\marek\\Documents\\Robco\\file.tex at line 12"
      expect(safeLog(log)).toContain("[path]")
      expect(safeLog(log)).not.toContain("C:\\Users")
    })

    it("masks Unix absolute paths", () => {
      const log = "Error in /var/tmp/posterapp-123/main.tex at line 5"
      expect(safeLog(log)).toContain("[path]")
      expect(safeLog(log)).not.toContain("/var/tmp")
    })

    it("truncates excessively long logs to MAX_LOG", () => {
      const longLog = "A".repeat(12_000)
      expect(safeLog(longLog).length).toBeLessThanOrEqual(8_000)
    })
  })

  describe("runSandboxedLatex execution & resilience", () => {
    let tempDir: string

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "compiler-test-"))
    })

    afterEach(() => {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true })
      } catch {}
    })

    it("compiles in production mode on Windows (does not block WSL with COMPILER_UNAVAILABLE)", async () => {
      try {
        vi.stubEnv("NODE_ENV", "production")

        // If on Windows and WSL is available, pdflatex --version should succeed
        if (process.platform === "win32") {
          const result = await runSandboxedLatex({
            stage: tempDir,
            buildCmd: "pdflatex --version",
            timeoutMs: 15_000,
          })
          expect(result.toLowerCase()).toContain("pdftex")
        }
      } finally {
        vi.unstubAllEnvs()
      }
    })

    it("gracefully falls back to local runner when docker image fails", async () => {
      // Pass a non-existent docker image
      if (process.platform === "win32") {
        const result = await runSandboxedLatex({
          stage: tempDir,
          buildCmd: "pdflatex --version",
          image: "nonexistent-test-image-999:invalid",
          timeoutMs: 15_000,
        })
        expect(result.toLowerCase()).toContain("pdftex")
      }
    })

    it("returns LaTeX errors directly without misidentifying them as COMPILER_UNAVAILABLE", async () => {
      if (process.platform === "win32") {
        fs.writeFileSync(path.join(tempDir, "main.tex"), "\\documentclass{article}\\begin{document}\\unknowncommandxyz\\end{document}")
        
        await expect(
          runSandboxedLatex({
            stage: tempDir,
            buildCmd: "pdflatex -interaction=nonstopmode -halt-on-error main.tex",
            timeoutMs: 15_000,
          })
        ).rejects.toThrow()

        try {
          await runSandboxedLatex({
            stage: tempDir,
            buildCmd: "pdflatex -interaction=nonstopmode -halt-on-error main.tex",
            timeoutMs: 15_000,
          })
        } catch (err: any) {
          // Should be a normal LaTeX error, NOT COMPILER_UNAVAILABLE
          expect(err.message).not.toContain("COMPILER_UNAVAILABLE")
          expect(err.message).toMatch(/unknowncommandxyz|Undefined control sequence|Emergency stop|Fatal error/i)
        }
      }
    })
  })
})
