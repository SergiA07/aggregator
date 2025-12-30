# Portfolio Aggregator - API

A NestJS REST API for managing investment portfolios across multiple brokers, built with Clean Architecture principles.

## Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | NestJS 11 |
| **HTTP Server** | Fastify (not Express) |
| **Database** | PostgreSQL via Supabase + Prisma v7 |
| **Authentication** | Supabase Auth (JWT) |
| **Validation** | Zod + class-validator |
| **Documentation** | Swagger/OpenAPI |
| **Logging** | Pino (structured JSON) |
| **Testing** | Bun test runner |

## Project Structure

```
src/
├── main.ts                              # Fastify bootstrap & plugins
├── app.module.ts                        # Root NestJS module
├── app.controller.ts                    # Health check endpoint
│
├── modules/                             # Feature modules
│   ├── auth/                            # Authentication (global)
│   │   ├── domain/interfaces/           # IAuthService, AuthUser
│   │   ├── infrastructure/              # SupabaseAuthService
│   │   └── presentation/                # Guards, decorators
│   │
│   └── portfolio/                       # Portfolio management
│       ├── domain/entities/             # Business objects
│       ├── application/
│       │   ├── services/                # Business logic
│       │   ├── use-cases/               # Complex workflows
│       │   └── parsers/                 # CSV parsing strategies
│       ├── infrastructure/
│       │   ├── repositories/            # Data access
│       │   └── services/                # External APIs
│       └── presentation/
│           ├── controllers/             # HTTP endpoints
│           └── dto/                     # Request/response shapes
│
└── shared/                              # Cross-cutting concerns
    ├── database/                        # Prisma client wrapper
    ├── filters/                         # Global error handling
    └── pipes/                           # Validation pipes
```

## Getting Started

### Prerequisites

- Bun 1.0+
- Docker (for local Supabase)
- PostgreSQL (via Supabase)

### Development

```bash
# From monorepo root
bun install

# Start local Supabase (requires Docker)
bunx supabase start

# Generate Prisma client
bun run db:generate

# Start API in dev mode
bun run dev:api
```

The API runs at `http://localhost:3333`

### Environment Variables

Required in `.env` at monorepo root:

```env
DATABASE_URL=postgresql://...
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Production only
FRONTEND_URL=https://your-frontend.com
```

## API Endpoints

| Route | Method | Purpose |
|-------|--------|---------|
| `/health` | GET | Health check |
| `/api/docs` | GET | Swagger UI |
| `/accounts` | GET/POST | List/create accounts |
| `/accounts/:id` | GET/PUT/DELETE | Manage account |
| `/transactions` | GET/POST | List/create transactions |
| `/positions` | GET | List positions |
| `/securities` | GET/POST | List/create securities |
| `/import/upload` | POST | Import CSV file |
| `/import/brokers` | GET | List supported brokers |

All routes except `/health` and `/api/docs` require authentication via `Authorization: Bearer <token>` header.

---

## Architecture: Clean Architecture

This API follows **Clean Architecture** with strict layer separation. Dependencies flow inward only - outer layers depend on inner layers, never the reverse.

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                       │
│         Controllers, DTOs, Guards, Decorators               │
│                                                             │
│  Handles HTTP concerns: routes, validation, auth, responses │
└─────────────────────────────────────────────────────────────┘
                            ↓ depends on
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                        │
│              Services, Use Cases, Parsers                   │
│                                                             │
│   Orchestrates business logic, coordinates repositories     │
└─────────────────────────────────────────────────────────────┘
                            ↓ depends on
┌─────────────────────────────────────────────────────────────┐
│                   INFRASTRUCTURE LAYER                      │
│            Repositories, External Services                  │
│                                                             │
│    Implements data access, external API integrations        │
└─────────────────────────────────────────────────────────────┘
                            ↓ depends on
