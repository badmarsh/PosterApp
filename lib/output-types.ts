/**
 * Output types, template registry, and layout constraints.
 *
 * This module defines the three first-class output types (poster, slides, paper),
 * the available graphical templates for each, and the physical layout constraints
 * that drive validation, AI generation, and height budgeting.
 */

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type OutputType = "poster" | "slides" | "paper" | "thesis-review"

export const OUTPUT_TYPE_LABELS: Record<OutputType, string> = {
  poster: "Poster",
  slides: "Slides",
  paper: "Paper",
  "thesis-review": "Thesis Review (Posudok)",
}

export const OUTPUT_TYPE_DESCRIPTIONS: Record<OutputType, string> = {
  poster: "Large-format academic poster (A0/A1), typically 3-column portrait layout",
  slides: "Presentation slides (Beamer), sequential frames with speaker notes",
  paper: "Academic paper (article class), full prose sections with floats",
  "thesis-review": "Academic thesis review / assessment (posudok diplomovej práce) with RAG & citation audit",
}

// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------

export type TemplateCategory = "core" | "poster" | "institutional"

export type TemplateColor = {
  id: string
  name: string
  hex: string
}

/**
 * Which mini-SVG layout diagram to render in the AddOutputDialog.
 * poster-3col  — 3-column poster
 * slides-wide  — 16:9 slide
 * paper-twocol — two-column paper
 * paper-single — single-column paper
 */
export type TemplateLayoutPreview = "poster-3col" | "slides-wide" | "paper-single" | "paper-twocol"

export type TemplateDef = {
  id: string
  outputType: OutputType
  label: string
  description: string
  category: TemplateCategory
  colors: TemplateColor[]
  layoutPreview: TemplateLayoutPreview
  detailFeatures: string[]
  latexClass: string
  colorSystem: string
}

