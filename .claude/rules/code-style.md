# Code Style Guidelines

Shared conventions that apply to both API and Web apps.

## Formatting (Biome)

This project uses **Biome** for linting and formatting. Never use ESLint or Prettier.

- **Indent**: 2 spaces
- **Line width**: 100 characters
- **Quotes**: Single quotes for JavaScript/TypeScript
- **Semicolons**: Always required
- **Trailing commas**: ES5 style

Run formatting:
```bash
bunx biome check --write .
bunx biome check src/  # Check specific directory
```

## TypeScript Conventions

### Imports

- Use ES module imports (not CommonJS)
- Organize imports (Biome handles this automatically)

**API (apps/api)**: Use barrel exports for domain entities:
```typescript
// Preferred
import { AccountEntity, TransactionEntity } from './domain/entities';

// Avoid importing from individual files when barrel exists
import { AccountEntity } from './domain/entities/account.entity';
```

**Web (apps/web)**: Use barrels only for features, direct imports for lib/utils:
```typescript
// Direct imports for lib/api/ (no barrels)
import { api } from '@/lib/api/client';
import type { Account } from '@/lib/api/types';
import { queryClient } from '@/lib/api/query-client';
import { positionListOptions } from '@/lib/api/queries/positions';
import { formatCurrency } from '@/utils/formatters';

// Barrel imports for features/
import { PositionsTable } from '@/features/positions';
```

### Types

- Prefer `interface` for object shapes, `type` for unions/intersections
- Use `type` imports when only importing types: `import type { Foo } from './foo'`
- Avoid `any` - use `unknown` if type is truly unknown
- Non-null assertions (`!`) are allowed (Biome rule disabled)

### Naming

- **Files**: kebab-case (`account.entity.ts`, `create-account.dto.ts`)
- **Classes**: PascalCase (`AccountEntity`, `AccountsService`)
- **Interfaces**: PascalCase, prefix with `I` only for repository interfaces (`IAccountRepository`)
- **Functions/variables**: camelCase
- **Constants**: SCREAMING_SNAKE_CASE for true constants
- **Enums**: PascalCase for enum name and values

### File Extensions

- Use `.ts` for all TypeScript files (not `.tsx` in API)
- Use `.tsx` only for React components in web app

## API-Specific (apps/api)

### Path Aliases

Use `@/*` for imports instead of relative paths:

```typescript
// Use path aliases
import { ZodValidationPipe } from '@/shared/pipes';
import { type AuthUser, CurrentUser, SupabaseAuthGuard } from '@/modules/auth';

// Avoid deep relative imports
import { ZodValidationPipe } from '../../../shared/pipes';  // Bad
```

### File Suffixes

- Suffix controllers with `.controller.ts`
- Suffix services with `.service.ts`
- Suffix modules with `.module.ts`
- Suffix entities with `.entity.ts`
- Suffix guards with `.guard.ts`
- Suffix decorators with `.decorator.ts`
- Suffix pipes with `.pipe.ts`

### Validation with Zod

Use shared Zod schemas from `@repo/shared-types/schemas` instead of class-validator DTOs:

```typescript
// controllers/accounts.controller.ts
import { createAccountSchema, type CreateAccountInput } from '@repo/shared-types/schemas';
import { ZodValidationPipe } from '@/shared/pipes';

@Post()
async createAccount(
  @CurrentUser() user: AuthUser,
  @Body(new ZodValidationPipe(createAccountSchema)) dto: CreateAccountInput,
) {
  return this.accountsService.create(user.id, dto);
}
```

## Web-Specific (apps/web)

### File Naming

- Components: kebab-case file (`submit-button.tsx`), PascalCase export (`SubmitButton`)
- Hooks: kebab-case file (`use-positions.ts`), camelCase export (`usePositions`)
- Stores: kebab-case file (`preferences.ts`), camelCase export (`usePreferences`)

### Path Aliases

Use `@/*` for imports instead of relative paths:

```typescript
// Direct imports for lib/api/
import { api } from '@/lib/api/client';
import { queryClient } from '@/lib/api/query-client';
import { positionListOptions } from '@/lib/api/queries/positions';
import { formatCurrency } from '@/utils/formatters';

// Barrel imports for features/
import { PositionsTable } from '@/features/positions';

// Direct imports for components
import { Button } from '@/components/ui/button';

// Avoid deep relative imports
import { Button } from '../../../components/ui/button';  // Bad
```

### Component Exports

- Use named exports (not default exports)
- One component per file for major components
- Co-locate small helper components in the same file

```typescript
// Preferred
export function PositionsTable() { ... }

// Avoid
export default function PositionsTable() { ... }
```

## Unused Code

- Biome warns on unused imports and variables
- Remove unused code rather than commenting it out
- No backwards-compatibility hacks (no `_unusedVar` patterns)
