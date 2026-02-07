-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE INDEX "positions_user_id_idx" ON "positions"("user_id");

-- CreateIndex
CREATE INDEX "positions_account_id_idx" ON "positions"("account_id");

-- CreateIndex
CREATE INDEX "securities_yahoo_symbol_idx" ON "securities"("yahoo_symbol");

-- CreateIndex
CREATE INDEX "transactions_user_id_idx" ON "transactions"("user_id");

-- CreateIndex
CREATE INDEX "transactions_account_id_idx" ON "transactions"("account_id");

-- CreateIndex
CREATE INDEX "transactions_security_id_idx" ON "transactions"("security_id");

-- CreateIndex
CREATE INDEX "transactions_date_idx" ON "transactions"("date");
