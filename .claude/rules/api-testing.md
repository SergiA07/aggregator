---
paths: apps/api/**/*.spec.ts, apps/api/**/test/**
---

# API Testing Guidelines

## Test Runner

The API uses **Bun test runner** (not Jest).

## File Naming

- Test files: `*.spec.ts` (co-located with source)
- Example: `accounts.service.spec.ts` next to `accounts.service.ts`

## Running Tests

```bash
cd apps/api
bun test              # Run all tests
bun test --watch      # Watch mode
bun test src/modules  # Run tests in specific directory
```

## Test Structure

```typescript
import { describe, expect, it, beforeEach, mock } from 'bun:test';
import { Test } from '@nestjs/testing';
import { AccountsService } from './accounts.service';
import { ACCOUNT_REPOSITORY } from '../infrastructure/repositories';

describe('AccountsService', () => {
  let service: AccountsService;

  const mockRepository = {
    findByUserId: mock(() => Promise.resolve([])),
    findById: mock(() => Promise.resolve(null)),
    create: mock(() => Promise.resolve({ id: '1', name: 'Test' })),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: ACCOUNT_REPOSITORY, useValue: mockRepository },
      ],
    }).compile();

    service = moduleRef.get(AccountsService);
  });

  it('should return accounts for user', async () => {
    const result = await service.findByUserId('user-123');
    expect(result).toEqual([]);
    expect(mockRepository.findByUserId).toHaveBeenCalledWith('user-123');
  });
});
```

## Mocking Repositories

Use the repository token constants, not string literals:

```typescript
import { mock } from 'bun:test';
import {
  ACCOUNT_REPOSITORY,
  TRANSACTION_REPOSITORY,
} from '../infrastructure/repositories';

const mockAccountRepo = {
  findByUserId: mock(() => Promise.resolve([])),
  findById: mock(() => Promise.resolve(null)),
  create: mock(() => Promise.resolve({ id: '1', name: 'Test' })),
};

const mockTransactionRepo = {
  findByAccountId: mock(() => Promise.resolve([])),
  create: mock(() => Promise.resolve({ id: '1' })),
};

// In test module
providers: [
  { provide: ACCOUNT_REPOSITORY, useValue: mockAccountRepo },
  { provide: TRANSACTION_REPOSITORY, useValue: mockTransactionRepo },
],
```

## Testing Controllers

```typescript
import { Test } from '@nestjs/testing';
import { AccountsController } from './accounts.controller';
import { AccountsService } from '../../application/services';

describe('AccountsController', () => {
  let controller: AccountsController;

  const mockService = {
    findByUserId: mock(() => Promise.resolve([{ id: '1', name: 'Test' }])),
    create: mock(() => Promise.resolve({ id: '1', name: 'New' })),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [
        { provide: AccountsService, useValue: mockService },
      ],
    }).compile();

    controller = moduleRef.get(AccountsController);
  });

  it('should return accounts for authenticated user', async () => {
    const user = { id: 'user-123', email: 'test@example.com' };
    const result = await controller.findAll(user);
    expect(result).toHaveLength(1);
    expect(mockService.findByUserId).toHaveBeenCalledWith('user-123');
  });
});
```

## Testing Use Cases

```typescript
import { ImportTransactionsUseCase } from './import-transactions.use-case';
import {
  ACCOUNT_REPOSITORY,
  TRANSACTION_REPOSITORY,
} from '../../infrastructure/repositories';

describe('ImportTransactionsUseCase', () => {
  let useCase: ImportTransactionsUseCase;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ImportTransactionsUseCase,
        { provide: ACCOUNT_REPOSITORY, useValue: mockAccountRepo },
        { provide: TRANSACTION_REPOSITORY, useValue: mockTransactionRepo },
      ],
    }).compile();

    useCase = moduleRef.get(ImportTransactionsUseCase);
  });

  it('should import transactions from CSV', async () => {
    const csvBuffer = Buffer.from('date,symbol,quantity\n2024-01-01,AAPL,10');
    const result = await useCase.execute(csvBuffer, 'account-1', 'user-1');
    expect(result.imported).toBe(1);
  });
});
```

## Test Categories

### Unit Tests

- Test individual classes/functions in isolation
- Mock all dependencies using repository tokens
- Fast execution
- Located next to source files

### Integration Tests

- Test module interactions
- May use real database (test database)
- Use `.integration.spec.ts` suffix

### E2E Tests

- Test full HTTP request/response cycle
- Use Supertest with Fastify adapter
- Located in `test/e2e/` directory

## Assertions

Bun's test runner uses expect-style assertions:

```typescript
expect(value).toBe(expected);           // Strict equality
expect(value).toEqual(expected);        // Deep equality
expect(value).toBeDefined();
expect(value).toBeNull();
expect(array).toContain(item);
expect(array).toHaveLength(3);
expect(fn).toThrow();
expect(fn).toThrow(NotFoundException);
expect(mockFn).toHaveBeenCalledWith(arg);
```

## Best Practices

1. **Use repository token constants** - Import from `infrastructure/repositories`
2. **Arrange-Act-Assert** pattern for test structure
3. **One assertion per test** when practical
4. **Descriptive test names** that explain the expected behavior
5. **Mock at boundaries** - Mock repositories, not internal methods
6. **Test behavior, not implementation** - Focus on inputs/outputs
7. **Clean up** in afterEach/afterAll hooks if needed
