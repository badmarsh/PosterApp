import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  List,
  Table2,
  ImageIcon,
  Images,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { cardType, type BlockPattern, type Card, type ValidationLevel } from "@/lib/poster-types"

export function StatusIcon({
  level,
  className,
}: {
  level: ValidationLevel
  className?: string
}) {
  const base = cn("size-3.5 shrink-0", className)
  switch (level) {
    case "valid":
      return <CheckCircle2 className={cn(base, "text-success")} />
    case "warning":
      return <AlertTriangle className={cn(base, "text-warning")} />
    case "invalid":
      return <XCircle className={cn(base, "text-destructive")} />
    case "generating":
      return <Loader2 className={cn(base, "animate-spin text-primary")} />
  }
}

const STATUS_LABEL: Record<ValidationLevel, string> = {
  valid: "Valid",
  warning: "Warning",
  invalid: "Invalid",
  generating: "Generating",
}

export function StatusBadge({ level }: { level: ValidationLevel }) {
  const styles: Record<ValidationLevel, string> = {
    valid: "border-success/30 bg-success/10 text-success",
    warning: "border-warning/30 bg-warning/10 text-warning",
    invalid: "border-destructive/30 bg-destructive/10 text-destructive",
    generating: "border-primary/30 bg-primary/10 text-primary",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide",
        styles[level],
      )}
    >
      <StatusIcon level={level} className="size-3" />
      {STATUS_LABEL[level]}
    </span>
  )
}

const TYPE_META: Record<
  ReturnType<typeof cardType>,
  { label: string; className: string }
> = {
  bullets: { label: "BULLETS", className: "text-muted-foreground" },
  table: { label: "TABLE", className: "text-muted-foreground" },
  figure: { label: "FIGURE", className: "text-muted-foreground" },
  mixed: { label: "MIXED", className: "text-muted-foreground" },
}

export function CardTypeBadge({ card }: { card: Card }) {
  const meta = TYPE_META[cardType(card)]
  return (
    <span
      className={cn(
        "rounded border border-border bg-muted px-1 py-px font-mono text-[10px] font-medium tracking-wide",
        meta.className,
      )}
    >
      {meta.label}
    </span>
  )
}

export function ContentIndicators({ card }: { card: Card }) {
  const hasBullets = card.pattern !== "image-focused" && card.content.trim().length > 0
  const hasTable = card.pattern === "bullets-table" && card.table.rows.length > 0
  const figs = card.figures.filter((f) => f.url.trim()).length
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      {hasBullets && <List className="size-3" aria-label="bullets" />}
      {hasTable && <Table2 className="size-3" aria-label="table" />}
      {figs === 1 && <ImageIcon className="size-3" aria-label="one image" />}
      {figs >= 2 && <Images className="size-3" aria-label="two images" />}
    </div>
  )
}

export const PATTERN_SHORT: Record<BlockPattern, string> = {
  bullets: "bullets",
  "bullets-image": "bullets+img",
  "bullets-two-images": "bullets+2img",
  "bullets-table": "bullets+table",
  "image-focused": "image",
  references: "refs",
  // Slides
  "title-slide": "title",
  "figure-slide": "figure",
  "two-column": "2-col",
  // Paper
  "section": "section",
  "section-figure": "sec+fig",
  "section-table": "sec+tbl",
  "section-two-figures": "sec+2fig",
}
