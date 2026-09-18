import type { OutputType } from "@/lib/output-types"

export const SKIP_PATTERNS = new Set(["title-slide", "references"])

export const ITEM_UNITS: Record<OutputType, { singular: string; plural: string }> = {
  slides: { singular: "slide", plural: "slides" },
  paper: { singular: "page", plural: "pages" },
  poster: { singular: "card", plural: "cards" },
  "thesis-review": { singular: "section", plural: "sections" },
}

export const ITEM_COUNT_DEFAULTS: Record<OutputType, number> = {
  poster: 9,
  slides: 10,
  paper: 6,
  "thesis-review": 7,
}

/* -------------------------------------------------------------------------
 * Micro-Illustrations for Operations
 * ------------------------------------------------------------------------- */

export function ScaffoldIllustration({ outputType }: { outputType: OutputType }) {
  if (outputType === "slides") {
    return (
      <svg
        viewBox="0 0 56 40"
        className="size-full shrink-0"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect x="14" y="4" width="36" height="22" rx="2.5" className="fill-muted stroke-border/70" strokeWidth="1" />
        <rect x="8" y="9" width="36" height="22" rx="2.5" className="fill-card stroke-border" strokeWidth="1" />
        <rect x="2" y="14" width="36" height="22" rx="2.5" className="fill-background stroke-primary/50" strokeWidth="1.2" />
        <rect x="5" y="17" width="14" height="2" rx="0.5" className="fill-primary" />
        <rect x="5" y="21" width="22" height="1.5" rx="0.5" className="fill-muted-foreground/40" />
        <rect x="5" y="24" width="18" height="1.5" rx="0.5" className="fill-muted-foreground/30" />
        <rect x="5" y="27" width="26" height="1.5" rx="0.5" className="fill-muted-foreground/30" />
        <rect x="5" y="30" width="12" height="1.5" rx="0.5" className="fill-primary/60" />
        <path d="M46 16L47.5 20L51.5 21.5L47.5 23L46 27L44.5 23L40.5 21.5L44.5 20L46 16Z" className="fill-warning" />
      </svg>
    )
  }
  if (outputType === "paper") {
    return (
      <svg
        viewBox="0 0 56 40"
        className="size-full shrink-0"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect x="10" y="3" width="36" height="34" rx="2" className="fill-background stroke-primary/50" strokeWidth="1.2" />
        <rect x="15" y="6" width="26" height="2" rx="0.5" className="fill-primary" />
        <rect x="18" y="10" width="20" height="1.5" rx="0.5" className="fill-muted-foreground/40" />
        <rect x="14" y="14" width="12" height="2" rx="0.5" className="fill-primary/70" />
        <rect x="14" y="18" width="12" height="1.5" rx="0.5" className="fill-muted-foreground/30" />
        <rect x="14" y="21" width="12" height="1.5" rx="0.5" className="fill-muted-foreground/30" />
        <rect x="14" y="24" width="10" height="1.5" rx="0.5" className="fill-muted-foreground/30" />
        <rect x="14" y="27" width="12" height="6" rx="1" className="fill-muted stroke-border" strokeWidth="0.8" />

        <rect x="30" y="14" width="12" height="2" rx="0.5" className="fill-primary/70" />
        <rect x="30" y="18" width="12" height="1.5" rx="0.5" className="fill-muted-foreground/30" />
        <rect x="30" y="21" width="12" height="1.5" rx="0.5" className="fill-muted-foreground/30" />
        <rect x="30" y="24" width="12" height="1.5" rx="0.5" className="fill-muted-foreground/30" />
        <rect x="30" y="27" width="9" height="1.5" rx="0.5" className="fill-muted-foreground/30" />
        <path d="M48 6L49 9L52 10L49 11L48 14L47 11L44 10L47 9L48 6Z" className="fill-warning" />
      </svg>
    )
  }
  return (
    <svg
      viewBox="0 0 56 40"
      className="size-full shrink-0"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="6" y="3" width="44" height="34" rx="2" className="fill-background stroke-primary/50" strokeWidth="1.2" />
      <rect x="8" y="5" width="40" height="5" rx="1" className="fill-primary/20 stroke-primary/40" strokeWidth="0.8" />
      <rect x="10" y="7" width="22" height="1.5" rx="0.5" className="fill-primary" />
      <rect x="8" y="12" width="11" height="9" rx="1" className="fill-muted stroke-border" strokeWidth="0.8" />
      <rect x="8" y="23" width="11" height="12" rx="1" className="fill-muted stroke-border" strokeWidth="0.8" />
      <rect x="22" y="12" width="12" height="14" rx="1" className="fill-muted stroke-border" strokeWidth="0.8" />
      <rect x="22" y="28" width="12" height="7" rx="1" className="fill-muted stroke-border" strokeWidth="0.8" />
      <rect x="37" y="12" width="11" height="11" rx="1" className="fill-muted stroke-border" strokeWidth="0.8" />
      <rect x="37" y="25" width="11" height="10" rx="1" className="fill-muted stroke-border" strokeWidth="0.8" />
      <path d="M49 4L50 7L53 8L50 9L49 12L48 9L45 8L48 7L49 4Z" className="fill-warning" />
    </svg>
  )
}

