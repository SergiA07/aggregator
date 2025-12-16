# Clean Architecture Guidelines

The API follows Clean Architecture with clear layer separation.

## Layer Structure

```
apps/api/src/modules/<module>/
├── domain/           # Business entities and rules (innermost)
│   ├── entities/     # Domain entities
│   └── interfaces/   # Domain interfaces (ports)
├── application/      # Use cases and business logic
│   ├── services/     # Application services
│   ├── use-cases/    # Specific use case implementations
│   └── parsers/      # Data transformation logic
├── infrastructure/   # External concerns (adapters)
│   └── repositories/ # Database implementations
└── presentation/     # HTTP layer (outermost)
    ├── controllers/  # NestJS controllers
    └── dto/          # Request/Response DTOs
```

## Dependency Rules

Dependencies flow **inward only**:
- `presentation` → `application` → `domain`
- `infrastructure` → `domain` (implements interfaces)
- `domain` has NO dependencies on other layers

```
┌─────────────────────────────────────┐
│         Presentation (HTTP)         │
│    Controllers, DTOs, Guards        │
├─────────────────────────────────────┤
│         Infrastructure              │
│   Repositories, External APIs       │
├─────────────────────────────────────┤
│          Application                │
│   Services, Use Cases, Parsers      │
├─────────────────────────────────────┤
│            Domain                   │
│    Entities, Interfaces (Ports)     │
└─────────────────────────────────────┘
```

## Layer Responsibilities

### Domain Layer
- **Entities**: Pure TypeScript classes representing business objects
- **Interfaces**: Repository contracts (ports) that infrastructure implements
- NO framework dependencies (no NestJS decorators)
- NO external library dependencies

### Application Layer
- **Services**: Orchestrate domain logic, injected with repository interfaces
- **Use Cases**: Single-purpose business operations
- Can depend on domain entities and interfaces
- Uses dependency injection for repositories

### Infrastructure Layer
- **Repositories**: Implement domain interfaces using Prisma
- Handles all database concerns
- Maps between Prisma models and domain entities

### Presentation Layer
- **Controllers**: Handle HTTP requests/responses
- **DTOs**: Validate input, shape output (use class-validator)
- Calls application services, never infrastructure directly

## Example Flow

```
HTTP Request
    ↓
Controller (presentation)
    ↓
Service (application)
    ↓
Repository Interface (domain) ← Repository Implementation (infrastructure)
    ↓
Database (Prisma)
```

## Module Organization

Each feature module is self-contained:

```typescript
// portfolio.module.ts
@Module({
  imports: [DatabaseModule],
  controllers: [AccountsController, TransactionsController],
  providers: [
    AccountsService,
    TransactionsService,
    { provide: 'IAccountRepository', useClass: AccountRepository },
  ],
})
export class PortfolioModule {}
```

## Shared Code

- `apps/api/src/shared/` - Cross-cutting concerns (database module, etc.)
- `packages/shared-types/` - Types shared between API and frontend
- `packages/database/` - Prisma client and schema
