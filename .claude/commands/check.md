---
description: Run all quality checks (lint, type-check, test)
allowed-tools: Bash(bunx biome:*), Bash(bun run:*), Bash(turbo:*)
---

Run all quality checks for the project:

1. Run Biome linting: `bunx biome check .`
2. Run TypeScript type checking (no cache): `turbo type-check --force`
3. Run tests: `bun run test`

Use `--force` for type-check to bypass Turborepo cache and catch cross-package type errors that only manifest when types change.

Report any failures with specific file locations and suggested fixes.
