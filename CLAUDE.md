# Portfolio Aggregator Monorepo

A Turborepo monorepo for tracking investment portfolios across multiple brokers.

## Tech Stack

- **Runtime**: Bun (package manager, test runner, dev server)
- **Monorepo**: Turborepo with Bun workspaces
- **API**: NestJS 11 + Fastify (not Express)
- **Frontend**: React 19 + Vite 7 + TanStack Router + TanStack Query
- **Database**: PostgreSQL via Supabase + Prisma v7 (with driver adapters)
- **Auth**: Supabase Auth
- **Linting/Formatting**: Biome (not ESLint/Prettier)
- **Python Service**: FastAPI with uv package manager

## Project Structure

```
apps/
  api/           # NestJS API with Clean Architecture
  web/           # React frontend (Vite + TanStack)
  python-service/# FastAPI service

packages/
  database/      # Prisma schema and client (@repo/database)
  shared-types/  # Shared TypeScript types (@repo/shared-types)
  config/        # Shared configs (Biome, TypeScript)
```

## Common Commands

```bash
# Development
bun install              # Install all dependencies
bun run dev              # Start all services (API + Web + Python)
bun run dev:api          # Start only API
bun run dev:web          # Start only frontend
bun run dev:mock         # Start web with mocked API (MSW)

# Database
bunx supabase start      # Start local Supabase (requires Docker)
bun run db:generate      # Generate Prisma client
bun run db:push          # Push schema to database (dev only)
bun run db:migrate       # Create new migration (dev)
bun run db:migrate:deploy # Apply migrations (production)
bun run db:migrate:status # Check migration status
bun run db:studio        # Open Prisma Studio

# Quality
bun run lint             # Run Biome linter
bun run type-check       # TypeScript type checking
bun run test             # Run unit/integration tests (jsdom)
bun run build            # Build all packages

# API-specific (from apps/api/)
bun test                 # Run Bun tests
bun test --watch         # Watch mode

# Web-specific (from apps/web/)
bun test                 # Run Vitest unit/integration tests (jsdom)
bun test:browser         # Run component tests in real Chromium

# E2E Tests (Playwright - from monorepo root)
bun run e2e              # Run E2E tests (headless)
bun run e2e:ui           # Run E2E tests with interactive UI
bun run e2e:debug        # Run E2E tests in debug mode
```

## Environment Variables

Required in `.env` at monorepo root:
- `DATABASE_URL` - PostgreSQL connection string
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_KEY` - Supabase service role key

## API Endpoints

- Health: `GET /health`
- Swagger docs: `GET /api/docs`
- All API routes prefixed with `/api/v1/`

## Key Conventions

- Use Biome for formatting (not Prettier) - run `bunx biome check --write .`
- Use Bun test runner for API tests (not Jest)
- Use Vitest for frontend tests (when implemented)
- Import from package barrel exports: `@repo/database`, `@repo/shared-types`
- API follows Clean Architecture: domain > application > infrastructure > presentation
