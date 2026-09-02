export function indent(s: string, n = 2): string {
  const pad = " ".repeat(n)
  return s
    .split("\n")
    .map((l) => (l ? pad + l : l))
    .join("\n")
}

/**
 * LaTeX cannot handle Windows backslash separators in \includegraphics paths:
 * `assets\remote\fig.jpg` is parsed as control sequences (`\r`, `\remote`).
 * Always emit forward slashes in generated .tex.
 */
export function normalizeLatexPath(p: string): string {
  return p.replace(/\\/g, "/")
}

export function assetUrlToLatexPath(apiUrl: string, workspaceId: string): string {
  const prefix = `/api/workspaces/${workspaceId}/assets/`
  if (apiUrl.startsWith(prefix)) {
    return normalizeLatexPath(`assets/${apiUrl.slice(prefix.length)}`)
  }
  return normalizeLatexPath(apiUrl)
}

export function cleanCaption(caption: string | undefined, prefix: "Figure" | "Table"): string {
  if (!caption || typeof caption !== "string") return ""
  const regex = prefix === "Figure" 
    ? /^(?:Figure|Fig\.?)\s*\d*[:\.\s-]*/i 
    : /^(?:Table|Tab\.?)\s*\d*[:\.\s-]*/i
  return caption.replace(regex, "").trim()
}
