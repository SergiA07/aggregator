-- Enable Row Level Security on all user tables
-- This provides defense-in-depth: even if the API has a bug, users can't access others' data

-- Enable RLS on user-owned tables
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own accounts
CREATE POLICY "Users access own accounts" ON accounts
  FOR ALL USING (auth.uid()::text = user_id);

-- Policy: Users can only access their own positions
CREATE POLICY "Users access own positions" ON positions
  FOR ALL USING (auth.uid()::text = user_id);

-- Policy: Users can only access their own transactions
CREATE POLICY "Users access own transactions" ON transactions
  FOR ALL USING (auth.uid()::text = user_id);

-- Policy: Users can only access their own bank accounts
CREATE POLICY "Users access own bank_accounts" ON bank_accounts
  FOR ALL USING (auth.uid()::text = user_id);

-- Policy: Users can only access their own bank transactions
CREATE POLICY "Users access own bank_transactions" ON bank_transactions
  FOR ALL USING (auth.uid()::text = user_id);

-- Securities and PriceHistory are shared (read-only for all authenticated users)
ALTER TABLE securities ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read securities" ON securities
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated read price_history" ON price_history
  FOR SELECT USING (auth.role() = 'authenticated');

-- Service role can insert/update securities and price_history
CREATE POLICY "Service role manage securities" ON securities
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role manage price_history" ON price_history
  FOR ALL USING (auth.role() = 'service_role');
