# syntax=docker/dockerfile:1

# Stage 1: Prune monorepo for minimal Docker context
FROM oven/bun:1 AS pruner

WORKDIR /app

# Install turbo globally
RUN bun add -g turbo@2.6.3

# Copy entire monorepo
COPY . .

# Prune to only @repo/api and its dependencies
# Creates: out/json/ (package.jsons + lockfile), out/full/ (source), out/bun.lock
RUN turbo prune @repo/api --docker

# Stage 2: Install dependencies
FROM oven/bun:1 AS installer

WORKDIR /app

# Copy pruned package.json files AND lockfile (both are in out/json/)
COPY --from=pruner /app/out/json/ .

# Install ALL dependencies (dev + prod) for building
# --frozen-lockfile removed due to Bun+Turbo prune compatibility (v2)
RUN bun install

# Stage 3: Build the application
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy installed dependencies
COPY --from=installer /app/node_modules ./node_modules

# Copy pruned source code
COPY --from=pruner /app/out/full/ .

# Generate Prisma client
RUN cd packages/database && bun run db:generate

# Build the API
RUN cd apps/api && bun run build

# Stage 4: Production dependencies only
FROM oven/bun:1 AS prod-deps

WORKDIR /app

# Copy pruned package.json files AND lockfile
COPY --from=pruner /app/out/json/ .

# Install production dependencies only (v2)
RUN bun install --production

# Stage 5: Production runtime
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# Security: run as non-root user
USER bun

# Copy production node_modules
COPY --from=prod-deps --chown=bun:bun /app/node_modules ./node_modules

# Copy Prisma generated client
COPY --from=builder --chown=bun:bun /app/packages/database/src/generated ./packages/database/src/generated
COPY --from=builder --chown=bun:bun /app/packages/database/package.json ./packages/database/

# Copy API build output
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
