# Portfolio Aggregator - API

A NestJS REST API for managing investment portfolios across multiple brokers.

## Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | NestJS 11 |
| **HTTP Server** | Fastify 5 (not Express) |
| **Database** | PostgreSQL via Supabase + Prisma |
| **Authentication** | Supabase Auth (JWT) |
| **Validation** | class-validator + class-transformer |
| **Documentation** | Swagger/OpenAPI |
| **Testing** | Bun test runner |
| **Architecture** | Clean Architecture |

## Quick Start

```bash
# From monorepo root
bun install

# Start local Supabase (requires Docker)
bunx supabase start

# Start API in development mode
bun run dev:api
```

The API runs at `http://localhost:3333`
Swagger docs at `http://localhost:3333/api/docs`

---

## For Beginners: Understanding the Architecture

### What is Clean Architecture?

Think of the API like an onion with layers. Each layer has a specific job, and they can only talk to the layers inside them (never outside).

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│   "The receptionist" - Handles HTTP requests/responses       │
│   Controllers, DTOs, Guards                                  │
├─────────────────────────────────────────────────────────────┤
│                    APPLICATION LAYER                         │
│   "The manager" - Orchestrates business operations           │
│   Services, Use Cases, Parsers                               │
├─────────────────────────────────────────────────────────────┤
│                   INFRASTRUCTURE LAYER                       │
│   "The warehouse" - Handles data storage                     │
│   Repositories (database access)                             │
├─────────────────────────────────────────────────────────────┤
│                      DOMAIN LAYER                            │
│   "The rulebook" - Core business logic                       │
│   Entities, Interfaces                                       │
└─────────────────────────────────────────────────────────────┘
```

**Why?** This separation makes the code:
- **Testable**: You can test each layer independently
- **Maintainable**: Changes in one layer don't break others
- **Flexible**: You can swap databases or frameworks without rewriting everything

### How a Request Flows

When you call `GET /accounts`:

```
1. HTTP Request arrives
        ↓
2. Controller receives it (presentation)
   "Hey, someone wants all accounts for user X"
        ↓
3. Service processes it (application)
   "Let me ask the database for this user's accounts"
        ↓
4. Repository fetches data (infrastructure)
   "SELECT * FROM accounts WHERE user_id = X"
        ↓
5. Data flows back up through the layers
        ↓
6. HTTP Response sent
```

### Understanding Dependency Injection

Instead of creating objects directly, we "inject" them:

```typescript
// ❌ Bad: Tightly coupled
class AccountsService {
  private repository = new AccountRepository(); // Hard to test!
}

// ✅ Good: Dependency injection
class AccountsService {
  constructor(private repository: IAccountRepository) {} // Easy to swap/mock!
}
```

The `@Inject()` decorator tells NestJS what to inject:

```typescript
constructor(
  @Inject(ACCOUNT_REPOSITORY)  // "Please give me the account repository"
  private readonly repository: IAccountRepository,
) {}
```

---

## Project Structure

```
src/
├── main.ts                           # App entry point, Fastify setup
├── app.module.ts                     # Root module
├── app.controller.ts                 # Health check endpoint
│
├── modules/
│   ├── auth/                         # Authentication module
│   │   ├── domain/interfaces/        # Auth contracts
│   │   ├── infrastructure/           # Supabase implementation
│   │   ├── presentation/             # Guards, decorators
│   │   └── auth.module.ts
│   │
│   └── portfolio/                    # Main business module
│       ├── domain/
│       │   └── entities/             # Business objects
│       │       ├── account.entity.ts
│       │       ├── transaction.entity.ts
│       │       ├── position.entity.ts
│       │       └── security.entity.ts
│       │
│       ├── application/
│       │   ├── services/             # Business logic orchestration
│       │   │   ├── accounts.service.ts
│       │   │   ├── transactions.service.ts
│       │   │   ├── positions.service.ts
│       │   │   └── securities.service.ts
│       │   ├── use-cases/            # Complex operations
│       │   │   └── import-transactions.use-case.ts
│       │   └── parsers/              # CSV parsing logic
│       │       ├── base-parser.ts
│       │       ├── degiro-parser.ts
│       │       └── trade-republic-parser.ts
│       │
│       ├── infrastructure/
│       │   ├── repositories/         # Database access
│       │   │   ├── account.repository.ts
│       │   │   ├── account.repository.interface.ts
│       │   │   └── ... (other repositories)
│       │   └── services/             # External API clients
│       │       └── openfigi.service.ts  # Security type lookup via OpenFIGI
│       │
│       ├── presentation/
│       │   ├── controllers/          # HTTP endpoints
│       │   │   ├── accounts.controller.ts
│       │   │   ├── transactions.controller.ts
│       │   │   ├── positions.controller.ts
│       │   │   └── import.controller.ts
│       │   └── dto/                  # Request/Response shapes
│       │       ├── account/
│       │       ├── transaction/
│       │       └── position/
│       │
│       └── portfolio.module.ts
│
└── shared/
    ├── database/                     # Prisma client wrapper
    │   ├── database.service.ts
    │   └── database.module.ts
    └── filters/                      # Error handling
        └── http-exception.filter.ts
