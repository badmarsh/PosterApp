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
  className,
}: EmptyStateProps) {
  return (
    <div
      role="group"
      aria-label={title}
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center",
        variant === "center"
          ? "px-6 py-10"
          : "rounded-md border border-dashed border-border px-4 py-6",
        className
      )}
    >
      <div className="rounded-full border border-border bg-muted p-3">
        <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="max-w-[18rem] text-[12px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}
