/** Shared editor UI copy. Keep this dictionary free of feature data so it can be
 * consumed by the desktop shell, responsive navigation, preview and inspector.
 * Slovak is the default because the thesis workflow is Slovak-first. */
export const UI_LANGUAGES = ["sk", "cs", "en"] as const
export type UiLanguage = (typeof UI_LANGUAGES)[number]

export const UI_LANGUAGE_LABELS: Record<UiLanguage, string> = {
  sk: "Slovenčina",
  cs: "Čeština",
  en: "English",
}

type UiCopy = {
  structure: string
  preview: string
  editor: string
  agent: string
  settings: string
  help: string
  save: string
  saving: string
  saved: string
  compile: string
  livePreview: string
  manualCompile: string
  language: string
  languageLabel: string
  languageHint: string
  output: string
  cards: string
  addCard: string
  addSlide: string
  addSection: string
  content: string
  figures: string
  table: string
  validation: string
  autoShrink: string
  layoutOverflow: (delta: number) => string
  quickEdit: string
  dropCards: string
  sourceEvidence: string
  jumpToSource: string
  suggestedFigures: string
  attach: string
  attached: string
  overBudget: string
  errorInLine: (line: number | string) => string
  mobilePanels: string
}

export const UI_COPY: Record<UiLanguage, UiCopy> = {
  sk: {
    language: "Jazyk",
    languageLabel: "Jazyk rozhrania",
    languageHint: "Mení texty ovládacích prvkov bez zmeny obsahu posteru.",
    structure: "Štruktúra",
    preview: "Náhľad",
    editor: "Editor",
    agent: "Agent",
    settings: "Nastavenia",
    help: "Pomoc",
    save: "Uložiť",
    saving: "Ukladám…",
    saved: "Uložené",
    compile: "Kompilovať",
    livePreview: "Živý náhľad",
    manualCompile: "Manuálna kompilácia",
    output: "Výstup",
    cards: "blokov",
    addCard: "Pridať blok",
    addSlide: "Pridať snímku",
    addSection: "Pridať sekciu",
    content: "Obsah",
    figures: "Obrázky",
    table: "Tabuľka",
    validation: "Validácia",
    autoShrink: "Automaticky skrátiť obsah",
    layoutOverflow: (delta) => `Prekročenie rozloženia: +${delta}u`,
    quickEdit: "Rýchla úprava",
    dropCards: "Presuňte bloky sem",
    sourceEvidence: "Dôkaz zo zdroja",
    jumpToSource: "Prejsť na úryvok zdroja",
    suggestedFigures: "Navrhnuté obrázky",
    attach: "Pripojiť ku karte",
    attached: "Pripojené",
    overBudget: "Nad limitom",
    errorInLine: (line) => `Chyba na riadku ${line}`,
    mobilePanels: "Panely editora",
  },
  cs: {
    language: "Jazyk",
    languageLabel: "Jazyk rozhraní",
    languageHint: "Mění texty ovládacích prvků bez změny obsahu posteru.",
    structure: "Struktura",
    preview: "Náhled",
    editor: "Editor",
    agent: "Agent",
    settings: "Nastavení",
    help: "Nápověda",
    save: "Uložit",
    saving: "Ukládám…",
    saved: "Uloženo",
    compile: "Kompilovat",
    livePreview: "Živý náhled",
    manualCompile: "Ruční kompilace",
    output: "Výstup",
    cards: "bloků",
    addCard: "Přidat blok",
    addSlide: "Přidat snímek",
    addSection: "Přidat sekci",
    content: "Obsah",
    figures: "Obrázky",
    table: "Tabulka",
    validation: "Validace",
    autoShrink: "Automaticky zkrátit obsah",
    layoutOverflow: (delta) => `Přetečení rozložení: +${delta}u`,
    quickEdit: "Rychlá úprava",
    dropCards: "Přetáhněte bloky sem",
    sourceEvidence: "Důkaz ze zdroje",
    jumpToSource: "Přejít na úryvek zdroje",
    suggestedFigures: "Navržené obrázky",
    attach: "Připojit ke kartě",
    attached: "Připojeno",
    overBudget: "Nad limitem",
    errorInLine: (line) => `Chyba na řádku ${line}`,
    mobilePanels: "Panely editoru",
  },
  en: {
    language: "Language",
    languageLabel: "Interface language",
    languageHint: "Changes control labels without changing poster content.",
    structure: "Structure",
    preview: "Preview",
    editor: "Editor",
    agent: "Agent",
    settings: "Settings",
    help: "Help",
    save: "Save",
    saving: "Saving…",
    saved: "Saved",
    compile: "Compile",
    livePreview: "Live Preview",
    manualCompile: "Manual Compile",
    output: "Output",
    cards: "cards",
    addCard: "Add Card",
    addSlide: "Add Slide",
    addSection: "Add Section",
    content: "Content",
    figures: "Figures",
    table: "Table",
    validation: "Validation",
    autoShrink: "Auto-Shrink Content",
    layoutOverflow: (delta) => `Layout overflow: +${delta}u`,
    quickEdit: "Quick edit",
    dropCards: "Drop cards here",
    sourceEvidence: "Source evidence",
    jumpToSource: "Jump to source excerpt",
    suggestedFigures: "Suggested Figures",
    attach: "Attach to Card",
    attached: "Attached",
    overBudget: "Over budget",
    errorInLine: (line) => `Error in line ${line}`,
    mobilePanels: "Editor panels",
  },
}

export function normalizeUiLanguage(value: unknown): UiLanguage {
  return value === "sk" || value === "cs" || value === "en" ? value : "sk"
}

export function getUiCopy(language: UiLanguage | string | null | undefined): UiCopy {
  return UI_COPY[normalizeUiLanguage(language)]
}

export type { UiCopy }