export const TEMPLATE_REGISTRY: TemplateDef[] = [
  // Posters
  { id: "atlas",       outputType: "poster", label: "TemplateATLAS (CERN)",  description: "Red/white scheme with dual logo support (Project Settings). Fully custom title bar.",      category: "institutional",
    colors: [{id:"red",name:"ATLAS Red",hex:"#C8102E"},{id:"navy",name:"Navy",hex:"#003366"},{id:"black",name:"Black",hex:"#222222"}], layoutPreview: "poster-3col",
    detailFeatures: ["Dual logo support via Project Defaults", "Fully custom rounded-corner title bar", "Block backgrounds tinted light-red!25", "Built for A0/A1 portrait printing"], latexClass: "tikzposter", colorSystem: "Custom \\definecolorstyle" },
  { id: "minimal",    outputType: "poster", label: "Minimal Blue",           description: "Clean academic layout. No logos. Full color override supported.", category: "core",
    colors: [{id:"blue",name:"Cobalt",hex:"#2563EB"},{id:"teal",name:"Teal",hex:"#0D9488"},{id:"violet",name:"Violet",hex:"#7C3AED"}], layoutPreview: "poster-3col",
    detailFeatures: ["Clean, non-institutional academic look", "Standard title block (no logos)", "Block backgrounds tinted light-blue!25", "Perfect for general-purpose research"], latexClass: "tikzposter", colorSystem: "Custom \\definecolorstyle" },
  { id: "gemini",     outputType: "poster", label: "Gemini",                 description: "Modern Beamerposter theme using standard block syntax.",                      category: "poster",
    colors: [{id:"indigo",name:"Indigo",hex:"#4F46E5"},{id:"emerald",name:"Emerald",hex:"#059669"},{id:"rose",name:"Rose",hex:"#E11D48"}], layoutPreview: "poster-3col",
    detailFeatures: ["Uses standard Beamer \\begin{block} syntax", "Sleek, modern flat-design layout", "Full color override via Beamer structure fg", "Highly customizable preamble"], latexClass: "beamer + beamerposter", colorSystem: "\\usecolortheme{gemini}" },
  { id: "tikzposter", outputType: "poster", label: "tikzposter",             description: "Built-in tikzposter Board theme. Standard blocks.",  category: "poster",
    colors: [{id:"blue",name:"Blue",hex:"#1D4ED8"},{id:"orange",name:"Orange",hex:"#EA580C"}], layoutPreview: "poster-3col",
    detailFeatures: ["Uses the built-in Board theme natively", "Block headers and bodies inherit native theme colors", "Classic modular block appearance"], latexClass: "tikzposter", colorSystem: "\\usetheme{Board}" },
  { id: "a0poster",   outputType: "poster", label: "A0 Poster",              description: "Classic A0 layout. Raw LaTeX sections (no blocks). Color override ignored.",                    category: "core",
    colors: [{id:"black",name:"Black",hex:"#111827"},{id:"blue",name:"Blue",hex:"#1E40AF"}], layoutPreview: "poster-3col",
    detailFeatures: ["Raw LaTeX sections (no tikzposter blocks)", "Uses standard \\begin{multicols}{3}", "Minimal styling, very close to a raw document", "Note: Color overrides are ignored"], latexClass: "a0poster", colorSystem: "None" },
  // Slides
  { id: "beamer-metropolis", outputType: "slides", label: "Metropolis",    description: "Modern minimal theme with progress bar. (Requires 'metropolis' package).",             category: "core",
    colors: [{id:"charcoal",name:"Charcoal",hex:"#2D3748"},{id:"blue",name:"Blue",hex:"#3B82F6"},{id:"green",name:"Green",hex:"#10B981"}], layoutPreview: "slides-wide",
    detailFeatures: ["Modern, flat design", "Distinctive progress bar in footer", "Clean, minimalist slide titles", "Requires the 'metropolis' LaTeX package"], latexClass: "beamer", colorSystem: "\\usetheme{metropolis}" },
  { id: "beamer-atlas",      outputType: "slides", label: "ATLAS Beamer",  description: "Madrid theme with hardcoded ATLAS red base color.",         category: "institutional",
    colors: [{id:"red",name:"ATLAS Red",hex:"#C8102E"},{id:"navy",name:"Navy",hex:"#003366"}], layoutPreview: "slides-wide",
    detailFeatures: ["Based on the classic Madrid theme", "Pre-configured with ATLAS Red base color", "Supports dynamic color override if needed", "Standard navigation bars"], latexClass: "beamer", colorSystem: "\\usetheme{Madrid}" },
  { id: "beamer-madrid",     outputType: "slides", label: "Madrid",         description: "Pure Madrid theme. Supports full color override.",             category: "core",
    colors: [{id:"blue",name:"Blue",hex:"#1D4ED8"},{id:"red",name:"Red",hex:"#DC2626"},{id:"green",name:"Green",hex:"#16A34A"}], layoutPreview: "slides-wide",
    detailFeatures: ["Classic academic Beamer theme", "Clean header and footer navigation boxes", "Supports full color override via structure fg"], latexClass: "beamer", colorSystem: "\\usetheme{Madrid}" },
  { id: "beamer-default",    outputType: "slides", label: "Default",        description: "Bare-bones Beamer. Highly portable, no extra packages needed.",          category: "core",
    colors: [{id:"blue",name:"Blue",hex:"#1E40AF"},{id:"gray",name:"Gray",hex:"#4B5563"}], layoutPreview: "slides-wide",
    detailFeatures: ["Bare-bones default Beamer style", "Extremely portable, works everywhere", "No extraneous packages required"], latexClass: "beamer", colorSystem: "\\usetheme{default}" },
  { id: "beamer-focus",      outputType: "slides", label: "Focus",          description: "Dark, minimalist full-bleed title slides. (Requires 'focus' package).",           category: "core",
    colors: [{id:"dark",name:"Dark",hex:"#1C1C1C"},{id:"blue",name:"Blue",hex:"#007AB8"}], layoutPreview: "slides-wide",
    detailFeatures: ["Dark, minimalist aesthetic", "Full-bleed title and section slides", "Requires the 'focus' LaTeX package"], latexClass: "beamer", colorSystem: "\\usetheme{focus}" },
  // Papers
  { id: "article-twocol",   outputType: "paper", label: "Two-Column Article",   description: "Standard preprint format. Uses geometry and authblk packages.",               category: "core",
    colors: [{id:"black",name:"Black",hex:"#111827"},{id:"blue",name:"Blue",hex:"#1E40AF"}], layoutPreview: "paper-twocol",
    detailFeatures: ["Standard two-column preprint layout", "Uses geometry package for 1-inch margins", "Clean author affiliations via authblk", "Figures correctly span columns using figure*"], latexClass: "article [twocolumn]", colorSystem: "None" },
  { id: "article-single",   outputType: "paper", label: "Single-Column",        description: "Wider margins, thesis style. Figures don't span columns.",             category: "core",
    colors: [{id:"black",name:"Black",hex:"#111827"},{id:"blue",name:"Blue",hex:"#1E40AF"}], layoutPreview: "paper-single",
    detailFeatures: ["Single-column thesis/report layout", "Wider 1.5-inch margins for readability", "Uses authblk for affiliations", "Uses standard figure environments"], latexClass: "article", colorSystem: "None" },
  { id: "ieee-conf",        outputType: "paper", label: "IEEE Conference",       description: "IEEE standards formatting. (Requires 'IEEEtran' class).",              category: "core",
    colors: [{id:"black",name:"Black",hex:"#111827"}], layoutPreview: "paper-twocol",
    detailFeatures: ["Complies with IEEE conference standards", "Two-column automatic layout", "Requires the 'IEEEtran' document class"], latexClass: "IEEEtran [conference]", colorSystem: "None" },
  { id: "acm-sigconf",      outputType: "paper", label: "ACM SIGCONF",           description: "ACM conference format. (Requires 'acmart' class).",                           category: "core",
    colors: [{id:"black",name:"Black",hex:"#111827"}], layoutPreview: "paper-twocol",
    detailFeatures: ["Complies with ACM SIGCONF standards", "Two-column automatic layout", "Requires the 'acmart' document class"], latexClass: "acmart [sigconf]", colorSystem: "None" },
  { id: "springer-llncs",   outputType: "paper", label: "Springer LLNCS",        description: "Single-col Lecture Notes format. (Requires 'llncs' class).",         category: "core",
    colors: [{id:"black",name:"Black",hex:"#111827"},{id:"blue",name:"Blue",hex:"#1A56DB"}], layoutPreview: "paper-single",
    detailFeatures: ["Complies with Springer LNCS formatting", "Single-column layout", "Requires the 'llncs' document class"], latexClass: "llncs", colorSystem: "None" },
  { id: "jinst-proceedings", outputType: "paper", label: "JINST Proceedings",   description: "Journal of Instrumentation (SISSA/IOP) proceedings style using jinstpub.", category: "institutional",
    colors: [{id:"black",name:"Black",hex:"#111827"}], layoutPreview: "paper-single",
    detailFeatures: ["Complies with JINST SISSA/IOP proceedings format", "Uses jinstpub package and linenumbers", "Single-column layout with standard JHEP bibliography style"], latexClass: "article + jinstpub", colorSystem: "None" },
  { id: "pos-proceedings",   outputType: "paper", label: "PoS Proceedings",     description: "SISSA Proceedings of Science format using pos package.", category: "institutional",
    colors: [{id:"black",name:"Black",hex:"#111827"}], layoutPreview: "paper-single",
    detailFeatures: ["Complies with SISSA Proceedings of Science format", "Uses pos package and linenumbers", "Single-column proceedings layout"], latexClass: "article + pos", colorSystem: "None" },
  // Thesis Reviews (Posudky)
  { id: "posudok-sk", outputType: "thesis-review", label: "Slovenský posudok (STU/UK)", description: "Štandardný posudok záverečnej práce podľa slovenských vysokoškolských noriem.", category: "institutional",
    colors: [{id:"blue",name:"Navy",hex:"#003366"},{id:"black",name:"Black",hex:"#111827"}], layoutPreview: "paper-single",
    detailFeatures: ["Formátovanie podľa STU / UK / TUKE noriem", "Tabuľka kritérií s ECTS známkami", "Otázky k obhajobe a podpisový blok"], latexClass: "article [slovak]", colorSystem: "None" },
  { id: "posudok-en", outputType: "thesis-review", label: "English Thesis Assessment", description: "Standard academic thesis assessment report in English.", category: "core",
    colors: [{id:"blue",name:"Navy",hex:"#003366"},{id:"black",name:"Black",hex:"#111827"}], layoutPreview: "paper-single",
    detailFeatures: ["European university assessment format", "Criteria rubric with letter grading", "Defense questions and signature section"], latexClass: "article [english]", colorSystem: "None" },
  { id: "posudok-cs", outputType: "thesis-review", label: "Český posudek (ČVUT/MUNI)", description: "Standardní posudek závěrečné práce dle českých vysokoškolských norem.", category: "institutional",
    colors: [{id:"blue",name:"Navy",hex:"#003366"},{id:"black",name:"Black",hex:"#111827"}], layoutPreview: "paper-single",
    detailFeatures: ["Formátování dle ČVUT / MUNI / VUT", "Kritéria s ECTS hodnocením", "Otázky k obhajobě a podpisový blok"], latexClass: "article [czech]", colorSystem: "None" },
]

