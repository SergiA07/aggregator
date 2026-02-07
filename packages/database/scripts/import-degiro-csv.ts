/**
 * Direct DeGiro CSV Import Script
 *
 * Imports DeGiro transactions from CSV file directly using the parser,
 * bypassing the API. Used for re-importing with updated FX data extraction.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." bun run packages/database/scripts/import-degiro-csv.ts
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { prisma } from '../src';

const CSV_PATH = '/Users/sergiayora/Code/projects/my-aggregator-monorepo/.csv/Transactions.csv';

// Transaction types matching Prisma TransactionType enum
type ParsedTransactionType =
  | 'buy'
  | 'sell'
  | 'dividend'
  | 'interest'
  | 'fee'
  | 'split'
  | 'deposit'
  | 'withdrawal'
  | 'transfer_in'
  | 'transfer_out'
  | 'contribution'
  | 'valuation'
  | 'fx_conversion'
  | 'other';

interface ParsedTransaction {
  date: Date;
  type: ParsedTransactionType;
  symbol?: string;
  isin?: string;
  name: string;
  quantity: number;
  price: number;
  amount: number;
  fees: number;
  currency: string;
  externalId?: string;
  fxRate?: number;
  localCurrency?: string;
  localAmount?: number;
  localPrice?: number;
  autoFxCost?: number;
}

function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  let cleaned = value.toString().trim();
  cleaned = cleaned.replace(/[€$£¥₹]/g, '').trim();
  // European format: periods as thousands separator, comma as decimal (e.g., "1.234,56")
  // US format: commas as thousands separator, period as decimal (e.g., "1,234.56")
  // Detect by checking the last separator - if comma is last, it's the decimal
  const lastComma = cleaned.lastIndexOf(',');
  const lastPeriod = cleaned.lastIndexOf('.');
  if (lastComma > lastPeriod) {
    // European format: comma is decimal separator
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastPeriod > lastComma) {
    // US format: period is decimal separator
    cleaned = cleaned.replace(/,/g, '');
  } else {
    // No separators or only one type - just remove commas
    cleaned = cleaned.replace(/,/g, '');
  }
  const num = Number.parseFloat(cleaned);
  return Number.isNaN(num) ? 0 : num;
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const cleaned = value.trim();
  const match = cleaned.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (match) {
    const day = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10) - 1;
    const year = Number.parseInt(match[3], 10);
    return new Date(year, month, day);
  }
  return null;
}

function detectTransactionType(quantity: number): 'buy' | 'sell' {
  return quantity >= 0 ? 'buy' : 'sell';
}

function parseCSVRaw(content: string): string[][] {
  const lines = content.split('\n').filter((line) => line.trim());
  const result: string[][] = [];
  for (const line of lines) {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && !inQuotes) {
        inQuotes = true;
      } else if (char === '"' && inQuotes) {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    result.push(values);
  }
  return result;
}

function findColumnIndices(headers: string[]) {
  const findIndex = (names: string[]): number => {
    for (const name of names) {
      const idx = headers.findIndex(
        (h) =>
          h.toLowerCase().trim() === name.toLowerCase() ||
          h.toLowerCase().includes(name.toLowerCase()),
      );
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const priceIdx = findIndex(['precio', 'price']);
  const localValueIdx = findIndex(['valor local', 'local value']);

  return {
    date: findIndex(['fecha', 'date']),
    product: findIndex(['producto', 'product']),
    isin: findIndex(['isin', 'código isin']),
    quantity: findIndex(['número', 'quantity']),
    price: priceIdx,
    priceCurrency: priceIdx !== -1 ? priceIdx + 1 : -1,
    localValue: localValueIdx,
    localCurrency: localValueIdx !== -1 ? localValueIdx + 1 : -1,
    valueEur: findIndex(['valor eur', 'value eur', 'value']),
    exchangeRate: findIndex(['tipo de cambio', 'exchange rate']),
    autoFxCost: findIndex(['comisión autofx', 'autofx cost']),
    transactionCosts: findIndex(['costes de transacción', 'transaction costs']),
    orderId: findIndex(['id orden', 'order id']),
  };
}

function generateFingerprint(params: {
  accountId: string;
  securityId: string | null;
  name: string;
  date: Date;
  quantity: number;
  price: number;
  amount: number;
}): string {
  const data = [
    params.accountId,
    params.securityId ?? params.name,
    params.date.toISOString().split('T')[0],
    params.quantity.toFixed(8),
    params.price.toFixed(8),
    params.amount.toFixed(2),
  ].join('|');
  return createHash('sha256').update(data).digest('hex').slice(0, 32);
}

async function importDeGiroCSV(): Promise<void> {
  console.log('Starting DeGiro CSV import...\n');

  // Read CSV
  const content = readFileSync(CSV_PATH, 'utf-8');
  const rawRecords = parseCSVRaw(content);
  console.log(`Read ${rawRecords.length} rows from CSV`);

  if (rawRecords.length < 2) {
    console.error('CSV file is empty or has no data rows');
    process.exit(1);
  }

  // Find column indices
  const headers = rawRecords[0];
  const cols = findColumnIndices(headers);
  console.log('Found column indices:', cols);

  // Find DeGiro account
  const account = await prisma.account.findFirst({
    where: { institution: 'degiro' },
  });

  if (!account) {
    console.error('No DeGiro account found! Create one first.');
    process.exit(1);
  }

  console.log(`\nImporting to account: ${account.name} (${account.id})`);
  console.log(`User ID: ${account.userId}`);

  // Parse transactions
  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];

  for (let i = 1; i < rawRecords.length; i++) {
    const row = rawRecords[i];
    try {
      const quantity = parseNumber(row[cols.quantity]);
      const product = row[cols.product]?.trim();
      const dateStr = row[cols.date]?.trim();

      if (!product || !dateStr || quantity === 0) continue;

      const date = parseDate(dateStr);
      if (!date) {
        errors.push(`Row ${i + 1}: Invalid date "${dateStr}"`);
        continue;
      }

      const isin = row[cols.isin]?.trim();
      const price = parseNumber(row[cols.price]);
      const priceCurrency = row[cols.priceCurrency]?.trim() || 'EUR';
      const localValue = parseNumber(row[cols.localValue]);
      const localCurrency = row[cols.localCurrency]?.trim() || priceCurrency;
      const eurValue = parseNumber(row[cols.valueEur]);
      const exchangeRate = parseNumber(row[cols.exchangeRate]);
      const autoFxCost = parseNumber(row[cols.autoFxCost]);
      const fees = Math.abs(parseNumber(row[cols.transactionCosts]));

      const amount = eurValue !== 0 ? Math.abs(eurValue) : Math.abs(localValue);
      const hasFxData = exchangeRate !== 0 && localCurrency !== 'EUR';

      const tx: ParsedTransaction = {
        date,
        type: detectTransactionType(quantity),
        symbol: isin || product.substring(0, 20).replace(/\s+/g, '_').toUpperCase(),
        isin: isin?.length === 12 ? isin : undefined,
        name: product,
        quantity: Math.abs(quantity),
        price: Math.abs(price),
        amount,
        fees,
        currency: 'EUR',
        externalId: row[cols.orderId]?.trim() || undefined,
        ...(hasFxData && {
          fxRate: exchangeRate,
          localCurrency,
          localAmount: Math.abs(localValue),
          localPrice: Math.abs(price),
          autoFxCost: autoFxCost !== 0 ? Math.abs(autoFxCost) : undefined,
        }),
      };

      transactions.push(tx);
    } catch (error) {
      errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  console.log(`\nParsed ${transactions.length} transactions`);
  if (errors.length > 0) {
    console.log(`Errors: ${errors.length}`);
  }

  // Sort by date (oldest first) for proper FIFO lot tracking
  transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Get or create securities
  const securityMap = new Map<string, string>();
  const uniqueIsins = [...new Set(transactions.map((t) => t.isin).filter(Boolean))] as string[];

  console.log(`\nProcessing ${uniqueIsins.length} unique securities...`);

  for (const isin of uniqueIsins) {
    const tx = transactions.find((t) => t.isin === isin);
    if (!tx) continue;

    let security = await prisma.security.findUnique({ where: { isin } });
    if (!security) {
      security = await prisma.security.create({
        data: {
          symbol: tx.symbol || isin,
          isin,
          name: tx.name,
          securityType: 'stock',
          currency: 'EUR',
        },
      });
      console.log(`  Created security: ${tx.name} (${isin})`);
    }
    securityMap.set(isin, security.id);
  }

  // Import transactions
  console.log('\nImporting transactions...');
  let imported = 0;
  let skipped = 0;

  for (const tx of transactions) {
    try {
      const securityId = tx.isin ? securityMap.get(tx.isin) : null;
      if (!securityId && tx.isin) {
        console.log(`  Warning: No security found for ${tx.isin}`);
        continue;
      }

      const fingerprint = tx.externalId
        ? undefined
        : generateFingerprint({
            accountId: account.id,
            securityId,
            name: tx.name,
            date: tx.date,
            quantity: tx.quantity,
            price: tx.price,
            amount: tx.amount,
          });

      // Create transaction
      const transaction = await prisma.transaction.create({
        data: {
          userId: account.userId,
          accountId: account.id,
          securityId,
          date: tx.date,
          type: tx.type,
          quantity: tx.quantity,
          price: tx.price,
          amount: tx.amount,
          fees: tx.fees,
          currency: tx.currency,
          externalId: tx.externalId,
          fingerprint,
          ...(tx.fxRate && {
            fxRate: tx.fxRate,
            localCurrency: tx.localCurrency,
            localAmount: tx.localAmount,
            autoFxCost: tx.autoFxCost,
          }),
        },
      });

      // Create lot for buy transactions
      if (securityId && tx.type === 'buy' && tx.quantity > 0) {
        const totalFees = tx.fees + (tx.autoFxCost || 0);
        // Use tx.amount (EUR value) for cost basis, NOT tx.quantity * tx.price (local currency)
        const totalCost = tx.amount + totalFees;
        const costPerShare = totalCost / tx.quantity;

        await prisma.lot.create({
          data: {
            userId: account.userId,
            accountId: account.id,
            securityId,
            buyTransactionId: transaction.id,
            purchaseDate: tx.date,
            originalQuantity: tx.quantity,
            remainingQuantity: tx.quantity,
            costPerShare,
            totalCost,
            currency: tx.currency,
            isClosed: false,
            ...(tx.fxRate &&
              tx.localCurrency && {
                fxRate: tx.fxRate,
                localCurrency: tx.localCurrency,
                localCostPerShare: tx.localPrice,
              }),
          },
        });
      }

      // Dispose lots for sell transactions
      if (securityId && tx.type === 'sell' && tx.quantity > 0) {
        const totalFees = tx.fees + (tx.autoFxCost || 0);
        await disposeLotsFIFO(
          account.userId,
          account.id,
          securityId,
          transaction.id,
          tx.date,
          tx.quantity,
          tx.amount, // Use EUR amount, not local currency price
          totalFees,
        );
      }

      imported++;
    } catch (error: unknown) {
      // Skip duplicates
      if (
        error instanceof Error &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        skipped++;
        continue;
      }
      console.error(`Error importing transaction:`, error);
    }
  }

  console.log(`\nImport complete:`);
  console.log(`  Imported: ${imported}`);
  console.log(`  Skipped (duplicates): ${skipped}`);

  // Count final state
  const txCount = await prisma.transaction.count({ where: { accountId: account.id } });
  const lotCount = await prisma.lot.count({ where: { accountId: account.id } });
  const lotsWithFx = await prisma.lot.count({
    where: { accountId: account.id, fxRate: { not: null } },
  });

  console.log(`\nFinal state:`);
  console.log(`  Transactions: ${txCount}`);
  console.log(`  Lots: ${lotCount}`);
  console.log(`  Lots with FX data: ${lotsWithFx}`);
}

async function disposeLotsFIFO(
  userId: string,
  accountId: string,
  securityId: string,
  sellTransactionId: string,
  sellDate: Date,
  sellQuantity: number,
  sellAmount: number, // EUR amount from CSV, not local currency price
  fees: number,
): Promise<void> {
  const openLots = await prisma.lot.findMany({
    where: {
      userId,
      accountId,
      securityId,
      isClosed: false,
      remainingQuantity: { gt: 0 },
    },
    orderBy: { purchaseDate: 'asc' },
  });

  if (openLots.length === 0) return;

  let remainingToSell = sellQuantity;
  // Use EUR amount directly, subtract fees for net proceeds
  const totalProceeds = sellAmount - fees;

  for (const lot of openLots) {
    if (remainingToSell <= 0) break;

    const lotRemaining = Number(lot.remainingQuantity);
    const disposeQuantity = Math.min(lotRemaining, remainingToSell);
    const costPerShare = Number(lot.costPerShare);

    const costBasis = disposeQuantity * costPerShare;
    const proceedsForDisposal = (disposeQuantity / sellQuantity) * totalProceeds;
    const realizedPnl = proceedsForDisposal - costBasis;

    await prisma.lotDisposal.create({
      data: {
        lotId: lot.id,
        sellTransactionId,
        quantity: disposeQuantity,
        costBasis,
        proceeds: proceedsForDisposal,
        realizedPnl,
        disposalDate: sellDate,
      },
    });

    const newRemaining = lotRemaining - disposeQuantity;
    await prisma.lot.update({
      where: { id: lot.id },
      data: {
        remainingQuantity: newRemaining,
        isClosed: newRemaining <= 0,
      },
    });

    remainingToSell -= disposeQuantity;
  }
}

// Main
importDeGiroCSV()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error('Import failed:', error);
    prisma.$disconnect();
    process.exit(1);
  });
