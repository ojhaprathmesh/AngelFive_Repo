# syntax=docker/dockerfile:1

# Stage 1: Dependencies & Compilation
FROM node:24.16.0-alpine AS builder
WORKDIR /app
ENV pnpm_config_package_import_method=copy
RUN --mount=type=cache,id=corepack,target=/root/.cache/node/corepack \
    corepack enable pnpm

COPY package.json ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --ignore-scripts
RUN pnpm approve-builds esbuild protobufjs @firebase/util && pnpm rebuild esbuild protobufjs @firebase/util

COPY . .
RUN npx tsc --build tsconfig.docker.json --force

# Stage 2: Production dependencies only
FROM node:24.16.0-alpine AS prod-deps
WORKDIR /app
ENV pnpm_config_package_import_method=copy
RUN --mount=type=cache,id=corepack,target=/root/.cache/node/corepack \
    corepack enable pnpm

COPY package.json ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --prod --ignore-scripts

# Stage 3: Minimal Production Runtime
FROM node:24.16.0-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=5000 \
    NODE_OPTIONS="--max-old-space-size=512"

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 backend

# Copy only production dependencies and built application code
COPY --from=prod-deps --chown=backend:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=backend:nodejs /app/dist ./dist

USER backend

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

CMD ["node", "dist/server.js"]
