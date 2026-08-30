"use client"

import { useState, useCallback, memo, useMemo, useEffect } from "react"
import { ChevronDown, ChevronUp, ImageIcon, List, Table2, FileDown, Loader2, ChevronDown as ChevronDownIcon, Plus, GripVertical, Settings2, LayoutTemplate, FileText, Sparkles, RefreshCw, Play, MonitorPlay, BookOpen, PanelTopOpen, GraduationCap, X } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useEditor } from "@/components/editor-store"
import { useShallow } from "zustand/react/shallow"
import { StatusIcon } from "@/components/status"
import { COLUMN_BUDGET, estimateHeight, generateFullTemplate } from "@/lib/latex"
import type { Card, ColumnIndex } from "@/lib/poster-types"
import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api-fetch"
import type { OutputType } from "@/lib/output-types"
import { TemplateHeader } from "@/components/template-header"
import { OUTPUT_TYPE_LABELS, TEMPLATE_REGISTRY, getTemplatesForType } from "@/lib/output-types"
import { ThesisReviewPanel } from "@/components/thesis-review/thesis-review-panel"

// ---------------------------------------------------------------------------
// OutputTypeIcon — maps output type to a small icon
// ---------------------------------------------------------------------------
function OutputTypeIcon({ type, className }: { type: OutputType; className?: string }) {
  if (type === "slides") return <MonitorPlay className={className} />
  if (type === "paper") return <BookOpen className={className} />
  if (type === "thesis-review") return <GraduationCap className={className} />
  return <PanelTopOpen className={className} />
}

// ---------------------------------------------------------------------------
// LayoutDiagram — tiny SVG schematic of a template's spatial structure
// ---------------------------------------------------------------------------
function LayoutDiagram({
  kind,
  color,
}: {
  kind: import("@/lib/output-types").TemplateDef["layoutPreview"]
  color: string
}) {
  const W = 44
  const H = 34
  const accent = color

  // Header bar shared by all layouts
  const headerElem = (
    <rect x={1} y={1} width={W - 2} height={5} rx={1} fill={accent} opacity={0.85} />
  )

  switch (kind) {
    case "poster-3col":
      return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0" aria-hidden>
          <rect x={0} y={0} width={W} height={H} rx={2} fill="currentColor" className="text-muted/50" />
          {headerElem}
          {[0, 1, 2].map((i) => {
            const colW = (W - 8) / 3
            const x = 2 + i * (colW + 2)
            return (
              <g key={i}>
                <rect x={x} y={8} width={colW} height={4} rx={0.5} fill={accent} opacity={0.35} />
                <rect x={x} y={13} width={colW} height={3} rx={0.5} fill="currentColor" className="text-muted-foreground/30" />
                <rect x={x} y={17} width={colW * 0.8} height={3} rx={0.5} fill="currentColor" className="text-muted-foreground/20" />
                <rect x={x} y={21} width={colW} height={4} rx={0.5} fill={accent} opacity={0.2} />
                <rect x={x} y={26} width={colW} height={5} rx={0.5} fill="currentColor" className="text-muted-foreground/15" />
              </g>
            )
          })}
        </svg>
      )
    case "slides-wide":
      return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0" aria-hidden>
          <rect x={0} y={0} width={W} height={H} rx={2} fill="currentColor" className="text-muted/50" />
          {/* Top title slide frame */}
          <rect x={2} y={2} width={W - 4} height={12} rx={1} fill={accent} opacity={0.85} />
          <rect x={5} y={5} width={18} height={2} rx={0.5} fill="white" opacity={0.95} />
          <rect x={5} y={8} width={12} height={1.5} rx={0.5} fill="white" opacity={0.65} />
          {/* Bottom content slide frame with progress bar */}
          <rect x={2} y={16} width={W - 4} height={15} rx={1} fill="currentColor" className="text-muted-foreground/15" />
          <rect x={4} y={18} width={14} height={2} rx={0.5} fill={accent} opacity={0.7} />
          <rect x={4} y={22} width={16} height={1.5} rx={0.5} fill="currentColor" className="text-muted-foreground/35" />
          <rect x={4} y={25} width={12} height={1.5} rx={0.5} fill="currentColor" className="text-muted-foreground/25" />
          <rect x={23} y={20} width={15} height={7} rx={0.5} fill={accent} opacity={0.25} />
          {/* Slide footer progress bar */}
          <rect x={2} y={30} width={W - 4} height={1} fill={accent} opacity={0.4} />
          <rect x={30} y={30} width={8} height={1} fill={accent} opacity={0.9} />
        </svg>
      )
    case "paper-twocol":
      return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0" aria-hidden>
          <rect x={0} y={0} width={W} height={H} rx={2} fill="currentColor" className="text-muted/50" />
          {/* Full-width Title & Author header */}
          <rect x={2} y={2} width={W - 4} height={4} rx={0.5} fill={accent} opacity={0.8} />
          <rect x={4} y={3} width={16} height={2} rx={0.5} fill="white" opacity={0.9} />
          {/* Left col */}
          <rect x={2} y={8} width={18} height={23} rx={0.5} fill="currentColor" className="text-muted-foreground/10" />
          <rect x={4} y={10} width={12} height={1.5} rx={0.5} fill={accent} opacity={0.6} />
          <rect x={4} y={13} width={14} height={1} rx={0.5} fill="currentColor" className="text-muted-foreground/30" />
          <rect x={4} y={15} width={12} height={1} rx={0.5} fill="currentColor" className="text-muted-foreground/25" />
          <rect x={4} y={17.5} width={14} height={6} rx={0.5} fill={accent} opacity={0.25} />
          <rect x={4} y={25} width={14} height={1} rx={0.5} fill="currentColor" className="text-muted-foreground/25" />
          <rect x={4} y={27} width={10} height={1} rx={0.5} fill="currentColor" className="text-muted-foreground/20" />
          {/* Right col */}
          <rect x={23} y={8} width={19} height={23} rx={0.5} fill="currentColor" className="text-muted-foreground/10" />
          <rect x={25} y={10} width={14} height={1.5} rx={0.5} fill={accent} opacity={0.6} />
          <rect x={25} y={13} width={15} height={1} rx={0.5} fill="currentColor" className="text-muted-foreground/30" />
          <rect x={25} y={15} width={13} height={1} rx={0.5} fill="currentColor" className="text-muted-foreground/25" />
          <rect x={25} y={17.5} width={15} height={1} rx={0.5} fill="currentColor" className="text-muted-foreground/25" />
          <rect x={25} y={20} width={12} height={1} rx={0.5} fill="currentColor" className="text-muted-foreground/20" />
          <rect x={25} y={23} width={15} height={1} rx={0.5} fill="currentColor" className="text-muted-foreground/25" />
          <rect x={25} y={26} width={14} height={1} rx={0.5} fill="currentColor" className="text-muted-foreground/20" />
        </svg>
      )
    case "paper-single":
      return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0" aria-hidden>
          <rect x={0} y={0} width={W} height={H} rx={2} fill="currentColor" className="text-muted/50" />
          {/* Centered Title */}
          <rect x={6} y={2} width={W - 12} height={4} rx={0.5} fill={accent} opacity={0.8} />
          <rect x={10} y={3} width={16} height={2} rx={0.5} fill="white" opacity={0.9} />
          {/* Abstract block */}
          <rect x={5} y={8} width={W - 10} height={4} rx={0.5} fill={accent} opacity={0.15} />
          <rect x={7} y={9.5} width={W - 14} height={1} rx={0.5} fill={accent} opacity={0.6} />
          {/* Single flowing column prose */}
          <rect x={5} y={14} width={16} height={1.5} rx={0.5} fill={accent} opacity={0.6} />
          <rect x={5} y={17} width={W - 10} height={1} rx={0.5} fill="currentColor" className="text-muted-foreground/30" />
          <rect x={5} y={19} width={W - 12} height={1} rx={0.5} fill="currentColor" className="text-muted-foreground/25" />
          {/* Centered figure float */}
          <rect x={10} y={21.5} width={W - 20} height={6.5} rx={0.5} fill={accent} opacity={0.25} />
          {/* Caption */}
          <rect x={8} y={29.5} width={W - 16} height={1} rx={0.5} fill="currentColor" className="text-muted-foreground/25" />
        </svg>
      )
    default:
      return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0" aria-hidden>
          <rect x={0} y={0} width={W} height={H} rx={2} fill="currentColor" className="text-muted/50" />
          <rect x={5} y={2} width={34} height={3} rx={0.5} fill={accent} opacity={0.7} />
          <rect x={3} y={7} width={38} height={1} rx={0.5} fill="currentColor" className="text-muted-foreground/30" />
          <rect x={3} y={9} width={36} height={1} rx={0.5} fill="currentColor" className="text-muted-foreground/25" />
          <rect x={3} y={11} width={38} height={1} rx={0.5} fill="currentColor" className="text-muted-foreground/20" />
          <rect x={3} y={15} width={28} height={2} rx={0.5} fill={accent} opacity={0.4} />
          <rect x={3} y={19} width={38} height={1} rx={0.5} fill="currentColor" className="text-muted-foreground/25" />
          <rect x={3} y={21} width={32} height={1} rx={0.5} fill="currentColor" className="text-muted-foreground/20" />
        </svg>
      )
  }
}

