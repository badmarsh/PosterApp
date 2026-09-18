"use client"

import { useEffect } from "react"
import { Check, Languages } from "lucide-react"
import { useShallow } from "zustand/react/shallow"
import { useEditor } from "@/components/editor-store"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { getUiCopy, UI_LANGUAGE_LABELS, UI_LANGUAGES, type UiLanguage } from "@/lib/i18n/ui"

/** Always-visible chrome language control. It changes only UI copy, not user content. */
export function LanguageSwitcher() {
  const { language, setLanguage } = useEditor(useShallow((state) => ({ language: state.language, setLanguage: state.setLanguage })))
  const copy = getUiCopy(language)

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-[11px]" />}
        aria-label={copy.languageLabel}
        title={copy.languageHint}
      >
        <Languages className="size-3.5" />
        <span className="hidden sm:inline">{language.toUpperCase()}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{copy.languageLabel}</div>
        {UI_LANGUAGES.map((option: UiLanguage) => (
          <DropdownMenuItem key={option} onClick={() => setLanguage(option)} className="gap-2 text-xs">
            <span className="w-6 font-mono font-semibold">{option.toUpperCase()}</span>
            <span className="flex-1">{UI_LANGUAGE_LABELS[option]}</span>
            {option === language && <Check className="size-3.5 text-primary" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
