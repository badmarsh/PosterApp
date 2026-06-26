"use client"

import { useState } from "react"
import { ArrowRight, Check, Link2Off } from "lucide-react"
import { useEditor } from "@/components/editor-store"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  SLOT_LABEL,
  slotsForKind,
  type AssignSlot,
  type ExtractedAsset,
} from "@/lib/ingestion"

export function PromotePopover({ asset }: { asset: ExtractedAsset }) {
  const { project, promoteAsset, unassignAsset } = useEditor()
  const slots = slotsForKind(asset.kind)
  const [open, setOpen] = useState(false)
  const [cardId, setCardId] = useState<string>(
    asset.assignedCardId ?? project.cards[0]?.id ?? "",
  )
  const [slot, setSlot] = useState<AssignSlot>(asset.assignedSlot ?? slots[0])

  const assigned = Boolean(asset.assignedCardId)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            size="xs"
            variant={assigned ? "outline" : "default"}
            className="h-6 gap-1 px-1.5 text-[10px]"
          >
            {assigned ? (
              <>
                <Check className="size-3" />
                {asset.assignedCardId}
              </>
            ) : (
              <>
                Use in card
                <ArrowRight className="size-3" />
              </>
            )}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-64">
        <PopoverHeader>
          <PopoverTitle className="text-[12px]">Promote to card slot</PopoverTitle>
        </PopoverHeader>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-muted-foreground">
            Target card
          </label>
          <Select
            value={cardId}
            onValueChange={(v) => setCardId(String(v))}
            items={Object.fromEntries(
              project.cards.map((c) => [c.id, c.title || c.id]),
            )}
          >
            <SelectTrigger size="sm" className="h-7 w-full bg-card text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {project.cards.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-[11px]">
                  {c.title || c.id}
                  <span className="ml-1 font-mono text-[9px] text-muted-foreground">
                    {c.id}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-muted-foreground">
            Slot
          </label>
          <div className="flex flex-wrap gap-1">
            {slots.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSlot(s)}
                className={
                  "rounded border px-1.5 py-1 text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                  (slot === s
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground")
                }
              >
                {SLOT_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-0.5 flex items-center gap-1.5">
          <Button
            size="xs"
            className="h-7 flex-1 gap-1 text-[11px]"
            onClick={() => {
              promoteAsset(asset.id, cardId, slot)
              setOpen(false)
            }}
            disabled={!cardId}
          >
            {assigned ? "Reassign" : "Assign"}
          </Button>
          {assigned && (
            <Button
              size="xs"
              variant="ghost"
              className="h-7 gap-1 text-[11px]"
              onClick={() => {
                unassignAsset(asset.id)
                setOpen(false)
              }}
            >
              <Link2Off className="size-3" />
              Unlink
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
