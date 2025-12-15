# Migration Investigation: my-aggregator → my-aggregator-monorepo

This document summarizes the investigation of data migration from the previous Python/SQLite project to this TypeScript/PostgreSQL monorepo.

## Source Project

**Location:** `/Users/sergiayora/Code/projects/my-aggregator`

### Technology Stack
- **Language:** Python
- **Database:** SQLite 3.x
- **ORM:** SQLAlchemy
- **Database File:** `data/database/portfolio.db` (328 KB, last updated Oct 12, 2025)

### Existing Data Summary

| Table | Records | Description |
|-------|---------|-------------|
| accounts | 1 | DeGiro broker account |
| securities | 84 | Stocks and ETFs with ISIN codes |
| transactions | 272 | Buy/sell/dividend transactions |
| positions | 17 | Current portfolio holdings |
| bank_accounts | 2 | Sabadell bank accounts |
| bank_transactions | 61 | Bank transactions (Aug-Oct 2025) |
| price_history | 0 | Empty (historical prices) |

### Source CSV Files (Source of Truth)

These CSV files were used to import data and serve as the canonical source:

```
data/manual_uploads/
├── degiro/
│   ├── Account.csv        # 1,416 lines, 194 KB - Account movements
│   └── Transactions.csv   # 273 lines, 45 KB - Trade history
├── sabadell/
│   └── 12102025_0215_0001062608.txt  # 62 lines - Bank transactions
└── trade_republic/
    └── sample_transactions.csv       # Sample file only
```

### Database Schema (SQLAlchemy Models)

**Key Models in `database/models.py`:**

- **Account:** broker, account_id, account_name, currency, is_active
- **Security:** symbol, isin, name, security_type, currency, exchange, sector, industry, country
- **Transaction:** account_id (FK), security_id (FK), date, type (BUY/SELL/DIVIDEND/FEE), quantity, price, amount, fees, currency, external_id
- **Position:** account_id (FK), security_id (FK), quantity, avg_cost, total_cost, market_price, market_value, unrealized_pnl
- **BankAccount:** bank, iban, account_name, currency, balance
- **BankTransaction:** bank_account_id (FK), date, amount, description, category

### Import Infrastructure

**Importers in `importers/` directory:**
- `degiro_importer.py` - Parses DeGiro CSV exports (Spanish/English formats)
- `sabadell_bank_importer.py` - PSD2 API and CSV import for Sabadell
- `trade_republic_importer.py` - Trade Republic CSV support
- `base_importer.py` - Common parsing utilities

**Connectors in `connectors/` directory:**
- `interactive_brokers.py` - IB API client (configured, not actively used)
- `sabadell_psd2.py` - Sabadell PSD2 Open Banking API

---

## Target Project (This Monorepo)

**Location:** `/Users/sergiayora/Code/projects/my-aggregator-monorepo`

### Technology Stack
- **Runtime:** Bun 1.1.6
- **Build System:** Turbo
- **Backend:** NestJS with Fastify
- **Frontend:** React 19 + Vite
- **Database:** PostgreSQL via Supabase
- **ORM:** Prisma

### Database Configuration

**Local Supabase:**
- API: `localhost:54321`
- Database: `localhost:54322`
- Studio: `localhost:54323`
- Credentials: `postgres:postgres`

**Prisma Schema:** `packages/database/prisma/schema.prisma`

### Schema Comparison

| Old (SQLAlchemy) | New (Prisma) | Notes |
|------------------|--------------|-------|
| accounts | Account | Added userId field |
| securities | Security | Same structure |
| transactions | Transaction | Added userId field |
| positions | Position | Added userId field |
| bank_accounts | BankAccount | Added userId field |
| bank_transactions | BankTransaction | Added userId field |
| price_history | PriceHistory | Same structure |

**Key Difference:** All user-owned tables in the new schema require a `userId` field linked to Supabase Auth.

### Row Level Security (RLS)

The new system implements RLS via `supabase/migrations/00001_enable_rls.sql`:
- User-owned tables: Users can only access their own data
- Shared tables (securities, price_history): Read-only for authenticated users, managed by service role

---

## Migration Options

### Option A: Re-import from CSV (Recommended)

1. Copy CSV files to monorepo (`data/imports/` or similar)
2. Implement importers in NestJS API or as CLI scripts
3. Re-import through the application layer

**Pros:**
- Data validated by new application logic
- Proper user_id assignment via authenticated context
- Clean integration with new architecture

**Cons:**
- Requires implementing import logic in TypeScript
- May need to adapt parsing for different CSV formats

### Option B: Direct Database Migration

1. Export data from SQLite as SQL or JSON
2. Transform to match Prisma schema (add user_id, adjust types)
3. Import directly to PostgreSQL

**Pros:**
- Faster initial migration
- Preserves exact historical data

**Cons:**
- Bypasses application validation
- Requires manual user_id assignment
- Potential schema mismatch issues

### Option C: Hybrid Approach

1. Migrate securities directly (shared data, no user_id needed)
2. Re-import transactions from CSV (with proper user context)
3. Recalculate positions from transaction history

**Pros:**
- Balances speed and data integrity
- Securities rarely change, safe to migrate directly

---

## Files to Preserve from Old Project

### Essential (Source of Truth)
```
data/manual_uploads/degiro/Account.csv
data/manual_uploads/degiro/Transactions.csv
data/manual_uploads/sabadell/12102025_0215_0001062608.txt
```

### Reference (For Building New Importers)
```
database/models.py          # Schema reference
database/repository.py      # Data access patterns
importers/degiro_importer.py
importers/sabadell_bank_importer.py
importers/base_importer.py
```

### Optional Backup
```
data/database/portfolio.db  # SQLite database file
```

---

## Pre-Migration Checklist

- [ ] Set up Supabase locally (`supabase start`)
- [ ] Run Prisma migrations (`bun run db:push`)
- [ ] Create a test user in Supabase Auth
- [ ] Copy CSV source files to monorepo
- [ ] Decide on migration approach (A, B, or C)
- [ ] Implement or adapt importers as needed

---

## Related Documentation (Old Project)

| File | Description |
|------|-------------|
| `docs/migration.md` | Original migration strategy document |
| `docs/DATABASE_GUIDE.md` | Database schema and operations |
| `docs/SABADELL_CSV_IMPORT.md` | Sabadell CSV format details |
| `BANK_ACCOUNT_INTEGRATION.md` | PSD2 API setup |
