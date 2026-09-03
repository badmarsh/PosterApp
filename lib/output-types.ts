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
  /**
   * TeX classes/packages this template needs that are NOT part of a base
   * TeX Live install and are NOT vendored in `public/latex-styles/`.
   *
   * Compilation copies `public/latex-styles/**` and any workspace-root
   * `.sty`/`.cls`/`.bst` into the staging dir (see
   * `app/api/workspaces/[id]/compile/route.ts`), so anything listed here must
   * come from the compiler image itself. The UI surfaces it as an up-front
   * warning: a missing class is otherwise only discovered as a failed compile
   * with an opaque log.
   */
  requiresClass?: string[]
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
  { id: "landscape",  outputType: "poster", label: "A0 Landscape",          description: "Landscape A0, 3 equal columns. For conferences that mandate landscape boards.", category: "core",
    colors: [{id:"blue",name:"Cobalt",hex:"#2563EB"},{id:"teal",name:"Teal",hex:"#0D9488"},{id:"slate",name:"Slate",hex:"#334155"}], layoutPreview: "poster-3col",
    detailFeatures: ["A0 LANDSCAPE (1189x841mm) — all other posters are portrait", "3 equal columns, wider and shorter than portrait", "Prefers wide tables and side-by-side figures", "Lower column budget (700u) reflects the shorter board"], latexClass: "tikzposter [landscape]", colorSystem: "Custom \\definecolorstyle" },
  { id: "betterposter", outputType: "poster", label: "Better Poster (Morrison)", description: "Landscape with a dominant centre column for one big finding, narrow detail sidebars.", category: "poster",
    colors: [{id:"slate",name:"Slate",hex:"#1F2937"},{id:"amber",name:"Amber",hex:"#D97706"},{id:"blue",name:"Blue",hex:"#2563EB"}], layoutPreview: "poster-3col",
    detailFeatures: ["Morrison 'big finding' layout, landscape A0", "Centre column 46% — one plain-language sentence", "Narrow 24% sidebars for methods and references", "Tightest column budget (520u) — brevity is the point"], latexClass: "tikzposter [landscape]", colorSystem: "Custom \\definecolorstyle" },
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
  // Physics / HEP venues
  { id: "elsarticle",   outputType: "paper", label: "Elsevier (elsarticle)",  description: "Elsevier journals (NIM A, Physics Letters B). Single-column preprint form.", category: "core",
    colors: [{id:"black",name:"Black",hex:"#111827"},{id:"orange",name:"Elsevier Orange",hex:"#E9711C"}], layoutPreview: "paper-single",
    detailFeatures: ["Elsevier elsarticle class (ships with TeX Live)", "Single-column preprint layout", "frontmatter block with journal line", "Standard figure/table floats"], latexClass: "elsarticle [preprint]", colorSystem: "None" },
  { id: "revtex-aps",   outputType: "paper", label: "APS REVTeX (PRD/PRL)",   description: "American Physical Society two-column journal format.", category: "core",
    colors: [{id:"black",name:"Black",hex:"#111827"},{id:"blue",name:"APS Blue",hex:"#00629B"}], layoutPreview: "paper-twocol",
    detailFeatures: ["REVTeX 4.2, aps/prd options", "Two-column reprint layout", "Figures span columns via figure*", "Ships with TeX Live"], latexClass: "revtex4-2 [reprint,aps,prd]", colorSystem: "None" },
  { id: "epj-woc",      outputType: "paper", label: "EPJ Web of Conferences", description: "Standard HEP conference proceedings (CHEP, Quark Matter).", category: "institutional",
    colors: [{id:"black",name:"Black",hex:"#111827"},{id:"blue",name:"EPJ Blue",hex:"#1F4E79"}], layoutPreview: "paper-single",
    detailFeatures: ["EPJ Web of Conferences proceedings format", "Single-column layout", "Author/institute blocks with email", "Requires the 'webofc' class"], latexClass: "webofc", colorSystem: "None", requiresClass: ["webofc"] },
  { id: "iopart",       outputType: "paper", label: "IOP (iopart)",           description: "IOP Publishing journals (J. Phys. series, Meas. Sci. Technol.).", category: "core",
    colors: [{id:"black",name:"Black",hex:"#111827"},{id:"green",name:"IOP Green",hex:"#00847C"}], layoutPreview: "paper-single",
    detailFeatures: ["IOP Publishing journal format", "Single-column layout", "\\address block for affiliations", "Requires the 'iopart' class"], latexClass: "iopart", colorSystem: "None", requiresClass: ["iopart"] },
  // ML / CS conferences
  { id: "neurips",      outputType: "paper", label: "NeurIPS",                description: "NeurIPS single-column camera-ready format.", category: "core",
    colors: [{id:"black",name:"Black",hex:"#111827"},{id:"purple",name:"NeurIPS Purple",hex:"#6B4FA0"}], layoutPreview: "paper-single",
    detailFeatures: ["NeurIPS single-column layout", "'final' option prints author names", "Do not use figure* — single column", "Requires 'neurips_2026.sty'"], latexClass: "article + neurips_2026", colorSystem: "None", requiresClass: ["neurips_2026.sty"] },
  { id: "icml",         outputType: "paper", label: "ICML",                   description: "ICML two-column format with icmlauthorlist front matter.", category: "core",
    colors: [{id:"black",name:"Black",hex:"#111827"},{id:"blue",name:"ICML Blue",hex:"#1B6CA8"}], layoutPreview: "paper-twocol",
    detailFeatures: ["ICML two-column layout", "'accepted' option de-anonymises", "Figures span columns via figure*", "Requires 'icml2026.sty'"], latexClass: "article + icml2026", colorSystem: "None", requiresClass: ["icml2026.sty"] },
  { id: "iclr",         outputType: "paper", label: "ICLR",                   description: "ICLR single-column conference format.", category: "core",
    colors: [{id:"black",name:"Black",hex:"#111827"},{id:"red",name:"ICLR Red",hex:"#C0392B"}], layoutPreview: "paper-single",
    detailFeatures: ["ICLR single-column layout", "Times body font", "Do not use figure* — single column", "Requires 'iclr2026_conference.sty'"], latexClass: "article + iclr2026_conference", colorSystem: "None", requiresClass: ["iclr2026_conference.sty"] },
  { id: "acl",          outputType: "paper", label: "ACL / EMNLP / NAACL",    description: "ACL Rolling Review two-column NLP format.", category: "core",
    colors: [{id:"black",name:"Black",hex:"#111827"},{id:"red",name:"ACL Red",hex:"#B31B1B"}], layoutPreview: "paper-twocol",
    detailFeatures: ["Shared ACL/EMNLP/NAACL style", "Two-column layout with microtype", "Figures span columns via figure*", "Requires 'acl.sty'"], latexClass: "article + acl", colorSystem: "None", requiresClass: ["acl.sty"] },
  { id: "cvpr",         outputType: "paper", label: "CVPR / ICCV",            description: "CVPR two-column camera-ready format.", category: "core",
    colors: [{id:"black",name:"Black",hex:"#111827"},{id:"teal",name:"CVPR Teal",hex:"#00838F"}], layoutPreview: "paper-twocol",
    detailFeatures: ["CVPR/ICCV two-column layout", "'final' camera-ready (no line numbers)", "Figures span columns via figure*", "Requires 'cvpr.sty'"], latexClass: "article + cvpr", colorSystem: "None", requiresClass: ["cvpr.sty"] },
  { id: "aaai",         outputType: "paper", label: "AAAI",                   description: "AAAI two-column format. Forbids hyperref/geometry/fancyhdr.", category: "core",
    colors: [{id:"black",name:"Black",hex:"#111827"},{id:"blue",name:"AAAI Blue",hex:"#003A70"}], layoutPreview: "paper-twocol",
    detailFeatures: ["AAAI two-column layout", "Style forbids hyperref/geometry/fancyhdr", "Figures span columns via figure*", "Requires 'aaai2026.sty'"], latexClass: "article + aaai2026", colorSystem: "None", requiresClass: ["aaai2026.sty"] },
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
  { id: "posudok-de", outputType: "thesis-review", label: "Deutsches Gutachten", description: "Gutachten zur Abschlussarbeit nach mitteleuropäischem Hochschulstandard.", category: "core",
    colors: [{id:"blue",name:"Navy",hex:"#003366"},{id:"black",name:"Black",hex:"#111827"}], layoutPreview: "paper-single",
    detailFeatures: ["Deutschsprachiges Gutachten (ngerman babel)", "Kriterientabelle mit ECTS-Noten", "Verteidigungsfragen und Unterschriftsfeld", "Kriterienbezeichnungen auf Englisch (Rubrik nicht übersetzt)"], latexClass: "article [ngerman]", colorSystem: "None" },
  { id: "posudok-pl", outputType: "thesis-review", label: "Recenzja polska", description: "Recenzja pracy dyplomowej zgodna ze standardami polskich uczelni.", category: "core",
    colors: [{id:"blue",name:"Navy",hex:"#003366"},{id:"black",name:"Black",hex:"#111827"}], layoutPreview: "paper-single",
    detailFeatures: ["Recenzja w języku polskim (polish babel)", "Tabela kryteriów z ocenami ECTS", "Pytania na obronę i pole podpisu", "Nazwy kryteriów po angielsku (rubryka nieprzetłumaczona)"], latexClass: "article [polish]", colorSystem: "None" },
  { id: "posudok-hu", outputType: "thesis-review", label: "Magyar bírálat", description: "Záródolgozat bírálata magyar felsőoktatási szabvány szerint.", category: "core",
    colors: [{id:"blue",name:"Navy",hex:"#003366"},{id:"black",name:"Black",hex:"#111827"}], layoutPreview: "paper-single",
    detailFeatures: ["Magyar nyelvű bírálat (magyar babel)", "Szempontok táblázata ECTS érdemjegyekkel", "Védési kérdések és aláírás mező", "A szempontok neve angolul (a rubrika nincs lefordítva)"], latexClass: "article [magyar]", colorSystem: "None" },
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

