---
paths: apps/api/**
---

# API Architecture Guidelines

The API follows Clean Architecture with NestJS + Fastify.

## Folder Structure

```
apps/api/src/
├── main.ts                           # Fastify bootstrap
├── app.module.ts                     # Root module
├── modules/
│   ├── auth/                         # Authentication (Global)
│   │   ├── domain/interfaces/        # IAuthService, IAuthUser
│   │   ├── infrastructure/           # SupabaseAuthService
│   │   ├── presentation/             # AuthGuard, CurrentUser decorator
│   │   └── auth.module.ts
│   ├── portfolio/                    # Investment portfolio
│   │   ├── domain/entities/          # AccountEntity, TransactionEntity, etc.
│   │   ├── application/
│   │   │   ├── services/             # AccountsService, TransactionsService
│   │   │   ├── use-cases/            # ImportTransactionsUseCase
│   │   │   └── parsers/              # BaseParser, DegiroParser, etc.
│   │   ├── infrastructure/
│   │   │   ├── repositories/         # Database access
│   │   │   │   ├── account.repository.ts
│   │   │   │   └── account.repository.interface.ts
│   │   │   └── services/             # External API clients (OpenFIGI, etc.)
│   │   ├── presentation/
│   │   │   ├── controllers/          # AccountsController, etc.
│   │   │   └── dto/                  # Organized by entity
│   │   └── portfolio.module.ts
│   └── banking/                      # Future module
└── shared/
    ├── database/                     # DatabaseService (Global)
    └── filters/                      # HttpExceptionFilter
```

## Clean Architecture Layers

Dependencies flow **inward only**:

```
┌─────────────────────────────────────┐
│         Presentation (HTTP)         │
│    Controllers, DTOs, Guards        │
├─────────────────────────────────────┤
│         Infrastructure              │
│   Repositories, External Services   │
├─────────────────────────────────────┤
│          Application                │
│   Services, Use Cases, Parsers      │
├─────────────────────────────────────┤
│            Domain                   │
│       Entities, Interfaces          │
└─────────────────────────────────────┘
```

### Domain Layer

Pure business logic with NO framework dependencies:

```typescript
// domain/entities/account.entity.ts
export class AccountEntity {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly name: string,
    public readonly broker: string,
  ) {}

  belongsToUser(userId: string): boolean {
    return this.userId === userId;
  }

  isBroker(): boolean {
    return this.broker !== 'manual';
  }
}
```

### Application Layer

Services orchestrate business logic:

```typescript
// application/services/accounts.service.ts
@Injectable()
export class AccountsService {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
  ) {}

  async findByUserId(userId: string): Promise<Account[]> {
    return this.accountRepository.findByUserId(userId);
  }
}
```

Use Cases encapsulate complex operations:

```typescript
// application/use-cases/import-transactions.use-case.ts
@Injectable()
export class ImportTransactionsUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY) private readonly transactionRepo: ITransactionRepository,
    @Inject(ACCOUNT_REPOSITORY) private readonly accountRepo: IAccountRepository,
  ) {}

  async execute(file: Buffer, accountId: string, userId: string): Promise<ImportResult> {
    // Complex import logic with parsing, validation, deduplication
  }
}
```

### Infrastructure Layer

Repositories implement domain interfaces:

```typescript
// infrastructure/repositories/account.repository.interface.ts
export const ACCOUNT_REPOSITORY = 'ACCOUNT_REPOSITORY';

export interface IAccountRepository {
  findByUserId(userId: string): Promise<Account[]>;
  findById(id: string): Promise<Account | null>;
  create(data: CreateAccountDto, userId: string): Promise<Account>;
}

// infrastructure/repositories/account.repository.ts
@Injectable()
export class AccountRepository implements IAccountRepository {
  constructor(private readonly db: DatabaseService) {}

  async findByUserId(userId: string): Promise<Account[]> {
    return this.db.account.findMany({ where: { userId } });
  }
}
```

### Presentation Layer

Controllers handle HTTP:

```typescript
// presentation/controllers/accounts.controller.ts
@ApiTags('Accounts')
@Controller('accounts')
@UseGuards(SupabaseAuthGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @ApiOperation({ summary: 'List all accounts' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.accountsService.findByUserId(user.id);
  }
}
```

## Platform: Fastify

This API uses **Fastify** (not Express):

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter({ logger: true }),
);

// Registered plugins
await app.register(fastifyCompress);
await app.register(fastifyCors, { origin: [...] });
await app.register(fastifyMultipart, { limits: { fileSize: 10_000_000 } });
await app.register(fastifyHelmet);

// Global validation
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}));

await app.listen({ port: 3333, host: '0.0.0.0' });
```

## Routes

Routes are NOT prefixed with `/api/v1/`:

| Route | Controller |
|-------|------------|
| `/health` | AppController |
| `/accounts` | AccountsController |
| `/transactions` | TransactionsController |
| `/positions` | PositionsController |
| `/securities` | SecuritiesController |
| `/import` | ImportController |
| `/api/docs` | Swagger UI |

## DTOs and Validation

Use class-validator with Swagger decorators:

```typescript
// presentation/dto/account/create-account.dto.ts
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAccountDto {
  @ApiProperty({ description: 'Account name' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(AccountType)
  type?: AccountType;
}
```

## Module Registration

Use factory providers for repositories:

```typescript
// portfolio.module.ts
@Module({
  controllers: [
    AccountsController,
    TransactionsController,
    PositionsController,
    ImportController,
  ],
  providers: [
    // Repository bindings with factory
    {
      provide: ACCOUNT_REPOSITORY,
      useFactory: (db: DatabaseService) => new AccountRepository(db),
      inject: [DatabaseService],
    },
    {
      provide: TRANSACTION_REPOSITORY,
      useFactory: (db: DatabaseService) => new TransactionRepository(db),
      inject: [DatabaseService],
    },
    // Services
    AccountsService,
    TransactionsService,
    PositionsService,
    // Use cases
    ImportTransactionsUseCase,
  ],
  exports: [AccountsService, TransactionsService],
})
export class PortfolioModule {}
```

## Authentication

Uses Supabase Auth with guard and decorator:

```typescript
// Usage in controller
@UseGuards(SupabaseAuthGuard)
@Controller('accounts')
export class AccountsController {
  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findByUserId(user.id);
  }
}
```

Development bypass: Set `DEV_MODE=true` to skip auth with mock user.

## File Uploads

Use Fastify multipart:

```typescript
@Post('upload')
async importFile(@Req() request: FastifyRequest) {
  const file = await request.file();
  const buffer = await file.toBuffer();
  return this.importUseCase.execute(buffer, accountId, user.id);
}
```

## Error Handling

Use NestJS HTTP exceptions:

```typescript
import { NotFoundException, BadRequestException } from '@nestjs/common';

async findById(id: string): Promise<Account> {
  const account = await this.repository.findById(id);
  if (!account) {
    throw new NotFoundException(`Account ${id} not found`);
  }
  return account;
}
```

Global `HttpExceptionFilter` formats all errors consistently.

## Database Access

Use the shared DatabaseService:

```typescript
import { DatabaseService } from '@/shared/database';

@Injectable()
export class AccountRepository {
  constructor(private readonly db: DatabaseService) {}

  async findAll(userId: string) {
    return this.db.account.findMany({ where: { userId } });
  }
}
```

## Shared Code

- `apps/api/src/shared/` - Cross-cutting concerns (database, filters)
- `packages/shared-types/` - Types shared between API and frontend
- `packages/database/` - Prisma client and schema
