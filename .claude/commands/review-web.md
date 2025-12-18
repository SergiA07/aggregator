---
description: Review frontend code for architecture, patterns, and quality
---

# Frontend Code Review

Review the web app (`apps/web/`) for quality, patterns, and adherence to feature-first architecture.

## Review Areas

### Feature-First Architecture

- **Features map 1:1 to routes**: Each feature folder corresponds to a route
- **Routes are thin**: Only compose feature components, no business logic
- **Barrel exports**: Each feature has `index.ts` exposing public API

### Component Organization

- `components/ui/` - Shadcn primitives (should NOT be edited)
- `components/composed/` - Custom compositions of Shadcn components
- `components/layout/` - App layout (Header, Sidebar, PageLayout)
- `features/*/components/` - Feature-specific components

### TanStack Router

- File-based routes in `routes/` directory
- Protected routes use `beforeLoad` in `_authenticated.tsx`
- Route params properly typed

### TanStack Query

- Query hooks in `hooks/api/` (not scattered in features)
- Consistent query key structure
- Mutations invalidate related queries
- Error handling uses `meta` for custom messages
- Loading/error states handled in components

### State Management

- **Server state**: TanStack Query (not useState/Zustand)
- **Client preferences**: Zustand with `persist` middleware
- **Ephemeral UI**: React useState

### Mutations Strategy

- Cache-affecting mutations: TanStack Query `useMutation`
- Simple forms (login, settings): React 19 `useActionState`
- Submit buttons: `useFormStatus` for pending state

### React 19 Patterns

- No manual `useMemo`/`useCallback` (React Compiler handles it)
- `use()` hook preferred over `useContext`
- `useOptimistic` for optimistic updates

### Code Quality

- Path aliases used (`@/*` imports)
- File naming: kebab-case files, PascalCase components
- Named exports (not default exports)
- Proper TypeScript types (no `any`)

### Testing

- Unit tests co-located (`*.spec.ts` next to source)
- Integration tests in `features/<feature>/__tests__/`
- MSW handlers for API mocking

## Output Format

Organize findings by severity:

### CRITICAL
Security issues, data exposure, broken auth flow

### HIGH
Bugs, architecture violations, state management issues

### MEDIUM
Missing error handling, inconsistent patterns, type issues

### LOW
Minor improvements, naming conventions, missing tests

Include file paths and line numbers for all findings.