┌─────────────────────────────────────────────────────────────┐
│                      DOMAIN LAYER                           │
│           Entities, Interfaces, Value Objects               │
│                                                             │
│  Pure business logic - NO framework dependencies            │
└─────────────────────────────────────────────────────────────┘
```

### Why Clean Architecture?

| Benefit | How It Helps |
|---------|--------------|
| **Testability** | Mock repositories easily, test business logic in isolation |
| **Flexibility** | Swap Supabase for Firebase? Change only infrastructure layer |
| **Maintainability** | Clear boundaries, predictable code location |
| **Scalability** | Add features without touching unrelated code |

---

## Layer Deep Dive

### Domain Layer (Business Rules)

The innermost layer contains **pure business logic** with zero framework dependencies. These classes can be copy-pasted to any TypeScript project.

**Entities** - Business objects with behavior:

```typescript
// domain/entities/transaction.entity.ts
export class TransactionEntity {
  constructor(
    public readonly id: string,
    public readonly type: TransactionType,
    public readonly quantity: Decimal,
    public readonly price: Decimal,
    // ...
  ) {}

  // Business logic methods
  isBuy(): boolean { return this.type === 'buy'; }
  isSell(): boolean { return this.type === 'sell'; }

  getNetAmount(): Decimal {
    return this.amount.minus(this.fees);
  }

  getTotalCost(): Decimal {
    return this.quantity.times(this.price).plus(this.fees);
  }
}
```

**Interfaces** - Contracts for outer layers:

```typescript
// domain/interfaces/auth.interface.ts
export interface IAuthService {
  verifyToken(token: string): Promise<AuthUser | null>;
}

export interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
}
```

### Application Layer (Orchestration)

Coordinates business operations using domain entities and repository interfaces.

**Services** - Simple CRUD orchestration:

```typescript
// application/services/accounts.service.ts
@Injectable()
export class AccountsService {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
  ) {}

  async findByUser(userId: string): Promise<Account[]> {
    return this.accountRepository.findByUser(userId);
  }

  async create(userId: string, data: CreateAccountInput): Promise<Account> {
    return this.accountRepository.create(userId, data);
  }
}
```

**Use Cases** - Complex multi-step workflows:

```typescript
// application/use-cases/import-transactions.use-case.ts
@Injectable()
export class ImportTransactionsUseCase {
  async execute(userId: string, content: string): Promise<ImportResult> {
    // 1. Detect broker format (DeGiro, Trade Republic, etc.)
    // 2. Parse CSV using appropriate parser
    // 3. Create/upsert account
    // 4. Create securities (with OpenFIGI lookup)
    // 5. Import transactions (with duplicate detection)
    // 6. Calculate and upsert positions
    // 7. Return comprehensive result
  }
}
```

**Parsers** - Strategy pattern for multi-format support:

```typescript
// application/parsers/base-parser.ts
export abstract class BaseParser {
  abstract readonly broker: string;
  abstract canParse(content: string): boolean;
  abstract parse(content: string): ParseResult;
}

// application/parsers/degiro-parser.ts
export class DegiroParser extends BaseParser {
  readonly broker = 'degiro';

  canParse(content: string): boolean {
    return content.includes('Fecha') || content.includes('Date');
  }

  parse(content: string): ParseResult {
    // DeGiro-specific CSV parsing logic
  }
}
```

### Infrastructure Layer (External Concerns)

Implements interfaces defined in domain/application layers.

**Repositories** - Data access abstraction:

```typescript
// infrastructure/repositories/account.repository.interface.ts
export interface IAccountRepository {
  findByUser(userId: string): Promise<Account[]>;
  findOne(userId: string, id: string): Promise<Account | null>;
  create(userId: string, data: CreateAccountData): Promise<Account>;
  update(userId: string, id: string, data: UpdateAccountData): Promise<Account | null>;
  delete(userId: string, id: string): Promise<boolean>;
}

