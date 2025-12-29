-- Revoke PostgREST Access
-- Since we use NestJS API with Prisma (not direct Supabase client queries),
-- we revoke access from anon/authenticated roles to prevent direct table access
-- via PostgREST and silence RLS warnings.
--
-- This does NOT affect:
-- - Prisma queries (uses postgres role via DATABASE_URL)
-- - Supabase Auth (separate auth schema)
--
-- If you later need Supabase Realtime or direct client queries,
-- you'll need to re-grant access and enable RLS with proper policies.

-- Revoke access from anon role (unauthenticated PostgREST requests)
REVOKE ALL ON accounts FROM anon;
REVOKE ALL ON transactions FROM anon;
REVOKE ALL ON positions FROM anon;
REVOKE ALL ON securities FROM anon;
REVOKE ALL ON bank_accounts FROM anon;
REVOKE ALL ON bank_transactions FROM anon;
REVOKE ALL ON price_history FROM anon;

-- Revoke access from authenticated role (authenticated PostgREST requests)
REVOKE ALL ON accounts FROM authenticated;
REVOKE ALL ON transactions FROM authenticated;
REVOKE ALL ON positions FROM authenticated;
REVOKE ALL ON securities FROM authenticated;
REVOKE ALL ON bank_accounts FROM authenticated;
REVOKE ALL ON bank_transactions FROM authenticated;
REVOKE ALL ON price_history FROM authenticated;

-- Revoke access to Prisma's internal migration tracking table
REVOKE ALL ON _prisma_migrations FROM anon;
REVOKE ALL ON _prisma_migrations FROM authenticated;
