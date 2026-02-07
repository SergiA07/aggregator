/**
 * Migrate Cost Basis from Lots Script
 *
 * Recalculates Position.totalCost and avgCost from FIFO lots.
 * Run this after re-importing transactions with FX data to ensure
 * positions have accurate cost basis values.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." bun run packages/database/scripts/migrate-cost-basis-from-lots.ts
 */

import type { Decimal } from '@repo/database';
import { prisma } from '../src';

function decimalToNumber(val: Decimal | null | undefined): number {
  if (!val) return 0;
  return typeof val.toNumber === 'function' ? val.toNumber() : Number(val);
}

async function migrateCostBasisFromLots(): Promise<void> {
  console.log('Starting cost basis migration from lots...\n');

  // Get all positions
  const positions = await prisma.position.findMany({
    include: {
      account: { select: { name: true, institution: true } },
      security: { select: { symbol: true, name: true } },
    },
  });

  console.log(`Found ${positions.length} positions to update\n`);

  let updatedCount = 0;
  let unchangedCount = 0;
  let noLotsCount = 0;

  for (const position of positions) {
    // Get open lots for this position
    const lots = await prisma.lot.findMany({
      where: {
        userId: position.userId,
        accountId: position.accountId,
        securityId: position.securityId,
        isClosed: false,
        remainingQuantity: { gt: 0 },
      },
    });

    if (lots.length === 0) {
      // No lots - might be a position without transactions (manual?)
      noLotsCount++;
      console.log(
        `  [NO LOTS] ${position.security.symbol} in ${position.account.name}: no open lots found`,
      );
      continue;
    }

    // Calculate cost basis from lots
    let totalCostBasis = 0;
    let totalQuantity = 0;

    for (const lot of lots) {
      const remaining = decimalToNumber(lot.remainingQuantity);
      const costPerShare = decimalToNumber(lot.costPerShare);
      totalQuantity += remaining;
      totalCostBasis += remaining * costPerShare;
    }

    const avgCostPerShare = totalQuantity > 0 ? totalCostBasis / totalQuantity : 0;

    // Compare with current values
    const currentTotalCost = decimalToNumber(position.totalCost);
    const currentAvgCost = decimalToNumber(position.avgCost);
    const currentQuantity = decimalToNumber(position.quantity);

    const totalCostDiff = Math.abs(currentTotalCost - totalCostBasis);
    const avgCostDiff = Math.abs(currentAvgCost - avgCostPerShare);
    const quantityDiff = Math.abs(currentQuantity - totalQuantity);

    // Only update if there's a meaningful difference (> €0.01 or > 0.0001 shares)
    if (totalCostDiff > 0.01 || avgCostDiff > 0.0001 || quantityDiff > 0.0001) {
      await prisma.position.update({
        where: { id: position.id },
        data: {
          totalCost: totalCostBasis,
          avgCost: avgCostPerShare,
          quantity: totalQuantity,
        },
      });

      updatedCount++;
      console.log(`  [UPDATED] ${position.security.symbol} in ${position.account.name}:`);
      console.log(
        `    totalCost: €${currentTotalCost.toFixed(2)} → €${totalCostBasis.toFixed(2)} (Δ€${totalCostDiff.toFixed(2)})`,
      );
      console.log(`    avgCost: €${currentAvgCost.toFixed(4)} → €${avgCostPerShare.toFixed(4)}`);
      if (quantityDiff > 0.0001) {
        console.log(`    quantity: ${currentQuantity.toFixed(4)} → ${totalQuantity.toFixed(4)}`);
      }
    } else {
      unchangedCount++;
    }
  }

  console.log('\n=== Migration Summary ===');
  console.log(`Positions updated: ${updatedCount}`);
  console.log(`Positions unchanged: ${unchangedCount}`);
  console.log(`Positions without lots: ${noLotsCount}`);
  console.log(`Total positions: ${positions.length}`);

  // Show lot statistics
  const allLots = await prisma.lot.findMany();
  const openLots = allLots.filter((l) => !l.isClosed);
  const closedLots = allLots.filter((l) => l.isClosed);

  console.log('\n=== Lot Statistics ===');
  console.log(`Total lots: ${allLots.length}`);
  console.log(`Open lots: ${openLots.length}`);
  console.log(`Closed lots: ${closedLots.length}`);

  // Count lots with FX data
  const lotsWithFx = allLots.filter((l) => l.fxRate !== null);
  console.log(
    `Lots with FX data: ${lotsWithFx.length} (${((lotsWithFx.length / allLots.length) * 100).toFixed(1)}%)`,
  );

  console.log('\nMigration complete!');
}

// Main
migrateCostBasisFromLots()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error('Migration failed:', error);
    prisma.$disconnect();
    process.exit(1);
  });