/** Get all templates available for a given output type. */
export function getTemplatesForType(outputType: OutputType): TemplateDef[] {
  return TEMPLATE_REGISTRY.filter((t) => t.outputType === outputType)
}

/** Look up a specific template definition. Returns undefined if not found. */
export function getTemplateDef(templateId: string): TemplateDef | undefined {
  return TEMPLATE_REGISTRY.find((t) => t.id === templateId)
}

/** Get all valid template IDs for a given output type. */
export function getTemplateIdsForType(outputType: OutputType): string[] {
  return getTemplatesForType(outputType).map((t) => t.id)
}

/** Get the default template ID for a given output type. */
export function getDefaultTemplateId(outputType: OutputType): string {
  const templates = getTemplatesForType(outputType)
  return templates[0]?.id ?? "atlas"
}

// ---------------------------------------------------------------------------
// Block patterns per output type
// ---------------------------------------------------------------------------

export type PosterPattern =
  | "bullets"
  | "bullets-image"
  | "bullets-two-images"
  | "bullets-table"
  | "image-focused"
  | "references"

export type SlidePattern =
  | "title-slide"
  | "bullets"
  | "bullets-image"
  | "figure-slide"
  | "two-column"
  | "references"

export type PaperPattern =
  | "section"
  | "section-figure"
  | "section-table"
  | "section-two-figures"
  | "references"

