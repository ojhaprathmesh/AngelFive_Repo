# syntax=docker/dockerfile:1

# Stage 1: Build
FROM node:24.16.0-alpine AS builder
WORKDIR /app
RUN --mount=type=cache,id=corepack,target=/root/.cache/node/corepack \
    corepack enable pnpm

COPY package.json ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --ignore-scripts
RUN pnpm approve-builds esbuild protobufjs @firebase/util && pnpm rebuild esbuild protobufjs @firebase/util

COPY . .
RUN npx tsc --build tsconfig.docker.json --force

# Stage 2: Runtime
FROM node:24.16.0-alpine AS runner
WORKDIR /app
RUN --mount=type=cache,id=corepack,target=/root/.cache/node/corepack \
    corepack enable pnpm

ENV NODE_ENV production
ENV PORT 5000

# Non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 backend

COPY package.json ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --prod --ignore-scripts

COPY --from=builder --chown=backend:nodejs /app/dist ./dist

USER backend

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

CMD ["node", "dist/server.js"]
