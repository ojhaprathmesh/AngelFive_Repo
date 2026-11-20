# syntax=docker/dockerfile:1

# Stage 1: Dependencies
FROM node:24.16.0-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV pnpm_config_package_import_method=copy

# Enable corepack for pnpm
RUN --mount=type=cache,id=corepack,target=/root/.cache/node/corepack \
    corepack enable pnpm

COPY package.json ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --ignore-scripts
RUN pnpm approve-builds esbuild && pnpm rebuild esbuild

# Stage 2: Builder
FROM node:24.16.0-alpine AS builder
WORKDIR /app
ENV pnpm_config_package_import_method=copy
RUN --mount=type=cache,id=corepack,target=/root/.cache/node/corepack \
    corepack enable pnpm

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the Next.js app in standalone output mode
ENV NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=cache,id=corepack,target=/root/.cache/node/corepack \
    pnpm build

# Stage 3: Minimal Production Runner
FROM node:24.16.0-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME="0.0.0.0" \
    NODE_OPTIONS="--max-old-space-size=512"

# Set up non-root user and directories in single layer
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    mkdir -p .next && \
    chown nextjs:nodejs .next

# Copy public assets and standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

CMD ["node", "server.js"]
