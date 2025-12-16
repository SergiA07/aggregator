---
paths: apps/api/**/*.ts
---

# NestJS + Fastify Guidelines

## Platform

This API uses **Fastify** (not Express). Important differences:

- Use `@nestjs/platform-fastify` imports
- File uploads use `@fastify/multipart` (not multer)
- CORS via `@fastify/cors`
- Compression via `@fastify/compress`

## Bootstrap Configuration

```typescript
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter({ logger: true }),
);

// Listen on all interfaces
await app.listen({ port: 3333, host: '0.0.0.0' });
```

## Controllers

### Route Prefixing

All API routes use `/api/v1/` prefix:

```typescript
@Controller('api/v1/accounts')
export class AccountsController {}
```

### Swagger Documentation

Use decorators for API documentation:

```typescript
@ApiTags('Accounts')
@Controller('api/v1/accounts')
export class AccountsController {
  @Get()
  @ApiOperation({ summary: 'List all accounts' })
  @ApiResponse({ status: 200, description: 'Returns all accounts' })
  findAll() {}
}
```

### Authentication

Use the Supabase auth guard:

```typescript
@UseGuards(AuthGuard)
@Controller('api/v1/accounts')
export class AccountsController {
  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findByUserId(user.id);
  }
}
```

## DTOs and Validation

### Request Validation

Use class-validator with class-transformer:

```typescript
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

### Global Validation Pipe

Already configured in main.ts:

```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,           // Strip unknown properties
  forbidNonWhitelisted: true,// Throw on unknown properties
  transform: true,           // Transform to DTO class instances
}));
```

## Services

### Dependency Injection

Inject repository interfaces, not implementations:

```typescript
@Injectable()
export class AccountsService {
  constructor(
    @Inject('IAccountRepository')
    private readonly accountRepository: IAccountRepository,
  ) {}
}
```

### Error Handling

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

## File Uploads

Use Fastify multipart:

```typescript
import { MultipartFile } from '@fastify/multipart';

@Post('import')
async importFile(@Req() request: FastifyRequest) {
  const file = await request.file();
  const buffer = await file.toBuffer();
  // Process file...
}
```

## Database Access

### Repository Pattern

Repositories implement domain interfaces:

```typescript
// Domain interface (domain/interfaces/)
export interface IAccountRepository {
  findAll(userId: string): Promise<AccountEntity[]>;
  findById(id: string): Promise<AccountEntity | null>;
  create(data: CreateAccountDto, userId: string): Promise<AccountEntity>;
}

// Implementation (infrastructure/repositories/)
@Injectable()
export class AccountRepository implements IAccountRepository {
  constructor(private readonly db: DatabaseService) {}

  async findAll(userId: string): Promise<AccountEntity[]> {
    const accounts = await this.db.client.account.findMany({
      where: { userId },
    });
    return accounts.map(this.toDomain);
  }
}
```

### Prisma Client Access

Use the shared DatabaseService:

```typescript
import { DatabaseService } from '@/shared/database';

@Injectable()
export class AccountRepository {
  constructor(private readonly db: DatabaseService) {}

  async findAll() {
    return this.db.client.account.findMany();
  }
}
```

## Module Registration

```typescript
@Module({
  imports: [DatabaseModule],
  controllers: [AccountsController, TransactionsController],
  providers: [
    // Services
    AccountsService,
    TransactionsService,
    // Repository bindings
    { provide: 'IAccountRepository', useClass: AccountRepository },
    { provide: 'ITransactionRepository', useClass: TransactionRepository },
  ],
  exports: [AccountsService],
})
export class PortfolioModule {}
```
