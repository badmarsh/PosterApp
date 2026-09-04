import * as React from "react"

import { cn } from "@/lib/utils"

export interface EmptyStateProps {
  /** Icon rendered in a muted circular chip. */
  icon: React.ElementType
  title: string
  description?: string
  /** Call-to-action (usually a `<Button size="sm">`). */
  action?: React.ReactNode
  /**
   * "center" — fills its container, for whole-pane empty states.
   * "inline" — compact dashed box, for empty lists inside a panel.
   */
  variant?: "center" | "inline"
  /** Tighter sizing for sidebar/dense contexts. */
  compact?: boolean
  className?: string
}

/**
 * Shared empty state (UI polish plan §1.6): icon chip, title, muted
 * description, optional CTA. Every list/view without content must use one.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "center",
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      role="group"
      aria-label={title}
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-1.5" : "gap-3",
        variant === "center"
          ? "px-6 py-10"
          : "rounded-md border border-dashed border-border px-4 py-6",
        compact && variant === "inline" && "px-3 py-3",
        className
      )}
    >
      <div className={cn("rounded-full border border-border bg-muted", compact ? "p-1.5" : "p-3")}>
        <Icon className={cn("text-muted-foreground", compact ? "size-3.5" : "size-5")} aria-hidden="true" />
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <p className={cn("font-medium text-foreground", compact ? "text-[11px]" : "text-sm")}>{title}</p>
        {description && (
          <p className={cn("max-w-[18rem] leading-relaxed text-muted-foreground", compact ? "text-[10px]" : "text-[12px]")}>
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}