export function FillEmptyIllustration() {
  return (
    <svg
      viewBox="0 0 56 40"
      className="size-full shrink-0"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="8"
        width="18"
        height="24"
        rx="2"
        className="fill-background stroke-muted-foreground/40"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <rect x="6" y="12" width="10" height="2" rx="0.5" className="fill-muted-foreground/30" />
      <path d="M12 19V25M9 22H15" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-muted-foreground/40" />

      <path
        d="M24 20H30M30 20L27.5 17.5M30 20L27.5 22.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-info"
      />
      <circle cx="27" cy="14" r="1" className="fill-warning" />

      <rect
        x="34"
        y="8"
        width="19"
        height="24"
        rx="2"
        className="fill-card stroke-info/60"
        strokeWidth="1.2"
      />
      <rect x="37" y="11" width="10" height="2" rx="0.5" className="fill-info dark:fill-info" />
      <rect x="37" y="15" width="13" height="1.2" rx="0.5" className="fill-muted-foreground/40" />
      <rect x="37" y="18" width="11" height="1.2" rx="0.5" className="fill-muted-foreground/30" />
      <rect x="37" y="21" width="13" height="6" rx="1" className="fill-info/10 stroke-info/30" strokeWidth="0.8" />
      <circle cx="49" cy="9" r="3.5" className="fill-info text-white" />
      <path d="M47.5 9L48.5 10L50.5 8" stroke="white" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function AiReviewIllustration() {
  return (
    <svg
      viewBox="0 0 56 40"
      className="size-full shrink-0"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="scanBeam" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <rect x="8" y="5" width="40" height="30" rx="2.5" className="fill-card stroke-border" strokeWidth="1" />
      <rect x="12" y="9" width="16" height="2" rx="0.5" className="fill-foreground/60" />
      <rect x="12" y="14" width="32" height="1.5" rx="0.5" className="fill-muted-foreground/30" />
      <rect x="12" y="18" width="24" height="1.5" rx="0.5" className="fill-muted-foreground/30" />
      <rect x="12" y="22" width="28" height="1.5" rx="0.5" className="fill-muted-foreground/30" />

      <path d="M8 12L48 24V32L8 20Z" fill="url(#scanBeam)" />
      <line x1="8" y1="16" x2="48" y2="28" stroke="#10B981" strokeWidth="1" strokeDasharray="3 2" className="opacity-70" />

      <circle cx="39" cy="11" r="4.5" className="fill-success/20 stroke-success" strokeWidth="1" />
      <path d="M37.5 11L38.5 12L40.5 10" stroke="#10B981" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />

      <path d="M46 2L47 5L50 6L47 7L46 10L45 7L42 6L45 5L46 2Z" className="fill-warning" />
    </svg>
  )
}

export function ExportIllustration() {
  return (
    <svg
      viewBox="0 0 56 40"
      className="size-full shrink-0"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M14 6C14 4.89543 14.8954 4 16 4H32L42 14V34C42 35.1046 41.1046 36 40 36H16C14.8954 36 14 35.1046 14 34V6Z"
        className="fill-card stroke-border"
        strokeWidth="1"
      />
      <path d="M32 4V14H42" className="fill-muted stroke-border" strokeWidth="1" />
      <rect x="18" y="12" width="11" height="5" rx="1" className="fill-primary/10 stroke-primary/30" strokeWidth="0.8" />
      <text x="19.2" y="15.8" fontSize="3.2" fontWeight="bold" fill="currentColor" className="text-primary font-mono">
        TEX
      </text>

      <rect x="18" y="20" width="18" height="1.5" rx="0.5" className="fill-muted-foreground/30" />
      <rect x="18" y="23" width="14" height="1.5" rx="0.5" className="fill-muted-foreground/30" />

      <circle cx="36" cy="27" r="7" className="fill-background stroke-border shadow-sm" strokeWidth="1" />
      <path
        d="M36 23V29M36 29L33.5 26.5M36 29L38.5 26.5M32.5 31H39.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary"
      />
    </svg>
  )
}

export function RagSourcesIllustration() {
  return (
    <svg
      viewBox="0 0 56 40"
      className="size-full shrink-0"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="14" y="6" width="22" height="28" rx="2" className="fill-muted stroke-border/70" strokeWidth="1" />
      <rect x="8" y="10" width="22" height="28" rx="2" className="fill-card stroke-border" strokeWidth="1.2" />
      <rect x="12" y="14" width="8" height="2" rx="0.5" className="fill-primary" />
      <rect x="12" y="18" width="14" height="1.5" rx="0.5" className="fill-muted-foreground/40" />
      <rect x="12" y="21" width="12" height="1.5" rx="0.5" className="fill-muted-foreground/30" />
      <rect x="12" y="24" width="14" height="1.5" rx="0.5" className="fill-muted-foreground/30" />

      <circle cx="38" cy="22" r="10" className="fill-background stroke-primary/50" strokeWidth="1.2" />
      <path
        d="M33 17H43L39 22V27L37 28V22L33 17Z"
        className="fill-primary/20 stroke-primary"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path d="M47 8L48 11L51 12L48 13L47 16L46 13L43 12L46 11L47 8Z" className="fill-warning" />
    </svg>
  )
}
