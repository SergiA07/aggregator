# syntax=docker/dockerfile:1

# Stage 1: Prune monorepo for minimal Docker context
FROM oven/bun:1 AS pruner

WORKDIR /app

# Install turbo globally
RUN bun add -g turbo

# Copy entire monorepo
COPY . .

# Prune to only @repo/api and its dependencies
RUN turbo prune @repo/api --docker

# Stage 2: Install dependencies and build
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy pruned package.json files (for dependency caching)
COPY --from=pruner /app/out/json/ .

# Install dependencies (this layer is cached unless package.json changes)
RUN bun install --frozen-lockfile

# Copy pruned source code
COPY --from=pruner /app/out/full/ .

# Generate Prisma client
RUN cd packages/database && bun run db:generate

# Build the API
RUN cd apps/api && bun run build

# Stage 3: Production runtime
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# Security: run as non-root user
USER bun

# Copy only production artifacts
COPY --from=builder --chown=bun:bun /app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=builder --chown=bun:bun /app/packages/database/src/generated ./packages/database/src/generated
COPY --from=builder --chown=bun:bun /app/packages/database/package.json ./packages/database/
COPY --from=builder --chown=bun:bun /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=bun:bun /app/apps/api/package.json ./apps/api/

# Environment
ENV NODE_ENV=production
ENV PORT=3333

EXPOSE 3333

WORKDIR /app/apps/api

# Healthcheck for container orchestration
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3333/health || exit 1

CMD ["bun", "run", "dist/main.js"]