/** All valid block patterns for a given output type. */
export const PATTERNS_FOR_TYPE: Record<OutputType, { id: string; label: string; description: string }[]> = {
  poster: [
    { id: "bullets", label: "Bullets only", description: "A bulleted list of findings." },
    { id: "bullets-image", label: "Bullets + single image", description: "Bullets followed by one centered figure." },
    { id: "bullets-two-images", label: "Bullets + two images", description: "Bullets followed by two side-by-side figures." },
    { id: "bullets-table", label: "Bullets + table", description: "Bullets followed by a tabular result block." },
    { id: "image-focused", label: "Image-focused card", description: "A figure-dominant block with a short caption." },
    { id: "references", label: "References / Bibliography", description: "Auto-generates the bibliography." },
  ],
  slides: [
    { id: "title-slide", label: "Title slide", description: "Title page with authors and venue." },
    { id: "bullets", label: "Bullet points", description: "Standard bullet-point slide." },
    { id: "bullets-image", label: "Bullets + image", description: "Bullets on one side, image on the other." },
    { id: "figure-slide", label: "Full figure", description: "A slide dominated by a single figure." },
    { id: "two-column", label: "Two-column", description: "Split slide with two content columns." },
    { id: "references", label: "References", description: "Bibliography slide." },
  ],
  paper: [
    { id: "section", label: "Text section", description: "Full prose section with optional bullets." },
    { id: "section-figure", label: "Section + figure", description: "Text section followed by a figure float." },
    { id: "section-table", label: "Section + table", description: "Text section followed by a table float." },
    { id: "section-two-figures", label: "Section + two figures", description: "Text section with two figure floats." },
    { id: "references", label: "References", description: "Bibliography section." },
  ],
  "thesis-review": [
    { id: "section", label: "Kritérium posudku", description: "Textové hodnotenie jedného hodnotiaceho kritéria." },
    { id: "bullets", label: "Pripomienky & Otázky", description: "Bodový zoznam pripomienok alebo otázok k obhajobe." },
    { id: "references", label: "Zoznam literatúry & Citácie", description: "Audit citovanej literatúry." },
  ],
}