// infrastructure/repositories/account.repository.ts
@Injectable()
export class AccountRepository implements IAccountRepository {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService
  ) {}

  async findByUser(userId: string): Promise<Account[]> {
    return this.db.account.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
```

**External Services** - Third-party integrations:

```typescript
// infrastructure/services/openfigi.service.ts
@Injectable()
export class OpenFigiService {
  async lookupByIsin(isin: string): Promise<SecurityMetadata | null> {
    // Calls OpenFIGI API to get security type (ETF, stock, bond, etc.)
    // Implements rate limiting, batching, and retry logic
  }
}
```

### Presentation Layer (HTTP Interface)

Handles all HTTP concerns - routing, validation, authentication, responses.

**Controllers** - Route handlers:

```typescript
// presentation/controllers/accounts.controller.ts
@Controller('accounts')
@UseGuards(SupabaseAuthGuard)
@ApiTags('Accounts')
@ApiBearerAuth()
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @ApiOperation({ summary: 'List user accounts' })
  async getAccounts(@CurrentUser() user: AuthUser): Promise<Account[]> {
    return this.accountsService.findByUser(user.id);
  }

  @Post()
  async createAccount(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createAccountSchema)) dto: CreateAccountInput,
  ): Promise<Account> {
    return this.accountsService.create(user.id, dto);
  }
}
```

**Guards** - Authentication/authorization:

```typescript
// presentation/auth.guard.ts
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    // Dev mode: use mock user
    if (this.isDev && !token) {
      request.user = createDevUser();
      return true;
    }

    // Prod mode: verify JWT
    const user = await this.authService.verifyToken(token);
    if (!user) throw new UnauthorizedException();

    request.user = user;
    return true;
  }
}
```

**Decorators** - Request context extraction:

```typescript
// presentation/user.decorator.ts
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

---

## NestJS Concepts Explained

### What is NestJS?

NestJS is a framework for building server-side applications. Think of it as "Angular for the backend" - it uses decorators, modules, and dependency injection to organize code.

### Modules

Modules group related functionality. Every NestJS app has at least one module (AppModule).

```typescript
@Module({
  imports: [DatabaseModule, AuthModule],    // Other modules to use
  controllers: [AccountsController],         // HTTP route handlers
  providers: [AccountsService],              // Injectable services
  exports: [AccountsService],                // Make available to other modules
})
export class PortfolioModule {}
```

### Dependency Injection (DI)

Instead of creating instances manually, NestJS creates and injects them for you:

```typescript
// WITHOUT DI (bad - tight coupling)
class AccountsController {
  private service = new AccountsService(new AccountRepository(new DatabaseService()));
}

// WITH DI (good - loose coupling)
@Controller()
class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}
  // NestJS automatically creates and injects AccountsService
}
```

**Benefits:**
- Easy to swap implementations (mock for testing, different DB for prod)
- Clear dependency graph
- Automatic lifecycle management

### Injection Tokens

