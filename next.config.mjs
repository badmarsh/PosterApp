import path from "node:path"

const aiOrigin = (() => { try { return new URL(process.env.AI_API_URL ?? "").origin } catch { return null } })()
const aiFallbackOrigin = (() => { try { return new URL(process.env.AI_API_URL_FALLBACK ?? "").origin } catch { return null } })()
const yjsOrigin = (() => {
  const wsUrl = process.env.NEXT_PUBLIC_YJS_WS_URL
  if (!wsUrl) return null
  try {
    const parsed = new URL(wsUrl)
    return `${parsed.protocol === "wss:" ? "https:" : "http:"}//${parsed.host}`
  } catch {
    return null
  }
})()

const connectSrc = [
  "'self'",
  "https://*.clerk.accounts.dev",
  "https://*.clerk.com",
  aiOrigin,
  aiFallbackOrigin,
  yjsOrigin,
].filter(Boolean).join(" ")

// 'unsafe-eval' is only needed by React Fast Refresh / Turbopack in development.
// 'unsafe-inline' remains for Next's inline bootstrap + Clerk; migrating to a
// nonce-based policy is tracked separately.
const scriptSrcEval = process.env.NODE_ENV === "production" ? "" : "'unsafe-eval'"

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' ${scriptSrcEval} https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com;
  worker-src 'self' blob:;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https://*.clerk.com https://img.clerk.com https://images.unsplash.com;
  font-src 'self' data:;
  connect-src ${connectSrc};
  frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com;
  object-src 'self';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
`.replace(/\s{2,}/g, " ").trim()

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: cspHeader,
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: import.meta.dirname,
    resolveAlias: {
      "tailwindcss": path.resolve(import.meta.dirname, "node_modules/tailwindcss"),
      "tw-animate-css": path.resolve(import.meta.dirname, "node_modules/tw-animate-css"),
      "shadcn/tailwind.css": path.resolve(import.meta.dirname, "node_modules/shadcn/tailwind.css"),
    },
  },
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "127.0.0.1:3333",
    "localhost:3333",
    "192.168.0.100",
    "192.168.0.100:3333",
    "0.0.0.0",
    "0.0.0.0:3333",
  ],
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["yjs"],
  experimental: {
    serverActions: {
      bodySizeLimit: "210mb",
    },
    proxyClientMaxBodySize: "210mb",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig

