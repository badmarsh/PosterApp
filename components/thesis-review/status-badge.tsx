"use client"

/**
 * StatusBadge — thin wrapper around the shadcn Badge for the thesis-review
 * module's status/severity/rating pills. Takes a pre-resolved className
 * string (from lib/thesis-review/badge-styles.ts) as `variant` so every
 * badge in the module pulls its color from one shared source instead of
 * repeating ternary chains per component.
 */

import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const SIZE_CLASSES = {
  sm: "text-[10px] py-0 px-1 gap-0.5",
  md: "text-[10px] py-0 px-1.5 gap-1",
} as const

interface StatusBadgeProps {
  /** className string from a badge-styles.ts map, e.g. SEVERITY_CLASSES[finding.severity] */
  variant: string
  size?: keyof typeof SIZE_CLASSES
  icon?: ReactNode
  title?: string
  className?: string
  children: ReactNode
}

export function StatusBadge({ variant, size = "sm", icon, title, className, children }: StatusBadgeProps) {
  return (
    <Badge variant="outline" title={title} className={cn(SIZE_CLASSES[size], "font-medium", variant, className)}>
      {icon}
      {children}
    </Badge>
  )
}