For interfaces (which don't exist at runtime), use string tokens:

```typescript
// Define token
export const ACCOUNT_REPOSITORY = 'ACCOUNT_REPOSITORY';

// Register in module
{
  provide: ACCOUNT_REPOSITORY,
  useFactory: (db: DatabaseService) => new AccountRepository(db),
  inject: [DatabaseService],
}

// Inject using token
constructor(
  @Inject(ACCOUNT_REPOSITORY)
  private readonly repo: IAccountRepository
) {}
```

### Decorators

Decorators add metadata to classes/methods. NestJS uses them heavily:

| Decorator | Purpose | Example |
|-----------|---------|---------|
| `@Controller('path')` | Define route prefix | `@Controller('accounts')` |
| `@Get()`, `@Post()`, etc. | HTTP method handlers | `@Get(':id')` |
| `@Injectable()` | Mark class as injectable | `@Injectable()` |
| `@Module()` | Define module | See above |
| `@UseGuards()` | Apply guards | `@UseGuards(AuthGuard)` |
| `@Body()`, `@Param()` | Extract request data | `@Body() dto: CreateDto` |

### Guards

Guards decide if a request should proceed. Return `true` to allow, `false` to deny.

```typescript
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    return this.validateRequest(request);
  }
}

// Usage
@UseGuards(AuthGuard)
@Get()
getProtectedData() { ... }
```

### Pipes

Pipes transform or validate input data:

```typescript
// Built-in validation pipe
@Post()
create(@Body(ValidationPipe) dto: CreateAccountDto) { ... }

// Custom Zod validation pipe
@Post()
create(@Body(new ZodValidationPipe(schema)) dto: CreateAccountInput) { ... }
```

### Filters

Filters handle exceptions globally:

```typescript
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // Format error response consistently
    response.status(status).send({
      statusCode: status,
      message: exception.message,
      timestamp: new Date().toISOString(),
    });
  }
}
```

---

## Fastify vs Express

This API uses **Fastify** instead of the more common Express. Here's why:

| Aspect | Express | Fastify |
|--------|---------|---------|
| **Performance** | ~15,000 req/s | ~75,000 req/s |
| **Schema validation** | External (Joi, Zod) | Built-in JSON Schema |
| **Plugins** | Middleware | Encapsulated plugins |
| **TypeScript** | Partial | First-class |

### Fastify Plugins Used

```typescript
// main.ts
await app.register(compress, { encodings: ['gzip', 'deflate'] });
await app.register(cors, { origin: ['http://localhost:5173'] });
await app.register(helmet, { contentSecurityPolicy: false });
await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
```

| Plugin | Purpose |
|--------|---------|
| `@fastify/compress` | Gzip responses (smaller payloads) |
| `@fastify/cors` | Cross-origin requests from frontend |
| `@fastify/helmet` | Security headers (XSS, clickjacking) |
| `@fastify/multipart` | File upload handling |

---

## Authentication Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  AuthGuard  │────▶│ Supabase    │────▶│  Controller │
│             │     │             │     │ Service     │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │                   │
       │ Authorization:    │                   │                   │
       │ Bearer <token>    │                   │                   │
       │──────────────────▶│                   │                   │
       │                   │ verifyToken()     │                   │
       │                   │──────────────────▶│                   │
       │                   │                   │ Validate JWT      │
       │                   │                   │ with Supabase     │
       │                   │◀──────────────────│                   │
       │                   │ AuthUser          │                   │
       │                   │                   │                   │
       │                   │ Attach to request │                   │
       │                   │──────────────────────────────────────▶│
       │                   │                   │                   │
       │                   │                   │    @CurrentUser() │
       │◀──────────────────────────────────────────────────────────│
       │ Response          │                   │                   │
```

### Development Mode

When `NODE_ENV=development`, the API:
- Skips Supabase credentials validation
- Uses a mock user when no token is provided
- Enables verbose logging

This makes local development easier without needing Supabase setup.

---

## Data Flow Example: Import CSV

Here's how a CSV import flows through all layers:

```
1. HTTP Request
   POST /import/upload
   Content-Type: multipart/form-data
   Body: { file: transactions.csv }
              │
              ▼
2. Presentation Layer (ImportController)
   - Extracts file from multipart
   - Validates file size/type
   - Converts to string
              │
              ▼
3. Application Layer (ImportTransactionsUseCase)
   - Detects broker format (DeGiro, Trade Republic)
   - Delegates to appropriate Parser
              │
              ▼
4. Application Layer (DegiroParser)
   - Parses CSV rows
   - Normalizes column names
   - Returns ParseResult { transactions, positions, errors }
              │
              ▼
5. Application Layer (ImportTransactionsUseCase continues)
   - Creates/upserts account
   - Looks up securities via OpenFigiService
   - Creates transactions (with duplicate detection)
   - Calculates and upserts positions
              │
              ▼
6. Infrastructure Layer (Repositories)
   - AccountRepository.upsert()
   - SecurityRepository.getOrCreate()
   - TransactionRepository.create()
   - PositionRepository.upsert()
              │
              ▼
7. Database (Prisma → PostgreSQL)
   - Executes SQL queries
   - Handles constraints (unique, foreign keys)
              │
              ▼
8. Response
   {
     "success": true,
     "broker": "degiro",
     "transactionsImported": 125,
     "duplicatesSkipped": 3,
     "securitiesCreated": 28
   }
```

---

## Testing

```bash
# Run all tests
bun test

# Watch mode
bun test --watch

# Specific file
bun test src/modules/portfolio/application/services/accounts.service.test.ts
```

### Testing Strategy

| Layer | What to Test | How |
|-------|--------------|-----|
| Domain | Entity methods | Unit tests, no mocks needed |
| Application | Service logic | Mock repositories |
| Infrastructure | Repository queries | Integration tests with test DB |
| Presentation | Controllers | E2E tests with supertest |

### Example: Testing a Service

```typescript
describe('AccountsService', () => {
  let service: AccountsService;
  let mockRepo: jest.Mocked<IAccountRepository>;

  beforeEach(() => {
    mockRepo = {
      findByUser: jest.fn(),
      create: jest.fn(),
    };
    service = new AccountsService(mockRepo);
  });

  it('should return user accounts', async () => {
    mockRepo.findByUser.mockResolvedValue([mockAccount]);

    const result = await service.findByUser('user-123');

    expect(mockRepo.findByUser).toHaveBeenCalledWith('user-123');
    expect(result).toHaveLength(1);
  });
});
```

---

## Code Style

- **Formatting**: Biome (not ESLint/Prettier)
- **Path Aliases**: `@/*` maps to `src/*`
- **File Naming**: kebab-case (`accounts.service.ts`)
- **File Suffixes**: `.controller.ts`, `.service.ts`, `.module.ts`, `.guard.ts`

Run linting:

```bash
bunx biome check --write .
```

---

## Common Commands

```bash
# Development
bun run dev:api          # Start with hot reload

# Database
bun run db:generate      # Generate Prisma client
bun run db:push          # Push schema changes (dev)
bun run db:migrate       # Create migration
bun run db:studio        # Open Prisma Studio

# Quality
bun run lint             # Run Biome linter
bun run type-check       # TypeScript check
bun run test             # Run tests
bun run build            # Build for production
```

---

## Adding a New Feature

1. **Create domain entities** (if needed):
   ```
   src/modules/portfolio/domain/entities/new-entity.ts
   ```

2. **Create repository interface**:
   ```
   src/modules/portfolio/infrastructure/repositories/new.repository.interface.ts
   ```

3. **Implement repository**:
   ```
   src/modules/portfolio/infrastructure/repositories/new.repository.ts
   ```

4. **Create service**:
   ```
   src/modules/portfolio/application/services/new.service.ts
   ```

5. **Create controller**:
   ```
   src/modules/portfolio/presentation/controllers/new.controller.ts
   ```

6. **Register in module**:
   ```typescript
   // portfolio.module.ts
   @Module({
     controllers: [..., NewController],
     providers: [
       ...,
       { provide: NEW_REPOSITORY, useFactory: ... },
       NewService,
     ],
   })
   ```

7. **Add tests** for each layer

---

## Troubleshooting

### "Cannot find module '@/...'"

Path aliases need to be resolved. Run:
```bash
bun run build
```

### "UnauthorizedException" in development

Make sure `NODE_ENV=development` is set, or provide a valid Supabase token.

### Database connection errors

1. Check `DATABASE_URL` in `.env`
2. Ensure Supabase is running: `bunx supabase status`
3. Regenerate Prisma client: `bun run db:generate`

### Import fails with "Unknown broker"

The CSV format wasn't recognized. Check:
1. File encoding is UTF-8
2. CSV has expected column headers
3. Broker is supported (see `/import/brokers`)

---

## Contributing

1. Create feature branch from `main`
2. Follow Clean Architecture patterns
3. Add tests for new functionality
4. Run `bun run lint` and `bun run type-check`
5. Submit PR with description
