"use client"

/**
 * ReviewRoleBanner / ReviewRoleBadge — visually distinguishes the four review
 * types (opponent, supervisor/školiteľ, pre-consultation self-triage, peer
 * reviewer) so the review detail page makes the review type unmistakable.
 */

import {
  ShieldCheck,
  GraduationCap,
  Wrench,
  FileSearch,
  type LucideIcon,
} from "lucide-react"
import type { ReviewerRole } from "@/lib/ai/thesis-rubric"

export interface RoleMeta {
  icon: LucideIcon
  sk: string
  cs: string
  en: string
  skSub: string
  csSub: string
  enSub: string
  /** Tailwind classes for the banner. */
  banner: string
  badge: string
  accent: string
}

export const REVIEW_ROLE_META: Record<ReviewerRole, RoleMeta> = {
  opponent: {
    icon: ShieldCheck,
    sk: "Oponentský posudok",
    cs: "Oponentský posudek",
    en: "Opponent Review",
    skSub: "Nezávislé kritické hodnotenie s návrhom výsledku obhajoby",
    csSub: "Nezávislé kritické hodnocení s návrhem výsledku obhajoby",
    enSub: "Independent critical assessment with a defense outcome recommendation",
    banner: "border-rose-300/60 bg-rose-50 dark:bg-rose-950/25 text-rose-900 dark:text-rose-100",
    badge: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800",
    accent: "text-rose-600 dark:text-rose-400",
  },
  supervisor: {
    icon: GraduationCap,
    sk: "Posudok vedúceho práce (školiteľa)",
    cs: "Posudek vedoucího práce (školitele)",
    en: "Supervisor Review",
    skSub: "Hodnotenie procesu vypracovania, spolupráce a prístupu študenta",
    csSub: "Hodnocení průběhu zpracování, spolupráce a přístupu studenta",
    enSub: "Assessment of the work process, supervision collaboration and student approach",
    banner: "border-info/50 bg-info/10 dark:bg-info/15 text-info dark:text-info",
    badge: "bg-info/15 text-info border-info/40 dark:bg-info/25 dark:text-info dark:border-info/40",
    accent: "text-info dark:text-info",
  },
  self: {
    icon: Wrench,
    sk: "Predkonzultačný rozbor",
    cs: "Předkonzultační rozbor",
    en: "Pre-consultation Triage",
    skSub: "Vnútorná kontrola pred odovzdaním — prioritizované pripomienky na opravu",
    csSub: "Vnitřní kontrola před odevzdáním — prioritizované připomínky k opravě",
    enSub: "Internal pre-submission check — triaged issues to fix before defense",
    banner: "border-warning/50 bg-warning/10 dark:bg-warning/15 text-warning dark:text-warning",
    badge: "bg-warning/15 text-warning border-warning/40 dark:bg-warning/25 dark:text-warning dark:border-warning/40",
    accent: "text-warning dark:text-warning",
  },
  reviewer: {
    icon: FileSearch,
    sk: "Recenzný posudok (Peer Review)",
    cs: "Recenzní posudek (Peer Review)",
    en: "Peer Review",
    skSub: "Článkové/konferenčné recenzné konanie podľa reporting štandardov",
    csSub: "Článekové/konferenční recenzní řízení podle reporting standardů",
    enSub: "Journal/conference peer review against reporting guidelines",
    banner: "border-status-ambiguous/50 bg-status-ambiguous/10 dark:bg-status-ambiguous/15 text-status-ambiguous dark:text-status-ambiguous",
    badge: "bg-status-ambiguous/15 text-status-ambiguous border-status-ambiguous/40 dark:bg-status-ambiguous/25 dark:text-status-ambiguous dark:border-status-ambiguous/40",
    accent: "text-status-ambiguous dark:text-status-ambiguous",
  },
}

export function getReviewRoleMeta(role?: string | null): RoleMeta {
  return REVIEW_ROLE_META[(role as ReviewerRole) ?? "opponent"] ?? REVIEW_ROLE_META.opponent
}

export function ReviewRoleBadge({
  role,
  lang = "sk",
  size = "md",
}: {
  role?: string | null
  lang?: "sk" | "cs" | "en"
  size?: "sm" | "md"
}) {
  const meta = getReviewRoleMeta(role)
  const Icon = meta.icon
  const label = lang === "en" ? meta.en : lang === "cs" ? meta.cs : meta.sk
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${meta.badge} ${
        size === "sm" ? "text-[10px] px-2 py-0.5" : "text-[11px] px-2.5 py-1"
      }`}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {label}
    </span>
  )
}

export function ReviewRoleBanner({
  role,
  reviewerName,
  lang = "sk",
}: {
  role?: string | null
  reviewerName?: string | null
  lang?: "sk" | "cs" | "en"
}) {
  const meta = getReviewRoleMeta(role)
  const Icon = meta.icon
  const title = lang === "en" ? meta.en : lang === "cs" ? meta.cs : meta.sk
  const sub = lang === "en" ? meta.enSub : lang === "cs" ? meta.csSub : meta.skSub
  return (
    <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${meta.banner}`}>
      <div className="p-2 rounded-lg bg-white/60 dark:bg-white/10 shrink-0">
        <Icon className={`h-5 w-5 ${meta.accent}`} />
      </div>
      <div className="min-w-0">
        <p className="font-bold text-sm leading-tight">{title}</p>
        <p className="text-[11px] opacity-80 mt-0.5 leading-snug">{sub}</p>
        {reviewerName && (
          <p className="text-[11px] font-semibold mt-1 opacity-90">
            {reviewerName}
          </p>
        )}
      </div>
    </div>
  )
}
