export function indent(s: string, n = 2): string {
  const pad = " ".repeat(n)
  return s
    .split("\n")
    .map((l) => (l ? pad + l : l))
    .join("\n")
}

export function assetUrlToLatexPath(apiUrl: string, workspaceId: string): string {
  const prefix = `/api/workspaces/${workspaceId}/assets/`
  if (apiUrl.startsWith(prefix)) {
    return `assets/${apiUrl.slice(prefix.length)}`
  }
  return apiUrl
}
