---
description: Check database and Supabase status
allowed-tools: Bash(bunx supabase:*), Bash(bunx prisma:*)
---

Check the status of the database:

1. Check if Supabase is running: `bunx supabase status`
2. Verify Prisma client is generated: check if `packages/database/src/generated/` exists
3. If Supabase is not running, suggest: `bunx supabase start`
4. If Prisma client is missing, suggest: `bun run db:generate`

Report the current state and any actions needed.
