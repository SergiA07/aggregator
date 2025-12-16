# Code Style Guidelines

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
- Import from barrel exports when available:
  ```typescript
  // Preferred
  import { AccountEntity, TransactionEntity } from './domain/entities';

  // Avoid importing from individual files when barrel exists
  import { AccountEntity } from './domain/entities/account.entity';
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

## NestJS Specific

- Suffix controllers with `.controller.ts`
- Suffix services with `.service.ts`
- Suffix modules with `.module.ts`
- Suffix DTOs with `.dto.ts`
- Suffix entities with `.entity.ts`
- Suffix guards with `.guard.ts`
- Suffix decorators with `.decorator.ts`

## Unused Code

- Biome warns on unused imports and variables
- Remove unused code rather than commenting it out
- No backwards-compatibility hacks (no `_unusedVar` patterns)
