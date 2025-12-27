# @repo/database

Shared database package providing Prisma ORM client and schema for the Portfolio Aggregator monorepo.

## Tech Stack

| Component | Technology |
|-----------|------------|
| **ORM** | Prisma 7 |
| **Database** | PostgreSQL (via Supabase) |
| **Runtime** | Bun |
| **Driver** | `@prisma/adapter-pg` |

## Package Structure

```
packages/database/
├── prisma/
│   ├── schema.prisma       # Database schema definition
│   └── migrations/         # Migration history (tracked in Git)
├── prisma.config.ts        # Prisma configuration
├── src/
│   ├── index.ts            # Main export (DatabaseService)
│   ├── client.ts           # Prisma client initialization
│   └── generated/prisma/   # Auto-generated Prisma client
└── package.json
```

## Usage

### Importing in Other Packages

```typescript
// Import the DatabaseService (extends PrismaClient)
import { DatabaseService } from '@repo/database';

// Or import types
import type { Account, Transaction } from '@repo/database';
```

### In NestJS (apps/api)

```typescript
import { DatabaseService } from '@repo/database';

@Injectable()
export class AccountRepository {
  constructor(private readonly db: DatabaseService) {}

  async findByUserId(userId: string) {
    return this.db.account.findMany({
      where: { userId }
    });
  }
}
```

## Commands

Run these from the **monorepo root**:

| Command | Description |
|---------|-------------|
| `make db-migrate` | Create new migration and apply to local DB |
| `make db-migrate-status` | Check which migrations are applied |
| `make db-generate` | Regenerate Prisma client after schema changes |
| `make db-push` | Push schema directly (prototyping only) |
| `make db-studio` | Open visual database browser |
| `make db-reset` | Reset local database (deletes all data!) |

Or use `bun run` equivalents:

```bash
bun run db:migrate
bun run db:migrate:status
bun run db:generate
bun run db:push
bun run db:studio
```

## Schema Overview

The database includes the following models:

| Model | Description |
|-------|-------------|
| `Account` | Broker accounts (DeGiro, IBKR, etc.) |
| `Security` | Stocks, ETFs, bonds (shared across users) |
| `Transaction` | Buy/sell/dividend transactions |
| `Position` | Current holdings per account |
| `BankAccount` | Bank accounts for cash tracking |
| `BankTransaction` | Bank transaction history |
| `PriceHistory` | Historical price data |

All user-owned models include a `userId` field for Row Level Security.

## Configuration

The package uses `prisma.config.ts` to configure Prisma:

```typescript
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join(__dirname, 'prisma/schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
```

The `DATABASE_URL` is loaded from the monorepo root `.env` file.

## Development Workflow

1. **Edit schema** in `prisma/schema.prisma`
2. **Create migration**: `make db-migrate`
3. **Commit** the migration files
4. **Push to main** - CI/CD applies migrations to production

## Documentation

For comprehensive guides, see:

- **[Prisma Migrations Guide](../../docs/prisma-migrations.md)** - Complete workflow for creating and managing migrations
- **[Prisma ORM Guide](../../docs/prisma-guide.md)** - Prisma concepts, queries, and best practices

## Environment Setup

Requires local Supabase running:

```bash
bunx supabase start    # Start local PostgreSQL
make db-migrate        # Apply migrations
```

## Exports

This package exports:

```typescript
// Main exports from index.ts
export { DatabaseService } from './database.service';
export * from './generated/prisma';  // All Prisma types and enums

// Client export from client.ts
export { prisma } from './client';   // Singleton Prisma instance
```
