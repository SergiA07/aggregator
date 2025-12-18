# Portfolio Aggregator - Web App

A modern React dashboard for tracking investment portfolios across multiple brokers.

## Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | React 19 + Vite 7 |
| **Routing** | TanStack Router (file-based) |
| **Data Fetching** | TanStack Query v5 |
| **State Management** | Zustand (client) + TanStack Query (server) |
| **UI Components** | Shadcn/ui + Tailwind CSS v4 |
| **Forms** | React 19 Actions + useActionState |
| **Authentication** | Supabase Auth |
| **Notifications** | Sonner |
| **Testing** | Vitest + MSW + Playwright |
| **Build** | Vite + SWC |

## Project Structure

```
src/
├── assets/                    # Build-processed assets (images, fonts, icons)
├── routes/                    # TanStack Router file-based routes
│   ├── __root.tsx            # Root layout (providers)
│   ├── login.tsx             # /login
│   ├── _authenticated.tsx    # Protected layout
│   └── _authenticated/
│       ├── dashboard.tsx     # /dashboard
│       ├── positions.tsx     # /positions
│       ├── transactions.tsx  # /transactions
│       └── accounts.tsx      # /accounts
│
├── features/                  # Feature modules (1:1 with routes)
│   ├── auth/
│   ├── dashboard/
│   ├── positions/
│   ├── transactions/
│   └── accounts/
│
├── components/
│   ├── ui/                   # Shadcn primitives (DO NOT EDIT directly)
│   ├── composed/             # Custom component compositions
│   └── layout/               # App layout (Header, Sidebar, PageLayout)
│
├── hooks/
│   ├── api/                  # TanStack Query hooks
│   └── ...                   # Other shared hooks
│
├── stores/                    # Zustand stores
├── utils/                     # Shared utilities
├── lib/                       # External service clients
├── types/                     # Shared TypeScript types
└── __tests__/                 # Shared test utilities
```

## Getting Started

### Prerequisites

- Node.js 20+
- Bun 1.0+
- Docker (for local Supabase)

### Development

```bash
# From monorepo root
bun install

# Start local Supabase
bunx supabase start

# Start dev server
bun run dev:web
```

The app runs at `http://localhost:5173`

### Environment Variables

Create `.env` in the web app directory:

```env
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Architecture Decisions

### Feature-First Organization

Code is organized by business domain, not technical concern. Each feature:

- Maps 1:1 to a route
- Contains its own components, hooks, and tests
- Exports a public API via `index.ts`

### Routes vs Features

- **`routes/`**: Thin page components handling URL, params, loaders
- **`features/`**: Business logic, domain components, feature hooks

### Component Organization

| Folder | Purpose | Edit? |
|--------|---------|-------|
| `components/ui/` | Shadcn primitives | No - treat as vendor |
| `components/composed/` | Custom compositions | Yes |
| `components/layout/` | App layout | Yes |

### State Management

| State Type | Tool | Storage |
|------------|------|---------|
| Server state | TanStack Query | API cache |
| Client preferences | Zustand + persist | localStorage |
| Ephemeral UI | React useState | Memory |

### Mutations Strategy

| Use Case | Tool |
|----------|------|
| API mutations affecting cache | TanStack Query `useMutation` |
| Simple forms (login, settings) | React 19 `useActionState` |
| Pending UI | `useFormStatus` |

## React 19 Features

We leverage React 19 features applicable to client-side SPAs:

- **React Compiler** - Auto-optimization (no manual memo/useCallback)
- **`use()` hook** - Cleaner context reading
- **`useOptimistic`** - Optimistic UI updates
- **`useActionState`** - Form state for simple forms
- **`useFormStatus`** - Pending states in forms

## Testing

### Unit Tests (Vitest)

Co-located with source files:

```bash
bun test                    # Run all tests
bun test --watch           # Watch mode
bun test src/utils         # Test specific directory
```

### Integration Tests (Vitest + MSW)

Located in `features/<feature>/__tests__/`:

```bash
bun test src/features/positions/__tests__
```

### E2E Tests (Playwright)

Located at monorepo root `/e2e/`:

```bash
cd ../..
bun run test:e2e
```

## Code Style

- **Formatting**: Biome (not Prettier/ESLint)
- **Path Aliases**: `@/*` maps to `src/*`
- **File Naming**: kebab-case (`submit-button.tsx`)
- **Components**: PascalCase (`SubmitButton`)

Run linting:

```bash
bunx biome check --write .
```

## Navigation

- **Sidebar**: Primary navigation (Dashboard, Positions, Transactions, Accounts)
- **Tabs**: Sub-views within pages
- **Command Menu (Cmd+K)**: Quick navigation (future)

## Error Handling

Global error handling via TanStack Query callbacks:

- **Query errors**: Toast for background refetch failures
- **Mutation errors**: Toast with custom message via `meta`
- **Local errors**: Component-level error UI

## Contributing

1. Create feature branch from `main`
2. Follow the feature-first architecture
3. Add tests for new functionality
4. Run `bun run lint` and `bun run type-check`
5. Submit PR with description