// ---------------------------------------------------------------------------
// AddOutputDialog — pick type + template, then create
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// LargeLayoutDiagram — larger, richer version for the detail panel
// ---------------------------------------------------------------------------
function LargeLayoutDiagram({
  kind,
  colors,
}: {
  kind: import("@/lib/output-types").TemplateDef["layoutPreview"]
  colors: import("@/lib/output-types").TemplateDef["colors"]
}) {
  const W = 320
  const H = 190
  const accent = colors[0]?.hex ?? "#2563EB"
  const accent2 = colors[1]?.hex ?? accent
  const bg = "currentColor"

  switch (kind) {
    case "poster-3col":
      return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden className="w-full max-w-[340px] h-auto drop-shadow-sm rounded">
          {/* Background */}
          <rect x={0} y={0} width={W} height={H} rx={6} fill={bg} className="text-muted/40" />
          {/* Header bar with title and logo badges */}
          <rect x={0} y={0} width={W} height={34} rx={6} fill={accent} opacity={0.92} />
          <rect x={0} y={26} width={W} height={8} fill={accent} opacity={0.92} />
          {/* Left institutional badge */}
          <rect x={10} y={9} width={16} height={16} rx={3} fill="white" opacity={0.85} />
          {/* Title & subtitle */}
          <rect x={32} y={9} width={120} height={8} rx={1.5} fill="white" opacity={0.95} />
          <rect x={32} y={20} width={80} height={4} rx={1} fill="white" opacity={0.6} />
          {/* Right institutional badge */}
          <rect x={W - 26} y={9} width={16} height={16} rx={3} fill="white" opacity={0.85} />

          {/* 3 columns */}
          {[0, 1, 2].map(i => {
            const colW = (W - 24) / 3
            const x = 6 + i * (colW + 6)
            return (
              <g key={i}>
                {/* Block 1 */}
                <rect x={x} y={40} width={colW} height={18} rx={3} fill={accent} opacity={0.28} />
                <rect x={x+4} y={44} width={colW * 0.7} height={4} rx={1} fill={accent} opacity={0.8} />
                <rect x={x+4} y={51} width={colW - 8} height={3} rx={0.5} fill={bg} className="text-muted-foreground/40" />
                {/* Block 2 */}
                <rect x={x} y={63} width={colW} height={44} rx={3} fill={accent} opacity={0.12} />
                <rect x={x+4} y={67} width={colW * 0.6} height={4} rx={1} fill={accent} opacity={0.6} />
                <rect x={x+4} y={74} width={colW - 8} height={3} rx={0.5} fill={bg} className="text-muted-foreground/35" />
                <rect x={x+4} y={80} width={colW - 16} height={3} rx={0.5} fill={bg} className="text-muted-foreground/30" />
                <rect x={x+4} y={86} width={colW - 8} height={3} rx={0.5} fill={bg} className="text-muted-foreground/30" />
                <rect x={x+4} y={92} width={colW - 12} height={3} rx={0.5} fill={bg} className="text-muted-foreground/25" />
                <rect x={x+4} y={98} width={colW - 18} height={3} rx={0.5} fill={bg} className="text-muted-foreground/20" />
                {/* Block 3 */}
                <rect x={x} y={112} width={colW} height={34} rx={3} fill={accent} opacity={0.12} />
                <rect x={x+4} y={116} width={colW * 0.5} height={4} rx={1} fill={accent} opacity={0.5} />
                <rect x={x+4} y={123} width={colW - 8} height={3} rx={0.5} fill={bg} className="text-muted-foreground/30" />
                <rect x={x+4} y={129} width={colW - 12} height={3} rx={0.5} fill={bg} className="text-muted-foreground/25" />
                {/* Image placeholder on middle col */}
                {i === 1 && <rect x={x+4} y={150} width={colW - 8} height={32} rx={3} fill={accent2} opacity={0.22} />}
                {i === 1 && <rect x={x + colW/2 - 10} y={161} width={20} height={11} rx={1.5} fill={accent2} opacity={0.4} />}
              </g>
            )
          })}
          {/* References bottom label in 3rd col */}
          <rect x={6 + 2*(((W-24)/3)+6)} y={150} width={(W-24)/3} height={24} rx={3} fill={accent} opacity={0.25} />
          <rect x={6 + 2*(((W-24)/3)+6)+4} y={155} width={45} height={4} rx={1} fill={accent} opacity={0.7} />
          <rect x={6 + 2*(((W-24)/3)+6)+4} y={162} width={65} height={3} rx={0.5} fill={bg} className="text-muted-foreground/30" />
        </svg>
      )
    case "slides-wide":
      return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden className="w-full max-w-[340px] h-auto drop-shadow-sm rounded">
          <rect x={0} y={0} width={W} height={H} rx={6} fill={bg} className="text-muted/40" />
          {/* Slide 1 - title slide (16:9 Beamer frame) */}
          <rect x={6} y={6} width={W - 12} height={52} rx={4} fill={accent} opacity={0.9} />
          <rect x={20} y={16} width={130} height={9} rx={1.5} fill="white" opacity={0.95} />
          <rect x={20} y={30} width={85} height={5} rx={1} fill="white" opacity={0.65} />
          <rect x={20} y={40} width={50} height={4} rx={1} fill="white" opacity={0.45} />
          {/* Slide 2 - bullet content */}
          <rect x={6} y={64} width={W - 12} height={56} rx={4} fill={accent} opacity={0.08} />
          <rect x={16} y={70} width={80} height={6} rx={1.5} fill={accent} opacity={0.75} />
          <rect x={16} y={82} width={W - 36} height={3.5} rx={0.5} fill={bg} className="text-muted-foreground/40" />
          <rect x={16} y={88} width={W - 50} height={3.5} rx={0.5} fill={bg} className="text-muted-foreground/35" />
          <rect x={16} y={94} width={W - 40} height={3.5} rx={0.5} fill={bg} className="text-muted-foreground/30" />
          <rect x={16} y={100} width={W - 60} height={3.5} rx={0.5} fill={bg} className="text-muted-foreground/25" />
          {/* Slide 3 - two-col split */}
          <rect x={6} y={126} width={W - 12} height={56} rx={4} fill={accent} opacity={0.08} />
          <rect x={16} y={132} width={75} height={6} rx={1.5} fill={accent} opacity={0.7} />
          <rect x={16} y={144} width={(W-44)/2} height={3} rx={0.5} fill={bg} className="text-muted-foreground/35" />
          <rect x={16} y={150} width={(W-44)/2 - 10} height={3} rx={0.5} fill={bg} className="text-muted-foreground/30" />
          <rect x={16} y={156} width={(W-44)/2 - 5} height={3} rx={0.5} fill={bg} className="text-muted-foreground/25" />
          <rect x={W/2 + 4} y={132} width={(W-44)/2} height={42} rx={3} fill={accent2} opacity={0.22} />
          <rect x={W/2 + (W-44)/4 - 6} y={148} width={20} height={12} rx={1.5} fill={accent2} opacity={0.4} />
          {/* Slide progress footer bar (Metropolis/Madrid style) */}
          <rect x={6} y={116} width={W - 12} height={4} rx={1} fill={accent} opacity={0.2} />
          <rect x={W - 50} y={117} width={38} height={2} rx={0.5} fill={accent} opacity={0.8} />
        </svg>
      )
    case "paper-twocol": {
      const midX = W / 2
      return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden className="w-full max-w-[340px] h-auto drop-shadow-sm rounded">
          <rect x={0} y={0} width={W} height={H} rx={6} fill={bg} className="text-muted/40" />
          {/* Title block across full width */}
          <rect x={6} y={6} width={W - 12} height={30} rx={3} fill={accent} opacity={0.8} />
          <rect x={14} y={12} width={140} height={7} rx={1} fill="white" opacity={0.95} />
          <rect x={14} y={23} width={95} height={4} rx={1} fill="white" opacity={0.65} />
          {/* Left col */}
          <rect x={6} y={42} width={midX - 10} height={6} rx={1} fill={accent} opacity={0.6} />
          {[51, 58, 65, 72, 79, 86, 93, 100].map(y => (
            <rect key={y} x={6} y={y} width={midX - 10 - (y % 14 === 0 ? 15 : 0)} height={3} rx={0.5} fill={bg} className="text-muted-foreground/35" />
          ))}
          {/* Figure float in left column */}
          <rect x={6} y={108} width={midX - 10} height={32} rx={3} fill={accent2} opacity={0.22} />
          <rect x={6 + (midX-10)/2 - 12} y={118} width={24} height={12} rx={1.5} fill={accent2} opacity={0.4} />
          <rect x={6} y={144} width={midX - 10} height={3} rx={0.5} fill={bg} className="text-muted-foreground/30" />
          <rect x={6} y={150} width={midX - 25} height={3} rx={0.5} fill={bg} className="text-muted-foreground/25" />
          {/* Right col */}
          <rect x={midX + 4} y={42} width={midX - 10} height={6} rx={1} fill={accent} opacity={0.6} />
          {[51, 58, 65, 72, 79, 86, 93, 100, 107, 114, 121, 128, 135, 142, 149].map(y => (
            <rect key={y} x={midX + 4} y={y} width={midX - 10 - (y % 11 === 0 ? 18 : 0)} height={3} rx={0.5} fill={bg} className="text-muted-foreground/35" />
          ))}
          {/* Bibliography bottom */}
          <rect x={6} y={160} width={W - 12} height={6} rx={1} fill={accent} opacity={0.3} />
          <rect x={6} y={170} width={W - 12} height={3} rx={0.5} fill={bg} className="text-muted-foreground/30" />
          <rect x={6} y={176} width={W - 40} height={3} rx={0.5} fill={bg} className="text-muted-foreground/25" />
        </svg>
      )
    }
    case "paper-single":
      return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden className="w-full max-w-[340px] h-auto drop-shadow-sm rounded">
          <rect x={0} y={0} width={W} height={H} rx={6} fill={bg} className="text-muted/40" />
          {/* Title */}
          <rect x={24} y={6} width={W - 48} height={26} rx={3} fill={accent} opacity={0.8} />
          <rect x={36} y={12} width={130} height={7} rx={1} fill="white" opacity={0.95} />
          <rect x={36} y={22} width={85} height={4} rx={1} fill="white" opacity={0.65} />
          {/* Abstract heading */}
          <rect x={24} y={38} width={55} height={5} rx={1} fill={accent} opacity={0.65} />
          {[47, 54, 61, 68].map(y => (
            <rect key={y} x={24} y={y} width={W - 48 - (y % 12 === 0 ? 20 : 0)} height={3} rx={0.5} fill={bg} className="text-muted-foreground/35" />
          ))}
          {/* Section 1 */}
          <rect x={24} y={80} width={80} height={5} rx={1} fill={accent} opacity={0.65} />
          {[89, 96, 103, 110, 117].map(y => (
            <rect key={y} x={24} y={y} width={W - 48 - (y % 10 === 0 ? 25 : 0)} height={3} rx={0.5} fill={bg} className="text-muted-foreground/35" />
          ))}
          {/* Centered Figure with LaTeX \\caption */}
          <rect x={50} y={128} width={W - 100} height={34} rx={3} fill={accent2} opacity={0.22} />
          <rect x={W/2 - 16} y={138} width={32} height={14} rx={1.5} fill={accent2} opacity={0.4} />
          <rect x={60} y={166} width={W - 120} height={3} rx={0.5} fill={bg} className="text-muted-foreground/30" />
          <rect x={75} y={172} width={W - 150} height={3} rx={0.5} fill={bg} className="text-muted-foreground/25" />
        </svg>
      )
    default:
      return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden className="w-full max-w-[340px] h-auto drop-shadow-sm rounded">
          <rect x={0} y={0} width={W} height={H} rx={6} fill={bg} className="text-muted/40" />
          <rect x={6} y={6} width={W - 12} height={24} rx={3} fill={accent} opacity={0.75} />
          <rect x={16} y={14} width={100} height={6} rx={1} fill="white" opacity={0.85} />
        </svg>
      )
  }
}

function AddOutputDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addOutput = useEditor((s) => s.addOutput)
  const [selectedType, setSelectedType] = useState<OutputType>("slides")
  const templates = getTemplatesForType(selectedType)
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]?.id ?? "")

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedType("slides")
      const ts = getTemplatesForType("slides")
      setSelectedTemplate(ts[0]?.id ?? "")
    }
  }, [open])

  const handleTypeChange = (t: OutputType) => {
    setSelectedType(t)
    const ts = getTemplatesForType(t)
    setSelectedTemplate(ts[0]?.id ?? "")
  }

  const handleCreate = () => {
    addOutput(selectedType, selectedTemplate)
    onClose()
  }

  const activeTmpl = templates.find(t => t.id === selectedTemplate) ?? templates[0]

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent showCloseButton={false} className="w-[92vw] max-w-4xl sm:max-w-4xl p-0 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border shrink-0 bg-card">
          <div>
            <DialogTitle className="text-base font-semibold">Add Output</DialogTitle>
            <DialogDescription className="text-[12px] text-muted-foreground mt-0.5">
              Choose a format and template for this workspace.
            </DialogDescription>
          </div>
          {/* Output type pills */}
          <div className="flex gap-2">
            {(["poster", "slides", "paper", "thesis-review"] as OutputType[]).map((t) => (
              <button
                key={t}
                onClick={() => handleTypeChange(t)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3.5 py-1.5 text-[12px] font-medium transition-all",
                  selectedType === t
                    ? "border-primary bg-primary/10 text-primary shadow-xs"
                    : "border-border text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground",
                )}
              >
                <OutputTypeIcon type={t} className="size-4" />
                {OUTPUT_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Body: left list + right detail panel */}
        <div className="flex min-h-0" style={{ height: "620px" }}>
          {/* Left: template list */}
          <div className="flex flex-col gap-1 overflow-y-auto p-3.5 border-r border-border shrink-0 bg-muted/10" style={{ width: "270px" }}>
            <p className="px-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Select Template ({templates.length})
            </p>
            {templates.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => setSelectedTemplate(tmpl.id)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-2.5 text-left transition-all",
                  selectedTemplate === tmpl.id
                    ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/20"
                    : "border-transparent hover:border-border hover:bg-muted/40",
                )}
              >
                <LayoutDiagram kind={tmpl.layoutPreview} color={tmpl.colors[0]?.hex ?? "#2563EB"} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={cn("text-[12px] font-semibold truncate", selectedTemplate === tmpl.id ? "text-primary font-bold" : "")}>
                      {tmpl.label}
                    </span>
                    {tmpl.category === "institutional" && (
                      <span className="rounded bg-amber-100 px-1 py-px text-[8px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 shrink-0">
                        ATLAS
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 items-center mt-0.5">
                    {tmpl.colors.slice(0, 4).map((c) => (
                      <span key={c.id} className="inline-block size-2.5 rounded-full border border-black/10 dark:border-white/10" style={{ backgroundColor: c.hex }} title={c.name} />
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Right: detail panel */}
          {activeTmpl && (
            <div className="flex flex-1 flex-col min-h-0 overflow-y-auto bg-card">
              {/* Large layout preview sample */}
              <div className="shrink-0 bg-muted/20 border-b border-border p-5 flex items-center justify-center">
                <LargeLayoutDiagram kind={activeTmpl.layoutPreview} colors={activeTmpl.colors} />
              </div>

              {/* Detail content */}
              <div className="flex flex-1 flex-col gap-4 p-5">
                {/* Title + badges */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-base font-bold">{activeTmpl.label}</span>
                    {activeTmpl.category === "institutional" && (
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                        Institutional
                      </span>
                    )}
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground border border-border">
                      {activeTmpl.latexClass}
                    </span>
                  </div>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">
                    {activeTmpl.description}
                  </p>
                </div>

                {/* Feature bullets */}
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Key Features &amp; Layout
                  </p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeTmpl.detailFeatures.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12px] text-foreground/90 bg-muted/30 p-2 rounded-md border border-border/50">
                        <span className="mt-1 shrink-0 size-2 rounded-full" style={{ backgroundColor: activeTmpl.colors[0]?.hex ?? "#2563EB" }} />
                        <span className="leading-snug">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Technical info row */}
                <div className="flex flex-wrap items-center gap-6 pt-3 border-t border-border mt-auto">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">LaTeX class</span>
                    <code className="text-[11px] font-mono text-foreground font-medium">{activeTmpl.latexClass}</code>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Theme system</span>
                    <code className="text-[11px] font-mono text-foreground font-medium">{activeTmpl.colorSystem}</code>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Palette</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      {activeTmpl.colors.map((c) => (
                        <span key={c.id} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className="inline-block size-3 rounded-full border border-black/10 dark:border-white/10" style={{ backgroundColor: c.hex }} />
                          {c.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-3.5 shrink-0 bg-muted/20">
          <p className="text-[11px] text-muted-foreground">
            You can change theme settings or switch templates anytime in Header Settings.
          </p>
          <button
            onClick={handleCreate}
            className="rounded-lg bg-primary px-6 py-2 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-xs"
          >
            Create Output
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// OutputTabBar — row of output tabs + add button
// ---------------------------------------------------------------------------
function OutputTabBar() {
  const { project, switchOutput, deleteOutput } = useEditor(
    useShallow((s) => ({ project: s.project, switchOutput: s.switchOutput, deleteOutput: s.deleteOutput }))
  )
  const [addOpen, setAddOpen] = useState(false)
  const outputs = project.outputs ?? []

  return (
    <>
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border bg-muted/30 px-2 py-1 shrink-0">
        {outputs.map((o) => {
          const isActive = o.id === project.activeOutputId
          return (
            <div key={o.id} className="relative group flex items-center">
              <button
                onClick={() => switchOutput(o.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors pr-6",
                  isActive
                    ? "bg-background border border-border shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/60",
                )}
              >
                <OutputTypeIcon type={o.outputType as OutputType} className="size-3" />
                {OUTPUT_TYPE_LABELS[o.outputType as OutputType]}
              </button>
              {outputs.length > 1 && !isActive && (
                <button
                  onClick={() => deleteOutput(o.id)}
                  className="absolute right-1 opacity-0 group-hover:opacity-100 p-0.5 rounded-sm hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                  aria-label="Delete output"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          )
        })}
        <button
          onClick={() => setAddOpen(true)}
          className="ml-1 flex items-center gap-1 rounded px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors"
          aria-label="Add output"
        >
          <Plus className="size-3" />
          Add
        </button>
      </div>
      <AddOutputDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}

function summarize(card: Card): string {
  if (card.pattern === "image-focused") {
    return card.figures[0]?.caption || "Figure-dominant block"
  }
  const first = card.content.split("\n").find((b) => b.trim())
  return first || "No content yet"
}

const MiniBlock = memo(function MiniBlock({ card, overlay }: { card: Card, overlay?: boolean }) {
  const { selectedCardId, selectCard, getStatus, project, deleteCard, validateCardAction, autoFillCardAction, generateLatexForCardAction, setInspectorTab, setPendingAiPrompt } =
    useEditor(
      useShallow((s) => ({
        selectedCardId: s.selectedCardId,
        selectCard: s.selectCard,
        getStatus: s.getStatus,
        project: s.project,
        deleteCard: s.deleteCard,
        validateCardAction: s.validateCardAction,
        autoFillCardAction: s.autoFillCardAction,
        generateLatexForCardAction: s.generateLatexForCardAction,
        setInspectorTab: s.setInspectorTab,
        setPendingAiPrompt: s.setPendingAiPrompt,
      }))
    )
  const active = card.id === selectedCardId
  const status = getStatus(card)
  const height = estimateHeight(card)
  const pct = Math.min(100, Math.round((height / COLUMN_BUDGET) * 100))
  const figs = card.figures.filter((f) => f.url.trim()).length
  const hasBullets =
    card.pattern !== "image-focused" && card.content.trim().length > 0
  const hasTable = card.pattern === "bullets-table" && card.table?.rows?.length > 0

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const colCards = useMemo(
    () => {
      const activeCards = project.outputs?.find(o => o.id === project.activeOutputId)?.cards ?? []
      return activeCards
        .filter((c) => c.column === card.column)
        .sort((a, b) => a.order - b.order)
    },
    [project.outputs, project.activeOutputId, card.column]
  )
  const idx = colCards.findIndex((c) => c.id === card.id)

  const handleAreaClick = useCallback((e: React.MouseEvent, tab: import("@/components/store/types").InspectorTab) => {
    e.stopPropagation()
    selectCard(card.id)
    setInspectorTab(tab)
  }, [card.id, selectCard, setInspectorTab])

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div
            role="button"
            tabIndex={0}
            aria-current={active ? "true" : undefined}
            aria-label={`Edit card ${card.title || "Untitled"}`}
            onClick={() => selectCard(card.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                selectCard(card.id)
              }
            }}
            ref={setNodeRef}
            style={style}
            className={cn(
              "group relative rounded-md border bg-card p-2 text-left shadow-sm transition-all hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-primary ring-1 ring-primary"
                : status === "invalid"
                  ? "border-destructive/50"
                  : "border-border hover:border-muted-foreground/40",
              overlay && "shadow-xl border-primary/50 cursor-grabbing rotate-2 scale-105"
            )}
          >
            {/* Drag Handle Overlay to capture drags anywhere on the card */}
            <div 
              className={cn("absolute inset-0 z-10", overlay ? "cursor-grabbing" : "cursor-grab")}
              {...attributes}
              {...listeners}
            />
            
            {/* Make content relative so it sits above the absolute drag layer if we want to click specific things */}
            <div className="relative z-20 pointer-events-none">
            <div
              aria-hidden
              className={cn(
                "absolute inset-y-1.5 left-0 w-0.5 rounded-full",
                status === "invalid"
                  ? "bg-destructive"
                  : status === "warning"
                    ? "bg-chart-4"
                    : status === "generating"
                      ? "bg-primary"
                      : "bg-chart-3",
              )}
            />
            <div className="flex items-start justify-between gap-1.5 pl-1.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <StatusIcon level={status} className="size-3" />
                <span className="truncate text-[12px] font-semibold leading-tight">
                  {card.title || "Untitled"}
                </span>
              </div>
              <div className="flex shrink-0 flex-col opacity-0 transition-opacity group-hover:opacity-100">
                <GripVertical className="size-4 text-muted-foreground" />
              </div>
            </div>

            <p 
              className="mt-1 line-clamp-4 pl-1.5 text-[11px] leading-relaxed text-muted-foreground pointer-events-auto cursor-pointer hover:bg-muted/50 rounded transition-colors"
              onClick={(e) => handleAreaClick(e, "content")}
            >
              {summarize(card)}
            </p>

            {(card.pattern === "bullets-image" ||
              card.pattern === "bullets-two-images" ||
              card.pattern === "image-focused") && (
              <div className="mt-1.5 flex gap-1 pl-1.5">
                {Array.from({ length: card.pattern === "bullets-two-images" ? 2 : 1 }).map(
                  (_, i) => (
                    <div
                      key={i}
                      className="flex h-8 flex-1 items-center justify-center rounded border border-dashed border-border bg-muted/60 pointer-events-auto cursor-pointer hover:bg-muted transition-colors"
                      onClick={(e) => handleAreaClick(e, "figures")}
                    >
                      <ImageIcon className="size-3 text-muted-foreground" />
                    </div>
                  ),
                )}
              </div>
            )}

            {card.pattern === "bullets-table" && (
              <div className="mt-1.5 flex gap-1 pl-1.5">
                <div
                  className="flex h-8 flex-1 items-center justify-center rounded border border-dashed border-border bg-muted/60 pointer-events-auto cursor-pointer hover:bg-muted transition-colors"
                  onClick={(e) => handleAreaClick(e, "table")}
                >
                  <Table2 className="size-3 text-muted-foreground" />
                </div>
              </div>
            )}

            <div className="mt-1.5 flex items-center justify-between gap-2 pl-1.5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                {hasBullets && <List className="size-3" />}
                {hasTable && <Table2 className="size-3" />}
                {figs > 0 && (
                  <span className="flex items-center gap-0.5">
                    <ImageIcon className="size-3" />
                    <span className="font-mono text-[9px]">{figs}</span>
                  </span>
                )}
              </div>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <div className="flex items-center gap-1">
                      <div className="h-1 w-10 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            pct > 100
                              ? "bg-destructive"
                              : pct > 85
                                ? "bg-chart-4"
                                : "bg-chart-3",
                          )}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <span className="font-mono text-[9px] text-muted-foreground">
                        {height}u
                      </span>
                    </div>
                  }
                />
                <TooltipContent>
                  Estimated height {height}u / {COLUMN_BUDGET}u budget
                </TooltipContent>
              </Tooltip>
            </div>
            </div>
          </div>
        }
      />
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => selectCard(card.id)}>
          Edit Card
        </ContextMenuItem>
        <ContextMenuItem onClick={() => autoFillCardAction(card.id)}>
          AI Auto-fill
        </ContextMenuItem>
        <ContextMenuItem onClick={() => validateCardAction(card.id)}>
          Validate with AI
        </ContextMenuItem>
        <ContextMenuItem onClick={() => generateLatexForCardAction(card.id)}>
          Re-compile LaTeX
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem 
          onClick={() => setPendingAiPrompt("Please fix the errors in this card.")}
          className="gap-2"
        >
          <Sparkles className="size-4" />
          <span>Fix errors with AI</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem 
          variant="destructive"
          onClick={(e) => {
            e.stopPropagation()
            deleteCard(card.id)
          }}
        >
          Delete Card
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
})

// ---------------------------------------------------------------------------
// PosterColumn — 3-column poster layout column
// ---------------------------------------------------------------------------
function PosterColumn({ column }: { column: ColumnIndex }) {
  const { project, addCard } = useEditor(
    useShallow((s) => ({
      project: s.project,
      addCard: s.addCard,
    }))
  )
  const cards = (project.outputs?.find(o => o.id === project.activeOutputId)?.cards ?? [])
    .filter((c) => c.column === column)
    .sort((a, b) => a.order - b.order)
  const total = cards.reduce((s, c) => s + estimateHeight(c), 0)
  const pct = Math.round((total / COLUMN_BUDGET) * 100)

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="mb-1.5 flex items-center justify-between border-b border-dashed border-border pb-1">
        <span className="font-mono text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Col {column}
        </span>
        <span
          className={cn(
            "font-mono text-[10px]",
            pct > 100 ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {pct}% fill
        </span>
      </div>
      <div className="flex flex-col gap-2 min-h-[100px] rounded-md p-1 -mx-1">
        <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {cards.length ? (
            cards.map((c) => <MiniBlock key={c.id} card={c} />)
          ) : (
            <div className="rounded-md border border-dashed border-border px-2 py-6 text-center text-[10px] leading-snug text-muted-foreground">
              Drop cards here
            </div>
          )}
        </SortableContext>
        <button
          onClick={() => addCard(column)}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/50 hover:text-primary mt-1"
        >
          <Plus className="size-3.5" />
          Add Card
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PosterSkeleton
// ---------------------------------------------------------------------------
function PosterSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-5xl p-5"
      role="status"
      aria-label="Loading poster preview"
    >
      <div className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
        <div className="flex flex-col items-center gap-1.5 border-b-2 border-primary/30 bg-muted/40 px-4 py-4">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-2 w-1/3" />
        </div>
        <div className="flex gap-3 p-3">
          {Array.from({ length: 3 }).map((_, c) => (
            <div key={c} className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-2 w-10" />
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading poster preview…</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// StructureView (poster 3-column DnD, poster-only)
// ---------------------------------------------------------------------------
function PosterStructureView() {
  const { project, isSwitchingProject, moveCard } = useEditor(
    useShallow((s) => ({
      project: s.project,
      isSwitchingProject: s.isSwitchingProject,
      moveCard: s.moveCard,
    }))
  )
  
  const [activeId, setActiveId] = useState<string | null>(null)
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return
    
    const activeId = active.id as string
    const overId = over.id as string
    
    if (activeId === overId) return
    
    const activeCard = (project.outputs?.find(o => o.id === project.activeOutputId)?.cards ?? []).find(c => c.id === activeId)
    const overCard = (project.outputs?.find(o => o.id === project.activeOutputId)?.cards ?? []).find(c => c.id === overId)
    
    if (!activeCard || !overCard) return
    
    if (activeCard.column !== overCard.column && overCard.column != null) {
      moveCard(activeId, overCard.column as ColumnIndex, overCard.order)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string
    
    if (activeId === overId) return

    const activeCard = (project.outputs?.find(o => o.id === project.activeOutputId)?.cards ?? []).find(c => c.id === activeId)
    const overCard = (project.outputs?.find(o => o.id === project.activeOutputId)?.cards ?? []).find(c => c.id === overId)
    
    if (activeCard && overCard && overCard.column != null) {
      moveCard(activeId, overCard.column as ColumnIndex, overCard.order)
    }
  }

  const activeCardData = useMemo(
    () => {
      const activeCards = project.outputs?.find(o => o.id === project.activeOutputId)?.cards ?? []
      return activeCards.find(c => c.id === activeId)
    },
    [project.outputs, project.activeOutputId, activeId]
  )

  return (
    <ScrollArea className="min-h-0 flex-1">
      {isSwitchingProject ? (
        <PosterSkeleton />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="mx-auto w-full max-w-5xl p-5 pb-20">
          <div className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
            {/* fixed header area */}
            <TemplateHeader variant="poster" />

            {/* three columns */}
            <div className="flex gap-3 p-3">
              <PosterColumn column={1} />
              <div className="w-px shrink-0 bg-border" />
              <PosterColumn column={2} />
              <div className="w-px shrink-0 bg-border" />
              <PosterColumn column={3} />
            </div>
          </div>
          </div>
          
          <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.4" } } }) }}>
            {activeCardData ? <MiniBlock card={activeCardData} overlay /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </ScrollArea>
  )
}

// ---------------------------------------------------------------------------
// SlideCard — linear card for slides view
// ---------------------------------------------------------------------------
const SlideCard = memo(function SlideCard({ card, index, overlay }: { card: Card; index: number; overlay?: boolean }) {
  const { selectedCardId, selectCard, deleteCard, autoFillCardAction } = useEditor(
    useShallow((s) => ({
      selectedCardId: s.selectedCardId,
      selectCard: s.selectCard,
      deleteCard: s.deleteCard,
      autoFillCardAction: s.autoFillCardAction,
    }))
  )
  const active = card.id === selectedCardId
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const figs = card.figures?.filter((f) => f.url.trim()).length ?? 0
  const preview = card.content?.split("\n").find((l) => l.trim())

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="button"
      tabIndex={0}
      aria-current={active ? "true" : undefined}
      onClick={() => selectCard(card.id)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectCard(card.id) } }}
      className={cn(
        "group relative flex items-stretch gap-0 rounded-md border bg-card shadow-sm transition-all hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "border-primary ring-1 ring-primary" : "border-border hover:border-muted-foreground/40",
        overlay && "shadow-xl border-primary/50 cursor-grabbing rotate-1 scale-105",
      )}
    >
      {/* Slide number badge */}
      <div className={cn(
        "flex w-8 shrink-0 flex-col items-center justify-center rounded-l-md border-r border-border bg-muted/40 text-center",
        active && "bg-primary/10",
      )}>
        <span className="font-mono text-[10px] font-bold text-muted-foreground">{index + 1}</span>
      </div>
      {/* Drag handle */}
      <div
        className={cn("flex items-center px-1 cursor-grab text-muted-foreground/40 hover:text-muted-foreground", overlay && "cursor-grabbing")}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </div>
      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 px-2 py-2">
        <div className="flex items-center gap-1.5">
          <StatusIcon level={"valid"} className="size-3 shrink-0" />
          <span className="truncate text-[12px] font-semibold">{card.title || "Untitled Slide"}</span>
        </div>
        {preview && (
          <p className="line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">{preview}</p>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          <span className="rounded border border-border bg-muted px-1 py-px font-mono text-[9px] text-muted-foreground">{card.pattern}</span>
          {figs > 0 && <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground"><ImageIcon className="size-2.5" />{figs}</span>}
          {card.slideNotes && <span className="text-[9px] text-muted-foreground/60 italic">has notes</span>}
        </div>
      </div>
    </div>
  )
})

// ---------------------------------------------------------------------------
// PaperSection — linear card for paper view
// ---------------------------------------------------------------------------
const PaperSection = memo(function PaperSection({ card, overlay }: { card: Card; overlay?: boolean }) {
  const { selectedCardId, selectCard, deleteCard } = useEditor(
    useShallow((s) => ({
      selectedCardId: s.selectedCardId,
      selectCard: s.selectCard,
      deleteCard: s.deleteCard,
    }))
  )
  const active = card.id === selectedCardId
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  const preview = card.content?.split("\n").find((l) => l.trim())
  const figs = card.figures?.filter((f) => f.url.trim()).length ?? 0
  const hasTable = card.table?.rows?.length > 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="button"
      tabIndex={0}
      aria-current={active ? "true" : undefined}
      onClick={() => selectCard(card.id)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectCard(card.id) } }}
      className={cn(
        "group relative flex items-stretch gap-0 rounded-md border bg-card shadow-sm transition-all hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "border-primary ring-1 ring-primary" : "border-border hover:border-muted-foreground/40",
        overlay && "shadow-xl border-primary/50 cursor-grabbing rotate-1 scale-105",
      )}
    >
      {/* Left accent: section type icon */}
      <div className={cn(
        "flex w-8 shrink-0 flex-col items-center justify-center rounded-l-md border-r border-border bg-muted/40",
        active && "bg-primary/10",
      )}>
        <FileText className="size-3.5 text-muted-foreground" />
      </div>
      {/* Drag handle */}
      <div
        className={cn("flex items-center px-1 cursor-grab text-muted-foreground/40 hover:text-muted-foreground", overlay && "cursor-grabbing")}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </div>
      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 px-2 py-2">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[12px] font-semibold">{card.title || "Untitled Section"}</span>
        </div>
        {preview && (
          <p className="line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">{preview}</p>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          <span className="rounded border border-border bg-muted px-1 py-px font-mono text-[9px] text-muted-foreground">{card.pattern}</span>
          {figs > 0 && <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground"><ImageIcon className="size-2.5" />{figs}</span>}
          {hasTable && <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground"><Table2 className="size-2.5" />table</span>}
        </div>
      </div>
    </div>
  )
})

// ---------------------------------------------------------------------------
// SlidesView — linear sortable list of slides
// ---------------------------------------------------------------------------
function SlidesView() {
  const { project, addCard, moveCard, isSwitchingProject } = useEditor(
    useShallow((s) => ({
      project: s.project,
      addCard: s.addCard,
      moveCard: s.moveCard,
      isSwitchingProject: s.isSwitchingProject,
    }))
  )
  const [activeId, setActiveId] = useState<string | null>(null)
  const cards = useMemo(() => {
    const activeCards = project.outputs?.find(o => o.id === project.activeOutputId)?.cards ?? []
    return [...activeCards].sort((a, b) => a.order - b.order)
  }, [project.outputs, project.activeOutputId])
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const activeCard = useMemo(() => cards.find(c => c.id === activeId), [cards, activeId])

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string)
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over || active.id === over.id) return
    const overCard = cards.find(c => c.id === over.id)
    if (overCard) moveCard(active.id as string, null, overCard.order)
  }

  if (isSwitchingProject) return <PosterSkeleton />

  return (
    <ScrollArea className="min-h-0 flex-1">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="mx-auto w-full max-w-2xl px-5 py-6 pb-20 flex flex-col gap-2">
          <TemplateHeader variant="slides" />
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MonitorPlay className="size-4 text-primary" />
              <span className="text-[13px] font-bold">Slides</span>
              <span className="rounded-full bg-muted px-2 py-px text-[10px] font-mono text-muted-foreground">{cards.length}</span>
            </div>
          </div>
          <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
            {cards.map((c, i) => <SlideCard key={c.id} card={c} index={i} />)}
          </SortableContext>
          <button
            onClick={() => addCard(null)}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/50 hover:text-primary mt-1"
          >
            <Plus className="size-3.5" />
            Add Slide
          </button>
        </div>
        <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.4" } } }) }}>
          {activeCard ? <SlideCard card={activeCard} index={cards.findIndex(c => c.id === activeCard.id)} overlay /> : null}
        </DragOverlay>
      </DndContext>
    </ScrollArea>
  )
}

// ---------------------------------------------------------------------------
// PaperView — linear sortable list of sections
// ---------------------------------------------------------------------------
function PaperView() {
  const { project, addCard, moveCard, isSwitchingProject } = useEditor(
    useShallow((s) => ({
      project: s.project,
      addCard: s.addCard,
      moveCard: s.moveCard,
      isSwitchingProject: s.isSwitchingProject,
    }))
  )
  const [activeId, setActiveId] = useState<string | null>(null)
  const cards = useMemo(() => {
    const activeCards = project.outputs?.find(o => o.id === project.activeOutputId)?.cards ?? []
    return [...activeCards].sort((a, b) => a.order - b.order)
  }, [project.outputs, project.activeOutputId])
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const activeCard = useMemo(() => cards.find(c => c.id === activeId), [cards, activeId])

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string)
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over || active.id === over.id) return
    const overCard = cards.find(c => c.id === over.id)
    if (overCard) moveCard(active.id as string, null, overCard.order)
  }

  if (isSwitchingProject) return <PosterSkeleton />

  return (
    <ScrollArea className="min-h-0 flex-1">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="mx-auto w-full max-w-2xl px-5 py-6 pb-20 flex flex-col gap-2">
          <TemplateHeader variant="paper" />
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 text-primary" />
              <span className="text-[13px] font-bold">Paper Sections</span>
              <span className="rounded-full bg-muted px-2 py-px text-[10px] font-mono text-muted-foreground">{cards.length}</span>
            </div>
          </div>
          <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
            {cards.map((c) => <PaperSection key={c.id} card={c} />)}
          </SortableContext>
          <button
            onClick={() => addCard(null)}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/50 hover:text-primary mt-1"
          >
            <Plus className="size-3.5" />
            Add Section
          </button>
        </div>
        <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.4" } } }) }}>
          {activeCard ? <PaperSection card={activeCard} overlay /> : null}
        </DragOverlay>
      </DndContext>
    </ScrollArea>
  )
}


// ---------------------------------------------------------------------------
// StructureView — routes to the right view based on active output type
// ---------------------------------------------------------------------------
function StructureView() {
  const activeOutputType = useEditor((s) => {
    const o = s.project.outputs?.find((o) => o.id === s.project.activeOutputId)
    return (o?.outputType ?? "poster") as OutputType
  })
  const workspaceId = useEditor((s) => s.project.id)

  if (activeOutputType === "thesis-review") return <ThesisReviewPanel workspaceId={workspaceId} />
  if (activeOutputType === "slides") return <SlidesView />
  if (activeOutputType === "paper") return <PaperView />
  return <PosterStructureView />
}

// ---------------------------------------------------------------------------
// PosterPreview (main export)
// ---------------------------------------------------------------------------
export function PosterPreview() {
  const { isSwitchingProject, compiling, compileOk, compileProject, project, autoCompile, setAutoCompile, lastCompileFormat, setLastCompileFormat, showLatexSource } = useEditor(
    useShallow((s) => ({
      isSwitchingProject: s.isSwitchingProject,
      compiling: s.compiling,
      compileOk: s.compileOk,
      compileProject: s.compileProject,
      project: s.project,
      autoCompile: s.autoCompile,
      setAutoCompile: s.setAutoCompile,
      lastCompileFormat: s.lastCompileFormat,
      setLastCompileFormat: s.setLastCompileFormat,
      showLatexSource: s.showLatexSource,
    }))
  )

  useEffect(() => {
    if (!autoCompile) return
    const t = setTimeout(() => {
      compileProject(lastCompileFormat)
    }, 2500)
    return () => clearTimeout(t)
  }, [project, autoCompile, lastCompileFormat, compileProject])

  const handleCompile = useCallback((format: OutputType) => {
    setLastCompileFormat(format)
    compileProject(format)
  }, [compileProject, setLastCompileFormat])

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-muted/30">
      {/* Output type tab bar */}
      <OutputTabBar />
      {/* Header bar */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border bg-card px-3">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-foreground">Structure</span>
        </div>

        {/* Right side: compile button */}
        <div className="flex items-center h-7 rounded border border-border bg-card shadow-sm overflow-hidden">
          <button
            onClick={() => {
              if (autoCompile) {
                setAutoCompile(false)
              } else {
                compileProject(lastCompileFormat)
              }
            }}
            disabled={compiling && !autoCompile}
            className={cn(
              "flex items-center gap-1.5 px-3 h-full text-[11px] font-semibold transition-colors disabled:opacity-50",
              autoCompile 
                ? "bg-primary/10 text-primary hover:bg-primary/20" 
                : "bg-card text-foreground hover:bg-muted",
              (!autoCompile && compileOk === true) && "text-emerald-600 dark:text-emerald-400",
              (!autoCompile && compileOk === false) && "text-destructive"
            )}
          >
            {autoCompile ? (
              <>
                <RefreshCw className={cn("size-3", compiling && "animate-spin")} />
                Live Preview
              </>
            ) : (
              <>
                {compiling ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
                Compile
              </>
            )}
          </button>
          <div className="w-[1px] h-full bg-border" />
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={compiling || isSwitchingProject}
              className={cn(
                "flex items-center justify-center px-1.5 h-full transition-colors",
                autoCompile ? "bg-primary/10 text-primary hover:bg-primary/20" : "bg-card hover:bg-muted text-muted-foreground"
              )}
            >
              <ChevronDownIcon className="size-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setAutoCompile(true)} className="gap-2">
                <RefreshCw className="size-3 text-muted-foreground" />
                Live Preview Mode
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAutoCompile(false)} className="gap-2">
                <Play className="size-3 text-muted-foreground" />
                Manual Compile Mode
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tab content */}
      {showLatexSource ? (
        <ScrollArea className="flex-1 min-h-0 bg-muted/20">
          <div className="p-4">
            <pre className="rounded-md border border-border bg-card p-4 font-mono text-[11px] leading-relaxed text-foreground max-w-full overflow-x-auto whitespace-pre-wrap break-all">
              {(() => {
                const activeOutput = project.outputs?.find(o => o.id === project.activeOutputId) || project.outputs?.[0];
                return activeOutput ? generateFullTemplate(project, activeOutput, project.id) : "No output selected";
              })()}
            </pre>
          </div>
        </ScrollArea>
      ) : (
        <StructureView />
      )}
    </section>
  )
}

