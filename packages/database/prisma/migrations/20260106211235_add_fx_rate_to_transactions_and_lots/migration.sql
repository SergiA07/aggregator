-- AlterTable
ALTER TABLE "lots" ADD COLUMN     "fx_rate" DECIMAL(12,6),
ADD COLUMN     "local_cost_per_share" DECIMAL(18,8),
ADD COLUMN     "local_currency" TEXT;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "auto_fx_cost" DECIMAL(18,4),
ADD COLUMN     "fx_rate" DECIMAL(12,6),
ADD COLUMN     "local_amount" DECIMAL(18,4),
ADD COLUMN     "local_currency" TEXT;
