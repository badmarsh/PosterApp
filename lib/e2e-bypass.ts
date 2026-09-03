/**
 * Single source of truth for the E2E authentication bypass.
 *
 * The bypass is granted ONLY when:
 *   - E2E_AUTH_BYPASS=1 is set (server-only; never NEXT_PUBLIC_*, so it can
 *     never be baked into a client bundle by a CI build), AND
 *   - NODE_ENV is explicitly "development" or "test".
 *
 * An unset NODE_ENV fails closed. Vitest is excluded so unit tests exercise
 * real auth paths via mocks.
 */
export function isE2eAuthBypassEnabled(): boolean {
  if (process.env.VITEST) return false
  if (process.env.E2E_AUTH_BYPASS !== "1") return false
  const env = process.env.NODE_ENV
  return env === "development" || env === "test"
}

export const E2E_TEST_USER_ID = "test-user-id"
