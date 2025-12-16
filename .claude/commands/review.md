# Comprehensive Codebase Review

Run a deep review of the entire codebase, checking for issues across multiple categories.

## Instructions

Launch **three parallel agents** to review different areas:

1. **Infrastructure & DevOps Agent** - Review:
   - CI/CD workflows (`.github/workflows/`)
   - Dockerfiles and container security
   - Environment configuration
   - Deployment setup (Railway, Cloudflare)
   - Dependency management (package.json, lockfiles)

2. **API/Backend Agent** - Review:
   - NestJS architecture and Clean Architecture compliance
   - Security (authentication, authorization, input validation)
   - Error handling and logging
   - Database queries and Prisma usage
   - API design (REST conventions, DTOs)
   - Test coverage

3. **Frontend Agent** - Review:
   - React patterns and hooks usage
   - State management (TanStack Query)
   - Routing (TanStack Router)
   - Component structure and reusability
   - Type safety
   - Performance (bundle size, lazy loading)

## Output Format

Consolidate findings into a single report organized by severity:

### CRITICAL (Security vulnerabilities, data loss risks)
- Issue description
- File location with line numbers
- Recommended fix

### HIGH (Bugs, significant issues)
- Issue description
- File location with line numbers
- Recommended fix

### MEDIUM (Code quality, maintainability)
- Issue description
- File location with line numbers
- Recommended fix

### LOW (Minor improvements, nice-to-haves)
- Issue description
- File location with line numbers
- Recommended fix

## Rules

- Be specific with file paths and line numbers
- Prioritize actionable issues over stylistic preferences
- Consider the project's conventions (see CLAUDE.md and .claude/rules/)
- Skip issues already handled by Biome linting
- Focus on real problems, not hypothetical edge cases
