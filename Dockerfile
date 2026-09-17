# ==============================================================================
# PosterApp Production Dockerfile (Multi-Stage Build)
# Next.js 16 + React 19 + Custom tsx/WebSocket Server (server.ts)
# ==============================================================================

FROM node:20-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# --- 1. Dependencies ---
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/
RUN pnpm install --frozen-lockfile

# --- 2. Builder ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client for debian runtime
RUN npx prisma generate

# Build Next.js production bundle
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=8192"
RUN pnpm run build

# --- 3. Runner (Production) ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3333
ENV HOSTNAME="0.0.0.0"
ENV WORKSPACES_DIR=workspaces
ENV YPERSISTENCE=./tmp/yjs
ENV CACHE_DIR=/app/.cache

# Non-root system user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 -g nodejs nextjs

# Create persistent storage directories
RUN mkdir -p /app/workspaces /app/tmp/yjs /app/.cache && \
    chown -R nextjs:nodejs /app/workspaces /app/tmp /app/.cache

# Copy application assets
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs

USER nextjs
EXPOSE 3333

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3333/healthz || exit 1

CMD ["npx", "tsx", "server.ts"]
