import { spawn } from "child_process"

export const MAX_LOG = 8_000

export function safeLog(value: string) {
  return value.replace(/[A-Za-z]:\\[^\s]+/g, "[path]").replace(/\/[^\s]+/g, "[path]").slice(-MAX_LOG)
}

export async function run(command: string, args: string[], cwd: string, timeoutMs: number = 60_000) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, signal: AbortSignal.timeout(timeoutMs) })
    let log = ""
    child.stdout.on("data", (data) => { log = (log + data.toString()).slice(-MAX_LOG * 2) })
    child.stderr.on("data", (data) => { log = (log + data.toString()).slice(-MAX_LOG * 2) })
    child.on("error", reject)
    child.on("close", (code) => code === 0 ? resolve(log) : reject(new Error(safeLog(log || `${command} exited with ${code}`))) )
  })
}

export interface RunSandboxedLatexOptions {
  stage: string
  buildCmd: string
  timeoutMs?: number
  image?: string
}

/**
 * Kpathsea file-access policy: `p` (paranoid) forbids reading/writing outside
 * the working directory and dot-files. Combined with -shell-restricted this
 * neutralises \input / \openout / \@@input tricks that slip past the
 * string-based blocklist in lib/latex/validation.ts.
 */
const TEX_HARDENING_ENV = "openin_any=p openout_any=p shell_escape=f"

export async function runSandboxedLatex({ stage, buildCmd, timeoutMs = 60_000, image = process.env.LATEX_COMPILER_IMAGE }: RunSandboxedLatexOptions) {
  const hardenedCmd = `export ${TEX_HARDENING_ENV}; ${buildCmd}`

  // Tier 1: Containerized isolated runner (if LATEX_COMPILER_IMAGE is provided and Docker is functional)
  if (image) {
    try {
      return await run(
        "docker",
        [
          "run",
          "--rm",
          "--network", "none",
          "--user", "1000:1000",
          "--cpus", "1",
          "--memory", "512m",
          "--pids-limit", "64",
          "--security-opt", "no-new-privileges",
          "--cap-drop=ALL",
          "--read-only",
          "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",
          "-v", `${stage}:/work`,
          "-w", "/work",
          image,
          "sh", "-c", hardenedCmd,
        ],
        stage,
        timeoutMs
      )
    } catch (dockerErr: any) {
      const dMsg = dockerErr instanceof Error ? dockerErr.message : String(dockerErr)
      console.warn(`[compiler-runner] Docker runner (${image}) failed: ${dMsg.slice(0, 300)}. Falling back to local compiler...`)
      // Fall through to local compiler tiers below
    }
  }

  // Tier 2: Direct local runner on Linux (in-container or Linux server)
  if (process.platform === "linux") {
    const linuxEnv = [
      'export PATH="/usr/local/texlive/2026/bin/x86_64-linux:/usr/local/texlive/2025/bin/x86_64-linux:/usr/local/texlive/2024/bin/x86_64-linux:/usr/local/bin:/usr/bin:/bin:$PATH"',
      'ulimit -t 55 2>/dev/null || true',
      'ulimit -f 1048576 2>/dev/null || true',
      `export ${TEX_HARDENING_ENV}`,
      process.env.HOME ? "" : "export HOME=/tmp",
      "export TEXMFVAR=${TEXMFVAR:-/tmp/.texmf-var} TEXMFCACHE=${TEXMFCACHE:-/tmp/.texmf-cache}",
    ].filter(Boolean).join("; ")

    try {
      return await run("sh", ["-c", `${linuxEnv}; ${buildCmd}`], stage, timeoutMs)
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err)
      if (
        msg.includes("pdflatex: not found") ||
        msg.includes("pdflatex: 127") ||
        msg.includes("pdflatex: command not found") ||
        (msg.includes("127") && !msg.includes("LaTeX"))
      ) {
        throw new Error(`COMPILER_UNAVAILABLE: pdflatex not found on Linux host (${msg})`)
      }
      throw err
    }
  }

  // Tier 3: Direct local runner on macOS (Darwin)
  if (process.platform === "darwin") {
    const macEnv = [
      'export PATH="/Library/TeX/texbin:/usr/local/bin:/opt/homebrew/bin:$PATH"',
      'ulimit -t 55 2>/dev/null || true',
      `export ${TEX_HARDENING_ENV}`,
    ].join("; ")

    try {
      return await run("sh", ["-c", `${macEnv}; ${buildCmd}`], stage, timeoutMs)
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes("pdflatex: not found") || msg.includes("127")) {
        throw new Error(`COMPILER_UNAVAILABLE: pdflatex not found on macOS host (${msg})`)
      }
      throw err
    }
  }

  // Tier 4: Windows hosts (WSL or native Windows pdflatex)
  if (process.platform === "win32") {
    // 4A: Try WSL (standard developer & Windows deployment environment)
    try {
      return await run(
        "wsl",
        ["--cd", stage.replace(/\\/g, "/"), "bash", "-lc", `ulimit -t 55 -v 524288 -f 1048576 2>/dev/null || true; ${hardenedCmd}`],
        stage,
        timeoutMs
      )
    } catch (wslErr: any) {
      const wslMsg = wslErr instanceof Error ? wslErr.message : String(wslErr)

      // If WSL succeeded in invoking pdflatex and pdflatex produced a normal LaTeX error, throw that LaTeX error directly
      if (wslMsg.includes("LaTeX") || wslMsg.includes("Emergency stop") || wslMsg.includes("Fatal error") || wslMsg.includes("Transcript written")) {
        throw wslErr
      }

      // 4B: Try native Windows pdflatex (e.g. MiKTeX or TeX Live installed on Windows)
      try {
        return await run("cmd.exe", ["/d", "/s", "/c", buildCmd], stage, timeoutMs)
      } catch (nativeErr: any) {
        const natMsg = nativeErr instanceof Error ? nativeErr.message : String(nativeErr)
        if (natMsg.includes("LaTeX") || natMsg.includes("Emergency stop") || natMsg.includes("Fatal error") || natMsg.includes("Transcript written")) {
          throw nativeErr
        }
        throw new Error(`COMPILER_UNAVAILABLE: Neither WSL nor native pdflatex could be executed on Windows (WSL error: ${wslMsg.slice(0, 150)}; Native error: ${natMsg.slice(0, 150)})`)
      }
    }
  }

  throw new Error(`COMPILER_UNAVAILABLE: Unsupported platform ${process.platform} with no available LaTeX compiler`)
}
