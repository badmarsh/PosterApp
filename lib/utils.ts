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

/**
 * Common named HTML entities mapping.
 */
const NAMED_ENTITIES: Record<string, string> = {
  quot: '"',
  apos: "'",
  amp: "&",
  lt: "<",
  gt: ">",
  nbsp: " ",
  iexcl: "¡",
  cent: "¢",
  pound: "£",
  curren: "¤",
  yen: "¥",
  brvbar: "¦",
  sect: "§",
  uml: "¨",
  copy: "©",
  ordf: "ª",
  laquo: "«",
  not: "¬",
  shy: "",
  reg: "®",
  macr: "¯",
  deg: "°",
  plusmn: "±",
  sup2: "²",
  sup3: "³",
  acute: "´",
  micro: "µ",
  para: "¶",
  middot: "·",
  cedil: "¸",
  sup1: "¹",
  ordm: "º",
  raquo: "»",
  frac14: "¼",
  frac12: "½",
  frac34: "¾",
  iquest: "¿",
  times: "×",
  divide: "÷",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  sbquo: "‚",
  ldquo: "“",
  rdquo: "”",
  bdquo: "„",
  dagger: "†",
  Dagger: "‡",
  bull: "•",
  hellip: "…",
  permil: "‰",
  prime: "′",
  Prime: "″",
  lsaquo: "‹",
  rsaquo: "›",
  oline: "‾",
  frasl: "⁄",
  euro: "€",
  trade: "™",
  le: "≤",
  ge: "≥",
  ne: "≠",
  asymp: "≈",
  infin: "∞",
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  pi: "π",
  sigma: "σ",
  omega: "ω",
}

/**
 * Decodes all HTML entities (named, decimal, hex, and double-escaped like &#x27; or &amp;quot;)
 * into clean unicode characters.
 */
export function decodeHtmlEntities(str: string | null | undefined): string {
  if (!str) return ""
  let text = String(str)

  if (!text.includes("&")) return text

  // Up to 2 passes to resolve double-encoded entities (e.g. &amp;#x27;)
  for (let pass = 0; pass < 2; pass++) {
    if (!text.includes("&")) break

    text = text
      // Hexadecimal entities: &#x27; &#x0027;
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
        try {
          return String.fromCodePoint(parseInt(hex, 16))
        } catch {
          return ""
        }
      })
      // Decimal entities: &#39; &#160;
      .replace(/&#(\d+);/g, (_, dec) => {
        try {
          return String.fromCodePoint(parseInt(dec, 10))
        } catch {
          return ""
        }
      })
      // Named entities: &amp; &quot; &apos; &nbsp;
      .replace(/&([a-zA-Z]+);/g, (match, entity) => {
        return NAMED_ENTITIES[entity] ?? match
      })
  }

  // Normalize non-breaking spaces (\u00A0, \u202F, \u2007) and strip zero-width chars (\u200B)
  text = text.replace(/[\u00A0\u202F\u2007]/g, " ").replace(/[\u200B\uFEFF]/g, "")

  return text
}

