/**
 * DeerFlow sidecar configuration (server-only).
 *
 * The sidecar is optional and off by default. Every value is read from the
 * environment at call time (not module load time) so tests can flip env vars
 * between cases without re-importing the module.
 */
import "server-only"

export interface DeerflowConfig {
  /** Master kill switch. `DEERFLOW_ENABLED=1` turns the integration on. */
  enabled: boolean
  /** Base URL of the unified DeerFlow nginx proxy (Gateway mode). */
  baseUrl: string
  /** Bearer token sent to the sidecar for every request. */
  serviceToken: string
  /** Per-workspace daily spend cap (USD). */
  dailyBudgetUsd: number
  /** Hard timeout for one agent run (ms). */
  runTimeoutMs: number
  /** Max LangGraph recursion limit sent to the agent. */
  maxRecursionLimit: number
  /** Per-user run rate limit (runs per hour). */
  runsPerHour: number
  /** Upper bound for maxMinutes accepted from clients. */
  maxRunMinutes: number
}

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]
  if (raw === undefined || raw === "") return fallback
  return raw === "1" || raw.toLowerCase() === "true"
}

function numEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name])
  return Number.isFinite(raw) && raw > 0 ? raw : fallback
}

const DEFAULT_BASE_URL = "http://127.0.0.1:2026"

export function getDeerflowConfig(): DeerflowConfig {
  return {
    enabled: boolEnv("DEERFLOW_ENABLED", false),
    baseUrl: (process.env.DEERFLOW_URL || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    serviceToken: process.env.DEERFLOW_SERVICE_TOKEN || "",
    dailyBudgetUsd: numEnv("DEERFLOW_DAILY_BUDGET_USD", 3.0),
    runTimeoutMs: numEnv("DEERFLOW_RUN_TIMEOUT_MS", 900_000),
    maxRecursionLimit: numEnv("DEERFLOW_MAX_RECURSION_LIMIT", 100),
    runsPerHour: numEnv("DEERFLOW_RUNS_PER_HOUR", 3),
    maxRunMinutes: numEnv("DEERFLOW_MAX_RUN_MINUTES", 30),
  }
}

export function isDeerflowEnabled(): boolean {
  return getDeerflowConfig().enabled
}
