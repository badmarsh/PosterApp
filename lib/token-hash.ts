import { createHash } from "crypto"

/**
 * Deterministic SHA-256 hex digest for API keys and one-time tickets.
 * Raw credentials must NEVER be stored in the database.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}
