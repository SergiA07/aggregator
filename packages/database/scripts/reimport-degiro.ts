/**
 * Re-import DeGiro Transactions Script
 *
 * Deletes existing DeGiro transactions/lots and re-imports from CSV
 * with the updated parser that extracts FX rate data.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." bun run packages/database/scripts/reimport-degiro.ts
 */

import { prisma } from '../src';

const CSV_PATH = '/Users/sergiayora/Code/projects/my-aggregator-monorepo/.csv/Transactions.csv';

async function reimportDegiro(): Promise<void> {
  console.log('Starting DeGiro re-import...\n');

  // Find the DeGiro account
  const degiroAccount = await prisma.account.findFirst({
    where: { institution: 'degiro' },
  });

  if (!degiroAccount) {
    console.error('No DeGiro account found!');
    process.exit(1);
  }

  console.log(`Found DeGiro account: ${degiroAccount.name} (${degiroAccount.id})`);

  // Count existing data
  const existingTxCount = await prisma.transaction.count({
    where: { accountId: degiroAccount.id },
  });
  const existingLotCount = await prisma.lot.count({
    where: { accountId: degiroAccount.id },
  });
  const existingPosCount = await prisma.position.count({
    where: { accountId: degiroAccount.id },
  });

  console.log(`\nExisting data for DeGiro account:`);
  console.log(`  Transactions: ${existingTxCount}`);
  console.log(`  Lots: ${existingLotCount}`);
  console.log(`  Positions: ${existingPosCount}`);

  // Delete existing data (in correct order for foreign key constraints)
  console.log('\nDeleting existing data...');

  // First delete lot disposals (they reference lots)
  const deletedDisposals = await prisma.lotDisposal.deleteMany({
    where: { lot: { accountId: degiroAccount.id } },
  });
  console.log(`  Deleted ${deletedDisposals.count} lot disposals`);

  // Then delete lots
  const deletedLots = await prisma.lot.deleteMany({
    where: { accountId: degiroAccount.id },
  });
  console.log(`  Deleted ${deletedLots.count} lots`);

  // Delete positions
  const deletedPositions = await prisma.position.deleteMany({
    where: { accountId: degiroAccount.id },
  });
  console.log(`  Deleted ${deletedPositions.count} positions`);

  // Delete transactions
  const deletedTxs = await prisma.transaction.deleteMany({
    where: { accountId: degiroAccount.id },
  });
  console.log(`  Deleted ${deletedTxs.count} transactions`);

  console.log('\nData cleanup complete. Ready for re-import via API.');
  console.log('\nTo re-import, use the import endpoint:');
  console.log(`  curl -X POST http://localhost:3333/import/csv \\`);
  console.log(`    -H "Authorization: Bearer <token>" \\`);
  console.log(`    -F "file=@${CSV_PATH}"`);
  console.log('\nOr use the web UI to upload the CSV file.');
}

// Main
reimportDegiro()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error('Re-import failed:', error);
    prisma.$disconnect();
    process.exit(1);
  });
