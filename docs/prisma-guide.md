# Prisma ORM Guide

This guide explains what Prisma is, why we use it, and how it works in this project.

## Table of Contents

1. [What is Prisma?](#what-is-prisma)
2. [Why Use Prisma?](#why-use-prisma)
3. [Core Concepts](#core-concepts)
4. [Our Project Setup](#our-project-setup)
5. [The Schema File](#the-schema-file)
6. [Working with Data](#working-with-data)
7. [Common Operations](#common-operations)
8. [How It All Connects](#how-it-all-connects)
9. [Tips and Best Practices](#tips-and-best-practices)

---

## What is Prisma?

Prisma is an **ORM (Object-Relational Mapper)** - a tool that lets you work with databases using TypeScript/JavaScript instead of writing raw SQL.

### Without an ORM (Raw SQL)

```sql
SELECT * FROM accounts WHERE user_id = '123';
INSERT INTO accounts (id, user_id, broker, account_name) VALUES (uuid(), '123', 'degiro', 'My Account');
```

Problems:
- No type safety (typos cause runtime errors)
- SQL injection vulnerabilities if not careful
- Different syntax for different databases

### With Prisma

```typescript
// Find accounts
const accounts = await prisma.account.findMany({
  where: { userId: '123' }
});

// Create account
const account = await prisma.account.create({
  data: {
    userId: '123',
    broker: 'degiro',
    accountName: 'My Account'
  }
});
```

Benefits:
- Full TypeScript autocomplete
- Type-safe queries (errors caught at compile time)
- Works the same across PostgreSQL, MySQL, SQLite, etc.

---

## Why Use Prisma?

### 1. Type Safety

Prisma generates TypeScript types from your database schema. If you try to access a field that doesn't exist, TypeScript tells you immediately:

```typescript
// ✅ This works - 'broker' exists on Account
account.broker

// ❌ TypeScript error - 'brokr' doesn't exist
account.brokr  // Error: Property 'brokr' does not exist on type 'Account'
```

### 2. Autocomplete

Your IDE knows every field, relation, and query option:

```typescript
prisma.account.findMany({
  where: {
    // IDE shows: userId, broker, accountName, currency, createdAt, updatedAt...
  },
  include: {
    // IDE shows: positions, transactions
  }
});
```

### 3. Automatic Migrations

When you change your schema, Prisma generates the SQL to update your database:

```
You added: fingerprint String?

Generated SQL:
ALTER TABLE "transactions" ADD COLUMN "fingerprint" TEXT;
```

### 4. Database Agnostic

The same Prisma code works with:
- PostgreSQL (what we use)
- MySQL
- SQLite
- MongoDB
- SQL Server

---

## Core Concepts

### The Schema (`schema.prisma`)

A single file that defines your entire database structure:

```prisma
model Account {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  broker    String
  createdAt DateTime @default(now()) @map("created_at")

  transactions Transaction[]  // Relation to transactions

  @@map("accounts")  // Actual table name in database
}
```

### The Client (`@prisma/client`)

Auto-generated TypeScript code that provides type-safe database access:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Now you can use prisma.account, prisma.transaction, etc.
```

### Migrations

SQL files that track changes to your database over time:

```
prisma/migrations/
  0_init/
    migration.sql           # Creates all initial tables
  20241225_add_fingerprint/
    migration.sql           # Adds fingerprint column
```

---

## Our Project Setup

### File Structure

```
packages/database/
├── prisma/
│   ├── schema.prisma       # Database schema definition
│   └── migrations/         # Migration history
├── prisma.config.ts        # Prisma configuration
├── src/
│   ├── index.ts            # Exports DatabaseService
│   ├── client.ts           # Prisma client initialization
│   └── generated/prisma/   # Auto-generated Prisma client
└── package.json
```

### Configuration (`prisma.config.ts`)

```typescript
import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join(__dirname, 'prisma/schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL!,  // Connection string from .env
  },
});
```

### How It's Used in the API

```typescript
// apps/api/src/shared/database/database.service.ts
import { PrismaClient } from '@repo/database';

@Injectable()
export class DatabaseService extends PrismaClient {
  constructor() {
    super();
  }
}

// Usage in a repository
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

---

## The Schema File

The `schema.prisma` file is the heart of Prisma. Let's break down its parts:

### Generator Block

Tells Prisma what to generate:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}
```

### Datasource Block

Tells Prisma what database to use:

```prisma
datasource db {
  provider = "postgresql"
}
```

Note: The connection URL comes from `prisma.config.ts`, not from here.

### Models

Each model becomes a database table:

```prisma
model Account {
  // Fields
  id          String   @id @default(uuid())    // Primary key, auto-generated UUID
  userId      String   @map("user_id")         // Maps to snake_case column
  broker      String                           // Required string field
  accountName String?  @map("account_name")    // Optional (nullable) field
  currency    String   @default("EUR")         // Default value
  createdAt   DateTime @default(now())         // Auto-set on creation
  updatedAt   DateTime @updatedAt              // Auto-updated on changes

  // Relations
  transactions Transaction[]                   // One-to-many relation
  positions    Position[]

  // Constraints
  @@unique([userId, broker, accountId])        // Composite unique constraint
  @@map("accounts")                            // Table name in database
}
```

### Field Types

| Prisma Type | PostgreSQL Type | Example |
|-------------|-----------------|---------|
| `String` | TEXT | `name String` |
| `Int` | INTEGER | `count Int` |
| `Float` | DOUBLE PRECISION | `price Float` |
| `Decimal` | DECIMAL | `amount Decimal @db.Decimal(18, 2)` |
| `Boolean` | BOOLEAN | `isActive Boolean` |
| `DateTime` | TIMESTAMP | `createdAt DateTime` |
| `Json` | JSONB | `metadata Json` |

### Field Modifiers

| Modifier | Meaning | Example |
|----------|---------|---------|
| `?` | Optional (nullable) | `notes String?` |
| `[]` | Array/List | `tags String[]` |
| `@id` | Primary key | `id String @id` |
| `@default()` | Default value | `@default(uuid())` |
| `@unique` | Unique constraint | `email String @unique` |
| `@map()` | Column name in DB | `@map("user_id")` |
| `@@map()` | Table name in DB | `@@map("accounts")` |
| `@updatedAt` | Auto-update timestamp | `updatedAt DateTime @updatedAt` |

### Relations

Relations connect models together:

```prisma
model Account {
  id           String        @id
  transactions Transaction[] // One account has many transactions
}

model Transaction {
  id        String  @id
  accountId String  @map("account_id")

  // Many transactions belong to one account
  account   Account @relation(fields: [accountId], references: [id])
}
```

This creates a foreign key from `transactions.account_id` to `accounts.id`.

---

## Working with Data

### Creating Records

```typescript
// Create one
const account = await prisma.account.create({
  data: {
    userId: 'user-123',
    broker: 'degiro',
    accountName: 'My Trading Account',
  }
});

// Create many
const accounts = await prisma.account.createMany({
  data: [
    { userId: 'user-123', broker: 'degiro', accountName: 'Account 1' },
    { userId: 'user-123', broker: 'ibkr', accountName: 'Account 2' },
  ]
});
```

### Reading Records

```typescript
// Find all
const allAccounts = await prisma.account.findMany();

// Find with filter
const userAccounts = await prisma.account.findMany({
  where: { userId: 'user-123' }
});

// Find one by ID
const account = await prisma.account.findUnique({
  where: { id: 'account-456' }
});

// Find first matching
const degiroAccount = await prisma.account.findFirst({
  where: { broker: 'degiro' }
});

// Include relations
const accountWithTransactions = await prisma.account.findUnique({
  where: { id: 'account-456' },
  include: { transactions: true }
});

// Select specific fields
const accountNames = await prisma.account.findMany({
  select: { id: true, accountName: true }
});
```

### Updating Records

```typescript
// Update one
const updated = await prisma.account.update({
  where: { id: 'account-456' },
  data: { accountName: 'New Name' }
});

// Update many
const result = await prisma.account.updateMany({
  where: { broker: 'degiro' },
  data: { currency: 'USD' }
});

// Upsert (update or create)
const account = await prisma.account.upsert({
  where: { id: 'account-456' },
  update: { accountName: 'Updated Name' },
  create: { userId: 'user-123', broker: 'degiro', accountName: 'New Account' }
});
```

### Deleting Records

```typescript
// Delete one
await prisma.account.delete({
  where: { id: 'account-456' }
});

// Delete many
await prisma.account.deleteMany({
  where: { userId: 'user-123' }
});
```

---

## Common Operations

### Filtering

```typescript
// Equals
where: { broker: 'degiro' }

// Not equals
where: { broker: { not: 'degiro' } }

// Contains (case-sensitive)
where: { accountName: { contains: 'trading' } }

// Starts with
where: { accountName: { startsWith: 'My' } }

// In list
where: { broker: { in: ['degiro', 'ibkr'] } }

// Greater than
where: { createdAt: { gt: new Date('2024-01-01') } }

// Multiple conditions (AND)
where: {
  userId: 'user-123',
  broker: 'degiro'
}

// OR conditions
where: {
  OR: [
    { broker: 'degiro' },
    { broker: 'ibkr' }
  ]
}
```

### Sorting

```typescript
// Single field
orderBy: { createdAt: 'desc' }

// Multiple fields
orderBy: [
  { broker: 'asc' },
  { accountName: 'asc' }
]
```

### Pagination

```typescript
// Skip and take
const page2 = await prisma.account.findMany({
  skip: 10,   // Skip first 10
  take: 10,   // Take next 10
});

// Cursor-based pagination
const nextPage = await prisma.account.findMany({
  take: 10,
  cursor: { id: 'last-seen-id' },
  skip: 1,  // Skip the cursor itself
});
```

### Aggregations

```typescript
// Count
const count = await prisma.transaction.count({
  where: { userId: 'user-123' }
});

// Sum, avg, min, max
const stats = await prisma.transaction.aggregate({
  where: { userId: 'user-123' },
  _sum: { amount: true },
  _avg: { amount: true },
  _count: true,
});

// Group by
const byBroker = await prisma.account.groupBy({
  by: ['broker'],
  _count: true,
});
```

### Transactions (Database Transactions)

When you need multiple operations to succeed or fail together:

```typescript
// Interactive transaction
const result = await prisma.$transaction(async (tx) => {
  // Create account
  const account = await tx.account.create({
    data: { userId: 'user-123', broker: 'degiro' }
  });

  // Create initial transaction
  const transaction = await tx.transaction.create({
    data: {
      accountId: account.id,
      userId: 'user-123',
      type: 'deposit',
      amount: 1000,
    }
  });

  return { account, transaction };
});
// If any operation fails, everything is rolled back
```

---

## How It All Connects

### The Flow

```
┌─────────────────────────────────────────────────────────┐
│                    schema.prisma                         │
│  Defines models, fields, relations, and constraints      │
└─────────────────────────────┬───────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                  prisma generate                         │
│  Creates TypeScript types and query builders             │
└─────────────────────────────┬───────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│              src/generated/prisma/                       │
│  Auto-generated Prisma Client with full type safety      │
└─────────────────────────────┬───────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                  Your Application                        │
│  Import and use: prisma.account.findMany()               │
└─────────────────────────────┬───────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                    PostgreSQL                            │
│  Actual database storing your data                       │
└─────────────────────────────────────────────────────────┘
```

### Key Commands

| Command | What It Does |
|---------|--------------|
| `make db-generate` | Regenerates Prisma Client from schema |
| `make db-migrate` | Creates migration and applies to database |
| `make db-push` | Pushes schema directly (no migration file) |
| `make db-studio` | Opens visual database browser |

### When to Regenerate

You need to run `make db-generate` after:
- Changing `schema.prisma`
- Running migrations
- Pulling changes that modified the schema

The generated client must match your database schema!

---

## Tips and Best Practices

### 1. Always Use Transactions for Related Operations

```typescript
// ❌ Bad - if second operation fails, first is orphaned
await prisma.account.create({ data: accountData });
await prisma.transaction.create({ data: transactionData });

// ✅ Good - atomic operation
await prisma.$transaction([
  prisma.account.create({ data: accountData }),
  prisma.transaction.create({ data: transactionData }),
]);
```

### 2. Select Only What You Need

```typescript
// ❌ Bad - fetches all fields
const accounts = await prisma.account.findMany();

// ✅ Good - fetches only needed fields
const accounts = await prisma.account.findMany({
  select: { id: true, accountName: true }
});
```

### 3. Use `include` for Relations Sparingly

```typescript
// ❌ Potentially slow - loads all transactions for all accounts
const accounts = await prisma.account.findMany({
  include: { transactions: true }
});

// ✅ Better - filter and limit
const account = await prisma.account.findUnique({
  where: { id: accountId },
  include: {
    transactions: {
      take: 10,
      orderBy: { date: 'desc' }
    }
  }
});
```

### 4. Handle Not Found Cases

```typescript
// findUnique returns null if not found
const account = await prisma.account.findUnique({
  where: { id: 'non-existent' }
});

if (!account) {
  throw new NotFoundException('Account not found');
}
```

### 5. Use Decimal for Money

```typescript
// In schema.prisma
amount Decimal @db.Decimal(18, 2)

// In code - Prisma returns Decimal objects
const transaction = await prisma.transaction.findFirst();
console.log(transaction.amount.toNumber());  // Convert to JS number
console.log(transaction.amount.toString());  // Or to string for precision
```

### 6. Map to Snake Case for PostgreSQL Convention

```prisma
model Transaction {
  userId    String   @map("user_id")      // Column: user_id
  accountId String   @map("account_id")   // Column: account_id
  createdAt DateTime @map("created_at")   // Column: created_at

  @@map("transactions")                   // Table: transactions
}
```

---

## Further Reading

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma Schema Reference](https://www.prisma.io/docs/orm/prisma-schema)
- [Prisma Client API](https://www.prisma.io/docs/orm/prisma-client)
- [Prisma Migrations Guide](prisma-migrations.md) - Our project-specific migration workflow
