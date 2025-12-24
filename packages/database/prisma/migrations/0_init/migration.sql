-- Initial migration baseline
-- This migration represents the existing database schema

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "broker" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "account_name" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "securities" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "isin" TEXT,
    "name" TEXT NOT NULL,
    "security_type" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "exchange" TEXT,
    "sector" TEXT,
    "industry" TEXT,
    "country" TEXT,

    CONSTRAINT "securities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "security_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL(18,8) NOT NULL,
    "price" DECIMAL(18,8) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "fees" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "notes" TEXT,
    "external_id" TEXT,
    "fingerprint" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "security_id" TEXT NOT NULL,
    "quantity" DECIMAL(18,8) NOT NULL,
    "avg_cost" DECIMAL(18,8) NOT NULL,
    "total_cost" DECIMAL(18,2) NOT NULL,
    "market_price" DECIMAL(18,8),
    "market_value" DECIMAL(18,2),
    "unrealized_pnl" DECIMAL(18,2),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "iban" TEXT,
    "bank_name" TEXT NOT NULL,
    "account_name" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "last_synced" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "bank_account_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "balance" DECIMAL(18,2),
    "category" TEXT,
    "reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_history" (
    "id" TEXT NOT NULL,
    "security_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "open" DECIMAL(18,8),
    "high" DECIMAL(18,8),
    "low" DECIMAL(18,8),
    "close" DECIMAL(18,8) NOT NULL,
    "volume" BIGINT,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_user_id_broker_account_id_key" ON "accounts"("user_id", "broker", "account_id");

-- CreateIndex
CREATE UNIQUE INDEX "securities_isin_key" ON "securities"("isin");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_user_id_account_id_external_id_key" ON "transactions"("user_id", "account_id", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_user_id_fingerprint_key" ON "transactions"("user_id", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "positions_user_id_account_id_security_id_key" ON "positions"("user_id", "account_id", "security_id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_user_id_iban_key" ON "bank_accounts"("user_id", "iban");

-- CreateIndex
CREATE UNIQUE INDEX "bank_transactions_user_id_bank_account_id_date_amount_descr_key" ON "bank_transactions"("user_id", "bank_account_id", "date", "amount", "description");

-- CreateIndex
CREATE UNIQUE INDEX "price_history_security_id_date_key" ON "price_history"("security_id", "date");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_security_id_fkey" FOREIGN KEY ("security_id") REFERENCES "securities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_security_id_fkey" FOREIGN KEY ("security_id") REFERENCES "securities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_security_id_fkey" FOREIGN KEY ("security_id") REFERENCES "securities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