```

---

## API Endpoints

All endpoints require authentication (Bearer token) except `/health`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/accounts` | List user's accounts |
| `POST` | `/accounts` | Create account |
| `GET` | `/accounts/:id` | Get account by ID |
| `PATCH` | `/accounts/:id` | Update account |
| `DELETE` | `/accounts/:id` | Delete account |
| `GET` | `/transactions` | List transactions (with filters) |
| `POST` | `/transactions` | Create transaction |
| `GET` | `/positions` | List current positions |
| `GET` | `/positions/summary` | Portfolio summary |
| `GET` | `/securities` | List securities |
| `POST` | `/import` | Import transactions from CSV |

Full documentation at: `http://localhost:3333/api/docs`

---

## Key Concepts Explained

### Entities vs DTOs

| Concept | Purpose | Example |
|---------|---------|---------|
| **Entity** | Represents a business object with behavior | `AccountEntity` with `belongsToUser()` method |
| **DTO** | Shapes data for HTTP transfer | `CreateAccountDto` with validation rules |

```typescript
// Entity (domain layer) - has business logic
class AccountEntity {
  belongsToUser(userId: string): boolean {
    return this.userId === userId;
  }
}

// DTO (presentation layer) - validates input
class CreateAccountDto {
  @IsString()
  @ApiProperty({ description: 'Account name' })
  name: string;
}
```

### Repository Pattern

Repositories abstract database access. The service doesn't know (or care) if you're using PostgreSQL, MongoDB, or a text file.

```typescript
// Interface (contract)
interface IAccountRepository {
  findByUserId(userId: string): Promise<Account[]>;
}

// Implementation (actual database code)
class AccountRepository implements IAccountRepository {
  async findByUserId(userId: string) {
    return this.db.account.findMany({ where: { userId } });
  }
}
```

### Token Constants

We use constants instead of magic strings for dependency injection:

```typescript
// ✅ Good: Type-safe, refactorable
export const ACCOUNT_REPOSITORY = 'ACCOUNT_REPOSITORY';
@Inject(ACCOUNT_REPOSITORY) private repo: IAccountRepository

// ❌ Bad: Magic string, error-prone
@Inject('IAccountRepository') private repo: IAccountRepository
```

---

## Environment Variables

Create `.env` at monorepo root:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Supabase
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Server
PORT=3333
NODE_ENV=development

# Development mode (bypasses auth with mock user)
DEV_MODE=false
```

---

## Development

### Running the API

```bash
# Development with hot reload
bun run dev:api

