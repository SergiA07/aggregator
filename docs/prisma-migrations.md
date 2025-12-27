# Database Migrations Guide

This guide explains how database management works in this project, from basic concepts to daily workflows.

## Table of Contents

1. [What Are Migrations?](#what-are-migrations)
2. [Why Use Migrations?](#why-use-migrations)
3. [Our Setup](#our-setup)
4. [Available Commands](#available-commands)
5. [Daily Workflow](#daily-workflow)
6. [How It Works Under the Hood](#how-it-works-under-the-hood)
7. [Common Scenarios](#common-scenarios)
8. [Troubleshooting](#troubleshooting)

---

## What Are Migrations?

Think of migrations as **version control for your database schema**.

Just like Git tracks changes to your code, migrations track changes to your database structure (tables, columns, indexes, etc.).

Each migration is a file that describes:
- What changed (e.g., "add a `fingerprint` column to the `transactions` table")
- How to apply the change (the SQL to run)
- When it was created (timestamp in the filename)

### Example Migration File

```
packages/database/prisma/migrations/
  0_init/
    migration.sql          # SQL to create all initial tables
  20241224_add_user_preferences/
    migration.sql          # SQL to add new table
```

---

## Why Use Migrations?

### Without Migrations (Bad)

```
Developer A: "I added a new column to the users table"
Developer B: "My app is crashing, what column?"
Developer A: "Just run this SQL... wait, did you also add the index?"
Production: *breaks because someone forgot a step*
```

### With Migrations (Good)

```
Developer A: Creates migration file, commits to Git
Developer B: Pulls code, runs `make db-migrate`, done
Production: CI/CD automatically applies migrations before deploy
```

### Benefits

- **Reproducible**: Anyone can recreate the exact database structure
- **Trackable**: See the history of all schema changes in Git
- **Safe**: Changes are tested locally before reaching production
- **Automated**: CI/CD applies migrations automatically

---

## Our Setup

### Tech Stack

| Component | Tool |
|-----------|------|
| Database | PostgreSQL (via Supabase) |
| ORM | Prisma 7 |
| Runtime | Bun |
| Monorepo | Turborepo |

### Key Files

```
packages/database/
  prisma/
    schema.prisma          # The source of truth for your database structure
    migrations/            # All migration files (tracked in Git)
      0_init/
        migration.sql
  prisma.config.ts         # Prisma configuration (loads DATABASE_URL)
  src/
    generated/prisma/      # Auto-generated Prisma client (don't edit!)
```

### Environments

| Environment | Database | How Migrations Run |
|-------------|----------|-------------------|
| Local Dev | Local Supabase (Docker) | `make db-migrate` |
| Production | Supabase Cloud | Automatically in CI/CD |

---

## Available Commands

Run these from the **monorepo root**:

### Development Commands

| Command | What It Does |
|---------|--------------|
| `make db-migrate` | Create new migration AND apply it locally |
| `make db-migrate-status` | Check which migrations are applied |
| `make db-generate` | Regenerate Prisma client after schema changes |
| `make db-studio` | Open visual database editor |
| `make db-push` | Push schema to DB without migration (prototyping only) |
| `make db-reset` | Reset local DB and reapply all migrations |

### What Each Command Does

#### `make db-migrate`

This is your main command for schema changes. It:

1. Compares your `schema.prisma` with your local database
2. Generates SQL for the differences
3. Asks you to name the migration
4. Creates a migration file in `prisma/migrations/`
5. Applies the migration to your local database
6. Regenerates the Prisma client

#### `make db-migrate-status`

Shows which migrations exist and their status:

```
1 migration found in prisma/migrations

Database schema is up to date!
```

Or if there are pending migrations:

```
2 migrations found in prisma/migrations

Following migrations have not yet been applied:
  20241224_add_user_settings

To apply all pending migrations, run `prisma migrate deploy`
```

#### `make db-studio`

Opens a visual interface to browse your database at `http://localhost:5555`.

#### `make db-reset`

Drops all tables and reapplies all migrations from scratch. Use this when:
- Your local database is corrupted
- You want a fresh start
- Migration history got out of sync

**Warning**: This deletes all local data!

---

## Daily Workflow

### Scenario: Adding a New Feature That Needs a Database Change

#### Step 1: Start Local Supabase

```bash
bunx supabase start
```

#### Step 2: Edit the Schema

Open `packages/database/prisma/schema.prisma` and make your changes:

```prisma
// Before
model User {
  id    String @id
  email String
}

// After - adding a new field
model User {
  id       String  @id
  email    String
  nickname String? // New field!
}
```

#### Step 3: Create and Apply Migration

```bash
make db-migrate
```

You'll be prompted to name your migration:

```
Enter a name for the new migration: add_user_nickname
```

This creates:
```
prisma/migrations/20241224143052_add_user_nickname/migration.sql
```

#### Step 4: Commit the Migration

```bash
git add packages/database/prisma/
git commit -m "feat(database): add nickname field to users"
```

#### Step 5: Push to Main

When you push to `main`, the CI/CD pipeline automatically:
1. Runs `prisma migrate deploy` against production
2. Deploys the updated application

---

## How It Works Under the Hood

### The Migration Lifecycle

```
┌─────────────────┐
│  schema.prisma  │  <- You edit this
└────────┬────────┘
         │
         v
┌─────────────────┐
│  db-migrate     │  <- Compares schema to database
└────────┬────────┘
         │
         v
┌─────────────────┐
│  migration.sql  │  <- Generated SQL file
└────────┬────────┘
         │
         v
┌─────────────────┐
│  Local Database │  <- Migration applied
└─────────────────┘

         ... later, in CI/CD ...

┌─────────────────┐
│  migrate deploy │  <- Runs pending migrations
└────────┬────────┘
         │
         v
┌─────────────────┐
│  Production DB  │  <- Migration applied
└─────────────────┘
```

### The `_prisma_migrations` Table

Prisma tracks applied migrations in a special table:

```sql
SELECT migration_name, finished_at FROM _prisma_migrations;

-- Results:
-- 0_init                         2024-12-24 10:00:00
-- 20241224_add_user_nickname     2024-12-24 14:30:00
```

This is how Prisma knows which migrations have already been applied.

### Environment Variables

The `DATABASE_URL` environment variable tells Prisma where to connect:

- **Local**: Loaded from `.env` at monorepo root
- **CI/CD**: Set as a GitHub secret

```
# .env (local)
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
```

---

## Common Scenarios

### "I just cloned the repo, how do I set up my database?"

```bash
# 1. Start local Supabase
bunx supabase start

# 2. Apply all migrations
make db-migrate

# 3. Start developing
make dev
```

### "I pulled changes that include new migrations"

```bash
# Apply the new migrations
make db-migrate
```

### "I made schema changes but want to start over"

```bash
# Reset and reapply all migrations
make db-reset
```

### "I want to see what's in my database"

```bash
# Open visual database browser
make db-studio
```

### "I want to quickly prototype without creating migrations"

```bash
# Push schema directly (dev only, no migration file created)
make db-push
```

**Note**: Only use `db-push` for quick prototyping. Once you're happy with your changes, create a proper migration with `db-migrate`.

### "My teammate and I both created migrations"

This is fine! Migrations are applied in order by timestamp. As long as they don't conflict (modifying the same column), they'll both apply cleanly.

If there are conflicts, you may need to:
1. `make db-reset` to start fresh
2. Manually resolve the conflict in the migration files

---

## Troubleshooting

### "Connection url is empty"

**Cause**: Prisma can't find `DATABASE_URL`

**Fix**: Make sure local Supabase is running:
```bash
bunx supabase start
```

### "Database schema is not in sync"

**Cause**: Your schema.prisma differs from the database

**Fix**: Create a migration:
```bash
make db-migrate
```

### "Migration failed to apply"

**Cause**: The migration SQL has an error

**Fix**:
1. Check the error message
2. Edit the migration file if needed
3. Or delete the migration and recreate it

### "We need to reset the schema"

**Cause**: Your local database state conflicts with migration history

**Fix**:
```bash
make db-reset
```

### "Prisma client is out of date"

**Cause**: Schema changed but client wasn't regenerated

**Fix**:
```bash
make db-generate
```

---

## Quick Reference

```bash
# Daily development
make db-migrate          # Create + apply migration
make db-migrate-status   # Check migration status
make db-studio           # Visual database browser

# Setup
bunx supabase start      # Start local database
make db-reset            # Fresh start (deletes data!)

# Prototyping
make db-push             # Quick schema push (no migration)
make db-generate         # Regenerate Prisma client
```

---

## Further Reading

- [Prisma Migrate Documentation](https://www.prisma.io/docs/orm/prisma-migrate)
- [Prisma Schema Reference](https://www.prisma.io/docs/orm/prisma-schema)
- [Supabase Local Development](https://supabase.com/docs/guides/local-development)
