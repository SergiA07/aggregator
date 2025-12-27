---
description: Check database and Supabase status
allowed-tools: Bash(bunx supabase:*), Bash(bun run db:*)
---

Check the status of the database:

1. Check if Supabase is running: `bunx supabase status`
2. Check migration status: `bun run db:migrate:status`
3. Verify Prisma client is generated: check if `packages/database/src/generated/` exists

If issues are found, suggest:
- Supabase not running: `bunx supabase start`
- Pending migrations: `make db-migrate`
- Prisma client missing: `bun run db:generate`

Report the current state and any actions needed.