# Or from apps/api directory
bun run dev
```

### Running Tests

```bash
cd apps/api
bun test              # Run all tests
bun test --watch      # Watch mode
```

### Linting & Type Checking

```bash
bun run lint          # Biome linter
bun run type-check    # TypeScript check
```

### Database Commands

```bash
# From monorepo root
bunx supabase start   # Start local database
bunx supabase stop    # Stop database
bunx prisma studio    # Visual database browser
bunx prisma db push   # Push schema changes
```

---

## Adding New Features

### 1. Create a New Module

Use the `/new-module` command or create manually:

```
src/modules/<module-name>/
├── domain/entities/
├── application/services/
├── infrastructure/repositories/
├── presentation/controllers/
├── presentation/dto/
└── <module>.module.ts
```

### 2. Follow the Pattern

1. **Define entity** in `domain/entities/`
2. **Create repository interface** in `infrastructure/repositories/*.interface.ts`
3. **Implement repository** in `infrastructure/repositories/*.repository.ts`
4. **Create service** in `application/services/`
5. **Create controller** with DTOs in `presentation/`
6. **Wire up in module** using factory providers
7. **Register module** in `app.module.ts`

### 3. Example Module Registration

```typescript
@Module({
  controllers: [MyController],
  providers: [
    // Repository with factory provider
    {
      provide: MY_REPOSITORY,
      useFactory: (db: DatabaseService) => new MyRepository(db),
      inject: [DatabaseService],
    },
    // Service
    MyService,
  ],
  exports: [MyService],
})
export class MyModule {}
```

---

## Testing

### Unit Test Example

```typescript
import { describe, expect, it, beforeEach, mock } from 'bun:test';
import { Test } from '@nestjs/testing';
import { AccountsService } from './accounts.service';
import { ACCOUNT_REPOSITORY } from '../infrastructure/repositories';

describe('AccountsService', () => {
  let service: AccountsService;

  const mockRepository = {
    findByUserId: mock(() => Promise.resolve([{ id: '1', name: 'Test' }])),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: ACCOUNT_REPOSITORY, useValue: mockRepository },
      ],
    }).compile();

    service = module.get(AccountsService);
  });

  it('should return accounts for user', async () => {
    const result = await service.findByUserId('user-123');
    expect(result).toHaveLength(1);
  });
});
```

---

## Error Handling

The API uses NestJS HTTP exceptions:

```typescript
import { NotFoundException, BadRequestException } from '@nestjs/common';

// In service
async findById(id: string) {
  const account = await this.repository.findById(id);
  if (!account) {
    throw new NotFoundException(`Account ${id} not found`);
  }
  return account;
}
```

All errors are formatted consistently by `HttpExceptionFilter`:

```json
{
  "statusCode": 404,
  "message": "Account abc123 not found",
  "error": "Not Found",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/accounts/abc123"
}
```

---

## Authentication

The API uses Supabase Auth with JWT tokens.

### Protected Routes

```typescript
@Controller('accounts')
@UseGuards(SupabaseAuthGuard)  // Requires valid JWT
export class AccountsController {
  @Get()
  findAll(@CurrentUser() user: AuthUser) {  // Extracts user from token
    return this.service.findByUserId(user.id);
  }
}
```

### Development Mode

Set `DEV_MODE=true` to bypass authentication with a mock user (useful for testing).

---

## Fastify vs Express

This API uses Fastify instead of Express because:

| Feature | Fastify | Express |
|---------|---------|---------|
| Performance | ~2x faster | Slower |
| Validation | Built-in JSON Schema | Requires middleware |
| Plugins | Modern async/await | Callback-based |
| TypeScript | First-class support | Requires types package |

**Important**: Don't use Express middleware. Use Fastify plugins instead:
- File uploads: `@fastify/multipart` (not multer)
- CORS: `@fastify/cors` (not cors)
- Compression: `@fastify/compress` (not compression)

---

## Contributing

1. Create feature branch from `main`
2. Follow Clean Architecture patterns
3. Add tests for new functionality
4. Run `bun run lint` and `bun run type-check`
5. Use repository token constants (not strings)
6. Submit PR with description
