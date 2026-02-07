/**
 * Backfill Lots Script
 *
 * Creates lot records for all existing buy transactions and
 * lot disposal records for all existing sell transactions.
 *
 * This script processes transactions in chronological order to ensure
 * FIFO lot disposal works correctly.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." bun run packages/database/scripts/backfill-lots.ts
 *
 * Options:
 *   --dry-run    Preview what would be created without making changes
 *   --user-id    Process only a specific user (for testing)
 */

import { prisma } from '../src';

interface BackfillStats {
  usersProcessed: number;
  lotsCreated: number;
  disposalsCreated: number;
  transactionsSkipped: number;
  errors: string[];
}

async function backfillLots(options: { dryRun: boolean; userId?: string }): Promise<BackfillStats> {
  const stats: BackfillStats = {
    usersProcessed: 0,
    lotsCreated: 0,
    disposalsCreated: 0,
    transactionsSkipped: 0,
    errors: [],
  };

  console.log('Starting lot backfill...');
  console.log(`Mode: ${options.dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);

  // Get all users (or specific user)
  const users = await prisma.account.findMany({
    where: options.userId ? { userId: options.userId } : undefined,
    select: { userId: true },
    distinct: ['userId'],
  });

  const uniqueUserIds = [...new Set(users.map((u) => u.userId))];
  console.log(`Found ${uniqueUserIds.length} users to process`);

  for (const userId of uniqueUserIds) {
    try {
      await processUser(userId, stats, options.dryRun);
      stats.usersProcessed++;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      stats.errors.push(`User ${userId}: ${message}`);
      console.error(`Error processing user ${userId}:`, message);
    }
  }

  return stats;
}

async function processUser(userId: string, stats: BackfillStats, dryRun: boolean): Promise<void> {
  console.log(`\nProcessing user: ${userId}`);

  // Get all buy/sell transactions with securities, ordered by date
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: { in: ['buy', 'sell'] },
      securityId: { not: null },
      quantity: { gt: 0 },
    },
    orderBy: { date: 'asc' },
    include: {
      account: { select: { id: true, institution: true } },
      security: { select: { id: true, symbol: true } },
    },
  });

  console.log(`  Found ${transactions.length} buy/sell transactions`);

  // Check which transactions already have lots
  const existingLotTxIds = new Set(
    (
      await prisma.lot.findMany({
        where: { userId },
        select: { buyTransactionId: true },
      })
    ).map((l) => l.buyTransactionId),
  );

  const existingDisposalTxIds = new Set(
    (
      await prisma.lotDisposal.findMany({
        where: { lot: { userId } },
        select: { sellTransactionId: true },
      })
    ).map((d) => d.sellTransactionId),
  );

  // Track lots in memory for FIFO processing
  // Key: `${accountId}:${securityId}`, Value: array of lots
  const lotsByPosition = new Map<
    string,
    Array<{
      id: string;
      purchaseDate: Date;
      remainingQuantity: number;
      costPerShare: number;
    }>
  >();

  // First, load any existing lots into memory
  const existingLots = await prisma.lot.findMany({
    where: { userId, isClosed: false },
    orderBy: { purchaseDate: 'asc' },
  });

  for (const lot of existingLots) {
    const key = `${lot.accountId}:${lot.securityId}`;
    const lots = lotsByPosition.get(key) || [];
    lots.push({
      id: lot.id,
      purchaseDate: lot.purchaseDate,
      remainingQuantity: lot.remainingQuantity.toNumber(),
      costPerShare: lot.costPerShare.toNumber(),
    });
    lotsByPosition.set(key, lots);
  }

  // Process transactions in chronological order
  for (const tx of transactions) {
    const key = `${tx.accountId}:${tx.securityId}`;
    const quantity = tx.quantity?.toNumber() ?? 0;
    const price = tx.price?.toNumber() ?? 0;
    const fees = tx.fees?.toNumber() ?? 0;

    if (tx.type === 'buy') {
      // Check if lot already exists
      if (existingLotTxIds.has(tx.id)) {
        stats.transactionsSkipped++;
        continue;
      }

      // Create lot for buy transaction
      const totalCost = quantity * price + fees;
      const costPerShare = totalCost / quantity;

      if (!dryRun) {
        const lot = await prisma.lot.create({
          data: {
            userId,
            accountId: tx.accountId,
            securityId: tx.securityId!,
            buyTransactionId: tx.id,
            purchaseDate: tx.date,
            originalQuantity: quantity,
            remainingQuantity: quantity,
            costPerShare,
            totalCost,
            currency: tx.currency,
            isClosed: false,
          },
        });

        // Add to in-memory tracking
        const lots = lotsByPosition.get(key) || [];
        lots.push({
          id: lot.id,
          purchaseDate: tx.date,
          remainingQuantity: quantity,
          costPerShare,
        });
        // Sort by purchase date to maintain FIFO order
        lots.sort((a, b) => a.purchaseDate.getTime() - b.purchaseDate.getTime());
        lotsByPosition.set(key, lots);
      }

      stats.lotsCreated++;
      console.log(
        `    ${dryRun ? '[DRY] ' : ''}Created lot: ${tx.security?.symbol} x ${quantity} @ ${price}`,
      );
    } else if (tx.type === 'sell') {
      // Check if disposal already exists
      if (existingDisposalTxIds.has(tx.id)) {
        stats.transactionsSkipped++;
        continue;
      }

      // Dispose lots in FIFO order
      const lots = lotsByPosition.get(key) || [];
      let remainingToSell = quantity;
      const totalProceeds = quantity * price - fees;

      if (lots.length === 0) {
        console.warn(
          `    Warning: No lots found for sell of ${tx.security?.symbol} x ${quantity} - skipping`,
        );
        stats.transactionsSkipped++;
        continue;
      }

      for (const lot of lots) {
        if (remainingToSell <= 0) break;
        if (lot.remainingQuantity <= 0) continue;

        const disposeQuantity = Math.min(lot.remainingQuantity, remainingToSell);
        const costBasis = disposeQuantity * lot.costPerShare;
        const proceedsForDisposal = (disposeQuantity / quantity) * totalProceeds;
        const realizedPnl = proceedsForDisposal - costBasis;

        if (!dryRun) {
          // Create disposal record
          await prisma.lotDisposal.create({
            data: {
              lotId: lot.id,
              sellTransactionId: tx.id,
              quantity: disposeQuantity,
              costBasis,
              proceeds: proceedsForDisposal,
              realizedPnl,
              disposalDate: tx.date,
            },
          });

          // Update lot
          const newRemaining = lot.remainingQuantity - disposeQuantity;
          await prisma.lot.update({
            where: { id: lot.id },
            data: {
              remainingQuantity: newRemaining,
              isClosed: newRemaining <= 0,
            },
          });

          // Update in-memory tracking
          lot.remainingQuantity = newRemaining;
        }

        stats.disposalsCreated++;
        remainingToSell -= disposeQuantity;
      }

      if (remainingToSell > 0.0001) {
        console.warn(
          `    Warning: Could not cover full sell quantity for ${tx.security?.symbol}. Remaining: ${remainingToSell}`,
        );
      }

      console.log(
        `    ${dryRun ? '[DRY] ' : ''}Processed sell: ${tx.security?.symbol} x ${quantity} @ ${price}`,
      );
    }
  }
}

// Main execution
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const userIdArg = args.find((a) => a.startsWith('--user-id='));
const userId = userIdArg?.split('=')[1];

backfillLots({ dryRun, userId })
  .then((stats) => {
    console.log('\n=== Backfill Complete ===');
    console.log(`Users processed: ${stats.usersProcessed}`);
    console.log(`Lots created: ${stats.lotsCreated}`);
    console.log(`Disposals created: ${stats.disposalsCreated}`);
    console.log(`Transactions skipped: ${stats.transactionsSkipped}`);
    if (stats.errors.length > 0) {
      console.log(`\nErrors (${stats.errors.length}):`);
      for (const error of stats.errors) {
        console.log(`  - ${error}`);
      }
    }
    process.exit(stats.errors.length > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
