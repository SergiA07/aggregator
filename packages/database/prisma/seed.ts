/**
 * Database Seed Script
 *
 * Seeds the database with CSV data from the .csv folder using the broker parsers.
 * This simulates a manual import to test the parsers and data flow.
 *
 * Usage: bun run db:seed (from monorepo root or packages/database)
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { prisma } from '../src/client.js';

// ============================================================================
// Parser Logic (simplified version of API parsers)
// ============================================================================

interface ParsedTransaction {
  date: Date;
  type: 'buy' | 'sell' | 'dividend' | 'fee' | 'split' | 'other';
  symbol: string;
  isin?: string;
  name: string;
  quantity: number;
  price: number;
  amount: number;
  fees: number;
  currency: string;
  externalId?: string;
}

interface ParsedPosition {
  symbol: string;
  isin?: string;
  name: string;
  quantity: number;
  avgCost: number;
  totalCost: number;
  currency: string;
}

interface ParseResult {
  transactions: ParsedTransaction[];
  positions: ParsedPosition[];
  errors: string[];
  broker: string;
}

function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  let cleaned = value.toString().trim();
  cleaned = cleaned.replace(/[€$£¥₹]/g, '').trim();

  // Detect European format: comma as decimal separator (e.g., "9,9500" or "1.234,56")
  // European: has comma followed by digits at the end, may have periods as thousands separator
  const hasCommaDecimal = /,\d+$/.test(cleaned);
  // US format: period followed by digits at the end, may have commas as thousands separator
  const hasPeriodDecimal = /\.\d+$/.test(cleaned);

  if (hasCommaDecimal && !hasPeriodDecimal) {
    // European format: 1.234,56 -> 1234.56 or 9,9500 -> 9.9500
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (hasPeriodDecimal && !hasCommaDecimal) {
    // US format: 1,234.56 -> 1234.56
    cleaned = cleaned.replace(/,/g, '');
  } else if (hasCommaDecimal && hasPeriodDecimal) {
    // Ambiguous - check which comes last
    const lastComma = cleaned.lastIndexOf(',');
    const lastPeriod = cleaned.lastIndexOf('.');
    if (lastComma > lastPeriod) {
      // European: comma is decimal, periods are thousands
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US: period is decimal, commas are thousands
      cleaned = cleaned.replace(/,/g, '');
    }
  }

  const num = Number.parseFloat(cleaned);
  return Number.isNaN(num) ? 0 : num;
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const cleaned = value.trim();

  // DD-MM-YYYY format (DeGiro Spanish)
  const match = cleaned.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (match) {
    const day = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10) - 1;
    const year = Number.parseInt(match[3], 10);
    const date = new Date(year, month, day);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  const isoDate = new Date(cleaned);
  return Number.isNaN(isoDate.getTime()) ? null : isoDate;
}

function getCurrencyFromIsin(isin: string | undefined): string {
  if (!isin || isin.length < 2) return 'EUR';

  const countryCode = isin.substring(0, 2).toUpperCase();
  const currencyMap: Record<string, string> = {
    US: 'USD',
    CA: 'CAD',
    GB: 'GBP',
    AU: 'AUD',
    JP: 'JPY',
    CH: 'CHF',
    HK: 'HKD',
    DK: 'DKK',
    DE: 'EUR',
    FR: 'EUR',
    NL: 'EUR',
    ES: 'EUR',
    IT: 'EUR',
    IE: 'EUR',
    LU: 'EUR',
    JE: 'EUR', // Jersey (often EUR-traded ETFs)
  };

  return currencyMap[countryCode] || 'EUR';
}

function extractSymbol(product: string, isin?: string): string {
  const symbolMatch = product.match(/\(([A-Z0-9.]+)\)$/);
  if (symbolMatch) {
    return symbolMatch[1];
  }
  if (isin) {
    return isin;
  }
  return product.substring(0, 20).replace(/\s+/g, '_').toUpperCase();
}

function inferSecurityType(name: string): string {
  const nameLower = name.toLowerCase();
  if (
    nameLower.includes('etf') ||
    nameLower.includes('ishares') ||
    nameLower.includes('wisdomtree')
  ) {
    return 'etf';
  }
  if (nameLower.includes('index') || nameLower.includes('tracker')) {
    return 'index';
  }
  if (nameLower.includes('bond') || nameLower.includes('treasury')) {
    return 'bond';
  }
  return 'stock';
}

// Simple CSV parser
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split('\n').filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Handle quoted values with commas
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length && j < values.length; j++) {
      record[headers[j]] = values[j];
    }
    records.push(record);
  }

  return records;
}

// DeGiro Transactions.csv parser
function parseDegiroTransactions(content: string): ParseResult {
  const errors: string[] = [];
  const transactions: ParsedTransaction[] = [];

  const columnMappings: Record<string, string> = {
    Fecha: 'Date',
    Hora: 'Time',
    Producto: 'Product',
    ISIN: 'ISIN',
    'Bolsa de referencia': 'Exchange',
    Número: 'Quantity',
    Precio: 'Price',
    'Valor local': 'Local Value',
    'Valor EUR': 'Value',
    'Total EUR': 'Total',
    'ID Orden': 'Order ID',
  };

  const records = parseCSV(content);

  const normalizedRecords = records.map((record) => {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(record)) {
      const mappedKey = columnMappings[key] || key;
      normalized[mappedKey] = value;
    }
    return normalized;
  });

  for (let i = 0; i < normalizedRecords.length; i++) {
    const row = normalizedRecords[i];

    try {
      const quantity = parseNumber(row.Quantity);
      if (!row.Product || !row.Date || quantity === 0) continue;

      const date = parseDate(row.Date);
      if (!date) {
        errors.push(`Row ${i + 1}: Invalid date "${row.Date}"`);
        continue;
      }

      const price = parseNumber(row.Price);
      const value = parseNumber(row.Value || row['Local Value']);
      const isin = row.ISIN?.trim().toUpperCase();

      const transaction: ParsedTransaction = {
        date,
        type: quantity > 0 ? 'buy' : 'sell',
        symbol: extractSymbol(row.Product, isin),
        isin: isin?.length === 12 ? isin : undefined,
        name: row.Product,
        quantity: Math.abs(quantity),
        price: Math.abs(price),
        amount: Math.abs(value || quantity * price),
        fees: 0, // Fees are in separate rows in DeGiro
        currency: getCurrencyFromIsin(isin),
        externalId: row['Order ID']?.trim() || undefined,
      };

      transactions.push(transaction);
    } catch (error) {
      errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Calculate positions from transactions
  const positions = calculatePositions(transactions);

  return { transactions, positions, errors, broker: 'degiro' };
}

function calculatePositions(transactions: ParsedTransaction[]): ParsedPosition[] {
  const sorted = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());

  const positionMap = new Map<
    string,
    {
      symbol: string;
      isin?: string;
      name: string;
      quantity: number;
      totalCost: number;
      currency: string;
    }
  >();

  for (const tx of sorted) {
    if (tx.type !== 'buy' && tx.type !== 'sell') continue;

    const key = tx.isin || tx.symbol;
    const existing = positionMap.get(key);

    if (tx.type === 'buy') {
      if (existing) {
        existing.quantity += tx.quantity;
        existing.totalCost += tx.amount + tx.fees;
      } else {
        positionMap.set(key, {
          symbol: tx.symbol,
          isin: tx.isin,
          name: tx.name,
          quantity: tx.quantity,
          totalCost: tx.amount + tx.fees,
          currency: tx.currency,
        });
      }
    } else if (tx.type === 'sell' && existing) {
      const ratio = tx.quantity / existing.quantity;
      existing.totalCost *= 1 - ratio;
      existing.quantity -= tx.quantity;

      if (existing.quantity <= 0.0001) {
        positionMap.delete(key);
      }
    }
  }

  return Array.from(positionMap.values())
    .filter((p) => p.quantity > 0.0001)
    .map((p) => ({
      symbol: p.symbol,
      isin: p.isin,
      name: p.name,
      quantity: p.quantity,
      avgCost: p.totalCost / p.quantity,
      totalCost: p.totalCost,
      currency: p.currency,
    }));
}

// IBKR Activity Statement parser
interface ParsedDeposit {
  date: Date;
  description: string;
  amount: number;
  currency: string;
}

interface IBKRParseResult {
  deposits: ParsedDeposit[];
  cashBalance: number;
  baseCurrency: string;
  accountName: string;
  accountNumber: string;
  errors: string[];
}

function parseIBKRActivityStatement(content: string): IBKRParseResult {
  const errors: string[] = [];
  const deposits: ParsedDeposit[] = [];
  let cashBalance = 0;
  let baseCurrency = 'EUR';
  let accountName = 'Interactive Brokers Account';
  let accountNumber = '';

  const lines = content.split('\n');

  for (const line of lines) {
    const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));

    // Account Information
    if (parts[0] === 'Account Information' && parts[1] === 'Data') {
      if (parts[2] === 'Name') accountName = parts[3] || accountName;
      if (parts[2] === 'Account') accountNumber = parts[3] || '';
      if (parts[2] === 'Base Currency') baseCurrency = parts[3] || 'EUR';
    }

    // Cash balance from Net Asset Value
    // Header: Asset Class, Prior Total, Current Long, Current Short, Current Total, Change
    // Indices: [2]        [3]         [4]           [5]            [6]            [7]
    if (parts[0] === 'Net Asset Value' && parts[1] === 'Data' && parts[2]?.trim() === 'Cash') {
      cashBalance = parseNumber(parts[6]) || parseNumber(parts[4]); // Current Total or Current Long
    }

    // Deposits & Withdrawals
    if (parts[0] === 'Deposits & Withdrawals' && parts[1] === 'Data' && parts[2] !== 'Total') {
      const currency = parts[2];
      const settleDate = parts[3];
      const description = parts[4];
      const amount = parseNumber(parts[5]);

      if (settleDate && amount !== 0) {
        const date = new Date(settleDate);
        if (!Number.isNaN(date.getTime())) {
          deposits.push({
            date,
            description: description || 'Deposit/Withdrawal',
            amount,
            currency: currency || baseCurrency,
          });
        }
      }
    }
  }

  return {
    deposits,
    cashBalance,
    baseCurrency,
    accountName: accountNumber ? `${accountName} (${accountNumber})` : accountName,
    accountNumber,
    errors,
  };
}

function generateFingerprint(params: {
  accountId: string;
  securityId: string;
  date: Date;
  type: string;
  quantity: number;
  price: number;
  amount: number;
}): string {
  const data = [
    params.accountId,
    params.securityId,
    params.date.toISOString().split('T')[0],
    params.type,
    params.quantity.toFixed(8),
    params.price.toFixed(8),
    params.amount.toFixed(2),
  ].join('|');

  return createHash('sha256').update(data).digest('hex').slice(0, 32);
}

// ============================================================================
// Main Seed Function
// ============================================================================

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Get user ID - either from env var or look up from auth.users
  let userId = process.env.SEED_USER_ID;

  if (!userId) {
    // Try to find an existing user in auth.users
    const result = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1
    `;
    if (result.length > 0) {
      userId = result[0].id;
      console.log(`📝 Found existing user: ${userId}`);
    }
  }

  if (!userId) {
    // Fall back to test user ID
    userId = '00000000-0000-0000-0000-000000000001';
    console.log(`⚠️  No auth user found, using test user ID: ${userId}`);
    console.log('   To seed with your real user, set SEED_USER_ID env var or sign up first.');
  } else {
    console.log(`📝 Using user ID: ${userId}`);
  }

  // 2. Read DeGiro Transactions.csv
  const csvPath = join(process.cwd(), '../../.csv/Transactions.csv');
  console.log(`📂 Reading CSV from: ${csvPath}`);

  let csvContent: string;
  try {
    csvContent = readFileSync(csvPath, 'utf-8');
  } catch {
    console.error(
      '❌ Could not read Transactions.csv. Make sure .csv folder exists at monorepo root.',
    );
    process.exit(1);
  }

  // 3. Parse the CSV
  console.log('🔍 Parsing DeGiro transactions...');
  const parseResult = parseDegiroTransactions(csvContent);

  console.log(`  📊 Found ${parseResult.transactions.length} transactions`);
  console.log(`  📊 Calculated ${parseResult.positions.length} positions`);
  if (parseResult.errors.length > 0) {
    console.log(`  ⚠️  ${parseResult.errors.length} parsing errors`);
  }

  // 3b. Parse DeGiro Account.csv for cash balance
  const accountCsvPath = join(process.cwd(), '../../.csv/Account.csv');
  let degiroCashBalance = 0;
  try {
    const accountContent = readFileSync(accountCsvPath, 'utf-8');
    // Use parseCSV to handle quoted values with commas
    const records = parseCSV(accountContent);
    // Headers: Fecha,Hora,Fecha valor,Producto,ISIN,Descripción,Tipo,Variación,,Saldo,,ID Orden
    // Find first record with EUR balance (Saldo column)
    for (const record of records) {
      // The balance is in column "Saldo" with empty header before it for currency
      // Looking at the raw structure: Variación,<currency>,<value>,Saldo,<balance_currency>,<balance>
      const keys = Object.keys(record);
      // Find the Saldo value - it should be after a key containing 'EUR'
      for (let i = 0; i < keys.length - 1; i++) {
        if (record[keys[i]] === 'EUR') {
          const balanceValue = record[keys[i + 1]];
          if (balanceValue) {
            const parsed = parseNumber(balanceValue);
            if (parsed > 0) {
              degiroCashBalance = parsed;
              break;
            }
          }
        }
      }
      if (degiroCashBalance > 0) break;
    }
    console.log(`  💰 DeGiro EUR cash balance: €${degiroCashBalance.toFixed(2)}`);
  } catch {
    console.log('  ℹ️  No Account.csv found for cash balance');
  }

  // 4. Import into database
  console.log('💾 Importing into database...');

  // Get or create account
  let account = await prisma.account.findFirst({
    where: { userId, institution: 'degiro' },
  });

  if (!account) {
    account = await prisma.account.create({
      data: {
        userId,
        type: 'broker',
        institution: 'degiro',
        name: 'DeGiro Account',
        baseCurrency: 'EUR',
      },
    });
    console.log(`  ✅ Created account: ${account.id}`);
  } else {
    console.log(`  ℹ️  Using existing account: ${account.id}`);
  }

  // Save DeGiro cash balance
  if (degiroCashBalance > 0) {
    await prisma.accountBalance.upsert({
      where: {
        accountId_currency: {
          accountId: account.id,
          currency: 'EUR',
        },
      },
      create: {
        accountId: account.id,
        currency: 'EUR',
        balance: degiroCashBalance,
      },
      update: {
        balance: degiroCashBalance,
      },
    });
    console.log(`  ✅ Set DeGiro cash balance: €${degiroCashBalance.toFixed(2)}`);
  }

  // Create securities
  const securityMap = new Map<string, string>();
  let securitiesCreated = 0;

  for (const tx of parseResult.transactions) {
    const key = tx.isin || tx.symbol;
    if (securityMap.has(key)) continue;

    try {
      let security = tx.isin
        ? await prisma.security.findUnique({ where: { isin: tx.isin } })
        : await prisma.security.findFirst({ where: { symbol: tx.symbol } });

      if (!security) {
        security = await prisma.security.create({
          data: {
            symbol: tx.symbol,
            isin: tx.isin,
            name: tx.name,
            securityType: inferSecurityType(tx.name),
            currency: tx.currency,
          },
        });
        securitiesCreated++;
      }

      securityMap.set(key, security.id);
    } catch (error) {
      // Handle unique constraint violations for concurrent creates
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        const existing = tx.isin
          ? await prisma.security.findUnique({ where: { isin: tx.isin } })
          : await prisma.security.findFirst({ where: { symbol: tx.symbol } });
        if (existing) {
          securityMap.set(key, existing.id);
        }
      }
    }
  }

  console.log(`  ✅ Created ${securitiesCreated} securities`);

  // Import transactions
  let transactionsImported = 0;
  let transactionsSkipped = 0;

  for (const tx of parseResult.transactions) {
    const securityId = securityMap.get(tx.isin || tx.symbol);
    if (!securityId) continue;

    // Always generate fingerprint - externalId alone is not unique (partial fills share Order ID)
    const fingerprint = generateFingerprint({
      accountId: account.id,
      securityId,
      date: tx.date,
      type: tx.type,
      quantity: tx.quantity,
      price: tx.price,
      amount: tx.amount,
    });

    try {
      await prisma.transaction.create({
        data: {
          userId: userId,
          accountId: account.id,
          securityId,
          date: tx.date,
          type: tx.type,
          quantity: tx.quantity,
          price: tx.price,
          amount: tx.amount,
          fees: tx.fees,
          currency: tx.currency,
          // Don't use externalId - partial fills share the same Order ID
          fingerprint,
        },
      });
      transactionsImported++;
    } catch (error) {
      // Skip duplicates
      if (
        error instanceof Error &&
        (error.message.includes('Unique constraint') || error.message.includes('P2002'))
      ) {
        transactionsSkipped++;
      }
    }
  }

  console.log(
    `  ✅ Imported ${transactionsImported} transactions (${transactionsSkipped} duplicates skipped)`,
  );

  // Create/update positions
  let positionsCreated = 0;

  for (const pos of parseResult.positions) {
    const securityId = securityMap.get(pos.isin || pos.symbol);
    if (!securityId) continue;

    try {
      await prisma.position.upsert({
        where: {
          userId_accountId_securityId: {
            userId: userId,
            accountId: account.id,
            securityId,
          },
        },
        create: {
          userId: userId,
          accountId: account.id,
          securityId,
          quantity: pos.quantity,
          avgCost: pos.avgCost,
          totalCost: pos.totalCost,
          marketValue: pos.totalCost, // Use cost as placeholder until we have market prices
          unrealizedPnl: 0,
          currency: pos.currency,
        },
        update: {
          quantity: pos.quantity,
          avgCost: pos.avgCost,
          totalCost: pos.totalCost,
          marketValue: pos.totalCost, // Use cost as placeholder until we have market prices
          unrealizedPnl: 0,
        },
      });
      positionsCreated++;
    } catch {
      // Ignore errors
    }
  }

  console.log(`  ✅ Created/updated ${positionsCreated} positions`);

  // ============================================================================
  // IBKR Import
  // ============================================================================
  console.log('\n📂 Looking for IBKR Activity Statement...');

  const ibkrPath = join(process.cwd(), '../../.csv/U22002049_20250101_20251230.csv');
  let ibkrAccount = null;

  try {
    const ibkrContent = readFileSync(ibkrPath, 'utf-8');
    console.log('🔍 Parsing IBKR Activity Statement...');

    const ibkrResult = parseIBKRActivityStatement(ibkrContent);

    console.log(`  📊 Account: ${ibkrResult.accountName}`);
    console.log(`  📊 Cash Balance: ${ibkrResult.cashBalance} ${ibkrResult.baseCurrency}`);
    console.log(`  📊 Found ${ibkrResult.deposits.length} deposits/withdrawals`);

    // Create IBKR account
    ibkrAccount = await prisma.account.findFirst({
      where: { userId, institution: 'ibkr' },
    });

    if (!ibkrAccount) {
      ibkrAccount = await prisma.account.create({
        data: {
          userId,
          type: 'broker',
          institution: 'ibkr',
          name: ibkrResult.accountName,
          baseCurrency: ibkrResult.baseCurrency,
        },
      });
      console.log(`  ✅ Created IBKR account: ${ibkrAccount.id}`);
    } else {
      console.log(`  ℹ️  Using existing IBKR account: ${ibkrAccount.id}`);
    }

    // Create/update cash balance
    if (ibkrResult.cashBalance > 0) {
      await prisma.accountBalance.upsert({
        where: {
          accountId_currency: {
            accountId: ibkrAccount.id,
            currency: ibkrResult.baseCurrency,
          },
        },
        create: {
          accountId: ibkrAccount.id,
          currency: ibkrResult.baseCurrency,
          balance: ibkrResult.cashBalance,
        },
        update: {
          balance: ibkrResult.cashBalance,
        },
      });
      console.log(`  ✅ Set cash balance: ${ibkrResult.cashBalance} ${ibkrResult.baseCurrency}`);
    }

    // Note: IBKR deposits/withdrawals are broker account movements, not bank transactions
    // They're recorded in the cash balance above
    if (ibkrResult.deposits.length > 0) {
      console.log(`  ℹ️  Found ${ibkrResult.deposits.length} deposit/withdrawal records`);
    }
  } catch {
    console.log('  ℹ️  No IBKR file found or could not parse');
  }

  // ============================================================================
  // Sabadell Import (requires xlsx library - skipping for now)
  // ============================================================================
  console.log('\n📂 Checking for Sabadell XLS file...');
  console.log('  ⚠️  Sabadell XLS parsing requires xlsx library (binary format)');
  console.log('  ℹ️  To add support: bun add xlsx && implement XLS parser');

  console.log('\n✨ Seed completed successfully!');
  console.log(`
Summary:
  DeGiro:
    - Account: ${account.name} (${account.id})
    - Securities: ${securitiesCreated} new
    - Transactions: ${transactionsImported} imported
    - Positions: ${positionsCreated} created/updated
  IBKR:
    - Account: ${ibkrAccount ? ibkrAccount.name : 'Not imported'}
    - Cash: ${ibkrAccount ? 'Imported' : 'N/A'}
  `);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
