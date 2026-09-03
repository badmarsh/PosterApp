# syntax=docker/dockerfile:1.7
# Production image for PosterApp (Next.js + custom Yjs WebSocket server).
#
# LaTeX compilation is NOT performed in this image: set LATEX_COMPILER_IMAGE
# and mount the Docker socket (or run a sidecar) — see lib/latex/compiler-runner.ts.

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# ---- deps ------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# ---- build -----------------------------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time public env (safe to bake); server secrets are injected at runtime.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_YJS_WS_URL
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
    NEXT_PUBLIC_YJS_WS_URL=$NEXT_PUBLIC_YJS_WS_URL \
    NODE_ENV=production
RUN pnpm exec prisma generate && pnpm build
# Drop dev-only packages from the tree we ship.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm prune --prod

# ---- runtime ---------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production PORT=3333 HOST=0.0.0.0 WORKSPACES_DIR=/data/workspaces YPERSISTENCE=/data/yjs
RUN groupadd -r app && useradd -r -g app -d /app app \
 && mkdir -p /data/workspaces /data/yjs && chown -R app:app /data
COPY --from=build --chown=app:app /app/package.json ./
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/.next ./.next
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/server.ts /app/next.config.mjs /app/tsconfig.json ./
COPY --from=build --chown=app:app /app/lib ./lib
USER app
EXPOSE 3333
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm start"]
