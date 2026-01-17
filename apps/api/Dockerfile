# syntax=docker/dockerfile:1@sha256:b6afd42430b15f2d2a4c5a02b919e98a525b785b1aaff16747d2f623364e39b6

# Stage 1: Prune monorepo for minimal Docker context
FROM oven/bun:1.3.6@sha256:f20d9cf365ab35529384f1717687c739c92e6f39157a35a95ef06f4049a10e4a AS pruner

WORKDIR /app

# Install turbo globally
RUN bun add -g turbo@2.6.3

# Copy entire monorepo
COPY . .

# Prune to only @repo/api and its dependencies
# Creates: out/json/ (package.jsons + lockfile), out/full/ (source), out/bun.lock
RUN turbo prune @repo/api --docker

# Stage 2: Install dependencies
FROM oven/bun:1.3.6@sha256:f20d9cf365ab35529384f1717687c739c92e6f39157a35a95ef06f4049a10e4a AS installer

WORKDIR /app

# Copy pruned package.json files AND lockfile (both are in out/json/)
COPY --from=pruner /app/out/json/ .

# Install ALL dependencies (dev + prod) for building
# --frozen-lockfile removed due to Bun+Turbo prune compatibility (v2)
RUN bun install

# Stage 3: Build the application
FROM oven/bun:1.3.6@sha256:f20d9cf365ab35529384f1717687c739c92e6f39157a35a95ef06f4049a10e4a AS builder

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
FROM oven/bun:1.3.6@sha256:f20d9cf365ab35529384f1717687c739c92e6f39157a35a95ef06f4049a10e4a AS prod-deps

WORKDIR /app

# Copy pruned package.json files AND lockfile
COPY --from=pruner /app/out/json/ .

# Install production dependencies only
# --ignore-scripts prevents the root "prepare" script from running husky
RUN bun install --production --ignore-scripts

# Stage 5: Production runtime
FROM oven/bun:1.3.6-alpine@sha256:819f91180e721ba09e0e5d3eb7fb985832fd23f516e18ddad7e55aaba8100be7 AS runner

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
