-- AddUniqueConstraint
-- Add unique constraint on (user_id, broker) for atomic upsert operations
CREATE UNIQUE INDEX "accounts_user_id_broker_key" ON "accounts"("user_id", "broker");
