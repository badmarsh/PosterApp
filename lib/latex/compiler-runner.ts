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

export async function runSandboxedLatex({ stage, buildCmd, timeoutMs = 60_000, image = process.env.LATEX_COMPILER_IMAGE }: RunSandboxedLatexOptions) {
  if (image) {
    // Production worker: an isolated container with no network, dropped capabilities, and read-only root with staging mount.
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
        "sh", "-c", buildCmd,
      ],
      stage,
      timeoutMs
    )
  } else if (process.env.NODE_ENV !== "production") {
    // Development-only WSL fallback; production must configure LATEX_COMPILER_IMAGE.
    return await run("wsl", ["--cd", stage, "bash", "-lc", `ulimit -t 55 -v 524288 -f 20480; ${buildCmd}`], stage, timeoutMs)
  } else {
    throw new Error("COMPILER_UNAVAILABLE")
  }
}
