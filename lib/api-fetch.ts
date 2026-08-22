/**
 * Scoped fetch wrapper that injects the auth bearer token
 * only for internal API requests (relative `/api/...` paths).
 *
 * Replaces the previous global `window.fetch` monkey-patch
 * which injected Authorization into ALL requests, including
 * CDN/external URLs — breaking libraries like react-pdf's
 * pdfjs-dist worker loader.
 */
export function apiFetch(
  url: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  // Reverted to localStorage to fix 401 Unauthorized for local user sessions.
  // In a multi-user production environment, this should be replaced with
  // a secure HttpOnly cookie session (e.g. NextAuth/Clerk) managed by the server.
  const token =
    (typeof window !== "undefined" && localStorage.getItem("API_SECRET")) ||
    "change-me-in-production"

  const urlStr =
    typeof url === "string"
      ? url
      : url instanceof URL
        ? url.toString()
        : url instanceof Request
          ? url.url
          : String(url)

  // Only inject auth for our own API routes (relative paths starting with /api)
  const isInternal = urlStr.startsWith("/api") || urlStr.startsWith("api")

  if (!isInternal) {
    return fetch(url, init)
  }

  const headers = new Headers(init?.headers)
  headers.set("Authorization", `Bearer ${token}`)

  return fetch(url, { ...init, headers })
}
