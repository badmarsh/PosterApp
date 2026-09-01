import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Slovak plural selection: 1 → singular, 2–4 → paucal ("few"), else → plural
 * ("many"). Slovak (like Czech) needs three noun forms, not two, so a plain
 * `n === 1 ? singular : plural` ternary is wrong for counts of 2–4.
 *
 * e.g. pluralizeSk(1, "chunk", "chunky", "chunkov") → "chunk"
 *      pluralizeSk(3, "chunk", "chunky", "chunkov") → "chunky"
 *      pluralizeSk(9, "chunk", "chunky", "chunkov") → "chunkov"
 */
export function pluralizeSk(count: number, one: string, few: string, many: string): string {
  const n = Math.abs(count)
  if (n === 1) return one
  if (n >= 2 && n <= 4) return few
  return many
}

/**
 * Generates a UUID v4 string safely in both secure (HTTPS/localhost) and
 * insecure (e.g. LAN HTTP) browser environments without crashing.
 */
export function safeRandomUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

