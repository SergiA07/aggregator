/**
 * Create/Update Positions from Lots
 *
 * Aggregates lots to create or update position records with accurate
 * cost basis calculated from FIFO lots.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." bun run packages/database/scripts/create-positions-from-lots.ts
 */

import { prisma } from '../src';

interface PositionData {
  accountId: string;
  securityId: string;
  quantity: number;
  totalCost: number;
  avgCost: number;
}

async function createPositionsFromLots(): Promise<void> {
  console.log('Creating positions from lots...\n');

  // Get all accounts
  const accounts = await prisma.account.findMany({
    select: { id: true, userId: true, name: true },
  });

  console.log(`Found ${accounts.length} accounts\n`);

  let created = 0;
  let updated = 0;

  for (const account of accounts) {
    console.log(`Processing account: ${account.name} (${account.id})`);

    // Get aggregated positions from lots
    const lotAggregations = await prisma.lot.groupBy({
      by: ['securityId'],
      where: {
        accountId: account.id,
        remainingQuantity: { gt: 0 },
      },
      _sum: {
        remainingQuantity: true,
      },
    });

    if (lotAggregations.length === 0) {
      console.log('  No open lots found\n');
      continue;
    }

    console.log(`  Found ${lotAggregations.length} securities with open lots`);

    for (const agg of lotAggregations) {
      // Get individual lots to calculate weighted average cost
      const lots = await prisma.lot.findMany({
        where: {
          accountId: account.id,
          securityId: agg.securityId,
          remainingQuantity: { gt: 0 },
        },
        select: {
          remainingQuantity: true,
          costPerShare: true,
        },
      });

      const totalQuantity = lots.reduce((sum, lot) => sum + Number(lot.remainingQuantity), 0);
      const totalCost = lots.reduce(
        (sum, lot) => sum + Number(lot.remainingQuantity) * Number(lot.costPerShare),
        0,
      );
      const avgCost = totalQuantity > 0 ? totalCost / totalQuantity : 0;

      // Check if position exists
      const existingPosition = await prisma.position.findFirst({
        where: {
          accountId: account.id,
          securityId: agg.securityId,
        },
      });

      if (existingPosition) {
        // Update existing position
        await prisma.position.update({
          where: { id: existingPosition.id },
          data: {
            quantity: totalQuantity,
            totalCost,
            avgCost,
          },
        });
        updated++;
      } else {
        // Create new position
        await prisma.position.create({
          data: {
            userId: account.userId,
            accountId: account.id,
            securityId: agg.securityId,
            quantity: totalQuantity,
            totalCost,
            avgCost,
          },
        });
        created++;
      }
    }

    console.log('');
  }

  console.log('\n=== Summary ===');
  console.log(`Positions created: ${created}`);
  console.log(`Positions updated: ${updated}`);

  // Verify
  const totalPositions = await prisma.position.count();
  const degiroPositions = await prisma.position.count({
    where: { account: { institution: 'degiro' } },
  });

  console.log(`\nTotal positions: ${totalPositions}`);
  console.log(`DeGiro positions: ${degiroPositions}`);
}

// Main
createPositionsFromLots()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error('Failed:', error);
    prisma.$disconnect();
    process.exit(1);
  });
