/**
 * Defensible Academic Audit Trail Engine.
 *
 * Provides tamper-evident audit logging for academic evaluation actions:
 *  - AI review generation & re-generation (with model & prompt hash)
 *  - Manual reviewer grade & score overrides
 *  - Finding triage (accepted, rejected, edited)
 *  - Official thesis protocol exports
 */

import { createHash } from "crypto"

export type AuditActionType =
  | "AI_GENERATION"
  | "CRITERION_REGENERATION"
  | "MANUAL_GRADE_OVERRIDE"
  | "FINDING_TRIAGE"
  | "DECISION_CONFIRMATION"
  | "PROTOCOL_EXPORT"

export interface AuditLogEntry {
  id: string
  workspaceId: string
  reviewId: string
  action: AuditActionType
  actor: {
    userId?: string
    name?: string
    role?: string
  }
  details: Record<string, any>
  timestamp: string
  previousEntryHash?: string
  entryHash: string
}

/**
 * Computes a SHA-256 integrity hash for an audit entry.
 */
export function computeAuditEntryHash(
  entry: Omit<AuditLogEntry, "id" | "entryHash">
): string {
  const payload = JSON.stringify({
    workspaceId: entry.workspaceId,
    reviewId: entry.reviewId,
    action: entry.action,
    actor: entry.actor,
    details: entry.details,
    timestamp: entry.timestamp,
    previousEntryHash: entry.previousEntryHash || "GENESIS",
  })
  return createHash("sha256").update(payload).digest("hex")
}

/**
 * Creates and signs a new immutable audit log entry.
 */
export function createAuditLogEntry(
  workspaceId: string,
  reviewId: string,
  action: AuditActionType,
  actor: { userId?: string; name?: string; role?: string },
  details: Record<string, any>,
  previousEntryHash?: string
): AuditLogEntry {
  const timestamp = new Date().toISOString()
  const partial = {
    workspaceId,
    reviewId,
    action,
    actor,
    details,
    timestamp,
    previousEntryHash,
  }

  const entryHash = computeAuditEntryHash(partial)
  const id = `audit-${Date.now()}-${entryHash.slice(0, 8)}`

  return {
    id,
    ...partial,
    entryHash,
  }
}

/**
 * Verifies the cryptographic integrity of an audit trail chain.
 */
export function verifyAuditChain(entries: AuditLogEntry[]): boolean {
  if (entries.length === 0) return true

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const expectedPrevious = i === 0 ? entry.previousEntryHash : entries[i - 1].entryHash

    if (i > 0 && entry.previousEntryHash !== expectedPrevious) {
      return false
    }

    const recomputedHash = computeAuditEntryHash({
      workspaceId: entry.workspaceId,
      reviewId: entry.reviewId,
      action: entry.action,
      actor: entry.actor,
      details: entry.details,
      timestamp: entry.timestamp,
      previousEntryHash: entry.previousEntryHash,
    })

    if (recomputedHash !== entry.entryHash) {
      return false
    }
  }

  return true
}
