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
  // Clerk handles authentication via secure HttpOnly cookies automatically,
  // so we no longer need to manually inject a static Authorization header.
  return fetch(url, init)
}
