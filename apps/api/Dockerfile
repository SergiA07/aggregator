# syntax=docker/dockerfile:1

# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy root package files first (better layer caching)
COPY package.json bun.lock ./
COPY turbo.json ./

# Copy workspace package.json files
COPY packages/database/package.json ./packages/database/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/api/package.json ./apps/api/

# Install all dependencies (including devDependencies for build)
RUN bun install --frozen-lockfile

# Copy source code
COPY packages/database ./packages/database
COPY packages/shared-types ./packages/shared-types
COPY apps/api ./apps/api
COPY tsconfig.json ./

# Generate Prisma client
RUN cd packages/database && bun run db:generate

# Build the API
RUN cd apps/api && bun run build

# Production stage - minimal image
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# Security: run as non-root user
USER bun

# Copy only what's needed for production
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

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3333/health || exit 1

CMD ["bun", "run", "dist/main.js"]
