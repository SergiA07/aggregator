---
description: Review API code for architecture, security, and quality
---

# API Code Review

Review the API codebase (`apps/api/`) for quality, security, and adherence to Clean Architecture.

## Review Areas

### Clean Architecture Compliance

- **Layer dependencies**: Verify flow is presentation → application → domain
- **Domain layer**: No NestJS decorators, no external dependencies
- **Repository interfaces**: Located in `infrastructure/repositories/*.interface.ts`
- **Repository implementations**: Use factory providers with `useFactory`

### Dependency Injection

- Use token constants (`ACCOUNT_REPOSITORY`), not string literals
- Services inject via `@Inject(TOKEN_CONSTANT)`
- Module registration uses factory pattern:
  ```typescript
  {
    provide: ACCOUNT_REPOSITORY,
    useFactory: (db: DatabaseService) => new AccountRepository(db),
    inject: [DatabaseService],
  }
  ```

### Controllers & Routes

- Routes should NOT have `/api/v1/` prefix (just `/accounts`, etc.)
- Protected routes use `@UseGuards(SupabaseAuthGuard)`
- Use `@CurrentUser()` decorator for authenticated user
- Swagger decorators present (`@ApiTags`, `@ApiOperation`, `@ApiResponse`)

### DTOs & Validation

- class-validator decorators (`@IsString`, `@IsOptional`, etc.)
- Swagger decorators (`@ApiProperty`, `@ApiPropertyOptional`)
- Proper typing (no `any`)

### Security

- User data scoped by `userId` in repository queries
- No SQL injection vulnerabilities
- Auth guards on all protected endpoints
- No hardcoded secrets

### Error Handling

- Use NestJS HTTP exceptions (`NotFoundException`, `BadRequestException`)
- Consistent error response format via `HttpExceptionFilter`

### Testing

- Unit tests co-located with source files
- Tests use repository token constants for mocking
- Proper use of `@nestjs/testing` module

## Output Format

Organize findings by severity:

### CRITICAL
Security vulnerabilities, data exposure risks

### HIGH
Bugs, architecture violations, missing auth guards

### MEDIUM
Code quality, missing validation, incomplete error handling

### LOW
Minor improvements, documentation gaps

Include file paths and line numbers for all findings.
