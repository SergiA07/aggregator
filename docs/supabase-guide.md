# Supabase Guide

This document covers everything about Supabase in this project: what it is, why we use it, how it's integrated, and how to set it up for development and production.

---

## Table of Contents

1. [What is Supabase?](#what-is-supabase)
2. [Why Supabase over Firebase?](#why-supabase-over-firebase)
3. [How We Use Supabase](#how-we-use-supabase)
4. [Local Development Setup](#local-development-setup)
5. [Production Setup](#production-setup)
6. [Production Checklist](#production-checklist)
7. [Commands Reference](#commands-reference)

---

## What is Supabase?

Supabase is an open-source Backend-as-a-Service (BaaS) that provides all the backend infrastructure you need to build an application without managing servers yourself.

**What Supabase gives you:**
- **PostgreSQL Database** - A real, full-featured relational database (not NoSQL)
- **Authentication** - User signup/login with email, OAuth providers (Google, GitHub, etc.)
- **Row-Level Security** - Database-level permissions that protect data automatically
- **Real-time subscriptions** - Listen to database changes in real-time
- **Storage** - File uploads and management
- **Edge Functions** - Serverless functions (like AWS Lambda)
- **Auto-generated APIs** - REST and GraphQL APIs from your database schema

---

## Why Supabase over Firebase?

| Aspect | Supabase | Firebase |
|--------|----------|----------|
| **Database** | PostgreSQL (relational, SQL) | Firestore (NoSQL, document-based) |
| **Query language** | SQL - powerful joins, aggregations | Limited NoSQL queries |
| **Data modeling** | Tables with relationships, foreign keys | Denormalized documents |
| **Open source** | Yes - can self-host | No - Google proprietary |
| **Vendor lock-in** | Low - standard PostgreSQL | High - Firebase-specific APIs |
| **Complex queries** | Easy with SQL | Difficult, often requires multiple reads |
| **Pricing** | Generous free tier, predictable | Can spike unexpectedly with reads |

**Why PostgreSQL matters for this project:**

Portfolio data is inherently relational:
```
Account → has many → Positions → references → Security
Account → has many → Transactions → references → Security
```

With SQL, we can easily query:
```sql
-- Get total portfolio value by account
SELECT a.broker, SUM(p.market_value)
FROM accounts a
JOIN positions p ON a.id = p.account_id
GROUP BY a.broker;

-- This would require multiple reads and client-side joins in Firebase
```

---

## How We Use Supabase

We use Supabase for three main purposes: **Authentication**, **Database**, and **Row-Level Security**.

### 1. Authentication (Frontend)

The React app uses Supabase Auth for user login/signup:

```typescript
// apps/web/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);
```

```typescript
// apps/web/src/hooks/useAuth.ts
const { signIn, signUp, signOut } = useAuth();

// Sign up a new user
await supabase.auth.signUp({ email, password });

// Sign in existing user
await supabase.auth.signInWithPassword({ email, password });

// Get current session (contains JWT token)
const { data: { session } } = await supabase.auth.getSession();
```

### 2. JWT Token Verification (Backend)

The NestJS API verifies JWT tokens using Supabase's service role:

```typescript
// apps/api/src/auth/supabase.service.ts
@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY  // Secret key can verify tokens
    );
  }

  async verifyToken(token: string) {
    const { data: { user }, error } = await this.supabase.auth.getUser(token);
    return user;  // Returns user object with id, email, etc.
  }
}
```

```typescript
// apps/api/src/auth/supabase.guard.ts
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.replace('Bearer ', '');

    const user = await this.supabaseService.verifyToken(token);
    request.user = user;  // Attach user to request
    return !!user;
  }
}
```

### 3. Database Access (Via Prisma, not Supabase client)

We connect directly to PostgreSQL using Prisma, not the Supabase client:

```typescript
// packages/database/prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")  // postgresql://postgres:postgres@localhost:54322/postgres
}
```

```typescript
// apps/api/src/portfolio/accounts.service.ts
@Injectable()
export class AccountsService {
  constructor(private db: DatabaseService) {}

  findByUser(userId: string) {
    return this.db.account.findMany({
      where: { userId },  // Filter by authenticated user
    });
  }
}
```

**Why Prisma instead of Supabase client?**
- Type-safe queries with auto-generated TypeScript types
- Better developer experience with IDE autocomplete
- More control over complex queries and transactions
- Supabase client is better for real-time subscriptions (which we may add later)

### 4. Row-Level Security (Database)

RLS policies ensure users can only access their own data, even if there's a bug in the API:

```sql
-- supabase/migrations/00001_enable_rls.sql

-- Enable RLS on user-owned tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see/modify their own accounts
CREATE POLICY "Users access own accounts" ON accounts
  FOR ALL USING (auth.uid()::text = user_id);
```

This creates a **double layer of security**:
1. **API layer**: Services filter queries by `userId`
2. **Database layer**: RLS blocks unauthorized access even if API is bypassed

### Complete Auth Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER LOGIN                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. React App                                                    │
│     supabase.auth.signInWithPassword({ email, password })       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Supabase Auth (port 54321)                                  │
│     - Validates credentials                                      │
│     - Returns JWT token (contains user.id)                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. React App stores session                                     │
│     - Token stored in memory/localStorage                        │
│     - Included in API requests: Authorization: Bearer <token>   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. NestJS API (port 3000)                                      │
│     - SupabaseAuthGuard extracts token                          │
│     - Calls supabase.auth.getUser(token) to verify              │
│     - Attaches user to request                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Service Layer                                                │
│     - Gets userId from @CurrentUser() decorator                 │
│     - Queries database: WHERE user_id = $userId                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. PostgreSQL (port 54322)                                     │
│     - RLS policy checks: auth.uid()::text = user_id             │
│     - Returns only user's data                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Environment Variables

```bash
# .env

# Backend (NestJS)
SUPABASE_URL="http://localhost:54321"
SUPABASE_SECRET_KEY="eyJ..."  # Can verify tokens, bypass RLS
DATABASE_URL="postgresql://postgres:postgres@localhost:54322/postgres"

# Frontend (React/Vite)
VITE_SUPABASE_URL="http://localhost:54321"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJ..."     # Public key, limited permissions
```

**Key difference:**
- `PUBLISHABLE_KEY`: Public, used in frontend, respects RLS policies
- `SECRET_KEY`: Secret, used in backend only, can bypass RLS

---

## Local Development Setup

### Prerequisites

- **Docker Desktop** (or alternatives: Rancher Desktop, Podman, OrbStack, colima)
- **Node.js 20+** (for CLI installation via npm)

### Step 1: Install the Supabase CLI

**macOS (Homebrew):**
```bash
brew install supabase/tap/supabase
```

**Windows (Scoop):**
```bash
scoop bucket add supabase https://github.com/supabase/cli/releases
scoop install supabase
```

**npm (any platform):**
```bash
npm install supabase --save-dev
# Then use: npx supabase <command>
```

Verify installation:
```bash
supabase --version
```

### Step 2: Initialize Local Development

Our project already has Supabase initialized (the `supabase/` folder exists). If starting fresh:

```bash
supabase init
```

This creates:
```
supabase/
├── config.toml      # Local configuration
├── migrations/      # SQL migration files
└── seed.sql         # Optional seed data
```

### Step 3: Start Local Supabase

```bash
supabase start
```

First run downloads Docker images (~5-10 minutes). Subsequent starts are fast (~30 seconds).

**Output shows your local credentials:**
```
Started supabase local development setup.

         API URL: http://localhost:54321
     GraphQL URL: http://localhost:54321/graphql/v1
  S3 Storage URL: http://localhost:54321/storage/v1/s3
          DB URL: postgresql://postgres:postgres@localhost:54322/postgres
      Studio URL: http://localhost:54323
    Inbucket URL: http://localhost:54324
      JWT secret: super-secret-jwt-token-with-at-least-32-characters
 publishable key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
      secret key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   S3 Access Key: ...
   S3 Secret Key: ...
       S3 Region: local
```

Copy these values to your `.env` file.

### Step 4: Access Local Services

| Service | URL | Purpose |
|---------|-----|---------|
| **Studio** | http://localhost:54323 | Visual database editor |
| **API** | http://localhost:54321 | Supabase API endpoint |
| **Database** | localhost:54322 | Direct PostgreSQL connection |
| **Inbucket** | http://localhost:54324 | Email testing (catches auth emails) |

### Step 5: Apply Database Schema

```bash
# Generate Prisma client
bun run db:generate

# Push Prisma schema to local database
bun run db:push
```

Or apply Supabase migrations:
```bash
supabase db reset  # Resets DB and applies all migrations
```

### Step 6: Stop Local Supabase

```bash
supabase stop           # Preserves data
supabase stop --backup  # Creates backup before stopping
```

---

## Production Setup

### Step 1: Create a Supabase Account

1. Go to [supabase.com](https://supabase.com)
2. Click **Start your project**
3. Sign up with GitHub or email

### Step 2: Create a New Project

1. In the dashboard, click **New Project**
2. Choose your organization (or create one)
3. Enter project details:
   - **Name:** `my-aggregator` (or your preference)
   - **Database Password:** Generate a strong password and **save it securely**
   - **Region:** Choose closest to your users (e.g., `eu-west-1` for Europe)
4. Click **Create new project**

Project creation takes 1-2 minutes.

### Step 3: Get Production Credentials

In your project dashboard, go to **Settings > API**:

```bash
# Production .env values
SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
SUPABASE_SECRET_KEY="sb_secret_..."

# Database connection (Settings > Database)
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres"
```

### Step 4: Link Local Project to Production

```bash
# Login to Supabase
supabase login

# Link to your remote project (find project-ref in dashboard URL)
supabase link --project-ref YOUR_PROJECT_REF

# Pull any existing remote schema (if you made changes in dashboard)
supabase db pull
```

### Step 5: Deploy Migrations to Production

```bash
# Push local migrations to production
supabase db push
```

Or use Prisma directly:
```bash
DATABASE_URL="your_production_url" npx prisma db push
```

---

## Production Checklist

Before going live, ensure:

**Security:**
- [ ] Enable RLS on all user-owned tables
- [ ] Enable SSL enforcement (Settings > Database)
- [ ] Enable network restrictions if possible
- [ ] Enable MFA on your Supabase account
- [ ] Use custom SMTP for auth emails (Settings > Auth)

**Performance:**
- [ ] Add database indexes for common queries
- [ ] Review slow queries with `pg_stat_statements`
- [ ] Load test with tools like k6

**Reliability:**
- [ ] Upgrade to Pro plan (Free plan pauses after 7 days of inactivity)
- [ ] Enable Point-in-Time Recovery (PITR) for databases > 4GB
- [ ] Set up monitoring and alerts

**Rate Limits (default):**
| Endpoint | Limit |
|----------|-------|
| Email signup | 2/hour |
| OTP requests | 360/hour |
| Token refresh | 1800/hour |
| Anonymous signups | 30/hour |

---

## Environment Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT WORKFLOW                      │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    LOCAL     │────▶│   STAGING    │────▶│  PRODUCTION  │
│  (Docker)    │     │  (Branch)    │     │   (Cloud)    │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       ▼                    ▼                    ▼
  supabase start      Branching or         supabase db push
  supabase db reset   Preview env          (via CI/CD)


Workflow:
1. Develop locally with `supabase start`
2. Make schema changes in Studio or write migrations
3. Test locally with `supabase db reset`
4. Commit migration files to git
5. Push to production with `supabase db push` or CI/CD
```

---

## Commands Reference

```bash
# Local Development
supabase start              # Start local stack
supabase stop               # Stop local stack
supabase status             # Show running services
supabase db reset           # Reset DB and apply migrations

# Migrations
supabase migration new NAME # Create new migration file
supabase db diff            # Generate migration from DB changes
supabase db push            # Push migrations to remote

# Remote Connection
supabase login              # Authenticate with Supabase
supabase link               # Link to remote project
supabase db pull            # Pull remote schema to local

# Debugging
supabase logs               # View service logs
supabase inspect db         # Database statistics
```

---

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase CLI Guide](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Local Development Overview](https://supabase.com/docs/guides/local-development/overview)
- [Production Checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
