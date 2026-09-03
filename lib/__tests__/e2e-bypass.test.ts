import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { isE2eAuthBypassEnabled } from "../e2e-bypass"

const ORIGINAL = { ...process.env }

function setEnv(vars: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
}

describe("isE2eAuthBypassEnabled", () => {
  beforeEach(() => setEnv({ VITEST: undefined, E2E_AUTH_BYPASS: undefined, NEXT_PUBLIC_E2E_TEST: undefined, NODE_ENV: undefined }))
  afterEach(() => { process.env = { ...ORIGINAL } })

  it("is disabled by default", () => {
    expect(isE2eAuthBypassEnabled()).toBe(false)
  })

  it("ignores the public NEXT_PUBLIC_E2E_TEST flag", () => {
    setEnv({ NEXT_PUBLIC_E2E_TEST: "1", NODE_ENV: "development" })
    expect(isE2eAuthBypassEnabled()).toBe(false)
  })

  it("fails closed when NODE_ENV is unset", () => {
    setEnv({ E2E_AUTH_BYPASS: "1" })
    expect(isE2eAuthBypassEnabled()).toBe(false)
  })

  it("fails closed in production even with the server flag", () => {
    setEnv({ E2E_AUTH_BYPASS: "1", NODE_ENV: "production" })
    expect(isE2eAuthBypassEnabled()).toBe(false)
  })

  it("enables only with the server flag in development/test", () => {
    setEnv({ E2E_AUTH_BYPASS: "1", NODE_ENV: "development" })
    expect(isE2eAuthBypassEnabled()).toBe(true)
    setEnv({ NODE_ENV: "test" })
    expect(isE2eAuthBypassEnabled()).toBe(true)
  })

  it("never enables under vitest", () => {
    setEnv({ E2E_AUTH_BYPASS: "1", NODE_ENV: "test", VITEST: "true" })
    expect(isE2eAuthBypassEnabled()).toBe(false)
  })
})
