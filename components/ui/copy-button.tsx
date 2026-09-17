"use client"

import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type CopyButtonProps = {
  copied: boolean
  onCopy: () => void
  label?: string
  copiedLabel?: string
  size?: "xs" | "sm" | "default" | "icon" | "icon-xs" | "icon-sm"
  variant?: "ghost" | "outline" | "secondary" | "default"
  className?: string
  ariaLabel?: string
}

/**
 * CopyButton — single-source copy affordance so every "copy code / citation"
 * surface matches in height, icon size, transition and Copied! feedback.
 */
export function CopyButton({
  copied,
  onCopy,
  label = "Copy",
  copiedLabel = "Copied!",
  size = "sm",
  variant = "ghost",
  className,
  ariaLabel,
}: CopyButtonProps) {
  return (
    <Button
      size={size as any}
      variant={variant as any}
      onClick={onCopy}
      aria-label={ariaLabel ?? label}
      className={cn(
        "gap-1.5 font-medium transition-colors duration-150",
        copied && "text-success",
        className
      )}
    >
      {copied ? <Check className="size-3.5 shrink-0" aria-hidden="true" /> : <Copy className="size-3.5 shrink-0" aria-hidden="true" />}
      {copied ? copiedLabel : label}
    </Button>
  )
}
