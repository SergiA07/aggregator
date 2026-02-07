/**
 * Restore Market Prices from Backup
 *
 * Restores marketPrice, marketValue, unrealizedPnl, and currency
 * from the backup file to current positions.
 */

import { readFileSync } from 'node:fs';
import { prisma } from '../src';

const BACKUP_PATH =
  '/Users/sergiayora/Code/projects/my-aggregator-monorepo/packages/database/backups/positions-2026-01-06T21-23-36.json';

interface BackupPosition {
  id: string;
  securityId: string;
  accountId: string;
  marketPrice: number | null;
  marketValue: number | null;
  unrealizedPnl: number | null;
  currency: string;
}

async function restorePricesFromBackup(): Promise<void> {
  console.log('Restoring market prices from backup...\n');

  // Read backup
  const backupData: BackupPosition[] = JSON.parse(readFileSync(BACKUP_PATH, 'utf-8'));
  console.log(`Loaded ${backupData.length} positions from backup`);

  // Create lookup by securityId + accountId
  const backupMap = new Map<string, BackupPosition>();
  for (const pos of backupData) {
    const key = `${pos.accountId}:${pos.securityId}`;
    backupMap.set(key, pos);
  }

  // Get current positions
  const currentPositions = await prisma.position.findMany({
    where: {
      account: { institution: 'degiro' },
    },
    select: {
      id: true,
      securityId: true,
      accountId: true,
      quantity: true,
      totalCost: true,
      marketPrice: true,
    },
  });

  console.log(`Found ${currentPositions.length} current positions`);

  let restored = 0;
  let missing = 0;

  for (const pos of currentPositions) {
    const key = `${pos.accountId}:${pos.securityId}`;
    const backup = backupMap.get(key);

    if (backup && backup.marketPrice !== null) {
      // Calculate new market value based on current quantity
      const quantity = Number(pos.quantity);
      const marketPrice = backup.marketPrice;
      const marketValue = quantity * marketPrice;
      const totalCost = Number(pos.totalCost);
      const unrealizedPnl = marketValue - totalCost;

      await prisma.position.update({
        where: { id: pos.id },
        data: {
          marketPrice,
          marketValue,
          unrealizedPnl,
          currency: backup.currency || 'EUR',
        },
      });
      restored++;
    } else {
      missing++;
    }
  }

  console.log(`\nRestored prices for ${restored} positions`);
  console.log(`Missing backup data for ${missing} positions`);

  // Show positions still without prices
  const stillMissing = await prisma.position.findMany({
    where: {
      account: { institution: 'degiro' },
      marketPrice: null,
    },
    include: { security: true },
  });

  if (stillMissing.length > 0) {
    console.log(`\nPositions still without prices:`);
    for (const p of stillMissing) {
      console.log(`  - ${p.security.symbol}: ${p.security.name}`);
    }
  }

  // Calculate totals
  const totals = await prisma.position.aggregate({
    where: { account: { institution: 'degiro' } },
    _sum: {
      marketValue: true,
      totalCost: true,
      unrealizedPnl: true,
    },
  });

  console.log(`\nNew totals:`);
  console.log(`  Market Value: €${Number(totals._sum.marketValue || 0).toFixed(2)}`);
  console.log(`  Total Cost: €${Number(totals._sum.totalCost || 0).toFixed(2)}`);
  console.log(`  Unrealized P&L: €${Number(totals._sum.unrealizedPnl || 0).toFixed(2)}`);
}

// Main
restorePricesFromBackup()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error('Failed:', error);
    prisma.$disconnect();
    process.exit(1);
  });
