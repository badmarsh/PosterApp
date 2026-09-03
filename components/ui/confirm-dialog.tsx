"use client"

import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * Shared confirmation dialog for destructive actions.
 * Keeps wording/layout identical across workspace, output, snapshot and review deletion.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  destructive = true,
  busy = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void | Promise<void>
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o) }}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <div className={destructive ? "flex items-center gap-2 text-destructive mb-1" : "flex items-center gap-2 mb-1"}>
            {destructive && <AlertTriangle className="size-4 shrink-0" />}
            <DialogTitle className={destructive ? "text-destructive" : undefined}>{title}</DialogTitle>
          </div>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="-mx-4 -mb-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={busy} autoFocus>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? "destructive" : "default"} size="sm" onClick={() => void onConfirm()} disabled={busy}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