/** Check if a pattern is valid for a given output type. */
export function isValidPattern(outputType: OutputType, patternId: string): boolean {
  return PATTERNS_FOR_TYPE[outputType].some((p) => p.id === patternId)
}

// ---------------------------------------------------------------------------
// Layout constraints
// ---------------------------------------------------------------------------

export type LayoutConstraints = {
  outputType: OutputType
  columnCount: number
  columnBudget: number        // height units; Infinity for paper
  maxCharsPerCard: number     // Infinity for paper
  defaultCardCount: number
}

export const LAYOUT_CONSTRAINTS: Record<OutputType, LayoutConstraints> = {
  poster: {
    outputType: "poster",
    columnCount: 3,
    columnBudget: 900,
    maxCharsPerCard: 400,
    defaultCardCount: 9,
  },
  slides: {
    outputType: "slides",
    columnCount: 1,
    columnBudget: 400,
    maxCharsPerCard: 180,
    defaultCardCount: 12,
  },
  paper: {
    outputType: "paper",
    columnCount: 1,
    columnBudget: Infinity,
    maxCharsPerCard: Infinity,
    defaultCardCount: 6,
  },
  "thesis-review": {
    outputType: "thesis-review",
    columnCount: 1,
    columnBudget: Infinity,
    maxCharsPerCard: Infinity,
    defaultCardCount: 7,
  },
}

/** Get layout constraints for a given output type. */
export function getLayoutConstraints(outputType: OutputType): LayoutConstraints {
  return LAYOUT_CONSTRAINTS[outputType]
}

// ---------------------------------------------------------------------------
// Default Structures
// ---------------------------------------------------------------------------

export type DefaultCardTemplate = {
  title: string
  pattern: string
  column?: 1 | 2 | 3
}

export const DEFAULT_STRUCTURES: Record<OutputType, DefaultCardTemplate[]> = {
  poster: [
    { title: "Abstract", pattern: "bullets", column: 1 },
    { title: "Introduction", pattern: "bullets", column: 1 },
    { title: "Methodology", pattern: "bullets-image", column: 2 },
    { title: "Results", pattern: "bullets-table", column: 2 },
    { title: "Discussion & Conclusion", pattern: "bullets", column: 3 },
    { title: "References", pattern: "references", column: 3 },
  ],
  slides: [
    { title: "Title Slide", pattern: "title-slide" },
    { title: "Outline", pattern: "bullets" },
    { title: "Motivation", pattern: "bullets-image" },
    { title: "Methodology", pattern: "bullets" },
    { title: "Results", pattern: "bullets-table" },
    { title: "Conclusion", pattern: "bullets" },
    { title: "References", pattern: "references" },
  ],
  paper: [
    { title: "Abstract", pattern: "section" },
    { title: "1 Introduction", pattern: "section" },
    { title: "2 Related Work", pattern: "section" },
    { title: "3 Methodology", pattern: "section-figure" },
    { title: "4 Experiments & Results", pattern: "section-table" },
    { title: "5 Conclusion", pattern: "section" },
    { title: "References", pattern: "references" },
  ],
  "thesis-review": [
    { title: "Formálna štruktúra a úprava", pattern: "section" },
    { title: "Definícia cieľov a problematiky", pattern: "section" },
    { title: "Metodológia a postup riešenia", pattern: "section" },
    { title: "Výsledky a ich vyhodnotenie", pattern: "section" },
    { title: "Originalita a prínos práce", pattern: "section" },
    { title: "Jazyková a štylistická úroveň", pattern: "section" },
    { title: "Citácie a zoznam literatúry", pattern: "references" },
  ],
}

/**
 * Builds a default or custom-sized skeleton structure for an output type.
 * Supports custom count for posters, slides, and papers.
 */
