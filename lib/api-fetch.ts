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

export function apiFetch(
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
  return fetch(url, init)
}
