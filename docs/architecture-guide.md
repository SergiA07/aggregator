# Portfolio Aggregator - Project Architecture

A full-stack investment portfolio aggregation platform built as a TypeScript monorepo.

---

## Table of Contents

1. [For Dummies - Quick Overview](#for-dummies---quick-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Applications](#applications)
5. [Database Schema](#database-schema)
6. [Authentication & Security](#authentication--security)
7. [Communication Patterns](#communication-patterns)
8. [Development Workflow](#development-workflow)

---

## For Dummies - Quick Overview

### What is this project?

This is a **personal finance dashboard** that helps you track your investments across multiple brokers (like DeGiro, Trade Republic, Interactive Brokers) and bank accounts in one place.

### How does it work?

Think of it like this:

```
┌─────────────────────────────────────────────────────────────┐
│                     YOUR BROWSER                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           React Dashboard (port 5173)                │   │
│  │  - Shows your portfolio value                        │   │
│  │  - Lists all your accounts                           │   │
│  │  - Displays gains/losses                             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND SERVICES                          │
│                                                             │
│  ┌──────────────────┐    ┌──────────────────┐              │
│  │ NestJS API       │    │ Python Service   │              │
│  │ (port 3000)      │    │ (port 8000)      │              │
│  │                  │    │                  │              │
│  │ - User accounts  │    │ - Web scraping   │              │
│  │ - Positions      │    │ - YouTube data   │              │
│  │ - Transactions   │    │ - News fetching  │              │
│  └────────┬─────────┘    └──────────────────┘              │
│           │                                                 │
│           ▼                                                 │
│  ┌──────────────────────────────────────────┐              │
│  │         Supabase (port 54321)            │              │
│  │  - PostgreSQL Database (port 54322)      │              │
│  │  - User Authentication                    │              │
│  │  - Row-Level Security                     │              │
│  └──────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

### Key Concepts

| Term | What it means |
|------|---------------|
| **Monorepo** | All code (frontend, backend, shared) lives in one repository |
| **Supabase** | A service that handles user login and database - like Firebase but open source |
| **Prisma** | A tool that makes database queries type-safe and easier to write |
| **NestJS** | A backend framework (like Express but more organized) |
| **React Query** | Handles fetching data from the API and caching it |

### Running the project

```bash
# 1. Start Supabase (database + auth)
supabase start

# 2. Start all services
bun run dev

# This starts:
# - React app at http://localhost:5173
# - NestJS API at http://localhost:3000
# - Python service at http://localhost:8000
```

---

## Tech Stack

### Runtime & Package Management

| Tool | Purpose |
|------|---------|
| **Bun 1.1.6** | JavaScript runtime and package manager (faster than Node + npm) |
| **Turbo** | Monorepo build orchestration (runs tasks in parallel) |

### Backend (apps/api)

| Technology | Purpose |
|------------|---------|
| **NestJS 11** | Backend framework with dependency injection |
| **Fastify** | HTTP server (2x faster than Express) |
| **Prisma** | Type-safe ORM for PostgreSQL |
| **Supabase JS** | Authentication and database client |
| **Swagger** | Auto-generated API documentation |
| **yahoo-finance2** | Stock price data |
| **csv-parse** | CSV file import |

### Frontend (apps/web)

| Technology | Purpose |
|------------|---------|
| **React 19** | UI framework with Compiler, Actions, useOptimistic |
| **Vite 7** | Build tool and dev server |
| **TanStack Router** | Type-safe file-based routing |
| **TanStack Query v5** | Server state management |
| **Zustand** | Client state management (preferences) |
| **Shadcn/ui** | UI component library |
| **Tailwind CSS v4** | Utility-first styling |
| **Sonner** | Toast notifications |
| **Vitest + MSW** | Unit and integration testing |
| **PWA Plugin** | Offline support and installability |

### Python Service (apps/python-service)

| Technology | Purpose |
|------------|---------|
| **FastAPI** | Async Python web framework |
| **BeautifulSoup4** | HTML parsing for web scraping |
| **httpx** | Async HTTP client |
| **youtube-transcript-api** | YouTube transcript extraction |
| **uvicorn** | ASGI server |

### Infrastructure

| Technology | Purpose |
|------------|---------|
| **Supabase** | Auth + PostgreSQL database + real-time |
| **PostgreSQL 17** | Relational database |
| **Row-Level Security** | Database-level data isolation |

> **📚 See [Supabase Guide](./supabase-guide.md)** for detailed documentation on:
> - What Supabase is and why we use it over Firebase
> - How authentication and RLS work in this project
> - Local development setup (Docker)
> - Production deployment steps
> - Commands reference

### Code Quality

| Tool | Purpose |
|------|---------|
| **TypeScript** | Static typing (strict mode) |
| **Biome** | Linting, formatting, and import organization |

---

## Project Structure

```
my-aggregator-monorepo/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── src/
│   │   │   ├── auth/           # Authentication module
│   │   │   │   ├── supabase.guard.ts
│   │   │   │   ├── supabase.service.ts
│   │   │   │   └── user.decorator.ts
│   │   │   ├── database/       # Prisma database module
│   │   │   ├── portfolio/      # Business logic
│   │   │   │   ├── accounts.controller.ts
│   │   │   │   ├── accounts.service.ts
│   │   │   │   ├── positions.controller.ts
│   │   │   │   └── positions.service.ts
│   │   │   ├── app.module.ts   # Root module
│   │   │   └── main.ts         # Entry point
│   │   └── nest-cli.json
│   │
│   ├── web/                    # React frontend
│   │   ├── src/
│   │   │   ├── assets/         # Build-processed images, fonts, icons
│   │   │   ├── routes/         # TanStack Router file-based routes
│   │   │   │   ├── __root.tsx
│   │   │   │   ├── index.tsx   # "/" redirect
│   │   │   │   ├── login.tsx
│   │   │   │   └── _authenticated/
│   │   │   │       ├── route.tsx  # Auth guard + layout
│   │   │   │       ├── dashboard.tsx
│   │   │   │       ├── positions.tsx
│   │   │   │       └── transactions.tsx
│   │   │   ├── features/       # Feature modules (1:1 with routes)
│   │   │   │   ├── auth/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── positions/
│   │   │   │   ├── transactions/
│   │   │   │   └── accounts/
│   │   │   ├── components/
│   │   │   │   ├── ui/         # Shadcn primitives
│   │   │   │   ├── composed/   # Custom compositions
│   │   │   │   └── layout/     # Header, Sidebar, PageLayout
│   │   │   ├── hooks/          # Shared custom hooks
│   │   │   ├── stores/         # Zustand stores
│   │   │   ├── lib/
│   │   │   │   ├── api/
│   │   │   │   │   ├── client.ts      # API client
│   │   │   │   │   ├── types.ts       # API types
│   │   │   │   │   ├── query-client.ts # TanStack Query config
│   │   │   │   │   └── queries/       # Query options + mutations
│   │   │   │   ├── supabase.ts        # Supabase client
│   │   │   │   ├── router.ts          # TanStack Router config
│   │   │   │   └── router-context.ts  # Router context type
│   │   │   ├── utils/          # Shared utilities
│   │   │   ├── types/          # TypeScript types
│   │   │   └── __tests__/      # Shared test utilities
│   │   └── vite.config.ts
│   │
│   └── python-service/         # FastAPI service
│       ├── main.py             # All endpoints
│       └── pyproject.toml      # Dependencies (uv)
│
├── packages/
│   ├── database/               # Shared Prisma client
│   │   ├── prisma/
│   │   │   └── schema.prisma   # Database schema
│   │   └── src/
│   │       ├── client.ts       # Singleton client
│   │       └── index.ts        # Exports
│   └── shared-types/           # Shared TypeScript types and Zod schemas
│       └── src/
│           ├── api/            # API response types
│           ├── schemas/        # Zod validation schemas (used by API and Web)
│           │   ├── account.ts
│           │   ├── auth.ts
│           │   ├── security.ts
│           │   ├── transaction.ts
│           │   └── index.ts
│           └── index.ts
│
├── supabase/
│   ├── config.toml             # Local dev config
│   └── migrations/
│       └── 00001_enable_rls.sql
│
├── e2e/                        # Playwright E2E tests (full-stack)
│   ├── *.e2e.ts               # Test files
│   ├── playwright-report/     # HTML reports (gitignored)
│   └── test-results/          # Test artifacts (gitignored)
│
├── playwright.config.ts        # Playwright configuration
│
├── .env                        # Environment variables
├── .env.example                # Template
├── package.json                # Root dependencies
├── turbo.json                  # Build configuration
└── tsconfig.json               # TypeScript config
```

---

## Applications

### API (NestJS) - Port 3000

The main backend service handling all business logic.

#### Modules

| Module | Scope | Purpose |
|--------|-------|---------|
| **AuthModule** | Global | JWT verification, user extraction |
| **DatabaseModule** | Global | Prisma client lifecycle |
| **PortfolioModule** | Feature | Accounts and positions CRUD |

#### Endpoints

**Accounts** (`/accounts`) - Protected

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/accounts` | List user's accounts |
| GET | `/accounts/:id` | Get single account |
| POST | `/accounts` | Create account |
| PUT | `/accounts/:id` | Update account |
| DELETE | `/accounts/:id` | Delete account |

**Positions** (`/positions`) - Protected

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/positions` | All positions with details |
| GET | `/positions/summary` | Portfolio totals |
| GET | `/positions/account/:id` | Positions by account |

**System**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Hello World |
| GET | `/health` | Health check |

#### Key Files

- [main.ts](apps/api/src/main.ts) - Fastify bootstrap, CORS, Swagger setup
- [app.module.ts](apps/api/src/app.module.ts) - Root module imports
- [supabase.guard.ts](apps/api/src/auth/supabase.guard.ts) - JWT verification
- [accounts.controller.ts](apps/api/src/portfolio/accounts.controller.ts) - Account endpoints

---

### Web (React) - Port 5173

The frontend dashboard application using a feature-first architecture.

#### Architecture

```
src/
├── routes/           # TanStack Router (file-based)
│   ├── __root.tsx   # Root layout
│   ├── index.tsx    # "/" redirect
│   ├── login.tsx    # "/login"
│   └── _authenticated/
│       ├── route.tsx      # Auth guard + layout
│       ├── dashboard.tsx  # "/dashboard"
│       └── positions.tsx  # "/positions"
├── features/         # Business domains (1:1 with routes)
│   ├── auth/
│   ├── dashboard/
│   ├── positions/
│   ├── transactions/
│   └── accounts/
├── components/
│   ├── ui/          # Shadcn primitives (DO NOT EDIT)
│   ├── composed/    # Custom compositions
│   └── layout/      # Header, Sidebar, PageLayout
├── hooks/           # Shared custom hooks
├── stores/          # Zustand stores
├── lib/api/
│   ├── client.ts       # API client
│   ├── query-client.ts # TanStack Query config
│   └── queries/        # Query options + mutations
└── __tests__/       # Shared test utilities
```

#### Features

- **Authentication**: Email/password login via Supabase
- **Dashboard**: Portfolio summary with value, cost, P&L
- **Sidebar Navigation**: Dashboard, Positions, Transactions, Accounts
- **Tabs within Pages**: Sub-views (e.g., Positions → All | Stocks | ETFs)
- **Dark Theme**: Slate color palette
- **PWA**: Installable with offline support

#### Key Patterns

| Pattern | Implementation |
|---------|----------------|
| **Routing** | TanStack Router (file-based, `route.tsx` for layouts) |
| **Server State** | TanStack Query v5 with `queryOptions()` pattern |
| **Client State** | Zustand with localStorage persist |
| **API Mutations** | TanStack Query `useMutation` in `lib/api/queries/` |
| **Simple Forms** | React 19 `useActionState` |
| **UI Components** | Shadcn/ui primitives + custom compositions |
| **Notifications** | Sonner toasts via global QueryCache callbacks |

#### State Management

```
TanStack Query (Server State) - Function-based key factories
├── accountKeys.lists()       # ['accounts', 'list']
├── accountKeys.detail(id)    # ['accounts', 'detail', id]
├── positionKeys.lists()      # ['positions', 'list']
├── positionKeys.list({accountId})  # ['positions', 'list', {accountId}]
├── positionKeys.summary()    # ['positions', 'summary']
├── transactionKeys.lists()   # ['transactions', 'list']
└── transactionKeys.list(filters)   # ['transactions', 'list', filters]

Zustand (Client State)
└── usePreferences
    ├── sidebarCollapsed
    ├── theme
    └── tablePageSize
```

#### Testing Strategy (3-Tier)

| Tier | Tool | Purpose | File Pattern |
|------|------|---------|--------------|
| **Unit/Integration** | Vitest + jsdom | Logic, hooks, components | `*.test.ts(x)` |
| **Component (Browser)** | Vitest Browser Mode | CSS, Canvas, browser APIs | `*.browser.test.tsx` |
| **E2E** | Playwright | Full user journeys | `e2e/*.e2e.ts` |

**Commands:**
```bash
bun test              # Unit/integration tests
bun test:browser      # Component tests in real browser
bun run e2e           # E2E tests (headless)
bun run dev:mock      # Develop with mocked API (no backend needed)
```

See [.claude/rules/web-testing.md](../.claude/rules/web-testing.md) for full documentation.

#### React 19 Features Used

- **React Compiler**: Auto-optimization (no manual memo/useCallback)
- **`use()` hook**: Cleaner context reading
- **`useOptimistic`**: Optimistic UI updates
- **`useActionState`**: Form state for login/settings
- **`useFormStatus`**: Pending states in submit buttons

---

### Python Service (FastAPI) - Port 8000

Utility service for operations not well-suited for JavaScript, including Trade Republic integration.

#### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/trade-republic/login/init` | Start Trade Republic 2FA login |
| POST | `/trade-republic/login/complete` | Complete login and fetch data |
| POST | `/trade-republic/login/resend` | Resend verification code |
| DELETE | `/trade-republic/session/{id}` | Cancel pending session |
| POST | `/scrape/url` | Scrape web page content |
| GET | `/scrape/sources` | List news sources |
| POST | `/youtube/transcript` | Get video transcript |
| POST | `/youtube/batch` | Batch transcript fetch |

#### Trade Republic Sync Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│  NestJS API │────▶│   Python    │────▶│    Trade    │
│   Modal     │     │   Proxy     │     │   Service   │     │  Republic   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              │ pytr library
                                              ▼
                                        ┌─────────────┐
                                        │  WebSocket  │
                                        │     API     │
                                        └─────────────┘
```

1. User enters phone + PIN in frontend modal
2. NestJS proxies to Python service (keeps API key server-side)
3. Python uses `pytr` library to connect to Trade Republic's WebSocket API
4. User receives 2FA code on Trade Republic app
5. After verification, Python fetches transactions, positions, and cash balances
6. Data returned to NestJS for import into database

#### Use Cases

- **Trade Republic Sync**: Portfolio data via private API (pytr library)
- Scrape financial news from Seeking Alpha, Yahoo Finance, Reuters
- Extract YouTube video transcripts for analysis
- Future: ML-based categorization, sentiment analysis

---

## Database Schema

### Entity Relationship

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   Account   │───────│  Position   │───────│  Security   │
└─────────────┘       └─────────────┘       └─────────────┘
      │                     │                     │
      ├───AccountBalance    │                     │
      │                     ▼                     ▼
      ▼               ┌─────────────┐       ┌─────────────┐
┌─────────────┐       │    User     │       │PriceHistory │
│ Transaction │       │ (Supabase)  │       └─────────────┘
└─────────────┘       └─────────────┘
                            │
                            ▼
                      ┌─────────────┐       ┌─────────────┐
                      │ BankAccount │───────│BankTransact.│
                      └─────────────┘       └─────────────┘
```

### Tables

#### User-Owned (RLS Protected)

| Table | Description | Key Fields |
|-------|-------------|------------|
| **Account** | Broker accounts | type, institution, baseCurrency |
| **AccountBalance** | Cash balances per currency | accountId, currency, balance |
| **Position** | Current holdings | quantity, avgCost, marketValue, unrealizedPnl |
| **Transaction** | Trade history | date, type, quantity, price, fees, fingerprint |
| **BankAccount** | Bank accounts | iban, bankName, balance |
| **BankTransaction** | Bank movements | date, amount, description, category |

**Notes:**
- `AccountBalance` stores cash per currency (e.g., Trade Republic EUR cash)
- `Transaction.fingerprint` prevents duplicate imports (hash of key fields)
- Transactions can have null `securityId` (for interest/fee transactions)

#### Shared (Service Role Managed)

| Table | Description | Key Fields |
|-------|-------------|------------|
| **Security** | Stocks/ETFs/Bonds | symbol, isin, name, securityType, yahooSymbol |
| **PriceHistory** | OHLCV data | date, open, high, low, close, volume |

---

## Authentication & Security

### Authentication Flow

```
1. User Login
   Browser → Supabase Auth → JWT Token

2. API Request
   Browser → API (Bearer Token) → Supabase Verify → User ID

3. Database Query
   API (user_id filter) → PostgreSQL (RLS check) → Data
```

### Security Layers

| Layer | Protection |
|-------|------------|
| **Frontend** | Token stored in Supabase session |
| **API** | SupabaseAuthGuard validates JWT |
| **Service** | Queries filtered by userId |
| **Database** | RLS policies enforce ownership |

### Row-Level Security Policies

```sql
-- User-owned tables: Only owner can access
CREATE POLICY "Users access own accounts" ON accounts
  FOR ALL USING (auth.uid()::text = user_id);

-- Shared tables: Read-only for authenticated users
CREATE POLICY "Authenticated read securities" ON securities
  FOR SELECT USING (auth.role() = 'authenticated');

-- Service role: Full access for backend operations
CREATE POLICY "Service role manage securities" ON securities
  FOR ALL USING (auth.role() = 'service_role');
```

---

## Communication Patterns

### Request Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  React   │────▶│  NestJS  │────▶│ Supabase │────▶│ Postgres │
│   App    │     │   API    │     │   Auth   │     │    DB    │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │
     │                ▼
     │          ┌──────────┐
     │          │  Python  │
     │          │ Service  │
     │          └──────────┘
     │                │
     ▼                ▼
┌──────────┐     ┌──────────┐
│ Supabase │     │ External │
│   Auth   │     │   APIs   │
└──────────┘     └──────────┘
```

### Environment Variables

| Variable | Used By | Purpose |
|----------|---------|---------|
| `SUPABASE_URL` | API | Supabase endpoint |
| `SUPABASE_SECRET_KEY` | API | Backend auth operations |
| `DATABASE_URL` | API | Direct Prisma connection |
| `PYTHON_SERVICE_URL` | API | Python service discovery |
| `VITE_SUPABASE_URL` | Web | Frontend auth |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Web | Frontend auth (public) |
| `VITE_API_URL` | Web | API endpoint |

---

## Development Workflow

### Prerequisites

- Bun 1.1.6+
- Docker (for Supabase)
- Python 3.13+ with uv
- Supabase CLI

### Setup

```bash
# Install dependencies
bun install

# Start Supabase
supabase start

# Generate Prisma client
bun run db:generate

# Push schema to database
bun run db:push

# Start all services
bun run dev
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start all services |
| `bun run dev:api` | Start API only |
| `bun run dev:web` | Start web only |
| `bun run dev:python` | Start Python service |
| `bun run build` | Build all apps |
| `bun run lint` | Lint all apps |
| `bun run db:generate` | Generate Prisma client |
| `bun run db:push` | Push schema to DB |
| `bun run db:studio` | Open Prisma Studio |
| `bun run e2e` | Run E2E tests (headless) |
| `bun run e2e:ui` | E2E tests with interactive UI |
| `bun run e2e:debug` | E2E tests in debug mode |

### Ports

| Service | Port | URL |
|---------|------|-----|
| React App | 5173 | http://localhost:5173 |
| NestJS API | 3000 | http://localhost:3000 |
| Python Service | 8000 | http://localhost:8000 |
| Supabase API | 54321 | http://localhost:54321 |
| PostgreSQL | 54322 | localhost:54322 |
| Supabase Studio | 54323 | http://localhost:54323 |

### API Documentation

Swagger UI available at: http://localhost:3000/api/docs
