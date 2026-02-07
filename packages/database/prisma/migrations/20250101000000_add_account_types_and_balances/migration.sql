-- Account Types and Balances Migration
-- Adds unified account management with AccountType enum, multi-currency balances,
-- and extended transaction types for all account types (brokers, banks, pensions).

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('broker', 'bank', 'pension', 'crypto', 'real_estate', 'other');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('buy', 'sell', 'dividend', 'fee', 'split', 'deposit', 'withdrawal', 'transfer_in', 'transfer_out', 'interest', 'contribution', 'valuation', 'fx_conversion', 'other');

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_security_id_fkey";

-- DropIndex
DROP INDEX "accounts_user_id_broker_account_id_key";

-- DropIndex
DROP INDEX "accounts_user_id_broker_key";

-- AlterTable accounts
-- Remove old columns and add new unified account structure
ALTER TABLE "accounts" DROP COLUMN "account_id",
DROP COLUMN "account_name",
DROP COLUMN "broker",
DROP COLUMN "currency",
ADD COLUMN     "base_currency" TEXT NOT NULL DEFAULT 'EUR',
ADD COLUMN     "external_id" TEXT,
ADD COLUMN     "institution" TEXT NOT NULL,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "last_import_at" TIMESTAMP(3),
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "type" "AccountType" NOT NULL DEFAULT 'broker';

-- AlterTable transactions
-- Make security_id optional (not needed for bank/pension transactions)
-- Change type to new TransactionType enum
-- Add description and category fields
ALTER TABLE "transactions" ADD COLUMN     "category" TEXT,
ADD COLUMN     "description" TEXT,
ALTER COLUMN "security_id" DROP NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" "TransactionType" NOT NULL,
ALTER COLUMN "quantity" DROP NOT NULL,
ALTER COLUMN "price" DROP NOT NULL,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "fees" SET DATA TYPE DECIMAL(18,4);

-- CreateTable account_balances
-- Multi-currency cash balances per account (essential for IBKR with EUR, USD, GBP)
CREATE TABLE "account_balances" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "balance" DECIMAL(18,4) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_balances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_balances_account_id_currency_key" ON "account_balances"("account_id", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_user_id_institution_external_id_key" ON "accounts"("user_id", "institution", "external_id");

-- AddForeignKey
ALTER TABLE "account_balances" ADD CONSTRAINT "account_balances_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_security_id_fkey" FOREIGN KEY ("security_id") REFERENCES "securities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Revoke PostgREST access from new table
DO $$
BEGIN
  REVOKE ALL ON account_balances FROM anon;
  REVOKE ALL ON account_balances FROM authenticated;
END $$;
