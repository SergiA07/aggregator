# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Install bun
RUN npm install -g bun

# Copy root package files
COPY package.json bun.lockb ./
COPY turbo.json ./

# Copy workspace packages
COPY packages/database/package.json ./packages/database/
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY packages/database ./packages/database
COPY apps/api ./apps/api
COPY tsconfig.json ./

# Generate Prisma client
RUN cd packages/database && bun run db:generate

# Build the API
RUN cd apps/api && bun run build

# Production stage
FROM node:24-alpine AS runner

WORKDIR /app

# Install bun for runtime
RUN npm install -g bun

# Copy built assets
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=builder /app/packages/database/src/generated ./packages/database/src/generated
COPY --from=builder /app/packages/database/package.json ./packages/database/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/package.json ./apps/api/

ENV NODE_ENV=production
ENV PORT=3333

EXPOSE 3333

WORKDIR /app/apps/api

CMD ["node", "dist/main.js"]
