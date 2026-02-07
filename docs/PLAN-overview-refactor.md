# Overview Refactor Plan

## Vision

Transform the current simple dashboard into a comprehensive **Personal Finance Aggregator** that provides a unified view of all financial accounts (brokers, banks, pension funds, real estate, etc.) with investment tracking, performance analysis, and future strategy planning.

---

## Table of Contents

1. [Current State](#1-current-state)
2. [Target Architecture](#2-target-architecture)
3. [Data Model Changes](#3-data-model-changes)
4. [Navigation Structure](#4-navigation-structure)
5. [Overview Page Design](#5-overview-page-design)
6. [API Endpoints](#6-api-endpoints)
7. [Implementation Phases](#7-implementation-phases)
8. [Phase 1 Detailed Tasks](#8-phase-1-detailed-tasks)
9. [Future Phases](#9-future-phases)
10. [Technical Decisions](#10-technical-decisions)

---

## 1. Current State

### Existing Pages
- **Dashboard**: 4 summary cards (Total Value, Cost, P&L, Return %) + accounts grid
- **Positions**: Full positions table with P&L per position
- **Transactions**: Filterable transactions table

### Existing Data
- Accounts (broker, accountName, currency)
- Positions (with security, avgCost, marketValue, unrealizedPnl)
- Transactions (buy, sell, dividend, fee, split, other)
- Securities (symbol, isin, name, assetClass)

### Supported Imports
- DeGiro (CSV) ✓
- Trade Republic (CSV) ✓

### Limitations
- No account type classification (broker vs bank vs pension)
- No cash balance tracking
- No net worth calculation
- No historical snapshots
- No multi-currency aggregation
- Cannot add non-importable accounts (real estate, etc.)

---

## 2. Target Architecture

### Core Concepts

```
┌─────────────────────────────────────────────────────────────┐
│                      NET WORTH                               │
│                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐     │
│  │   ASSETS     │ - │ LIABILITIES  │ = │  NET WORTH   │     │
│  └──────────────┘   └──────────────┘   └──────────────┘     │
│                                                              │
│  Assets include:                                             │
│  • Investment accounts (positions + cash)                    │
│  • Bank accounts (balance)                                   │
│  • Pension funds (value)                                     │
│  • Real estate (manual value)                                │
│  • Other assets                                              │
│                                                              │
│  Liabilities include: (future)                               │
│  • Mortgages                                                 │
│  • Loans                                                     │
│  • Credit cards                                              │
└─────────────────────────────────────────────────────────────┘
```

### Account Type Taxonomy

| Type | Examples | Has Positions | Has Transactions | Has Cash Balance | Import Method |
|------|----------|---------------|------------------|------------------|---------------|
| `broker` | DeGiro, IBKR, Trade Republic | ✓ | ✓ | ✓ | CSV/API |
| `bank` | Sabadell, BBVA, Pibank | ✗ | ✓ | ✓ | CSV/API |
| `pension` | Caser, Indexa | Maybe | Maybe | ✗ | CSV/Manual |
| `crypto` | Kraken, Binance | ✓ | ✓ | ✓ | CSV/API |
| `real_estate` | Properties | ✗ | ✗ | ✗ | Manual |
| `other` | Art, collectibles | ✗ | ✗ | ✗ | Manual |

### Institution Registry

Separate the **account type** (what it is) from the **institution** (where it's held):

```typescript
// Institutions are configurable data, not code
const INSTITUTIONS = [
  { id: 'degiro', name: 'DeGiro', type: 'broker', country: 'NL', hasParser: true },
  { id: 'trade-republic', name: 'Trade Republic', type: 'broker', country: 'DE', hasParser: true },
  { id: 'ibkr', name: 'Interactive Brokers', type: 'broker', country: 'US', hasParser: false },
  { id: 'sabadell', name: 'Banco Sabadell', type: 'bank', country: 'ES', hasParser: false },
  { id: 'bbva', name: 'BBVA', type: 'bank', country: 'ES', hasParser: false },
  { id: 'pibank', name: 'Pibank', type: 'bank', country: 'ES', hasParser: false },
  { id: 'caser', name: 'Caser Pensiones', type: 'pension', country: 'ES', hasParser: false },
  { id: 'manual', name: 'Manual Entry', type: 'other', country: null, hasParser: false },
];
```

---

## 3. Data Model Changes

### Design Principles

Based on requirements analysis:
- **Multi-currency support**: IBKR can have EUR + USD + GBP balances
- **Full transaction history**: Banks, pensions, brokers - all have transactions
- **Historical tracking**: Net worth evolution calculated from transactions
- **Scalability**: Support for future asset types (crypto, real estate, liabilities)

### 3.1 Account Entity Updates

```prisma
// packages/database/prisma/schema.prisma

enum AccountType {
  broker        // DeGiro, IBKR, Trade Republic
  bank          // Sabadell, BBVA, Pibank
  pension       // Caser, Indexa
  crypto        // Kraken, Binance (future)
  real_estate   // Properties (future)
  other         // Manual/catch-all
}

model Account {
  id            String      @id @default(uuid())
  userId        String      @map("user_id")

  // Classification
  type          AccountType @default(broker)
  institution   String      // 'degiro', 'sabadell', 'manual', etc.
  name          String      // User's custom name for the account
  baseCurrency  String      @default("EUR") @map("base_currency") // For reporting

  // Metadata
  isActive      Boolean     @default(true) @map("is_active")
  lastImportAt  DateTime?   @map("last_import_at")
  notes         String?

  // Timestamps
  createdAt     DateTime    @default(now()) @map("created_at")
  updatedAt     DateTime    @updatedAt @map("updated_at")

  // Relations
  positions     Position[]
  transactions  Transaction[]
  balances      AccountBalance[]  // NEW: Multi-currency cash balances

  @@map("accounts")
}
```

### 3.2 New: AccountBalance (Multi-Currency Cash)

Tracks cash balances per currency per account. Essential for brokers like IBKR.

```prisma
model AccountBalance {
  id          String   @id @default(uuid())
  accountId   String   @map("account_id")
  currency    String   // EUR, USD, GBP, etc.
  balance     Decimal  @db.Decimal(18, 4)
  updatedAt   DateTime @updatedAt @map("updated_at")

  account     Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@unique([accountId, currency])
  @@map("account_balances")
}
```

**Usage examples:**
- DeGiro EUR account: 1 balance (EUR)
- IBKR multi-currency: 3 balances (EUR, USD, GBP)
- Bank account: 1 balance (EUR)
- Pension: 1 balance (EUR) - represents total value

### 3.3 Extended Transaction Types

```prisma
enum TransactionType {
  // Investment transactions (existing)
  buy
  sell
  dividend
  fee
  split

  // Cash movements (new)
  deposit           // Cash added to account
  withdrawal        // Cash removed from account
  transfer_in       // Transfer from another tracked account
  transfer_out      // Transfer to another tracked account

  // Banking (new)
  interest          // Bank interest earned

  // Pension/Manual (new)
  contribution      // Pension plan contribution
  valuation         // Manual value update (real estate, pension current value)

  // FX (new)
  fx_conversion     // Currency exchange within account

  other
}
```

**Transaction type by account type:**

| Account Type | Typical Transactions |
|--------------|---------------------|
| broker | buy, sell, dividend, fee, deposit, withdrawal, fx_conversion |
| bank | deposit, withdrawal, interest, transfer_in, transfer_out |
| pension | contribution, valuation |
| real_estate | valuation |
| crypto | buy, sell, deposit, withdrawal, transfer_in |

### 3.4 Institution Registry (Static Config)

```typescript
// packages/shared-types/src/institutions.ts

export interface Institution {
  id: string;
  name: string;
  type: AccountType;
  country: string | null;
  logoUrl?: string;
  hasParser: boolean;
  supportedCurrencies: string[];  // NEW
  parserInstructions?: string;
}

export const INSTITUTIONS: Institution[] = [
  {
    id: 'degiro',
    name: 'DeGiro',
    type: 'broker',
    country: 'NL',
    hasParser: true,
    supportedCurrencies: ['EUR', 'USD', 'GBP', 'CHF', 'DKK', 'SEK', 'NOK'],
    parserInstructions: 'Actividad > Estado de cuenta > Exportar CSV',
  },
  {
    id: 'ibkr',
    name: 'Interactive Brokers',
    type: 'broker',
    country: 'IE',
    hasParser: true,
    supportedCurrencies: ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'AUD', 'CAD'],
    parserInstructions: 'Reports > Statements > Activity',
  },
  {
    id: 'trade-republic',
    name: 'Trade Republic',
    type: 'broker',
    country: 'DE',
    hasParser: true,
    supportedCurrencies: ['EUR'],
    parserInstructions: 'Via pytr (Python library)',
  },
  {
    id: 'sabadell',
    name: 'Banco Sabadell',
    type: 'bank',
    country: 'ES',
    hasParser: true,
    supportedCurrencies: ['EUR'],
  },
  {
    id: 'bbva',
    name: 'BBVA',
    type: 'bank',
    country: 'ES',
    hasParser: false,
    supportedCurrencies: ['EUR'],
  },
  {
    id: 'pibank',
    name: 'Pibank',
    type: 'bank',
    country: 'ES',
    hasParser: false,
    supportedCurrencies: ['EUR'],
  },
  {
    id: 'caser',
    name: 'Caser Pensiones',
    type: 'pension',
    country: 'ES',
    hasParser: false,
    supportedCurrencies: ['EUR'],
    parserInstructions: 'Manual: Enter total value monthly',
  },
  {
    id: 'manual',
    name: 'Manual Entry',
    type: 'other',
    country: null,
    hasParser: false,
    supportedCurrencies: ['EUR', 'USD'],
  },
];
```

### 3.5 Net Worth Calculation Logic

**Net Worth = Sum of all account values**

Per account type:
- **broker**: Σ(position market values) + Σ(cash balances in EUR)
- **bank**: Σ(cash balances in EUR)
- **pension**: Latest `valuation` transaction amount OR Σ(cash balances)
- **real_estate**: Latest `valuation` transaction amount
- **crypto**: Σ(position market values) + Σ(cash balances in EUR)

**Multi-currency conversion:**
- All values converted to user's base currency (EUR) for aggregation
- FX rates fetched from external service (future: ECB, OpenExchangeRates)
- For MVP: assume EUR-only or manual conversion

### 3.6 Net Worth Snapshot Table (Phase 2+)

For historical charts, store daily snapshots:

```prisma
model NetWorthSnapshot {
  id            String    @id @default(uuid())
  userId        String    @map("user_id")
  date          DateTime  @db.Date

  // Totals (in base currency)
  totalAssets   Decimal   @map("total_assets") @db.Decimal(18, 4)
  totalLiabilities Decimal @map("total_liabilities") @db.Decimal(18, 4) @default(0)
  netWorth      Decimal   @map("net_worth") @db.Decimal(18, 4)

  // Breakdown (JSON for flexibility)
  breakdown     Json?     // { byType: {...}, byInstitution: {...} }

  createdAt     DateTime  @default(now()) @map("created_at")

  @@unique([userId, date])
  @@map("net_worth_snapshots")
}
```

---

## 4. Navigation Structure

### Current
```
Dashboard  |  Positions  |  Transactions
```

### Proposed
```
Overview  |  Investments  |  Accounts  |  Transactions  |  (Strategy - future)
```

| Route | Purpose |
|-------|---------|
| `/overview` | Net worth dashboard, all accounts summary |
| `/investments` | Portfolio detail (renamed from Positions) |
| `/accounts` | Account management, add/edit accounts |
| `/transactions` | Transaction history (existing) |
| `/strategy` | Investment plan & rebalancing (future) |

---

## 5. Overview Page Design

### Wireframe

```
┌─────────────────────────────────────────────────────────────────┐
│  NET WORTH                                                      │
│  €125,430.00                           ▲ €2,340.50 (+1.90%)     │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  [1M] [3M] [6M] [YTD] [1Y] [All]                                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │          📈 Area chart: Net worth over time               │  │
│  │              (requires historical snapshots)              │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐    │
│  │ 💰 Total Assets │ │ 📈 Invested     │ │ 🏦 Cash         │    │
│  │   €125,430      │ │   €93,430       │ │   €32,000       │    │
│  │   (net worth)   │ │   +€8,230 YTD   │ │   25.5%         │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘    │
│                                                                  │
│  ACCOUNTS BY TYPE                                                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 📈 Investments (3)                              €93,430   │  │
│  │   ┌─────────────────────────────────────────────────────┐ │  │
│  │   │ DeGiro              Main Portfolio    €52,300  56%  │ │  │
│  │   │ Trade Republic      Tech Stocks       €28,630  31%  │ │  │
│  │   │ IBKR                US Stocks         €12,500  13%  │ │  │
│  │   └─────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │ 🏦 Banks (2)                                    €18,000   │  │
│  │   ┌─────────────────────────────────────────────────────┐ │  │
│  │   │ Sabadell            Checking          €12,000  67%  │ │  │
│  │   │ Pibank              Savings            €6,000  33%  │ │  │
│  │   └─────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │ 🎯 Pension (1)                                  €14,000   │  │
│  │   ┌─────────────────────────────────────────────────────┐ │  │
│  │   │ Caser               Plan Pensiones    €14,000 100%  │ │  │
│  │   └─────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────┐ ┌─────────────────────────────┐│
│  │ ASSET ALLOCATION            │ │ RECENT ACTIVITY             ││
│  │ ┌─────────────────────────┐ │ │                             ││
│  │ │                         │ │ │ Dec 28  BUY   NVDA    €500  ││
│  │ │     [Donut Chart]       │ │ │ Dec 27  DIV   MSFT     €12  ││
│  │ │                         │ │ │ Dec 26  BUY   VTI     €300  ││
│  │ │  Stocks      45%        │ │ │ Dec 25  SELL  AAPL    €200  ││
│  │ │  ETFs        25%        │ │ │ Dec 24  BUY   GOOGL   €400  ││
│  │ │  Cash        20%        │ │ │                             ││
│  │ │  Pension     10%        │ │ │         [View all →]        ││
│  │ └─────────────────────────┘ │ └─────────────────────────────┘│
│  └─────────────────────────────┘                                │
└─────────────────────────────────────────────────────────────────┘
```

### Components Breakdown

| Component | Data Source | Phase |
|-----------|-------------|-------|
| `NetWorthHero` | Computed from all accounts | 1 |
| `NetWorthChart` | `net_worth_snapshots` table | 2 |
| `SummaryCards` | Aggregated from accounts | 1 |
| `AccountsByType` | Grouped accounts with totals | 1 |
| `AllocationChart` | Positions by asset class | 1 |
| `RecentActivity` | Last N transactions | 1 |

---

## 6. API Endpoints

### 6.1 Overview Endpoints (New)

```typescript
// GET /api/v1/overview/summary
// Returns aggregated financial summary
interface OverviewSummary {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;  // Future

  // Breakdown
  totalInvested: number;     // Sum of position values
  totalCash: number;         // Sum of cash balances
  totalPension: number;      // Sum of pension values
  totalOther: number;        // Manual accounts

  // Performance
  investedPnl: number;       // Unrealized P&L
  investedPnlPercent: number;

  // Currency
  baseCurrency: string;      // EUR
}

// GET /api/v1/overview/accounts-grouped
// Returns accounts grouped by type with totals
interface AccountsGrouped {
  [type: AccountType]: {
    total: number;
    count: number;
    accounts: AccountSummary[];
  }
}

interface AccountSummary {
  id: string;
  name: string;
  institution: string;
  value: number;           // Computed: positions + cash + manual
  percentOfTotal: number;
  currency: string;
  lastImportAt?: string;
}

// GET /api/v1/overview/allocation
// Returns asset allocation for charts
interface AssetAllocation {
  items: {
    category: string;      // 'Stocks', 'ETFs', 'Cash', etc.
    value: number;
    percentage: number;
    color?: string;
  }[];
  total: number;
}

// GET /api/v1/overview/history?period=1M|3M|6M|YTD|1Y|ALL
// Returns net worth history for chart (Phase 2)
interface NetWorthHistory {
  points: {
    date: string;
    netWorth: number;
    assets: number;
    liabilities: number;
  }[];
  period: string;
  startDate: string;
  endDate: string;
}
```

### 6.2 Account Endpoints (Enhanced)

```typescript
// GET /api/v1/accounts
// Enhanced to include type and computed values
interface Account {
  id: string;
  type: AccountType;
  institution: string;
  name: string;
  currency: string;

  // Computed values
  positionsValue: number;    // Sum of position market values
  cashBalance: number;
  manualValue?: number;
  totalValue: number;        // positions + cash + manual

  // Metadata
  isActive: boolean;
  lastImportAt?: string;
  positionCount: number;

  createdAt: string;
  updatedAt: string;
}

// POST /api/v1/accounts
// Create account (enhanced)
interface CreateAccountInput {
  type: AccountType;
  institution: string;
  name: string;
  currency: string;
  cashBalance?: number;
  manualValue?: number;      // For manual-entry accounts
  notes?: string;
}

// PATCH /api/v1/accounts/:id
// Update account
interface UpdateAccountInput {
  name?: string;
  cashBalance?: number;
  manualValue?: number;
  isActive?: boolean;
  notes?: string;
}

// GET /api/v1/institutions
// Returns list of known institutions
interface InstitutionInfo {
  id: string;
  name: string;
  type: AccountType;
  country: string | null;
  hasParser: boolean;
  parserInstructions?: string;
}
```

---

## 7. Implementation Phases

### Phase 1: Overview Foundation (Current Focus)
- Schema changes (account type, cash balance, manual value)
- Institution registry (static config)
- Overview page with summary cards
- Accounts grouped by type
- Asset allocation donut chart
- Recent transactions widget

### Phase 2: Historical Data & Charts
- Net worth snapshot table
- Daily snapshot job (scheduled or on-demand)
- Net worth trend chart with time periods
- Performance tracking

### Phase 3: Account Management
- Dedicated accounts page
- Add/edit account forms
- Manual account entry
- Account detail view

### Phase 4: Enhanced Investments
- Rename Positions → Investments
- Performance chart
- Holdings breakdown by asset class
- Top movers widget

### Phase 5: New Parsers
- IBKR CSV parser
- Sabadell CSV parser
- BBVA CSV parser
- Caser pension parser

### Phase 6: Strategy Planner
- Target allocation definition
- Current vs target comparison
- Rebalancing suggestions

---

## 8. Phase 1 Detailed Tasks

### 8.1 Database Schema Changes

**File**: `packages/database/prisma/schema.prisma`

```diff
+ enum AccountType {
+   broker
+   bank
+   pension
+   crypto
+   real_estate
+   other
+ }

  model Account {
    id            String      @id @default(uuid())
    userId        String      @map("user_id")
-   broker        String
-   accountId     String?     @map("account_id")
-   accountName   String?     @map("account_name")
+
+   // Classification
+   type          AccountType @default(broker)
+   institution   String      // 'degiro', 'sabadell', etc.
+   name          String      // User's display name
    currency      String      @default("EUR")
+
+   // Balances
+   cashBalance   Decimal?    @map("cash_balance") @db.Decimal(18, 4)
+   manualValue   Decimal?    @map("manual_value") @db.Decimal(18, 4)
+
+   // Metadata
+   isActive      Boolean     @default(true) @map("is_active")
+   lastImportAt  DateTime?   @map("last_import_at")
+   notes         String?

    createdAt     DateTime    @default(now()) @map("created_at")
    updatedAt     DateTime    @updatedAt @map("updated_at")

    // Relations
    positions     Position[]
    transactions  Transaction[]

    @@map("accounts")
  }
```

**Migration steps**:
1. Add new columns with defaults
2. Migrate existing data: `broker` → `institution`, `accountName` → `name`, `type` = 'broker'
3. Remove old columns

### 8.2 Institution Registry

**File**: `packages/shared-types/src/institutions.ts`

```typescript
import type { AccountType } from './account';

export interface Institution {
  id: string;
  name: string;
  type: AccountType;
  country: string | null;
  hasParser: boolean;
  parserInstructions?: string;
}

export const INSTITUTIONS: Institution[] = [
  // Brokers
  {
    id: 'degiro',
    name: 'DeGiro',
    type: 'broker',
    country: 'NL',
    hasParser: true,
    parserInstructions: 'Go to Activity > Account Statement > Export CSV',
  },
  {
    id: 'trade-republic',
    name: 'Trade Republic',
    type: 'broker',
    country: 'DE',
    hasParser: true,
  },
  {
    id: 'ibkr',
    name: 'Interactive Brokers',
    type: 'broker',
    country: 'US',
    hasParser: false,
  },

  // Banks
  {
    id: 'sabadell',
    name: 'Banco Sabadell',
    type: 'bank',
    country: 'ES',
    hasParser: false,
  },
  {
    id: 'bbva',
    name: 'BBVA',
    type: 'bank',
    country: 'ES',
    hasParser: false,
  },
  {
    id: 'pibank',
    name: 'Pibank',
    type: 'bank',
    country: 'ES',
    hasParser: false,
  },

  // Pension
  {
    id: 'caser',
    name: 'Caser Pensiones',
    type: 'pension',
    country: 'ES',
    hasParser: false,
  },

  // Manual
  {
    id: 'manual',
    name: 'Manual Entry',
    type: 'other',
    country: null,
    hasParser: false,
  },
];

export function getInstitution(id: string): Institution | undefined {
  return INSTITUTIONS.find((i) => i.id === id);
}

export function getInstitutionsByType(type: AccountType): Institution[] {
  return INSTITUTIONS.filter((i) => i.type === type);
}
```

### 8.3 Install shadcn Charts

```bash
cd apps/web
bunx shadcn@latest add chart
```

**File**: `apps/web/src/app.css` (add chart colors)

```css
@layer base {
  :root {
    /* Existing colors... */

    /* Chart colors */
    --chart-1: oklch(0.646 0.222 41.116);   /* Orange (accent) */
    --chart-2: oklch(0.6 0.15 250);          /* Blue */
    --chart-3: oklch(0.65 0.18 150);         /* Teal */
    --chart-4: oklch(0.7 0.15 320);          /* Purple */
    --chart-5: oklch(0.75 0.12 80);          /* Yellow */

    /* Semantic */
    --color-gain: oklch(0.65 0.2 145);       /* Green */
    --color-loss: oklch(0.6 0.22 25);        /* Red */
  }

  .dark {
    /* Dark mode chart colors */
    --chart-1: oklch(0.75 0.18 41.116);
    --chart-2: oklch(0.7 0.15 250);
    --chart-3: oklch(0.72 0.16 150);
    --chart-4: oklch(0.75 0.14 320);
    --chart-5: oklch(0.78 0.1 80);

    --color-gain: oklch(0.72 0.18 145);
    --color-loss: oklch(0.68 0.2 25);
  }
}
```

### 8.4 Frontend File Structure

```
apps/web/src/
├── features/
│   └── overview/
│       ├── index.ts                    # Barrel export
│       └── components/
│           ├── overview.tsx            # Main page component
│           ├── overview-error.tsx      # Error boundary
│           ├── net-worth-hero.tsx      # Big number + change
│           ├── summary-cards.tsx       # Assets/Invested/Cash cards
│           ├── accounts-by-type.tsx    # Grouped accounts list
│           ├── allocation-chart.tsx    # Donut chart
│           └── recent-activity.tsx     # Last transactions
├── lib/
│   └── api/
│       ├── types.ts                    # Add new types
│       └── queries/
│           └── overview.ts             # New query options
└── routes/
    └── _authenticated/
        ├── index.tsx                   # Redirect to /overview
        └── overview.tsx                # Route file
```

### 8.5 API Implementation

**New module**: `apps/api/src/modules/overview/`

```
apps/api/src/modules/overview/
├── overview.module.ts
├── presentation/
│   └── controllers/
│       └── overview.controller.ts
├── application/
│   ├── use-cases/
│   │   ├── get-overview-summary.use-case.ts
│   │   ├── get-accounts-grouped.use-case.ts
│   │   └── get-asset-allocation.use-case.ts
│   └── dtos/
│       └── overview.dto.ts
└── domain/
    └── interfaces/
        └── overview.interfaces.ts
```

### 8.6 Task Checklist

| # | Task | Est. Complexity |
|---|------|-----------------|
| 1 | Create Prisma migration for Account schema changes | Medium |
| 2 | Update shared-types with new Account types | Low |
| 3 | Create institution registry in shared-types | Low |
| 4 | Install shadcn chart component | Low |
| 5 | Add chart CSS variables to app.css | Low |
| 6 | Create Overview module in API | Medium |
| 7 | Implement GET /overview/summary endpoint | Medium |
| 8 | Implement GET /overview/accounts-grouped endpoint | Medium |
| 9 | Implement GET /overview/allocation endpoint | Low |
| 10 | Create overview feature folder in web | Low |
| 11 | Create NetWorthHero component | Low |
| 12 | Create SummaryCards component | Low |
| 13 | Create AccountsByType component | Medium |
| 14 | Create AllocationChart component | Medium |
| 15 | Create RecentActivity component | Low |
| 16 | Create Overview page component | Medium |
| 17 | Add /overview route | Low |
| 18 | Update navigation to use new routes | Low |
| 19 | Add i18n translations for overview | Low |
| 20 | Update import flow to handle new account fields | Medium |

---

## 9. Future Phases

### Phase 2: Historical Data
- Add `net_worth_snapshots` table
- Create snapshot service (daily or on-demand)
- Implement NetWorthChart component
- Add time period selector (1M/3M/6M/YTD/1Y/All)

### Phase 3: Account Management
- Create `/accounts` page
- Add account creation form (with institution selector)
- Add account edit/delete
- Add manual value entry for non-import accounts
- Account detail view with transactions

### Phase 4: Enhanced Investments
- Rename Positions → Investments
- Add performance line chart
- Add holdings by asset class breakdown
- Add "top movers" widget
- Add dividend tracking

### Phase 5: New Parsers
- Research CSV formats for IBKR, Sabadell, BBVA, Caser
- Implement parsers following existing pattern
- Add parser selection in import modal

### Phase 6: Strategy Planner
- Target allocation definition UI
- Target vs actual comparison
- Rebalancing calculator
- Investment rules engine

---

## 10. Technical Decisions

### 10.1 Charts: shadcn/ui Charts (Recharts)

**Rationale**:
- Official shadcn integration
- Uses Recharts under the hood (24.8K+ GitHub stars)
- Native theming with CSS variables
- No vendor lock-in

### 10.2 Account Type as Enum

**Rationale**:
- Simple and type-safe
- Easy to add new types via migration
- Behavior comes from institution config, not type

### 10.3 Institution as Static Config (for now)

**Rationale**:
- No database table needed initially
- Easy to add new institutions
- Can migrate to database table later if needed

### 10.4 Computed Values in API, Not Stored

**Rationale**:
- Account `totalValue` = positions + cash + manual
- Always fresh, no sync issues
- Can cache in API layer if performance needed

### 10.5 Multi-Currency: Convert to Base Currency

**Rationale**:
- All aggregations in user's base currency (EUR)
- Store original currency per account
- Future: exchange rate service for conversion

---

## Appendix A: CSV Format Analysis (from .csv/ folder)

### A.1 DeGiro - Transactions.csv (Already Supported)

**Type**: Investment transactions only
**Delimiter**: Comma
**Encoding**: UTF-8 with BOM

```
Fecha,Hora,Producto,ISIN,Bolsa de referencia,Centro de ejecución,Número,Precio,,Valor local,,Valor EUR,Tipo de cambio,Comisión AutoFX,Costes de transacción y/o externos EUR,Total EUR,ID Orden,
31-12-2025,16:04,SOUNDHOUND AI INC,US8361001071,NDQ,ARCX,177,"9,9500",USD,"-1761,15",USD,"-1502,31","1,1723","-3,76","-2,00","-1504,31",,64ac64c4-daf7-4709-84dc-f5fa4bd26652
```

**Key fields**:
- `Número`: Quantity (negative = buy, positive = sell)
- `Total EUR`: Final amount including fees
- Multi-currency support (USD, EUR, DKK)

### A.2 DeGiro - Account.csv (More Complete - NEW)

**Type**: Full account activity (recommended for import)
**Includes**: Dividends, fees, cash transfers, FX conversions, taxes

```
Fecha,Hora,Fecha valor,Producto,ISIN,Descripción,Tipo,Variación,,Saldo,,ID Orden
31-12-2025,16:04,31-12-2025,SOUNDHOUND AI INC CLASS A,US8361001071,Ingreso Cambio de Divisa,"1,1694",USD,"1761,15",USD,"0,00",64ac64c4-...
24-12-2025,07:46,23-12-2025,META PLATFORMS INC CLASS A,US30303M1027,Dividendo,,USD,"2,63",USD,"2,24",
24-12-2025,07:45,23-12-2025,META PLATFORMS INC CLASS A,US30303M1027,Retención del dividendo,,USD,"-0,39",USD,"-0,39",
```

**Key transaction types (Descripción)**:
- `Compra X [Product]@[Price] [Currency]` → Buy
- `Venta X [Product]@[Price] [Currency]` → Sell
- `Dividendo` → Dividend income
- `Retención del dividendo` → Dividend tax withholding
- `Costes de transacción y/o externos de DEGIRO` → Transaction fee
- `Spanish Transaction Tax` → Spanish FTT
- `Comisión de conectividad con el mercado` → Market connectivity fee
- `Degiro Cash Sweep Transfer` → Cash movement
- `Ingreso Cambio de Divisa` / `Retirada Cambio de Divisa` → FX conversion

**Recommendation**: Use Account.csv instead of Transactions.csv for:
- ✅ Dividend tracking
- ✅ Fee breakdown
- ✅ Cash balance tracking
- ✅ Tax withholding records

### A.3 Interactive Brokers (IBKR) - Activity Statement

**Type**: Multi-section statement (not standard CSV)
**Format**: Section-based with headers

```
Statement,Header,Field Name,Field Value
Statement,Data,BrokerName,Interactive Brokers Ireland Limited
Account Information,Data,Name,Sergio Ayora Sancho
Account Information,Data,Account,U22002049
Account Information,Data,Base Currency,EUR
Net Asset Value,Data,Cash,5000
Deposits & Withdrawals,Data,EUR,2025-09-27,Electronic Fund Transfer,5000
```

**Sections available**:
- `Statement` - Report metadata
- `Account Information` - Account details
- `Net Asset Value` - Current balances
- `Change in NAV` - Period changes
- `Cash Report` - Cash details by currency
- `Deposits & Withdrawals` - Cash movements
- `Trades` - (when present) Buy/sell transactions
- `Dividends` - (when present) Dividend payments

**Parser approach**: Parse by section, not row-by-row.

**Current sample**: Only has €5,000 deposit, no trades yet.

### A.4 Banco Sabadell - XLS File

**File**: `31122025_0215_0001062608.xls`
**Format**: Binary Excel (not CSV)

**Action required**:
- Add XLS reading support using `xlsx` library
- Or convert to CSV manually for analysis

### A.5 Trade Republic

**Native export**: ❌ Not available
**Chosen solution**: **pytr** (Python package)

**Why pytr over TR Exporter:**
- ✅ More secure (open source, 647 stars, 40 contributors)
- ✅ Actively maintained (v0.4.5, Dec 2025)
- ✅ Can integrate with existing `apps/python-service/`
- ✅ Automatable (vs manual Chrome extension)
- ✅ No browser extension permissions needed

**pytr output format**:
```csv
date,type,isin,name,shares,price,amount,currency
2025-01-15,Buy,US0378331005,Apple Inc,10,150.00,-1500.00,EUR
2025-01-20,Dividend,US0378331005,Apple Inc,,,12.50,EUR
```

**Integration plan**: Add endpoint in `apps/python-service/` to sync Trade Republic data via pytr.

### A.6 Caser Pensiones

**Native export**: ❌ Not available
**Solution**: Manual value entry (monthly updates)

**Data model for pension**:
- `manualValue`: Current total value
- `lastImportAt`: When value was last updated
- No positions/transactions tracking

---

## Appendix B: Questions Resolved

| Question | Answer |
|----------|--------|
| Cash balance source for brokers? | DeGiro Account.csv has running balance. IBKR has Cash Report section. |
| Pension tracking? | Caser: Manual value entry monthly. No CSV available. |
| Multi-currency? | Yes - DeGiro trades in USD, EUR, DKK. Need FX conversion to EUR base. |
| Liabilities? | Deferred to future phase. |

---

## Appendix C: Parser Implementation Priority

| Parser | Priority | Status | Notes |
|--------|----------|--------|-------|
| DeGiro Account.csv | High | 🔶 New | More complete than Transactions.csv |
| IBKR Activity Statement | High | 🔶 New | Multi-section parser needed |
| Sabadell XLS | Medium | 🔶 New | Requires xlsx library |
| Trade Republic (via TR Exporter) | Medium | 🔶 New | Standard CSV format |
| BBVA | Low | ❓ | Need sample file |
| Pibank | Low | ❓ | Need sample file |

---

## Appendix D: Technical Requirements for New Parsers

### XLS Support (for Sabadell)

```bash
# Add to apps/api
bun add xlsx
```

```typescript
import * as XLSX from 'xlsx';

function parseXLS(buffer: Buffer): ParsedRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet);
}
```

### IBKR Multi-Section Parser

```typescript
interface IBKRSection {
  name: string;
  headers: string[];
  data: Record<string, string>[];
}

function parseIBKRStatement(content: string): IBKRSection[] {
  const lines = content.split('\n');
  const sections: IBKRSection[] = [];

  for (const line of lines) {
    const [sectionName, rowType, ...values] = line.split(',');
    // Group by section, handle Header vs Data rows
  }

  return sections;
}
```

---

*Plan created: 2025-12-31*
*Last updated: 2025-12-31 (Added CSV analysis)*
*Status: Ready for review*
