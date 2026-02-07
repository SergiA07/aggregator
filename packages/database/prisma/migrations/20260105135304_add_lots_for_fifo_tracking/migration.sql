-- CreateTable
CREATE TABLE "lots" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "security_id" TEXT NOT NULL,
    "buy_transaction_id" TEXT NOT NULL,
    "purchase_date" TIMESTAMP(3) NOT NULL,
    "original_quantity" DECIMAL(18,8) NOT NULL,
    "remaining_quantity" DECIMAL(18,8) NOT NULL,
    "cost_per_share" DECIMAL(18,8) NOT NULL,
    "total_cost" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lot_disposals" (
    "id" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "sell_transaction_id" TEXT NOT NULL,
    "quantity" DECIMAL(18,8) NOT NULL,
    "cost_basis" DECIMAL(18,4) NOT NULL,
    "proceeds" DECIMAL(18,4) NOT NULL,
    "realized_pnl" DECIMAL(18,4) NOT NULL,
    "disposal_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lot_disposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lots_user_id_account_id_security_id_idx" ON "lots"("user_id", "account_id", "security_id");

-- CreateIndex
CREATE INDEX "lots_user_id_security_id_purchase_date_idx" ON "lots"("user_id", "security_id", "purchase_date");

-- CreateIndex
CREATE INDEX "lots_is_closed_idx" ON "lots"("is_closed");

-- CreateIndex
CREATE INDEX "lot_disposals_lot_id_idx" ON "lot_disposals"("lot_id");

-- CreateIndex
CREATE INDEX "lot_disposals_sell_transaction_id_idx" ON "lot_disposals"("sell_transaction_id");

-- AddForeignKey
ALTER TABLE "lot_disposals" ADD CONSTRAINT "lot_disposals_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
