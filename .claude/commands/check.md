---
description: Run all quality checks (lint, type-check, test)
allowed-tools: Bash(bunx biome:*), Bash(bun run:*), Bash(turbo:*)
---

Run all quality checks for the project:

1. Run Biome linting: `bunx biome check .`
2. Run TypeScript type checking: `bun run type-check`
3. Run tests: `bun run test`

Report any failures with specific file locations and suggested fixes.