export function buildDefaultStructure(outputType: OutputType, count?: number): DefaultCardTemplate[] {
  if (outputType === "thesis-review") {
    return DEFAULT_STRUCTURES["thesis-review"]
  }

  if (outputType === "poster") {
    const n = count && count >= 3 ? Math.min(count, 15) : 6
    const cards: DefaultCardTemplate[] = []

    const basePerCol = Math.floor(n / 3)
    const remainder = n % 3
    const col1Count = basePerCol + (remainder >= 1 ? 1 : 0)
    const col2Count = basePerCol + (remainder === 2 ? 1 : 0)
    const col3Count = n - col1Count - col2Count

    const defaultTopics: { title: string; pattern: PosterPattern }[] = [
      { title: "Abstract & Overview", pattern: "bullets" },
      { title: "Introduction & Motivation", pattern: "bullets" },
      { title: "Theoretical Framework", pattern: "bullets" },
      { title: "Methodology & Architecture", pattern: "bullets-image" },
      { title: "Experimental Setup", pattern: "bullets-image" },
      { title: "Primary Results", pattern: "bullets-table" },
      { title: "Comparative Evaluation", pattern: "bullets-table" },
      { title: "Key Findings & Discussion", pattern: "bullets" },
      { title: "Conclusion & Future Work", pattern: "bullets" },
    ]

    let topicIdx = 0

    // Column 1
    for (let i = 0; i < col1Count; i++) {
      const topic = defaultTopics[topicIdx++ % defaultTopics.length]
      cards.push({ title: topic.title, pattern: topic.pattern, column: 1 })
    }

    // Column 2
    for (let i = 0; i < col2Count; i++) {
      const topic = defaultTopics[topicIdx++ % defaultTopics.length]
      cards.push({ title: topic.title, pattern: topic.pattern, column: 2 })
    }

    // Column 3 (last card is always References)
    const col3NonRef = Math.max(0, col3Count - 1)
    for (let i = 0; i < col3NonRef; i++) {
      const topic = defaultTopics[topicIdx++ % defaultTopics.length]
      cards.push({ title: topic.title, pattern: topic.pattern, column: 3 })
    }
    cards.push({ title: "References", pattern: "references", column: 3 })

    return cards
  }

  if (outputType === "paper") {
    const n = count && count >= 3 ? Math.min(count, 20) : 7
    const cards: DefaultCardTemplate[] = []
    cards.push({ title: "Abstract", pattern: "section" })

    const midCount = Math.max(1, n - 2)
    const paperTopics: { title: string; pattern: PaperPattern }[] = [
      { title: "Introduction", pattern: "section" },
      { title: "Related Work", pattern: "section" },
      { title: "Methodology", pattern: "section-figure" },
      { title: "System Architecture", pattern: "section-figure" },
      { title: "Experiments & Results", pattern: "section-table" },
      { title: "Discussion & Limitations", pattern: "section" },
      { title: "Conclusion", pattern: "section" },
    ]

    for (let i = 0; i < midCount; i++) {
      const topic = paperTopics[i % paperTopics.length]
      const cycle = Math.floor(i / paperTopics.length)
      const num = i + 1
      const title = cycle > 0 ? `${num} ${topic.title} (${cycle + 1})` : `${num} ${topic.title}`
      cards.push({ title, pattern: topic.pattern })
    }

    cards.push({ title: "References", pattern: "references" })
    return cards
  }

  // Slides: dynamic count based on user input (default 7)
  const n = count && count >= 3 ? Math.min(count, 30) : 7
  const slides: DefaultCardTemplate[] = []
  slides.push({ title: "Title Slide", pattern: "title-slide" })

  const midCount = n - 2
  const standardSlideTopics: { title: string; pattern: SlidePattern }[] = [
    { title: "Motivation & Background", pattern: "bullets" },
    { title: "Problem Formulation", pattern: "bullets" },
    { title: "Methodology Overview", pattern: "bullets-image" },
    { title: "Core Architecture", pattern: "bullets" },
    { title: "Experimental Results", pattern: "bullets" },
    { title: "Comparative Evaluation", pattern: "bullets-image" },
    { title: "Discussion & Findings", pattern: "bullets" },
    { title: "Conclusion & Future Work", pattern: "bullets" },
  ]

  for (let i = 0; i < midCount; i++) {
    const topic = standardSlideTopics[i % standardSlideTopics.length]
    const cycle = Math.floor(i / standardSlideTopics.length)
    const title = cycle > 0 ? `${topic.title} (${cycle + 1})` : topic.title
    slides.push({ title, pattern: topic.pattern })
  }

  slides.push({ title: "References", pattern: "references" })
  return slides
}

