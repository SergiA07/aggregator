/**
 * Backup Portfolio Data Script
 *
 * Exports all portfolio data (transactions, lots, positions, securities) to JSON files
 * before re-importing with updated FX data extraction.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." bun run packages/database/scripts/backup-portfolio-data.ts
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { prisma } from '../src';

// Custom JSON replacer to handle BigInt and Decimal
function jsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  // Handle Prisma Decimal
  if (value !== null && typeof value === 'object' && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return value;
}

interface BackupData {
  exportedAt: string;
  counts: {
    accounts: number;
    transactions: number;
    positions: number;
    lots: number;
    lotDisposals: number;
    securities: number;
    priceHistory: number;
  };
  accounts: unknown[];
  transactions: unknown[];
  positions: unknown[];
  lots: unknown[];
  lotDisposals: unknown[];
  securities: unknown[];
  priceHistory: unknown[];
}

async function backupPortfolioData(): Promise<void> {
  console.log('Starting portfolio data backup...\n');

  // Create backup directory
  const backupDir = './backups';
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  // Fetch all data
  console.log('Fetching accounts...');
  const accounts = await prisma.account.findMany({
    include: { balances: true },
  });

  console.log('Fetching transactions...');
  const transactions = await prisma.transaction.findMany({
    orderBy: { date: 'asc' },
  });

  console.log('Fetching positions...');
  const positions = await prisma.position.findMany();

  console.log('Fetching lots...');
  const lots = await prisma.lot.findMany({
    orderBy: { purchaseDate: 'asc' },
  });

  console.log('Fetching lot disposals...');
  const lotDisposals = await prisma.lotDisposal.findMany({
    orderBy: { disposalDate: 'asc' },
  });

  console.log('Fetching securities...');
  const securities = await prisma.security.findMany();

  console.log('Fetching price history...');
  const priceHistory = await prisma.priceHistory.findMany({
    orderBy: { date: 'asc' },
  });

  // Prepare backup data
  const backupData: BackupData = {
    exportedAt: new Date().toISOString(),
    counts: {
      accounts: accounts.length,
      transactions: transactions.length,
      positions: positions.length,
      lots: lots.length,
      lotDisposals: lotDisposals.length,
      securities: securities.length,
      priceHistory: priceHistory.length,
    },
    accounts,
    transactions,
    positions,
    lots,
    lotDisposals,
    securities,
    priceHistory,
  };

  // Write full backup
  const fullBackupPath = `${backupDir}/portfolio-backup-${timestamp}.json`;
  writeFileSync(fullBackupPath, JSON.stringify(backupData, jsonReplacer, 2));
  console.log(`\nFull backup written to: ${fullBackupPath}`);

  // Write individual files for easier inspection
  writeFileSync(
    `${backupDir}/transactions-${timestamp}.json`,
    JSON.stringify(transactions, jsonReplacer, 2),
  );
  writeFileSync(`${backupDir}/lots-${timestamp}.json`, JSON.stringify(lots, jsonReplacer, 2));
  writeFileSync(
    `${backupDir}/positions-${timestamp}.json`,
    JSON.stringify(positions, jsonReplacer, 2),
  );
  writeFileSync(
    `${backupDir}/securities-${timestamp}.json`,
    JSON.stringify(securities, jsonReplacer, 2),
  );

  // Print summary
  console.log('\n=== Backup Summary ===');
  console.log(`Accounts: ${accounts.length}`);
  console.log(`Transactions: ${transactions.length}`);
  console.log(`Positions: ${positions.length}`);
  console.log(`Lots: ${lots.length}`);
  console.log(`Lot Disposals: ${lotDisposals.length}`);
  console.log(`Securities: ${securities.length}`);
  console.log(`Price History: ${priceHistory.length}`);

  // Print transaction type breakdown
  const txByType = new Map<string, number>();
  for (const tx of transactions) {
    const count = txByType.get(tx.type) || 0;
    txByType.set(tx.type, count + 1);
  }
  console.log('\n=== Transaction Types ===');
  for (const [type, count] of [...txByType.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }

  // Print account summary
  console.log('\n=== Accounts ===');
  for (const account of accounts) {
    const txCount = transactions.filter((t) => t.accountId === account.id).length;
    const posCount = positions.filter((p) => p.accountId === account.id).length;
    console.log(
      `  ${account.name} (${account.institution}): ${txCount} txs, ${posCount} positions`,
    );
  }

  console.log('\nBackup complete!');
}

// Main
backupPortfolioData()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error('Backup failed:', error);
    prisma.$disconnect();
    process.exit(1);
  });
