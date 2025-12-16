# Testing Guidelines

## Test Runners

- **API (NestJS)**: Bun test runner (`bun test`)
- **Frontend (React)**: Vitest (to be implemented)

## API Testing with Bun

### File Naming

- Test files: `*.spec.ts` (co-located with source)
- Example: `app.controller.spec.ts` next to `app.controller.ts`

### Running Tests

```bash
cd apps/api
bun test              # Run all tests
bun test --watch      # Watch mode
bun test src/modules  # Run tests in specific directory
```

### Test Structure

```typescript
import { describe, expect, it, beforeEach, afterEach, mock } from 'bun:test';
import { Test } from '@nestjs/testing';

describe('AccountsService', () => {
  let service: AccountsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: 'IAccountRepository', useValue: mockRepository },
      ],
    }).compile();

    service = moduleRef.get(AccountsService);
  });

  it('should create an account', async () => {
    const result = await service.create(createAccountDto);
    expect(result.name).toBe('Test Account');
  });
});
```

### Mocking

```typescript
import { mock } from 'bun:test';

const mockRepository = {
  findAll: mock(() => Promise.resolve([])),
  findById: mock(() => Promise.resolve(null)),
  create: mock(() => Promise.resolve({ id: '1', name: 'Test' })),
};
```

### NestJS Testing Module

Always use `@nestjs/testing` to create isolated test modules:

```typescript
import { Test, TestingModule } from '@nestjs/testing';

const moduleRef: TestingModule = await Test.createTestingModule({
  controllers: [AccountsController],
  providers: [
    AccountsService,
    { provide: 'IAccountRepository', useValue: mockRepo },
  ],
}).compile();
```

## Test Categories

### Unit Tests

- Test individual classes/functions in isolation
- Mock all dependencies
- Fast execution
- Located next to source files

### Integration Tests

- Test module interactions
- May use real database (test database)
- Located in `test/` directory or with `.integration.spec.ts` suffix

### E2E Tests (Future)

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
expect(fn).toThrow();
expect(fn).toThrow(ErrorClass);
```

## Best Practices

1. **Arrange-Act-Assert** pattern for test structure
2. **One assertion per test** when practical
3. **Descriptive test names** that explain the expected behavior
4. **Mock external dependencies** (database, HTTP, etc.)
5. **Clean up** in afterEach/afterAll hooks
6. **Don't test implementation details** - test behavior
