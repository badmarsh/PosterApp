"use client"

/**
 * CitationIssuesPanel — displays citation audit results & bibliographic issues.
 *
 * Shows issues flagged by Academic Connector (Semantic Scholar / arXiv)
 * and ISO 690 / completeness checks.
 */

import { AlertTriangle, BookOpen, CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { ReviewLanguage } from "@/lib/ai/thesis-rubric"

interface Props {
  issues: string[]
  lang: ReviewLanguage
}

const LABELS: Record<
  ReviewLanguage,
  {
    title: string
    subtitle: string
    clean: string
  }
> = {
  sk: {
    title: "Akademický konektor & Kontrola citácií",
    subtitle: "Overenie citovaných zdrojov cez Semantic Scholar / arXiv a formálne požiadavky",
    clean: "Všetky overované citácie spĺňajú základné požiadavky.",
  },
  cs: {
    title: "Akademický konektor & Kontrola citací",
    subtitle: "Ověření citovaných zdrojů přes Semantic Scholar / arXiv a formální požadavky",
    clean: "Všechny ověřované citace splňují základní požadavky.",
  },
  en: {
    title: "Academic Connector & Citation Audit",
    subtitle: "Verification of cited references via Semantic Scholar / arXiv and ISO standards",
    clean: "All verified citations meet the criteria.",
  },
}

export function CitationIssuesPanel({ issues, lang }: Props) {
  const t = LABELS[lang]

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">{t.title}</h3>
        </div>
        {issues.length > 0 ? (
          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200 text-xs">
            {issues.length} {lang === "sk" ? "pripomienok" : lang === "cs" ? "připomínek" : "notes"}
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-200 text-xs">
            OK
          </Badge>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{t.subtitle}</p>

      {issues.length === 0 ? (
        <div className="flex items-center gap-2 rounded-md bg-green-50 p-2.5 text-xs text-green-800 dark:bg-green-950/40 dark:text-green-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{t.clean}</span>
        </div>
      ) : (
        <div className="space-y-2">
          {issues.map((issue, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/50 p-2.5 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <div className="flex-1 whitespace-pre-wrap">{issue}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
