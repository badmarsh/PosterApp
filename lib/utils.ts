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
