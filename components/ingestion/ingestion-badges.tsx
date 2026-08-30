import {
  CheckCircle2,
  CircleDashed,
  FileText,
  ImageIcon,
  Loader2,
  Table2,
  XCircle,
  Sigma,
  Quote,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type {
  AssetKind,
  Confidence,
  ParseMethod,
  ParseStatus,
} from "@/lib/ingestion"

export function MethodBadge({ method }: { method: ParseMethod }) {
  const styles: Record<ParseMethod, string> = {
    MinerU: "border-primary/30 bg-primary/10 text-primary",
    Pandoc: "border-chart-3/30 bg-chart-3/10 text-chart-3",
    Auto: "border-border bg-muted text-muted-foreground",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1 py-px font-mono text-[9px] font-medium uppercase tracking-wide",
        styles[method],
      )}
    >
      {method}
    </span>
  )
}

export function ParseStatusBadge({ status }: { status: ParseStatus }) {
  const meta: Record<
    ParseStatus,
    { label: string; className: string; icon: React.ReactNode }
  > = {
    queued: {
      label: "Queued",
      className: "border-border bg-muted text-muted-foreground",
      icon: <CircleDashed className="size-3" />,
    },
    parsing: {
      label: "Parsing",
      className: "border-primary/30 bg-primary/10 text-primary",
      icon: <Loader2 className="size-3 animate-spin" />,
    },
    done: {
      label: "Done",
      className: "border-chart-3/30 bg-chart-3/10 text-chart-3",
      icon: <CheckCircle2 className="size-3" />,
    },
    failed: {
      label: "Failed",
      className: "border-destructive/30 bg-destructive/10 text-destructive",
      icon: <XCircle className="size-3" />,
    },
  }
  const m = meta[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wide",
        m.className,
      )}
    >
      {m.icon}
      {m.label}
    </span>
  )
}

export function ConfidenceMeter({ level }: { level: Confidence }) {
  const filled = level === "high" ? 3 : level === "medium" ? 2 : 1
  const color =
    level === "high"
      ? "bg-chart-3"
      : level === "medium"
        ? "bg-chart-4"
        : "bg-destructive"
  return (
    <span
      className="inline-flex items-center gap-1"
      title={`Extraction confidence: ${level}`}
      aria-label={`Extraction confidence ${level}`}
    >
      <span className="flex items-end gap-px" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              "w-1 rounded-sm",
              i === 0 ? "h-1.5" : i === 1 ? "h-2" : "h-2.5",
              i < filled ? color : "bg-border",
            )}
          />
        ))}
      </span>
      <span className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
        {level}
      </span>
    </span>
  )
}

export function AssetKindIcon({
  kind,
  className,
}: {
  kind: AssetKind | "citation"
  className?: string
}) {
  const base = cn("size-3.5", className)
  if (kind === "text") return <FileText className={base} />
  if (kind === "figure") return <ImageIcon className={base} />
  if (kind === "equation") return <Sigma className={base} />
  if (kind === "citation") return <Quote className={base} />
  return <Table2 className={base} />
}
