# syntax=docker/dockerfile:1@sha256:ecfaec9ed6d810b56388c508f4121597bfbba70d41a6dfeee4d8cad5f295fc32

# Stage 1: Prune monorepo for minimal Docker context
FROM oven/bun:1.4.2@sha256:9114c058aeae42162ee16dd5084b95fe9473970bb6bcb5b232ab1630f0546895 AS pruner

WORKDIR /app

# Install turbo globally
RUN bun add -g turbo@2.6.3

# Copy entire monorepo
COPY . .

# Prune to only @repo/api and its dependencies
# Creates: out/json/ (package.jsons + lockfile), out/full/ (source), out/bun.lock
RUN turbo prune @repo/api --docker

# Stage 2: Install dependencies
FROM oven/bun:1.4.2@sha256:9114c058aeae42162ee16dd5084b95fe9473970bb6bcb5b232ab1630f0546895 AS installer

WORKDIR /app

# Copy pruned package.json files AND lockfile (both are in out/json/)
COPY --from=pruner /app/out/json/ .

# Install ALL dependencies (dev + prod) for building
# --frozen-lockfile removed due to Bun+Turbo prune compatibility (v2)
RUN bun install

# Stage 3: Build the application
FROM oven/bun:1.4.2@sha256:9114c058aeae42162ee16dd5084b95fe9473970bb6bcb5b232ab1630f0546895 AS builder

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
FROM oven/bun:1.4.2@sha256:9114c058aeae42162ee16dd5084b95fe9473970bb6bcb5b232ab1630f0546895 AS prod-deps

WORKDIR /app

# Copy pruned package.json files AND lockfile
COPY --from=pruner /app/out/json/ .

# Install production dependencies only
# --ignore-scripts prevents the root "prepare" script from running husky
RUN bun install --production --ignore-scripts

# Stage 5: Production runtime
FROM oven/bun:1.4.2-alpine@sha256:d888c0ae6c86d7866ff10c5aafdd9077b36aee6455b33dd270fb93c0dd5cef6f AS runner

WORKDIR /app

# Security: run as non-root user
USER bun

# Copy production node_modules
COPY --from=prod-deps --chown=bun:bun /app/node_modules ./node_modules

# Copy workspace packages (required for module resolution)
# @repo/database: includes src/index.ts, src/client.ts, and generated Prisma client
# @repo/shared-types: includes Zod schemas used for validation
COPY --from=builder --chown=bun:bun /app/packages/database ./packages/database
COPY --from=builder --chown=bun:bun /app/packages/shared-types ./packages/shared-types

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

# Start the application
# Migrations are run in CI/CD before deployment (not at container startup)
# Force rebuild: 2025-12-29-v2
CMD ["bun", "run", "dist/main.js"]
