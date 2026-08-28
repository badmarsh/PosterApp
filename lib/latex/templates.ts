import { Project, resolveOutputMetadata } from "@/lib/poster-types"
import { parseMarkdownToLatex } from "./parser"
import { assetUrlToLatexPath } from "./helpers"

// ---------------------------------------------------------------------------
// Helper: Resolve title, authors, venue for the active output
// ---------------------------------------------------------------------------
function getMeta(project: Project) {
  const m = resolveOutputMetadata(project)
  return {
    title: parseMarkdownToLatex(m.title),
    authors: parseMarkdownToLatex(m.authors),
    venue: parseMarkdownToLatex(m.venue),
  }
}

// ---------------------------------------------------------------------------
// Color utilities
// ---------------------------------------------------------------------------

/**
 * Convert a CSS hex color (#RRGGBB) to a LaTeX RGB triplet string ("R,G,B")
 * suitable for use in \definecolor{...}{RGB}{...}.
 * Returns null if the input is not a valid 6-digit hex string.
 */
export function hexToLatexRgb(hex: string): string | null {
  const m = hex.replace(/^#/, "").match(/^([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/)
  if (!m) return null
  return `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}`
}

/**
 * Build the LaTeX snippet that overrides the poster accent colour when a custom
 * themeColor is provided.  Injects \definecolor{maincolor} before the
 * \definecolorstyle block so that all colour-style references pick it up.
 * Returns an empty string when themeColor is absent or invalid.
 */
export function posterThemeOverride(themeColor?: string): string {
  if (!themeColor) return ""
  const rgb = hexToLatexRgb(themeColor)
  if (!rgb) return ""
  const hex = themeColor.replace(/^#/, "").toUpperCase()
  return `% --- theme color override (set in PosterApp) ---
\\definecolor{maincolor}{HTML}{${hex}}
\\definecolor{accentlight}{RGB}{${rgb}}
% ------------------------------------------------
`
}

/**
 * Build the LaTeX snippet that overrides the Beamer structure colour when a
 * custom themeColor is provided.  Injects \setbeamercolor{structure}{fg=...}
 * immediately after the color theme declaration.
 * Returns an empty string when themeColor is absent or invalid.
 */
export function beamerThemeOverride(themeColor?: string): string {
  if (!themeColor) return ""
  const hex = themeColor.replace(/^#/, "").toUpperCase()
  return `\\definecolor{customaccent}{HTML}{${hex}}
\\setbeamercolor{structure}{fg=customaccent}
`
}

// ---------------------------------------------------------------------------
// POSTERS
// ---------------------------------------------------------------------------

export function getMinimalTemplate(project: Project, themeColor?: string): string {
  const override = posterThemeOverride(themeColor)
  const { title, authors, venue } = getMeta(project)
  return `
% [AI-CONTEXT] You are inside a tikzposter poster template.
% Use \\block{Title}{Content} for each card section.
% Enclose blocks within \\column{width} commands (e.g. \\column{0.33}).
\\documentclass[a0paper,portrait, blockverticalspace=3em, colspace=2em]{tikzposter}
\\tikzposterlatexaffectionproofoff
\\usepackage{graphicx}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{multicol}
\\usetikzlibrary{calc}

\\newcommand{\\looseitems}{\\begin{itemize}\\setlength{\\itemsep}{0.3em}}
\\newcommand{\\tightitems}{\\begin{itemize}\\setlength{\\itemsep}{0.15em}}
\\newcommand{\\captiontext}[1]{#1}

\\usetheme{Default}

\\definecolor{maincolor}{HTML}{2B4B9E}
\\definecolor{secondarycolor}{RGB}{43, 75, 158}
\\definecolor{lightblue}{RGB}{199, 215, 237}
${override}
\\definecolorstyle{minimalcolors}{
    \\colorlet{backgroundcolor}{white}
    \\colorlet{titlefgcolor}{white}
    \\colorlet{titlebgcolor}{maincolor}
    \\colorlet{blocktitlefgcolor}{white}
    \\colorlet{blocktitlebgcolor}{maincolor}
    \\colorlet{blockbodyfgcolor}{black}
    \\colorlet{blockbodybgcolor}{lightblue!25}
}{}
\\usecolorstyle{minimalcolors}

\\title{\\parbox{0.74\\linewidth}{\\centering\\huge
    ${title}\\\\[1mm]
    }}
\\author{\\Large ${authors}}
\\institute{\\normalsize ${venue}}
\\date{}

\\begin{document}
\\maketitle
`
}

export function getAtlasTemplate(project: Project, themeColor?: string, workspaceId = ""): string {
  const override = posterThemeOverride(themeColor)
  const m = resolveOutputMetadata(project)
  const title = parseMarkdownToLatex(m.title)
  const authors = parseMarkdownToLatex(m.authors)
  const venue = parseMarkdownToLatex(m.venue)
  const rightLogo = m.secondaryLogoUrl
    ? (workspaceId ? assetUrlToLatexPath(m.secondaryLogoUrl, workspaceId) : m.secondaryLogoUrl)
    : "logos/atlas_transparent.png"
  const leftLogo = m.logoUrl
    ? (workspaceId ? assetUrlToLatexPath(m.logoUrl, workspaceId) : m.logoUrl)
    : "logos/uk_logo.png"

  return `
% [AI-CONTEXT] You are inside an ATLAS (CERN) tikzposter poster template.
% Use \\block{Title}{Content} for each card section.
% Enclose blocks within \\column{width} commands (e.g. \\column{0.33}).
\\documentclass[a0paper,portrait, blockverticalspace=3em, colspace=2em]{tikzposter}
\\tikzposterlatexaffectionproofoff
\\usepackage{graphicx}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{multicol}
\\usetikzlibrary{calc}

\\newcommand{\\looseitems}{\\begin{itemize}\\setlength{\\itemsep}{0.3em}}
\\newcommand{\\tightitems}{\\begin{itemize}\\setlength{\\itemsep}{0.15em}}
\\newcommand{\\captiontext}[1]{#1}

\\usetheme{Default}

\\definecolor{maincolor}{HTML}{9e2b2f}
\\definecolor{secondarycolor}{RGB}{158, 43, 47}
\\definecolor{lightred}{RGB}{237, 199, 201}
${override}
\\definecolorstyle{atlascolors}{
    \\colorlet{backgroundcolor}{white}
    \\colorlet{titlefgcolor}{white}
    \\colorlet{titlebgcolor}{maincolor}
    \\colorlet{blocktitlefgcolor}{white}
    \\colorlet{blocktitlebgcolor}{maincolor}
    \\colorlet{blockbodyfgcolor}{black}
    \\colorlet{blockbodybgcolor}{lightred!25}
}{}
\\usecolorstyle{atlascolors}

\\definetitlestyle{sampletitle}{width=760mm, roundedcorners=20, linewidth=2pt,
  innersep=10pt, titletotopverticalspace=6mm, titletoblockverticalspace=8mm}{%
  \\begin{scope}[line width=\\titlelinewidth, rounded corners=\\titleroundedcorners]
    \\draw[color=blocktitlebgcolor, fill=titlebgcolor]
      (\\titleposleft,\\titleposbottom) rectangle (\\titleposright,\\titlepostop);
  \\end{scope}
  \\node[anchor=east, fill=white, rounded corners=10pt, inner sep=10pt, xshift=5mm]
    at ($(\\titleposright,\\titlepostop)!0.5!(\\titleposright,\\titleposbottom)$)
    {\\includegraphics[height=8.6cm]{${rightLogo}}};
  \\node[anchor=west, fill=white, rounded corners=10pt, inner sep=10pt, xshift=-45mm, yshift=5mm]
    at ($(\\titleposleft,\\titlepostop)!0.5!(\\titleposleft,\\titleposbottom)$)
    {\\includegraphics[height=15cm]{${leftLogo}}};}
\\usetitlestyle{sampletitle}

\\title{\\parbox{0.74\\linewidth}{\\centering\\huge
    ${title}\\\\[1mm]
    }}
\\author{\\Large ${authors}}
\\institute{\\normalsize ${venue}}
\\date{}

\\begin{document}
\\maketitle
`
}

export function getGeminiTemplate(project: Project, themeColor?: string): string {
  const override = beamerThemeOverride(themeColor)
  const { title, authors, venue } = getMeta(project)
  return `
% [AI-CONTEXT] You are inside a gemini beamerposter template.
% Use \\begin{block}{Title} ... \\end{block} for each section.
% Enclose blocks within \\begin{column}{width} ... \\end{column} (e.g. \\begin{column}{0.31\\textwidth}).
\\documentclass[final]{beamer}
\\usepackage[orientation=portrait,size=a0,scale=1.2]{beamerposter}
\\usepackage[utf8]{inputenc}
\\usepackage{graphicx}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{booktabs}

\\usetheme{Madrid}
\\usecolortheme{default}

% Gemini-inspired minimalist styling for Beamerposter
\\definecolor{customaccent}{HTML}{4F46E5}
${override}
\\setbeamercolor{headline}{fg=white,bg=customaccent}
\\setbeamercolor{title in headline}{fg=white}
\\setbeamercolor{author in headline}{fg=white!90}
\\setbeamercolor{institute in headline}{fg=white!80}
\\setbeamercolor{structure}{fg=customaccent}
\\setbeamercolor{block title}{fg=white,bg=customaccent}
\\setbeamercolor{block body}{fg=black,bg=customaccent!8}
\\setbeamertemplate{navigation symbols}{}
\\setbeamertemplate{headline}{
  \\leavevmode
  \\begin{beamercolorbox}[wd=\\paperwidth,leftskip=2cm,rightskip=2cm,sep=1.5cm]{headline}
    \\usebeamerfont{title in headline}{\\huge \\bfseries ${title}\\par}
    \\vspace{0.8ex}
    \\usebeamerfont{author in headline}{\\Large ${authors}\\par}
    \\vspace{0.4ex}
    \\usebeamerfont{institute in headline}{\\large ${venue}\\par}
  \\end{beamercolorbox}
  \\vspace{1cm}
}

\\begin{document}
\\begin{frame}[fragile,t]
`
}

export function getTikzposterTemplate(project: Project, themeColor?: string): string {
  const override = posterThemeOverride(themeColor)
  const { title, authors, venue } = getMeta(project)
  return `
% [AI-CONTEXT] You are inside a standard tikzposter template.
% Use \\block{Title}{Content} for each card section.
% Enclose blocks within \\column{width} commands (e.g. \\column{0.33}).
\\documentclass[a0paper,portrait, blockverticalspace=3em, colspace=2em]{tikzposter}
\\tikzposterlatexaffectionproofoff
\\usepackage{graphicx}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{multicol}
${override}
\\usetheme{Board}

\\title{\\parbox{0.74\\linewidth}{\\centering\\huge
    ${title}\\\\[1mm]
    }}
\\author{\\Large ${authors}}
\\institute{\\normalsize ${venue}}
\\date{}

\\begin{document}
\\maketitle
`
}

export function getA0PosterTemplate(project: Project, _themeColor?: string): string {
  const { title, authors } = getMeta(project)
  return `
% [AI-CONTEXT] You are inside a classic a0poster document.
% Use standard \\section commands or minipages.
\\documentclass[a0,portrait]{a0poster}
\\usepackage{graphicx}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{multicol}

\\title{\\Huge ${title}}
\\author{\\Large ${authors}}
\\date{}

\\begin{document}
\\maketitle
`
}
// ---------------------------------------------------------------------------
// SLIDES
// ---------------------------------------------------------------------------

export function getMetropolisTemplate(project: Project, themeColor?: string): string {
  const override = beamerThemeOverride(themeColor)
  const { title, authors, venue } = getMeta(project)
  return `
% [AI-CONTEXT] You are inside a Metropolis Beamer presentation.
% Use \\begin{frame}{Title} ... \\end{frame} for each slide.
% Note: The Metropolis theme handles title formatting automatically.
\\documentclass{beamer}
\\usetheme{metropolis}
${override}\\usepackage[utf8]{inputenc}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage{amsmath}

\\title{${title}}
\\author{${authors}}
\\institute{${venue}}

\\begin{document}
\\begin{frame}
\\titlepage
\\end{frame}
`
}

export function getBeamerAtlasTemplate(project: Project, themeColor?: string): string {
  const override = beamerThemeOverride(themeColor)
  const { title, authors, venue } = getMeta(project)
  return `
% [AI-CONTEXT] You are inside an ATLAS-branded Beamer presentation.
% Use \\begin{frame}{Title} ... \\end{frame} for each slide.
\\documentclass{beamer}
\\usetheme{Madrid}
\\definecolor{atlasred}{RGB}{158,43,47}
\\setbeamercolor{structure}{fg=atlasred}
${override}\\usepackage[utf8]{inputenc}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage{amsmath}

\\title{${title}}
\\author{${authors}}
\\institute{${venue}}

\\begin{document}
\\begin{frame}
\\titlepage
\\end{frame}
`
}

export function getMadridTemplate(project: Project, themeColor?: string): string {
  const override = beamerThemeOverride(themeColor)
  const { title, authors, venue } = getMeta(project)
  return `
% [AI-CONTEXT] You are inside a Madrid Beamer presentation.
% Use \\begin{frame}{Title} ... \\end{frame} for each slide.
\\documentclass{beamer}
\\usetheme{Madrid}
${override}\\usepackage[utf8]{inputenc}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage{amsmath}

\\title{${title}}
\\author{${authors}}
\\institute{${venue}}

\\begin{document}
\\begin{frame}
\\titlepage
\\end{frame}
`
}

export function getDefaultTemplate(project: Project, themeColor?: string): string {
  const override = beamerThemeOverride(themeColor)
  const { title, authors, venue } = getMeta(project)
  return `
% [AI-CONTEXT] You are inside a Default Beamer presentation.
% Use \\begin{frame}{Title} ... \\end{frame} for each slide.
\\documentclass{beamer}
\\usetheme{default}
${override}\\usepackage[utf8]{inputenc}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage{amsmath}

\\title{${title}}
\\author{${authors}}
\\institute{${venue}}

\\begin{document}
\\begin{frame}
\\titlepage
\\end{frame}
`
}

export function getFocusTemplate(project: Project, themeColor?: string): string {
  const override = beamerThemeOverride(themeColor)
  const { title, authors, venue } = getMeta(project)
  return `
% [AI-CONTEXT] You are inside a Focus Beamer presentation.
% Use \\begin{frame}{Title} ... \\end{frame} for each slide.
\\documentclass{beamer}
\\usetheme[nofirafonts]{focus}
${override}\\usepackage[utf8]{inputenc}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage{amsmath}

\\title{${title}}
\\author{${authors}}
\\institute{${venue}}

\\begin{document}
\\begin{frame}
\\titlepage
\\end{frame}
`
}

// ---------------------------------------------------------------------------
// PAPERS
// ---------------------------------------------------------------------------

export function getTwoColumnTemplate(project: Project): string {
  const { title, authors, venue } = getMeta(project)
  return `
% [AI-CONTEXT] You are inside a two-column article document.
% Use standard \\section{}, \\subsection{} commands.
% For wide figures that must span across both columns, use \\begin{figure*} ... \\end{figure*}.
\\documentclass[11pt, a4paper, twocolumn]{article}
\\usepackage[utf8]{inputenc}
\\usepackage{graphicx}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{booktabs}
\\usepackage[margin=1in]{geometry}
\\usepackage{authblk}

\\title{${title}}
\\author{${authors}}
\\affil{${venue}}
\\date{}

\\begin{document}
\\maketitle
`
}

export function getSingleColumnTemplate(project: Project): string {
  const { title, authors, venue } = getMeta(project)
  return `
% [AI-CONTEXT] You are inside a single-column article document.
% Use standard \\section{}, \\subsection{} commands.
% Wide figures are not needed, use \\begin{figure}[htbp] ... \\end{figure}.
\\documentclass[11pt, a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage{graphicx}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{booktabs}
\\usepackage[margin=1.5in]{geometry}
\\usepackage{authblk}

\\title{${title}}
\\author{${authors}}
\\affil{${venue}}
\\date{}

\\begin{document}
\\maketitle
`
}

export function getIEEEConfTemplate(project: Project): string {
  const { title, authors } = getMeta(project)
  return `
% [AI-CONTEXT] You are inside an IEEEtran conference document.
% Use standard \\section{}, \\subsection{} commands.
\\documentclass[conference]{IEEEtran}
\\usepackage[utf8]{inputenc}
\\usepackage{graphicx}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{booktabs}

\\title{${title}}
\\author{${authors}}

\\begin{document}
\\maketitle
`
}

export function getACMSigconfTemplate(project: Project): string {
  const { title, authors } = getMeta(project)
  return `
% [AI-CONTEXT] You are inside an ACM sigconf document.
% Use standard \\section{}, \\subsection{} commands.
\\documentclass[sigconf]{acmart}
\\usepackage[utf8]{inputenc}
\\usepackage{graphicx}
\\usepackage{booktabs}

\\title{${title}}
\\author{${authors}}

\\begin{document}
\\maketitle
`
}

export function getSpringerLLNCSTemplate(project: Project): string {
  const { title, authors } = getMeta(project)
  return `
% [AI-CONTEXT] You are inside a Springer llncs document.
% Use standard \\section{}, \\subsection{} commands.
\\documentclass{llncs}
\\usepackage[utf8]{inputenc}
\\usepackage{graphicx}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{booktabs}

\\title{${title}}
\\author{${authors}}

\\begin{document}
\\maketitle
`
}
