/**
 * Scoped fetch wrapper that injects the auth bearer token
 * only for internal API requests (relative `/api/...` paths).
 *
 * Replaces the previous global `window.fetch` monkey-patch
 * which injected Authorization into ALL requests, including
 * CDN/external URLs — breaking libraries like react-pdf's
 * pdfjs-dist worker loader.
 */
import { getAiModelOverrideHeaders } from "@/lib/settings-store"

export async function apiFetch(
  url: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  // Clerk handles authentication via secure HttpOnly cookies automatically,
  // so we no longer need to manually inject a static Authorization header.
  // Inject AI model override headers for user-configured model preferences
  const overrideHeaders = getAiModelOverrideHeaders()
  if (Object.keys(overrideHeaders).length > 0) {
    init = init || {}
    init.headers = {
      ...(init.headers || {}),
      ...overrideHeaders,
    }
  }

  const res = await fetch(url, init)

  // Guard against HTML redirects (e.g. Clerk dev-browser handshake or /sign-in redirect)
  // for API routes that expect JSON. This prevents `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`.
  const urlStr = typeof url === "string" ? url : url instanceof URL ? url.pathname : (url as Request).url
  if (urlStr && urlStr.includes("/api/") && !urlStr.includes("/assets/")) {
    const contentType = res.headers.get("content-type") || ""
    if (res.redirected && res.url && res.url.includes("/sign-in")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", message: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }
    if (contentType.includes("text/html") && (res.status === 200 || res.status === 307)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", message: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }
  }

  return res
}
